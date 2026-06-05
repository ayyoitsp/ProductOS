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
- **Internal-to-internal transitions become vertical arrows between boxes.** The action label (derived from the element's `label`, lowercased — "+ Add a kid" → "add a kid", "− Spend" → "spend"; for unlabeled elements fall back to element id with dashes-as-spaces) goes to the right of the vertical `│` line, with `▼` just before the target box. Use `┬` on the source bottom border, `┴` on the target top border.
- **Cross-feature transitions fan to the right of the source box**, one per inner row: ` ── action ──► target_id (cross-feature)`.
- **Sibling fork (one source → multiple internal targets at the next row)**: targets render side-by-side. Source bottom forks one row below: source center descends to a horizontal segment that spans to each target's center; each target gets its own vertical drop with action label and ▼.
- **Back edges** (target sits earlier in declaration order): render as right-fan with `(internal — back)` tag instead of a backward-pointing arrow. We don't draw upward arrows.
- **Non-rightmost-in-row boxes**: their fans render *below* the box on dedicated lines (not to the right, since the right side is occupied by the next sibling).
- **Don't list behaviors at the summary level.** Just the flow + rules reference + affected_by.
- End with the **guided question** ("Does this flow look right? Want to change details or view a screen?") — NOT a generic "what's off?".

The CLI tool `productos review` renders this same chart via `src/core/flowchart.ts` — when in doubt, match what it would produce.

### 1a. Auto-analyze on entry — surface suggestions WITHOUT being asked

Right after the summary render, **always run an audit pass** and append a Suggestions section. Don't make the user drill in and notice gaps; surface them up front so they can pick what to address.

**What to audit (walk the whole feature once):**

For **each UX view**:
- Count interactive elements (button / input / link / cta / select / checkbox / radio / toggle / stepper / card / row). If 2+ interactive elements with 0–1 behaviors anchored to this UX → flag as **HIGH** (probably under-specified — name specific missing rules per §2's gap-flag list).
- Elements with `kind` matching `button|link|cta|card|row` and no `leads_to` → flag if the element name suggests navigation ("kid-card", "view-detail-button") → **MEDIUM**.
- Elements with no `label` whose action would otherwise be derived from a verbose id (e.g. `kid-card` has no label, so the flow shows "kid card") → **LOW** (suggest a `label`).

For **each behavior**:
- 0 test cases → **HIGH** (especially for `status: shipped`).
- 1 test case (happy path only) → **MEDIUM** (suggest one error/edge case).
- Claim mentions API/file/endpoint/status-code language (`POST`, `/api/`, `HTTP 200`, `.tsx`, `function `, `return 4xx`) → **MEDIUM** (suggest a product-language rewrite).
- Behavior id that names a widget rather than a rule (`submit-button-click`, `kid-card-tap`, anything ending in `-click`/`-tap`/`-button`) → **LOW** (suggest a rule-named alternative).
- Behavior with `surface` or `element` that doesn't exist on the feature (dangling anchor) → **HIGH**.

For the **feature as a whole**:
- No `description` → **LOW**.
- 0 behaviors → **HIGH**.
- `status: shipped` but 0 behaviors with any test cases → **HIGH**.

**Render the audit like this** (after the summary, before the guided question):

```
─── Suggestions ────────────────────────────────────

HIGH:
  1. earn-form has 3 interactive elements but only 1 behavior anchored. Likely
     missing rules: amount-must-be-positive, submit-disabled-until-valid,
     reason-is-optional, amount-autofocuses-on-open, server-failure-keeps-form-open.
  2. behavior `earn-flow` (status: shipped) has 0 test cases.

MEDIUM:
  3. behavior `balance-is-derived` claim references "the underlying ledger" —
     slightly implementation-leaning. Suggest: "A kid's balance is always the sum
     of their transactions; there's no place a stale value could appear."
  4. behavior `tap-kid` has only 1 test case (happy path). Could add: tapping a
     kid with $0 balance still navigates correctly.

LOW:
  5. element `kid-card` on family-list has no label — flow shows "kid card" as
     the action. Suggest label: "tap a kid".
  6. feature has no `description`.

Pick numbers to apply (e.g. "1, 3, 5"), say "all", or describe what to do.
```

**Then** end with the guided question. The user can engage with the suggestions OR ignore them and drill into something else — both are fine.

**Apply rules:**
- When the user picks numbers, apply each via the appropriate MCP tool (`productos_add_behavior` for missing-coverage suggestions, `productos_update_behavior` for claim rewrites or test-case additions, `productos_add_or_replace_element` for label additions, `productos_update_feature` for description). Then re-render the summary so they see what changed.
- "all" → apply all HIGH and MEDIUM items at once, skip LOW (the noisy nice-to-haves). Confirm in one line afterward.
- If a suggestion involves multiple sub-items (e.g. "missing rules: X, Y, Z"), expand inline so the user can pick a subset: ask "Apply all 5 of those? Or pick a subset (e.g. 'X and Z only')?".
- Don't get stuck in an audit loop — after applying, re-render the summary + run audit again. If audit comes back empty, just say "Looks clean. Anything else?".

**This auto-analysis is the main value-add of review.** Without it the skill is just an editor; with it it's the second pair of eyes the PM came for.

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

### Proactively flag coverage gaps when you drill in

Right after rendering a UX drilled view, **assess coverage**. Don't make the user notice the gap and ask. If the behaviors look thin for the elements present, surface specific candidates:

- **Empty or 1 behavior with 2+ interactive elements** → almost certainly under-specified
- **Inputs without validation behaviors** (e.g. amount-input with no claim about "rejects negatives" or "requires positive")
- **Buttons with conditional state** (e.g. a "Submit" button whose `notes` say "disabled until valid" — that disabled-state rule isn't captured as a behavior)
- **Optional fields with implied defaults** (e.g. reason-input optional → what's the default label? not captured)
- **Forms with navigation** (e.g. submit returns to X — captured? what about cancel/back?)
- **Autofocus / first-render rules** (e.g. "amount input autofocuses when form opens")

When you see thin coverage, append a section after the render:

```
Coverage looks thin here — 3 interactive elements, 1 behavior. Candidates I see:

  1. **Amount must be positive.** Submitting zero or negative shows an error and the
     form doesn't submit.
  2. **Submit disabled until amount > 0.** The button's enabled state tracks the
     amount input.
  3. **Empty reason defaults to "Earned".** When the parent leaves Reason blank, the
     transaction row label is "Earned" rather than empty.
  4. **Amount input autofocuses on open.** When the form mounts, focus lands in the
     Amount field.

Want me to add any? Pick the numbers — or "all" — and I'll add them with test cases.
```

Frame candidates as **rule-style claims** in product language. NO API/file references. Anchor each candidate to the appropriate element + interaction when the candidate is about a specific element. Wait for the user to pick before writing — don't bulk-add. If the user picks "1, 2, 4", apply just those via `productos_add_behavior` (with appropriate `surface`/`element`/`interaction` anchors and short `test_cases`), then re-render the UX drilled view so they see the new behaviors land.

This proactive gap-flag IS in-scope for review — it's about the focused UX. (Whole-feature gap analysis is still `productos-fullscan` territory.)

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

### Proactively flag thin test-case coverage

Right after rendering a behavior drilled view, **assess test-case coverage**. If the claim has obvious edge cases or alternate paths that aren't covered, surface them:

- **0 test cases** → flag immediately
- **Only happy path covered** → suggest at least one error/edge case
- **Claims mentioning "always", "never", "only when"** → suggest the negation case
- **Numeric / range claims** → suggest boundary cases (zero, max, negative)
- **Network/persistence claims** → suggest failure-mode cases (offline, conflict, retry)

When you see thin coverage, append:

```
Test coverage looks thin — happy path only. Candidates:

  3. (e2e) Submitting zero amount: form rejects and stays on the page.
  4. (e2e) Submitting negative amount: input clamps to zero before submit fires.
  5. (api) Network failure on submit: the form re-enables and shows a retry message.

Add any? Pick numbers or "all".
```

On confirmation, apply via `productos_update_behavior(..., { test_cases: [...new full array...] })` and re-render the behavior. **Pick stable numeric ids** that continue from the existing ones.

Same scope rule: only test cases for the focused behavior. Whole-feature gap analysis is `productos-fullscan`.

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

**Edit history (undo recent writes):**
- `productos_list_edits({ feature_id })` — recent on-disk snapshots taken before each edit. Most recent first; each entry has timestamp + age.
- `productos_undo_edit({ feature_id, index? })` — restore a snapshot (default index 1 = most recent). Use when the user reacts negatively to a change you just made ("no, that was wrong", "put it back", "undo that"). The current state is itself snapshotted before restore, so undo is reversible — call again to walk further back.

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
- **When the user reacts negatively to a change you just made** ("no", "that's wrong", "put it back", "I didn't want that"), call `productos_undo_edit` BEFORE making other changes. Don't try to compose a fix on top of a bad edit — undo it cleanly first, then redo.
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
