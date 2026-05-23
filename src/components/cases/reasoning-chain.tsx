import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlanModal } from "@/components/cases/plan-modal";
import {
  Brain,
  Cpu,
  FileText,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Sparkles,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import type { AgentResponse, ReasoningStep, UnstructuredSource } from "@/agent/types/response";
import type { AgentAction } from "@/agent/types/actions";

interface ReasoningChainProps {
  response: AgentResponse;
  tenantId?: string;
  tenantName?: string;
  amountCents?: number;
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

const renderActionDetails = (action: AgentAction) => {
  switch (action.kind) {
    case "soft_nudge":
      return (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">Soft Nudge Notification</p>
          <p className="text-sm text-slate-600 italic bg-slate-50 border border-slate-100 p-3 rounded-lg">
            "{action.message}"
          </p>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">Language: {action.language.toUpperCase()}</Badge>
          </div>
        </div>
      );
    case "friendly_check_in":
      return (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">Friendly Check-In</p>
          <p className="text-sm text-slate-600 italic bg-slate-50 border border-slate-100 p-3 rounded-lg">
            "{action.message}"
          </p>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">Language: {action.language.toUpperCase()}</Badge>
            {action.payment_link_url && (
              <a
                href={action.payment_link_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 underline font-medium inline-flex items-center gap-1 hover:text-indigo-800"
              >
                Stripe Payment Link URL
              </a>
            )}
          </div>
        </div>
      );
    case "plan_negotiation":
      return (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-800">Proposed Payment Installments Plan</p>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Installments</span>
              <span className="text-lg font-bold text-slate-900">{action.proposed_installments} Months</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Monthly Amount</span>
              <span className="text-lg font-bold text-slate-900">{formatEur(action.installment_amount_eur_cents)}</span>
            </div>
          </div>
          <p className="text-sm text-slate-600 italic bg-slate-50 border border-slate-100 p-3 rounded-lg">
            "{action.message}"
          </p>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">Language: {action.language.toUpperCase()}</Badge>
          </div>
        </div>
      );
    case "late_fee_warning":
      return (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">Formal Late Fee Warning</p>
          <div className="max-w-xs bg-rose-50/50 border border-rose-100 p-2.5 rounded-lg text-center">
            <span className="text-[10px] uppercase font-bold text-rose-500 block">Accrued Late Fees</span>
            <span className="text-base font-bold text-rose-700">{formatEur(action.fee_amount_eur_cents)}</span>
          </div>
          <p className="text-sm text-slate-600 italic bg-slate-50 border border-slate-100 p-3 rounded-lg">
            "{action.message}"
          </p>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">Language: {action.language.toUpperCase()}</Badge>
          </div>
        </div>
      );
    case "formal_notice":
      return (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">Formal Legal Notice (Mahnstufe {action.level})</p>
          <p className="text-sm text-slate-600 italic bg-slate-50 border border-slate-100 p-3 rounded-lg">
            "{action.message}"
          </p>
          <div className="flex gap-2">
            <Badge variant="destructive" className="text-xs uppercase font-bold">Escalation Level {action.level}</Badge>
            <Badge variant="outline" className="text-xs">Language: {action.language.toUpperCase()}</Badge>
          </div>
        </div>
      );
    case "escalate_human":
      return (
        <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <h4 className="text-sm font-bold text-amber-900">Escalated for Manual Underwriting</h4>
          </div>
          <p className="text-sm text-amber-800 font-medium">Urgency: <span className="uppercase font-bold">{action.urgency}</span></p>
          <p className="text-sm text-slate-700 leading-relaxed bg-white border border-amber-100/50 p-3 rounded-md">
            {action.reason}
          </p>
        </div>
      );
    case "auto_payout_vendor":
      return (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-800">Automated Vendor Service Disbursement</p>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Payout Amount</span>
              <span className="text-base font-bold text-slate-900">{formatEur(action.amount_eur_cents)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Invoice Reference</span>
              <span className="text-xs font-mono font-bold text-slate-950 truncate block mt-0.5">{action.invoice_reference}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 font-mono">Vendor ID: {action.vendor_id}</p>
        </div>
      );
    case "auto_disburse_landlord":
      return (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-800">Automated Disbursement to Landlord (Connected Express)</p>
          <div className="grid grid-cols-3 gap-3 max-w-xl">
            <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-emerald-500 block">Disbursed Amount</span>
              <span className="text-base font-bold text-emerald-700">{formatEur(action.amount_eur_cents)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Platform Fee</span>
              <span className="text-base font-bold text-slate-700">{formatEur(action.fee_eur_cents)}</span>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-indigo-500 block">Net Transferred</span>
              <span className="text-base font-bold text-indigo-700">{formatEur(action.amount_eur_cents - action.fee_eur_cents)}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 font-mono">Landlord ID: {action.landlord_id}</p>
        </div>
      );
    default:
      return <p className="text-sm text-slate-600">No structured details available.</p>;
  }
};

export function ReasoningChain({ response, tenantId, tenantName, amountCents }: ReasoningChainProps) {
  const [showRawJson, setShowRawJson] = useState(false);

  return (
    <div data-testid="reasoning-chain" className="space-y-6">
      {/* 1. Reasoning Summary */}
      <Card className="overflow-hidden border border-slate-100 bg-white/70 backdrop-blur-md shadow-md shadow-slate-100/50 hover:shadow-lg transition-all duration-300">
        <CardHeader className="border-b border-slate-50 bg-slate-50/40 px-6 py-4 flex flex-row items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/50">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-900">Agent Decision Overview</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">High-level executive rationale from autonomous planner</p>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm leading-relaxed text-slate-700 font-medium bg-slate-50/50 border border-slate-100/80 p-4 rounded-xl shadow-inner">
            {response.reasoning_summary}
          </p>
        </CardContent>
      </Card>

      {/* 2. Citations Grid */}
      {response.unstructured_sources && response.unstructured_sources.length > 0 && (
        <Card className="overflow-hidden border border-slate-100 bg-white/70 backdrop-blur-md shadow-md shadow-slate-100/50">
          <CardHeader className="border-b border-slate-50 bg-slate-50/40 px-6 py-4 flex flex-row items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 border border-violet-100/50">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Unstructured Source Citations</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">German documents & communications cited with relative weights</p>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {response.unstructured_sources.map((src: UnstructuredSource, idx) => {
                const percentage = Math.round(src.weight * 100);
                return (
                  <div
                    key={idx}
                    className="relative flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/40 p-4 hover:border-slate-200 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md truncate max-w-[70%]">
                          {src.source}
                        </span>
                        <Badge variant="secondary" className="text-[10px] bg-indigo-50 border-indigo-100 text-indigo-700 font-bold py-0 px-1.5 font-mono">
                          Weight {src.weight.toFixed(2)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 italic bg-white p-3 rounded-lg border border-slate-50/60 leading-relaxed shadow-sm">
                        "{src.excerpt}"
                      </p>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                        <span>Relevance weight</span>
                        <span>{percentage}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200/50">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Reasoning Chain Timeline */}
      <Card className="overflow-hidden border border-slate-100 bg-white/70 backdrop-blur-md shadow-md shadow-slate-100/50">
        <CardHeader className="border-b border-slate-50 bg-slate-50/40 px-6 py-4 flex flex-row items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600 border border-teal-100/50">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-900">Step-by-Step Reasoning Timeline</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Chronological evaluation steps processed by LLM decision space</p>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="relative pl-6 before:absolute before:left-3 before:top-2 before:h-[calc(100%-1rem)] before:w-[2px] before:bg-slate-100 space-y-6">
            {response.reasoning_chain.map((step: ReasoningStep) => (
              <div key={step.step} className="relative group">
                <span className="absolute -left-[23px] top-0 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 border-2 border-white text-[9px] font-bold text-white shadow-sm ring-1 ring-slate-100 transition-colors group-hover:bg-indigo-600 group-hover:ring-indigo-100">
                  {step.step}
                </span>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-800 leading-snug">{step.thought}</p>
                  {step.evidence && step.evidence.length > 0 && (
                    <div className="rounded-lg bg-slate-50/50 border border-slate-100 p-2.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Coded Evidence</span>
                      <ul className="space-y-1">
                        {step.evidence.map((e, i) => (
                          <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5 leading-relaxed font-mono">
                            <span className="text-indigo-500 shrink-0 mt-0.5">▪</span>
                            <span>{e}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 4. Alternatives Grid */}
      {response.alternatives_considered && response.alternatives_considered.length > 0 && (
        <Card className="overflow-hidden border border-slate-100 bg-white/70 backdrop-blur-md shadow-md shadow-slate-100/50">
          <CardHeader className="border-b border-slate-50 bg-slate-50/40 px-6 py-4 flex flex-row items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100/50">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Alternatives Evaluated & Dismissed</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Rejection rationale for alternative action vectors</p>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {response.alternatives_considered.map((alt, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-100 bg-slate-50/20 p-3.5 flex flex-col justify-between"
                >
                  <div>
                    <span className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      {alt.action_kind.replace(/_/g, " ")}
                    </span>
                    <p className="text-xs text-slate-600 leading-relaxed mt-2.5">
                      {alt.reason_not_chosen}
                    </p>
                  </div>
                  <div className="mt-3.5 border-t border-slate-100/60 pt-2 flex items-center text-[10px] text-rose-500 font-bold uppercase tracking-wider gap-1">
                    <AlertCircle className="h-3 w-3" /> Dismissed
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Chosen Action Display */}
      <Card className="overflow-hidden border-2 border-indigo-600 bg-indigo-50/10 shadow-lg shadow-indigo-100/50">
        <CardHeader className="border-b border-indigo-100 bg-indigo-50/40 px-6 py-4 flex flex-row items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Autonomous Recommendation Action</CardTitle>
              <p className="text-xs text-indigo-600 font-semibold mt-0.5 uppercase tracking-wider">
                {response.action.kind.replace(/_/g, " ")}
              </p>
            </div>
          </div>
          <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1 font-mono uppercase tracking-wider shadow-sm">
            Confidence {Math.round(response.confidence * 100)}%
          </Badge>
        </CardHeader>
        <CardContent className="p-6 space-y-4 bg-white/50">
          {renderActionDetails(response.action)}

          {/* Render Payment Plan Review Modal inside the Action Block */}
          {response.action.kind === "plan_negotiation" && tenantId && tenantName && amountCents && (
            <div className="mt-4 border-t border-slate-100 pt-4 flex justify-end">
              <PlanModal
                tenantId={tenantId}
                tenantName={tenantName}
                amountCents={amountCents}
                installments={response.action.proposed_installments}
              />
            </div>
          )}

          {/* Toggle Raw JSON */}
          <div className="border-t border-slate-100 pt-4 mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-xs text-slate-500 hover:text-slate-900 font-medium inline-flex items-center gap-1 p-0 h-auto hover:bg-transparent"
            >
              <FileCode className="h-3.5 w-3.5" />
              {showRawJson ? "Hide Technical Audit Envelope" : "Inspect Raw Decision Payload"}
              {showRawJson ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>

            {showRawJson && (
              <div className="mt-3 relative group">
                <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-[11px] font-mono leading-relaxed text-emerald-400 shadow-inner max-h-96">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 6. Technical Audit Metadata footer */}
      <div className="flex flex-wrap gap-4 items-center justify-between text-xs text-slate-400 font-mono px-2">
        <div className="flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          <span>Model: {response.audit.model}</span>
        </div>
        <div>
          <span>Policy: {response.audit.policy_version}</span>
        </div>
        <div>
          <span>Timestamp: {new Date(response.audit.timestamp).toLocaleString("de-DE")}</span>
        </div>
      </div>
    </div>
  );
}
