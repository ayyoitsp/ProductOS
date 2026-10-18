# Groom a piece of work against product truth

You are holding a piece of work — a ticket, an issue, a line in a plan — and you are about to find
out whether it can be built. ProductOS holds the product truth it has to agree with. This is the
loop. Four steps, in this order.

**ProductOS knows nothing about your tracker, and must not be asked to.** It answers about truth. You
hold the work item through your own connector; you read truth here and you write the result back
there yourself. Nothing below takes an issue id.

---

## 1. Find the truth the work touches

Call `productos_find` with a sentence from the work item. It answers with refs in the corpus's own
addresses, best first, each with how settled it is. `productos_exchange_scopes` gives the whole tree
of features and behaviours when you need to browse instead.

A **scope** is a feature; an **exchange** is one behaviour of it, addressed `<scope>#<exchange>`.
A behaviour answers up to eight questions about itself, called **slots**: who `may` ask, what they
come `with`, what the `answer` is, what is true `after`, what it `refuses`, how it `fails`, what a
repeat does (`again`), and what two at once do (`at_once`).

Match the work to a scope or to one exchange. ⛔ **If you cannot tell which, stop and ask the person
rather than guessing.** A readiness verdict about the wrong behaviour is worse than no verdict: it
reads exactly like a correct one.

## 2. Ask whether it is ready

Call `productos_readiness` with that scope or exchange.

It answers in one field — `ready: true | false` — and `because` says which of the two reasons it is.
The gate is one line: **nothing the work touches may be below `derived`.**

Every claim carries a `level` and a `because`:

| level | means | what you do |
| --- | --- | --- |
| `accepted` | a person read these words and agreed to them | build it |
| `derived` | it follows from an acceptance, or the product has been seen doing it | build it |
| `suggested` | something wrote it or inferred it and nobody has agreed | see `wrote`, below |
| `open` | there is a question here and a person owes the answer | step 3 |

And `wrote` says who wrote it, which is how you route a `suggested` claim:

| `wrote.is` | what you do |
| --- | --- |
| `a person` | they typed it and have not confirmed it. It needs a **stamp**, not a question. |
| `a role` / `software` | something worked it out or landed a default. Raise it as a **question**. |
| `unrecorded` | ⛔ **nothing records it.** A person's unconfirmed draft and an agent's inference are the same bytes here. Ask who wrote it; do not pick one. |

⛔ **Never record a person's agreement yourself.** `accepted` means a human read the words and said
yes. You cannot produce it, by any route, for any reason — and a corpus where an agent can is a
corpus where the word means nothing. If something only needs a stamp, say so and let them stamp it.

Three things in the verdict are reported and do not block: `latitude` (declared the builder's
latitude — nobody owes an answer and there is nothing to build), `framing` (why the feature exists,
what could go wrong, how we would know), and `openElsewhere` (a question that reaches this work
without landing on any of its facts — worth raising, not blocking).

## 3. Raise what is open, as questions for a person

For every ref in `holes`, call `productos_exchange_questions` on the scope. Each question arrives
with what guessing wrong costs and, often, drafted answers with the trade-off of each.

Put those in the work item verbatim, with the ref. ⛔ **Do not answer them, do not pick an option,
and do not write around them.** A hole a builder fills is product truth invented by a builder, and
nothing downstream can tell it apart from a decision somebody made.

If grooming turns up a question the truth does not ask yet, **raise it**:

```
productos_in { intent: "ask", fields: { ref: "<scope>#<exchange>#<slot>", question: "…", asked_of: "<who owes it>",
               blocks: [], candidates: [{ says: "…", consequence: "…" }, …], cost: "…" } }
```

It lands in the corpus at once, gates the behaviour, and shows up in that person's queue with your
drafted answers. Give two drafted answers and a cost when you can see two readings — that is what
makes it a decision rather than an essay.

If you have learned something that bears on an open question — a transcript, a log, a screen you
drove — record it as an observation, not as the answer. It is evidence about the question, and the
person deciding wants to see it.

## 4. Write the test list into the work item

`productos_readiness` returns `requirements` — the testing requirements, each with:

- `ref` — `<scope>#<exchange>#shows#<id>`, the address of this requirement
- `hash` — the hash of the words it was written from
- `says` — given / when / then
- `demonstrates` — the claim it shows
- `level`, `state` — whether it is current with that claim, and whether anybody agreed to it

⛔ **Carry both the ref and the hash into whatever demonstrates it.** The ref says which requirement;
the hash says which version. A requirement whose hash no longer matches the one you were handed is
one to revisit, not one to trust — and a test that passes against a sentence nobody agrees to any
more is the one defect that ships wrong behaviour while looking correct.

A requirement at `suggested` with `state: "stale"` was worked out from wording that has since
changed. Do not implement it. Say so, and name the claim.

A requirement at `suggested` with `route: "worked-out-from-a-draft"` tests a claim nobody has agreed
to yet. ⛔ **Do not implement it either.** It becomes `derived` the moment a person agrees to the claim,
with nothing rewritten — so what it needs is the stamp on the claim, not a new test.

### When a claim has no test at all

`untested` lists every claim that owes a demonstration and has none, and it holds `ready` at `false`.
⛔ **Do not write a test of your own into the work item to fill it.** Spawn `productos-demonstrator` on
the feature; it writes each one back through the door, where the next readiness call sees it:

```
productos_in { intent: "demonstrate", fields: { ref: "<scope>#<exchange>#<slot>", given: "…", when: "…", then: "…" } }
```

The server hashes the claim it attaches to, so the requirement is current with exactly the words it
was worked out from. A test on a claim nobody has agreed to reads `suggested` until somebody does.

### Before you say it is ready

`ready: true` says every fact is agreed and every claim has a test. It does not say the tests would
prove anything. Run `hand it to the builders` — `test-design` asks whether each requirement would
show its claim holding or just pass, and `buildability` whether somebody could start on Monday. Put
what they find in the work item beside the verdict.

Then, for the work you are about to do, call `productos_exchange_packet` on the scope: the full
behaviours, the words this product uses, the screens the asks arrive on, the org-wide rules that
govern, and the latitude you have by declaration rather than by silence. Readiness is the verdict;
the packet is what you build from.

---

## If the truth is wrong, or has nowhere to say what you found

Write it into the corpus as a suggestion. It lands at once, reads as `suggested` until a person agrees
to it, and never needs to wait in a note:

```
productos_in { intent: "suggest", fields: { ref: "<scope>#<exchange>#<slot>", says: "…", from: "<what you worked it out from>" } }
```

- **A behaviour the product has and the truth does not** — suggest it, with `from` naming where you
  saw it. ⛔ The corpus is the **target state** — what the product *should* do — so something being
  built is evidence for a suggestion, never a reason to treat it as agreed.
- **A sentence you think is wrong** — raise it with `ask` on that slot, with `about` naming the part
  in question. Do not suggest a contradicting sentence beside it.
- **Something true that the model has no field for** is our problem, not the corpus author's. Name
  it, and name where you were forced to put it instead.
