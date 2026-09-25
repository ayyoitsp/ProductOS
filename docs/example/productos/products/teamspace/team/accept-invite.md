---
id: teamspace/team/accept-invite
title: Accepting an invite
status: shipped
description: An invited person opens the link they were emailed and joins the team.
depends_on: [capabilities/user-account-manager/invite-user]
affected_by: [teamspace/team/invite-teammate]

ux:
  - id: accept-invite-page
    title: Accept invite
    runtime: public web, unauthenticated
    stub: true          # declared, never walked — behaviors may still anchor here

behaviors:
  - id: an-accepted-invite-cannot-be-reused
    claim: >
      Opening an invite link that has already been accepted explains it has been used
      and offers sign-in, rather than failing.
    surface: accept-invite-page
    interaction: view
    test_cases:
      - { id: 1, level: e2e, description: a used link explains itself and offers sign-in }

  - id: invite-expiry
    question: >
      Does an outstanding invite expire, and if so does the admin re-send it or does the
      recipient get a fresh link automatically?
    notes: Settled by product.
---

# Accepting an invite

The only screen in the product an outsider ever sees. They arrive from a link, with no
account and no session, and everything has to work from the link alone.

## Why a used link explains itself

A link that silently fails looks like a broken product to someone who has never seen
the product working. Saying it has been used, and offering sign-in, turns a dead end
into the one action that helps.
