# ADR 0008: AI Runtime + Prompt Versioning

- **Status:** Accepted
- **Date:** 2026-05-23
- **Deciders:** Mohamed Ayari, Aymen

## Context

The agent makes three categorically different LLM calls:

1. **Decision call** — reads sanitized context, picks an action, emits the `AgentResponse` envelope. Must NOT see protected attributes (see ADR-0005).
2. **Redaction call** — reads raw unstructured input and emits PII-redacted excerpts.
3. **Rendering call** — given a decided action, drafts the outgoing tenant message in the right language and tone. May see the tenant's real name and language; has no decision authority.

We also need:

- Deterministic-as-possible output (JSON schema constraints, low temperature)
- Per-call prompt versioning so audit records remain interpretable as prompts evolve
- Model pinning so an upstream model swap doesn't silently change behavior
- Sensible cost / latency tradeoff

## Decision

| Concern | Choice |
|---|---|
| SDK | `@anthropic-ai/sdk` (official Anthropic SDK) |
| Decision model | **`claude-opus-4-7`** — maximum reasoning quality |
| Redaction model | **`claude-haiku-4-5-20251001`** — fast, cheap |
| Rendering model | **`claude-haiku-4-5-20251001`** — fast, cheap, language-fluent |
| Output format | JSON (via tool-use / JSON-mode strict schemas) |
| Temperature | 0.2 for decision; 0.0 for redaction; 0.4 for rendering |
| Prompt versioning | Semantic key `agent_decision_v1`, `redactor_v1`, `renderer_v1` — string in code, stored in `agent_case.audit.prompt_version` |
| Prompt caching | Use Anthropic prompt caching on the system prompt + reusable context to cut cost & latency |

## Consequences

### Easier

- Three small, focused LLM jobs are easier to evaluate independently than one big one
- Audit records carry the exact prompt version + model used, so a regression after a prompt change is debuggable
- Haiku for the cheap calls (redaction, rendering) keeps cost low for an audit log we'll generate constantly
- Opus for the decision call is justified — it's the one where reasoning quality matters most

### Harder

- Three prompts to maintain instead of one
- Schema-constrained JSON output needs careful prompt design
- Cost discipline: even with Haiku, large unstructured contexts can blow the budget — we'll cap excerpt length

## Alternatives considered

- **Single model (Opus) for everything.** Pro: simpler. Con: expensive and slower for high-volume redaction/rendering.
- **Use GPT-4 / Gemini for some calls.** Rejected: hackathon is Anthropic-sponsored; Claude credits provided.
- **Open-source model (Llama-3, Mistral) self-hosted.** Rejected: no infra, no time, no quality at this task.
- **Prompt versioning via database table.** Rejected: overkill; string constant in code + git history is enough.

## Implementation notes

### SDK initialization (`src/agent/client.ts`)

```ts
import Anthropic from "@anthropic-ai/sdk";

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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
```

### The decision call (`src/agent/runner.ts`)

We use Claude's structured tool-use for typed JSON output:

```ts
import { z } from "zod";
import { claude, MODELS, PROMPT_VERSIONS } from "./client";
import { AgentResponseSchema } from "./types";

export async function runDecisionAgent(
  sanitizedContext: SanitizedContext,
  trigger: Trigger,
  priorFailure?: PriorFailure,
): Promise<AgentResponse> {

  const systemPrompt = buildDecisionSystemPrompt({ priorFailure });
  const userMessage = JSON.stringify({ trigger, context: sanitizedContext });

  const result = await claude.messages.create({
    model: MODELS.decision,
    max_tokens: 4096,
    temperature: 0.2,
    system: [
      // Cached: the long, stable system prompt
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userMessage }],
    tools: [
      {
        name: "emit_decision",
        description: "Emit the agent's chosen action with reasoning",
        input_schema: AGENT_RESPONSE_TOOL_SCHEMA,   // JSON Schema mirroring the type
      },
    ],
    tool_choice: { type: "tool", name: "emit_decision" },
  });

  // Find the tool_use block
  const toolUse = result.content.find(c => c.type === "tool_use");
  if (!toolUse || toolUse.name !== "emit_decision") {
    throw new Error("agent did not emit a decision tool_use block");
  }

  // Parse + validate against Zod (defense in depth on top of the schema)
  const parsed = AgentResponseSchema.parse(toolUse.input);
  return parsed;
}
```

### The redaction call

```ts
export async function llmRedact(text: string): Promise<string> {
  const result = await claude.messages.create({
    model: MODELS.redactor,
    max_tokens: Math.min(1024, text.length * 2),
    temperature: 0.0,
    system: [{
      type: "text",
      cache_control: { type: "ephemeral" },
      text: `You are a privacy redactor. Replace personally identifying \
information with placeholders: [REDACTED-NAME], [REDACTED-LOC], \
[REDACTED-EMPLOYER], [REDACTED-PHONE], [REDACTED-EMAIL], [REDACTED-IBAN]. \
Keep meaning intact. Output ONLY the redacted text, no explanation.`,
    }],
    messages: [{ role: "user", content: text }],
  });
  return (result.content[0] as Anthropic.TextBlock).text;
}
```

### The rendering call

```ts
export async function renderMessage(args: {
  action: AgentAction;
  tenant: { name: string; language: "de" | "en" | "fr" };
  tone: "warm" | "neutral" | "formal";
}): Promise<{ subject: string; body: string }> {
  // ...similar pattern, with rendering-specific prompt and tool
}
```

This call **does** see the tenant's real name and language. It has **no decision authority** — it only translates a decided action into outgoing text. Compliance + fairness checks have already passed by the time we call it.

### Prompt versioning

- Bump the version string in code when the prompt changes
- Old `agent_case` rows keep their `prompt_version` reference
- A `docs/prompts/` directory will hold versioned prompt snapshots for git history (alternative: just rely on git log of `prompt.ts`)

### Cost discipline

- Redaction: cap excerpt input length to 2000 chars (truncate with `[…]`)
- Decision: include only the most salient unstructured excerpts (top-5 by salience score from the context builder)
- Use prompt caching aggressively on the system prompt (it's stable, ~2k tokens)

### Latency expectations

- Decision call (Opus): ~3–8 seconds
- Redaction call (Haiku): ~1 second per excerpt; parallelizable
- Rendering call (Haiku): ~1–2 seconds

Under our `decideAndExecute` orchestration (compliance retry max 3), worst-case latency is ~30 seconds. Within Vercel API route 60s timeout.

## Open questions

- Streaming the decision response for UI progressive reveal — nice for the demo, but adds complexity. Probably skip for MVP.
- Tool-use vs JSON-mode: tool-use is more deterministic with schemas. Stick with tool-use.
- Cost cap per demo run? Anthropic credits are generous; not worth a budget tracker now.

## References

- Anthropic SDK: https://docs.anthropic.com/en/api/client-sdks
- Prompt caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Tool use with JSON schemas: https://docs.anthropic.com/en/docs/build-with-claude/tool-use
- ADR-0001 — `AgentResponse` shape
- ADR-0004 — compliance check (called after decision LLM)
- ADR-0005 — fairness defense (where redactor + rendering separation comes from)
