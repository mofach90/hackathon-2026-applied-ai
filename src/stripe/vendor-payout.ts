import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { vendor, vendorInvoice } from "@/db/schema";
import { stripe } from "@/stripe/client";

export async function payVendorInvoice(vendor_invoice_id: string): Promise<void> {
  const invoiceRow = await db.query.vendorInvoice.findFirst({
    where: eq(vendorInvoice.id, vendor_invoice_id),
  });
  if (!invoiceRow) throw new Error(`VendorInvoice ${vendor_invoice_id} not found`);

  if (invoiceRow.status === "paid") {
    throw new Error(`VendorInvoice ${vendor_invoice_id} already has status '${invoiceRow.status}'`);
  }

  const vendorRow = await db.query.vendor.findFirst({
    where: eq(vendor.id, invoiceRow.vendor_id),
  });
  if (!vendorRow) throw new Error(`Vendor ${invoiceRow.vendor_id} not found`);

  await stripe.transfers.create(
    {
      amount: invoiceRow.amount_eur_cents,
      currency: "eur",
      destination: vendorRow.stripe_account_id,
      description: `RentPilot vendor payout for invoice ${vendor_invoice_id}`,
    },
    { idempotencyKey: `vendor_payout_${vendor_invoice_id}` },
  );

  await db
    .update(vendorInvoice)
    .set({ status: "paid" })
    .where(eq(vendorInvoice.id, vendor_invoice_id));
}
