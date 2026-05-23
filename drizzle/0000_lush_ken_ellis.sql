CREATE TYPE "public"."case_status" AS ENUM('pending', 'executed', 'failed', 'blocked_retry', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."disbursement_cadence" AS ENUM('weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."escalation_reason" AS ENUM('compliance_block', 'manual_review', 'tenant_request', 'payment_failure');--> statement-breakpoint
CREATE TYPE "public"."escalation_status" AS ENUM('open', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."escalation_urgency" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('active', 'completed', 'cancelled', 'broken');--> statement-breakpoint
CREATE TYPE "public"."rent_obligation_status" AS ENUM('pending', 'paid', 'late', 'in_plan');--> statement-breakpoint
CREATE TYPE "public"."tenant_language" AS ENUM('de', 'en', 'fr');--> statement-breakpoint
CREATE TYPE "public"."vendor_invoice_status" AS ENUM('received', 'verified', 'paid', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('open', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "agent_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"demo_run_id" text,
	"trigger_type" text NOT NULL,
	"trigger_payload" jsonb NOT NULL,
	"context_used" jsonb NOT NULL,
	"unstructured_sources" jsonb NOT NULL,
	"reasoning_chain" jsonb NOT NULL,
	"decision" jsonb NOT NULL,
	"confidence" integer NOT NULL,
	"alternatives_considered" jsonb NOT NULL,
	"compliance_check" jsonb NOT NULL,
	"fairness_check" jsonb NOT NULL,
	"outcome" "case_status" NOT NULL,
	"audit" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disbursement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"landlord_id" uuid NOT NULL,
	"period_from" timestamp with time zone NOT NULL,
	"period_to" timestamp with time zone NOT NULL,
	"gross_eur_cents" integer NOT NULL,
	"fee_eur_cents" integer NOT NULL,
	"net_eur_cents" integer NOT NULL,
	"underlying_payments" jsonb NOT NULL,
	"stripe_transfer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_case_id" uuid NOT NULL,
	"tenant_id" uuid,
	"reason" "escalation_reason" NOT NULL,
	"urgency" "escalation_urgency" NOT NULL,
	"status" "escalation_status" NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landlord" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"stripe_account_id" text NOT NULL,
	"mgmt_fee_pct" integer NOT NULL,
	"disbursement_cadence" "disbursement_cadence" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"original_rent_obligation_id" uuid,
	"installments" jsonb NOT NULL,
	"status" "plan_status" NOT NULL,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_webhook" (
	"event_id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"landlord_id" uuid NOT NULL,
	"address" text NOT NULL,
	"unit" text,
	"monthly_rent_eur_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rent_obligation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"amount_eur_cents" integer NOT NULL,
	"stripe_invoice_id" text,
	"status" "rent_obligation_status" NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"language" "tenant_language" NOT NULL,
	"phone" text,
	"stripe_customer_id" text NOT NULL,
	"tenancy_started" timestamp with time zone NOT NULL,
	"lease_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"stripe_account_id" text NOT NULL,
	"category" text NOT NULL,
	"kyc_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"amount_eur_cents" integer NOT NULL,
	"pdf_url" text,
	"status" "vendor_invoice_status" NOT NULL,
	"paid_at" timestamp with time zone,
	"stripe_transfer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quoted_amount_eur_cents" integer NOT NULL,
	"status" "work_order_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "disbursement" ADD CONSTRAINT "disbursement_landlord_id_landlord_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlord"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation" ADD CONSTRAINT "escalation_agent_case_id_agent_case_id_fk" FOREIGN KEY ("agent_case_id") REFERENCES "public"."agent_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation" ADD CONSTRAINT "escalation_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plan" ADD CONSTRAINT "payment_plan_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plan" ADD CONSTRAINT "payment_plan_original_rent_obligation_id_rent_obligation_id_fk" FOREIGN KEY ("original_rent_obligation_id") REFERENCES "public"."rent_obligation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_landlord_id_landlord_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlord"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_obligation" ADD CONSTRAINT "rent_obligation_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_invoice" ADD CONSTRAINT "vendor_invoice_work_order_id_work_order_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_invoice" ADD CONSTRAINT "vendor_invoice_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order" ADD CONSTRAINT "work_order_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order" ADD CONSTRAINT "work_order_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action;