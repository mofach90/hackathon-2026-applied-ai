import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db/client";
import { landlord, vendor } from "@/db/schema";

function isVerified(account: Stripe.Account): boolean {
  return (
    account.charges_enabled === true &&
    account.payouts_enabled === true &&
    account.details_submitted === true
  );
}

export async function handleAccountUpdated(event: Stripe.Event): Promise<void> {
  const account = event.data.object as Stripe.Account;
  const stripeAccountId = account.id;
  const verified = isVerified(account);

  // Try landlord
  const landlordRows = await db
    .select()
    .from(landlord)
    .where(eq(landlord.stripe_account_id, stripeAccountId));

  if (landlordRows.length > 0) {
    // landlord table has no kyc/status field — log only (no-op update needed)
    console.log(`[account-updated] landlord ${landlordRows[0]?.id} account verified=${verified}`);
    return;
  }

  // Try vendor
  const vendorRows = await db
    .select()
    .from(vendor)
    .where(eq(vendor.stripe_account_id, stripeAccountId));

  if (vendorRows.length > 0) {
    const v = vendorRows[0];
    if (!v) return;
    if (v.kyc_verified === verified) return; // idempotent

    await db
      .update(vendor)
      .set({ kyc_verified: verified })
      .where(eq(vendor.stripe_account_id, stripeAccountId));
    return;
  }

  console.warn(`[account-updated] No landlord or vendor found for account ${stripeAccountId}`);
}
