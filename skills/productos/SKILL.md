---
name: productos
description: The one entry point to ProductOS. Scope a feature, scan a codebase, map evidence onto claims, check whether a corpus communicates, compare the drawings against the running product, drain the queue of what people have asked for, or make a surgical edit. Routes to the roles that do the work and keeps the judgement with the session. Triggers on "scope this feature", "full scan", "drain the queue", "does this match the app", "run a PM review", and anything addressed to productos.
version: 0.1.0
---

# ProductOS

<!-- productos:preset -->
## ⛔ The routes — what to ask for, and which roles it spawns

> **Generated from `src/core/jobs.ts` (`SHIMS`). Do not edit between the markers.**
> `productos v2 agents --presets` rewrites this, and a test fails if it drifts.

You are the **orchestrator**, and you are the session — not a subagent. That is not an implementation detail: you are the only thing talking to the person, and talking to the person is the one job that may never be delegated.

### Turn one in-flight feature into product truth

*They say:* scope the deals list · spec this feature · what should this screen promise

⛔ **Only at stage: specification.** Derive it before spawning anything here — the stage comes from stageOf, and nothing stores it.

**Spawn, in order:**

- `scoper` *(product · writes)* — the feature written in a context holding nothing but that feature
- `machinist` *(engineering · writes)* — the half of this feature nobody presses — what runs by itself, and what sets it off
- `instrumenter` *(engineering · writes)* — what has to be recorded for any of this feature's measures to be knowable
- `decomposer` *(engineering · writes)* — which parts of the system this feature needs — ⛔ one run, against the product's settled subsystem tree, never one per feature
- `demonstrator` *(quality · writes)* — **one per unit, in parallel** — what would have to be demonstrated for each claim to be believed, invalidated when the claim moves
- `designer` *(design · writes)* — **one per unit, in parallel** — screens the product should have and nothing renders yet
- `completeness` *(product · judges, writes nothing)* — whether somebody can get from the start of this feature to the end of it
- `design-critique` *(design · judges, writes nothing)* — **one per unit, in parallel** — whether these are the right screens for the job, not just complete ones

**⛔ You keep these yourself:**

- the conversation about what this feature is for — a purpose inferred from code is a purpose nobody chose
- putting every open question to the person, in their own interface
- every act of judgement, and never answering one on their behalf
- ⛔ settling the subsystem tree with a person before the decomposer runs, and never spawning one per feature — a part that serves several features cannot be named by a role that can see only one of them
- ⛔ stopping here. The engineering and QA reads are a different route and it cannot run until somebody has agreed to this — an engineer costing a draft produces a decision nobody made

### Turn a whole codebase into a first corpus

*They say:* full scan · index this repo · propose truth for everything

**Spawn, in order:**

- `surveyor` *(product · writes)* — decide what the product consists of once, before anything describes a feature
- `scoper` *(product · writes)* — **one per unit, in parallel** — every feature written in its own context, reading only its own code
- `machinist` *(engineering · writes)* — **one per unit, in parallel** — every feature's machinery, written by somebody whose question is what runs without a person
- `instrumenter` *(engineering · writes)* — **one per unit, in parallel** — what the product already records, and which measure each recording answers
- `designer` *(design · writes)* — **one per unit, in parallel** — a picture for every screen no component renders — a screen with none cannot be reviewed
- `evidencer` *(quality · writes)* — what the repository already demonstrates, found by somebody who did not write the claims
- `completeness` *(product · judges, writes nothing)* — **one per unit, in parallel** — every feature walked end to end, because a first corpus is where paths fail to join
- `coherence` *(product · judges, writes nothing)* — ⛔ the whole corpus at once — thirty scopers writing in isolation is exactly how one word comes to mean two things
- `hand-authored` *(quality · judges, writes nothing)* — whether anything was typed that a generator should have produced — on a run this large, nobody would notice

**⛔ You keep these yourself:**

- running `productos v2 generate`, because a screen a component renders is DRAWN and never designed — it sweeps BOTH corpus layouts and copies the design libraries in first, so a drawing looks like the product wherever the corpus is read rather than only beside a checkout
- running `productos v2 check` before anybody is asked to look
- putting the survey in front of a person before thirty scopers start against a partition that is wrong
- every act of judgement — nothing here is validated by having been written

### Index what a product already does, by driving it

*They say:* walk the app · index what this does today · what is actually on these screens

**Spawn, in order:**

- `walker` *(design · writes)* — **one per unit, in parallel** — ⛔ one area each, because a session that walked thirty screens describes the thirtieth in the words of the first
- `rendered` *(design · judges, writes nothing)* — where a walked screen is one the corpus already holds, whether the two agree — a difference here is the most valuable thing this route produces

**⛔ You keep these yourself:**

- ⛔ somebody else having signed in. The walker never authenticates: an agent that can sign in can reach everything the person could, and a sign-in wall is a RESULT — which routes are behind it is the most useful thing a first pass reports
- ⛔ pressing nothing that sends, deletes, publishes or pays. A walk that changed the data cannot be repeated, and being repeatable is the only reason it counts for anything
- ⛔ the difference between what the product does and what it should do. Everything this route writes is proposed; nothing it sees could tell it which of the two it is looking at
- every act of judgement — a walk is evidence, and evidence is not agreement

### Run one analysis across everything, over only what is outstanding

*They say:* index the capabilities · re-derive the test cases · analyse the whole corpus · what is left to work out · sweep this corpus

**Spawn, in order:**

- `decomposer` *(engineering · writes)* — the parts each feature needs — one run over the refs `analyse capabilities` names, after the subsystem tree is settled
- `demonstrator` *(quality · writes)* — **one per unit, in parallel** — what would show each claim holding — one per ref `analyse requirements` names
- `designer` *(design · writes)* — **one per unit, in parallel** — a picture for each screen `analyse drawings` names, including the appearances a screen falls into

**⛔ You keep these yourself:**

- ⛔ running `productos v2 analyse <name>` FIRST and working only the refs it returns — a sweep that runs over everything redoes finished work and stops being something anybody runs twice
- ⛔ reading what the analysis says about fanning before spawning anything: one that must be settled across the product first says so, and its refs are one run's worklist rather than a list of roles to spawn
- ⛔ putting the subsystem tree in front of a person before any part of it is worked — the names, the areas and what nests in what. Three cold runs over three features produced three disjoint trees and nothing shared, and nobody reading them could see they were the same machinery
- deciding which analysis to run: this route does one at a time, because thirty roles of three kinds at once is a diff nobody reviews
- ⛔ reading the stale ones before the missing ones — a unit that was done and now answers an older wording looks finished to everybody reading it
- every act of judgement. Nothing swept is validated by having been swept, and none of these roles may stamp

### The engineering and QA read, once product and design have signed off

*They say:* ready for review · is this buildable · can we start on this · engineering review · would these tests prove anything

⛔ **Only at stage: ready for review.** Derive it before spawning anything here — the stage comes from stageOf, and nothing stores it.

**Spawn, in order:**

- `architecture` *(engineering · judges, writes nothing)* — whether those are the right subsystems, with boundaries that hold
- `buildability` *(engineering · judges, writes nothing)* — whether somebody could start on Monday — the second tenet, read from a builder's seat
- `test-design` *(quality · judges, writes nothing)* — whether each criterion would show its claim holding, rather than merely pass

**⛔ You keep these yourself:**

- ⛔ checking somebody actually agreed before spawning either of these — the precondition is the whole point of the split
- deciding what to do with what comes back: a question the corpus must settle goes to the person, never to the builder
- every act of judgement — an engineer saying it is buildable is not somebody agreeing it is right

### Answer whether a piece of work can be built, and raise what is open as questions

*They say:* can I build this · is this groomed · is this ready to build · what are the tests for this · groom this

**Spawn nothing.** Every part of this is something you may not hand off.

**⛔ You keep these yourself:**

- the whole reading — `productos_readiness` for the verdict, the queue for each open question, and the packet for what to build from
- ⛔ raising every open question with the person who was asked, verbatim, and answering none of them — a hole a builder fills is product truth invented by a builder
- ⛔ never recording consent: a claim nobody has agreed to needs a stamp from a person, and no amount of grooming produces one
- deciding what a claim with no recorded author is — ask who wrote it; a person's unconfirmed draft and an agent's inference are the same bytes
- writing the test list, with each requirement's ref and the hash of the words it was written from, into whatever holds the work

### Find what already demonstrates the claims a corpus makes

*They say:* map my tests · what covers this · align evidence

**Spawn, in order:**

- `evidencer` *(quality · writes)* — the whole of the search, by a role that cannot mistake a green test for agreement
- `coverage` *(quality · judges, writes nothing)* — whether each claim is pinned by something that fails on its own

**⛔ You keep these yourself:**

- the decision about what to do with a criterion nothing demonstrates
- ⛔ not reading a coverage number as quality — whether those criteria would show anything is `hand it to the builders`, after somebody has agreed
- never letting coverage be reported as validation

### Find out whether a corpus can be built from by somebody who has not read it

*They say:* run a PM review · fresh eyes · would somebody understand this

**Spawn, in order:**

- `newcomer` *(product · judges, writes nothing)* — **one per unit, in parallel** — a product manager handed a URL, who has never seen ProductOS and may not read its source

**⛔ You keep these yourself:**

- running the reviewers, which judge and never write
- routing what comes back: a framework gap to us with `productos todo add --at <corpus>`, a corpus finding to the author
- never answering a newcomer's confusion — writing it down is the output

### Compare the drawings against the product a person actually sees

*They say:* does this match · check the prototype against the app

**Spawn, in order:**

- `rendered` *(design · judges, writes nothing)* — **one per unit, in parallel** — whether the drawing matches the product a person actually sees
- `design-critique` *(design · judges, writes nothing)* — **one per unit, in parallel** — ⛔ and whether it is any good — `rendered` refuses this, so a faithful drawing of a bad screen passes it
- `truthfulness` *(engineering · judges, writes nothing)* — where the built product disagrees with the target, reported as drift and never as the corpus being wrong

**⛔ You keep these yourself:**

- bringing the environment up, and saying so when it will not come up
- running the reviewer that looks, which judges and never writes
- never treating a difference as the corpus being wrong — the corpus is the target state

### Work what people have asked for, and answer them where they asked

*They say:* drain the queue · anything waiting · did anyone press anything

**Spawn nothing.** Every part of this is something you may not hand off.

**⛔ You keep these yourself:**

- deciding which route each request belongs to, and running it
- replying where they asked — ⛔ a `pos:` is answered concisely, and the framework is what changes
- every act of judgement

### A surgical change to truth somebody already agreed to

*They say:* rename this · set leads_to · change this one field

**Spawn nothing.** Every part of this is something you may not hand off.

**⛔ You keep these yourself:**

- the edit itself — one field is not worth a context, and a scoper would rewrite around it

⛔ **Every author writes and none may settle.** An author may propose, populate, draw and regenerate; it may never produce a verdict, answer an open question, or mark anything validated. None of them can put a question to a person — deliberately, because consent obtained inside a subagent has no record of how it was obtained. What an author cannot resolve comes back to you as a question, and you put it to the person yourself.
<!-- /productos:preset -->

## ⛔ A probe is a write, not a request — `Note.probe`

A session that needs to check whether an instance can take a write has to write *something*, and
the request queue is the only writable thing there. So say what it is:

```bash
productos v2 notes add "staleness-probe-231153" --about <ref> --by <session> --via cli --probe --at <corpus>
```

Over the single door it is the same field: `POST /api/v2/in` with `{"intent":"note", …, "probe":true}`.

`probe: true` is counted in no waiting total and shown on no surface a person reviews. It is still a
real note, really stored, through the whole write path — which is the entire point of it.

⛔ **Omit it and you are asking somebody for a change.** Five probes from one session rendered on
Peter's review page as five people waiting on him. He read the banner and asked *"what are those 6
requests, i did not send any requests"*. He had not sent any.

⛔ **And never infer it.** `staleness-probe-231153` is text a classifier would be right about, and
being right about it is not the point: a note treated as a probe because of how it reads is
somebody's request silently discarded. The flag is set by whoever wrote the note or it is not set.

## ⛔ A gap is filed against the corpus it was found in

```bash
productos todo add "<what the model cannot express>" --at <corpus> --forced-into <where it went>
productos todo --at <corpus>          # what this corpus could not say
```

**`--at`, always.** Without it the command walks up from wherever the shell is standing and files
the finding against whatever product lives *there*. That is not a lost gap, which would be
recoverable — it is a gap recorded as a fact about the wrong product, indistinguishable once filed
from that product's own, so reading the backlog reports limits the model does not have.

It happened at scale before the flag existed: thirty-three gaps found while authoring one corpus
went into another product's record, and every one of them printed the same confident tick. `add`
now names the file it wrote to, which is the only moment somebody can still catch it.

## ⛔ How confident the corpus is, and the line that cannot move

Every statement has **three** separate facts, and they must never be read as one scale:

- **who wrote it** — `wrote: {hand: person|agent, as: …, from: …}` on the sentence, the statement,
  the named refusal or the rule. ⛔ Every role writes `hand: agent` on every sentence it puts in a
  corpus, with `from:` naming what it was worked out from. A claim software inferred and a claim a
  product person typed-but-has-not-confirmed both read *"not confirmed"*, and so does one nobody has
  ever looked at — the first has to be **raised as a question** when a ticket is groomed and the
  second only needs a **stamp**. Nothing can tell them apart unless this is written.
  ⛔ **Absent means `unrecorded`, never "a person"** — that is what a migrated corpus says, and
  defaulting it the other way turns an agent's guess into somebody's draft. ⛔ **And it is not a
  stamp**: no gate reads it, so it cannot make anything look agreed.
  ⛔ **`hand: person` is not yours to type, and the door refuses it.** Where a command writes
  authorship it is DERIVED from the `via` the consent boundary already guards; a document sent
  through `productos_in { intent: "document" }` is raw bytes, so a session authenticated by a token
  that types `hand: person` is refused — write `hand: agent` with `from:`, which is the claim a
  grooming agent raises as a question. A person's hand is recorded by a person landing it themselves.


- **confirmed** — a person's act. `accept` or `rule`, with a `by` and a `via`.
- **strength** — `none · one source · corroborated · strongly supported`, derived from the readings
  bearing on it. The top of this is BELOW the line; no amount of it ever becomes confirmed.

`productos v2 decide <scope>` now asks **least-supported first**: a statement nothing backs is where
a person's answer is the only thing that will settle it, and one three sources already agree about
can be shown with its evidence and skimmed. ⛔ It is an order, never a filter — nothing is hidden on
the strength of inference.

⛔ **A confirmation propagates, and the page says from where.** Confirming a happy path settles that
its screens are on it (`derived`); confirming a statement raises one resting on the same pointer
(`shared-support`), and that one renders dotted with a line naming whose confirmation it borrowed.
Peter chose this knowingly — *"the reason why it has confidence needs to be visible as well"* — so
if you surface strength anywhere, surface why beside it.

⛔ **And a confirmation can be overtaken.** A reading dated after an acceptance means somebody agreed
and then something was observed; the page says `confirmed · newer evidence`. That is a question for
the person, not a finding an author can fix.


## What this is, and what it is not

⛔ **There is one skill, and this is it.** There used to be eight, and they were carrying three
different things at once: which roles to spawn, the rules for authoring a scope, and a workflow for
a model the work has left. Peter: *"hmm, these don't seem right, why do we need skills and
commands?"*

Only the first of those is a skill's job. The split now:

| | is | lives in |
|---|---|---|
| **a command** | what the system can do | `productos v2 …` — 34 of them, and only a handful are yours to type |
| **a role** | who does a piece of the work | an agent with its own context and its own prohibitions |
| **a skill** | how somebody asks for something by name | here, and only here |

The rules for writing a scope moved to the **scoper**, which is the only role that writes one. They
are not repeated here, because a rule delivered to everybody and used by one is a rule that drifts.

## ⛔ The three things you never hand off

Whatever route you are on:

1. **Talking to the person.** You are the only thing that can. No author may ask a question — not
   because they are untrusted, but because consent obtained inside a subagent has no record of how
   it was obtained, which is the whole thing `via` exists to carry.
2. **Every act of judgement.** `accept`, `rule`, `read`, `waive`, `defer`. The CLI is how somebody's
   choice gets RECORDED, never how it gets made.
3. **Answering an open question.** Not even an obvious one. An answer nobody gave, written in the
   form of one somebody did, is indistinguishable afterwards from a decision.

## Walking someone through what is undecided

The surfaces a person meets are **a page** and **the question interface**. They are never handed a
flag: the CLI and the MCP tools are yours.

### 1. Show them the feature

```
productos_exchange_scopes                     which feature is holding the most work
productos_exchange_page   scope, out: <file>  render it, then show them the file
```

The page carries the questions with their options, the grid, every behaviour in full, and what was
already decided. Reading it is what makes the next step answerable — a question with no feature
around it is not a question anybody can answer.

### 2. Ask, in the question interface

`productos_exchange_questions` gives you each question with its options, what it costs to guess
wrong, and what has actually been observed. Put that into **`AskUserQuestion`**:

- **one call per feature**, at most 4 questions — the whole design of `decide` is that a reviewer
  is never handed the corpus at once
- **the question text** is the question plus what guessing wrong costs. The cost is often the
  deciding fact and it is the thing a person cannot reconstruct
- **one option per drafted candidate**, using its `consequence` as the description — that is the
  argument for it, already written
- **plus the honest exits**: *Not now* (park it) and *The builder decides* (grant latitude). Never
  offer only the candidates; a person who thinks both are wrong needs somewhere to go
- **header** is the slot name, and `at once` / `at_once` both fit the 12-character limit

Their freeform answer arrives as Other. That is a `says`, not a pick.

### 3. Record what they chose

```
productos_exchange_settle          slot, pick | says, because, by, via
productos_exchange_park            slot, because, until, by, via
productos_exchange_grant_latitude  slot, because, by, via
productos_exchange_agree_to        ref, by, via
productos_exchange_record_read_through  scope, buildable, by, via
```

`via: "question"` when they selected an option, `"chat"` when they answered in prose. Before asking
anyone to agree to a whole exchange, call **`productos_exchange_what_it_covers`** and show them —
an acceptance used to print what it covered in the same breath as writing it, which left no point
at which anybody could decline.

### ⛔ The second way truth gets accepted: they state a sentence, and it settles several claims

A person does not only press on one claim at a time. They say a thing — *"folders are restricted to
be linked to a single deal"* — and that one sentence answers several claims already in the corpus.
Record the sentence as a **rule**, in their words, and then each claim it reaches is accepted with
their sentence named as the proof. **One human act, N records.**

What each reached claim's acceptance carries, and why the three are three:

| | holds | whose claim it is |
| --- | --- | --- |
| `through:` | the **rule id** whose statement this was reached through, rather than pressed on | **theirs** — it is the sentence they stated |
| `reading:` | why that sentence settles **this** claim | software's. ⛔ **Never their words** |
| `read_by:` | who read it that way — a model name, or `software` where no judgement was involved | software's |

⛔ **The sentence is theirs; its reach is an inference, and the two must never share a field.** Write
the reading into `because` or into the sentence itself and the log prints a model's reasoning under a
person's name — the `chose` / `option_said` failure, which cost the one floor the strongest act in the
model has. Keep it in `reading:`, with `read_by:` naming who drew it.

⛔ **And it names ONE claim, at `<scope>#<exchange>#<slot>`.** A whole exchange is eight sentences and
one org-wide statement does not answer all eight; a coarser target is refused.

⛔ **It lasts exactly as long as the sentence does.** `stampFor` grants a reached-through acceptance
only while the rule it names is itself accepted and unreworded, so rewording that rule — or
withdrawing its acceptance — withdraws every claim read through it, at once. Do not re-record the
reading to make the stamp come back: that is the acceptance surviving a reword, which is the one thing
the whole stamp mechanism exists to stop. Take the reworded sentence back to the person.

### When it refuses

Every refusal carries `instead`: the acts that WOULD be honest there. Offer those. **Do not work
around a refusal and do not soften what the person said to get past a floor** — if a refusal has
no honest answer, that is a finding about the model and worth saying so.

### ⛔ `productos serve` is the one place somebody goes. Send them there and stay out of the way

```bash
productos serve --v2 <dir>        #  → http://localhost:<port>/v2
```

Everything a person needs happens on that page and nowhere else: they read the feature with its
screens, they press, the press is written to the corpus **synchronously**, and — because the page
holds a connection open — **it tells them when the truth changes underneath**, whoever changed it.
Nothing leaves the machine, so this is also the only surface for a corpus that must not be
published, and product truth routinely names a real client.

**Why it has to be one place.** Reading, deciding and authoring used to live on three surfaces: a
published page to read, a question interface to decide, a session to author. Every handoff between
them was a person carrying something by hand, and the one they felt worst was the reload — the
truth had already changed and their page went on showing the old one until they thought to check.

So when someone is reviewing:

1. Start the server and give them the URL. **Once.**
2. Work from what arrives — a press, or a note the composer filed. Do not ask them to re-describe
   what they already pressed.
3. Author the change, regenerate, and **say nothing**: their page announces it and offers to show
   it. A message from you here is a second notification about the same event.

⛔ **Do not hand a human a flag, and do not ask in chat what the page is already asking.** A
question in prose next to an unanswered question on the page gives the same decision two records
and no way to tell which is current. `AskUserQuestion` carries no feature — an option list with no
screen next to it asks somebody to judge something they cannot see.

### A published page, with buttons, inside Claude

`productos v2 publishable <scope> --by <them>` emits a page whose presses land in an artifact's
database. It **refuses unless that corpus is marked publishable**, because publishing copies the
truth to claude.ai. Do not argue with the gate; tell them what it said.

See `WATCHING_PRESSES.md` for reading presses back and turning them into truth.

## ⛔ One door into a corpus, and it tells you what it takes — `/api/v2/in`

Everything that changes a corpus goes through **one input**, named by an **intent**. There is no
endpoint per operation and no new route for a new capability — a capability costs an intent.

```bash
curl -s <instance>/api/v2/in                      # what it takes: every intent, its authority, its fields
curl -sX POST <instance>/api/v2/in \
  -d '{"intent":"note","about":"pricing#publish","says":"this screen says nothing about what happens next"}'
```

From MCP, the same door and the same contract:

```
productos_intents   # ask what may be said, and what each field means
productos_in        # say it: { intent, fields: { … } }
```

⛔ **Ask before you guess.** `GET /api/v2/in` and `productos_intents` are generated from the intent
registry, so they cannot be out of date. A hardcoded idea of the fields is wrong the first time one
changes — and the cost is on the record twice already: *a refusal printing a remedy the tool then
rejected.*

⛔ **The intent is NAMED, never inferred — and neither is what a request is about.** A classifier
reading a sentence as `accept` mints consent nobody gave; one guessing `about` files a request
against the wrong feature, which is worse than one that asked. **If you do not know what somebody is
referring to, ask them.** This binds anything that relays messages in — a chat channel, a bot, a
queue — where there is no page context to read it from.

⛔ **A relay carries a press; it never makes one.** Use `carry`, which keeps the presser's name and
records who carried it. Recording a relayed message as a direct press claims a person agreed to
something in a room they were not in.

| What came back | What it means | What to do |
| --- | --- | --- |
| `403` | **you may not** — this principal lacks the authority | stop, and tell a person |
| `422` | **you have not said enough** — the refusal names each field and what it is | supply it and retry |

The four authorities: `consent` (a person agreed — ⛔ a token can never claim this), `relay`
(carrying somebody else's press), `author` (your own words, claiming nothing about what anyone
agreed to), `open` (anybody may).

## ⛔ `pos:` means the framework

The review page is a conversation. The composer files a request; a bar at the bottom says how many
framework asks have been dealt with and opens to show what was done.

```bash
productos v2 notes say <id> --says "…"          # reply, and leave it open
productos v2 notes done <id> --outcome "…"      # the last reply, and close
```

| They typed | It is | What you do |
| --- | --- | --- |
| `pos: …` | a **framework** issue — ProductOS itself, its roles, generators and checks | fix the framework, then reply **concisely**: what was updated or fixed |
| anything else | a **corpus** request — what the product truth says | fix the truth, reply with what changed |

⛔ **The tag sets it; nothing infers it.** A classifier reading the sentence would be a guess wearing
a decision's clothes — and this is the audit-finding-versus-framework-gap distinction that
`GLOSSARY.md` warns is costly in both directions.

⛔ **A reply is not a closure.** `done` ends the request, so answering with it used to double as
deciding the matter was finished.

## ⛔ Before anybody is asked to look

```bash
productos v2 check --at <corpus>
```

It refuses a corpus that cannot be handed over, and it is the difference between a review and an
apology. ⛔ The `v2` is load-bearing — the bare verb is the v1 command and cannot read an Exchange
corpus at all.

## ⛔ A drawing wears the product's own style, and nothing says so when it does not

A screen is drawn in the application's real class names, so it needs the application's real CSS or
it is a drawing of some other product. Four lines of `web:` in `productos/config.yaml` decide that,
and every one of them fails by **looking fine** — the screen still renders, laid out and legible and
reviewable, in whatever the fallbacks are.

⛔ **The corpus CARRIES the stylesheets; it does not reference them.**

```bash
productos v2 style --into <corpus>     # copy the design libraries in — where the repository is
productos v2 style --check --into <corpus>   # has the design system moved since?
```

`web.stylesheets` says where the bytes are **taken from**; `style.yaml` is where they **live**. Same
relationship a drawing has to the component it was drawn from, and generated for the same reason: a
corpus read anywhere but beside a checkout has no stylesheets to read. An instance materializes a
project into a temp directory with no repository above it — that is not an edge case, it is the
hosted product, and before this it rendered every drawing in browser defaults while the identical
line of code kept working locally.

So the snapshot is taken **where the repository is**, by `v2 style` or by `v2 generate`, which runs
it first. Everything downstream — a hosted instance, a packet, a published page — reads the corpus.

### ⛔ Deploy every time. Deploys are cheap; batching them is not

Peter: *"don't ever do this again --> 'the code for it still needs a deploy, which I've not
re-requested since they've just done one.' deploys are cheap, why would you waste my time not
deploying"*.

**Every merge to main gets deployed, immediately, without being asked.** Not batched, not held back
because one went out an hour ago. A merged change that is not live is one nobody can look at, and
looking at it is the whole loop.

⛔ **A deploy is not finished when the code ships.** `sketch_html` is persisted truth, so new
drawing code changes nothing already stored — deploying new generators cannot alter a drawing that
already exists.

⛔ **The two halves have different owners.** A deploy session ships code and reads a number off the
page; it does **not** redraw, because redrawing is an act on product truth and a session doing that
without a person is the one thing the corpus is careful to prevent. The drawings are the author's
half, and the author finishes them:

```bash
productos v2 draw --all --into <corpus>     # the drawings are output; redraw them
productos v2 prototypes --into <corpus>     # and the chrome
productos v2 style --into <corpus>          # and the stylesheet snapshot
productos hosted import <corpus> --into <projectId>
```

Then **check a number on the live page that would be different if it had not worked** — not that the
page returns 200. A corpus was once reported deployed while every drawing on it still came from the
previous generator, and the tick was true.

### ⛔ A dimension reaches every feature, and every truth inside one — `dimensions`, `holds_for`

Peter: *"we need dimensions to carry through to all features, so we can have different variations
PER feature. and the dimensions should affect the truths as well"*.

Dimensions started life inside `prototypes.yaml`, where one could only pick a whole walkthrough. A
product that genuinely differs by role differs **per feature**, in what each one promises — so they
are declared on the **product**, and any screen or sentence says which combination it is for:

```yaml
# the product — the scope with no `in:`
dimensions:
  - id: role
    label: Role
    values: [admin, loan processor]
  - id: line
    label: Product line
    values: [CRE, private lending]
```

```yaml
# a feature: two drawings of one job, for two audiences
views:
  - id: deals-list
    title: Deals, as an admin
    holds_for: { role: admin }
  - id: deals-list-processor
    title: Deals, as a loan processor
    holds_for: { role: loan processor }

exchanges:
  - id: price-a-deal
    slots:
      shows:
        says:
          - id: margin
            says: The indicative margin is shown beside the rate.
            holds_for: { role: admin }
          - id: rate
            says: The rate is shown to two decimal places.
```

⛔ **Unsaid means EVERYWHERE, never nowhere.** A truth with no `holds_for` holds under every
combination — `rate` above is promised to everyone. Write `holds_for` only where the product really
does differ; adding it "for completeness" narrows a promise nobody asked to narrow.

⛔ **On the slot when the whole part only exists there**, on the statement when one sentence does. A
refusal an auditor never meets is the slot's `holds_for`; a line of detail only an admin is shown is
the statement's. Writing the first as a `holds_for` on each of its statements is the same fact in N
places.

⛔ **The ids are the product's own dimension ids, and a typo does not fail — it goes universal.** A
dimension nobody declared excludes nothing, so `roles: admin` quietly shows an admin-only screen to
everybody. `v2 check` refuses both an undeclared dimension and a value the dimension does not list.

⛔ **Never declare dimensions on a feature.** They are the product's, read from the root scope and
nowhere else; a feature declaring its own would be a second product inside the first.

⛔ **And a feature never states what it varies by** — that is derived from the `holds_for` actually
present. A field saying "varies by role" beside truths that say so themselves is a second record
with no forcing function.

### ⛔ Several ways through one product — dimensions, and which one each prototype is

Peter: *"we can have different prototypes for differnet prototypes.. like 'unauthenticated' could be
a flow, and CRE vs private lending"*, then *"It's going to split on different products - CRE vs
private lending, then also on roles"*, then *"let's allow users to specify their own dimensions for
the prototype - 'role', as an example, and 'product line' as another, and let them specify the
values"*.

An unauthenticated flow and a signed-in one do not share a menu; two lending businesses in one
codebase do not share a walk. So a product has **prototypes**, and the set splits on **dimensions**
the project names — each with its own values:

```yaml
splits_on:
  - label: Role
    values: [admin, loan processor]
  - label: Product line
    values: [CRE, private lending]
prototypes:
  - id: cre-admin
    title: CRE admin
    starts_at: deal-list#deals-list
    is:
      role: admin
      product-line: CRE
```

⛔ **`label`, not `asks`** — and a test caught that, not me. `asks` is already a field in this model:
an enum of `whether | when | told` on a standing. A dimension carrying `asks: Role` taught a key
that is a parse refusal three objects away, and a reader meeting `asks:` had to know which object
they were in. `label` is the word this model already uses for what a reader is shown.

⛔ **The `is:` keys are the dimensions' own ids**, derived from the label where you do not give one,
so "Product line" becomes `product-line`. They are data rather than schema: this is the one map in
the model whose KEYS a project chooses.

⛔ **This is set from the page, not from a terminal.** Peter: *"I should be able to drive this from
the listener/input, right??? why could you possibly need this?"* — the Prototype tab has a dropdown
per dimension, **Add a dimension**, and a row per prototype you assign from. The commands exist for
a session working in a checkout and are not the primary surface:

```bash
productos v2 prototypes --into <corpus>        # draw each one's chrome and aim its menu
productos v2 prototypes new "<title>" --starts-at <scope>#<view> --into <corpus>
```

⛔ **Or from the one text input, with a tag** — never from prose:

```
dim: Role = admin, loan processor
```

The tag is typed, the way `pos:` is. A classifier reading *"add a dimension for role"* out of a
sentence would be a guess wearing a decision's clothes, and this one would write product truth on
the guess. Untagged text files a request, as always.

⛔ **Never hand-write `prototypes.yaml`.** The id comes from the title, the front door is checked
before anything is written, and `shell_html`, `nav[].to` and `from` are all output. What a person
says is the title, the front door, the dimensions and where each prototype sits.

⛔ **Nothing infers a dimension.** Two titles reading "CRE — loan processor" and "Admin" would give a
classifier "Role" and "Product line"; absent is absent, and every surface says so rather than
labelling it. The example in the form is a *placeholder*, which a person overwrites.

⛔ **`title` and `is` are different things on purpose.** "CRE admin" is for a reader; `is` is where
it sits. A list built from titles alone cannot say that two of five are the same combination, or
that nothing covers signed-out — and `check` reports exactly those: `prototypes-split-on-nothing`,
`two-prototypes-one-answer`, `prototype-answers-nothing`, `nothing-covers-this`,
`a-prototype-opens-on-nothing`.

⛔ **The dropdowns are FILTERS, not a coordinate.** They narrow the list of prototypes; each row
carries its own placement as chips reading `role:admin`. This was built as a coordinate resolving to
one prototype first, and it took four redesigns to find that the control's *kind* was the mistake: a
coordinate needs a special case for a combination nothing covers, filters make that an empty list.
⛔ **And a prototype specifying nothing is in the list saying so** — hiding it until somebody placed
it would hide the thing that needs doing.

⛔ **How much of the product each one reaches is derived, never typed**, and so is whether a value is
covered at all. The first prototype in the file is where a reader lands — ordering, not a flag.

### ⛔ A screen somebody has worked on is not the sweep's to rewrite

Peter: *"we should add some internal tracking to screens - when screens haven't had review yet
(including product truth), we can freely regenerate. once they have been operated on, they should
stay locked. from there, only direct user input changes things."*

`draw --all` rewrites every screen it can resolve, which is right while a screen is a first guess —
the sweep is the whole reason sixty screens were drawn at all. It stops being right the moment
somebody reads one and says something, because from then on the corpus holds a judgement the
generator never heard of and cannot reproduce.

**So the sweep skips them and says so**, and the count it prints is of what it left alone:

```
✓ 19 of 33 screens drawn from the code

3 left alone — somebody has worked on them:
  ·  create-deal#folder-picker  (a note by peter and 2 other acts)
```

⛔ **Nothing to set. It is derived from the acts already recorded**, and there are three — a **note**
about the screen, a **verdict** on truth the screen `shows` (his *"including product truth"*), or a
**reading** a person recorded about it. A `locked:` field would be a second record of what the
corpus already knows, with nothing keeping the two in step.

⛔ **Naming the screen still redraws it.** That is the direct user input the rule turns on, so
`v2 draw "<scope>#<view>" --route <file>` goes through — and prints whose work it is replacing
first. Never reach for it to make a sweep look complete; a held screen is held because the cheapest
thing in the corpus is about to overwrite the most expensive.

⛔ **And a held screen's drawing stops following the code.** That is the cost of the lock, not a
defect, and `v2 check` reports it as `held-and-the-code-moved` rather than fixing it — whose work
gets replaced is a person's call.

### ⛔ Say what a screen appears INSIDE — `within`

A product is not a pile of screens, and for a long time that is all a corpus could say. Scopes nest,
so it knew a screen belongs to a **feature**; `connect` infers that a control **leads** somewhere
from what its words say. Neither of those is containment.

```yaml
views:
  - id: workspace-shell
    title: Deal workspace
  - id: overview-tab
    title: Overview
    within: workspace-shell          # a view in this scope
  - id: activity-tab
    title: Activity
    within: deal-workspace#shell     # or one somewhere else
```

⛔ **It is where a screen APPEARS, not what it is about.** A screen can be filed under one feature
and shown inside a screen owned by another — that is a normal product, not a mistake.

⛔ **Write it wherever one screen is shown inside another**: a tab, a pane, a step in a wizard, a
drawer. Where you do not, that screen has no way in unless some control happens to lead to it, and
the walk will say so.

**Why it matters more than it looks.** On the corpus this was built against, `connect` found four
links across twenty-two screens — eighteen with no way in or out — so the product looked like it was
in pieces. It was not. Most controls do not navigate: they act where they are, or they switch a tab,
and switching a tab is containment. The truth simply had nowhere to say so.

```bash
productos v2 check --at <corpus>   # within-points-at-nothing · no-way-in · one-page-two-screens
```

⛔ **`one-page-two-screens` points and does not decide.** Two screens drawn from the same route are
one page, so one very likely holds the other — but which way round is not derivable, and a shell
filed inside its own tab is worse than no answer.

### ⛔ A corpus on disk can be behind the schema — `productos v2 forward`

```bash
productos v2 forward --at <corpus> -n   # what it would bring forward
productos v2 forward --at <corpus>      # bring it forward
```

Document migrations always ran against the **store** — `hosted import` calls them, boot calls them —
so a hosted corpus was current and a corpus in a **directory** was not reachable by any of it. When
`walked` was removed from `View`, twelve files in a working corpus stopped parsing and `check`
answered `cannot-judge-this-corpus`: not one finding, about anything, until somebody read the key.

⛔ **Run it when `check` says a key is unrecognized.** That is what it looks like from the outside: a
corpus written by an older build, read by a newer one.

### ⛔ The environment convenient to measure in is not the environment the thing lives in

Peter, pressing Add on the live page: *"Not saved: Not Found"*. Three defects in two days, same
shape — the code right about where it was tested and wrong about where it runs:

- **every page write**, checked against the local stack. Local serves at `/`; hosted serves under
  `/p/<project>/`. Seven root-relative urls — the composer, the thread, the live connection —
  404ing on the only page anybody reviews on.
- **the side menu**, measured in the default headless window. Its rules live inside
  `@media (min-width: 62rem)`, so a correct page measured as broken.
- **the config**, read from a corpus directory, which is reachable in a way a temp dir is not.

⛔ **Nothing could see the first one.** A browser test that replaces `fetch` asserts what a handler
SENDS, so a wrong url passes — it would go green on `/nonsense`.

⛔ **So verify against the shape the thing ships in.** A route checked by curl against a path you
typed says nothing about a page that builds a different one.

### ⛔ A zero proves nothing unless you can say what a failing zero looks like

Peter: *"why aren't you just looking at all variable substituion? are you just searching for 'n"?
what the heck?"*

**Six times in one week the measurement agreed with the hypothesis, so it was never checked.**
`grep -c` counts *lines*, so three hundred placeholders on one line read as 1. A sweep's number was
quoted for two days after the sweep had stopped happening that way. A deploy log looked clean
because `--since` matched nothing and printed an empty 2037-line outage.

The worst of the six is the one to learn: an attribute that is **omitted** when the condition is
absent, counted as 0 and reported as working. A zero there is not a weak check, it is not a check —
there is no failing state in the observation at all.

**So produce a non-zero.** Exercise the shipped code until it answers differently for cases that
differ: no acts → `false`, a person's reading → `true`, the generator's own reading → `false`. That
probe found a real bug in the feature it was verifying.

⛔ **And when two numbers are mutually impossible, stop counting and look at one instance.** Reading
a single control is what found a sample value nobody had noticed was wrong; reading one recorded act
is what found eight screens held by nobody.

⛔ **A drawing is only right if it RENDERS right, and there is a test harness that renders in a
real browser.** `test/support/chrome.mjs`, used by `test/v2-the-mock-in-a-real-browser.test.mjs`:

```bash
npm test                              # includes them wherever Chrome is installed
PRODUCTOS_REQUIRE_BROWSER=1 npm test  # absence of a browser becomes a failure, not a skip
```

It drives the Chrome already on the machine over the DevTools protocol — no dependency, nothing
downloaded — and it asserts **computed style, never markup**. Markup assertions would have passed
on every bug it exists for: a stylesheet read with `innerHTML` came back with every child
combinator HTML-escaped and 209 rules silently dropped; `@property` is document-scoped, so
`border-style: var(--tw-border-style)` resolved to nothing and every bordered box drew as a bare
underline; a page written to own a viewport kept `min-height: 100vh` inside a 450px pane. In all
three the markup was correct, which is exactly why they survived.

⛔ **Never reach for jsdom here.** It resolves no cascade, implements no `adoptedStyleSheets` and
registers no `@property`. It would have passed on all three — a green test asserting the opposite
of the truth is worse than no test.

⛔ **And a test that has never failed has not been shown to test anything.** Put the defect back,
watch it go red, then put it right. Each of the three above was verified that way.

⛔ **A copy with nothing watching it is a copy that goes quietly wrong.** The snapshot carries a
digest of every file it read, so `--check` and `v2 check` can say the design system has moved; take
it again when they do. Where there is no repository to compare against they say **so**, rather than
reporting it current — asserting something nothing checked, on the one surface nobody can go and
look at, is the failure this whole section exists to stop.

```yaml
web:
  design_system: frontend/design-system   # the parts the product ships, so a drawn screen uses them
  stylesheets:                            # ⛔ EVERY file, in cascade order — one of them is not enough
    - frontend/design-system/src/tokens.css
    - frontend/design-system/src/themes.css
    - frontend/.next/static/chunks/*.css  # a build output is content-hashed; glob it
```

⛔ **Which scheme a project wears is NOT in here.** It is a choice, made per project, by whoever is
looking at it:

```bash
productos v2 style --wear bilrost --into <corpus>        # locally
productos hosted style <project> --wear bilrost          # on an instance, no checkout needed
productos v2 style --bare --into <corpus>                # a product that ships unthemed
```

Peter: *"NEXT_PUBLIC_DS_THEME is a bilrost specific thing, doesn't belong in productos config. we
should be able to choose themes per project."* It was a config field, and briefly a pointer at one
application's env var — which put that customer's variable name into this model and put the decision
somewhere the reviewer cannot reach. The snapshot records what the design system **offers**; a
person picks one, and the pick survives every re-take of the bytes.

⛔ **Never pick for them.** A system offering four schemes is a product offering four, and choosing
by position or by rule count is a guess wearing a decision's clothes — the drawings would look
authoritative and nobody could tell. Ask.

⛔ **Naming one stylesheet is worse than naming none.** The right class names with none of the
values they resolve to renders as a badly written mock rather than as a missing file, and nobody
reading it can tell which.

`productos v2 check` reports a path that resolves to nothing, a scheme the stylesheets do not
define, and schemes defined with none chosen. Run it **before** reading a drawing as evidence of
anything: the only thing a reviewer compares a drawing against is the drawing.

## The reviewers

```bash
productos v2 agents          # every role, what it asks, and which model runs it here
```

⛔ **Every one judges and none may write** — enforced at install, not hoped: a role's tools are
derived from the capabilities it declares, and the derivation refuses to install a judge that
reaches anything able to change something. ⛔ **It is default-deny over ProductOS's own surface** —
anything this server offers that is not in the read set counts as writing, `productos_in` first of
all, because the door can perform any intent including one behind the consent gate. A reviewer that
repairs what it finds hides how often it fires, and how often it fires is the only measure of
whether the model is holding.

**Every judge but the newcomer holds the read half of this server** — `scopes`, `page`, `grid`,
`packet`, `questions`, `what_it_covers`, `can_be_agreed_to`, `check`, `record` — so a spawn prompt
names the corpus and the scope rather than the files, and a judge reporting on what a corpus says is
reporting on what a consumer's session would receive rather than on what somebody typed where. Each
prompt says
which of the nine answers its own question; ⛔ **do not re-explain them in a spawn prompt**, and do
not tell one to read files instead — the surface the MVP rests on is exercised by these roles or by
nobody who knows this model.

⛔ **Never explain ProductOS to the newcomer**, in the prompt or in follow-up. A reviewer who has
been told what a capability is can no longer detect that the corpus failed to tell them. A newcomer
coming back confused about something you could clear up in one sentence is the highest-value result
there is — write it down, do not answer it.
