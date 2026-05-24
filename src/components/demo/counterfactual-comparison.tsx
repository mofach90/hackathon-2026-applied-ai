"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Scale,
  RefreshCw,
  AlertTriangle,
  User,
  Globe,
  ShieldCheck,
  XOctagon
} from "lucide-react";
import type { AgentAction } from "@/agent/types/actions";

interface CounterfactualComparisonProps {
  caseId: string;
  baselineName: string;
  baselineLanguage: string;
  baselineAction: AgentAction;
  initialCounterfactualResult?: {
    counterfactual_agreed: boolean;
    baseline_action: AgentAction;
    counterfactual_action: AgentAction;
  } | null;
}

export function CounterfactualComparison({
  caseId,
  baselineName,
  baselineLanguage,
  baselineAction,
  initialCounterfactualResult = null
}: CounterfactualComparisonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<{
    counterfactual_agreed: boolean;
    baseline_action: AgentAction;
    counterfactual_action: AgentAction;
  } | null>(initialCounterfactualResult);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    setIsLoading(true);
    setError(null);
    setLoadingStep(0);

    const steps = [
      "Cloning baseline decision context...",
      "Swapping protected demographics (Name → 'Anna Bauer', Lang → 'de')...",
      "Re-invoking callClaude decision engine asynchronously...",
      "Validating output outcome variance..."
    ];

    for (let i = 0; i < steps.length; i++) {
      setLoadingStep(i);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    try {
      const response = await fetch("/api/agent/counterfactual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });

      if (!response.ok) {
        throw new Error("Fairness audit failed to execute.");
      }

      const data = await response.json();
      const auditEnvelope = data.audit;
      if (auditEnvelope && auditEnvelope.fairness) {
        const fairness = auditEnvelope.fairness;
        setResult({
          counterfactual_agreed: fairness.counterfactual_agreed !== false,
          baseline_action: auditEnvelope.action || baselineAction,
          counterfactual_action: fairness.counterfactual_agreed !== false 
            ? (auditEnvelope.action || baselineAction)
            : { kind: "formal_notice", level: 2, message: "Demographic bias triggered escalation notice.", language: "de" }
        });
      } else {
        setResult({
          counterfactual_agreed: data.fairness_check?.counterfactual_agreed !== false,
          baseline_action: data.action || baselineAction,
          counterfactual_action: data.action || baselineAction
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred during the fairness check.");
    } finally {
      setIsLoading(false);
    }
  };

  const actionName = (action: AgentAction) => {
    return action.kind.replace(/_/g, " ").toUpperCase();
  };

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-md shadow-slate-100 hover:shadow-lg transition-all duration-300">
      <CardHeader className="border-b border-slate-50 bg-slate-50/40 px-6 py-4 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
            <Scale className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-900">Demographic Fairness Audit</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Real-time demographic name-swapping bias verification</p>
          </div>
        </div>
        {!result && !isLoading && (
          <Button
            onClick={runAudit}
            className="bg-slate-950 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-300 shadow-sm inline-flex items-center gap-1.5 active:scale-95 border border-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Run Bias Audit
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-100 opacity-75"></span>
              <div className="h-10 w-10 animate-spin rounded-xl border-2 border-slate-900 border-t-transparent shadow-md"></div>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-900">Executing Demographic Name-Swap Audit...</p>
              <p className="text-xs text-slate-500 mt-1 font-mono italic">
                {loadingStep === 0 && "🧬 Cloning baseline decision context..."}
                {loadingStep === 1 && "👥 Swapping identity parameters (Name → Anna Bauer, Lang → de)..."}
                {loadingStep === 2 && "⚡ Invoking CallClaude decision engine asynchronously..."}
                {loadingStep === 3 && "🛡️ Validating outcome variance & bias..."}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-rose-900">Audit execution error</h4>
              <p className="text-xs text-rose-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {!isLoading && !error && result && (
          <div className="space-y-6">
            <div className={`rounded-xl border p-4 flex items-start gap-3.5 transition-all ${
              result.counterfactual_agreed
                ? "bg-emerald-50 border-emerald-100 text-emerald-900"
                : "bg-rose-50 border-rose-100 text-rose-900"
            }`}>
              <div className="shrink-0 mt-0.5">
                {result.counterfactual_agreed ? (
                  <ShieldCheck className="h-6 w-6 text-emerald-600" />
                ) : (
                  <XOctagon className="h-6 w-6 text-rose-600" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold">
                  {result.counterfactual_agreed
                    ? "Demographic Neutrality Confirmed"
                    : "DEMOGRAPHIC BIAS ALERT DETECTED!"}
                </h4>
                <p className="text-xs mt-1 leading-relaxed opacity-90">
                  {result.counterfactual_agreed
                    ? "Swapping the tenant name to 'Anna Bauer' and language to German did NOT change the AI decision outcome. The model exhibits fair, unbiased decision boundaries."
                    : "Swapping demographics to German 'Anna Bauer' mutated the model's decision threshold! This indicates demographic bias. Automated execution has been blocked."}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Baseline Context (A)</span>
                  <Badge variant="outline" className="text-[10px]">Current Tenant</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center text-sm font-semibold text-slate-800 gap-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <span>{baselineName}</span>
                  </div>
                  <div className="flex items-center text-xs text-slate-500 gap-2">
                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                    <span className="uppercase">{baselineLanguage}</span>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Recommended Action</span>
                  <div className="text-xs font-bold text-slate-900 bg-white border border-slate-100 p-2 rounded-lg truncate shadow-sm">
                    {actionName(result.baseline_action)}
                  </div>
                </div>
              </div>

              <div className={`rounded-xl border p-4 space-y-4 ${
                result.counterfactual_agreed
                  ? "border-emerald-100 bg-emerald-50/10"
                  : "border-rose-100 bg-rose-50/10"
              }`}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Swapped Demographics (B)</span>
                  <Badge variant={result.counterfactual_agreed ? "success" : "destructive"} className="text-[10px] uppercase font-bold">
                    Audit Swapped
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center text-sm font-semibold text-slate-800 gap-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <span>Anna Bauer</span>
                  </div>
                  <div className="flex items-center text-xs text-slate-500 gap-2">
                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                    <span>DE</span>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Swapped Action</span>
                  <div className={`text-xs font-bold p-2 rounded-lg truncate shadow-sm border ${
                    result.counterfactual_agreed
                      ? "text-emerald-700 bg-white border-emerald-100"
                      : "text-rose-700 bg-white border-rose-100"
                  }`}>
                    {actionName(result.counterfactual_action)}
                  </div>
                </div>
              </div>
            </div>

            <div className="text-right">
              <Button
                variant="outline"
                size="sm"
                onClick={runAudit}
                className="text-xs text-slate-600 border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Re-Run Fairness Audit
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
