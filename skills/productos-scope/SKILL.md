---
name: productos-scope
description: Use when the user wants to scope ProductOS on ONE in-flight feature (the v0.1 wedge) — either pre-code planning OR retrofit on a feature that already exists. Reads the relevant code paths, proposes COMPREHENSIVE COVERAGE of behaviors with claims + test_cases in product language (however many the feature actually has — don't artificially cap), plus UX views and their elements (ASCII sketches AND — when web.components_dir is configured — high-fidelity HTML mocks (sketch_html) mirroring the user's real components), and writes them to productos/products/<product>/<area…>/<feature>.md as Unverified. Surfaces ambiguities and discrepancies as observations (not blocking questions) before writing. Triggers on "scope productos on the X flow", "scope X with productos", "I'm planning a Y feature", "let's spec X in productos". The 80% v0.1 entry point. (For a broad pass across the whole codebase, use `productos-fullscan` instead.)
version: 0.1.0
---

# ProductOS — Scope Skill (one feature at a time)

> **The model is defined outside this skill.** `OVERVIEW.md` introduces it, `EXAMPLE.md`
> shows it as real files one concept at a time, and `GLOSSARY.md` defines every term and
> what it refuses — feature area, capability system, feature, capability, surface, stub,
> behavior, claim, undefined behavior, `depends_on` vs `affected_by`, validation,
> readiness, framework gap.
>
> Read them before classifying anything, and do not re-derive a definition here: this
> skill and the glossary disagreeing is how six words ended up circulating for one
> concept.


The v0.1 entry point. The user — typically a product lead — wants to scope ProductOS on **one feature**. You produce **comprehensive coverage** of that feature: every distinct behavior the code exhibits, every surface the user sees, every interactive element. Behaviors are claims + numbered test_cases, written in product language, committed to `productos/products/<product>/<area…>/<feature>.md`. Don't cap the count artificially — a feature has however many behaviors it has. If you find yourself writing 15 behaviors, that's fine; if 3 is enough, that's fine too. The size of the slice should match the size of the feature.

You do **not** model the whole codebase. The wedge is scoped to one feature the user already cares about — usually one in flight (about to change) or one they want to protect from regression.


## Before handing the corpus back

```bash
productos check
```

It refuses a product / area / capability system with no description, a container at the
wrong depth, any high audit finding, and any `depends_on` / `affected_by` / `leads_to`
that resolves to nothing. **Do not tell the user a corpus is ready to review until this
passes** — the structural claims the model makes are not the reviewer's job to catch.


## Three modes

| Mode | Trigger | Source of truth |
|---|---|---|
| **Pre-code planning** | User describes a feature they're planning before code lands | The user's description + Product Context |
| **In-flight protection** | User points at a feature they're about to change | Existing code paths + the user's intent |
| **Retrofit** | User points at a working feature with no behaviors declared yet | Existing code paths |

The shape of the output is the same across all three; what changes is the lifecycle status and how aggressively you read code.

## Process

### 1. Consult first (always)

Call:

- `productos_list_context` — see what Strategy documents exist
- `productos_get_strategy` — load goals / principles / personas / non-goals / voice if any are present
- `productos_list_areas` + `productos_list_features` — see what feature areas exist already

Strategy is **optional in v0.1** but if it's present it constrains every behavior you propose. A proposed claim that contradicts a Design Principle gets flagged for human review, not silently written.

**Cross-reference principles, don't restate them.** Before writing each candidate behavior, ask: "Does this rule already exist as a principle?" If yes — write the behavior as a thin reference instead of a restatement, and put the reference in **`cites:`**, not in prose:

```yaml
- id: submit-double-tap-safe
  claim: "Add money is single-fire on this form."
  cites:
    - principles#submits-are-idempotent
  notes: "Universal rule; this form follows it."
  test_cases: [...]
```

`cites` takes a reference to any `##` heading in context. **Two namespaces:**

| Scope | Lives at | Cited as |
|---|---|---|
| Product-wide | `productos/context/<doc>.md` | `principles#report-never-block` |
| One area | `productos/products/<product>/context/<doc>.md` | `pricing/glossary#option` |

**Which scope?** If the rule or term would mean nothing outside this area — it uses the
area's own vocabulary, like *departure* or *answering layer* — it is area-scoped. If it
would settle an argument on an unrelated screen, it is product-wide. When in doubt,
area-scoped: promoting later is easy, and a product-wide file full of one area's jargon
makes that jargon look universal.

Principles and glossary are the common area-scoped kinds. Goals, personas and voice are
what make something a product rather than an area — keep those global.

**⛔ Structured, not prose.** The same sentence in `notes:` is unparseable, and three
things stop working:

- the context page cannot say **which behaviors rest on this rule**, so a principle
  nobody has accepted looks harmless;
- **readiness cannot see it** — a behavior deferring to an unaccepted rule is resting on
  something an agent may have written, and that should block a build;
- changing a principle has no blast radius.

Context is validated **per `##` section** and agents can write context, so citing an
unaccepted section is a real readiness blocker, not a style note.

This keeps the principle as source-of-truth and the feature spec lean. If a candidate looks like a CROSS-CUTTING principle that doesn't exist yet ("all primary forms accept Enter-key submit", "no caps on financial amounts"), DON'T quietly bake it into this feature's behaviors. Flag it for the user: "this looks like a principle that would apply to other forms too — add it to context first?". On confirmation, call `productos_propose_context` to add it to `principles.md` BEFORE adding the per-feature behavior with a reference.

Test by reading the corpus: if you can imagine the same exact rule applying to another existing feature (spend-form, settings-form, login), it's a principle — not a per-feature behavior.

### 2. Scope to the feature

Identify the code paths relevant to the feature in question. Examples:

- "scope on checkout" → `src/checkout/*`, `src/api/checkout/*`, `src/pages/checkout/*`
- "scope on signup" → `src/api/auth/signup*`, `src/pages/signup*`
- "I'm planning a wishlist" → no code yet; lifecycle will be `planned`

**Read narrowly.** This is a feature scope, not a codebase scan. If the relevant code is more than ~10 files, ask the user to confirm scope before proceeding.

### 2b. Decide `kind` — feature or capability

One question: **what triggers it?**

| | Trigger | Has screens? | Promised to |
|---|---|---|---|
| `kind: feature` | A **user action** | Yes | The user |
| `kind: capability` | An **input from elsewhere in the product** | **No** | The features that depend on it |

A capability is a **promise, not a subsystem.** *"Every resolved limit carries which
layer answered it"* is a capability claim. *"There's a resolution service behind a
cache"* is a thing, and it's engineering's, not ours.

**Two symmetric trees.** A capability system is a **subsystem** — engineering's
decomposition — and it is the grouping level, congruent to a feature area:

| | Product tree | System tree |
|---|---|---|
| grouping | **feature area** `products/pricing/` | **capability system** `capabilities/user-account-manager/` |
| container | **feature** `invite-teammate.md` | **capability** `invite-user.md` |
| contents | behaviors | behaviors |

So a capability goes at **`productos/capabilities/<system>/<slug>.md`** with
`id: capabilities/<system>/<slug>`. A capability system is **never inside a feature
area** — a subsystem serves many of them.

**Name the system for a component, not a topic.** `user-account-manager` is a component;
`invitations` is a topic, and a topic-named system is usually a feature area wearing the
wrong hat. Every capability the component offers lives in it — inviting, re-roling and
deactivating are the same component answering at different moments.

The claims still state **what a consumer may rely on, never the mechanism**. *"Inviting
an address at a role puts them in the system as invited"* is a capability; *"invites live
in a table with a partial unique index"* is engineering's and never appears. Product owns
what is promised, engineering owns how it is kept.

### ⛔ Capabilities live in their OWN TREE, never inside an area

```
productos/
├── capabilities/
│   └── limit-resolution.md      id: capabilities/limit-resolution
└── products/
    └── pricing/                  ← areas hold FEATURES only
        └── deal-quote.md         id: pricing/deal-quote
```

Write the file to `productos/capabilities/<system>/<slug>.md` with
`id: capabilities/<system>/<slug>`. **Never `products/<product>/<area…>/`, and never an
area-scoped id.**

The reason is that ids are immutable: an area in the id makes that area part of the
capability's identity permanently. Many features across many areas depend on one
capability — an identity promise serves every area — so filing it under whichever area
happened to need it first is a hierarchy that misreports what it serves.

`kind` is inferred from the tree the file is in, so it cannot disagree with its
location.

**Skip §3a entirely** — a capability has no screens. Its behaviors are unanchored: no
`surface`, no `element`, no `interaction`. Forcing a screen onto an interface is how a
contract ends up documented as whichever page happened to call it first.

### ⛔ The trap: "I can't find a screen" is NOT a signal

**Never classify by whether you found UI.** That tests what you were reading, not what
the thing is. A screen can be absent from the code in front of you because it is:

- an add-in, extension, task pane, mobile app or emailed view — a different runtime
- rendered by a service you did not open
- **real, and simply never scoped**

All three look identical to "has no UI" from inside one repo, and all three are
**features**. This exact mistake turned a specification's *"Surface three — the
workbook"* into a capability: the Excel task pane had no route in the web app, so it
read as system-level. It was a screen the whole time.

**Ask what triggers it, and nothing else.** *Does a person do something?* If an analyst
pulls, opts in, reads a notice, or picks a source — **feature**, however far the screen
is from the code you are reading. Scope the surface even if you have to describe it from
the specification rather than from source.

### Real signals of a capability

- **Several features consume the same answer.** This is the strongest one. If only one
  container would ever call it, it is that container's behavior.
- **The claims are operations a subsystem offers**, not someone acting:
  *"a published version is an immutable snapshot of the inputs it was priced from"* is a
  capability. *"the analyst opts in per source"* is a feature, on the screen where they
  opt in.
- **You cannot write a test for it without opening a screen.** If you can't, good. If
  you can — that is a feature behavior and the linter will refuse it.

### Decomposing a boundary correctly

An integration usually hides one capability and one feature, and naming it as a single
"exchange" or "sync" container conflates them:

| | Kind | Example |
|---|---|---|
| The data promise | **capability** | versions are immutable snapshots; a deal pins the version it was priced from |
| The act of moving it | **feature** | the analyst is told a newer version exists and pulls it, per source |

**This is the altitude most teams have no artifact for** — PRDs stop below it, design
docs start above it — so when in doubt, scoping it explicitly is the higher-value move.

### 2c. Declare `depends_on` — the capabilities you rely on

`depends_on: [container ids]` names the capabilities this container is built on.

**⛔ Not the same edge as `affected_by`, and conflating them asserts something false:**

| Edge | Means | Example |
|---|---|---|
| `depends_on` | I am built on this promise and break if it changes | the deal grid → the limit-resolution capability |
| `affected_by` | Another feature's **user-facing trigger** mutates MY state | a kid balance ← completing a task |

`affected_by` renders as *"Affected by:"*. Using it for a dependency tells the reader
that the capability's triggers mutate this feature's state, which is not what is true.

`depends_on` points at **capabilities**. If you want to depend on a feature, either the
relationship is really `affected_by`, or the shared part is a capability nobody has
named yet — say so rather than pointing at the feature.

The reverse view — *"depended on by"*, and what breaks if this promise changes — is
**derived from these edges.** Never write it a second time.

### 2d. Before writing a container, check it is not framing

The failure this prevents: converting a spec's framing section into a container because
a container was the only shape available. Ask what triggers it. If the answer is
"nothing — it explains the domain", it is **not a container at all.** Route it:

| What it is | Where it goes |
|---|---|
| An interface other containers rely on | A **capability**, in `productos/capabilities/` |
| The domain model — what the thing is, how the parts relate | The area README body |
| A rule that governs many surfaces in **this area** | `productos/products/<product>/context/principles.md`, cited `<area>/principles#<anchor>` |
| A rule that governs the **whole product** | `productos/context/principles.md`, cited `principles#<anchor>` |
| Vocabulary — what a term means here | The glossary, area-scoped unless the term really is product-wide |
| Something the product deliberately does not do | `non-goals` — area-scoped or global, same test |
| A genuinely undecided question | An **undefined behavior** on whichever container owns the thing |

**Check for a duplicate before writing.** If the claim restates a non-goal or a
principle that already exists, reference it in `notes:` instead — two homes for one
fact is the redundancy the whole model is built to avoid.

### 2e. Decide where it is filed — the area, at whatever depth

A feature's id **is** its path: `<product>/<area…>/<slug>`. There is one product
segment and **at least one** area segment, and areas nest as deep as the product needs
— `cre/pricing/agency/limit-tiers` is as ordinary as `cre/deals/deal-list`.

Pick the depth by **size, not by taste**:

| Situation | What to do |
|---|---|
| An existing area fits and holds ≤ 8 features | File it there. Do not invent a level. |
| The area already holds ~8 and this one clusters with 2+ of them | Propose a sub-area, and say which existing features move into it |
| Nothing fits and you'd be the only occupant | File it in the closest existing area anyway |

⛔ **Never create an area to hold one feature.** A grouping of one is a name, not a
grouping — it reads as structure where there is none, and `productos check` flags it.
Let the area grow to the point of being unreadable first; splitting a real crowd is a
decision somebody can evaluate, inventing an empty hierarchy is not.

⛔ **Never re-file by hand.** To move something that is already filed, run
`productos move <id> <destination>` (add `--dry-run` first, `--as <slug>` to rename in
the same step). It carries the file, rewrites the id, moves the tracking sidecar, and
repoints every `depends_on`, `affected_by` and `leads_to` edge aimed at it. `mv` does
none of that: the id keeps claiming the old path and every edge pointing at it silently
dies, which still passes `check` on the moved file.

When you are unsure whether the area has grown past readable, don't guess — run
`productos check`. It measures every area against `grouping:` in
`productos/config.yaml` and names the clusters it would split out, so the answer comes
from the corpus rather than from you.

### 2f. Four things that feel like they need a new field and do not

Fresh readers have hit all four and dropped what they had. Each has a correct home
already; the failure was not knowing it, so route them rather than inventing structure.

**A non-functional requirement.** *"How long may a workbook round trip take before the
analyst is told something? How long is cell history retained?"* — dropped, because
filing an undecided latency budget under non-goals "would read as *we have decided there
is no latency budget*, which is a lie with teeth."

→ **An observable NFR is an ordinary behavior.** *"If the round trip has not returned
within a few seconds, the analyst is shown that it is still working"* is a claim a test
can falsify. If the threshold is undecided, that is an **undecided behavior** with a
question, not a non-goal. Only a genuinely unobservable target (an internal p99) is out
of scope — and if no promisee can distinguish two implementations by it, it was never
product truth.

**A migration or one-time concern.** *"Adding a template — what does it do to deals
provisioned before it?"*

→ **Either a behavior or a delivery task, never truth about the event itself.** What the
product does for a deal provisioned before the change is a claim
(*"a deal rewound across a template change states which model produced the figures"*).
The work of getting existing rows there is a delivery task and belongs in your tracker.
If nobody has decided what the product does in that situation — an undecided behavior.

**A risk you noticed.** *"If Properties is unversioned, editing it retroactively changes
a published rent roll's occupancy."*

→ **That is an undecided behavior**, and a good one. It is a question about what the
product does in a case nobody has settled. Write it with `asked_of` and `blocks` and it
stops being a worry in somebody's head.

**Build order, priority, estimate, cost.**

→ **Deliberately refused.** Product truth says what the product does; a plan changes
weekly and is owned by whoever runs delivery. Putting a plan in truth means truth rots at
the speed of a sprint board, and the packet compiles against truth.

But the legitimate half of what readers wanted is **derived, not authored**: *"of three
declared-and-unbuilt screens, nothing distinguishes the one that is load-bearing from the
two that are not."* That is knowable from `depends_on` and `blocks` — a planned container
something else already depends on IS load-bearing, and the site says so. So declare the
edges properly and the ordering signal appears; do not author a priority.

### 3a. Map the surfaces FIRST

Before behaviors, identify the **screens / pages / modals** the feature surfaces in the product. Read route definitions, page components, modal triggers — anywhere the feature presents UI.

For each surface:

- `id`: kebab-case (e.g. `cart-page`, `checkout-form`, `confirmation-modal`)
- `title`: human-readable ("Cart", "Checkout", "Confirmation")
- `path`: route or selector if applicable (`/cart`, `/checkout`, `modal:profile-edit`). Omit for screens that don't have a URL.
- `sketch`: an **ASCII rough layout** of INTERFACE STRUCTURE only — not design. Show where things are positioned relative to each other and what kind of element they are. ~6-15 lines per sketch. *Don't describe colors, fonts, typography, brand styling, spacing, or visual polish — those are design decisions that change. ProductOS captures interface (what's there, where it sits, what it does), not design (how it looks).*

  **Element conventions in the sketch** (the renderer styles these so they pop visually):

  | Pattern | What it represents |
  |---|---|
  | `[ Label ]` | Button or CTA |
  | `<Label>` | Link / navigation target |
  | `[__________]` or `[Type here]` | Input field |
  | `[Label ▼]` | Dropdown / select |
  | `[✓]` / `[ ]` | Checkbox |
  | `(•)` / `( )` | Radio button |
  | `→ Name` | Card / list item / row (preferred — reads as a right-arrow click target) |
  | `▢` or `▦` | Card / list item (legacy — `→` is preferred) |
  | `┌─┐ │ └─┘` | Box / container outlines |

  Use the labels in the sketch verbatim — when the renderer matches an element's `label` to text inside `[ ... ]` or `<...>`, it can wrap it as a clickable link (if `leads_to` is set on the element).
- `elements`: named interactive items on the screen. Each element has `id` (kebab-case), `kind` (button, input, link, toggle, stepper, list, modal-trigger, etc. — freeform), `label` (human label, matching what's in the sketch verbatim), optional `notes`. **Don't put styling/color/visual-design notes in `notes`** — only things like *role*, *what triggers it*, *what it shows*, *what makes it unique among similar elements*.
- `elements[].leads_to`: **REQUIRED on every navigation element. OMITTED on every in-place action.** No middle ground.

  **MUST set leads_to on:**
  - Card/row elements (a list row the user can tap/click into) — even if you don't know the exact destination yet, name it speculatively (e.g. `kid-detail`, `transaction-detail`). The renderer will best-effort resolve it to `/{currentArea}/{value}`; the URL may 404 until you scope that destination feature, but the row IS clickable from day one.
  - CTAs / buttons that navigate to another screen (Checkout, View detail, Settings)
  - Links (`<...>` style elements like "Edit", "See all", "Back")
  - Navigation tabs, breadcrumb crumbs, drawer triggers

  **MUST NOT set leads_to on:**
  - Submit buttons (Place Order, Save, Confirm) — they POST in place
  - +/− steppers, trash/delete icons, toggle switches — in-place mutations
  - Inputs, dropdowns, radios, checkboxes — not navigation
  - Pure-display elements (balance amounts, labels, headings)

  Format is strict:

  | Value | Means |
  |---|---|
  | `checkout-page` | Same-feature UX anchor (a `UxView.id` declared in THIS feature) — renders as `#surface-checkout-page` |
  | `wallet/transactions` | Cross-feature page nav (an `area/feature` id) — renders as `/wallet/transactions` |
  | `wallet/balance#kid-view` | Cross-feature + surface anchor — renders as `/wallet/balance#surface-kid-view` |

  **NEVER write:**
  - `/add-kid` — leading slash is a path-shape, not a feature id. (The renderer strips it defensively but it's wrong.)
  - `https://...` — an external URL is invalid.
  - `add-kid-page.html` — file extensions are wrong.

  If you don't know where the element navigates, leave `leads_to` blank — the element is rendered visually but not clickable.

Example sketch:

```
sketch: |
  ┌────────────────────────────────────┐
  │  Cart                              │
  ├────────────────────────────────────┤
  │  ▢ Apple Juice    × 1  $4.99  [-][+] │
  │  ▢ Banana Bread   × 2  $7.98  [-][+] │
  │                                    │
  │  Total: $12.97                     │
  │                      [ Checkout ]→ │
  └────────────────────────────────────┘
```

UX is **optional** — features that are pure invariants/rules (a tax calculation, a balance constraint) don't have screens. Leave `ux` empty in that case.

#### A screen you can't walk — declare a STUB, never skip it

If the feature clearly presents a screen you cannot scope right now — it lives in an
add-in, a mobile app, an emailed view, a service you did not open, or it is simply out
of scope for this pass — **declare it as a stub** rather than leaving it out:

```yaml
  - id: addin-task-pane
    title: Add-in task pane
    runtime: Excel add-in        # where it runs, when not the app the code lives in
    stub: true                   # declared, never walked
```

A stub needs no sketch and no elements. Behaviors may anchor to it, so claims about that
screen have a real home instead of being filed on the nearest container.

⛔ **This is what stops a screen being misfiled as a capability.** Leaving the surface
out makes its behaviors homeless, and homeless behaviors land wherever is closest — a
specification's *"Surface three — the workbook"* became a capability for exactly this
reason.

⛔ **A stub is not a shortcut for "I don't feel like sketching."** The test is whether
you have walked the screen. If you have, sketch it. A stub is reported as
known-but-unscoped and makes the feature **not ready to build**, which is correct: a
screen nobody has walked has unknown behavior.

### ⛔ A claim outranks a sketch — and that means your sketch must not contradict one

When the drawing and a behavior disagree, the behavior wins, and the site says so on
every surface. That is a safety net, not a licence: a reader who has to use it has
already lost time, and two reviewers lost real time to exactly this.

The three that actually happened, all avoidable:

- prose said **eight tabs**, the sketch drew **six**, and two of the three the page argued
  must be visible were the two missing from its own picture;
- a naming rule's test case said the third option is column **N**; the sketch labelled it
  **R**;
- a **padlock** sat on the one band the feature exists to let the user edit — *"a padlock
  is the universal glyph for not-editable"*, on three behaviors' worth of editable cells.

Before you finish a surface, read your sketch back against the behaviors anchored to it
and count the things it draws. If a glyph implies a rule, the rule belongs in a claim; if
a claim says a number, the sketch has to show that number.

### 3a-ter. High-fidelity HTML mocks (sketch_html) — generate alongside the ASCII

Each UX view also takes an **OPTIONAL `sketch_html`** field — a static HTML version of the sketch the web renderer prefers over ASCII. When `productos/config.yaml` has `web.stylesheet` and (ideally) `web.components_dir` configured, the rendered page loads the user's actual CSS, so a mock written with their real class names looks like the real app rather than a wireframe. **Generate sketch_html alongside the ASCII whenever the config supports it** — it transforms the scope output from "ASCII drawings of a UI nobody sees" to "previews of the real app's UI that the PM can react to".

**Decision: should you generate sketch_html for this scope pass?**

1. Read `productos/config.yaml` directly. Check:
   - `web.stylesheet` — path to the user's CSS / Tailwind output. If unset, sketch_html still renders but with generic styling — flag that and suggest the user set it before continuing if visual fidelity matters to them.
   - `web.components_dir` — path to the user's components (e.g. `src/components`, `app/`). If set, this is the source you mirror.
2. **If `web.components_dir` is set: yes, generate sketch_html for every UX view in this scope.** Partial coverage looks broken — the un-mocked views fall back to ASCII and feel jarring next to styled ones.
3. **If only `web.stylesheet` is set: ask the user.** They may want the fidelity bonus even without component source — say "I can generate generic HTML that loads your stylesheet but I won't be mirroring your components — useful?"
4. **If neither is set: skip sketch_html.** ASCII alone is fine. Optionally suggest at the end: "Want richer previews? Set `web.stylesheet` (and `web.components_dir` if you have one) in productos/config.yaml and re-run scope."

**How to produce a good sketch_html:**

1. **Read the real components first.** Walk `web.components_dir` and pick the components the screen would naturally compose. The job is mirroring, not invention.
2. **Read the stylesheet** (`web.stylesheet` path) — or for Tailwind, scan a few representative components to learn class conventions. Pull real class names from source; don't invent.
3. **Produce static HTML** that mirrors the component structure: same semantic elements, same class names, same nesting. No JavaScript, no interactivity, no event handlers — the renderer wraps the mock in `<div class="ux-mock">` and styles it via the user's CSS; that's all the rendering you need.
4. **Keep the ASCII `sketch` alongside.** ASCII stays as the canonical reader-friendly view in CLI and inline Claude; sketch_html is the web-renderer fidelity bonus.
5. **Don't hand-wire navigation hrefs.** Wrap clickable text in plain `<a>` tags — leave `href` blank or set to anything. The renderer post-processes sketch_html and auto-fills `href` from each element's `leads_to` declaration. It matches on the element's `label` text (case-insensitive), or on a `data-element="<element-id>"` attribute if you want to be explicit. Example: an element with `label: "Adjust"` + `leads_to: adjust-guideline-modal` → wrapping the text "Adjust" in `<a>` gets href `#surface-adjust-guideline-modal` automatically.
6. **Mirror the ASCII labels verbatim.** Same words in the HTML as in the ASCII as in `elements[].label` — that's how the renderer's text matcher finds navigation targets.
7. **All UX views or none.** Partial coverage produces a jarring mix of styled and wireframe screens. Either generate sketch_html for every UX view in the feature, or for none.

**Write order during scope:** ASCII `sketch` first (always required), then `sketch_html` for the same view in the same `productos_add_or_replace_ux` call (or follow up with `productos_update_ux(..., { sketch_html: "..." })`). Don't drop the ASCII once you have HTML — both fields stay.

### 3a-bis. Deterministic scope rule (apply BEFORE listing behaviors)

When a user action in one feature mutates state in another (kid completes a task → balance changes; interest accrual → balance changes; spend → balance changes), **the behavior belongs to the feature whose user-facing trigger fires.** Not the feature whose state is mutated.

| Trigger | Behavior owned by |
|---|---|
| Parent submits + Earn form | `wallet/earn` (or wherever the form lives) |
| Parent submits − Spend form | `wallet/spend` |
| Kid taps "Complete" on a task card | `tasks/complete-task` |
| Cron / settings change for interest | `wallet/interest` |
| Viewing the balance | `wallet/kid-balance` (display + invariant rules) |

The affected feature (here, `wallet/kid-balance`) does NOT redundantly own those mutation behaviors. Instead, it lists the triggering features under `affected_by`:

```yaml
id: wallet/kid-balance
title: Kid balance
affected_by:
  - wallet/earn
  - wallet/spend
  - tasks/complete-task
  - wallet/interest
```

Renders as an "Affected by:" pill row in the site, linking to each triggering feature. The PM can see at a glance "this balance changes via these other features" without us duplicating the trigger behaviors here.

**User override.** If the user has a strong preference about where a behavior should live ("I want all balance-mutation behaviors gathered inside wallet/kid-balance"), respect it — capture the user's chosen organization verbatim. The deterministic rule is the *default* when no preference is stated; it stops the skill from asking the PM unanswerable scope questions, but it isn't an enforcement gate.

### 3c. Three things you cannot write, and one you must always leave room for

**You are an agent. Three of the signals on a page are a person's to give, and writing
them yourself destroys their meaning:**

| Signal | Whose | Why not yours |
|---|---|---|
| **Read-through** (`productos read`) | a person, or an agent that says so | It says *somebody read this end to end and could build from it*. You may record one for an uninformed fresh-eyes review — that reader is worth having and is often the only one available at volume — but `--by` must name it as an agent. Never a human's name, and never for yourself: you wrote the page and cannot be surprised by it. |
| **Ambiguous** (`productos ask ambiguous`) | a reader | An ambiguity is found by somebody who did not already know what was meant. You wrote the claim; you cannot be surprised by it. |
| **A decision** (`productos decide`) | a person | See §"you do not answer these". |

What you **can** do is make room for them: an ambiguity you can already see is not an
ambiguity to flag, it is a claim to rewrite. If you notice two readings while writing,
fix the sentence.

And record the fourth honestly: **`blocks: []` on a question you have worked out blocks
nothing** is a real contribution. Leaving it absent says nobody has looked.

### 3d. When a screen is not built yet

Set `status: planned` on the surface, not just `stub: true`, and write the **intended**
behaviors:

```yaml
ux:
  - id: properties-tab
    title: Properties
    status: planned
    stub: true
    runtime: web
```

⛔ **A stub is not a home for a claim about its own emptiness.** A real corpus had three
unbuilt tabs whose only behavior was *"an unbuilt tab says it is unbuilt"*, and a PM asked
to build one concluded the model had no shape for intent at all — *"the actual work product
of my first day has nowhere to live."* It does: behaviors on a planned surface, marked
`stated` where the user told you and `guessed` where you inferred. `productos check`
reports a stub with nothing but placeholder claims on it.

### 3b. Decompose into behaviors (comprehensive — no artificial cap)

Each behavior is one falsifiable claim about what the product does. **Write every distinct behavior the code exhibits.** If a feature genuinely has 12 behaviors, write 12. Don't fold distinct claims into one to hit a count, and don't pad a simple feature to look more comprehensive than it is.

Heuristic: a behavior is one falsifiable claim. If two claims could be true/false independently, they're two behaviors. If the only way to distinguish them is implementation detail, it's one behavior.

The volume isn't a vetting concern — `productos-review` walks them one at a time at the user's pace; they can quit and resume.

#### When you can't tell what the claim should be — write an UNDEFINED behavior

Sometimes the code, the docs and the user's description genuinely disagree, or nobody
has decided yet. **Do not guess, and do not omit it.** Write the behavior with a
`question:` and **no `claim:`**:

```yaml
  - id: interest-rate-floor-meaning
    question: >
      Is an interest rate floor a lender policy the deal is measured against, or
      something the sizing model computes per option? The two readings of the
      template disagree, so nothing here claims what a floor does.
    asked_of: an underwriter          # who owes the answer — REQUIRED in practice
    asked_at: 2026-09-18              # when you raised it
    blocks: []                        # what cannot be built until it is answered
```

**Three fields make the difference between a recorded question and a useful one.**

`asked_of` — **never write this as prose.** `notes: Settled by an underwriter.` was the
shape a whole real corpus used, and as prose it cannot be listed, counted or chased:
nobody can ask *"what is product sitting on?"*, so a named owner has exactly the same
effect as no owner. `productos check` now reports it.

`asked_at` — a question with no age looks equally fresh forever. A fresh reader: *"I
cannot tell whether it was raised yesterday or has been open for a year, or whether
anyone ever asked the customer."* Nothing feels overdue if nothing has an age.

`blocks` — **the empty list is a real answer and you should write it.** `blocks: []`
says *the rest of this can ship without it*, which is precisely what lets a reader
proceed. Omitting the field says nobody has worked it out. A reviewer hit this directly:

> *"I wanted to record `buy-down-twin-own-inputs` blocks 4 of the 8 columns and the
> option data model; `recommended-option-recorded` blocks nothing and can ship later. No
> field held it, so my brief says 'asked for a human' for both, flattening a hard
> blocker and a nice-to-have into one word."*

Values are behavior ids in this container, or `<container-id>#<behavior-id>` elsewhere.

**⛔ A behavior has a claim OR a question, never both and never neither.** The schema
rejects both. If a claim is decided but some edge of it is still open, that edge is
its **own** undefined behavior with its own id — otherwise "is this decided?" has two
answers and the state can't be derived.

Why this shape rather than a note, a TODO, or a message to the user:

- It renders as **undefined** — the rung below unverified. There is nothing for a human
  to accept, so it never lands in a review queue where a reviewer has nothing to do.
- It makes the feature **not ready to build**, visibly, in the sidebar and in
  `productos gaps`. An agent cannot build past it by accident.
- Answering it fills in `claim` **on the same stable id**, so
  undefined → awaiting review → accepted happens on one id and the history records that
  the ambiguity existed.

An undefined behavior carries **no test cases** — there is no claim to demonstrate.

#### ⛔ You do not answer these. `productos decide` does, and only a person runs it

```bash
productos decide <container> <behavior> --claim "..." --because "..."
```

It keeps the question in `answers:`, records `decided_by` / `decided_at` / `because`,
and **refuses a behavior that already carries a claim** — re-deciding a settled claim
would fabricate a decision record for a question nobody asked.

If the user tells you the answer in conversation, run it with `--by <them>`. Never fill
in a claim over a question yourself: the whole reason an undefined behavior is safe to
write is that nothing can quietly turn it into a decision.

#### Scope: does this claim hold for the whole product?

Set `holds_for` when the claim is only asserted of something narrower:

```yaml
    holds_for: the Colliers template
```

This exists because of the **highest-cost ambiguity a fresh reader has found**. One page
stated a lender's accepted-value ladder — *"LTV between 0.55 and 0.90 and DSCR between
1.00 and 1.60, in steps of 0.05"* — in exactly the same grammatical form as the
product's invariants, with nothing saying whose numbers they were:

> *"Two engineers reading this today will answer differently, and both will pass every
> existing test. If it is really a product rule and I make it per-template, I have
> removed a guard. If it is really per-template and an engineer hard-codes 0.55–0.90,
> lender two's legitimate 0.925 is refused at delivery on every deal, presented as 'a
> value the template cannot hold' — which is a lie about their template."*

**⛔ But `holds_for` is usually the wrong fix, and reaching for it first is the trap.**
If the claim states *values* that vary by customer, those values are that customer's
**data** and belong nowhere in product truth. The claim is the **rule** about them:

```yaml
# ✗ one customer's numbers, asserted as product truth
claim: The workbook accepts an LTV between 0.55 and 0.90 in steps of 0.05.

# ✓ the rule, which is what the product actually promises
claim: >
  Each template declares the values its cells will hold. A value falling between the
  declared steps is surfaced as unholdable rather than rounded to one that fits.
```

Use `holds_for` when the **rule itself** is narrower than the product — a guarantee that
genuinely only applies to one integration, one plan tier, one region. `productos check`
flags a claim carrying three or more specific decimals with no scope, because that shape
is almost always somebody's configuration pinned into a claim.

#### Walk every element systematically — don't stop at the happy path

The most common scoping failure is writing ONE happy-path behavior per UX view ("user submits the form") and skipping the rules every element implies. Walk each element and ask the questions below. Most will produce a behavior; some won't apply.

**For every `input` element:**
- **Validation** — what values does it accept / reject? (positive only? non-empty? max length? format?) → one behavior per validation rule
- **Default value** — does it start empty, or pre-filled with something? → behavior if non-obvious
- **Focus** — does it autofocus on mount? → behavior if yes
- **Error display** — when invalid, does it show an inline error? → behavior

**For every `button` (especially submit-style):**
- **Enabled state** — always enabled, or only when some condition is met? ("disabled until amount > 0", "disabled while pending") → behavior per condition
- **Primary action outcome** — what happens on tap/click? → main behavior, usually the one that's there already
- **Loading / pending state** — does it change appearance while the action is in flight? → behavior if visible
- **Failure handling** — what happens if the action errors? → behavior

**For every `card` / `row` / list item:**
- **Tap target** — does the whole row navigate, or just an icon? → behavior

**For every `link` / CTA:**
- **Destination** — where does it go? → behavior (often the leads_to itself is the behavior)

**For every form (the whole UX view, not just elements):**
- **Initial render** — what's shown on first open? → behavior if non-trivial
- **Default label / fallback values** — what shows up when an optional field is left blank? → behavior
- **Cancel / back path** — what happens if the user backs out? → behavior
- **Successful submission outcome** — what state changes in the system? (transaction recorded, balance updated, redirect to X) → behavior per system-state change
- **Server error path** — what does the user see if the submit fails? → behavior

**Feature-level rules / invariants** (no UX anchor):
- **Authorization** — who can do this? (logged-in only? owner only? admin?) → behavior
- **Precision / format** — currency rounding, date format, etc. → behavior
- **Persistence / idempotency** — can the same action be replayed safely? → behavior if a guarantee
- **Concurrency** — what happens with simultaneous actions on the same record? → behavior if a guarantee

For a form like "Earn money" (3 inputs + submit + cancel), you should typically produce **5–10 behaviors**, not 1. If you find yourself writing 1, you missed the rules — go back and walk the checklist.

#### Naming behaviors

Use a short, kebab-case id that names the rule, not the element:
- ✓ `amount-must-be-positive` (rule)
- ✓ `submit-disabled-until-valid` (rule)
- ✓ `reason-defaults-to-earned` (rule)
- ✗ `submit-button-click` (element-named, not a claim)
- ✗ `earn-flow` (too broad — it folds in 5+ rules)

For each behavior:

- **Claim:** in product language — "When a guest user clicks Checkout, they reach the confirmation page without being asked to create an account." Not "POST /api/checkout returns 200."
- **Anchor (when applicable):** if the behavior is triggered by an interaction on a UX view, set:
  - `ux`: the UxView.id (e.g. `cart-page`)
  - `element`: the Element.id (e.g. `checkout-cta`) — optional
  - `interaction`: what action (`click`, `submit`, `view`, `load`, `input`, `tap`, etc.) — freeform, optional
  Rules / invariants that aren't tied to a screen leave these blank.
- **Notes (optional):** non-obvious context, links to principles
- **Test cases:** numbered list of concrete scenarios that demonstrate the claim
  - Each case has `id` (1, 2, 3, ...), `description`, and either `given`/`when`/`then` blocks or freeform `steps`
  - Pick a `level` per case: `unit`, `integration`, `api`, or `e2e`. Default to whatever the existing test culture suggests.
  - 1-3 cases per behavior typically. Quality over quantity.

### 3e. ⛔ The capability pass: find the machinery by its verbs

**Every corpus written with this tool comes out screen-heavy, and it is the tool's fault
before it is yours.** A feature has a route, a component, a screen to walk — a capability
has none of those, so there is nothing to trip over while reading code. One real corpus
came out **111 behaviors of screen against 35 of machinery**, in a product whose own
overview says the real work happens underneath. Three fresh readers built briefs from it
before anyone noticed, and the first thing the person who noticed said was: *"there's no
capabilities around document processing, upload, etc. how could this possibly work?"*

So do this as a deliberate pass, after the features and before you hand anything back.

**1. List every verb your feature claims attribute to the system.** Go through the claims
you just wrote and pull out what the *product* does as opposed to what the *user* does:

> read from the file · scored with low confidence · not located in the file · a
> re-supplied file · delivered to the workbook · captured from the model · resolved
> against the selection · minted a version

**2. For each verb, name the page that owns it.** Not the page that *mentions* it — the
page whose claims say what a caller may rely on when it happens.

**3. Every verb with no owner is a missing capability.** Not a missing sentence: a missing
page. In that corpus, *upload, parse, extract and confidence-score* were referenced by
four features and owned by nothing, so the screens promised behaviour that rested on
machinery nobody had specified — and the hard failure states all live there.

**4. Sanity-check the ratio before you finish.** `productos check` prints it. If the
machinery is under a third of a corpus for a product that does real work underneath, you
have not finished this pass. Say so in your handoff rather than letting somebody find it
three reviews later.

⛔ **A feature with eight or more behaviors and no `depends_on` is the tell.** Either it
genuinely does everything itself — rare, worth stating out loud in the body — or you never
traced it. `productos check` flags it, and a reader cannot tell the two apart, which is
exactly the distinction the model exists to keep separable.

### 3f. ⛔ One surface per thing a user sees — not one surface per feature

A surface is **a thing that appears**: a page, a modal, a drawer, a panel, an empty state,
an error state, a loading state. It is not "the screen this feature lives on".

The failure is measurable and it shipped: one real feature had **25 behaviors anchored to a
single surface with 11 elements.** All the modals, all the empty and failure states, were
either missing or smuggled into element notes — and it rendered as a designed screen.
`productos check` now refuses that shape, but the check is a backstop, not a method.

The method: **when you find yourself writing a behavior about a state the current sketch
cannot show, that state is a surface.** A dialog is a surface. "Nothing here yet" is a
surface. "We could not read this" is a surface. Each gets its own `ux:` entry, its own
sketch, its own elements, and the behaviors that belong to it anchor there.

If one surface is collecting more than about a dozen behaviors, stop and ask what else a
user sees while using it. The answer is never "nothing".

### 4. Ask before writing if anything is ambiguous

Don't pick silently. Surface ambiguity:

- "Persistence — per-session, per-device, or per-account?"
- "Removing a missing item — silent success or 404?"
- "Authorization — anonymous OK or login required?"
- "Limits — max items? rate limit?"

Wait for answers. The answers go into the claim text or the notes — explicit, captured forever.

### 5. Propose the feature

Call `productos_propose_feature`. It writes the new feature directly to `productos/products/<id>.md`. There's no draft layer — the file IS the feature. The human runs `productos review <id>` in their terminal to interactively trim behaviors/UX views or open the file in `$EDITOR`, and commits via git when satisfied. Re-running review is always safe; it's just an editor on the live file.

Pass to `productos_propose_feature`:

- `id` like `checkout/index` or `wishlist/manage`
- `title` in product language
- `status: built` if the code exists; `planned` if pre-code
- `description` (short paragraph)
- `ux` array — UX views with `sketch` (ASCII, always) + `sketch_html` (when `web.components_dir` is set — see §3a-ter) + elements (see §3a)
- `behaviors` array, each with `id`, `claim`, optional `surface`/`element`/`interaction`, optional `notes`, `test_cases` array
- `affected_by` array — features whose triggers mutate this feature's state
- `body` (the markdown after the frontmatter) is **REQUIRED and must have substance.**

  A reader landing here should finish it knowing **what this thing is and how the
  domain works** — not a list of what the page contains. A list of behaviors tells
  someone *what is true*; the body is the only place that tells them *what they are
  looking at*. Aim for three or four short sections:

  - **What it is** — the situation in the user's world that this exists for. Concrete.
  - **How it works, in product terms** — the mechanic a newcomer needs to follow the
    claims. If two values are coupled, say so. If there's a ladder or an ordering, show
    it. A small fenced block of pseudo-arithmetic or a flow is fine and often the
    clearest thing on the page.
  - **The boundary** — what this deliberately does *not* do, and why, when the absence
    is load-bearing.
  - **Who works here** — the roles, when more than one person touches it.

  **⛔ Never write a table of contents.** *"This area holds what a quote is, where the
  limits come from, and the two screens that set them"* is navigation — the site
  already lists the features. Say what a quote **is**.

  **⛔ Never name a file, a table, a column, a route, a ticket or a branch.** Readers
  never see the storage; the hosted service has no files at all. If something true has
  nowhere to live, it needs a *field*, not prose — that is how `kind:` and `question:`
  came to exist.

  **Still don't write:**
  - Implementation rationale ("why this column?", "why this algorithm?") — that belongs
    in code comments and ADRs. Note the difference from the above: *"a cheaper loan is
    often a larger one, because the rate feeds the payment constant"* is product
    mechanics and belongs here; *"we denormalized this to avoid a join"* does not.
  - Design discussion (colors, fonts, animations) — ProductOS captures interface, not design
  - Lifecycle or validation status in prose — that's `status:` and the human stamp;
    prose restating either becomes a second record that rots silently
  - Lists of related features — `affected_by` covers that

**Edits to an EXISTING feature** use `productos_update_feature` / `productos_update_behavior` / `productos_add_behavior`. `productos_propose_feature` refuses to overwrite an existing id, keeping "create" vs "edit" explicit. The human can also run `productos review <id>` on any existing feature to edit it interactively.

### ⛔ Every behavior you propose needs a confidence and its basis

This is not optional and it is the single most useful thing you produce for the
reviewer. Review burden is the reason corpora get rubber-stamped, and a reviewer facing
forty undifferentiated claims cannot tell which ones you effectively made up.

Set these in the tracking sidecar, per behavior:

| `confidence:` | Use when | `basis:` |
|---|---|---|
| `stated` | **A human said it.** A sentence in the doc you were given, an answer to a question you asked, a line in a ticket. | **Required** — quote them |
| `observed` | **You read it off the code** and can point at the lines. | **Required** — file:line |
| `guessed` | **You inferred it.** Generalised from a pattern, assumed from convention, or wrote it because the feature "should" have it. | None needed |

```yaml
behaviors:
  sending-shows-them-as-invited:
    status: proposed
    confidence: stated
    basis:
      - kind: human
        ref: product review, 2026-09-12
        quote: the admin should see them on the list straight away, not after a refresh
  an-invite-needs-a-valid-address:
    status: proposed
    confidence: observed
    basis:
      - kind: code
        ref: app/team/invite-form.tsx:22-30
  an-outstanding-invite-is-explained-not-just-refused:
    status: proposed
    confidence: guessed
```

**⛔ Do not inflate.** `stated` and `observed` are claims about *evidence*, and the audit
rejects either one with an empty `basis` at **high** severity. If you are honestly
unsure whether the code says what you think, that is `guessed`.

**⛔ `guessed` is not a failure — hiding it is.** Guessing is often the right move while
scoping: you can see the shape of a rule the code only half-implements. Labelling it is
what lets the reviewer start there instead of finding it six weeks later in production.
A scope pass that reports everything as `stated` is worthless, because the reviewer
learns nothing about where to look.

**Rule of thumb:** if you cannot name the sentence or the line, it is `guessed`.

If the lifecycle is `built`, call `productos_update_tracking` after writing the feature:

- `implements: ["src/checkout/index.ts", ...]`
- per-behavior: `code_refs: ["src/checkout/index.ts:42-78"]`, `status: "proposed"`,
  plus `confidence:` and `basis:` as above

Never set `status: "verified"` — only the human does that, via the site or the `productos-review` skill.

### 6. Surface potential gaps — and write the real ones into the feature

Reading code only shows what *is*. The product question is often the opposite: **what's
missing?** Before handing off to vet, list 3-7 questions a product person might ask
about behavior that should probably exist but you couldn't find. Frame each as a
*question*, not a claim:

**⛔ A question that is genuinely undecided goes INTO the feature as an undefined
behavior** (§3b), not only into your message. A question raised in chat is gone the
moment the session ends; an undefined behavior blocks the feature from reading as
ready-to-build until somebody answers it.

Keep in your message only the questions that are *speculative* — "should this exist at
all?" — and write as undefined behaviors the ones where you know a behavior belongs
there and cannot tell what it claims.

- "Can a guest user *recover* their cart if they accidentally close the tab?"
- "Is there rate-limiting on the order endpoint to prevent abuse?"
- "Does the confirmation page handle a slow tax calc gracefully?"
- "Is the guest email validated for syntax before order creation?"
- "What if the guest later signs up with the same email — does the order migrate?"

Don't propose Contracts for these. Don't write tracking. *List them as open questions in the handoff* so the human decides which deserve a behavior, which are non-goals, and which are misunderstandings.

Lenses to draw from (pick whichever fit the feature):

| Lens | Example questions |
|---|---|
| **Error paths** | What happens on network failure? Timeout? Partial state? |
| **Edge inputs** | Empty / whitespace / Unicode / extreme values? |
| **Concurrency** | Two users doing this simultaneously? Same user, two devices? |
| **Authorization** | Logged-out? Wrong role? Cross-tenant? |
| **Lifecycle** | What about *un*-doing? *Re*-doing? Mid-flight cancellation? |
| **Observability** | Can support verify this happened? |
| **Accessibility** | Keyboard? Screen reader? Color-only signals? |
| **Strategy fit** | Does every Design Principle still hold? |

### 6b. The area README, if you create or touch one

`productos/products/<product>/<area…>/README.md` renders as the **area overview page**. Same rules
as a feature body, and the same failure modes — it is the page that most often decays
into a file listing.

It states **what the area is and how its domain works.** It does not contain:

- a table of the files in it, or any filename at all
- a "where this came from" / conversion-history section
- a spec-versus-code delta table, ticket numbers, or branch names
- status marks (✅ / 📋 / 🔄) — lifecycle is `status:`, validation is a human stamp

Anything that is a statement about *documents and branches* rather than about the
product belongs outside `productos/products/` entirely.

### 7. Hand off cleanly

Tell the user the feature is written and surface the gap questions:

```
I wrote N behaviors for <feature_id> at productos/products/<feature_id>.md.

Review and edit it interactively in your terminal:
  productos review <feature_id>

That command walks you through the UX views + behaviors, lets you trim or edit
in $EDITOR, and saves changes back to the same file. Commit via git when satisfied.

Potential gaps (questions, no behaviors written for these):
  1. <gap question 1>
  2. <gap question 2>
  ...
```

## Worked example — in-flight protection

User: "I'm about to refactor the checkout flow. Scope ProductOS on it first."

You read `src/checkout/index.ts`, `src/api/checkout/place-order.ts`, `src/pages/checkout/confirm.tsx`.

You ask: "Quick clarifications before I write:
- Guest checkout — I see `requireAuth` is conditional. Confirming: a guest user CAN complete checkout without an account?
- Tax rounding — code uses Math.round. Is banker's rounding (HALF_EVEN) intended, or floor, or simple round?"

User: "Yes guest can checkout. Tax uses banker's rounding — I added it last week, code probably hasn't caught up."

You write:

```yaml
id: checkout/index
title: Checkout flow
status: built
description: A guest or logged-in user completes an order from their cart.
behaviors:
  - id: guest-flow
    claim: "A guest user can complete checkout without creating an account; the order is recorded against their guest email."
    test_cases:
      - id: 1
        level: e2e
        description: "Guest reaches confirmation page without an account prompt"
        given: "an empty session, an item in the cart"
        when: "the user clicks Checkout and provides a guest email"
        then: "the confirmation page renders with an order id"
      - id: 2
        level: api
        description: "Order record carries the guest email"
        given: "no logged-in user"
        when: "POST /api/checkout completes successfully"
        then: "the order row has user_id=null and guest_email set"
  - id: tax-rounding
    claim: "Tax line on the invoice uses banker's rounding (HALF_EVEN). Intent: matches accounting standards; will outlive the current implementation."
    test_cases:
      - id: 1
        level: unit
        description: "0.5 rounds to even"
        given: "a subtotal that yields tax of $1.005"
        when: "the tax line is computed"
        then: "the tax line shows $1.00, not $1.01"
```

Then call `productos_update_tracking` with `implements` and `code_refs`.

Then tell the user:

> Proposed 2 behaviors for `checkout/index`. Vet them either:
>   • In Claude Code: "Use productos-review on checkout/index"
>   • In the site: http://localhost:7878/checkout/index
>
> Note: I read the tax-rounding code (`src/checkout/tax.ts:34`). It currently uses `Math.round`, NOT banker's rounding. The claim reflects your stated intent; you'll want to fix the code before accepting this Contract — or it'll come back as `Contested` once tests run against it.

That last note is gold. Surface code-vs-intent gaps the moment you see them.

## Worked example — a form (showing the checklist in action)

User: "Scope productos on the Earn flow — kid-detail has an Earn button that opens a form."

You read the form. It has: an Amount input, an optional Reason input, a Cancel link, and an "Add money" submit button. The submit is disabled until amount > 0; the amount input autofocuses on open; on success the kid's balance increments and the user returns to kid-detail.

**Bad output (what an LLM defaults to — DON'T do this):**

```yaml
behaviors:
  - id: earn-flow
    claim: "On submit, a credit is recorded against the kid and the user returns to kid-detail."
```

One behavior. Misses everything in the checklist.

**Good output (walking the checklist):**

```yaml
behaviors:
  - id: amount-must-be-positive
    claim: "The Amount input only accepts values greater than zero. Submitting zero or a negative number does nothing — no transaction is recorded and the form stays open."
    surface: earn-form
    element: amount-input
    interaction: input
    test_cases: [...]
  - id: amount-autofocuses-on-open
    claim: "When the Earn form opens, focus lands in the Amount input."
    surface: earn-form
    element: amount-input
    interaction: view
    test_cases: [...]
  - id: reason-is-optional
    claim: "The parent can leave Reason blank and still submit. The row label defaults to 'Earned'."
    surface: earn-form
    element: reason-input
    test_cases: [...]
  - id: submit-disabled-until-valid
    claim: "The Add money button is disabled until the amount is greater than zero. The disabled state reads visually as greyed-out and is not tappable."
    surface: earn-form
    element: submit-button
    interaction: view
    test_cases: [...]
  - id: submit-records-credit
    claim: "On a valid submit, a credit transaction is recorded against the focused kid for the amount entered."
    surface: earn-form
    element: submit-button
    interaction: submit
    test_cases: [...]
  - id: submit-returns-to-kid-detail
    claim: "After a successful submit, the user returns to the kid's detail screen with the new balance reflected."
    surface: earn-form
    element: submit-button
    interaction: submit
    test_cases: [...]
  - id: cancel-discards-input
    claim: "Tapping Cancel returns to the kid's detail screen without recording anything. No transaction is created."
    surface: earn-form
    element: cancel-link
    interaction: tap
    test_cases: [...]
  - id: server-failure-keeps-form-open
    claim: "If the credit fails to record server-side, the form stays open with the entered values and an inline error appears."
    surface: earn-form
    element: submit-button
    interaction: submit
    test_cases: [...]
```

Eight behaviors from one form. That's the right level. Each is a falsifiable rule with its own anchor and its own test cases. The PM can argue with any of them individually.

## Whatever the user named IS the feature. Don't pre-decompose.

**The most common scoping failure is pre-decomposing a feature into sub-features before scoping it.** This happens when you see a large codebase footprint (many components, many files, lots of LOC) and reach for the "split" tool to make the work feel manageable. That's exactly backwards.

The PM's mental unit is the feature. When they say "scope risk-analysis", `risk-analysis` IS the feature — even if it spans 10 components and 3,000 LOC. Scope it whole. **Don't propose a split before you've enumerated.**

**Hard rule**: until you've written all the UX views and behaviors for the feature the user named, **don't even mention splitting**. The output of the scope tells you whether splitting is needed; the input (component count, LOC, file count) doesn't.

Concrete examples of what NOT to do:

- ❌ "Risk analysis has ~3,000 LOC across 10 components — this is multiple features. Let me start with the trigger sub-feature." → Wrong. Scope all of it, then look at the output.
- ❌ "Checkout has cart, payment, and confirmation pages — let me split into three features." → Wrong if the user said "scope checkout." Checkout IS the feature.
- ❌ "Auth has signup and login — let me ask how to split." → Wrong if the user said "scope auth." Both flows are part of one feature unless they've genuinely diverged into different user-visible products.

## When to consider splitting (post-scope, not pre-scope)

After you've enumerated the whole feature, if the result is unwieldy, **then** consider whether the behaviors cluster into separable concerns. Splitting is appropriate when ALL of the following are true:

1. The scope produced **30+ behaviors** AND **12+ UX views** (one alone isn't enough; LOC and component count alone never are)
2. The behaviors **cluster cleanly** into 2-3 groups where each group could stand alone as a coherent product story
3. **Different stakeholders** would care about different groups (a PM owning checkout cart wouldn't necessarily own payment-method)
4. The split is along **user-meaningful axes** (flow, persona, lifecycle phase), not along widgets, components, or files

If you're not confident on ALL FOUR, leave it as one feature. A long feature page is fine — `productos-review` walks the behaviors at the user's pace, the area-level flow chart links related features, and the audit roll-up keeps coverage visible.

**Acceptable splittable axes** (if all four criteria are met):

| Split axis | Example |
|---|---|
| **By user flow / state** | `checkout/cart`, `checkout/payment-method`, `checkout/confirmation` — IF these are genuinely separable stages with their own PMs / domains |
| **By data domain** | `wallet/transactions` vs `wallet/kid-balance` vs `wallet/interest` — IF the domains have distinct invariants |
| **By persona** | `auth/parent-login` vs `auth/kid-login` — IF the experiences are meaningfully different products |
| **By trigger origin** | `tasks/create-task` (parent) vs `tasks/complete-task` (kid) — IF the trigger surfaces are separate |
| **By lifecycle phase** | `onboarding/welcome` vs `onboarding/add-first-kid` — IF the phases have separate stakeholders |

**Anti-patterns — never these splits:**

- ❌ **By widget**: `earn-form-amount-input` is not a feature
- ❌ **By component file**: the component tree is an engineering decomposition, not a product one
- ❌ **By API endpoint**: routes are implementation, not product
- ❌ **By "trigger" vs "result"**: triggering an analysis and seeing its results are TWO HALVES of one feature, not two features
- ❌ **By backend vs frontend**: features span the stack

**How to propose a split (only after scoping)**: write the full feature first via `productos_propose_feature`, then if AND ONLY IF the four criteria above are met, follow up with: "I scoped this as one feature (N behaviors, M UX views). Looking at the result, the behaviors cluster into [groups A / B / C] — each could stand alone. Want me to split into [feature-A] and [feature-B], or keep as one?"

On user confirmation, propose the split features and remove the parent. On rejection (the default), leave the comprehensive feature as the canonical scope.

## Don't

- **Don't pre-decompose based on LOC, file count, or component count.** Component count in the codebase is not behavior count in the spec. Scope the whole feature the user named, then evaluate.
- **Don't model the whole codebase.** This is single-feature scope. If the user wants a full pass, they ask for `productos-fullscan` instead.
- **Don't artificially cap or pad behavior count.** Write every distinct behavior the code exhibits. If a feature has 12 distinct claims, write 12. `productos-review` walks them at the user's pace.
- **Don't stop at the happy path.** A form is not "one behavior" — walk the §3b checklist (validation, default, focus, disabled-state, error-path, cancel, success-outcome) and produce one behavior per rule. If a UX view has 3+ interactive elements and you wrote 1 behavior for it, you missed the rules.
- **Don't write claims in implementation language.** "POST /api/X returns 409" → wrong. "User sees 'already registered'" → right.
- **Don't set status='verified'.** Humans do that.
- **Don't paper over ambiguity.** If a decision isn't made, ask. If the user defers, capture in body.
- **Don't force a fit — record it.** If something true has no clean home in the model
  (not a feature, not a capability, not context, not a behavior), run
  `productos todo add "<what the model can't express>" --forced-into <where it had to go>`
  **before** you write it somewhere approximate. That is a TODO for ProductOS's
  developers, not a note to the user.

  This instruction has existed in some form since the first version of this skill and has
  been ignored repeatedly, which is why `productos todo scan` now **detects** forced fits
  mechanically. Recording it yourself is cheaper than being caught by the scan, and far
  cheaper than the alternative: a hand-placed compromise destroys the evidence that the
  framework was deficient, so the same gap gets rediscovered from scratch next session.

  Signs you are forcing a fit: a capability behavior you can only test through a screen;
  a container invented to hold prose; a rule written into a feature because there is no
  principle file for it; anything that made you write "for now" or "temporarily".
- **Don't fabricate code paths or test cases.** Cite what you read; describe what you observed.
