import { describe, expect, it } from "vitest";
import type { AgentContext } from "@/agent/types/context";
import { sanitizeContext } from "../sanitize";

const baseContext: AgentContext = {
  case_id: "3ef3ab52-6db8-4b7a-9519-88ecb77f8a14",
  tenant: {
    id: "a06f05ec-4d80-43c7-80d5-53a4de8a7f31",
    name: "Amina Benali",
    language: "de",
    monthly_rent_eur_cents: 125000,
  },
  tenant_history: {
    rent_obligations: [
      {
        month: "2026-04",
        amount_eur_cents: 125000,
        paid_at: "2026-04-04T10:00:00.000Z",
        days_late: 3,
      },
    ],
    prior_mahnungen_this_cycle: [],
    prior_outreach_this_cycle: 1,
  },
  current_event: {
    type: "rent_late",
    days_late: 7,
    amount_eur_cents: 125000,
    event_payload: {
      name_origin: "Maghrebi",
      ethnicity: "Arab",
      landlord_note: {
        religion: "Muslim",
        political_view: "green",
        detail: "Tenant disclosed job loss.",
      },
    },
  },
  unstructured_inputs: [
    {
      source: "support_chat",
      content: "Tenant says they changed jobs.",
    },
  ],
};

describe("sanitizeContext", () => {
  it("removes protected fields recursively without mutating the input", () => {
    const sanitized = sanitizeContext(baseContext);

    expect(sanitized).toEqual({
      ...baseContext,
      current_event: {
        ...baseContext.current_event,
        event_payload: {
          landlord_note: {
            detail: "Tenant disclosed job loss.",
          },
        },
      },
    });

    expect(baseContext.current_event.event_payload).toEqual({
      name_origin: "Maghrebi",
      ethnicity: "Arab",
      landlord_note: {
        religion: "Muslim",
        political_view: "green",
        detail: "Tenant disclosed job loss.",
      },
    });
  });
});
