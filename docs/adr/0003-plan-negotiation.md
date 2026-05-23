# ADR 0003: Plan Negotiation Implementation

- **Status:** Accepted
- **Date:** 2026-05-23
- **Deciders:** Mohamed Ayari, Aymen

## Context

When the agent approves a payment plan (e.g. Amina's €600 + €600), we need a Stripe mechanism to:

- Create ≥2 future invoices for the same tenant
- Send each at the right time
- Track which installments are paid
- Mark the plan complete when all installments clear

Stripe gives us two reasonable paths:

1. **Raw `Invoice`s + `InvoiceItem`s** — create N independent invoices, each with its own `due_date`
2. **Subscription Schedules** — define a phased subscription with one-shot phases

We need a path that is simple, observable, and works in test mode in 22 hours.

## Decision

**Raw Invoices, one per installment.** The plan itself lives in our DB (`payment_plan` table); each installment links to a `stripe_invoice_id`.

## Consequences

### Easier

- Each installment is a standalone `Invoice` with its own state machine (open → paid)
- Webhook handler is straightforward: `invoice.paid` → mark that installment paid
- Cancelling a single installment is `invoices.voidInvoice` — no schedule untangling
- The plan as a whole lives in our DB (`payment_plan.installments jsonb`)
- Stripe-hosted invoice pages handle UI for free; tenant pays from email link
- Easy to reason about during the demo

### Harder

- We track plan-level state ourselves (which installments paid, which open, when to give up)
- If a tenant misses an installment, we trigger the agent ourselves (no built-in per-installment dunning)
- Plan-cancellation semantics need a small bit of code (void all unpaid invoices)

## Alternatives considered

### Subscription Schedules
- **Pro:** Native multi-phase pricing, native retry logic
- **Con:** Designed for recurring subscriptions, not finite N-installment plans. Each phase has start+end times; awkward to express "1 invoice every 7 days for 2 weeks." More API surface to learn under time pressure.
- **Verdict:** Wrong shape for this problem.

### Single invoice + `payment_intent.setup_future_usage`
- **Pro:** Tenant enters card once
- **Con:** No structured installment tracking. We'd manually trigger future `PaymentIntent`s. Loses the audit + invoice trail.
- **Verdict:** Wrong shape — we lose Stripe-hosted UI per installment.

### Native Stripe "Installment Plans"
- Stripe has experimented with installment-plan APIs but as of 2026 no stable API for "split this invoice into N parts" is generally available.
- **Verdict:** Not available; revisit if it lands.

## Implementation notes

### Plan creation flow

```ts
async function createPaymentPlan(args: {
  plan_id: string;
  tenant_id: string;
  original_rent_obligation_id: string;
  installments: Array<{ amount_eur: number; due_date: string /* ISO date */ }>;
}): Promise<PaymentPlan> {
  const tenant = await db.tenant.findUniqueOrThrow(args.tenant_id);

  const stripe_invoice_ids: string[] = [];

  for (const [i, inst] of args.installments.entries()) {
    // 1. Create the line item first (Stripe pattern: items become pending against the customer)
    await stripe.invoiceItems.create({
      customer: tenant.stripe_customer_id,
      amount: eurToCents(inst.amount_eur),
      currency: "eur",
      description: `Rent installment ${i + 1}/${args.installments.length} — ${period_label}`,
      metadata: {
        rentpilot_plan_id: args.plan_id,
        rentpilot_installment_index: String(i),
      },
    });

    // 2. Create the invoice (will pull in the pending invoice items above)
    const invoice = await stripe.invoices.create({
      customer: tenant.stripe_customer_id,
      collection_method: "send_invoice",
      due_date: toUnixTimestamp(inst.due_date),
      pending_invoice_items_behavior: "include",
      metadata: {
        rentpilot_plan_id: args.plan_id,
        rentpilot_installment_index: String(i),
      },
    });

    // 3. Finalize + send (sends the hosted invoice page to the tenant)
    await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(invoice.id);

    stripe_invoice_ids.push(invoice.id);
  }

  return db.payment_plan.create({
    id: args.plan_id,
    tenant_id: args.tenant_id,
    original_rent_obligation_id: args.original_rent_obligation_id,
    installments: args.installments.map((inst, i) => ({
      ...inst,
      stripe_invoice_id: stripe_invoice_ids[i],
      paid_at: null,
    })),
    status: "active",
  });
}
```

### Webhook handler — installment paid

```ts
if (event.type === "invoice.paid") {
  const invoice = event.data.object as Stripe.Invoice;
  const planId = invoice.metadata?.rentpilot_plan_id;
  if (!planId) return; // not a plan invoice

  const idx = Number(invoice.metadata.rentpilot_installment_index);
  const plan = await db.payment_plan.findUniqueOrThrow(planId);
  plan.installments[idx].paid_at = new Date().toISOString();
  await db.payment_plan.update(plan);

  const allPaid = plan.installments.every(i => i.paid_at !== null);
  if (allPaid) {
    await db.payment_plan.update({ id: planId, status: "completed" });
    await notifyTenantPlanComplete(plan);
    await notifyLandlordPlanComplete(plan);
  }
}
```

### Plan failure handling

If an installment goes overdue past N days (configurable; default 3 days post-due):

1. A scheduled job (`/api/cron/check-overdue-plans`) finds open plan installments with `due_date + grace_days < now`
2. Emits a new `Trigger { type: "rent_late", event_payload: { plan_id, installment_index } }`
3. Agent is invoked. It typically picks `late_fee_warning` or `escalate_human` based on the prior plan history.

### Plan cancellation

```ts
async function cancelPlan(plan_id: string, reason: string) {
  const plan = await db.payment_plan.findUniqueOrThrow(plan_id);
  for (const inst of plan.installments) {
    if (!inst.paid_at) {
      await stripe.invoices.voidInvoice(inst.stripe_invoice_id);
    }
  }
  await db.payment_plan.update({
    id: plan_id,
    status: "cancelled",
    cancellation_reason: reason,
  });
}
```

## Open questions

- **Max installments per plan?** Compliance policy v1 doesn't cap. We should add `max_installments_per_plan` (suggest 4). Tracked as TODO in ADR-0004.
- **Out-of-order payment?** If installment 2 is paid before installment 1, our plan state shows "2/2 paid but 1/2 still open" — confusing. Resolution: once `sum(paid) >= sum(due)`, mark plan complete and void any remaining open invoices.
- **Partial payment of a single installment?** Stripe Hosted Invoice Page allows partial in some setups. For demo: disable partial via `payment_settings.payment_method_types` restrictions.

## References

- `docs/brainstorm/2026-05-23-stripe-data-model.md` — plan-negotiation flow diagram
- `docs/brainstorm/2026-05-23-decision-space.md` — `plan_negotiation` action payload
- Stripe Hosted Invoice Page: https://stripe.com/docs/invoicing/invoice-payment-page
- Stripe Invoices API: https://stripe.com/docs/api/invoices
- ADR-0001 — agent action surface
- ADR-0002 — Connect mode + charge pattern
- ADR-0004 — compliance policy (Mahnverfahren constraints)
- ADR-0012 — webhook handling
