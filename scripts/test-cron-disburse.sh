#!/usr/bin/env bash
# Run after pnpm dev is restarted with CRON_SECRET set in .env.local
set -u

BASE="${BASE:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-your-cron-secret}"
FAILED=0

echo "=== Cron Disburse Tests ==="

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

# 1. No auth -> 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cron/disburse-landlord" --max-time 10)
check_status "No auth" "401" "$STATUS"

# 2. Wrong secret -> 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer wrong-secret" \
  "$BASE/api/cron/disburse-landlord" --max-time 10)
check_status "Wrong secret" "401" "$STATUS"

# 3. Correct secret -> 200
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$BASE/api/cron/disburse-landlord" --max-time 15)
check_status "Correct secret" "200" "$STATUS"

exit "$FAILED"
