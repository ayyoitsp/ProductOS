# Where this is, and what to pick up

A snapshot for somebody arriving with no context. Written 2026-09-18.

For the model itself, read [`OVERVIEW.md`](./OVERVIEW.md) (what it is and why it is shaped
this way), [`GLOSSARY.md`](./GLOSSARY.md) (every term and what it refuses) and
[`EXAMPLE.md`](./EXAMPLE.md) (the same model as real files). This document does not repeat
them. It says what state the thing is in, what was just learned, and what is open.

---

## The two tenets

Everything is judged against these. They are the whole product.

> **1. A human has validated the product truth.**
> **2. The product truth is sufficient to build from — no confusion, no room for
> interpretation.**

With a corollary on the second — *it should also help validate the truth is COMPLETE* — and
a constraint on how the first is served: **make it easy to validate, do not overwhelm the
reviewer, and record their decisions.**

These are the two things a code repository structurally cannot hold and an agent cannot
supply for itself. An agent can write a plausible claim; it cannot make a human have agreed
to it. It can describe what code does; it cannot tell you the description omits the case
nobody decided, or that one sentence has two builds.

**Corollary worth internalising:** schema work *is* tenet work. A claim with no home cannot
be validated, and non-redundancy is the primary lever on review cost — so getting the shape
right is reducing validation burden, not a detour from it.

---

## What exists

A CLI, an MCP server, a rendered product-truth site, seven skills and two agents.

```bash
npm install && npm run build
productos init claude          # installs skills + agents, scaffolds productos/
productos serve                # the site
productos check                # the pre-handoff gate
productos next                 # the decisions waiting on a person, ranked
```

**Surfaces, and which tenet each serves:**

| | |
|---|---|
| `productos next` · `/_queue` | **1** — the ranked worklist. Every entry is a question with what you need to answer it |
| `productos decide` (CLI + a button) | **1** — settles an open question, recording who and why |
| `productos verify` · Accept button | **1** — the validation stamp. **No MCP tool exposes this** |
| `productos check` | **2** — refuses a corpus before handover |
| `productos ask ambiguous` · `contradicts` | **2** — records that what is written has two builds |
| `productos read` | **2** — a person's verdict that they could or could not build from it |
| readiness blockers on each page | **both** — grouped by which tenet they fail |
| `productos todo` | the record of what the model still cannot express |

`service/` is the hosted Postgres authority, work in progress. The design intent is that the
database becomes the authority and markdown becomes an export — a product is not a repo.

---

## What was just done, and the method that produced it

The work was driven by **fresh-eyes review**, and that method is the most transferable thing
here. Two agent definitions ship in `agents/`:

- **`productos-newcomer`** — a product manager handed a URL and told to build from it, with
  an explicit prohibition on reading `OVERVIEW.md`, `GLOSSARY.md`, the skills or the source.
  The ignorance is the instrument: everyone else already knows what the corpus meant to say.
- **`productos-architect`** — a chief architect asked whether a product's **system
  capabilities** are right: trace one flow end to end and say where it goes cold; pull every
  verb the screens attribute to the system and name the page that owns it; judge the
  boundaries, including the ones to leave alone.

`skills/productos-pmcheck/SKILL.md` runs them and routes what comes back. Three rules in it
were learned the hard way:

1. **Never explain ProductOS to a reviewer.** A reviewer who knows what a capability is can
   no longer detect that the site failed to tell them.
2. **Freeze the corpus for the run.** Editing mid-review produced a headline finding that
   was an artefact of the editing.
3. **A reviewer who read the feedback queue is no longer independent** — sequence the cold
   reviewer first.

**The pattern worth expecting: ProductOS violates its own rules, and only a reader catches
it.** Examples found this session, all verified in the code before being fixed:

- Three documents said *"there is no tool a model can call to mark something true."* An MCP
  tool did exactly that, guarded by a sentence in its own description — which is precisely
  what the framework's stated principle refuses.
- A citation regex refused the syntax the glossary prescribes: 13 of 37 citations in a real
  corpus were reported malformed for following the documentation, and the noise hid five
  that were genuinely wrong.
- Four fields invented to catch what nothing computes — `contradicts`, `same_as`,
  `holds_for`, `suspected_depends_on` — had no writer in any interface. Render-only. The
  corpus had 1, 1 and 0 of them across 146 behaviors.
- `productos decide`, the human's verb, was a CLI command **printed as prose on a web page.**
- Maintainer notes were shipping inside the rendered artifact.

The full log — every change, the reviewer quote that caused it, and the reasoning where a
judgement was needed — is in `planning/PMCHECK_ITERATION.md` (gitignored; local only).

---

## The corpus it was tested against

A real commercial-real-estate lending product, in a private work repo, generously sized:
**12 features, 14 capabilities, 169 claims, 290 acceptance cases.** Not included here.

The numbers that mattered, because they were invisible from inside any single page:

| | |
|---|---|
| screens vs machinery | 111 claims about screens, 58 about what runs underneath (**34%**, up from 24%) |
| blockers | **250** across 26 pages — of which **5** are the kind that produce wrong software |
| validated | **0 of 169** |

That last number is the honest state of tenet 1, and it is the most important open problem:
**the mechanism exists and the motion does not.** There is a button and no reason to press it
today. `productos next` is a first attempt at the motion.

---

## Open, and worth picking up

**Needs a decision, not implementation:**

1. **The non-functional boundary.** Is a latency budget *refused* as implementation detail,
   or merely *absent*? The gap log asks the framework this directly and gets no answer, so
   authors drop the content. Answering it one way in `GLOSSARY.md` also closes two other
   gaps as explicit refusals — sequencing (plan, not truth) and "risk" (already an undecided
   behavior, or a decision's accepted cost).
2. **`holds_over`** — one field for a cross-container invariant. Authorization, tenant
   isolation and an error vocabulary are all this shape, and each currently becomes a
   per-feature copy, a non-goal with no test cases, or a glossary line. It is the mirror of
   `holds_for`.
3. **A container for a unit of work.** Four independent reviewers asked for it. The argument
   against is real — a plan changes weekly and truth would rot at that speed — but three of
   their four needs survive the refusal. A recommendation and the alternatives are in the
   iteration log.

**Implementation, no decision needed:**

- `dependency-not-ready` is 37 of 71 completeness blockers and is transitive noise that
  clears the moment anyone accepts the capabilities. Collapse to one line per dependency.
- `pricing` is 49 behaviors in 3 features, one of which hangs 25 claims off a single screen.
  The advisor names it and does not fail the gate, because whether that screen is one or
  three is a product judgement.
- The two tenets are not stated as co-equal anywhere in the docs. `README.md` leads with
  tenet 1 and leaves sufficiency to be inferred from a gate's name.

---

## Working rules that are not obvious

In [`CLAUDE.md`](./CLAUDE.md), and the three that catch people out:

- **Feedback on the output is a bug report against ProductOS.** Never fix only the corpus:
  fix the schema, the renderer or the skill, re-run, then verify the regenerated output. The
  failure mode is subtler than it sounds — it is possible to build the detector, report the
  reading, and never fix the thing. That happened this session and had to be called out.
- **The skills are the most-missed layer.** A schema field no skill writes is a field that
  only ever appears where somebody typed it by hand.
- **Run `productos check` before asking anyone to review.** An author is the worst possible
  person to notice what their own corpus fails to say.
