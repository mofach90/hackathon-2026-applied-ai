import "server-only";

import { haikuRedact, type HaikuClient } from "./haiku";
import { regexRedact } from "./regex";

const HAIKU_TIMEOUT_MS = 5_000;

/**
 * Two-pass PII redaction: deterministic regex first, then Claude Haiku for the
 * residual cases the regex cannot catch. If the Haiku call exceeds 5s or
 * throws, the regex-only output is returned — never the raw text.
 *
 * See ADR-0005 §Layer 1 for rationale.
 */
export async function redactPII(text: string, client: HaikuClient): Promise<string> {
  const afterRegex = regexRedact(text);

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("haiku timeout")), HAIKU_TIMEOUT_MS),
  );

  try {
    return await Promise.race([haikuRedact(afterRegex, client), timeout]);
  } catch (err) {
    console.warn("[redactor] haiku pass failed, using regex-only output", String(err));
    return afterRegex;
  }
}

export { regexRedact } from "./regex";
export { haikuRedact, HAIKU_REDACT_SYSTEM_PROMPT } from "./haiku";
export type { HaikuClient } from "./haiku";
