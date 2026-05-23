import { describe, expect, it } from "vitest";
import { checkOutputGuardrails } from "../guardrails";
import { FORBIDDEN_KEYWORDS } from "../keywords";

describe("FORBIDDEN_KEYWORDS", () => {
  it("covers core English and German protected-attribute references", () => {
    expect(FORBIDDEN_KEYWORDS).toEqual(
      expect.arrayContaining([
        "race",
        "ethnicity",
        "religion",
        "nationality",
        "political affiliation",
        "herkunft",
        "religion",
        "nationalitat",
        "politische ansicht",
      ]),
    );
  });
});

describe("checkOutputGuardrails", () => {
  it("passes clean reasoning", () => {
    expect(
      checkOutputGuardrails(
        "The tenant has two recent late payments and responded constructively to outreach.",
      ),
    ).toEqual({
      forbidden_keywords_present: false,
      hits: [],
    });
  });

  it("flags forbidden keywords in the reasoning summary", () => {
    expect(
      checkOutputGuardrails(
        "The tenant has a Muslim name and non-native communication style, so escalate.",
      ),
    ).toEqual({
      forbidden_keywords_present: true,
      hits: ["muslim", "muslim name", "non-native"],
    });
  });
});
