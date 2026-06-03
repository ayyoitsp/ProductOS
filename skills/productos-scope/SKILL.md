---
name: productos-scope
description: Use when the user wants to scope ProductOS on ONE in-flight feature (the v0.1 wedge) — either pre-code planning OR retrofit on a feature that already exists. Reads the relevant code paths, proposes COMPREHENSIVE COVERAGE of behaviors with claims + test_cases in product language (however many the feature actually has — don't artificially cap), plus UX views and their elements, and writes them to productos/products/<area>/<feature>.md as Unverified. Surfaces ambiguities and discrepancies as observations (not blocking questions) before writing. Triggers on "scope productos on the X flow", "scope X with productos", "I'm planning a Y feature", "let's spec X in productos". The 80% v0.1 entry point. (For a broad pass across the whole codebase, use `productos-fullscan` instead.)
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

### 5. Propose the feature (writes a draft, not live truth)

Call `productos_propose_feature`. NEW features always land in `productos/drafts/<id>.md` and wait for the human to run `productos review <id>` in their terminal. That command shows them the draft, lets them trim behaviors/UX views or open the file in `$EDITOR`, then promotes it to `productos/products/<id>.md` (or discards it).

Why drafts:
- Scope is the highest-leverage moment of capture; the human MUST sign off before it becomes Product Truth others cite.
- Same review UX as the BYOK `productos scan` runner — one path for new features regardless of who proposed.
- A draft is harmless if the human walks away — `productos serve` doesn't render it, gap reports ignore it.

Pass to `productos_propose_feature`:

- `id` like `checkout/index` or `wishlist/manage`
- `title` in product language
- `status: shipped` if the code exists; `planned` if pre-code
- `description` (short paragraph)
- `ux` array — UX views with sketches + elements (see §3a)
- `behaviors` array, each with `id`, `claim`, optional `surface`/`element`/`interaction`, optional `notes`, `test_cases` array
- `affected_by` array — features whose triggers mutate this feature's state
- `body` (the markdown after the frontmatter) is **OPTIONAL** and stays SHORT. Use it for product-language context that doesn't fit in the description — a sentence or two on who/when/why-this-feature-exists. **Don't write:**
  - Implementation rationale ("Why derived, not stored?", "Why this column?", "Why this algorithm?") — engineering discussion belongs in code comments / ADRs / PR descriptions, not the product spec
  - Out-of-scope sections that catalog what isn't here — the absence of behaviors IS the scope; surfaces/behaviors are the canonical statement of what's covered, and `affected_by` already names what triggers from elsewhere
  - Design discussion (colors, fonts, animations) — ProductOS captures interface, not design
  - Lists of related features ("see also wallet/spend") — `affected_by` and feature links cover that
  Default to writing nothing in the body. If you can't summarize the feature in description + behaviors + surfaces alone, that's a signal the feature is doing too much.

**Edits to an EXISTING feature** (already in products/) use `productos_update_feature` / `productos_update_behavior` / `productos_add_behavior` directly — those skip review because the human already signed off when the feature was first promoted. `productos_propose_feature` refuses to re-propose an existing id.

Tracking (code refs, status) is set AFTER the draft is promoted. If the lifecycle is `shipped`, you can call `productos_update_tracking` once the draft is accepted:

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

Tell the user the draft is ready and surface the gap questions:

```
I drafted N behaviors for <feature_id>. The draft is at productos/drafts/<feature_id>.md
— it isn't live Product Truth yet.

Review it interactively in your terminal:
  productos review <feature_id>

That command walks you through the UX views + behaviors, lets you trim or edit
in $EDITOR, then promotes the draft to productos/products/.

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

## Don't

- **Don't model the whole codebase.** This is single-feature scope. If the user wants a full pass, they ask for `productos-fullscan` instead.
- **Don't artificially cap or pad behavior count.** Write every distinct behavior the code exhibits. If a feature has 12 distinct claims, write 12. `productos-review` walks them at the user's pace.
- **Don't write claims in implementation language.** "POST /api/X returns 409" → wrong. "User sees 'already registered'" → right.
- **Don't set status='verified'.** Humans do that.
- **Don't paper over ambiguity.** If a decision isn't made, ask. If the user defers, capture in body.
- **Don't fabricate code paths or test cases.** Cite what you read; describe what you observed.
