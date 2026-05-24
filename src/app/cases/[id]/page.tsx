import { notFound } from "next/navigation";
import Link from "next/link";
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
import { CounterfactualComparison } from "@/components/demo/counterfactual-comparison";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Calendar, UserCheck, ShieldAlert } from "lucide-react";

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
        orderBy: (o, { desc }) => [desc(o.period_start)],
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

  const amountCents = typeof payload.amount_due === "number" ? payload.amount_due : 0;

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 sm:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="group inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors bg-white px-3.5 py-2 rounded-xl border border-slate-100 shadow-sm"
          >
            <ChevronLeft className="mr-1 h-3.5 w-3.5 text-slate-400 group-hover:text-slate-900 group-hover:-translate-x-0.5 transition-all" />
            Back to Dashboard
          </Link>
          <div className="text-xs font-mono text-slate-400 bg-white border border-slate-100 shadow-sm rounded-xl px-3 py-1.5">
            Case ID: <span className="font-semibold text-slate-700">{caseData.id}</span>
          </div>
        </div>

        {/* Header Block */}
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-6 sm:p-8 backdrop-blur-md shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Case Audit Review</h1>
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <span className="font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-xs uppercase tracking-wide">
                {caseData.trigger_type.replace(/_/g, " ")}
              </span>
              &middot;
              <span className={`inline-flex items-center gap-1 font-semibold rounded px-2 py-0.5 text-xs uppercase tracking-wide ${
                caseData.outcome === "executed"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-amber-50 text-amber-700 border border-amber-100"
              }`}>
                {caseData.outcome === "executed" ? <UserCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                {caseData.outcome}
              </span>
            </p>
          </div>
          <div className="flex items-center text-xs text-slate-400 font-mono bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 shrink-0">
            <Calendar className="h-4 w-4 mr-2 text-slate-400" />
            <span>Created: {caseData.created_at.toLocaleString("de-DE")}</span>
          </div>
        </div>

        {/* Dashboard Content Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Column (2/3 width): Decisions and reasoning timeline */}
          <div className="lg:col-span-2 space-y-8">
            {agentResponseResult.success ? (
              <ReasoningChain
                response={agentResponseResult.data}
                tenantId={tenantId ?? undefined}
                tenantName={tenantData?.name ?? undefined}
                amountCents={amountCents}
              />
            ) : (
              <Card className="p-6 text-center">
                <p className="text-sm text-slate-500">Failed to parse LLM reasoning envelope structure.</p>
              </Card>
            )}

            {/* Demographic Fairness Real-time Swapping Audit trigger */}
            {tenantData && agentResponseResult.success && (
              <CounterfactualComparison
                caseId={caseData.id}
                baselineName={tenantData.name}
                baselineLanguage={tenantData.language}
                baselineAction={agentResponseResult.data.action}
                initialCounterfactualResult={
                  caseData.fairness_check && (caseData.fairness_check as Record<string, unknown>).counterfactual_agreed !== null
                    ? {
                        counterfactual_agreed: (caseData.fairness_check as Record<string, unknown>).counterfactual_agreed as boolean,
                        baseline_action: agentResponseResult.data.action,
                        counterfactual_action: agentResponseResult.data.action,
                      }
                    : null
                }
              />
            )}
          </div>

          {/* Sidebar Column (1/3 width): Tenant, Compliance, Fairness checks */}
          <div className="space-y-8">
            {/* Compliance Matrix */}
            {complianceResult.success && <ComplianceBadge check={complianceResult.data} />}

            {/* Fairness Guardrails */}
            {fairnessResult.success && <FairnessBadge check={fairnessResult.data} />}

            {/* Tenant Card */}
            {tenantData && <TenantCard tenant={tenantData} />}

            {/* Payment obligations schedule */}
            {obligations.length > 0 && <PaymentHistory obligations={obligations} />}
          </div>
        </div>
      </div>
    </div>
  );
}
