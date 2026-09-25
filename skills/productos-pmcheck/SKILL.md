---
name: productos-pmcheck
description: Use when the user wants to know whether a ProductOS corpus actually communicates — "run a PM review", "would a PM understand this", "find framework gaps", "fresh eyes on the product truth". Spawns fresh-eyes product-manager subagents with NO ProductOS knowledge against the rendered site, then routes what they report into framework gaps (for ProductOS's developers) and feedback entries (for the corpus author). Run it after a fullscan or before asking anyone to review.
version: 0.1.0
---

# ProductOS — PM Check (does this corpus actually communicate?)

Everyone who reviews a corpus already knows what it meant to say. That is the problem
this skill exists to solve: **the only reader who can tell you whether the truth
explains itself is one who has never seen it**, and after five minutes of explanation
no such reader is left in the conversation.

So the review is done by subagents who are never told what ProductOS is, and your job
is to set them up, keep them ignorant, and route what comes back.

You are running this **because you cannot do it yourself.** You know the vocabulary.
Do not read the corpus and write the report — the finding you would produce is
"everything is clear", every time.

## ⛔ The one rule that makes this work

**Never explain ProductOS to a reviewer, in the prompt or in follow-up.**

Not the model, not what a behavior is, not what the tabs mean, not "it's fine that
capabilities have no screens". The moment a reviewer knows any of that, they stop
being able to detect that the site failed to tell them — and a leading prompt is how
this review turns into a confirmation of what you already believe.

If a reviewer comes back confused about something *you* could have explained in one
sentence, that is the highest-value result the run can produce. Write it down. Do not
answer it.

## 1. Bring the site up

```bash
productos check                     # fix structural problems FIRST — see below
productos serve --port 7899 &       # a port nothing else is on
```

⛔ **Run `productos check` first and fix what it reports.** A reviewer who hits a
missing README or a broken link spends the whole run on that, and you learn nothing
about whether the *content* communicates. Grouping suggestions are fine to leave —
they are judgement calls, and a reviewer's opinion on the shape is worth having.

Then get the map, so you can pick targets:

```bash
curl -s localhost:7899/api/areas    # or just open the overview
```

## 2. Pick what to send them at

Two to four reviewers. More than that and you are paying for the same three findings.

| Send one at | Because |
|---|---|
| The **overview**, cold, told to build whatever seems in-flight | Tests whether the corpus orients a newcomer at all — the highest-signal run |
| One **feature with a surface and several behaviors** | Tests whether a feature is buildable as written |
| One **capability system** | Tests the altitude readers most often misread |
| The **area the user is actually shipping next** | The finding that has a deadline attached |

Always include the first. It is the only one that tests the corpus as a whole.

## 3. Spawn them

One subagent per target, **in parallel** — they must not see each other's reports, or
the second one inherits the first one's vocabulary.

Use the `productos-newcomer` agent type. Give each a prompt with exactly three things
and nothing more:

1. the URL to start at,
2. the path to write its report to,
3. what it has been asked to build (or, for the cold run, that it must pick).

```
Start at http://localhost:7899/ — that is the spec for this product.
Write your report to /tmp/pmcheck/cold.md.
Pick whatever looks like the next thing to build, and write the engineering brief for it.
```

That is the whole prompt. Adding "note that behaviors are…" breaks the run.

If `productos-newcomer` is not available as an agent type, spawn a general-purpose
agent and paste the contents of the agent definition as its instructions — but **do
not paraphrase them**, and do not add context.

## 4. Route what comes back

This is the part that has value beyond a pile of notes. Every finding goes to exactly
one of four places, and the routing decision is yours, not the reviewer's — they do
not know the categories exist.

| The reviewer said | It means | Where it goes |
|---|---|---|
| "I wanted to record X and there was nowhere for it" | The **model** can't express something | `productos todo add "<what>" --forced-into <where it landed>` |
| "I couldn't tell whether X" about this product | A **claim** is missing or ambiguous | A feedback entry on that container, or an undefined behavior |
| "I didn't know what <word> meant" | The **glossary** is missing a term — theirs or ours | A feedback entry; if it is a ProductOS word, a framework gap |
| "I expected a page for X and there wasn't one" | Ask which: no shape, or empty shape | Framework gap, or a feedback entry |

Two distinctions to get right, because getting them wrong buries the useful half:

- **A framework gap is about ProductOS. A feedback entry is about this product.**
  "Nothing says who can approve this" is the corpus's problem. "There was no way to
  say this rule only applies to enterprise customers" is ProductOS's. When an item
  reads as both, it is usually the corpus — check whether an existing field would have
  held it before recording a gap.
- **A reviewer being confused is data even when they are wrong.** If they misread a
  capability as a feature, the finding is not "reviewer was mistaken" — it is that the
  page let them. Record it against the page.

Record them:

```bash
productos todo add "no way to scope a rule to a customer segment" --forced-into cre/pricing/deal-pricing
```

For corpus findings, write feedback entries so they land in the queue the author
already works from rather than in a chat message they will scroll past.

## 5. Report back

Give the user, in this order:

1. **Would they build from it** — each reviewer's verdict, verbatim, no summarising.
2. **What two or more reviewers independently hit.** Convergence is the strongest
   signal in the run; say so explicitly.
3. **Framework gaps recorded**, with the id of each.
4. **Corpus findings recorded**, grouped by container.
5. **What you discarded and why.** Not everything a reviewer says is a finding — a
   reviewer who wanted the implementation is telling you the model is working. Say
   what you threw out, so the user can disagree with you.

⛔ **Quote the reviewers.** Their exact words are the evidence; your paraphrase is the
thing that made the corpus look clear in the first place. When a reviewer says "I
assumed the lender could override this, because nothing said otherwise", that sentence
is worth more than your summary of it.

## What a good run looks like

Not a long report. A short one with three things nobody in the room would have said:

- one place where the model could not hold something, recorded as a gap;
- one place where two strangers read the same claim differently;
- one word everybody here uses and nobody else understands.

A run that produces none of those either got a leading prompt, or got a reviewer who
read the docs. Check which, and run it again.

## ⛔ Freeze the corpus for the duration of a run

Do not edit product truth while reviewers are reading it. Two reviewers in one run both
reported that a contradiction rendered on only one of its two pages — it renders on
both; one of them had loaded the first page before the declaration was added and the
second after. **Their headline finding was an artifact of my editing.**

A fresh reader cannot tell a changing corpus from an inconsistent one, and neither can
you once the report lands. Collect every finding, then fix.

Check the server is still serving before you believe a 404 in a report, too. One
reviewer's server died mid-run: *"for fifteen minutes the specification did not exist."*
Everything they concluded in that window is about your infrastructure, not your corpus.

## The reader's verbs — tell the reviewer they exist, in the routing step only

A reader can now record findings directly, and these are where their report should land:

| The reviewer said | Verb |
|---|---|
| "this is decided and two people would build it differently" | `productos ask ambiguous <container> <behavior> -r "..." -r "..." -c "<cost>"` |
| "nobody has decided X" | `productos ask question <container> <id> -q "..." --of <who> -b <blocks...>` |
| "I propose X, somebody rule on it" | the same, plus `--propose "..." --because "..."` |
| "I believe this page depends on that one" | add `suspected_depends_on` to the depending page |
| "I read the whole thing and could not build from it" | `productos read <container> --blocked --blocked-by <ids> -n "..."` |

⛔ **Run these yourself, during routing — never put them in a reviewer's prompt.** A
reviewer who knows the verbs starts writing artifacts instead of reporting confusion, and
the confusion is the product of the run. Their ignorance is the instrument.

⛔ **`productos read` — and you must be honest about who read it.**

An architect reviewing the framework caught me doing this wrong: both read-throughs in a
real corpus said `by: a fresh-eyes review`, stamped by this skill on behalf of an LLM
subagent, while `productos-scope` says the recorder must be *a person* and that *"an agent
recording it makes the one uncomputable signal computed."* Two of the framework's own
skills disagreed, and nothing arbitrated.

**The ruling, and the reasoning, so you can argue with it:** record it, and name the
reader as what it was. An uninformed LLM reader genuinely is the only reader you can get
at volume, and its verdict is worth far more than nothing — it is the only thing that
catches a disagreement between two sentences, which no check computes. But it is not a
person, and `by:` must not imply one.

So: `--by "a fresh-eyes review (agent)"`, never a human's name, never a bare role. A
reader seeing that knows exactly how much to weigh it. If the user reads a page
themselves, record it in their name — that is the stronger signal and it should be
distinguishable.

⛔ **Always record one.** A corpus can pass every check and be unbuildable, and one run
demonstrated it: thirty-two automated notes on a page, not one of which was any of the
sixteen problems that stopped the reviewer.

## ⛔ The open-notes block contaminates a fresh-eyes run — sequence around it

Every container page now shows the notes already filed against it, and tells a reader to read
them before writing another. For a real reader that is right, and measurably so: one reviewer
said it saved them from duplicating three findings.

For **this skill** it is contamination, and a reviewer caught it on themselves:

> *"My eyes were therefore fresh up to that point and not after it. The instruction to read
> the queue is the right instruction; it just costs the next reviewer their independence,
> which is a thing worth knowing about the tool."*

So:

- **File nothing until the whole round's reports are in.** A reviewer reading round N's notes
  is reviewing your routing, not your corpus.
- **Run the cold reviewer first**, before any of the round's findings exist on the pages.
- **Ask them to say whether they read the queue.** The one who volunteered it is the reason
  this trade-off is visible at all — treat an unremarked-on report as possibly primed.
- **Convergence between a primed reviewer and an earlier one is not convergence.** Weight it
  as one finding, not two.
