import { db } from "@/db/client";
import { agentCase } from "@/db/schema";
import { desc } from "drizzle-orm";
import { CaseListTable } from "@/components/cases/case-list-table";

export default async function HomePage() {
  const cases = await db
    .select({
      id: agentCase.id,
      outcome: agentCase.outcome,
      trigger_type: agentCase.trigger_type,
      created_at: agentCase.created_at,
    })
    .from(agentCase)
    .orderBy(desc(agentCase.created_at));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Cases</h1>
      <CaseListTable cases={cases} />
    </div>
  );
}
