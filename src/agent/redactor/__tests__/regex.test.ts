import { describe, expect, it } from "vitest";

import { regexRedact } from "../regex";

describe("regexRedact", () => {
  it("redacts a known tenant name (case-insensitive, whole-word)", () => {
    expect(regexRedact("Amina Benali called the office")).toContain("[REDACTED-NAME]");
    expect(regexRedact("amina was polite")).toContain("[REDACTED-NAME]");
    expect(regexRedact("amination is unrelated")).not.toContain("[REDACTED-NAME]");
  });

  it("redacts a DE IBAN", () => {
    const out = regexRedact("Send rent to DE89370400440532013000 by Friday");
    expect(out).toContain("[REDACTED-IBAN]");
    expect(out).not.toContain("DE89370400440532013000");
  });

  it("redacts international phone formats", () => {
    expect(regexRedact("Call me at +49 30 12345678")).toContain("[REDACTED-PHONE]");
    expect(regexRedact("Call me at +49-30-12345678")).toContain("[REDACTED-PHONE]");
    expect(regexRedact("Try 0049 30 12345678 tomorrow")).toContain("[REDACTED-PHONE]");
  });

  it("redacts German local phone formats", () => {
    expect(regexRedact("Reach me on 030 12345678")).toContain("[REDACTED-PHONE]");
    expect(regexRedact("030-12345678 anytime")).toContain("[REDACTED-PHONE]");
  });

  it("redacts an email", () => {
    expect(regexRedact("foo@bar.de wrote in")).toContain("[REDACTED-EMAIL]");
    expect(regexRedact("Reach us at info+landlord@example.co.uk")).toContain("[REDACTED-EMAIL]");
  });

  it("does not redact dates that resemble phone digits", () => {
    expect(regexRedact("Tenancy started 01.01.2026")).not.toContain("[REDACTED-PHONE]");
    expect(regexRedact("Lease covers 1999-2024")).not.toContain("[REDACTED-PHONE]");
  });

  it("does not redact postal codes or plain addresses", () => {
    const out = regexRedact("The apartment at Kantstraße 5, 10115 Berlin is vacant");
    expect(out).not.toContain("[REDACTED-PHONE]");
    expect(out).not.toContain("[REDACTED-IBAN]");
    expect(out).not.toContain("[REDACTED-NAME]");
    expect(out).not.toContain("[REDACTED-EMAIL]");
  });

  it("handles combined PII in one pass", () => {
    const input =
      "Mike Schmidt (mike@example.de, +49 30 12345678) owes rent — IBAN DE89370400440532013000";
    const out = regexRedact(input);
    expect(out).toContain("[REDACTED-NAME]");
    expect(out).toContain("[REDACTED-EMAIL]");
    expect(out).toContain("[REDACTED-PHONE]");
    expect(out).toContain("[REDACTED-IBAN]");
    expect(out).not.toContain("Mike");
    expect(out).not.toContain("Schmidt");
    expect(out).not.toContain("mike@example.de");
    expect(out).not.toContain("DE89370400440532013000");
  });

  it("is idempotent — redacted text stays redacted", () => {
    const once = regexRedact("Sara Petrović, sara@example.org");
    const twice = regexRedact(once);
    expect(twice).toBe(once);
  });
});
