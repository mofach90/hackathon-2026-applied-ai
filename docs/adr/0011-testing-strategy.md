# ADR 0011: Testing Strategy

- **Status:** Accepted
- **Date:** 2026-05-23
- **Deciders:** Mohamed Ayari, Aymen

## Context

We have ~22 working hours. Time spent on tests is time not spent shipping. But **zero** tests means a 5pm bug becomes an 11pm bug becomes a 2am demo-killer.

The trick is to test the parts that, if they break, will kill the demo silently — and skip everything else.

What kills demos silently:

- Money math (€600.00 vs 600 vs 60000 cents) — visible only after a real charge
- Time zone math (Berlin vs UTC) — late-detection flag fires wrong day
- PII redaction — bias-check passes a name through, then judges spot it
- Compliance rule outcomes — a "blocked" demo moment that doesn't trigger
- Stripe webhook signature verification — silent failure under load

## Decision

| What | How | Where |
|---|---|---|
| **Typecheck** | `tsc --noEmit` | CI, every PR + push |
| **Lint** | ESLint with `--max-warnings=0` | CI, every PR + push |
| **Unit tests** | Vitest | Only for: money utils, time utils, compliance rules, PII redactor, parsing/validation |
| **Integration tests** | (skip) | — |
| **E2E** | Playwright, **one** smoke test | Manual run before merge to `main`; not in CI |
| **Manual rehearsal** | Loom-quality demo walkthrough | Saturday evening + Sunday morning |

We **do not** test: React components, page rendering, Stripe API call shapes (covered by SDK types), agent output quality (manual eval), CSS.

## Consequences

### Easier

- Tests are scoped to what matters; we keep them green
- CI stays fast (<60s) and useful
- We never re-litigate "should we test this trivial thing"

### Harder

- A regression in something untested (e.g. landlord dashboard render bug) won't be caught by CI — we rely on the rehearsal to catch it
- Stripe API contract drift won't be detected — we depend on the SDK types being right
- Agent output regressions are subjective; we eyeball them during rehearsals

## Alternatives considered

- **Full unit-test coverage.** Pro: pristine. Con: 6+ hours we don't have.
- **No tests at all.** Pro: 100% ship-time. Con: too risky for money + compliance code.
- **Snapshot tests on JSON envelopes.** Pro: catches structural drift. Con: brittle to harmless prompt changes. Skip.

## Implementation notes

### Test runner: Vitest

```bash
pnpm add -D vitest @vitest/ui
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

### What we test (and example file paths)

#### Money utils (`src/lib/money.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { eurToCents, centsToEur, formatEur, applyFeePct } from "./money";

describe("eurToCents", () => {
  it("converts whole euros", () => {
    expect(eurToCents(1200)).toBe(120000);
  });
  it("rounds, never floors", () => {
    expect(eurToCents(1199.995)).toBe(120000);
    expect(eurToCents(1199.994)).toBe(119999);
  });
  it("rejects negatives", () => {
    expect(() => eurToCents(-1)).toThrow();
  });
});

describe("applyFeePct", () => {
  it("8% of €1200 = €96 net €1104", () => {
    const { fee, net } = applyFeePct(120000, 800);   // 800 bps = 8%
    expect(fee).toBe(9600);
    expect(net).toBe(110400);
  });
});
```

#### Time utils (`src/lib/time.test.ts`)

```ts
describe("isContactHours", () => {
  it("21:00 Berlin → false", () => {
    expect(isContactHours(new Date("2026-06-06T19:00:00Z"))).toBe(false); // 21:00 Berlin (CEST)
  });
  it("10:00 Berlin → true", () => {
    expect(isContactHours(new Date("2026-06-06T08:00:00Z"))).toBe(true);  // 10:00 Berlin
  });
});

describe("daysBetween", () => {
  it("respects calendar days, not 24h windows", () => {
    expect(daysBetween(new Date("2026-06-01T23:59:00"), new Date("2026-06-02T00:01:00"))).toBe(1);
  });
});
```

#### Compliance rules (`src/agent/compliance.test.ts`)

```ts
describe("verzug_grace rule", () => {
  it("blocks late_fee_warning when days_late < 7", () => {
    const action = { kind: "late_fee_warning", fee_amount_eur: 50, /* ... */ };
    const ctx = { current_event: { days_late: 3 }, /* ... */ };
    const r = ruleChecks.verzug_grace(action, ctx, COMPLIANCE_POLICY_V1);
    expect(r?.result).toBe("fail");
  });
  it("passes late_fee_warning when days_late >= 7", () => {
    // ...
  });
  it("returns null for non-applicable actions", () => {
    const action = { kind: "soft_nudge", /* ... */ };
    const r = ruleChecks.verzug_grace(action, ctx, COMPLIANCE_POLICY_V1);
    expect(r).toBeNull();
  });
});

describe("late_fee_cap rule", () => {
  it("blocks fee > 5% of monthly rent", () => {
    // 5% of €1200 = €60. Propose €100.
    const r = ruleChecks.late_fee_cap({ kind: "late_fee_warning", fee_amount_eur: 100, /* ... */ }, ctx, POLICY);
    expect(r?.result).toBe("fail");
  });
});
```

#### PII redactor (`src/agent/redactor.test.ts`)

```ts
describe("regexRedact", () => {
  it("redacts simple names", () => {
    expect(regexRedact("Amina Benali called")).toContain("[REDACTED-NAME]");
  });
  it("redacts IBANs", () => {
    expect(regexRedact("DE89370400440532013000")).toContain("[REDACTED-IBAN]");
  });
  it("redacts phone numbers", () => {
    expect(regexRedact("+49 30 12345678")).toContain("[REDACTED-PHONE]");
  });
});
```

#### Zod parsers (`src/agent/types.test.ts`)

Validate that a well-formed `AgentResponse` JSON parses, and a malformed one throws clearly.

### E2E smoke test (`tests/e2e/demo-flow.spec.ts`)

One Playwright test that:

1. Resets demo data (`pnpm demo:reset`)
2. Navigates to the landlord dashboard
3. Clicks into Amina's case
4. Asserts the reasoning chain renders
5. Asserts compliance + fairness badges show "pass"
6. Triggers the plan-negotiation flow
7. Confirms the Stripe Hosted Invoice URL is reachable

Run it before each merge to `main` from local. NOT in CI (needs full stack + Stripe).

### What we eyeball, not test

- Agent reasoning quality — manual rehearsal
- Counterfactual demo — manual click during rehearsal
- Email rendering (tone, language) — manual rehearsal
- Dashboard polish — manual

## Open questions

- Mock Stripe in unit tests? We don't — the touch points are thin and we'd be testing our own mocks. Stripe SDK types catch the call-site stuff.
- Test agent output with fixtures? Tempting, but agent output is non-deterministic and a snapshot test would flap. Skip.
- Pre-push hooks (husky)? Optional — DEVELOPMENT.md recommends them but we don't gate.

## References

- Vitest: https://vitest.dev/
- Playwright: https://playwright.dev/
- ADR-0010 — CI/CD (what runs in CI)
- ADR-0019 — Money & time handling (the discipline being tested)
- DEVELOPMENT.md — manual rehearsal checklist
