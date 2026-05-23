"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";

interface CaseRow {
  id: string;
  outcome: string;
  decision: unknown;
  created_at: Date;
  tenantName: string | null;
  propertyAddress: string | null;
}

function lastAction(decision: unknown): string {
  if (decision && typeof decision === "object" && "kind" in decision) {
    return String((decision as { kind: string }).kind).replace(/_/g, " ");
  }
  return "—";
}

interface CaseListTableProps {
  cases: CaseRow[];
}

export function CaseListTable({ cases }: CaseListTableProps) {
  const router = useRouter();

  if (cases.length === 0) {
    return (
      <p className="text-sm text-slate-500 mt-8">
        No cases yet. Run{" "}
        <code className="font-mono bg-slate-100 px-1 rounded">pnpm demo:reset</code> to seed cases.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tenant</TableHead>
          <TableHead>Property</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Action</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cases.map((c) => (
          <TableRow
            key={c.id}
            className="cursor-pointer"
            onClick={() => router.push(`/cases/${c.id}`)}
          >
            <TableCell className="font-medium">{c.tenantName ?? "—"}</TableCell>
            <TableCell className="text-slate-600">{c.propertyAddress ?? "—"}</TableCell>
            <TableCell>
              <CaseStatusBadge status={c.outcome} />
            </TableCell>
            <TableCell className="capitalize text-slate-600">{lastAction(c.decision)}</TableCell>
            <TableCell className="text-slate-500">
              {new Date(c.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
