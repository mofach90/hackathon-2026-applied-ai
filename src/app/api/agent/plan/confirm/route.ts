import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createPaymentPlan } from "@/stripe/plan";

export async function POST(req: NextRequest) {
  const { tenant_id, amount_cents, installments } = (await req.json()) as {
    tenant_id: string;
    amount_cents: number;
    installments: number;
  };

  if (!tenant_id || !amount_cents || !installments) {
    return NextResponse.json({ error: "tenant_id, amount_cents, installments required" }, { status: 400 });
  }

  const plan = await createPaymentPlan(tenant_id, amount_cents, installments);
  return NextResponse.json(plan);
}
