import { describe, expect, it, vi } from "vitest";
import { HAIKU_REDACT_SYSTEM_PROMPT, haikuRedact, type HaikuClient } from "../haiku";
import { redactPII } from "../index";

function makeMockClient(returnText: string): HaikuClient {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: returnText }],
      }),
    },
  };
}

describe("haikuRedact", () => {
  it("calls the model with the correct system prompt", async () => {
    const client = makeMockClient("cleaned text");
    await haikuRedact("some input", client);

    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-4-5-20251001",
        system: HAIKU_REDACT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: "some input" }],
      }),
    );
  });

  it("returns the model output text", async () => {
    const client = makeMockClient("[REDACTED-NAME] called.");
    const result = await haikuRedact("Amina called.", client);
    expect(result).toBe("[REDACTED-NAME] called.");
  });

  it("returns original text if model returns no text block", async () => {
    const client: HaikuClient = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [] }),
      },
    };
    const result = await haikuRedact("original", client);
    expect(result).toBe("original");
  });
});

describe("redactPII", () => {
  it("runs regex pass first then haiku pass", async () => {
    const client = makeMockClient("after haiku");
    const result = await redactPII("Amina foo@bar.de", client);
    expect(result).toBe("after haiku");

    const createCall = vi.mocked(client.messages.create).mock.calls[0]?.[0];

    // Regex should have already replaced the email before haiku sees it
    expect(createCall?.messages[0]?.content).toContain("[REDACTED-EMAIL]");
    expect(createCall?.messages[0]?.content).not.toContain("foo@bar.de");
  });

  it("falls back to regex-only output when haiku throws", async () => {
    const client: HaikuClient = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error("timeout")),
      },
    };
    const result = await redactPII("Amina called foo@bar.de", client);
    expect(result).toContain("[REDACTED-NAME]");
    expect(result).toContain("[REDACTED-EMAIL]");
    expect(result).not.toContain("Amina");
    expect(result).not.toContain("foo@bar.de");
  });
});
