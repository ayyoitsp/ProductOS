# ProductOS

**Human-validated product truth that AI agents can build from.**

ProductOS holds a structured, validated record of what your product does — what it guarantees, why it works that way, and what's currently in question. Product people define it. Agents build from it. Engineering finds out when a change breaks something the team committed to.

> **Status:** v0.1.0 — early, in active design. The architecture changed substantially in Aug 2026 (standalone hosted service, product-first). Docs reflect the new direction; code is catching up.

## Why

> **AI agents autonomously deliver code based on human-validated product truths.**

Writing code is automating. Knowing *what* to build, and telling when you've broken it, is not. Agents read code and infer intent — and they can't infer what isn't there: the case you deliberately chose not to support leaves no trace in a repo.

ProductOS makes product truth an input to building, rather than a report on what was built.

## The two tenets

Everything here is judged against these, and a feature that serves neither does not belong.

> **1. A human has validated the product truth.**
>
> **2. The product truth is sufficient to build from — no confusion, no room for interpretation.**

The second carries a corollary: it has to help you see whether the truth is **complete**, not
only whether it is clear. And the first carries a constraint on how it is served — **make
validating easy, never overwhelm the reviewer, and record their decisions.** A queue nobody
works is worth nothing, and a rubber-stamped corpus is worse than none, because every claim
in it is labelled reviewed.

These are the two things a repository structurally cannot hold and an agent cannot supply
for itself. An agent can write a plausible claim; it cannot make a human have agreed to it.
It can describe what code does; it cannot tell you the description omits the case nobody
decided, or that one sentence has two builds.

They divide the work cleanly, and the division is visible in the product:

| | Tenet 1 — has a person agreed? | Tenet 2 — is it enough to build from? |
|---|---|---|
| **The act** | accepting a claim, settling a question | writing a claim that admits one reading |
| **Who** | only a person; no tool exposes it to a model | whoever authors, human or agent |
| **Surfaced by** | `productos next` · the ranked queue | `productos check` · readiness · the audit |
| **Fails as** | *awaiting review* | *undecided* · *ambiguous* · *contradiction* |

⛔ **The order matters.** Never accept a claim that is contradicted or ambiguous: stamping
*"this is what we intend"* onto a sentence with two meanings is worse than leaving it
unstamped, because now it looks settled. Tenet 2 first, then tenet 1.

Start with [`OVERVIEW.md`](./OVERVIEW.md) — the model and why it is shaped this way — alongside [`EXAMPLE.md`](./EXAMPLE.md), which shows the same model as real files. [`GLOSSARY.md`](./GLOSSARY.md) defines every term and what it refuses; [`VISION.md`](./VISION.md) has the thesis.

## The model

Three altitudes, one atom:

```
Surface     how the user interacts — screens, elements, flow
Feature     what the user gets                     grouped into feature areas
Capability  one thing a subsystem promises         grouped into capability systems
```

Feature areas sit inside a **product** and **nest as deep as that product needs** —
products vary enormously in complexity, so a fixed depth would force the real joints
into names or into one unreadable bag. What bounds it is a target *size*, not a depth
limit: `productos check` measures every area against it and names the specific edit,
including which features it would split into a sub-area. A container's id **is** its
path, so re-filing is `productos move`, which carries the file, the id, the tracking
sidecar and every edge pointing at it.

A **Behavior** is a single falsifiable claim — the atom everything hangs off. Behaviors live on features and capabilities, and anchor to a surface when a user action triggers them.

A **Capability** is one thing a subsystem promises — *"classification returns a confidence for every document"*, never *"there's a classification service behind a queue."* Capabilities group into **capability systems** (the subsystem), symmetric to features grouping into **feature areas**. That altitude is where product and engineering negotiate: product owns what is promised, engineering owns how it's kept.

Two rules govern authoring:

- **Observability** decides what belongs — a detail is truth only if someone the product makes a promise to could distinguish two implementations differing in it. State the observation, never the mechanism.
- **Trigger** decides where it belongs — user action → feature; input from elsewhere → capability.

## How it fits together

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│   Product app   │────►│  ProductOS API   │◄────│   MCP server       │
│  define, review │     │   + Postgres     │     │  (local bridge)    │
└─────────────────┘     └────────┬─────────┘     └─────────┬──────────┘
                                 │                          │
                        markdown export              coding agent
                        AGENTS.md                    CI / reconcile
```

- **The database is the authority.** Markdown is an export — the portability promise holds (*remove ProductOS and you keep your truth*) without making a repo the authoring surface. A product isn't a repo.
- **Agents read truth over MCP**, and validated truth is emitted into [`AGENTS.md`](https://agents.md/) — read natively by most major coding agents, so behavior reaches them with no integration.
- **The packet** is the handoff artifact: behaviors, test cases, applicable context and decisions, and the verified truth a change must not regress. Deliberately no implementation — stack and patterns come from the repo.

## Validation

Agents propose. **Only humans validate** — no tool for a model to do it is exposed, which
is a property of the tool surface and not a request in a prompt. An agent may *remove* a
validation stamp (noticing that a claim no longer holds only ever reduces what the corpus
asserts); it cannot add one.

State stays deliberately small. Externally: *planned / built / retired*, and *needs review / validated / problem*. One "problem" signal, not a drift taxonomy. Richer structure exists internally and stays out of a reviewer's way.

Invariants are enforced at the tool boundary rather than requested in prompts: an agent can
ignore an instruction; it cannot ignore a rejected call. What is actually enforced, and
what is only checked, are deliberately different lists.

**Refused at the boundary** — no tool exists for a model to mark a claim validated; a
behavior may not carry both a claim and a question; an answer must name who decided and
why; a re-decision of a settled claim is rejected; a container may not be re-filed without
carrying its id and every edge pointing at it.

**Refused before handover** — `productos check` will not pass a corpus with a declared
contradiction, a reference that resolves to nothing, a grouping with no description, or a
high audit finding.

**Checked and reported, not refused** — the claim linter, the flow rules, size and shape
advice. These are judgement calls, and a gate that fails on judgement is a gate people
route around.

## Adoption

**Incremental, from active work — never a day-one full scan.** A full pass produces a queue nobody reads carefully, and a rubber-stamped corpus is worse than none, because every claim in it is labelled reviewed.

Start with the feature you're building now. Grow at the edges. Areas nobody touches stay uncovered, correctly.

## The `demo/` directory

`demo/` contains **Family Wallet** — a small Expo + React Native app used as a dogfooding testbed. Parents manage allowances, track tasks → balances per kid, and can apply interest on selected days. Simple, but with enough real surface (multi-tenant ledger, editable task list, unbounded interest rules, modal flows) to make product truth non-trivial.

## License

[Apache 2.0](./LICENSE)
