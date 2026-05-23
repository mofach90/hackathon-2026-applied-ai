import { z } from "zod";

const TenantHistoryEntrySchema = z.object({
  month: z.string(),
  amount_eur_cents: z.number().int(),
  paid_at: z.string().nullable(),
  days_late: z.number().int().nullable(),
});

const PriorMahnungSchema = z.object({
  level: z.number().int().min(1).max(3),
  sent_at: z.string(),
});

const TenantHistorySchema = z.object({
  rent_obligations: z.array(TenantHistoryEntrySchema),
  prior_mahnungen_this_cycle: z.array(PriorMahnungSchema),
  prior_outreach_this_cycle: z.number().int().nonnegative(),
});

const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  language: z.string(),
  monthly_rent_eur_cents: z.number().int().positive(),
});

const CurrentEventSchema = z.object({
  type: z.enum([
    "rent_late",
    "vendor_invoice_received",
    "scheduled_disbursement",
    "compliance_trigger",
  ]),
  days_late: z.number().int().nonnegative().nullable(),
  amount_eur_cents: z.number().int().nonnegative().nullable(),
  event_payload: z.record(z.string(), z.unknown()),
});

export const AgentContextSchema = z.object({
  case_id: z.string().uuid(),
  tenant: TenantSchema,
  tenant_history: TenantHistorySchema,
  current_event: CurrentEventSchema,
  unstructured_inputs: z.array(
    z.object({ source: z.string(), content: z.string() }),
  ),
});

export type AgentContext = z.infer<typeof AgentContextSchema>;
export type TenantHistory = z.infer<typeof TenantHistorySchema>;
export type CurrentEvent = z.infer<typeof CurrentEventSchema>;
