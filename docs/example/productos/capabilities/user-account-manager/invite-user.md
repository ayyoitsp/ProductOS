---
id: capabilities/user-account-manager/invite-user
title: Invite a user
kind: capability
status: shipped
description: |
  Putting a person into the system as invited, at a role, pending their acceptance.
ux: []
affected_by: []
depends_on: []
behaviors:
  - id: an-invited-person-is-in-the-system
    claim: |
      Inviting an address at a role puts that person in the system as invited, and they stay invited until they accept or the invite is withdrawn.
    cites: []
    test_cases:
      - id: 1
        description: an invited address is in the system as invited
        level: integration
      - id: 2
        description: accepting moves them from invited to active
        level: integration
    verified: true
    verified_at: 2026-09-17T22:36:24.916Z
    verified_by: peter
  - id: one-outstanding-invite-per-address
    claim: |
      At most one invite is outstanding for an address at a time. A second attempt while one is outstanding is refused, and the refusal names the outstanding invite.
    cites: []
    test_cases:
      - id: 1
        description: a second invite while one is outstanding is refused
        level: integration
  - id: the-invited-role-is-the-role-they-get
    claim: |
      A person carries the role they were invited at from the moment they accept. Nothing re-asks for it on acceptance.
    cites: []
    test_cases:
      - id: 1
        description: the invited role is the role they hold on accepting
        level: integration
---

# Invite a user

The way anybody enters the system. Inviting is deliberately separate from creating: an
invited person exists, can be seen and withdrawn, and has not yet agreed to anything.

## Why one outstanding invite, not many

Two live invites to one address mean two links, and whichever is used second fails for a
reason the recipient cannot act on. Holding one keeps the link they were sent the link
that works — and gives the inviting screen something specific to say.
