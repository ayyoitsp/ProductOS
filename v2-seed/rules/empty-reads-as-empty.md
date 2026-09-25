---
id: empty-reads-as-empty
statement: >
  A figure nobody has set reads as unset. It never reads as zero, and it never inherits a
  value from something nearby.
fills: [answer]
mode: constrains
scope:
  asked_by: person
  under: family-wallet
criteria:
  - id: 1
    slot: answer
    kind: conformance
    given: a figure that has never been set
    when: it is shown
    then: it reads as unset, and not as zero
why: >
  A reader who cannot tell an unset figure from a zero will act on a number nobody chose.
---

# Empty reads as empty

`under: family-wallet` and `asked_by: person`, not `everywhere: true`. A figure reading as
unset is about what a person sees; machinery is handed a value or it is not, and "reads as
unset" is not an answer for a caller. A rule that declines to say whose ask it is about
supplies a person-shaped sentence to both.

`constrains`, not `supplies` — it is not an answer to anything. Whatever an exchange
answers, an unset figure inside that answer still reads as unset. Filed as `supplies` it
would have offered *"a figure nobody has set reads as unset"* as the entire answer to any
exchange that left `answer` blank, which answers nothing and hides the hole.
