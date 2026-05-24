"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EscalationRow {
  escalation: {
    id: string;
    reason: string;
    urgency: string;
    status: string;
    created_at: Date;
  };
}

interface Props {
  items: EscalationRow[];
  caseId: string;
}

export function ApprovalQueue({ items }: Props) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);

  // Demo: also show a synthetic pending action if no real escalations exist
  const syntheticItem: EscalationRow = {
    escalation: {
      id: "demo-1",
      reason: "max_retries_exceeded",
      urgency: "high",
      status: "open",
      created_at: new Date(),
    },
  };

  const displayItems = items.length > 0 ? items : [syntheticItem];
  const visible = displayItems.filter((i) => !resolved.has(i.escalation.id));

  async function handleAction(id: string, _action: "approve" | "reject") {
    setLoading(id);
    // Demo-only: resolve locally; a real implementation would call an API
    await new Promise((r) => setTimeout(r, 400));
    setResolved((prev) => new Set([...prev, id]));
    setLoading(null);
  }

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending actions.</p>;
  }

  return (
    <div className="space-y-3" data-testid="approval-queue">
      {visible.map((item) => (
        <Card key={item.escalation.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Escalation
              <Badge
                variant={item.escalation.urgency === "high" ? "destructive" : "secondary"}
              >
                {item.escalation.urgency}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Reason: {item.escalation.reason.replace(/_/g, " ")}
            </p>
            <p className="text-xs text-muted-foreground">
              Created: {new Date(item.escalation.created_at).toLocaleString("de-DE")}
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                disabled={loading === item.escalation.id}
                onClick={() => handleAction(item.escalation.id, "approve")}
              >
                {loading === item.escalation.id ? "…" : "Approve"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={loading === item.escalation.id}
                onClick={() => handleAction(item.escalation.id, "reject")}
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
