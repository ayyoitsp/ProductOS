---
id: work-in-flight-is-visible
statement: >
  A control that starts work the person waits for shows that it is working, from the press
  until the work finishes or fails, and does not act a second time in the meantime.
in: family-wallet
fills: [answer, fails]
mode: constrains
scope:
  asked_by: person
  part_role: commits
criteria:
  - id: 1
    slot: answer
    kind: conformance
    given: a control whose work does not finish at once
    when: the person presses it
    then: it shows that it is working, and pressing it again does nothing until the work ends
  - id: 2
    slot: fails
    kind: conformance
    given: work started at a control fails
    then: it stops showing work and says what failed, in words the person can act on
why: >
  A parent taps twice when nothing moves, and pays a kid twice. The double-charge is the
  failure; the spinner is only how it is prevented.
---

# Work in flight is visible

Stated once, and it constrains the `answer` **and** `fails` of every exchange a person starts
at a control. No feature mentions it.

It governs two slots because it genuinely says two things: what the control shows while the
work is in flight, and what it shows when the work fails. With a single-slot `fills`, the
second criterion had to be filed under `answer` — a `fails` criterion in an `answer` slot,
written that way because filing it honestly was refused.
