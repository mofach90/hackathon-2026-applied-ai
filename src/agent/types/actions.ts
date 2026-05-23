import { z } from "zod";

const SoftNudgeAction = z.object({
  kind: z.literal("soft_nudge"),
  message: z.string(),
  language: z.string(),
});

const FriendlyCheckInAction = z.object({
  kind: z.literal("friendly_check_in"),
  message: z.string(),
  language: z.string(),
  payment_link_url: z.string().url().nullable(),
});

const PlanNegotiationAction = z.object({
  kind: z.literal("plan_negotiation"),
  proposed_installments: z.number().int().positive(),
  installment_amount_eur_cents: z.number().int().positive(),
  message: z.string(),
  language: z.string(),
});

const LateFeeWarningAction = z.object({
  kind: z.literal("late_fee_warning"),
  fee_amount_eur_cents: z.number().int().positive(),
  message: z.string(),
  language: z.string(),
});

const FormalNoticeAction = z.object({
  kind: z.literal("formal_notice"),
  level: z.number().int().min(1).max(3),
  message: z.string(),
  language: z.string(),
});

const EscalateHumanAction = z.object({
  kind: z.literal("escalate_human"),
  urgency: z.enum(["low", "medium", "high"]),
  reason: z.string(),
});

const AutoPayoutVendorAction = z.object({
  kind: z.literal("auto_payout_vendor"),
  vendor_id: z.string().uuid(),
  amount_eur_cents: z.number().int().positive(),
  invoice_reference: z.string(),
});

const AutoDisburse_landlordAction = z.object({
  kind: z.literal("auto_disburse_landlord"),
  landlord_id: z.string().uuid(),
  amount_eur_cents: z.number().int().positive(),
  fee_eur_cents: z.number().int().nonnegative(),
});

export const AgentActionSchema = z.discriminatedUnion("kind", [
  SoftNudgeAction,
  FriendlyCheckInAction,
  PlanNegotiationAction,
  LateFeeWarningAction,
  FormalNoticeAction,
  EscalateHumanAction,
  AutoPayoutVendorAction,
  AutoDisburse_landlordAction,
]);

export type AgentAction = z.infer<typeof AgentActionSchema>;
export type ActionKind = AgentAction["kind"];
