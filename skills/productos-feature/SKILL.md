---
name: productos-feature
description: Use when the user is planning a new feature or change before writing code — to consult existing product truth, decompose the plan into a new productos/products/ feature file with planned behaviors, and surface ambiguity as questions. Triggers on "I'm planning a [feature]", "let's spec a new [feature] in productos", "vet this plan against the product". Stored as status=planned in the markdown tree. Once code lands, the productos-analyze skill takes over to verify the implementation against the plan.
version: 0.1.0
---

# ProductOS — Feature Planning Skill

The user is planning a **new feature** or a change to an existing one, before writing code. Your job is to:

1. **Consult existing product truth** to understand what the system already does (avoid duplication, identify integration points).
2. **Decompose the plan** into a feature markdown file with planned behaviors.
3. **Surface ambiguity** in the plan as questions to the user — *do not assume reasonable defaults*. The whole point of planning in product truth is to make decisions explicit.
4. **Write the markdown** via MCP. Status `planned`, no `implements` paths yet, behavior `status: planned`.

Once the code lands, the `productos-analyze` skill compares the implementation against this planned truth and either confirms it matches or surfaces drift.

## Step 1 — Consult before proposing

Call `productos_list_areas` and `productos_list_features` to see what exists. For any area the new feature touches, call `productos_get_feature` on related features. This is mandatory:

- Avoids duplicating existing behaviors
- Surfaces integration points ("this new feature changes how login works → check `auth/login`")
- Lets you reference related features in the new feature's `related:` field

## Step 2 — Decompose the plan into behaviors

Read the user's feature description and list the surfaces it likely touches: API endpoints, UI pages/components, data shapes, side effects, error handling. Draft 4-12 behaviors covering the load-bearing parts. Over-decomposition is noise; under-decomposition hides decisions.

## Step 3 — Identify ambiguities and ask

A claim is ambiguous if it leaves a real decision unspoken:

- Data shape ("does the response include the updated wishlist or just an ack?")
- Persistence ("per-session, per-device, per-account?")
- Error paths ("what does removing a missing item return?")
- Authorization ("is this admin-only?")
- Limits ("max items? rate limit?")

Ask the user before proposing. Don't assume sensible defaults — surfacing decisions is the entire job.

## Step 4 — Propose the feature

Once decisions are made, write the feature via `productos_propose_feature`:

```json
{
  "id": "wishlist/manage",
  "title": "Wishlist add/remove",
  "status": "planned",
  "owners": ["peter"],
  "implements": [],
  "related": ["auth/login", "products/catalog"],
  "behaviors": [
    {
      "id": "add-to-wishlist",
      "claim": "POST /api/wishlist with valid auth and a productId adds the product to the user's wishlist and returns 200 with the updated wishlist",
      "status": "planned",
      "evidence": []
    },
    {
      "id": "duplicate-adds-idempotent",
      "claim": "POST /api/wishlist with a productId already in the wishlist returns 200 and the wishlist still contains the product exactly once",
      "status": "planned",
      "evidence": []
    }
  ],
  "body": "## Background\n\nUsers asked for a wishlist (15 requests in last quarter's user research...).\n\n## UX\n\nThe wishlist tab lives in the user menu. Adding from a product page uses the heart icon.\n\n## Out of scope\n\n- Cross-device sync: deferred to phase 2.\n- Wishlist sharing: deferred."
}
```

Conventions:

- `status: planned` on both the feature and every behavior
- `implements: []` — empty until code lands
- `evidence: []` — empty until code lands
- `body` should capture **rationale, UX notes, and explicit out-of-scope items** so the planning context survives in the markdown

## Step 5 — Summarize and hand off

```
Planned feature `wishlist/manage` with N behaviors. Decisions captured:
  - Logged-in users only (no anonymous wishlists)
  - Duplicate adds silently succeed
  - Removing a missing item returns 200, not 404
  - No cross-device sync in phase 1

Open http://localhost:7878/wishlist/manage to review the plan.

When you write the code, run `productos-analyze` so it can compare your
implementation against this planned truth and surface drift.
```

## When NOT to use this skill

- The code already exists → use `productos-analyze`
- The user is asking open-ended design questions → discuss; only commit to product truth once decisions are made
- The "feature" is really a refactor of existing behavior → analyze existing first, then plan the deltas

## Don't

- **Don't propose `shipped` or `verified` status.** Planning means `planned`, period.
- **Don't fabricate evidence.** Planned behaviors have empty `evidence: []` until the code exists. `productos-analyze` populates evidence after the fact.
- **Don't paper over ambiguity.** If a decision isn't made yet, ask. If the user defers, capture the deferral as a note in the body — but don't pick a side silently.
- **Don't put dynamic state in the markdown.** Planned truth describes intent. Production state (counts, latencies, error rates) lives in observability, not here.
