# ADR 0001: Agent Decision Space + Stripe API Mapping

- **Status:** Accepted
- **Date:** 2026-05-23
- **Deciders:** Mohamed Ayari, Aymen

## Context

The RentPilot agent reacts to events (rent late, vendor invoice received, scheduled disbursement, compliance trigger). Without a fixed, typed action surface, every part of the system — UI, audit log, Stripe adapter — invents its own assumptions. That leads to drift, untestable code, and an audit log that nobody can query.

We need:

- A finite, enumerable set of actions
- Each action mapping cleanly to either a Stripe API call or an internal side effect
- A unified response envelope so logging + UI + dispatch are uniform
- Type safety so the action dispatcher cannot be misused

## Decision

We define **8 agent actions** as a TypeScript discriminated union. Each action carries a typed payload. The agent always returns a unified `AgentResponse` envelope containing the chosen action plus reasoning, compliance/fairness check results, and audit metadata.

### The 8 actions

| Action | Trigger | Stripe call |
|---|---|---|
| `soft_nudge` | Trustworthy tenant, first miss | — |
| `friendly_check_in` | Low signal (new tenant) | optional `paymentLinks.create` |
| `plan_negotiation` | Tenant cannot pay full | `invoices.create` ×N |
| `late_fee_warning` | Past grace period | `invoiceItems.create` |
| `formal_notice` | Chronic + ignored prior reminders | `invoices.update(metadata.mahnung_level)` |
| `escalate_human` | Agent unsure / out of policy | none (internal `escalations` table) |
| `auto_payout_vendor` | Verified vendor invoice | `transfers.create({ destination: vendor })` |
| `auto_disburse_landlord` | Scheduled sweep | `transfers.create({ destination: landlord, application_fee_amount })` |

### The `AgentResponse` envelope (summary)

```ts
type AgentResponse = {
  case_id: string;
  trigger: { type: TriggerType; event_payload: object };
  context_used: SanitizedContext;
  unstructured_sources: Array<UnstructuredSource>;  // what the agent read (PII-redacted)
  reasoning_chain: Array<{ step: number; thought: string; evidence?: string[] }>;
  decision: AgentAction;                            // the discriminated union
  confidence: number;                               // 0..1
  alternatives_considered: Array<{ action_kind: string; reason_not_chosen: string }>;
  compliance_check: ComplianceResult;               // see ADR-0004
  fairness_check: FairnessResult;                   // see ADR-0005
  audit: { timestamp; model; prompt_version; policy_version };
}
```

The full type definitions live in `src/agent/types.ts` (proposed) and are mirrored in `docs/brainstorm/2026-05-23-decision-space.md`.

## Consequences

### Easier

- UI renders any agent response from one shape.
- `agent_case` audit table is one JSONB schema — queryable with SQL.
- Action dispatcher is a single `switch` over `decision.kind`. Exhaustiveness is enforced by TypeScript's `never` check.
- Adding a 9th action is mechanical: extend the union, add a switch arm, add a dispatcher.
- Type errors catch missing payload fields at compile time.

### Harder

- Schema migration if we change the union shape — but JSONB columns absorb most of this and the audit envelope is append-only by policy.
- The agent must pick from a fixed menu. "Do nothing" is awkward; we model it as `escalate_human` with low urgency.
- New event types (e.g. `vendor_invoice_disputed`) need a new trigger and possibly a new action.

## Alternatives considered

- **Free-form action description (no enum).** Rejected: not auditable, not type-safe, dispatcher becomes prompt-engineering whack-a-mole.
- **JSON-Schema-only validation, no TypeScript types.** Rejected: loses compile-time safety. Refactors become dangerous.
- **One micro-action per Stripe call (e.g. separate `apply_fee` and `notify_late_fee`).** Rejected: 20+ actions is too granular; we group at the *intent* level (`late_fee_warning` = apply fee + notify in one logical step).
- **External workflow engine (Temporal, Inngest).** Rejected: overkill for a 22-hour hackathon. We call Stripe directly from API routes; webhooks close the loop.

## Implementation notes

- **Type union:** `src/agent/actions.ts`
- **Dispatcher:** `src/agent/dispatch.ts` — a single exhaustive `switch`
- **Persistence:** `agent_case` table with `decision` as `jsonb`. Query example:
  ```sql
  select decision->>'kind' as action_kind, count(*)
  from agent_case
  where created_at >= '2026-06-01'
  group by 1;
  ```
- **Demo data isolation:** `agent_case.demo_run_id` so each rehearsal is isolated and `demo:reset` doesn't lose history.
- **Idempotency:** the dispatcher must be idempotent on `case_id`. Re-execution of the same case must not double-charge.

## Open questions

- Need for a 9th `refund_or_credit` action: not for MVP. Tracked as a gap in the brainstorm.
- Sub-types for `escalate_human`: urgency is already in the payload; no need yet.

## References

- `docs/brainstorm/2026-05-23-decision-space.md` — full payloads + worked example
- `docs/brainstorm/2026-05-23-compliance-and-audit.md` — `ComplianceResult`
- `docs/brainstorm/2026-05-23-bias-and-fairness.md` — `FairnessResult`
- `docs/brainstorm/2026-05-23-stripe-data-model.md` — Stripe primitive mapping
- ADR-0002 — Connect mode + charge pattern
- ADR-0003 — Plan negotiation
- ADR-0004 — Compliance policy v1
- ADR-0005 — Bias defense layers
