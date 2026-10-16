# ProductOS

**Human-validated product truth that AI agents can build from.**

ProductOS holds a structured, validated record of what your product does — what it guarantees, why it works that way, and what's currently in question. Product people define it. Agents build from it. Engineering finds out when a change breaks something the team committed to.

> **Status:** v0.1.0 — early, in active design. The model is the **Exchange** model; an older one
> (containers, behaviors, test cases, surfaces) is still reachable from the commands and agent tools
> marked *retiring*, and [`GLOSSARY.md`](./GLOSSARY.md) deliberately defines none of its words.
> [`STATE.md`](./STATE.md) says what is actually built and what is open.

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
| **Surfaced by** | `productos v2 decide` · the ranked queue | `productos v2 check` · `productos v2 grid` |
| **Fails as** | *nobody has stamped this* · *the words moved since* | *open* · *disputed* · *a blank cell* |

⛔ **The order matters.** Never accept a claim that is contradicted or ambiguous: stamping
*"this is what we intend"* onto a sentence with two meanings is worse than leaving it
unstamped, because now it looks settled. Tenet 2 first, then tenet 1.

Start with [`OVERVIEW.md`](./OVERVIEW.md) — the model and why it is shaped this way — alongside [`EXAMPLE.md`](./EXAMPLE.md), which shows the same model as real files. [`GLOSSARY.md`](./GLOSSARY.md) defines every term and what it refuses; [`VISION.md`](./VISION.md) has the thesis.

## The model

**One ask, eight questions about it, and a count of what nobody has answered.**

```
Scope       the only container, at every altitude — the product, a grouping in it, one feature
  View      a screen, and where an ask arrives: its parts, their conditions, its states
  Exchange  one ask with exactly one answer — and the unit a human accepts
    Slot    one of eight questions about it, and the only place a sentence lives
            may · with · answer · after · refuses · fails · again · at_once
Rule        a sentence whose subject is a class of exchanges rather than one
Reading     an observation. Never truth — it explains why the truth is what it is
Verdict     a human's act: accept · rule · read · defer · waive
```

**Scopes nest as deep as the product needs**, because depth is a property of the product. An
**exchange** is one ask — made by a person, by the system, or by an integrator — and it is the
unit somebody reads in one sitting and agrees to in one act.

⛔ **The eight slots are all required, and the count is the point.** A real corpus came out 111
claims about screens against 58 about the machinery underneath, because a screen-shaped thing
had a route and a component to read and the machinery had neither. A required skeleton identical
on both sides means **you cannot be thin without a blank cell showing it** — which is how
*"incompleteness is countable"* stops being a feeling and becomes arithmetic.

A slot that nobody has settled carries a **standing**: the question, who owes the answer, what
it costs to guess wrong, and drafted options with the consequence of each. The AI drafts; the
human picks.

Two rules govern authoring:

- **Observability** decides what belongs — a detail is truth only if someone the product makes a
  promise to could distinguish two implementations differing in it. State the observation, never
  the mechanism.
- **Non-redundancy** decides where it lives — every fact has exactly one home, others reference
  it, nothing restates it. This is the primary lever on review cost, and when something true has
  nowhere to live the answer is a new field, never prose.

## How it fits together

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│   Product app   │────►│  ProductOS API   │◄────│   MCP server       │
│  define, review │     │   + Postgres     │     │  (local bridge)    │
└─────────────────┘     └────────┬─────────┘     └─────────┬──────────┘
                                 │                          │
                        markdown export              coding agent
                        a publishable page           CI / reconcile
```

- **The database is the authority.** Markdown is an export — the portability promise holds (*remove ProductOS and you keep your truth*) without making a repo the authoring surface. A product isn't a repo.
- **Agents read truth over MCP**, and a published page is a review surface a person can use with no
  checkout at all. A corpus carries the application's own stylesheet with it, so a drawing looks
  like the product wherever it is read.
- **[`AGENTS.md`](./AGENTS.md) in this repository is the roles document**, generated from the
  registry. ⛔ It is not an export of product truth, and nothing writes truth into it — that claim
  stood here while it was false.
- **The packet** is the handoff artifact: what a feature is for, each ask with its eight slots, the
  org-wide rules reaching them, what must be demonstrated, what is deliberately left to the
  builder, and what nobody has answered. Compiled on demand, and it will not compile over an
  unsettled slot. Deliberately no implementation — stack and patterns come from the repo.

## Validation

Agents propose. **Only humans validate.** The mechanism that enforces it is worth understanding,
because it changed: a boundary test used to fail the build if *any* agent tool could record an
act at all, and that boundary was deliberately opened so a person can answer in conversation or
press a button on a published page. What replaced it is stronger in the way that matters.

**Every act records which surface it came through** — `page`, `question`, `chat`, `cli`, `agent`
— required and never defaulted, because a default would let the weakest provenance silently wear
the strongest name. ⛔ **And `via: agent` is structurally incapable of satisfying a gate:**
software may land a default so a reviewer has something to disagree with rather than a blank, and
it is filtered out at the one place every gate asks whether something is accepted. So a corpus
can be read for the *quality* of its validation and not only for its presence.

**What a person agreed to is hashed in two halves** — what it says, and what demonstrates it — so
an acceptance reads back as *accepted*, *the claim changed since*, *the criteria changed since*,
*both changed*, or *nobody stamped this*. A stamp is never revived by a reword; what is kept is
the exact text that was hashed, so re-confirming is one glance at a diff.

**The stages are derived, never stored** — *specification → ready for review → ready for build*.
Each is already a fact about the stamps, and a stored stage would let a feature be marked ready
for build while questions are open. The stage is a report on consent, not a substitute for it.

**Refused before handover** — `productos v2 check` will not pass a corpus with a reference that
resolves to nothing, a slot nobody has filled, a rule that governs nothing or demonstrates
nothing, a drawing claiming to show something nothing states, or an ask arriving at a control
that promises nothing.

**Checked and reported, not refused** — size and shape advice, and anything resting on a
judgement call. A gate that fails on judgement is a gate people route around, and a refusal that
fires on every corpus in existence is one people switch off.

## Adoption

**Incremental, from active work — never a day-one full scan.** A full pass produces a queue nobody reads carefully, and a rubber-stamped corpus is worse than none, because every claim in it is labelled reviewed.

Start with the feature you're building now. Grow at the edges. Areas nobody touches stay uncovered, correctly.

## What is in here that is not ProductOS

`demo/` contains **Family Wallet** — a small Expo + React Native app used as a dogfooding testbed. Parents manage allowances, track tasks → balances per kid, and can apply interest on selected days. Simple, but with enough real surface (multi-tenant ledger, editable task list, unbounded interest rules, modal flows) to make product truth non-trivial.

`backend/` is **that demo's API**, not ProductOS: it mirrors the app's local ledger as a REST
surface so the app can run either fully local or backend-driven. Nothing in ProductOS depends on
it.

The hosted store is `src/v2/store/`, with the compose files here at the root. The older store
that modelled the replaced schema has been deleted — if you find a reference to one anywhere
else, it is out of date.

## License

[Apache 2.0](./LICENSE)
