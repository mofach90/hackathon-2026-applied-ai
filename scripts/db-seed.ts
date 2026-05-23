import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const sql = postgres(DATABASE_URL, { prepare: false });
const db = drizzle(sql, { schema });

const IDS = {
  landlord: "a1000000-0000-0000-0000-000000000001",
  property_amina: "b1000000-0000-0000-0000-000000000001",
  property_mike: "b1000000-0000-0000-0000-000000000002",
  property_sara: "b1000000-0000-0000-0000-000000000003",
  tenant_amina: "c1000000-0000-0000-0000-000000000001",
  tenant_mike: "c1000000-0000-0000-0000-000000000002",
  tenant_sara: "c1000000-0000-0000-0000-000000000003",
  vendor: "d1000000-0000-0000-0000-000000000001",
  work_order: "e1000000-0000-0000-0000-000000000001",
  vendor_invoice: "f1000000-0000-0000-0000-000000000001",
} as const;

async function seed() {
  // Landlord
  await db
    .insert(schema.landlord)
    .values({
      id: IDS.landlord,
      name: "Demo Landlord GmbH",
      email: "landlord@rentpilot.demo",
      stripe_account_id: "acct_demo_landlord",
      mgmt_fee_pct: 800, // 8% in basis points
      disbursement_cadence: "monthly",
    })
    .onConflictDoNothing();

  // Properties
  await db
    .insert(schema.property)
    .values([
      {
        id: IDS.property_amina,
        landlord_id: IDS.landlord,
        address: "Bergmannstr. 42",
        unit: "3L",
        monthly_rent_eur_cents: 120000, // €1,200
      },
      {
        id: IDS.property_mike,
        landlord_id: IDS.landlord,
        address: "Oranienstr. 17",
        unit: "2R",
        monthly_rent_eur_cents: 95000, // €950
      },
      {
        id: IDS.property_sara,
        landlord_id: IDS.landlord,
        address: "Gneisenaustr. 8",
        unit: "1L",
        monthly_rent_eur_cents: 110000, // €1,100
      },
    ])
    .onConflictDoNothing();

  // Tenants
  await db
    .insert(schema.tenant)
    .values([
      {
        id: IDS.tenant_amina,
        property_id: IDS.property_amina,
        name: "Amina Benali",
        email: "amina.benali@example.com",
        language: "fr",
        phone: "+49151000001",
        stripe_customer_id: "cus_demo_amina",
        tenancy_started: new Date("2024-11-01T00:00:00Z"),
      },
      {
        id: IDS.tenant_mike,
        property_id: IDS.property_mike,
        name: "Mike Schmidt",
        email: "mike.schmidt@example.com",
        language: "de",
        phone: "+49151000002",
        stripe_customer_id: "cus_demo_mike",
        tenancy_started: new Date("2023-06-01T00:00:00Z"),
      },
      {
        id: IDS.tenant_sara,
        property_id: IDS.property_sara,
        name: "Sara Petrović",
        email: "sara.petrovic@example.com",
        language: "en",
        phone: "+49151000003",
        stripe_customer_id: "cus_demo_sara",
        tenancy_started: new Date("2026-05-01T00:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  // Vendor (plumber)
  await db
    .insert(schema.vendor)
    .values({
      id: IDS.vendor,
      name: "Sanitär Müller GmbH",
      email: "mueller@sanitaer.demo",
      stripe_account_id: "acct_demo_vendor",
      category: "plumbing",
      kyc_verified: true,
    })
    .onConflictDoNothing();

  // Work order
  await db
    .insert(schema.workOrder)
    .values({
      id: IDS.work_order,
      property_id: IDS.property_amina,
      vendor_id: IDS.vendor,
      description: "Repair leaking pipe under kitchen sink",
      quoted_amount_eur_cents: 35000, // €350
      status: "completed",
    })
    .onConflictDoNothing();

  // Vendor invoice (awaiting payment — ready for demo flow)
  await db
    .insert(schema.vendorInvoice)
    .values({
      id: IDS.vendor_invoice,
      work_order_id: IDS.work_order,
      vendor_id: IDS.vendor,
      amount_eur_cents: 35000, // €350
      status: "verified",
    })
    .onConflictDoNothing();

  console.log("✓ Seed complete");
  await sql.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
