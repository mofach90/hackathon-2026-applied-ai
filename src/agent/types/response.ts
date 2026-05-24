import { z } from "zod";
import { AgentActionSchema } from "./actions";
import { ComplianceCheckSchema } from "./compliance";
import { FairnessCheckSchema } from "./fairness";

const UnstructuredSourceSchema = z.object({
  source: z.string(),
  excerpt: z.string(),
  weight: z.number().min(0).max(1),
});

const ReasoningStepSchema = z.object({
  step: z.number().int().positive(),
  thought: z.string(),
  evidence: z.array(z.string()).optional(),
});

const AlternativeConsideredSchema = z.object({
  action_kind: z.string(),
  reason_not_chosen: z.string(),
});

const AuditSchema = z.object({
  timestamp: z.string(),
  model: z.string(),
  prompt_version: z.string(),
  policy_version: z.string(),
});

export const AgentResponseSchema = z.object({
  case_id: z.string().uuid(),
  action: AgentActionSchema,
  confidence: z.number().min(0).max(1),
  reasoning_summary: z.string().optional().default(""),
  reasoning_chain: z.array(ReasoningStepSchema),
  unstructured_sources: z.array(UnstructuredSourceSchema).optional().default([]),
  alternatives_considered: z.array(AlternativeConsideredSchema).optional().default([]),
  compliance_check: ComplianceCheckSchema,
  fairness_check: FairnessCheckSchema,
  audit: AuditSchema,
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;
export type UnstructuredSource = z.infer<typeof UnstructuredSourceSchema>;
export type ReasoningStep = z.infer<typeof ReasoningStepSchema>;
