#!/usr/bin/env bash
# Run after pnpm dev is restarted with GEMINI_API_KEY set in .env.local
BASE=http://localhost:3000

echo "=== Stripe Webhook Tests ==="

# 1. No signature → 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/stripe/webhook \
  -H "Content-Type: text/plain" -d '{}' --max-time 10)
[ "$STATUS" = "400" ] && echo "PASS: No sig → 400" || echo "FAIL: No sig → $STATUS (expected 400)"

# 2. Bad signature → 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/stripe/webhook \
  -H "Content-Type: text/plain" \
  -H "stripe-signature: t=1,v1=badhash" \
  -d '{}' --max-time 10)
[ "$STATUS" = "400" ] && echo "PASS: Bad sig → 400" || echo "FAIL: Bad sig → $STATUS (expected 400)"

echo "Done. Valid signed event: use 'stripe trigger invoice.paid' with stripe CLI."
