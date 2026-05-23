import { db } from "@/db/client";
import { agentCase } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AgentContext } from "@/agent/types/context";
import type { AgentAction } from "@/agent/types";
import type { ComplianceCheck } from "@/agent/types/compliance";
import type { FairnessCheck } from "@/agent/types/fairness";

export interface AuditEnvelope {
  input: AgentContext;
  redacted_input: AgentContext;
  action: AgentAction;
  compliance: ComplianceCheck;
  fairness: FairnessCheck;
  model: string;
  prompt_version: string;
  timestamp: string;
}

/**
 * Persists an audit envelope to the agent_case row identified by case_id.
 * Writes audit_envelope (stored in the `audit` column), compliance_check,
 * and fairness_check.
 */
export async function writeAuditEnvelope(
  case_id: string,
  envelope: AuditEnvelope,
): Promise<void> {
  await db
    .update(agentCase)
    .set({
      audit: envelope as unknown as Record<string, unknown>,
      compliance_check: envelope.compliance as unknown as Record<string, unknown>,
      fairness_check: envelope.fairness as unknown as Record<string, unknown>,
    })
    .where(eq(agentCase.id, case_id));
}
