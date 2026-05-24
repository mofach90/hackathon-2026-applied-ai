#!/usr/bin/env bash
# Run after pnpm dev is restarted with STRIPE_SECRET_KEY set in .env.local
BASE=http://localhost:3000

echo "=== Plan Confirm Tests ==="

# 1. Missing params → 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/agent/plan/confirm \
  -H "Content-Type: application/json" -d '{}' --max-time 10)
[ "$STATUS" = "400" ] && echo "PASS: Missing params → 400" || echo "FAIL: → $STATUS (expected 400)"

# 2. Valid params (needs real tenant_id from DB)
TENANT_ID="c1000000-0000-4000-a000-000000000001"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/agent/plan/confirm \
  -H "Content-Type: application/json" \
  -d "{\"tenant_id\":\"$TENANT_ID\",\"amount_cents\":120000,\"installments\":3}" \
  --max-time 15)
[ "$STATUS" = "200" ] && echo "PASS: Plan created → 200" || echo "FAIL: → $STATUS (expected 200)"
