---
title: Product Truth
---

# Product Truth

This directory contains the **product truth** for this codebase. Each subdirectory under
`productos/products/` is a **product area** (e.g. `auth/`, `checkout/`); each `.md` file
inside an area is a **feature**, with structured *behaviors* (atomic claims about what the
feature does) declared in its frontmatter and supporting prose in the body.

Above features sits **strategy** (`productos/context/`) — overarching goals, design
principles, personas, non-goals, and voice. Read those first; features must respect them.

Run `productos serve` and open http://localhost:7878 to browse this as a website.

When designing a new feature, **consult `context/` first**. When shipping a feature,
**update product truth + tracking in the same PR** so the diff captures both the code
change and the behavior change in one place.
