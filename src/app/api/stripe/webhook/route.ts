export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { processedWebhook } from "@/db/schema";
import { env } from "@/lib/env";
import { stripe } from "@/stripe/client";
import { dispatchWebhookEvent } from "@/stripe/webhook-dispatcher";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return Response.json({ error: "missing signature" }, { status: 400 });
  }

  // 1. Verify signature
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return Response.json({ error: "bad signature" }, { status: 400 });
  }

  // 2. Dedup: insert into processed_webhook (event_id), ON CONFLICT → return 200
  try {
    await db
      .insert(processedWebhook)
      .values({ event_id: event.id, type: event.type })
      .onConflictDoNothing();
  } catch {
    return Response.json({ ok: true });
  }

  // 3. Dispatch
  try {
    await dispatchWebhookEvent(event);
  } catch {
    // Remove dedup row so Stripe retries
    await db.delete(processedWebhook).where(eq(processedWebhook.event_id, event.id));
    return Response.json({ error: "handler failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
