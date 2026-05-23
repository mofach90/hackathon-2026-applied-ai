# Brainstorm — Compliance & Audit Layer

> **Date:** 2026-05-23
> **Status:** Brainstorm (will inform ADR-0005)
> **Related:** `docs/project.md`, `docs/brainstorm/2026-05-23-decision-space.md`, `docs/brainstorm/2026-05-23-bias-and-fairness.md`

This document defines the **legal compliance frame** in which the agent operates,
and the **audit trail** that supports legal defensibility.

---

## Why this is a feature, not a chore

The hallo theo team pushed back on our initial framing with:
*"where's the AI value if it's just if-statements?"*

Two answers (the other is **judgment over unstructured data** — see `project.md`).
This document covers the second answer: **compliance and audit are themselves a
defensible product feature**.

In Germany (and the EU more broadly), rent collection touches:

- **BGB §§286–288** — Verzug (legal default) and Mahnverfahren (formal reminder process)
- **Mietrecht** (German rental law generally)
- **GDPR / DSGVO** — personal-data handling
- **EU AI Act** — housing decisions classified as **high-risk AI**

A property manager who deploys our system needs to:

1. Know that the AI **cannot break these rules**, even when it makes a "smart" judgment
2. Be able to **prove compliance** to a Mietgericht (tenancy court) if challenged

That is what the compliance + audit layer provides.

---

## German rental law — what we hard-code

> Disclaimer: not legal advice. Simplified for the hackathon demo. Any real
> deployment requires lawyer + regulator review.

### Verzug (legal default state)

A tenant is in **Verzug** (legal default) when:

- Rent is due (Fälligkeit), AND
- Reasonable time has passed, AND
- A Mahnung has been issued (or rent has been due for ≥30 days under BGB §286 II Nr. 1)

**Our hard rule:** late fee can only be applied after Verzug is established.
We default to a **7-day grace period** before any fee-bearing action.

### Mahnverfahren (formal reminder sequence)

The legal path to enforcement:

1. **Zahlungserinnerung** — informal first reminder (friendly), no specific legal requirements
2. **1. Mahnung** — formal first notice, establishes Verzug if not already
3. **2. Mahnung** — formal second notice, typically 10–14 days after 1st
4. **3. Mahnung / Letzte Mahnung** — final warning before legal action
5. **Mahnbescheid** — court order proceedings (out of scope)

**Our hard rules:**

- Min **14 days between Mahnung levels** (configurable per landlord, but capped)
- Each Mahnung must contain: amount due, deadline, consequences of non-payment
- All Mahnungen logged with timestamp + sent-via channel
- Level 2 requires Level 1 was sent; Level 3 requires Level 2

### Late fee limits

Late fees in Germany are loosely regulated, but courts typically reject fees that:

- Exceed reasonable damages (Verzugsschaden)
- Are not explicitly specified in the lease
- Exceed ~5% of monthly rent absent specific lease clauses

**Our hard rule:** `late_fee_eur ≤ 5% × monthly_rent_eur` per cycle.

### Contact-time restrictions

No legal hard rule for residential tenants, but courts have ruled certain hours
"unreasonable" (e.g. 23:00–07:00 contact for non-emergency).

**Our hard rule:** agent contact only between **08:00 and 20:00** local time.

### Language requirement

If the lease was signed in language X, formal notices should also be in language X
(or come with a translation) for legal defensibility.

**Our hard rule:** formal notices match the tenant's lease-signing language.

---

## The `CompliancePolicy` type

```ts
type CompliancePolicy = {
  verzug_grace_days: 7,
  mahnung_levels_min_days_between: 14,
  mahnung_required_content: ["amount_due", "deadline", "consequences"],
  late_fee_max_pct_of_rent: 5,
  allowed_contact_hours: { start: 8, end: 20 },
  language_must_match_lease: true,
  formal_notice_requires_prior_mahnung: true,
  max_reminders_per_cycle: 3,
  policy_version: "v1"
}
```

This is **hard-coded in code** (not LLM-controlled). For hackathon: in a TypeScript
constant. For production: per-landlord DB row with audit-trail of changes.

---

## The compliance check (every agent action)

```
[Agent picks action]
        ↓
[Compliance Layer]
  - Validate action against CompliancePolicy
  - Return ComplianceResult { status, rules_checked, blocked_reason? }
        ↓
   ┌─────────┴─────────┐
   ▼                   ▼
 [PASS]              [FAIL]
 Execute             - Send back to agent: "blocked, reason: X"
 + log               - Agent picks alternative
                     - Re-run compliance check
                     - Max 3 retries → escalate_human
```

### The `ComplianceResult` type

```ts
type ComplianceResult = {
  status: "pass" | "fail" | "warn";
  rules_checked: Array<{
    rule_id: string;                  // e.g. "verzug_grace"
    rule_description: string;
    result: "pass" | "fail" | "warn";
    note?: string;
  }>;
  blocked_reason?: string;
  suggested_alternative?: string;
}
```

### Example — Amina's `soft_nudge` (pass)

```json
{
  "status": "pass",
  "rules_checked": [
    { "rule_id": "contact_hours",
      "rule_description": "Contact only 08:00-20:00",
      "result": "pass", "note": "current time 09:14 local" },
    { "rule_id": "max_reminders_per_cycle",
      "rule_description": "Max 3 reminders per billing cycle",
      "result": "pass", "note": "0 prior reminders this cycle" },
    { "rule_id": "language_match",
      "rule_description": "Message language matches lease language",
      "result": "pass", "note": "tenant prefers fr; message in fr" }
  ]
}
```

### Example — hypothetical `late_fee_warning` blocked on day 3

```json
{
  "status": "fail",
  "rules_checked": [
    { "rule_id": "verzug_grace",
      "rule_description": "Late fee requires 7-day grace post-due",
      "result": "fail", "note": "only 3 days late" }
  ],
  "blocked_reason": "Late fee blocked: tenant only 3 days late; grace period is 7 days.",
  "suggested_alternative": "soft_nudge or friendly_check_in"
}
```

---

## Audit trail

Every agent invocation persists a full `agent_case` row with:

- Trigger event with timestamp
- Sanitized context the agent saw (with `unstructured_sources` showing which messages were read)
- Reasoning chain
- Proposed decision
- `compliance_check` result (full `rules_checked` array)
- `fairness_check` result (see `bias-and-fairness.md`)
- Final executed decision (or escalation)
- Execution outcome
- Audit metadata: timestamp, model, prompt version, **policy version**

For legal defensibility, this is queryable:

- *"Show all Mahnungen sent to Mike in March 2026"*
- *"Show all decisions that referenced support ticket #4729"*
- *"Show all alternative actions the agent considered but rejected"*
- *"Show all blocked actions and what the agent picked instead"*

---

## Demo plan: the "blocked" moment

For the demo, we deliberately set up **one case where the first agent decision
is blocked by compliance**, so judges see the layer working:

- A tenant is 3 days late (within grace period)
- Agent's initial proposal: `late_fee_warning`
- Compliance layer blocks it: "verzug_grace failed"
- Agent retries with `soft_nudge`
- Compliance check: pass
- Action executes

This is a **30-second beat** that proves the layer is real and not theater.

---

## What we explicitly include for the hackathon demo

- Hard rules for the 5 most important compliance items (above)
- Live compliance check displayed in the UI per action
- The "blocked-then-retry" demo moment
- `agent_case.compliance_check` JSONB column with full audit
- `policy_version` field in audit metadata

## What we explicitly exclude

- Real lawyer review (this is a hackathon demo, not legal advice)
- All edge cases of BGB / Mietrecht (we pick 5 high-impact rules)
- Multi-jurisdiction support (DE only)
- Mahnbescheid / court filing automation (out of scope)
- Production-grade data retention / DSGVO compliance (test data only)
- Per-landlord configurable policy (hackathon: hard-coded in code)

---

## Open questions for ADR phase

- **ADR-0005 candidate:** Lock the `CompliancePolicy` v1 values + the rule IDs + the retry-on-block flow.
- Should `CompliancePolicy` live in code or DB? Hackathon: in code. Production: per-landlord DB row.
- Override flow: can a property manager override a blocked action? Yes, but logged as `override_with_reason`. Surface in dashboard.
- Versioning: when we update rules, do old `agent_case` records need policy version recorded? **Yes — already in the audit field.**
- What happens on policy_version drift between when the action was decided and when it's audited later? Document immutability of audit records.
