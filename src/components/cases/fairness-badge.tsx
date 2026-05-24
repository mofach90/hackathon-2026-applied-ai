import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, CheckCircle2, AlertTriangle, ShieldCheck, XOctagon } from "lucide-react";
import type { FairnessCheck } from "@/agent/types/fairness";

interface FairnessBadgeProps {
  check: FairnessCheck;
}

export function FairnessBadge({ check }: FairnessBadgeProps) {
  const isPass = check.overall === "pass";

  return (
    <Card className="overflow-hidden border border-slate-100 bg-white/70 backdrop-blur-md shadow-md shadow-slate-100/50 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300">
      <CardHeader className="border-b border-slate-50 bg-slate-50/40 px-6 py-4 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
              isPass
                ? "bg-indigo-50 text-indigo-600 border-indigo-100/50"
                : "bg-rose-50 text-rose-600 border-rose-100/50"
            }`}
          >
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Fairness & Bias Shield
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Algorithmic fairness & demographic neutrality
            </p>
          </div>
        </div>
        <Badge
          variant={isPass ? "success" : "destructive"}
          className="text-xs font-bold uppercase tracking-wider px-3 py-1 shadow-sm"
        >
          {isPass ? "Fairness: Pass" : "Fairness: Blocked"}
        </Badge>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* Blocked or warning reasons */}
        {!isPass && check.blocked_reason && (
          <div className="rounded-xl bg-rose-50 border border-rose-100/50 p-4 flex items-start gap-2.5">
            <XOctagon className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-rose-900">Fairness Infraction Detected</h4>
              <p className="text-sm text-rose-700 mt-1 leading-relaxed">{check.blocked_reason}</p>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Forbidden Keywords status */}
          <div
            className={`rounded-xl border p-3.5 flex items-start gap-3 transition-colors ${
              check.forbidden_keywords_present
                ? "bg-rose-50/20 border-rose-100"
                : "bg-emerald-50/10 border-emerald-100/50"
            }`}
          >
            {check.forbidden_keywords_present ? (
              <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="text-sm font-bold text-slate-900">Protected Attributes Check</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Checks for references to race, gender, religion, or nationality.
              </p>
              <div className="mt-2.5">
                <Badge
                  variant={check.forbidden_keywords_present ? "destructive" : "success"}
                  className="text-[10px] font-bold uppercase"
                >
                  {check.forbidden_keywords_present ? "Keywords Found" : "Neutral & Clean"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Counterfactual Status */}
          <div
            className={`rounded-xl border p-3.5 flex items-start gap-3 transition-colors ${
              check.counterfactual_agreed === null
                ? "bg-slate-50/50 border-slate-100 opacity-60"
                : check.counterfactual_agreed
                  ? "bg-emerald-50/10 border-emerald-100/50"
                  : "bg-rose-50/20 border-rose-100"
            }`}
          >
            <CheckCircle2
              className={`h-5 w-5 shrink-0 mt-0.5 ${
                check.counterfactual_agreed === null
                  ? "text-slate-400"
                  : check.counterfactual_agreed
                    ? "text-emerald-500"
                    : "text-rose-500"
              }`}
            />
            <div>
              <h4 className="text-sm font-bold text-slate-900">Counterfactual Swapping</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Evaluates decision outcome stability when swapping tenant names & demographics.
              </p>
              <div className="mt-2.5">
                {check.counterfactual_agreed !== null ? (
                  <Badge
                    variant={check.counterfactual_agreed ? "success" : "warning"}
                    className="text-[10px] font-bold uppercase"
                  >
                    Counterfactual: {check.counterfactual_agreed ? "agreed" : "disagreed"}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold uppercase text-slate-400 border-slate-200"
                  >
                    Not run yet
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
