---
name: productos-exchange
description: Write and settle product truth in the Exchange model — scopes, exchanges, the eight slots, org-wide rules. Use when scoping a feature, answering what is undecided, or preparing a corpus for review. Never use to decide anything on a person's behalf.
version: 0.1.0
---

# The Exchange model — authoring, and walking someone through what is undecided

> The model is defined in `src/v2/schema.ts`, and its comments carry the reasoning for every
> field plus what went wrong before that field existed. **Read it before inventing shapes.**
> Most apparent gaps are deliberate refusals, and mistaking a refusal for an omission wastes
> the session.

⛔ **You author. You never decide.** Every sentence you write is a proposal until a person
performs an act against it. If you find yourself about to write an answer to something nobody
has decided, that is a `standing`, not a `says`.

⛔ **You CAN now record their acts, and that is exactly why this matters more than it used to.**
The five acts used to be unreachable from any tool a model could call. They are reachable now —
`productos_exchange_settle` and friends — because a person answering in conversation, or pressing
a button on a page you rendered for them, is the whole point. What replaced the old guarantee is
one required field:

**`via` — how their consent was obtained.** `page` (they pressed a button on a page showing what
it covered) · `question` (they chose from options in the question interface) · `chat` (they
answered in conversation) · `cli` (they typed it). It is never defaulted and you must never guess
it. Recording `via: page` for something said in passing in chat is a lie about the strength of the
only human signal in the model, and no surface can detect it afterwards.

⛔ **And `because` must be THEIR words.** Not yours, and not the drafted option's argument — that
has its own field and is filled in for you. The reasoning floor exists so a decision is not
relitigated from nothing; a floor you cleared with your own prose protects nothing. If they gave
you one sentence, record one sentence and let the floor refuse it, then ask them for more.

## The shape

```
truth/<scope>.md      a Scope — containers and features are the same thing, nested by `in:`
rules/<rule>.md       an org-wide sentence, with a selector
readings/*.yaml       observations. Never truth.
verdicts/*.yaml       a person's acts. Append-only. You never write these.
```

A **Scope** holds terms, views and exchanges. An **Exchange** is one ask with one answer, and
`asked_by` decides whether a person triggers it (then `at:` names the screen and control) or
machinery does (then `when:` names what hands it over and whether it repeats).

### Every key, so nothing is only ever written by hand

⛔ **A field the skill does not name is a field no session writes.** The schema can support a
concept perfectly and still have it appear only where somebody typed it — which is the
most-missed layer in this repo and is now checked by a test. So, the whole file shape:

```yaml
# truth/<scope>.md
id: deal-list                 # one segment, kebab-case
title: The deals list
in: deals                     # the scope above this one. Absent on the product root only
exists: kept                  # kept | intended | withdrawn — whether the thing is really there
was: cre/deals/deal-list      # where it came from, when a migration or a move renamed it
tags: [cre, table]            # free labels a rule's selector can match on
depends_on: [deal-pipeline]   # scopes this one cannot be built without
terms:                        # the words THIS scope defines, and a rule may select on
  deal: A financing request against one property.
views:                        # the screens. See "Screens" below
  - id: deals-list
    title: CRE Deals
    view_kind: list           # form | list | detail | modal | strip — a rule can select on it
    exists: kept
    walked: false             # ⛔ has a person opened this screen and confirmed what it holds?
    sketch_html: |            # generated — see below. Never typed
      …
    shows:                    # which of this scope's sentences the drawing demonstrates
      - see-the-list#answer#a-deal-with-no-size-shows-a-dash
    parts:
      - id: new-deal-button
        role: commits         # commits | entry | navigates | display | region
        label: New Deal
exchanges:                    # the asks. Eight slots each
  - id: see-the-list
    …
```

⛔ **`exists` is not a status.** `intended` means the thing is not built and everything about it is
intent; `withdrawn` means it was real and is gone, and it stays in the file so the ids it owned
cannot be reused. `kept` is the ordinary case.

⛔ **`walked: false` means nobody has opened the screen.** It is not "I did not get round to
sketching" — it is the difference between a drawing somebody confirmed and a drawing somebody
imagined, and it is rendered on the page in those terms.

⛔ **`tags`, `view_kind` and a part's `role` exist so a rule can select on them** — `tag:`,
`view_kind:` and `part_role:` in a selector. A label nothing selects on is decoration; add one when
a rule needs it, not in advance.

### ⛔ The happy path — what the feature is FOR, and it is agreed first

```yaml
happy_path:
  accomplishes: A parent moves money into or out of a kid's pocket money and both of them can see
    what it is now and where it came from.
  brings: the kid it is for, an amount, and what it was for
  ends_with: the kid's money is different by that amount, and the movement is on the list with its
    reason and the date
  through: [balance, earn-form]     # the screens, IN ORDER — a sequence, not a set
  not: setting up the allowance that runs on its own
```

This is the meat of the feature: what gets accomplished, what the person arrives with, what they
leave with, and the flow. The eight slots are the **details** of it.

⛔ **IT GATES EVERYTHING BENEATH IT.** A feature's behaviours are not offered for agreement until
its happy path has been accepted — `productos v2 accept "<scope>#happy-path"`. Agreeing to a detail
of a purpose nobody has confirmed is the expensive kind of wasted review: if the purpose turns out
wrong, every stamp underneath it was spent on a sentence that is about to change.

⛔ **AND REWORDING IT WITHDRAWS THEM AGAIN.** The acceptance is hashed over the whole happy path, so
changing what a feature is for breaks the stamp and takes every ask in the feature back out of the
queue. That is not friction; it is the reason the gate is worth having.

⛔ **It is not a ninth slot.** A slot answers one question about one ask. This answers "what is this
feature for", which is a question about the feature — folding it into a slot would make it agreeable
at the same grain as the details it exists to frame.

⛔ **A group gets one too, derived.** A container scope renders "how this part of the product fits
together" from the screens beneath it and the `leads_to` of their parts — so record `leads_to`, or
the group's high-level view is a list of screens rather than a flow.

### The eight slots, all required

| | asks |
|---|---|
| `may` | who is permitted to ask |
| `with` | what the asker brings |
| `answer` | what the asker gets |
| `after` | **what is true afterwards that was not true before, whether or not the asker sees it** |
| `refuses` | the named ways it refuses, each with `when` and what the asker is `told` |
| `fails` | what the asker is left with when it cannot |
| `again` | what happens when it is asked twice |
| `at_once` | what happens when two ask at the same time |

**The count is the point.** A blank cell is the mechanism that makes incompleteness visible,
so nothing may be filled in to make a cell look answered. Two fields have erased it before —
`none` on every slot, then `outcomes` on every slot — and both are now keyed to the slots they
actually answer.

#### ⛔ `answer` and `after` are different questions, and conflating them hid a product's whole point

`answer` is what the asker gets back. `after` is what the world now holds. They are routinely
both true and they are not the same sentence.

`after` exists because it did not, and the cost was measurable: deleting *"the amount is added to
what the kid has"* from `money#record-earning#answer` on the pristine seed produced a `check`
output **byte-identical** to the original. The money moving, in a pocket-money product, left the
product truth and every surface said the corpus was fine — while `changes: [money, balance]` went
on claiming the exchange changed money.

So when you author:

- **the state change goes in `after`, never as a clause in `answer`.** If you catch yourself
  writing *"X is added to Y, and the screen shows Z"*, that is two slots.
- **`after: { none: true }`** is the honest answer for anything that only reads. Say it rather than
  inventing a change to fill the cell.
- **`changes:` and `after` are checked against each other.** Declaring terms while `after` says
  nothing changed is refused, and so is the inverse. `changes:` is how another behaviour discovers
  this one can move a word it reads; `after` is what it moves it to.
- **a stated `after` owes a criterion** whose `then` is the new state. The clause with no criterion
  is the one that goes missing without a trace.

Its question is frequently the hard one. The seed's *"is an amount larger than what the kid has
taken off at all, or refused?"* is an `after` question — it sat on `answer` for a whole model
version because there was nowhere else, and every drafted option had to restate the history entry
and the navigation to avoid deleting them. Three facts welded together because only one had a home.

**Do not confuse `after` with `when.follows`.** `follows` is a causal ordering — the ask this one
comes after. That field was itself called `after` until this slot arrived, which is exactly the
collision this warning exists to prevent.

## The product-wide documents

```
charter/<doc>.md      goals · non-goals · principles · personas · voice · decisions
```

A **Charter** document is product-wide truth with **named sections**. Features cite these rather
than restating them, so the citation has to point at something addressable:

```yaml
id: principles
title: Design principles
order: 2
sections:
  - id: report-never-block
    title: Report, never block
    says: >
      Where a figure cannot be read, the row is reported and the work continues. Nothing in the
      pipeline stops because one input is unreadable.
```

⛔ **Sections are named because a person agrees to one at a time.** A reviewer accepts *"report,
never block"*, not "the principles document" — and a document-sized stamp goes stale on any edit to
any part of it, which is how a stamp stops meaning anything.

⛔ **A charter document is NOT a rule, and this is the distinction that matters.**

| | it does | it owes |
|---|---|---|
| `Rule` | supplies or constrains a named slot | a conformance criterion — it is checkable |
| Charter section | settles a design argument, or says what the product is for | nothing demonstrable |

A goal is what the product is *for*. A principle settles an argument without being demonstrable on
any one exchange. Filing either as a rule demands a demonstration nobody can write, and then reads
as governing slots it does not govern — which is exactly what a v1 "principle" did, carrying no
weight at all.

So: if you can name the slot it fills and write a given/when/then for it, it is a `Rule`. If you
cannot, and it still constrains how the product is built, it is a charter section.

## Bringing a v1 corpus across

```bash
productos v2 migrate --from productos --out v2      # add --force to redo it
```

It carries what v1 recorded and **refuses the rest by name**, into `not-carried.yaml`. Read that
file before anything else: it is the real work queue, and every entry needs a person rather than a
better script.

⛔ **A migration decides nothing, and the temptation to make it decide is strong.** v1 recorded only
`answer` — it had no field for who may ask, what they bring, what is left behind, what it refuses,
what a failure leaves, what a repeat does, or what two at once does. On a real corpus that is
**one slot in eight**, and the other seven-eighths come across blank.

An earlier version of this migrator could not bear handing over 643 blanks, so it wrote seven open
org-wide rules — one per unrecorded slot, with a generated question restating the slot's own
definition, `scope: everywhere`. The result: a tool's invented questions gated every real behaviour in
the product, and were presented to the reviewer as their own backlog. Peter's reaction on being
shown it is the shortest summary of the failure: *"it's all generic, org-wide BS?"*

**A blank is a blank.** The count is the finding, and a surface that dresses it up as a queue is
lying about how much of a product has been written down.

## When you do not know

⛔ **This is the part that matters, and the part that gets done wrong.** Write the standing,
never a guess:

```yaml
answer:
  says: >                       # what IS agreed, if anything
    The amount is taken off what the kid has...
  standing:
    kind: open
    about: >                    # REQUIRED beside a sentence: which part is unruled
      whether an amount larger than what the kid has is recorded at all, or refused
    question: Is an amount larger than what the kid has recorded, or refused?
    candidates:                 # DRAFT THESE. Deciding should be choosing, not composing.
      - replaces: the whole sentence   # ⛔ beside an `about`, write the WHOLE replacement
        says: >                 # a BEHAVIOUR — what the product does
          The amount is taken off what the kid has — even past nothing, and their money
          then reads as owed — the act appears at the top of their history dated today...
        consequence: >          # the ARGUMENT for it, and what it costs
          Parents recorded spending after the fact, so refusing would...
    cost: >                     # required once two answers are on the table
      Guessing wrong takes money off a kid that nobody spent, or...
    asked_of: peter
    blocks: []                  # [] means the rest can ship; absent means nobody looked
```

**Draft the candidates, and beside an `about`, draft them WHOLE.** A question with nothing to
choose between is one a person cannot act on, and `decide` will say so. Beside an `about` the
ruling becomes the entire sentence, so an option that answers only the unruled part cannot be
picked — the only exit left is retyping the merged sentence at a prompt, and a reviewer who
took that exit deleted the agreed clauses without any surface noticing. Each candidate's `says` is a *behaviour a builder could
implement*; its `consequence` is the argument. Putting the argument in `says` is the single
most common way to make a question unanswerable.

Four standings: `stated` · `open` · `disputed` · `out_of_scope`. Anything you cannot settle is
`open`. `out_of_scope` costs a recorded act (`v2 waive`) and is **not yours to declare**.

## Rules — where the leverage is, and where each one belongs

Before writing the same sentence on a third exchange, stop. It is a rule:

```yaml
in: family-wallet               # ⛔ WHOSE product. Required unless you mean `everywhere`.
fills: [answer, fails]          # a constrains rule often governs several slots
mode: constrains                # supplies = IS the answer where silent
                                # constrains = adds a requirement to whatever is said
scope:
  asked_by: person              # ⛔ WHOSE ask. Required unless you mean `everywhere`.
  term: money
  acts_on: changes
```

**⛔ A rule declares its reach, and both halves are load-bearing.** Without `in:`, a rule
reached every product in the corpus — one whose `money` meant *the face value left on a
voucher* had its `may` supplied by *"Only a parent may change what a kid has."* Without
`asked_by`, a sentence about what a **person** is told was supplied to machinery: a
clock-triggered exchange promised *"Only a parent may change what a kid has"* about something
no parent touches. Say `everywhere: true` if you genuinely mean it; it is still sayable and it
still means it.

⛔ **`only:` names exchanges one by one, as `<scope>#<exchange>`** — and a hand-typed list of twenty
is copy-onto-every-feature wearing a selector's clothes, which `check` flags. Reach for a dimension
that describes WHY those exchanges are alike (`term:`, `part_role:`, `asked_by:`) before naming them.

`mode` has no default on purpose. A `supplies` rule read as `constrains` bolts a requirement
onto stated answers; a `constrains` rule read as `supplies` governs almost nothing, because
any exchange that states its answer escapes it.

**A rule can itself be an open question** — give it a `standing` and omit `statement`. That is
the highest-leverage question a corpus can hold: one ruling settles every exchange the
selector reaches, including ones nobody has written. Asking the same question on four
exchanges instead guarantees four different answers.

If an exchange's own sentence lands where a rule would, say which: `defers_to` (the rule still
holds, this is narrower) or `instead_of` (it does not hold here). `check` asks for one of them;
guessing is the one thing that is refused.

### A rule belongs to a group, and most rules are not org-wide

```yaml
in: versioned-inputs
scope:
  under: versioned-inputs       # ⛔ everything filed under this group, and nothing else
  acts_on: changes
```

`under:` scopes a rule to one part of the tree. The page renders it on that group under
**"What holds everywhere in <group>"**, and it counts as that group's own unanswered question
until somebody rules it — not as a decision the whole company owes.

**⛔ ASK "WHAT HOLDS ACROSS THIS WHOLE GROUP" AT EVERY GROUPING, NOT ONLY AT THE TOP.** This is
the most-missed authoring move in the model and it was invisible until the counts stopped
rolling up: a real 34-scope corpus had **zero** rules, so every grouping stated nothing, and
the rolled-up number on each row made it look like it had something. `productos v2 check`
reports the groupings that state nothing across them.

A group rule is the cheapest thing in the corpus to review — one sentence, agreed to once,
holding for every feature filed under the group *including ones written next year*. The same
sentence copied onto nine features is nine reviews, nine chances to diverge, and nothing that
notices when the tenth feature forgets it.

**⛔ But do not manufacture one.** Plenty of groupings are only filing and owe nothing. A
grouping that genuinely states nothing should say so; inventing a rule to fill the blank is
how seven generic org-wide questions once ended up gating every behaviour in a corpus, none of
which mattered to the product. Ask the question at every grouping; accept "nothing" as an
answer.

**Where a rule lands is derived, not declared twice.** A rule belongs to the narrowest scope
containing everything its selector reaches. Reach the whole product and it is genuinely
org-wide — reported once, in the shared queue, not on every row.

## Screens

A `View` is where a person's ask arrives: `sketch` (interface structure in ASCII — where things sit
and what kind of thing they are, never colour or type), and `parts` with a `role` each.

⛔ **`commits` is the only role that owes an exchange.** An `entry` part's accepted values belong to
the `with` slot of whatever commits it, and a `navigates` part is fully described by `leads_to`. A
migration that assigned `commits` to anything with a claim attached turned every search field and
filter into an ask of its own — say which role a control has by what it does, not by what somebody
happened to record about it.

### The sketch is a working prototype, so write it like one

The page turns the sketch into the control surface: every part is a button a reviewer can click to
see what the product promises there, and a part with `leads_to` walks to that screen. Three things
make that work, and all three are authoring:

**⛔ Put each part's `label` in the sketch verbatim.** The wiring finds a part by looking for its
label in the drawing. Whole words only, at both ends — a part labelled *"No deals yet"* once bound
itself to the `No` inside `Northgate` and clicking a deal row reported on the empty state, so a
single word shorter than five characters is not accepted as a match at all. An abbreviated label
still matches on its leading words (`Clear` for `Clear filters`); a renamed one does not match and
is listed under *"parts the drawing does not show"*, which is a visible admission that the drawing
and the parts disagree.

**⛔ Anchor a behaviour at the control it happens at**, not just at the screen:

```yaml
at:
  view: deals-list
  part: deal-row          # ⛔ the card can now say "show me the deal row" and take them to it
```

Without the part, a card reads *"Deal row on CRE Deals — refuses"* with nothing to look at, which
is unjudgeable — and was the exact complaint that made this exist. In a real 47-exchange corpus 21
named a screen and **7** named a control; `productos v2 check` reports the controls no behaviour
says anything about, which is where the holes are.

### Generate the screen from the codebase — `sketch_html`

⛔ **Prefer this to ASCII wherever there is code to read.** ASCII is for a screen nobody has built
and nobody has designed. If the application exists, the screen can be rendered in its own markup
and its own CSS, and the difference is not cosmetic: a reviewer looking at a wireframe is asked to
imagine the product, and what they agree to is their imagination.

```yaml
# productos/config.yaml
web:
  components_dir: frontend/app/components
  stylesheets:                              # inlined into the page, in cascade order
    - frontend/design-system/src/tokens.css
    - frontend/design-system/src/themes.css
    - frontend/design-system/src/typography.css
    - frontend/design-system/src/styles.css
    - frontend/.next/static/chunks/*.css    # ⛔ a glob: build output is content-hashed
```

⛔ **GENERATE IT. DO NOT TYPE IT.**

```bash
productos v2 draw "<scope>#<view>" --route <the component that renders it> --into <corpus>
```

It reads the route, inlines the primitives it composes, binds the props the call site passes, and
writes the drawing into the corpus. **Re-run it after the component changes** — the drawing is
output, and output is regenerated.

⛔ **A hand-typed drawing is the single most-repeated mistake in this repo.** It cannot be
re-derived when the application changes, so it is wrong the day after it is written and nothing
says so; and when somebody reports that a screen is wrong, the shortest path becomes typing it
again, which leaves the next corpus and the next session with nothing. If `draw` produces the wrong
drawing, **the defect is in `draw`**.

What it cannot do, and says so: it transforms source, it does not run it. An expression behind a
hook, or a third-party icon, becomes a marked placeholder — hatched on the page — rather than a
guess. A drawing that is mostly placeholders is a thin drawing, and the count is printed when it is
made.

Then:

1. **Say which element is which part**, with `data-part="<part id>"`. The renderer falls back to
   matching the part's label in the text, and to `placeholder` / `aria-label` / `title` on inputs,
   but an explicit attribute is the only way that cannot be guessed wrong.
2. **List what the drawing shows**, in `shows:`. `check` reports the sentences anchored at a screen
   that its drawing does not claim to demonstrate — which is how "this screen is thin" becomes
   something the tool says rather than something a person has to notice.
3. **Never real customer data.** The page gets published.

⛔ **The mock renders in a shadow root with the app's CSS inside it.** That is what stops Tailwind
restyling the review page. Two consequences worth knowing: a design system defining tokens on
`:root` is rewritten to `:host, :root`, because `:root` does not match inside a shadow tree; and a
stylesheet using `@import` will not work, because an import is a fetch and the CSP blocks it — name
the imported files in the list instead.

⛔ **`@import` and remote fonts are dropped, and stylesheet paths are reported.** A mistyped path
produces a mock with the right class names and browser-default styling, which reads as a badly
written mock rather than a stale config line — so `publishable` prints what it loaded and warns
about what it could not find.

A published page **cannot** reach the running application: a strict CSP blocks every external host,
so there is no iframe of localhost and no fetch from the dev server. A prototype here is built from
what the corpus says, which is also why it still works a year later.

### A control the product promises nothing about

Clicking one says so, in those words. That is not a formatting choice: a control a person can press
that no behaviour describes is decided by whoever builds it, and it is invisible in any list of what
IS written. Either state what it does, or mark it `decorative: true`.

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

### Driving it in a browser instead

`productos serve` puts the same page at `/v2`, with buttons that record on this machine. Nothing
leaves it, so this is the only surface for a corpus that must not be published — and product truth
routinely names a real client.

### A published page, with buttons, inside Claude

`productos v2 publishable <scope> --by <them>` emits a page whose presses land in an artifact's
database. It **refuses unless that corpus is marked publishable**, because publishing copies the
truth to claude.ai. Do not argue with the gate; tell them what it said.

See `WATCHING_PRESSES.md` for reading presses back and turning them into truth.

## The reviewers, and what each one asks

```bash
productos v2 agents            # what each asks, why it exists, which model runs it
```

⛔ **You cannot review your own work.** By the time you have written a corpus you know what it
meant to say, so your reading of it is worth nothing as evidence that it communicates — and after
a few exchanges there is no reader left in the session who has not been told the answer.

Each reviewer answers **one question about the whole**, which is why none of them is scoped to a
file:

| Agent | Asks |
|---|---|
| `productos-consistency` | is every concept in every layer it needs to be, or in one and nowhere else |
| `productos-coverage` | is each defect pinned by something that fails on its own |
| `productos-generated` | is anything hand-authored that a generator should have produced |
| `productos-truthfulness` | does the corpus say what the code actually does |
| `productos-newcomer` | could a PM handed this build from it |
| `productos-architect` | are these the right subsystems with the right boundaries |
| `productos-framework` | can the model express a real product, and can a person review it |

⛔ **Every one of them judges and none may write.** Enforced at install: the tool list is derived
from declared capabilities and no capability a judge can declare maps to a writing tool. So a
reviewer physically cannot fix what it finds — which is the point, because how often a reviewer
fires is the only measure of whether the model is holding.

⛔ **Never explain the model to the newcomer**, in the prompt or in follow-up. A reviewer who has
been told what a capability is can no longer detect that the corpus failed to tell them.

⛔ **Route what comes back.** "There was nowhere to record X" is a framework gap and belongs to us.
"I could not tell whether X" is a finding about the corpus and belongs to its author. Getting the
direction wrong is costly both ways: one sends somebody to rearrange a corpus that has no correct
arrangement, the other buries a real fix in a backlog.

Which model runs each is the project's choice, in its own `productos/config.yaml`:

```yaml
agents:
  default_model: sonnet
  model:
    truthfulness: opus        # this one reads the code as well as the corpus
    consistency: opus
  effort:
    truthfulness: high
  off:
    architecture: reviewed by hand here — one promise per subsystem already
```

⛔ **`off` removes the agent**, it does not merely skip it. An agent a project has switched off and
left on disk is one the host can still run while the config says otherwise.

## Before handing anything over

```bash
productos v2 check              # must exit 0
```

It refuses a corpus whose acceptance no longer covers what it stamped, a sentence that
displaces an org-wide rule without saying which way, two exchanges on one control, a criterion
asserting more than its slot, latitude nobody granted, and a dozen more. Every refusal names
what to do. **Do not work around one** — if a refusal has no honest answer, that is a finding
about the model and worth saying so.

## Notes — what somebody asked to be changed

```
notes/notes.yaml      requests, append-only. Not truth, and not verdicts.
```

```bash
productos v2 notes                                     # what is open, and what each was raised against
productos v2 notes --all                               # including the ones dealt with
productos v2 notes add "<what should change>" \
    --about <ref> --by <who> --via page|question|chat   # file one
productos v2 notes done <id> --outcome "<what you did>" # close it
```

```bash
productos v2 watch --at <corpus>   # ⛔ blocks. says nothing until somebody records something
```

A press on the **served** page writes to disk, so `watch` hears it — run that rather than asking
repeatedly whether anything has happened. A press on a **published** page writes to the artifact's
database instead and has to be carried in; `WATCHING_PRESSES.md` has both, and says why polling a
published page is the option of last resort.

A **note** is a request: *"the tab strip should also show the pinned version"*, *"this sketch is two
releases out of date"*, *"this behaviour belongs on the other screen"*. It carries `about` — the ref
the person was looking at when they wrote it — because that is the part nobody can reconstruct an
hour later.

⛔ **A note is not product truth and not a verdict.** The five acts record a judgement about a
sentence; a note records a request to change one. Filed as either, a request reads as a decision —
a packet would ship *"the tab strip should show the pinned version"* as something the product does,
under whatever stamp covered the slot it landed in.

⛔ **Acting on one is authoring, and it is your job.** Read the note, make the change to the truth,
then close it saying what you did. `state: done` with no `outcome` is refused by the schema,
because a closed note with no account of what happened cannot be told apart from one somebody
dropped.

⛔ **Never answer a note by editing the note.** If the request is wrong, or you cannot do it, say so
in the outcome and leave the truth alone — the note is the record that somebody asked.
