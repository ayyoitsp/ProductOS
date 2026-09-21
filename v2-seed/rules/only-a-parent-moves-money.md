---
id: only-a-parent-moves-money
statement: >
  Only a parent may change what a kid has.
in: family-wallet
fills: [may]
mode: supplies
scope:
  asked_by: person
  term: money
  acts_on: changes
criteria:
  - id: 1
    slot: may
    kind: conformance
    given: a kid signed in on the shared device
    when: they try to change what any kid has
    then: it is refused, and nothing changes
why: >
  This was four separate open questions on four exchanges, each phrased differently, and
  answering any one of them left the other three open. It is one sentence about a class.
---

# Only a parent moves money

Authorization. Selected by `term: money` **and `acts_on: changes`** — every exchange that
changes money is governed, including exchanges nobody has written yet, which is the
difference between a rule and a convention.

Before `acts_on` existed this rule had to carry a second sentence about *reading* a
balance, purely so it would be true on the exchanges it was wrongly forced to govern. The
sentence was defensive, not meant. Who may look at a kid's money is a different question
and belongs to a different rule.
