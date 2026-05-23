# Brainstorm — Stripe Data Model & Money Flow

> **Date:** 2026-05-23
> **Status:** Brainstorm (decisions will be promoted to ADR-0002 / ADR-0003)
> **Related:** `docs/project.md`, `docs/brainstorm/2026-05-23-decision-space.md`

This document maps our domain (property managers, tenants, landlords, vendors)
onto Stripe primitives, picks a Connect mode, picks a charge pattern, and
sketches the database schema.

---

## Entity map

| Our entity | Stripe primitive | Why |
|---|---|---|
| Property management company (us) | **Platform Account** (main Stripe account) | Merchant of record, owns the balance, runs the dashboard |
| **Tenant** | `Customer` | They pay us; never receive money; just have payment methods |
| **Landlord** | **Connect Account** (Express) | They receive money; need bank info; light KYC via Stripe-hosted flow |
| **Vendor** | **Connect Account** (Express) | Same as landlord — receive money for invoices |
| Rent obligation | `Invoice` + `InvoiceItem` | Recurring monthly bill; can be split into plan installments |
| Late fee | `InvoiceItem` (added to next invoice) | Cleanest way to attach a fee |
| Vendor invoice | Stored in our DB, paid via `Transfer` | Vendors don't bill us through Stripe; we just pay them out |
| Landlord disbursement | `Transfer` from platform → landlord Connect | Net rent after management fee |

## Decision: Connect mode = **Express** (for both landlords and vendors)

| Mode | Pros | Cons | Verdict |
|---|---|---|---|
| **Standard** | Connected account has full Stripe dashboard | Complex OAuth onboarding | Too heavy for hackathon |
| **Express** | Stripe-hosted onboarding, lightweight, decent dashboard | Limited customization | **✅ Picked** |
| **Custom** | Full control, fully white-labeled | Must build all UI ourselves | Too much work for hackathon |

**Hackathon hack:** skip live onboarding. Use `stripe.accounts.create()` with
`business_type: 'individual'` and pre-filled test data to instantiate Express
accounts for the seed landlords and vendors before the demo.

## Decision: charge pattern = **Separate charges & transfers**

| Pattern | How it works | Best for |
|---|---|---|
| **Direct charges** | Tenant pays landlord's account directly; platform takes `application_fee` | When tenant should see landlord branding |
| **Destination charges** | Tenant pays platform; funds immediately split to landlord | Simple split-on-payment marketplaces |
| **Separate charges & transfers** | Tenant pays platform; funds sit in platform balance; we Transfer later | **✅ Our case** — we want to aggregate, hold briefly, pay vendors from pool, then net-disburse to landlord |

This matches how real property managers operate (collect into escrow → pay
vendors → net-disburse to landlords) and lets us implement weekly/monthly
disbursement cadence rather than per-charge.

---

## Money flow — tenant pays rent

```
[Tenant] --Stripe Checkout--> [Stripe]
   |                            |
   |  webhook                   |
   |  checkout.session.completed|
   |<---------------------------|
[Our backend] --updates DB-->  funds now in PLATFORM balance
   |
   |  triggers agent (any plan obligations updated?)
   v
[Agent decision] (probably nothing for a normal on-time pay)
```

## Money flow — vendor payout

```
[Vendor email with invoice]
        |
        v
[Agent] verifies: matches WO? within quote? KYC ok?
        |
        v
[Decision: auto_payout_vendor]
        |
        v
stripe.transfers.create({
  amount: 50000,                  // €500 in cents
  currency: "eur",
  destination: vendor.stripe_account_id,
  description: "Invoice INV-123, WO-456"
})
        |
        v
[Stripe pays vendor's bank within ~T+2]
```

## Money flow — landlord disbursement

```
[Scheduled job — weekly Sunday 02:00]
        |
        v
For each landlord:
  gross = SUM(tenant rent paid this period)
  fee   = gross × landlord.management_fee_pct
  net   = gross - fee
        |
        v
stripe.transfers.create({
  amount: net_in_cents,
  currency: "eur",
  destination: landlord.stripe_account_id,
  description: "Disbursement 2026-W23"
})
        |
        v
[Email PDF statement to landlord]
```

## Money flow — plan negotiation (Amina's €600 + €600 case)

```
[Agent decision: plan_negotiation, accept_offer]
        |
        v
For each installment (×2):
  stripe.invoiceItems.create({
    customer: tenant.stripe_customer_id,
    amount: 60000,                // €600 in cents
    currency: "eur",
    description: "Rent installment 1/2 — June 2026"
  })
  invoice = stripe.invoices.create({
    customer: tenant.stripe_customer_id,
    collection_method: "send_invoice",
    due_date: timestamp(installment.due_date),
    metadata: { plan_id, installment_number }
  })
  stripe.invoices.finalizeInvoice(invoice.id)
  stripe.invoices.sendInvoice(invoice.id)  // emails hosted page
        |
        v
[Tenant pays via Stripe-hosted invoice page]
        |
        v
[Webhook: invoice.paid] → update plan progress
```

For 2 installments, raw `Invoices` beats `subscriptionSchedules`. Simpler.

---

## Database schema (Supabase Postgres)

```sql
landlord       (id, name, email, stripe_account_id, mgmt_fee_pct,
                disbursement_cadence, created_at)

property       (id, landlord_id, address, unit, monthly_rent_eur, created_at)

tenant         (id, property_id, name, email, language, phone,
                stripe_customer_id, tenancy_started, lease_end, created_at)

vendor         (id, name, email, stripe_account_id, category,
                kyc_verified, created_at)

work_order     (id, property_id, vendor_id, description, quoted_amount_eur,
                status, created_at)

vendor_invoice (id, work_order_id, vendor_id, amount_eur, pdf_url, status,
                paid_at, stripe_transfer_id, created_at)

rent_obligation (id, tenant_id, period_start, period_end, amount_eur,
                 stripe_invoice_id, status, due_date, paid_at, created_at)

payment_plan   (id, tenant_id, original_rent_obligation_id, installments jsonb,
                status, created_at)

agent_case     (id, trigger_type, trigger_payload jsonb, context_used jsonb,
                unstructured_sources jsonb,   -- which messages/threads the agent read (PII-redacted)
                reasoning_chain jsonb, decision jsonb, confidence,
                alternatives_considered jsonb,
                compliance_check jsonb,        -- see compliance-and-audit.md
                fairness_check jsonb,          -- see bias-and-fairness.md
                outcome, audit jsonb, created_at)

disbursement   (id, landlord_id, period_from, period_to, gross_eur, fee_eur,
                net_eur, underlying_payments jsonb, stripe_transfer_id, created_at)

escalation     (id, agent_case_id, tenant_id, reason, urgency, status,
                resolved_by, resolved_at, created_at)
```

`agent_case` is the audit log — every `AgentResponse` envelope from the
decision-space brainstorm gets stored here as JSONB.

---

## Hackathon risks + mitigations

| Risk | Mitigation |
|---|---|
| Live Express onboarding flaky in test mode | Pre-create accounts via `stripe.accounts.create()` with test data |
| Platform balance empty → transfers fail | Use Stripe Dashboard "Add to balance" in test mode before the demo |
| Webhooks don't reach localhost | `stripe listen --forward-to localhost:3000/api/stripe/webhook` during dev |
| EUR/cents confusion | Helper: `eurToCents(amount: number) → number` and use it everywhere |
| Demo Stripe account needs EUR currency | Confirm Stripe account country = DE (or any EUR country) at registration |
| Connect transfer needs `business_profile.mcc` | Pre-fill MCC code (`6513` real estate agents) on test account creation |

---

## Open questions for ADR phase

- **ADR-0002 candidate:** Confirm Connect Express + separate charges & transfers, document trade-offs vs alternatives, lock the test-account bootstrap procedure.
- **ADR-0003 candidate:** Plan flow uses raw `Invoices` (not `subscriptionSchedules`). Rationale: 2-installment plans don't need recurrence; we lose flexibility for free.
- **ADR-0004 candidate:** Storing `AgentResponse` envelopes in `agent_case.* jsonb` columns. Trade-off: schema-flexible vs typed queries.
- Should vendor KYC be a separate brainstorm or rolled into ADR-0002?
- Is the disbursement cadence per-landlord configurable on day 1, or hardcoded weekly for the demo?
