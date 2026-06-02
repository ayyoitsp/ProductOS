---
name: productos-feature
description: Use when the user wants to scope ProductOS on one in-flight feature (the v0.1 wedge) — either pre-code planning OR retrofit on a feature that already exists. Reads the relevant code paths, proposes 3-5 behaviors with claims + test_cases in product language, and writes them to productos/products/<area>/<feature>.md as Unverified. Surfaces ambiguities as questions before writing. Triggers on "scope productos on the X flow", "run a productos feature scope on Y", "I'm planning a Z feature", "let's spec X in productos". The 80% v0.1 entry point.
version: 0.2.0
---

# ProductOS — Feature Scope Skill

The v0.1 entry point. The user — typically a product lead — wants to scope ProductOS on **one feature**. You produce a small, vettable slice: 3-5 behaviors with claims + numbered test_cases, written in product language, committed to `productos/products/<area>/<feature>.md`.

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
- `sketch`: an **ASCII rough layout** (not pixel-perfect). Show the high-level structure + key interactive elements. Use box-drawing characters (`┌─┐│└┘`) for boxes, `[Label]` for buttons, `[___]` for inputs, `▢` for icons/list items, etc. ~6-15 lines per sketch. Don't try to be precise; *give the PM a mental anchor for the screen*.
- `elements`: named interactive items on the screen. Each element has `id` (kebab-case), `kind` (button, input, link, toggle, stepper, list, modal-trigger, etc. — freeform), `label` (human label), optional `notes`.

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

Surfaces are **optional** — features that are pure invariants/rules (a tax calculation, a balance constraint) don't have screens. Leave `surfaces` empty in that case.

### 3b. Decompose into 3-5 behaviors

Each behavior is one falsifiable claim about what the product does. Aim for 3-5, not 10. If you find more, the feature is probably two features.

For each behavior:

- **Claim:** in product language — "When a guest user clicks Checkout, they reach the confirmation page without being asked to create an account." Not "POST /api/checkout returns 200."
- **Anchor (when applicable):** if the behavior is triggered by an interaction on a Surface, set:
  - `surface`: the Surface.id (e.g. `cart-page`)
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

### 5. Write product truth

Call `productos_propose_feature` with:

- `id` like `checkout/index` or `wishlist/manage`
- `title` in product language
- `status: shipped` if the code exists; `planned` if pre-code
- `description` (short paragraph)
- `behaviors` array, each with `id`, `claim`, optional `notes`, and `test_cases` array
- `body` for rationale, decisions captured, out-of-scope

If the lifecycle is `shipped`, also call `productos_update_tracking` with the code paths you read:

- `implements: ["src/checkout/index.ts", ...]`
- per-behavior: `code_refs: ["src/checkout/index.ts:42-78"]`, `status: "proposed"` (awaiting human acceptance)

Never set `status: "verified"` — only the human does that, via the site or the `productos-vet` skill.

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

Tell the user where to vet AND surface the gap questions:

```
I proposed N behaviors for <feature_id>. Vet them either:

  In Claude Code (inline, no context switch):
    "Use productos-vet on <feature_id>"

  In the product-truth site:
    Open http://localhost:7878/<feature_id>

Potential gaps (questions, no Contracts written):
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
>   • In Claude Code: "Use productos-vet on checkout/index"
>   • In the site: http://localhost:7878/checkout/index
>
> Note: I read the tax-rounding code (`src/checkout/tax.ts:34`). It currently uses `Math.round`, NOT banker's rounding. The claim reflects your stated intent; you'll want to fix the code before accepting this Contract — or it'll come back as `Contested` once tests run against it.

That last note is gold. Surface code-vs-intent gaps the moment you see them.

## Don't

- **Don't model the whole codebase.** This is feature scope. If the user wants a full pass, they ask for `productos-analyze` instead.
- **Don't propose 20 behaviors.** 3-5 is the target. More and the user can't vet in a sitting.
- **Don't write claims in implementation language.** "POST /api/X returns 409" → wrong. "User sees 'already registered'" → right.
- **Don't set status='verified'.** Humans do that.
- **Don't paper over ambiguity.** If a decision isn't made, ask. If the user defers, capture in body.
- **Don't fabricate code paths or test cases.** Cite what you read; describe what you observed.
