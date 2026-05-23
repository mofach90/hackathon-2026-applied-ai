import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export const MODELS = {
  decision: "claude-opus-4-7",
  redactor: "claude-haiku-4-5-20251001",
  renderer: "claude-haiku-4-5-20251001",
} as const;

export const PROMPT_VERSIONS = {
  decision: "agent_decision_v1",
  redactor: "redactor_v1",
  renderer: "renderer_v1",
} as const;

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

type CreateParams = Omit<Anthropic.MessageCreateParamsNonStreaming, "model">;

function makeClient(model: string) {
  return {
    model,
    messages: {
      create: (params: CreateParams): Promise<Anthropic.Message> =>
        anthropic.messages.create({
          ...params,
          model,
        } as Anthropic.MessageCreateParamsNonStreaming),
    },
  };
}

// Decision: Opus for maximum reasoning quality (ADR-0008)
export const decisionClient = makeClient(MODELS.decision);

// Redaction + rendering: Haiku — fast, cheap, language-fluent (ADR-0008)
export const redactorClient = makeClient(MODELS.redactor);
export const rendererClient = makeClient(MODELS.renderer);
