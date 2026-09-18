#!/usr/bin/env bash
# Seed Family Wallet product truth through the API, so every gate applies.
# Surfaces mirror the demo app's actual routes under demo/app/.
set -uo pipefail
cd "$(dirname "$0")/.."

BASE="${BASE:-http://localhost:${PORT:-4100}}"
S=$(grep '^PRODUCTOS_SECRET' .env | cut -d= -f2 | tr -d '"')
H=$(grep '^PRODUCTOS_HUMAN_SECRET' .env | cut -d= -f2 | tr -d '"')
A=(-s -H "x-productos-secret: $S" -H "content-type: application/json")
q() { curl "${A[@]}" "$@" > /dev/null; }

echo "→ context"
q -X PUT $BASE/api/context -d '{"id":"non-goal/no-real-money","kind":"non_goal","title":"No real bank accounts","body":"Balances are play money. We never connect to a real financial institution, and we never move real funds."}'
q -X PUT $BASE/api/context -d '{"id":"non-goal/no-anti-fraud","kind":"non_goal","title":"No anti-fraud","body":"This is trust-based. A parent can set any number they like; we do not police it."}'
q -X PUT $BASE/api/context -d '{"id":"principle/never-punishing","kind":"principle","title":"Numbers feel rewarding, never punishing","body":"Balances going up should feel good. Balances going down should feel factual, not like a telling-off."}'
q -X PUT $BASE/api/context -d '{"id":"principle/parents-in-control","kind":"principle","title":"Parents stay in control","body":"Kids can see and suggest. Parents decide. Every change to a balance is a parent action."}'
q -X PUT $BASE/api/context -d '{"id":"persona/parent","kind":"persona","title":"Parent","body":"Manages allowances for one or more kids. Wants under five minutes a week of admin."}'
q -X PUT $BASE/api/context -d '{"id":"glossary/kid","kind":"glossary","title":"Kid","body":"A child profile owned by a parent account. Holds a balance and a task list."}'
q -X PUT $BASE/api/context -d '{"id":"glossary/adjustment","kind":"glossary","title":"Adjustment","body":"A manual balance change made by a parent, positive or negative, with a reason."}'

echo "→ decisions"
q -X POST $BASE/api/context/decisions -d '{"id":"d-001","title":"Interest is opt-in, never a default","decidedOn":"2026-07-30","owner":"peter","context":"Parents asked for interest to just work without setup. But rates are unbounded by design — a parent can set 50%/week for a six-year-old — and an always-on default compounds a number the parent never chose.","alternatives":["Always-on at a fixed 1%/week — rejected: picks a financial opinion we do not want to own","Parent-set default applied to new kids — rejected: same failure, one step removed"],"chosen":"Interest is off until a parent enables it per kid"}'
q -X POST $BASE/api/context/decisions -d '{"id":"d-002","title":"Balances may go negative","decidedOn":"2026-07-30","owner":"peter","context":"Clamping at zero hides that a kid overspent, and silently discards a parent adjustment they deliberately made. Showing the real number is more honest and matches a real ledger.","alternatives":["Clamp at zero — rejected: silently discards a parent action","Block the adjustment — rejected: parents stay in control"],"chosen":"A balance can go below zero and is shown as-is"}'

echo "→ surfaces (from demo/app routes)"
q -X PUT $BASE/api/surfaces -d '{"id":"family-list","title":"Family list","path":"/(tabs)/(family)","sketch":"┌────────────────────────────────┐\n│  Family                    [+] │\n├────────────────────────────────┤\n│  ┌──────────────────────────┐  │\n│  │ Ava                      │  │\n│  │ $12.50          [Adjust] │  │\n│  └──────────────────────────┘  │\n│  ┌──────────────────────────┐  │\n│  │ Noah                     │  │\n│  │ -$2.00          [Adjust] │  │\n│  └──────────────────────────┘  │\n├────────────────────────────────┤\n│  Family   Tasks    Settings    │\n└────────────────────────────────┘"}'
q -X PUT $BASE/api/surfaces -d '{"id":"add-kid","title":"Add a kid","path":"/add-kid","sketch":"┌────────────────────────────────┐\n│  ← Add a kid                   │\n├────────────────────────────────┤\n│  Name                          │\n│  ┌──────────────────────────┐  │\n│  │                          │  │\n│  └──────────────────────────┘  │\n│  Starting balance              │\n│  ┌──────────────────────────┐  │\n│  │ 0.00                     │  │\n│  └──────────────────────────┘  │\n│           [      Save      ]   │\n└────────────────────────────────┘"}'
q -X PUT $BASE/api/surfaces -d '{"id":"adjust-balance","title":"Adjust a balance","path":"/adjust/[id]","sketch":"┌────────────────────────────────┐\n│  ← Adjust — Ava                │\n├────────────────────────────────┤\n│  Current      $12.50           │\n│                                │\n│  Amount                        │\n│  ┌──────────────────────────┐  │\n│  │ +                        │  │\n│  └──────────────────────────┘  │\n│  Reason                        │\n│  ┌──────────────────────────┐  │\n│  │                          │  │\n│  └──────────────────────────┘  │\n│           [    Confirm     ]   │\n└────────────────────────────────┘"}'
q -X PUT $BASE/api/surfaces -d '{"id":"task-list","title":"Tasks","path":"/(tabs)/tasks","sketch":"┌────────────────────────────────┐\n│  Tasks                     [+] │\n├────────────────────────────────┤\n│  ☐ Make bed            Ava $1  │\n│  ☐ Dishes             Noah $2  │\n│  ☑ Homework            Ava $3  │\n├────────────────────────────────┤\n│  Family   Tasks    Settings    │\n└────────────────────────────────┘"}'
q -X PUT $BASE/api/surfaces -d '{"id":"settings","title":"Settings","path":"/(tabs)/settings","sketch":"┌────────────────────────────────┐\n│  Settings                      │\n├────────────────────────────────┤\n│  Interest                      │\n│    Enabled           [  ○—  ]  │\n│    Rate per week      [ 1.0 %] │\n│    Applies on                  │\n│      M T W T F S S             │\n│      ☐ ☐ ☑ ☐ ☐ ☐ ☐             │\n└────────────────────────────────┘"}'

echo "→ elements"
q -X PUT $BASE/api/surfaces/elements -d '{"surfaceId":"family-list","id":"add-kid-button","kind":"button","label":"+","leadsTo":"add-kid"}'
q -X PUT $BASE/api/surfaces/elements -d '{"surfaceId":"family-list","id":"adjust-button","kind":"button","label":"Adjust","leadsTo":"adjust-balance"}'
q -X PUT $BASE/api/surfaces/elements -d '{"surfaceId":"add-kid","id":"name-input","kind":"input","label":"Name"}'
q -X PUT $BASE/api/surfaces/elements -d '{"surfaceId":"add-kid","id":"save-button","kind":"button","label":"Save","leadsTo":"family-list"}'
q -X PUT $BASE/api/surfaces/elements -d '{"surfaceId":"adjust-balance","id":"amount-input","kind":"input","label":"Amount"}'
q -X PUT $BASE/api/surfaces/elements -d '{"surfaceId":"adjust-balance","id":"reason-input","kind":"input","label":"Reason"}'
q -X PUT $BASE/api/surfaces/elements -d '{"surfaceId":"adjust-balance","id":"confirm-button","kind":"button","label":"Confirm","leadsTo":"family-list"}'
q -X PUT $BASE/api/surfaces/elements -d '{"surfaceId":"task-list","id":"complete-checkbox","kind":"checkbox","label":"Complete"}'
q -X PUT $BASE/api/surfaces/elements -d '{"surfaceId":"settings","id":"interest-toggle","kind":"toggle","label":"Interest enabled"}'
q -X PUT $BASE/api/surfaces/elements -d '{"surfaceId":"settings","id":"day-picker","kind":"day-picker","label":"Applies on"}'

echo "→ capability: interest accrual"
q -X PUT $BASE/api/containers -d '{"id":"ledger/interest","kind":"capability","title":"Interest accrual","goal":"Let a balance grow on its own so saving feels like it pays off, without us picking a financial opinion for the family.","lifecycle":"built"}'
q -X PUT $BASE/api/behaviors -d '{"containerId":"ledger/interest","id":"only-on-selected-days","claim":"Given a kid with interest enabled, the balance grows only on the weekdays a parent selected","lifecycle":"built"}'
q -X POST $BASE/api/testcases -d '{"containerId":"ledger/interest","behaviorId":"only-on-selected-days","description":"Accrues on a selected day","given":"a kid with interest enabled and Wednesday selected","when":"Wednesday passes","then":"the balance has grown by the configured rate"}'
q -X POST $BASE/api/testcases -d '{"containerId":"ledger/interest","behaviorId":"only-on-selected-days","description":"Does not accrue on an unselected day","given":"a kid with interest enabled and only Wednesday selected","when":"Thursday passes","then":"the balance is unchanged"}'
q -X PUT $BASE/api/behaviors -d '{"containerId":"ledger/interest","id":"off-until-enabled","claim":"A kid accrues nothing until a parent turns interest on for that kid","lifecycle":"built","surfaceId":"settings","elementId":"interest-toggle","interaction":"toggle"}'
q -X POST $BASE/api/testcases -d '{"containerId":"ledger/interest","behaviorId":"off-until-enabled","description":"New kid accrues nothing","given":"a newly added kid","when":"any number of days pass","then":"the balance is unchanged"}'

echo "→ feature: adjust a balance"
q -X PUT $BASE/api/containers -d '{"id":"ledger/adjust-balance","kind":"feature","title":"Adjust a balance","goal":"Let a parent correct a balance when life happened offline, without making the kid feel punished.","lifecycle":"built"}'
q -X PUT $BASE/api/behaviors -d '{"containerId":"ledger/adjust-balance","id":"adjustment-recorded","claim":"When a parent confirms an adjustment, the kid balance changes by that amount and the change appears in their history with the reason given","lifecycle":"built","surfaceId":"adjust-balance","elementId":"confirm-button","interaction":"tap"}'
q -X POST $BASE/api/testcases -d '{"containerId":"ledger/adjust-balance","behaviorId":"adjustment-recorded","description":"Positive adjustment","given":"a kid with a balance of 12.50","when":"a parent confirms +5.00 with reason \"birthday\"","then":"the balance reads 17.50 and history shows +5.00 birthday"}'
q -X POST $BASE/api/testcases -d '{"containerId":"ledger/adjust-balance","behaviorId":"adjustment-recorded","description":"Negative adjustment is recorded, not blocked","given":"a kid with a balance of 2.00","when":"a parent confirms -5.00","then":"the balance reads -3.00 and history shows the deduction"}'
q -X PUT $BASE/api/behaviors -d '{"containerId":"ledger/adjust-balance","id":"reason-is-optional","claim":"A parent can confirm an adjustment without giving a reason, and the history entry simply shows no reason","lifecycle":"built","surfaceId":"adjust-balance","elementId":"reason-input"}'

echo "→ feature: completing a task"
q -X PUT $BASE/api/containers -d '{"id":"ledger/task-completion","kind":"feature","title":"Completing a task","goal":"Turn a chore into a visible reward the moment it is done, so the connection between effort and balance is obvious to a kid.","lifecycle":"built"}'
q -X PUT $BASE/api/behaviors -d '{"containerId":"ledger/task-completion","id":"credits-on-complete","claim":"Marking a task complete credits the assigned kid by the task reward amount and shows in their history","lifecycle":"built","surfaceId":"task-list","elementId":"complete-checkbox","interaction":"tap"}'
q -X POST $BASE/api/testcases -d '{"containerId":"ledger/task-completion","behaviorId":"credits-on-complete","description":"Completion credits the kid","given":"a task worth 3.00 assigned to Ava","when":"a parent marks it complete","then":"Ava balance increases by 3.00 and history shows the task name"}'
q -X POST $BASE/api/testcases -d '{"containerId":"ledger/task-completion","behaviorId":"credits-on-complete","description":"Un-completing reverses the credit","given":"a completed task worth 3.00","when":"a parent un-marks it","then":"the credit is reversed and the history entry is withdrawn"}'

echo "→ feature: adding a kid"
q -X PUT $BASE/api/containers -d '{"id":"family/add-kid","kind":"feature","title":"Adding a kid","goal":"Get a new child into the family in under a minute, so setup never becomes the reason a parent gives up.","lifecycle":"built"}'
q -X PUT $BASE/api/behaviors -d '{"containerId":"family/add-kid","id":"appears-with-starting-balance","claim":"After saving a new kid, they appear in the family list with the starting balance the parent entered","lifecycle":"built","surfaceId":"add-kid","elementId":"save-button","interaction":"tap"}'
q -X POST $BASE/api/testcases -d '{"containerId":"family/add-kid","behaviorId":"appears-with-starting-balance","description":"New kid shows immediately","given":"an empty family","when":"a parent saves a kid named Ava with 10.00","then":"Ava appears in the family list showing 10.00"}'

echo "→ graph"
q -X POST $BASE/api/edges -d '{"kind":"depends_on","fromType":"container","fromId":"ledger/adjust-balance","toType":"container","toId":"ledger/interest"}'
q -X POST $BASE/api/edges -d '{"kind":"depends_on","fromType":"container","fromId":"ledger/task-completion","toType":"container","toId":"ledger/interest"}'
q -X POST $BASE/api/edges -d '{"kind":"affected_by","fromType":"container","fromId":"family/add-kid","toType":"container","toId":"ledger/adjust-balance"}'
q -X POST $BASE/api/edges -d '{"kind":"decided_by","fromType":"behavior","fromId":"ledger/interest#off-until-enabled","toType":"decision","toId":"d-001"}'
q -X POST $BASE/api/edges -d '{"kind":"decided_by","fromType":"behavior","fromId":"ledger/adjust-balance#adjustment-recorded","toType":"decision","toId":"d-002"}'

echo "→ validating the built ones (human credential)"
for pair in "ledger/interest only-on-selected-days" "ledger/interest off-until-enabled" "ledger/task-completion credits-on-complete" "family/add-kid appears-with-starting-balance"; do
  set -- $pair
  curl "${A[@]}" -H "x-productos-human: $H" -X POST $BASE/api/validations \
    -d "{\"containerId\":\"$1\",\"behaviorId\":\"$2\",\"actor\":\"peter\"}" > /dev/null
done

echo "done."
