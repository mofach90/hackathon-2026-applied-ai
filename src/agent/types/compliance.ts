import { z } from "zod";

export const ComplianceResultItemSchema = z.object({
  rule_id: z.enum([
    "verzug_grace",
    "mahnung_spacing",
    "late_fee_cap",
    "contact_hours",
    "language_match",
    "max_reminders_per_cycle",
  ]),
  rule_description: z.string(),
  result: z.enum(["pass", "fail", "n/a"]),
  note: z.string().optional(),
});

export const ComplianceCheckSchema = z.object({
  overall: z.enum(["pass", "fail"]),
  results: z.array(ComplianceResultItemSchema),
  blocked_reason: z.string().optional(),
  suggested_alternative: z.string().optional(),
});

export type ComplianceResult = z.infer<typeof ComplianceResultItemSchema>;
export type ComplianceCheck = z.infer<typeof ComplianceCheckSchema>;
