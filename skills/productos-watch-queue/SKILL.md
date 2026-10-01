---
name: productos-watch-queue
description: Use when the user wants Claude to drain pending work in the ProductOS queue — either once ("work the productos queue", "drain productos", "what's pending in productos") or as a long-running watcher ("watch the productos queue for an hour", "stay on productos queue duty"). The skill spawns a subagent that polls `productos_pending_tasks`, claims tasks, performs the work via ProductOS MCP edit tools, and marks them complete. Tasks come from the web UI (Ask AI button, ✗ Reject with reason, ! Contest) or from other skills. For an Exchange (v2) corpus the queue is the event log instead — `productos_exchange_inbox` with a cursor and a claim, closed with `productos_exchange_close_note`. Triggers: "drain queue", "work productos queue", "process pending tasks", "watch the queue", "is there anything pending", "ask AI on the site needs handling", "anything in the productos inbox", "did anyone press anything".
version: 0.1.0
---

# ProductOS — Watch Queue

<!-- productos:preset -->
## ⛔ The preset — which roles this skill orchestrates

> **Generated from `src/core/jobs.ts` (`SHIMS`). Do not edit between the markers.**
> `productos v2 agents --presets` rewrites every skill, and a test fails if one drifts.

You are the **orchestrator**, and you are the session — not a subagent. That is not an implementation detail: you are the only thing talking to the person, and talking to the person is the one job that may never be delegated.

**Spawn nothing.** Every part of this is something you may not hand off.

**⛔ You keep these yourself, because they may not be delegated:**

- deciding which preset each queued item belongs to, and running it

⛔ **Every author writes and none may settle.** An author may propose, populate, draw and regenerate; it may never produce a verdict, answer an open question, or mark anything walked or validated. None of them can put a question to a person — deliberately, because consent obtained inside a subagent has no record of how it was obtained. What an author cannot resolve comes back to you as a question, and you put it to the person yourself.
<!-- /productos:preset -->

A long-running drainer for the productos work queue. The web UI lets users send tasks (`🤖 Ask AI`, `✗ Reject` with reason, `! Contest`) — those land as files in `productos/queue/*.md`. This skill picks them up and processes them.

## Two modes

| User says | Mode |
|---|---|
| "drain the queue", "process pending", "what's pending in productos" | **One-shot**: process everything pending right now, then stop. |
| "watch the productos queue for an hour", "stay on queue duty for 30 min", "keep an eye on productos for the next 2 hours" | **Watch**: spawn a subagent that loops for the requested duration, claiming new tasks as they arrive. |

If duration is ambiguous ("watch the queue") default to **30 minutes** and confirm: *"Watching for 30 minutes — interrupt me anytime."*

## How to run it

**One-shot** (do it inline, no subagent):

1. Call `productos_pending_tasks({ limit: 20 })`. If empty, say `"Queue's clean — no pending tasks."` and stop.
2. For each pending task, in priority/age order:
   - Print one line: *`▸ q-...  freeform  risk/risk-analysis#trigger-on-property-change`*
   - Call `productos_claim_task({ id })`. If `ok: false` (race), skip.
   - Read the task body. Decide what kind of work it is (see §"Task kinds" below).
   - Do the work using the appropriate ProductOS MCP tools.
   - Call `productos_complete_task({ id, outcome: "done" | "failed" | "abandoned", summary: "..." })`.
3. After the loop: print `"Drained N tasks (done: X, abandoned: Y, failed: Z)."`

**Watch mode** (spawn a subagent for durability + back-off):

Use the `Agent` tool with `subagent_type: "general-purpose"` and a self-contained prompt. The subagent runs the loop below until duration expires or N consecutive empty polls indicate the queue's been clean for a while:

```
You are draining the ProductOS work queue for the next {{duration}} minutes.

Loop:
  1. Call productos_pending_tasks({ limit: 5 }).
  2. If tasks: process each per the productos-watch-queue skill instructions
     (claim, do the work, complete). Then immediately loop again.
  3. If no tasks: sleep 30s via `Bash({ command: "sleep 30" })`, then loop.

Exit conditions:
  - {{duration}} minutes elapsed since you started → exit, report total.
  - 10 consecutive empty polls (5 min idle) → exit, report total.
  - Any productos_complete_task call returns 'failed' for an unrecoverable
    error (MCP unreachable, paths missing) → exit, surface the error.

Report at exit: total tasks processed (done/abandoned/failed) + last activity time.
```

The subagent uses the same ProductOS MCP tools the parent has access to. From the user's perspective, the Agent tool returns when the watch ends.

## The Exchange loop — `productos_exchange_inbox`

⛔ **This is a different queue from the one above and the difference is not cosmetic.** The v1 queue
is files a web UI wrote. The Exchange loop is one **event log** that the served page streams and a
session polls, so the page and whoever is authoring cannot disagree about what happened. If the work
is on a v2 corpus (`v2 check`, `v2 grid`, `productos_exchange_*`), use this section and ignore the
one above.

### Read it

```
productos_exchange_inbox({ since: <last position you handled>, claim: "<your session id>" })
```

⛔ **`claim` is not optional in a working loop.** Reading with a `claim` takes a **lease** on every
note it hands you, so a session on a laptop and one in the cloud do not both author the same request
and overwrite each other. Omit it only to *look* — a status display, answering "is anything
pending".

The answer carries two positions and they are not interchangeable:

| | Carry it when |
| --- | --- |
| `head` | you are alive and polling in a loop — the end of the log, so settled information is not re-read every time |
| `next_cursor` | you **restarted and lost your place** — the low-water mark, so unfinished work comes back to you |

### What each event owes you

| Kind | What you do | Done means |
| --- | --- | --- |
| `press` | usually nothing — a person judged something and the truth already moved | nothing to do |
| `question-answered` | look at what the ruling unblocked, and offer the next thing | nothing to do |
| `note` | ⛔ **the only kind that carries work.** Author the change, regenerate what derives from it, then close it | `productos_exchange_close_note` |
| `note-closed` | somebody else dealt with a request | nothing to do |
| `corpus-changed` | reload before authoring, or you write onto stale truth | nothing to do |

⛔ **A note's position does not advance until it is closed.** That is deliberate: until you say what
you did, the request comes back on every restart. Closing it owes an account —

```
productos_exchange_close_note({ id: "n-...", outcome: "what was actually done" })
```

"We are not doing this, because X" is a perfectly good outcome. **Silence is not** — a closed note
with no account of it cannot be told apart from one somebody dropped because they did not fancy it.

If you claimed a note and are not going to finish it, hand it back with
`productos_exchange_release_note` rather than going quiet. A lease that has to expire on its own
strands the request for as long as the lease lasts, and the person who asked is watching a queue
that looks like somebody is on it.

### Working against an instance rather than a directory

`--at` takes an instance URL as well as a directory, and refs do not change —
`<scope>#<view>#<slot>#<id>` is instance-independent, which is why this is a client concern and not
a model one.

```bash
productos v2 inbox   --at https://x.productos.dev/cre --claim "$SESSION" --token "$PRODUCTOS_TOKEN"
productos v2 whoami  --at https://x.productos.dev/cre        # what it thinks you are, and who is working
```

⛔ **An unreachable instance refuses; it does not fall back to a local corpus.** If you see *"cannot
reach the instance — the truth is there, not here"*, that is the tool working. Do not go looking for
a local copy to work on instead: two people would then be agreeing to two different corpora and both
seeing a tick.

⛔ **The inbox is never mirrored.** Reading it takes leases, so it always goes to the instance. Read
commands (`check`, `grid`, `acts`, `page`, `next`, `packet`) mirror into a scratch directory — that
is a cache of a read, not a working copy. **Never edit it.** An edit there is a change nothing will
carry back.

### ⛔ You cannot record that a person agreed. You can only carry a press they made

This is the guarantee the whole product rests on — tenet 1 is *a human validated this* — and on an
instance it is enforced, not requested:

| You are | You may | You may never |
| --- | --- | --- |
| a session holding a token | author truth; land a default as `via: agent`; **carry** a press somebody made | record `via: page`/`question`/`chat`/`cli` — those claim a person agreed |

⛔ **No token scope grants it.** It is not off by default; `accepted-by-human` is not in the
vocabulary, so no configuration can turn it on. A request that claims it comes back **403** with the
corpus untouched and nothing appended to the log.

**What this costs, said plainly:** if you genuinely know the answer, you still cannot record
agreement — a person has to press, even when it is obvious. That is the intended cost. The
alternative is a corpus whose validation means *something in the pipeline believed this*, which is
worth nothing to the person betting a quarter's roadmap on it.

So when you have authored a change and want it agreed: **close the note saying what you did, and
leave the agreeing to them.** `via: agent` is available and is the honest thing to write when no
person was asked — it is a default a reviewer can disagree with, it satisfies no gate, and every
surface prints it as not-agreement.

**Carrying**, when a person really did press somewhere this instance could not see it:

```
productos_exchange_inbox → …     # the loop
POST /api/v2/carry { act, ref, by: "<the presser>", via: "page", … }
```

The verdict keeps **their** name and **their** `via`, and records you as `relayed_by` — so the
corpus can tell what it observed from what it is taking on somebody's word.

### ⛔ Before you trust a drawn screen, check the code still has it

A corpus describes screens it generated from components. Components get deleted.

```bash
productos v2 check --at <corpus>    # refuses `drawn-from-something-that-is-gone`
productos v2 moved --at <corpus>    # and the commits that took it
```

`moved` **reports**; it does not rewrite. Regenerating is its own command, and `moved` prints the
exact one to run:

```bash
productos v2 draw --all --into <corpus>      # every screen, finding each one's component itself
productos v2 draw "<scope>#<view>" --route <file> --into <corpus>    # one, when the sweep could not
```

⛔ **If the screen is genuinely gone, say so — `exists: withdrawn`.** Drawing it again from some
neighbouring component because one was needed is how a corpus acquires a screen that never existed.

⛔ **And read the commit bodies, not just the subjects** (`--full`). This is where a codebase records
*why* — the operator's words, what was deliberately deleted, what it now refuses to do. A deleted
component's commit is usually a better source for what is true now than anything you can infer from
what replaced it.

### ⛔ Check that anything will actually reach you

`productos_exchange_inbox` answers this every time, in `how_you_will_be_told`. Read it.

A push that is running over a **different corpus** from the one you are working looks, from inside a
session, exactly like a quiet queue — and a session will read "nothing has happened" and stop asking
while requests pile up. If it says nothing will wake you, **poll**; the inbox is the backstop and it
always works. To aim the push at the corpus you are actually on, start the server with
`PRODUCTOS_V2_DIR=<corpus>`.

### ⛔ Never sleep-and-poll from inside a session

Peter: *"Stop the monitor now. We need a better way to monitor than to poll endlessly."*

Forty wakes that report "nothing new" is what that was. **Polling is free; waking a model is not** —
they are two different dials:

| Dial | Costs | Can be |
| --- | --- | --- |
| how often something checks the inbox | requests, not tokens | as granular as you like |
| how often a **session** wakes | context, every time | as rare as the work allows |

So the waiting happens in a **local process, not a model**. Run the terminal reader in the
background and let it be the thing that blocks:

```bash
productos v2 inbox --claim "$SESSION" --json      # one read, for a relay
productos v2 watch                                 # blocks on the filesystem, prints on change
```

A `Bash` loop that sleeps and re-reads costs nothing while nothing is happening. A **session** that
sleeps and re-reads costs a wake per tick and reports nothing almost every time. If you find
yourself writing `sleep 30` inside a subagent prompt for a v2 corpus, that is the mistake.

## Task kinds — what to do with each

### `freeform`
A user typed an instruction into the "Ask AI" textarea. The body IS the instruction. Read it, do what it says using the ProductOS MCP edit tools (`productos_update_behavior`, `productos_add_behavior`, `productos_update_feature`, etc.). Complete with `outcome: "done"` + a summary like `"Updated claim to include the negative-amount edge case + added test case."`.

If the request is impossible or out of scope (e.g. "fix the production bug" — that's a code task, not a productos-edit task), complete with `outcome: "abandoned"` and a summary explaining why so the user sees the reasoning when they check the queue.

### `address-feedback`
Auto-generated from a `✗ Reject` (with reason) or `! Contest` action. The body gives you the context — the user's reason, the target feature/behavior, and a pointer to the source feedback file if applicable.

Workflow:
1. `productos_get_feature({ id: <target.feature> })` for context.
2. If the task references a `feedback_id`, read it with `productos_get_feedback` (or via the file path in body).
3. Decide between:
   - **Edit the claim**: the user's complaint reveals the claim is wrong. `productos_update_behavior(..., { claim: "..." })`. If the behavior was just deprecated (from `/api/reject`), call `productos_update_behavior(..., { deprecated: false })` to revive it after fixing.
   - **Add a missing rule**: the complaint reveals an unstated behavior. `productos_add_behavior(...)` with appropriate anchor + test cases.
   - **Confirm the rejection holds**: the deprecation was right. `productos_mark_feedback_processed(...)` with a note explaining.
4. Complete the task with a summary describing which path you took.

## Rules

- **Always complete claimed tasks.** A claim without a completion leaves a `.claimed.md` file orphaned. If you can't finish, complete with `outcome: "failed"` or `outcome: "abandoned"` and explain why in the summary.
- **Never set `verified: true` on behaviors you edit.** Per `productos-review` rule — verified is a human-only stamp. You can update claims, add tests, deprecate, etc. — but not stamp validation.
- **Don't loop forever in one-shot mode.** Process the snapshot you got from `productos_pending_tasks` once, then exit. New tasks that land during your processing wait for the next invocation (or for watch mode).
- **One claim at a time per worker.** Don't claim N tasks then process them — claim → process → complete → claim next. Reduces the orphan-claim risk if the worker crashes.
- **Print progress.** Each `▸ q-... → done: <summary>` line so the user can follow along. In watch mode the subagent's report at exit is the summary.

## Don't

- Don't process tasks the user didn't ask you to — only when invoked.
- Don't enqueue new tasks unless explicitly told to (use `productos_enqueue_task` only when a task you're processing legitimately spawns more work).
- Don't process tasks created by other agents you don't recognize without reading the body — there's no auth on the queue, anyone with disk access could enqueue.

## Defer

- **Inspecting a specific task without claiming** → `productos v2 inbox` for an Exchange corpus. (The v1 queue is `productos queue show <id>`.)
- **Releasing a stale claim** (your previous watch crashed mid-task) → `productos v2 notes` — a claim lapses on its own. (The v1 queue releases with `productos queue release <id>`.)
- **One-off edits with no queue task** → just use `productos-edit` or `productos-review` directly.
