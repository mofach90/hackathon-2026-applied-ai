import { TENANT_NAMES } from "./names";

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// IBAN: country code (2 letters) + check digits (2) + 4-30 alphanumerics.
// DE89370400440532013000 is the canonical DE example from ADR-0005.
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g;

// Two phone shapes covered:
//   1. International:  +49 30 12345678 / +49-30-12345678 / 0049 30 12345678
//   2. German local:   030 12345678 / 030-12345678
// The DE-local form requires at least one separator after the area code so
// short date-like sequences (01.01.2026) and postal codes (10115) don't match.
const PHONE_RES: readonly RegExp[] = [
  /(?:\+|00)\d{1,3}[\s.-]?[\d\s.-]{6,18}\d/g,
  /\b0\d{2,4}[\s.-]\d{3}[\d\s.-]{2,12}\d\b/g,
];

const REGEX_META = /[.*+?^${}()|[\]\\]/g;
function escapeRegex(s: string): string {
  return s.replace(REGEX_META, "\\$&");
}

const NAME_RES: readonly RegExp[] = TENANT_NAMES.map(
  (n) => new RegExp(`\\b${escapeRegex(n)}\\b`, "gi"),
);

/**
 * Layer-1 PII redaction. Pure function — no LLM call.
 *
 * Replaces emails, IBANs, phone numbers, and known tenant names with
 * `[REDACTED-*]` placeholders. Pass order matters: email and IBAN run before
 * phone so digits inside them are not re-matched, and names run last so the
 * placeholder text from earlier passes is never mistaken for a name.
 *
 * See ADR-0005 §Layer 1 for the rationale and ADR-0008 for how this composes
 * with the Claude Haiku second pass (#9).
 */
export function regexRedact(input: string): string {
  let out = input;
  out = out.replace(EMAIL_RE, "[REDACTED-EMAIL]");
  out = out.replace(IBAN_RE, "[REDACTED-IBAN]");
  for (const re of PHONE_RES) {
    out = out.replace(re, "[REDACTED-PHONE]");
  }
  for (const re of NAME_RES) {
    out = out.replace(re, "[REDACTED-NAME]");
  }
  return out;
}
