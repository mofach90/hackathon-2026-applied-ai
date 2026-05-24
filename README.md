# RentPilot AI

> **Autonomous payment operations for property management — powered by AI.**
> Built for the **hallo theo Applied AI Hackathon** (Berlin, 23–24 May 2026),
> Stripe track — *Autonomous Payment Operations*.

---

## What is this?

RentPilot AI is an autonomous agent platform that handles rent payment failures end-to-end — without a human in the loop.

When a tenant misses a payment, the agent:
1. **Builds context** — payment history, days overdue, tenant profile, prior interactions
2. **Reasons** — produces a step-by-step reasoning chain explaining its decision
3. **Checks compliance** — verifies German tenancy law (Mahnung spacing, grace period, late-fee cap, contact hours)
4. **Audits for bias** — runs a counterfactual swap (different name/language, same financial situation) to prove demographic fairness
5. **Acts** — sends a friendly check-in, proposes a payment plan, issues a formal notice, or escalates to a human

Every decision is fully explainable and auditable. No black boxes.

---

## Live Demo

| URL | What you see |
|-----|-------------|
| `http://localhost:3000` | Dashboard — all active cases |
| `http://localhost:3000/cases/<id>` | Case detail — reasoning chain, compliance, fairness audit |

**Demo cases pre-loaded:**
| Tenant | Situation | Agent Decision |
|--------|-----------|---------------|
| Amina Benali | 3 days overdue, first miss, long-term tenant | Friendly check-in (French) |
| Mike Schmidt | 18 days overdue, 3rd missed payment | Formal notice Level 1 (German) |
| Sara Petrovic | 7 days overdue, brand-new tenant | Payment plan negotiation (English) |

---

## Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | ≥ 22 |
| pnpm | 11.2.2 |
| PostgreSQL | 15+ (local) or Supabase |

### 1 — Clone & install

```bash
git clone https://github.com/mofach90/hackathon-2026-applied-ai.git
cd hackathon-2026-applied-ai
pnpm install
```

### 2 — Environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
|----------|----------------|
| `DATABASE_URL` | Supabase → Settings → Database → Connection pooler (port **6543**) — or local PostgreSQL: `postgresql://postgres:postgres@localhost:5432/rentpilot` |
| `STRIPE_SECRET_KEY` | https://dashboard.stripe.com/test/apikeys — use `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` — copy the printed `whsec_...` |
| `STRIPE_CONNECT_LANDLORD_PLATFORM_FEE_BPS` | Platform fee in basis points — `800` = 8% (default) |
| `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey |
| `RESEND_API_KEY` | https://resend.com/api-keys |
| `CRON_SECRET` | Generate with `openssl rand -hex 32` |

### 3 — Database setup

```bash
# Push schema
DATABASE_URL="your-url-here" pnpm db:push

# Seed with demo data (landlord, properties, tenants)
DATABASE_URL="your-url-here" pnpm db:seed
```

### 4 — Run

```bash
pnpm dev
```

Open **http://localhost:3000**.

> The app loads with 3 demo cases already visible. If the dashboard shows "No cases yet", run the seed command above.

---

## Demo Reset

To wipe and re-seed all demo data (useful before a demo):

```bash
DATABASE_URL="your-url-here" pnpm db:reset
DATABASE_URL="your-url-here" pnpm db:seed
```

> `pnpm demo:reset` also runs `stripe:seed` but requires Stripe Connect enabled on the account.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| AI / LLM | Google Gemini (`@google/genai`) |
| Database | PostgreSQL + Drizzle ORM |
| Payments | Stripe (webhooks, Connect) |
| Email | Resend |
| Styling | Tailwind CSS v4 |
| Language | TypeScript |

---

## Key Features for Judges

### Autonomous Agent Pipeline
Every payment failure triggers a full agent run: context building → sanitisation → PII redaction → compliance loop → fairness audit → decision → DB write. See `src/agent/runner.ts`.

### Compliance Engine
Rules encoded from German tenancy law (BGB §286, §543): grace periods, Mahnung spacing (14 days), late-fee cap, contact hours, language matching. See `src/agent/compliance/`.

### Demographic Fairness Audit
For every case, the agent re-runs the decision with a swapped demographic profile (different name, different language, same financials). If the outcome differs, the decision is flagged as biased and blocked. See `src/agent/fairness/`.

### Full Explainability
Every case stores a reasoning chain (step-by-step thoughts), unstructured sources referenced, alternatives considered, and a full audit envelope. Nothing is a black box.

### Dark / Light Mode
Toggle in the top-right corner. Light is the default.

---

## Project Structure

```
src/
├── agent/              # AI agent pipeline
│   ├── runner.ts       # Full pipeline orchestrator
│   ├── compliance/     # German tenancy law rules
│   ├── fairness/       # Bias detection + counterfactual
│   ├── prompts/        # System prompts + tool schemas
│   └── types/          # Zod schemas for agent I/O
├── app/                # Next.js App Router pages + API routes
│   ├── page.tsx        # Dashboard (case list)
│   ├── cases/[id]/     # Case detail page
│   └── api/            # Stripe webhooks, cron, agent endpoints
├── components/         # React components
├── db/                 # Drizzle schema + client
├── lib/                # Shared utilities (env, auth)
└── stripe/             # Stripe event handlers
```

---

## Team

- **Mohamed Ayari** — [@mofach90](https://github.com/mofach90)
- **Aymen Soussi** — [@Aymen-Soussi](https://github.com/Aymen-Soussi)

## Hackathon

- **Event:** hallo theo Applied AI Hackathon, Berlin
- **Track:** Stripe — Autonomous Payment Operations
- **Date:** 23–24 May 2026
