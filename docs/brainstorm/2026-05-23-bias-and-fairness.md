# Brainstorm — Bias & Fairness Layer

> **Date:** 2026-05-23
> **Status:** Brainstorm (will inform ADR-0006)
> **Related:** `docs/project.md`, `docs/brainstorm/2026-05-23-decision-space.md`, `docs/brainstorm/2026-05-23-compliance-and-audit.md`

This document defines the **5-layer bias defense** and the **demo counterfactual
moment** that makes it visible to judges.

---

## Why this matters

### Regulatory frame

- **EU AI Act** classifies AI systems used to evaluate creditworthiness or make decisions affecting access to essential private services as **high-risk**. Property rental decisions fall here. High-risk systems must demonstrate bias mitigation.
- **Germany's AGG (Allgemeines Gleichbehandlungsgesetz)** prohibits discrimination in housing on grounds of race, ethnicity, gender, religion, age, sexual identity, or disability.
- **GDPR** prohibits decisions based solely on automated processing that significantly affect people, including special-category data without explicit consent.
- **US Fair Housing Act** (relevant for any future US expansion) similarly prohibits discrimination.

For a real deployment, we cannot ship without bias mitigation. For the hackathon
demo, showing this work is **itself a competitive advantage** — most teams will
not have thought about this at all.

### The proxy problem

Even when we don't pass race/ethnicity to the model, LLMs can proxy via:

| Proxy | Why it correlates with protected attributes |
|---|---|
| **Name** | Strongest proxy. *Amina Benali*, *Mike Schmidt*, *Sara Petrović* signal different ethnicities just from the names. |
| **Language preference** | Arabic, Turkish, Polish, French in Berlin map imperfectly to ethnicity. |
| **Neighborhood** | Kreuzberg, Neukölln, Wedding vs Charlottenburg, Zehlendorf carry demographic associations. |
| **Communication patterns** | Non-native German, salutation style, code-switching. |
| **Time-of-day activity** | Shift work correlates with industries that have demographic skew. |
| **Employer mentioned in support chat** | E.g. cleaning company vs tech company. |

Our defense must address each proxy directly.

---

## The 5-layer defense

### Layer 1 — Input redaction (most important)

Before any prompt reaches the LLM that **makes the decision**, the context is sanitized:

```ts
function sanitizeContext(ctx: Context): SanitizedContext {
  return {
    tenant_anonymized_id: hash(ctx.tenant.id),
    // REMOVED: name, language, nationality, neighborhood,
    //          photo, religion, marital_status, age, sexual_orientation
    behavior: {
      months_on_time: ctx.history.months_on_time,
      months_late: ctx.history.months_late,
      months_partial: ctx.history.months_partial,
      communication_responsiveness: ctx.history.communication_responsiveness,
      prior_promises_broken: ctx.history.prior_promises_broken,
    },
    structured_event: {
      days_late: ctx.current_event.days_late,
      amount_due_eur: ctx.current_event.amount_due_eur,
      // ...
    },
    unstructured_excerpts: ctx.unstructured.map(redactPII)
  }
}

function redactPII(text: string): string {
  // 1. Regex pass: names (capitalized words, common name patterns), addresses, phone numbers
  // 2. Claude-as-redactor pass: ask Claude to redact PII it finds
  // 3. Return excerpts with [REDACTED-NAME], [REDACTED-LOC], etc.
}
```

The decision-making LLM sees `tenant_anon_e7f3` with payment history plus
excerpts like:

> *"[REDACTED-NAME] mentioned that [REDACTED-EMPLOYER] laid off employees last week. They asked about lease flexibility."*

**Key invariant:** the LLM that decides what to do never sees protected attributes.

A **separate, narrower LLM call** renders the personalized message (which needs
the name + language). That call has no decision-making power — it just translates
a decided action into outgoing text.

### Layer 2 — Reasoning constraints in the system prompt

Hard requirement in the decision prompt:

> *"You may justify decisions only based on payment history, communication history,
> prior outreach response, lease state, and explicit consent given. You must not
> reference name, ethnicity, nationality, religion, gender, family status,
> disability, sexual orientation, age, or neighborhood as factors. If a behavioral
> signal cannot be explained without reference to these, escalate to human review."*

**Post-hoc check:** scan `reasoning_chain` text for forbidden keywords. If any
appear, the response is rejected and the agent is re-prompted with feedback.

### Layer 3 — Output guardrails (hard rules)

Some actions are **NEVER automated**, regardless of agent reasoning:

- Eviction recommendation → always `escalate_human`
- Lease non-renewal decision → always `escalate_human`
- Anything that mentions law enforcement → always `escalate_human`
- Differential treatment vs cohort baseline → always `escalate_human`

Hard-coded list, lives next to the compliance policy.

### Layer 4 — Counterfactual checks (the demo win)

For each persona, run a **name-swap test**:

```ts
function counterfactualCheck(persona: Persona): CounterfactualResult {
  const baseline = runAgentEndToEnd(persona);

  // Swap to a neutral baseline name + language
  const swappedPersona = {
    ...persona,
    name: "Anna Bauer",
    language: "de"
  };
  const swapped = runAgentEndToEnd(swappedPersona);

  return {
    same_decision_kind: baseline.decision.kind === swapped.decision.kind,
    same_reasoning: deepEqualIgnoringNames(
      baseline.reasoning_chain,
      swapped.reasoning_chain
    ),
    diff: diffResponses(baseline, swapped)
  };
}
```

Because Layer 1 redaction strips name + language before the decision LLM sees
the context, baseline and swapped runs **should be byte-identical at the
decision level** (only the rendered message differs — that's expected, because
message rendering is a separate downstream step).

**Demo moment:** click "Run fairness check" → screen shows side-by-side reasoning
chains for Amina vs Anna, **identical**. 30 seconds. Judges go *"oh, they
actually thought about this."*

### Layer 5 — Audit + human-in-the-loop

- Every decision logged with `fairness_check` JSONB
- Daily aggregate (post-hackathon): are decisions correlated with any protected proxy across the cohort?
- Escalations require human review
- "Challenge this decision" button on every action surfaced to the property manager

---

## The `FairnessResult` type

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
    matched: boolean;                       // true = no measured bias
  };
}
```

---

## What we explicitly include for the hackathon demo

- **Layer 1:** PII redaction in code, working on all 3 personas + their unstructured excerpts
- **Layer 2:** reasoning constraints in the system prompt + post-hoc keyword check
- **Layer 3:** hard-coded list of always-human actions
- **Layer 4:** live name-swap counterfactual on the demo page
- **Layer 5:** `fairness_check` JSONB column persisted in `agent_case`

---

## What we explicitly do NOT claim

We will be **publicly and intentionally honest** about what we have and have not done:

- ❌ *"We have eliminated bias from AI rental decisions."* → false, no system has
- ❌ *"Our system is AGG-compliant for real-world deployment."* → false, that requires lawyer + regulator review
- ❌ *"We detect intersectional bias."* → false, single-axis name-swap only
- ❌ *"We measure disparate impact at scale."* → false, demo has 3 personas

## What we DO claim

- ✅ We treat bias as a **first-class architectural concern**
- ✅ We hard-code **five layers of defense**
- ✅ We **surface the defense** to the user and the auditor
- ✅ We acknowledge **ongoing limitations honestly**

The honesty is the credibility.

---

## Demo script — fairness moment (90 seconds)

> *"Here's something most AI demos don't show you. We're going to swap the name on this tenant — from Amina Benali to Anna Bauer — and re-run the agent. Watch the reasoning chain."*
>
> *[Click button. Side-by-side renders appear.]*
>
> *"The decision is identical. The reasoning is identical. Same `soft_nudge`. Same chain of thought. Why? Because the decision-making model never sees the name. It sees an anonymized ID and the tenant's behavioral history."*
>
> *"We didn't solve AI bias — nobody has. But we built five layers of defense: input redaction, reasoning constraints, output guardrails, counterfactual checks, and full audit. Because deploying AI for high-stakes housing decisions without thinking about this would be irresponsible."*

---

## Open questions for ADR phase

- Should the message-rendering LLM call (which DOES see the name) use a different model than the decision LLM? Hackathon: same Claude, scoped second prompt. Production: separate model + access control.
- How do we redact unstructured data efficiently at scale? Hackathon: regex + Claude redaction. Production: dedicated PII redaction pipeline.
- Counterfactual swap names — how many baseline names to test against? Hackathon: 1 (Anna Bauer). Production: distribution of names from underrepresented groups.
- Do we need a "disparity rate" metric on the dashboard? Hackathon: no. Production: yes.
