import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runAgent } from "../runner";
import { decisionClient, redactorClient } from "../llm";
import { buildAgentContext } from "../context-builder";
import { writeAuditEnvelope } from "../audit/writer";
import { db } from "@/db/client";
import type { AgentAction, AgentContext } from "../types";
import type Anthropic from "@anthropic-ai/sdk";

vi.mock("../llm", () => {
  return {
    MODELS: {
      decision: "claude-opus-4-7",
      redactor: "claude-haiku-4-5-20251001",
      renderer: "claude-haiku-4-5-20251001",
    },
    PROMPT_VERSIONS: {
      decision: "agent_decision_v1",
      redactor: "redactor_v1",
      renderer: "renderer_v1",
    },
    redactorClient: {
      messages: {
        create: vi.fn(),
      },
    },
    decisionClient: {
      messages: {
        create: vi.fn(),
      },
    },
  };
});

vi.mock("../context-builder", () => ({
  buildAgentContext: vi.fn(),
}));

vi.mock("../audit/writer", () => ({
  writeAuditEnvelope: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/db/client", () => {
  return {
    db: {
      update: vi.fn(),
    },
  };
});

const MOCK_CONTEXT = {
  case_id: "c1000000-0000-0000-0000-000000000001",
  tenant: {
    id: "t1000000-0000-0000-0000-000000000001",
    name: "Amina Benali",
    language: "en",
    monthly_rent_eur_cents: 100_000,
  },
  tenant_history: {
    rent_obligations: [],
    prior_mahnungen_this_cycle: [],
    prior_outreach_this_cycle: 0,
  },
  current_event: {
    type: "rent_late",
    days_late: 10,
    amount_eur_cents: 100_000,
    event_payload: {},
  },
  unstructured_inputs: [
    { source: "support_chat", content: "Original chat content." },
  ],
};

const createToolUseResponse = (action: AgentAction, reasoningSummary = "Valid reasoning text") => ({
  content: [
    {
      type: "tool_use",
      id: "call_123",
      name: "submit_decision",
      input: {
        case_id: "c1000000-0000-0000-0000-000000000001",
        action,
        confidence: 0.95,
        reasoning_summary: reasoningSummary,
        reasoning_chain: [
          { step: 1, thought: "Risk level is low based on tenant payment profile." },
          { step: 2, thought: "Sending nudges before escalating." },
        ],
        unstructured_sources: [
          { source: "support_chat", excerpt: "Excerpt text", weight: 0.8 },
        ],
        compliance_check: {
          overall: "pass",
          results: [],
        },
        fairness_check: {
          forbidden_keywords_present: false,
          counterfactual_agreed: null,
          overall: "pass",
        },
        audit: {
          timestamp: "2026-05-23T10:00:00Z",
          model: "claude-opus-4-7",
          prompt_version: "agent_decision_v1",
          policy_version: "compliance_v1",
        },
      },
    },
  ],
});

describe("runAgent Orchestrator Runner", () => {
  beforeEach(() => {
    vi.mocked(buildAgentContext).mockResolvedValue(MOCK_CONTEXT as unknown as AgentContext);
    // Mock hours to be in contact hours (e.g. 10:00 Berlin time)
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(10);

    // Set up database update mock
    const mockSet = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
      where: mockWhere,
    } as unknown as ReturnType<typeof db.update>);

    // Set up redactorClient mock
    vi.mocked(redactorClient.messages.create).mockImplementation(async () => {
      return {
        content: [{ type: "text", text: "anonymized support chat content" }],
      } as unknown as Anthropic.Message;
    });

    // Set up default decisionClient mock implementation (supporting German/English matching)
    vi.mocked(decisionClient.messages.create).mockImplementation(async (params) => {
      const messages = (params as { messages: { content: string }[] }).messages;
      const userMsg = messages[0]?.content || "";
      const isGerman = userMsg.includes('"language": "de"');
      const action = {
        kind: "soft_nudge",
        message: isGerman ? "Freundliche Erinnerung." : "Friendly reminder regarding outstanding invoice.",
        language: isGerman ? "de" : "en",
      } as AgentAction;
      return createToolUseResponse(action) as unknown as Anthropic.Message;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it("successfully performs a clean decision on the first run", async () => {
    const cleanAction: AgentAction = {
      kind: "soft_nudge",
      message: "Friendly reminder regarding outstanding invoice.",
      language: "en",
    };

    const result = await runAgent("c1000000-0000-0000-0000-000000000001", {
      withCounterfactual: true,
    });

    expect(result.action).toEqual(cleanAction);
    expect(result.compliance_check.overall).toBe("pass");
    expect(result.fairness_check.overall).toBe("pass");
    expect(result.fairness_check.counterfactual_agreed).toBe(true);

    expect(buildAgentContext).toHaveBeenCalledWith("c1000000-0000-0000-0000-000000000001");
    expect(redactorClient.messages.create).toHaveBeenCalled();
    expect(decisionClient.messages.create).toHaveBeenCalled();
    expect(writeAuditEnvelope).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });

  it("retries if the first decision fails compliance, and succeeds on the second try", async () => {
    const invalidAction: AgentAction = {
      kind: "late_fee_warning",
      fee_amount_eur_cents: 20_000, // 20% of rent, exceeds standard 5% cap rule
      message: "Proposed fee too high.",
      language: "en",
    };

    const validAction: AgentAction = {
      kind: "soft_nudge",
      message: "Friendly reminder regarding outstanding invoice.",
      language: "en",
    };

    // Override default mock with explicit sequence, cloning actions to prevent shared reference leak
    vi.mocked(decisionClient.messages.create).mockImplementation(
      vi.fn()
        .mockResolvedValueOnce(createToolUseResponse({ ...invalidAction }) as unknown as Anthropic.Message)
        .mockResolvedValueOnce(createToolUseResponse({ ...validAction }) as unknown as Anthropic.Message)
    );

    const result = await runAgent("c1000000-0000-0000-0000-000000000001");

    expect(result.action).toEqual(validAction);
    expect(result.compliance_check.overall).toBe("pass");
    expect(decisionClient.messages.create).toHaveBeenCalledTimes(2);
  });

  it("retries if the reasoning contains forbidden keywords, and succeeds on the second try", async () => {
    const compliantAction: AgentAction = {
      kind: "soft_nudge",
      message: "Friendly reminder regarding outstanding invoice.",
      language: "en",
    };

    // Override default mock with explicit sequence, cloning actions to prevent shared reference leak
    vi.mocked(decisionClient.messages.create).mockImplementation(
      vi.fn()
        .mockResolvedValueOnce(
          createToolUseResponse({ ...compliantAction }, "Checking ethnicity of the name") as unknown as Anthropic.Message,
        )
        .mockResolvedValueOnce(
          createToolUseResponse({ ...compliantAction }, "Normal behavior-based evaluation") as unknown as Anthropic.Message,
        )
    );

    const result = await runAgent("c1000000-0000-0000-0000-000000000001");

    expect(result.action).toEqual(compliantAction);
    expect(result.compliance_check.overall).toBe("pass");
    expect(result.fairness_check.overall).toBe("pass");
    expect(decisionClient.messages.create).toHaveBeenCalledTimes(2);
  });
});
