# Brainstorm Notes

This folder holds **raw brainstorm sessions, exploration notes, and rejected
ideas with reasoning**. Unlike ADRs (which capture *committed* decisions),
brainstorm files capture *thinking in progress*.

## Naming convention

```
YYYY-MM-DD-short-topic.md
```

Examples:
- `2026-05-23-initial-ideation.md`
- `2026-05-23-stripe-product-mapping.md`
- `2026-05-24-demo-script.md`

## What goes here

- Initial idea dumps before they're committed to scope
- Exploration of options before promoting one to an ADR
- Notes from team conversations
- Verbatim copies of source briefs (e.g., the hackathon track text)
- Post-mortems and retros

## What does NOT go here

- Committed architectural decisions → that's an ADR (`docs/adr/`)
- The project's current scope/demo flow → that's `docs/project.md`
- Code or implementation details → those live in the code

## Suggested first files for this project

- `2026-05-23-hackathon-brief.md` — verbatim copy of the hallo theo track brief
- `2026-05-23-initial-ideation.md` — the RentPlan AI → RentPilot AI evolution
- `2026-05-23-rejected-ideas.md` — SaaS Save Agent, Dispute Defense, B2B A/R Negotiator, and why we rejected them for this track
