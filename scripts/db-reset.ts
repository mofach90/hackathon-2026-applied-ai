import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const client = postgres(DATABASE_URL, { prepare: false });
const db = drizzle(client);

async function reset() {
  // Truncate in reverse FK dependency order
  await db.execute(sql`
    TRUNCATE TABLE
      escalation,
      agent_case,
      payment_plan,
      processed_webhook,
      disbursement,
      vendor_invoice,
      work_order,
      rent_obligation,
      tenant,
      vendor,
      property,
      landlord
    RESTART IDENTITY CASCADE
  `);

  console.log("✓ Reset complete");
  await client.end();
}

reset().catch((err) => {
  console.error(err);
  process.exit(1);
});
