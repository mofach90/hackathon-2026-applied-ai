import { z } from "zod";

export const FairnessCheckSchema = z.object({
  forbidden_keywords_present: z.boolean(),
  counterfactual_agreed: z.boolean().nullable(),
  overall: z.enum(["pass", "fail"]),
  blocked_reason: z.string().optional(),
});

export type FairnessCheck = z.infer<typeof FairnessCheckSchema>;
