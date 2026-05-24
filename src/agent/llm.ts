import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type FunctionDeclaration,
} from "@google/genai";
import { env } from "@/lib/env";

export const MODELS = {
  decision: "gemini-3.5-flash",
  redactor: "gemini-3.1-flash-lite",
  renderer: "gemini-3.1-flash-lite",
} as const;

export const PROMPT_VERSIONS = {
  decision: "agent_decision_v1",
  redactor: "redactor_v1",
  renderer: "renderer_v1",
} as const;

// Anthropic-compatible Tool type — used by tool-schema.ts and runner.ts
export interface Tool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

interface ContentBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface CreateParams {
  model?: string;
  system?: string;
  max_tokens: number;
  messages: { role: "user" | "assistant"; content: string }[];
  tools?: Tool[];
  tool_choice?: { type: "tool"; name: string };
}

const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

function makeClient(boundModel: string) {
  return {
    model: boundModel,
    messages: {
      async create(params: CreateParams): Promise<{ content: ContentBlock[] }> {
        const model = params.model ?? boundModel;

        const functionDeclarations = params.tools?.map((t) => ({
          name: t.name,
          description: t.description,
          parametersJsonSchema: t.input_schema,
        })) satisfies FunctionDeclaration[] | undefined;

        const contents = params.messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const result = await genAI.models.generateContent({
          model,
          contents,
          config: {
            ...(params.system ? { systemInstruction: params.system } : {}),
            maxOutputTokens: params.max_tokens,
            ...(functionDeclarations?.length
              ? {
                  tools: [{ functionDeclarations }],
                  ...(params.tool_choice
                    ? {
                        toolConfig: {
                          functionCallingConfig: {
                            mode: FunctionCallingConfigMode.ANY,
                            allowedFunctionNames: [params.tool_choice.name],
                          },
                        },
                      }
                    : {}),
                }
              : {}),
          },
        });

        const candidate = result.candidates?.[0];
        if (!candidate) throw new Error("Gemini returned no candidates");

        const blocks: ContentBlock[] = [];
        for (const functionCall of result.functionCalls ?? []) {
          if (functionCall.name) {
            blocks.push({
              type: "tool_use",
              id: functionCall.id ?? `fn_${Date.now()}`,
              name: functionCall.name,
              input: functionCall.args,
            });
          }
        }

        for (const part of candidate.content?.parts ?? []) {
          if (part.text) {
            blocks.push({ type: "text", text: part.text });
          }
        }

        return { content: blocks };
      },
    },
  };
}

// Decision: Flash for reasoning quality (ADR-0008 updated for Gemini)
export const decisionClient = makeClient(MODELS.decision);

// Redaction + rendering: Flash-Lite — fast, cheap, language-fluent (ADR-0008)
export const redactorClient = makeClient(MODELS.redactor);
export const rendererClient = makeClient(MODELS.renderer);
