# ProductOS — Use Cases

> **Retired 2026-08-03, pending rewrite.**

This document described three flows — scoped onboarding, feature development, and CI test-result
ingestion — under the git-native design, and asserted they were shipping behavior. That architecture is
retired and the claim no longer holds.

The two loops ProductOS is being built around now:

**Product — defining a feature.** Define it in the app; ProductOS surfaces relevant existing truth and
past decisions, flags contradictions and duplicates, captures behaviors and test cases, and produces a
packet an agent can build from.

**Engineering — after the change.** Reconciliation checks whether the code still matches validated
truth; mismatches surface as a single signal for a human to resolve.

Detail will follow once v0.1 exists. See [`OVERVIEW.md`](./OVERVIEW.md) for the model.
