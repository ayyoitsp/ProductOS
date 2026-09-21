---
id: foil
title: Foil
exists: kept
terms:
  thing:
    means: A thing this corpus pretends to be about.
    # ⛔ An unverified claim that nothing here sets this, on a word two exchanges change. It
    # silenced requirement 3's only detector and was printed to the builder as product truth.
    set_outside:
      because: somewhere else is the system of record for this, allegedly
      by: nobody
      at: 2026-09-01
  orphan:
    means: Something read here and set by nothing, which is an unowned entity and not a subsystem.
views:
  - id: a-screen
    title: A screen
    view_kind: form
    walked: true
    parts:
      - id: go
        role: commits
        label: Go
      - id: elsewhere
        role: navigates
        label: Elsewhere
        leads_to: a-screen-that-does-not-exist
exchanges:
  # ⛔ `may` left absent so two `supplies` rules both reach it — which one wins was decided by
  # filename. And a criterion pointing at `again`, which neither this exchange nor any rule
  # answers.
  - id: two-rules-reach-may
    title: An exchange whose permission two rules both answer
    asked_by: system
    when:
      triggered_by: something elsewhere hands it over
      cadence: on-an-event
      # ⛔ Follows an ask nobody can find. The relation was prose, so two products could
      # describe one event with flatly opposite sentences and nothing read them together.
      follows: foil#an-ask-that-is-not-here
    reads: [thing]
    changes: []
    slots:
      with: { says: an input from somewhere else }
      answer: { says: something is recorded somewhere }
      refuses: { none: true }
      fails:
        # ⛔ Two references nothing resolved: a rule that does not exist, and a formal
        # exemption from one that never reached this slot. Both printed to the builder as
        # considered decisions, and one of them switched off `rule-governs-nothing`.
        instead_of:
          - rule: a-rule-that-was-never-written
            because: it plainly cannot apply to something with no person watching
        cannot_fail: there is nothing here that can go wrong
      at_once:
        defers_to:
          - rule: first-supplies-may
            because: that rule still holds here, though it answers a different slot entirely
        says: two at once is not a problem here
    criteria:
      - id: 1
        slot: again
        given: it is handed over twice
        then: something happens, which no slot here says anything about
  # Every slot claims there is nothing there — the blank-cell eraser.
  - id: nothing-here
    title: An exchange that says nothing while reading as settled
    asked_by: person
    at: { view: a-screen, part: go }
    reads: [thing]
    changes: [thing]
    slots:
      may: { says: anybody at all may ask for this }
      with: { says: what the asker brings }
      answer: { says: what it does }
      refuses: { none: true }
      fails: { cannot_fail: there is nothing that can go wrong }
      again: { says: it happens once }
      at_once:
        standing:
          kind: out_of_scope
          because: two people at once is not something the first release needs to answer at all
          answered_by: nobody
          answered_at: 2026-09-01
    criteria:
      - id: 1
        slot: fails
        given: something goes wrong
        then: the person is told, which no slot here says anything about
  # A criterion that pins a build and asserts unpromised behaviour.
  - id: over-asserting
    title: An exchange whose criterion invents a feature
    asked_by: person
    at: { view: a-screen, part: go }
    reads: [orphan]
    changes: []
    slots:
      may: { says: anybody at all may ask for this }
      with: { says: nothing in particular is required }
      answer: { says: it is recorded }
      refuses: { none: true }
      fails: { cannot_fail: it cannot }
      again: { says: asking twice is the same as asking once }
      at_once: { says: two people at once is fine here }
    criteria:
      - id: 1
        slot: answer
        given: a person on the screen
        when: they press it
        then: it is posted to Stripe within thirty seconds and a receipt is emailed to both parties
  # Two exchanges arriving at the same control — one press, two answers.
  - id: also-at-go
    title: A second exchange at the very same control
    asked_by: person
    at: { view: a-screen, part: go }
    reads: [thing]
    changes: []
    slots:
      may: { says: anybody at all may ask }
      with: { says: nothing at all is required }
      answer: { says: something else entirely happens }
      after: { says: the thing is now recorded as handed over }
      refuses: { none: true }
      fails: { cannot_fail: no }
      again: { says: it happens exactly once }
      at_once: { says: two people at once is fine here }
    criteria: []
  # ⛔ Declares it changes two words and says nothing is different afterwards. Before the eighth
  # slot existed, the state change lived as a clause inside `answer` prose and deleting it produced
  # a check output byte-identical to the original — the money moving out of a pocket-money product
  # with every surface reporting the corpus fine.
  - id: changes-and-leaves-nothing
    title: An exchange that changes two things and leaves nothing behind
    asked_by: system
    when: { triggered_by: a schedule somewhere, cadence: repeating }
    reads: [thing]
    # ⛔ `thing` only. Declaring `orphan` here would have given the corpus's deliberately unowned
    # word a writer and switched off `nothing-in-this-product-sets-this` — a foil silencing another
    # foil's detector, which is the hazard `check.ts` names as the cheapest way to hide it.
    changes: [thing]
    slots:
      may: { says: only the schedule may ask }
      with: { says: nothing beyond the schedule }
      answer: { says: the caller is told it ran }
      after: { none: true }
      refuses: { none: true }
      fails: { cannot_fail: it cannot }
      again: { says: running twice runs it twice }
      at_once: { says: two at once is fine }
    criteria: []
  # ⛔ The inverse: something is left behind and the exchange declares it touches nothing, so no
  # other promise can find out this one can move a word it reads.
  # ⛔ Exempt from a rule whose sentence nobody has written. `excepts` only checked the rule EXISTED,
  # so this rendered as `⊗Rn` on the grid and printed to the builder as a considered decision with
  # zero findings — a bet on whatever the rule turns out to say, which nothing would ever revisit.
  - id: exempt-from-the-unwritten
    title: An exchange exempt from a rule nobody has settled
    asked_by: system
    when: { triggered_by: a schedule somewhere, cadence: repeating }
    excepts:
      - rule: an-unsettled-rule
        because: it plainly cannot apply to something with no person watching at all
    reads: [thing]
    changes: [thing]
    slots:
      may: { says: only the schedule may ask }
      with: { says: nothing beyond the schedule }
      answer: { says: the caller is told it ran }
      after: { says: the thing is marked as having run }
      refuses: { none: true }
      fails: { cannot_fail: it cannot }
      again:
        # ⛔ The slot-level twin of the exemption above. `instead_of` "is the same cost as an
        # `excepts`, because it is the same act" — so it carries the same refusal: this slot claims
        # to REPLACE a sentence that does not exist.
        instead_of:
          - rule: an-unsettled-rule
            because: whatever that turns out to say, this one is deliberately different here
        says: running twice runs it twice
      at_once: { says: two at once is fine }
    criteria: []
  - id: leaves-what-it-never-declared
    title: An exchange that leaves something behind and declares it changes nothing
    asked_by: system
    when: { triggered_by: a schedule somewhere, cadence: repeating }
    reads: [thing]
    changes: []
    slots:
      may: { says: only the schedule may ask }
      with: { says: nothing beyond the schedule }
      answer: { says: the caller is told it ran }
      after: { says: the thing is now marked as having been seen }
      refuses: { none: true }
      fails: { cannot_fail: it cannot }
      again: { says: running twice runs it twice }
      at_once: { says: two at once is fine }
    criteria: []
  # A dispute, so the far side must render as contradicted too.
  - id: disputes-another
    title: An exchange that cannot hold with another
    asked_by: system
    when:
      triggered_by: something elsewhere in the product hands it over
      cadence: on-an-event
    reads: [thing]
    changes: [thing]
    slots:
      may: { says: the machinery is the only caller }
      with: { says: an input from somewhere else }
      answer:
        standing:
          kind: disputed
          # ⛔ A RULE among the targets, which is legal and was invisible from the rule's end. The
          # accusing slot was gated and reported; the rule stayed in the ready-to-accept list and
          # `accept` stamped it clean. One accept on a rule reaches every exchange its selector
          # touches, so it is the widest stamp in the model and the one a contradiction could not
          # reach.
          targets: [foil#also-at-go#answer, foil#nothing-here#answer, first-supplies-may]
          because: these cannot all be true of the same thing at once
      refuses: { none: true }
      fails: { cannot_fail: no }
      again: { says: it happens exactly once }
      at_once: { says: two people at once is fine here }
    criteria: []
depends_on: [not-a-scope-anywhere]
---

A corpus built entirely out of the attacks reviewers used to make the framework lie. It must
never pass.
