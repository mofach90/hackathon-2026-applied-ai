import { KNOWN_NAMES } from "./names";

const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g;
const PHONE_RE = /(?:\+49|0049|0)\s?[\d\s\-/()]{7,15}\d/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function buildNamesRegex(): RegExp {
  const escaped = KNOWN_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
}

const NAMES_RE = buildNamesRegex();

export function regexRedact(text: string): string {
  return text
    .replace(IBAN_RE, "[REDACTED-IBAN]")
    .replace(EMAIL_RE, "[REDACTED-EMAIL]")
    .replace(PHONE_RE, "[REDACTED-PHONE]")
    .replace(NAMES_RE, "[REDACTED-NAME]");
}
