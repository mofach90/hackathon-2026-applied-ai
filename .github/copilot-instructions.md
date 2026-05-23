# GitHub Copilot instructions — RentPilot AI

Read `AGENTS.md` at the repo root before suggesting or applying any changes.
It contains the mandatory issue-claiming protocol that prevents two agents from
working the same ticket simultaneously.

Key rules (full details in `AGENTS.md` and `DEVELOPMENT.md`):

- Claim a GitHub issue before writing code:
  `gh issue edit <N> --add-assignee @me && gh issue edit <N> --add-label "in-progress"`
  Then push the branch immediately.
- `pnpm` only — never npm or yarn
- Conventional Commits format: `<type>(<scope>): <subject>`
- Money = integer cents; time storage = UTC
- Never pass un-redacted text to the decision LLM
