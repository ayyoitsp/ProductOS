# CLAUDE.md

Working rules for this repo. ProductOS is the product; the corpora it generates
(`demo/productos/`, any consumer repo's `productos/`) are its **output**.

---

## ⛔ Feedback on the output is a bug report against ProductOS

**Any complaint about generated product truth is a request to change ProductOS so it
generates correctly. Never fix only the output.**

If Peter says a feature reads thin, that an area page shows filenames, that a concept is
missing, that a graph does not render, or that something belongs on a different screen —
the output is the *symptom*. The defect is in the schema, the renderer, or the skill that
wrote it.

**Three steps, every time, in this order:**

1. **Fix ProductOS.** Whichever layer is actually wrong:
   - `src/core/product.ts` — the concept does not exist in the schema
   - `src/core/*.ts` — the derivation or state model is wrong
   - `src/ui/renderer.ts` — it exists but is not shown, or is shown in the wrong place
   - `skills/*/SKILL.md` — **the authoring instructions.** Easiest to forget and the
     most consequential: the schema can support a concept perfectly while every future
     session keeps writing the old shape, because the skill never mentions it.
2. **Re-run ProductOS** to regenerate the output. Do not hand-edit the corpus into the
   desired shape and call it done — that proves nothing about what the next session will
   produce.
3. **Verify the regenerated output matches the desired shape.** Not the version you
   patched by hand; the version the tool just produced.

**Why:** a hand-patched corpus looks identical to a fixed one and is worthless. The next
scope run in any repo regenerates the original defect, and now there are two shapes in
circulation with nothing recording which is correct.

### The skills are the most-missed layer — and it is now a test, because prose failed

```bash
npm test -- test/framework-not-just-output.test.mjs
```

It walks every field of every object an author writes and fails if the skill does not name it.
A schema field no skill writes is a field that only ever appears where someone typed it by hand.

**This test exists because the rule above was violated four times in one session**, each time the
same way: feedback arrives about a rendered corpus, the corpus gets edited, the complaint goes
away, and nothing about ProductOS changed. Prose with a ⛔ on it did not stop that. A failing
build does.

## ⛔ He drives through ProductOS now, and `pos:` means the framework

Peter: *"i'm going to drive things mostly through product OS now, but let's add a 2-way window so
you can send messages back as well. if i tag pos: {blah blah} in the message, that indicates a
framework issue and to fix the framework issue (agent setup), and you respond concisely that it has
been updated or fixed"*.

**The page is the conversation, not a one-way request form.** The composer files a note; the window
above it shows the thread for whatever he is looking at — his words and the answers to them. Reply
where he is standing:

```bash
productos v2 notes say <id> --says "…"          # reply, leave it open
productos v2 notes done <id> --outcome "…"      # the last reply, and close
```

| He typed | It is | What you do |
| --- | --- | --- |
| `pos: …` | a **framework** issue — ProductOS itself, the agents, the generators, the checks | fix the framework, then reply **concisely**: what was updated or fixed |
| anything else | a **corpus** request — what the product truth says | fix the truth, reply with what changed |

⛔ **The tag sets `Note.kind`; nothing infers it.** A classifier reading the sentence would be a
guess wearing a decision's clothes, and this is the distinction the top of this file opens on —
backwards in either direction is expensive.

⛔ **Concise means concise on a `pos:` note.** He is reviewing a product, not reading a changelog.
One or two sentences saying what now happens differently. The full account belongs in the commit
and in `productos v2 change`, which is where it already goes.

⛔ **Still every layer.** A `pos:` note is feedback like any other: record it with `v2 change new`,
quote him verbatim, and reach every layer its kind demands. Replying "fixed" without the cascade is
the same defect this file has been fighting since the first line of it.

---

### ⛔ Record what he said, then drive it — `productos v2 change`

```bash
productos v2 change new "<his words, verbatim>" --kind concept|derivation|surface|generator|instruction
productos v2 change check <id>      # layer by layer, by looking
productos v2 change close <id>      # refused while any layer is unreached
```

The kind routes to the layers that kind must reach; each is verified by looking for a named thing
in the file that would hold it; `close` refuses while one is short. Waiving a layer needs a reason
somebody could argue with.

**Quote him. Never paraphrase.** A summary is where the requirement quietly becomes the thing that
was convenient to build — "screens overall are very thin" rendered as "improve the screens" loses
the only part that was checkable.

On its first real run this caught a layer I had skipped in the previous commit: a group's
high-level view, built and rendered and driven in a browser, with nothing asserting a line of it.

### ⛔ Read what the record already says — `productos learn`

```bash
productos learn        # what seventy corrections say about how this project works
```

Peter: *"we should have product OS self improve from the get-go. all the feedback it receives we
should record and figure out how to improve the agents."* Recording was done long ago; **reading it
was not.** Nothing looked at seventy change records and noticed that four were the same mistake —
that was found by a person remembering, which is how `walked:` survived its own deletion for months.

This is the half that needs no model, and it is arithmetic, so it cannot be wrong about what it
counted. Today it answers: **`derive` and `check` are each waived eleven times** against eight for
the next — the layer whose absence makes every other layer unfalsifiable is among the two this
project most often argues its way past.

⛔ **It reports and writes nothing.** A finding goes to one of exactly two places, and both need a
person:

| the lesson is | where it goes |
| --- | --- |
| universal | `productos v2 change new "<what was said>" --kind instruction` — through the same cascade every piece of feedback goes through |
| true of this project only | `productos v2 steer new "<the habit>" --steers generation --learned-from "<the records>"` |

⛔ **An agent does not edit its own instructions, and it is structural rather than a rule.** The only
route from a noticed pattern to a framework change is a change record, which requires `said:` —
somebody's verbatim words. A pattern has no words of its own, so it cannot author an instruction
change without quoting the human corrections it was drawn from.

### ⛔ What this project has learned — `productos v2 steer`

```bash
productos v2 steer list                                   # habits in force, and where each came from
productos v2 steer new "<the habit>" --steers generation --learned-from "<what you noticed it in>"
productos v2 steer decline <id> --because "<why it is not a rule here>"
```

A **generation** steer reaches every author's instructions, at install and when a screen is proposed
— so after writing one, `productos init claude --update`. ⛔ **And no judge ever gets one**: a
reviewer told what this project likes can no longer notice the project is wrong. They are visible on
the page under **What steers this**, which is a settings surface and deliberately not the charter —
nobody agrees to a habit.

⛔ **Declining keeps it.** Deleting a learned steer ends nothing: the pattern it came from is still
in the record, and the next read learns it again.

### ⛔ If it can be generated, generate it — hand-authoring is the trap

The specific thing that went wrong four times was hand-writing screens into a corpus. A typed
artefact cannot be re-derived when the source changes, so it is wrong the day after it is written;
and when somebody says it is wrong, typing it again is always the shortest path.

```bash
productos v2 draw "<scope>#<view>" --route <component> --into <corpus>
```

**When a generated thing is wrong, fix the generator.** Ask, before editing any corpus file:
*could a command have produced this?* If yes, the edit is the bug.

---

## The reviewers

`AGENTS.md` — **generated from `src/core/jobs.ts`**, never edited. Seven reviewers, each asking one
question about the whole system; four of them exist because of failures in this repo that no
file-scoped review could have seen.

```bash
productos v2 agents                    # what each asks, and which model runs it here
productos v2 agents --out AGENTS.md    # regenerate the document
```

⛔ **Every one judges and none may write** — enforced at install, because an agent's tools are
derived from the capabilities it declares and no capability a judge can declare maps to a writing
tool. ⛔ **And none names a model**: that is the project's choice, per agent, in its own config.

## ⛔ You cannot review your own explanations — run the newcomer

By the time you have written a corpus you know what it meant to say, so your reading of
it is worth nothing as evidence that it communicates. Same for these docs. The only
useful reader is one who has never seen ProductOS, and after a few exchanges there is
no such reader left in the session.

So the check is a subagent: `productos-newcomer` (installed to `~/.claude/agents/`) is
a product manager handed a URL and told to build from it, with **no knowledge of
ProductOS and an explicit prohibition on reading OVERVIEW, GLOSSARY, EXAMPLE, the
skills or the source.** The `check it communicates` route runs a few of them in parallel
and routes what comes back.

**Never explain ProductOS to one, in the prompt or in follow-up.** A reviewer who has
been told what a capability is can no longer detect that the site failed to tell them,
and a leading prompt turns the run into a confirmation of what you already believed. A
newcomer coming back confused about something you could clear up in one sentence is the
highest-value result available — write it down, do not answer it.

Run it after a fullscan, after changing the model, and before asking anyone to review a
corpus. Then route every finding: *"there was nowhere to record X"* is a framework gap,
*"I couldn't tell whether X"* is a corpus finding. See the table in that skill.

## Framework gaps — the record of what the model can't express

A **framework gap** is a TODO addressed to us, recorded in
`<repo>/productos/framework-gaps.yaml`. It is not a user-facing concept and is
deliberately absent from `GLOSSARY.md`.

| | Says | Who fixes it |
| --- | --- | --- |
| **Audit finding** | your corpus has a mistake | the author |
| **Framework gap** | the model has no way to say this | us |

Getting the direction wrong is costly both ways: reporting a framework gap as an author
mistake sends someone to rearrange a corpus that has no correct arrangement; reporting
an author mistake as a framework gap buries a real fix in our backlog.

```bash
productos todo          # read the open gaps
productos todo add "<what the model can't express>" \
  --costs "<what somebody CANNOT DO, and what they do instead>" \
  --forced-into <where it went>
productos todo close <id> --resolution "<what changed>"   # ⛔ never by hand — see below
```

⛔ **`--costs` is required, and it is the field a reader can check.** Peter, reading his own
backlog: *"i really don't understand what fg-0001 is, wtf are these descriptions?"* then *"tell me
the actual IMPACT, not a wordy thing about holding slots.. none of that makes sense"*.

`what` is written by whoever hit the gap, in the vocabulary of the layer they were standing in — "a
slot holds one standing", "`of:` names one existing statement". Accurate, and unreadable. And
unreadable has a consequence: re-reading the records to ask *"is this still true?"* costs enough
that nobody does, so **two of four gaps were fixed and still read `open` — both closed earlier in
the same session that recorded them.** A backlog where half the entries are false agrees with
whatever was believed when it was written.

So `--costs` names the act somebody cannot perform and what they do instead, written for a reader
who did not hit it: *"you get asked about one sentence at a time, so a slot saying eleven things
takes eleven round trips."* That can be **checked by trying it**. `what` cannot — verifying it
means reading the source, which is the cost that let two records rot.

⛔ **And closing one is a command, never a hand-edit.** `settleFrameworkGap` rewrites the file from
the parsed records, so invented keys are silently dropped — a closure written by hand as `how:` and
`closed_by:` survived until the next `todo close` rewrote the file, and then vanished with no trace
that anything had been said. Same rule as everywhere else here: if a command produces it, the edit
is the bug.

**`forced_into` is the load-bearing field.** It names the compromise, so the corpus can
be corrected in one pass once the gap closes — instead of the compromise quietly
becoming the convention.

**Record one before you write the approximate version, not after.** A hand-placed
compromise looks correct, so the evidence that the framework was deficient disappears
and the same hole gets rediscovered from scratch next session. The skills have always
said "don't paper over ambiguity"; that instruction alone has repeatedly not been
enough, which is why recording one comes before the approximate version, not after.

## ⛔ Product truth is the target state — never gate it on what exists

`GLOSSARY.md` and `OVERVIEW.md` both say it now; this is the operational form.

**A corpus may never require code to exist.** Screens are truth, so a screen is the screen the
product *should* have. The codebase is one way to **populate** a corpus, never what it is tied to,
and comparing target against built is **drift** — downstream, separate, and never authority.

- A deleted component is **evidence about the product**, not proof the truth is wrong. Report it and
  ask; do not refuse the corpus, and never pressure an author into withdrawing target state to make
  a check pass.
- A screen with no picture is a real defect. A screen with no *component* is not. Generate the
  picture — from code where code exists, from the truth and the design system where it does not.
- Whether something is built is not a fact about the target. Do not read `exists: intended` as
  permission for a truth-level gap, and do not ask an author to set it to get target state accepted.

**Why this is here:** OVERVIEW said "a record of what your product does" four lines above "not a
report on what was built" and resolved it nowhere, while the only explicit statement about the
corpus-to-code relationship was a reviewer asking *"does the corpus say what the code actually
does?"*. A session inherited the code as the standard and shipped a check refusing any screen not
drawn from a component. Nothing in the docs contradicted it.

## The output is product truth; keep the substrate out of it

Nothing a reader sees should mention the storage. No `.md` filenames, no table or column
names, no directory paths, no ticket numbers, no branch names. The hosted service has no
files at all — anything file-shaped on a product-truth page is a leak, and usually a sign
that a real concept is missing a field and got smuggled into prose.

When something true has nowhere to live, **add the field**; do not write it as prose.
Both of these started as prose workarounds and became schema:

- promise-vs-screen → `kind: feature | capability`
- open questions → `question:` on a behavior, with no claim

---

## Every fact has exactly one home

Other places reference it; nothing restates it. This is the primary lever on review cost.
Two renders of the same source answering *different questions* is fine — a feature page
answering "what must I not assume here" and an area page answering "what is undecided in
this area" are projections, not copies. Two hand-maintained lists of the same fact are
not.

---

## Don't restate lifecycle or validation in prose

Lifecycle is `status:`. Validation is a human stamp. Prose carrying either becomes a
second record with no forcing function, and it rots silently — a reader cannot tell which
of the two is current.

---

## ⛔ Run `productos v2 check` before asking anyone to review a corpus

```bash
productos v2 check --at <corpus>   # structure + every refusal + reference resolution
```

**A corpus was handed over for review that contradicted the documented model in four
ways at once**: ten capabilities rendered as a flat list of operations with no subsystem
named anywhere, a whole product filed as a single area, a boundary statement filed as an
operation, and nav links to pages that 404ed. Every one of those was visible from the
corpus alone, and an author is the worst possible person to notice them.

So the structural claims the docs make are checked mechanically, and the check runs
before the handoff — not after somebody's patience runs out.

It refuses: a product, area or capability system with no description; a container at the
wrong depth; any high audit finding; a `depends_on`, `affected_by` or `leads_to` that
resolves to nothing.

## ⛔ The environment convenient to measure in is not the environment the thing lives in

Peter, pressing Add on the live page: *"Not saved: Not Found"*.

**Three defects in two days, same shape: the code was right about the place it was tested and
wrong about the place it runs.**

| what was measured | where it was wrong |
| --- | --- |
| every page write, against the local stack | local serves at `/`, hosted serves under `/p/<project>/` — seven root-relative urls, including the composer and the live connection, 404ing on the only page he reviews on |
| the side menu, in the default headless window | its rules live inside `@media (min-width: 62rem)`; the window was narrower, so a correct page measured as broken |
| the config, from a corpus directory | reachable above a corpus and not above a temp dir, so a fixture behaved unlike a repo |

⛔ **The first one is the expensive one and it is the one nothing could see.** Browser tests replace
`fetch` and assert on what a handler SENDS, so a wrong url passes — they would go green on
`/nonsense`. A parse check reads the script. `tsc` cannot see inside a template string. And the
stack anybody develops against is the one where the bug does not exist.

⛔ **So a measurement carries its conditions.** "A matcher is a claim about the shape of the thing"
needs the second clause: it is also a claim about the conditions under which that shape exists, and
a default — a window size, a serving path, a working directory — is a condition nobody wrote down.

**What this costs in practice:** verify against the shape the thing actually ships in. A route
checked by curl against a path you typed says nothing about a page that builds a different one; a
layout checked at whatever width a headless browser opens at says nothing about the layout that
only exists above a breakpoint.

## ⛔ A zero proves nothing unless you can say what a failing zero looks like

Peter: *"why aren't you just looking at all variable substituion? are you just searching for 'n"?
what the heck?"* — a count that measured the wrong thing and agreed with what I wanted to be true.

**Six times in one week, two sessions, the same shape: the measurement agreed with the hypothesis,
so it was never checked.** The ones that cost time:

| the number | why it was meaningless |
| --- | --- |
| `grep -c` read as occurrences | it counts **lines**, so 300 placeholders on one line read as 1 |
| 972 unresolved selects | from a sweep that had stopped happening that way two days earlier |
| a clean deploy log | `--since` matched nothing and silently printed an empty 2037-line outage |
| 0 grey icon squares | the CSS rule that would have drawn them had been renamed |
| 0 `data-held` on the page | the attribute is **omitted** when absent — so 0 is also what shipping nothing produces |

The last one is worse in kind than the other four, and it is the rule: **for a feature whose correct
answer today is zero, a zero is not a weak check, it is not a check.** There is no failing state in
that observation at all. Same family as the guard in #95, which passed at the commit where its own
defect was live.

**So produce a non-zero somewhere.** Exercise the shipped module until it answers differently for
cases that differ:

```
no acts at all              held: false
a reading by a person       held: true     ← the one that cannot happen by accident
a reading by the generator  held: false
```

Three distinguishable outcomes, out of the deployed build. That probe also independently caught the
real bug in the feature it was verifying — the generator holding a screen against its own reading.

⛔ **And when the numbers are mutually impossible, stop counting and look at one instance.** Every
one of the six survived because the next step was another aggregate. Reading a single combobox is
what found `Blue Harbour`; reading a single `.yaml` is what found eight screens held by nobody.

## Verify by running, not by reasoning

A rendering claim that was never rendered is a guess. **For renderer changes, there is a
test harness that renders in a real browser** — `test/support/chrome.mjs`, used by
`test/v2-the-mock-in-a-real-browser.test.mjs`:

```bash
npm test                              # includes them wherever Chrome is installed
PRODUCTOS_REQUIRE_BROWSER=1 npm test  # absence of a browser becomes a failure, not a skip
PRODUCTOS_TEST_BROWSER=/path/to/chrome npm test
```

It drives the Chrome already on the machine over the DevTools protocol — no dependency, no
downloaded browser, no postinstall. It asserts **computed style**, never markup.

⛔ **Markup assertions would have passed on every bug this exists for.** Three defects in one
session lived entirely inside a browser and all three were found by hand, late, after Peter
said the drawings looked nothing like his product:

| what broke | why nothing saw it |
| --- | --- |
| the stylesheet was read with `innerHTML`, which HTML-escapes | every rule with a child combinator came back unparseable and was dropped in silence — 828 rules reached the mock and not one had a `>` in it |
| `@property` is document-scoped, not shadow-scoped | `border-style: var(--tw-border-style)` resolved to nothing, so every bordered box drew as a bare underline |
| a page written to own a viewport | kept `min-height: 100vh` and 72px of page padding inside a 450px pane |

⛔ **And a DOM emulator is worse than nothing here.** jsdom and friends do not resolve a
cascade, do not implement `adoptedStyleSheets` and do not register `@property`. They would
have passed on all three — a green test asserting the opposite of the truth.

⛔ **A test that cannot fail is not evidence.** Each of those three was verified by putting the
defect back and watching the test go red. Do that for any new one: a renderer test that has
never failed has not been shown to test anything.

### ⛔ A test never calls `mkdtempSync` — it calls `temp()`

```js
import { temp } from "./support/temp.mjs";
const dir = temp("productos-thing-");   // removed when this file's process exits
```

**The suite left 58,932 directories in the system temp root — 95% of everything in it.** One
throwaway corpus per `fs.mkdtempSync`, over ten days, because 45 of 74 test files never removed
what they made.

It was not merely untidy. `drawFromRoute` indexes a route's neighbourhood to resolve `<Wizard/>`,
and a route in `/var/folders/…/T/draw5-x/` has the temp **root** one level up — so the suite's own
litter became the suite's input: 61,520 directories given a recursive descent to yield four `.tsx`
files, 52 seconds a call, 216 seconds in one test, 13 minutes for the run.

⛔ **And a trailing `rmSync` is not the fix — that is what the 29 well-behaved files already did.**
It sits at the end of the test, so it is not reached when an assertion fails, and a red run litters
exactly like an unfixed one. `temp()` reaps at process exit, which does not care how the process
got there.

⛔ **It is a test, not a convention** — `v2-tests-clean-up-after-themselves` fails if any file under
`test/` calls `mkdtempSync` itself. Every one of those 74 files was written by somebody who could
have cleaned up; 45 did not. Same reason `framework-not-just-output` exists: prose with a ⛔ on it
did not stop this.

---

## Versions stay at 0.1.0

Skill `version:`, `package.json`, anything stamped. No increments during the design phase
unless Peter says so explicitly.

## ⛔ Deploy every time. Deploys are cheap; batching them is not

Peter: *"don't ever do this again --> 'the code for it still needs a deploy, which I've not
re-requested since they've just done one.' deploys are cheap, why would you waste my time not
deploying"*.

**Every merge to main gets deployed, immediately, without being asked.** Not batched, not held
back because one went out an hour ago, not deferred to spare anybody the trouble. A merged change
that is not live is a change he cannot look at, and the whole point of the loop is that he can.

⛔ **And a deploy is not finished when the code ships.** `sketch_html` is persisted truth, so new
drawing code changes nothing already stored — see `fg-0002`. Shipping the code and stopping leaves
every drawing exactly as the previous generator left it, and the tick is true.

⛔ **But the two halves have different owners, and they must not blur.** The deploy session said it
plainly, about this rule: *"I DO NOT REDRAW. Those are an author's acts on product truth, and this
session deploys code. Otherwise a deploy session is rewriting truth without a person, which is the
one thing the corpus is careful not to do."* Right, and the wording here used to imply otherwise.

| | who | what finishes it |
| --- | --- | --- |
| **the code** | the deploy session | it is live, and here is a number read off the page |
| **the drawings** | the author — you | `v2 draw --all`, `v2 prototypes`, `v2 style`, `hosted import` |

**Do your half in the same breath as the merge**, and then check a number on the live page that
would be different if it had not worked — not that the page returns 200.

## After changing `src/` or `skills/`

```bash
npm run build && productos init claude --update       # from the main checkout
npm run build && node bin/productos.js init claude --update   # ⛔ from a worktree
```

So Peter's other sessions pick the change up immediately. Never ask him to run install
commands.

### ⛔ From a worktree, `productos` is the wrong binary — for every verb, not just installs

The global `productos` is an `npm link`: `lib/node_modules/productos` is a **symlink to the main
checkout**. So it runs whatever branch that one checkout happens to be on, no matter which directory
you invoke it from — and its registry, not yours, decides which roles exist.

What that cost: an `init claude --update` run from a worktree, served by a main checkout sitting on
an unrelated feature branch, **deleted `productos-decomposer` and `productos-demonstrator`** from the
worktree (the stale registry has no such roles, so pruning read them as renamed) and **reverted
`productos-scoper.md`** to the `criteria` section removed after *"a product person doesn't write a
criterion - what even is this? this is old shit."* Silently, inside the normal path, reported as a
successful install. It looked exactly like somebody deleting two files by hand.

⛔ **This is now refused rather than written** — installing one ProductOS checkout's roles into a
different ProductOS checkout throws before anything is written or removed, and the message names both
trees. `node bin/productos.js` runs *this* worktree's build, which is what you want anyway. Installing
into a **consumer repo** is unaffected: that is what the installer is for, and such a repo has no
`agents/` of its own to lose.

⛔ **And it is not only `init`. `productos v2 change check` gave a false ✗** on a layer that had been
reached: the global binary runs the main checkout's registry, and on that branch `src/v2/analyse.ts`
was not yet listed as a `derive` file — so the layer that owns it was never searched. Same command
through `node dist/cli/index.js` reported every layer reached.

A false ✗ is the *safe* direction and it still cost time. The unsafe direction is the same mechanism:
a layer this build knows about, verified against a registry that does not, reports **✓ for a file the
running code never reads**. So from a worktree, reach for the local build for anything that reads the
registry or the source — `change`, `check`, `analyse`, `agents`, `init`.

---

## Planning docs are private

Design and strategy notes live in `planning/` (gitignored). The public repo stays clean.
