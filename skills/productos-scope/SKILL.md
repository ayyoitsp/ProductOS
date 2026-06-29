---
name: productos-scope
description: Use when the user wants to scope ProductOS on ONE in-flight feature (the v0.1 wedge) — either pre-code planning OR retrofit on a feature that already exists. Reads the relevant code paths, proposes COMPREHENSIVE COVERAGE of behaviors with claims + test_cases in product language (however many the feature actually has — don't artificially cap), plus UX views and their elements (ASCII sketches AND — when web.components_dir is configured — high-fidelity HTML mocks (sketch_html) mirroring the user's real components), and writes them to productos/products/<area>/<feature>.md as Unverified. Surfaces ambiguities and discrepancies as observations (not blocking questions) before writing. Triggers on "scope productos on the X flow", "scope X with productos", "I'm planning a Y feature", "let's spec X in productos". The 80% v0.1 entry point. (For a broad pass across the whole codebase, use `productos-fullscan` instead.)
version: 0.1.0
---

# ProductOS — Scope Skill (one feature at a time)

The v0.1 entry point. The user — typically a product lead — wants to scope ProductOS on **one feature**. You produce **comprehensive coverage** of that feature: every distinct behavior the code exhibits, every surface the user sees, every interactive element. Behaviors are claims + numbered test_cases, written in product language, committed to `productos/products/<area>/<feature>.md`. Don't cap the count artificially — a feature has however many behaviors it has. If you find yourself writing 15 behaviors, that's fine; if 3 is enough, that's fine too. The size of the slice should match the size of the feature.

You do **not** model the whole codebase. The wedge is scoped to one feature the user already cares about — usually one in flight (about to change) or one they want to protect from regression.

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

**Cross-reference principles, don't restate them.** Before writing each candidate behavior, ask: "Does this rule already exist as a principle?" If yes — write the behavior as a thin reference instead of a restatement:

```yaml
- id: submit-double-tap-safe
  claim: "Add money is single-fire on this form."
  notes: "Per principles#submits-are-idempotent — universal rule, this form follows it."
  test_cases: [...]
```

This keeps the principle as source-of-truth and the feature spec lean. If a candidate looks like a CROSS-CUTTING principle that doesn't exist yet ("all primary forms accept Enter-key submit", "no caps on financial amounts"), DON'T quietly bake it into this feature's behaviors. Flag it for the user: "this looks like a principle that would apply to other forms too — add it to context first?". On confirmation, call `productos_propose_context` to add it to `principles.md` BEFORE adding the per-feature behavior with a reference.

Test by reading the corpus: if you can imagine the same exact rule applying to another existing feature (spend-form, settings-form, login), it's a principle — not a per-feature behavior.

### 2. Scope to the feature

Identify the code paths relevant to the feature in question. Examples:

- "scope on checkout" → `src/checkout/*`, `src/api/checkout/*`, `src/pages/checkout/*`
- "scope on signup" → `src/api/auth/signup*`, `src/pages/signup*`
- "I'm planning a wishlist" → no code yet; lifecycle will be `planned`

**Read narrowly.** This is a feature scope, not a codebase scan. If the relevant code is more than ~10 files, ask the user to confirm scope before proceeding.

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

### 3b. Decompose into behaviors (comprehensive — no artificial cap)

Each behavior is one falsifiable claim about what the product does. **Write every distinct behavior the code exhibits.** If a feature genuinely has 12 behaviors, write 12. Don't fold distinct claims into one to hit a count, and don't pad a simple feature to look more comprehensive than it is.

Heuristic: a behavior is one falsifiable claim. If two claims could be true/false independently, they're two behaviors. If the only way to distinguish them is implementation detail, it's one behavior.

The volume isn't a vetting concern — `productos-review` walks them one at a time at the user's pace; they can quit and resume.

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
- `status: shipped` if the code exists; `planned` if pre-code
- `description` (short paragraph)
- `ux` array — UX views with `sketch` (ASCII, always) + `sketch_html` (when `web.components_dir` is set — see §3a-ter) + elements (see §3a)
- `behaviors` array, each with `id`, `claim`, optional `surface`/`element`/`interaction`, optional `notes`, `test_cases` array
- `affected_by` array — features whose triggers mutate this feature's state
- `body` (the markdown after the frontmatter) is **OPTIONAL** and stays SHORT. Use it for product-language context that doesn't fit in the description — a sentence or two on who/when/why-this-feature-exists. **Don't write:**
  - Implementation rationale ("Why derived, not stored?", "Why this column?", "Why this algorithm?") — engineering discussion belongs in code comments / ADRs / PR descriptions, not the product spec
  - Out-of-scope sections that catalog what isn't here — the absence of behaviors IS the scope; surfaces/behaviors are the canonical statement of what's covered, and `affected_by` already names what triggers from elsewhere
  - Design discussion (colors, fonts, animations) — ProductOS captures interface, not design
  - Lists of related features ("see also wallet/spend") — `affected_by` and feature links cover that
  Default to writing nothing in the body. If you can't summarize the feature in description + behaviors + surfaces alone, that's a signal the feature is doing too much.

**Edits to an EXISTING feature** use `productos_update_feature` / `productos_update_behavior` / `productos_add_behavior`. `productos_propose_feature` refuses to overwrite an existing id, keeping "create" vs "edit" explicit. The human can also run `productos review <id>` on any existing feature to edit it interactively.

If the lifecycle is `shipped`, call `productos_update_tracking` after writing the feature:

- `implements: ["src/checkout/index.ts", ...]`
- per-behavior: `code_refs: ["src/checkout/index.ts:42-78"]`, `status: "proposed"` (awaiting human acceptance)

Never set `status: "verified"` — only the human does that, via the site or the `productos-review` skill.

### 6. Surface potential gaps

Reading code only shows what *is*. The product question is often the opposite: **what's missing?** Before handing off to vet, list 3-7 questions a product person might ask about behavior that should probably exist but you couldn't find. Frame each as a *question*, not a claim:

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
status: shipped
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
- **Don't fabricate code paths or test cases.** Cite what you read; describe what you observed.
