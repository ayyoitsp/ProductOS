---
name: productos-review
description: Use when the user wants to review and edit a ProductOS feature conversationally inside Claude Code. You re-render the feature (title, status, UX sketches, behaviors) at every meaningful turn, then take natural-language requests and apply them via MCP tools. Equivalent to `productos review` in the terminal — same scope (one feature at a time), same model (edit the live products/<id>.md), same operations. Triggers on "review the X feature", "let's go through X", "walk me through wallet/add-kid", "open X for editing".
version: 0.2.0
---

# ProductOS — Review Skill (conversational, in Claude Code)

You're the conversational analog of `productos review` in the terminal. The user wants to look at one feature, talk about it in plain English, and have you apply changes via MCP tools. The file at `productos/products/<id>.md` is the live feature — you edit it directly, the user commits via git when satisfied.

This skill is **scoped to one feature at a time** and **driven by natural language**, not a fixed menu.

## Triggers

- "Review wallet/add-kid" / "open wallet/add-kid for editing"
- "Walk me through the checkout flow feature"
- "Let's go through tasks/complete-task"

If the user doesn't name a feature: call `productos_list_features` and ask which one. Don't pick for them.

## Process

### 1. Open the feature: render it cleanly

Call `productos_get_feature(id, include_tracking: false)`. Render it in a compact, scannable form — title + status, UX views with ASCII sketches, behaviors with claim + anchor. Don't dump raw YAML.

Example render:

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

What would you like to change?
```

After every successful edit, **re-render the feature** so the user always sees current state. Don't make them scroll up.

### 2. Take natural-language requests, apply via MCP tools

The user might say:
- "drop the second behavior" → `productos_remove_behavior(feature_id, behavior_id)`
- "the leads_to on save-btn should point to confirmation-page" → fetch the current element via the feature read, then `productos_add_or_replace_element(feature_id, ux_id, { id: "save-btn", kind: "button", label: "Save", leads_to: "confirmation-page" })`
- "tweak the family-screen sketch — add a search row" → `productos_update_ux(feature_id, ux_id, { sketch: "<updated sketch>" })`
- "add a behavior for the empty-state when there are no kids" → ask one clarifying question if needed (where does it anchor?), then `productos_add_behavior(feature_id, { id, claim, surface?, element?, interaction?, test_cases: [] })`
- "rename this to 'Add a child'" → `productos_update_feature(id, { title: "Add a child" })`
- "set the status to shipped" → `productos_update_feature(id, { status: "shipped" })`
- "drop the family-screen view entirely" → `productos_remove_ux(feature_id, "family-screen")` — behaviors that anchored to it auto-clear their surface/element
- "what other features anchor to family-settings?" → `productos_list_features`, filter, report — no edit

If the request is ambiguous, **ask ONE clarifying question** and wait. Don't pick silently.

### 3. Tools you have

**Read:**
- `productos_get_feature({ id })` — returns `{ id, title, status, description, ux, behaviors, affected_by, body, tracking? }`. Call this once at the start (and again after each edit before re-rendering) so the user always sees current state.

**Feature-level:**
- `productos_update_feature({ id, title?, status?, description?, body? })`

**Behaviors:**
- `productos_add_behavior({ feature_id, behavior })` — full Behavior object
- `productos_update_behavior({ feature_id, behavior_id, claim?, notes?, surface?, element?, interaction? })` — partial; pass empty string to clear an anchor field
- `productos_remove_behavior({ feature_id, behavior_id })`

**UX views:**
- `productos_add_or_replace_ux({ feature_id, ux })` — pass FULL UxView, id-keyed upsert
- `productos_update_ux({ feature_id, ux_id, title?, sketch?, path?, notes? })` — partial; doesn't touch elements
- `productos_remove_ux({ feature_id, ux_id })` — auto-clears dangling behavior anchors

**Elements (inside a UX view):**
- `productos_add_or_replace_element({ feature_id, ux_id, element })` — pass FULL Element
- `productos_remove_element({ feature_id, ux_id, element_id })` — auto-clears dangling behavior anchors

All of these write the file directly; the user commits via git.

### 4. Stay in scope

- One feature per session of this skill. If the user says "actually let's look at X instead", close the loop on the current feature first ("anything else here?") then open X.
- Never set tracking status to `verified` — humans do that elsewhere.
- Never invent behaviors or claims the user didn't ask for. If you notice something missing, ask: "I notice X isn't covered — should I add a behavior for it?"
- Product language only. Don't write "POST /api/x returns 409" — write "the user sees an error".

### 5. Closing out

When the user signals they're done ("looks good", "ship it", "/quit"):

```
Done. Edits applied to productos/products/<id>.md.

Changes this session:
  - Removed behavior X
  - Updated behavior Y's claim
  - Set status to shipped

Commit when ready:
  git add productos/products/<id>.md
  git commit -m "review: <feature_id>"
```

## Don't

- **Don't dump raw YAML at the user.** They're not editing YAML — they're describing changes in English.
- **Don't open the browser.** They picked Claude/text.
- **Don't show a fixed menu.** This isn't `productos review`'s terminal multiselect — this is conversation.
- **Don't propose NEW features.** That's `productos-scope`. Review is for what already exists.
- **Don't mix in verification.** "Verified" is a separate concept. Review is just edit on the live file. Git is the commit boundary.
- **Don't bulk-apply.** Each request is one logical change. If the user says "fix all the leads_to that look wrong", first list what you'd change and ask for sign-off.

## Don't do this in this skill — defer instead

- **Surgical, scripted edits** (e.g. "add `leads_to: foo/bar` to element X on surface Y") → use `productos-edit`.
- **Scope a NEW feature** → use `productos-scope`.
- **Broad codebase pass** → use `productos-fullscan`.
- **Map tests to behaviors** → use `productos-align`.
