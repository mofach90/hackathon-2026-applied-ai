import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentAction } from "@/agent/types";
import type { AgentContext } from "@/agent/types/context";
import { COMPLIANCE_POLICY_V1 } from "../policy";
import { ruleChecks } from "../rules";

const baseCtx = {
  current_event: { days_late: 0 },
  tenant: { monthly_rent_eur_cents: 100_000, language: "de" },
  tenant_history: { prior_mahnungen_this_cycle: [] },
} as unknown as AgentContext;

const softNudgeDe = { kind: "soft_nudge", language: "de", message: "" } as AgentAction;
const softNudgeEn = { kind: "soft_nudge", language: "en", message: "" } as AgentAction;
const escalateHuman = { kind: "escalate_human", urgency: "low", reason: "test" } as AgentAction;

function getRule(name: keyof typeof ruleChecks) {
  const rule = ruleChecks[name];

  if (!rule) {
    throw new Error(`Missing rule check: ${name}`);
  }

  return rule;
}

// ── contact_hours ────────────────────────────────────────────────────────────

describe("contact_hours", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("passes during allowed hours (10:00 Berlin)", () => {
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(10);
    const result = getRule("contact_hours")(softNudgeDe, baseCtx, COMPLIANCE_POLICY_V1);
    expect(result?.result).toBe("pass");
  });

  it("fails before allowed hours (07:00 Berlin)", () => {
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(7);
    const result = getRule("contact_hours")(softNudgeDe, baseCtx, COMPLIANCE_POLICY_V1);
    expect(result?.result).toBe("fail");
  });

  it("fails at or after end hour (20:00 Berlin)", () => {
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(20);
    const result = getRule("contact_hours")(softNudgeDe, baseCtx, COMPLIANCE_POLICY_V1);
    expect(result?.result).toBe("fail");
  });
});

// ── verzug_grace ─────────────────────────────────────────────────────────────

describe("verzug_grace", () => {
  it("passes when days_late >= grace period", () => {
    const action = {
      kind: "late_fee_warning",
      fee_amount_eur_cents: 100,
      language: "de",
      message: "",
    } as AgentAction;
    const ctx = { ...baseCtx, current_event: { days_late: 7 } } as unknown as AgentContext;
    const result = getRule("verzug_grace")(action, ctx, COMPLIANCE_POLICY_V1);
    expect(result?.result).toBe("pass");
  });

  it("fails when days_late < grace period", () => {
    const action = {
      kind: "late_fee_warning",
      fee_amount_eur_cents: 100,
      language: "de",
      message: "",
    } as AgentAction;
    const ctx = { ...baseCtx, current_event: { days_late: 3 } } as unknown as AgentContext;
    const result = getRule("verzug_grace")(action, ctx, COMPLIANCE_POLICY_V1);
    expect(result?.result).toBe("fail");
  });

  it("returns null for non-late_fee_warning actions (N/A)", () => {
    const result = getRule("verzug_grace")(softNudgeDe, baseCtx, COMPLIANCE_POLICY_V1);
    expect(result).toBeNull();
  });
});

// ── late_fee_cap ──────────────────────────────────────────────────────────────

describe("late_fee_cap", () => {
  // rent = 100_000 cents, cap = 5% = 5_000 cents

  it("passes when fee is within cap", () => {
    const action = {
      kind: "late_fee_warning",
      fee_amount_eur_cents: 5_000,
      language: "de",
      message: "",
    } as AgentAction;
    const result = getRule("late_fee_cap")(action, baseCtx, COMPLIANCE_POLICY_V1);
    expect(result?.result).toBe("pass");
  });

  it("fails when fee exceeds cap", () => {
    const action = {
      kind: "late_fee_warning",
      fee_amount_eur_cents: 5_001,
      language: "de",
      message: "",
    } as AgentAction;
    const result = getRule("late_fee_cap")(action, baseCtx, COMPLIANCE_POLICY_V1);
    expect(result?.result).toBe("fail");
  });

  it("returns null for non-late_fee_warning actions (N/A)", () => {
    const result = getRule("late_fee_cap")(softNudgeDe, baseCtx, COMPLIANCE_POLICY_V1);
    expect(result).toBeNull();
  });
});

// ── mahnung_spacing ───────────────────────────────────────────────────────────

describe("mahnung_spacing", () => {
  it("always passes for level 1 (no prior required)", () => {
    const action = { kind: "formal_notice", level: 1, language: "de", message: "" } as AgentAction;
    const result = getRule("mahnung_spacing")(action, baseCtx, COMPLIANCE_POLICY_V1);
    expect(result?.result).toBe("pass");
  });

  it("passes for level 2 when prior Mahnung is >= 14 days ago", () => {
    const longAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const ctx = {
      ...baseCtx,
      tenant_history: { prior_mahnungen_this_cycle: [{ sent_at: longAgo }] },
    } as unknown as AgentContext;
    const action = { kind: "formal_notice", level: 2, language: "de", message: "" } as AgentAction;
    const result = getRule("mahnung_spacing")(action, ctx, COMPLIANCE_POLICY_V1);
    expect(result?.result).toBe("pass");
  });

  it("fails for level 2 when prior Mahnung is < 14 days ago", () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const ctx = {
      ...baseCtx,
      tenant_history: { prior_mahnungen_this_cycle: [{ sent_at: recent }] },
    } as unknown as AgentContext;
    const action = { kind: "formal_notice", level: 2, language: "de", message: "" } as AgentAction;
    const result = getRule("mahnung_spacing")(action, ctx, COMPLIANCE_POLICY_V1);
    expect(result?.result).toBe("fail");
  });

  it("fails for level 2 when no prior Mahnung exists", () => {
    const action = { kind: "formal_notice", level: 2, language: "de", message: "" } as AgentAction;
    const result = getRule("mahnung_spacing")(action, baseCtx, COMPLIANCE_POLICY_V1);
    expect(result?.result).toBe("fail");
  });

  it("returns null for non-formal_notice actions (N/A)", () => {
    const result = getRule("mahnung_spacing")(softNudgeDe, baseCtx, COMPLIANCE_POLICY_V1);
    expect(result).toBeNull();
  });
});

// ── language_match ────────────────────────────────────────────────────────────

describe("language_match", () => {
  it("passes when message language matches lease language", () => {
    const result = getRule("language_match")(softNudgeDe, baseCtx, COMPLIANCE_POLICY_V1);
    expect(result?.result).toBe("pass");
  });

  it("fails when message language differs from lease language", () => {
    const result = getRule("language_match")(softNudgeEn, baseCtx, COMPLIANCE_POLICY_V1);
    expect(result?.result).toBe("fail");
  });

  it("returns null for actions without a language field (N/A)", () => {
    const result = getRule("language_match")(escalateHuman, baseCtx, COMPLIANCE_POLICY_V1);
    expect(result).toBeNull();
  });
});
