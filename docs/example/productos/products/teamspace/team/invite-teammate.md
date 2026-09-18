---
id: teamspace/team/invite-teammate
title: Inviting a teammate
kind: feature
status: shipped
description: An admin invites someone to the team by email address and role.
ux:
  - id: invite-form
    title: Invite a teammate
    path: /team/invite
    sketch: |
      ┌──────────────────────────────┐
      │  Invite a teammate           │
      │  Email                       │
      │  [ name@company.com        ] │
      │  Role  [ Member          ▾]  │
      │            [ Send invite ]   │
      └──────────────────────────────┘
    elements:
      - id: email-input
        kind: input
        label: Email
      - id: role-select
        kind: select
        label: Role
      - id: send-button
        kind: button
        label: Send invite
affected_by: []
depends_on:
  - capabilities/user-account-manager/invite-user
  - capabilities/email-delivery/email-a-user
behaviors:
  - id: sending-shows-them-as-invited
    claim: |
      Sending the form invites that address at the chosen role, and the person appears on the team list as invited without the admin reloading.
    surface: invite-form
    element: send-button
    interaction: click
    cites:
      - glossary#invited
    test_cases:
      - id: 1
        description: the invited person appears on the team as invited
        level: e2e
    verified: true
    verified_at: 2026-09-17T22:36:24.530Z
    verified_by: peter
  - id: an-invite-needs-a-valid-address
    claim: |
      Send invite is refused until the email field holds a well-formed address. Nothing is sent and the form stays open with what was typed.
    surface: invite-form
    element: send-button
    interaction: click
    cites: []
    test_cases:
      - id: 1
        description: a malformed address is refused and nothing is sent
        level: e2e
      - id: 2
        description: the typed value survives the refusal
        level: e2e
  - id: an-outstanding-invite-is-explained-not-just-refused
    claim: |
      When the address already has an invite outstanding, the form says so and offers to resend it, rather than reporting a generic failure.
    surface: invite-form
    element: send-button
    interaction: click
    cites: []
    test_cases:
      - id: 1
        description: a duplicate names the outstanding invite and offers resend
        level: e2e
---

# Inviting a teammate

Teams grow by someone inside vouching for someone outside. This is the screen where that
happens: an address, a role, and immediate confirmation that the person is now expected.

## Why the duplicate case gets its own wording

`invite-user` refuses a second outstanding invite, and a refusal the admin cannot act on
reads as a broken button. Naming the outstanding invite — and offering to resend it —
turns the refusal into the next step.
