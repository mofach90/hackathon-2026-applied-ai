# ADR 0007: Database & ORM

- **Status:** Accepted
- **Date:** 2026-05-23
- **Deciders:** Mohamed Ayari, Aymen

## Context

We need a database that:

- Stores typed relational entities (landlords, tenants, properties, invoices, plans)
- Stores semi-structured audit envelopes (`agent_case` with `jsonb` columns)
- Is queryable for the demo (Stripe Sigma-like aggregations)
- Works with Vercel deploys out of the box
- Doesn't require ops time we don't have

## Decision

| Layer | Choice |
|---|---|
| Database | **Supabase managed Postgres** (free tier) |
| ORM | **Drizzle ORM** |
| Migrations | **Drizzle Kit** (`drizzle-kit generate` + `drizzle-kit push`) |
| Client | `postgres` (postgres.js) over connection pooling |
| Seed | Custom TypeScript script `src/db/seed.ts`, run via `pnpm db:seed` |

## Consequences

### Easier

- Supabase gives us Postgres + connection pooling + a dashboard for ad-hoc SQL — zero ops
- Drizzle is **schema-first**, types flow automatically from `schema.ts` to query results
- JSONB columns handle the agent_case audit envelope without schema gymnastics
- Free tier covers the demo
- We can write SQL directly when we need it (audit queries during the demo)

### Harder

- Supabase free tier has connection limits — we use pgbouncer (Supabase's pooler) endpoint
- Drizzle is younger than Prisma; fewer Stack Overflow answers
- We deliberately don't use Supabase Auth or Storage — only Postgres

## Alternatives considered

- **Prisma.** Pro: mature, large community. Con: separate `schema.prisma`; longer cold starts on serverless; type inference for JSON columns is weaker.
- **Raw `postgres` (no ORM).** Pro: zero abstraction. Con: write more glue code; lose type safety on result shapes.
- **Neon serverless Postgres.** Pro: also fine. Con: we know Supabase better; dashboard is more useful for the demo.
- **PlanetScale (MySQL).** Pro: serverless. Con: not Postgres; lose JSONB ergonomics that matter for the audit envelope.
- **SQLite + Turso.** Pro: fast. Con: weaker JSONB story; harder to demo with Sigma-like queries.

## Implementation notes

### Schema (`src/db/schema.ts`)

```ts
import { pgTable, uuid, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const landlord = pgTable("landlord", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  stripe_account_id: text("stripe_account_id").notNull(),
  mgmt_fee_pct: integer("mgmt_fee_pct").notNull(),    // bps not pct, see ADR-0019
  disbursement_cadence: text("disbursement_cadence").notNull(),  // 'weekly' | 'monthly'
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const property = pgTable("property", {
  id: uuid("id").primaryKey().defaultRandom(),
  landlord_id: uuid("landlord_id").notNull().references(() => landlord.id),
  address: text("address").notNull(),
  unit: text("unit"),
  monthly_rent_eur_cents: integer("monthly_rent_eur_cents").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenant = pgTable("tenant", {
  id: uuid("id").primaryKey().defaultRandom(),
  property_id: uuid("property_id").notNull().references(() => property.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  language: text("language").notNull(),               // 'de' | 'en' | 'fr'
  phone: text("phone"),
  stripe_customer_id: text("stripe_customer_id").notNull(),
  tenancy_started: timestamp("tenancy_started").notNull(),
  lease_end: timestamp("lease_end"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vendor = pgTable("vendor", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  stripe_account_id: text("stripe_account_id").notNull(),
  category: text("category").notNull(),
  kyc_verified: boolean("kyc_verified").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const work_order = pgTable("work_order", {
  id: uuid("id").primaryKey().defaultRandom(),
  property_id: uuid("property_id").notNull().references(() => property.id),
  vendor_id: uuid("vendor_id").notNull().references(() => vendor.id),
  description: text("description").notNull(),
  quoted_amount_eur_cents: integer("quoted_amount_eur_cents").notNull(),
  status: text("status").notNull(),                   // 'open' | 'completed' | 'cancelled'
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vendor_invoice = pgTable("vendor_invoice", {
  id: uuid("id").primaryKey().defaultRandom(),
  work_order_id: uuid("work_order_id").notNull().references(() => work_order.id),
  vendor_id: uuid("vendor_id").notNull().references(() => vendor.id),
  amount_eur_cents: integer("amount_eur_cents").notNull(),
  pdf_url: text("pdf_url"),
  status: text("status").notNull(),                   // 'received' | 'verified' | 'paid' | 'rejected'
  paid_at: timestamp("paid_at"),
  stripe_transfer_id: text("stripe_transfer_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rent_obligation = pgTable("rent_obligation", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenant.id),
  period_start: timestamp("period_start").notNull(),
  period_end: timestamp("period_end").notNull(),
  amount_eur_cents: integer("amount_eur_cents").notNull(),
  stripe_invoice_id: text("stripe_invoice_id"),
  status: text("status").notNull(),                   // 'pending' | 'paid' | 'late' | 'in_plan'
  due_date: timestamp("due_date").notNull(),
  paid_at: timestamp("paid_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payment_plan = pgTable("payment_plan", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenant.id),
  original_rent_obligation_id: uuid("original_rent_obligation_id").references(() => rent_obligation.id),
  installments: jsonb("installments").notNull(),      // Array<Installment>
  status: text("status").notNull(),                   // 'active' | 'completed' | 'cancelled' | 'broken'
  cancellation_reason: text("cancellation_reason"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agent_case = pgTable("agent_case", {
  id: uuid("id").primaryKey().defaultRandom(),
  demo_run_id: text("demo_run_id"),                   // for isolating demo rehearsals
  trigger_type: text("trigger_type").notNull(),
  trigger_payload: jsonb("trigger_payload").notNull(),
  context_used: jsonb("context_used").notNull(),
  unstructured_sources: jsonb("unstructured_sources").notNull(),
  reasoning_chain: jsonb("reasoning_chain").notNull(),
  decision: jsonb("decision").notNull(),
  confidence: integer("confidence").notNull(),        // 0..100
  alternatives_considered: jsonb("alternatives_considered").notNull(),
  compliance_check: jsonb("compliance_check").notNull(),
  fairness_check: jsonb("fairness_check").notNull(),
  outcome: text("outcome").notNull(),                 // 'pending' | 'executed' | 'failed' | 'blocked_retry' | 'escalated'
  audit: jsonb("audit").notNull(),                    // { timestamp, model, prompt_version, policy_version }
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const disbursement = pgTable("disbursement", {
  id: uuid("id").primaryKey().defaultRandom(),
  landlord_id: uuid("landlord_id").notNull().references(() => landlord.id),
  period_from: timestamp("period_from").notNull(),
  period_to: timestamp("period_to").notNull(),
  gross_eur_cents: integer("gross_eur_cents").notNull(),
  fee_eur_cents: integer("fee_eur_cents").notNull(),
  net_eur_cents: integer("net_eur_cents").notNull(),
  underlying_payments: jsonb("underlying_payments").notNull(),
  stripe_transfer_id: text("stripe_transfer_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const escalation = pgTable("escalation", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent_case_id: uuid("agent_case_id").notNull().references(() => agent_case.id),
  tenant_id: uuid("tenant_id").references(() => tenant.id),
  reason: text("reason").notNull(),
  urgency: text("urgency").notNull(),                 // 'low' | 'medium' | 'high'
  status: text("status").notNull(),                   // 'open' | 'in_progress' | 'resolved'
  resolved_by: text("resolved_by"),
  resolved_at: timestamp("resolved_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const processed_webhook = pgTable("processed_webhook", {
  // Idempotency table for Stripe webhooks — see ADR-0012
  event_id: text("event_id").primaryKey(),
  type: text("type").notNull(),
  processed_at: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### Client (`src/db/client.ts`)

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;  // Supabase pooler URL
const sql = postgres(connectionString, { prepare: false });
export const db = drizzle(sql, { schema });
```

For Vercel Edge runtime we'd swap to `drizzle-orm/postgres-js` with a different client; for our case the Node runtime suffices.

### Migrations

```bash
pnpm drizzle-kit generate    # generate migration SQL from schema.ts
pnpm drizzle-kit push        # apply to dev DB
```

For demo simplicity, we **don't** use migration history files; we apply schema diff directly via `push`. Pre-production this would change.

### JSONB query patterns

Audit queries the landlord sees during the demo:

```sql
-- All actions in the past hour, sorted by impact
select id, trigger_type, decision->>'kind' as action,
       compliance_check->>'status' as compliance,
       fairness_check->>'status' as fairness,
       created_at
from agent_case
where created_at > now() - interval '1 hour'
order by created_at desc;

-- All Mahnungen sent to a specific tenant
select id, decision, audit, created_at
from agent_case
where decision->>'kind' = 'formal_notice'
  and trigger_payload->>'tenant_id' = $1
order by created_at desc;

-- All blocked actions and the rule that blocked them
select id, decision->>'kind' as proposed_action,
       compliance_check->'rules_checked' as rules
from agent_case
where compliance_check->>'status' = 'fail'
order by created_at desc;
```

### Money columns

All monetary amounts stored as `integer` cents. See ADR-0019 + DEVELOPMENT.md.

## Open questions

- Row-level security? Not for demo (single tenant). Add for production.
- Backup strategy? Supabase free tier has automatic backups; that's enough for demo.
- Read replicas? Not for demo.

## References

- Supabase: https://supabase.com/docs
- Drizzle ORM: https://orm.drizzle.team/
- ADR-0006 — Application stack
- ADR-0009 — Hosting (where Supabase lives)
- ADR-0019 — Money & time handling (cents discipline)
