# ProductOS — Usage

> **Canonical conceptual reference:** [`OVERVIEW.md`](OVERVIEW.md). This doc captures how people actually use the system — personas, daily flows, what's load-bearing.

---

## 1. Who uses ProductOS

The v0.1 user is a **product-lead person willing to install Claude Code as a one-time setup**. They have the repo checked out locally. They author intent and validate the build through **two co-equal surfaces**: the product-truth site at `localhost:7878` (browser) and the Claude/text skill flow inside Claude Code (terminal). Both surfaces call the same MCP tools and produce the same DB state — the PM picks whichever fits the moment. The "developer" exists too, but downstream — they're the *builder* who consumes the spec ProductOS produces, often Claude in agent mode running the actual codebase changes.

| Persona | Cadence | Primary surface |
| --- | --- | --- |
| **Product lead (v0.1 primary)** | Daily during feature cycles | **Either**: product-truth site (batch review, deep inspection of behaviors + evidence) **or** Claude Code session (inline vet — skill presents behavior, PM types Y/N/E). PM picks per moment |
| **Builder (engineer or Claude in agent mode)** | Per feature | Reads the Contract spec via MCP (or as a packet). Writes code + tests. CI surfaces results back to ProductOS |
| **Eng lead / reviewer** | Weekly | Site Drift view, `productos gaps` for coverage gaps and orphans |
| **Wider team (as the corpus grows)** | Occasional | Site read-mode for "what does our product do?" |

The product-lead person is the v0.1 wedge. **Site is for batch review and deep inspection; Claude/text is for inline vetting without context switching.** Both are first-class. The CLI is a one-time install + serve step they barely interact with after setup. As the team grows, more people read the corpus; the authoring lock stays light.

---

## 2. The core loop

Everything in ProductOS exists to serve this loop:

```
   Product Context (durable)  ──┐
                                 │
   Code  ──► Claude (analyzer skill) ──► proposes Contracts via MCP
                                 │
                                 ▼
                    productos/products/<area>/<feature>.md  (Unverified)
                                 │
                                 ▼
                        Product-truth site
                          (read · edit · accept)
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
        edit content                      flip state
        (markdown commit)                 (DB write, no commit)
                │                                 │
                └────────────────┬────────────────┘
                                 ▼
                       Product Truth (Verified corpus)
                                 │
                ┌────────────────┼────────────────┐
                ▼                ▼                ▼
        Implementation   Drift signals    Context for next
        packet export    (drift skill,    agent session
                          feedback)
        ─ Handoff ─      ─ Maintenance ─  ─ Prevention ─
```

The loop is what makes the spec come alive. Without it, ProductOS is a folder of markdown. With it, every meaningful agent action happens against verified Product Truth, proposes new Contracts with Evidence, and feeds back into the corpus *only after human acceptance*. The HITL iteration in the product-truth site is the trust anchor.

---

## 3. Adoption journey

ProductOS adoption is **scoped to an in-flight feature, not the whole codebase.** You don't model your product upfront; you protect one feature you're already working on, feel the value, then grow the corpus feature-by-feature.

### Minute 1 — Install (one-time, ~3 minutes)

```
$ npm i -g productos
$ cd my-app
$ productos init claude
✓ Skill installed, MCP registered, productos/ scaffolded
$ productos serve     # leave running in a terminal tab
```

That's the entire dev-shaped setup. From here, daily work happens in Claude Code + the product-truth site at http://localhost:7878.

### Minute 5 — First scoped pass on a real feature

Pick a feature you're about to change (or one you want to protect from regression). In Claude Code:

> *"Run ProductOS feature scope on the checkout flow."*

The skill walks the relevant code paths, proposes **3-5 behaviors** for that feature with claims + test cases in product language, and writes them to `productos/products/checkout/index.md`. Not 30 Contracts. Not the whole codebase. One feature, a handful of behaviors, sized for a 60-second vet.

### Minute 6 — Vet (pick a surface)

The PM has two co-equal vet surfaces. Either works; pick whichever fits the moment.

**Surface A — In Claude Code (inline, no context switch).** The skill presents each proposed behavior one at a time:

```
Behavior 1 of 4: checkout/guest-flow
Claim: A guest user can complete checkout without creating an account.
Code-consistency: looks consistent (src/checkout.ts:42)
Test-coverage: no existing test covers this
Test cases: 1. Guest reaches confirmation page  2. Order persists with guest email
[Y]accept  [N]reject  [E]edit  [S]skip
```

PM types `Y`, `N`, `E`, or `S` per behavior. Writes go through the same MCP tools the site uses.

**Surface B — In the product-truth site** (`http://localhost:7878`). Visual grid of the 4 proposed behaviors with **Unverified** badges. Per behavior:

- Read the claim. Is this what the product is supposed to do?
- Accept, edit, or reject. Keyboard-friendly; one click per behavior.
- Code-consistency and test-coverage analyses show as evidence badges next to the claim ("Code: looks consistent" / "Tests: covered by `src/checkout.test.ts:42`").

Either surface, a typical first vet is under 5 minutes. The feature now has product-language Truth committed in the repo.

### Minute 10 — Hand off to the builder

The builder is either you, another dev, or **Claude in agent mode** in the same Claude Code session. They read the Contract directly via MCP (no separate packet needed in v0.1; the markdown is the packet). They implement, write tests against the declared test cases, and push.

### Minute 20+ — Validate post-build

CI runs the tests. Results flow back via `productos test record` (or the MCP equivalent). You reopen the site:

- Behaviors with passing tests: **Verified** (green)
- Behaviors with failing tests: **Contested** (red — needs attention before merge)
- Behaviors with no tests received: **Orphan** (yellow — the builder may have cherry-picked; check)

This is the **felt-value moment**: you shipped a feature *knowing the product intent was conveyed faithfully* (the builder read your declared behaviors) *and you can validate it happened* (test signals + AI-derived code-consistency signals on the same dashboard).

### Day 1+ — Grow the corpus feature-by-feature

Every subsequent feature you scope adds 3-5 more behaviors. There's no "model the whole product" ceremony. After a month of normal feature work, you naturally have 30-60 verified behaviors — built up at the moments where they were actually cared about.

The implementer flow each cycle:

- Reads test cases in the site to know what acceptance looks like
- Aligns existing tests when present (`productos test align` — proposes mappings so existing tests adopt declared cases without duplication)
- Writes runnable tests against the test cases that aren't already covered
- Encodes each test case's stable id (e.g. `auth/signup#duplicate-email/1`) in the test name so CI results map back
- Posts test results back to ProductOS from CI

In v0.1 ProductOS does not auto-generate runnable test files for every behavior. The scaffolder (`productos test scaffold`) emits skeletons for net-new cases — useful at unit/integration/api level, mostly a forcing function at e2e where the harness depends on your stack. For most existing repos, **align is the dominant flow**; scaffolding is the tail case.

### When to add Strategy (optional)

`productos/context/*.md` — goals, design principles, personas, non-goals, voice — is available from day 1, but not required. Add it when you have enough features that cross-cutting consistency matters (typically after 5-10 features). When you do, the analyzer skill reads Strategy first and uses it to constrain every behavior it proposes thereafter.

### Week 1 — The flywheel starts

Claude finishes a change to the auth flow. Via the analyzer skill:

1. Re-reads Product Context (if filled in)
2. Reads its Contract changes against the modified code
3. Produces fresh code-consistency + test-coverage evidence on the affected Contracts
4. Proposes new Contracts (Unverified) for behaviors the change introduced, and surfaces drift events for Contracts the change might have broken

You open the site, accept the new ones, address the contested ones. 5 minutes.

The corpus grows; Claude in any subsequent session sees the verified Contracts as context, and doesn't break them.

### Month 1 — Gaps become the team's pulse

```
$ productos gaps

Summary: 14 gaps

Unverified (4):           code exists, never accepted
Coverage (2):             code surface with zero Contracts
Stale (3):                Verified past freshness TTL
Contested (1):            test failure or feedback challenging Truth
Ownership (1):            Contract with no owner
Implementation (3):       Planned Contract with no code yet
```

Gaps tell the team what to work on next: what to verify, what to write Contracts for, what to refresh, what to investigate.

---

## 4. Day-in-the-life flows

### Flow A — Pre-PR drift scan (the daily flow)

Before opening a PR, the engineer runs the drift skill against their branch.

```
Engineer: "Claude, run a productos drift scan on my branch"
Claude: [Reads diff against main; identifies 5 affected Contracts via implements/code_refs overlap]
Claude: [Runs code_change analyzer on each]
Claude: "Scan complete:
  • 3 Contracts: self-healed (cosmetic / mechanical-rename / file-move)
  • 1 Contract: ambiguous — escalated as Drift
       auth/signup#welcome-email: refactor in the email-queue call — can't tell if observable behavior changed
  • 1 Contract: load-bearing change — escalated as Drift with proposed Contract edit
       billing/invoice#tax-row: tax calculation rounding changed from floor to round
       Proposed claim edit: 'Tax line uses banker's rounding (HALF_EVEN)'"
Claude: "Open the product-truth site to vet the 2 escalated Contracts."

Engineer: [Opens site, accepts the billing/invoice claim edit, takes 1 minute on the ambiguous one and accepts as-is]
Engineer: [Opens PR — code change + 1 Contract edit are in the diff together]
```

**What this flow eliminated**: the engineer didn't manually scan for affected Contracts. Cosmetic and mechanical changes flowed through without attention. Only the two load-bearing items needed judgment.

### Flow B — Engineer + agent fixing a bug

The 80% case. The engineer barely interacts with ProductOS directly.

```
Engineer: "Claude, the multi-page PDFs are dropping last-page data"
Claude: [Reads Product Context — sees 'every extracted field must carry source citation' as a design principle]
Claude: [Pulls verified Contracts for documents/extraction]
Claude: [Sees the page-citation Contract is Verified; suspects regression]
Claude: "I found the bug. The chunker is off-by-one on odd-page docs. Patching."
Claude: [Patches the chunker]
Claude: [Runs the user's normal test suite for the affected area]
Tests: ✓ pass (Contract stays Verified)
Claude: "Fixed. Eval improved 0.94 → 0.95. The page-citation Contract is still Verified."

Engineer: [Reviews diff, ships]
```

**What this flow eliminated**: the engineer didn't have to remember the design principle. The verified Contract caught the concern up front. The test gate caught regressions before merge.

### Flow C — PM authoring a new feature

```
PM: "I'm planning a wishlist feature. Users add products, view them, remove them. Persists across sessions, max 100 items, cross-device sync."
Claude: [Reads Product Context]
Claude: [Notices 'kids suggest, parents approve' Principle — flags the wishlist needs an approval flow?]
Claude: "Question: does adding to wishlist require parent approval? Your principle says kids suggest, parents approve."
PM: "No — wishlist is just suggestions; nothing is purchased without approval. The wishlist itself is free-flow."
Claude: [Proposes 8 Contracts with Lifecycle=Planned via MCP]
PM: [Opens product-truth site, reviews planned behaviors]
PM: [Edits 2, accepts 6, marks 2 as out-of-scope]
PM: [Commits the new productos/products/wishlist/*.md to the feature branch]
```

The Contracts ship in the PR alongside the code.

### Flow D — Owner reviewing the day's proposals

```
$ productos gaps --type unverified

Unverified Contracts (3):

[1] auth/signup#welcome-email
    Proposed by: claude-code on 2026-05-28 from src/api/auth/signup.ts:80
    "Successful signup enqueues a welcome email"

[2] wishlist/add-item#max-100
    Proposed (Planned) by: claude-code on 2026-05-27
    "Adding the 101st item returns 400 with body.error.code = 'wishlist_full'"
    (no code refs yet)

[3] ...
```

Click any to open in the product-truth site, vet, and accept.

A reasonable rule of thumb: a week of agent activity should produce ≤10 minutes of HITL vetting per Feature area. If it produces more, raise quality of Context (so Claude proposes fewer wrong things), tighten what counts as a Contract, or both.

### Flow E — Lead checking org health on a Friday

```
$ productos summary --since 7d

This week:
  • 14 Contracts proposed (12 accepted, 1 rejected, 1 pending)
  • 3 Contests opened (2 resolved by re-verify, 1 fixed and re-verified)
  • 23 generated tests run; 23 passed
  • Net gap delta: -5 (8 closed, 3 new)

Coverage:
  • 87% of identified UX surfaces have at least 1 Verified Contract
  • Auth, wishlist, settings: fully covered
  • Reports, admin: 0 Contracts (dark)
```

Five-minute Friday read. The team knows what's verified, what shifted, what's dark.

---

## 5. What stays in ProductOS vs. what stays in your code

| In ProductOS spec | In your code |
| --- | --- |
| What the workflow *does* (intent) | How it does it (implementation) |
| Product Context (goals, principles, personas, non-goals, voice) | n/a |
| Product Contracts (behaviors) | Code that implements them |
| Owners, freshness, verification state | n/a |
| Generated tests | The test runner that executes them |

Code can reference the spec (`@productos:contract auth/signup#duplicate-email`), and the spec points at code (file:line refs). Neither is canonical for the other — they coexist.

---

## 6. Integration with the existing stack

ProductOS doesn't try to replace Linear, Notion, GitHub, or your observability stack. It **interoperates** via the AI runtime's existing MCPs:

- **GitHub** — Contracts surface in PR descriptions; generated tests run as PR checks; Contested Contracts block merge
- **Linear / Jira / GitHub Issues** — coverage gaps become tickets via the user's existing ticket-system MCP (post-MVP via `productos-sync` skill)
- **Notion / Confluence** — Product Truth replaces the "what does our product do" wiki entries (the markdown is the wiki)
- **Slack** — drift summaries, weekly digests (post-MVP)
- **Zendesk / Sentry / OpenTelemetry** — feedback flows into Contested Verification or new Planned Contracts via the user's support/observability MCP (post-MVP via `productos-feedback` skill)

The **spec stays canonical** — adapters render *from* it and ingest *into* it. If you remove ProductOS later, you keep the markdown and lose only the runtime state DB.

---

## 7. Minimum viable adoption

The smallest useful adoption — one engineer, one repo, one weekend:

- `productos/context/` filled with 5 short markdown files (goals/principles/personas/non-goals/voice)
- 3–5 Features in `productos/products/<area>/<feature>.md`, each with 3–5 Contracts
- All Contracts Verified
- Implementation packets exported when handing features to a ticket tracker or agent (test cases in the packet serve as acceptance criteria; implementer writes runnable tests against them)
- Claude Code adapter enabled
- A weekly habit of `productos gaps`

That's enough to make every Claude Code session in that repo smarter and trustworthy.

---

## 8. What ProductOS deliberately doesn't do

- **Doesn't replace your IDE or agent runtime.** Claude Code stays Claude Code. ProductOS feeds it Context and Truth.
- **Doesn't write code.** It tells agents what behavior to preserve; agents write code.
- **Doesn't decide priorities.** Product Context (goals) is human-authored; gap prioritization is human.
- **Doesn't impose process.** A single-Feature, Context-light setup is fully valid. Heaviness is opt-in.
- **Doesn't lock you in.** Spec is plain markdown in git. Runtime state DB is replaceable.
- **Doesn't validate its own work.** Agents propose; humans verify by committing the Contract markdown. The product-truth site exists for viewing and for resolving drift events that need human judgment. This separation is non-negotiable — it's what keeps the system from gaslighting itself. (Agents *can* self-heal — carry an existing human Verification forward when a change is cosmetic or mechanical. That's not new judgment; it's maintenance under tight rules.)
- **Doesn't run tests.** ProductOS doesn't own a test runner or parse framework-specific output. It *receives* per-test status events from the user's CI (`{stable_id, status, timestamp}` via MCP / CLI / HTTP) and updates Verification accordingly. The CI keeps doing what it does.
- **Doesn't watch your filesystem.** Drift detection from code is on-demand (`productos-drift` skill or `productos drift scan`). Drift from tests arrives push-style from the user's CI. No daemon, no continuous file watching.

---

## 9. Open UX questions

1. **First-run friction.** How do we get someone from `productos init` to "Claude Code is now noticeably smarter" in under 30 minutes? Probably needs really good `init --starter <industry>` to pre-seed plausible Context.
2. **Context ergonomics.** How does Product Context stay fresh? Probably needs `productos context refresh` that re-reads the README + recent feature work and proposes Context updates.
3. **Vetting fatigue.** This is the single biggest UX risk. If reviewing the proposed-Contracts queue feels like ticket triage, owners stop using it. Mitigations: better Context (fewer wrong proposals); batch ops in the site; weekly digest for low-severity items. Target: ≤10 minutes/week per Feature area.
4. **What counts as "Evidence."** Code refs are obvious. Narrative notes are obvious. Generated test results are obvious. Customer feedback as Evidence (post-MVP) needs structure; bound it.
5. **Auto-validation policies.** Post-MVP. Routine claims could auto-verify under explicit policy. Policies live in `productos/config.yaml`, version-controlled, require an explicit `validated_by: policy:<name>` audit trail.
6. **Product-truth site vs CLI.** Site is the primary UX; CLI is for power users and scripts. Don't over-invest in either alone.
7. **How much of the spec is generated vs hand-written?** Context probably hand-written initially (Claude proposes refinements). Contracts mostly Claude-proposed. Both vetted.
8. **Multi-repo orgs.** Many real orgs span repos. Probably central spec repo (`org-os`) + adapters that read code-repos. v0.3+ concern.
