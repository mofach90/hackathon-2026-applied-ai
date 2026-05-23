import "server-only";

import { haikuRedact, type HaikuClient } from "./haiku";
import { regexRedact } from "./regex";

export async function redactPII(text: string, client: HaikuClient): Promise<string> {
  const afterRegex = regexRedact(text);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);

  try {
    const afterHaiku = await haikuRedact(afterRegex, client, controller.signal);
    return afterHaiku;
  } catch (err) {
    console.warn("[redactor] haiku pass failed, using regex-only output", String(err));
    return afterRegex;
  } finally {
    clearTimeout(timer);
  }
}

export { regexRedact } from "./regex";
export { haikuRedact, HAIKU_REDACT_SYSTEM_PROMPT } from "./haiku";
export type { HaikuClient } from "./haiku";
