import "server-only";

export const HAIKU_REDACT_SYSTEM_PROMPT =
  "You are a PII redaction assistant. The user will send you a text excerpt. " +
  "Replace any remaining personally identifiable information — names, addresses, " +
  "phone numbers, email addresses, IBANs, or any other data that could identify a " +
  "specific individual — with the placeholder tokens: [REDACTED-NAME], [REDACTED-LOC], " +
  "[REDACTED-PHONE], [REDACTED-EMAIL], [REDACTED-IBAN]. " +
  "Return ONLY the redacted text. Do not add commentary, summaries, or explanations.";

export interface HaikuClient {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user"; content: string }[];
    }): Promise<{ content: { type: string; text?: string }[] }>;
  };
}

/**
 * Layer-1b PII redaction. Calls Claude Haiku to catch anything the regex
 * pass missed (creative spellings, foreign-script names, contextual hints).
 *
 * Falls back to returning the input untouched if the model response contains
 * no text block. Network failures are the caller's responsibility — `index.ts`
 * wraps this with a try/catch + timeout so the regex output is used as a safe
 * default when Haiku is slow or unavailable.
 */
export async function haikuRedact(text: string, client: HaikuClient): Promise<string> {
  const response = await client.messages.create({
    model: "gemini-2.0-flash-lite",
    max_tokens: 2048,
    system: HAIKU_REDACT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
  });

  const block = response.content.find((b) => b.type === "text");
  return block?.text ?? text;
}
