---
id: one-hand-at-a-time
statement: >
  When two people act on the same kid's money at the same time, both acts are recorded and
  neither is lost. What each person is looking at catches up without them reloading.
in: family-wallet
fills: [at_once]
mode: supplies
scope:
  asked_by: person
  term: money
  acts_on: changes
criteria:
  - id: 1
    slot: at_once
    kind: conformance
    given: two parents looking at the same kid on two devices
    when: both record something at the same moment
    then: both are recorded, and each parent's view shows both
why: >
  Concurrency had no home at all, so every exchange either ignored it or invented a
  different answer. Ignoring it is the dangerous one: money is involved.
---

# One hand at a time

The `at_once` slot exists because this question was never asked. Answering it once for
everything that touches money is what makes seven slots per exchange survivable.
