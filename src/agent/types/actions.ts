import { z } from "zod";

const SoftNudgeAction = z.object({
  kind: z.literal("soft_nudge"),
  message: z.string().default(""),
  language: z.string().default("en"),
});

const FriendlyCheckInAction = z.object({
  kind: z.literal("friendly_check_in"),
  message: z.string().default(""),
  language: z.string().default("en"),
  payment_link_url: z.string().url().nullable().optional().default(null),
});

const PlanNegotiationAction = z.object({
  kind: z.literal("plan_negotiation"),
  proposed_installments: z.number().int().positive().default(2),
  installment_amount_eur_cents: z.number().int().positive().default(0),
  message: z.string().default(""),
  language: z.string().default("en"),
});

const LateFeeWarningAction = z.object({
  kind: z.literal("late_fee_warning"),
  fee_amount_eur_cents: z.number().int().positive().default(0),
  message: z.string().default(""),
  language: z.string().default("en"),
});

const FormalNoticeAction = z.object({
  kind: z.literal("formal_notice"),
  level: z.number().int().min(1).max(3).default(1),
  message: z.string().default(""),
  language: z.string().default("en"),
});

const EscalateHumanAction = z.object({
  kind: z.literal("escalate_human"),
  urgency: z.enum(["low", "medium", "high"]).default("medium"),
  reason: z.string().default(""),
});

const AutoPayoutVendorAction = z.object({
  kind: z.literal("auto_payout_vendor"),
  vendor_id: z.string().default(""),
  amount_eur_cents: z.number().int().positive().default(0),
  invoice_reference: z.string().default(""),
});

const AutoDisburseLandlordAction = z.object({
  kind: z.literal("auto_disburse_landlord"),
  landlord_id: z.string().default(""),
  amount_eur_cents: z.number().int().positive().default(0),
  fee_eur_cents: z.number().int().nonnegative().default(0),
});

export const AgentActionSchema = z.discriminatedUnion("kind", [
  SoftNudgeAction,
  FriendlyCheckInAction,
  PlanNegotiationAction,
  LateFeeWarningAction,
  FormalNoticeAction,
  EscalateHumanAction,
  AutoPayoutVendorAction,
  AutoDisburseLandlordAction,
]);

export type AgentAction = z.infer<typeof AgentActionSchema>;
export type ActionKind = AgentAction["kind"];
