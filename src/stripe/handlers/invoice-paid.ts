import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db/client";
import { paymentPlan } from "@/db/schema";

export async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const planId = invoice.metadata?.rentpilot_plan_id;
  const installmentIndex = invoice.metadata?.rentpilot_installment_index;

  if (!planId || installmentIndex === undefined) {
    // Not a payment plan invoice — nothing to do
    return;
  }

  const idx = Number(installmentIndex);

  const planRow = await db.query.paymentPlan.findFirst({
    where: eq(paymentPlan.id, planId),
  });

  if (!planRow) {
    console.warn(`[invoice-paid] No payment plan found for id ${planId}`);
    return;
  }

  if (planRow.status === "completed") return; // idempotent

  const installments = planRow.installments as Array<{
    stripe_invoice_id: string;
    index: number;
    amount_cents: number;
    paid_at?: string;
  }>;

  // Mark this installment as paid
  const updated = installments.map((inst) =>
    inst.index === idx ? { ...inst, paid_at: new Date().toISOString() } : inst,
  );

  // Check if all installments are now paid
  const allPaid = updated.every((inst) => !!inst.paid_at);

  await db
    .update(paymentPlan)
    .set({
      installments: updated,
      status: allPaid ? "completed" : planRow.status,
    })
    .where(eq(paymentPlan.id, planId));
}
