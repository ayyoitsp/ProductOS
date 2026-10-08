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
- `decomposer` *(engineering · writes)* — **one per unit, in parallel** — which parts of the system this feature needs, from the truth as it now reads
- `demonstrator` *(quality · writes)* — **one per unit, in parallel** — what would have to be demonstrated for each claim to be believed, invalidated when the claim moves
- `designer` *(design · writes)* — **one per unit, in parallel** — screens the product should have and nothing renders yet
- `completeness` *(product · judges, writes nothing)* — whether somebody can get from the start of this feature to the end of it
- `design-critique` *(design · judges, writes nothing)* — **one per unit, in parallel** — whether these are the right screens for the job, not just complete ones

**⛔ You keep these yourself:**

- the conversation about what this feature is for — a purpose inferred from code is a purpose nobody chose
- putting every open question to the person, in their own interface
- every act of judgement, and never answering one on their behalf
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

### Find what already demonstrates the claims a corpus makes

*They say:* map my tests · what covers this · align evidence

**Spawn, in order:**

- `evidencer` *(quality · writes)* — the whole of the search, by a role that cannot mistake a green test for agreement
- `coverage` *(quality · judges, writes nothing)* — whether each claim is pinned by something that fails on its own

**⛔ You keep these yourself:**

- the decision about what to do with a criterion nothing demonstrates
- ⛔ not reading a coverage number as quality — whether those criteria would show anything is `ready it for build`, after somebody has agreed
- never letting coverage be reported as validation

### Find out whether a corpus can be built from by somebody who has not read it

*They say:* run a PM review · fresh eyes · would somebody understand this

**Spawn, in order:**

- `newcomer` *(product · judges, writes nothing)* — **one per unit, in parallel** — a product manager handed a URL, who has never seen ProductOS and may not read its source
- `can-the-model-say-it` *(the framework itself · judges, writes nothing)* — whether a confusion is the corpus's fault or ours — the routing this whole route exists to get right

**⛔ You keep these yourself:**

- running the reviewers, which judge and never write
- routing what comes back: a framework gap to us, a corpus finding to the author
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

### Review the framework, not anybody's product

*They say:* review the framework · did we skip a layer · is this the right architecture · can the model say this

**Spawn, in order:**

- `consistency` *(the framework itself · judges, writes nothing)* — whether a concept reached every layer, or stopped at the one that was convenient
- `architecture` *(engineering · judges, writes nothing)* — whether these are the right subsystems with the right boundaries, and whether it would work
- `coverage` *(quality · judges, writes nothing)* — whether each defect we fixed is pinned by something that fails on its own
- `can-the-model-say-it` *(the framework itself · judges, writes nothing)* — whether the model can express a real product, and whether a person can review what it produces

**⛔ You keep these yourself:**

- ⛔ deciding what to change — these four judge the framework and may not touch it
- running it after a change to `src/` or `skills/`, which is when a layer gets skipped
- recording what came back with `productos v2 change`, in the words it came back in

### A surgical change to truth somebody already agreed to

*They say:* rename this · set leads_to · change this one field

**Spawn nothing.** Every part of this is something you may not hand off.

**⛔ You keep these yourself:**

- the edit itself — one field is not worth a context, and a scoper would rewrite around it

⛔ **Every author writes and none may settle.** An author may propose, populate, draw and regenerate; it may never produce a verdict, answer an open question, or mark anything validated. None of them can put a question to a person — deliberately, because consent obtained inside a subagent has no record of how it was obtained. What an author cannot resolve comes back to you as a question, and you put it to the person yourself.
<!-- /productos:preset -->

## ⛔ How confident the corpus is, and the line that cannot move

Every statement has two separate facts, and they must never be read as one scale:

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
derived from the capabilities it declares, and no capability a judge can declare maps to a writing
tool. A reviewer that repairs what it finds hides how often it fires, and how often it fires is the
only measure of whether the model is holding.

⛔ **Never explain ProductOS to the newcomer**, in the prompt or in follow-up. A reviewer who has
been told what a capability is can no longer detect that the corpus failed to tell them. A newcomer
coming back confused about something you could clear up in one sentence is the highest-value result
there is — write it down, do not answer it.
