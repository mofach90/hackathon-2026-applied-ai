import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { CaseListTable } from "@/components/cases/case-list-table";

interface CaseRow extends Record<string, unknown> {
  id: string;
  outcome: string;
  decision: unknown;
  created_at: Date;
  tenantName: string | null;
  propertyAddress: string | null;
}

async function getCases(): Promise<CaseRow[]> {
  return db.execute<CaseRow>(sql`
    SELECT
      ac.id,
      ac.outcome,
      ac.decision,
      ac.created_at,
      t.name        AS "tenantName",
      p.address     AS "propertyAddress"
    FROM agent_case ac
    LEFT JOIN tenant t  ON t.id = (ac.trigger_payload->>'tenant_id')::uuid
    LEFT JOIN property p ON p.id = t.property_id
    ORDER BY ac.created_at DESC
    LIMIT 100
  `);
}

export default async function HomePage() {
  const cases = await getCases();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Cases</h1>
      <CaseListTable cases={cases} />
    </div>
  );
}
