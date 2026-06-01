# Overview

> **ProductOS enables Product-Driven Development.**
>
> **As implementation becomes automated, Product Truth becomes the bottleneck.**
>
> **ProductOS creates, verifies, and maintains Product Truth so autonomous systems can safely build software.**

## Product-Driven Development (PDD)

> Product-Driven Development is the practice of continuously growing and maintaining **Product Truth** — the verified corpus of **Product Contracts** that describe how the product behaves — while minimizing **Product Drift**.

PDD is a methodology for building software where **verified product behavior is the primary unit of work** — not code, not tickets, not stories, not features in a tracker. You write down what your product does as structured, falsifiable claims; a human validates each one with evidence; everything downstream — tests, tickets, walkthroughs, evals — derives from that record.

The shift PDD makes:

| Conventional development | Product-Driven Development |
| --- | --- |
| Ship code, then write tests against it | Write the behavior, derive the test |
| Product knowledge lives in heads, wikis, and tribal lore | Product knowledge is a structured, owned, dated graph |
| Tickets describe work; correctness is implicit | The graph describes correctness; tickets fall out of gaps |
| AI agents read code and infer intent | AI agents read verified behavior and don't regress it |
| Regressions are caught by tests (if you wrote them) | Regressions are caught by Product Drift signals on the graph |
| Planning happens in a separate tool from the code | Planning happens by writing `planned` behaviors that the implementation must satisfy |

The five tenets:

1. **Behavior is the unit.** Every claim about what the product does is atomic, falsifiable, and individually tracked.
2. **Humans verify; the system maintains.** Agents propose new Contracts, and self-heal cosmetic/mechanical Drift autonomously. Humans are pulled in only to make load-bearing judgments about claims. The graph cannot mark itself true, but it can carry an existing Verification forward when nothing about the claim changed.
3. **Outputs are derived, not parallel.** Tests, tickets, walkthroughs, evals all come from the same source — the graph — so they can't drift from each other.
4. **Drift is first-class.** When code changes, evidence stales, or feedback contests a claim, the system surfaces it as a signal, not a silent rot.
5. **Planning is graph-writing.** Intended behavior is written as `planned` claims before code lands. The implementation is checked against the plan.

## The conceptual system

| Layer | Name |
| --- | --- |
| **Philosophy** | Product-Driven Development (PDD) |
| **Platform** | ProductOS |
| **Upstream framing** | Product Context (goals, design principles, personas, non-goals, voice) — durable product-level claims that constrain every Contract below |
| **Primitive** | Behavior — a single falsifiable claim about the product |
| **Container** | Feature (bundles behaviors), grouped into Areas |
| **Item-level artifact** | Product Contract (an individual claim about how the product behaves) |
| **Corpus** | Product Truth (the verified collection of all Product Contracts, framed by Product Context) |
| **Outputs** | Tests, tickets, walkthroughs, evals |

ProductOS is the platform that makes PDD operable. It holds the structured artifact, surfaces drift and gaps, and lets your existing AI runtime do the reasoning. *Pods (team-level ownership scoping) are an aspirational layer in the planning docs; not first-class in v0.1.0.*

## Product Context — the layer above Contracts

Product Contracts answer *"what does the product do?"*. But upstream of that there are durable claims about the product as a whole that constrain every Contract below them. These are **Product Context**.

| Type | Example for Family Wallet |
| --- | --- |
| **Goals** | "Kids internalize saving by feeling progress on small balances" / "Parents spend <5min/week on chore admin" |
| **Design principles** | "Numbers feel rewarding, never punishing" / "Parents stay in control — kids suggest, parents approve" / "Interest is opt-in and unbounded by design" |
| **Personas** | "Sarah, mom of 2 (ages 8 & 10)" / "Jake, single dad of a 6yo who had a piggy bank growing up" |
| **Non-goals** | "We don't connect to real bank accounts" / "No anti-fraud — this is trust-based" |
| **Voice / tone** | "Kid-friendly language; celebrate wins; never shame losses" |

Context is **the first thing Claude reads before proposing anything** — a proposed Contract that contradicts a Design Principle or a Non-goal is wrong before it's even evaluated against the code.

Stored as a top-level directory mirroring `products/`:

```
productos/
├── context/                       ← Product Context
│   ├── README.md                  ← how to read this dir
│   ├── goals.md
│   ├── principles.md
│   ├── personas.md
│   ├── non-goals.md
│   └── voice.md
└── products/                      ← Product Contracts (claims + numbered test cases)
    └── <area>/<feature>.md
```

Context items are vetted and edited through the same product-truth site as Contracts — Claude can propose updates (e.g., during analysis of a new feature it might suggest a new design principle), and the human accepts, refines, or rejects.

## What a Contract looks like

A Contract bundles the claim and its numbered test cases. The claim is the prescriptive spec; the test cases are the concrete scenarios that prove it. Test generation materializes each test case into a runnable test in the user's framework.

```yaml
---
id: auth/signup
title: User signup
owners: [peter]
implements:
  - src/api/auth/signup.ts
  - src/pages/signup.tsx
behaviors:
  - id: duplicate-email
    claim: "POST /api/auth/signup with an email already in use returns 409 with body.error.code = 'duplicate_email' and no new account is created"
    notes: |
      Intentional separation from 400 so the client can show a
      specific 'this email is already registered' message.
    test_cases:
      - id: 1
        description: "Standard duplicate rejection"
        steps: |
          1. Existing user with email alice@example.com
          2. POST /api/auth/signup with email alice@example.com
          3. Assert response is 409 with body.error.code = 'duplicate_email'
          4. Assert no new user record was created
      - id: 2
        description: "Case-insensitive duplicate detection"
        steps: |
          1. Existing user with email alice@example.com
          2. POST /api/auth/signup with email ALICE@EXAMPLE.COM
          3. Assert response is 409 (emails treated case-insensitively)
  - id: welcome-email
    claim: "Successful signup enqueues a welcome email to the registered address"
    test_cases:
      - id: 1
        description: "Welcome email enqueued on success"
        steps: |
          1. POST /api/auth/signup with a fresh email + valid password
          2. Assert response is 201
          3. Assert one job enqueued on the email queue, targeted at the new user's email
---
```

The test case carries a stable id (e.g. `auth/signup#duplicate-email/1`) so any test eventually written for it — by the implementer in v0.1, by a future skill in a future release — traces back to the Contract.

**In v0.1, ProductOS does not generate runnable test files.** Test cases live in the Contract as the spec; the implementer (engineer or agent) writes the actual tests in the user's framework, using the cases as acceptance criteria. Skill-driven test generation lands in a future release once the test-case shape is settled.

## What ProductOS is, in one sentence

A **human-validated product correctness graph** — a structured, owned, dated record of what your product does, version-controlled in your repo, with explicit verification status per claim.

## Terminology

Two layers of vocabulary: the **conceptual terms** (how the methodology talks) and the **Contract states** (the per-contract lifecycle, orthogonal to the conceptual layer).

### Conceptual terms

| Term | What it is |
| --- | --- |
| **Product Graph** | The data structure underneath everything: nodes are context items, features, behaviors, contracts, evidence, code refs, owners; edges are the relationships between them. The graph is the canvas; everything else is a view over it |
| **Product Context** | Upstream, product-level claims that frame every Contract: Goals, Design Principles, Personas, Non-goals, Voice/Tone. Durable; rarely changes. Stored as committed markdown under `productos/context/`. Read first by Claude before proposing Contracts |
| **Product Contract** | An individual unit of how the product behaves. Includes both **the claim** (what's true at the product level) and **numbered test cases** (concrete scenarios that demonstrate the claim). One Contract per behavior; the claim is the spec, the test cases are the verification scaffold. Stored as a behavior entry inside a Feature's committed markdown |
| **Product Truth** | The corpus — the entire verified collection of Product Contracts. "The Product Truth" is the team's complete spec of how the product works |
| **Product Verification** | The act of accepting that a Contract reflects reality. Two provenance types: `human` (a person accepts via the product-truth site after reviewing/editing) and `self-heal:<reason>` (an agent carries an existing human Verification forward because a change was non-semantic — cosmetic edit, mechanical rename, file move). Content edits write to committed markdown; state transitions write to the local DB without a commit. Audits can filter to human-only Verifications trivially |
| **Product Evidence** | What currently backs a Contract — text-only refs by design: code references (file:line into `src/`), narrative notes, generated tests and their last-known status, optional query results. Provenance includes the validator's identity, the timestamp, and the freshness window |
| **Product Drift** | Divergence between an Implemented Contract and reality — code changes that invalidate Evidence, test failures, customer feedback disagreements, Evidence past its TTL. Drift signals push an Implemented Contract from Verified → Contested. Surfaced as a first-class signal, not silent rot |
| **Product Correctness** | The aggregate quality of Product Truth: how many Implemented Contracts are Verified with fresh Evidence, how few are Contested, how few Gaps remain. The property the whole methodology optimizes for |
| **Behavior** | The implementation-level name for a Contract — a single falsifiable claim held inside a Feature file |
| **Feature** | A bundle of related behaviors / Contracts. The file unit: `productos/products/<area>/<feature>.md` |
| **Area** | A folder-level grouping of features. Pure organization; no inherent semantics |
| **Gap** | A place in the corpus where Truth is missing or weak: a Planned Contract with no code yet, an Implemented Contract that's Unverified, a Verified Contract past its TTL, a Contested Contract, an orphan with no owner. Gaps are where the Graph tells you what to work on next |

### Contract states — two orthogonal axes

A Contract has two independent state dimensions: its **lifecycle** (where it sits in its life — a property of the Contract itself) and its **verification** (whether it currently matches reality — a function of downstream validation and Drift signals).

**Lifecycle** — a property of the Contract:

| State | Meaning |
| --- | --- |
| **Planned** | Forward-looking intent. The Contract describes a behavior the team plans to build. No code yet; verification state not meaningful |
| **Implemented** | Code exists for this Contract. Carries a verification state |
| **Deprecated** | Explicitly retired by the team. Kept in the corpus for history; no longer counted toward Correctness |

**Verification** — a function of validation and Drift, only meaningful for Implemented Contracts:

| State | Meaning |
| --- | --- |
| **Unverified** | No human has reviewed and accepted the Contract. Default for newly-Implemented Contracts (e.g., analyzer-generated drafts) |
| **Verified** | A human has read and accepted via the product-truth site. Backed by Evidence with a freshness window |
| **Contested** | A Drift signal challenges the Contract: test failure, freshness expired, customer feedback disagreement, or a referenced code path changed. Stays Contested until re-verified or rewritten |

```
Lifecycle:                       Verification (only when Implemented):

  Planned                            Unverified ──(HITL accepts)──► Verified ◄──┐
     │                                                                   │       │
     │ (code lands)                                                      ▼       │ (re-verify)
     ▼                                                              Contested ───┘
  Implemented
     │
     │ (team retires)
     ▼
  Deprecated
```

A Planned Contract has no verification state — there's nothing to verify against yet. A Deprecated Contract has no verification state — it's no longer counted. An Implemented Contract always carries one of {Unverified, Verified, Contested}.

## Where ProductOS sits relative to the tools you already use

Everyone else owns a stage of the PDLC or a surface in the stack. ProductOS owns the **Product Graph** that those stages read from, write to, or fall out of.

| Adjacent category | Relationship |
| --- | --- |
| **BDD / acceptance frameworks** (Cucumber, Gherkin, SpecFlow) | **Closest conceptual neighbor.** Both describe behavior in human-readable form. Gherkin couples scenarios tightly to test execution; ProductOS decouples — behaviors stand on their own as the artifact, and tests are one of several evidence kinds |
| **Product docs / wikis** (Notion, Confluence, internal wikis) | **Replaces, for product behavior.** Wikis are free-form, undated, ownerless, and decay silently. The graph is structured, owned, dated, with explicit verification status and stale-detection |
| **Test frameworks** (Jest, Playwright, pytest, Vitest) | **Downstream.** The graph defines what should be true; the framework runs the check. Tests are a generated output of the graph, run in the user's stack |
| **Test / QA management** (TestRail, Zephyr, Qase, Xray) | **Tests are a direct output of the graph.** Whether ProductOS replaces these tools or feeds them depends on how a team uses them — for a team that treats the catalog as authoritative, ProductOS *is* that catalog; for a team that uses QA management as a workflow layer on top, ProductOS feeds it |
| **Ticket systems** (Linear, Jira, GitHub Issues) | **Downstream.** The graph is the source of truth for *what work needs to exist* — gaps in the graph become tickets. The ticket system tracks the work; the graph tracks the correctness |
| **Product spec / roadmap tools** (Productboard, Aha, Linear roadmaps) | **Downstream.** Planning happens through the graph — `planned` behaviors capture intent before code lands and synthesize what the product *should* do. The roadmap consumes that, and ProductOS is a natural extension for managing some of it directly |
| **AI coding assistants** (Claude Code, Cursor, Copilot, Codex, Devin) | **Symbiotic.** They write the code; the graph gives them verified behaviors so they don't regress what's true, and they propose new behaviors back. ProductOS needs a runtime, doesn't compete with one |
| **Customer feedback** (Zendesk, Intercom, Pendo, Canny) | **Upstream input.** Feedback contests verified behaviors and surfaces planned ones; the graph + feedback together drive how the product should evolve to meet what customers actually want |

## Scope — in vs. out

| In scope | Out of scope |
| --- | --- |
| Reading the user's codebase to propose Product Contracts | Writing or refactoring the user's code (that's the runtime's job) |
| Routing Product Context into the runtime's context window | Replacing the runtime — Claude Code stays Claude Code |
| Vetting / accepting Contracts via the product-truth site | Calling LLMs directly — no BYOK in v0.1 |
| Holding numbered test cases inside Contracts (specs in plain English) | Writing runnable test files in the user's framework (v0.1: implementer writes them; skill-driven generation ships future) |
| Ingesting feedback queue entries as Drift signals | n/a |
| Receiving test results from the user's CI (`{stable_id, status, timestamp}` via MCP / CLI / HTTP) and opening/resolving `test_failed` Drift on each | Parsing framework-specific test output formats (connectors ship as separate convenience packages) |
| Self-healing cosmetic / mechanical Drift | Self-validating claims as Verified — human signal required |
| Surfacing Drift events when load-bearing change is detected | Deciding what to do about them |
| Surfacing Gaps (uncovered, unverified, stale, contested) | Prioritizing engineering work |
| Per-Contract Lifecycle + Verification state | Workflows, ticket statuses, deployment states |
| Storage: committed markdown + local SQLite (later: remote endpoint) | Hosted-only operation; multi-repo orchestration |
| Web + API surfaces | Native-app analysis (mobile / desktop) |
| Receiving inbound signals (test reports, feedback queue entries) | Holding third-party API keys (Linear, Zendesk, Sentry, etc.) — those flow through the user's runtime MCPs |

## What ProductOS is explicitly *not*

- **Not an LLM, agent, or coding assistant.** It makes the runtime you already use smarter; it doesn't replace it.
- **Not a wiki or free-form doc tool.** The graph is structured, owned, and dated by construction.
- **Not a description of implementation.** It describes product *behavior*, not interface contracts or code shape. API docs and OpenAPI schemas sit in a different concern.
- **Not a test runner or test parser.** Verification is a human *judgment* anchored by the markdown commit and live drift signals. Tests execute in the user's normal runner; ProductOS doesn't drive browsers, capture screenshots, or run live traces. It *receives* per-test status from the user's CI (one tiny interface: `{stable_id, status, timestamp}`) and lets that move Verification — but it never parses framework-specific output formats itself.
- **Not self-validating.** Agents and humans propose; humans verify. The "human-validated" half of the name is non-negotiable — without it, the graph becomes the agent gaslighting itself.

## The verification loop

Verification is not a discrete action — it's the iteration loop between Claude and the human, mediated by the product-truth site.

```
Claude (skill) ──► proposes contracts (writes markdown)
                          │
                          ▼
            User opens product-truth site
                          │
            reviews → edits → accepts
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
   edit contract content         mark as verified
   (writes markdown,             (writes DB,
    committed to git)             no commit)
            │                           │
            └─────────────┬─────────────┘
                          │
                          ▼
              Updated Product Truth
                          │
              (next Claude pass reads this)
```

Two kinds of user actions land in two different places:

| Action | Writes to | Commits? |
| --- | --- | --- |
| Edit a claim, split a behavior, add notes, refine a contract | Markdown file | Yes — content change, belongs in git |
| Accept a contract as Truth, mark contested, record validator + timestamp | Local DB behind MCP | No — state change, no commit per verify |

This resolves the friction of "commit per verify" without losing the audit trail: git captures every content evolution; the DB captures every state evolution; together they're the full history.

## Self-healing — humans verify, the system maintains

> **Goal:** Product Truth should be self-healing. Humans verify; they do not maintain.

The agent's role splits in two:

- **Verifying a claim** — "is this assertion about the product correct?" — load-bearing judgment, always human
- **Assessing whether a change matters to a claim** — "does this code edit affect what the claim says?" — falsifiable, agent-driven

The agent never decides a claim is true. It decides whether a *change* is relevant to a claim the human already said was true. When the change is non-semantic, the agent records a `self-heal` Verification and the Contract stays Verified. When the change is load-bearing, the agent escalates by emitting a Drift event and flipping Verification to Contested.

### What self-heals

| Change type | Self-heal action |
| --- | --- |
| Whitespace, formatting, comments | Record `self-heal:cosmetic` Verification; no Contract change |
| Mechanical rename (all callers updated atomically) | Update `code_refs`; record `self-heal:rename` Verification |
| File moved (no body change) | Update `code_refs` path; record `self-heal:file-move` Verification |
| Behavior-preserving refactor (e.g., extract-method on private helper) | Update `code_refs`; record `self-heal:refactor` Verification |

### What escalates to a human

| Change type | Escalation |
| --- | --- |
| Logic change in a referenced region | Drift event; Verification → Contested; agent may propose updated claim |
| Observable behavior changed (return shape, error code, side effect) | Drift event with proposed Contract edit; Verification → Contested |
| Ambiguous (agent can't classify) | Drift event "needs human review"; Verification → Contested |

### The confidence gate

Self-heal only fires when the agent is highly confident the change is non-semantic. Anything less escalates. The skill's instruction is explicit: *false positives (escalating cosmetic changes) are cheap; false negatives (auto-healing a load-bearing change) corrupt Truth.*

### The success metric

The principle is measurable: **what fraction of code changes flow through without human attention?** A team where every refactor pulls humans into the vet queue is failing self-healing; a team where cosmetic and mechanical changes carry forward silently is succeeding.

## Drift detection — on-demand, not continuous

ProductOS doesn't watch for Drift. The user (or their CI) decides when to scan; ProductOS provides the analyzers.

Five kinds in MVP, split by trigger pattern:

| Kind | Pattern | Trigger |
| --- | --- | --- |
| `code_change` | Pull (agent-analyzed) | User runs the `productos-drift` skill or `productos drift scan` |
| `conflict` | Pull (agent-analyzed) | Same |
| `expired` | Pull (deterministic query) | `productos gaps` or `productos drift list --kind expired` |
| `test_failed` | Push (inbound from CI) | User's CI calls `productos_record_test_results` (MCP / CLI / HTTP) with a per-test status; ProductOS opens a `test_failed` Drift for each failing *active* stable id, resolves it when the same id passes on a later run. *Deprecated* ids pass through to `last_run_status` without opening Drift (deprecated cases aren't part of current Truth). Unmapped ids are dropped silently. Stable ids are immutable + append-only — test cases are deprecated, never deleted. Connectors (jest reporter, pytest plugin, JUnit converter) ship as separate convenience packages |
| `feedback` | Push (inbound) | A feedback entry is filed targeting a Verified Contract |

**MVP first iteration:** the `productos-drift` skill — a Claude-driven, local, pre-PR scan that uses the user's existing runtime session. The skill walks the branch diff, runs the `code_change` and `conflict` analyzers, self-heals what it can, and escalates the rest as Drift events.

**Deferred:** a CI PR bot packaging the same analyzers for headless use (requires BYOK; lands later).

## Storage model

Two artifacts are checked into the user's repo. Everything else lives behind the MCP server in a local DB.

**Committed:**

```
productos/context/                       ← Product Context (goals, principles, personas, non-goals, voice)
productos/products/<area>/<feature>.md   ← Product Contracts (claims + numbered test cases in frontmatter)
```

*Runnable test files are written by the implementer in v0.1 (using the test cases as the spec) and live wherever the user's stack expects them. Skill-driven generation into `productos/tests/...` ships future.*

**Gitignored, behind the MCP server:**

```
productos/.local/runtime.db              ← verification state, drift events, evidence refs
```

All clients (CLI, product-truth site, Claude Code skill) read and write through the MCP server. The server owns the DB; today it's a local SQLite file, later it can be swapped for a remote endpoint via `productos configure` without any client-side changes.

| Concept | Storage |
| --- | --- |
| Product Context | `productos/context/*.md` — committed markdown for goals, design principles, personas, non-goals, voice. Edited via the product-truth site |
| Product Contracts | `productos/products/<area>/<feature>.md` — frontmatter holds id, owners, code links, behaviors with claims, notes, and numbered test cases. Edited directly via the product-truth site |
| Product Verification | DB — append-only log of state changes (accepted, contested, etc.) per behavior |
| Product Evidence | DB — text-only refs (code, narrative, test-result, query); no binary artifacts |
| Product Truth | Derived — latest valid Verification per behavior |
| Product Drift | DB — event stream (file changes, expirations, contests) |
| Product Correctness | Derived rollup |
| Generated tests | *v0.1: not generated by ProductOS — the implementer writes runnable tests using the Contract's test cases as the spec. Skill-driven generation ships future* |
