import type { AgentAction } from "@/agent/types";
import type { AgentContext } from "@/agent/types/context";
import type { ComplianceResult } from "@/agent/types/compliance";
import { COMPLIANCE_POLICY_V1 } from "./policy";
import { ruleChecks } from "./rules";

export const MAX_AGENT_RETRIES = 3;

export interface ComplianceFailure {
  attempt: number;
  action: AgentAction;
  failed_rules: ComplianceResult[];
}

export interface RunCompliantAgentResult {
  action: AgentAction;
  compliance_check: ComplianceResult[];
  retries: number;
}

export type AgentFn = (
  ctx: AgentContext,
  prior_failures?: ComplianceFailure[],
) => Promise<AgentAction>;

function runAllRules(action: AgentAction, ctx: AgentContext): ComplianceResult[] {
  return Object.values(ruleChecks)
    .map((check) => check(action, ctx, COMPLIANCE_POLICY_V1))
    .filter((r): r is ComplianceResult => r !== null);
}

function allPass(results: ComplianceResult[]): boolean {
  return results.every((r) => r.result === "pass");
}

/**
 * Runs the agent function, validates every compliance rule, and retries with
 * failure context if any rule fails. After MAX_AGENT_RETRIES failed attempts
 * it falls back to escalate_human so a human can resolve the conflict.
 */
export async function runCompliantAgent(
  ctx: AgentContext,
  agentFn: AgentFn,
): Promise<RunCompliantAgentResult> {
  const failures: ComplianceFailure[] = [];

  for (let attempt = 0; attempt < MAX_AGENT_RETRIES; attempt++) {
    const action = await agentFn(ctx, failures.length > 0 ? failures : undefined);
    const results = runAllRules(action, ctx);

    if (allPass(results)) {
      return { action, compliance_check: results, retries: attempt };
    }

    failures.push({
      attempt,
      action,
      failed_rules: results.filter((r) => r.result === "fail"),
    });
  }

  const escalate: AgentAction = { kind: "escalate_human", urgency: "high", reason: "max retries exceeded — compliance rules repeatedly violated" };
  return {
    action: escalate,
    compliance_check: failures.at(-1)?.failed_rules ?? [],
    retries: MAX_AGENT_RETRIES,
  };
}
