/**
 * seed-stripe.ts
 *
 * Creates real Stripe objects for the demo seed data and persists their IDs
 * back into the database.
 *
 * Idempotent: skips creation if the DB row already contains a non-placeholder ID.
 * Safety: refuses to run against a live Stripe key (sk_live_…).
 *
 * Usage:
 *   pnpm stripe:seed
 */

import Stripe from "stripe";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

// ── env ──────────────────────────────────────────────────────────────────────

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is required");
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

if (STRIPE_SECRET_KEY.startsWith("sk_live_")) {
  throw new Error(
    "STRIPE_SECRET_KEY is a live key (sk_live_…). " +
      "This seed script must only run against test keys.",
  );
}

// ── clients ──────────────────────────────────────────────────────────────────

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2026-04-22.dahlia" });

const sql = postgres(DATABASE_URL, { prepare: false });
const db = drizzle(sql, { schema });

// ── well-known demo IDs (must match db-seed.ts) ───────────────────────────

const DEMO_IDS = {
  landlord: "a1000000-0000-0000-0000-000000000001",
  tenants: [
    {
      id: "c1000000-0000-0000-0000-000000000001",
      name: "Amina Benali",
      email: "amina.benali@example.com",
    },
    {
      id: "c1000000-0000-0000-0000-000000000002",
      name: "Mike Schmidt",
      email: "mike.schmidt@example.com",
    },
    {
      id: "c1000000-0000-0000-0000-000000000003",
      name: "Sara Petrović",
      email: "sara.petrovic@example.com",
    },
  ],
  vendor: {
    id: "d1000000-0000-0000-0000-000000000001",
    name: "Sanitär Müller GmbH",
    email: "mueller@sanitaer.demo",
  },
} as const;

// ── helpers ───────────────────────────────────────────────────────────────────

/** Returns true when the stored ID is a real Stripe ID (not a placeholder). */
function isRealStripeId(id: string, prefix: string): boolean {
  return id.startsWith(prefix) && !id.startsWith(`${prefix}_demo_`);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("stripe:seed — starting …");

  // ── 1. Stripe Customers for each tenant ────────────────────────────────────

  for (const t of DEMO_IDS.tenants) {
    const [row] = await db
      .select({ stripe_customer_id: schema.tenant.stripe_customer_id })
      .from(schema.tenant)
      .where(eq(schema.tenant.id, t.id));

    if (!row) {
      console.warn(`  tenant ${t.id} not found in DB — run pnpm db:seed first`);
      continue;
    }

    if (isRealStripeId(row.stripe_customer_id, "cus")) {
      console.log(`  tenant ${t.name}: already has customer ${row.stripe_customer_id} — skip`);
      continue;
    }

    const customer = await stripe.customers.create(
      { name: t.name, email: t.email, metadata: { demo_tenant_id: t.id } },
      { idempotencyKey: `seed-customer-${t.id}` },
    );

    await db
      .update(schema.tenant)
      .set({ stripe_customer_id: customer.id })
      .where(eq(schema.tenant.id, t.id));

    console.log(`  tenant ${t.name}: created customer ${customer.id}`);
  }

  // ── 2. Connect Express account for the landlord ────────────────────────────

  const [landlordRow] = await db
    .select({ id: schema.landlord.id, stripe_account_id: schema.landlord.stripe_account_id, email: schema.landlord.email, name: schema.landlord.name })
    .from(schema.landlord)
    .where(eq(schema.landlord.id, DEMO_IDS.landlord));

  if (!landlordRow) {
    console.warn(`  landlord ${DEMO_IDS.landlord} not found in DB — run pnpm db:seed first`);
  } else if (isRealStripeId(landlordRow.stripe_account_id, "acct")) {
    console.log(
      `  landlord ${landlordRow.name}: already has account ${landlordRow.stripe_account_id} — skip`,
    );
  } else {
    const account = await stripe.accounts.create(
      {
        type: "express",
        country: "DE",
        email: landlordRow.email,
        business_type: "individual",
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        business_profile: { mcc: "6513" },
        metadata: { demo_landlord_id: landlordRow.id },
      },
      { idempotencyKey: `seed-landlord-account-${landlordRow.id}` },
    );

    await db
      .update(schema.landlord)
      .set({ stripe_account_id: account.id })
      .where(eq(schema.landlord.id, landlordRow.id));

    console.log(`  landlord ${landlordRow.name}: created account ${account.id}`);
  }

  // ── 3. Connect Express account for the vendor ──────────────────────────────

  const [vendorRow] = await db
    .select({ id: schema.vendor.id, stripe_account_id: schema.vendor.stripe_account_id, email: schema.vendor.email, name: schema.vendor.name })
    .from(schema.vendor)
    .where(eq(schema.vendor.id, DEMO_IDS.vendor.id));

  if (!vendorRow) {
    console.warn(`  vendor ${DEMO_IDS.vendor.id} not found in DB — run pnpm db:seed first`);
  } else if (isRealStripeId(vendorRow.stripe_account_id, "acct")) {
    console.log(
      `  vendor ${vendorRow.name}: already has account ${vendorRow.stripe_account_id} — skip`,
    );
  } else {
    const account = await stripe.accounts.create(
      {
        type: "express",
        country: "DE",
        email: vendorRow.email,
        business_type: "individual",
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        business_profile: { mcc: "6513" },
        metadata: { demo_vendor_id: vendorRow.id },
      },
      { idempotencyKey: `seed-vendor-account-${vendorRow.id}` },
    );

    await db
      .update(schema.vendor)
      .set({ stripe_account_id: account.id })
      .where(eq(schema.vendor.id, vendorRow.id));

    console.log(`  vendor ${vendorRow.name}: created account ${account.id}`);
  }

  console.log("stripe:seed — done");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
