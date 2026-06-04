---
name: productos-review
description: Use when the user wants to look at and edit a ProductOS feature conversationally. You render a compact SUMMARY first — a UX flow diagram (which screens lead to which) + behaviors as id+claim only. They talk freely or ask to drill into a SPECIFIC UX view (sketch + elements) or a SPECIFIC behavior (notes + test cases). No information dumps, no walkthroughs, no per-item Y/N. Triggers on "review the X feature", "let's look at X", "anything wrong with X", "open X", "walk me through X", "show me the family-settings screen", "drill into Y".
version: 0.1.0
---

# ProductOS — Review Skill

The user wants to look at one feature and edit it. **Two layers, no dumps:**

1. **Summary (default):** UX flow (id → leads_to map, no sketches) + behaviors as id + claim only.
2. **Drilled-in:** ONE specific item at a time — either a UX view (sketch + elements + leads_to) OR a behavior (claim + notes + test cases).

The point: showing all UX sketches and all test cases at once is overwhelming. Show the map first, drill on request.

The file at `productos/products/<id>.md` is the live feature — every tool call writes the file directly. Git is the commit boundary.

## Trigger phrases

"review wallet/add-kid" · "let's look at wallet/add-kid" · "anything wrong with wallet/add-kid" · "walk me through X" · "open X"

If the user doesn't name a feature, call `productos_list_features` and ask which one.

## 1. Summary render (default state)

Call `productos_get_feature({ id, include_tracking: false })`. You get `{ id, title, status, description, ux, behaviors, affected_by, body }`.

Render compactly. **No sketches at this level. No test-case content.** Just the map and the behavior claims:

```
Add a kid                                                    wallet/add-kid
status: shipped

Parent adds a kid to the family from the family settings.

UX flow:
  family-settings    Family settings
    [add-kid-btn] → add-kid-modal
    [kid-card] → wallet/kid-detail (cross-feature)
  add-kid-modal      Add a kid modal
    [confirm-btn] → wallet/kid-detail (cross-feature)
    [cancel-btn] → family-settings

Behaviors:
  open-modal       [family-settings.add-kid-btn tap]    (2 test cases)
    Tapping + Add a kid opens a modal where the parent enters name + avatar.
  submit-modal     [add-kid-modal.confirm-btn submit]   (1 test case)
    On confirm, a new kid is added with $0 balance and the modal closes.

What's off? Want me to show a UX or a behavior in detail?
```

End with an invitation that names both drill targets (UX view / behavior).

**Important:** the UX flow section just shows id → id edges (with element labels in brackets). NEVER paste the ASCII sketch at the summary level. NEVER list a behavior's test cases at the summary level.

## 2. Drilled-in render — UX view

When the user says "show me family-settings" / "drill into family-settings" / "what does the family-settings screen look like" / etc., render JUST that UX view with full detail:

```
─── family-settings ──────────────────────────────────
title: Family settings   path: /family

┌──────────────────────────────┐
│  Family                      │
│  → Mia      $12.50           │
│  → Leo       $4.00           │
│  [ + Add a kid ]             │
└──────────────────────────────┘

Elements (2):
  add-kid-btn  button  "+ Add a kid"  → add-kid-modal
  kid-card     card    → wallet/kid-detail (cross-feature)

Anything to change? /back to the summary.
```

This is where the sketch goes. Edits here scoped naturally — "drop the kid-card", "the leads_to on add-kid-btn should be wallet/add-kid-modal", "tweak the sketch to add a search row at top", etc.

## 3. Drilled-in render — behavior

When the user says "show me open-modal" / "what are the test cases for open-modal" / etc.:

```
─── open-modal ──────────────────────────────────────
anchor: family-settings.add-kid-btn tap

claim: Tapping + Add a kid opens a modal where the parent enters the kid's name and picks an avatar.
notes: The modal animates in from the bottom; focus lands on the name input.

Test cases (2):
  #1 (e2e)  Modal appears on tap
      given: parent on the family settings page
      when:  they tap the + Add a kid button
      then:  the add-kid modal renders with focus in the name input
  #2 (e2e)  Modal can be dismissed with the cancel link
      ...

Anything to change here? /back to the summary.
```

## 4. Take whatever they say

| They say (summary) | You do |
|---|---|
| "Looks good" / "nothing wrong" | Stop. End cleanly (see §6). |
| "Anything off with the family-settings UX?" | Drill into it (render §2), then give your focused read. |
| "Drop open-modal" | `productos_remove_behavior(...)`. Re-render summary. |
| "Rename this to 'Add a child'" | `productos_update_feature(id, { title: "Add a child" })`. Re-render summary. |
| "show me family-settings" / "drill into add-kid-modal" | Switch to UX drilled render. |
| "show me open-modal" / "what's the claim on submit-modal" | Switch to behavior drilled render. |

| They say (UX drilled on `family-settings`) | You do |
|---|---|
| "Drop kid-card" | `productos_remove_element(feature_id, "family-settings", "kid-card")`. Re-render UX. |
| "Set leads_to on add-kid-btn to add-kid-modal" | `productos_add_or_replace_element(feature_id, "family-settings", { id: "add-kid-btn", kind: "button", label: "+ Add a kid", leads_to: "add-kid-modal" })`. Re-render UX. |
| "Tweak the sketch — add a search row at the top" | `productos_update_ux(feature_id, "family-settings", { sketch: "<new sketch>" })`. Re-render UX. |
| "/back" / "back to summary" | Switch back to summary render. |

| They say (behavior drilled on `open-modal`) | You do |
|---|---|
| "Drop case 2" | `productos_update_behavior(..., { test_cases: <array w/o case 2> })`. Re-render behavior. |
| "Add a test for canceling with X" | Build new full test_cases, `productos_update_behavior(..., { test_cases })`. Re-render behavior. |
| "Rephrase the claim" | `productos_update_behavior(..., { claim: "..." })`. Re-render behavior. |
| "/back" | Switch back to summary render. |

**Re-render after every write.** Skip re-render when answering a question.

## 5. Tools you have

**Read:** `productos_get_feature({ id })` — returns `{ id, title, status, description, ux, behaviors, affected_by, body, tracking? }`.

**Feature-level:** `productos_update_feature({ id, title?, status?, description?, body? })`

**Behaviors:**
- `productos_add_behavior({ feature_id, behavior })`
- `productos_update_behavior({ feature_id, behavior_id, claim?, notes?, surface?, element?, interaction?, test_cases? })` — `test_cases` REPLACES the array (read current, mutate, send)
- `productos_remove_behavior({ feature_id, behavior_id })`

**UX views:**
- `productos_add_or_replace_ux({ feature_id, ux })` — full UxView
- `productos_update_ux({ feature_id, ux_id, title?, sketch?, path?, notes? })`
- `productos_remove_ux({ feature_id, ux_id })` — auto-clears dangling behavior anchors

**Elements:**
- `productos_add_or_replace_element({ feature_id, ux_id, element })`
- `productos_remove_element({ feature_id, ux_id, element_id })`

## 6. Close cleanly

```
Done. Changes this session:
  - Removed behavior create-record
  - Added test case #3 on open-modal
  - Set status to shipped

Commit when ready:
  git add productos/products/wallet/add-kid.md
  git commit -m "review: wallet/add-kid"
```

Skip if no edits.

## Rules

- **Three render states. Summary by default. Drill into ONE UX or ONE behavior on explicit request.**
- **Summary = flow map + behavior id/claim/count.** No sketches. No test cases. No notes.
- **UX drilled = sketch + elements + leads_to.** Sketch goes here, not summary.
- **Behavior drilled = claim + notes + test cases with given/when/then.**
- Re-render after every write. Skip re-render for questions.
- Product language only.
- Ambiguity → one clarifying question.
- Don't bulk-apply judgment calls — list and get OK first.

## Don't

- Don't dump sketches at the summary level. **That's the whole point of layering.**
- Don't dump test cases at the summary level. Same.
- Don't open a browser. They picked Claude.
- Don't propose NEW features. That's `productos-scope`.
- Don't show a fixed menu.

## Defer

- **Surgical scripted edit** → `productos-edit`.
- **NEW feature scope** → `productos-scope`.
- **Broad codebase pass** → `productos-fullscan`.
- **Map tests to behaviors** → `productos-align`.
