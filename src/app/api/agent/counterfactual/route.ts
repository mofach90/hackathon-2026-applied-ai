import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/agent/runner";

export async function POST(req: NextRequest) {
  const { case_id } = (await req.json()) as { case_id: string };
  if (!case_id) {
    return NextResponse.json({ error: "case_id required" }, { status: 400 });
  }

  const result = await runAgent(case_id, { withCounterfactual: true });
  return NextResponse.json(result);
}
