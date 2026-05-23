import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { disburseLandlord } from "@/stripe/landlord-disburse";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Disburse the prior week (Sunday-to-Saturday window)
  const to = new Date(now);
  to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 7);

  await disburseLandlord({ from, to });

  return NextResponse.json({ ok: true });
}
