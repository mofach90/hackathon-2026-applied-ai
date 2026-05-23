# ADR 0012: Webhook Handling + Idempotency

- **Status:** Accepted
- **Date:** 2026-05-23
- **Deciders:** Mohamed Ayari, Aymen

## Context

Stripe webhooks drive most of the agent's state transitions:

- `checkout.session.completed` — tenant paid rent
- `invoice.paid` — installment paid
- `invoice.payment_failed` — late or failed
- `transfer.created` — vendor or landlord payout sent
- `account.updated` — Connect account state changed

Stripe **will retry** any webhook that doesn't respond with `2xx` within ~10 seconds. Stripe **will replay** under network failures. Without idempotency, we'd double-charge, double-pay, double-notify.

Stripe also signs every webhook. **Unsigned webhooks must be rejected** or anyone with our URL can forge events.

## Decision

Webhook handler at `POST /api/stripe/webhook` does, in order:

1. **Read raw body** (Next.js: disable body parser for this route)
2. **Verify Stripe signature** with `STRIPE_WEBHOOK_SECRET`
3. **Deduplicate by `event.id`** via a `processed_webhook` table
4. **Dispatch to handler** for the event type
5. **Return 200** quickly; long work goes to a follow-up cron or queue (we don't have one, so we keep work short)

Handlers are designed to be **idempotent** — running them twice has the same effect as running them once.

## Consequences

### Easier

- Replays are safe — we always check `processed_webhook` first
- Forged events are rejected — signature check is the gate
- Failed handlers return `500` and Stripe retries them, eventually they succeed or we investigate

### Harder

- The deduplication table grows unbounded — needs a periodic prune (out of MVP scope)
- All handlers must be written idempotently — discipline required
- Local dev requires `stripe listen --forward-to localhost:3000/api/stripe/webhook` always running

## Alternatives considered

- **Skip signature verification.** Rejected: webhook URL is public, judges may see the URL — anyone could forge events.
- **No idempotency, trust Stripe not to retry.** Rejected: Stripe explicitly tells you to be idempotent. Demo would break if any network blip.
- **Queue (BullMQ / SQS) behind the webhook.** Rejected: overkill for hackathon; we keep handlers <100ms when possible.

## Implementation notes

### Route handler — Next.js App Router style

```ts
// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/stripe/client";
import { db } from "@/db/client";
import { processed_webhook } from "@/db/schema";
import { eq } from "drizzle-orm";
import { dispatchWebhookEvent } from "@/stripe/webhook-dispatcher";

// Disable Next's default body parsing — we need the raw text
export const runtime = "nodejs"; // not edge (stripe SDK needs node crypto)
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();  // raw string
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  // Idempotency check
  const already = await db.select().from(processed_webhook).where(eq(processed_webhook.event_id, event.id)).limit(1);
  if (already.length > 0) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // Atomically record we've seen this event (before dispatching)
  // ON CONFLICT DO NOTHING handles the race where two replays arrive nearly simultaneously
  await db.insert(processed_webhook).values({
    event_id: event.id,
    type: event.type,
  }).onConflictDoNothing();

  // Dispatch
  try {
    await dispatchWebhookEvent(event);
  } catch (err) {
    // Don't mark as failed — Stripe will retry, and we'll re-attempt next time
    // (the processed_webhook row stays so we can investigate, but…)
    // Actually: roll back the dedup row so retries do re-attempt.
    await db.delete(processed_webhook).where(eq(processed_webhook.event_id, event.id));
    console.error(`webhook ${event.type}/${event.id} failed`, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

### Event dispatcher

```ts
// src/stripe/webhook-dispatcher.ts
export async function dispatchWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    case "invoice.paid":
      return handleInvoicePaid(event.data.object as Stripe.Invoice);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
    case "transfer.created":
      return handleTransferCreated(event.data.object as Stripe.Transfer);
    case "account.updated":
      return handleAccountUpdated(event.data.object as Stripe.Account);
    default:
      // Log and ignore unknown event types
      console.log(`Unhandled webhook event: ${event.type}`);
  }
}
```

### Idempotent handler pattern — `invoice.paid` example

```ts
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const planId = invoice.metadata?.rentpilot_plan_id;
  if (!planId) {
    // Not a plan invoice — could be a regular rent invoice
    await handleRentInvoicePaid(invoice);
    return;
  }

  const idx = Number(invoice.metadata.rentpilot_installment_index);
  const plan = await db.query.payment_plan.findFirst({ where: eq(payment_plan.id, planId) });
  if (!plan) {
    console.error(`unknown plan_id ${planId}`);
    return;
  }

  // Idempotent: only update if not already marked paid
  if (plan.installments[idx]?.paid_at) {
    return;  // already processed; no-op
  }

  plan.installments[idx].paid_at = new Date().toISOString();
  await db.update(payment_plan).set({ installments: plan.installments }).where(eq(payment_plan.id, planId));

  const allPaid = plan.installments.every(i => i.paid_at !== null);
  if (allPaid && plan.status !== "completed") {
    await db.update(payment_plan).set({ status: "completed" }).where(eq(payment_plan.id, planId));
    await notifyTenantPlanComplete(plan);
  }
}
```

Key idempotency rule: **read state, check "is this already done?", mutate only if not**.

### Stripe API call idempotency

When **we** call Stripe (not webhook-driven), pass an idempotency key:

```ts
await stripe.transfers.create(
  { /* ... */ },
  { idempotencyKey: `transfer_${case_id}_${period}` },
);
```

This makes our outbound calls safe to retry.

### Local dev setup

```bash
# In one terminal:
pnpm dev

# In another terminal:
pnpm stripe:listen
# This prints a STRIPE_WEBHOOK_SECRET — copy into .env.local as STRIPE_WEBHOOK_SECRET
# (Dev secret is different from prod secret; that's fine.)
```

### Events we listen to

| Event | Handler | What it does |
|---|---|---|
| `checkout.session.completed` | `handleCheckoutCompleted` | Mark rent_obligation paid, trigger landlord disbursement queueing |
| `invoice.paid` | `handleInvoicePaid` | Mark plan installment paid; if all paid, complete plan |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` | Trigger agent with `rent_failed_charge` |
| `invoice.finalized` | `handleInvoiceFinalized` | Sanity-log when an invoice we created becomes ready-to-send |
| `transfer.created` | `handleTransferCreated` | Mark vendor_invoice.status='paid' or disbursement complete |
| `account.updated` | `handleAccountUpdated` | Refresh Connect account state in our DB |

Anything else: log and ignore.

## Open questions

- Long-running handlers: if dispatching to the agent inside the webhook handler exceeds 10s, Stripe retries. We **do not** dispatch the agent inline — we queue work via a `pending_triggers` row picked up by `/api/cron/process-triggers` every minute. (Implementation detail — captured here, may want its own ADR.)
- Pruning `processed_webhook` table — periodically delete rows >30 days old. Not for MVP.
- Cross-region webhook latency: Vercel can route a EU webhook to US-East. Probably not a problem at our scale.

## References

- Stripe webhooks: https://stripe.com/docs/webhooks
- Stripe webhook signing: https://stripe.com/docs/webhooks/signatures
- Stripe idempotency: https://stripe.com/docs/api/idempotent_requests
- ADR-0003 — Plan negotiation (where `invoice.paid` matters most)
- ADR-0007 — DB schema (`processed_webhook` table)
- ADR-0009 — Hosting (webhook URL registration)
