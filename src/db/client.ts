import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";

// prepare: false required for Supabase pgBouncer connection pooling (ADR-0007)
const sql = postgres(env.DATABASE_URL, { prepare: false });

export const db = drizzle(sql);
