---
id: capabilities/email-delivery/email-a-user
title: Email a user
status: shipped
description: How anything in the product reaches one person by email.

behaviors:
  - id: one-email-per-recipient-per-event
    claim: >
      An event produces at most one email per recipient, however many times the event is
      retried or replayed.
    test_cases:
      - { id: 1, level: integration, description: replaying an event sends nothing further }

  - id: a-muted-channel-receives-nothing
    claim: >
      A recipient who has muted a channel receives no email on that channel, and the
      caller is told the message was suppressed rather than sent.
    test_cases:
      - { id: 1, level: integration, description: a muted recipient gets no mail }
      - { id: 2, level: integration, description: the caller is told it was suppressed, not delivered }
---

# Email a user

Every feature that needs to tell somebody something by email comes through here, so the
guarantees hold wherever the message came from.

## Why the caller is told about a suppression

A feature that believes it sent a message will tell the user it did. Answering
"suppressed" rather than "sent" is what lets the invite screen say *"this person has
muted invitations"* instead of promising an email that never left.
