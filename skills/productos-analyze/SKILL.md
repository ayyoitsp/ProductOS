---
name: productos-analyze
description: Use when the user asks to analyze a codebase for ProductOS — to propose Product Truth claims (executable behavior contracts), drive the live dev environment to validate each one, and record the outcomes. Triggers on requests like "do a ProductOS pass", "scan this codebase and propose ProductOS truth", "validate T-0042", "vet this feature for ProductOS". You (the AI runtime) drive the user's live code via shell — ProductOS is the structural backend that holds Truth + env config + outcomes.
version: 0.0.3
---

# ProductOS — Analyze Skill

You are doing **product correctness analysis** for ProductOS. Your job is to:

1. **Read the codebase** and propose Truth claims (executable behavior contracts) about what the product does.
2. **Drive the user's live dev environment** to validate each claim — bring up services per `productos/env.yaml`, run the proposed test, observe the result.
3. **Record outcomes** back to ProductOS via MCP so the human can review and approve in the vet UI.

You are the brain. ProductOS is the structural backend (storage, MCP tools, env config, test runner harness, vet UI). It does **not** call an LLM. It does **not** parse your test source. You drive the actual code; ProductOS records the structured result.

## Core principles

1. **Every claim is paired with an executable test.** Not prose — code that runs.
2. **Every claim must cite code refs.** Falsifiability gate: no code evidence → don't propose.
3. **You validate live, you don't speculate.** Bring up the env, run the test against the running app, observe what actually happens. Don't claim "the test will pass" — *run it*.
4. **You propose and validate; humans approve.** Set status `proposed`. Record outcomes via `productos_record_outcome`. The vet UI is where humans hit ✓ Validate or ✗ Reject.

## The end-to-end flow

```
   1. Call productos_get_env             → know how to drive the dev stack
   2. Shell: `productos env <name> check` → is the env already up?
      If not: `productos env <name> up`   → start services + healthcheck
   3. For each candidate claim:
        a. Read the relevant code thoroughly
        b. Decide: what claim, what test, what fixtures?
        c. Call productos_propose_truth   → returns the assigned T-XXXX id
        d. Write the proposed test into env.staging_dir/T-XXXX.test.ts
        e. Shell: `productos env <name> reset` → (optional) fresh state
        f. Shell: run the test in the user's stack (npx jest path, pytest path, etc.)
        g. Observe stdout/stderr — pass or fail?
        h. Call productos_record_outcome(id, pass|fail, captured_output, test_file)
   4. Summarize: "Proposed N claims, M passed live, K failed. Vet at http://localhost:7878."
```

## The Truth claim shape

You call the MCP tool `productos_propose_truth` with this shape:

```json
{
  "claim": "POST /api/auth/signup with a duplicate email returns 409 with body.error.code = 'duplicate_email'",
  "type": "api-behavior",
  "code_ref": ["src/api/auth/signup.ts:23-67", "src/api/auth/validators.ts:12-30"],
  "proposed_test": {
    "framework": "jest",
    "source": "import request from 'supertest';\nimport { app } from '../../src/index';\n\ntest('rejects duplicate email with 409', async () => {\n  const existing = { email: 'taken@example.com', password: 'p4ssword!' };\n  await request(app).post('/api/auth/signup').send(existing);\n  const res = await request(app).post('/api/auth/signup').send(existing);\n  expect(res.status).toBe(409);\n  expect(res.body.error.code).toBe('duplicate_email');\n});\n"
  },
  "fixtures": [],
  "scope": { "feature": "auth" }
}
```

## Claim types

| Type | When | How to validate live |
| --- | --- | --- |
| `api-behavior` | HTTP req → response invariants | Run jest/pytest against the live API |
| `ui-flow` | Multi-step browser interaction | Run Playwright against the running frontend |
| `data-invariant` | What must be true of stored data | Run a unit/integration test that asserts on the DB |
| `side-effect` | Non-response effect (email, queue, audit log) | Run a test that triggers + asserts on the side effect |
| `error-handling` | Response to bad input or upstream failure | Same as `api-behavior` / `ui-flow` with bad inputs |

## Selector preferences (for `ui-flow` claims)

1. `data-testid` — `page.locator('[data-testid=submit-btn]')`
2. ARIA role + accessible name — `page.getByRole('button', { name: 'Sign up' })`
3. Stable visible text — `page.getByText('Sign up')`
4. Semantic structure — `page.locator('main form input[type=email]')`
5. **Never** CSS classes that look implementation-specific

If you have to fall back to anything below `data-testid`, mark the test scope notes so the human knows to add a testid before depending on it.

## Driving the env — concrete recipes

### Step 1 — Always start with `productos_get_env`

This returns:
- The env config you'll be driving (default env unless the user asked for a specific one — `productos_get_env({ name: "staging" })`)
- `all_envs`: list of every configured env name
- `default_env`: which one is used by default
- `cli_helpers`: the exact `productos env <cmd>` strings for this env (with `name` baked in). If the env is `read_only`, the `reset` and `down` helpers are `null` — respect that.

If the env response is `configured: false`, **stop**: tell the user to run `productos init claude` and edit `productos/env.yaml` for their stack.

### Step 2 — Pick the right env, then make sure it's up

**Default:** use the default env. The user usually means "local."

**Multi-env disambiguation:** if `all_envs` has more than one entry and the user didn't say which, **ask before validating** — running validation against `staging` when the user meant `local` is at best wasteful, at worst destructive. Sample question: *"You have envs `local` (default), `staging`, and `ci`. Should I validate against `local`?"*

**Bring the env up:**

```bash
productos env <name> check    # exit 0 if healthy
```

If non-zero:

```bash
productos env <name> up       # runs setup commands + healthcheck
```

(Name comes first — `env staging check` reads as "on the staging env, do a check." If you omit the name, ProductOS uses the default env.)

`<name>` is the env's identifier (use `cli_helpers.up` from the get_env response — it has the name baked in). If `env up` fails, **read the output and tell the user what to fix** — don't try to paper over a broken env config.

### Step 2.5 — Respect `external` and `read_only` flags

- `external: true` means ProductOS doesn't own this env (e.g. staging). The setup commands are usually empty (`[]`). Don't try to start services there — they're already running. Just confirm reachability via healthcheck.
- `read_only: true` means **do not call `productos env <name> reset` or `productos env <name> down`**. The CLI will refuse anyway, but don't even propose it. Per-test reset isn't available; design tests that don't require it (idempotent, or use fresh fixtures inline).
- If the user has both a `local` and a `read_only` env and the test you're proposing is destructive, validate against `local` only. Mention this in your proposal notes.

### Step 3 — For each claim, write the test and run it

The env config response has a `staging_dir` (default: `productos/tests/proposed/`). Write your proposed test there:

```bash
# After productos_propose_truth returns T-0042:
write productos/tests/proposed/T-0042.test.ts with the test source
```

Then run it. **Apply the env's `test_env` vars when invoking the test runner**, so the test hits the right URL/auth:

```bash
# If env.test_env = { BASE_URL: "http://localhost:3000" }
BASE_URL=http://localhost:3000 npx jest productos/tests/proposed/T-0042.test.ts
```

For Playwright:

```bash
BASE_URL=http://localhost:3000 npx playwright test productos/tests/proposed/T-0042.spec.ts
```

For pytest:

```bash
BASE_URL=http://localhost:3000 pytest productos/tests/proposed/test_T_0042.py
```

### Step 4 — Optional reset between tests

If the env has `reset_per_run` **and is not read_only**, run it between tests to keep state clean:

```bash
productos env <name> reset
```

(`cli_helpers.reset` will be `null` if the env is read-only — skip this step.)

### Step 5 — Record the outcome

```
productos_record_outcome({
  truth_id: "T-0042",
  result: "pass" | "fail" | "skip",
  captured_output: <truncated stdout+stderr from the test run>,
  test_file: "productos/tests/proposed/T-0042.test.ts",
  detail: "(optional one-line summary)"
})
```

If the test failed: **don't immediately mark it failed in the user's mind**. Read the output. Common causes:
- The env wasn't actually in the state your test assumed → reset + retry
- The test depends on a fixture that doesn't exist → propose/wire the fixture, retry
- The code genuinely doesn't behave as you claimed → record the fail; let the user decide if the claim is wrong or the code is wrong
- The test has a typo or wrong import → fix and retry

## Falsifiability gate (mandatory before propose)

- [ ] Can I cite the specific file(s) and line range(s) that demonstrate this behavior?
- [ ] Did I read every cited file (not just the imports)?
- [ ] Is the test runnable as-is (modulo fixtures), or does it have TODO placeholders?
- [ ] Would a competent dev reading the cited code agree the test exercises the claim?

If any answer is no → don't propose. Tighten the claim or read more code first.

## How to work through a codebase

1. **Detect the architecture.** Read `package.json`, framework markers, etc.
2. **Confirm the dev env is up** — `productos env check`, then `productos env up` if needed.
3. **Enumerate surfaces.** API routes, pages/components, data shapes.
4. **For each surface, propose + validate iteratively.** One claim at a time. Don't queue 30 proposals then batch-validate — propose, write test, run it, record outcome, move on. The user sees results in the vet UI as they land.
5. **Summarize at the end** — N proposed, M passed live, K failed; point user at `http://localhost:7878`.

## Common pitfalls — don't

- **Don't propose claims and *not* validate them.** That's just guessing dressed up as structured data. Run the test live; record the outcome.
- **Don't mark a fail as a fail without trying obvious fixes first** — reset state, check fixtures, re-read the code. But also don't go down a debugging rabbit hole; if the third try still fails, record it and move on.
- **Don't claim behavior you didn't read.** If `signup.ts` calls `sendWelcomeEmail()` and you didn't open that function, don't claim "sends a welcome email" — read it or skip.
- **Don't write `TODO` placeholders in test code.** Either runnable, or don't propose.
- **Don't propose `validated` status.** Only humans validate, in the vet UI.
- **Don't synthesize fixtures from imagination.** Read schema/migration first; propose a fixture stub if needed.
- **Don't bring up services the env config doesn't list.** If you find yourself needing to start something not in `productos/env.yaml`, *tell the user to update env.yaml* — don't paper over it ad-hoc.

## Worked example — an Express auth route

You read `src/api/auth/signup.ts`:

```ts
router.post('/signup', validate(signupSchema), async (req, res) => {
  const { email, password } = req.body;
  const existing = await db.users.findByEmail(email);
  if (existing) {
    return res.status(409).json({ error: { code: 'duplicate_email', message: 'Email already registered' } });
  }
  const user = await db.users.create({ email, passwordHash: await hash(password) });
  await sendWelcomeEmail(user);
  return res.status(201).json({ user: { id: user.id, email: user.email } });
});
```

You check the env is up (`productos env check`). It's not. You run `productos env up`. Healthy. Good.

You propose claim 1 via `productos_propose_truth` → get `T-0001`. You write `productos/tests/proposed/T-0001.test.ts`. You run `npx jest productos/tests/proposed/T-0001.test.ts`. It passes. You call `productos_record_outcome({ truth_id: "T-0001", result: "pass", captured_output: "PASS productos/tests/proposed/T-0001.test.ts\n  ✓ rejects duplicate email with 409 (45 ms)" })`.

You repeat for the success path (`T-0002`) and the side-effect (`T-0003` — and you read `email/welcome.ts` first because the claim cites it).

You summarize:

```
Proposed 3 Truth claims for src/api/auth/signup.ts:
  T-0001  ✓ pass    rejects duplicate email with 409
  T-0002  ✓ pass    creates user on new email
  T-0003  ✓ pass    sends welcome email on successful signup

Open http://localhost:7878 to vet — every claim has a live-passing
test waiting for your approval.
```

## When the env can't be brought up

Sometimes the env config is incomplete, the user's machine is missing something, or services are misbehaving. Don't try to validate in that case — surface the problem clearly:

```
I tried to bring up the `local` env via `productos env local up` but it failed:

  > docker compose up -d postgres
  Error: port 5432 already in use

Three things might be wrong:
  1. You already have postgres running locally — that's fine, just adjust
     env.yaml to not start it (or `lsof -i :5432` to find what's using it).
  2. A previous docker container is still up — `docker compose down` first.
  3. Your env.yaml expected docker compose to start postgres, but maybe
     your stack uses something else.

I haven't proposed any Truth yet. Once you tell me how to bring up the
env, I'll start.
```

The user fixes it, then asks you to retry.

## Picking between envs — quick rules

| Situation | Use |
| --- | --- |
| User says nothing about envs | The default env (almost always `local`) |
| User says "validate against staging" | `staging` (external, read-only) |
| User asks for the planning-feature loop (planned Truth → code lands → refresh) | Always `local` — feature work is iterative and needs reset |
| Test is destructive (deletes data, mutates global state) | `local` only. Don't even propose running against external read-only envs |
| Multiple envs exist and the user hasn't picked | Ask. Default to default_env if pushed, but ask first |
