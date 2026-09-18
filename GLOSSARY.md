# Glossary

**The definition of every ProductOS term.** One entry per term, each saying what it is
and — more usefully — **what it refuses**.

A category that never refuses anything is not a category, so most entries spend more
words on what a term **excludes** than on what it covers. When any other document
disagrees with this one, **this one wins** — fix the other place.

**Definitions only.** [`OVERVIEW.md`](./OVERVIEW.md) introduces the model;
[`EXAMPLE.md`](./EXAMPLE.md) shows it as real files.

---

## Product truth

The human-validated record of what a product does. The artifact ProductOS exists to
produce, held as `productos/products/**` plus `productos/capabilities/**` plus
`productos/context/**`.

**Never** implementation. No services, queues, schemas, endpoints or file layouts, at
any altitude, ever. When an agent builds the wrong thing the fix is a more precise
*product* claim, never technical detail.

## Container

Anything that holds behaviors: a **feature** or a **capability**. Used when the
distinction doesn't matter. Not a word that appears in authored truth — it's for talking
about the model.

## Feature area

A grouping of features, one directory under a product. A product concern like `pricing`
or `onboarding`. Often just "area".

**Areas nest, to any depth.** `cre/pricing/agency/` is an area inside an area; so is
anything below it. Depth is a property of the product — products vary enormously in
complexity and a fixed two levels forces the extra joints into names
(`deal-pricing-agency`) or into one unreadable bag.

What bounds it is **size, not depth**: an area targets 2–8 features
(`grouping:` in `productos/config.yaml`), and `productos check` names the specific
edit when one drifts — the clusters that want to become sub-areas, the level that
separates nothing, the feature that has become two. Move things with
`productos move`, never by hand: an id **is** a path, so a manual `mv` strands every
edge pointing at the old one.

**Never** holds capabilities. Its counterpart on the other tree is a **capability
system** — same shape, different decomposition.

| | Product tree | System tree |
|---|---|---|
| grouping | **feature area** — `products/billing/pricing/`, nesting freely | **capability system** — `capabilities/user-account-manager/`, one level |
| container | **feature** — `invite-teammate.md` | **capability** — `invite-user.md` |
| contents | behaviors | behaviors |

An area is a **product concern**; a capability system is a **subsystem** —
engineering's cut of the system. A capability system is never inside an area, because a
subsystem serves many of them.

## Feature

What the user gets. **Triggered by a user action**, has one or more surfaces, and is
promised to the user. Lives at `productos/products/<product>/<area…>/<slug>.md` — one
product, then at least one area, nested as deep as that product needs. Its **id is that
path**, which is why re-filing is `productos move` and never `mv`.

**A screen you cannot find in the code is still a feature.** An add-in, a task pane, a
mobile app, an emailed view, or a screen nobody has scoped yet all look like "has no UI"
from inside one repo. Classify by *what triggers it*, never by whether you located the
component.

## Capability system

A **subsystem**, and the grouping level on the system tree — one directory under
`productos/capabilities/`. `user-account-manager`, `email-delivery`,
`document-classifier`.

It is **engineering's decomposition of the system**, which is what earns every rule that
follows from it at once — none needing separate justification:

- it lives **outside product areas**, because a subsystem serves many of them;
- it has **no screens**, because a subsystem has no UI;
- **engineering is the party that keeps it**, while product owns what it promises.

Congruent to a **feature area**: an area groups features, a capability system groups
capabilities. [`EXAMPLE.md`](./EXAMPLE.md) level 2 shows both trees on disk.

**Granularity: one system per component, and every capability it offers lives in it.**
Inviting, re-roling and deactivating all belong to the account manager — the same
component answering at different moments. Splitting by operation shreds an interface
into fragments nobody can read as a whole.

**Never** named for a product concern. `invitations` is a topic; `user-account-manager`
is a component. If the name describes *what the product does* rather than *what part of
the system this is*, it is probably a feature area.

## Capability

**One thing a subsystem promises**, as an interface. A container on the system tree:
`productos/capabilities/<system>/<slug>.md`, with its own behaviors.

`invite-user` on `user-account-manager` is a capability. Its behaviors are what a
consumer may rely on when it is called: *"inviting an address at a role puts that person
in the system as invited, and they stay invited until they accept or the invite is
withdrawn"*, *"at most one invite is outstanding per address"*.

**Triggered by an input from elsewhere in the product**, never by a person. Promised to
the containers that depend on it.

**Never:**

- **mechanism.** *"Invites live in a table with a partial unique index"* is
  engineering's and never appears. The system is *named for* a subsystem; the claims are
  its promises. "Not a subsystem" is a rule about **claims**, not about grouping —
  reading it the other way produces capabilities grouped by topic.
- **a screen.** A behavior that can only be demonstrated by opening a screen belongs to
  the feature that owns that screen. An add-in, a task pane, a mobile view and a screen
  nobody has scoped yet all look alike from inside one codebase — and all are features.
- **a person acting.** *"The user chooses which source to apply"* is a feature. A
  capability is handed an input by another container.
- **called a "promise."** See **promise** — every behavior is a promise to somebody, so
  the word cannot name a subset of them.
- **framing.** If nothing consumes it, it is not a capability — it is context. Prose
  explaining what a thing *is* belongs in an area overview, a glossary term, a principle
  or a non-goal, never in a container invented to hold it.

**The feature and the capability often share words at different altitudes.** The feature
**invite teammate** calls the capability **invite user** on the **user-account-manager**
system. The feature is the whole user-facing thing — the screen, what it refuses, what
the admin is told. The capability is what the system guarantees when asked.

## Surface · UX view

A screen, page, modal, drawer or section a feature presents. Declared in a feature's
`ux:` list with an ASCII `sketch` and named `elements`. "UX view" is the field name;
"surface" is the older word for the same thing and still appears on `Behavior.surface`.

**Only features have them.**

⛔ **A claim outranks a sketch, always.** When the drawing and a behavior disagree, the
behavior is right. A sketch is ASCII: it cannot carry a condition, an exception or a
state, so a glyph is a hint and never a specification. Two reviewers hit this three times
each — six tabs drawn where the prose said eight, a padlock on the one band the feature
exists to let you edit — and an engineer building from the mock ships the wrong thing
while believing they followed the spec.

### Stub

A surface declared but never walked: `stub: true`. Needs no sketch and no elements,
behaviors may anchor to it, and it makes its feature **not ready to build** — an
un-walked screen has unknown behavior.

**A behavior on a `planned` surface is intent, not observation.** Product truth is
written in the present tense throughout, so the grammar cannot show the difference — the
surface says it once for everything beneath it. There is no separate field and no tense
change; without this, ProductOS refused something it also demanded, telling an author to
record what an unbuilt screen must do while offering nowhere to put it.

A surface also carries its own **`status`**, defaulting to its feature's. Without it, a
feature stamped `built` containing three unbuilt screens told a reader the opposite of
the truth, and the only machine-readable trace was an audit finding — the absence of a
screen classified as a documentation defect.

Exists so an unscoped screen has a *home*. Without it, behaviors about a screen you
haven't scoped are homeless and get filed on whatever container is nearest.

**Never** a shortcut for "I didn't feel like sketching." The test is whether you walked
the screen.

### Runtime

Where a surface runs when it isn't the app the code lives in — `Excel add-in`,
`iOS app`, `email`. Recorded because "no component in this repo" is the most common
reason a screen gets misfiled as a capability.

## Element

A named, meaningful part of a surface — button, input, card, row, panel, toggle.
`leads_to` on an element declares navigation and builds the flow graph.

`leads_to` is **required** on navigation elements and **forbidden** on in-place actions
(submit, delete, stepper, toggle). No middle ground.

## Behavior

**The atom.** One falsifiable claim about what the product does. Everything verifiable
hangs here: test cases, validation, drift.

Lives on features and capabilities. **Anchors** to a surface + element when a user
action triggers it; anchors to nothing when it is a rule or invariant. Surfaces never
own behaviors — a behavior belongs to whatever *triggers* it.

### Claim

The one falsifiable sentence. Present tense, product language, specific enough that two
people would write the same test from it.

**Never** implementation language — the claim linter refuses paths, HTTP verbs, status
codes, SQL, code identifiers, table and column names.

### Undecided behavior

A behavior carrying a `question:` and **no claim** — we know it exists and have not
decided what it says. Renders as **undecided**.

> Called an *undecided behavior* in earlier drafts. Renamed because a fresh reader read
> it as a JavaScript `undefined` leaking into the page — the language already owns that
> word for "bug", which is the opposite of "we asked and nobody answered."

A behavior has a claim **or** a question, never both and never neither. If a claim is
decided but an edge is still open, that edge is its *own* undecided behavior with its
own id. Answering fills in `claim` on the same stable id, so
undecided -> awaiting review -> accepted happens on one id.

Carries no test cases: there is no claim to demonstrate.

Three fields turn a recorded question into a chaseable one, and all three are refused as
prose:

| Field | Says | Why it is not prose |
|---|---|---|
| `asked_of` | who owes the answer | `notes: Settled by product.` cannot be listed, counted or chased |
| `asked_at` | when it was raised | a question with no age looks equally fresh forever |
| `blocks` | what cannot be built until it is answered | **`[]` is a real answer** — "the rest can ship without it" is what lets a reader proceed; *absent* means nobody worked it out |
| `same_as` | other questions that are this same hole | three copies of one question get three inconsistent answers; see **Same question** |

### Decision on a behavior

Answering an undecided behavior, recorded where the question was asked: `answers` keeps
the question verbatim, with `decided_by`, `decided_at` and `because`.

**Only a person does this** — `productos decide`, which refuses a behavior that already
carries a claim. Re-deciding a settled claim would fabricate a decision record for a
question nobody asked.

**The question is kept, never deleted.** A claim that settled a real disagreement
otherwise reads identically to one nobody ever doubted, so the next reader cannot tell
that this sentence is a resolution — or ask the person who resolved it.

**Deciding is not accepting.** What the product does, and whether a written claim says
what the team meant, are two acts by possibly two people. A newly decided claim is
*awaiting review*.

## `holds_for`

The scope a claim is asserted over, when it is **not** the whole product:
`holds_for: the Colliers template`. Absent means universal.

**Usually the wrong fix, and reaching for it first is the trap.** If the claim states
*values* that vary by customer, those values are that customer's **data** and belong
nowhere in product truth — the claim is the *rule* about them. Use `holds_for` when the
rule itself is narrower than the product: a guarantee that genuinely only applies to one
integration, one plan tier, one region.

It exists because one page stated a lender's accepted-value ladder in the same
grammatical form as the product's invariants, and *"two engineers reading it today
answer differently, and both pass every existing test."* `productos check` flags a claim
carrying three or more specific decimals with no scope, because that shape is almost
always configuration pinned into a claim.

## Test case

A numbered given/when/then that demonstrates a claim, at `unit`, `integration`, `api` or
`e2e`.

**The spec, not a test.** ProductOS does not generate tests; the implementer writes them
and these say what they must demonstrate.

An `e2e` case means the claim needs a screen — which is why one on a capability is
refused.

### Same question

Two or more undecided behaviors that are **one hole wearing several hats**: `same_as`,
declared on any one member and rendered on all.

It exists because three features each carried a question about authorization and nothing
could say they were one question. *"Answer it once and all three close; answer it three
times and you get three inconsistent checks."* Grouped by union-find, so a chain of
declarations surfaces as one group rather than a set of pairs.

One decision closes the group. Answered separately they become that many inconsistent
answers, which is worse than that many open questions.

## Ambiguous

A behavior whose claim is **decided and underdetermined** — two competent readers would
build different things from the same sentence. Carries `ambiguous:` with at least two
`readings` and, ideally, what it costs to guess wrong.

**Not contested**, which says the claim is false. **Not a question**, which says nothing
is decided. This says the sentence is true and does not pin the build — the state in
which two engineers ship different products and both pass every test case.

**At least two readings, always.** "This is vague" is not a finding; "it could mean X or
Y" is one somebody can rule on, and the tool refuses fewer than two.

**A reader may add it** — `productos ask ambiguous`. The person who finds an ambiguity is
by definition not the person who wrote it unambiguously in their own head. Blocks
ready-to-build, above *awaiting review*.

## Read-through

Somebody recording that they read a container end to end and whether they could hand it
to an engineer: `productos read <container> --buildable | --blocked`.

**`by:` says who, honestly.** An uninformed fresh-eyes review — including an agent's — is
worth recording and is often the only reader available at volume; it is the one thing that
catches a disagreement between two sentences. But it is not a person, and the field must
not imply one: name it as an agent. **Never for the author** — you wrote the page and
cannot be surprised by it.

**The only signal on a page that nothing can compute.** Everything else — audit findings,
readiness, conformance — is derived from the corpus's shape, and shape is not the thing
that goes wrong. A corpus can satisfy every check, read well, and still contain a
disagreement between two sentences that makes a feature unbuildable.

A page with no read-through says so. A blocked one with no reason is refused, and a
blocked one **blocks ready-to-build** — everything else in readiness is derived from
shape, and shape is not what goes wrong.

## Suspected dependency

An edge a **reader** believes exists that the page's owner has not declared:
`suspected_depends_on`, with a required `because`.

`depends_on` is authored on the page by whoever owns it, so a wrong impact count could
not be corrected in place — and a wrong count is worse than none, because it gets scoped
off. A suspected edge renders dashed on both sides and makes the count a range
(*"changes 1–3 containers — 1 declared, 2 suspected"*). It resolves two ways: the owner
promotes it to `depends_on`, or removes it.

## Context

The layer above containers: **goals · principles · personas · non-goals · voice ·
glossary · decisions**. Read first — a proposal contradicting a principle or a non-goal
is wrong before it is evaluated against anything else.

Two scopes, two namespaces, **not** an override chain:

| Scope | Lives at | Cited as |
|---|---|---|
| Product-wide | `productos/context/<doc>.md` | `principles#report-never-block` |
| One product | `productos/products/<product>/context/<doc>.md` | `cre/glossary#option` |

A global and an area entry sharing a name are two *different* rules. Principles and
glossary are the common area-scoped kinds.

### Glossary (a user's)

Term → one line of what it means **in that product**. Keeps vocabulary consistent so
nobody invents a synonym.

**Never an entity model.** *"A kid is a dependent tracked in a family"* belongs;
*"a kid has an id, a name and a colour"* is a data model.

### Decision

A fork settled deliberately, **with what else was considered**. Prevents an agent
finding no handling for a case, calling it a gap, and reintroducing what was removed on
purpose.

**Carries no validation state** — a decision isn't falsifiable. It carries **currency**:
`active` → `under-review` → `superseded`, with `revisit_after` and a `reaffirmed`
history. The record is immutable; the ruling is not.

### Citation (`cites`)

A behavior's structured reference to a context section. Structured rather than prose so
the reverse view works: *which behaviors rest on this rule*, and therefore whether an
unaccepted rule is load-bearing.

A behavior citing an unaccepted section is **not ready to build** — it defers to a rule
an agent may have written.

## `depends_on` vs `affected_by`

Two different edges, routinely confused, and confusing them asserts something false.

| Edge | Means |
|---|---|
| `depends_on` | I am built on this capability's interface and break if it changes |
| `affected_by` | Another feature's **user-facing trigger** mutates my state |

`affected_by` renders as *"Affected by:"*. Using it for a dependency tells a reader the
capability's triggers mutate this feature, which is not true. `depends_on` points at
capabilities; wanting to depend on a feature means the edge is really `affected_by`, or
the shared part is an unnamed capability.

## Validation

A human accepting a claim. **The trust anchor**: agents propose, only humans validate,
and there is no tool a model can call to mark something true.

**Not the same act as deciding.** `productos decide` settles *what the product does*;
validation confirms *that a written claim says what the team meant*. Collapsing them
would let one command both write a claim and bless it.

The question a human is asked is **"is this what we intend?"** — never *"is this true?"*
Truth about reality comes from signals; intent comes from a person. Blurring them is
what makes review expensive.

Applies per behavior and **per `##` context section** — per-file would bless fifteen
principles with one click.

Editing what was accepted drops the acceptance: a claim edit clears its stamp, and a
context section carries a hash of the text the stamp covered.

## Readiness

Whether there is enough here to properly build something. **A gate with enumerated
blockers, never a score** — a percentage invites building at 73%, which is exactly where
an agent invents the rest.

Two axes that must not be collapsed:

| | Question | Matters |
|---|---|---|
| **Ready to build** | Every claim decided, human-accepted, with acceptance criteria, nothing unresolved | Before code |
| **Ready to trust** | Evidence backs the claims — test runs or coverage refs, no open drift | After code |

A `planned` feature with no code can be fully ready to build. So `orphan`
(accepted, no evidence yet) does **not** block ready-to-build.

Blockers, ordered by distance from buildable: `contradiction` → `ambiguous` →
`undecided` → `contested` → `awaiting review` → `no acceptance criteria` →
`unaccepted context` → `unscoped surface`.

⛔ **Readiness is computed from shape, and shape is not what goes wrong.** A container
can clear every blocker above and still be unbuildable, because the failure that
actually costs money is a disagreement between two sentences — which nothing computes. A
**read-through** is the only signal that catches it, and it is the one thing on a page
that a person has to supply.

## Packet

The handoff artifact: goal · applicable context · decisions already made · promises it
can rely on · what must not regress · acceptance criteria · open questions · latitude.
Compiled on demand; nobody writes one.

**Deliberately contains no stack, patterns, file layout or architecture** — those come
from the repo. Anything not constrained is the agent's call.

## Promisee

**Who you owe an answer to.** A feature's promisee is the user. A capability's is the
container that calls it. A public API's is the integrator using it.

It matters because it decides what belongs in truth at all: a detail is truth only if
**some promisee could distinguish two implementations differing in it**. State what they
observe, never the mechanism that produces it.

**Engineers are not promisees.** Logs, dashboards, traces and database access are
engineering visibility, which is not product observability — with one exception: a
customer-facing audit log or status page *is* something the product promises, so what it
shows is truth.
