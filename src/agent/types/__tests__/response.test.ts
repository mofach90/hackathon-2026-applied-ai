import { describe, expect, it } from "vitest";
import { AgentResponseSchema } from "../response";

const VALID_RESPONSE = {
  case_id: "550e8400-e29b-41d4-a716-446655440000",
  action: {
    kind: "soft_nudge" as const,
    message: "Hi, just a reminder your rent is due.",
    language: "de",
  },
  confidence: 0.92,
  reasoning_summary: "Tenant has strong payment history; a soft nudge is appropriate.",
  reasoning_chain: [
    {
      step: 1,
      thought: "Tenant has paid on time 23 of 24 months.",
      evidence: ["rent_obligation.history"],
    },
    { step: 2, thought: "First miss — low urgency. Soft nudge is proportionate." },
  ],
  unstructured_sources: [
    { source: "support_chat", excerpt: "Tenant asked about payment portal.", weight: 0.3 },
  ],
  alternatives_considered: [
    { action_kind: "friendly_check_in", reason_not_chosen: "Tenant history is strong; check-in is overkill." },
  ],
  compliance_check: {
    overall: "pass" as const,
    results: [
      {
        rule_id: "contact_hours" as const,
        rule_description: "Contact 08:00–20:00 local",
        result: "pass" as const,
      },
    ],
  },
  fairness_check: {
    forbidden_keywords_present: false,
    counterfactual_agreed: null,
    overall: "pass" as const,
  },
  audit: {
    timestamp: "2026-05-23T10:00:00Z",
    model: "claude-opus-4-7",
    prompt_version: "agent_decision_v1",
    policy_version: "v1",
  },
};

describe("AgentResponseSchema", () => {
  it("parses a valid envelope", () => {
    const result = AgentResponseSchema.safeParse(VALID_RESPONSE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action.kind).toBe("soft_nudge");
      expect(result.data.confidence).toBe(0.92);
      expect(result.data.compliance_check.overall).toBe("pass");
    }
  });

  it("rejects a malformed envelope (missing case_id)", () => {
    const bad = { ...VALID_RESPONSE, case_id: undefined };
    const result = AgentResponseSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects confidence out of range", () => {
    const bad = { ...VALID_RESPONSE, confidence: 1.5 };
    const result = AgentResponseSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects unknown action kind", () => {
    const bad = { ...VALID_RESPONSE, action: { kind: "unknown_action", message: "x" } };
    const result = AgentResponseSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects invalid case_id (not a uuid)", () => {
    const bad = { ...VALID_RESPONSE, case_id: "not-a-uuid" };
    const result = AgentResponseSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
