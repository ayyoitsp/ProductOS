---
name: productos-fullscan
description: Use for a FULL SCAN across the whole codebase (or a large area) — proposing many features and behaviors at once from existing code. Also used to process the open feedback queue. Triggers on "do a ProductOS fullscan", "scan the codebase and propose product truth", "process feedback", "full ProductOS pass". For a SINGLE in-flight feature, use `productos-scope` instead — that's the v0.1 PM wedge. After this skill writes proposals, recommend the user run `productos-review` (or open localhost:7878) to walk them interactively.
version: 0.1.0
---

# ProductOS — Fullscan Skill (BROAD codebase pass)

ProductOS holds the **product truth** for this codebase as a tree of markdown files under `productos/products/`. **Implementation tracking is separate** — it lives in YAML sidecars under `productos/tracking/`. **Feedback** (free-form notes from humans or external sources) lives as queue entries under `productos/feedback/`.

Your job is to consult, propose, update, and process these three things via MCP. You do not write tests; you do not run tests as the validation core.

## When to use this skill vs other ProductOS skills

| You want to... | Use this skill |
|---|---|
| Do a full scan across the whole codebase, propose many features at once | **`productos-fullscan`** (you are here) |
| Scope on ONE in-flight feature, propose 3-5 behaviors for it | `productos-scope` (the v0.1 PM wedge) |
| Walk proposed behaviors one at a time and accept/reject inline | `productos-review` |
| Map existing tests in the user's repo to declared test cases | `productos-align` |

If the user said "analyze/scope the X feature" (singular), they probably want `productos-scope`, not this skill. Confirm before running a broad pass.

## The split

```
productos/products/<area>/<feature>.md       ← PRODUCT TRUTH
  - claims: what the user does, what the user sees, in product language
  - no API/endpoint/file references in the claim text
  - status (planned | shipped | deprecated), title, description
  - body: OPTIONAL short product-language context (a sentence or two). DEFAULT TO NOTHING. Never put implementation rationale ("why derived not stored"), out-of-scope catalogs, design discussion, or related-feature lists in the body. Surfaces + behaviors + description ARE the spec.

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

For each feature, **identify the Surfaces first** — screens, pages, modals the user actually sees. Read route definitions, page components, modal triggers. Each Surface has:

- `id`: kebab-case (`cart-page`, `checkout-form`, `profile-modal`)
- `title`: human label ("Cart", "Checkout")
- `path`: route or selector when applicable (`/cart`, `modal:edit-profile`)
- `sketch`: an **ASCII rough layout** of INTERFACE STRUCTURE only — not design. ~6-15 lines. *Don't describe colors, fonts, typography, brand styling, spacing, or visual polish — those are design decisions that change.*

  **Element conventions in the sketch:**

  | Pattern | What it represents |
  |---|---|
  | `[ Label ]` | Button |
  | `<Label>` | Link |
  | `[__________]` | Input |
  | `[Label ▼]` | Dropdown |
  | `[✓]` / `[ ]` | Checkbox |
  | `(•)` / `( )` | Radio |
  | `→ Name` | Card / list item / row (preferred — reads as a right-arrow click target) |
  | `▢` / `▦` | Legacy card markers (use `→` in new sketches) |
  | `┌─┐ │ └─┘` | Box outlines |

  Use the element's `label` verbatim inside `[ ... ]` or `<...>` so the renderer can wrap it as a clickable link when `leads_to` is set.

- `elements`: array of `{ id, kind, label?, notes?, leads_to? }` — buttons, inputs, links, lists, modals, etc. **Don't put styling/color/visual-design notes in `notes`** — only role, trigger, what's shown, what makes the element unique.
- `elements[].leads_to`: **OPTIONAL — only on navigation elements**. Three valid forms:
  - `checkout-page` — same-feature Surface anchor (Surface.id from THIS feature)
  - `wallet/transactions` — cross-feature page (area/feature id)
  - `wallet/balance#kid-view` — cross-feature + surface anchor

  **NEVER write** leading `/` (e.g. `/add-kid`), `https://...`, or filenames. **Don't set on in-place actions** (Submit, +/− steppers, trash/delete, toggles). If unsure, leave blank — the element will render visually but won't be clickable.

Surfaces are **optional** — features that are pure invariants (a tax calculation, a balance constraint) leave the `surfaces` array empty.

**Deterministic scope rule** (apply when deciding which feature owns a behavior):

A behavior belongs to the feature whose **user-facing trigger** fires — not the feature whose state is mutated. If feature B's trigger causes feature A's state to change, the behavior lives in B, and A lists B under `affected_by`:

```yaml
id: wallet/kid-balance
affected_by:
  - wallet/earn
  - wallet/spend
  - tasks/complete-task     # task completion is a tasks/ trigger that mutates balance
  - wallet/interest
```

`affected_by` renders as an "Affected by:" pill row in the site so the PM sees at a glance which other features feed into this one. The triggering features keep the behaviors; no duplication.

**User override.** If the user states a preference about where behaviors should live ("group all balance mutations inside wallet/kid-balance"), respect it. The rule is the *default* when no preference is stated; it isn't an enforcement gate.

Then, for each behavior-bearing code path:

1. Read the code. Don't propose claims you can't cite.
2. Decide: existing feature (update) or new (propose)?
3. **Write the claim in product language**. Not `POST /api/auth/signup returns 409`. Yes `When a user submits the signup form with an already-registered email, they see "this email is already registered"`. The endpoint is an implementation detail.
4. **Write product truth via MCP:**
   - New feature → `productos_propose_feature` with `id`, `title`, `description`, `surfaces`, and `behaviors`. Each behavior has `id`, `claim`, optional `notes`, optional anchor (`surface` / `element` / `interaction`), **and `test_cases`** — a numbered list of concrete scenarios that demonstrate the claim.
   - Existing feature, new behavior → `productos_add_behavior(feature_id, behavior)`.
   - Reword a claim → `productos_update_behavior(feature_id, behavior_id, claim?)`.

   **Every behavior MUST have at least 1 test case.** A behavior without test cases is just a wish — the PM can't tell what evidence would falsify it; the align skill has nothing to map existing tests against; the receive interface has nothing to flip Verification on. Aim for 1-3 test cases per behavior, structured as:

   ```yaml
   test_cases:
     - id: 1
       description: "Standard happy path — short product-language summary"
       level: api  # one of: unit | integration | api | e2e
       given: "an existing user with email alice@example.com"
       when: "POST /api/auth/signup with email alice@example.com"
       then: "response is 409 with body.error.code = 'duplicate_email'"
     - id: 2
       description: "Edge case — short summary"
       level: unit
       steps: |
         1. (use steps as a freeform alternative when given/when/then is awkward)
         2. ...
   ```

   Pick `level` based on the existing test culture — if there's a Jest unit test suite, lean unit/integration; if there's Playwright, e2e is fair game. Default to whatever the codebase already uses.
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

### Mode D: Surface gaps (do this BEFORE handing off to vet)

Reading code only shows you what *exists*. The product person's question is often the opposite: **what's missing?** A welcome email is implemented but is there a path for *resending* it? Signup catches duplicate emails — what about whitespace-padded duplicates? `alice@example.com` and `alice@example.com  `? Etc.

After proposing the behaviors that come from the code you read, **end with a "Potential gaps" list** — 3-7 questions a product person might ask about behavior that should probably exist but you couldn't find. Frame each gap as a *question*, not a claim:

- "Can a user reset their password if they forgot it?"
- "Does the welcome email include the user's first name, or is it generic?"
- "What happens if the user signs up while logged in from a different account?"
- "Is there rate-limiting on signup to prevent enumeration attacks?"
- "Is the duplicate-email message accessible to screen readers?"

Don't propose Contracts for these. Don't write tracking. Just *list them as open questions* in your final summary so the human decides which deserve a behavior, which are non-goals, and which are misunderstandings on your part.

The list comes from reading the code in light of:

| Lens | Example gap questions |
|---|---|
| **Error paths** | What does the code do on network failure? Timeout? Partial state? |
| **Edge inputs** | Empty / whitespace / Unicode / very long inputs? |
| **Concurrency** | What if two users do this simultaneously? Same user from two devices? |
| **Authorization** | Who can do this? Logged-out? Other org? Other roles? |
| **Lifecycle** | What about *un*-doing this? *Re*-doing it? |
| **Observability** | Is there a way for support to verify this happened? |
| **Accessibility** | Keyboard, screen reader, color-only signals? |
| **Strategy fit** | Does this respect every Design Principle in productos/context/? |

Use whichever lens makes sense for the feature in front of you. Don't enumerate all of them every time.

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

You MUST end by explicitly handing the user off to a vetting surface AND listing the gap questions you surfaced. Don't leave proposed behaviors sitting Unverified without telling them what to do next. Two co-equal options — recommend both:

```
I proposed N features across M areas and recorded tracking for K behaviors.
I also processed J open feedback entries (P→processed, Q→ambiguous, awaiting your input).

Potential gaps (questions to consider, no Contracts written for these):
  1. <gap question 1>
  2. <gap question 2>
  3. <gap question 3>
  ...

The behaviors are Unverified — you need to vet them. Two co-equal options:

  In Claude Code (inline, single-keystroke responses, no context switch):
    "Use productos-review to walk these"
    (or scope it: "Use productos-review on auth/signup")

  In the product-truth site:
    Open http://localhost:7878 — accept/edit/reject per behavior with buttons

Both surfaces use the same MCP tools and produce the same DB state.
Pick whichever fits the moment.

Files to review:
  - Product truth diffs:        productos/products/<area>/<feature>.md
  - Tracking sidecar updates:   productos/tracking/<area>/<feature>.yaml
  - Processed feedback:         productos/feedback/<id>.md (state: processed)
```

The previous version of this skill ended with "verify via the ✓ Verify button or `productos product verify`" — that's incomplete. With v0.1, `productos-review` is the canonical inline vetting flow and the site is the canonical visual flow. Both must be surfaced.
