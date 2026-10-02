---
id: example/hello
title: Hello world example
status: shipped
description: A placeholder feature so the rendered site has something to show.
behaviors:
  - id: greeting-renders
    claim: 'When a user opens the home page, they see the text "Hello, world".'
    notes: |
      This is the smallest possible feature: one behavior with one claim,
      written in product language (no API/file references — those live in
      the tracking sidecar at productos/tracking/example/hello.yaml).
---

# Hello world example

This is a placeholder feature. Delete it (and the parent `example/` area) once you've
written your first real feature.

## How to structure a real feature

A feature file is a Markdown document with YAML frontmatter:

- **`id`**: `area/slug` — must match the file location.
- **`title`**: human-readable name.
- **`status`**: `planned` | `shipped` | `deprecated`.
- **`description`**: short product-language summary.
- **`behaviors`**: a list of atomic claims (see below).

Each **behavior** has:

- **`id`**: kebab-case, unique within the feature.
- **`claim`**: a single sentence describing what the product does, in *product* language (what the user does, what the user sees). Not in API/file terms.
- **`notes`**: free-form context, gotchas, design rationale.

That's it. Notice what's *not* here: code references, implementation paths,
verification status. Those are operational metadata and live in the *tracking
sidecar* at `productos/tracking/<area>/<feature>.yaml`:

```yaml
feature_id: example/hello
implements: [README.md]
behaviors:
  greeting-renders:
    code_refs: ["README.md:1"]
    status: verified
    last_verified: 2026-05-28
    verified_by: example
    history: [...]
```

This split keeps product truth standalone — diffs to *what the product does*
are separate from diffs to *which file implements it*.
