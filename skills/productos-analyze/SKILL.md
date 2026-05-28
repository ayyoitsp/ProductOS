---
name: productos-analyze
description: Use when the user asks to analyze a codebase for ProductOS — to consult existing product truth, propose new features + behaviors, attach evidence (code refs, screenshots, traces, narratives), and update productos/products/ markdown directly. Triggers on requests like "do a ProductOS pass", "scan this codebase and propose product truth", "verify feature X", "update productos for the wishlist work I just did". Your output is markdown files under productos/products/, not tests.
version: 0.1.0
---

# ProductOS — Analyze Skill

ProductOS holds the **product truth** for this codebase: a tree of markdown files under `productos/products/` describing what the product does, with structured behaviors and supporting evidence. The site at `productos serve` (http://localhost:7878) renders this as a navigable website.

Your job is to **consult, propose, and update product truth in this markdown tree** — not to write tests. Tests are one possible kind of evidence, but the core artifact is the markdown.

## The core mental model

```
productos/products/
  <area>/                   ← e.g. auth/, wishlist/, checkout/
    README.md               ← area overview
    <feature>.md            ← e.g. signup.md, password-reset.md
      • YAML frontmatter declares behaviors (atomic claims) + metadata
      • Markdown body holds prose: UX notes, design rationale, caveats
```

A **feature** is a markdown file. A **behavior** is one structured entry inside that file's `behaviors:` frontmatter — an atomic claim about what the feature does, with evidence and a status (planned / proposed / verified / stale / contested / deprecated).

## Three things you do

### 1. Consult (before proposing or planning anything)

Call `productos_list_areas` and `productos_list_features` to understand what exists. Call `productos_get_feature(id)` for any area you're about to touch. This is **mandatory** for the planning case — the whole point of product truth is that you read it first.

### 2. Propose (when code exists but isn't yet documented in product truth)

For each surface in the codebase you're analyzing:

a. Read the code thoroughly (don't synthesize claims you can't cite).
b. Decide: is this an *existing feature* that needs an update, or a *new feature*?
c. Read the existing `<area>/<feature>.md` if one exists — don't duplicate.
d. Propose or update via MCP:
   - **New feature**: `productos_propose_feature` with `id`, `title`, `status`, `implements`, and initial behaviors.
   - **Existing feature, new behavior**: `productos_add_behavior(feature_id, behavior)`.
   - **Existing behavior, new evidence**: `productos_attach_evidence(feature_id, behavior_id, evidence)`.
e. Set behavior `status: proposed` — never `verified`. Only humans verify.

### 3. Verify (when the user asks you to check the live env against documented claims)

For each behavior the user wants verified:
1. Read the claim and current evidence.
2. Ensure the env is up: `productos env <name> check`; if not, `productos env <name> up`.
3. Gather fresh evidence — see "Evidence" below for what to capture per claim type.
4. Attach the evidence via `productos_attach_evidence`.
5. Do NOT call `productos_update_behavior(status: verified)`. The human reviews the evidence on the rendered site and verifies via `productos product verify <feature_id> <behavior_id>`.

## Feature shape

When you call `productos_propose_feature` or `productos_add_behavior`, the resulting markdown looks like:

```yaml
---
id: auth/signup
title: User signup
status: shipped
owners: [peter]
implements:
  - src/api/auth/signup.ts
  - src/pages/signup.tsx
related: [auth/login]
behaviors:
  - id: duplicate-email
    claim: "POST /api/auth/signup with an existing email returns 409 with body.error.code = 'duplicate_email'"
    status: proposed                 # ← set by you; humans flip to verified
    evidence:
      - kind: code
        ref: "src/api/auth/signup.ts:23-67"
      - kind: response
        path: "productos/evidence/auth-signup-dup-email.json"
        description: "Captured from local env on 2026-05-28"
    notes: "Intentional separation from 400 so the client can show a friendly error."
  - id: welcome-email
    claim: "Successful signup enqueues a welcome email"
    status: proposed
    evidence:
      - kind: code
        ref: "src/api/auth/signup.ts:80"
      - kind: code
        ref: "email/welcome.ts:1-30"
---

# User signup

Signup uses email + password. Email must be unique.

## UX

The signup page lives at `/signup`. Fields: email, password, confirm password.

## Known caveats

- Email verification is NOT enforced before account becomes usable.
```

Headers and prose in the body are rendered as-is on the feature's page.

## Evidence — what to attach per claim type

The kinds available: `code` | `response` | `screenshot` | `trace` | `narrative` | `test-result` | `query`.

Pick the kinds that genuinely *justify the claim*. The human reviewing the rendered site has to be able to decide ✓ verified or ✗ contested from what you attached — so attach enough.

| Claim shape | Minimum evidence | Stronger evidence |
| --- | --- | --- |
| **API response invariant** (status code, body shape) | `code` ref to handler | `response` capture (real request + response) saved as JSON in `productos/evidence/` |
| **UI element exists / labels / structure** | `code` ref to component | `screenshot` of the page in the relevant state |
| **Multi-step flow** | `code` refs + `narrative` walking through the steps | `trace` (Playwright trace, recording, etc.) |
| **Data invariant** (DB rows always have X) | `code` ref to migration/model | `query` evidence with the actual SQL and result |
| **Side effect** (email sent, queue job enqueued) | `code` ref to the call site + the side-effect handler | `narrative` capture of the live event firing |
| **Performance / latency** | `code` ref + a `narrative` describing measurement method | `trace` with timings |

Two evidence types worth special call-outs:

- **`narrative`** is free-form prose Claude (or a human) wrote. Use the `body` field on the evidence object for the prose. Good for "I navigated to /wishlist, added 3 items, refreshed, all 3 were still there." When code refs don't tell the whole story, narrative + code = a complete picture.
- **`screenshot`** lives at `productos/evidence/<filename>.png`. You take it (via dev-browser or whatever your runtime exposes), save it to that path, then attach the path. The vet UI renders it inline. *If you don't have screenshot capability, fall back to narrative + code.*

## Driving the env (when you need to gather live evidence)

Same pattern as before:

```bash
productos env <name> check       # is the env reachable?
productos env <name> up          # bring it up if not
# ... gather evidence (curl, dev-browser, etc.) ...
productos env <name> reset       # optional, if not read_only
```

Get the env config via `productos_get_env({ name })`. Respect `external` (don't try to start services on staging) and `read_only` (no destructive ops).

For API behaviors, the canonical "gather evidence" pattern is:

```bash
# capture a real request/response
curl -s -X POST ${BASE_URL}/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"taken@example.com","password":"pw"}' \
  -o productos/evidence/auth-signup-dup-email.json -w '%{http_code}\n'
```

Then attach:

```
productos_attach_evidence({
  feature_id: "auth/signup",
  behavior_id: "duplicate-email",
  evidence: {
    kind: "response",
    path: "productos/evidence/auth-signup-dup-email.json",
    description: "Status 409, body.error.code = duplicate_email, captured 2026-05-28 against local"
  }
})
```

## Falsifiability gate (mandatory before any propose call)

Before each `productos_propose_feature` / `productos_add_behavior` / `productos_attach_evidence` call:

- [ ] Can I name the specific code file(s)+lines that demonstrate this behavior?
- [ ] Did I actually READ that code, not just see its imports?
- [ ] Is the claim a single observable thing, or am I bundling multiple behaviors?
- [ ] Would a reviewer reading the rendered site agree with the claim + evidence?

If any answer is no → don't propose. Tighten the claim or read more code first.

## How to work through a codebase

1. **Consult first.** `productos_list_areas` + `productos_list_features` so you know what's already documented.
2. **Detect the architecture.** Read `package.json`, frameworks, etc.
3. **Enumerate surfaces.** Pages, API routes, components, schemas. Group by area (auth, billing, profile, etc.).
4. **For each surface, decide: existing feature or new?** Call `productos_get_feature(id)` if existing.
5. **Propose or update.** One behavior at a time. Cite code. Attach the cheapest sufficient evidence (code ref + narrative is often enough on first pass).
6. **Gather live evidence** where it adds real signal (API response captures, screenshots of UI states) — not for every claim, only the ones that benefit.
7. **Summarize:** "Proposed N features across M areas. Added K behaviors to existing features. Vet at http://localhost:7878."

## Common pitfalls — don't

- **Don't write tests.** This skill is for product truth markdown, not test files.
- **Don't propose `verified` status.** Humans verify via the rendered site or `productos product verify`.
- **Don't claim behavior you didn't read.** Imports aren't evidence; read the function.
- **Don't bundle multiple claims into one behavior.** "Signup works" is too coarse — split into duplicate-email, welcome-email, password-stored-hashed, etc.
- **Don't propose features whose `id` doesn't match where the file lives.** `id: auth/signup` must live at `productos/products/auth/signup.md`.
- **Don't gather evidence you can't justify.** A screenshot of an unrelated page isn't evidence; a narrative that just restates the claim isn't evidence. Each piece should make a reviewer more confident the claim holds.

## When the env can't be brought up

Same advice as before: surface the error clearly, don't try to validate without a working env. But for many propose-only flows you don't need the env at all — code refs alone are sufficient evidence for first-pass propose. Only bring up the env when you need to capture live evidence (API responses, screenshots, traces).

## After working

```
I proposed N features and K behaviors across M areas:
  - auth/  (3 features, 11 behaviors)
  - wishlist/  (1 feature, 4 behaviors)
  ...

Most behaviors are `proposed` with code refs as evidence. For five of them
I also captured live API response evidence (saved to productos/evidence/).

Open http://localhost:7878 to review. Use `productos product verify <feature> <behavior>`
to mark behaviors verified once you've reviewed the evidence.
```
