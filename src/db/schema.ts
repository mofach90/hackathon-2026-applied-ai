import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const disbursementCadenceEnum = pgEnum("disbursement_cadence", ["weekly", "monthly"]);

export const tenantLanguageEnum = pgEnum("tenant_language", ["de", "en", "fr"]);

export const workOrderStatusEnum = pgEnum("work_order_status", ["open", "completed", "cancelled"]);

export const vendorInvoiceStatusEnum = pgEnum("vendor_invoice_status", [
  "received",
  "verified",
  "paid",
  "rejected",
]);

export const rentObligationStatusEnum = pgEnum("rent_obligation_status", [
  "pending",
  "paid",
  "late",
  "in_plan",
]);

export const planStatusEnum = pgEnum("plan_status", ["active", "completed", "cancelled", "broken"]);

export const caseStatusEnum = pgEnum("case_status", [
  "pending",
  "executed",
  "failed",
  "blocked_retry",
  "escalated",
]);

export const escalationReasonEnum = pgEnum("escalation_reason", [
  "compliance_block",
  "manual_review",
  "tenant_request",
  "payment_failure",
]);

export const escalationUrgencyEnum = pgEnum("escalation_urgency", ["low", "medium", "high"]);

export const escalationStatusEnum = pgEnum("escalation_status", [
  "open",
  "in_progress",
  "resolved",
]);

export const landlord = pgTable("landlord", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  stripe_account_id: text("stripe_account_id").notNull(),
  mgmt_fee_pct: integer("mgmt_fee_pct").notNull(),
  disbursement_cadence: disbursementCadenceEnum("disbursement_cadence").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const property = pgTable("property", {
  id: uuid("id").primaryKey().defaultRandom(),
  landlord_id: uuid("landlord_id")
    .notNull()
    .references(() => landlord.id),
  address: text("address").notNull(),
  unit: text("unit"),
  monthly_rent_eur_cents: integer("monthly_rent_eur_cents").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenant = pgTable("tenant", {
  id: uuid("id").primaryKey().defaultRandom(),
  property_id: uuid("property_id")
    .notNull()
    .references(() => property.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  language: tenantLanguageEnum("language").notNull(),
  phone: text("phone"),
  stripe_customer_id: text("stripe_customer_id").notNull(),
  tenancy_started: timestamp("tenancy_started", { withTimezone: true }).notNull(),
  lease_end: timestamp("lease_end", { withTimezone: true }),
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

export const workOrder = pgTable("work_order", {
  id: uuid("id").primaryKey().defaultRandom(),
  property_id: uuid("property_id")
    .notNull()
    .references(() => property.id),
  vendor_id: uuid("vendor_id")
    .notNull()
    .references(() => vendor.id),
  description: text("description").notNull(),
  quoted_amount_eur_cents: integer("quoted_amount_eur_cents").notNull(),
  status: workOrderStatusEnum("status").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vendorInvoice = pgTable("vendor_invoice", {
  id: uuid("id").primaryKey().defaultRandom(),
  work_order_id: uuid("work_order_id")
    .notNull()
    .references(() => workOrder.id),
  vendor_id: uuid("vendor_id")
    .notNull()
    .references(() => vendor.id),
  amount_eur_cents: integer("amount_eur_cents").notNull(),
  pdf_url: text("pdf_url"),
  status: vendorInvoiceStatusEnum("status").notNull(),
  paid_at: timestamp("paid_at", { withTimezone: true }),
  stripe_transfer_id: text("stripe_transfer_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rentObligation = pgTable("rent_obligation", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id),
  period_start: timestamp("period_start", { withTimezone: true }).notNull(),
  period_end: timestamp("period_end", { withTimezone: true }).notNull(),
  amount_eur_cents: integer("amount_eur_cents").notNull(),
  stripe_invoice_id: text("stripe_invoice_id"),
  status: rentObligationStatusEnum("status").notNull(),
  due_date: timestamp("due_date", { withTimezone: true }).notNull(),
  paid_at: timestamp("paid_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentPlan = pgTable("payment_plan", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id),
  original_rent_obligation_id: uuid("original_rent_obligation_id").references(
    () => rentObligation.id,
  ),
  installments: jsonb("installments").notNull(),
  status: planStatusEnum("status").notNull(),
  cancellation_reason: text("cancellation_reason"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentCase = pgTable("agent_case", {
  id: uuid("id").primaryKey().defaultRandom(),
  demo_run_id: text("demo_run_id"),
  trigger_type: text("trigger_type").notNull(),
  trigger_payload: jsonb("trigger_payload").notNull(),
  context_used: jsonb("context_used").notNull(),
  unstructured_sources: jsonb("unstructured_sources").notNull(),
  reasoning_chain: jsonb("reasoning_chain").notNull(),
  decision: jsonb("decision").notNull(),
  confidence: integer("confidence").notNull(),
  alternatives_considered: jsonb("alternatives_considered").notNull(),
  compliance_check: jsonb("compliance_check").notNull(),
  fairness_check: jsonb("fairness_check").notNull(),
  outcome: caseStatusEnum("outcome").notNull(),
  audit: jsonb("audit").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const disbursement = pgTable("disbursement", {
  id: uuid("id").primaryKey().defaultRandom(),
  landlord_id: uuid("landlord_id")
    .notNull()
    .references(() => landlord.id),
  period_from: timestamp("period_from", { withTimezone: true }).notNull(),
  period_to: timestamp("period_to", { withTimezone: true }).notNull(),
  gross_eur_cents: integer("gross_eur_cents").notNull(),
  fee_eur_cents: integer("fee_eur_cents").notNull(),
  net_eur_cents: integer("net_eur_cents").notNull(),
  underlying_payments: jsonb("underlying_payments").notNull(),
  stripe_transfer_id: text("stripe_transfer_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const escalation = pgTable("escalation", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent_case_id: uuid("agent_case_id")
    .notNull()
    .references(() => agentCase.id),
  tenant_id: uuid("tenant_id").references(() => tenant.id),
  reason: escalationReasonEnum("reason").notNull(),
  urgency: escalationUrgencyEnum("urgency").notNull(),
  status: escalationStatusEnum("status").notNull(),
  resolved_by: text("resolved_by"),
  resolved_at: timestamp("resolved_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const processedWebhook = pgTable("processed_webhook", {
  event_id: text("event_id").primaryKey(),
  type: text("type").notNull(),
  processed_at: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});
