import { db } from "@/db/client";
import { agentCase } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildAgentContext } from "./context-builder";
import { sanitizeContext } from "./fairness/sanitize";
import { redactPII } from "./redactor";
import { redactorClient, decisionClient, MODELS, PROMPT_VERSIONS } from "./llm";
import { runCompliantAgent, type ComplianceFailure } from "./compliance/orchestrator";
import { checkOutputGuardrails } from "./fairness/guardrails";
import { runCounterfactual } from "./fairness/counterfactual";
import { writeAuditEnvelope, type AuditEnvelope } from "./audit/writer";
import { SYSTEM_PROMPT_V1 } from "./prompts/system-v1";
import { SUBMIT_DECISION_TOOL } from "./prompts/tool-schema";
import type { AgentResponse, AgentAction, AgentContext } from "./types";

interface RunAgentOptions {
  withCounterfactual?: boolean;
}

interface DecisionToolInput {
  action: AgentAction;
  confidence: number;
  reasoning_summary: string;
  reasoning_chain: { step: number; thought: string; evidence?: string[] }[];
  unstructured_sources: { source: string; excerpt: string; weight: number }[];
  alternatives_considered: { action_kind: string; reason_not_chosen: string }[];
}

export async function runAgent(
  case_id: string,
  options?: RunAgentOptions,
): Promise<AgentResponse> {
  const modelId = MODELS.decision;
  const promptVersion = PROMPT_VERSIONS.decision;

  console.log(
    JSON.stringify({
      event: "runner.start",
      case_id,
      model_id: modelId,
      prompt_version: promptVersion,
    }),
  );

  // 1. Build context
  console.log(
    JSON.stringify({
      event: "runner.build_context",
      case_id,
      model_id: modelId,
      prompt_version: promptVersion,
    }),
  );
  const ctx = await buildAgentContext(case_id);

  // 2. Sanitize context
  console.log(
    JSON.stringify({
      event: "runner.sanitize_context",
      case_id,
      model_id: modelId,
      prompt_version: promptVersion,
    }),
  );
  const sanitizedCtx = sanitizeContext(ctx);

  // 3. Redact unstructured inputs
  console.log(
    JSON.stringify({
      event: "runner.redact_context",
      case_id,
      model_id: modelId,
      prompt_version: promptVersion,
    }),
  );
  const redactedInputs = await Promise.all(
    sanitizedCtx.unstructured_inputs.map(async (input) => ({
      source: input.source,
      content: await redactPII(input.content, redactorClient),
    })),
  );
  const redactedCtx = { ...sanitizedCtx, unstructured_inputs: redactedInputs };

  // 4. Run compliance loop (which wraps decision client call)
  let lastToolInput: DecisionToolInput | null = null;

  const agentFn = async (
    currentCtx: AgentContext,
    priorFailures?: ComplianceFailure[],
  ): Promise<AgentAction> => {
    console.log(
      JSON.stringify({
        event: "runner.call_decision_llm",
        case_id,
        model_id: modelId,
        prompt_version: promptVersion,
        attempt: (priorFailures?.length ?? 0) + 1,
      }),
    );

    let userMessage = `Here is the current AgentContext:\n${JSON.stringify(currentCtx, null, 2)}`;
    if (priorFailures && priorFailures.length > 0) {
      userMessage += `\n\nYour prior attempts failed compliance checks. Here are the failures you must correct:\n${JSON.stringify(
        priorFailures.map((f) => ({
          attempt: f.attempt + 1,
          action: f.action,
          failed_rules: f.failed_rules.map((r) => ({
            rule_id: r.rule_id,
            rule_description: r.rule_description,
            note: r.note,
          })),
        })),
        null,
        2,
      )}`;
    }
    userMessage += `\n\nPlease submit your decision.`;

    const response = await decisionClient.messages.create({
      system: SYSTEM_PROMPT_V1,
      messages: [{ role: "user", content: userMessage }],
      max_tokens: 4096,
      tools: [SUBMIT_DECISION_TOOL],
      tool_choice: { type: "tool", name: "submit_decision" },
    });

    const toolUse = response.content.find(
      (block) => block.type === "tool_use" && block.name === "submit_decision",
    );
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Decision LLM failed to invoke submit_decision tool");
    }

    const input = toolUse.input as unknown as DecisionToolInput;
    lastToolInput = input;

    const action = input.action;

    // Check for forbidden keywords in the reasoning
    const reasoningText = [
      input.reasoning_summary || "",
      ...(input.reasoning_chain || []).map((step) => step.thought || ""),
    ].join(" ");

    const guardrail = checkOutputGuardrails(reasoningText);
    if (guardrail.forbidden_keywords_present) {
      console.warn(
        JSON.stringify({
          event: "runner.fairness_keyword_hit",
          case_id,
          model_id: modelId,
          prompt_version: promptVersion,
          hits: guardrail.hits,
        }),
      );
      (action as Record<string, unknown>)._forbiddenKeywords = guardrail.hits.join(", ");
    }

    return action;
  };

  console.log(
    JSON.stringify({
      event: "runner.start_compliance_loop",
      case_id,
      model_id: modelId,
      prompt_version: promptVersion,
    }),
  );
  const compliantResult = await runCompliantAgent(redactedCtx, agentFn);

  // 5. Fairness check (guardrails and optionally counterfactual)
  console.log(
    JSON.stringify({
      event: "runner.fairness_guardrails",
      case_id,
      model_id: modelId,
      prompt_version: promptVersion,
    }),
  );
  const toolInput = lastToolInput as DecisionToolInput | null;
  const finalReasoningText = [
    toolInput?.reasoning_summary || "",
    ...(toolInput?.reasoning_chain || []).map((step) => step.thought || ""),
  ].join(" ");
  const finalGuardrail = checkOutputGuardrails(finalReasoningText);

  let counterfactual_agreed: boolean | null = null;

  if (options?.withCounterfactual) {
    console.log(
      JSON.stringify({
        event: "runner.start_counterfactual",
        case_id,
        model_id: modelId,
        prompt_version: promptVersion,
      }),
    );
    const cfResult = await runCounterfactual(redactedCtx, async (cfCtx) => {
      const result = await runCompliantAgent(cfCtx, async (currentCtx, priorFailures) => {
        let userMessage = `Here is the current AgentContext:\n${JSON.stringify(currentCtx, null, 2)}`;
        if (priorFailures && priorFailures.length > 0) {
          userMessage += `\n\nYour prior attempts failed compliance checks. Here are the failures you must correct:\n${JSON.stringify(
            priorFailures,
            null,
            2,
          )}`;
        }
        userMessage += `\n\nPlease submit your decision.`;

        const response = await decisionClient.messages.create({
          system: SYSTEM_PROMPT_V1,
          messages: [{ role: "user", content: userMessage }],
          max_tokens: 4096,
          tools: [SUBMIT_DECISION_TOOL],
          tool_choice: { type: "tool", name: "submit_decision" },
        });

        const toolUse = response.content.find(
          (block) => block.type === "tool_use" && block.name === "submit_decision",
        );
        if (!toolUse || toolUse.type !== "tool_use") {
          throw new Error("Decision LLM failed to invoke submit_decision tool");
        }

        const input = toolUse.input as unknown as DecisionToolInput;
        return input.action;
      });
      return result.action;
    });

    counterfactual_agreed = cfResult.counterfactual_agreed;
  }

  const fairnessOverall =
    finalGuardrail.forbidden_keywords_present || counterfactual_agreed === false
      ? ("fail" as const)
      : ("pass" as const);

  const finalFairnessCheck = {
    forbidden_keywords_present: finalGuardrail.forbidden_keywords_present,
    counterfactual_agreed,
    overall: fairnessOverall,
    blocked_reason: finalGuardrail.forbidden_keywords_present
      ? `Forbidden keywords found in reasoning: ${finalGuardrail.hits.join(", ")}`
      : counterfactual_agreed === false
        ? "Counterfactual name-swap check failed (action changed when tenant identity changed)"
        : undefined,
  };

  const finalComplianceCheck = {
    overall:
      compliantResult.action.kind === "escalate_human" && compliantResult.retries === 3
        ? ("fail" as const)
        : ("pass" as const),
    results: compliantResult.compliance_check,
    blocked_reason:
      compliantResult.action.kind === "escalate_human" && compliantResult.retries === 3
        ? "compliance loop exceeded max retries"
        : undefined,
    suggested_alternative: undefined,
  };

  let finalAction = compliantResult.action;
  if (fairnessOverall === "fail" && finalAction.kind !== "escalate_human") {
    console.warn(
      JSON.stringify({
        event: "runner.fairness_check_failed_escalating",
        case_id,
        model_id: modelId,
        prompt_version: promptVersion,
      }),
    );
    finalAction = {
      kind: "escalate_human",
      urgency: "high",
      reason: finalFairnessCheck.blocked_reason || "Fairness guardrails failed",
    };
  }

  // 6. Write audit envelope
  console.log(
    JSON.stringify({
      event: "runner.write_audit",
      case_id,
      model_id: modelId,
      prompt_version: promptVersion,
    }),
  );
  const auditEnvelope: AuditEnvelope = {
    input: ctx,
    redacted_input: redactedCtx,
    action: finalAction,
    compliance: finalComplianceCheck,
    fairness: finalFairnessCheck,
    model: modelId,
    prompt_version: promptVersion,
    timestamp: new Date().toISOString(),
  };

  await writeAuditEnvelope(case_id, auditEnvelope);

  await db
    .update(agentCase)
    .set({
      context_used: ctx as unknown as Record<string, unknown>,
      unstructured_sources: (toolInput?.unstructured_sources || []) as unknown as Record<string, unknown>[],
      reasoning_chain: (toolInput?.reasoning_chain || []) as unknown as Record<string, unknown>[],
      decision: finalAction as unknown as Record<string, unknown>,
      confidence: Math.round((toolInput?.confidence || 0) * 100),
      alternatives_considered: (toolInput?.alternatives_considered || []) as unknown as Record<string, unknown>[],
      outcome: finalAction.kind === "escalate_human" ? "escalated" : "executed",
    })
    .where(eq(agentCase.id, case_id));

  console.log(
    JSON.stringify({
      event: "runner.complete",
      case_id,
      model_id: modelId,
      prompt_version: promptVersion,
    }),
  );

  return {
    case_id,
    action: finalAction,
    confidence: toolInput?.confidence || 0,
    reasoning_summary: toolInput?.reasoning_summary || "",
    reasoning_chain: toolInput?.reasoning_chain || [],
    unstructured_sources: toolInput?.unstructured_sources || [],
    alternatives_considered: toolInput?.alternatives_considered || [],
    compliance_check: finalComplianceCheck,
    fairness_check: finalFairnessCheck,
    audit: {
      timestamp: auditEnvelope.timestamp,
      model: modelId,
      prompt_version: promptVersion,
      policy_version: "compliance_v1",
    },
  };
}
