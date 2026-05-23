import { describe, it, expect } from "vitest";
import { SUBMIT_DECISION_TOOL } from "../tool-schema";
import { AgentResponseSchema } from "../../types/response";

const VALID_FIXTURE = {
  case_id: "123e4567-e89b-12d3-a456-426614174000",
  action: {
    kind: "soft_nudge",
    message: "Hi, just a reminder your rent is due.",
    language: "en",
  },
  confidence: 0.85,
  reasoning_summary: "Tenant is 2 days overdue with no prior issues.",
  reasoning_chain: [
    { step: 1, thought: "Overdue by 2 days — within grace period." },
    { step: 2, thought: "No prior late payments — low risk." },
    { step: 3, thought: "Soft nudge is appropriate first action." },
  ],
  unstructured_sources: [
    { source: "payment_history", excerpt: "No late payments in 12 months", weight: 0.9 },
  ],
  alternatives_considered: [],
  compliance_check: {
    overall: "pass",
    results: [
      {
        rule_id: "verzug_grace",
        rule_description: "Must wait 14 days before formal Mahnung.",
        result: "pass",
      },
    ],
  },
  fairness_check: {
    forbidden_keywords_present: false,
    counterfactual_agreed: null,
    overall: "pass",
  },
  audit: {
    timestamp: "2026-05-23T10:00:00.000Z",
    model: "claude-sonnet-4-6",
    prompt_version: "system_v1",
    policy_version: "compliance_v1",
  },
};

describe("SUBMIT_DECISION_TOOL schema", () => {
  it("has the correct tool name", () => {
    expect(SUBMIT_DECISION_TOOL.name).toBe("submit_decision");
  });

  it("declares all required fields in input_schema", () => {
    const required = SUBMIT_DECISION_TOOL.input_schema.required as string[];
    expect(required).toContain("case_id");
    expect(required).toContain("action");
    expect(required).toContain("confidence");
    expect(required).toContain("reasoning_chain");
    expect(required).toContain("compliance_check");
    expect(required).toContain("fairness_check");
    expect(required).toContain("audit");
  });

  it("action schema lists all 8 action kinds", () => {
    const actionProp = (SUBMIT_DECISION_TOOL.input_schema.properties as Record<string, unknown>)[
      "action"
    ] as { properties: { kind: { enum: string[] } } };
    const kinds = actionProp.properties.kind.enum;
    expect(kinds).toContain("soft_nudge");
    expect(kinds).toContain("friendly_check_in");
    expect(kinds).toContain("plan_negotiation");
    expect(kinds).toContain("late_fee_warning");
    expect(kinds).toContain("formal_notice");
    expect(kinds).toContain("escalate_human");
    expect(kinds).toContain("auto_payout_vendor");
    expect(kinds).toContain("auto_disburse_landlord");
    expect(kinds).toHaveLength(8);
  });

  it("valid fixture passes AgentResponseSchema", () => {
    const result = AgentResponseSchema.safeParse(VALID_FIXTURE);
    expect(result.success).toBe(true);
  });

  it("fixture missing required field fails AgentResponseSchema", () => {
    const { case_id, ...incomplete } = VALID_FIXTURE;
    void case_id;
    const result = AgentResponseSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("fixture with invalid confidence fails AgentResponseSchema", () => {
    const result = AgentResponseSchema.safeParse({ ...VALID_FIXTURE, confidence: 1.5 });
    expect(result.success).toBe(false);
  });

  it("fixture with invalid action kind fails AgentResponseSchema", () => {
    const result = AgentResponseSchema.safeParse({
      ...VALID_FIXTURE,
      action: { kind: "unknown_action" },
    });
    expect(result.success).toBe(false);
  });
});
