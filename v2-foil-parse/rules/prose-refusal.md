---
# ⛔ A rule answering `refuses` in prose. `RefusalOutcome` exists because a refusal is
# "named, never a code", and a rule was the one way to fill the slot naming nothing — the
# packet then told a builder "it refuses in the same two named ways and in the same words"
# with the two named ways nowhere in the corpus.
id: prose-refusal
statement: Amounts are refused in the same two named ways everywhere, and in the same words.
fills: [refuses]
mode: supplies
scope:
  asked_by: person
  everywhere: true
criteria:
  - id: 1
    slot: refuses
    kind: conformance
    given: an amount that is not an amount of money
    then: it is refused in the usual way
---
