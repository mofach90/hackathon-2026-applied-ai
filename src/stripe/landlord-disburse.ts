import { and, between, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { rentObligation, tenant, property, landlord, disbursement } from "@/db/schema";
import { stripe } from "@/stripe/client";
import { env } from "@/lib/env";

export async function disburseLandlord(period: { from: Date; to: Date }): Promise<void> {
  // Query rent obligations paid within the period
  const obligations = await db
    .select({
      id: rentObligation.id,
      amount_eur_cents: rentObligation.amount_eur_cents,
      landlord_id: landlord.id,
      stripe_account_id: landlord.stripe_account_id,
    })
    .from(rentObligation)
    .innerJoin(tenant, eq(rentObligation.tenant_id, tenant.id))
    .innerJoin(property, eq(tenant.property_id, property.id))
    .innerJoin(landlord, eq(property.landlord_id, landlord.id))
    .where(and(between(rentObligation.paid_at, period.from, period.to)));

  // Sum amounts per landlord
  const byLandlord = new Map<
    string,
    { stripe_account_id: string; gross: number; obligation_ids: string[] }
  >();

  for (const row of obligations) {
    const existing = byLandlord.get(row.landlord_id);
    if (existing) {
      existing.gross += row.amount_eur_cents;
      existing.obligation_ids.push(row.id);
    } else {
      byLandlord.set(row.landlord_id, {
        stripe_account_id: row.stripe_account_id,
        gross: row.amount_eur_cents,
        obligation_ids: [row.id],
      });
    }
  }

  const fromIso = period.from.toISOString();
  const toIso = period.to.toISOString();

  for (const [landlord_id, data] of byLandlord.entries()) {
    const fee = Math.floor((data.gross * env.STRIPE_CONNECT_LANDLORD_PLATFORM_FEE_BPS) / 10000);
    const net = data.gross - fee;

    const transfer = await stripe.transfers.create(
      {
        amount: net,
        currency: "eur",
        destination: data.stripe_account_id,
        description: `RentPilot landlord disbursement ${fromIso} – ${toIso}`,
      },
      { idempotencyKey: `landlord_disburse_${landlord_id}_${fromIso}_${toIso}` },
    );

    await db.insert(disbursement).values({
      landlord_id,
      period_from: period.from,
      period_to: period.to,
      gross_eur_cents: data.gross,
      fee_eur_cents: fee,
      net_eur_cents: net,
      underlying_payments: data.obligation_ids,
      stripe_transfer_id: transfer.id,
    });
  }
}
