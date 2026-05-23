import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agentCase, rentObligation, tenant } from "@/db/schema";
import { AgentResponseSchema } from "@/agent/types/response";
import { ComplianceCheckSchema } from "@/agent/types/compliance";
import { FairnessCheckSchema } from "@/agent/types/fairness";
import { TenantCard } from "@/components/cases/tenant-card";
import { PaymentHistory } from "@/components/cases/payment-history";
import { ReasoningChain } from "@/components/cases/reasoning-chain";
import { ComplianceBadge } from "@/components/cases/compliance-badge";
import { FairnessBadge } from "@/components/cases/fairness-badge";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CaseDetailPage({ params }: PageProps) {
  const { id } = await params;

  const caseData = await db.query.agentCase.findFirst({
    where: eq(agentCase.id, id),
  });

  if (!caseData) notFound();

  // Extract tenant_id from trigger_payload (expected shape: { tenant_id: string })
  const payload = caseData.trigger_payload as Record<string, unknown>;
  const tenantId = typeof payload.tenant_id === "string" ? payload.tenant_id : null;

  const tenantData = tenantId
    ? await db.query.tenant.findFirst({
        where: eq(tenant.id, tenantId),
        with: { property: true },
      })
    : null;

  const obligations = tenantId
    ? await db.query.rentObligation.findMany({
        where: eq(rentObligation.tenant_id, tenantId),
        orderBy: (t, { desc }) => [desc(t.period_start)],
      })
    : [];

  // Parse jsonb columns with Zod
  const complianceResult = ComplianceCheckSchema.safeParse(caseData.compliance_check);
  const fairnessResult = FairnessCheckSchema.safeParse(caseData.fairness_check);

  // Build an AgentResponse-like object from the stored columns
  const agentResponseData = {
    case_id: caseData.id,
    action: (caseData.decision as Record<string, unknown>).action,
    confidence: caseData.confidence / 100,
    reasoning_summary: (caseData.decision as Record<string, unknown>).reasoning_summary ?? "",
    reasoning_chain: caseData.reasoning_chain,
    unstructured_sources: caseData.unstructured_sources,
    alternatives_considered: caseData.alternatives_considered,
    compliance_check: caseData.compliance_check,
    fairness_check: caseData.fairness_check,
    audit: caseData.audit,
  };
  const agentResponseResult = AgentResponseSchema.safeParse(agentResponseData);

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Case Detail</h1>
        <p className="text-sm text-slate-500">
          {caseData.trigger_type} &middot; {caseData.outcome} &middot;{" "}
          {caseData.created_at.toLocaleString()}
        </p>
      </div>

      {tenantData && <TenantCard tenant={tenantData} />}

      {obligations.length > 0 && <PaymentHistory obligations={obligations} />}

      {agentResponseResult.success && (
        <ReasoningChain response={agentResponseResult.data} />
      )}

      {complianceResult.success && <ComplianceBadge check={complianceResult.data} />}

      {fairnessResult.success && <FairnessBadge check={fairnessResult.data} />}
    </div>
  );
}
