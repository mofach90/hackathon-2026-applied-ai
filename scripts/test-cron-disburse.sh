#!/usr/bin/env bash
# Run after pnpm dev is restarted with CRON_SECRET set in .env.local
BASE=http://localhost:3000
CRON_SECRET="${CRON_SECRET:-your-cron-secret}"

echo "=== Cron Disburse Tests ==="

# 1. No auth → 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/cron/disburse-landlord --max-time 10)
[ "$STATUS" = "401" ] && echo "PASS: No auth → 401" || echo "FAIL: → $STATUS (expected 401)"

# 2. Wrong secret → 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer wrong-secret" \
  $BASE/api/cron/disburse-landlord --max-time 10)
[ "$STATUS" = "401" ] && echo "PASS: Wrong secret → 401" || echo "FAIL: → $STATUS (expected 401)"

# 3. Correct secret → 200
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  $BASE/api/cron/disburse-landlord --max-time 15)
[ "$STATUS" = "200" ] && echo "PASS: Correct secret → 200" || echo "FAIL: → $STATUS (expected 200)"
