---
# ⛔ The shared refusal vocabulary — the thing the schema advertises rules as the home for, and
# which this corpus hand-typed twice before a slot could take the shared cases AND its own.
#
# `not-positive` existed on both money forms, as "an amount earned is more than nothing" and
# "an amount spent is more than nothing", under nothing that compared them.
id: amounts-refuse-the-same-way
in: family-wallet
statement: >
  Wherever a person types an amount of money, it is refused in the same two named ways and in
  the same words, so a family never learns two vocabularies for one mistake.
fills: [refuses]
mode: constrains
scope:
  asked_by: person
  term: money
  acts_on: changes
outcomes:
  - name: not-a-number
    when: the amount is not an amount of money
    told: what is wrong with it, with what they typed still there
  - name: not-positive
    when: the amount is zero or less
    told: that an amount is more than nothing, with what they typed still there
criteria:
  - id: 1
    slot: refuses
    kind: conformance
    given: a person typing an amount of money anywhere in this product
    when: they type something that is not an amount
    then: they are told what is wrong with it, in the same words everywhere, with what they typed still there
why: >
  Two forms, one mistake, two messages is how a product teaches a family that it is two
  products.
---

# Amounts refuse the same way

A slot may still name a case of its own — the shared ones and the local ones reach a builder
together. What it may not do is quietly reword a shared case: `says-it-differently-here` asks
whether that was a decision.
