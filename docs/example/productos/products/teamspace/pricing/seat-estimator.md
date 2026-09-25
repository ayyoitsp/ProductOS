---
id: teamspace/pricing/seat-estimator
title: Seat cost estimator
status: shipped
description: >
  A visitor tries seat counts and billing periods against published prices and sees
  what a plan would cost them. Nothing is saved and nobody is contacted.

ux:
  - id: estimator
    title: Seat estimator
    path: /pricing
    sketch: |
      ┌────────────────────────────────┐
      │  Estimate your cost            │
      │  Seats    [  12 ]  ▲▼          │
      │  Billing  (•) Monthly          │
      │           ( ) Yearly           │
      │  ────────────────────────────  │
      │  $144 / month                  │
      │  Yearly would save $288        │
      └────────────────────────────────┘
    elements:
      - { id: seat-stepper, kind: stepper, label: Seats }
      - { id: billing-toggle, kind: radio, label: Billing }
      - { id: total, kind: text, label: Total }
      - { id: saving-hint, kind: text, label: Saving hint }

behaviors:
  - id: the-total-follows-the-seat-count
    claim: >
      The total is the seat count times the per-seat price for the chosen billing period,
      and it updates as soon as either changes.
    cites:
      - glossary#seat
    surface: estimator
    element: total
    interaction: view
    test_cases:
      - { id: 1, level: e2e, description: raising seats raises the total immediately }
      - { id: 2, level: unit, description: twelve seats monthly shows the monthly rate times twelve }

  - id: seats-cannot-go-below-one
    claim: >
      The seat count stops at one. The estimator never shows a total for zero or fewer
      seats.
    surface: estimator
    element: seat-stepper
    interaction: click
    test_cases:
      - { id: 1, level: e2e, description: stepping down at one does nothing }

  - id: the-yearly-saving-is-shown-whenever-it-exists
    claim: >
      When yearly billing would cost less than twelve monthly payments for the same
      seats, the difference is shown as a saving. When it would not, nothing is shown.
    surface: estimator
    element: saving-hint
    interaction: view
    test_cases:
      - { id: 1, level: e2e, description: a saving is shown for a plan where yearly is cheaper }
      - { id: 2, level: e2e, description: no saving line when yearly is not cheaper }
---

# Seat cost estimator

Someone deciding whether to buy wants the number before they talk to anyone. The
estimator answers that on the pricing page, with no account and no commitment.

## Why nothing is saved

An estimate is a question, not an intent. Capturing it would turn browsing into a lead,
which is a different product decision — and the estimator works for someone who has not
agreed to be contacted.
