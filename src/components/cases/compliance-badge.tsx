import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComplianceCheck, ComplianceResult } from "@/agent/types/compliance";

interface ComplianceBadgeProps {
  check: ComplianceCheck;
}

const ruleVariant = (result: ComplianceResult["result"]) => {
  if (result === "pass") return "success" as const;
  if (result === "fail") return "destructive" as const;
  return "outline" as const;
};

export function ComplianceBadge({ check }: ComplianceBadgeProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Compliance</CardTitle>
        <Badge variant={check.overall === "pass" ? "success" : "destructive"}>
          {check.overall === "pass" ? "Compliance: Pass" : "Compliance: Blocked"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {check.blocked_reason && <p className="text-sm text-red-600">{check.blocked_reason}</p>}
        {check.suggested_alternative && (
          <p className="text-sm text-slate-600">
            <span className="font-medium">Suggested: </span>
            {check.suggested_alternative}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {check.results.map((r) => (
            <Badge key={r.rule_id} variant={ruleVariant(r.result)} title={r.note}>
              {r.rule_id}: {r.result}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
