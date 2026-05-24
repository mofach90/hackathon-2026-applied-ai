import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("[db] Missing DATABASE_URL environment variable.");
}

// prepare: false required for Supabase pgBouncer connection pooling (ADR-0007)
const sql = postgres(process.env.DATABASE_URL, { prepare: false });

export const db = drizzle(sql, { schema });
