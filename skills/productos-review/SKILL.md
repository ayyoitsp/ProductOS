---
name: productos-review
description: Use when the user wants to look at and edit a ProductOS feature conversationally. You render a compact SUMMARY first (UX with sketches + behaviors as id+claim only — no test cases, no notes). They talk freely at that level. When they want detail on a specific behavior, you DRILL IN — show notes + test cases for just that one — and they can edit those. No walkthrough, no per-item Y/N, no information dumps. Triggers on "review the X feature", "let's look at X", "anything wrong with X", "open X", "walk me through X", "show me behavior Y on X", "drill into Y".
version: 0.4.0
---

# ProductOS — Review Skill

The user wants to look at one feature and edit it. **Two layers:**

1. **Summary (default):** UX with sketches, behaviors as id + claim only. They talk freely about anything at this level.
2. **Drilled-in:** ONE specific behavior at a time — claim + notes + test cases with given/when/then. Reached by saying "show me X" / "drill into X" / "tell me about X".

The point: don't dump all the test cases and notes for every behavior up front. That's too much. Only show that level when the user asks for it.

The file at `productos/products/<id>.md` is the live feature — every tool call writes the file directly. Git is the commit boundary.

## Trigger phrases

"review wallet/add-kid" · "let's look at wallet/add-kid" · "anything wrong with wallet/add-kid" · "walk me through X" · "open X"

If the user doesn't name a feature, call `productos_list_features` and ask which one.

## 1. Summary render (default state)

Call `productos_get_feature({ id, include_tracking: false })`. You get `{ id, title, status, description, ux, behaviors, affected_by, body }`. Render compactly:

```
Add a kid                                                    wallet/add-kid
status: shipped

Parent adds a kid to the family from the family settings.

UX views:
  family-settings — Family settings  (/family)
    ┌──────────────────────────────┐
    │  Family                      │
    │  → Mia      $12.50           │
    │  [ + Add a kid ]             │
    └──────────────────────────────┘
    elements: add-kid-btn:button→add-kid-modal

Behaviors:
  open-modal       [family-settings.add-kid-btn tap]    (2 test cases)
    Tapping + Add a kid opens a modal where the parent enters name + avatar.
  submit-modal     [add-kid-modal.confirm-btn submit]   (1 test case)
    On confirm, a new kid is added with $0 balance and the modal closes.

What's off, or want to drill into a behavior?
```

**Show behaviors as: id + anchor + count of test cases + the claim.** Don't expand notes. Don't expand test cases. Don't show given/when/then. That's drill-in territory.

End with an invitation that mentions both options: free-form change OR drill in.

## 2. Drilled-in render (one behavior)

When the user says "show me open-modal" / "drill into open-modal" / "what are the test cases for open-modal" / etc., render JUST that behavior with full detail:

```
─── open-modal ──────────────────────────────────
anchor: family-settings.add-kid-btn tap

claim: Tapping + Add a kid opens a modal where the parent enters the kid's name and picks an avatar.
notes: The modal animates in from the bottom; the focus lands on the name input.

Test cases (2):
  #1 (e2e)  Modal appears on tap
      given: parent on the family settings page
      when:  they tap the + Add a kid button
      then:  the add-kid modal renders with focus in the name input
  #2 (e2e)  Modal can be dismissed with the cancel link
      ...

Anything to change here? Or /back to the summary.
```

**At this level, edits scoped to this behavior are obvious** — the user is staring at it. "Drop case 2" → remove it. "Add a test for the empty avatar case" → add. "Rephrase the claim" → update.

If the user asks about a different behavior, switch focus (re-render with the new one). If they want to leave detail, return to the summary render.

## 3. Take whatever they say

Free-form input. Examples — covering both summary and drilled levels:

| They say (summary level) | You do |
|---|---|
| "Looks good" / "nothing wrong" | Stop. End cleanly (see §5). |
| "Anything wrong with the family-settings sketch?" | YOU give a focused read — point out missing leads_to, behaviors not anchored, sketch/behavior mismatches. Don't edit yet. |
| "The second behavior's claim is off — persistence is on submit, not confirm" | `productos_update_behavior(feature_id, "submit-modal", { claim: "..." })`. Re-render summary. |
| "Drop open-modal" | `productos_remove_behavior(...)`. Re-render summary. |
| "Rename this to 'Add a child'" | `productos_update_feature(id, { title: "Add a child" })`. Re-render summary. |
| "show me open-modal" / "drill into submit-modal" / "what about open-modal" | Switch to drilled-in render for that behavior. No edits. |

| They say (drilled level on `open-modal`) | You do |
|---|---|
| "Drop case 2" | `productos_update_behavior(feature_id, "open-modal", { test_cases: <array with case 2 removed> })`. Re-render drilled. |
| "Add a test for canceling with the X button" | Build the new full test_cases array, call `productos_update_behavior(..., { test_cases })`. Re-render drilled. |
| "Rephrase the claim — 'opens a modal' is vague" | `productos_update_behavior(..., { claim: "..." })`. Re-render drilled. |
| "/back" / "back to summary" / "ok let's see the other one" | Switch back to summary render. |

**Re-render after every write.** That's the signal state moved. Don't re-render when you're just answering a question or commenting.

## 4. Tools you have

**Read:** `productos_get_feature({ id })` — returns `{ id, title, status, description, ux, behaviors, affected_by, body, tracking? }`.

**Feature-level:** `productos_update_feature({ id, title?, status?, description?, body? })`

**Behaviors:**
- `productos_add_behavior({ feature_id, behavior })` — full Behavior including test_cases array
- `productos_update_behavior({ feature_id, behavior_id, claim?, notes?, surface?, element?, interaction?, test_cases? })` — partial; `test_cases` REPLACES the array (pass the full new one)
- `productos_remove_behavior({ feature_id, behavior_id })`

**UX views:**
- `productos_add_or_replace_ux({ feature_id, ux })` — full UxView
- `productos_update_ux({ feature_id, ux_id, title?, sketch?, path?, notes? })` — partial; doesn't touch elements
- `productos_remove_ux({ feature_id, ux_id })` — auto-clears dangling behavior anchors

**Elements (inside a UX view):**
- `productos_add_or_replace_element({ feature_id, ux_id, element })` — full Element
- `productos_remove_element({ feature_id, ux_id, element_id })` — auto-clears dangling anchors

## 5. Close cleanly when they're done

```
Done. Changes this session:
  - Removed behavior create-record
  - Added test case #3 on open-modal
  - Set status to shipped

Commit when ready:
  git add productos/products/wallet/add-kid.md
  git commit -m "review: wallet/add-kid"
```

Skip this block if no edits were made.

## Rules

- **Two layers. Summary by default. Drill-in on explicit request.**
- **Summary = id + anchor + count + claim. Nothing more.** No notes, no test cases.
- **Drilled = one behavior, full detail.** Re-render only that behavior's block.
- **Re-render after every write.** Skip re-render for questions / commentary.
- **Product language only.** Don't write API/file/endpoint terms in claims.
- **Don't invent.** Ambiguity → one clarifying question.
- **Don't bulk-apply judgment calls** ("fix all the wrong leads_to") — list what you'd do, get OK, apply.
- **Don't mix in verification.** Verified is a separate concept.

## Don't

- Don't open a browser. They picked Claude.
- Don't propose NEW features here. That's `productos-scope`.
- Don't write code.
- Don't dump raw YAML.
- Don't show all test cases for all behaviors at once. **That's the whole point of the layered view.**
- Don't show a fixed menu.

## Defer instead

- **Surgical scripted edit** ("add leads_to: foo to element X") → `productos-edit`.
- **Scope a NEW feature** → `productos-scope`.
- **Broad codebase pass** → `productos-fullscan`.
- **Map tests to behaviors** → `productos-align`.
