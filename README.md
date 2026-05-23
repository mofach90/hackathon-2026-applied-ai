# RentPilot AI

> Autonomous payment operations for property management.
> Built for the **hallo theo Applied AI Hackathon** (Berlin, 23–24 May 2026),
> Stripe track — *Autonomous Payment Operations*.

---

## Read this first

The full project definition — scope, demo story, architecture sketch, MVP cut-list,
stretch goals, and open questions — lives in **[`docs/project.md`](docs/project.md)**.

**All contributors and AI agents must read `docs/project.md` before making changes.**
It is the load-bearing document for this project. The rest of this README is
intentionally brief.

For day-to-day working conventions (git workflow, commit format, folder structure,
money/time discipline, error handling, demo reset) read **[`DEVELOPMENT.md`](DEVELOPMENT.md)**.
For decisions and *why* a choice was made, read the ADRs in **[`docs/adr/`](docs/adr/)**.

## Repo layout

```
.
├── README.md           # You are here.
├── DEVELOPMENT.md      # Daily working conventions.
├── docs/
│   ├── project.md      # Project definition — source of truth.
│   ├── plan.md         # MVP plan: 30 tickets + dependency graph.
│   ├── adr/            # Architecture Decision Records (the "why"s).
│   └── brainstorm/     # Brainstorm sessions and exploration notes.
└── (code dirs as the build progresses)
```

### Documentation map

| Need | Read |
|---|---|
| What we're building, demo story | `docs/project.md` |
| MVP plan + 30 tickets + dependency graph | `docs/plan.md` |
| Daily conventions, commit format, demo reset | `DEVELOPMENT.md` |
| Why a technical choice was made | `docs/adr/NNNN-*.md` |
| Hackathon track brief (verbatim) | `docs/brainstorm/2026-05-23-hackathon-brief.md` |
| Agent action surface + Stripe mapping | `docs/adr/0001-agent-decision-space.md` |
| Compliance + audit (German rental law) | `docs/adr/0004-compliance-policy-v1.md` |
| Bias defense (5 layers + counterfactual) | `docs/adr/0005-bias-defense-layers.md` |

## Team

- Mohamed Ayari
- Aymen

## Hackathon

- **Track:** Stripe — Autonomous Payment Operations
- **Submission deadline:** Sunday 24 May 2026, 14:00 Berlin time
- **Deliverables:** 2-minute Loom demo + this public repo
