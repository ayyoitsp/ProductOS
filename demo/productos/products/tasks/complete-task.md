---
id: tasks/complete-task
kind: feature
title: Completing a task
status: shipped
description: |
  A parent works through the list of chores the family has agreed on and marks
  one done, choosing which kid earned it. Completing a task credits that kid.
  The amount and the wording are confirmed at the moment of completion, so the
  agreed price is a starting point rather than a rule.

ux:
  - id: task-list
    title: Tasks
    path: /tasks
    notes: |
      The whole tab is the list of tasks currently on offer. Tapping a row is
      how a task gets completed; the pencil is the only other action.
    sketch: |
      ┌──────────────────────────────────────┐
      │  Tasks                               │
      ├──────────────────────────────────────┤
      │  → Unload the dishwasher             │
      │    recurring              $0.75  ✓ ✎ │
      │                                      │
      │  → Wash the car                      │
      │    one-time               $5.00  ✓ ✎ │
      │                                      │
      │  → Take out the bins                 │
      │    recurring              $0.50  ✓ ✎ │
      │                                      │
      │         <+ Add a task>               │
      └──────────────────────────────────────┘
    sketch_html: |
      <div style="background:#fffbf5;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;min-height:420px;">
        <div style="font-size:22px;font-weight:700;margin-bottom:14px;">Tasks</div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="background:#fff;border:1px solid #fed7aa;border-radius:14px;padding:14px;display:flex;align-items:center;gap:10px;">
            <a style="flex:1;text-decoration:none;color:inherit;cursor:pointer;">
              <div style="font-size:16px;font-weight:600;">Unload the dishwasher</div>
              <div style="font-size:12px;color:#78716c;margin-top:2px;">recurring</div>
            </a>
            <div style="font-size:16px;font-weight:700;color:#16a34a;">$0.75</div>
            <div style="color:#f97316;font-size:22px;">&#9678;</div>
            <div style="color:#78716c;padding-left:10px;">&#9998;</div>
          </div>
          <div style="background:#fff;border:1px solid #fed7aa;border-radius:14px;padding:14px;display:flex;align-items:center;gap:10px;">
            <a style="flex:1;text-decoration:none;color:inherit;cursor:pointer;">
              <div style="font-size:16px;font-weight:600;">Wash the car</div>
              <div style="font-size:12px;color:#78716c;margin-top:2px;">one-time</div>
            </a>
            <div style="font-size:16px;font-weight:700;color:#16a34a;">$5.00</div>
            <div style="color:#f97316;font-size:22px;">&#9678;</div>
            <div style="color:#78716c;padding-left:10px;">&#9998;</div>
          </div>
        </div>
        <div style="margin-top:18px;display:flex;align-items:center;justify-content:center;gap:8px;color:#f97316;font-weight:600;">
          <span style="font-size:18px;">&#8853;</span><a style="color:#f97316;text-decoration:none;">Add a task</a>
        </div>
      </div>
    elements:
      - id: task-row
        kind: card
        label: Task row
        leads_to: complete-task-sheet
        notes: One per task on offer. Shows the name, whether it recurs, and the agreed amount. Tapping it starts a completion.
      - id: task-amount
        kind: text
        label: Task amount
        notes: The amount agreed for this task, shown in the credit colour.
      - id: recurrence-label
        kind: text
        label: Recurrence
        notes: Reads "recurring" or "one-time" — whether the task comes back after being done.
      - id: edit-task
        kind: button
        label: Edit task
        leads_to: tasks/add-task
        notes: Pencil on each row. Opens the task for editing rather than completing it.
      - id: add-task
        kind: button
        label: Add a task
        leads_to: tasks/add-task
      - id: empty-state
        kind: text
        label: Empty state
        notes: Shown when no tasks are on offer, with an example of what a task looks like.

  - id: complete-task-sheet
    title: Complete task
    notes: |
      A sheet over the task list. Everything in it is pre-filled from the task
      and editable, because the agreed price is a starting point — the parent
      settles the final wording and amount at the moment the work is judged done.
    sketch: |
      ┌──────────────────────────────────────┐
      │  Complete task                       │
      │                                      │
      │  Task                                │
      │  [ Unload the dishwasher           ] │
      │                                      │
      │  Amount                              │
      │  [ 0.75                            ] │
      │                                      │
      │  Comment (optional)                  │
      │  [                                 ] │
      │                                      │
      │  Who did this?                       │
      │   (Mia)  ( Leo )  ( Ada )            │
      │                                      │
      │      [ Cancel ]      [ Confirm ]     │
      └──────────────────────────────────────┘
    sketch_html: |
      <div style="background:rgba(0,0,0,0.35);padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:460px;display:flex;align-items:center;justify-content:center;">
        <div style="background:#fff;border-radius:18px;padding:18px;width:100%;max-width:420px;display:flex;flex-direction:column;gap:12px;color:#1c1917;">
          <div style="font-size:18px;font-weight:700;">Complete task</div>
          <div>
            <div style="font-size:12px;font-weight:600;color:#78716c;margin-bottom:4px;">Task</div>
            <div style="border:1px solid #fed7aa;border-radius:10px;padding:10px;">Unload the dishwasher</div>
          </div>
          <div>
            <div style="font-size:12px;font-weight:600;color:#78716c;margin-bottom:4px;">Amount</div>
            <div style="border:1px solid #fed7aa;border-radius:10px;padding:10px;">0.75</div>
          </div>
          <div>
            <div style="font-size:12px;font-weight:600;color:#78716c;margin-bottom:4px;">Comment (optional)</div>
            <div style="border:1px solid #fed7aa;border-radius:10px;padding:10px;color:#a8a29e;">&nbsp;</div>
          </div>
          <div>
            <div style="font-size:12px;font-weight:600;color:#78716c;margin-bottom:6px;">Who did this?</div>
            <div style="display:flex;gap:8px;">
              <div style="background:#f97316;border:1px solid #f97316;color:#fff;font-weight:600;border-radius:999px;padding:6px 14px;">Mia</div>
              <div style="background:#fef3c7;border:1px solid #fed7aa;font-weight:600;border-radius:999px;padding:6px 14px;">Leo</div>
              <div style="background:#fef3c7;border:1px solid #fed7aa;font-weight:600;border-radius:999px;padding:6px 14px;">Ada</div>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:4px;">
            <a style="flex:1;text-align:center;border:1px solid #fed7aa;border-radius:10px;padding:10px;color:#78716c;font-weight:600;text-decoration:none;">Cancel</a>
            <a style="flex:1;text-align:center;background:#16a34a;border-radius:10px;padding:10px;color:#fff;font-weight:700;text-decoration:none;">Confirm</a>
          </div>
        </div>
      </div>
    elements:
      - id: task-name-input
        kind: input
        label: Task
        notes: Pre-filled with the task's name. Editable for this completion only.
      - id: amount-input
        kind: input
        label: Amount
        notes: Pre-filled with the task's agreed amount. Editable for this completion only.
      - id: comment-input
        kind: input
        label: Comment
        notes: Optional. Appended to the task name on the resulting transaction.
      - id: kid-chip
        kind: toggle
        label: Who did this?
        notes: One chip per kid. Exactly one is chosen; the chosen chip fills with that kid's colour.
      - id: cancel-button
        kind: button
        label: Cancel
      - id: confirm-button
        kind: button
        label: Confirm

behaviors:
  # ---------- Opening a completion ----------

  - id: tapping-a-task-starts-a-completion
    claim: Tapping a task on the list opens a completion sheet for that task, pre-filled with the task's name and its agreed amount.
    surface: task-list
    element: task-row
    interaction: tap
    test_cases:
      - id: 1
        level: e2e
        description: The sheet opens pre-filled from the task tapped
        given: a task "Unload the dishwasher" agreed at $0.75
        when: the parent taps that task
        then: the completion sheet opens with the task name "Unload the dishwasher" and the amount 0.75
      - id: 2
        level: e2e
        description: A different task pre-fills differently
        given: the same list also holds "Wash the car" at $5.00
        when: the parent taps "Wash the car"
        then: the sheet shows "Wash the car" and 5.00

  - id: a-task-cannot-be-completed-with-no-kids
    claim: With no kids in the family, tapping a task does not open the completion sheet. The parent is told to add a kid first.
    surface: task-list
    element: task-row
    interaction: tap
    notes: |
      A completion has to credit someone. Opening a sheet whose only required
      choice cannot be made would be a dead end.
    test_cases:
      - id: 1
        level: e2e
        description: Tapping a task with no kids explains why nothing happened
        given: a family with tasks but no kids
        when: the parent taps a task
        then: no completion sheet opens and the parent is told to add a kid first
      - id: 2
        level: e2e
        description: Adding a kid makes completion available
        given: the same family after one kid has been added
        when: the parent taps a task
        then: the completion sheet opens

  - id: a-single-kid-is-chosen-already
    claim: When the family has exactly one kid, that kid is already chosen when the sheet opens. With more than one kid, nobody is chosen and the parent must pick.
    surface: complete-task-sheet
    element: kid-chip
    interaction: view
    notes: |
      With one kid there is no choice to make, and asking for it would be a
      step with one possible answer. With several, guessing would credit the
      wrong kid quietly.
    test_cases:
      - id: 1
        level: e2e
        description: One kid is pre-chosen
        given: a family with only Mia
        when: the parent opens a completion
        then: Mia is already chosen
      - id: 2
        level: e2e
        description: Several kids leaves the choice open
        given: a family with Mia, Leo and Ada
        when: the parent opens a completion
        then: no kid is chosen

  # ---------- What the parent settles ----------

  - id: the-amount-is-confirmed-not-fixed
    claim: The parent can change the amount before confirming, and the credit is for the amount they confirm rather than the task's agreed amount.
    surface: complete-task-sheet
    element: amount-input
    interaction: input
    test_cases:
      - id: 1
        level: integration
        description: A changed amount is what gets credited
        given: a task agreed at $0.75 and a completion sheet open for Mia
        when: the parent changes the amount to 1.00 and confirms
        then: Mia is credited $1.00
      - id: 2
        level: integration
        description: An unchanged amount credits the agreed amount
        given: the same task
        when: the parent confirms without touching the amount
        then: Mia is credited $0.75

  - id: confirming-does-not-change-the-task
    claim: Editing the name or amount on the completion sheet applies to that completion only. The task keeps its own name and agreed amount for next time.
    notes: |
      This is what makes a recurring task usable — paying a bit more for a job
      done unusually well should not silently renegotiate the standing price.
    test_cases:
      - id: 1
        level: integration
        description: A one-off higher amount leaves the task's price alone
        given: a recurring task agreed at $0.75
        when: the parent completes it at $1.00
        then: the credit is $1.00 and the task still shows $0.75 on the list
      - id: 2
        level: integration
        description: A one-off renaming leaves the task's name alone
        given: a recurring task named "Unload the dishwasher"
        when: the parent completes it having typed "Unload + put away"
        then: the transaction reads "Unload + put away" and the task is still named "Unload the dishwasher"

  - id: a-comment-is-appended-to-the-task-name
    claim: A comment entered on the sheet is appended to the task name on the resulting credit, separated by a dash. Left blank, the credit reads as the task name alone.
    surface: complete-task-sheet
    element: comment-input
    interaction: input
    test_cases:
      - id: 1
        level: integration
        description: A comment is appended
        given: a completion of "Wash the car" with the comment "did the wheels too"
        when: the parent confirms
        then: the resulting credit reads "Wash the car — did the wheels too"
      - id: 2
        level: integration
        description: No comment leaves the name alone
        given: the same completion with the comment left blank
        when: the parent confirms
        then: the resulting credit reads "Wash the car"
      - id: 3
        level: unit
        description: Surrounding whitespace in a comment is ignored
        given: a comment of "   " only
        when: the parent confirms
        then: the credit reads as the task name alone

  # ---------- What is refused ----------

  - id: someone-must-be-credited
    claim: Confirming without choosing a kid is refused. Nothing is recorded and the sheet stays open.
    surface: complete-task-sheet
    element: confirm-button
    interaction: submit
    test_cases:
      - id: 1
        level: e2e
        description: Confirming with nobody chosen is refused
        given: a completion sheet with several kids and none chosen
        when: the parent taps Confirm
        then: the parent is asked to choose who gets credit, the sheet stays open, and no credit is recorded

  - id: a-completion-needs-a-name
    claim: Confirming with the task name cleared is refused. Nothing is recorded and the sheet stays open.
    surface: complete-task-sheet
    element: confirm-button
    interaction: submit
    test_cases:
      - id: 1
        level: e2e
        description: An empty name is refused
        given: a completion sheet with the task name cleared
        when: the parent taps Confirm
        then: the parent is told a name is required and no credit is recorded
      - id: 2
        level: e2e
        description: A whitespace-only name is refused
        given: a completion sheet whose name is only spaces
        when: the parent taps Confirm
        then: the completion is refused

  - id: a-completion-must-be-worth-something
    claim: Confirming with an amount of zero, a negative amount, or something that is not an amount is refused. Nothing is recorded and the sheet stays open.
    surface: complete-task-sheet
    element: confirm-button
    interaction: submit
    notes: |
      A task worth nothing is not a completion. Unlike a spend, there is no
      reading under which zero is meaningful here.
    test_cases:
      - id: 1
        level: e2e
        description: Zero is refused
        given: a completion sheet with the amount set to 0
        when: the parent taps Confirm
        then: the parent is told the amount is invalid and no credit is recorded
      - id: 2
        level: e2e
        description: A negative amount is refused
        given: a completion sheet with the amount set to -1.00
        when: the parent taps Confirm
        then: the completion is refused
      - id: 3
        level: e2e
        description: Text that is not an amount is refused
        given: a completion sheet with the amount set to "abc"
        when: the parent taps Confirm
        then: the completion is refused

  # ---------- What a completion does ----------

  - id: completing-credits-the-chosen-kid
    claim: Confirming a completion records a credit against the chosen kid for the confirmed amount, and only against that kid.
    surface: complete-task-sheet
    element: confirm-button
    interaction: submit
    test_cases:
      - id: 1
        level: integration
        description: The chosen kid is credited
        given: Mia at $2.00, Leo at $2.00, and a completion of a $0.75 task for Mia
        when: the parent confirms
        then: Mia's balance is $2.75 and Leo's is unchanged at $2.00
      - id: 2
        level: integration
        description: The credit is attributable to the task
        given: the same completion
        when: the parent confirms
        then: the resulting credit is recorded as having come from completing a task

  - id: a-one-time-task-leaves-the-list-once-done
    claim: Completing a one-time task takes it off the list of tasks on offer. It is not offered again.
    surface: complete-task-sheet
    element: confirm-button
    interaction: submit
    test_cases:
      - id: 1
        level: e2e
        description: A one-time task disappears after completion
        given: a one-time task "Wash the car" on the list
        when: the parent completes it
        then: the task list no longer offers "Wash the car"
      - id: 2
        level: integration
        description: The credit survives the task leaving the list
        given: the same completion
        when: the parent looks at the kid's history
        then: the credit for "Wash the car" is still there

  - id: a-recurring-task-stays-on-the-list
    claim: Completing a recurring task leaves it on the list, ready to be completed again.
    surface: complete-task-sheet
    element: confirm-button
    interaction: submit
    test_cases:
      - id: 1
        level: e2e
        description: A recurring task is still offered after completion
        given: a recurring task "Unload the dishwasher"
        when: the parent completes it
        then: the task is still on the list with its agreed amount unchanged
      - id: 2
        level: integration
        description: Completing twice credits twice
        given: the same recurring task completed for Mia, then for Leo
        when: both completions are confirmed
        then: Mia and Leo each hold one credit for that task

  - id: a-completion-is-confirmed-back-to-the-parent
    claim: After a completion is recorded, the parent is shown what was credited, for how much, and to whom.
    surface: complete-task-sheet
    element: confirm-button
    interaction: submit
    notes: |
      The sheet closes on confirm, so without this the parent is returned to an
      unchanged-looking list with no sign the credit landed.
    test_cases:
      - id: 1
        level: e2e
        description: The confirmation names the task, the amount and the kid
        given: a completion of "Unload the dishwasher" at $0.75 for Mia
        when: the parent confirms
        then: the parent sees a confirmation naming the task, $0.75, and Mia

  - id: backing-out-records-nothing
    claim: Cancelling the sheet, or tapping outside it, returns to the task list without recording anything — even when a kid, an amount and a comment have all been entered.
    surface: complete-task-sheet
    element: cancel-button
    interaction: tap
    test_cases:
      - id: 1
        level: e2e
        description: Cancel records nothing
        given: a fully filled-in completion sheet
        when: the parent taps Cancel
        then: the task list is shown, no credit is recorded, and the task is still on offer
      - id: 2
        level: e2e
        description: Tapping outside the sheet records nothing
        given: the same sheet
        when: the parent taps outside it
        then: the sheet closes and no credit is recorded
      - id: 3
        level: e2e
        description: Re-opening starts clean
        given: a sheet that was cancelled with a comment typed in
        when: the parent taps the same task again
        then: the comment is empty and the name and amount are back to the task's own

  # ---------- Undecided ----------

  - id: repeat-completion-guard
    question: >
      Should completing the same task twice in quick succession be prevented, or is a
      double credit the parent's problem to undo? Nothing in the flow refuses a second
      completion, and for a recurring task two credits in a row is legitimate — so it is
      not clear this is a mistake worth blocking at all.
    notes: Settled by product.

  - id: completion-history-per-task
    question: >
      Does a task carry its own record of having been completed — how often, by which
      kid — or is the credit on the kid the only record? Today a completion is only
      visible from the kid's side, so nothing answers "who usually does this one".
    notes: Settled by product.
---

# Completing a task

A family agrees on a list of chores and what each one is worth. Completing a task is
the moment a parent judges one of them done and decides who earned it — which is the
only way money enters a kid's balance through work rather than as a gift.

## The agreed amount is a starting point, not a rule

Every task carries a name and an amount the family settled on in advance. When a
parent completes it, both are pre-filled and **both are editable for that completion
only**:

```
task on the list        "Unload the dishwasher"   $0.75   (unchanged)
this completion         "Unload + put away"       $1.00   → credited to Mia
next time it is offered "Unload the dishwasher"   $0.75
```

That separation is what makes a recurring chore workable. Paying a bit more for a job
done unusually well should not quietly renegotiate the standing price, and a one-off
note about what actually happened should not rewrite the chore's name.

A comment is appended to the name on the resulting credit, so the kid's history reads
as what they did rather than as a bare task label.

## Recurring and one-time tasks diverge at completion

This is the only place the distinction matters. A one-time task is taken off the list
once it is done; a recurring one stays, ready to be earned again — by the same kid or a
different one. Either way the credit already recorded is untouched by what happens to
the task afterwards.

## What the flow refuses

Three things, all for the same reason — a completion that cannot be attributed is worse
than no completion:

- **Nobody chosen.** A credit has to belong to exactly one kid.
- **No name.** The kid's history would carry a blank entry.
- **Nothing, or less than nothing, as an amount.** Unlike a spend, there is no reading
  under which a task worth zero is meaningful.

None of the three records anything or closes the sheet, so nothing typed is lost.

## Who works here

A **parent** completes tasks; they are the only person who can, because completing one
credits money. A **kid** never appears in this flow — they see the result on their own
balance, not the judgement that produced it.

