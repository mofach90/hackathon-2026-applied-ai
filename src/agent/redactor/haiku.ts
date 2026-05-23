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
      signal?: AbortSignal;
    }): Promise<{ content: { type: string; text?: string }[] }>;
  };
}

export async function haikuRedact(
  text: string,
  client: HaikuClient,
  signal?: AbortSignal,
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: HAIKU_REDACT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
    ...(signal ? { signal } : {}),
  });

  const block = response.content.find((b) => b.type === "text");
  return block?.text ?? text;
}
