# Overview

> **The canonical conceptual reference** — *why the model is shaped this way*. Term definitions
> live in [`GLOSSARY.md`](./GLOSSARY.md), which wins on any disagreement;
> [`EXAMPLE.md`](./EXAMPLE.md) shows the same model as real files. *Why we're building it* is
> `planning/STRATEGY.md`; *how* is `planning/ARCHITECTURE.md`.
>
> **Describes the Exchange model, which is the model the code runs. Revised 2026-10-16.**

ProductOS holds a **human-validated record of what your product is meant to do**, structured so
AI agents can build from it and check against it.

> **AI agents autonomously deliver code based on human-validated product truths.**

## ⛔ Product truth is the TARGET STATE. Always. Whether it is built is a different question

Truth is an **input to building**, not a report on what was built. Everything below serves that,
and it is the one principle most easily lost, because a corpus retrofitted onto an existing
product looks exactly like a description of that product.

**What follows, and none of it is optional:**

- **A screen in the corpus is the screen the product should have** — not a picture of a
  component that exists. Screens are truth, so screens are target state too.
- **The codebase is one way to POPULATE truth**, and a good one: reading what was built is the
  only cheap way to retrofit a product that already exists. It is never what truth is *tied to*.
  A feature nobody has built is as real in the corpus as one that shipped this morning.
- **Drift is downstream and separate.** Comparing the target against what exists is its own
  question, asked after the fact. A component that was deleted is *evidence about the product*,
  never proof that the truth is wrong — only a person deciding the target changed can make it
  wrong.
- **So nothing in the corpus may require code to exist.** A check that refuses a screen for
  having no component is not a standard, it is the code quietly made authoritative over the
  target.

⛔ **This document used to say "a record of what your product does" four lines above "not a
report on what was built", and resolved the contradiction nowhere.** A session read the first
sentence, inherited the code as the standard, and shipped a check that refused any screen not
drawn from a component — with `exists: intended` as the escape, which made it worse: it forced
an author to declare something *not built* just to get the target state accepted. The principle
being implied by tenet 2 was not enough. It is stated here now because its absence was
load-bearing.

---

## What the whole thing is for

Two tenets, and every shape below exists to serve one of them:

> **1. A human has validated the product truth.**
>
> **2. The product truth is sufficient to build from — no confusion, no room for
> interpretation** — which includes being able to see whether it is **complete**.

⛔ **They are ordered.** Never accept a claim that is unsettled, disputed or has one thing about
it nobody has ruled — stamping intent onto a sentence with two meanings is worse than leaving it
unstamped, because now it looks settled. Tenet 2 first, then tenet 1.

Reading the model with those two in hand makes most of it obvious. An acceptance covers one ask
rather than one file, because per-file would bless fifteen claims with one click — tenet 1
refusing to overwhelm a reviewer. A slot nobody has filled renders as a **hole** rather than as
whitespace, so incompleteness is countable — tenet 2. A charter section is cited rather than
restated, so the reverse question *which sentences rest on this* can be asked at all — tenet 1
again.

These are the two things a repository structurally cannot hold and an agent cannot supply for
itself. An agent can write a plausible claim; it cannot make a human have agreed to it. It can
describe what code does; it cannot tell you the description omits the case nobody decided, or
that one sentence has two builds.

---

## The model

**One ask, eight questions about it, and a count of what nobody has answered.**

```
   Scope ──────── the only container, at every altitude
                  the product · a grouping in it · one feature

     View ─────── a screen, and where an ask arrives
                  its parts, their conditions, its states, which screen it appears inside

     Exchange ─── one ask with exactly one answer — and the unit a human accepts
                  asked by a person, the system, or an integrator

       Slot ───── one of eight questions about that ask, and the only place a sentence lives
                  may · with · answer · after · refuses · fails · again · at_once

         Standing ─ the disposition of that slot
                    stated · open · disputed · out_of_scope

         Criterion ─ what would have to be demonstrated for it to be believed

   Rule ───────── a sentence whose subject is a class of exchanges rather than one

   Reading ────── an observation. Never truth — it explains why the truth is what it is

   Verdict ────── a human's act: accept · rule · read · defer · waive
```

Beside those nine, the model carries what a real product needs and a behaviour cannot hold: a
feature's **happy path** and its **why · risks · measures · instruments**; the product's
**charter** documents, **dimensions**, **access** model and **vocabulary**; the **prototypes** a
person walks; the **capabilities** engineering offers in answer to the machinery; the **notes**
people file and the **steers** a project has learned. [`GLOSSARY.md`](./GLOSSARY.md) defines
each one and what it refuses.

### Why an exchange, and why exactly eight slots

The unit of truth is **one ask with exactly one answer**, because that is the unit a person can
read in one sitting and agree to in one act.

⛔ **The eight are all required, and the count is the point.** A real corpus came out **111
claims about screens against 58 about the machinery underneath**, and the cause was the
framework's rather than the author's: a screen-shaped thing had a route, a component and a
screen to walk, and the machinery had none of those. A required skeleton identical on both sides
is the only fix that works at the type level rather than by nagging — **you cannot be thin here
without a blank cell showing it.**

That blank is the whole of *"its incompleteness is countable"*. A grid over a feature says, per
ask, which of the eight are stated, which are unsettled, which are deliberately latitude, and
which are **holes nobody has thought about**. Tenet 2's corollary stops being a feeling and
becomes arithmetic.

⛔ **The eighth slot exists because its absence let a product's whole reason for existing be
deleted with zero findings.** `answer` asks what the asker *gets*. Nothing asked what the ask
*left behind*, so the state change lived as a clause inside `answer` prose — and deleting *"the
amount is added to what the kid has"* from a pocket-money corpus produced gate output
**byte-identical** to the original. The money moving vanished from the truth and every surface
said the corpus was fine. `after` asks it directly.

### Why a standing, and not a field per complaint

The disposition of a slot is **one enum whose values demand their own companions**: an `open`
slot owes a question, an owner and a blocks list; a `disputed` one owes what it collides with
and why; a deliberate refusal to answer owes a reason, an owner and a date.

⛔ **It replaced ten fields that had accumulated one per complaint** — `question`, `asked_of`,
`blocks`, `same_as`, `ambiguous`, `contradicts`, `contested` and the rest. An architect
reviewing that shape warned that a framework growing a field per complaint becomes a form nobody
fills in honestly, and it was right.

**Two things are true of a standing wherever it hangs**, and that is load-bearing. It annotates
what a slot says rather than replacing it — so a slot can state what it does and still have one
thing nobody has ruled, named. And the contract is enforced at every grain a standing can appear
at: a slot, a single named refusal inside it, a rule. Writing those guards per site is exactly
how a named refusal once ended up with none of them, and *"a settled standing with an unruled
residual beside it"* — the state the model exists to prevent — passed clean one grain down.

⛔ **Latitude is priced.** Declaring something deliberately unanswered counts as settled: it
leaves the queue, ungates the ask, and tells a builder *"this is yours"*. Rewriting four
standings as `because: n/a` once took a whole corpus to zero rulings owed and zero packet holes —
every hard question in it formally the builder's choice, in four words. So it now costs more than
an honest open question does: a deliberate absence is a **stronger** claim than admitting you do
not know, and it must not be cheaper to write than one.

⛔ **And a question a person cannot act on is a decoration, not a queue item.** So an open slot
carries **drafted candidates**: each a sentence the slot could say, with — required — what
follows if it is the answer. The AI drafts from the code and the corpus; the human picks. That
is the same division the analyzer has always had, and it turns deciding into choosing rather
than composing.

### Why rules

A sentence whose subject is a **class** of asks is not the same artifact as a sentence about one.
*"Only a parent may change what a kid has"* was once four separate open questions on four asks,
each phrased differently, where answering any one left the other three open.

⛔ **The mode is required and has no default.** A rule either **supplies** the answer where an
ask is silent, or **constrains** whatever the ask says — and collapsing those makes the most
valuable rules inert, because *"every control shows work in flight"* read as `supplies` only
answers asks that forgot to write an answer, which is close to none of them. Guessing wrong is
invisible in both directions: a supplying rule read as constraining bolts an unrelated
requirement onto stated answers, and a constraining rule read as supplying governs nothing while
still appearing in the list as though it did.

⛔ **The selector language is closed, and closed is the feature.** Eight ANDed dimensions, no
union, no negation, no expressions. The moment a selector can express anything it becomes a
query language nobody can invert — and the gate has to invert it to report a rule that governs
nothing, which is the precise failure of a "principle" that carried no criteria and reached
nothing.

⛔ **A rule owes a demonstration.** That is the whole difference between this and a principle.

⛔ **And a rule can itself be the open question**, which is the highest-leverage question a
corpus can hold: one ruling settles every ask the selector reaches. While it stands open the
rule governs **nothing**, so every slot it would have filled reads as the blank it actually is.

### Why two hashes

What a person agreed to is hashed in two halves: **what it says**, and **what demonstrates it.**

⛔ **Where the cases lived inside the stamped unit, accepting a claim silently blessed every case
attached to it** — including ones nobody read, and including ones added afterwards. Two hashes is
the one mechanical change that makes *"a case added after acceptance is not reviewed"* true
rather than aspirational.

It also makes staleness answerable in the terms a reviewer needs. An acceptance reads back as
**accepted**, **claim-changed**, **criteria-changed**, **both-changed**, or **never** — and the
first stale message deliberately does not say *"a sentence is no longer here"*, because a rule
**arriving or leaving** breaks the stamp with no sentence changed anywhere.

⛔ **A stamp is never revived by a reword**, and must not be: that would be a person's consent
attached to words they never read. What is kept instead is **the exact text that was hashed**, so
re-confirming is one glance at a diff rather than an argument reconstructed from memory — and so
a generator can be stopped *before* it rewords something somebody agreed to.

⛔ **A criterion nobody derived is hashed; one a machine worked out is not.** Otherwise a role
re-deriving test specs would invalidate every acceptance in a corpus at once, and a person cannot
have agreed to words they never saw.

### Why a verdict carries its provenance

**Agents propose; only humans validate.** The mechanism that enforces it has changed, and the
change is worth understanding.

A boundary test used to fail the build if **any** agent tool could perform an act at all. That
boundary was deliberately opened, because a person answering in conversation or pressing a button
on a published page is a real press and losing it would be worse than carrying it. So *"a model
cannot produce a verdict"* no longer holds, and what takes its place is stronger in the way that
matters:

- **Every act records which surface it came through** — `page`, `question`, `chat`, `cli`,
  `agent` — required, never defaulted, because a default would let the weakest provenance
  silently wear the strongest name.
- **`via: agent` is structurally incapable of satisfying a gate.** Software may land a default so
  a reviewer has something to disagree with rather than a blank, and it is filtered out at the one
  place every gate asks whether a thing is accepted. One field could otherwise make the first
  tenet void.
- **A relayed press names its courier.** Present means a person really did agree and this
  instance has somebody's word for it; absent means the instance issued the session that pressed.

So a corpus can be read for the **quality** of its validation and not only for its presence.

### Why the stage is derived

Three stages: **specification → ready for review → ready for build.** Peter: *"ready for review
is when the builders get involved… design and product have signed off, more or less."*

⛔ **No field holds this, deliberately.** Each stage is already a fact about the stamps: whether
anything is unanswered, whether anybody agreed, whether a builder read it through and said it was
buildable. A stage field beside those is a second record of one fact, and the stored one wins —
because it is the one a page prints, until it is wrong and nothing detects it.

⛔ **And it cannot be set ahead of the work.** A stored stage lets a feature be marked ready for
build while questions are open, which is the failure the two tenets exist to prevent wearing a
status field. **The stage is a report on consent, not a substitute for it.** A read-through that
says *not buildable* returns the feature to the first stage with the blockers named — not a
fourth stage, the first one re-entered for a reason somebody can read.

The same reasoning governs **confidence**: how well-supported a statement is, derived from the
observations bearing on it and never stored. A stored confidence is a number that was true when
it was written and unfalsifiable afterwards. And it has **two zones, not one axis** — the support
tiers are all *below the line*, and `confirmed` is a separate field of a different type that no
amount of support can produce. A scale whose top is reachable without a person is worse than no
scale.

---

## The two authoring rules

### Observability — does this belong at all?

> A detail belongs in truth **iff someone the product makes a promise to can distinguish two
> implementations that differ only in that detail.**
>
> When it qualifies, state **the observation, never the mechanism.**

**Promisees:** the person who asks, whatever hands machinery its input, an external integrator.
**Not** engineers with logs, dashboards, traces or database access — engineering visibility is
not product observability. *Exception:* a customer-facing audit log or status page **is** a
promise surface.

**The procedure:** name the detail → imagine two implementations differing only in it → can any
promisee tell them apart? → yes: state what is *observed*; no: cut it.

Worked against an async pipeline (upload → classify → extract):

| Detail | Distinguishable? | Verdict |
| --- | --- | --- |
| Classification runs before extraction | No | ❌ Cut |
| The type appears before the fields do | Yes | ✅ *"The type appears as soon as it's known, before fields are ready"* |
| Internal retry on low confidence | No | ❌ Cut |
| A user's correction survives re-extraction | Yes | ✅ Include |
| Runs on a queue vs. inline | No | ❌ Cut |

Row 2 is the one to internalise: the claim is *"the type appears before the fields"* — **not**
*"classification runs first."* Same fact; only one survives a rewrite.

**Async workflows need no new concept.** The machinery half of a long-running pipeline is asks
the system makes of itself, each saying what hands it its input and what it leads to; the
async-ness is truth wherever it surfaces — pending states, partial results, failures, whether
work continues after navigation. Orchestration stays out.

### Non-redundancy — where does it live?

> **Every fact has exactly one home. Other places reference it; nothing restates it.**

Not elegance — **the primary lever on review burden.** If nothing is restated, reviewing a
feature means reading only what is genuinely new, so review cost tracks *new information* rather
than corpus size.

This is also the rule that most of the model's awkward-looking fields exist to serve, and the
pattern is always the same: **when something true has nowhere to live, add the field — never
write it as prose.** Each of these started as a prose workaround and became schema because the
duplication was measured:

| The true thing | Was written as | Is now |
|---|---|---|
| this feature has no screen of its own | a clause inside the `may` sentence of **all eight** asks | one stated reason |
| two slots rest on one product-wide principle | the principle's substance, restated in both | a citation |
| who may ask, in terms the product shares | prose naming a role without naming it, retyped per ask | an enumerable access model beside the sentence |
| what sets this machinery off | smuggled into `with:` — *"and the day it falls due"* | what hands it its input, and what it follows |
| a question about a whole class of asks | the same question on four asks, phrased four ways | one rule with an open standing |

⛔ **And where a fact is genuinely two different questions, two renders of one source is not
duplication.** A feature page answering *what must I not assume here* and an area page answering
*what is undecided in this area* are projections. Two hand-maintained lists of the same fact are
not.

---

## What a person supplies, and nothing computes

Every signal derived from a corpus is derived from its **shape**. Shape is not what goes wrong.

A fresh reader handed a corpus that satisfied every check found sixteen problems on one page, on
which the tool had logged thirty-two findings — **none of which was any of the sixteen**. Their
conclusion: *"The checks that exist are checks of form. Everything that would produce wrong
software here is a matter of agreement between two sentences, and nothing checks that."*

So the acts that matter most are the ones a person performs:

| | Says | Recorded as |
|---|---|---|
| **accept** | I read this whole ask and agree to it | the stamp every gate asks about |
| **rule** | the answer is this, and here is the argument | the sentence a builder implements |
| **read** | I read this feature end to end and could / could not build from it | the only thing that reaches *ready for build* |
| **defer** | I looked, I understood, and now is not when this gets answered | still unsettled, still gated — only the asking stops |
| **waive** | this is deliberately not answered here | latitude, priced, owned and dated |

⛔ **A question that reaches nobody is worth nothing**, which is why an open slot owes an owner
and why a deferral owes *what brings it back*. A person who cannot clear an item learns to stop
reading the list, and then the items that do need them are buried behind the ones that never
will.

---

## The roles

Work is done by roles, and **the division between writing and judging is structural rather than
instructed.**

**Eight authors** write truth: the surveyor partitions the product, the scoper writes what one
feature promises, the machinist writes the half nobody presses, the instrumenter writes what gets
recorded, the demonstrator works out what would have to be demonstrated, the decomposer works out
which parts of the system a promise needs, the designer draws a screen no code renders, the
evidencer maps what already demonstrates each claim.

**Thirteen judges** ask one question each about the whole system and **write nothing** — four of
them exist because of failures in this repository that no file-scoped review could have seen.

⛔ **An author cannot ask the person a question and a judge cannot be given a writing tool**,
because each role's tools are derived from the capabilities it declares and no capability a judge
can declare maps to a writing tool. ⛔ **No role names a model**: that is the project's choice,
per role.

⛔ **The session is the only orchestrator and the only asker.** Routes are a documented sequence
rather than an enforced one, which keeps every question to a person in one place — and the cost
is said rather than hidden: stage gates are advisory, and nothing enforces route order.

⛔ **You cannot review your own explanations.** By the time you have written a corpus you know
what it meant to say, so your reading of it is worth nothing as evidence that it communicates.
The only useful reader is one who has never seen ProductOS — which is why one judge is handed a
URL and told to build from it, with an explicit prohibition on reading these documents, the
skills or the source. **Never explain ProductOS to one.** A reviewer who has been told what
something is can no longer detect that the page failed to tell them.

---

## Storage

**The database is the authority. A markdown corpus is an export.**

Truth lives in a hosted service; export produces the same corpus on demand, which preserves the
portability promise — *remove ProductOS and you keep your truth* — without making a repository
the authoring surface. This matters beyond convenience: **a product is not a repository.** One
product often spans several, and truth is a property of the product.

A corpus carries **what the product looks like** with it. A drawing is written in the
application's own class names, so it needs the application's own stylesheet or it is a drawing of
some other product — and a hosted instance has no checkout anywhere near it. The stylesheet is
snapshotted into the corpus with a fingerprint of what it was taken from, so a stale snapshot can
be **caught** rather than merely suspected. ⛔ One source at render time for both local and
hosted: a renderer that read disk where it could and the corpus where it could not would be two
products that look the same until somebody publishes one.

Agents reach truth over MCP, and a published page is a review surface a person can use with no
checkout at all.

---

## ⛔ Two models are live, and what else is in this repository

**This document describes the Exchange model.** An older model is still reachable, and a reader
of this repository will meet it:

- **The retiring commands and tools.** The agent surface registers both vocabularies side by
  side. The registry marks which belong to the track that is no longer where the work is; the
  older ones speak *container*, *behavior*, *test case*, *surface* and *element*, and
  [`GLOSSARY.md`](./GLOSSARY.md) deliberately defines none of those words.
- **`service/` is the retired hosted store, and it is still deployed.** It models the older
  schema and cannot read an Exchange corpus at all. It is not deleted because it is serving
  traffic: deleting the source for something live is not a tidy-up, so whether it is torn down —
  and what happens to anything in its database — is **Peter's call**. Its own notice is currently
  the only thing stopping somebody extending it.
- **`backend/` is not ProductOS.** It is the **Family Wallet** demo's API — the dogfooding app in
  `demo/`, mirrored as a REST surface so that app can run either fully local or backend-driven.
  Nothing in ProductOS depends on it. It lives here because the demo does, and moving it out is a
  question somebody should answer deliberately rather than a cleanup.

⛔ **The cost of leaving the older model undocumented-but-reachable is paid by every agent that
orients itself from these documents**, which is the whole premise: many instances connecting and
working out what is true from what they read. If you are deciding what to believe, believe the
Exchange model, and treat an undefined word as a signal that you have found the retired one.

---

## What ProductOS is not

- **Not an agent, IDE, or coding assistant.** It makes the runtime you already use smarter.
- **Not implementation.** No services, queues, schemas, or interface contracts — ever. When an
  agent builds the wrong thing, the fix is a **more precise claim**, never technical detail.
- **Not a wiki.** Structured, owned, and dated by construction.
- **Not a ticket tracker or roadmap tool.** Those consume the graph.
- **Not self-validating.** Agents propose; humans validate. Without that, the graph is an agent
  gaslighting itself.
