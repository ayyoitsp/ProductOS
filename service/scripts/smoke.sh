#!/usr/bin/env bash
# End-to-end smoke test. Assumes the service is running on $PORT (default 4100)
# and that .env holds the two credentials.
#
# Exercises: setup context -> decision -> capability -> feature -> edges ->
# validation -> packet, plus every enforcement gate.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-4100}"
BASE="${BASE:-http://localhost:$PORT}"
S=$(grep '^PRODUCTOS_SECRET' .env | cut -d= -f2 | tr -d '"')
H=$(grep '^PRODUCTOS_HUMAN_SECRET' .env | cut -d= -f2 | tr -d '"')
A=(-s -H "x-productos-secret: $S" -H "content-type: application/json")

pass=0; fail=0
check() { # name expected actual
  if [[ "$3" == *"$2"* ]]; then echo "  ✓ $1"; pass=$((pass+1));
  else echo "  ✗ $1"; echo "     expected to contain: $2"; echo "     got: ${3:0:200}"; fail=$((fail+1)); fi
}

echo "── setup: product framing ──"
check "non-goal captured" '"kind":"non_goal"' "$(curl "${A[@]}" -X PUT $BASE/api/context -d '{"id":"non-goal/no-real-money","kind":"non_goal","title":"No real bank accounts","body":"Balances are play money. We never connect to a real financial institution."}')"
check "persona captured" '"kind":"persona"' "$(curl "${A[@]}" -X PUT $BASE/api/context -d '{"id":"persona/parent","kind":"persona","title":"Parent","body":"Manages allowances for one or more kids; wants under 5 minutes a week of admin."}')"

echo "── decisions ──"
curl "${A[@]}" -X POST $BASE/api/context/decisions -d '{"id":"d-001","title":"Interest is opt-in, never a default","decidedOn":"2026-07-30","owner":"peter","context":"Rates are unbounded by design; an always-on default compounds a number the parent never chose.","alternatives":["Always-on at 1%/week — rejected: picks a financial opinion we do not want to own"],"chosen":"Interest is off until a parent enables it per kid"}' > /dev/null
check "decision exists" '"id":"d-001"' "$(curl "${A[@]}" $BASE/api/context/decisions)"
check "decision immutable" 'decision_immutable' "$(curl "${A[@]}" -X POST $BASE/api/context/decisions -d '{"id":"d-001","title":"Rewritten","decidedOn":"2026-08-01","context":"x","chosen":"y"}')"
check "reaffirm records date" '"status":"active"' "$(curl "${A[@]}" -X POST $BASE/api/context/decisions/d-001/reaffirm)"

echo "── capability ──"
curl "${A[@]}" -X PUT $BASE/api/containers -d '{"id":"ledger/interest","kind":"capability","title":"Interest accrual","lifecycle":"built"}' > /dev/null
check "capability behavior" '"id":"applies-on-selected-days"' "$(curl "${A[@]}" -X PUT $BASE/api/behaviors -d '{"containerId":"ledger/interest","id":"applies-on-selected-days","claim":"Given a kid with interest enabled, a balance accrues interest only on the days a parent selected","lifecycle":"built"}')"
curl "${A[@]}" -H "x-productos-human: $H" -X POST $BASE/api/validations -d '{"containerId":"ledger/interest","behaviorId":"applies-on-selected-days","actor":"peter"}' > /dev/null

echo "── sibling (regression surface) ──"
curl "${A[@]}" -X PUT $BASE/api/containers -d '{"id":"ledger/task-completion","kind":"feature","title":"Completing a task","lifecycle":"built"}' > /dev/null
curl "${A[@]}" -X PUT $BASE/api/behaviors -d '{"containerId":"ledger/task-completion","id":"credits-balance","claim":"Completing a task credits the kid balance by the task reward amount","lifecycle":"built"}' > /dev/null
curl "${A[@]}" -H "x-productos-human: $H" -X POST $BASE/api/validations -d '{"containerId":"ledger/task-completion","behaviorId":"credits-balance","actor":"peter"}' > /dev/null

echo "── feature + graph ──"
curl "${A[@]}" -X PUT $BASE/api/containers -d '{"id":"ledger/adjust-balance","kind":"feature","title":"Adjust a balance","goal":"Let a parent correct a balance when life happened offline, without making the kid feel punished.","lifecycle":"planned"}' > /dev/null
curl "${A[@]}" -X PUT $BASE/api/surfaces -d '{"id":"adjust-modal","title":"Adjust balance modal","path":"/adjust/:id"}' > /dev/null
check "element with flow" '"leadsTo"' "$(curl "${A[@]}" -X PUT $BASE/api/surfaces/elements -d '{"surfaceId":"adjust-modal","id":"confirm-button","kind":"button","label":"Confirm","leadsTo":"adjust-modal"}')"
check "behavior anchored" '"surfaceId":"adjust-modal"' "$(curl "${A[@]}" -X PUT $BASE/api/behaviors -d '{"containerId":"ledger/adjust-balance","id":"manual-adjustment-recorded","claim":"When a parent confirms an adjustment, the kid balance changes by that amount and the change is listed in history","surfaceId":"adjust-modal","elementId":"confirm-button","interaction":"click"}')"
check "depends_on capability" '"toId":"ledger/interest"' "$(curl "${A[@]}" -X POST $BASE/api/edges -d '{"kind":"depends_on","fromType":"container","fromId":"ledger/adjust-balance","toType":"container","toId":"ledger/interest"}')"
check "depends_on rejects feature" 'depends_on_requires_capability' "$(curl "${A[@]}" -X POST $BASE/api/edges -d '{"kind":"depends_on","fromType":"container","fromId":"ledger/interest","toType":"container","toId":"ledger/adjust-balance"}')"
check "decided_by link" '"toId":"d-001"' "$(curl "${A[@]}" -X POST $BASE/api/edges -d '{"kind":"decided_by","fromType":"behavior","fromId":"ledger/adjust-balance#manual-adjustment-recorded","toType":"decision","toId":"d-001"}')"

echo "── enforcement gates ──"
check "linter rejects implementation" 'claim_rejected' "$(curl "${A[@]}" -X PUT $BASE/api/behaviors -d '{"containerId":"ledger/adjust-balance","id":"impl","claim":"POST /api/adjust writes a row to the transactions table and returns 201"}')"
check "duplicate rejected" 'duplicate_claim' "$(curl "${A[@]}" -X PUT $BASE/api/behaviors -d '{"containerId":"ledger/adjust-balance","id":"dupe","claim":"When a parent confirms an adjustment the kid balance changes by that amount and the change is listed in the history"}')"
check "agent cannot validate" 'human_validation_required' "$(curl "${A[@]}" -X POST $BASE/api/validations -d '{"containerId":"ledger/adjust-balance","behaviorId":"manual-adjustment-recorded","actor":"agent"}')"
check "kind is immutable" 'kind_immutable' "$(curl "${A[@]}" -X PUT $BASE/api/containers -d '{"id":"ledger/interest","kind":"feature","title":"Interest accrual"}')"

echo "── packet ──"
PACKET=$(curl "${A[@]}" "$BASE/api/packet/ledger/adjust-balance?format=md")
check "packet leads with goal" "## Goal" "$PACKET"
check "goal text present" "without making the kid feel punished" "$PACKET"
check "constraints section" "## Constraints" "$PACKET"
check "acceptance criteria section" "## Acceptance criteria" "$PACKET"
check "latitude section" "## Latitude" "$PACKET"
check "packet has context" "No real bank accounts" "$PACKET"
check "packet has decision" "d-001" "$PACKET"
check "packet has behavior" "manual-adjustment-recorded" "$PACKET"
check "packet has capability promise" "accrues interest only on the days" "$PACKET"
check "must-not-regress section renders" "## Must not regress" "$PACKET"
check "must-not-regress has the sibling" "ledger/task-completion#credits-balance" "$PACKET"
check "must-not-regress excludes dependency (no dupe)" "1" "$(grep -c 'accrues interest only on the days' <<< "$PACKET")"
check "packet excludes implementation" "AGENTS.md" "$PACKET"

echo
echo "passed: $pass   failed: $fail"
[[ $fail -eq 0 ]] || exit 1
