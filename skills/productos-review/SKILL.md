---
name: productos-review
description: Use when the user wants to look at and edit a ProductOS feature conversationally. You render an ASCII FLOW CHART of the UX views at the top (with boxes around each screen and arrows between them) + a one-line summary per UX — NOT a behavior dump. They can ask to drill into a specific UX (sketch + elements + anchored behaviors) or a specific behavior (claim + notes + test cases). End each render with a guided question — "does this flow look right? want to view a particular screen?" — not just "what's off?". Triggers on "review the X feature", "let's look at X", "anything wrong with X", "open X", "walk me through X", "show me the family-list screen", "drill into Y".
version: 0.1.0
---

# ProductOS — Review Skill

The user wants to look at one feature and edit it. **Three layers, flow-chart first:**

1. **Summary (default):** ASCII flow chart with **boxes around each UX view**, a one-line summary per UX, arrows showing leads_to between screens. **No behavior list at this level.** Rule/invariant behaviors get a one-line `Rules: id1, id2` reference at the bottom.
2. **UX drilled:** ONE UX view — sketch + elements + the behaviors anchored to it.
3. **Behavior drilled:** ONE behavior — claim + notes + test cases.

The file at `productos/products/<id>.md` is the live feature — every tool call writes the file directly. Git is the commit boundary.

## Trigger phrases

"review wallet/kid-balance" · "let's look at wallet/kid-balance" · "anything wrong with wallet/kid-balance" · "walk me through X" · "open X"

If the user doesn't name a feature, call `productos_list_features` and ask which one.

## 1. Summary render (default state)

Call `productos_get_feature({ id, include_tracking: false })`. Render a real ASCII flow chart — boxes for screens, with **actual arrows connecting them** down the page. Cross-feature transitions fan out to the right of each box.

```
Kid balance                                                wallet/kid-balance
status: shipped

Each kid has a running balance equal to the sum of their transactions.

UX flow:

  ┌─ family-list ──────────────┐
  │ Family list                │ ── add a kid ──► add-kid (cross-feature)
  │ shows each kid's row with  │
  │ name and balance           │
  └──────────────┬─────────────┘
                 │
                 │ tap a kid
                 ▼
  ┌─ kid-detail ─┴─────────────┐
  │ Kid detail                 │ ── earn ──► wallet/earn (cross-feature)
  │ shows current balance +    │ ── spend ──► wallet/spend (cross-feature)
  │ transaction history        │ ── delete a transaction ──► wallet/delete-transaction (cross-feature)
  └────────────────────────────┘

Rules & invariants: balance-is-derived, negative-balances-allowed
Affected by: wallet/earn · wallet/spend · tasks/complete-task · wallet/interest

Does this overall flow look right? Want to change or add details, or view a particular UX screen and its behaviors?
```

**The chart rules — exactly how to render:**

- **Each screen is a box.** Top border carries the id (`┌─ family-list ─...─┐`). Inside: line 1 is the title, line 2+ is a wrapped one-line summary (from the UX view's `notes` field). All boxes share the same width.
- **Internal-to-internal transitions become vertical arrows between boxes.** The action label (derived from the element's `label`, lowercased — "+ Add a kid" → "add a kid"; for unlabeled elements fall back to element id with dashes-as-spaces) goes to the right of the vertical `│` line, with `▼` just before the target box. Use `┬` on the source bottom border, `┴` on the target top border.
- **Cross-feature transitions fan to the right of the source box**, one per inner row: ` ── action ──► target_id (cross-feature)`.
- **Multi-internal-target case**: only the FIRST internal target gets the vertical arrow. Other internal targets render as right-fan with `(internal)` tag instead of `(cross-feature)`. Don't try to draw multiple internal arrows — it gets tangled.
- **Don't list behaviors at the summary level.** Just the flow + rules reference + affected_by.
- End with the **guided question** ("Does this flow look right? Want to change details or view a screen?") — NOT a generic "what's off?".

The CLI tool `productos review` renders this same chart via `src/core/flowchart.ts` — when in doubt, match what it would produce.

## 2. UX drilled-in render

When the user says "show me family-list" / "drill into kid-detail" / etc., render JUST that UX view, with its anchored behaviors:

```
─── family-list ────────────────────────────────────
title: Family list   path: /family

┌──────────────────────────────┐
│  Family                      │
│  → Mia      $12.50           │
│  → Leo       $4.00           │
│  [ + Add a kid ]             │
└──────────────────────────────┘

Elements (2):
  kid-card        card   → kid-detail
  add-kid-button  button  "+ Add a kid"  → add-kid

Behaviors anchored here (1):
  balance-on-family-list  [kid-balance-amount · view]  (2 test cases)
    Each kid's row shows their current balance, kept in sync with the ledger.

  /show <behavior_id> for claim + notes + test cases.

Anything to change here? /back to the summary.
```

This is where the sketch goes. Anchored behaviors live here too — drill from here into the behavior detail.

## 3. Behavior drilled-in render

When the user says "show me balance-on-family-list" / "what are the test cases for X" / etc.:

```
─── balance-on-family-list ──────────────────────────
anchor: family-list.kid-balance-amount view

claim: On the family list, each kid's row shows their current balance, and the number stays in sync when transactions are recorded elsewhere.
notes: Computed via the same derive-from-transactions rule as kid-detail.

Test cases (2):
  #1 (e2e)  Initial render shows correct balance
      given: a kid with three transactions totaling $12.50
      when:  the family list loads
      then:  the row shows $12.50
  #2 (e2e)  Updates when a new transaction lands
      ...

Anything to change here? /back.
```

Rule/invariant behaviors (no anchor) render the same way when the user `/show`s them by id.

## 4. Take whatever they say

| They say (summary) | You do |
|---|---|
| "Looks good" / "ship it" | Stop. End cleanly (see §6). |
| "The flow looks right" | Acknowledge. Stay in summary. |
| "Anything off with the family-list screen?" | Drill into it (render §2), then give your focused read. |
| "Drop balance-on-family-list" | `productos_remove_behavior(...)`. Re-render summary. |
| "Add a UX for the confirm-delete modal" | Ask: should I anchor [these behaviors] to it? Then `productos_add_or_replace_ux(...)`. Re-render summary. |
| "Rename this to 'Per-kid wallet'" | `productos_update_feature(id, { title: "Per-kid wallet" })`. Re-render summary. |
| "show me family-list" / "drill into kid-detail" | Switch to UX drilled render. |
| "show me balance-is-derived" | Switch to behavior drilled render. |

| They say (UX drilled on `family-list`) | You do |
|---|---|
| "Drop kid-card" | `productos_remove_element(...)`. Re-render UX. |
| "Set leads_to on add-kid-button to add-kid-modal" | `productos_add_or_replace_element(...)`. Re-render UX. |
| "Tweak the sketch — add a search row at top" | `productos_update_ux(..., { sketch: "..." })`. Re-render UX. |
| "Anything wrong with this screen?" | YOU give a focused read — missing leads_to, sketch/behavior mismatches. Don't edit yet. |
| "/back" | Switch back to summary. |

| They say (behavior drilled on `open-modal`) | You do |
|---|---|
| "Drop case 2" | `productos_update_behavior(..., { test_cases: <array w/o case 2> })`. Re-render behavior. |
| "Add a test for the empty state" | Build new full test_cases, send. Re-render behavior. |
| "Rephrase the claim" | `productos_update_behavior(..., { claim: "..." })`. Re-render behavior. |
| "/back" | Switch back to summary. |

**Re-render after every write.** Skip re-render when answering a question.

## 5. Tools you have

**Read:** `productos_get_feature({ id })` — returns `{ id, title, status, description, ux, behaviors, affected_by, body, tracking? }`.

**Feature-level:** `productos_update_feature({ id, title?, status?, description?, body? })`

**Behaviors:**
- `productos_add_behavior({ feature_id, behavior })`
- `productos_update_behavior({ feature_id, behavior_id, claim?, notes?, surface?, element?, interaction?, test_cases? })` — `test_cases` REPLACES the array
- `productos_remove_behavior({ feature_id, behavior_id })`

**UX views:**
- `productos_add_or_replace_ux({ feature_id, ux })`
- `productos_update_ux({ feature_id, ux_id, title?, sketch?, path?, notes? })`
- `productos_remove_ux({ feature_id, ux_id })` — auto-clears dangling behavior anchors

**Elements:**
- `productos_add_or_replace_element({ feature_id, ux_id, element })`
- `productos_remove_element({ feature_id, ux_id, element_id })`

## 6. Close cleanly

```
Done. Changes this session:
  - Set leads_to on add-kid-button to add-kid-modal
  - Added test case #3 on balance-on-family-list

Commit when ready:
  git add productos/products/wallet/kid-balance.md
  git commit -m "review: wallet/kid-balance"
```

Skip if no edits.

## Rules

- **Summary = boxed flow chart + UX summaries.** No behavior enumeration.
- **Rules/invariants reference by id only** at the bottom of summary; expand only on `/show <id>`.
- **UX drilled = sketch + elements + anchored behaviors.**
- **Behavior drilled = claim + notes + test cases.**
- **Guided prompt** at the end of each render, not "what's off?".
- Re-render after every write.
- Product language only.
- Ambiguity → one clarifying question.

## Don't

- Don't dump sketches at summary. **That's the whole point of layering.**
- Don't list behaviors at summary. **Same.**
- Don't list test cases at summary or at UX-drilled. Only at behavior-drilled.
- Don't open a browser. They picked Claude.
- Don't propose NEW features. That's `productos-scope`.
- Don't show a fixed menu.

## Defer

- **Surgical scripted edit** → `productos-edit`.
- **NEW feature scope** → `productos-scope`.
- **Broad codebase pass** → `productos-fullscan`.
- **Map tests to behaviors** → `productos-align`.
