# AGENTS.md — RentPilot AI

This file is the **canonical coordination protocol** for every AI agent working
in this repository, regardless of provider (Anthropic, OpenAI, Google, Mistral,
Cursor, Copilot, or any other tool).

Read this file in full before making any changes to the codebase.

---

## Issue claiming protocol — MANDATORY

Two or more agents may be running simultaneously in this repo.
**You must claim an issue before writing a single line of code.**
Failure to do so causes duplicate work and merge conflicts.

### Step 1 — Find a free issue

```bash
gh issue list --state open --assignee "" | grep -v "in-progress"
```

An issue is **free** only when it satisfies both conditions:
- No assignee
- Does not carry the `in-progress` label

If an issue has either, it is taken. Pick a different one.

### Step 2 — Claim the issue (run all three, in order)

```bash
# Assign yourself
gh issue edit <N> --add-assignee @me

# Mark as in-progress
gh issue edit <N> --add-label "in-progress"

# Create and push the branch immediately (even if empty)
git checkout -b feat/<short-description>
git push -u origin feat/<short-description>
```

All three steps must complete before you write any application code.
The combination of assignee + label + pushed branch is what another agent checks.

### Step 3 — Release the lock when the PR is open

```bash
gh pr create --title "feat(...): ..." --body "Closes #<N>"
gh issue edit <N> --remove-label "in-progress"
```

### Issue state reference

| Assignee | Has `in-progress` label | Branch pushed | Meaning |
|---|---|---|---|
| none | no | no | **Free — safe to claim** |
| set | yes | yes | **Taken — do not touch** |
| set | no | yes | In review — awaiting merge |

---

## Project context

**RentPilot AI** — Autonomous payment operations for property management.
Hackathon: hallo theo Applied AI, Berlin 23–24 May 2026.
Deadline: Sunday 24 May 2026, 14:00 CET.

### Stack

- Next.js 15 App Router + TypeScript strict + Tailwind v4 + shadcn/ui + pnpm + Node 22
- Supabase Postgres + Drizzle ORM
- Claude API: `claude-opus-4-7` (decisions) + `claude-haiku-4-5-20251001` (redactor/renderer)
- Stripe Connect Express + separate charges & transfers + raw Invoices

### Ticket dependency order (critical path)

```
#01 → #02 → #04 → #06 → #13 → #14 → #17 → #18 → #19 → #29 → #30
```

Off-critical-path tickets can be parallelized. Full 30-ticket plan: `docs/plan.md`.

### Non-negotiable conventions (full details in `DEVELOPMENT.md`)

- `pnpm` only — never npm or yarn
- Conventional Commits: `<type>(<scope>): <subject>`
- Branch names: `feat/<kebab>` or `fix/<kebab>`
- No direct push to `main` — all changes go through a PR
- Money = integer cents only, never floats
- Time storage = UTC; display = Europe/Berlin
- Never pass un-redacted unstructured text to the decision LLM

---

## Where to find more

| Question | File |
|---|---|
| What are we building? | `docs/project.md` |
| 30-ticket plan + dependency graph | `docs/plan.md` |
| Daily working conventions | `DEVELOPMENT.md` |
| Why a technical choice was made | `docs/adr/` |
