import { Badge } from "@/components/ui/badge";

type CaseStatus = "pending" | "executed" | "failed" | "blocked_retry" | "escalated";

const statusConfig: Record<
  CaseStatus,
  { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  executed: { label: "Executed", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  blocked_retry: { label: "Blocked / Retry", variant: "warning" },
  escalated: { label: "Escalated", variant: "destructive" },
};

interface CaseStatusBadgeProps {
  status: string;
}

export function CaseStatusBadge({ status }: CaseStatusBadgeProps) {
  const config = statusConfig[status as CaseStatus] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
