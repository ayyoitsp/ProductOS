---
name: productos-vet
description: Use when the user wants to vet (accept / edit / reject) ProductOS behaviors inline in the Claude Code session — without switching to the product-truth site in a browser. Presents Unverified or Contested behaviors one at a time with their claim, evidence (test results, code-consistency, test-coverage), and asks for single-keystroke responses (Y/N/E/S). Triggers on "vet productos behaviors", "vet the X feature", "use productos-vet on X", "let's go through the unverified behaviors". Site and Claude/text are co-equal vetting surfaces in v0.1 — this is the in-terminal one.
version: 0.1.0
---

# ProductOS — Vet Skill (in Claude/text, co-equal with the site)

The user wants to vet behaviors without leaving Claude Code. You present each behavior one at a time, surface its evidence, and accept a single-keystroke response.

The site (`localhost:7878`) does the same thing visually. Both call the same MCP tools and produce the same DB state. The user picks whichever fits the moment — you don't have to argue for one over the other.

## Process

### 1. Pick the scope

If the user names a feature (`vet checkout/index`) → scope to that feature.
If they don't → list candidates from `productos_get_gaps({ type: "unverified" })`.

Present:

```
ProductOS has N behaviors to vet across M features:
  • checkout/index — 3 unverified
  • auth/signup — 2 unverified
  • billing/invoice — 1 contested

Which scope? (feature_id, "all", or skip)
```

### 2. Walk the scope

For each behavior in order:

1. Call `productos_get_feature(id)` to get the feature + tracking
2. For each behavior with derived state ∈ {Unverified, Orphan, Uncertain, Contested}, present it as a card:

```
Behavior 1 of 4: checkout/index#guest-flow
─────────────────────────────────────────────
Claim:    A guest user can complete checkout without creating an account;
          the order is recorded against their guest email.

Evidence:
  ✓ Code looks consistent (read src/checkout/index.ts:42)
  ⚠ No existing test covers this — orphan if you accept

Test cases:
  1. [e2e] Guest reaches confirmation page without an account prompt
  2. [api] Order record carries the guest email

State:    Unverified
─────────────────────────────────────────────
[Y] accept   [E] edit claim   [N] reject   [S] skip   [Q] quit
```

3. Wait for the user's keystroke. Possible responses:

| Key | Action | MCP call |
|---|---|---|
| `Y` | Accept the claim as-is | `productos_update_tracking({ feature_id, behavior_id, status: "verified", setVerified: true })` |
| `E` | User wants to edit. Ask: "Reword the claim:" — accept the new text — confirm — call `productos_update_behavior({ feature_id, behavior_id, claim: <new> })` then accept | propose+accept |
| `N` | Reject. Ask: "Reason?" — accept reason — call the rejection path (set `deprecated: true` on the behavior in markdown + tracking status=deprecated). | propose `deprecated: true` via `productos_update_behavior` |
| `S` | Skip — leave Unverified, move on |
| `Q` | Quit the vet session |

4. After each action, show a one-line confirmation:

```
  ✓ Accepted. Derived state: Verified (no test signal yet, will become Orphan
    until a test result is received or coverage_ref is set — consider `productos test align`)
```

Or:

```
  ✓ Edited and accepted. Markdown updated.
```

5. Move to the next behavior.

### 3. Summarize at the end

```
Vetted N behaviors across M features:
  • Accepted: A    (now Verified or Orphan, depending on evidence)
  • Edited:   B
  • Rejected: C    (now Deprecated in markdown)
  • Skipped:  D
  • Quit early: E remaining

Markdown changes ready to commit:
  productos/products/checkout/index.md
  productos/products/auth/signup.md

Tracking changes (DB-only, no commit needed):
  3 acceptance events
  1 deprecation event

Next steps:
  • Run `productos test align <feature_id>` to map existing tests to declared cases
    (turns Orphan → Verified for the ones that already have coverage)
  • Or implement code + tests for the behaviors you accepted, then post results
    via `productos test record`
```

## Rules

- **Present evidence honestly.** If code-consistency says "uncertain," show that. Don't hide hedges.
- **Respect Q.** If the user quits, stop cleanly. Don't auto-resume.
- **One behavior at a time.** Don't batch-display three behaviors and ask for three responses. The point of inline vetting is one focused decision per exchange.
- **Show derived state, not raw tracking.** Use the derived state language: Verified / Contested / Orphan / Uncertain / Unverified. That's what the PM sees in the site too.
- **Never auto-accept.** Even for behaviors that look obviously correct. The whole point is the human's signal.

## Don't

- **Don't open a browser.** The user picked Claude/text on purpose. Don't suggest the site mid-flow unless they ask.
- **Don't bulk-flip.** No "accept all the Unverified ones." Each behavior gets its moment.
- **Don't skip evidence.** Even on simple-looking behaviors, surface what the system knows. If there's no evidence, say so — that's the Orphan signal.
- **Don't write code.** Vetting is judgment over markdown. Code changes are downstream.
