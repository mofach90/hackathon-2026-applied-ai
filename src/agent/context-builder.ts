import { eq, gte, and } from "drizzle-orm";
import { db } from "@/db/client";
import { agentCase, tenant, property, rentObligation } from "@/db/schema";
import { AgentContext } from "@/agent/types/context";
import { getUnstructuredFixtures } from "@/agent/fixtures/unstructured";

function subMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

function formatMonth(date: Date): string {
  return date.toISOString().slice(0, 7); // "YYYY-MM"
}

function daysLate(dueDate: Date, paidAt: Date | null): number | null {
  if (!paidAt) return null;
  const diff = paidAt.getTime() - dueDate.getTime();
  return diff > 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) : 0;
}

export async function buildAgentContext(case_id: string): Promise<AgentContext> {
  // 1. Fetch agent_case row
  const [caseRow] = await db
    .select()
    .from(agentCase)
    .where(eq(agentCase.id, case_id))
    .limit(1);

  if (!caseRow) {
    throw new Error(`agent_case not found: ${case_id}`);
  }

  const payload = caseRow.trigger_payload as Record<string, unknown>;
  const tenantId = payload["tenant_id"] as string;

  // 2. Fetch tenant + property
  const [tenantRow] = await db
    .select({
      id: tenant.id,
      name: tenant.name,
      language: tenant.language,
      monthly_rent_eur_cents: property.monthly_rent_eur_cents,
    })
    .from(tenant)
    .innerJoin(property, eq(tenant.property_id, property.id))
    .where(eq(tenant.id, tenantId))
    .limit(1);

  if (!tenantRow) {
    throw new Error(`tenant not found: ${tenantId}`);
  }

  // 3. Fetch rent obligations for past 6 months
  const sixMonthsAgo = subMonths(new Date(), 6);
  const obligations = await db
    .select()
    .from(rentObligation)
    .where(
      and(
        eq(rentObligation.tenant_id, tenantId),
        gte(rentObligation.period_start, sixMonthsAgo),
      ),
    )
    .orderBy(rentObligation.period_start);

  const rent_obligations = obligations.map((o) => ({
    month: formatMonth(o.period_start),
    amount_eur_cents: o.amount_eur_cents,
    paid_at: o.paid_at ? o.paid_at.toISOString() : null,
    days_late: o.paid_at ? daysLate(o.due_date, o.paid_at) : null,
  }));

  // 4. Prior Mahnungen this cycle — derive from trigger_payload if present
<<<<<<< HEAD
  const priorMahnungen = (payload["prior_mahnungen"] as { level: number; sent_at: string }[] | undefined) ?? [];
=======
  const priorMahnungen = (payload["prior_mahnungen"] as Array<{ level: number; sent_at: string }> | undefined) ?? [];
>>>>>>> 6a83736 (feat(agent): context builder + unstructured fixtures)

  // 5. Prior outreach count
  const priorOutreach = (payload["prior_outreach_count"] as number | undefined) ?? 0;

  // 6. Unstructured inputs from fixtures
  const unstructured_inputs = getUnstructuredFixtures(tenantId);

  // 7. Current event
  const eventType = caseRow.trigger_type as AgentContext["current_event"]["type"];
  const currentEvent: AgentContext["current_event"] = {
    type: eventType,
    days_late: (payload["days_late"] as number | null) ?? null,
    amount_eur_cents: (payload["amount_eur_cents"] as number | null) ?? null,
    event_payload: payload,
  };

  return {
    case_id,
    tenant: {
      id: tenantRow.id,
      name: tenantRow.name,
      language: tenantRow.language,
      monthly_rent_eur_cents: tenantRow.monthly_rent_eur_cents,
    },
    tenant_history: {
      rent_obligations,
      prior_mahnungen_this_cycle: priorMahnungen,
      prior_outreach_this_cycle: priorOutreach,
    },
    current_event: currentEvent,
    unstructured_inputs,
  };
}
