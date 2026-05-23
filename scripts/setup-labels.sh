#!/usr/bin/env bash
# RentPilot AI — GitHub labels setup
# Idempotent: uses `--force` so re-runs update colors/descriptions in place.
# Usage: bash scripts/setup-labels.sh

set -euo pipefail

# Sanity-check we're authenticated
if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh CLI not authenticated. Run \`gh auth login\` first." >&2
  exit 1
fi

REPO="$(gh repo view --json owner,name -q '.owner.login + "/" + .name')"
echo "Setting up labels in $REPO"
echo ""

# Phase labels — distinct colours so the board reads at a glance
gh label create "phase-0" --color "ededed" --description "Phase 0 — Bootstrap"               --force
gh label create "phase-1" --color "d4c5f9" --description "Phase 1 — Type contracts"          --force
gh label create "phase-2" --color "c5d4f9" --description "Phase 2 — Foundational utils"      --force
gh label create "phase-3" --color "c5e6f9" --description "Phase 3 — Database + seed"         --force
gh label create "phase-4" --color "c5f9d6" --description "Phase 4 — Compliance + Fairness"   --force
gh label create "phase-5" --color "f9e6c5" --description "Phase 5 — Agent core"              --force
gh label create "phase-6" --color "f9d4c5" --description "Phase 6 — Stripe flows"            --force
gh label create "phase-7" --color "f9c5e6" --description "Phase 7 — Webhooks"                --force
gh label create "phase-8" --color "e6c5f9" --description "Phase 8 — UI"                      --force
gh label create "phase-9" --color "f9c5c5" --description "Phase 9 — Demo prep"               --force

# Area labels
gh label create "area:agent"  --color "bfdadc" --description "Agent core: prompts, runner, compliance, fairness, redactor" --force
gh label create "area:stripe" --color "635bff" --description "Stripe SDK, Connect, Invoices, transfers, webhooks"          --force
gh label create "area:ui"     --color "fbca04" --description "Dashboard, case detail, modals, components"                  --force
gh label create "area:db"     --color "4f9d4f" --description "Drizzle schema, seeds, queries"                              --force
gh label create "area:infra"  --color "555555" --description "Scaffolding, CI, env, tooling, utils, demo prep"             --force

# Priority
gh label create "priority:critical-path" --color "b60205" --description "On the critical path — blocks the demo if late" --force

echo ""
echo "✓ Labels created/updated. Run \`gh label list\` to verify."
