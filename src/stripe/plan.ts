import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { tenant, paymentPlan } from "@/db/schema";
import { stripe } from "@/stripe/client";

export async function createPaymentPlan(
  tenant_id: string,
  amount_cents: number,
  installments: number,
): Promise<void> {
  const tenantRow = await db.query.tenant.findFirst({
    where: eq(tenant.id, tenant_id),
  });
  if (!tenantRow) throw new Error(`Tenant ${tenant_id} not found`);

  const base = Math.floor(amount_cents / installments);
  const remainder = amount_cents - base * installments;
  const planId = `plan_${tenant_id}_${Date.now()}`;

  const invoiceIds: string[] = [];

  for (let i = 0; i < installments; i++) {
    const installmentAmount = i === installments - 1 ? base + remainder : base;
    const idempotencyKey = `${planId}_${i}`;

    const invoice = await stripe.invoices.create(
      {
        customer: tenantRow.stripe_customer_id,
        collection_method: "send_invoice",
        days_until_due: (i + 1) * 30,
        metadata: {
          rentpilot_plan_id: planId,
          rentpilot_installment_index: String(i),
        },
      },
      { idempotencyKey: `${idempotencyKey}_create` },
    );

    await stripe.invoiceItems.create(
      {
        customer: tenantRow.stripe_customer_id,
        amount: installmentAmount,
        currency: "eur",
        invoice: invoice.id,
        description: `Payment plan installment ${i + 1} of ${installments}`,
      },
      { idempotencyKey: `${idempotencyKey}_item` },
    );

    await stripe.invoices.finalizeInvoice(invoice.id, undefined, {
      idempotencyKey: `${idempotencyKey}_finalize`,
    });

    if (i === 0) {
      await stripe.invoices.sendInvoice(invoice.id, undefined, {
        idempotencyKey: `${idempotencyKey}_send`,
      });
    }

    invoiceIds.push(invoice.id);
  }

  await db.insert(paymentPlan).values({
    tenant_id,
    installments: invoiceIds.map((id, i) => ({
      stripe_invoice_id: id,
      index: i,
      amount_cents: i === installments - 1 ? base + remainder : base,
    })),
    status: "active",
  });
}
