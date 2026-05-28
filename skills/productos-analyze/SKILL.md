---
name: productos-analyze
description: Use when the user asks to analyze a codebase for ProductOS — to propose Product Truth claims (executable behavior contracts) and the tests that verify them. Triggers on requests like "scan this codebase and propose ProductOS truth", "find what this app does and propose claims", "vet this feature for ProductOS". Reads code (backend, UI, routes, schemas), proposes { claim + test } pairs as one atomic unit via the productos MCP server. Each proposal must cite the code refs it derived from — proposals without code evidence are invalid.
version: 0.0.1
---

# ProductOS — Analyze Skill

You are doing **product correctness analysis** for ProductOS. Your job is to read a codebase and propose **Truth claims** about what the product does — each claim paired with an **executable test** that verifies it.

The user will validate your proposals by watching the tests actually run against their real app. Your test must therefore *actually work* — not just describe the behavior in prose.

## Core principles

1. **Every claim is paired with an executable test.** The test is not a description of the test — it's the code that runs. Make it idiomatic in the user's test framework.
2. **Every claim must cite code refs.** If you can't point at the specific file:line ranges that demonstrate the behavior, do not propose the claim.
3. **You propose; humans validate.** Never set status to `validated`. Always `proposed` (or `planned` for the feature-skill).
4. **Pair the claim narrowly with what the code can demonstrate.** Don't generalize beyond the evidence.
5. **No assumptions about behavior you didn't read.** If a handler imports a function you haven't read, *read it before claiming behavior*.

## The Truth claim shape

You call the MCP tool `productos_propose_truth` with this shape:

```json
{
  "claim": "POST /api/auth/signup with a duplicate email returns 409 with body.error.code = 'duplicate_email'",
  "type": "api-behavior",
  "code_ref": [
    "src/api/auth/signup.ts:23-67",
    "src/api/auth/validators.ts:12-30"
  ],
  "proposed_test": {
    "framework": "jest",
    "source": "import request from 'supertest';\nimport { app } from '../../src/index';\n\ntest('rejects duplicate email with 409', async () => {\n  const existing = { email: 'taken@example.com', password: 'p4ssword!' };\n  await request(app).post('/api/auth/signup').send(existing);\n  const res = await request(app).post('/api/auth/signup').send(existing);\n  expect(res.status).toBe(409);\n  expect(res.body.error.code).toBe('duplicate_email');\n});\n"
  },
  "fixtures": [],
  "scope": { "feature": "auth" }
}
```

## Claim types

Pick the right type — it routes how validation runs.

| Type | When | Test framework hint |
| --- | --- | --- |
| `api-behavior` | HTTP request → response invariants | Jest + supertest, pytest + httpx, etc. |
| `ui-flow` | Multi-step user interaction in the browser | Playwright (or framework's equivalent) |
| `data-invariant` | What must be true of stored data | Unit test against the data layer |
| `side-effect` | Non-response observable effect (email sent, queue job enqueued, audit log written) | Whatever runs the trigger + asserts the side effect |
| `error-handling` | How the system responds to bad input or upstream failure | Same as the surface (api-behavior with bad payloads, ui-flow with broken state) |

## Selector preferences (for `ui-flow` claims)

Choose selectors in this order. Mark anything below `data-testid` as `quality: fragile` so the user knows to add a testid before depending on it.

1. `data-testid` attributes — `page.locator('[data-testid=submit-btn]')`
2. ARIA role + accessible name — `page.getByRole('button', { name: 'Sign up' })`
3. Stable visible text — `page.getByText('Sign up')`
4. Semantic structure — `page.locator('main form input[type=email]')`
5. **Never** CSS classes that look implementation-specific (`.btn-primary-active-large`)

## Fixture inference

Before proposing a test, identify what fixtures are needed by reading:

- **Auth middleware** in API routes — if a route requires a logged-in user, propose a `user` fixture
- **Data models / migrations** — if the test needs an existing record (a wishlist with items, an order in state X), propose the fixture
- **Feature flags** — if behavior depends on a flag, propose enabling it

Express fixtures in the proposal:

```json
{
  "fixtures": [
    { "type": "user", "ref": "fixtures/users/default.json" },
    { "type": "product", "ref": "fixtures/products/p-123.json", "fields": { "id": "p-123", "price": 19.99 } }
  ]
}
```

The user wires fixtures once. Don't propose new fixture content if one of equivalent shape already exists in `productos/fixtures/` — link to it instead.

## Falsifiability gate (mandatory)

Before each `productos_propose_truth` call, sanity-check:

- [ ] Can I name the specific file(s) and line range(s) that demonstrate this behavior? (If no → don't propose.)
- [ ] Did I read all of them, or am I inferring from imports? (Read what you cite.)
- [ ] Is the test runnable as-is (modulo fixtures), or does it have `TODO` placeholders? (TODOs → don't propose; either flesh out the test or drop the claim.)
- [ ] Would a competent developer reading the cited code agree the test exercises the claim? (If you'd have to explain, the claim is at the wrong abstraction.)

## How to work through a codebase

1. **Detect the architecture.** Read `package.json`, framework markers (Express vs Fastify vs Next.js routes, React vs Vue, etc.).
2. **Enumerate the surfaces.** API routes (typically `src/api/`, `src/routes/`, `app/api/`), pages/components (typically `src/pages/`, `src/app/`, `src/components/`).
3. **For each surface, propose 1–3 claims.** Don't over-shard ("user can click button" is too granular); don't over-bundle ("auth works" is too coarse). Target: one observable behavior per claim.
4. **Cite the code.** Read each route's handler + its imports (validators, middleware, response helpers) before claiming behavior.
5. **Propose all claims via `productos_propose_truth`**, one at a time. After all proposals, summarize what you proposed and where (which surfaces / what counts).
6. **Tell the user to open the vet UI** at `http://localhost:7878` to review and live-validate.

## Common pitfalls — don't

- **Don't claim behavior you didn't read.** If `signup.ts` calls `sendWelcomeEmail()` and you didn't open that function, don't claim "sends a welcome email" as a side-effect — propose a stub claim or skip.
- **Don't claim what type signatures imply but the code doesn't enforce.** `email: string` doesn't mean "validates email format."
- **Don't propose claims at the wrong abstraction.** "Returns JSON" is too generic; "Returns `{ error: { code: 'duplicate_email' } }` on duplicate" is right.
- **Don't write hopeful tests.** If you guessed the response shape, the test will fail live validation — better to read it carefully than to guess.
- **Don't propose `validated` status.** Only humans validate.
- **Don't write `TODO` placeholders in test code.** Either the test is complete and runnable, or you don't propose the claim.
- **Don't synthesize fixtures from imagination.** Read the schema/migration first.

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
  await sendWelcomeEmail(user);  // (you also read sendWelcomeEmail and confirmed it actually sends)
  return res.status(201).json({ user: { id: user.id, email: user.email } });
});
```

You propose three claims, each with `productos_propose_truth`:

1. **`api-behavior`**: "POST /api/auth/signup with a new email returns 201 and `{ user: { id, email } }`" — code_ref `signup.ts:1-15`
2. **`api-behavior`**: "POST /api/auth/signup with a duplicate email returns 409 and `{ error: { code: 'duplicate_email' } }`" — code_ref `signup.ts:5-10`
3. **`side-effect`**: "Successful POST /api/auth/signup sends a welcome email via sendWelcomeEmail" — code_ref `signup.ts:13`, `email/welcome.ts:8-30`

You do **not** propose:
- "Password is hashed before storage" — true but it's an implementation detail; only propose as Truth if it's externally observable
- "Email field is validated" — `validate(signupSchema)` is a wrapper, you'd need to read the schema before claiming a specific behavior
- "Returns JSON content-type" — too generic

## After proposing

When you're done, summarize for the user:

```
I proposed N Truth claims across M surfaces.

Auth (3): T-0001, T-0002, T-0003
Wishlist (5): T-0004 through T-0008
...

Open http://localhost:7878 to vet them. For each card, click "▶ Run live" — I've written the test in {framework}, so it should execute against your dev server at {target_url}. Approve the ones that match your intent; reject the ones I got wrong.
```

The user then takes over in the vet UI. Your job is done until they ask for more.
