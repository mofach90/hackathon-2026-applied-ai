# Brainstorm — Agent Decision Space + Stripe Mapping

> **Date:** 2026-05-23
> **Status:** Brainstorm (not yet a committed ADR)
> **Related:** `docs/project.md`, `docs/brainstorm/2026-05-23-compliance-and-audit.md`, `docs/brainstorm/2026-05-23-bias-and-fairness.md`

This document defines the **action surface** the RentPilot agent can take, the
**unified response envelope** every agent call returns, and the **Stripe API
mapping** for each action.

The envelope also includes a **compliance check** (German rental law) and a
**fairness check** (5-layer bias defense). Every agent decision passes through
both before execution.

---

## The 8 actions

| # | Action | Trigger context | Money move | Stripe API |
|---|---|---|---|---|
| 1 | `soft_nudge` | Trustworthy tenant, 1st miss, low risk | none | — |
| 2 | `friendly_check_in` | Low signal (new tenant), offer help | none | `paymentLinks.create` *(optional)* |
| 3 | `plan_negotiation` | Tenant proposes/needs a plan | future installments | `invoices.create` ×N |
| 4 | `late_fee_warning` | Past policy grace period | adds fee | `invoiceItems.create` |
| 5 | `formal_notice` | Chronic + ignored prior nudges (Mahnung) | none | `invoices.update({ metadata: { mahnung_level }})` |
| 6 | `escalate_human` | Ambiguous / high stakes / agent unsure | none | — (internal `escalations` table) |
| 7 | `auto_payout_vendor` | Vendor invoice verified against work order | platform → vendor | `transfers.create({ destination: vendor.connect_id })` |
| 8 | `auto_disburse_landlord` | Weekly/monthly sweep | platform → landlord | `transfers.create({ destination: landlord.connect_id, application_fee_amount })` |

## The unified `AgentResponse` envelope

```ts
type AgentResponse = {
  case_id: string;
  trigger: {
    type: "rent_late" | "rent_partial" | "rent_failed_charge"
        | "vendor_invoice_received" | "scheduled_disbursement";
    event_payload: object;
  };
  context_used: Context;                  // sanitized; see fairness section

  // NEW: which unstructured sources the agent actually read
  unstructured_sources: Array<{
    source_type: "support_chat" | "email_thread" | "sms_thread"
               | "onboarding_form" | "voice_transcript";
    source_id: string;
    excerpt_redacted: string;             // PII-redacted excerpt
    salience: number;                     // 0..1, influence on the decision
  }>;

  reasoning_chain: Array<{
    step: number;
    thought: string;
    evidence?: string[];
  }>;
  decision: AgentAction;
  confidence: number;                     // 0..1
  alternatives_considered: Array<{
    action_kind: string;
    reason_not_chosen: string;
  }>;

  // NEW: compliance check — see compliance-and-audit.md
  compliance_check: ComplianceResult;

  // NEW: fairness check — see bias-and-fairness.md
  fairness_check: FairnessResult;

  audit: {
    timestamp: string;
    model: string;
    prompt_version: string;
    policy_version: string;               // NEW: which CompliancePolicy was applied
  };
}
```

The UI renders directly from this envelope:
- Reasoning chain on the left
- Decision JSON on the right
- `alternatives_considered` as a "why-not-this?" footer
- `compliance_check` and `fairness_check` as inline badges

## The 8 action payloads (typed)

```ts
type AgentAction =
  | { kind: "soft_nudge";
      tenant_id: string;
      channel: "email" | "sms";
      language: "de" | "en" | "fr";
      tone: "warm" | "neutral";
      subject: string;
      body: string;
      follow_up_in_hours: number; }

  | { kind: "friendly_check_in";
      tenant_id: string;
      channel: "email" | "sms";
      language: string;
      help_link_url: string;
      subject: string;
      body: string;
      follow_up_in_hours: number; }

  | { kind: "plan_negotiation";
      tenant_id: string;
      sub_action: "accept_offer" | "counter_offer" | "decline";
      approved_plan?: {
        installments: Array<{ amount_eur: number; due_date: string }>;
        rationale: string;
      };
      counter_offer?: {
        installments: Array<{ amount_eur: number; due_date: string }>;
        rationale: string;
      };
      message_to_tenant: string; }

  | { kind: "late_fee_warning";
      tenant_id: string;
      fee_amount_eur: number;
      applied_at: string;
      legal_basis?: string;
      subject: string;
      body: string;
      follow_up_in_hours: number; }

  | { kind: "formal_notice";
      tenant_id: string;
      level: 1 | 2 | 3;
      legal_basis: "BGB §286";
      subject: string;
      body: string;
      cc_landlord: boolean;
      follow_up_in_days: number; }

  | { kind: "escalate_human";
      tenant_id: string;
      reason: string;
      urgency: "low" | "medium" | "high";
      suggested_action: string;
      context_summary: string; }

  | { kind: "auto_payout_vendor";
      vendor_id: string;
      invoice_id: string;
      work_order_id: string;
      amount_eur: number;
      verification: {
        invoice_matches_work_order: boolean;
        within_quote_range: boolean;
        vendor_kyc_verified: boolean;
      }; }

  | { kind: "auto_disburse_landlord";
      landlord_id: string;
      period: { from: string; to: string };
      gross_collected_eur: number;
      fee_eur: number;
      net_disbursed_eur: number;
      underlying_payments: Array<{
        tenant_id: string;
        amount_eur: number;
        paid_at: string;
      }>; }
```

## The `ComplianceResult` type

```ts
// Full detail in docs/brainstorm/2026-05-23-compliance-and-audit.md
type ComplianceResult = {
  status: "pass" | "fail" | "warn";
  rules_checked: Array<{
    rule_id: string;                        // e.g. "verzug_grace"
    rule_description: string;
    result: "pass" | "fail" | "warn";
    note?: string;
  }>;
  blocked_reason?: string;
  suggested_alternative?: string;
}
```

## The `FairnessResult` type

```ts
// Full detail in docs/brainstorm/2026-05-23-bias-and-fairness.md
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

## Worked example — Amina's full response

```json
{
  "case_id": "case_2026-06-06_amina",
  "trigger": {
    "type": "rent_late",
    "event_payload": {
      "tenant_id": "ten_amina",
      "days_late": 5,
      "amount_due_eur": 1200
    }
  },
  "unstructured_sources": [
    {
      "source_type": "support_chat",
      "source_id": "ticket_4729",
      "excerpt_redacted": "[REDACTED-NAME] asked: 'I'd love to renew my lease in November. Do I need to do anything in advance?' Tone: warm. Sentiment: positive retention signal.",
      "salience": 0.7
    },
    {
      "source_type": "email_thread",
      "source_id": "email_thread_3018",
      "excerpt_redacted": "Thread with landlord from March 2026. [REDACTED-NAME] sent thank-you note after boiler repair. Relationship: warm, mutual respect.",
      "salience": 0.4
    }
  ],
  "reasoning_chain": [
    {
      "step": 1,
      "thought": "Pull tenant history.",
      "evidence": ["18/18 months on time", "0 prior late", "0 prior plan requests"]
    },
    {
      "step": 2,
      "thought": "Read support ticket 4729: tenant proactively asked about lease renewal. Strong retention signal — she intends to stay."
    },
    {
      "step": 3,
      "thought": "Read landlord email thread 3018: warm relationship, prior thank-you note. Punitive action would damage trust."
    },
    {
      "step": 4,
      "thought": "Holistic judgment: late event is sharply out of character. Most likely cause is one-off (bank, travel, oversight) — not financial distress. Risk of damaging trust outweighs the cost of waiting 48h."
    }
  ],
  "decision": {
    "kind": "soft_nudge",
    "tenant_id": "ten_amina",
    "channel": "email",
    "language": "fr",
    "tone": "warm",
    "subject": "Petit rappel amical — loyer de juin",
    "body": "Bonjour, ...",
    "follow_up_in_hours": 48
  },
  "confidence": 0.86,
  "alternatives_considered": [
    {
      "action_kind": "late_fee_warning",
      "reason_not_chosen": "Premature — no signal of bad faith. Would damage 18-month trust."
    },
    {
      "action_kind": "friendly_check_in",
      "reason_not_chosen": "Too proactive for a tenant with this much history; soft_nudge is gentler."
    }
  ],
  "compliance_check": {
    "status": "pass",
    "rules_checked": [
      { "rule_id": "contact_hours", "rule_description": "Contact 08:00-20:00",
        "result": "pass", "note": "09:14 local time" },
      { "rule_id": "max_reminders_per_cycle", "rule_description": "Max 3 reminders / cycle",
        "result": "pass", "note": "0 prior this cycle" },
      { "rule_id": "language_match", "rule_description": "Language matches lease",
        "result": "pass", "note": "tenant prefers fr; message in fr" }
    ]
  },
  "fairness_check": {
    "status": "pass",
    "checks": [
      { "check_id": "input_redaction", "result": "pass",
        "note": "name + language stripped from decision context" },
      { "check_id": "reasoning_constraint", "result": "pass",
        "note": "no protected attributes referenced in reasoning_chain" },
      { "check_id": "output_guardrail", "result": "pass",
        "note": "soft_nudge is not an eviction-class action" },
      { "check_id": "counterfactual", "result": "pass",
        "note": "name-swap to Anna Bauer yields identical decision" },
      { "check_id": "audit_logged", "result": "pass" }
    ],
    "counterfactual": {
      "baseline_decision_kind": "soft_nudge",
      "swapped_decision_kind": "soft_nudge",
      "matched": true
    }
  },
  "audit": {
    "timestamp": "2026-06-06T09:14:22Z",
    "model": "claude-opus-4-7",
    "prompt_version": "v1",
    "policy_version": "v1"
  }
}
```

## Why this design

- **One envelope for all 8 actions** → simple UI rendering, simple logging, simple audit
- **`reasoning_chain` + `alternatives_considered`** → the visible "this isn't a script" moment
- **`unstructured_sources`** → the visible "the AI reads humans, not metrics" moment
- **`compliance_check` + `fairness_check`** → the visible "this isn't a runaway agent" moment
- **Clean Stripe mapping** → no abstraction tax; agent output is one call away from Stripe
- **TypeScript union** → type-safe action dispatcher in code

## Known gaps / future work

- **No `refund` or `credit` action.** Edge case: overpayment, early move-out. Could be a 9th action; not needed for hackathon MVP.
- **No `pause` action.** SaaS-style "pause subscription" doesn't map cleanly to rent. Excluded.
- **No `dispute_resolution` action.** Out of MVP scope.
- **Confidence calibration** is unspecified — we trust the model's self-reported score for now.
- **Counterfactual swap is single-axis** (name only). Production needs intersectional (name × language × neighborhood × ...).

## Open questions for ADR phase

- For `plan_negotiation`: use Stripe Billing `invoices` (one per installment) or `subscriptionSchedules`? Pros/cons go in ADR-0003.
- For payouts: Connect Express (KYC-light) vs Custom vs Standard for landlords/vendors? ADR-0002.
- Where do we store `AgentResponse` envelopes? Supabase JSONB column on `agent_case` is the lazy answer. ADR-0004.
- Should the message-rendering LLM call (which needs the name) be a different model than the decision LLM call (which must not see the name)? ADR-0006.
