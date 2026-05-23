import { describe, expect, it } from "vitest";
import { regexRedact } from "../regex";

describe("regexRedact", () => {
  it("redacts known tenant names", () => {
    expect(regexRedact("Amina Benali called about her lease.")).toContain(
      "[REDACTED-NAME]",
    );
    expect(regexRedact("Amina Benali called about her lease.")).not.toContain(
      "Amina",
    );
  });

  it("redacts IBAN", () => {
    const result = regexRedact("Please transfer to DE89370400440532013000 today.");
    expect(result).toContain("[REDACTED-IBAN]");
    expect(result).not.toContain("DE89370400440532013000");
  });

  it("redacts German phone number", () => {
    const result = regexRedact("Call me at +49 30 12345678 tomorrow.");
    expect(result).toContain("[REDACTED-PHONE]");
    expect(result).not.toContain("+49 30 12345678");
  });

  it("redacts email address", () => {
    const result = regexRedact("Contact foo@bar.de for info.");
    expect(result).toContain("[REDACTED-EMAIL]");
    expect(result).not.toContain("foo@bar.de");
  });

  it("does not mangle non-PII text", () => {
    const text =
      "Property at Musterstrasse 12, 10115 Berlin. Rent: 1200 EUR.";
    const result = regexRedact(text);
    expect(result).toContain("Musterstrasse 12");
    expect(result).toContain("10115 Berlin");
    expect(result).toContain("1200 EUR");
  });

  it("handles combined PII in one string", () => {
    const text =
      "Tenant Amina (amina@example.de, +49 176 11223344) has IBAN DE89370400440532013000.";
    const result = regexRedact(text);
    expect(result).toContain("[REDACTED-NAME]");
    expect(result).toContain("[REDACTED-EMAIL]");
    expect(result).toContain("[REDACTED-PHONE]");
    expect(result).toContain("[REDACTED-IBAN]");
    expect(result).not.toContain("Amina");
    expect(result).not.toContain("amina@example.de");
  });
});
