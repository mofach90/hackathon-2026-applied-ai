# ADR 0006: Application Stack

- **Status:** Accepted
- **Date:** 2026-05-23
- **Deciders:** Mohamed Ayari, Aymen

## Context

We have ~22 working hours to ship:

- A tenant-facing payment page
- A landlord-facing dashboard with live agent reasoning UI
- A backend that handles Stripe webhooks, runs the agent, enforces compliance + fairness, persists to Postgres
- Public GitHub repo + comprehensive README + 2-min Loom

This means **the stack must minimize incidental complexity** — one toolchain, one dev server, one deploy target. We can't afford to wire frontend + backend + worker as separate services.

## Decision

| Layer | Choice |
|---|---|
| Framework | **Next.js 15 (App Router)** |
| Language | **TypeScript** (strict mode) |
| Styling | **Tailwind CSS v4** |
| UI components | **shadcn/ui** + Lucide icons |
| Package manager | **pnpm** |
| Node version | **22.x** (LTS, pinned in `.nvmrc`) |
| Forms / validation | **Zod** + React Hook Form |
| State (server) | React Server Components + Server Actions |
| State (client) | TanStack Query for any client fetching |

Single deploy unit: the Next.js app handles UI, API routes, and webhooks.

## Consequences

### Easier

- **One dev server.** `pnpm dev` runs everything.
- **One deploy.** Vercel auto-deploys on push to `main`.
- **Server Components** mean we can read from the DB directly in components without inventing a query client.
- **Server Actions** mean we can mutate from forms without writing API routes for trivial cases.
- **Type safety end-to-end** (DB → server → client).
- shadcn/ui gives polished components without us shipping our own design system.
- Zod gives runtime parsing aligned with TypeScript types (agent responses, webhook payloads).

### Harder

- Tightly coupled — can't easily split worker out for long-running tasks
  - Mitigation: Vercel API routes timeout at 60s. Agent calls take seconds. Disbursement cron uses Vercel Cron with a short job.
- App Router learning curve if a contributor doesn't know it
  - Mitigation: we know it; CLAUDE.md has the patterns we use
- Tailwind v4 is recent — fewer Stack Overflow answers
  - Mitigation: docs are good; we keep styling simple

## Alternatives considered

- **Remix.** Pro: simpler mental model. Con: smaller ecosystem of polished components; no Server Actions equivalent.
- **SvelteKit.** Pro: smaller bundle. Con: team is faster in React; ecosystem smaller.
- **Separate FastAPI backend + Next.js frontend.** Pro: more decoupled. Con: two dev servers, two deploys, CORS, auth between them — burns time we don't have.
- **Plain Express + Vite/React SPA.** Pro: maximal control. Con: lots of glue code; loses SSR + RSC ergonomics.
- **Astro.** Pro: great DX. Con: weaker for our interaction-heavy dashboard.

## Implementation notes

### Project bootstrap

```bash
pnpm create next-app@latest rentpilot \
  --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint
cd rentpilot
pnpm add @anthropic-ai/sdk stripe zod drizzle-orm postgres
pnpm add -D drizzle-kit @types/node tsx
pnpx shadcn@latest init
```

### Top-level folder layout

```
src/
├── app/                  # Next.js App Router (RSC by default)
│   ├── (tenant)/         # Tenant-facing pages: pay, plan
│   ├── (landlord)/       # Landlord dashboard
│   ├── api/              # Route handlers: stripe webhook, agent invocations
│   └── layout.tsx
├── agent/                # Agent orchestrator
│   ├── types.ts          # AgentAction union, AgentResponse, etc.
│   ├── prompt.ts         # System + user prompts (versioned)
│   ├── runner.ts         # Claude API call + parse
│   ├── compliance.ts     # validateCompliance + rule checks
│   ├── fairness.ts       # validateFairness + counterfactual runner
│   ├── redactor.ts       # PII redaction (regex + LLM)
│   ├── context.ts        # Context builder + sanitizer
│   └── dispatch.ts       # The big switch — execute the decision
├── stripe/               # Stripe adapters
│   ├── client.ts         # Stripe SDK initialization
│   ├── customers.ts      # Tenant Customer create/lookup
│   ├── connect.ts        # Express account create
│   ├── invoices.ts       # Plan invoice helpers
│   ├── transfers.ts      # Vendor/landlord transfer helpers
│   └── webhook.ts        # Webhook handler (verification + dispatch)
├── db/                   # Drizzle ORM
│   ├── schema.ts         # Table definitions
│   ├── client.ts         # postgres client + drizzle instance
│   └── seed.ts           # Demo data seeder
├── lib/                  # Shared utilities
│   ├── money.ts          # eurToCents, centsToEur, formatEur
│   ├── time.ts           # nowInBerlin, isContactHours, etc.
│   └── ids.ts            # ID generation
├── components/           # React components (shadcn primitives + ours)
│   └── ui/               # shadcn/ui generated
└── styles/
    └── globals.css       # Tailwind + custom CSS
```

### TypeScript config (`tsconfig.json`)

Strict mode on:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    // ...
  }
}
```

### Tailwind / shadcn

shadcn/ui generates components directly into `src/components/ui/` — we own them. No CSS-in-JS. No theme prop systems. Just Tailwind classes.

### Server Actions usage

Mutations (create plan, approve escalation, run counterfactual) are Server Actions. Form-driven flows do not need API routes. API routes are reserved for:

- Stripe webhook (`/api/stripe/webhook`)
- Cron entry points (`/api/cron/*`)
- Anything that needs to be HTTP-accessible from outside (e.g. a future external integration)

## Open questions

- Do we need a state-management library on the client? Probably not — TanStack Query covers server data; React state covers UI.
- Bundle size budget? Not chasing it for the demo.
- Accessibility? Aim for shadcn defaults (which are decent); don't audit further given time.

## References

- Next.js App Router docs: https://nextjs.org/docs/app
- shadcn/ui: https://ui.shadcn.com/
- ADR-0007 — Database & ORM
- ADR-0008 — AI runtime
- ADR-0009 — Hosting (Vercel-shaped decisions in this ADR depend on it)
