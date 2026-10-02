---
id: a-repeat-does-nothing-twice
statement: >
  Doing the same thing a second time, when nothing has changed in between, records it once
  and tells the person it is already done.
in: family-wallet
fills: [again]
mode: supplies
scope:
  asked_by: person
  acts_on: changes
criteria:
  - id: 1
    slot: again
    kind: conformance
    given: work that has already been recorded
    when: the person does the same thing again with nothing changed in between
    then: one record exists, and the person is told it is already done
why: >
  A shared device in a kitchen gets double-pressed constantly. Defaulting to
  once-only makes the exceptions — where a repeat is a real second act — visible as
  exceptions instead of invisible as omissions.
---

# A repeat does nothing twice

Note what makes this safe to default: the exchanges where a repeat IS a distinct act must
now say so with an `excepts` and a reason. `money#record-earning` is one, and it is
legible precisely because everything else inherits.
