import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  runCompliantAgent,
  MAX_AGENT_RETRIES,
  type AgentFn,
  type ComplianceFailure,
} from "../orchestrator";
import type { AgentContext } from "@/agent/types/context";
import type { AgentAction } from "@/agent/types";

// A context where the agent is allowed to act:
//   - contact hours mocked to 10:00 (within 08–20)
//   - 10 days late (>= 7-day grace)
//   - rent 100_000¢, proposed fee 5_000¢ (at the cap)
const validCtx = {
  current_event: { days_late: 10 },
  tenant: { monthly_rent_eur_cents: 100_000, language: "de" },
  tenant_history: { prior_mahnungen_this_cycle: [] },
} as unknown as AgentContext;

beforeEach(() => {
  // Keep contact-hours check in "pass" state throughout
  vi.spyOn(Date.prototype, "getHours").mockReturnValue(10);
});

afterEach(() => vi.restoreAllMocks());

describe("runCompliantAgent — success on first try", () => {
  it("returns the action and retries=0 when all rules pass", async () => {
    const compliantAction = {
      kind: "late_fee_warning",
      fee_amount_eur_cents: 5_000,
      language: "de",
      message: "",
    } as AgentAction;
    const agentFn: AgentFn = vi.fn().mockResolvedValue(compliantAction);

    const result = await runCompliantAgent(validCtx, agentFn);

    expect(result.action).toEqual(compliantAction);
    expect(result.retries).toBe(0);
    expect(result.compliance_check.every((r) => r.result === "pass")).toBe(true);
    expect(agentFn).toHaveBeenCalledTimes(1);
    expect(agentFn).toHaveBeenCalledWith(validCtx, undefined);
  });
});

describe("runCompliantAgent — passes failure context on retry", () => {
  it("calls agentFn again with the prior failures when a rule fails", async () => {
    // First call: fee too high (6_000¢ > cap 5_000¢) → fail
    // Second call: fee within cap → pass
    const blocked = {
      kind: "late_fee_warning",
      fee_amount_eur_cents: 6_000,
      language: "de",
      message: "",
    } as AgentAction;
    const compliant = {
      kind: "late_fee_warning",
      fee_amount_eur_cents: 5_000,
      language: "de",
      message: "",
    } as AgentAction;
    const agentFn: AgentFn = vi.fn()
      .mockResolvedValueOnce(blocked)
      .mockResolvedValueOnce(compliant);

    const result = await runCompliantAgent(validCtx, agentFn);

    expect(result.action).toEqual(compliant);
    expect(result.retries).toBe(1);
    expect(agentFn).toHaveBeenCalledTimes(2);

    // Second call must receive the failure context
    const [, secondCallFailures] = (agentFn as ReturnType<typeof vi.fn>).mock.calls[1] as [
      AgentContext,
      ComplianceFailure[] | undefined,
    ];
    expect(secondCallFailures).toHaveLength(1);
    expect(secondCallFailures![0]!.failed_rules.some((r) => r.rule_id === "late_fee_cap")).toBe(true);
  });
});

describe("runCompliantAgent — escalate_human after max retries", () => {
  it("returns escalate_human after 3 consecutive rule failures", async () => {
    // Always returns a fee that exceeds the cap
    const alwaysBlocked = {
      kind: "late_fee_warning",
      fee_amount_eur_cents: 99_999,
      language: "de",
      message: "",
    } as AgentAction;
    const agentFn: AgentFn = vi.fn().mockResolvedValue(alwaysBlocked);

    const result = await runCompliantAgent(validCtx, agentFn);

    expect(result.action.kind).toBe("escalate_human");
    expect(result.retries).toBe(MAX_AGENT_RETRIES);
    expect(agentFn).toHaveBeenCalledTimes(MAX_AGENT_RETRIES);
  });

  it("carries the last failure's failed_rules in the result", async () => {
    const alwaysBlocked = {
      kind: "late_fee_warning",
      fee_amount_eur_cents: 99_999,
      language: "de",
      message: "",
    } as AgentAction;
    const agentFn: AgentFn = vi.fn().mockResolvedValue(alwaysBlocked);

    const result = await runCompliantAgent(validCtx, agentFn);

    expect(result.compliance_check.length).toBeGreaterThan(0);
    expect(result.compliance_check.some((r) => r.rule_id === "late_fee_cap")).toBe(true);
  });
});

describe("runCompliantAgent — N/A rules are excluded from check", () => {
  it("omits null results (rules that don't apply to the action)", async () => {
    // soft_nudge has language — only contact_hours + language_match apply; verzug_grace and late_fee_cap return null
    const action = { kind: "soft_nudge", language: "de", message: "" } as AgentAction;
    const agentFn: AgentFn = vi.fn().mockResolvedValue(action);

    const result = await runCompliantAgent(validCtx, agentFn);

    expect(result.action.kind).toBe("soft_nudge");
    expect(result.compliance_check.every((r) => r !== null)).toBe(true);
    expect(result.compliance_check.find((r) => r.rule_id === "verzug_grace")).toBeUndefined();
  });
});
