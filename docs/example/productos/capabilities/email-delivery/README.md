---
title: Email delivery
---
The subsystem that gets mail to a person. Given an address, a template and the values
to fill it with, it promises what the recipient ends up with and what the caller is told
when it cannot deliver.

It has no opinion about *why* mail is being sent — an invite, a receipt and a password
reset are the same job here. Which mail a product sends, and what it says, belongs to
the feature that decided to send it.
