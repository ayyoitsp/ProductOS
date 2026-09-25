---
id: nothing-half-happens
statement: >
  When work cannot be completed, the person is told it was not recorded, nothing has
  changed, and they can try again without undoing anything first.
in: family-wallet
fills: [fails]
mode: supplies
scope:
  asked_by: person
  acts_on: changes
criteria:
  - id: 1
    slot: fails
    kind: conformance
    given: work that cannot be completed
    when: the person is told
    then: they are told it was not recorded, and what they were looking at reads as it did before
  - id: 2
    slot: fails
    kind: conformance
    given: work that failed once
    when: the person does the same thing again
    then: it can succeed, with nothing to undo first
why: >
  Every author was writing this sentence per exchange in slightly different words, and the
  differences were accidental rather than meant. Where the difference IS meant, the
  exchange states `fails` itself and this steps aside.
---

# Nothing half happens

The load-lightener. This is the shape of an org-wide rule that `supplies`: it answers a
slot most exchanges would otherwise have to answer identically, and the narrower sentence
still wins wherever one exists.
