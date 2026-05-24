import { db } from "@/db/client";
import { agentCase } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AgentContext } from "@/agent/types/context";
import type { AgentAction } from "@/agent/types";
import type { ComplianceCheck } from "@/agent/types/compliance";
import type { FairnessCheck } from "@/agent/types/fairness";
import type { ReasoningStep, UnstructuredSource } from "@/agent/types/response";

export interface AuditEnvelope {
  input: AgentContext;
  redacted_input: AgentContext;
  action: AgentAction;
  compliance: ComplianceCheck;
  fairness: FairnessCheck;
  model: string;
  prompt_version: string;
  timestamp: string;
  confidence?: number;
  reasoning_summary?: string;
  reasoning_chain?: ReasoningStep[];
  unstructured_sources?: UnstructuredSource[];
  alternatives_considered?: { action_kind: string; reason_not_chosen: string }[];
}

export async function writeAuditEnvelope(case_id: string, envelope: AuditEnvelope): Promise<void> {
  await db
    .update(agentCase)
    .set({
      audit: envelope as unknown as Record<string, unknown>,
      compliance_check: envelope.compliance as unknown as Record<string, unknown>,
      fairness_check: envelope.fairness as unknown as Record<string, unknown>,
      decision: {
        action: envelope.action,
        reasoning_summary: envelope.reasoning_summary ?? "",
      } as unknown as Record<string, unknown>,
      confidence: envelope.confidence != null ? Math.round(envelope.confidence * 100) : undefined,
      reasoning_chain: (envelope.reasoning_chain ?? []) as unknown as Record<string, unknown>[],
      unstructured_sources: (envelope.unstructured_sources ?? []) as unknown as Record<string, unknown>[],
      alternatives_considered: (envelope.alternatives_considered ?? []) as unknown as Record<string, unknown>[],
      outcome: "executed",
    })
    .where(eq(agentCase.id, case_id));
}
