"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CounterfactualComparison } from "@/components/demo/counterfactual-comparison";
import { PlanModal } from "@/components/cases/plan-modal";
import type { AgentAction } from "@/agent/types/actions";

interface Props {
  caseId: string;
  tenantName: string;
  tenantLanguage: string;
  baselineAction: AgentAction;
  planAction?: {
    tenantId: string;
    amountCents: number;
    installments: number;
  } | null;
}

export function CaseActions({
  caseId,
  tenantName,
  tenantLanguage,
  baselineAction,
  planAction,
}: Props) {
  const [showCf, setShowCf] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowCf((v) => !v)}>
          {showCf ? "Hide counterfactual" : "Run counterfactual"}
        </Button>

        {planAction && (
          <PlanModal
            tenantId={planAction.tenantId}
            tenantName={tenantName}
            amountCents={planAction.amountCents}
            installments={planAction.installments}
          />
        )}

        <Button variant="ghost" size="sm" asChild>
          <Link href={`/cases/${caseId}/actions`}>Approval queue</Link>
        </Button>
      </div>

      {showCf && (
        <CounterfactualComparison
          caseId={caseId}
          baselineName={tenantName}
          baselineLanguage={tenantLanguage}
          baselineAction={baselineAction}
        />
      )}
    </div>
  );
}
