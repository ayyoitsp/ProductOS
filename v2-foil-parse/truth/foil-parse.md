---
# ⛔ REFUSED AT THE SCHEMA, NOT BY A DETECTOR — which is why it is in its own file.
#
# A parse refusal takes the whole file with it, so a schema-level attack and a semantic one
# cannot share a file: the parse failure masks every finding the detectors would have made.
# That is correct behaviour and a real constraint on how a foil is built.
#
# Two attacks here. `none` on a slot that is not `refuses` was a blank-cell eraser: an
# exchange with it on all seven read "0 blank", passed `check`, was offered for acceptance,
# and handed a builder seven lines of "nothing to refuse. Stated, not omitted." And
# `retention` is a true sentence about a product with nowhere to live — it must REFUSE
# rather than vanish, because that refusal is the only channel through which "the model has
# no way to say this" ever reaches anybody.
id: foil-parse
title: Foil, at the schema
retention: history is kept for two years
exchanges:
  - id: erases-every-cell
    title: An exchange claiming there is nothing in any slot
    asked_by: system
    when:
      triggered_by: nothing at all, which is the point
      cadence: repeating
    reads: []
    changes: []
    slots:
      may: { none: true }
      with: { none: true }
      answer: { none: true }
      refuses: { none: true }
      fails: { none: true }
      again: { none: true }
      at_once: { none: true }
    criteria: []
---

Refused before it loads.
