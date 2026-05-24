#!/usr/bin/env bash
# Run after pnpm dev is restarted with STRIPE_SECRET_KEY set in .env.local
set -u

BASE="${BASE:-http://localhost:3000}"
TENANT_ID="${TENANT_ID:-c1000000-0000-0000-0000-000000000001}"
FAILED=0

echo "=== Plan Confirm Tests ==="

check_status() {
  local label="$1"
  local expected="$2"
  local actual="$3"

  if [ "$actual" = "$expected" ]; then
    echo "PASS: $label -> $expected"
  else
    echo "FAIL: $label -> $actual (expected $expected)"
    FAILED=1
  fi
}

# 1. Missing params -> 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/agent/plan/confirm" \
  -H "Content-Type: application/json" -d '{}' --max-time 10)
check_status "Missing params" "400" "$STATUS"

# 2. Valid params (needs real tenant_id from DB)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/agent/plan/confirm" \
  -H "Content-Type: application/json" \
  -d "{\"tenant_id\":\"$TENANT_ID\",\"amount_cents\":120000,\"installments\":3}" \
  --max-time 30)
check_status "Plan created" "200" "$STATUS"

exit "$FAILED"
