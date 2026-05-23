"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";

interface CaseRow {
  id: string;
  outcome: string;
  trigger_type: string;
  created_at: Date;
}

interface CaseListTableProps {
  cases: CaseRow[];
}

export function CaseListTable({ cases }: CaseListTableProps) {
  const router = useRouter();

  if (cases.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No cases yet. Run <code className="font-mono bg-slate-100 px-1 rounded">pnpm demo:reset</code> to seed cases.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Case ID</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cases.map((c) => (
          <TableRow
            key={c.id}
            className="cursor-pointer"
            onClick={() => router.push(`/cases/${c.id}`)}
          >
            <TableCell className="font-mono text-xs text-slate-600">{c.id.slice(0, 8)}…</TableCell>
            <TableCell>{c.trigger_type}</TableCell>
            <TableCell>
              <CaseStatusBadge status={c.outcome} />
            </TableCell>
            <TableCell className="text-slate-500">
              {new Date(c.created_at).toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
