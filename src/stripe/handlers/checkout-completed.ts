import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db/client";
import { tenant, rentObligation } from "@/db/schema";

export async function handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const customerId = session.customer as string;

  if (!customerId) return;

  const tenantRow = await db.query.tenant.findFirst({
    where: eq(tenant.stripe_customer_id, customerId),
  });

  if (!tenantRow) {
    console.warn(`[checkout-completed] No tenant found for customer ${customerId}`);
    return;
  }

  // Mark the associated rent obligation as paid if linked via invoice
  const invoiceId = session.invoice as string | null;
  if (!invoiceId) return;

  const existing = await db.query.rentObligation.findFirst({
    where: eq(rentObligation.stripe_invoice_id, invoiceId),
  });

  if (!existing) return;
  if (existing.status === "paid") return; // idempotent

  await db
    .update(rentObligation)
    .set({ status: "paid", paid_at: new Date() })
    .where(eq(rentObligation.stripe_invoice_id, invoiceId));
}
