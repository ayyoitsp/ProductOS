# ProductOS — Vision

> Conceptual model: [`OVERVIEW.md`](OVERVIEW.md). *(Detailed strategy lives in the private planning set.)*

## In three lines

> **AI agents autonomously deliver code based on human-validated product truths.**
>
> **As implementation automates, product truth becomes the bottleneck.**
>
> **ProductOS creates, validates, and maintains that truth so autonomous systems can build safely.**

## The thesis

Writing code is automating fast. The constraint is moving upstream — from *can we build it?* to *do we know what we're building?* and *can we tell when we've broken it?*

Without a validated, structured record of what a product does, agents infer intent from code, get it wrong, and quietly regress behavior nobody wrote down. Product knowledge lives in heads, wikis, and Slack threads — none of which an agent can read reliably or treat as true.

**Truth is an input to building, not a report on what was built.** That distinction drives everything: the artifact exists so an agent can build *from* it, and so a human can tell whether what came back still holds.

## The gap it fills

Two gaps, one artifact.

**Agents and intent.** Coding assistants read code and guess at why. Deliberate absences are invisible — nothing in a repo records what the team considered and rejected. An agent finds no handling for a case, calls it a gap, and "fixes" it.

**Product and engineering.** PRDs stop at features. Design docs start at services. The promises in between — what the product's shared abilities actually guarantee — live in tribal knowledge, and both sides assume the other wrote them down. When it breaks, product says *"that's not what I asked for"*, engineering says *"that's not what you specified"*, and both are right.

ProductOS occupies that altitude: **what the systems should do, not how they do it.** Product owns what the promise is; engineering owns how it's kept.

## Who it's for

**Product people author. Engineering verifies. Both get value.**

Product defines features and sees what already exists, what it conflicts with, and what was decided before. Engineering finds out whether a change breaks something the team committed to.

Product leads because engineering value is worthless on an empty corpus — *"this contradicts verified behavior"* requires verified behavior to exist first.

**Nobody maintains a corpus.** Truth accrues as a byproduct of defining features — work that was happening anyway. Every documentation discipline that asked people to visit a separate place to keep it current has failed; the ones that survived were byproducts of work already in motion.

## Principles

- **Observability decides inclusion** — a detail belongs in truth only if someone the product makes a promise to could tell two implementations apart. State the observation, never the mechanism.
- **Non-redundancy** — every fact has one home; others reference it. This is the main lever on review cost.
- **Enforce at the tool boundary** — an agent can ignore an instruction; it cannot ignore a rejected call.
- **Precision is not implementation** — when an agent builds the wrong thing, the fix is a more precise *product* claim, never technical detail.
- **Humans validate; the system maintains** — agents propose and heal mechanical drift. The graph cannot mark itself true.
- **Minimal surface** — rich internally, poor externally. A reviewer sees *right / wrong / not sure*.

## What it is not

Not an agent, IDE, or coding assistant. Not a wiki. Not a ticket tracker or roadmap tool. Not a description of implementation. Not self-validating — without the human bit, the graph is an agent gaslighting itself.
