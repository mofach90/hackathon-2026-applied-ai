# ADR 0010: CI/CD Pipeline

- **Status:** Accepted
- **Date:** 2026-05-23
- **Deciders:** Mohamed Ayari, Aymen

## Context

We need a CI pipeline that:

- Catches type errors and lint violations **before** merge
- Runs the small set of tests we have
- Doesn't slow down the team (we ship every ~30 min during the hackathon)
- Doesn't require a self-hosted runner
- Plays nicely with Vercel's own preview deployments

CD is handled by Vercel (ADR-0009). This ADR covers **CI only** plus the Vercel hand-off.

## Decision

| Concern | Choice |
|---|---|
| CI provider | **GitHub Actions** |
| Trigger | Pull request + push to `main` |
| Required checks on `main` | typecheck, lint, test |
| Required reviews | 1 approval from the other team member |
| Preview deploy | Auto via Vercel GitHub app on PR open |
| Production deploy | Auto via Vercel on push to `main` |
| Branch protection | `main` is protected; no direct push |

## Consequences

### Easier

- GitHub Actions is the default — no separate dashboard, no separate billing
- Vercel handles the actual deploy, we don't have to script it
- Preview URLs per PR for visual review
- Required checks block merges of broken PRs

### Harder

- Branch protection slows down hot-fix flows — we'll need to disable temporarily for last-minute Loom-day fixes if review is unavailable
- GitHub Actions cold starts add ~30s to PR feedback

## Alternatives considered

- **Skip CI entirely** — Pro: faster iteration. Con: a broken `main` 1 hour before submission deadline would be catastrophic.
- **CircleCI / Buildkite** — Pro: faster. Con: extra setup, separate billing, no benefit for a hackathon repo.
- **Run checks only on `main`** — Pro: simpler. Con: defeats the purpose; we want to catch issues *before* merge.

## Implementation notes

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test:ci
```

### `package.json` scripts

```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings=0",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest",
    "test:ci": "vitest run",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "db:seed": "tsx src/db/seed.ts",
    "db:reset": "tsx scripts/db-reset.ts",
    "stripe:seed": "tsx scripts/seed-stripe.ts",
    "stripe:listen": "stripe listen --forward-to localhost:3000/api/stripe/webhook",
    "demo:reset": "pnpm db:reset && pnpm db:seed && pnpm stripe:seed"
  }
}
```

### Branch protection rules (set in GitHub Settings → Branches)

For `main`:

- ✅ Require a pull request before merging
- ✅ Require approvals: 1
- ✅ Require status checks to pass before merging:
  - `ci`
  - `Vercel`
- ✅ Require branches to be up to date before merging
- ⛔ Allow force pushes — OFF
- ⛔ Allow deletions — OFF

### Vercel GitHub integration

Install the Vercel GitHub app on the repo. Vercel then:

- Comments on each PR with the preview URL
- Auto-deploys `main` on push
- Surfaces deploy status as a GitHub check

### What we explicitly DON'T do in CI

- ❌ **Run E2E tests in CI.** Playwright needs a running stack; we run E2E locally before merge.
- ❌ **Run Stripe integration tests in CI.** They hit Stripe test mode; flaky in CI; we run locally.
- ❌ **Bundle-size budgets.** Out of scope for hackathon.
- ❌ **Visual regression.** Out of scope.

## Open questions

- Codecov / coverage tracking? Not needed for hackathon.
- Slack / Discord webhook on red `main`? Nice but skip.
- Branch naming convention enforcement? Captured in DEVELOPMENT.md, not CI.

## References

- GitHub Actions: https://docs.github.com/en/actions
- Vercel GitHub integration: https://vercel.com/docs/git/vercel-for-github
- ADR-0009 — Hosting (CD half of the pipeline)
- ADR-0011 — Testing strategy (defines what runs in CI)
- DEVELOPMENT.md — git workflow & commit conventions
