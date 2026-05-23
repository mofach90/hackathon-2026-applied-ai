# Development Guide

> This is the **single conventions reference** for RentPilot AI. ADRs in
> `docs/adr/` capture *load-bearing decisions*; this file captures the
> *working conventions* every contributor and AI agent must follow.

When you (a future contributor or AI agent) start a session on this repo:

1. Read `docs/project.md` first — the product north star.
2. Skim `docs/adr/` — the load-bearing technical decisions.
3. Read this file — the daily working rules.

If you find a convention that contradicts an ADR, the **ADR wins**. File a PR
fixing this doc.

---

## Table of contents

- [Quick start](#quick-start)
- [Git workflow](#git-workflow)
- [Commit conventions](#commit-conventions)
- [Branching strategy](#branching-strategy)
- [Folder structure](#folder-structure)
- [Code style & lint](#code-style--lint)
- [TypeScript discipline](#typescript-discipline)
- [Money & time handling](#money--time-handling)
- [PII redaction in practice](#pii-redaction-in-practice)
- [Error handling patterns](#error-handling-patterns)
- [Data seeding](#data-seeding)
- [Demo reset](#demo-reset)
- [Mocked auth](#mocked-auth)
- [Prompt versioning](#prompt-versioning)
- [Observability](#observability)
- [Rehearsal checklist](#rehearsal-checklist)

---

## Quick start

```bash
# clone, then
pnpm install
cp .env.example .env.local        # fill in secrets — see ADR-0009
pnpm db:push                       # apply schema to Supabase
pnpm db:seed                       # seed demo data
pnpm stripe:seed                   # create Express test accounts
pnpm dev                           # http://localhost:3000

# in another terminal:
pnpm stripe:listen                 # forward Stripe webhooks to localhost
```

---

## Issue claiming protocol (AI agents and humans)

**Before touching any code**, you must claim the issue you intend to work on. This prevents two agents or developers from duplicating work on the same ticket.

### Mandatory steps — in order, before writing a single line of code

```bash
# 1. Assign the issue to yourself on GitHub
gh issue edit <N> --add-assignee @me

# 2. Add the in-progress label
gh issue edit <N> --add-label "in-progress"

# 3. Create and immediately push the branch (even if empty)
git checkout -b feat/<short-description>
git push -u origin feat/<short-description>
```

Do all three steps **atomically** before starting. The pushed branch + label + assignee are the canonical signals another agent will check.

### Before picking an issue, always check it is free

```bash
# List only open, unassigned, not-in-progress issues
gh issue list --state open --label "" | grep -v "in-progress"

# Or check a specific issue
gh issue view <N>   # look for assignees and labels
```

If the issue already has an assignee **or** has the `in-progress` label, **skip it and pick another one.**

### When you finish

```bash
# Open the PR — this also signals the issue is in review
gh pr create --title "feat(...): ..." --body "Closes #<N>"

# Remove the in-progress label once the PR is open
gh issue edit <N> --remove-label "in-progress"
```

### Rule summary

| State | Assignee | Labels | Branch pushed? | Meaning |
|---|---|---|---|---|
| Free | none | no `in-progress` | no | Safe to claim |
| Claimed | you | `in-progress` | yes | Being worked on — do not touch |
| In review | you | no `in-progress` | yes (PR open) | Awaiting merge |

---

## Git workflow

- `main` is always green and always deployable.
- All changes land via pull request. **No direct push to `main`.**
- 1 approval required (the other team member).
- PR must pass CI (typecheck + lint + test) and the Vercel preview must build.
- Squash-merge to `main`. Squashing keeps `main`'s history clean and gives PR-granular commits to revert.
- Delete the branch after merge.

### Quick rules

- Don't merge your own PR without a review. Ask explicitly if needed.
- If you must hot-fix `main` directly (last 30 min before submission, no reviewer awake), say so in the commit body.
- Never `git push --force` to `main`. To `--force-with-lease` to your own branch only.

---

## Commit conventions

We use **Conventional Commits**. This is what the squash-merge commit looks like — make your PR title match:

```
<type>(<scope>): <subject>
```

| Type | When |
|---|---|
| `feat` | New user-visible feature |
| `fix` | Bug fix |
| `refactor` | Code restructure, no behavior change |
| `perf` | Performance work |
| `docs` | Docs only (project.md, ADRs, this file, README) |
| `test` | Tests only |
| `chore` | Tooling, lockfile bumps, config |
| `style` | Formatting, lint fixes |
| `ci` | CI config changes |

### Scopes we use

`agent`, `stripe`, `db`, `ui`, `compliance`, `fairness`, `webhook`, `cron`, `seed`, `docs`, `infra`, `auth`.

### Examples

```
feat(agent): emit alternatives_considered in AgentResponse
fix(stripe): reject webhooks without stripe-signature header
docs(adr): add ADR-0012 webhook handling
refactor(compliance): split rule_checks into pure functions
chore(deps): bump @anthropic-ai/sdk to 0.42.0
```

Body is optional. Use it for the **why**, not the **what**.

---

## Branching strategy

- **Trunk-based.** `main` is the trunk.
- Branches off `main`, named `<type>/<short-kebab-title>`:
  - `feat/agent-decision-envelope`
  - `fix/webhook-signature-leak`
  - `docs/adr-0006-stack`
- Keep branches **short-lived** (< 4 hours when possible). Stale branches get nasty merge conflicts.
- Rebase your branch onto `main` before opening the PR for review (`git rebase origin/main`).

### When to break the rules

Submission-day fire-fighting: anything goes. Just make the code work, comment what you did, and we clean up after the demo.

---

## Folder structure

```
.
├── README.md                       # Entry point. Brief. Points at docs/project.md.
├── DEVELOPMENT.md                  # This file.
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── drizzle.config.ts
├── vitest.config.ts
├── vercel.json                     # Vercel cron + region config
├── .env.example                    # Documented env vars (no secrets!)
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── project.md                  # Source of truth.
│   ├── adr/                        # Architecture Decision Records (this folder = decisions).
│   └── brainstorm/                 # Brainstorm sessions and exploration.
├── scripts/
│   ├── seed-stripe.ts              # Create test Connect accounts
│   └── db-reset.ts                 # Drop + recreate dev DB
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (tenant)/               # Tenant-facing pages
│   │   ├── (landlord)/             # Landlord dashboard
│   │   ├── api/                    # Route handlers (webhook, cron)
│   │   └── layout.tsx
│   ├── agent/                      # Agent orchestrator
│   │   ├── types.ts                # AgentAction, AgentResponse, etc.
│   │   ├── prompt.ts               # System prompts (versioned strings)
│   │   ├── client.ts               # Anthropic SDK + model pins
│   │   ├── runner.ts               # Decision LLM call
│   │   ├── compliance.ts           # validateCompliance + rule checks
│   │   ├── fairness.ts             # validateFairness + counterfactual
│   │   ├── redactor.ts             # PII redaction
│   │   ├── context.ts              # Context builder + sanitizer
│   │   ├── dispatch.ts             # Action → Stripe/email side-effects
│   │   └── orchestrator.ts         # decideAndExecute with retry budget
│   ├── stripe/
│   │   ├── client.ts
│   │   ├── customers.ts
│   │   ├── connect.ts
│   │   ├── invoices.ts
│   │   ├── transfers.ts
│   │   └── webhook-dispatcher.ts
│   ├── db/
│   │   ├── schema.ts
│   │   ├── client.ts
│   │   └── seed.ts
│   ├── lib/
│   │   ├── money.ts                # eurToCents, centsToEur, formatEur, applyFeePct
│   │   ├── time.ts                 # nowInBerlin, isContactHours, daysBetween
│   │   ├── ids.ts                  # UUID generation
│   │   └── log.ts                  # structured logger
│   ├── components/
│   │   └── ui/                     # shadcn/ui generated
│   └── styles/
│       └── globals.css
└── tests/
    └── e2e/
        └── demo-flow.spec.ts       # Playwright E2E smoke
```

### Module rules

- **No reach-arounds.** `src/agent/*` does not import from `src/app/*`. Server-side code does not import client-only modules. Use `import "server-only"` at the top of server-only modules.
- **`src/lib/*` is leaf.** It can be imported by anything, but it imports nothing from `src/agent`, `src/stripe`, `src/db`, `src/app`.
- **`src/agent/dispatch.ts` is the ONLY file** that imports both Stripe adapter and email/SMS adapter. This is intentional — it's the action seam.
- **DB schema imports go through `@/db/schema`.** Drizzle types flow from here; do not duplicate type definitions.

---

## Code style & lint

- **Prettier** for formatting. Default config. Run `pnpm format` before commit (or set up the VS Code Prettier extension to format on save).
- **ESLint** with `eslint-config-next` + a small custom rule set. Warnings are errors in CI (`--max-warnings=0`).
- **Imports sorted** by Prettier plugin (external → internal → relative).
- **2-space indent**, single quotes, trailing comma on multiline.
- **No semicolons** is tempting but we use them — TypeScript/Next default.
- **`async/await`**, not `.then()`. Mixing is confusing.

---

## TypeScript discipline

- `strict: true`. No `any` without a `// eslint-disable-next-line` comment with a reason.
- Use `unknown` instead of `any` when receiving untyped input. Narrow with Zod or a manual type guard.
- All exported functions get an explicit return type.
- `null` is preferred over `undefined` for "no value" in DB columns. `undefined` is for "field not present" in TypeScript.
- Discriminated unions over `if/else` branches. Use `never` exhaustiveness checks:
  ```ts
  function dispatch(action: AgentAction): void {
    switch (action.kind) {
      case "soft_nudge": return doSoftNudge(action);
      case "friendly_check_in": return doFriendlyCheckIn(action);
      // ...
      default:
        const _exhaustive: never = action;
        throw new Error(`unhandled action kind: ${(_exhaustive as any).kind}`);
    }
  }
  ```

---

## Money & time handling

**Two rules. Memorize them.**

### Money

- **All monetary amounts are stored and passed around as integer cents.** Never floats.
- `1200.00 EUR` is `120000`. `0.99 EUR` is `99`.
- Use the helpers in `src/lib/money.ts`:
  ```ts
  eurToCents(1200)           // 120000
  centsToEur(120000)         // 1200
  formatEur(120000)          // "€1,200.00"
  applyFeePct(120000, 800)   // { fee: 9600, net: 110400 }   // 800 bps = 8%
  ```
- Fee percentages are **basis points** (1 bp = 0.01%, 100 bps = 1%, 800 bps = 8%) in the DB. This keeps fee math integer-only.
- **Never** do `amount * 100` or `amount / 100` inline. Use the helpers.

### Time

- **Storage is always UTC.** All `timestamp` columns are `timestamp with time zone` (Drizzle: `{ withTimezone: true }`). DB writes go in as UTC.
- **Display is Europe/Berlin** for the property manager and tenants. Convert at the UI layer.
- Use the helpers in `src/lib/time.ts`:
  ```ts
  nowInBerlin()                                  // Date instance
  isContactHours(date)                           // bool, against policy
  daysBetween(date1, date2)                      // calendar days, not 24h windows
  toUnixTimestamp(date)                          // for Stripe `due_date` etc.
  ```
- Dates in JSON / agent envelopes are ISO 8601 (`2026-06-06T09:14:22Z`).
- Don't use `Date.now()` for "today" — use `nowInBerlin()`.

---

## PII redaction in practice

See ADR-0005 for the why. The **how** is:

1. **All raw unstructured data** (support chats, email threads, SMS) must pass through `redactor.ts` before reaching the decision LLM.
2. **Regex pass first** — fast, catches obvious cases (capitalized names, IBANs, phone numbers, emails).
3. **Claude (Haiku) pass second** — catches what regex misses.
4. Resulting excerpts use placeholders: `[REDACTED-NAME]`, `[REDACTED-LOC]`, `[REDACTED-EMPLOYER]`, `[REDACTED-PHONE]`, `[REDACTED-EMAIL]`, `[REDACTED-IBAN]`.
5. **Cap input length** — truncate to 2000 chars per excerpt to control cost.
6. **Salience scoring** — the context builder ranks excerpts and we send only the top 5 to the decision LLM.

### Where redaction lives

```ts
// src/agent/redactor.ts
export async function redactPII(item: UnstructuredItem): Promise<UnstructuredItem> {
  const truncated = item.excerpt.slice(0, 2000);
  const r1 = regexRedact(truncated);
  const r2 = await llmRedact(r1);
  return { ...item, excerpt: r2 };
}
```

**Never** call the decision LLM with un-redacted unstructured input. This is the single most important fairness invariant.

---

## Error handling patterns

- **Throw at the boundary, catch at the top.** Internal code throws plain `Error` (or domain-specific subclasses); only the API route handler / webhook handler catches.
- **Stripe API errors** are caught and converted to internal errors with the Stripe error code preserved in `cause`.
- **Agent retry budget:** see ADR-0004. After 3 attempts hitting compliance/fairness blocks → `escalate_human`. After 3 attempts hitting Claude API errors → log + escalate.
- **Idempotency keys** on every outbound Stripe call: see ADR-0012.
- **Webhook handlers** that fail return `500`; Stripe retries. They must be **idempotent** so retries are safe (see ADR-0012).
- **Database transactions** for any multi-write action that must be atomic (e.g. mark invoice paid + complete plan).

### Error logging

```ts
import { log } from "@/lib/log";

try {
  await stripe.transfers.create(...);
} catch (err) {
  log.error("stripe.transfer.failed", {
    case_id, vendor_id, amount_eur_cents, err: serializeError(err),
  });
  throw new TransferFailedError("vendor payout failed", { cause: err });
}
```

Logs go to Vercel's stdout collector. Don't log PII; do log IDs.

---

## Data seeding

`pnpm db:seed` populates the demo from `src/db/seed.ts`. It creates:

- **3 landlords** with Express Connect accounts
- **6 properties** across the 3 landlords
- **3 demo tenants** with full personas — Amina, Mike, Sara
- **History** for each tenant (24 months of `rent_obligation` rows for Amina, 8 for Mike, 1 for Sara)
- **Unstructured sources** for each tenant (mock support chats, email threads)
- **2 vendors** with Connect accounts
- **1 open work order** + **1 received vendor invoice** (ready for the demo)

### Seed determinism

- IDs are deterministic (hashes of slugs) so the same seed run produces the same UUIDs — useful for screenshots & rehearsals.
- `created_at` timestamps are anchored relative to `nowInBerlin()` so the history is always "as of today."

### Re-seeding

`pnpm db:seed` is **idempotent** — running it twice is a no-op for existing rows. To wipe and re-seed, use `pnpm demo:reset`.

---

## Demo reset

Between rehearsals you want a clean slate.

```bash
pnpm demo:reset
```

This runs (see `package.json`):

1. `pnpm db:reset` — drops + recreates all tables
2. `pnpm db:seed` — re-seeds the demo data
3. `pnpm stripe:seed` — recreates test Connect accounts (idempotent: skips if account already exists with the same email)

### When to reset

- Before recording the Loom
- Before the live pitch
- If the agent did something weird mid-rehearsal and the state is now contaminated
- After any schema change

### What demo reset does NOT touch

- `processed_webhook` table is **kept** so re-running the same Stripe replay doesn't double-fire
- Stripe test-mode balance is **kept** (no API for resetting; just add funds via dashboard)

---

## Mocked auth

For the hackathon demo, **auth is mocked**. There is one "property manager" who can see everything. There is no login screen.

- The `landlord` table has a `mgr_user_id` column that's hard-coded to `"demo_manager"` for all landlords in seed data.
- Server actions check `getCurrentUser() === "demo_manager"` and proceed.
- Tenant-facing pages are accessed via a magic link in seed-generated URLs — no password.

Production would replace this with Clerk / Supabase Auth / NextAuth. This is documented as a known gap in `docs/project.md` MVP "out of scope."

---

## Prompt versioning

Per ADR-0008, each LLM call has a `prompt_version` string stored in `agent_case.audit.prompt_version`.

### Convention

- Format: `<role>_v<N>` — e.g. `agent_decision_v1`, `redactor_v2`, `renderer_v1`
- Bump `v1 → v2` when the prompt changes in a way that could affect output (most changes do)
- Old `agent_case` rows keep their old version — never retroactively rewrite
- Optional: dump the prompt text into `docs/prompts/<version>.md` for git history beyond the `prompt.ts` file blame

### When you change a prompt

1. Bump the version constant in `src/agent/client.ts`
2. Update the prompt text in `src/agent/prompt.ts`
3. (Optional) Snapshot to `docs/prompts/agent_decision_v2.md`
4. Commit: `feat(agent): bump decision prompt to v2 — add unstructured-source emphasis`

---

## Observability

Hackathon-grade. Production would be richer.

- **Logs:** stdout/stderr go to Vercel logs. Use the structured logger in `src/lib/log.ts`:
  ```ts
  log.info("agent.decided", { case_id, action_kind, confidence });
  log.warn("compliance.blocked", { case_id, rule_id });
  log.error("stripe.api.failed", { call, err: serializeError(err) });
  ```
- **Audit log:** the `agent_case` table is the auditable record. Query it from Supabase SQL editor during the demo if needed.
- **Error tracking:** none. Hackathon. Logs + the team eyeballing the demo are enough.
- **Metrics:** none. We don't have time.

### Useful queries during the demo

```sql
-- Last 10 agent decisions
select created_at, decision->>'kind', compliance_check->>'status'
from agent_case order by created_at desc limit 10;

-- All blocked actions
select decision->>'kind', compliance_check->'rules_checked'
from agent_case where compliance_check->>'status' = 'fail';

-- Active payment plans
select tenant_id, installments, status
from payment_plan where status = 'active';
```

---

## Rehearsal checklist

Run this **before recording the Loom** and **before the live pitch**:

- [ ] `pnpm demo:reset` — fresh state
- [ ] Stripe test balance ≥ €10,000 (Dashboard → Balance → Add to balance)
- [ ] Webhook URL registered in Stripe Dashboard (production webhook secret matches Vercel env)
- [ ] `pnpm dev` running locally OR Vercel preview is green
- [ ] Open the landlord dashboard — headline metrics show
- [ ] Click into Amina — reasoning chain renders, compliance + fairness badges show ✅
- [ ] Run counterfactual on Amina — reasoning chains match
- [ ] Click into Mike — reasoning chain shows enforcement
- [ ] Vendor flow — invoice marked paid after transfer
- [ ] Landlord disbursement — net rent transferred, statement generated
- [ ] Loom recording: screen + face cam tested, audio levels good
- [ ] GitHub repo: `README.md` and `docs/project.md` polished, no embarrassing TODOs

---

## When in doubt

- Check the ADRs in `docs/adr/` — they cover *why*
- Check the brainstorms in `docs/brainstorm/` — they cover *how we arrived at this*
- Ask the other team member before doing something that contradicts any of the above
- For AI agents: do not silently break a documented convention; raise it as a question first
