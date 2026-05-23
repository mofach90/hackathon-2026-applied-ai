# AGENTS.md — RentPilot AI

Canonical coordination protocol for every AI agent in this repository,
regardless of provider (Anthropic, OpenAI, Google, Mistral, Cursor, Copilot,
or any other tool). **Read this file in full before doing anything else.**

---

## TL;DR — the four rules

1. **Pick from your track only.** Each issue carries `track:brain`, `track:platform`, `track:ui`, `track:bootstrap`, or `track:demo`. Once you have started in a track, keep claiming from that track until it is exhausted.
2. **Claim before coding.** Assign yourself, add the `in-progress` label, push the branch — all three, before writing any application code.
3. **Sibling pairs ship as one PR.** If an issue has the `sibling-pair` label, find its partner (linked in the issue comments) and claim both atomically.
4. **Serialize `package.json` edits.** Only one open PR may carry the `touches:package-json` label at a time. If another such PR is already in-progress, pick a different ticket.

---

## Work tracks (lanes)

Tickets are partitioned into tracks so two agents can run concurrently without
ever touching the same files. **Two agents = two tracks active at once.**

| Track | Owner role | Lives in | Purpose |
|---|---|---|---|
| `track:bootstrap` | first available agent | repo root, `src/app/`, `src/lib/env.ts` | Phase 0 only. Must finish before tracks open. |
| `track:brain` | the "Brain" agent | `src/agent/` (excluding `llm.ts`) | Agent decision pipeline — critical path |
| `track:platform` | the "Platform" agent | `src/db/`, `src/stripe/`, `src/lib/{money,time}.ts`, `scripts/` | Data + payments + webhooks + utils |
| `track:ui` | the "Platform" agent (after platform settles) | `src/app/`, `src/components/`, `components.json` | Dashboard + case detail + counterfactual UI |
| `track:demo` | one agent | `tests/e2e/`, scripts polish | Phase 9 — sequential demo prep |

### Track ownership rules

- **Brain track must be owned by a single agent end-to-end.** It is the critical path (`#05 → #06 → #08 → #09 → #13 → #14 → #15 → #16 → #17 → #18 → #19`) and sequential dependencies dominate. Splitting it across agents creates idle time.
- **Platform + UI** can be owned by the same agent because they rarely overlap in time — UI mostly waits on the brain runner (`#19`) before it can finish (`#27`, `#28`).
- **Bootstrap** is mostly sequential. The free slot is `#03` (CI), which the Platform agent can grab while the Brain agent does `#02`.

---

## Sibling pairs (must be claimed atomically)

Two same-file conflicts exist. Both pairs must be claimed together by **one
agent** and shipped as **one PR**:

| Pair | Shared files | Track |
|---|---|---|
| **#5 + #6** | `src/agent/types/response.ts`, `src/agent/types/index.ts` | brain |
| **#23 + #24** | `src/stripe/webhook-dispatcher.ts` | platform |

When you see the `sibling-pair` label on an issue, scroll to the comments
section — the first comment names the partner.

---

## Resource locks

### `package.json` lock

Tickets labelled `touches:package-json`: **#1, #3, #4, #10, #11, #12, #25, #29.**

Before claiming any of these, run:

```bash
gh pr list --label "touches:package-json" --state open
```

If another PR is already open with this label, **pick a different ticket** and
come back later. Two simultaneous PRs editing `package.json` will conflict.

---

## Issue claiming protocol — MANDATORY

### Step 0 — Identify your track

If the user has not assigned you a track, decide:

```bash
# Is Brain track currently owned by anyone?
gh pr list --state open --label "track:brain" --json author --jq '.[].author.login' | sort -u
gh issue list --state open --label "track:brain,in-progress" --json assignees \
  --jq '.[].assignees[].login' | sort -u
```

- If both queries return empty → claim **Brain** (no one is doing the critical path; Brain has priority).
- Otherwise → claim **Platform**.

Announce your track in a comment on your first claimed issue:
`> I am the Brain agent for this session.`

After this, **do not switch tracks** within the session. Cross-track switching
is the #1 source of file conflicts.

### Step 1 — Find a ticket that is free, in your track, and unblocked

```bash
# Free + in your track (replace 'brain' with your track)
gh issue list --state open --assignee "" --label "track:brain" \
  --json number,title,labels \
  --jq '.[] | select(.labels | map(.name) | contains(["in-progress"]) | not) | "#\(.number) \(.title)"'
```

Then **open the issue body** and confirm every line under `Depends on:` is
closed. If any dependency is still open, the ticket is logically blocked — pick
a different one.

If the ticket has `touches:package-json`, run the `gh pr list` check above.

### Step 2 — Claim it atomically (all three, in order)

```bash
# 1. Assign yourself
gh issue edit <N> --add-assignee @me

# 2. Mark in-progress
gh issue edit <N> --add-label "in-progress"

# 3. Push the branch immediately, even if empty
git checkout -b feat/<N>-<short-slug>
git commit --allow-empty -m "chore: claim #<N>"
git push -u origin feat/<N>-<short-slug>
```

For sibling pairs, do all three steps on **both** issue numbers before
writing any code.

### Step 3 — Verify no race

```bash
gh issue view <N> --json assignees --jq '.assignees[].login'
```

You should see exactly one login: your own. If you see two (race condition),
the later assignee yields — unassign yourself and pick a different ticket.

### Step 4 — Release when the PR is open

```bash
gh pr create --title "feat(scope): subject" --body "Closes #<N>"
gh issue edit <N> --remove-label "in-progress"
```

For sibling pairs, the single PR body should `Closes #<N1>` and `Closes #<N2>`
on separate lines.

---

## Pre-flight conflict check (run before every claim)

```bash
# 1. List every file your target issue declares it will touch
#    (read the "Files to touch" section in the issue body)

# 2. Check those paths are not being modified by any open in-progress PR
gh pr list --label "in-progress" --json number,headRefName,files \
  --jq '.[] | "\(.number) \(.files[].path)"' | grep -E "<path-regex>"
```

If your target paths overlap with another open PR's changed files, pause and
pick a different ticket.

---

## Edge cases — what to do when…

### …your track is empty

Brain finishes #19 before Platform finishes #28, or vice versa. **Do not steal
from the other track.** Cross-track work is where same-file conflicts come
from. Instead, in this priority order:

1. Review the other agent's open PRs (`gh pr list --state open`). Squash-merge after approval.
2. Pick up `track:demo` if all its `Depends on:` lines are closed.
3. If all of the above is exhausted: idle. Re-check in 5 minutes. The other agent is the bottleneck — interrupting them is worse than waiting.

### …every open ticket is blocked by a dependency

```bash
gh issue list --state open --assignee "" --json number,body \
  --jq '.[] | "#\(.number) \(.body | capture("Depends on:.*?\n").string)"'
```

If nothing is unblocked, **wait** — do not force-pick. Re-query in 5 minutes.
Acting on a blocked ticket means you'll either rewrite the dependency or
produce broken code.

### …you finished a PR but the other agent hasn't reviewed yet

- Do not merge your own PR. Wait for the other agent.
- If they are mid-ticket, ping them only after >30 min of waiting.
- Move on to your next ticket — your branch is independent.

### …you and the other agent assigned yourselves at the same time

The race is real and resolved by the verification step:

```bash
gh issue view <N> --json assignees --jq '.assignees | length'
```

If the result is `> 1`, the agent who claimed **second** yields:

```bash
gh issue edit <N> --remove-assignee @me --remove-label "in-progress"
git push origin --delete feat/<N>-<slug>
```

The "second" claimer is the one whose `--add-assignee` API call resolved later.
If unclear, the agent on `track:platform` yields to `track:brain` (critical-path
priority).

### …a `touches:package-json` ticket is already in-progress

Pick a non-`touches:package-json` ticket from your track first. If your entire
track is gated on `package.json` work, fall back to reviewing or to
`track:demo` (see above).

---

## Review responsibility

Each agent reviews the other's PRs. **Never merge your own PR.** The PR
template (added in #03) requires one approval — that approval comes from the
other agent. If you are blocked and the other agent's PR is awaiting review,
reviewing is the highest-leverage thing you can do.

---

## Branch + PR conventions for tooling

- Branch name must include the issue number: `feat/<N>-<short-slug>` (e.g. `feat/05-shared-types`). This lets `gh pr list --json files` correlate PRs to issues.
- Sibling-pair PR body lists both closures on separate lines:
  ```
  Closes #5
  Closes #6
  ```
- Push the empty claim commit (`chore: claim #<N>`) immediately on branch creation. An empty branch on origin is the public signal that the ticket is locked.

---

## Project context

**RentPilot AI** — Autonomous payment operations for property management.
Hackathon: hallo theo Applied AI, Berlin 23–24 May 2026. Deadline:
Sunday 24 May 14:00 CET.

### Stack

- Next.js 15 App Router + TypeScript strict + Tailwind v4 + shadcn/ui + pnpm + Node 22
- Supabase Postgres + Drizzle ORM
- Claude API: `claude-opus-4-7` (decisions) + `claude-haiku-4-5-20251001` (redactor/renderer)
- Stripe Connect Express + separate charges & transfers + raw Invoices

### Critical-path execution order

```
Bootstrap : #01 → (#02 ∥ #03) → #04
Brain     : #05+#06 → #08 → #09 → #13 → #14 → #15 → #16 → #17 → #18 → #19
Platform  : #07 ∥ #10 → #11 → #12 → #20 ∥ #21 ∥ #22 → #23+#24
UI        : #25 → #26 ∥ (#27 → #28)          # #27/#28 wait on Brain #19
Demo      : #29 → #30
```

`∥` = can run in parallel within the same agent (independent files).

### Non-negotiable conventions (full details in `DEVELOPMENT.md`)

- `pnpm` only — never npm or yarn
- Conventional Commits: `<type>(<scope>): <subject>`
- Branch names: `feat/<N>-<kebab>` or `fix/<N>-<kebab>` (include issue number)
- No direct push to `main` — all changes via PR
- Money = integer cents only, never floats
- Time storage = UTC; display = Europe/Berlin
- Never pass un-redacted unstructured text to the decision LLM

---

## Where to find more

| Question | File |
|---|---|
| What are we building? | `docs/project.md` |
| 30-ticket plan + dependency graph + parallel playbook | `docs/plan.md` |
| Daily working conventions | `DEVELOPMENT.md` |
| Why a technical choice was made | `docs/adr/` |
