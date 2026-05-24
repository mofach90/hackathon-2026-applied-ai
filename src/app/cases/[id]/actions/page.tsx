import "server-only";

import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { escalation, agentCase } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ApprovalQueue } from "@/components/cases/approval-queue";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ActionsPage({ params }: Props) {
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

  const rows = await db
    .select()
    .from(escalation)
    .innerJoin(agentCase, eq(escalation.agent_case_id, agentCase.id))
    .where(eq(escalation.agent_case_id, id));

  const pending = rows.filter((r) => r.escalation.status === "open");

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Pending approvals</h1>
      <ApprovalQueue items={pending} caseId={id} />
    </div>
  );
}
