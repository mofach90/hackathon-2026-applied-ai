# Feature Test Results

Last verified: 2026-05-24 against master (5bd830c)

## UI Features (no API key required)

| Feature | Route | Status |
|---------|-------|--------|
| Dashboard + case list | `GET /` | ✅ PASS |
| Case detail | `GET /cases/[id]` | ✅ PASS (all 3 seeded cases) |
| Compliance badges | in case detail | ✅ PASS |
| Fairness / counterfactual | in case detail | ✅ PASS |
| Approval queue | `GET /cases/[id]/actions` | ✅ PASS |
| Plan modal UI | in case detail | ✅ PASS |
| 404 for unknown case | `GET /cases/unknown-id` | ✅ PASS |

## API Features (require keys in .env.local + server restart)

| Feature | Route | Status |
|---------|-------|--------|
| Stripe webhook | `POST /api/stripe/webhook` | ⏳ Needs server restart |
| Cron disburse | `GET /api/cron/disburse-landlord` | ⏳ Needs server restart |
| Plan confirm | `POST /api/agent/plan/confirm` | ⏳ Needs server restart |
| Agent E2E / counterfactual | `POST /api/agent/counterfactual` | ⏳ Needs server restart |

## Unit Tests

110/110 passing across 17 test files.
