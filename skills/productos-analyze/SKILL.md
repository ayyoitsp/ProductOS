---
name: productos-analyze
description: Use when peter asks to analyze a codebase for ProductOS — to consult existing product truth, propose features and behaviors in product-language markdown, record implementation in the tracking sidecar, and process open feedback queue entries. Triggers on "do a ProductOS pass", "scan the codebase and propose product truth", "process feedback", "update tracking for the wishlist work". Your outputs are markdown files in productos/products/ + YAML sidecars in productos/tracking/, and you mark feedback entries processed when you handle them.
version: 0.1.0
---

# ProductOS — Analyze Skill

ProductOS holds the **product truth** for this codebase as a tree of markdown files under `productos/products/`. **Implementation tracking is separate** — it lives in YAML sidecars under `productos/tracking/`. **Feedback** (free-form notes from humans or external sources) lives as queue entries under `productos/feedback/`.

Your job is to consult, propose, update, and process these three things via MCP. You do not write tests; you do not run tests as the validation core.

## The split

```
productos/products/<area>/<feature>.md       ← PRODUCT TRUTH
  - claims: what the user does, what the user sees, in product language
  - no API/endpoint/file references in the claim text
  - status (planned | shipped | deprecated), title, description
  - body: prose, UX notes, design rationale, screenshots

productos/tracking/<area>/<feature>.yaml     ← IMPLEMENTATION + VERIFICATION
  - implements: [code paths]
  - per-behavior: code_refs, status (planned|proposed|verified|stale|contested|deprecated),
                  last_verified, verified_by, full transition history

productos/feedback/<id>.md                   ← FEEDBACK QUEUE
  - one file per submission (from the browser, CLI, or external sources)
  - frontmatter: state (open|claimed|processed), target (feature/behavior)
  - body: free-form prose
```

**The two files link by feature_id and behavior id, but they're edited independently.** A PR that changes product truth is documentation work; a PR that updates tracking (new verification stamp, new code_refs) is operational.

## What you do — three modes

### Mode A: Consult (always first)

Before proposing anything, call:
- `productos_list_areas` + `productos_list_features` — see what exists
- `productos_get_feature(id)` for any area you're about to touch — returns truth + tracking joined

Skipping this leads to duplication and inconsistency.

### Mode B: Propose / update product truth + tracking

For each surface in the codebase:

1. Read the code. Don't propose claims you can't cite.
2. Decide: existing feature (update) or new (propose)?
3. **Write the claim in product language**. Not `POST /api/auth/signup returns 409`. Yes `When a user submits the signup form with an already-registered email, they see "this email is already registered"`. The endpoint is an implementation detail.
4. **Write product truth via MCP:**
   - New feature → `productos_propose_feature` with `id`, `title`, `description`, `behaviors`. Each behavior has `id`, `claim`, optional `notes`. **That's all** that goes in product truth.
   - Existing feature, new behavior → `productos_add_behavior(feature_id, behavior)`.
   - Reword a claim → `productos_update_behavior(feature_id, behavior_id, claim?)`.
5. **Write tracking via MCP (separate call):**
   - `productos_update_tracking(feature_id, implements?, behavior_id?, code_refs?, status?)`
   - For a brand-new behavior: status='proposed' so the human knows to verify it.
   - For tracking the file paths that implement a feature: set `implements`.
   - For tying code lines to a behavior: set `behavior_id` + `code_refs`.
   - Never set status='verified' — only humans verify (via the website's ✓ Verify button or `productos product verify`).

### Mode C: Process the feedback queue

When peter asks "process feedback" (or you notice open entries):

1. `productos_list_feedback({ state: "open" })` — get the queue
2. For each entry:
   a. `productos_claim_feedback(id)` — mark it `claimed`
   b. Read the body; figure out what edit it's asking for
   c. Make the edit using the appropriate MCP tool:
      - "the claim wording is wrong" → `productos_update_behavior`
      - "this isn't true" → `productos_update_tracking(status: "contested")`
      - "we need a behavior for X" → `productos_add_behavior`
      - "this code path also matters" → `productos_update_tracking(code_refs)`
   d. `productos_mark_feedback_processed(id, resolution_note)` — close it out
3. Summarize what you did. The user reviews the diff (changes to product truth + tracking + the processed feedback entries) and commits.

## Falsifiability gate

Before each `propose_feature` / `add_behavior`:

- [ ] Can I name specific code file(s)+lines I read that demonstrate this claim?
- [ ] Is the claim written in product language, not implementation language?
- [ ] Is the claim a single observable thing, not bundled?
- [ ] Would a non-engineer reading the rendered site understand it?

The code refs go in tracking, not in the claim text. If you can't think of a product-language version of a claim, the claim is at the wrong level — it's an implementation detail, not a behavior.

## Worked example

You read `src/api/auth/signup.ts`. There's:
- A handler that rejects duplicate emails with 409
- A welcome email enqueued on success

You write **product truth** (`productos/products/auth/signup.md`):

```yaml
id: auth/signup
title: User signup
status: shipped
description: Users create accounts with email + password.
behaviors:
  - id: duplicate-email-rejected
    claim: "When a user submits the signup form with an email that already has an account, they see an inline 'this email is already registered' message and no new account is created."
    notes: "Intentional UX choice — a specific message helps users vs. a generic 'invalid input'."
  - id: welcome-email-on-signup
    claim: "After a user successfully creates an account, they receive a welcome email at the address they registered with."
```

You write **tracking** (separately, `productos/tracking/auth/signup.yaml`):

```yaml
feature_id: auth/signup
implements:
  - src/api/auth/signup.ts
  - src/pages/signup.tsx
behaviors:
  duplicate-email-rejected:
    code_refs: ["src/api/auth/signup.ts:23-67"]
    status: proposed                 # awaiting human verification
  welcome-email-on-signup:
    code_refs: ["src/api/auth/signup.ts:80", "src/email/welcome.ts:1-30"]
    status: proposed
```

You don't run tests. You don't verify the behaviors. You give the human enough to look at the rendered site, click into the cited code, and decide.

## Don't

- **Don't put endpoints / file refs / status / verification in product truth.** Those go in tracking.
- **Don't set status='verified'.** Humans do that.
- **Don't write claims in implementation language.** "POST /api/X returns 409" is wrong; "user sees 'already registered'" is right.
- **Don't propose claims you can't cite.** Imports aren't evidence; read the function.
- **Don't process feedback you don't understand.** If a feedback entry is ambiguous, leave a resolution_note explaining and ask the user for clarification rather than guessing.

## After working

```
I proposed N features across M areas and recorded tracking for K behaviors.
I also processed J open feedback entries (P→processed, Q→ambiguous, awaiting your input).

Open http://localhost:7878 to review:
  - Product truth diffs are in productos/products/
  - Tracking updates are in productos/tracking/
  - Processed feedback is in productos/feedback/ (state: processed)

Verify behaviors you agree with via the ✓ Verify button or `productos product verify`.
```
