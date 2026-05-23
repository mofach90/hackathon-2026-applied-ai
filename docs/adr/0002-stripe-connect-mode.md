# ADR 0002: Stripe Connect Mode + Charge Pattern

- **Status:** Accepted
- **Date:** 2026-05-23
- **Deciders:** Mohamed Ayari, Aymen

## Context

Money flows in three directions in our system:

- Tenants → platform (rent payments)
- Platform → vendors (maintenance payouts)
- Platform → landlords (net-rent disbursements)

Stripe Connect offers three account modes (Standard, Express, Custom) and three charge patterns (direct, destination, separate). Each combination trades off onboarding complexity, balance handling, reporting visibility, and platform liability.

Hackathon constraints:

- ~22 working hours to ship a demo
- Test mode only — no real bank accounts
- Need multiple connected accounts for the demo (3 landlords + 2 vendors)
- Need to demonstrate aggregation: collect from many tenants, hold, then disburse

## Decision

- **Connect account mode for landlords AND vendors: `Express`**
- **Charge pattern: separate charges & transfers** — platform collects, holds in its balance, then issues transfers on its own cadence

## Consequences

### Easier

- Express's Stripe-hosted onboarding means we never build a KYC form
- Separate charges & transfers gives us full control over disbursement timing (weekly/monthly)
- We aggregate many tenant payments into one landlord transfer (matches real property-management bookkeeping)
- We can pay vendors from the same balance pool that holds tenant rent (the "escrow" pattern)
- Reporting is centralized in our platform account — landlords don't need to navigate Stripe themselves

### Harder

- Express onboarding in test mode is occasionally flaky (UI bugs, intermittent timeouts) — we mitigate by pre-creating accounts via API
- The platform balance must be funded in test mode (Stripe Dashboard "Add funds" button — €10k pre-demo)
- Reconciliation responsibility is on us — landlords don't see per-tenant detail in their own Stripe dashboard; we generate statements
- "Where's my money?" support questions route to us, not to Stripe

### Hackathon mitigation plan

- **Skip the live Express onboarding flow during the demo.** Pre-create Express accounts via `stripe.accounts.create()` with prefilled test data before the demo. The dashboard looks live; it's seeded.
- **Pre-fund the platform balance to €10,000** in test mode before recording the Loom and before the live pitch.
- **Document the Add Funds path** in DEVELOPMENT.md so any team member can refresh balance before a rehearsal.

## Alternatives considered

### Standard Connect mode
- **Pro:** Connected account has full Stripe dashboard and sees its own data
- **Con:** OAuth onboarding requires custom button + redirect flow; more moving parts at demo time
- **Verdict:** Too heavy for hackathon. Defer to v2 when landlord self-service matters.

### Custom Connect mode
- **Pro:** Fully white-labeled UI, max control
- **Con:** We build all KYC UI, dispute UI, payout-settings UI — months of work
- **Verdict:** No.

### Direct charges
- **Pro:** Tenant sees landlord branding, money lands in landlord's Connect balance directly
- **Con:** `application_fee` + transfer happen at charge time. No aggregation, no weekly cadence, no escrow pool for vendor payouts
- **Verdict:** Wrong fit. We want to hold + aggregate.

### Destination charges
- **Pro:** Single API call, automatic transfer to landlord on charge
- **Con:** Money moves immediately. Can't pay vendor from the same pool. Can't smooth disbursements.
- **Verdict:** Wrong fit.

## Implementation notes

### Test-account bootstrap

A one-shot script at `scripts/seed-stripe.ts` creates the seed Express accounts:

```ts
async function createTestConnectedAccount(opts: {
  type: "landlord" | "vendor";
  email: string;
  display_name: string;
}) {
  return stripe.accounts.create({
    type: "express",
    country: "DE",
    email: opts.email,
    business_type: "individual",
    business_profile: {
      mcc: opts.type === "landlord" ? "6513" : "1799",  // 6513 = real-estate agents, 1799 = special trade contractors
      url: "https://rentpilot.example",
    },
    capabilities: {
      transfers: { requested: true },
    },
    individual: {
      first_name: "Test",
      last_name: opts.display_name,
      // DOB + address from Stripe test fixtures, see docs link below
    },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: "127.0.0.1" },
  });
}
```

### Tenant `Customer` creation

Tenants are Stripe `Customer` records, **not** Connect accounts:

```ts
await stripe.customers.create({
  email: tenant.email,
  name: tenant.name,
  preferred_locales: [tenant.language],
  metadata: {
    rentpilot_tenant_id: tenant.id,
    rentpilot_property_id: tenant.property_id,
  },
});
```

### Transfer creation (vendor or landlord)

```ts
await stripe.transfers.create({
  amount: eurToCents(net_eur),
  currency: "eur",
  destination: connected_account_id,
  description,
  metadata: {
    rentpilot_kind: "vendor_payout" | "landlord_disbursement",
    rentpilot_case_id: case.id,
    rentpilot_invoice_id: vendor_invoice.id,    // for vendor case
    rentpilot_period: "2026-W23",               // for landlord case
  },
});
```

**Convention:** every Stripe object we create has a `metadata.rentpilot_*` prefix so we can query in Stripe Sigma later (`SELECT * FROM transfers WHERE metadata['rentpilot_kind'] = 'landlord_disbursement'`).

## Open questions

- Production path: use Stripe Treasury to hold funds, or stay on platform balance? Hackathon: platform balance. Production likely Treasury for proper segregation.
- Express + Stripe Tax — when we eventually do VAT, does Express handle it correctly for our DE setup? Out of scope.
- Onboarding link refresh: `account.links.create({ type: "account_onboarding" })` for real users. Not needed for demo.

## References

- `docs/brainstorm/2026-05-23-stripe-data-model.md` — full money-flow diagrams
- Stripe Connect Express: https://stripe.com/docs/connect/express-accounts
- Stripe separate charges & transfers: https://stripe.com/docs/connect/separate-charges-and-transfers
- Stripe test fixtures (DOB/address for Express): https://stripe.com/docs/connect/testing
- ADR-0001 — agent action surface (the actions that drive these calls)
- ADR-0012 — webhook handling for `account.updated`, `transfer.created`, etc.
