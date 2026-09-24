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

## ⛔ You cannot review your own explanations — run the newcomer

By the time you have written a corpus you know what it meant to say, so your reading of
it is worth nothing as evidence that it communicates. Same for these docs. The only
useful reader is one who has never seen ProductOS, and after a few exchanges there is
no such reader left in the session.

So the check is a subagent: `productos-newcomer` (installed to `~/.claude/agents/`) is
a product manager handed a URL and told to build from it, with **no knowledge of
ProductOS and an explicit prohibition on reading OVERVIEW, GLOSSARY, EXAMPLE, the
skills or the source.** The `productos-pmcheck` skill runs a few of them in parallel
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
productos todo scan     # detect forced fits in this corpus
productos todo          # read the open gaps
productos todo add "<what the model can't express>" --forced-into <where it went>
```

**`forced_into` is the load-bearing field.** It names the compromise, so the corpus can
be corrected in one pass once the gap closes — instead of the compromise quietly
becoming the convention.

**Record one before you write the approximate version, not after.** A hand-placed
compromise looks correct, so the evidence that the framework was deficient disappears
and the same hole gets rediscovered from scratch next session. The skills have always
said "don't paper over ambiguity"; that instruction alone has repeatedly not been
enough, which is why the scan exists.

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

## ⛔ Run `productos check` before asking anyone to review a corpus

```bash
productos check      # structure + every high audit finding + reference resolution
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

## Verify by running, not by reasoning

For renderer changes, load the page and assert on the DOM. Playwright is available at
`frontend/node_modules/.pnpm/playwright-core@*/` in the bilrost checkout. A rendering
claim that was never rendered is a guess.

---

## Versions stay at 0.1.0

Skill `version:`, `package.json`, anything stamped. No increments during the design phase
unless Peter says so explicitly.

## After changing `src/` or `skills/`

```bash
npm run build && productos init claude --update
```

So Peter's other sessions pick the change up immediately. Never ask him to run install
commands.

## Planning docs are private

Design and strategy notes live in `planning/` (gitignored). The public repo stays clean.
