# Architecture Decision Records

This folder holds **ADRs** — short documents that capture a single architectural
or technical decision, why it was made, and what alternatives were considered.

## Why ADRs

When the hackathon ends, the team (and any future agent) needs to understand
*why* the code is shaped the way it is. Commit messages decay. Slack threads
disappear. ADRs persist.

## Naming convention

```
NNNN-short-title.md
```

Examples:
- `0001-use-nextjs-app-router.md`
- `0002-stripe-connect-vs-payouts.md`
- `0003-claude-as-agent-runtime.md`

Increment `NNNN` monotonically. Never reuse a number, even if an ADR is superseded.

## Template

```markdown
# ADR NNNN: <short title>

- **Status:** Proposed | Accepted | Superseded by ADR-XXXX
- **Date:** YYYY-MM-DD
- **Deciders:** Mohamed, Aymen, ...

## Context

What is the problem? What constraints matter? What are we deciding between?

## Decision

What did we decide? State it plainly.

## Consequences

What gets easier? What gets harder? What are we explicitly accepting as a trade-off?

## Alternatives considered

- **Alt A** — why we didn't pick this
- **Alt B** — why we didn't pick this
```

## When to write an ADR

Write one when the decision is **non-obvious from the code** and a future reader
would reasonably ask "why this and not that?" — e.g., choice of database,
choice of payment flow shape, choice of AI runtime, choice of channel adapter.

Don't ADR routine choices (file naming, lint config, etc.).
