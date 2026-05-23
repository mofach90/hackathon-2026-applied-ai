# ADR 0004: Compliance Policy v1

- **Status:** Accepted
- **Date:** 2026-05-23
- **Deciders:** Mohamed Ayari, Aymen

## Context

The system needs to enforce German rental law constraints on every agent decision so the agent cannot reason its way around them. The compliance layer should:

- Be **hard-coded** (not LLM-controlled)
- Be **auditable** — every decision logged with which rules were checked and the result
- **Block illegal actions** and force the agent to pick an alternative
- Be **versioned** so historical audit records remain interpretable

> Disclaimer: this is hackathon-level. Real deployment needs lawyer + regulator review.

## Decision

Lock the **CompliancePolicy v1** as a TypeScript constant. Every agent action runs through `validateCompliance(action, context, policy)`, which returns a `ComplianceResult`. If `status === "fail"`, the action is blocked. The agent retries (max 3 attempts), then `escalate_human`.

```ts
export const COMPLIANCE_POLICY_V1: CompliancePolicy = {
  verzug_grace_days: 7,
  mahnung_levels_min_days_between: 14,
  mahnung_required_content: ["amount_due", "deadline", "consequences"],
  late_fee_max_pct_of_rent: 5,
  allowed_contact_hours: { start: 8, end: 20 },         // local TZ (Europe/Berlin)
  language_must_match_lease: true,
  formal_notice_requires_prior_mahnung: true,
  max_reminders_per_cycle: 3,
  policy_version: "v1",
};
```

## The 5 hard-coded rules (with German legal basis)

1. **Verzug grace** — late fees can only be applied ≥7 days after the rent due date. Basis: BGB §286 (Verzug requires either Mahnung or 30 days past due).
2. **Mahnung spacing** — minimum 14 days between Mahnung levels (1 → 2 → 3). Basis: Mahnverfahren conventions; courts reject hurried escalation.
3. **Late-fee cap** — late fee ≤ 5% of monthly rent per cycle. Basis: typical court interpretation of Verzugsschaden + reasonable damages.
4. **Contact hours** — agent contacts tenants only 08:00–20:00 local. Basis: courts have ruled non-emergency contact outside ~08:00–20:00 as unreasonable.
5. **Language match** — formal notices in the lease-signing language. Basis: defensibility of formal notices.

## Consequences

### Easier

- Auditors pull any `agent_case` row and see which rules were checked.
- Policy updates are versioned. Historical decisions are linked to the policy in force at the time.
- The agent gets immediate feedback when it proposes an illegal action and retries.

### Harder

- Policy changes need migration thinking. Old `agent_case` rows reference `policy_version: "v1"`; if we add v2 we don't retroactively re-evaluate.
- Edge cases not covered by 5 rules are unhandled (e.g. multi-property tenants — do reminders compound? v1 says no).

## Alternatives considered

- **Soft constraints in the LLM system prompt only.** Rejected: LLMs are weak at hard constraints under reasoning pressure.
- **Per-landlord policy in DB.** Rejected: out of scope for hackathon; schema + UI + change-history would eat a day.
- **3rd-party compliance API (Datev / Casavi).** Rejected: doesn't exist as a clean API; would be a partner integration.

## Implementation notes

### `ComplianceResult` type

```ts
type ComplianceResult = {
  status: "pass" | "fail" | "warn";
  rules_checked: Array<{
    rule_id: string;
    rule_description: string;
    result: "pass" | "fail" | "warn";
    note?: string;
  }>;
  blocked_reason?: string;
  suggested_alternative?: string;
}
```

### Rule check pattern

Each rule is a pure function `(action, context, policy) → RuleResult | null`. Returning `null` means "not applicable to this action."

```ts
type RuleCheck = (
  action: AgentAction,
  ctx: Context,
  policy: CompliancePolicy,
) => RuleResult | null;

const ruleChecks: Record<string, RuleCheck> = {
  contact_hours: (_, _ctx, policy) => {
    const localHour = nowInBerlin().getHours();
    const inBounds = localHour >= policy.allowed_contact_hours.start
                  && localHour < policy.allowed_contact_hours.end;
    return {
      rule_id: "contact_hours",
      rule_description: `Contact 08:00–20:00 local`,
      result: inBounds ? "pass" : "fail",
      note: `current local hour ${localHour}`,
    };
  },

  verzug_grace: (action, ctx, policy) => {
    if (action.kind !== "late_fee_warning") return null;
    const daysLate = ctx.current_event?.days_late ?? 0;
    return {
      rule_id: "verzug_grace",
      rule_description: `Late fee requires ${policy.verzug_grace_days}-day grace post-due`,
      result: daysLate >= policy.verzug_grace_days ? "pass" : "fail",
      note: daysLate < policy.verzug_grace_days
        ? `only ${daysLate} days late; grace is ${policy.verzug_grace_days}`
        : undefined,
    };
  },

  late_fee_cap: (action, ctx, policy) => {
    if (action.kind !== "late_fee_warning") return null;
    const rent = ctx.tenant?.monthly_rent_eur ?? 0;
    const max = (policy.late_fee_max_pct_of_rent / 100) * rent;
    return {
      rule_id: "late_fee_cap",
      rule_description: `Late fee ≤ ${policy.late_fee_max_pct_of_rent}% of monthly rent`,
      result: action.fee_amount_eur <= max ? "pass" : "fail",
      note: action.fee_amount_eur > max
        ? `proposed €${action.fee_amount_eur} exceeds cap €${max}`
        : undefined,
    };
  },

  mahnung_spacing: (action, ctx, policy) => {
    if (action.kind !== "formal_notice") return null;
    // Look back at prior Mahnungen for this rent cycle
    const priorMahnungen = ctx.history?.prior_mahnungen_this_cycle ?? [];
    if (action.level === 1) return { rule_id: "mahnung_spacing", result: "pass", rule_description: "first Mahnung — no spacing requirement" };
    const lastMahnungAt = priorMahnungen.at(-1)?.sent_at;
    if (!lastMahnungAt) return { rule_id: "mahnung_spacing", result: "fail", rule_description: "level 2+ requires prior Mahnung", blocked_reason: "no prior Mahnung found" };
    const daysSince = daysBetween(new Date(lastMahnungAt), new Date());
    return {
      rule_id: "mahnung_spacing",
      rule_description: `≥${policy.mahnung_levels_min_days_between} days between Mahnung levels`,
      result: daysSince >= policy.mahnung_levels_min_days_between ? "pass" : "fail",
      note: `${daysSince} days since prior Mahnung`,
    };
  },

  max_reminders_per_cycle: (action, ctx, policy) => {
    if (!["soft_nudge", "friendly_check_in", "late_fee_warning", "formal_notice"].includes(action.kind)) return null;
    const count = ctx.current_event?.prior_outreach_this_cycle ?? 0;
    return {
      rule_id: "max_reminders_per_cycle",
      rule_description: `Max ${policy.max_reminders_per_cycle} reminders per cycle`,
      result: count < policy.max_reminders_per_cycle ? "pass" : "fail",
      note: `${count} prior this cycle`,
    };
  },

  language_match: (action, ctx, policy) => {
    if (!("language" in action)) return null;
    if (!policy.language_must_match_lease) return null;
    const tenantLang = ctx.tenant?.language;
    return {
      rule_id: "language_match",
      rule_description: "Message language matches lease language",
      result: action.language === tenantLang ? "pass" : "fail",
      note: `message ${action.language} vs lease ${tenantLang}`,
    };
  },
};
```

### Orchestration

```ts
const MAX_AGENT_RETRIES = 3;

async function decideAndExecute(trigger: Trigger): Promise<void> {
  let attempt = 0;
  let priorFailure: PriorFailure | undefined;

  while (attempt < MAX_AGENT_RETRIES) {
    const response = await runAgent(trigger, priorFailure);
    const compliance = validateCompliance(response.decision, response.context_used, COMPLIANCE_POLICY_V1);
    const fairness = validateFairness(response);

    if (compliance.status === "pass" && fairness.status === "pass") {
      await persistCase({ ...response, compliance_check: compliance, fairness_check: fairness });
      await dispatchAction(response.decision);
      return;
    }

    attempt++;
    priorFailure = { compliance, fairness };
  }

  await escalateToHuman({
    trigger,
    reason: "compliance/fairness retry budget exhausted",
    last_attempt: priorFailure,
  });
}
```

### Demo "blocked" moment

For the demo, we set up a tenant 3 days late so the agent's first instinct (`late_fee_warning`) is blocked by `verzug_grace`. The audit panel shows:

```
attempt 1: late_fee_warning → BLOCKED by verzug_grace (only 3 days late)
attempt 2: soft_nudge → PASS
```

That visible retry is the proof that the layer is real.

## Open questions

- Add `max_installments_per_plan` (suggest 4) to the policy — small follow-up.
- Override flow: property manager can manually approve a blocked action with a reason → logged as `compliance_override`. Not in v1 demo.
- Per-landlord policy override (some want 5-day grace, some want 14)? Defer to v2.

## References

- `docs/brainstorm/2026-05-23-compliance-and-audit.md` — full detail + worked examples
- `docs/brainstorm/2026-05-23-decision-space.md` — `ComplianceResult` type
- BGB §286 (Verzug): https://www.gesetze-im-internet.de/bgb/__286.html
- ADR-0001 — agent action surface
- ADR-0005 — bias defense (runs alongside compliance check)
- ADR-0007 — DB schema for `agent_case`
