# ProductOS — Vision

> **Canonical conceptual reference:** [`OVERVIEW.md`](OVERVIEW.md). This doc is the high-level thesis.

## In three lines

> **ProductOS enables Product-Driven Development.**
>
> **As implementation becomes automated, Product Truth becomes the bottleneck.**
>
> **ProductOS creates, verifies, and maintains Product Truth so autonomous systems can safely build software.**

## Core Thesis

Software teams (and the AI agents working alongside them) should organize around **verified product behavior**, not around code, tickets, or repos. **Product-Driven Development (PDD)** is the methodology; **ProductOS** is the platform that makes it operable.

The moment matters. Implementation — writing code, refactoring, generating tests — is rapidly automating. The constraint on shipping software is moving upstream: from *can we build it?* to *do we know what we're building?* and *can we tell when we've broken it?*. **Product Truth becomes the bottleneck.** Without a verified, structured record of what the product does, autonomous systems either regress quietly or require humans to babysit every loop.

The goal is **not** replacing humans or building "AI employees." The goal is making product correctness a first-class, queryable, version-controlled artifact — so agents stop regressing what's already true, humans stop holding the spec in their heads, and downstream outputs (tests, tickets, walkthroughs, evals) fall out of one source instead of drifting away from each other.

## The Missing Layer

Current AI coding systems focus on code generation, agent orchestration, IDE assistance, PR automation, and sandbox execution. They lack **product understanding**: what does this product actually do, how do we know, and what's currently in question?

The result: agents read code and infer intent (often wrong), reverify nothing, propose changes that quietly regress behavior nobody wrote down, and force humans to babysit every loop. Product knowledge stays in heads, wikis, and tribal lore — none of which an agent can read reliably or treat as Truth.

ProductOS fills the missing layer: **a human-validated product correctness graph** that sits between the codebase and the runtime, holding what the team commits to, what's currently verified, and where reality is in question.

## Model Shift

| Conventional development | Product-Driven Development |
| --- | --- |
| Ship code, then write tests against it | Write the behavior, derive the test |
| Product knowledge lives in heads, wikis, and tribal lore | Product knowledge is a structured, owned, dated graph |
| Tickets describe work; correctness is implicit | The graph describes correctness; tickets fall out of gaps |
| AI agents read code and infer intent | AI agents read verified behavior and don't regress it |
| Regressions are caught by tests (if you wrote them) | Regressions are caught by Drift signals on the graph |
| Planning happens in a separate tool from the code | Planning happens by writing `Planned` Contracts before code lands |

## Core Concepts

The full terminology lives in [`OVERVIEW.md`](OVERVIEW.md); the shortlist:

- **Product Context** — upstream framing (goals, design principles, personas, non-goals, voice). The first thing read before proposing anything. Optional in v0.1; load-bearing as the corpus grows.
- **Product Contracts** — individual claims about how the product behaves. The atomic artifact, authored in product language.
- **Product Truth** — the corpus: all Product Contracts as committed markdown. Survives if ProductOS is removed.
- **Product Evidence** — signals that inform whether reality matches Truth: test results from CI, AI-derived code-consistency analyses, AI-derived test-coverage analyses, human acceptance. Lives in the DB layer.
- **Derived Verification state** — per Contract: Verified / Contested / Orphan / Uncertain / Unverified. Pure function over Truth + Evidence.
- **Product Drift** — divergence signals (code changes, test failures, code-consistency flags, contests, expirations).
- **Product Correctness** — the aggregate quality of Truth.

**Three architectural layers:** Truth (committed markdown, PM-authoritative), Evidence (DB, signals about reality), Derived state (pure function over both). Each layer has a clean role. Remove ProductOS and you keep Truth; Evidence is regenerable.

Behaviors are atomic; Features group them; Areas group Features.

Contract states have two orthogonal axes: **Lifecycle** (`Planned` → `Implemented` → `Deprecated`) and **Verification** (only when Implemented: derived from Evidence into one of `Unverified`, `Verified`, `Contested`, `Orphan`, `Uncertain`).

## Who this is for

Two customer personas. They start in different places but converge on the same need: **a verified Product Truth that AI runtimes can act on safely.**

> **The v0.1 wedge persona:** A **product-lead person** inside either of the teams below, willing to install Claude Code as a one-time setup. They live in the browser (the product-truth site), use Claude Code's skill system to drive analysis on a scoped feature, and hand off the resulting spec to a builder — often Claude in agent mode. The eng-side surfaces (CLI, MCP, receive interface) are plumbing they don't think about after install.

### Persona 1 — AI-native team

- Already builds with Claude / Codex / Cursor / Devin daily; runtime is wired into the workflow.
- **Pain.** The runtime keeps regressing behavior the team's already built. Business intent lives in heads, Slack threads, half-written docs. Translating intent into agent context is manual, brittle, repetitive.
- **Why ProductOS.** Translates business intent (Product Context) into structured, verified Contracts that any runtime can read as context. Agents stop optimizing locally. Humans stop holding the spec in their heads. The drift loop keeps the corpus current as code evolves.
- **First-week value:** *"Claude now knows what we're building. It stopped breaking things I'd already shipped."*

### Persona 2 — Team that doesn't use AI yet

- Builds software the normal way today. Has a codebase. Doesn't know where AI fits or how to introduce it safely.
- **Pain.** Every AI tool wants to write code immediately. There's no path from *"we have a codebase"* to *"agents work alongside us without making a mess."*
- **Why ProductOS.** Provides the onramp. ProductOS indexes the existing codebase into a structured Product Truth that's AI-ready. The team writes down what they expect; ProductOS verifies; the corpus becomes the foundation any runtime can read once the team adopts one.
- **First-week value:** *"We now have a structured spec + tests for what our product does. We're ready to bring in AI on top."*

Both personas end at the same place: **Product Truth as the layer between codebase and runtime.** Persona 1 bolts ProductOS in to make their existing AI usage safer; Persona 2 starts with ProductOS and grows into agentic workflows from there.

## Strategic Positioning

ProductOS is **not** an IDE, an LLM, an agent runtime, or a coding assistant. It is the **product correctness substrate** that coordinates them — held in markdown in the user's repo, accessed via MCP, surfaced through a local product-truth site.

Conceptual analog: **dbt for product behavior** — declarative files describe the spec, the runtime turns them into queryable structure, and outputs (tests, tickets) derive from one source instead of being authored independently.

## Principles

- Agent/runtime agnostic — Claude Code first, Codex / Devin / Cursor follow
- Zero API keys held by ProductOS — AI flows through the runtime's session; external systems flow through the user's existing MCPs
- File-system-first, git-diffable — Contracts and Context live in committed markdown; runtime state lives behind MCP
- Humans verify, agents propose — never the inverse
- **Humans verify; the system maintains.** Product Truth should be self-healing. Agents resolve cosmetic and mechanical Drift autonomously; humans are only pulled in for load-bearing judgments
- Behavior over code, intent over implementation
- Outputs derive from one source — tests, tickets, walkthroughs, evals never drift from each other
- Drift is information, not failure — surface signals, let humans decide
- Drift detection is on-demand, not continuous — the user (or their CI) decides cadence; ProductOS provides the analyzers
