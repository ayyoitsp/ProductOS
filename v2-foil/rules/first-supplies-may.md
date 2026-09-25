---
# The other half of the collision above.
id: first-supplies-may
statement: Only somebody named on the account may ask for anything at all.
fills: [may]
mode: supplies
scope:
  asked_by: system
  everywhere: true
criteria:
  - id: 1
    slot: may
    kind: conformance
    given: somebody not named on the account
    when: they ask
    then: it is refused
---
