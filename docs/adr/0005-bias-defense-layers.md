# ADR 0005: Bias Defense Layers

- **Status:** Accepted
- **Date:** 2026-05-23
- **Deciders:** Mohamed Ayari, Aymen

## Context

RentPilot makes decisions that affect access to housing. Under the EU AI Act this is a **high-risk** AI category. Under Germany's AGG (Allgemeines Gleichbehandlungsgesetz), discrimination in housing on grounds of race, ethnicity, gender, religion, age, sexual identity, or disability is prohibited. Under GDPR Article 22, decisions based solely on automated processing that significantly affect people require safeguards.

LLMs do not see race directly, but **proxy** it via:

- Name (strongest proxy — *Amina*, *Mike*, *Sara* signal different ethnicities)
- Language preference
- Neighborhood
- Communication patterns (non-native German, code-switching)
- Time-of-day activity
- Employer / institution mentioned in unstructured data

A single "guardrail" is insufficient because LLMs find paths around isolated checks.

## Decision

A **5-layer defense**, each independently auditable, with a **live counterfactual demo** visible to the user.

1. **Input redaction** — agent never sees protected attributes; PII-redacted excerpts only
2. **Reasoning constraints** — system prompt requires behavioral justifications; post-hoc keyword check
3. **Output guardrails** — hard list of always-human actions
4. **Counterfactual checks** — name-swap test, decisions must match
5. **Audit + human-in-the-loop** — every decision logged; escalations require human

## Consequences

### Easier

- Defensible against AGG and EU-AI-Act scrutiny — we have multiple independent layers
- The "counterfactual passes" badge is a visible trust signal in the UI
- Each layer is testable in isolation
- Honest framing for the demo: *"we have layers of defense, we don't claim bias-free"*

### Harder

- More moving parts: redactor, constraint check, counterfactual runner, audit table
- The "message rendering" LLM call (which DOES need the name) must be carefully scoped — it has no decision authority, only translates an already-decided action into outgoing text
- Counterfactual at scale would need many baseline names — for the demo we use one swap

## Alternatives considered

- **Single guardrail (post-hoc keyword filter only).** Rejected: LLMs route around single checks.
- **No fairness layer.** Rejected: regulatory risk, irresponsible, judges will notice.
- **Fairness review by humans only.** Rejected: undermines the autonomy story; we need both human review for escalations AND automated checks for routine decisions.

## Implementation notes

### Layer 1 — Input redaction

```ts
// src/agent/context.ts

export function sanitizeContext(ctx: FullContext): SanitizedContext {
  return {
    tenant_anonymized_id: hash(ctx.tenant.id),
    // REMOVED: name, language, nationality, neighborhood, photo,
    //          religion, marital_status, age, sexual_orientation, phone
    behavior: {
      months_on_time: ctx.history.months_on_time,
      months_late: ctx.history.months_late,
      months_partial: ctx.history.months_partial,
      communication_responsiveness: ctx.history.communication_responsiveness,
      prior_promises_broken: ctx.history.prior_promises_broken,
      prior_outreach_this_cycle: ctx.current_event.prior_outreach_this_cycle,
    },
    structured_event: ctx.current_event,
    unstructured_excerpts: await Promise.all(
      ctx.unstructured.map(u => redactPII(u))
    ),
  };
}

export async function redactPII(item: UnstructuredItem): Promise<UnstructuredItem> {
  // 1. Regex pass: names, addresses, phone, email, IBAN
  const r1 = regexRedact(item.excerpt);
  // 2. Claude-as-redactor pass: ask Claude (Haiku) to find anything missed
  const r2 = await llmRedact(r1);
  return { ...item, excerpt: r2 };
}
```

### Layer 2 — Reasoning constraints

The decision-LLM system prompt includes:

> *"You may justify decisions only on the basis of: payment history, communication history, prior outreach response, lease state, and explicit consent given. You must NOT reference name, ethnicity, nationality, religion, gender, family status, disability, sexual orientation, age, or neighborhood as factors. If a behavioral signal cannot be explained without reference to these, output `escalate_human` with reason 'cannot decide without protected-attribute reference.'"*

Post-hoc:

```ts
const FORBIDDEN_KEYWORDS = [
  // base list — expand iteratively
  "race", "ethnicity", "religion", "muslim", "jewish", "christian",
  "arab", "german", "polish", "turkish", "french", "syrian",
  "male", "female", "woman", "man", "gay", "straight",
  "muslim name", "german name", "non-native",
  "disabled", "elderly", "young",
];

function reasoningConstraintCheck(chain: ReasoningStep[]): RuleResult {
  const corpus = chain.map(s => s.thought).join(" ").toLowerCase();
  const hits = FORBIDDEN_KEYWORDS.filter(k => corpus.includes(k));
  return {
    rule_id: "reasoning_constraint",
    result: hits.length === 0 ? "pass" : "fail",
    note: hits.length > 0 ? `forbidden keywords: ${hits.join(", ")}` : undefined,
  };
}
```

### Layer 3 — Output guardrails

```ts
const ALWAYS_HUMAN_KINDS = new Set([
  // Actions we will never automate, regardless of what the agent reasons
  // (eviction, lease non-renewal, law-enforcement contact, etc.)
  // For the hackathon MVP these are not in our action surface at all —
  // they would be future additions and would default to escalate_human.
]);

function outputGuardrailCheck(action: AgentAction): RuleResult {
  return {
    rule_id: "output_guardrail",
    result: ALWAYS_HUMAN_KINDS.has(action.kind) ? "fail" : "pass",
    note: ALWAYS_HUMAN_KINDS.has(action.kind)
      ? `${action.kind} must be human-decided; converting to escalate_human`
      : undefined,
  };
}
```

### Layer 4 — Counterfactual

```ts
export async function runCounterfactual(persona: Persona, baseline: AgentResponse) {
  const swapped = {
    ...persona,
    name: "Anna Bauer",
    language: "de",
  };
  const swappedResponse = await runAgentEndToEnd(swapped);

  return {
    baseline_decision_kind: baseline.decision.kind,
    swapped_decision_kind: swappedResponse.decision.kind,
    matched: baseline.decision.kind === swappedResponse.decision.kind
          && deepEqualIgnoringMessages(baseline.reasoning_chain, swappedResponse.reasoning_chain),
  };
}
```

Because Layer 1 strips the name + language before the decision LLM sees the context, baseline and swapped should match. The **message rendering** LLM call (which needs the real name) is a separate, downstream call with no decision authority.

### Layer 5 — Audit + HITL

- `agent_case.fairness_check` JSONB column persists every check result
- `escalations` table for human review
- "Challenge this decision" button on every action surfaced to the property manager — clicking it creates an `escalation` row

### `FairnessResult` type

```ts
type FairnessResult = {
  status: "pass" | "fail" | "warn";
  checks: Array<{
    check_id: "input_redaction" | "reasoning_constraint"
            | "output_guardrail" | "counterfactual" | "audit_logged";
    result: "pass" | "fail" | "warn";
    note?: string;
  }>;
  counterfactual?: {
    baseline_decision_kind: string;
    swapped_decision_kind: string;
    matched: boolean;
  };
}
```

## What we DO claim publicly

- We treat bias as a first-class architectural concern.
- We hard-code 5 layers of defense.
- We surface every check in the audit trail and in the UI.
- We acknowledge ongoing limitations honestly.

## What we DO NOT claim

- *"AI bias is solved."* — false, no system has.
- *"AGG-compliant for production deployment."* — false, that needs lawyer + regulator review.
- *"Intersectional bias detection."* — false, our counterfactual is single-axis.
- *"Statistical disparate-impact monitoring."* — false, demo has 3 personas.

## Demo script — fairness moment (~90 seconds)

> *"Most AI demos don't show you this. We're going to swap the name on this tenant — Amina Benali → Anna Bauer — and re-run the agent. Watch the reasoning chain on both sides."*
>
> *[Click. Side-by-side renders.]*
>
> *"Identical. Same `soft_nudge`. Same chain of thought. Why? Because the decision-making model never sees the name. It sees an anonymized ID and behavioral history."*
>
> *"We didn't solve AI bias — nobody has. But we built five layers of defense. Deploying AI for high-stakes housing decisions without thinking about this would be irresponsible."*

## Open questions

- Production: should the message-rendering LLM call use a different model than the decision LLM? Hackathon: same Claude, scoped second prompt. Production: separate access boundary.
- Production: counterfactual against a distribution of names from underrepresented groups, not just one swap.
- Disparity-rate dashboard metric (post-hackathon).

## References

- `docs/brainstorm/2026-05-23-bias-and-fairness.md` — full 5-layer detail
- `docs/brainstorm/2026-05-23-decision-space.md` — `FairnessResult` type definition
- EU AI Act, high-risk classification: https://artificialintelligenceact.eu/
- AGG (German equal-treatment act): https://www.gesetze-im-internet.de/agg/
- ADR-0001 — agent action surface
- ADR-0004 — compliance policy (runs alongside fairness check)
- ADR-0008 — AI runtime (which LLM does redaction, which does decision)
