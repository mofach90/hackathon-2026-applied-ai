import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db/client";
import { disbursement, vendorInvoice } from "@/db/schema";

export async function handleTransferCreated(event: Stripe.Event): Promise<void> {
  const transfer = event.data.object as Stripe.Transfer;

  // Try disbursement first
  const disbursementRows = await db
    .select()
    .from(disbursement)
    .where(eq(disbursement.stripe_transfer_id, transfer.id));

  if (disbursementRows.length > 0) {
    // Already has stripe_transfer_id set — nothing to update for disbursements
    // (the transfer_id was set at creation; this is just a confirmation)
    console.log(`[transfer-created] disbursement ${disbursementRows[0]?.id} confirmed`);
    return;
  }

  // Try vendor invoice
  const invoiceRows = await db
    .select()
    .from(vendorInvoice)
    .where(eq(vendorInvoice.stripe_transfer_id, transfer.id));

  if (invoiceRows.length > 0) {
    const inv = invoiceRows[0];
    if (!inv) return;
    if (inv.status === "paid") return; // idempotent

    await db
      .update(vendorInvoice)
      .set({ status: "paid", paid_at: new Date() })
      .where(eq(vendorInvoice.stripe_transfer_id, transfer.id));
    return;
  }

  // Check metadata for explicit references
  const disbursementId = transfer.metadata?.rentpilot_disbursement_id;
  const vendorInvoiceId = transfer.metadata?.rentpilot_vendor_invoice_id;

  if (disbursementId) {
    const rows = await db.select().from(disbursement).where(eq(disbursement.id, disbursementId));
    if (rows.length > 0) {
      console.log(`[transfer-created] disbursement ${disbursementId} confirmed via metadata`);
    }
    return;
  }

  if (vendorInvoiceId) {
    const rows = await db.select().from(vendorInvoice).where(eq(vendorInvoice.id, vendorInvoiceId));
    if (rows.length === 0) return;
    const row = rows[0];
    if (!row) return;
    if (row.status === "paid") return; // idempotent

    await db
      .update(vendorInvoice)
      .set({ status: "paid", paid_at: new Date(), stripe_transfer_id: transfer.id })
      .where(eq(vendorInvoice.id, vendorInvoiceId));
  }
}
