---
id: a-kid-sees-only-their-own
statement: >
  A parent sees everything belonging to the kids in their family. A kid sees their own
  money and nothing belonging to another kid — not the amounts, and not that the other kid
  exists.
in: family-wallet
fills: [may]
mode: supplies
scope:
  term: money
  acts_on: reads
  asked_by: person
criteria:
  - id: 1
    slot: may
    kind: conformance
    given: a kid signed in on the shared device
    when: they are shown anything about money
    then: it is their own, and nothing identifies another kid
  - id: 2
    slot: may
    kind: conformance
    given: a person who is not a parent in this family and is not this kid
    when: they ask for anything about this kid
    then: they are shown nothing, and not told the kid exists
why: >
  Looking is a different question from changing, and answering both in one sentence made
  the sentence false at one end or the other. The device is shared and siblings are
  competitive; what a kid can see about another kid is its own decision.
---

# A kid sees only their own

The counterpart to [only-a-parent-moves-money]. That one is `acts_on: changes`; this is
`acts_on: reads`. Before the selector could tell those apart, one rule had to try to be
both, and the clause about reading existed only to survive being applied where nobody
meant it to apply.
