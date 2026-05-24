import "server-only";

import { buildAgentContext } from "@/agent/context-builder";
import { sanitizeContext } from "@/agent/fairness/sanitize";
import { checkOutputGuardrails } from "@/agent/fairness/guardrails";
import { runCounterfactual } from "@/agent/fairness/counterfactual";
import { runCompliantAgent, type AgentFn } from "@/agent/compliance/orchestrator";
import { redactPII } from "@/agent/redactor";
import { SYSTEM_PROMPT_V1, PROMPT_VERSION } from "@/agent/prompts/system-v1";
import { SUBMIT_DECISION_TOOL } from "@/agent/prompts/tool-schema";
import { AgentResponseSchema, type AgentResponse } from "@/agent/types/response";
import { writeAuditEnvelope } from "@/agent/audit/writer";
import { decisionClient, redactorClient, MODELS } from "@/agent/llm";
import type { AgentContext } from "@/agent/types/context";
import type { AgentAction } from "@/agent/types";
import type { ComplianceFailure } from "@/agent/compliance/orchestrator";
import { COMPLIANCE_POLICY_V1 } from "@/agent/compliance/policy";

export interface RunAgentOptions {
  withCounterfactual?: boolean;
}

/**
 * Calls Claude with tool-use and extracts the submit_decision tool input.
 * Accepts optional prior compliance failures to include in messages.
 */
async function callClaude(
  sanitizedCtx: AgentContext,
  priorFailures?: ComplianceFailure[],
): Promise<AgentResponse> {
  const messages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: JSON.stringify(sanitizedCtx) },
  ];

  if (priorFailures && priorFailures.length > 0) {
    messages.push({
      role: "assistant",
      content: JSON.stringify({ prior_compliance_failures: priorFailures }),
    });
    messages.push({
      role: "user",
      content:
        "Your previous response violated compliance rules. Please reconsider and choose a compliant action.",
    });
  }

  const response = await decisionClient.messages.create({
    system: SYSTEM_PROMPT_V1,
    max_tokens: 2000,
    tools: [SUBMIT_DECISION_TOOL],
    tool_choice: { type: "tool", name: "submit_decision" },
    messages,
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not call submit_decision tool");
  }

  return AgentResponseSchema.parse(toolUse.input);
}

/**
 * Full agent pipeline:
 * 1. Build context
 * 2. Sanitize (remove protected attributes)
 * 3. Redact PII from unstructured_inputs
 * 4. Call Claude → parse AgentResponse
 * 5. Run compliance retry loop
 * 6. Check output guardrails
 * 7. Optionally run counterfactual
 * 8. Write audit envelope
 * 9. Return AgentResponse
 */
export async function runAgent(
  case_id: string,
  options: RunAgentOptions = {},
): Promise<AgentResponse> {
  const { withCounterfactual = false } = options;

  // Step 1: Build context
  const rawCtx = await buildAgentContext(case_id);

  // Step 2: Sanitize protected attributes
  const sanitizedCtx = sanitizeContext(rawCtx);

  // Step 3: Redact PII from unstructured_inputs text fields
  const redactedInputs = await Promise.all(
    sanitizedCtx.unstructured_inputs.map(async (input) => ({
      ...input,
      content: await redactPII(input.content, redactorClient),
    })),
  );
  const redactedCtx: AgentContext = {
    ...sanitizedCtx,
    unstructured_inputs: redactedInputs,
  };

  // Step 4–5: Build agentFn closure and run compliance loop
  const agentFn: AgentFn = async (
    ctx: AgentContext,
    priorFailures?: ComplianceFailure[],
  ): Promise<AgentAction> => {
    const agentResponse = await callClaude(ctx, priorFailures);
    return agentResponse.action;
  };

  const { action, compliance_check } = await runCompliantAgent(redactedCtx, agentFn);

  // We need the full AgentResponse for the final result — run Claude one more
  // time with the winning action context, or re-derive it.
  // Since runCompliantAgent only returns the action, we call Claude once more
  // to get the full response for the final action (or reconstruct it).
  // To avoid an extra LLM call, we re-run callClaude to get the final full
  // response matching the compliant action.
  // However, since the compliance loop already consumed Claude calls, we build
  // the AgentResponse from the parts we have.

  // Get final full response from Claude for the winning action
  const finalResponse = await callClaude(redactedCtx);

  // Override the action with the compliance-vetted action (in case it differs)
  const response: AgentResponse = {
    ...finalResponse,
    action,
    compliance_check: {
      overall: compliance_check.every((r) => r.result === "pass") ? "pass" : "fail",
      results: compliance_check,
    },
    audit: {
      ...finalResponse.audit,
      timestamp: new Date().toISOString(),
      model: MODELS.decision,
      prompt_version: PROMPT_VERSION,
      policy_version: COMPLIANCE_POLICY_V1.policy_version,
    },
  };

  // Step 6: Check output guardrails on reasoning chain
  const reasoningSummary = response.reasoning_chain.map((s) => s.thought).join(" ");
  const guardrailResult = checkOutputGuardrails(reasoningSummary);

  let fairnessOverall: "pass" | "fail" = guardrailResult.forbidden_keywords_present
    ? "fail"
    : "pass";

  if (guardrailResult.forbidden_keywords_present) {
    // Treat as compliance failure — add to compliance check
    response.compliance_check = {
      overall: "fail",
      results: [
        ...response.compliance_check.results,
        {
          rule_id: "language_match",
          rule_description: "Forbidden keywords detected in reasoning chain",
          result: "fail",
          note: `Hits: ${guardrailResult.hits.join(", ")}`,
        },
      ],
      blocked_reason: `Forbidden keywords in reasoning: ${guardrailResult.hits.join(", ")}`,
    };
  }

  // Step 7: Optionally run counterfactual
  let counterfactualAgreed: boolean | null = null;
  if (withCounterfactual) {
    const cfResult = await runCounterfactual(redactedCtx, async (ctx) => {
      const r = await callClaude(ctx);
      return r.action;
    });
    counterfactualAgreed = cfResult.counterfactual_agreed;
    if (!counterfactualAgreed) {
      fairnessOverall = "fail";
    }
  }

  response.fairness_check = {
    forbidden_keywords_present: guardrailResult.forbidden_keywords_present,
    counterfactual_agreed: counterfactualAgreed,
    overall: fairnessOverall,
    ...(fairnessOverall === "fail"
      ? {
          blocked_reason: guardrailResult.forbidden_keywords_present
            ? `Forbidden keywords: ${guardrailResult.hits.join(", ")}`
            : "Counterfactual check failed",
        }
      : {}),
  };

  // Step 8: Write audit envelope + full response fields
  await writeAuditEnvelope(case_id, {
    input: rawCtx,
    redacted_input: redactedCtx,
    action: response.action,
    compliance: response.compliance_check,
    fairness: response.fairness_check,
    model: MODELS.decision,
    prompt_version: PROMPT_VERSION,
    timestamp: response.audit.timestamp,
    confidence: response.confidence,
    reasoning_summary: response.reasoning_summary,
    reasoning_chain: response.reasoning_chain,
    unstructured_sources: response.unstructured_sources,
    alternatives_considered: response.alternatives_considered,
  });

  // Step 9: Return AgentResponse
  return response;
}
