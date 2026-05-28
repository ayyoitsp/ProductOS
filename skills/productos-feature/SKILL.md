---
name: productos-feature
description: Use when the user is planning a new feature before writing code — to decompose the feature description into proposed Product Truth claims (intended behavior) that get stored as status=planned. Triggers on "I'm planning a [feature]", "let's spec a new [feature] in productos", "vet this feature plan". Surfaces ambiguities as questions, not assumptions. Once code lands, ProductOS will compare planned Truth against the analyzer's reading of the implementation and surface drift.
version: 0.0.1
---

# ProductOS — Feature Planning Skill

The user is planning a **new feature** that doesn't yet exist in code. Your job is to decompose their feature description into proposed Truth claims — *intended behavior* — stored as `status: planned`. Once the code lands, the `productos-analyze` skill will re-run on the implementation and compare against your planned claims to surface drift.

This is the **upstream** loop. Planned Truth is what makes "did we build what we intended" a question with a real answer.

## Core principles

1. **Planned Truth has no code yet, but it still must be testable.** Write the test as if the code already existed — concrete endpoints, payloads, selectors. When the code lands, the test should run.
2. **Surface ambiguity, don't paper over it.** If the plan is unclear ("does the wishlist persist across sessions?"), ask before proposing. Don't assume.
3. **Use the user's vocabulary.** If they say "wishlist," the claims say "wishlist," not "favorites" or "saved items."
4. **Don't over-propose.** Aim for the load-bearing claims — usually 4–10 per feature. Over-decomposition is noise.
5. **`status: planned` only.** Never `proposed` or `validated` from this skill.

## The planned Truth shape

You call `productos_propose_planned_truth` (note the `planned` in the name) with:

```json
{
  "claim": "POST /api/wishlist with valid auth and a productId adds the product to the user's wishlist and returns 200 with the updated wishlist",
  "type": "api-behavior",
  "scope": { "feature": "wishlist" },
  "proposed_test": {
    "framework": "jest",
    "source": "test('add to wishlist returns updated list', async () => {\n  const res = await request(app)\n    .post('/api/wishlist')\n    .set(authHeaders)\n    .send({ productId: 'p-123' });\n  expect(res.status).toBe(200);\n  expect(res.body.items).toContainEqual(\n    expect.objectContaining({ productId: 'p-123' }));\n});\n"
  },
  "fixtures": [
    { "type": "user", "ref": "fixtures/users/default.json" }
  ],
  "notes": "Assumes the endpoint exists at /api/wishlist and returns the wishlist object with an `items` array. Confirm the response shape with the user if they have a strong preference."
}
```

## How to work through a feature description

1. **Read the user's feature description carefully.** Don't fill in gaps.
2. **List the surfaces** the feature will likely touch: API endpoints, UI pages/components, data shapes, side effects, error handling.
3. **For each surface, draft 1–3 candidate claims** at the intended-behavior level.
4. **Identify ambiguities** in each claim. A claim is ambiguous if:
   - The data shape isn't specified
   - The persistence model isn't clear (per-session? per-device? per-account?)
   - Error paths aren't specified
   - Authorization rules aren't specified
   - Quantitative limits aren't specified ("max items?", "rate limit?")
5. **Ask the user clarifying questions** for ambiguities before proposing. *Do not assume reasonable defaults.* The whole point of planned Truth is to surface these decisions.
6. **Once clarified, propose the planned Truth claims** via `productos_propose_planned_truth`, one at a time.
7. **Summarize what you proposed** and tell the user to open the vet UI to review the plan.

## Worked example

User: "I'm planning a wishlist feature: users can add products to a wishlist, view it on /wishlist, remove items. Wishlist persists across sessions."

You think through it:

**Surfaces:**
- API: POST /api/wishlist, GET /api/wishlist, DELETE /api/wishlist/:productId
- UI: /wishlist page, "Add to wishlist" button on product page, wishlist badge in header
- Data: `Wishlist` table or similar, foreign-keyed to user
- Side effect: none obvious
- Error handling: unauthorized (no session), missing product, duplicate adds

**Ambiguities (ask first, don't assume):**
- "Persists across sessions" — does it persist across *devices* for a logged-in user? (Probably yes if logged in. What about anonymous users?)
- Adding a duplicate — silently ignore? Return success without modifying? Return a specific error?
- Max items per wishlist?
- Removing an item not in the list — 404 or 200?
- Does the UI show "loading" state while toggling?

You **ask the user** before proposing. Once they answer (e.g., "logged-in only; duplicates silently ignored; no max; removing missing returns 200; show loading state"), you propose ~6 planned Truth claims:

1. `api-behavior` — Add: POST /api/wishlist with valid auth + productId returns 200 with updated wishlist
2. `api-behavior` — Add duplicate: POST same productId twice returns 200, wishlist contains it exactly once
3. `api-behavior` — Get: GET /api/wishlist with valid auth returns the user's wishlist items
4. `api-behavior` — Remove: DELETE /api/wishlist/:productId with valid auth removes it, returns 200
5. `api-behavior` — Remove missing: DELETE /api/wishlist/:productId for an item not in the list returns 200, wishlist unchanged
6. `api-behavior` — Auth required: any /api/wishlist call without auth returns 401
7. `ui-flow` — User on product page clicks "Add to wishlist"; button shows loading state; wishlist badge in header increments
8. `ui-flow` — User on /wishlist sees their saved products; clicking "remove" makes the product disappear immediately

All with `status: planned`, no `code_ref`. Each `proposed_test` writes the test as if the endpoints/selectors existed (and the user accepts that assumption — the test will only run after the code lands).

## After proposing

```
I proposed N planned Truth claims for the wishlist feature.

Note these decisions you made along the way — they're encoded in the claims:
  - Logged-in users only (no anonymous wishlists)
  - Duplicate adds silently succeed
  - Removing a missing item returns 200, not 404
  - UI shows loading state on add

Open http://localhost:7878 to review.

When you (or Claude) build the feature, run `productos truth refresh feature wishlist`
to compare the implementation against this plan and surface any drift.
```

## When NOT to use this skill

- The code already exists — use `productos-analyze` instead
- The user is asking general design questions, not committing to ship something — Truth claims are commitments
- The "feature" is really a refactor of existing behavior — analyze the existing first, then plan deltas
