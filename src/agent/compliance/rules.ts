import type { AgentAction } from "@/agent/types";
import type { ComplianceResult } from "@/agent/types/compliance";
import type { AgentContext } from "@/agent/types/context";
import type { CompliancePolicy } from "./policy";

export type RuleCheck = (
  action: AgentAction,
  ctx: AgentContext,
  policy: CompliancePolicy,
) => ComplianceResult | null;

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / msPerDay);
}

function nowBerlinHour(): number {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }),
  ).getHours();
}

function feeCap(rentCents: number, bps: number): number {
  return Math.round((rentCents * bps) / 10_000);
}

const contactHours: RuleCheck = (_action, _ctx, policy) => {
  const hour = nowBerlinHour();
  const inBounds =
    hour >= policy.allowed_contact_hours.start &&
    hour < policy.allowed_contact_hours.end;
  return {
    rule_id: "contact_hours",
    rule_description: `Contact ${policy.allowed_contact_hours.start}:00–${policy.allowed_contact_hours.end}:00 local`,
    result: inBounds ? "pass" : "fail",
    note: inBounds ? undefined : `current local hour ${hour}`,
  };
};

const verzugGrace: RuleCheck = (action, ctx, policy) => {
  if (action.kind !== "late_fee_warning") return null;
  const daysLate = ctx.current_event.days_late ?? 0;
  const pass = daysLate >= policy.verzug_grace_days;
  return {
    rule_id: "verzug_grace",
    rule_description: `Late fee requires ${policy.verzug_grace_days}-day grace post-due`,
    result: pass ? "pass" : "fail",
    note: pass
      ? undefined
      : `only ${daysLate} days late; grace is ${policy.verzug_grace_days}`,
  };
};

const lateFeeCapRule: RuleCheck = (action, ctx, policy) => {
  if (action.kind !== "late_fee_warning") return null;
  const rent = ctx.tenant.monthly_rent_eur_cents;
  const cap = feeCap(rent, policy.late_fee_max_bps_of_rent);
  const pass = action.fee_amount_eur_cents <= cap;
  return {
    rule_id: "late_fee_cap",
    rule_description: `Late fee ≤ ${policy.late_fee_max_bps_of_rent / 100}% of monthly rent`,
    result: pass ? "pass" : "fail",
    note: pass
      ? undefined
      : `proposed ${action.fee_amount_eur_cents}¢ exceeds cap ${cap}¢`,
  };
};

const mahnungSpacing: RuleCheck = (action, ctx, policy) => {
  if (action.kind !== "formal_notice") return null;
  const priorMahnungen = ctx.tenant_history.prior_mahnungen_this_cycle;

  if (action.level === 1) {
    return {
      rule_id: "mahnung_spacing",
      rule_description: "First Mahnung — no spacing requirement",
      result: "pass",
    };
  }

  const lastMahnung = priorMahnungen.at(-1);
  if (!lastMahnung) {
    return {
      rule_id: "mahnung_spacing",
      rule_description: `≥${policy.mahnung_levels_min_days_between} days between Mahnung levels`,
      result: "fail",
      note: "level 2+ requires prior Mahnung but none found",
    };
  }

  const daysSince = daysBetween(new Date(lastMahnung.sent_at), new Date());
  const pass = daysSince >= policy.mahnung_levels_min_days_between;
  return {
    rule_id: "mahnung_spacing",
    rule_description: `≥${policy.mahnung_levels_min_days_between} days between Mahnung levels`,
    result: pass ? "pass" : "fail",
    note: pass
      ? undefined
      : `only ${daysSince} days since prior Mahnung`,
  };
};

const languageMatch: RuleCheck = (action, ctx, policy) => {
  if (!("language" in action)) return null;
  if (!policy.language_must_match_lease) return null;
  const tenantLang = ctx.tenant.language;
  const pass = (action as { language: string }).language === tenantLang;
  return {
    rule_id: "language_match",
    rule_description: "Message language matches lease language",
    result: pass ? "pass" : "fail",
    note: pass
      ? undefined
      : `message lang=${(action as { language: string }).language} vs lease=${tenantLang}`,
  };
};

export const ruleChecks: Record<string, RuleCheck> = {
  contact_hours: contactHours,
  verzug_grace: verzugGrace,
  late_fee_cap: lateFeeCapRule,
  mahnung_spacing: mahnungSpacing,
  language_match: languageMatch,
};
