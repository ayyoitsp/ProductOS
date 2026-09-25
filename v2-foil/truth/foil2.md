---
# ⛔ A second scope declaring a screen the first one already declares. That duplication was the
# escape hatch from `one-press-two-answers`: two different answers on one button, zero findings,
# because the collision was keyed per scope.
id: foil-two
title: Foil, a second scope
in: foil
views:
  - id: a-screen
    title: The same screen name, declared twice
    view_kind: form
    walked: true
    parts:
      - id: go
        role: commits
        label: Go
exchanges: []
---

Refused for sharing a screen's identity.
