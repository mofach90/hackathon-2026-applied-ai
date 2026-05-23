import type { AgentContext } from "@/agent/types/context";

const PROTECTED_CONTEXT_KEYS = new Set([
  "name_origin",
  "ethnicity",
  "nationality",
  "religion",
  "political_view",
]);

function stripProtectedFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripProtectedFields(item));
  }

  if (value && typeof value === "object") {
    const stripped: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (PROTECTED_CONTEXT_KEYS.has(key)) {
        continue;
      }

      stripped[key] = stripProtectedFields(nestedValue);
    }

    return stripped;
  }

  return value;
}

export function sanitizeContext(ctx: AgentContext): AgentContext {
  return stripProtectedFields(structuredClone(ctx)) as AgentContext;
}

