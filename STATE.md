# Where this is, and what to pick up

A snapshot for somebody arriving with no context. **Written 2026-10-16**, by counting rather
than by remembering — the previous version of this file said *"seven skills and two agents"*,
which had been wrong for weeks.

For the model itself read [`OVERVIEW.md`](./OVERVIEW.md) (what it is and why it is shaped this
way), [`GLOSSARY.md`](./GLOSSARY.md) (every term and what it refuses) and
[`EXAMPLE.md`](./EXAMPLE.md) (the same model as real files). This document does not repeat them.
It says what state the thing is in and what is open.

---

## The two tenets

Everything is judged against these. They are the whole product.

> **1. A human has validated the product truth.**
> **2. The product truth is sufficient to build from — no confusion, no room for
> interpretation.**

With a corollary on the second — *it should also help validate the truth is COMPLETE* — and a
constraint on how the first is served: **make it easy to validate, do not overwhelm the
reviewer, and record their decisions.**

**Corollary worth internalising:** schema work *is* tenet work. A claim with no home cannot be
validated, and non-redundancy is the primary lever on review cost — so getting the shape right
is reducing validation burden, not a detour from it.

---

## What exists, measured

A CLI, an MCP server, a rendered and publishable product-truth page, **one skill, and 21 role
definitions** — 8 authors and 13 judges, which is exactly what the registry declares. The skill
is the single entry point; it routes to the roles and keeps the judgement with the session.

```bash
npm install && npm run build
productos init claude            # installs the skill + every role, scaffolds a corpus
productos v2 check --at <corpus> # the pre-handover gate
productos v2 page <scope>        # the page a person reviews
productos v2 decide <scope>      # the open questions, with what guessing wrong would cost
productos v2 grid <scope>        # per ask, which of the eight slots are stated and which are holes
productos v2 packet <scope>      # the handoff artifact
```

Roughly forty verbs sit under `productos v2`. Five of them are **the acts**: `accept`, `rule`,
`read`, `waive`, `defer` — a person performs them, and the CLI is how a session records what
they chose.

**Where each tenet is served:**

| | |
|---|---|
| `v2 decide` · `v2 next` | **1** — what to ask somebody next, each item with drafted options and what it costs to pick wrong |
| the five acts (CLI + buttons on the page) | **1** — the record of human judgement, each stamped with the surface it came through |
| `v2 accepted` | **1** — the exact wording somebody agreed to, before anybody rewrites it |
| `v2 acts` | **1** — how many acts of human judgement this corpus actually carries |
| `v2 check` | **2** — refuses a corpus before handover, and separates refusals from reports |
| `v2 grid` | **2** — the blank cells, which is incompleteness as arithmetic |
| `v2 packet` | **2** — compiled, never written, and it will not compile over an unsettled slot |
| `v2 notes` · `v2 inbox` · `v2 watch` | the conversation: what people asked to be changed, and the replies |
| `v2 change` · `v2 steer` · `productos learn` | keeping ourselves honest about the framework |
| `productos todo` | the record of what the model still cannot express |

**The seed corpus** (`v2-seed`, restorable with `v2 reset`) is deliberately small and is what
most of the model's refusals were proved against: a pocket-money product in **3 scopes, 5
screens, 5 asks, 9 org-wide rules, 2 trial readings**, with one genuinely open question in it —
*can both kids complete the same task, or is it claimed by whoever presses first?*

`demo/` holds **Family Wallet**, an Expo + React Native app used as a dogfooding testbed, with
its own corpus on the retiring model.

---

## ⛔ Two models are live, and that is the biggest standing cost

The agent surface registers **58 tools: 20 for the Exchange model and 38 for the model it
replaced.** A client sees both vocabularies side by side. The registry says out loud which
commands belong to the retiring track, and nothing unregisters the tools.

**The documentation half of that is now done** — this file, [`OVERVIEW.md`](./OVERVIEW.md) and
[`GLOSSARY.md`](./GLOSSARY.md) describe the Exchange model and define none of the retired
model's words. **Unregistering the 38 tools is open**, and it matters more than it used to: the
premise is many Claude Code instances connecting and orienting themselves, and each one meets
both vocabularies as tool names with no page to disambiguate them.

### `backend/` — what it is, and why it is still here

| | What it is | Why it is still here |
|---|---|---|
| **`backend/`** | **not ProductOS.** It is the Family Wallet demo's API, mirroring the demo app's local ledger as a REST surface so that app can run either fully local or backend-driven | the demo lives here, so its API did too. Nothing in ProductOS depends on it. Whether it moves out is a deliberate question, not a cleanup |

The hosted Exchange store is `src/v2/store/`, with the compose files at the repository root, and
it is now the only one. **The retired store's source has been deleted** — schema, routes, review
app, its own migrations and its deploy script. Nothing imported it and nothing in the suite read
it. ⛔ **Deleting it did not stop its deployment**: a container app of that code was running when
the source went, and tearing it down is a cloud operation nobody has performed. The names needed
to do it are in the private architecture note, not here.

---

## Open, and worth picking up

**Needs a decision, not implementation:**

1. **The consumer has no route, no role and no tool shape.** Every route, role and gate is aimed
   at *writing and reviewing* truth. None takes a ticket and answers *"is this groomed — may I
   build from it?"* Ten routes exist; only two carry a stage, `specification` and `ready for
   review`, so **`ready for build` has no route at all** even though it is a derived stage the
   model already computes. The nearest thing is the packet, which is prose for a human rather
   than data for an agent.
2. **The three levels a consumer needs — accepted, derived, suggested — exist and are
   scattered.** Acceptance comes from the stamp, derivation from provenance plus a hash that
   detects staleness, suggestion from drafted candidates and from observation strength. Over the
   agent surface none of them is a field: a connecting instance would have to parse prose to
   learn whether it may build from a sentence.
3. **Consent over stdio is an honour system, deliberately and in writing.** The act tools take
   `by` and `via` as arguments and pass them straight through; the hosted path takes all three
   away from the caller and refuses a human `via` on an agent token. That is defensible with one
   person at the machine and changes character with many instances connecting, each told to make
   tickets unambiguous and each therefore tempted to settle what it finds.
4. **`backend/`** — see the table above. Whether it moves out is Peter's to answer.
5. **The retired store's container app is still serving.** Its source is gone; the deployment is
   not, and it holds whatever was written to its database. Tearing it down needs cloud access, so
   it is a decision plus an action, neither of which belongs to this repository.

**Implementation, no decision needed:**

- **A route name in the registry does not exist.** Four places send a reader to `ready it for
  build`; the route is called `hand it to the builders`.
- **Two roles both declare they write criteria** — the scoper and the demonstrator. The comments
  say the demonstrator took it over and the scoper's declaration was never trimmed. For *"tests
  are well defined"* this is the field that matters most.
- **Two code comments describe a model that has moved.** The verdict header says *"Four"* acts
  where the enum has five (`waive` was added later and is documented further down the same
  file); the confidence module says *"all nine of its slots"* where there are eight.

---

## Working rules that are not obvious

In [`CLAUDE.md`](./CLAUDE.md), and the three that catch people out:

- **Feedback on the output is a bug report against ProductOS.** Never fix only the corpus: fix
  the schema, the renderer or the skill, re-run, then verify the regenerated output. This was
  violated four times in one session, which is why it is now a test rather than prose.
- **The skills are the most-missed layer.** A schema field no skill tells anyone to write is a
  field that only ever appears where somebody typed it by hand — also a test now.
- **Run `productos v2 check --at <corpus>` before asking anyone to review.** The `v2` is
  load-bearing: the older verb takes no `--at` and cannot read an Exchange corpus at all.
