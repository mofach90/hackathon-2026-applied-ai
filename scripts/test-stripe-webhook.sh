#!/usr/bin/env bash
# Run after pnpm dev is restarted with GEMINI_API_KEY set in .env.local
set -u

BASE="${BASE:-http://localhost:3000}"
FAILED=0

echo "=== Stripe Webhook Tests ==="

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

# 1. No signature -> 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/stripe/webhook" \
  -H "Content-Type: text/plain" -d '{}' --max-time 10)
check_status "No signature" "400" "$STATUS"

# 2. Bad signature -> 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/stripe/webhook" \
  -H "Content-Type: text/plain" \
  -H "stripe-signature: t=1,v1=badhash" \
  -d '{}' --max-time 10)
check_status "Bad signature" "400" "$STATUS"

echo "Done. Valid signed event: use 'stripe trigger invoice.paid' with stripe CLI."
exit "$FAILED"
