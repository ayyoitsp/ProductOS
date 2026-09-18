# Overview

> **The canonical conceptual reference** — *why the model is shaped this way*. Term definitions live in [`GLOSSARY.md`](./GLOSSARY.md), which wins on any disagreement. *Why we're building it* is `planning/STRATEGY.md`; *how* is `planning/ARCHITECTURE.md`.
> **Revised 2026-08-03.**

ProductOS holds a **human-validated record of what your product does**, structured so AI agents can build from it and check against it.

> **AI agents autonomously deliver code based on human-validated product truths.**

Truth is an **input to building**, not a report on what was built. Everything below serves that.

---

## The model

Three altitudes, one atom.

```
   Surface  ─────  how the user interacts, exactly
                   screens, elements, flow between them

   Feature  ─────  what the user gets
                   user-facing functionality

   Capability ───  one thing a subsystem promises, as an interface
                   grouped into capability systems; many features depend on one
```

**Altitudes, not containment.** Many features depend on one capability; one capability composes others; one surface serves several features. The edges are many-to-many — this is a DAG, and any strict hierarchy would be a lie.

**Two symmetric trees.** Features group into **feature areas** (which nest, inside a **product**); capabilities group into **capability systems**. Same shape, different decomposition: an area is a product concern, a capability system is a subsystem — engineering's cut of the system. A capability system is never inside an area, because a subsystem serves many of them.

```
products/                                    capabilities/
└── billing/            ← product            └── user-account-manager/  ← capability system
    └── pricing/        ← feature area           ├── invite-user.md     ← capability
        ├── seat-estimator.md   ← feature        └── change-role.md
        └── invite-teammate.md
```

**Feature areas nest as deep as the product needs.** `cre/pricing/agency/limit-tiers` is
as valid as `cre/pricing/deal-pricing`. A fixed two levels forced every real joint past
the second one into a name (`deal-pricing-agency`) or into a bag of thirty features
nobody reads — depth is a property of the product, not of ProductOS.

What keeps that from becoming a free-for-all is a **target size**, not a depth limit.
`productos check` measures every area against `grouping:` in `productos/config.yaml`
(default: 2–8 features, 24 behaviors) and names the specific edit — which features
cluster into a proposed sub-area, which level separates nothing and should collapse,
which feature has grown into two. Re-filing is `productos move <id> <destination>`,
which carries the file, the id, the tracking sidecar and every `depends_on`,
`affected_by` and `leads_to` edge pointing at it in one operation.

⛔ **Never re-file by hand.** A container's id *is* its path, so `mv` leaves the id
claiming the old location and silently strands every edge aimed at it — a corpus that
passes `check` on the moved file and has quietly lost its graph.


### Three things only a reader can say

Every signal above is derived from the corpus's shape. Shape is not what goes wrong.

A fresh reader handed a corpus that satisfied every check found sixteen problems on one
page, on which the tool had logged thirty-two findings — **none of which was any of the
sixteen**. Their conclusion: *"The checks that exist are checks of form. Everything that
would produce wrong software here is a matter of agreement between two sentences, and
nothing checks that."*

So three things are supplied by a person and computed by nothing:

| | Says | Recorded with |
|---|---|---|
| **Read-through** | I read this end to end and could / could not build from it | `productos read` |
| **Ambiguous** | this claim is decided, and two of us would build it differently | `productos ask ambiguous` |
| **Suspected dependency** | I believe this edge exists and its owner has not declared it | `suspected_depends_on` |
| **Same question** | these open questions are one hole, and one decision closes them all | `same_as` |

⛔ **All three are addable by someone who does not own the page**, and that is the point.
The person who finds an ambiguity is by definition not the person who wrote it
unambiguously in their own head, and a wrong impact count cannot be corrected by the page
that is wrong about it.

### Behavior is the atom

A **Behavior** is a single falsifiable claim about what the product does. Everything verifiable hangs here: acceptance test cases, validation state, drift.

Behaviors live on **Features** and **Capabilities** — the two container kinds. They *anchor* to a Surface + Element when triggered by a user action, and anchor to nothing when they're rules or invariants.

Surfaces don't own behaviors. A behavior belongs to whatever **triggers** it; the screen is where it's anchored, not who owns it.

```yaml
# feature: documents/delete-document
- id: delete-removes-from-file
  claim: "When a user deletes a document, it is removed from the loan file
          and no longer counted toward completeness"
  anchor: { surface: document-list, element: delete-button }

# capability: capabilities/extraction/field-extraction
- id: extracts-by-type
  claim: "Given a document and a document type, extraction returns every field
          defined for that type, each with a confidence between 0 and 1"
  # no anchor — nothing user-triggered
```

### Feature vs. Capability

| | Groups into | Trigger | Anchored to | Promisee |
| --- | --- | --- | --- | --- |
| **Feature** behavior | a feature area | A *user action* | A surface + element | The user |
| **Capability** behavior | a capability system | An *input from elsewhere in the product* | Nothing | The consuming feature |

A capability is **one thing a subsystem promises.** *"Classification returns a confidence for every document"* is a capability. The **capability system** it belongs to is the subsystem — `document-classifier` — which is engineering's decomposition, and is why capability systems live outside product areas and have no screens.

What never leaks in is the subsystem's *internals*. *"There's a classification service behind a queue"* is mechanism: engineering's, and not ours.

⛔ **"Not a subsystem" is a rule about claims, not about grouping.** Reading it as "the container must not be named for a subsystem" is what produces capabilities grouped by topic, or a screen filed as a capability because it had no route in the repo being read.

The capability altitude is where product and engineering **negotiate**: product owns what is promised, engineering owns how it's kept. That altitude is missing from most teams' artifacts entirely — PRDs stop at features, design docs start at services — which is why the gap between them is where arguments happen.

---

## The two rules

### Observability — does this belong at all?

> A detail belongs in Truth **iff someone the product makes a promise to can distinguish two implementations that differ only in that detail.**
>
> When it qualifies, state **the observation, never the mechanism.**

**Promisees:** the user (features), the consuming feature (capabilities), external integrators (public APIs). **Not** engineers with logs, dashboards, traces, or DB access — engineering visibility is not product observability. *Exception:* a customer-facing audit log or status page **is** a promise surface.

**The procedure:** name the detail → imagine two implementations differing only in it → can any promisee tell them apart? → yes: state what's *observed*; no: cut it.

Worked against an async pipeline (upload → classify → extract):

| Detail | Distinguishable? | Verdict |
| --- | --- | --- |
| Classification runs before extraction | No | ❌ Cut |
| The type appears before the fields do | Yes | ✅ *"The type appears as soon as it's known, before fields are ready"* |
| Internal retry on low confidence | No | ❌ Cut |
| A user's correction survives re-extraction | Yes | ✅ Include |
| Runs on a queue vs. inline | No | ❌ Cut |

Row 2 is the one to internalise: the claim is *"the type appears before the fields"* — **not** *"classification runs first."* Same fact; only one survives a rewrite.

This rule also does **anti-redundancy** work: if no promisee can distinguish the implementations, the claim adds nothing over reading the code and wastes a reviewer's attention.

**Async workflows need no new concept.** A long-running pipeline is a feature depending on several capabilities. The async-ness is Truth wherever it surfaces — pending states, partial results, failures, whether work continues after navigation. Orchestration stays out; composition is carried by `depends_on`, so you never write "then."

### Trigger — where does it belong?

Feature or capability, per the table above. Two orthogonal jobs: **observability decides inclusion, trigger decides placement.** Don't conflate them.

*(The "does it survive reimplementation?" test is a corollary of observability, not a third rule — if no promisee can distinguish the implementations, the claim survives by construction.)*

---

## Non-redundancy

> **Every fact has exactly one home. Other places reference it; nothing restates it.**

Not elegance — **the primary lever on review burden.** If nothing is restated, reviewing a feature means reading only what's genuinely new, so review cost tracks *new information* rather than corpus size.

Three redundancy types, three fixes:

| Type | Fix |
| --- | --- |
| Truth ↔ truth (same fact twice) | Reference via `depends_on` / `affected_by` / `decided_by` |
| Truth ↔ code (claim adds nothing over the code) | The observability rule |
| Truth ↔ truth (contradiction) | Conflict detection |

Conflict detection therefore has **two modes**: contradiction *and* duplication. *"This already exists at `extraction/field-extraction#confidence`"* is as valuable as *"this contradicts X."*

---

## The graph

**Nodes:** context items · decisions · glossary terms · feature areas · capability systems · surfaces · elements · features · capabilities · behaviors · test cases · evidence · drift signals · code refs · owners

**Edges:**

| Edge | From → To |
| --- | --- |
| `has` | Feature area → Feature; Capability system → Capability; Feature/Capability → Behavior; Behavior → Test case; Surface → Element |
| `anchor` | Behavior → Surface + Element + interaction |
| `depends_on` | Feature → Capability; Capability → Capability |
| `uses` | Feature → Surface |
| `leads_to` | Element → Surface (the flow graph) |
| `affected_by` | Feature → Feature |
| `decided_by` | Behavior → Decision |
| `implements` | Feature/Capability → code ref |

**Views** — projections, never authored twice:

| View | Question |
| --- | --- |
| Flow | How does a user move between screens? |
| Blast radius | If this capability's promise changes, what breaks? |
| Subsystem load | Which features lean on this capability system, and how heavily? |
| Surface usage | Which features does this screen participate in? |
| Component usage | If I change this component, which screens change? |
| Rationale | Why is this behavior the way it is? |
| Gaps | Where is Truth missing, stale, or contested? |

The **reversed** traversals are where value concentrates — *"what breaks if I change this"* is the question a hierarchy structurally cannot answer.

---

## Product Context

Upstream claims that frame every behavior. **Read first** — a proposal contradicting a principle or non-goal is wrong before it's evaluated against anything.

Goals · Design principles · Personas · Non-goals · Voice/tone · **Glossary** · **Decisions**

**Glossary** — term → one-line product meaning. Keeps vocabulary consistent so analysis doesn't invent synonyms (*kid* / *child* / *dependent*). Deliberately **not** an entity model: entities with fields are a data model, which is implementation.

### Decisions

Non-goals record *what* the product doesn't do. Decisions record **why**, and **what else was considered**.

The failure this prevents is the one PDD exists for: an agent finds no handling for a case, calls it a gap, and "fixes" it — reintroducing something removed deliberately. No behavior can express this, because the whole point is that the behavior doesn't exist.

Decisions carry **no validation state** — a decision isn't falsifiable, it's a record of a choice.

> **The record is immutable; the ruling is not.**

You never erase *that* a decision was made or why. Whether it still **governs** is expected to change: `active` → `under-review` → `superseded`, with `revisit_after` and a `reaffirmed` history. A decision from ten months ago encodes ten-month-old constraints; treating it as permanent converts an old trade-off into an unexamined rule.

Four revisit triggers, all signals rather than verdicts: **age**, **the stated constraint changed**, **a citing behavior is contested**, **direct challenge**. Note the last — feedback can contest a *decision*, not just a behavior. Reopening is normal, not exceptional.

---

## State — deliberately minimal

Rich internally, poor externally. A reviewer should never meet the internal taxonomy.

**Lifecycle** — is it built?

| | |
| --- | --- |
| **Planned** | Intended, no code yet. *This is where generation lives* |
| **Built** | Code exists |
| **Retired** | Deliberately withdrawn; kept for history |

**Validation** — can we trust it?

| | |
| --- | --- |
| **Needs review** | Proposed by an agent, no human has accepted it |
| **Validated** | A human accepted it |
| **Problem** | Something disagrees — a failing check, a contradiction, a challenge |

That's it externally. One "problem" signal, not seven drift kinds. Richer internal structure (evidence provenance, signal source, confidence) exists for analysis and stays out of the reviewer's way.

**The one bit that is sacred:** *human-validated* vs *agent-proposed*. It's the trust anchor, it's what agents consume to decide what they can rely on, and it survives every simplification. Agents propose; only humans validate.

---

## Adoption

### Setup — a correction task, not a blank form

Before anything is ingested, the product needs framing: **what it is, who it's for, and what it deliberately doesn't do.** Without that, imported claims land at arbitrary altitude with nothing to judge relevance against.

The minimum is small — a paragraph, a rough audience, two or three non-goals. Everything else accrues. And it's drafted from whatever's reachable (README, an existing PRD) for the PM to *correct*, because editing a wrong sentence is far cheaper than authoring a blank one.

### Seeding — in the corpus ≠ in your queue

A PM starting from nothing has nothing to design against, so the corpus can be seeded from a codebase, existing tests, PRDs, or support conversations. Every imported claim lands **unvalidated**, tagged with where it came from.

The rubber-stamping failure comes from *asking for review*, not from claims existing. So the two are separated:

> Hundreds of unvalidated claims can exist as orientation and as a conflict-detection substrate, with none of them landing in a queue.

Baseline claims are **never packeted, never emitted to agents, and flagged as unvalidated when they surface in a conflict.** They validate incrementally as a byproduct — when a PM designs in an area, the relevant ones surface for confirmation as part of that work.

### Growth

**Incremental, from active work. Never a day-one review push.**

Asking someone to accept 40 claims in a sitting produces rubber-stamping, and a rubber-stamped corpus is **worse than none** — every claim in it is labelled reviewed.

1. **Start with what's in flight.** Scope the feature being built. The work is happening anyway; validation rides along.
2. **Grow at the edges.** Each new or actively-changed feature adds its slice.
3. **Reach steady state.** The actively-developed surface gets covered, which is the surface that matters.

**Coverage percentage is a bad headline metric** — it rewards the bulk-accept behavior that hollows the corpus out. *Validated behaviors in actively-changed areas* is the number that means something.

---

## Storage

**The database is the authority. Markdown is an export.**

Truth lives in a hosted service. Export produces the same markdown corpus on demand, which preserves the portability promise — *remove ProductOS and you keep your truth* — without making a repo the authoring surface.

This matters beyond convenience: a **product isn't a repo**. One product often spans several, and truth is a property of the product.

Agents reach truth over MCP. Verified truth is also emitted into **AGENTS.md**, which is read natively by most major coding agents — so behavior reaches them with no integration at all.

See `planning/ARCHITECTURE.md` for the substrate.

---

## What ProductOS is not

- **Not an agent, IDE, or coding assistant.** It makes the runtime you already use smarter.
- **Not implementation.** No services, queues, schemas, or interface contracts — ever. When an agent builds the wrong thing, the fix is a **more precise claim**, never technical detail.
- **Not a wiki.** Structured, owned, and dated by construction.
- **Not a ticket tracker or roadmap tool.** Those consume the graph.
- **Not self-validating.** Agents propose; humans validate. Without that, the graph is an agent gaslighting itself.
