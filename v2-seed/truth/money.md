---
id: money
title: Money
in: family-wallet
exists: kept
views:
  - id: balance
    title: A kid's money
    view_kind: detail
    walked: true
    sketch: |
      ┌──────────────────────────────┐
      │  Ada                         │
      │  $14.50                      │
      ├──────────────────────────────┤
      │  Sat  Tidy your room  +$2.00 │
      │  Fri  Cinema          -$8.00 │
      │  Thu  Walk the dog    +$1.50 │
      ├──────────────────────────────┤
      │  [ + Earned ]   [ − Spent ]  │
      └──────────────────────────────┘
    parts:
      - id: figure
        role: display
        label: $14.50
      - id: history
        role: display
        label: Sat Tidy your room
      - id: earned
        role: navigates
        label: + Earned
        leads_to: earn-form
      - id: spent
        role: navigates
        label: − Spent
        leads_to: spend-form
  - id: earn-form
    title: Record something earned
    view_kind: form
    walked: true
    sketch: |
      ┌──────────────────────────────┐
      │  Ada earned                  │
      │  Amount  [__________]        │
      │  What for [__________]       │
      │                              │
      │  <Cancel>        [ Record ]  │
      └──────────────────────────────┘
    parts:
      - id: amount
        role: entry
        label: Amount
      - id: what-for
        role: entry
        label: What for
      - id: record
        role: commits
        label: Record
      - id: cancel
        role: navigates
        label: Cancel
        leads_to: balance
  - id: spend-form
    title: Record something spent
    view_kind: form
    walked: true
    sketch: |
      ┌──────────────────────────────┐
      │  Ada spent                   │
      │  Amount  [__________]        │
      │  What on  [__________]       │
      │                              │
      │  <Cancel>        [ Record ]  │
      └──────────────────────────────┘
    parts:
      - id: amount
        role: entry
        label: Amount
      - id: what-on
        role: entry
        label: What on
      - id: record
        role: commits
        label: Record
      - id: cancel
        role: navigates
        label: Cancel
        leads_to: balance
exchanges:
  - id: see-a-balance
    title: Somebody looks at what a kid has
    asked_by: person
    at: { view: balance, part: figure }
    reads: [money, balance, kid]
    changes: []
    slots:
      with:
        says: Which kid.
      fails:
        says: >
          Nothing of the kid's is shown rather than a partial or stale picture, and the
          person is told it could not be loaded and can look again.
      again:
        says: >
          Looking twice shows the same thing, plus anything recorded in between. Looking
          changes nothing and is never refused for having been done before.
      after:
        # ⛔ `none` is a real answer here, not an empty cell. An exchange that only reads leaves
        # nothing behind, and a model that refused to let anyone say so would push an author into
        # inventing a state change just to fill the slot.
        none: true
      answer:
        says: >
          What the kid has now, and everything recorded against them most recent first,
          each with the day, what it was for, and the amount.
        within: >
          What a parent sees reflects what they recorded before they finished looking at
          it — they never have to reload to see their own act.
      refuses:
        outcomes:
          - name: not-your-kid
            when: the person asking is not a parent in this family, and is not this kid
            told: nothing about this kid, not even that they exist
      at_once:
        says: >
          Two people looking at once see the same thing, and a change one of them makes
          appears for the other without a reload.
    criteria:
      - id: 1
        slot: answer
        given: a kid with three things recorded against them
        when: a parent looks
        then: the three are listed most recent first, each with the day, what it was for, and the amount
      - id: 2
        slot: answer
        given: a kid with nothing recorded against them
        when: a parent looks
        then: the history reads as empty and the figure reads as unset, not as zero
      - id: 3
        slot: refuses
        given: a kid signed in
        when: they look at a different kid
        then: they are shown nothing about that kid, and not told the kid exists
      - id: 4
        slot: fails
        given: a parent looking at a kid, and the history cannot be loaded
        when: they are told
        then: no amounts are shown at all, and they are told they can look again
      - id: 5
        slot: again
        given: a parent who has looked at a kid once
        when: something is recorded and they look a second time
        then: they are shown everything recorded against that kid, including what was just recorded
  - id: record-earning
    title: A parent records something a kid earned
    asked_by: person
    at: { view: earn-form, part: record }
    reads: [kid]
    changes: [money, balance]
    excepts:
      - rule: a-repeat-does-nothing-twice
        because: >
          A parent genuinely does pay the same amount for the same thing twice — two weeks
          of the same chore is two records, not one. Collapsing them would silently lose
          money the kid earned, which is the worst failure this product has. The single
          press is made safe by work-in-flight-is-visible, which is a different guarantee
          from this one and the reason this exception is safe to make.
    slots:
      with:
        says: Which kid, an amount, and what it was for. What it was for may be left blank.
      after:
        # ⛔ MOVED OUT OF `answer`, not copied. This clause is the reason the eighth slot exists:
        # deleting it from the `answer` sentence produced a check output byte-identical to the
        # original, so the money moving could leave a pocket-money product without a trace.
        says: The kid has that much more than they had before.
      answer:
        says: >
          The act appears at the top of the kid's history dated today, and the parent is
          returned to the kid's money.
      again:
        says: >
          Two identical records are two records. Recording the same amount for the same
          thing twice credits the kid twice, because it happened twice.
    criteria:
      - id: 1
        slot: answer
        given: a kid who has $10.00 and a parent on the earn form
        when: the parent records $2.50 for tidying
        then: the kid has $12.50, and tidying is at the top of their history dated today
        example:
          because: the amounts are one family's numbers; the rule is that the sum is what was recorded
          by: peter
          at: 2026-09-16
      - id: 2
        slot: answer
        given: a parent on the earn form who leaves what-it-was-for blank
        when: they record an amount
        then: it is recorded, and the history shows the amount with no reason against it
      - id: 3
        slot: refuses
        given: a parent on the earn form
        when: they record an amount of zero
        then: nothing is recorded and they are told an amount earned is more than nothing
      - id: 4
        slot: again
        given: a kid already recorded an amount for tidying today
        when: a parent records the same amount for tidying again
        then: two records exist, and the kid has both amounts
      - id: 5
        slot: with
        given: a parent on the earn form
        when: they submit with no amount
        then: nothing is recorded and they are told an amount is needed
      - id: 6
        slot: after
        given: a kid who has $10.00 and a parent on the earn form
        when: the parent records $2.50 for tidying
        then: the kid has $12.50
        example:
          because: the amounts are one family's numbers; the rule is that the sum is what was recorded
          by: peter
          at: 2026-09-21
      - id: 7
        slot: after
        given: a kid with some money and a parent on the earn form
        when: the parent records an amount
        then: the kid has that amount more than they had before, and nothing else about them changed

  - id: record-spending
    title: A parent records something a kid spent
    asked_by: person
    at: { view: spend-form, part: record }
    reads: [kid, balance]
    changes: [money, balance]
    slots:
      with:
        says: Which kid, an amount, and what it was on. What it was on may be left blank.
      answer:
        says: >
          The act appears at the top of the kid's history dated today, and the parent is
          returned to the kid's money.
      after:
        # ⛔ THE QUESTION MOVED HERE WITH THE FACT IT IS ABOUT, and it is the clearest evidence
        # the eighth slot was missing: *"is an amount larger than what the kid has recorded at
        # all, or refused?"* is a question about what the ask LEAVES BEHIND, and it was filed on
        # `answer` because there was nowhere else. Every candidate had to restate the history
        # entry and the navigation to avoid deleting them — three facts welded together because
        # only one of them had a home.
        says: The kid has that much less than they had before.
        standing:
          kind: open
          about: >
            whether an amount larger than what the kid has is taken off at all, or refused
          question: >
            Is an amount larger than what the kid has taken off like any other, or refused?
          candidates:
            - replaces: the whole sentence
              says: >
                The kid has that much less than they had before — even past nothing, and their
                money then reads as owed rather than as a negative number.
              consequence: >
                Parents in the trial recorded spending after the fact, so refusing it would
                mean the record does not match what happened. Showing it as owed rather than
                as minus keeps it readable to a kid.
            - replaces: the whole sentence
              says: >
                The kid has that much less than they had before, unless it is more than they
                have, in which case nothing is taken off and nothing is recorded.
              consequence: >
                A kid's money can never read as owed, which is one fewer thing to explain to a
                nine-year-old — and a parent recording a real overspend after the fact has
                nowhere to put it, so the record and the money diverge.
          cost: >
            Guessing wrong is either a kid's money reading as owed when the product never meant
            to allow it, or a parent with a real overspend and nowhere to record it — and the
            screens get built around whichever one an engineer reads first.
          asked_of: peter
          blocks: []
          asked_at: 2026-09-16
      again:
        # ⛔ Each option's `says` is a BEHAVIOUR and its `consequence` is the argument for
        # it. When the competing readings lived in their own field, they were arguments —
        # and picking one wrote the argument into the slot, where a builder found prose
        # they could not implement.
        standing:
          kind: open
          question: >
            Is recording the same amount for the same thing twice on one day two purchases,
            or one mis-press?
          candidates:
            - says: >
                Each record stands on its own. The same amount for the same thing on the
                same day is recorded twice and taken off twice.
              consequence: >
                A kid can be taken to the cinema twice in a day and the record matches. A
                parent who double-presses has taken money off a kid nobody spent, and has
                to notice and correct it.
            - says: >
                Recording the same amount for the same thing on the same day records it
                once, and the parent is told it is already recorded.
              consequence: >
                A double-press cannot cost a kid money. A parent who genuinely spent the
                same amount twice in a day has to change something — the reason, or the
                day — before the second record will take.
          cost: >
            Guessing wrong takes money off a kid that nobody spent, or loses a real second
            purchase. Both are defensible, so an engineer will pick whichever they read
            first and neither outcome will have been chosen.
          asked_of: peter
          blocks: []
          raised_by: peter
    criteria:
      - id: 1
        slot: answer
        given: a kid who has some money and a parent on the spend form
        when: the parent records an amount spent
        then: the kid has that much less, and it is at the top of their history dated today
      - id: 2
        slot: refuses
        given: a parent on the spend form
        when: they record an amount of zero
        then: nothing is recorded and they are told an amount spent is more than nothing
      - id: 3
        slot: with
        given: a parent on the spend form who leaves what-it-was-on blank
        when: they record an amount
        then: it is recorded, and the history shows the amount with no reason against it
      - id: 4
        slot: after
        given: a kid who has $10.00 and a parent on the spend form
        when: the parent records $4.00 spent
        then: the kid has $6.00
        example:
          because: the amounts are one family's numbers; the rule is that the difference is what was recorded
          by: peter
          at: 2026-09-21
      - id: 5
        slot: after
        given: a kid with some money and a parent on the spend form
        when: the parent records an amount spent
        then: the kid has that amount less than they had before, and nothing else about them changed

  - id: apply-a-standing-allowance
    title: A standing allowance falls due
    asked_by: system
    when:
      triggered_by: the turn of the day, once for each kid who has a standing allowance
      cadence: repeating
    reads: [kid, money]
    changes: [money, balance]
    slots:
      # ⛔ Answered here rather than inherited, because the org-wide rules about who may ask
      # and about two people at once are written about a PERSON. Neither is an answer for a
      # clock, and until rules had to declare their asker both were supplied here for free —
      # so this exchange promised "only a parent may change what a kid has" about something no
      # parent touches.
      may:
        says: >
          Nothing outside this product sets an allowance running. It is the product's own
          timekeeping, and no person asks for it.
      at_once:
        says: >
          The same day for the same kid is only ever applied once, however many times
          timekeeping fires for it.
      with:
        says: Which kid, and which day the allowance is for.
      after:
        says: The kid has the allowance more than they had before.
      answer:
        says: >
          The allowance appears in the kid's history dated the day it fell due, described as
          the allowance rather than as something earned.
      refuses:
        outcomes:
          - name: no-allowance-set
            when: the kid has no standing allowance
            told: nothing, because nothing asked — no record is written
      fails:
        says: >
          Nothing is added and the day stays due, so that the next attempt adds it exactly
          once rather than skipping it.
      again:
        says: >
          An allowance that has already been added for a day is not added again for that
          day, however many times the day comes round.
    criteria:
      - id: 1
        slot: answer
        given: a kid with a standing allowance, on the day it falls due
        when: the allowance falls due
        then: it is added, and their history shows it dated that day, described as the allowance
        level: integration
      - id: 2
        slot: again
        given: a kid whose allowance has already been added for today
        when: it falls due again for today
        then: nothing further is added
        level: integration
      - id: 4
        slot: at_once
        given: two attempts at the same kid's allowance for the same day
        when: both run
        then: it is added exactly once
        level: integration
      - id: 3
        slot: fails
        given: a kid with a standing allowance due, and the work cannot be completed
        when: it is attempted again
        then: it is added exactly once
        level: integration
      - id: 5
        slot: after
        given: a kid with a standing allowance, on the day it falls due
        when: the allowance falls due
        then: the kid has the allowance more than they had before it fell due
---

Money is what everything else here is about, so this is where the delicate parts are: what
counts as a repeat, what happens when a kid spends past nothing, and who is allowed to
change any of it. The last of those is not answered here at all — it is
`only-a-parent-moves-money` and `a-kid-sees-only-their-own`, once, for everything.

Spending past nothing lives inside `record-spending` rather than beside it, because it is
the same press. It was written as its own exchange once, and the two then disagreed about
repeats without either of them saying so.
