# Glossary

**The definition of every ProductOS term.** One entry per term, each saying what it is
and — more usefully — **what it refuses**.

A category that never refuses anything is not a category, so most entries spend more
words on what a term **excludes** than on what it covers. When any other document
disagrees with this one, **this one wins** — fix the other place.

**Definitions only.** [`OVERVIEW.md`](./OVERVIEW.md) introduces the model and argues why it
is shaped this way; [`EXAMPLE.md`](./EXAMPLE.md) shows it as real files.

> ⛔ **This describes the Exchange model, which is the model the code runs.** An older model —
> containers, behaviors, test cases, surfaces, elements — is still reachable through the
> commands and tools marked *retiring*, and nothing in it is defined here. If you meet a word
> in this repository that this file does not define, you have met the retired model. See
> **Retiring track**.

---

## Product truth

The human-validated record of what a product is **meant** to do. The artifact ProductOS
exists to produce.

⛔ **It is the TARGET STATE, always, and whether any of it is built is a different question.**
Truth is an input to building, not a report on what was built. A feature nobody has started
is as real here as one that shipped this morning; a screen in the corpus is the screen the
product *should* have, not a picture of a component that exists.

The codebase is one way to **populate** truth — the only cheap way to retrofit a product that
already exists — and never what truth is tied to. Comparing the target against what was built
is **drift**, which is downstream and separate: a deleted component is evidence about the
product, never proof the truth is wrong. Only a person deciding the target has changed makes
it wrong.

So **nothing in a corpus may require code to exist.** A check that refuses a screen for
naming no component is not a standard; it is the code made authoritative over the target,
which inverts what this artifact is for.

**Never** implementation. No services, queues, schemas, endpoints or storage layouts, at any
altitude, ever. When an agent builds the wrong thing the fix is a more precise *product*
claim, never technical detail.

## Corpus

One product's whole truth, as ProductOS holds it: its scopes, the org-wide rules, the
charter documents, the observations, and the log of human acts. A corpus is read by one
parser and every surface — the page, the gate, the packet, the agent tools — is a projection
of it.

**Never** a repository. One product often spans several, and truth is a property of the
product.

---

## Scope

**The only container, at every altitude.** A product, a grouping inside it, and one feature
are the same shape — a title, a filing (`in:`), a vocabulary, screens, and the asks a person
or the machinery can make.

| What it is | How you can tell |
|---|---|
| **the product** | nothing files it — no `in:` |
| **an area** | other scopes are filed inside it |
| **a feature** | it holds exchanges of its own |

**Scopes nest to any depth**, because depth is a property of the product. A fixed two levels
forces every real joint past the second into a name or into one unreadable bag.

⛔ **Filing is load-bearing, not decoration.** `in:` decides what a scope inherits: which
org-wide rules reach it, which words it may use, and what a reader is shown when they ask for
it. Deleting one filing silently changes what governs the asks beneath it.

⛔ **Filing does not decide what something IS.** Whether an ask is a person's or the
machinery's is `asked_by` on the **exchange**, where it is a fact rather than a filing
decision. Re-filing changes what a scope inherits, never what it is.

**Never** a path a reader is shown, and never re-filed by hand — a scope's id is what every
reference points at.

### `exists`

Whether this is **`intended`** (the product should have it, nothing yet does),
**`kept`** (it stands), or **`withdrawn`** (deliberately dropped, kept for history). Carried
by a scope, a screen and an exchange.

⛔ **Not a report on the code and never a licence for a hole.** `intended` says the target
state has not been built. It does not say the truth may be thin, and no check may ask an
author to set it in order to get target state accepted.

### Happy path

What a feature is **FOR**, agreed before any detail of it: what it `accomplishes`, what the
person `brings`, what it `ends_with`, the screens it runs `through` in order, and what is
deliberately `not` part of it.

⛔ **It gates.** A feature's behaviours are not offered for acceptance until its happy path
has been agreed to — stamping a detail of a purpose nobody has confirmed spends a reviewer on
a sentence that is about to change.

⛔ **Not a ninth slot.** A slot answers one question about one ask; this answers *what is this
feature for*, which is a question about the feature.

**Never the fields of the form.** *"a name for the deal, the borrower, and the property's
address"* is the entry form, listed — a second copy of the screen's own parts that goes wrong
the moment a field is added. *"the deal they want to create and where its model should live"*
is the altitude.

### Why · Risk · Measure · Instrument

The framing a PRD carries and a behaviour cannot. Each is a **list of cards**, never a
paragraph, because one of them is agreed to, reworded or dropped on its own.

| | Says | Refuses |
|---|---|---|
| **why** (a *reason*) | what is wrong **today** | a restatement of the feature. *"Users want X"* is not a reason for X |
| **risk** | what could go wrong, in terms somebody could later agree had happened, with `mitigated_by` where there is a plan | nothing — a risk nobody has a plan for is a real state, and a forced mitigation is a sentence invented to fill a field |
| **measure** | what would be true if this worked, in something observable, with a `target` where there is a defensible one | an invented number. An early feature often has none |
| **instrument** | what gets recorded, in product terms, and which measures it `feeds` | a column name or an event schema; and an instrument feeding nothing, which is telemetry somebody will maintain for nobody |

### Term

One word this product uses, and one line of what it means **here**. `closed: true` with
`members:` makes it a taxonomy.

**Never an entity model.** *"A kid is a dependent tracked in a family"* belongs; *"a kid has
an id, a name and a colour"* is a data model, which is implementation.

A term also records where its other half lives, because a question like *does anything in this
product set this word* has exactly four honest answers: a behaviour is missing, `set_outside` /
`read_outside` (something beyond this product's edge), `set_by` / `read_by` (a sibling feature
in this corpus), or the word is dead. ⛔ **`contested`** is the fifth state and not an answer:
two or more names in this corpus point at related-but-different things and nobody has ruled
which sense wins. It names the colliding words, and the question goes to a person.

### Dimension · `holds_for`

The ways a product varies — Role, Product line, signed-in versus not. **Declared once, on the
product**, reaching every feature in it.

`holds_for` says which combination a screen, a slot or a single statement is promised under.
⛔ **Unsaid means EVERYWHERE, never nowhere** — a sentence with no `holds_for` holds under
every combination, so a corpus written before dimensions existed says exactly what it said
before.

On a **slot** it means *this part of the exchange only exists there* — a refusal an auditor
never meets. On a **statement** it means *this sentence is promised there*. Writing the first
as a `holds_for` on every statement in the slot would be the same fact in N places.

**Never** declared by a feature. A feature with dimensions of its own is a second product
inside the first.

### Access — role · permission

**Who may, as a thing the product has**, rather than a sentence each feature writes again.
Each one says what holding it lets somebody do, and a **role** `holds` permissions.

It exists because *"anybody in the organization whose role lets them create deals here"* is
prose standing where a concept should be: it names a role without naming it, cannot be
checked, cannot be listed, and is retyped slightly differently on every exchange — so *what
can an underwriter reach* was unanswerable except by reading everything.

⛔ **Not every product has them**, and the product says which model it uses. Forcing the
concept everywhere is how a framework makes products describe themselves in its vocabulary.

**A permission holds nothing** — only a role is a bag of permissions.

---

## View

**A screen, and where an ask arrives.** Never what states it.

⛔ **A screen is not one picture.** Loading, empty, failed and full are the same screen in
different conditions, and a corpus holding only one of them makes every statement about the
others unjudgeable.

A view also says **which screen it appears inside** (`within`), because without that a product
is a pile of screens rather than a product: a workspace with four tabs is four screens shown
inside a fifth, which is the plainest fact about it and the one a person uses to find their
way.

### `shows`

Which of this scope's sentences the drawing actually demonstrates.

⛔ **Without it, a thin drawing is indistinguishable from a complete one.** A list that
asserts an unsized row shows a dash rather than a zero, that a load failure keeps the
previous page, and that a filtered list matching nothing says so — drawn as three full rows
and none of it — passed every check, because a screen either has a drawing or it does not and
this one did.

⛔ **It is a claim, not a proof.** Listing a reference says the author drew that state.
Nothing can verify from the drawing that the dash is really in it; what closes that gap is a
person or a reviewer looking at the product beside it, never a box somebody ticks.

### Part

A named, meaningful piece of a screen, in one of **five roles** — because with one `control`
role a text box, a Cancel link and a Record button were the same kind of thing, and a rule
about *things you press and wait for* governed the text box.

| Role | Is | Owes |
|---|---|---|
| **commits** | pressing it starts work the person waits on | the ask that arrives there |
| **entry** | takes what the person types or picks | nothing — what it accepts is the `with` of whatever `commits` reads it |
| **navigates** | goes somewhere else and changes nothing | where it goes, or `returns: true` for *back to this screen as it was* |
| **display** | shows something | an ask may arrive here: looking IS an ask, triggered by arriving rather than by pressing |
| **region** | groups other parts | nothing |

⛔ **An ask never arrives at `entry` or `navigates`.** Those two are fully described already,
and an exchange on them asks a person what a text box refuses.

`repeats:` says what one control appears once per — *"once per sortable column"* — because
five column headings doing the same thing are one ask and five controls, and a count goes
stale the moment a column is added.

### Condition · part state

What a **part** can be doing, as opposed to what the screen is doing. Peter: *"multiple
buttons could have LOADING States. MULTIPLE FIELDS COULD HAVE ERROR STATES."*

Six are built in — **busy · disabled · invalid · loading · empty · failed** — and the part's
role decides which are even possible: a button is never `empty`, a text box is never
`loading`.

⛔ **The vocabulary is open, not closed.** `locked`, `syncing`, `stale`, `pending approval`
are real conditions no list written here could have anticipated, so a condition is **a word
the product declares**, exactly as a term is. The honest cost, said rather than hidden: a
declared condition cannot be role-checked, because nothing knows whether `syncing` belongs on
a button or a region.

⛔ **A condition that reports a problem has to say what the person is told.** *"the borrower
field is invalid"* is not reviewable; *"Borrower is required"* is a product decision somebody
can accept or reword.

### State (of a screen)

One appearance of a screen: a label, and **what is different about each part while it holds** —
a part's condition, a part hidden, or different words in this state only.

⛔ **A set of changes, not a second picture.** One form's error state measured 96%
byte-identical to its default frame — 129 bytes of difference, one red line under one field —
stored as a complete copy. Two fields in error would be a third picture, two fields plus a
working button a fourth, and loading never arrives at all. Conditions compose; screenshots do
not.

**Never** a state with no picture and no conditions. That is a label, and there is nothing in
it to review.

### Prototype

**One way through the product, with its own front door and its own chrome.** A product has
several — an unauthenticated flow has no application menu at all, and two lending businesses
sharing a codebase are different products to the people using them.

Each one names where it `starts_at`, carries the drawn chrome and its menu, and says **its
answer on each axis the set splits on** (`is: { line: CRE, role: loan processor }`).

⛔ **The answer, not the name.** *"CRE — loan processor"* is a title somebody wrote for a
reader. Without the answers, nothing can say which prototypes cover private lending, that two
of five are the same combination, or — the most useful thing available — that a combination
**nothing covers** exists.

⛔ **The axis is never inferred.** A classifier reading two titles and guessing "role" is a
guess wearing a decision's clothes.

---

## Exchange

**One ask with exactly one answer** — and the unit a human accepts.

Every exchange says **who asks** it: a **person**, the **system** (machinery nobody presses),
or an **integrator**. That answer decides what it owes:

| `asked_by` | Owes | Refuses |
|---|---|---|
| **person** | the screen the ask arrives at, and which control on it | a `when:` — a person's ask arrives at a view |
| **system** · **integrator** | `when:` — what hands it its input, in product language, whether it repeats, and which asks it `follows` | an `at:` — machinery is handed an input from elsewhere |

⛔ **`asked_by` replaces the old promise-versus-subsystem judgement**, and it is a fact rather
than a filing decision. A system-asked exchange is machinery-shaped **product truth**, written
by a product author and agreed by a product person. What engineering offers in answer to it is
a **capability**.

⛔ **A person's ask arrives somewhere nameable.** `at` carries the screen, the control, and
**which state of it** — because a view with four states has controls that exist in exactly one
of them, and every sentence about folders was otherwise shown beside a screen with no folders
on it. Where the screen belongs to another feature, `view_in` names it: the guarantee is "the
ask arrives somewhere nameable", not "arrives in this file", and insisting on the latter pushed
real reader actions back into machinery.

⛔ **One control, one answer.** Two exchanges arriving at the same control is a refusal, and
naming no control at all is not the cheaper way out of it.

`reads` and `changes` name the **terms** this ask touches — which is how an org-wide rule can
say *every ask that CHANGES money* without also governing every ask that looks at it.

`finishes: true` says **this is the press that ends the feature**, and it is said, never
scored. Finishing was once derived by matching a control's words against the happy path's
outcome, and **Continue** was declared to complete a feature on a sentence whose own words are
*"Nothing has been created yet"* — it shared two nouns with the outcome, and every sentence in
a feature is about the same nouns.

### Slot

**The typed parts of an exchange, and the only place a sentence lives.** ⛔ **Eight, all
required, and the count is the point.**

| Slot | Asks | Short |
|---|---|---|
| **may** | who is permitted to ask | who may ask |
| **with** | what must be known to ask, in product language | what they bring |
| **answer** | what the asker gets | what they get |
| **after** | what is true afterwards that was not true before, whether or not the asker sees it | what is different afterwards |
| **refuses** | the named outcomes it can refuse with, each with when and what the asker is told | what it refuses |
| **fails** | what the asker is left with when it cannot do the thing | what a failure leaves them with |
| **again** | what happens when it is asked twice | asked twice |
| **at_once** | what happens when two askers arrive on one subject | two at once |

⛔ **A required skeleton identical on both sides is what makes thinness visible.** One real
corpus came out 111 claims about screens against 58 about the machinery underneath, and the
cause was the framework's: a screen-shaped thing had a route, a component and a screen to
walk, and the machinery had none of those. You cannot be thin here without a blank cell
showing it.

⛔ **`after` is the eighth, and its absence let a product's whole reason for existing be
deleted with zero findings.** `answer` asks what the asker *gets*; nothing asked what the ask
*left behind*, so the state change lived as a clause inside `answer` prose. Deleting *"the
amount is added to what the kid has"* from a pocket-money corpus produced a gate output
**byte-identical** to the original. The money moving — the entire point of the product —
vanished and every surface said the corpus was fine.

**Three answers that are not sentences**, and each is a real answer rather than an empty cell:

| | Legal on | Means |
|---|---|---|
| `none: true` | `refuses` · `after` · `again` | there is nothing to refuse / nothing is different afterwards / nothing further happens on a second press |
| `cannot_fail` | `fails` | it cannot fail |
| `outcomes` | `refuses` | the named ways it refuses |

⛔ **Each of those belongs to the slots it can answer and is refused everywhere else.** A
field that is meaningful on one slot and accepted on all eight gets written on the wrong one,
read by nothing, and looks correct. `none: true` on every slot once erased the blank-cell
mechanism the whole design is staked on: `0 blank`, a successful accept, and a packet handing
a builder a line per slot of *"nothing to refuse. Stated, not omitted."* under a human's
stamp.

⛔ **One slot, one answer.** A sentence beside a `cannot_fail`, or beside a deliberate refusal
to answer, is a slot saying two things, and a reader cannot tell which a builder should
implement.

`within:` carries a timing or quality the **asker can observe**. Anything only engineering
could notice is engineering's.

**Never** a `notes:` field. It answered no slot's question, so it had no honest content, and
it carried unsettled truth — *"How far back the history goes is not decided"* — through every
guard and into a packet as a bullet indented like an obligation.

### Statement

**One sentence of what a slot says, with an identity.** A slot that says several things keeps
them as several, each with its own id.

⛔ **The id is the point, and throwing it away made review impossible.** On a real corpus one
slot held thirteen statements — every rule about one lender's program settings — as a single
string, so a reviewer got thirteen claims and thirty-one criteria under one *"That is right"*,
with no way to say twelve are and one is not.

⛔ **Ids are stable**, because a stamp and a criterion point at them. Renaming one is a new
statement, and the old stamp stops covering anything.

**Never** a non-answer. `tbd`, `unclear`, `n/a`, `todo` and their spellings are refused
wherever a sentence can go: if nobody has decided, that is a **standing**, and it belongs
somewhere a person will be asked about it.

### Named refusal (a case)

One named way an ask is refused: a **name**, **when** it refuses, and what the asker is
**told** — in their words, never a code.

⛔ **The name is the address a ruling is delivered to.** Two cases with one name means only
the first is reachable, so the other can never be settled.

⛔ **A case carries its own standing**, because a slot settled in general can have one case
open. Without that, recording *"whether it also refuses an amount larger than the balance was
never ruled"* meant marking the whole slot unsettled — which silently dropped both settled
refusals from the packet while the criteria below went on demonstrating one of them.

⛔ **A case can never be `out_of_scope`.** It already states what the asker is told; declaring
it nobody's to answer contradicts itself.

---

## Standing

**The disposition of a slot** — one enum, and each value demands the companions that make it
actionable. It replaced ten fields that had accumulated one per complaint, which is how a
framework becomes a form nobody fills in honestly.

| Kind | Means | Requires |
|---|---|---|
| **stated** | somebody has said what this is | something said: a sentence, `none`, `cannot_fail`, or named cases |
| **open** | nobody has decided | `question`, `asked_of` (a question nobody owes stays open by default), `blocks`, and a `cost` once two answers are on the table |
| **disputed** | this cannot hold with another sentence | `targets` — the slot or slots it collides with — and `because` |
| **out_of_scope** | deliberately not answered here; this is the builder's latitude | `because` in at least 40 characters a reader can weigh, `answered_by`, `answered_at` |

⛔ **A standing ANNOTATES what a slot says; it does not replace it.** A slot can state what it
does and still have one thing nobody has ruled — so where an unsettled standing sits beside a
sentence, **`about`** is required and names which part is in question. Without it the whole
sentence reads unruled and every surface discards it. `of:` points at **which statement**,
where the slot says several.

⛔ **`out_of_scope` costs more than an honest `open`, deliberately.** It counts as settled: it
leaves the queue, ungates the exchange, and prints *"this is your latitude"* to a builder.
Rewriting four standings as `because: n/a` once took a corpus to zero rulings owed and zero
packet holes — every hard question in it formally the builder's choice, in four words.
Declaring something deliberately unanswered is a **stronger** claim than admitting you do not
know, and it must not be cheaper to write than one.

⛔ **`blocks: []` and an absent `blocks` are documented opposites.** `[]` means *the rest can
ship without this*; absent means nobody worked it out.

⛔ **Four kinds, not six.** `underdetermined` was `open` with strictly weaker companions, and
`proposed` was `open` with exactly one candidate. Two standings for one state meant two code
paths on every surface, and they drifted — one state's options could be picked and the other's
could not.

### Candidate

**A drafted answer, so deciding is choosing rather than composing.** Each one carries what it
`says` (or named `outcomes`, or `none`) and — required — its **`consequence`**: what follows
if this is the answer, what it forces, what it rules out. Two options with no stated
difference is not a choice.

The AI drafts these from the code and the corpus; **the human picks.** A question a person
cannot act on is not a queue item, it is a decoration — a page asking *"can both kids complete
the same task, or is it claimed by whoever presses first?"* with no way to tell what either
answer would cost is the state this exists to end.

⛔ **A candidate belongs to an `open` question and nowhere else.** On any other standing it
would be offered for picking and become the sentence a builder implements, with nothing having
asked whether it answers anything.

⛔ **Beside an `about`, a candidate says whether it `replaces` the whole sentence or only the
part in question.** A fragment picked as a whole answer deletes the rest of what was agreed —
which happened: an agreed sentence about money coming off a child's balance was destroyed by
the only exit the tool printed, and the packet then told a builder that spending is *"recorded
like any other"* and nowhere said the money comes off.

---

## Criterion

**What would have to be demonstrated for a claim to be believed**: a given / when / then (or
`steps`) filed against one slot, and against one statement where the slot says several.

**The spec, not a test.** ProductOS does not write tests; this says what a test must
demonstrate, at `unit`, `integration`, `api` or `e2e`.

⛔ **A criterion is not authored.** Peter: *"a product person doesn't write a criterion — what
even is this? this is old shit. the agents decide what kind of tests need to exist."*
Everything about `derived` follows from that: it names the role that worked it out, when, and
**the hash of the claim it was worked out against**.

That hash is the whole of keeping a derived set idempotent. Re-deriving over unchanged truth
produces the same set; a reworded sentence leaves exactly the requirements that came from it
pointing at a hash nothing matches. It is also what keeps a human's acceptance honest: an
acceptance hashes only the criteria **nobody derived**, so a machine rewriting test specs
cannot stale a person's stamp.

⛔ **Separately hashed from the claim, which is the point.** Where the cases lived inside the
stamped unit, accepting a claim silently blessed every case attached to it — including ones
nobody read, and including ones added afterwards.

⛔ **An absent `derived` means somebody typed it.** Reported, never refused: every corpus in
existence is full of authored criteria, and a refusal firing on all of them is one people
switch off.

**Two kinds.** An **instance** demonstrates one named exchange. A **conformance** criterion
demonstrates a rule across the class it governs — and an instance on a rule that governs a
class is refused, because instances cannot be written without an instance.

An `e2e` criterion means the claim needs a screen, which is why one on a system-asked exchange
is refused: if it needs a screen it belongs to whoever owns that screen.

### `example`

An escape hatch for a criterion legitimately naming an example value — **priced**, with a
reason, an owner and a date.

It was a bare boolean, and it was the cheapest sentence in the model: `then: rounded up to the
nearest dollar, held for twenty-four hours, charged through Stripe, an email receipt to both
parents, the record locked` passed with zero findings and printed five invented behaviours
under a human's stamp.

---

## Rule

**A sentence whose subject is a class of exchanges rather than one.** It says which slots it
`fills`, the class it governs, and — required, with no default — **how** it governs:

| Mode | Means |
|---|---|
| **supplies** | the rule IS the answer where the exchange is silent. A locally stated slot wins, because the narrower sentence is the more considered one |
| **constrains** | the rule adds a requirement to whatever the exchange says, and a stated slot does **not** escape it |

⛔ **Collapsing those two makes the most valuable rules inert.** *"Every control shows work in
flight"* read as `supplies` only answers exchanges that forgot to write an answer, which is
close to none of them — so the rule that survives the collapse is the trivial kind, and the
one you wanted org-wide is silently opted out of by every competent author.

⛔ **A rule can itself be an open question**, and it is the highest-leverage question a corpus
can hold: one ruling settles every exchange the selector reaches. While it stands open the
rule governs **nothing** — it is a question about a class, not an answer for one, so every slot
it would have filled reads as the blank it actually is.

⛔ **A rule that demonstrates nothing is an aspiration.** It owes a conformance criterion, and
the handover is refused without one. (Refused at handover rather than at load, because the
role that works out criteria runs *after* sign-off — as a load refusal it made the corpus
unreadable between two documented steps, including to the role whose job was to fix it.)

⛔ **A rule filling `refuses` names the cases.** Prose there fills the slot and tells a builder
nothing implementable: a grid reading `↑R3` with `0 blank`, silence from the gate, and a packet
promising *"it refuses in the same two named ways"* with the two ways nowhere in the corpus.

### Selector

**The closed language a rule's class is written in** — ANDed dimensions, no union, no
negation, no expressions.

`everywhere` · `under` a branch · `in` its home scope · `asked_by` · `tag` · `view_kind` ·
`part_role` · `term` · `acts_on: reads | changes` · `only` (named exchanges, each qualified).

⛔ **Closed is the feature.** The moment a selector can express anything, it becomes a query
language nobody can invert — and the gate has to invert it to report a rule that governs
nothing.

⛔ **A rule declares its reach: whose product, and whose ask.** Both halves were found missing
in one shipped corpus. A disconnected second product had its `fails` supplied by *"the person
is told it was not recorded"* — there is no person; a till asked. And an exchange handed over
by *the turn of the day* was told `may — Only a parent may change what a kid has`.

⛔ **`acts_on` exists because its absence manufactured false promises.** `term:` matched
`reads` and `changes` alike, so a rule about changing money also governed looking at it: *"a
second time records it once and tells the person it is already done"* became the `again` of
looking at a balance.

### `instead_of` · `defers_to` · `excepts` · `rests_on`

The four declarations a slot or an exchange can make about a rule, and the distinctions are
load-bearing.

| | Says | Costs |
|---|---|---|
| **`excepts`** | this exchange is exempt from that rule | a reason |
| **`instead_of`** | my own sentence displaces that rule here | a reason |
| **`defers_to`** | my own sentence is mine, and that rule still holds here | a reason |
| **`rests_on`** | this sentence follows from a charter section — a **citation** | nothing; it is resolved, never resolved *from* |

⛔ **`instead_of` exists because the quiet path was cheaper than the honest one.** Simply
stating the slot escaped a rule, demanded nothing, and rendered as an ordinary `✓` — so a
reviewer replaced *"Only a parent may change what a kid has"* with *"Anybody on the shared
device may record what a kid spent"*, on the exchange that takes money off a child, and the
only complaint was that the new sentence had nothing demonstrating it.

⛔ **`defers_to` exists because agreeing with a rule was unsayable.** With only a declaration
that a rule does *not* govern, an author whose sentence agreed with the rule — even restated it
verbatim — had to file a formal exemption from it. After three such rulings every money write
carried `⊗` and the idempotency rule governed no money write at all.

⛔ **`rests_on` is a citation and not a resolution.** A rule reaches in and changes what a slot
promises. A charter section settles a design argument and governs nothing mechanically, so
nothing derives a promise from it and nothing should.

---

## Charter

**The product-wide documents** — what the product is for and the arguments already settled
about it. Four kinds have no other home: **goals · principles · personas · voice**.

⛔ **Sections are named so they can be agreed to one at a time.** A reviewer accepts *"report,
never block"*, not *"the principles document"* — and a document-sized stamp goes stale on every
edit to any part of it, which is how a stamp stops meaning anything.

⛔ **Not a rule.** A rule supplies or constrains a named slot and owes a criterion; it is
checkable. A goal is what the product is for, and a principle settles a design argument without
being demonstrable on any one exchange. Filing them as rules demands demonstrations nobody can
write and then reads as governing slots they do not govern.

⛔ **The four are a reference, never a whitelist.** A project adding a document of its own
works, and nothing gates it. The list with teeth names what has a **better** home:

| Not a document | Where it goes |
|---|---|
| **non-goals** | a slot's `out_of_scope` standing with this as the reason, a named refusal, or the feature's `happy_path.not` — attached to what it constrains, where a reader meets it |
| **decisions** | a **verdict**, recorded by whoever decided, with their reason and what it replaced. In a document it carries no hash, so it reads as current forever after the thing it decided has moved |

---

## Capability · subsystem

**The parts of the system beneath the product, and roughly what each does.** Peter:
*"capabilities are like object oriented design. just designing the subsystems, roughly what
they do. that's it. they should be logically grouped into areas. they obviously nest, or cross
reference other areas."*

A **subsystem** groups capabilities and nests to any depth, exactly as a product scope does.
A **capability** is one thing it offers: what it `does`, and — required — what it `serves`.

⛔ **"Roughly what they do. That's it" is a schema constraint, not a tone.** There are no slots
here, no criteria, no standings, and there must not be. The eight-slot skeleton exists because
a product promise has to be falsifiable before anybody builds against it; a subsystem sketch is
the opposite kind of artefact. Anything that makes an engineer write a given/when/then at this
layer has misunderstood the layer.

⛔ **`serves` is the whole of "flow from the product design".** A capability serving nothing is
an engineer inventing scope. Another capability is a legitimate target — a general subsystem is
often two levels from a feature — but following `serves` must eventually reach product truth:
machinery that only ever serves machinery is machinery nobody asked for.

⛔ **Generated from current truth, and it carries an invalidated state.** `derived` hashes
**what it serves**, so the question it answers is *has the truth this part exists to answer
moved since anybody worked the part out*.

⛔ **Not the same thing as a system-asked exchange**, and reading them as interchangeable is
how this layer once went missing for months. A system-asked exchange is machinery-shaped
**product truth**: a product person agrees to it. A capability is **engineering's answer** to
it.

**Never** mechanism. *"Invites live in a table with a partial unique index"* is engineering's
and never appears.

---

## Reading

**An observation. ⛔ Never truth.** What was seen, where it was seen (`basis.ref` — a
`file:line`, a session set, a ticket, a dashboard), and which claim it `bears_on`.

Nine bases: **code · test-run · screen · inspection · trial · interview · support · telemetry ·
log.** ⛔ The ways of observing a *person* are in that list deliberately — with only ways of
observing a machine, the strongest evidence in a real corpus (*"parents in the trial recorded
spending after the fact, so refusing it would mean the record does not match what happened"*)
had to live as prose inside a standing's reason, and the concept that exists to hold
observations could not hold the observation the corpus rested on.

⛔ **`bears_on` may be absent, and that absence is meaningful**: the product does something
nobody has decided. It is the completeness signal a grid structurally cannot produce.

⛔ **A reading whose basis names no source is an assertion wearing evidence's clothes.** The
whole point is that whoever answers a question can go and look.

### Confidence · strength

How well-supported a statement is — ⛔ **two zones, not one axis.**

**Below the line**, derived and never stored: **none · one-source · corroborated ·
strongly-supported.** Named tiers, not a number, because averaging a code path against an
interview produces a figure that looks like information and is not.

⛔ **`confirmed` is a separate field of a different type, not the top of the scale.** No amount
of support can produce it. It comes from a human's acceptance, and a scale whose top is
reachable without a person is worse than no scale.

⛔ **Independent bases, not readings.** Two readings citing the same source are one source —
four observations of one code path is one thing known four ways of saying it.

⛔ **Inherited support names where it came from**, because a reader seeing a statement look
stronger with nothing saying why can only conclude that somebody looked at it.

---

## Verdict

**A human's act**, and the five of them are the only things that move truth forward. Every one
records `by`, `at`, what it is `about`, and `via`.

| Act | Says | Owes |
|---|---|---|
| **accept** | I have read this whole exchange (or this rule) and agree to it | the one thing it names; refused while anything in it is unsettled |
| **rule** | the answer is this | a sentence a builder can implement (not `tbd`), and a reason carrying the argument |
| **read** | I read this scope end to end and could / could not build from it | `buildable`, and the blockers where it is false |
| **defer** | I looked at this, understood it, and now is not when it gets answered | a reason, and **what brings it back** |
| **waive** | this is deliberately not answered here | why, in a sentence a reader can weigh — a builder is about to be told this is their latitude |

⛔ **`defer` is not `open`.** `open` means nobody has looked. A deferral means somebody looked
and judged that now is not when it gets answered — and collapsing them loses the most useful
signal in a corpus, that a real reviewer read this and was not blocked by it.

⛔ **Deferring must not launder.** A deferred slot stays unsettled, its exchange stays gated,
and no packet compiles over it. The only thing a deferral changes is whether a person is asked
again.

⛔ **The floors exist because the strongest acts were the cheapest to perform.** A ruling of
`--says "tbd" --because "n/a"` once cleared the hardest open question in a corpus for three
characters, and took its packet's hole count to zero. A waiver was not even an act — it was a
field edit, which is a model's native path and not a person's.

⛔ **A ruling on a disputed slot says what happens to the other side.** A dispute once vanished
entirely from a corpus through its own resolution: the standing was deleted, the counterparty
was offered as ready to accept, and nothing recorded which of the two stood.

### `via` · `relayed_by`

**How this person's consent was obtained** — `page` · `question` · `chat` · `cli` · `agent`.
⛔ **Required and never defaulted.**

It is the guarantee that replaced a stronger one. A boundary test used to fail the build if any
agent tool could perform an act at all; that boundary was deliberately opened so a person can
answer in conversation or press a button on a page. What takes its place is that every stamp
records **which surface it came through**, so a corpus can be read for the *quality* of its
validation and not only for its presence. A default would let the weakest provenance silently
wear the strongest name.

⛔ **`via: agent` is not consent.** Software may land a default so a reviewer has something to
disagree with rather than a blank, and it is then **structurally incapable** of satisfying a
gate — filtered out at the one place every gate asks. Without that value the choice was between
software that cannot help and software whose help is indistinguishable from a person's
agreement.

**`relayed_by`** names the courier where this instance did not watch the press happen. Present
means a person really did agree and this instance has somebody's word for it; absent means the
instance issued the session that pressed the button.

### Acceptance, and its three stale states

What a person agreed to is hashed in two halves — **what it says** and **what demonstrates
it** — so an acceptance reads back as exactly one of five things:

| | Means |
|---|---|
| **accepted** | the words a person agreed to are the words that are there |
| **claim-changed** | a sentence here changed, **or** an org-wide rule reaching it arrived, left or was reworded |
| **criteria-changed** | at least one criterion was added or edited after the acceptance and nobody has read it |
| **both-changed** | both halves have moved |
| **never** | nobody has stamped this |

⛔ **An acceptance is not revived by a reword.** A stamp that survived an edit would be a
person's consent attached to words they never read. What is kept instead is **the exact text
that was hashed**, so re-confirming is one glance at a diff rather than an argument
reconstructed from memory — and so a generator can be stopped *before* it rewords something
somebody agreed to.

⛔ **A confirmed rule is recognised wherever its sentence actually stands.** Where a slot says
nothing of its own and a confirmed rule supplies every word of it, the slot reads accepted
**through** that rule, named. Asking a reviewer to confirm one sentence once per exchange it
reaches is review surface with nothing behind it. This is not inference, and a slot whose own
sentence a rule merely *constrains* keeps asking.

### Stage

**The stages a feature passes through — and they are DERIVED, never stored.**

| Stage | Reached when |
|---|---|
| **specification** | something is unanswered or unsaid, or nobody has agreed to a behaviour yet — product and design are still writing it |
| **ready for review** | every behaviour is agreed to and nothing is unsettled. ⛔ **This is where builders get involved** |
| **ready for build** | a builder read it through and said it is buildable |

⛔ **No field holds this, deliberately.** Every one of those is already a fact about the
stamps, and a stage field beside them would be a second record of one fact — where the stored
one wins, because it is the one a page prints, until it is wrong and nothing detects it.

⛔ **And it cannot be set ahead of the work.** A stored stage lets a feature be marked ready
for build while questions are open, which is the failure the two tenets exist to prevent
wearing a status field. Derived, *ready for build* is unreachable until a human actually agreed
and a builder actually read it. **The stage is a report on consent, not a substitute for it.**

A read-through that says it is **not** buildable sends the feature back to *specification* with
the blockers named. That is not a fourth stage: it is the first one, re-entered for a reason
somebody can read.

⛔ **Sign-off is read off the stamps, and there is no separate approval step.** Inventing one
would create a second record of consent, and the weaker one always wins because it is one press
instead of several.

---

## Note

**Something a person wants changed, addressed to whoever authors.** ⛔ **A note is not product
truth, and keeping that line is the whole design.** The five acts record a *judgement* about
truth; a note records a *request*, and until somebody acts on it nothing about the product has
changed. Filed as a verdict or a slot, *"the tab strip should show the pinned version"* would
ship as something the product does.

⛔ **`about` is the point.** A reviewer typing *"this is wrong"* has told you almost nothing an
hour later, so the reference they were looking at is captured with the words.

⛔ **`kind` says whether the corpus or the framework is being asked about, and it is set from
what the person typed, never inferred.** A classifier reading the sentence would be a guess
wearing a decision's clothes, and getting it backwards is expensive in both directions.

**A note is a conversation**, not a request with a receipt: it carries replies, and closing one
says what was **done** about it. `done` with no outcome cannot be told apart from a note
somebody dropped because they did not fancy it.

**It is leased, not locked.** Two sessions read the same inbox, so reading it takes a claim
with an expiry — and the expiry is the whole reason it is a time and not a flag, because a
session that dies mid-authoring would otherwise strand the request forever.

**`probe: true`** says *nobody is waiting on this one* — a session checking that writing works.
It exists because the queue was the only writable thing to probe, and five probes once rendered
on a review surface as five people asking for changes.

## Steer

**What a project knows that is not a claim about the product** — a design system, a naming
habit, *"he rejects screens with more than three required fields"*. Split by **what it
steers**:

| Steers | Is | Reaches |
|---|---|---|
| **generation** | how a thing gets made. Idiom, layout habits, what gets rejected and why | every author's instructions. Opaque: nothing here is something a person could be wrong about, so no reviewer agrees to it |
| **truth** | a claim about the product. A principle, a constraint, a decision | the page, because somebody can disagree with it |

⛔ **It is never a verdict.** A steer has no standing, no acceptance and no `via`, and it never
counts as somebody having agreed to anything. The moment one carries weight in a gate it has
become product truth and belongs in a scope.

⛔ **No judge is ever given one.** A reviewer told what this project likes can no longer notice
the project is wrong.

⛔ **Anything learned names where it came from.** A pattern inferred from what somebody accepted
is only trustworthy if the next person can go and look at what it was inferred from. A steer
with no provenance is a rule nobody can argue with and nobody chose.

⛔ **Declining keeps it.** A learned steer is noticed from a pattern in the record, so deleting
one that turned out to be wrong does not end it — the next read learns it again. Declining is
how a person says *"I saw this and it is not a rule here"*, with the reason, in a form the
noticer can read.

---

## Packet

**The handoff artifact**, compiled on demand for one scope: what it is for, the behaviours with
their slots, the org-wide rules reaching them, what must be demonstrated, what is deliberately
left to the builder, and what nobody has answered — each marked with whether a person agreed to
it and whether that agreement still covers the words.

⛔ **Nobody writes one**, and no packet compiles over an unsettled slot.

**Deliberately contains no stack, patterns, layout or architecture** — those come from the
repository. Anything not constrained is the builder's call.

## Reference

**The one grammar every pointer is checked against.** A rule's id, or:

| Form | Points at |
|---|---|
| `<scope>` | a product, an area or a feature |
| `<scope>#<exchange>` | one ask |
| `<scope>#<exchange>#<slot>` | one slot of it |
| `<scope>#<exchange>#<slot>#<case>` | one named refusal, or one statement |
| `<scope>#<exchange>#shows#<id>` | one testing requirement |
| `<scope>#<view>` | one screen |
| `<charter>#<section>` | one settled argument |

⛔ **Nothing else addresses anything**, and every reference is resolved — a pointer at nothing
is refused rather than believed.

## Check — refusal versus report

**The pre-handover gate.** It separates what a corpus **refuses** from what it merely
**reports**, and the split is deliberate.

A **refusal** is a claim about shape that is wrong whoever is reading: a pointer that resolves
to nothing, a slot nobody has filled, a rule that governs nothing or demonstrates nothing, a
drawing claiming to show something nothing states, two things sharing an id, an ask arriving at
a control that promises nothing, a product with no name of its own.

A **report** is a judgement call. ⛔ **A gate that fails on judgement is a gate people route
around**, and a refusal firing on every corpus in existence is one people switch off — which
this project has learned more than once.

⛔ **Run it before asking anybody to review**, never after their patience runs out. An author is
the worst possible person to notice what their own corpus fails to say.

## Drift

**What the code has decided since the truth was written.** A screen carries the component it was
drawn from and the commit it was drawn at, so the history between then and now can be walked for
exactly the files that screen is about — and what the commits **say** is the part a diff cannot
give.

⛔ **Downstream, separate, and never authority.** A deleted component is evidence about the
product. Only a person deciding the target has changed makes the truth wrong.

---

## Promisee

**Who you owe an answer to.** A person's ask is owed to that person; machinery's ask is owed to
whatever hands it its input; an integrator's is owed to the integrator.

It matters because it decides what belongs in truth at all: a detail is truth only if **some
promisee could distinguish two implementations differing in it**. State what they observe, never
the mechanism that produces it.

**Engineers are not promisees.** Logs, dashboards, traces and database access are engineering
visibility, which is not product observability — with one exception: a customer-facing audit log
or status page *is* something the product promises, so what it shows is truth.

## Framework gap

Not a user-facing concept, and deliberately not defined here. See [`CLAUDE.md`](./CLAUDE.md).

## Retiring track

An **older model** is still reachable from this repository: *container*, *behavior*, *claim*,
*test case*, *surface*, *element*, *feature area*, *capability system*, *context*, and a
validation ladder of *undecided → awaiting review → accepted*. The commands and agent tools that
speak it are marked as retiring in the registry, and the hosted store that holds it is retired
and still deployed.

⛔ **None of those words is defined in this file, and that is the answer rather than an
omission.** They describe the model the code left behind. Anything orienting itself for work on
a product today uses the Exchange model above.
