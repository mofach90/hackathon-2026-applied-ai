"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface PlanModalProps {
  tenantId: string;
  tenantName: string;
  amountCents: number;
  installments: number;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function PlanModal({
  tenantId,
  tenantName,
  amountCents,
  installments,
  trigger,
  onSuccess
}: PlanModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Divide amount cents mirroring stripe/plan.ts logic
  const base = Math.floor(amountCents / installments);
  const remainder = amountCents - base * installments;

  const installmentList = Array.from({ length: installments }).map((_, i) => {
    const amount = i === installments - 1 ? base + remainder : base;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (i + 1) * 30);
    return {
      index: i + 1,
      amount,
      dueDate,
    };
  });

  const confirmPlan = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/agent/plan/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          amount_cents: amountCents,
          installments: installments,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to materialize payment plan in Stripe.");
      }

      setIsSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred finalising the plan.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setIsSuccess(false);
        setError(null);
      }
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm">
            Review Payment Plan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-white border border-slate-100 shadow-xl rounded-2xl overflow-hidden p-0">
        <DialogHeader className="px-6 py-5 border-b border-slate-50 bg-slate-50/40">
          <DialogTitle className="text-base font-bold text-slate-900">Installment Plan Review</DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            Verify and finalize the proposed payment structure for <span className="font-semibold text-slate-700">{tenantName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-inner">
                <CheckCircle className="h-8 w-8 animate-bounce-slow" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-slate-900">Stripe Payment Plan Configured!</h4>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  The payment plan installments have been successfully created. The first installment notice was finalized and emailed to the tenant via Stripe.
                </p>
              </div>
              <div className="pt-2">
                <DialogClose asChild>
                  <Button className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-6 py-2 rounded-xl transition-colors">
                    Close Reviewer
                  </Button>
                </DialogClose>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 flex items-start gap-2.5">
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-rose-900">Materialisation Failed</h5>
                    <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">{error}</p>
                  </div>
                </div>
              )}

              {/* Installments schedule list */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Installment Schedule</h5>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden bg-slate-50/20">
                  {installmentList.map((inst) => (
                    <div key={inst.index} className="flex justify-between items-center px-4 py-3 bg-white">
                      <div className="flex items-center space-x-3">
                        <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] font-bold">
                          {inst.index}
                        </Badge>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">Installment #{inst.index}</span>
                          <span className="text-[10px] text-slate-400 font-medium inline-flex items-center mt-0.5">
                            <CalendarDays className="h-3 w-3 mr-1 text-slate-300" />
                            Due: {inst.dueDate.toLocaleDateString("de-DE")}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono text-sm font-semibold text-slate-900">
                        {formatEur(inst.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center px-4 py-3 bg-slate-50/50">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Repayment</span>
                    <span className="font-mono text-base font-bold text-slate-900">
                      {formatEur(amountCents)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <DialogClose asChild>
                  <Button variant="outline" size="sm" className="text-xs text-slate-500 hover:bg-slate-50 rounded-xl border-slate-150">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  onClick={confirmPlan}
                  disabled={isLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Finalizing...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Confirm & Send Plan
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
