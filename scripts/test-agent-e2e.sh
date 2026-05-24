#!/usr/bin/env bash
# Run after pnpm dev is restarted with GEMINI_API_KEY set in .env.local
set -u

BASE="${BASE:-http://localhost:3000}"
CASE_ID="${CASE_ID:-01000000-0000-4000-a000-000000000001}"
FAILED=0

echo "=== Agent E2E Tests ==="

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

# 1. Missing case_id -> 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/agent/counterfactual" \
  -H "Content-Type: application/json" -d '{}' --max-time 10)
check_status "Missing case_id" "400" "$STATUS"

# 2. Full agent run (allow up to 90s for Gemini)
echo "Running full agent pipeline (up to 90s)..."
RESPONSE=$(curl -s -X POST "$BASE/api/agent/counterfactual" \
  -H "Content-Type: application/json" \
  -d "{\"case_id\":\"$CASE_ID\"}" \
  --max-time 90)
ACTION=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('action',{}).get('kind','MISSING'))" 2>/dev/null)
COMPLIANCE=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('compliance_check',{}).get('overall','MISSING'))" 2>/dev/null)
FAIRNESS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('fairness_check',{}).get('overall','MISSING'))" 2>/dev/null)
echo "action.kind = $ACTION"
echo "compliance.overall = $COMPLIANCE"
echo "fairness.overall = $FAIRNESS"
if [ "$ACTION" != "MISSING" ] && [ "$COMPLIANCE" != "MISSING" ] && [ "$FAIRNESS" != "MISSING" ]; then
  echo "PASS: Agent returned valid response"
else
  echo "FAIL: Agent response missing expected fields"
  FAILED=1
fi

exit "$FAILED"
