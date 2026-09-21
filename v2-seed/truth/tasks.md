---
id: tasks
title: Tasks
in: family-wallet
exists: kept
tags: [consumer]
views:
  - id: add-a-task
    title: Offer a task
    view_kind: form
    exists: intended
    walked: false
    parts:
      - id: what
        role: entry
        label: What needs doing
      - id: amount
        role: entry
        label: Worth
      - id: offer
        role: commits
        label: Offer it
        decorative: true
  - id: task-list
    title: Tasks
    view_kind: list
    walked: true
    sketch: |
      ┌──────────────────────────────┐
      │  Tasks                       │
      ├──────────────────────────────┤
      │  → Tidy your room     $2.00  │
      │    [ Done ]                  │
      │  → Walk the dog       $1.50  │
      │    [ Done ]                  │
      │                              │
      │           [ + Add a task ]   │
      └──────────────────────────────┘
    parts:
      - id: task-row
        role: display
        label: Tidy your room
      - id: done-button
        role: commits
        label: Done
      - id: add-task
        role: navigates
        label: + Add a task
        leads_to: add-a-task
exchanges:
  - id: complete-a-task
    title: A kid says a task is done
    asked_by: person
    at: { view: task-list, part: done-button }
    reads: [task]
    changes: [completion]
    slots:
      may:
        says: A kid may say a task of theirs is done. A kid may not approve it.
      with:
        says: The task, and which kid is saying it.
      after:
        says: >
          The task is waiting for a parent to approve it, and no money has moved.
      answer:
        says: >
          The task shows as waiting for a parent, and the kid is told it is waiting rather
          than done.
      refuses:
        outcomes:
          - name: already-waiting
            when: the same task is already waiting for a parent
            told: it is already waiting, with no second completion recorded
      at_once:
        standing:
          kind: open
          question: >
            Two kids are shown the same task on a shared device. Can both complete it, or
            is a task claimed by whoever presses first?
          asked_of: product
          asked_at: 2026-09-18
          blocks: []
    criteria:
      - id: 1
        slot: answer
        given: a task of this kid's that nobody has completed
        when: the kid says it is done
        then: it shows as waiting for a parent, and the kid is told it is waiting
      - id: 2
        slot: may
        given: a kid and a task belonging to a different kid
        when: the kid says it is done
        then: it is refused, and no completion is recorded
      - id: 3
        slot: after
        given: a task of this kid's that nobody has completed
        when: the kid says it is done
        then: the task is waiting for a parent to approve it, and nothing has been added to the kid's money
