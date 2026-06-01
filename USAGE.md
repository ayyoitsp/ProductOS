# ProductOS — Usage

> **Canonical conceptual reference:** [`OVERVIEW.md`](OVERVIEW.md). This doc captures how people actually use the system — personas, daily flows, what's load-bearing.

---

## 1. Who uses ProductOS

| Persona | Cadence | Primary surface |
| --- | --- | --- |
| **Founder / early team lead** | Heavy at adoption, then weekly | CLI + Context/Contract files in editor |
| **Day-to-day engineer (human + agent)** | Continuous | Claude Code / Cursor / Codex (transparent — agent pulls verified Truth) |
| **Product / business lead** | Weekly | Product-truth site (read mode); Context files |
| **Eng lead / on-call** | Weekly | `productos gaps`, product-truth site Drift view |

The day-to-day engineer is the **silent majority of usage**. They mostly never type `productos` directly — the value reaches them through their runtime pulling verified Contracts. If we get that one flow right, ProductOS works.

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

### Minute 1 — Install + init

```
$ npm i -g productos
$ cd my-app
$ productos init claude
✓ Skill installed, MCP registered, productos/ scaffolded
```

### Hour 1 — Fill in Product Context

Open `productos/context/` and write:

- `goals.md` — what does this product change about its users' lives?
- `principles.md` — design principles that constrain every feature decision
- `personas.md` — who are we building for?
- `non-goals.md` — what we explicitly don't do
- `voice.md` — brand voice / tone

This is the **first thing Claude reads** before proposing anything. A weak Context means weak Contracts. A 30-minute investment here pays off across every analyzer session.

You can also ask Claude to **propose Context** from the codebase + your README — then vet what it produces.

### Hour 1.5 — First analyzer pass

```
$ productos serve     # (in another terminal)
```

Then in Claude Code:

> do a ProductOS pass on this codebase

Claude reads your Context first, then walks the code, proposing 20-40 Contracts as Unverified state in `productos/products/<area>/<feature>.md`.

### Hour 2 — Vet the proposals

Open the product-truth site at http://localhost:7878. Browse Features by Area. For each:

- Read the proposed claims
- Edit wording where it's off (writes back to markdown, will commit)
- Accept as Verified (state flip in DB, no commit)
- Reject ones that are wrong (state → rejected)
- Note Drift if Claude misread the code

A medium codebase: 30-45 minutes.

### End of session — Commit

```
$ git add productos/
$ git commit -m "Initial ProductOS pass: 32 Contracts verified"
```

Note: the commit captures Context + Contract markdown (content). Verification state lives in the DB and was already updated through the session.

### Day 1+ — Use Contracts as the spec for everything downstream

The Contract's claim + numbered test cases are the spec. The team:

- Reads test cases in the product-truth site to know what acceptance looks like
- Writes runnable tests against those cases in their normal test framework when implementing features
- Encodes each test case's stable id (e.g. `auth/signup#duplicate-email/1`) in the test name so CI results map back to the Contract
- Posts test results back to ProductOS from CI via `productos test record` (or MCP / HTTP) so Verification stays live
- Exports the implementation packet (`productos packet export <feature_id>`) when handing work off to a ticket tracker or an agent

In v0.1 ProductOS does not generate runnable test files — the implementer writes them. Skill-driven test generation lands in future.

### Week 1 — The flywheel starts

Claude finishes a change to the auth flow. Via the analyzer skill it:

1. Re-reads Product Context
2. Reads its Contract changes against the modified code
3. Proposes new Contracts (Unverified) and proposes Contests on Contracts the change might have broken

You open the site, accept the new ones, address the contested ones. 5 minutes.

The corpus grows; agents working in that area now see the new verified Truth in context, and don't break it.

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
