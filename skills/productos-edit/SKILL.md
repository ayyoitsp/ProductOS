---
name: productos-edit
description: Use for SURGICAL EDITS to existing Product Truth — add `leads_to` to an element, change a kind, rename an id, set `affected_by`, add a new surface to an existing feature, adjust a behavior's anchor, etc. The user names exactly what they want changed; this skill applies it via MCP tools or the Edit tool. NOT for proposing new behaviors (use productos-scope) or interactive walkthroughs (use productos-review). Triggers on "in X, add leads_to to Y", "change the kind of X", "rename element X to Y", "set affected_by on X to include Y", "add a new surface to X", "update the sketch of X".
version: 0.1.0
---

# ProductOS — Edit Skill (surgical, non-interactive)

> **The model is defined outside this skill.** `OVERVIEW.md` introduces it, `EXAMPLE.md`
> shows it as real files one concept at a time, and `GLOSSARY.md` defines every term and
> what it refuses — feature area, capability system, feature, capability, surface, stub,
> behavior, claim, undefined behavior, `depends_on` vs `affected_by`, validation,
> readiness, framework gap.
>
> Read them before classifying anything, and do not re-derive a definition here: this
> skill and the glossary disagreeing is how six words ended up circulating for one
> concept.


The user knows exactly what they want changed. You apply it. No walkthrough, no questions unless the instruction is genuinely ambiguous.



## When something has no clean home

Do not force it into the nearest category. Run:

```
productos todo add "<what the model cannot express>" --forced-into <where it had to go>
```

That records a **framework gap** — a TODO for ProductOS's developers, distinct from the
user's queue. `productos todo scan` also detects forced fits mechanically (a capability
behavior demonstrable only through a screen; a behavior anchored to a surface nothing
declares), because this instruction alone has repeatedly not been enough.

A hand-placed compromise is worse than a recorded gap: it looks correct, so the evidence
that the framework was deficient disappears and the same hole is rediscovered next time.


## Undefined behaviors, and resolving them

A behavior with `question:` and no `claim:` is **undefined** — nobody has decided what
it claims.

**Adding one** — "we don't know whether X yet": write the behavior with `question:` and
no `claim:`, no test cases. Never invent a claim to fill the slot.

**Resolving one** — the user tells you the answer:

1. Write the `claim:` on the **same behavior id**. Never create a new id — the whole
   point is that undefined → unverified → verified happens on one stable id.
2. **Remove `question:`.** The schema rejects a behavior carrying both, and leaving it
   would mean "is this decided?" has two answers.
3. Add test cases — the claim now needs acceptance criteria.
4. Leave verification alone. It becomes *unverified*, awaiting the human stamp; you
   never set `verified`.

**Changing `kind:` means MOVING THE FILE.** The two live in separate trees and `kind` is
inferred from which tree a file is in:

| | Path | Id |
|---|---|---|
| feature | `productos/products/<product>/<area…>/<slug>.md` | `<area>/<slug>` |
| capability | `productos/capabilities/<system>/<slug>.md` | `capabilities/<system>/<slug>` |

So feature → capability is: move the file, rewrite the `id`, drop every behavior's
`surface` / `element` / `interaction` anchor (an interface has no screen), and repoint
every `depends_on` and prose reference to the old id.

⛔ **This changes an id, which is normally immutable.** Only do it while nothing in the
container is validated, and say so explicitly before starting — once claims are accepted
or tests carry the id, the move is no longer safe and the right answer is a new
capability plus deprecation of the old container.

**Retiring a container that should never have existed** — set `status: deprecated`, mark
every behavior `deprecated: true` with a `deprecated_reason` naming where its content
went, and leave the file in place. Deleting it breaks every id that ever pointed at it
and erases the record that the mistake was made.


## When to use this skill vs others

| You want to... | Use this skill |
|---|---|
| Apply a specific named edit ("add leads_to to X", "rename id Y to Z") | **`productos-edit`** (you are here) |
| Walk through behaviors / UX views / elements one at a time accepting or editing each | `productos-review` |
| Propose a brand-new feature from code | `productos-scope` |
| Broad codebase pass | `productos-fullscan` |
| Map existing tests to declared cases | `productos-align` |

If the user's instruction can't be acted on without more decisions ("make this feature better"), don't run this skill — ask them to be specific OR suggest `productos-review` for the walkthrough.

## The schema you can edit

### Feature (file: `productos/products/<product>/<area…>/<feature>.md`, frontmatter)

| Field | Type | Notes |
|---|---|---|
| `id` | string | `<area>/<slug>` — renaming this is a real migration; warn the user before doing it |
| `title` | string | Human-readable |
| `status` | `planned \| shipped \| deprecated` | |
| `description` | string | Short product-language summary |
| `affected_by` | string[] | Feature ids whose triggers mutate this feature's state |
| `ux` | UxView[] | See below |
| `behaviors` | Behavior[] | See below |

### UX view

| Field | Type | Notes |
|---|---|---|
| `id` | kebab-case string | Behavior anchors reference this |
| `title` | string | Human label |
| `path` | string | Optional route/selector — kept in markdown but not rendered |
| `sketch` | string | ASCII layout (see element conventions below) |
| `notes` | string | Short context |
| `elements` | Element[] | See below |

### Element

| Field | Type | Notes |
|---|---|---|
| `id` | kebab-case string | Behavior anchors reference this; renaming requires updating any behavior that anchors to it |
| `kind` | freeform string | Conventional: `button`, `input`, `link`, `card`, `list-item`, `toggle`, `dropdown`, `checkbox`, `radio`, etc. |
| `label` | string | Used inside `[ ... ]` or `<...>` in the sketch for visual matching |
| `notes` | string | Short — role/trigger only, never visual design |
| `leads_to` | string | NAVIGATION target. Three forms: same-feature `<surface-id>`, cross-feature `<area>/<feature>`, or cross-feature + surface anchor `<area>/<feature>#<surface-id>` |

### Behavior

| Field | Type | Notes |
|---|---|---|
| `id` | kebab-case string | Stable — test case stable ids embed it |
| `claim` | string | Product-language falsifiable claim. Min 10 chars |
| `notes` | string | Optional brief context. NO engineering rationale |
| `ux` | string | Optional — anchor to a UxView.id in the same feature |
| `element` | string | Optional — anchor to an Element.id within the referenced surface |
| `interaction` | string | Optional — freeform: `click`, `submit`, `view`, `load`, `input`, `tap`, etc. |
| `test_cases` | TestCase[] | Required — at least 1 per behavior |
| `deprecated` | bool | Set to mark a behavior dead but kept-for-history |
| `deprecated_reason` | string | If `deprecated: true` |

### TestCase

| Field | Type | Notes |
|---|---|---|
| `id` | positive int | Append-only — never renumber |
| `description` | string | Short scenario summary |
| `level` | `unit \| integration \| api \| e2e` | Optional but recommended |
| `given` / `when` / `then` | strings | Optional structured form |
| `steps` | string | Optional freeform alternative |
| `coverage_ref` | string | Path to existing test that covers this (set by `productos-align`) |
| `deprecated` | bool | Same rules as behavior |

## Element conventions in sketches (when editing sketches)

| Pattern | Element kind |
|---|---|
| `[ Label ]` | button |
| `<Label>` | link |
| `[__________]` | input |
| `[Label ▼]` | dropdown |
| `[✓]` / `[ ]` | checkbox |
| `(•)` / `( )` | radio |
| `→ Name` | card / list-item / row (preferred) |
| `▢ Name` / `▦ Name` | card (legacy — `→` is preferred) |

## Process

### 1. Parse the instruction

Identify: which feature, which item (surface/element/behavior/test_case), which field, what value.

If ambiguous, ask ONE clarifying question. If the user is vague ("make this better"), tell them to be specific and suggest `productos-review` instead.

### 2. Apply the edit

**Prefer MCP tools when one exists for the field:**

| Edit | MCP tool |
|---|---|
| Behavior `claim` or `notes` | `productos_update_behavior(feature_id, behavior_id, { claim?, notes? })` |
| Test case `coverage_ref` | `productos_set_coverage_ref(feature_id, behavior_id, test_case_id, coverage_ref)` |
| Behavior `status` (verify / contest / deprecate) | `productos_update_tracking(...)` |
| Add a new behavior | `productos_add_behavior(feature_id, behavior)` |
| Add/replace a context doc | `productos_propose_context(...)` |

**For everything else, use the Edit tool on the markdown file directly:**

- Element `leads_to`, `kind`, `label`, `notes`, `id`
- UX-view fields, sketches, elements list
- Feature `affected_by`, `title`, `status`, `description`
- Behavior `ux`, `element`, `interaction` anchors

When using the Edit tool: read the file first, locate the YAML block, make a focused replacement, preserve indentation and surrounding structure.

### 3. Validate before reporting

Sanity-check the edit:

- `id` fields kebab-case (e.g. `add-kid-button` not `addKidButton`)
- `leads_to` in one of the three valid forms
- `level` in {unit, integration, api, e2e} if set
- `test_case.id` not reused or renumbered (stable ids are immutable)
- Behavior `ux`/`element` refs exist on the feature
- Behavior `claim` ≥ 10 chars

If the edit breaks an existing reference (e.g. renaming an element id that behaviors anchor to), warn the user and offer to update the dependents too.

### 4. Report concisely

```
Updated wallet/kid-balance:
  ✓ Element kid-card now has leads_to: wallet/kid-detail
  ✓ Element add-kid-button now has leads_to: wallet/add-kid

Markdown changes ready to commit:
  productos/products/wallet/kid-balance.md
```

No interactive walk, no Y/N — the user told you what to do.

## Worked examples

**User:** "In wallet/family, add `leads_to: wallet/add-kid` to the add-kid-button element."

You: read the file, find the `add-kid-button` element block, add the `leads_to:` line with proper indentation, save. Validate. Report.

**User:** "Rename element `kid-card` to `kid-row` in wallet/family."

You: warn — "This element is anchored by behavior X. I'll update the behavior's `element:` ref to the new name as well. Proceed?" On Y: edit both. Validate. Report.

**User:** "Add tasks/complete-task to affected_by on wallet/kid-balance."

You: read the feature file, find the `affected_by:` block (or create one), append the new entry. Validate. Report.

**User:** "Update the sketch of family-screen in wallet/family to add a Search box at the top."

You: read the surface's sketch, add a line like `│  [Search…________________]    │`, propose the change with the Edit tool, validate. Report.

## Rules

- **Don't ask unless the instruction is genuinely ambiguous.** "Add leads_to to add-kid-button" is unambiguous — just do it.
- **Preserve YAML formatting.** Indentation matters; don't reflow blocks unnecessarily.
- **Warn before destructive renames.** Renaming an `id` that's referenced elsewhere is a migration, not an edit.
- **One file at a time when possible.** Don't fan out across multiple feature files unless the user asks.
- **Validate before reporting success.** A successful edit is one that parses cleanly when productos reads it.

## Don't

- **Don't propose new features, UX views, elements, or behaviors.** That's `productos-scope`. If the user asks for "a new behavior in wallet/family" — judgment call: if it's clearly defined (specific claim + anchor + test cases), apply it; if it's vague, route to `productos-scope`.
- **Don't open a browser.** All edits are markdown + MCP.
- **Don't write code.** Spec edits only.
- **Don't bundle unrelated edits.** If the user asks for one thing, do that one thing.
