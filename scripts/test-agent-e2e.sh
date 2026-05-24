#!/usr/bin/env bash
# Run after pnpm dev is restarted with GEMINI_API_KEY set in .env.local
BASE=http://localhost:3000
CASE_ID="01000000-0000-4000-a000-000000000001"

echo "=== Agent E2E Tests ==="

# 1. Missing case_id → 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/agent/counterfactual \
  -H "Content-Type: application/json" -d '{}' --max-time 10)
[ "$STATUS" = "400" ] && echo "PASS: Missing case_id → 400" || echo "FAIL: → $STATUS (expected 400)"

# 2. Full agent run (allow up to 90s for Gemini)
echo "Running full agent pipeline (up to 90s)..."
RESPONSE=$(curl -s -X POST $BASE/api/agent/counterfactual \
  -H "Content-Type: application/json" \
  -d "{\"case_id\":\"$CASE_ID\"}" \
  --max-time 90)
ACTION=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('action',{}).get('kind','MISSING'))" 2>/dev/null)
COMPLIANCE=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('compliance_check',{}).get('overall','MISSING'))" 2>/dev/null)
FAIRNESS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('fairness_check',{}).get('overall','MISSING'))" 2>/dev/null)
echo "action.kind = $ACTION"
echo "compliance.overall = $COMPLIANCE"
echo "fairness.overall = $FAIRNESS"
[ "$ACTION" != "MISSING" ] && echo "PASS: Agent returned valid response" || echo "FAIL: No action in response"
