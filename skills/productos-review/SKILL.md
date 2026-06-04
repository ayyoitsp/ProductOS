---
name: productos-review
description: Use when the user wants to look at a ProductOS feature and talk about it conversationally — UX sketches, behaviors, anchors, whatever. You render the feature once, then take whatever free-form feedback they give ("anything wrong with this UX?", "the second behavior is off", "drop the kid-card", "rename it"), and apply via MCP tools. No walkthroughs, no keystrokes, no per-item Y/N. Equivalent to `productos review` in the terminal — same scope (one feature), same model (live edits to products/<id>.md). Triggers on "review the X feature", "let's look at X", "anything wrong with X", "open X", "walk me through X".
version: 0.3.0
---

# ProductOS — Review Skill

The user wants to look at one feature and talk about it. You render it, they tell you what's off, you fix it. **Not a walkthrough.** Not Y/N per behavior. Free-form input, free-form response, free-form edits.

The file at `productos/products/<id>.md` is the live feature — every tool call writes the file directly. Git is the commit boundary; the user re-runs review whenever.

## Trigger phrases

"review wallet/add-kid" · "let's look at wallet/add-kid" · "anything wrong with wallet/add-kid" · "walk me through X" · "open X for editing"

If the user doesn't name a feature, call `productos_list_features` and ask which one. Don't pick for them.

## The whole flow

### 1. Render once

Call `productos_get_feature({ id, include_tracking: false })`. You get `{ id, title, status, description, ux, behaviors, affected_by, body }`. Render it in compact, scannable form:

```
Add a kid                                                    wallet/add-kid
status: shipped

Parent adds a kid to the family from the family settings.

UX views:
  family-settings — Family settings  (/family)
    ┌──────────────────────────────┐
    │  Family                      │
    │  → Mia      $12.50           │
    │  → Leo       $4.00           │
    │  [ + Add a kid ]             │
    └──────────────────────────────┘
    elements: add-kid-btn:button→add-kid-modal, kid-card:card→wallet/kid-detail

Behaviors:
  open-modal  [family-settings.add-kid-btn tap]
    Tapping + Add a kid opens a modal where the parent enters the kid's name and avatar.
  submit-modal  [add-kid-modal.confirm-btn submit]
    On confirm, a new kid is added with $0 balance and the modal closes.

What's off, or what would you like to change?
```

That's the whole opening. One render, one open question. **Don't enumerate "Behavior 1 of 2 — accept? Y/N".** **Don't ask permission to start.** **Don't walk the user through items.**

### 2. Take whatever they say

Free-form. The user might:

| They say | You do |
|---|---|
| "Looks good" / "nothing wrong" | Stop. End cleanly (see §4). |
| "The second behavior is wrong — persistence is on submit, not confirm" | `productos_update_behavior(feature_id, "create-record", { claim: "..." })` or remove+add. Re-render. |
| "Anything wrong with the family-settings sketch?" | YOU answer — give your read. Point out missing leads_to, behaviors not anchored, sketches that don't match described behavior. Don't edit yet. |
| "Drop the kid-card element" | `productos_remove_element(...)`. Re-render. |
| "Add a behavior for the empty state" | One clarifying Q if anchor isn't clear, then `productos_add_behavior(...)`. Re-render. |
| "Rename this to 'Add a child'" | `productos_update_feature(id, { title: "Add a child" })`. Re-render. |
| "Set status to shipped" | `productos_update_feature(id, { status: "shipped" })`. Re-render. |
| "tweak the sketch to add a search row at the top" | `productos_update_ux(feature_id, ux_id, { sketch: "<new sketch>" })`. Re-render. |
| "What else needs work?" | YOU give a focused read — 3-5 items max, prioritized. Then wait. Don't apply. |

**Re-render after every meaningful write.** That's the signal that the state moved. Skip re-render when you're just answering a question or commenting.

### 3. Tools you have

**Read:** `productos_get_feature` — returns `{ id, title, status, description, ux, behaviors, affected_by, body, tracking? }`.

**Feature-level:** `productos_update_feature({ id, title?, status?, description?, body? })`

**Behaviors:**
- `productos_add_behavior({ feature_id, behavior })` — full Behavior
- `productos_update_behavior({ feature_id, behavior_id, claim?, notes?, surface?, element?, interaction? })` — partial; empty string clears anchor
- `productos_remove_behavior({ feature_id, behavior_id })`

**UX views:**
- `productos_add_or_replace_ux({ feature_id, ux })` — full UxView, id-keyed upsert
- `productos_update_ux({ feature_id, ux_id, title?, sketch?, path?, notes? })` — partial; doesn't touch elements
- `productos_remove_ux({ feature_id, ux_id })` — auto-clears dangling behavior anchors

**Elements (inside a UX view):**
- `productos_add_or_replace_element({ feature_id, ux_id, element })` — full Element
- `productos_remove_element({ feature_id, ux_id, element_id })` — auto-clears dangling anchors

All writes hit the file directly.

### 4. Close cleanly when they're done

When they signal done ("looks good", "ship it", "thanks", silence), wrap with the diff:

```
Done. Changes this session:
  - Removed behavior create-record
  - Added behavior submit-modal
  - Set status to shipped

Commit when ready:
  git add productos/products/wallet/add-kid.md
  git commit -m "review: wallet/add-kid"
```

Skip this block if no edits were made.

## Rules

- **One render at the start, then conversation.** No walkthrough.
- **Re-render after every write** so the user sees current state without scrolling.
- **No keystroke prompts.** No Y/N, no /accept, no per-item enumeration.
- **Product language only.** Don't write "POST /api/x returns 409" — write "the user sees an error".
- **Don't invent.** If they say "drop the second behavior" and there are three, ask which.
- **Don't bulk-apply judgment calls.** "Fix all the leads_to that look wrong" → list what you'd change, get a one-line OK, then apply.
- **Don't mix in verification.** Verified is a separate concept; review is just edit.
- **Ask ONE clarifying question max per turn**, not three.

## Don't

- Don't open a browser. They picked Claude.
- Don't propose NEW features here. That's `productos-scope`.
- Don't write code. Review is judgment over markdown.
- Don't dump raw YAML at them.
- Don't show a fixed menu. This isn't the CLI's slash-command surface.
- Don't apologize for missing tools. The element-level tools exist now.

## Defer instead

- **Surgical scripted edit** ("add leads_to: foo to element X") → `productos-edit`.
- **Scope a NEW feature** → `productos-scope`.
- **Broad codebase pass** → `productos-fullscan`.
- **Map tests to behaviors** → `productos-align`.
