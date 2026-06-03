---
name: productos-review
description: Use when the user wants to walk through and accept/reject/edit ProductOS content inline in the Claude Code session — without switching to the product-truth site. Reviews not just behaviors but also UX views, Elements, and affected_by relationships, one at a time, with single-keystroke responses (Y/N/E/S/Q). Triggers on "review the X feature", "review my productos", "let's go through X", "walk me through the unverified behaviors", "review the UX in X". Site and Claude/text are co-equal review surfaces (UX views) in v0.1 — this is the in-terminal one.
version: 0.1.0
---

# ProductOS — Review Skill (interactive walkthrough in Claude/text)

The user wants to walk through ProductOS content for a feature (or across features) one item at a time, with single-keystroke responses, without leaving Claude Code.

**Scope is everything in a feature — not just behaviors.** You walk through:

1. **UX views** — their ASCII sketches, titles, element lists
2. **Elements** — each interactive item: id, kind, label, leads_to (does this navigate? where to?)
3. **Behaviors** — claims, anchors (surface/element/interaction), test cases
4. **affected_by** — cross-feature trigger references

The site (`localhost:7878`) does the same thing visually. Both call the same MCP tools and produce the same DB state. The user picks whichever fits the moment.

## Process

### 1. Pick the scope

If the user names a feature → scope to that feature.
If they don't → list candidates from `productos_get_gaps({ type: "unverified" })` plus any features with newly-added surfaces or elements that haven't been reviewed yet.

```
ProductOS has unreviewed content across 3 features:
  • wallet/kid-balance   2 surfaces · 5 elements · 4 unverified behaviors
  • checkout/flow        1 surface · 3 elements · 2 unverified behaviors
  • auth/signup          1 unverified behavior

Which scope? (feature_id, "all", or skip)
```

### 2. Walk the scope, in order

For each feature, walk content in this order: **UX → Elements → Behaviors → affected_by**.

**For each UX view:**

```
UX 1 of 2: wallet/kid-balance / family-screen
─────────────────────────────────────────────────
Title:  Family
Path:   /family

Sketch:
  ┌──────────────────────────────┐
  │  Family                      │
  │  → Mia      $12.50           │
  │  → Leo       $4.00           │
  │                              │
  │  [ + Add a kid ]             │
  └──────────────────────────────┘

Elements (will be walked next):
  kid-card · → Mia, → Leo  (no leads_to set)
  add-kid-button · [ + Add a kid ]  (no leads_to set)

[Y] accept  [E] edit sketch/title  [N] reject  [S] skip  [Q] quit
```

**For each Element:**

```
Element 1 of 5: wallet/kid-balance / family-screen / kid-card
─────────────────────────────────────────────────────────────
Kind:       card
Label:      Kid card
Leads to:   (not set — clicking will not navigate)
Used in:    UX family-screen (3 instances: → Mia, → Leo, → Ada)

[Y] accept  [E] edit (kind / label / leads_to)  [N] reject  [S] skip  [Q] quit
```

When the user picks `E` on an element, offer common edits:
- `leads_to` — most common edit; ask "where does this navigate to?" Accept a UxView.id, area/feature, or area/feature#surface form.
- `kind` — change button → cta, link → button, etc.
- `label` — rename
- `id` — rename (warn: this breaks behavior anchors that reference the old id)

**For each Behavior:**

(Same as the original vet flow — claim, evidence, test cases, anchor, Y/N/E/S.)

**For affected_by (one prompt per feature):**

```
affected_by for wallet/kid-balance
─────────────────────────────────
Currently:
  • wallet/earn
  • wallet/spend

Other features that might affect this one (Claude's reading of the codebase):
  • tasks/complete-task — task completion increments balance
  • wallet/interest — interest accrual changes balance

[Y] add suggested  [E] edit list manually  [S] skip  [Q] quit
```

### 3. Summarize at the end

```
Reviewed N items across M features:
  UX:          A accepted, B edited
  Elements:    C accepted, D edited (leads_to set on D items)
  Behaviors:   E accepted, F edited, G rejected
  affected_by: H updated

Markdown changes ready to commit:
  productos/products/wallet/kid-balance.md
  ...

Tracking changes (DB-only, no commit needed):
  N acceptance events

Next steps:
  • If you set new leads_to on elements, the sketch is now clickable
  • Run `productos test align <feature_id>` to map existing tests to behaviors
  • Or implement code + tests for accepted behaviors and post results via
    `productos test record`
```

## Rules

- **Walk in a fixed order** — UX views, then Elements, then Behaviors, then affected_by. Don't jump around; the order matters because elements anchor to surfaces, behaviors anchor to elements, and affected_by depends on the feature being well-formed.
- **One item at a time.** Single decision per exchange.
- **Respect Q.** If the user quits, stop cleanly. The next session can resume from where they left off.
- **For UX-view edits**, offer to update both `title` and `sketch` — most edits are sketch tweaks.
- **For Element edits**, lead with `leads_to` — that's the most-frequently-missed field on first-pass scopes and the one that makes the sketch clickable.
- **Never auto-accept.** Even for items that look obviously correct.

## Don't

- **Don't open a browser.** User picked Claude/text.
- **Don't bulk-flip.** No "accept all the elements." Each one gets its moment.
- **Don't skip evidence on behaviors.** Surface what the system knows; if there's no test result, say so.
- **Don't write code.** Review is judgment over markdown. Code changes are downstream.
- **Don't propose NEW surfaces/elements/behaviors.** That's `productos-scope`. Review is for what already exists.
- **Don't try to ALSO be productos-edit.** If the user wants a specific surgical edit ("add leads_to to X"), suggest they use `productos-edit` instead. Review is the interactive walk; edit is the targeted directive.
