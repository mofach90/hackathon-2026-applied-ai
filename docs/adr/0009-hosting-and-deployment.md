# ADR 0009: Hosting & Deployment

- **Status:** Accepted
- **Date:** 2026-05-23
- **Deciders:** Mohamed Ayari, Aymen

## Context

The submission requires a public GitHub repo + a 2-minute Loom demo. Judges may or may not run the code themselves, but a live URL is reassuring and lets us record the demo against a real deployed app rather than `localhost`.

We need:

- Frontend + API on one URL
- A Postgres database the deployed app can reach
- Webhooks reachable from Stripe (which means a public URL, no localhost)
- Zero-ops deploys
- Free tier sufficient

## Decision

| Concern | Choice |
|---|---|
| Application host | **Vercel** |
| Database host | **Supabase** (managed Postgres) |
| Domain | Default `*.vercel.app` for the demo (no custom domain) |
| Environments | **One: `production`** (no staging — too much overhead for hackathon) |
| Auto-deploy | On push to `main` |
| Preview deploys | On every PR (default Vercel behavior) |
| Webhook URL (dev) | `stripe listen --forward-to localhost:3000/api/stripe/webhook` |
| Webhook URL (prod) | `https://rentpilot-xxx.vercel.app/api/stripe/webhook` registered in Stripe Dashboard |

## Consequences

### Easier

- `git push` deploys
- Next.js + Vercel is the smoothest combination available
- Preview URLs per PR mean we can demo branches without merging
- Supabase + Vercel both have generous free tiers — no card needed
- Webhook URL is stable as long as we don't rename the Vercel project

### Harder

- Single production environment means **one mistake on `main` can break the demo** — discipline matters
- Vercel API route timeout is 60s (Hobby plan); our agent calls fit, but a slow chain could hit it
- Stripe webhook URL must be re-registered if we rename the project — pin the name early

## Alternatives considered

- **Self-host on Railway / Fly.io.** Pro: more control. Con: extra ops, no Next.js-native serverless integration.
- **Render.** Pro: similar story. Con: less mature Next.js story.
- **AWS Amplify / Cloudflare Pages.** Pro: powerful. Con: more friction than Vercel for Next.js.
- **`ngrok` + localhost for the whole demo.** Pro: zero hosting cost. Con: ngrok URLs change; not credible if the judges check the GitHub URL.

## Implementation notes

### Vercel project setup

```bash
# from the repo root, once
pnpx vercel link
pnpx vercel env pull .env.local    # pull env vars for local dev
```

Vercel project name: `rentpilot` (lowercase, hyphens, stable — do not rename).

### Environment variables

Set in Vercel dashboard, **not** in code or `.env.local` commits:

```
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
DATABASE_URL=postgresql://...@.supabase.com:6543/postgres   # Supabase pooler URL
RESEND_API_KEY=re_...
NEXT_PUBLIC_APP_URL=https://rentpilot-xxx.vercel.app
NODE_ENV=production
```

See ADR-0011 for secrets management.

### Supabase setup

1. Create project at https://supabase.com/dashboard — region `eu-central-1` (closest to Berlin)
2. Copy the **connection pooler** URL (port 6543) into `DATABASE_URL` — do NOT use the direct connection (port 5432) for the serverless deploy
3. Run schema sync from local: `pnpm drizzle-kit push`

### Cron jobs

For the landlord weekly disbursement sweep, we use **Vercel Cron**:

```ts
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/disburse-landlords",
      "schedule": "0 2 * * 0"  // Sunday 02:00 UTC
    },
    {
      "path": "/api/cron/check-overdue",
      "schedule": "*/15 * * * *"  // every 15 min
    }
  ]
}
```

API routes must verify `Authorization: Bearer ${process.env.CRON_SECRET}` for cron-only endpoints.

### Webhook URL registration

- Production: register `https://rentpilot-xxx.vercel.app/api/stripe/webhook` in the Stripe Dashboard
- Local dev: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
  - This generates a new webhook signing secret for local — different from prod's
  - Store both: `STRIPE_WEBHOOK_SECRET_DEV` and `STRIPE_WEBHOOK_SECRET` in `.env.local`

### Recording the Loom

For the 2-minute video, record against the deployed URL, not localhost. This:

- Looks more polished
- Demonstrates we have a real deploy
- Avoids the awkward `localhost:3000` in the browser address bar

## Open questions

- Custom domain? Not for demo. Easy to add later if we keep the project.
- Region for Supabase? `eu-central-1` (Frankfurt). Vercel auto-selects edge for static content; API routes run in a US region by default — fine for demo. Production would pin to EU.
- Backup / restore plan? Supabase has automatic backups on free tier; that's enough.

## References

- Vercel docs: https://vercel.com/docs
- Vercel Cron: https://vercel.com/docs/cron-jobs
- Supabase Postgres: https://supabase.com/docs/guides/database
- Stripe webhook setup: https://stripe.com/docs/webhooks
- ADR-0006 — App stack
- ADR-0007 — Database
- ADR-0010 — CI/CD pipeline
- ADR-0012 — Webhook handling
