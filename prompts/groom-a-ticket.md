# Groom a piece of work against product truth

You are holding a piece of work — a ticket, an issue, a line in a plan — and you are about to find
out whether it can be built. ProductOS holds the product truth it has to agree with. This is the
loop. Four steps, in this order.

**ProductOS knows nothing about your tracker, and must not be asked to.** It answers about truth. You
hold the work item through your own connector; you read truth here and you write the result back
there yourself. Nothing below takes an issue id.

---

## 1. Find the truth the work touches

Call `productos_exchange_scopes` for the tree of features and behaviours, with counts.

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

Then, for the work you are about to do, call `productos_exchange_packet` on the scope: the full
behaviours, the words this product uses, the screens the asks arrive on, the org-wide rules that
govern, and the latitude you have by declaration rather than by silence. Readiness is the verdict;
the packet is what you build from.

---

## If the truth is wrong, or has nowhere to say what you found

Say so where the person is. `productos_in` files a note against the thing you were looking at. Two
things that are not notes:

- **A behaviour the product has and the truth does not** is a gap in the truth. Report it; do not
  add it. ⛔ The corpus is the **target state** — what the product *should* do — so something being
  built is not evidence that the truth is wrong, and something being absent is not permission to
  invent it.
- **Something true that the model has no field for** is our problem, not the corpus author's. Name
  it, and name where you were forced to put it instead.
