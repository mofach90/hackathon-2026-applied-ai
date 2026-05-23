import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarRange, CreditCard, Clock, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { rentObligation } from "@/db/schema";

type RentObligation = InferSelectModel<typeof rentObligation>;

interface PaymentHistoryProps {
  obligations: RentObligation[];
}

const statusBadge = (status: RentObligation["status"]) => {
  switch (status) {
    case "paid":
      return (
        <Badge variant="success" className="font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Paid
        </Badge>
      );
    case "late":
      return (
        <Badge variant="destructive" className="font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 inline-flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Late
        </Badge>
      );
    case "in_plan":
      return (
        <Badge variant="warning" className="font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 inline-flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-200">
          <Clock className="h-3 w-3" /> In Plan
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 inline-flex items-center gap-1">
          <HelpCircle className="h-3 w-3" /> {status}
        </Badge>
      );
  }
};

function daysLate(obligation: RentObligation): number | null {
  if (!obligation.paid_at) return null;
  const diff = obligation.paid_at.getTime() - obligation.due_date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : null;
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function PaymentHistory({ obligations }: PaymentHistoryProps) {
  if (obligations.length === 0) {
    return (
      <Card className="border border-slate-100 bg-white/70 backdrop-blur-md shadow-md">
        <CardHeader className="flex flex-row items-center space-x-3 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <CreditCard className="h-4 w-4" />
          </div>
          <CardTitle className="text-base font-bold text-slate-900">Payment History</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-slate-500">No payment records found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border border-slate-100 bg-white/70 backdrop-blur-md shadow-md shadow-slate-100/50 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 bg-slate-50/40 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/50">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-900">Payment History</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Rent obligations and schedule tracking</p>
          </div>
        </div>
        <div className="text-xs font-semibold text-slate-500 flex items-center bg-white px-2.5 py-1 rounded-md border border-slate-100">
          <CalendarRange className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
          {obligations.length} records
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-3.5">Month</th>
                <th className="px-6 py-3.5 text-right">Amount</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5">Paid At</th>
                <th className="px-6 py-3.5 text-right">Days Late</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {obligations.map((o) => {
                const late = daysLate(o);
                return (
                  <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {o.period_start.toLocaleDateString("de-DE", {
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm font-semibold text-slate-900">
                      {formatEur(o.amount_eur_cents)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {statusBadge(o.status)}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                      {o.paid_at ? o.paid_at.toLocaleDateString("de-DE") : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-right font-mono">
                      {late !== null ? (
                        <span className="inline-flex items-center rounded bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-100">
                          {late} days
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
