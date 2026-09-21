---
# ⛔ A second `supplies` rule reaching the same slot as another. Which one wins was decided by
# `readdir().sort()`, so renaming this file — id and contents unchanged — flipped the
# authorization sentence on a money write. `two-rules-answer-this` refuses it.
id: also-supplies-may
statement: Anybody signed in on the shared device may ask for anything at all.
fills: [may]
mode: supplies
scope:
  asked_by: system
  everywhere: true
criteria:
  - id: 1
    slot: may
    kind: conformance
    given: anybody signed in
    when: they ask
    then: it is allowed
---
