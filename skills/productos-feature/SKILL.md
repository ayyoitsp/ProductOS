---
name: productos-feature
description: Use when peter is planning a new feature or change before writing code — to consult existing product truth, decompose the plan into a productos/products/<area>/<feature>.md file with planned behaviors, and surface ambiguities as questions. Triggers on "I'm planning a [feature]", "let's spec a [feature] in productos", "vet this plan against the product". The output is product-truth markdown only; implementation tracking is empty until code exists.
version: 0.1.0
---

# ProductOS — Feature Planning Skill

The user is planning a feature before writing code. Your job: decompose the plan into a product-truth markdown file with `status: planned`, surface ambiguities as questions, write the claims in product language.

You produce **only product truth** here. No tracking file. No code refs. Implementation tracking starts empty and gets filled in by `productos-analyze` once the code lands.

## Three steps

### 1. Consult

Call `productos_list_areas` + `productos_list_features` to see what exists. Read related features via `productos_get_feature`. The whole point of planning in product truth is reading what's already there.

### 2. Decompose + ask

Read the user's description. Draft a candidate list of 4-12 behaviors covering the load-bearing surface. For each, ask: is this ambiguous? Surface ambiguity as a question, *don't pick a side silently*:

- Data shape?  ("does the response include the updated wishlist, or just an ack?")
- Persistence? ("per-session, per-device, per-account?")
- Error paths? ("removing a missing item: 404 or 200?")
- Authorization? ("admin-only? logged-in-only?")
- Limits? ("max items? rate limit?")

Wait for answers. Once decisions are made, those decisions are explicit in the markdown — that's the value.

### 3. Write product truth

Use `productos_propose_feature` with:
- `id` like `wishlist/manage`
- `title`, `status: planned`, `description`
- `behaviors`: list of `{ id, claim, notes? }` — claims in product language only
- `body`: rationale, out-of-scope items, UX notes

That's all. No tracking, no code refs, no status on behaviors (the `planned` feature status implies behaviors are pre-implementation).

## Worked example

User: "I'm planning a wishlist: users can add products, see them at /wishlist, remove them. Persists across sessions."

You ask:
- "Per-account persistence (across devices)? Or per-device?"
- "Removing a product not in the wishlist — succeed silently, or 404?"
- "Anonymous wishlists, or login required?"
- "Max items per wishlist?"

User: "Per-account, silent success on remove, login required, no max."

You write:

```yaml
id: wishlist/manage
title: Wishlist
status: planned
description: Logged-in users can save products to a wishlist that follows their account.
behaviors:
  - id: add-to-wishlist
    claim: "When a logged-in user clicks 'Add to wishlist' on a product, the product is saved to their wishlist and appears in their wishlist on every device they're logged in on."
  - id: add-duplicate-is-idempotent
    claim: "When a logged-in user adds a product that's already in their wishlist, no error is shown and the wishlist still contains the product exactly once."
  - id: view-wishlist
    claim: "When a logged-in user opens /wishlist, they see the products currently in their wishlist."
  - id: remove-from-wishlist
    claim: "When a logged-in user clicks 'Remove' on an item in their wishlist, the item disappears immediately."
  - id: remove-missing-is-silent
    claim: "When a logged-in user removes an item that isn't in their wishlist, no error is shown and the wishlist is unchanged."
  - id: requires-login
    claim: "When a logged-out user tries to add to or view a wishlist, they are prompted to sign in or sign up."
```

Body:

```markdown
# Wishlist

## Rationale

15 user research requests this quarter — top frustration is "I see a product I'm not ready to buy and lose it."

## Decisions captured

- Per-account, not per-device (matches login-required choice).
- Idempotent adds + silent removes — match e-commerce expectations.
- No max items in v1.

## Out of scope (v1)

- Wishlist sharing.
- Notifications when items go on sale.
- Bulk add from history.
```

## Don't

- **Don't propose `shipped` status.** Planning means `planned`.
- **Don't fabricate code paths.** That's `productos-analyze`'s job, after the code lands.
- **Don't paper over ambiguity.** If a decision isn't made, ask. If the user defers, capture that in the body — but don't pick silently.
- **Don't write implementation-flavored claims.** "POST /api/wishlist returns 200" → wrong. "User sees the product saved" → right.
