# ProductOS — Use Cases

> **Canonical conceptual reference:** [`OVERVIEW.md`](OVERVIEW.md). Personas are defined in [`VISION.md`](VISION.md). This doc walks through the three concrete flows ProductOS supports today. Everything described here is shipping behavior — no future capabilities.

## How the flows fit together

| Flow | When it runs | Primary actor |
| --- | --- | --- |
| **1. Scoped onboarding** | First feature a team protects with ProductOS — usually one already in flight | Product lead (with Claude Code as the analyzer) |
| **2. Feature development** | Every new feature — idea → spec → implementation → validation | PM (authors intent), Builder (engineer or Claude in agent mode) |
| **3. Test result ingestion** | Every CI run — how the user's test results feed back into ProductOS's view of Truth | The user's CI |

Scoped onboarding produces the **first** Verified slice — one feature, 3-5 behaviors. Not the whole codebase. Feature development is the everyday loop that grows the corpus feature-by-feature, on the cadence of real work. Test result ingestion is the live link that lets a test pass or fail in the user's CI move the Contract's derived Verification state without anyone touching the product-truth site.

---

## Flow 1 — Scoped onboarding

A product-lead person adopts ProductOS on their existing codebase. They install Claude Code + ProductOS once, then **scope the first pass to a single in-flight feature** — not the whole codebase. Goal: a small slice of Verified Product Truth (3-5 behaviors) for the one feature they're already invested in. Strategy/Context is **optional** and deferred until they have enough features to justify cross-cutting principles.

```mermaid
flowchart TD
    A[productos init claude<br/>~3 min one-time setup] --> B[Skill installed, MCP registered<br/>productos/ scaffolded]
    B --> C[productos serve<br/>localhost:7878]
    C --> D[Pick one in-flight feature<br/>e.g. checkout flow]
    D --> E[In Claude Code:<br/>'Scope ProductOS on the checkout flow'<br/>(triggers productos-scope skill)]

    E --> F[Skill walks ONLY the relevant code paths<br/>NOT the whole codebase]
    F --> G[Skill proposes 3-5 behaviors<br/>+ code-consistency analysis per behavior<br/>+ test-coverage analysis if tests exist<br/>Lifecycle: Implemented · Verification: Unverified]

    G --> H[PM opens http://localhost:7878]
    H --> I{For each proposed behavior<br/>~60 seconds each}
    I -->|claim is right| K[Accept<br/>DB state · no commit]
    I -->|claim needs work| L[Edit claim / test cases inline<br/>writes to markdown]
    I -->|claim is wrong| M[Reject<br/>DB state · no commit]
    K --> N[Continue to next]
    L --> N
    M --> N
    N --> I

    I -->|all reviewed| O[git add productos/products/checkout/<br/>git commit]
    O --> P[First Verified slice lives in the repo<br/>3-5 behaviors · one feature · 5-10 minutes total]
    P --> Q[Strategy/Context optional<br/>add later when ≥5 features exist]
```

**What ships at the end of scoped onboarding:**

- `productos/products/<area>/<feature>.md` — vetted Contracts for **one feature**, with claims + numbered test cases (committed)
- Per-Contract Verification state + Evidence (code-consistency, test-coverage) recorded in the local DB (gitignored, regenerable)
- Strategy/Context files exist as empty templates in `productos/context/*.md` but **don't need to be filled in for the loop to work**

**Time budget:** 5-10 minutes from `productos init` to first Verified slice. The whole point is making the first feature cheap — *the corpus grows from real feature work, not a one-time modeling ceremony*.

---

## Flow 2 — Feature development

The everyday loop. A feature idea travels through clarification (Contracts), handoff (implementation packet), execution (code + tests), drift check (pre-PR), and re-verification.

The cycle is **PM authors intent → builder consumes → PM validates.** The builder is often Claude in agent mode in the same Claude Code session, sometimes a human dev, sometimes a contractor.

```mermaid
sequenceDiagram
    autonumber
    actor PM as Product lead
    participant Claude as Claude Code
    participant ProductOS
    actor Builder as Builder<br/>(Claude agent / engineer)

    Note over PM,Claude: Author intent
    PM->>Claude: "Scope ProductOS on the wishlist feature"
    Claude->>ProductOS: read Product Context (if present)
    Claude->>Claude: walk wishlist code paths
    Claude->>ProductOS: propose 4 behaviors with claims + test cases<br/>+ code-consistency analysis<br/>+ test-coverage analysis
    ProductOS-->>PM: 4 behaviors shown in site<br/>(Unverified · per-behavior evidence badges)

    Note over PM,ProductOS: Vet — either surface, same MCP tools
    alt In Claude Code (inline, no context switch)
        Claude->>PM: present behavior 1: claim + evidence
        PM->>Claude: Y/N/E/S per behavior
    else In product-truth site (batch / deep)
        PM->>ProductOS: open localhost:7878
        PM->>ProductOS: accept/edit/reject each behavior
    end
    ProductOS->>ProductOS: markdown content committed; state in DB

    Note over Builder,ProductOS: Consume intent
    Builder->>ProductOS: read Contract via MCP<br/>(or as exported packet)
    Builder->>Builder: implement code
    Builder->>ProductOS: productos test align<br/>(map existing tests to behaviors)
    ProductOS-->>Builder: 3 of 4 covered by existing tests<br/>1 needs a new test
    Builder->>Builder: write the missing test<br/>(or productos test scaffold for net-new)
    Builder->>Builder: push branch · CI runs

    Note over ProductOS: Validate post-build
    ProductOS->>ProductOS: receive test results from CI<br/>per-stable_id status<br/>resolves test_failed drift / opens new
    ProductOS->>ProductOS: recompute Derived state<br/>(Verified · Contested · Orphan · Uncertain)

    alt PM checks status in site
        PM->>ProductOS: reopen localhost:7878
        ProductOS-->>PM: visual grid of per-behavior badges
    else PM checks status in Claude Code
        PM->>Claude: "what's the status on this feature?"
        Claude->>ProductOS: read derived state via MCP
        Claude-->>PM: text rollup: 3 Verified · 1 Verified (new)
    end

    Note over PM: Felt-value moment:<br/>intent conveyed faithfully, validated automatically
```

**What ships at the end of each feature cycle:**

- New Contracts with Lifecycle = `Implemented` and derived Verification = `Verified` (or `Contested` / `Orphan` if signals say so)
- The Contract content (claims, test cases, notes) reflects what shipped — committed to the repo
- Evidence trail in the local DB: per-stable_id test results, code-consistency analyses with reasoning, test-coverage analyses
- The markdown is the packet — no separate handoff artifact required in v0.1 (Claude reads it directly via MCP)

**Drift outside this flow:** the Contracts produced here become the baseline for the *next* PR. As code evolves, the analyzer skill (re-run on demand) produces fresh code-consistency + test-coverage evidence, opening drift events when reality moves away from the claim. The drift loop is what keeps Truth honest as code evolves.

---

## Flow 3 — Test result ingestion

How runnable tests in the user's CI feed back into ProductOS's view of Truth. ProductOS doesn't run tests, doesn't parse test source, and doesn't own the runner. It exposes one tiny **receive** interface that takes per-test status + timestamp. Anything that can hit the interface with the right payload — a CI shell step, a GitHub Action, a Jest reporter, a pytest plugin — works. Connectors are convenience packaging around the same receive call.

```mermaid
flowchart LR
    subgraph PO[ProductOS — the spec]
        TC[Contracts with numbered test cases<br/>each carries stable id:<br/>area/feature#behavior/case]
    end

    subgraph IMPL[Implementer]
        I[reads test cases<br/>writes runnable tests<br/>encodes stable id in test name/annotation]
    end

    subgraph REPO[User's repo]
        T[describe/it blocks in jest, pytest, etc.<br/>test names carry the stable id]
    end

    subgraph CI[User's CI — unchanged]
        RUN[Runner produces per-test results]
        POST[Post-step posts results to ProductOS<br/>via CLI / HTTP / MCP / connector]
    end

    subgraph RECV[ProductOS — receive only]
        ING[Receive {stable_id, status, timestamp}<br/>Match stable id → test case<br/>Unmapped results: ignored silently]
        DRIFT[Open test_failed drift on fail<br/>Resolve on subsequent pass]
        VST[Verification recomputed:<br/>no open drift = Verified<br/>any open drift = Contested]
    end

    TC --> I
    I --> T
    T --> RUN
    RUN --> POST
    POST --> ING
    ING --> DRIFT
    DRIFT --> VST
```

**The contract with the user's stack:**

- **Coverage management, not test generation.** ProductOS organizes coverage around verified behaviors: it *maps* the user's existing tests onto test cases (`productos test align`), *surfaces* which cases are uncovered (`productos test coverage`), and *receives* results from CI through the same stable id. Scaffolding new test files is a supporting feature for net-new cases — not the headline.
- **One tiny receive interface.** ProductOS accepts a list of `{stable_id, status, timestamp}` tuples (with optional `message` / `run_id` for context). Same payload across MCP, CLI (`productos test record < results.json`), and HTTP. No parsing of framework-specific outputs in ProductOS itself.
- **Connectors are optional convenience.** A jest reporter, pytest plugin, or JUnit-XML converter can wrap the call so the user doesn't write glue. None are required — anything that emits the payload works. Connectors ship as separate packages on the user's normal package manager.
- **Stable id is the only convention.** Format: `<area>/<feature>#<behavior>/<test_case_id>` — e.g. `auth/signup#duplicate-email/1`. The implementer puts it where their framework carries it through to the result (test name is the easiest path; some frameworks support tags or metadata).
- **Unmapped results are dropped silently.** Tests that don't carry a recognizable stable id are outside the Contract grid and don't drive Verification. No errors, no warnings — they just don't show up.
- **Deprecated test cases stay in the Contract.** When a test case (or its parent behavior) is no longer load-bearing, it gets `deprecated: true` in the markdown — it is never deleted. Stable ids are immutable + append-only. Results coming in for a deprecated id are recorded in `last_run_status` for forensics but **don't open `test_failed` Drift**. If the behavior comes back, the user removes the flag and the id resumes driving Verification — no resurrection, no renumbering.

**How a pass/fail moves Truth:**

- A **fail** on an *active* test case opens a `test_failed` Drift event on the Contract. The Contract's computed Verification flips from `Verified` to `Contested`.
- A subsequent **pass** on the same test case resolves the open `test_failed` drift. If no other drift events remain open on the Contract, the computed Verification returns to `Verified`.
- A pass or fail on a *deprecated* test case is recorded but does not flip Verification (a deprecated case is not part of current Truth).
- The engineer never opens the site for this. CI runs, ProductOS receives, the Verification state reflects reality. The site is for *viewing* or for resolving the drift events that need human judgment.

**What this delivers:**

- The user's existing CI keeps doing what it does. ProductOS doesn't replace the runner, doesn't replace the reporter, doesn't depend on any specific framework.
- The stable id is the only thing crossing the boundary in both directions: implementer writes it into the test, results flow back referencing it.
- Verification is live — no separate "re-verify" step, no manual sweep. The Contract reads as Verified at any moment when nothing currently contests it.
- Connectors absorb the awkwardness of producing the payload for popular runners. They're convenience, not a requirement.

**Scaffolding new test files (supporting feature, not the headline):**

For behaviors with no existing test coverage, `productos test scaffold <feature_id>` emits a framework-native skeleton (jest / vitest / playwright / pytest) with the stable id baked into each test name and the `given`/`when`/`then` (or `steps`) as comments. The stub fails loudly until the implementer fills in setup + assertions.

The labor savings vary by test layer:

- **Unit / integration / api:** the skeleton is most of the work. The implementer drops in assertions and is done.
- **End-to-end:** the skeleton is 5% of the work — harness setup (browser, fixtures, page objects) is the rest. The scaffold here is a forcing function for coverage (the empty file sits red until you address it), not a labor saver.

The 80% case for any non-greenfield codebase is **mapping existing tests to test cases**, not scaffolding from scratch. `productos test align` is the primary entry point; scaffolding is the tail case for genuinely-net-new behaviors.

---

## How the flows reinforce each other

- **Scoped onboarding** seeds the corpus with one feature the team actually cares about — and teaches them what a good Contract looks like in the process.
- **Feature development** uses the corpus as context (Claude pulls Verified Contracts during the feature pass) and grows it (new Contracts get added per cycle).
- **Test result ingestion** lets the team's existing CI move derived Verification state automatically — ProductOS receives status events without owning the runner or parsing framework-specific output.

The whole system is one tight loop: PM authors intent (claims + test cases) → builder consumes intent via MCP → builder writes code + tests against the test cases → CI runs and posts results back → ProductOS recomputes derived state per behavior (Verified / Contested / Orphan / Uncertain) using test results + AI-derived code-consistency + AI-derived test-coverage evidence → PM validates the feature shipped as intended. Self-heal handles the cosmetic / mechanical changes; humans vet only what genuinely needs judgment.
