import { describe, it, expect, vi } from "vitest";
import { runCounterfactual } from "../counterfactual";
import type { AgentContext } from "@/agent/types/context";
import type { AgentAction } from "@/agent/types";

const baseCtx: AgentContext = {
  case_id: "00000000-0000-0000-0000-000000000001",
  tenant: {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Mehmet Yilmaz",
    language: "tr",
    monthly_rent_eur_cents: 90000,
  },
  tenant_history: {
    rent_obligations: [],
    prior_mahnungen_this_cycle: [],
    prior_outreach_this_cycle: 0,
  },
  current_event: {
    type: "rent_late",
    days_late: 5,
    amount_eur_cents: 90000,
    event_payload: {},
  },
  unstructured_inputs: [],
};

const softNudge: AgentAction = { kind: "soft_nudge", message: "Please pay", language: "en" };
const planAction: AgentAction = {
  kind: "plan_negotiation",
  proposed_installments: 3,
  installment_amount_eur_cents: 30000,
  message: "We offer a plan",
  language: "en",
};

describe("runCounterfactual", () => {
  it("returns counterfactual_agreed=true when both runs return the same action kind", async () => {
    const agentFn = vi.fn().mockResolvedValue(softNudge);
    const result = await runCounterfactual(baseCtx, agentFn);

    expect(result.counterfactual_agreed).toBe(true);
    expect(result.baseline_action).toEqual(softNudge);
    expect(result.counterfactual_action).toEqual(softNudge);
  });

  it("returns counterfactual_agreed=false when action kinds differ", async () => {
    const formalNotice: AgentAction = {
      kind: "formal_notice",
      level: 1,
      message: "Notice",
      language: "en",
    };
    const agentFn = vi
      .fn()
      .mockResolvedValueOnce(softNudge)
      .mockResolvedValueOnce(formalNotice);

    const result = await runCounterfactual(baseCtx, agentFn);

    expect(result.counterfactual_agreed).toBe(false);
    expect(result.baseline_action.kind).toBe("soft_nudge");
    expect(result.counterfactual_action.kind).toBe("formal_notice");
  });

  it("swaps tenant name and language in counterfactual context without mutating original", async () => {
    const capturedContexts: AgentContext[] = [];
    const agentFn = vi.fn().mockImplementation(async (ctx: AgentContext) => {
      capturedContexts.push(structuredClone(ctx));
      return softNudge;
    });

    await runCounterfactual(baseCtx, agentFn);

    expect(capturedContexts[0]!.tenant.name).toBe("Mehmet Yilmaz");
    expect(capturedContexts[0]!.tenant.language).toBe("tr");
    expect(capturedContexts[1]!.tenant.name).toBe("Anna Bauer");
    expect(capturedContexts[1]!.tenant.language).toBe("de");

    // original context must not be mutated
    expect(baseCtx.tenant.name).toBe("Mehmet Yilmaz");
    expect(baseCtx.tenant.language).toBe("tr");
  });

  it("plan_negotiation agrees when installments differ by exactly 1", async () => {
    const plan3 = { ...planAction, proposed_installments: 3 };
    const plan4 = { ...planAction, proposed_installments: 4 };
    const agentFn = vi
      .fn()
      .mockResolvedValueOnce(plan3)
      .mockResolvedValueOnce(plan4);

    const result = await runCounterfactual(baseCtx, agentFn);
    expect(result.counterfactual_agreed).toBe(true);
  });

  it("plan_negotiation disagrees when installments differ by more than 1", async () => {
    const plan2 = { ...planAction, proposed_installments: 2 };
    const plan5 = { ...planAction, proposed_installments: 5 };
    const agentFn = vi
      .fn()
      .mockResolvedValueOnce(plan2)
      .mockResolvedValueOnce(plan5);

    const result = await runCounterfactual(baseCtx, agentFn);
    expect(result.counterfactual_agreed).toBe(false);
  });
});
