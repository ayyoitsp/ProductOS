---
name: productos-align
description: Use when the user wants to map existing tests in their repo to declared ProductOS test cases — the primary entry point for any non-greenfield codebase. Walks the relevant test files, scores existing tests against declared test_cases, and proposes mappings: either (a) rename the existing test to carry the stable_id, or (b) set `coverage_ref` on the test case to point at the existing test. The user accepts/edits per proposal. Triggers on "productos test align <feature>", "align my existing tests to <feature>", "map my Jest tests to the productos behaviors". Don't generate new tests here — that's `productos test scaffold` or live coding by the builder.
version: 0.1.0
---

# ProductOS — Align Skill (map existing tests to declared cases)

The user has declared behaviors + test_cases for a feature; they almost certainly already have existing tests in their repo that cover some of those cases. Your job: **map**, not generate.

For each declared test case, propose one of two outcomes:

- **`coverage_ref`** — point the case at the existing test (e.g. `tests/checkout/guest.test.ts:42`). Cheapest; no code edit needed; the case is marked covered for derived state.
- **rename** — suggest renaming the existing test to add the stable_id in its name (e.g. `it("checkout/index#guest-flow/1: standard guest checkout", ...)`). Better for CI result mapping via the receive interface; requires a code edit (you offer to do it; user accepts).

Use rename when the existing test is the canonical home for this case AND you want CI results to flow back automatically via the receive interface. Use `coverage_ref` when the existing test does cover the case but its name shouldn't change (third-party fixture, legacy convention, etc).

## Process

### 1. Load the scope

User says: `productos test align checkout/index`

Call `productos_get_feature("checkout/index")`. Read the feature's behaviors + test_cases. Note which already have `coverage_ref` set — those are already mapped.

Identify the test directories from the user's config:

- `productos_get_env` to read repo config / test conventions
- Common patterns: `tests/`, `__tests__/`, `*.test.ts`, `*.spec.ts`, `test_*.py`

Walk those directories. For Node: read the `describe`/`it` block structure. For pytest: read class/method names + docstrings. Build a candidate list of existing tests near the feature's code paths.

### 2. Match cases to tests

For each declared test_case that doesn't already have a `coverage_ref`:

1. Use the test_case's `description`, `given/when/then`, and the parent behavior's `claim` as the matching signal.
2. Score candidate existing tests by likelihood of coverage. A test in `tests/checkout/guest.test.ts` named "rejects logged-in user on guest path" is a strong candidate for `checkout/index#guest-flow/1`.
3. Pick the top 1 (sometimes 2) candidates. If no candidate scores above "plausible," skip the case — it's likely net-new and the builder will write a test for it.

### 3. Propose per case

For each (declared case → existing test) pair, present:

```
Test case 1 of 4: checkout/index#guest-flow/1
─────────────────────────────────────────────
Declared:    Guest reaches confirmation page without an account prompt
             [level: e2e]

Candidate match:
  tests/checkout/guest.test.ts:14
    describe("guest checkout") → it("redirects to confirmation, no auth prompt")

Confidence: high (90%)

Proposed action:
  [R] rename existing test to add stable id:
        it("checkout/index#guest-flow/1: redirects to confirmation, no auth prompt", …)
  [C] set coverage_ref instead (no code edit):
        test_case.coverage_ref = "tests/checkout/guest.test.ts:14"
  [N] no match — skip
  [V] view the existing test before deciding
─────────────────────────────────────────────
```

Wait for the user's choice.

If `R`: edit the test file inline (use the Edit tool to add the stable_id prefix to the test name). Confirm. Then also set `coverage_ref` to the same file path for redundancy. Move to next case.

If `C`: call `productos_set_coverage_ref({ feature_id, behavior_id, test_case_id, coverage_ref })`. Move to next case.

If `N`: leave the case unmapped. Note: it'll appear as "no test_result yet, no coverage_ref" → Orphan in derived state until covered or test result received.

If `V`: print the existing test code, then re-ask.

### 4. Summarize

```
Aligned <feature_id>:

  Mapped via rename:        N cases (stable_id added to existing tests, CI results
                            will now flow back via the receive interface)
  Mapped via coverage_ref:  M cases (existing tests stay as-is; declared case is
                            marked covered)
  Skipped (no match):       K cases (will be Orphan until covered)

Markdown changes ready to commit:
  productos/products/<area>/<feature>.md  (coverage_ref additions)

Code changes ready to commit (if rename was chosen):
  tests/checkout/guest.test.ts  (test name updates)

Next steps:
  • Run the test suite — passing tests with stable_ids will post via
    `productos test record` and flip those cases' state to Verified
  • For skipped cases: write tests (or `productos test scaffold` if you
    want a stub), or let the builder cover them in their PR
```

## Rules

- **Don't generate new tests.** This skill is mapping only. For net-new cases, the user (or the builder) writes them — or runs `productos test scaffold`.
- **Don't auto-rename without confirmation.** Even high-confidence matches need a yes from the human. Test names are user-facing in failure output; the user has aesthetic and conventional opinions.
- **Don't pollute test names.** If the existing name is already long, the stable_id prefix can be a comment or a JSDoc-style annotation instead. Surface both options if the name is awkward.
- **Don't claim coverage you can't see.** If the existing test only checks part of the declared case, set `coverage_ref` but flag it: "partial coverage — covers WHEN/THEN but not the GIVEN setup". The PM should know.
- **Prefer rename over coverage_ref** when the language fits cleanly. Rename gives the receive interface a way to flow results back automatically; coverage_ref alone is documentary.

## Worked example

User: `productos test align checkout/index`

You read `productos/products/checkout/index.md`. Two behaviors, three active test cases, none with `coverage_ref` yet.

You walk `tests/checkout/` and `tests/api/checkout/`. Three describe blocks, six it blocks.

Case 1: `checkout/index#guest-flow/1` (e2e, "Guest reaches confirmation page").
You match it against `tests/checkout/guest.test.ts:14` → "redirects to confirmation, no auth prompt" — strong.

Propose rename. User picks `R`. You edit:

```ts
// before:
it("redirects to confirmation, no auth prompt", async () => { ... });
// after:
it("checkout/index#guest-flow/1: redirects to confirmation, no auth prompt", async () => { ... });
```

Also set `coverage_ref` to `"tests/checkout/guest.test.ts:14"`.

Case 2: `checkout/index#guest-flow/2` (api, "Order record carries guest email").
You match it against `tests/api/checkout/place-order.test.ts:48` — moderate; the test asserts user_id is null but doesn't check guest_email.

Propose: set `coverage_ref` with a "partial coverage" note. User picks `C` and edits the case description to clarify.

Case 3: `checkout/index#tax-rounding/1` (unit, "0.5 rounds to even").
No matching test exists.

Propose skip. The user accepts. This case will show Orphan in the dashboard until the builder writes a test (or runs `productos test scaffold`).

You report:
- 1 rename (case 1)
- 1 coverage_ref (case 2, partial)
- 1 skipped (case 3 → Orphan)

User commits.

## Don't

- **Don't run the tests.** ProductOS doesn't run tests. The receive interface gets results when the user's CI runs them.
- **Don't modify the test bodies.** Renaming the `it` name is OK (with user confirmation); changing assertions is not your job.
- **Don't suggest deleting existing tests.** Even if they're redundant. The user owns their test suite.
- **Don't get into harness setup.** If a case needs a Playwright harness the project doesn't have, surface that as a gap — don't try to scaffold a Playwright config.
