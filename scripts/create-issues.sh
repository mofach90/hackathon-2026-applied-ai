#!/usr/bin/env bash
# RentPilot AI — GitHub issue creation
# Creates 30 issues matching docs/plan.md tickets #01–#30.
# Idempotent: skips issues whose exact title already exists in the repo.
# Usage:
#   bash scripts/setup-labels.sh   # first time only
#   bash scripts/create-issues.sh
#
# Implementation note: each issue body is loaded into a variable via
# `read -r -d ''` (with `|| true` to absorb its always-1 exit code). This
# avoids a known bash 3.2 parser bug with apostrophes inside `$(cat <<EOF)`
# command substitution — relevant because macOS still ships bash 3.2.

set -euo pipefail

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh CLI not authenticated. Run \`gh auth login\` first." >&2
  exit 1
fi

REPO="$(gh repo view --json owner,name -q '.owner.login + "/" + .name')"
echo "Creating RentPilot AI issues in $REPO"
echo ""

# Pre-fetch all existing issue titles once (fast idempotency check).
EXISTING_TITLES="$(gh issue list --state all --limit 200 --json title -q '.[].title' || true)"

create_issue() {
  local title="$1"
  local labels="$2"
  local body="$3"

  if printf '%s\n' "$EXISTING_TITLES" | grep -Fxq -- "$title"; then
    echo "  ·  SKIP    $title"
    return
  fi

  gh issue create --title "$title" --label "$labels" --body "$body" >/dev/null
  echo "  +  CREATE  $title"
}

# ───────────────────────────────────────────────────────────────────
# PHASE 0 — Bootstrap
# ───────────────────────────────────────────────────────────────────

IFS='' read -r -d '' TICKET_01 <<'EOF' || true
**Phase:** 0 — Bootstrap
**Depends on:** —
**Blocks:** all others (this ticket unblocks everything)
**Est. time:** ~25 min
**ADR refs:** ADR-0006 (Application Stack)

## Scope

Initialize Next.js 15 with App Router, TypeScript strict, Tailwind v4, and the folder layout from `DEVELOPMENT.md`. Install only the runtime + dev deps that are *always* needed (zod, date-fns, clsx, tailwind-merge). Heavier SDKs land in #04.

## Files to touch

- `package.json`, `pnpm-lock.yaml` (new)
- `tsconfig.json` — `strict: true`, `noUncheckedIndexedAccess: true`
- `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`
- `src/app/layout.tsx`, `src/app/page.tsx` (placeholder), `src/app/globals.css`
- `src/agent/`, `src/stripe/`, `src/db/`, `src/lib/`, `src/components/`, `scripts/`, `tests/e2e/` — empty dirs with `.gitkeep`

## Acceptance criteria

- [ ] `pnpm install` succeeds, no warnings
- [ ] `pnpm dev` boots; `http://localhost:3000` renders placeholder
- [ ] `pnpm typecheck` (= `tsc --noEmit`) passes
- [ ] `tsconfig.json` has `strict` + `noUncheckedIndexedAccess` enabled
- [ ] Folder layout matches `DEVELOPMENT.md`
- [ ] `engines.node` in `package.json` is `>=22`

## Implementation notes

- `pnpm create next-app@latest rentpilot --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --no-turbopack`. ESLint comes in #03.
- Do NOT install Stripe / Anthropic / Drizzle here — that's #04 so failures isolate.
- Add to deps: `zod`, `date-fns`, `date-fns-tz`, `clsx`, `tailwind-merge`.

---

_From `docs/plan.md` ticket #01. See `docs/plan.md` for the full dependency graph and phase context._
EOF
create_issue "#01 — Scaffold Next.js 15 + base deps" "phase-0,area:infra,priority:critical-path" "$TICKET_01"

IFS='' read -r -d '' TICKET_02 <<'EOF' || true
**Phase:** 0 — Bootstrap
**Depends on:** #01
**Blocks:** #04
**Est. time:** ~20 min
**ADR refs:** ADR-0009 (Hosting), `DEVELOPMENT.md` (env discipline)

## Scope

Define the env schema with zod so every required var is validated at boot. Provide `.env.example` listing all keys. Mis-configuration must fail loudly on first import, not silently at runtime.

## Files to touch

- `src/lib/env.ts` (new)
- `.env.example` (new)
- `.gitignore` — ensure `.env.local`, `.env*.local` are ignored

## Acceptance criteria

- [ ] `src/lib/env.ts` exports a frozen, typed `env` object
- [ ] Missing required vars throw with a clear message at module-load time
- [ ] `.env.example` lists: `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_LANDLORD_PLATFORM_FEE_BPS`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_APP_URL`
- [ ] `pnpm typecheck` passes

## Implementation notes

- Schema with `z.object({ ... })` then `.parse(process.env)`. Server-only keys must NOT be `NEXT_PUBLIC_*`.
- Use `z.coerce.number()` for `STRIPE_CONNECT_LANDLORD_PLATFORM_FEE_BPS` (basis points integer).
- Throw on parse failure — do not provide fallbacks except for `NEXT_PUBLIC_APP_URL` which defaults to `http://localhost:3000`.

---

_From `docs/plan.md` ticket #02._
EOF
create_issue "#02 — Env config + zod validation" "phase-0,area:infra,priority:critical-path" "$TICKET_02"

IFS='' read -r -d '' TICKET_03 <<'EOF' || true
**Phase:** 0 — Bootstrap
**Depends on:** #01
**Blocks:** every PR (CI gate)
**Est. time:** ~25 min
**ADR refs:** ADR-0010 (CI/CD), ADR-0011 (Testing)

## Scope

Wire ESLint (`--max-warnings=0`), Prettier, and a GitHub Actions workflow that runs typecheck + lint + test on PR and push to `main`. Also add the `pnpm` scripts from ADR-0010.

## Files to touch

- `eslint.config.mjs` (new — flat config)
- `.prettierrc`, `.prettierignore` (new)
- `.github/workflows/ci.yml` (new)
- `package.json` — add scripts (`typecheck`, `lint`, `format`, `format:check`, `test`, `test:ci`)
- `vitest.config.ts` (new — minimal; tests come per-feature)

## Acceptance criteria

- [ ] `pnpm lint` passes with `--max-warnings=0`
- [ ] `pnpm format:check` passes
- [ ] `pnpm test:ci` passes (zero tests is OK at this stage)
- [ ] GitHub Actions workflow runs on PR + push to `main`
- [ ] typecheck, lint, test appear as separate CI steps

## Implementation notes

- ESLint flat config: `next/core-web-vitals` + `@typescript-eslint` strict + Prettier integration.
- CI workflow content — copy verbatim from ADR-0010 § Implementation notes.
- Add `concurrency` block to cancel stale PR runs.
- Branch protection rules are configured manually in the GitHub UI (not in this ticket) — note in PR body that the user should enable them.

---

_From `docs/plan.md` ticket #03._
EOF
create_issue "#03 — ESLint + Prettier + GitHub Actions CI" "phase-0,area:infra" "$TICKET_03"

IFS='' read -r -d '' TICKET_04 <<'EOF' || true
**Phase:** 0 — Bootstrap
**Depends on:** #02
**Blocks:** Phases 3, 5, 6, 7
**Est. time:** ~30 min
**ADR refs:** ADR-0002 (Stripe Connect mode), ADR-0007 (Database + ORM), ADR-0008 (AI runtime + prompt versioning)

## Scope

Install Stripe SDK, Anthropic SDK, Drizzle ORM + drizzle-kit + postgres driver. Create thin module-level clients for each, wired to `env`. Three Anthropic clients (decision / redactor / renderer) so model pinning is centralized.

## Files to touch

- `package.json` — add deps: `stripe`, `@anthropic-ai/sdk`, `drizzle-orm`, `drizzle-kit`, `postgres`
- `src/stripe/client.ts` (new — exports `stripe`)
- `src/agent/llm.ts` (new — exports `decisionClient`, `redactorClient`, `rendererClient`, with model IDs pinned)
- `src/db/client.ts` (new — exports `db`)
- `drizzle.config.ts` (new)

## Acceptance criteria

- [ ] `import { stripe } from "@/stripe/client"` works; client uses `env.STRIPE_SECRET_KEY`
- [ ] Three Anthropic clients exported; models pinned to `claude-opus-4-7` (decision) and `claude-haiku-4-5-20251001` (redactor + renderer) per ADR-0008
- [ ] Drizzle client connects to `env.DATABASE_URL`
- [ ] `pnpm typecheck` + `pnpm lint` pass
- [ ] No code paths actually call these clients yet — just exports

## Implementation notes

- Stripe client: `new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-04-30.basil" })` — pin the version.
- Anthropic clients: each is `new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })`, then a thin wrapper that locks the `model` field. Decision client sets `max_tokens` higher (e.g. 4096) — see ADR-0008.
- Drizzle: use `postgres-js` driver with prepared statements disabled (Supabase pgBouncer compat).

---

_From `docs/plan.md` ticket #04._
EOF
create_issue "#04 — SDK clients: Stripe, Anthropic (×3), Drizzle" "phase-0,area:infra,priority:critical-path" "$TICKET_04"

# ───────────────────────────────────────────────────────────────────
# PHASE 1 — Type contracts
# ───────────────────────────────────────────────────────────────────

IFS='' read -r -d '' TICKET_05 <<'EOF' || true
**Phase:** 1 — Type contracts
**Depends on:** #04
**Blocks:** Phase 4, 5, 8
**Est. time:** ~25 min
**ADR refs:** ADR-0001 (Agent Decision Space), `docs/brainstorm/2026-05-23-decision-space.md`

## Scope

Define the 8-variant `AgentAction` discriminated union and the `AgentResponse` envelope (with `unstructured_sources`, `compliance_check`, `fairness_check` fields). Zod schemas + inferred TS types. These are the contract every other layer depends on.

## Files to touch

- `src/agent/types/actions.ts` (new)
- `src/agent/types/response.ts` (new)
- `src/agent/types/index.ts` (new — barrel)
- `src/agent/types/__tests__/response.test.ts` (new — parse known-good fixture, reject known-bad one)

## Acceptance criteria

- [ ] All 8 actions present: `soft_nudge`, `friendly_check_in`, `plan_negotiation`, `late_fee_warning`, `formal_notice`, `escalate_human`, `auto_payout_vendor`, `auto_disburse_landlord` (exact names per ADR-0001)
- [ ] Each variant has a `kind` literal field + its specific payload
- [ ] `AgentResponse` envelope includes: `case_id`, `action`, `confidence`, `reasoning_summary`, `unstructured_sources`, `compliance_check`, `fairness_check`
- [ ] One Vitest test validates a known-good envelope, one rejects malformed
- [ ] `pnpm typecheck` passes

## Implementation notes

- Use `z.discriminatedUnion("kind", [ ... ])`.
- `confidence` is `z.number().min(0).max(1)`.
- `unstructured_sources` is `z.array(z.object({ source: z.string(), excerpt: z.string(), weight: z.number() }))` — see brainstorm doc for full shape.
- Do NOT define ComplianceCheck/FairnessCheck here — that's #06. Use `z.unknown()` placeholders that #06 replaces.

---

_From `docs/plan.md` ticket #05._
EOF
create_issue "#05 — Shared types: AgentAction + AgentResponse" "phase-1,area:agent" "$TICKET_05"

IFS='' read -r -d '' TICKET_06 <<'EOF' || true
**Phase:** 1 — Type contracts
**Depends on:** #05
**Blocks:** Phase 4, 5
**Est. time:** ~25 min
**ADR refs:** ADR-0004 (Compliance), ADR-0005 (Bias defense)

## Scope

Define `ComplianceCheck`, `ComplianceResult`, `FairnessCheck`, `FairnessResult`, `AgentContext` (input shape for the agent — case, history, persona, current event). Wire these into the `AgentResponse` envelope from #05 (replacing the `z.unknown()` placeholders).

## Files to touch

- `src/agent/types/compliance.ts` (new)
- `src/agent/types/fairness.ts` (new)
- `src/agent/types/context.ts` (new)
- `src/agent/types/response.ts` (modify — replace `z.unknown()` placeholders)
- `src/agent/types/index.ts` (modify — export new types)

## Acceptance criteria

- [ ] `ComplianceResult` has `rule_id`, `result` (`"pass" | "fail" | "n/a"`), `reason`
- [ ] `ComplianceCheck` is `{ overall: "pass" | "fail", results: ComplianceResult[] }`
- [ ] `FairnessCheck` includes `forbidden_keywords_present: boolean`, `counterfactual_agreed: boolean | null` (null = not run), `overall: "pass" | "fail"`
- [ ] `AgentContext` covers: `case`, `tenant_history`, `current_event`, `unstructured_inputs`
- [ ] `pnpm typecheck` passes; no `any` types

## Implementation notes

- Rule IDs match ADR-0004 verbatim: `verzug_grace`, `mahnung_spacing`, `late_fee_cap`, `contact_hours`, `language_match`.
- `unstructured_inputs` in `AgentContext` is an array of `{ source: string; content: string }` — raw strings the agent will read.

---

_From `docs/plan.md` ticket #06._
EOF
create_issue "#06 — Shared types: Compliance + Fairness + Context" "phase-1,area:agent,priority:critical-path" "$TICKET_06"

# ───────────────────────────────────────────────────────────────────
# PHASE 2 — Foundational utils
# ───────────────────────────────────────────────────────────────────

IFS='' read -r -d '' TICKET_07 <<'EOF' || true
**Phase:** 2 — Foundational utils
**Depends on:** #04
**Blocks:** Phase 4, 6
**Est. time:** ~35 min
**ADR refs:** `DEVELOPMENT.md` (money + time discipline), ADR-0011 (Testing)

## Scope

Implement `eurToCents`, `centsToEur`, `formatEur`, `applyFeePct` (basis-points-based) plus `isContactHours` (Europe/Berlin 08:00–20:00), `daysBetween`, `formatBerlin`. Comprehensive Vitest tests — money & time are the silent demo killers.

## Files to touch

- `src/lib/money.ts` (new)
- `src/lib/time.ts` (new)
- `src/lib/__tests__/money.test.ts` (new)
- `src/lib/__tests__/time.test.ts` (new)

## Acceptance criteria

- [ ] `eurToCents(1199.995) === 120000` (rounds; never floors)
- [ ] `eurToCents(-1)` throws
- [ ] `applyFeePct(120000, 800)` returns `{ fee: 9600, net: 110400 }` (800 bps = 8%)
- [ ] `isContactHours(new Date("2026-06-06T19:00:00Z"))` → false (21:00 Berlin CEST)
- [ ] `isContactHours(new Date("2026-06-06T08:00:00Z"))` → true (10:00 Berlin)
- [ ] `daysBetween` respects calendar days, not 24h windows
- [ ] All tests pass via `pnpm test:ci`

## Implementation notes

- Money: integer cents in/out. Use `Math.round`. Reject negatives at boundary.
- Time: store/compute in UTC, convert with `date-fns-tz`'s `formatInTimeZone` to `Europe/Berlin` for display.
- Use exact test cases from ADR-0011 § Implementation notes.

---

_From `docs/plan.md` ticket #07._
EOF
create_issue "#07 — Money + time utils + tests" "phase-2,area:infra" "$TICKET_07"

IFS='' read -r -d '' TICKET_08 <<'EOF' || true
**Phase:** 2 — Foundational utils
**Depends on:** #04
**Blocks:** #09, Phase 5
**Est. time:** ~30 min
**ADR refs:** ADR-0005 (Bias defense, layer 1)

## Scope

First-pass redaction over user-supplied text: names (lookup), IBAN, phone, email. Output replaces matches with `[REDACTED-NAME]`, `[REDACTED-IBAN]`, etc. Pure function — no LLM call (that's #09).

## Files to touch

- `src/agent/redactor/regex.ts` (new — exports `regexRedact`)
- `src/agent/redactor/names.ts` (new — seed list of tenant names from `docs/project.md` personas)
- `src/agent/redactor/__tests__/regex.test.ts` (new)

## Acceptance criteria

- [ ] `regexRedact("Amina Benali called")` contains `[REDACTED-NAME]`
- [ ] IBAN like `DE89370400440532013000` → `[REDACTED-IBAN]`
- [ ] Phone `+49 30 12345678` → `[REDACTED-PHONE]`
- [ ] Email `foo@bar.de` → `[REDACTED-EMAIL]`
- [ ] Doesn't mangle non-PII text (property addresses pass through)
- [ ] Tests for each pattern + a combined-input test

## Implementation notes

- IBAN regex: `/\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/` (DE-focused but tolerant).
- Phone regex: international + German formats. Don't over-match dates or postal codes — test for false positives.
- Name list: load from `src/agent/redactor/names.ts` const array. Match whole-words, case-insensitive.

---

_From `docs/plan.md` ticket #08._
EOF
create_issue "#08 — PII redactor (regex layer)" "phase-2,area:agent" "$TICKET_08"

IFS='' read -r -d '' TICKET_09 <<'EOF' || true
**Phase:** 2 — Foundational utils
**Depends on:** #08
**Blocks:** Phase 5
**Est. time:** ~25 min
**ADR refs:** ADR-0005 (Bias defense, layer 1), ADR-0008 (AI runtime)

## Scope

Second-pass redactor: takes regex-redacted output and asks Claude Haiku (via the `redactorClient` from #04) to catch anything missed. Defensive — if the API call fails, return the regex-only output unchanged.

## Files to touch

- `src/agent/redactor/haiku.ts` (new — exports `haikuRedact`)
- `src/agent/redactor/index.ts` (new — exports `redactPII` = regex + haiku composed)
- `src/agent/redactor/__tests__/haiku.test.ts` (new — mocked client)

## Acceptance criteria

- [ ] `redactPII(text)` runs regex first, then Haiku
- [ ] If Haiku call throws/times out, return regex output (log warning)
- [ ] System prompt to Haiku is short, deterministic, asks ONLY for redaction (no summarization, no commentary)
- [ ] Test mocks the client and verifies the prompt content
- [ ] `pnpm typecheck` + tests pass

## Implementation notes

- Haiku call: temperature=0, max_tokens=2048, single system + single user message.
- System prompt content: see ADR-0005 § Implementation notes.
- Timeout: 5s. Use `AbortController`.

---

_From `docs/plan.md` ticket #09._
EOF
create_issue "#09 — PII redactor (Claude Haiku pass)" "phase-2,area:agent" "$TICKET_09"

# ───────────────────────────────────────────────────────────────────
# PHASE 3 — Database + seed
# ───────────────────────────────────────────────────────────────────

IFS='' read -r -d '' TICKET_10 <<'EOF' || true
**Phase:** 3 — Database
**Depends on:** #04
**Blocks:** #11, #12, Phase 5, 6, 7
**Est. time:** ~40 min
**ADR refs:** ADR-0007 (Database + ORM)

## Scope

Define the 11-table schema in Drizzle: `landlord`, `property`, `tenant`, `vendor`, `work_order`, `vendor_invoice`, `rent_obligation`, `payment_plan`, `agent_case`, `disbursement`, `escalation`, `processed_webhook`. Wire `drizzle-kit push` for dev. **No data yet** — that's #11/#12.

## Files to touch

- `src/db/schema.ts` (new — all 11 tables)
- `drizzle.config.ts` (modify — point at schema.ts)
- `package.json` — add scripts: `db:push`, `db:generate`

## Acceptance criteria

- [ ] All 11 tables defined, matching ADR-0007 verbatim (column names, types, FKs)
- [ ] JSONB columns: `agent_case.unstructured_sources`, `agent_case.compliance_check`, `agent_case.fairness_check`, `payment_plan.installments`
- [ ] All FKs declared
- [ ] `pnpm db:push` runs against a fresh Supabase DB and exits 0
- [ ] `pnpm typecheck` passes; `db.query.tenant.findFirst(...)` autocompletes

## Implementation notes

- Use `pgTable`, `text`, `integer` (cents!), `timestamp`, `jsonb`, `pgEnum`.
- Money columns are `integer` (cents) — never `numeric`. Per `DEVELOPMENT.md`.
- Enums: `case_status`, `plan_status`, `escalation_reason` — define inline.
- For PR demo: assume Supabase DB exists; reviewer runs `pnpm db:push` once locally.

---

_From `docs/plan.md` ticket #10._
EOF
create_issue "#10 — Drizzle schema (11 tables) + db:push" "phase-3,area:db" "$TICKET_10"

IFS='' read -r -d '' TICKET_11 <<'EOF' || true
**Phase:** 3 — Database
**Depends on:** #10
**Blocks:** Phase 9 (demo)
**Est. time:** ~30 min
**ADR refs:** ADR-0007, `DEVELOPMENT.md` (data seeding), `docs/project.md` (personas)

## Scope

Write `scripts/db-seed.ts` that inserts: 1 landlord, 3 properties, 3 tenants (Amina/Mike/Sara per project.md), 1 vendor (plumber), 1 work_order, 1 vendor_invoice. **Idempotent** — running twice doesn't duplicate.

## Files to touch

- `scripts/db-seed.ts` (new)
- `package.json` — add script `db:seed`
- `scripts/db-reset.ts` (new — truncates all tables; called via `db:reset`)
- `package.json` — add script `db:reset`

## Acceptance criteria

- [ ] `pnpm db:seed` creates 1 landlord + 3 properties + 3 tenants + 1 vendor + 1 work_order + 1 vendor_invoice
- [ ] Re-running `pnpm db:seed` is a no-op (idempotent — uses fixed UUIDs from a const block)
- [ ] `pnpm db:reset` truncates all tables in dependency order
- [ ] Tenant personas match `docs/project.md`: Amina Benali (loyal, French), Mike Schmidt (chronic, German), Sara Petrović (new, Serbian)

## Implementation notes

- Use a `FIXED_IDS` const block at top: each entity has a hard-coded UUID. ON CONFLICT DO NOTHING semantics.
- Money values in cents. Rent: €1200 = 120000.
- Don't seed `agent_case` rows — those are created by the agent at runtime.

---

_From `docs/plan.md` ticket #11._
EOF
create_issue "#11 — DB seed script (3 personas)" "phase-3,area:db" "$TICKET_11"

IFS='' read -r -d '' TICKET_12 <<'EOF' || true
**Phase:** 3 — Database
**Depends on:** #10
**Blocks:** Phase 6, 9
**Est. time:** ~35 min
**ADR refs:** ADR-0002 (Stripe Connect mode)

## Scope

Write `scripts/seed-stripe.ts` that creates: Stripe Customers for each tenant, Stripe Connect Express accounts for landlord + vendor (test mode, no real onboarding — use `accounts.create` directly with test data), saves the `stripe_*_id` back into our DB.

## Files to touch

- `scripts/seed-stripe.ts` (new)
- `package.json` — add script `stripe:seed`
- `package.json` — add script `demo:reset` (= `db:reset && db:seed && stripe:seed`)

## Acceptance criteria

- [ ] Creates 3 Stripe Customers (one per tenant), saves IDs into `tenant.stripe_customer_id`
- [ ] Creates 2 Connect Express accounts (landlord + vendor), saves IDs into `landlord.stripe_account_id` and `vendor.stripe_account_id`
- [ ] Idempotent — uses Stripe `idempotency_key` per entity + skips create if our DB already has the ID
- [ ] `pnpm demo:reset` runs all three (db reset + db seed + stripe seed) in sequence
- [ ] Test mode keys only — production keys must throw

## Implementation notes

- Express accounts: `stripe.accounts.create({ type: "express", country: "DE", email, business_type: "individual", capabilities: { transfers: { requested: true }, card_payments: { requested: true } }, business_profile: { mcc: "6513" } })` — full payload in ADR-0002.
- Skip onboarding link generation — for demo we mark accounts as "ready" via Stripe test mode toggles.
- Add a safety check: `if (env.STRIPE_SECRET_KEY.startsWith("sk_live_")) throw`.

---

_From `docs/plan.md` ticket #12._
EOF
create_issue "#12 — Stripe seed script (Connect Express)" "phase-3,area:stripe" "$TICKET_12"

# ───────────────────────────────────────────────────────────────────
# PHASE 4 — Compliance + Fairness
# ───────────────────────────────────────────────────────────────────

IFS='' read -r -d '' TICKET_13 <<'EOF' || true
**Phase:** 4 — Compliance + Fairness
**Depends on:** #06, #07
**Blocks:** #14, Phase 5
**Est. time:** ~40 min
**ADR refs:** ADR-0004 (Compliance policy v1)

## Scope

Define the `COMPLIANCE_POLICY_V1` constant and implement all 5 rule check functions: `verzug_grace`, `mahnung_spacing`, `late_fee_cap`, `contact_hours`, `language_match`. Vitest test per rule with at least 2 cases (pass + fail).

## Files to touch

- `src/agent/compliance/policy.ts` (new — `COMPLIANCE_POLICY_V1` const)
- `src/agent/compliance/rules.ts` (new — exports `ruleChecks` registry)
- `src/agent/compliance/__tests__/rules.test.ts` (new)

## Acceptance criteria

- [ ] `COMPLIANCE_POLICY_V1` includes: 7-day Verzug grace, 14-day Mahnung spacing, 5% late fee cap, 08:00–20:00 contact hours, language matching
- [ ] Each rule returns `ComplianceResult | null` (null = N/A for this action)
- [ ] `ruleChecks` is a registry keyed by rule_id
- [ ] Tests cover: rule passes; rule fails; rule N/A (returns null)
- [ ] All tests pass

## Implementation notes

- Use exact code snippets from ADR-0004 § Implementation notes — they're already drafted.
- Rule `late_fee_cap`: 5% of monthly rent (in cents). Use `applyFeePct(rent_cents, 500)` from #07.
- Rule `contact_hours`: uses `isContactHours()` from #07.

---

_From `docs/plan.md` ticket #13._
EOF
create_issue "#13 — Compliance policy v1 + 5 rule checks" "phase-4,area:agent,priority:critical-path" "$TICKET_13"

IFS='' read -r -d '' TICKET_14 <<'EOF' || true
**Phase:** 4 — Compliance + Fairness
**Depends on:** #13
**Blocks:** Phase 5
**Est. time:** ~30 min
**ADR refs:** ADR-0004 (Compliance orchestration)

## Scope

Implement the retry loop: agent proposes action → run all rules → if any fails, send the failure reasons back to the agent and ask for a compliant alternative. Max 3 retries. After that, fallback to `escalate_human`.

## Files to touch

- `src/agent/compliance/orchestrator.ts` (new — exports `runCompliantAgent`)
- `src/agent/compliance/__tests__/orchestrator.test.ts` (new)

## Acceptance criteria

- [ ] `runCompliantAgent(ctx, agentFn)` returns a `{ action, compliance_check, retries }` result
- [ ] On rule failure, calls `agentFn` again with the failure reasons appended to context
- [ ] After 3 failed retries, returns an `escalate_human` action with reason `"compliance_max_retries"`
- [ ] Test mocks `agentFn` and verifies the retry contract
- [ ] On success first try, returns immediately (no extra calls)

## Implementation notes

- `MAX_AGENT_RETRIES = 3` const.
- Pass failure reasons as additional context to the agent — see ADR-0004 § Implementation notes.
- This is pure logic — the real Claude call is in #17–#19.

---

_From `docs/plan.md` ticket #14._
EOF
create_issue "#14 — Compliance orchestrator (retry-on-block)" "phase-4,area:agent,priority:critical-path" "$TICKET_14"

IFS='' read -r -d '' TICKET_15 <<'EOF' || true
**Phase:** 4 — Compliance + Fairness
**Depends on:** #06, #09
**Blocks:** #16, Phase 5
**Est. time:** ~30 min
**ADR refs:** ADR-0005 (Bias defense, layers 1, 2, 3)

## Scope

Implement: `sanitizeContext(ctx)` (strips ethnicity/origin/religion/political fields per layer-1), `FORBIDDEN_KEYWORDS` list (layer-2 reasoning constraint), and the `checkOutputGuardrails(action, ctx)` function (layer-3) that scans the agent's `reasoning_summary` for forbidden language.

## Files to touch

- `src/agent/fairness/sanitize.ts` (new — exports `sanitizeContext`)
- `src/agent/fairness/keywords.ts` (new — exports `FORBIDDEN_KEYWORDS`)
- `src/agent/fairness/guardrails.ts` (new — exports `checkOutputGuardrails`)
- `src/agent/fairness/__tests__/*.test.ts` (new)

## Acceptance criteria

- [ ] `sanitizeContext` removes any property in: `name_origin`, `ethnicity`, `nationality`, `religion`, `political_view` (kept out of the agent's view; downstream layers still see them for audit)
- [ ] `FORBIDDEN_KEYWORDS` includes at minimum: terms covering race, ethnicity, religion, nationality, political affiliation (English + German both)
- [ ] `checkOutputGuardrails` returns `{ forbidden_keywords_present: boolean, hits: string[] }`
- [ ] Tests cover: clean input passes; sanitized input strips fields; forbidden keyword in reasoning fails

## Implementation notes

- Forbidden keyword list copy from ADR-0005 § Implementation notes.
- Sanitize: deep-clone first, then delete keys. Don't mutate the input.
- The PII redactor from #08/#09 runs *before* sending to the agent — that's the orchestrator's job in #19, not this ticket.

---

_From `docs/plan.md` ticket #15._
EOF
create_issue "#15 — Fairness: sanitize + forbidden keywords + reasoning constraints" "phase-4,area:agent" "$TICKET_15"

IFS='' read -r -d '' TICKET_16 <<'EOF' || true
**Phase:** 4 — Compliance + Fairness
**Depends on:** #15
**Blocks:** Phase 5
**Est. time:** ~30 min
**ADR refs:** ADR-0005 (Bias defense, layers 4, 5)

## Scope

Implement `runCounterfactual(ctx, agentFn)`: swaps the tenant's name to "Anna Bauer" (and German-default fields), re-runs the agent, compares actions. If they diverge → flag bias. Also implement the audit log writer that persists the full envelope (input, redacted input, action, compliance, fairness, model+prompt version) to `agent_case`.

## Files to touch

- `src/agent/fairness/counterfactual.ts` (new — exports `runCounterfactual`)
- `src/agent/audit/writer.ts` (new — exports `writeAuditEnvelope`)
- `src/agent/fairness/__tests__/counterfactual.test.ts` (new)

## Acceptance criteria

- [ ] `runCounterfactual(ctx, agentFn)` swaps `tenant.name` to "Anna Bauer", `tenant.preferred_language` to "de", re-runs `agentFn`, returns `{ counterfactual_agreed: boolean, baseline_action: AgentAction, counterfactual_action: AgentAction }`
- [ ] Two actions "agree" if they have the same `kind` and meaningfully-similar parameters (e.g., plan_negotiation with identical installment count)
- [ ] `writeAuditEnvelope(case_id, envelope)` writes JSONB to `agent_case` columns: `audit_envelope`, `compliance_check`, `fairness_check`
- [ ] Counterfactual is **opt-in per case** (not run on every case) — orchestrator decides when (e.g., demo trigger, weekly sample)
- [ ] Tests with mocked `agentFn`

## Implementation notes

- "Meaningfully similar" comparison: shallow equality on `kind`, plus key payload fields (e.g., for plan_negotiation: same number of installments ± 1). See ADR-0005.
- Audit envelope shape: `{ input: AgentContext, redacted_input: AgentContext, action: AgentAction, compliance: ComplianceCheck, fairness: FairnessCheck, model: string, prompt_version: string, timestamp: string }`.
- The audit writer is also where we log retries (for ADR-0011 transparency).

---

_From `docs/plan.md` ticket #16._
EOF
create_issue "#16 — Fairness: counterfactual + audit log" "phase-4,area:agent" "$TICKET_16"

# ───────────────────────────────────────────────────────────────────
# PHASE 5 — Agent core
# ───────────────────────────────────────────────────────────────────

IFS='' read -r -d '' TICKET_17 <<'EOF' || true
**Phase:** 5 — Agent core
**Depends on:** #05, #06, #16
**Blocks:** #18, #19
**Est. time:** ~35 min
**ADR refs:** ADR-0008 (AI runtime + prompt versioning), `docs/brainstorm/2026-05-23-decision-space.md`

## Scope

Write the v1 system prompt for the decision agent. Include: role definition, three-pillars reminder, action surface (8 options), compliance + fairness reminders, output contract (tool-use). Define the matching Anthropic tool-use schema (one tool: `submit_decision` whose input mirrors `AgentResponse`).

## Files to touch

- `src/agent/prompts/system-v1.ts` (new — exports `SYSTEM_PROMPT_V1` and `PROMPT_VERSION = "v1"`)
- `src/agent/prompts/tool-schema.ts` (new — exports `SUBMIT_DECISION_TOOL` for Anthropic SDK)
- `src/agent/prompts/__tests__/tool-schema.test.ts` (new — assert schema matches `AgentResponse` zod schema)

## Acceptance criteria

- [ ] System prompt is one large template literal; references all 8 actions, both compliance + fairness expectations
- [ ] Tool schema (`SUBMIT_DECISION_TOOL`) input JSON Schema exactly matches the structure of `AgentResponse` from #05/#06
- [ ] `PROMPT_VERSION` constant exported (used by audit writer in #16)
- [ ] Test parses a Claude-style tool-input fixture against the schema

## Implementation notes

- Use Anthropic's official tool-use pattern: a single tool the model MUST call.
- System prompt structure (sections):
  1. Role: "RentPilot AI — payment ops agent for property managers"
  2. Inputs you will receive
  3. The 8 actions you can take, with one-line each
  4. Compliance frame: "rules will hard-block you. Read the failures and adapt."
  5. Fairness frame: "you will not see name origin/ethnicity. Reason on payment behavior only."
  6. Output: "call `submit_decision` exactly once"
- Keep prompt under ~3500 tokens.

---

_From `docs/plan.md` ticket #17._
EOF
create_issue "#17 — Agent system prompt v1 + tool-use schema" "phase-5,area:agent,priority:critical-path" "$TICKET_17"

IFS='' read -r -d '' TICKET_18 <<'EOF' || true
**Phase:** 5 — Agent core
**Depends on:** #10, #17
**Blocks:** #19
**Est. time:** ~30 min
**ADR refs:** ADR-0008, `docs/brainstorm/2026-05-23-decision-space.md`

## Scope

Implement `buildAgentContext(case_id)`: queries the DB (tenant, history, current event), assembles the `unstructured_sources` array (mocked support chat snippets + landlord notes for demo), returns a fully-formed `AgentContext`.

## Files to touch

- `src/agent/context-builder.ts` (new — exports `buildAgentContext`)
- `src/agent/fixtures/unstructured.ts` (new — mocked unstructured strings per tenant)
- `src/agent/__tests__/context-builder.test.ts` (new — uses a seeded test DB)

## Acceptance criteria

- [ ] Given a `case_id`, returns full `AgentContext` with all fields populated
- [ ] `unstructured_sources` includes at least 2 sources per tenant (e.g., support chat + landlord note)
- [ ] Mocked unstructured content is rich enough that the agent can demonstrate judgment (e.g., Amina's chat shows job-loss confession; Mike's chat shows hostility)
- [ ] Test with a seeded DB returns expected shape

## Implementation notes

- Use Drizzle queries from #10. JOIN `tenant`, `property`, `rent_obligation`.
- Mocked unstructured strings: hand-written, 1–3 paragraphs per source, anchored to the persona facts in `docs/project.md`.
- The context is NOT redacted here — that happens in #19.

---

_From `docs/plan.md` ticket #18._
EOF
create_issue "#18 — Agent context builder" "phase-5,area:agent,priority:critical-path" "$TICKET_18"

IFS='' read -r -d '' TICKET_19 <<'EOF' || true
**Phase:** 5 — Agent core
**Depends on:** #09, #14, #16, #17, #18
**Blocks:** Phase 6, 8
**Est. time:** ~45 min
**ADR refs:** ADR-0001, ADR-0004, ADR-0005, ADR-0008

## Scope

The centerpiece. `runAgent(case_id, { withCounterfactual? })` does the full pipeline: build context → sanitize → redact → call Claude with tool-use → parse → run compliance (retry up to 3) → run fairness guardrails → optionally counterfactual → write audit envelope → return final `AgentResponse`.

## Files to touch

- `src/agent/runner.ts` (new — exports `runAgent`)
- `src/agent/__tests__/runner.test.ts` (new — mocks Claude client)

## Acceptance criteria

- [ ] `runAgent(case_id)` returns a fully-validated `AgentResponse`
- [ ] Pipeline order: build → sanitize → redact → call → compliance loop → guardrails → counterfactual (optional) → audit
- [ ] If compliance fails 3× → returns `escalate_human`
- [ ] If forbidden keywords found in reasoning → forces re-prompt (counts as a compliance retry)
- [ ] Persisted to `agent_case` table via audit writer
- [ ] Test with mocked Claude that returns: (a) a clean action, (b) an action that fails compliance once then passes

## Implementation notes

- Pulls together #14 (compliance orchestrator) + #15/#16 (fairness layers) + #09 (redactor) + #17 (prompt) + #18 (context).
- Claude call: `decisionClient.messages.create({ system, messages, tools: [SUBMIT_DECISION_TOOL], tool_choice: { type: "tool", name: "submit_decision" } })`.
- The single agent call function (closure) is what's passed to `runCompliantAgent` from #14.
- Log every step with structured logger; include `prompt_version` and `model_id` in every log line (debugging).

---

_From `docs/plan.md` ticket #19._
EOF
create_issue "#19 — Agent orchestration runner" "phase-5,area:agent,priority:critical-path" "$TICKET_19"

# ───────────────────────────────────────────────────────────────────
# PHASE 6 — Stripe flows
# ───────────────────────────────────────────────────────────────────

IFS='' read -r -d '' TICKET_20 <<'EOF' || true
**Phase:** 6 — Stripe flows
**Depends on:** #04, #11
**Blocks:** Phase 7
**Est. time:** ~40 min
**ADR refs:** ADR-0003 (Plan negotiation)

## Scope

Implement `createPaymentPlan(tenant, amount_cents, installments)` using raw Stripe Invoices (NOT subscriptionSchedules — see ADR-0003). Creates N invoice items, N invoices, finalizes them, sends the first one. Saves the plan to our DB.

## Files to touch

- `src/stripe/plan.ts` (new — exports `createPaymentPlan`)
- `src/stripe/__tests__/plan.test.ts` (new — mocks Stripe client)

## Acceptance criteria

- [ ] `createPaymentPlan(tenant_id, 60000, 2)` creates 2 invoices of 30000 cents each
- [ ] Each invoice has metadata: `rentpilot_plan_id`, `rentpilot_installment_index`
- [ ] First invoice is sent immediately (`stripe.invoices.sendInvoice`); rest are auto-sent on due date
- [ ] `payment_plan` row inserted into DB with `status='active'`, `installments` JSONB array
- [ ] Idempotency key set on every Stripe call (`plan_${case_id}_${index}`)
- [ ] Test verifies 2 invoices, correct amounts, correct metadata

## Implementation notes

- Code skeleton in ADR-0003 § Implementation notes.
- `due_date` for installment N is `now + N × 30 days` (calendar-day, not 30×24h).
- Amounts must split evenly; if not, last installment absorbs the remainder cent.

---

_From `docs/plan.md` ticket #20._
EOF
create_issue "#20 — Plan negotiation (Stripe Invoices)" "phase-6,area:stripe" "$TICKET_20"

IFS='' read -r -d '' TICKET_21 <<'EOF' || true
**Phase:** 6 — Stripe flows
**Depends on:** #04, #11, #12
**Blocks:** Phase 7
**Est. time:** ~30 min
**ADR refs:** ADR-0002 (Stripe Connect — separate charges & transfers)

## Scope

Implement `payVendorInvoice(vendor_invoice_id)`: pulls the vendor invoice from DB, calls `stripe.transfers.create` to send money to the vendor's Connect account, marks invoice as paid in our DB. Uses platform's balance.

## Files to touch

- `src/stripe/vendor-payout.ts` (new — exports `payVendorInvoice`)
- `src/stripe/__tests__/vendor-payout.test.ts` (new — mocked)

## Acceptance criteria

- [ ] `payVendorInvoice(id)` creates a Stripe transfer to vendor's `stripe_account_id`
- [ ] Idempotency key: `vendor_payout_${vendor_invoice_id}`
- [ ] On success: DB `vendor_invoice.status` → `'pending_transfer'` (final flip to `'paid'` happens in webhook #24)
- [ ] Throws if the vendor invoice is already paid/in-progress
- [ ] Test verifies transfer call shape + DB update

## Implementation notes

- `stripe.transfers.create({ amount, currency: "eur", destination: vendor.stripe_account_id, description: "..." }, { idempotencyKey })`.
- This is a TRANSFER from platform balance — we assume platform balance exists (in test mode it always does).

---

_From `docs/plan.md` ticket #21._
EOF
create_issue "#21 — Vendor disbursement (transfers)" "phase-6,area:stripe" "$TICKET_21"

IFS='' read -r -d '' TICKET_22 <<'EOF' || true
**Phase:** 6 — Stripe flows
**Depends on:** #04, #11, #12
**Blocks:** Phase 7, 9
**Est. time:** ~35 min
**ADR refs:** ADR-0002, ADR-0009 (Hosting + Vercel Cron)

## Scope

Implement `disburseLandlord(period)`: queries all paid rents for the period, deducts platform fee (basis points from env), transfers net to landlord. Plus a Vercel Cron endpoint `/api/cron/disburse-landlord` that fires weekly (Sundays 02:00 UTC per ADR-0009).

## Files to touch

- `src/stripe/landlord-disburse.ts` (new — exports `disburseLandlord`)
- `src/app/api/cron/disburse-landlord/route.ts` (new — cron endpoint)
- `vercel.json` (new — cron schedule)
- `src/stripe/__tests__/landlord-disburse.test.ts` (new)

## Acceptance criteria

- [ ] `disburseLandlord({ from, to })` finds all `rent_obligation` rows paid in window
- [ ] Platform fee deducted using `applyFeePct(net_cents, env.STRIPE_CONNECT_LANDLORD_PLATFORM_FEE_BPS)`
- [ ] One `transfer.create` call per landlord account, idempotency key includes period
- [ ] Cron endpoint returns 200; rejects requests without `Authorization: Bearer <CRON_SECRET>` header
- [ ] `vercel.json` schedules `/api/cron/disburse-landlord` at `0 2 * * 0` (Sunday 02:00 UTC)

## Implementation notes

- Cron secret check: Vercel passes the secret in the Authorization header for protected crons.
- Don't actually call this from a UI button — it's cron-only. For demo, we'll call it manually via curl in the rehearsal.

---

_From `docs/plan.md` ticket #22._
EOF
create_issue "#22 — Landlord disbursement + Vercel Cron" "phase-6,area:stripe" "$TICKET_22"

# ───────────────────────────────────────────────────────────────────
# PHASE 7 — Webhooks
# ───────────────────────────────────────────────────────────────────

IFS='' read -r -d '' TICKET_23 <<'EOF' || true
**Phase:** 7 — Webhooks
**Depends on:** #04, #10
**Blocks:** #24
**Est. time:** ~30 min
**ADR refs:** ADR-0012 (Webhook handling + idempotency)

## Scope

Implement `POST /api/stripe/webhook`: reads raw body, verifies Stripe signature, dedupes via `processed_webhook` table, dispatches to event handlers (handlers come in #24). Returns 200 fast.

## Files to touch

- `src/app/api/stripe/webhook/route.ts` (new)
- `src/stripe/webhook-dispatcher.ts` (new — exports `dispatchWebhookEvent`, with stub handlers; real ones land in #24)

## Acceptance criteria

- [ ] Raw body parsing (no Next.js body parser interference)
- [ ] Signature verification with `STRIPE_WEBHOOK_SECRET`; bad signature → 400
- [ ] Idempotency: `processed_webhook` INSERT with `event_id`, ON CONFLICT DO NOTHING — replays return 200 immediately
- [ ] On handler error: rolls back the dedup row + returns 500 so Stripe retries
- [ ] Returns 200 for unknown event types (logs and skips)
- [ ] Locally testable via `stripe listen --forward-to localhost:3000/api/stripe/webhook`

## Implementation notes

- Full code in ADR-0012 § Implementation notes — copy verbatim, this ticket is mostly translation.
- `export const runtime = "nodejs"` (not edge, Stripe SDK needs node crypto).
- `export const dynamic = "force-dynamic"`.

---

_From `docs/plan.md` ticket #23._
EOF
create_issue "#23 — Webhook route (signature + dedup + dispatcher)" "phase-7,area:stripe" "$TICKET_23"

IFS='' read -r -d '' TICKET_24 <<'EOF' || true
**Phase:** 7 — Webhooks
**Depends on:** #20, #21, #22, #23
**Blocks:** Phase 9
**Est. time:** ~40 min
**ADR refs:** ADR-0012, ADR-0003

## Scope

Implement the 5 webhook handlers: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `transfer.created`, `account.updated`. All idempotent (read-then-update pattern). Plus tests for each.

## Files to touch

- `src/stripe/handlers/checkout-completed.ts` (new)
- `src/stripe/handlers/invoice-paid.ts` (new)
- `src/stripe/handlers/invoice-payment-failed.ts` (new)
- `src/stripe/handlers/transfer-created.ts` (new)
- `src/stripe/handlers/account-updated.ts` (new)
- `src/stripe/webhook-dispatcher.ts` (modify — wire real handlers)
- `src/stripe/handlers/__tests__/*.test.ts` (one test file per handler)

## Acceptance criteria

- [ ] All 5 handlers implemented per ADR-0012 § Events we listen to table
- [ ] `invoice.paid` handler: idempotent — checks `installments[idx].paid_at` before updating; if all installments paid, flips plan to `completed` and emits a notification
- [ ] `invoice.payment_failed` handler: creates an `agent_case` with trigger `rent_failed_charge` (does NOT call the agent inline — queues for cron)
- [ ] `transfer.created` handler: matches transfer metadata back to `vendor_invoice` or `disbursement` row, marks paid
- [ ] Each handler has a Vitest test with at least: first-call success, second-call idempotent no-op

## Implementation notes

- Idempotency pattern in ADR-0012 § Idempotent handler pattern — copy.
- "Do not call agent inline" — instead insert a `pending_triggers` row (or just mark on the case) so the cron processes it. Or, simpler: call `runAgent` directly but only if estimated time is <8s. Decide in PR.

---

_From `docs/plan.md` ticket #24._
EOF
create_issue "#24 — All 5 event handlers (idempotent)" "phase-7,area:stripe" "$TICKET_24"

# ───────────────────────────────────────────────────────────────────
# PHASE 8 — UI
# ───────────────────────────────────────────────────────────────────

IFS='' read -r -d '' TICKET_25 <<'EOF' || true
**Phase:** 8 — UI
**Depends on:** #04
**Blocks:** #26, #27, #28
**Est. time:** ~30 min
**ADR refs:** ADR-0006 (UI stack), `DEVELOPMENT.md` (mocked auth)

## Scope

Add shadcn/ui (Button, Card, Badge, Dialog, Sheet, Table — these specific ones). Build the app shell layout: sidebar nav, top bar showing the demo manager's name (mocked). No real auth — single hard-coded `demo_manager` per `DEVELOPMENT.md`.

## Files to touch

- `components.json` (new — shadcn config)
- `src/components/ui/*.tsx` (new — shadcn-installed components)
- `src/components/layout/sidebar.tsx`, `top-bar.tsx`, `app-shell.tsx` (new)
- `src/app/layout.tsx` (modify — wrap with `AppShell`)
- `src/lib/auth.ts` (new — exports `getCurrentManager()`, returns hard-coded `demo_manager`)

## Acceptance criteria

- [ ] `pnpm dlx shadcn@latest add button card badge dialog sheet table` succeeds
- [ ] App shell renders sidebar + top bar; main content slot empty
- [ ] `/` renders a placeholder dashboard ("Welcome, demo_manager")
- [ ] `getCurrentManager()` returns `{ id: "demo_manager", name: "Demo Manager", email: "demo@rentpilot.local" }`
- [ ] Theme is shadcn's default (we can polish later if time permits)

## Implementation notes

- Sidebar items: Dashboard, Cases, Settings (placeholder).
- No real auth ever — even logged-in user is hardcoded for hackathon.

---

_From `docs/plan.md` ticket #25._
EOF
create_issue "#25 — shadcn/ui + layout shell + mock auth" "phase-8,area:ui" "$TICKET_25"

IFS='' read -r -d '' TICKET_26 <<'EOF' || true
**Phase:** 8 — UI
**Depends on:** #10, #25
**Blocks:** Phase 9
**Est. time:** ~30 min
**ADR refs:** ADR-0006, `docs/project.md` (demo flow)

## Scope

Build `/cases` page (and make it the homepage): table of all `agent_case` rows with tenant name, property, status, agent's last action, timestamp. Click row → navigate to case detail (which is #27). Use a Server Component for the data fetch.

## Files to touch

- `src/app/page.tsx` (modify — server component, fetch cases via Drizzle)
- `src/components/cases/case-list-table.tsx` (new)
- `src/components/cases/case-status-badge.tsx` (new — colored badge per status)

## Acceptance criteria

- [ ] `/` renders a table of all `agent_case` rows from DB
- [ ] Columns: Tenant, Property, Status, Last Action, Created At
- [ ] Status badge color reflects status (pending=blue, in_progress=yellow, resolved=green, escalated=red)
- [ ] Row click navigates to `/cases/[id]`
- [ ] Empty state if no cases: "Run `pnpm demo:reset` to seed cases"

## Implementation notes

- Server Component (no `"use client"` on the page).
- For demo, we expect ~3 cases (one per persona).
- No pagination — small list.

---

_From `docs/plan.md` ticket #26._
EOF
create_issue "#26 — Landlord dashboard (case list)" "phase-8,area:ui" "$TICKET_26"

IFS='' read -r -d '' TICKET_27 <<'EOF' || true
**Phase:** 8 — UI
**Depends on:** #19, #25
**Blocks:** Phase 9
**Est. time:** ~40 min
**ADR refs:** ADR-0001 (reasoning chain UX), ADR-0004 (compliance badge), ADR-0005 (fairness badge), `docs/project.md` (demo flow)

## Scope

Build `/cases/[id]` page: tenant info card, payment history, the agent's `AgentResponse` rendered as a **reasoning chain** (inputs → weighted considerations → action → compliance + fairness badges). This is the visual centerpiece of the demo.

## Files to touch

- `src/app/cases/[id]/page.tsx` (new — server component)
- `src/components/cases/reasoning-chain.tsx` (new)
- `src/components/cases/compliance-badge.tsx`, `fairness-badge.tsx` (new)
- `src/components/cases/tenant-card.tsx`, `payment-history.tsx` (new)

## Acceptance criteria

- [ ] Renders all `agent_case` data including JSONB envelope
- [ ] **Reasoning chain** shows: each unstructured source (with its excerpt + weight bar), the agent's `reasoning_summary`, the chosen action with parameters
- [ ] Compliance badge shows green "Pass" with rule check icons; red "Blocked" + reason if `overall = "fail"`
- [ ] Fairness badge shows green "Pass" + "Counterfactual: agreed" (or hidden if not run)
- [ ] Payment history table: rent_obligation rows with status + dates

## Implementation notes

- The reasoning chain is the *wow* moment of the demo. Spend visual care here: source cards with mini-quotes, weight bars (0.0–1.0), connecting lines to the action.
- Compliance badge: small component showing 5 rule check pills + overall.
- Use Tailwind only — no animation libs.

---

_From `docs/plan.md` ticket #27._
EOF
create_issue "#27 — Case detail (reasoning chain + badges)" "phase-8,area:ui" "$TICKET_27"

IFS='' read -r -d '' TICKET_28 <<'EOF' || true
**Phase:** 8 — UI
**Depends on:** #19, #20, #27
**Blocks:** Phase 9
**Est. time:** ~40 min
**ADR refs:** ADR-0005 (counterfactual demo), ADR-0003 (plan negotiation flow), `docs/brainstorm/2026-05-23-bias-and-fairness.md`

## Scope

Three UI elements:
1. **"Run counterfactual" button** on the case detail page that triggers `runAgent({ withCounterfactual: true })` and renders the side-by-side comparison.
2. **Plan modal** that the manager opens when reviewing a plan_negotiation action, showing the proposed installments and a "Confirm & send" button that calls `createPaymentPlan`.
3. **Action approval queue** — list of pending agent actions awaiting human review (for the demo we'll show 1–2 awaiting items).

## Files to touch

- `src/components/demo/counterfactual-comparison.tsx` (new)
- `src/app/cases/[id]/counterfactual/page.tsx` (new — or modal in the case detail page)
- `src/components/cases/plan-modal.tsx` (new)
- `src/app/cases/[id]/actions/page.tsx` (new — approval queue)
- `src/app/api/agent/counterfactual/route.ts` (new — POST endpoint)
- `src/app/api/agent/plan/confirm/route.ts` (new — POST endpoint)

## Acceptance criteria

- [ ] Counterfactual button on case detail; clicking triggers `runAgent` server-side with `withCounterfactual: true`
- [ ] Renders side-by-side: baseline (Amina) → action vs. counterfactual (Anna Bauer) → action
- [ ] If they agree: green checkmark + "Same recommendation — fair." If they diverge: red + flag for review
- [ ] Plan modal: 2 installment rows, due dates, amounts. "Confirm & send" calls `/api/agent/plan/confirm` → `createPaymentPlan` from #20
- [ ] Approval queue: shows pending agent actions, each with approve/reject buttons

## Implementation notes

- Counterfactual is the demo's wow moment — make it visually clean. The point is to show fairness, not noise.
- Plan modal can use the shadcn `Dialog` component.

---

_From `docs/plan.md` ticket #28._
EOF
create_issue "#28 — Counterfactual demo + plan modal + action approval" "phase-8,area:ui" "$TICKET_28"

# ───────────────────────────────────────────────────────────────────
# PHASE 9 — Demo prep
# ───────────────────────────────────────────────────────────────────

IFS='' read -r -d '' TICKET_29 <<'EOF' || true
**Phase:** 9 — Demo prep
**Depends on:** everything in Phases 0–8
**Blocks:** #30
**Est. time:** ~35 min
**ADR refs:** ADR-0011 (Testing), `DEVELOPMENT.md` (demo reset)

## Scope

Finalize `pnpm demo:reset` so it produces a clean, demoable state in <10s. Add ONE Playwright E2E smoke test that walks the demo flow end-to-end (per ADR-0011 § E2E).

## Files to touch

- `scripts/db-reset.ts` (modify — ensure truncates everything)
- `scripts/db-seed.ts`, `scripts/seed-stripe.ts` (modify — verify idempotent)
- `tests/e2e/demo-flow.spec.ts` (new)
- `playwright.config.ts` (new)
- `package.json` — add `e2e` script

## Acceptance criteria

- [ ] `pnpm demo:reset` runs in <10s on a warm DB
- [ ] After reset: dashboard shows exactly 3 personas, 3 cases pending
- [ ] Playwright test passes locally: navigate → click Amina's case → assert reasoning chain visible → assert compliance pass badge → trigger counterfactual → assert agreement → trigger plan modal → assert Stripe Hosted Invoice URL appears
- [ ] Test does NOT run in CI (per ADR-0011) — `package.json` script is `pnpm e2e`

## Implementation notes

- E2E hits real Claude + real Stripe test mode — flaky but acceptable for one smoke test.
- Add `--retries=2` to playwright config.
- Use selectors that survive copy refactors: `data-testid="reasoning-chain"`, etc.

---

_From `docs/plan.md` ticket #29._
EOF
create_issue "#29 — Demo reset + Playwright E2E smoke" "phase-9,area:infra,priority:critical-path" "$TICKET_29"

IFS='' read -r -d '' TICKET_30 <<'EOF' || true
**Phase:** 9 — Demo prep
**Depends on:** #29
**Blocks:** submission
**Est. time:** ~60 min (incl. retakes)
**ADR refs:** `DEVELOPMENT.md` (rehearsal checklist), `docs/project.md` (demo flow)

## Scope

Final demo prep: rehearse the 2-minute walkthrough end-to-end at least 3 times, fix any blocker bugs found, record the Loom. Push final commit to `main`. Submit per hackathon brief.

## Files to touch

- Various — based on bugs found during rehearsal
- (No new files required)

## Acceptance criteria

- [ ] 3 full rehearsals completed back-to-back, all clean
- [ ] Loom recorded, <2 min, covers: problem framing → reasoning chain → compliance block moment → counterfactual moment → outcome
- [ ] Public GitHub repo URL works for an anonymous user (no broken links)
- [ ] README.md links work end-to-end
- [ ] Final commit on `main` is green in CI
- [ ] Submission posted to hackathon platform before 14:00 Berlin

## Implementation notes

- Loom script: see `docs/brainstorm/2026-05-23-bias-and-fairness.md` § 90-second script for the fairness moment; combine with `docs/project.md` demo flow for the full 2 min.
- This ticket is for **a human**, not an AI agent. The agent has handed off to demo prep.

---

_From `docs/plan.md` ticket #30._
EOF
create_issue "#30 — Rehearsal + bugfixes + Loom recording" "phase-9,area:infra,priority:critical-path" "$TICKET_30"

echo ""
echo "✓ Done. Run \`gh issue list --limit 30\` to verify all 30 issues."
echo ""
echo "Next steps:"
echo "  1. (Optional) Create a GitHub Project board and bulk-add issues to it"
echo "  2. (Optional) Set up branch protection on \`main\` per ADR-0010"
echo "  3. Pick #01 and start building"
