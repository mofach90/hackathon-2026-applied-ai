import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db/client";
import { tenant, agentCase } from "@/db/schema";

export async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;

  if (!customerId) return;

  const tenantRow = await db.query.tenant.findFirst({
    where: eq(tenant.stripe_customer_id, customerId),
  });

  if (!tenantRow) {
    console.warn(`[invoice-payment-failed] No tenant found for customer ${customerId}`);
    return;
  }

  // Idempotency: check if a case for this invoice already exists
  const existingCases = await db
    .select()
    .from(agentCase)
    .where(eq(agentCase.trigger_type, "rent_failed_charge"));

  const alreadyExists = existingCases.some((c) => {
    const payload = c.trigger_payload as Record<string, unknown>;
    return payload?.stripe_invoice_id === invoice.id;
  });

  if (alreadyExists) return;

  await db.insert(agentCase).values({
    trigger_type: "rent_failed_charge",
    trigger_payload: {
      stripe_invoice_id: invoice.id,
      tenant_id: tenantRow.id,
      customer_id: customerId,
      amount_due: invoice.amount_due,
    },
    context_used: {},
    unstructured_sources: [],
    reasoning_chain: [],
    decision: {},
    confidence: 0,
    alternatives_considered: [],
    compliance_check: {},
    fairness_check: {},
    outcome: "pending",
    audit: { created_by: "webhook", event_id: event.id },
  });
}
