import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AgentContext } from "@/agent/types/context";
import type { AgentAction } from "@/agent/types";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const CASE_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TENANT_ID = "c1000000-0000-0000-0000-000000000001";

const mockCtx: AgentContext = {
  case_id: CASE_ID,
  tenant: {
    id: TENANT_ID,
    name: "Amina Benali",
    language: "fr",
    monthly_rent_eur_cents: 120_000,
  },
  tenant_history: {
    rent_obligations: [],
    prior_mahnungen_this_cycle: [],
    prior_outreach_this_cycle: 0,
  },
  current_event: {
    type: "rent_late",
    days_late: 10,
    amount_eur_cents: 120_000,
    event_payload: {},
  },
  unstructured_inputs: [{ source: "support_chat", content: "Tenant called about payment." }],
};

const cleanAction: AgentAction = {
  kind: "soft_nudge",
  message: "Please pay your rent.",
  language: "fr",
};

const complianceFailAction: AgentAction = {
  kind: "late_fee_warning",
  fee_amount_eur_cents: 999_999, // exceeds cap — will fail compliance
  message: "Huge fee",
  language: "fr",
};

const compliancePassAction: AgentAction = {
  kind: "late_fee_warning",
  fee_amount_eur_cents: 5_000, // within cap
  message: "Small fee",
  language: "fr",
};

function makeAgentResponse(action: AgentAction) {
  return {
    case_id: CASE_ID,
    action,
    confidence: 0.9,
    reasoning_summary: "Tenant is 10 days late, sending a nudge.",
    reasoning_chain: [{ step: 1, thought: "Tenant is overdue", evidence: [] }],
    unstructured_sources: [],
    alternatives_considered: [],
    compliance_check: {
      overall: "pass" as const,
      results: [],
    },
    fairness_check: {
      forbidden_keywords_present: false,
      counterfactual_agreed: null,
      overall: "pass" as const,
    },
    audit: {
      timestamp: new Date().toISOString(),
      model: "claude-opus-4-7",
      prompt_version: "system_v1",
      policy_version: "v1",
    },
  };
}

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before any imports of runner.ts
// ---------------------------------------------------------------------------

vi.mock("@/agent/context-builder", () => ({
  buildAgentContext: vi.fn(),
}));

vi.mock("@/agent/llm", () => ({
  MODELS: { decision: "claude-opus-4-7", redactor: "claude-haiku-4-5-20251001" },
  PROMPT_VERSIONS: { decision: "agent_decision_v1" },
  decisionClient: {
    model: "claude-opus-4-7",
    messages: { create: vi.fn() },
  },
  redactorClient: {
    model: "claude-haiku-4-5-20251001",
    messages: { create: vi.fn() },
  },
}));

vi.mock("@/agent/redactor", () => ({
  redactPII: vi.fn(async (text: string) => text), // identity mock
}));

vi.mock("@/agent/audit/writer", () => ({
  writeAuditEnvelope: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/db/client", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock("@/lib/env", () => ({
  env: { ANTHROPIC_API_KEY: "test-key" },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runAgent", () => {
  beforeEach(async () => {
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(10);

    const { buildAgentContext } = await import("@/agent/context-builder");
    vi.mocked(buildAgentContext).mockResolvedValue(mockCtx);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("(a) returns AgentResponse when Claude returns a clean submit_decision", async () => {
    const { decisionClient } = await import("@/agent/llm");
    const mockCreate = vi.mocked(decisionClient.messages.create);

    const cleanResponse = makeAgentResponse(cleanAction);
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "tool_1",
          name: "submit_decision",
          input: cleanResponse,
        },
      ],
      id: "msg_1",
      model: "claude-opus-4-7",
      role: "assistant",
      stop_reason: "tool_use",
      stop_sequence: null,
      type: "message",
      usage: { input_tokens: 100, output_tokens: 200 },
    } as never);

    const { runAgent } = await import("@/agent/runner");
    const result = await runAgent(CASE_ID);

    expect(result).toBeDefined();
    expect(result.case_id).toBe(CASE_ID);
    expect(result.action.kind).toBe("soft_nudge");
    expect(result.fairness_check.forbidden_keywords_present).toBe(false);
  });

  it("(b) retries on compliance failure and succeeds on second call", async () => {
    const { decisionClient } = await import("@/agent/llm");
    const mockCreate = vi.mocked(decisionClient.messages.create);

    // First compliance call → fail action; second call → pass action;
    // The runner also calls Claude for the "final response" — return pass for that too.
    mockCreate
      .mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "tool_1",
            name: "submit_decision",
            input: makeAgentResponse(complianceFailAction),
          },
        ],
        id: "msg_1",
        model: "claude-opus-4-7",
        role: "assistant",
        stop_reason: "tool_use",
        stop_sequence: null,
        type: "message",
        usage: { input_tokens: 100, output_tokens: 200 },
      } as never)
      .mockResolvedValue({
        content: [
          {
            type: "tool_use",
            id: "tool_2",
            name: "submit_decision",
            input: makeAgentResponse(compliancePassAction),
          },
        ],
        id: "msg_2",
        model: "claude-opus-4-7",
        role: "assistant",
        stop_reason: "tool_use",
        stop_sequence: null,
        type: "message",
        usage: { input_tokens: 100, output_tokens: 200 },
      } as never);

    const { runAgent } = await import("@/agent/runner");
    const result = await runAgent(CASE_ID);

    // Should have succeeded (not escalated)
    expect(result.action.kind).not.toBe("escalate_human");
    // Claude was called at least twice (once for failing attempt, once for passing)
    expect(mockCreate).toHaveBeenCalledTimes(3); // 1 fail + 1 pass (compliance loop) + 1 final
  });
});
