# CLAUDE.md — RentPilot AI (Claude Code entry point)

Read **`AGENTS.md`** first — it is the canonical protocol for all agents,
including the mandatory issue-claiming steps you must complete before writing
any code.

This file adds Claude Code-specific guidance only.

---

## Session startup checklist

1. Read `AGENTS.md` — issue claiming protocol and project context
2. Read `DEVELOPMENT.md` — full working conventions
3. Run `gh issue list --state open --assignee "" | grep -v "in-progress"` to find a free ticket
4. Claim it (three commands in `AGENTS.md`) before touching any file

## Claude-specific notes

- Model pins are in `src/agent/client.ts` (created in ticket #06) — do not change them without updating the audit version string
- All LLM calls go through `src/lib/ai.ts` — never instantiate the Anthropic SDK directly in feature code
- Prompt versions use format `<role>_v<N>`; bump on every prompt change that could affect output
