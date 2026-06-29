---
name: productos-watch-queue
description: Use when the user wants Claude to drain pending work in the ProductOS queue — either once ("work the productos queue", "drain productos", "what's pending in productos") or as a long-running watcher ("watch the productos queue for an hour", "stay on productos queue duty"). The skill spawns a subagent that polls `productos_pending_tasks`, claims tasks, performs the work via ProductOS MCP edit tools, and marks them complete. Tasks come from the web UI (Ask AI button, ✗ Reject with reason, ! Contest) or from other skills. Triggers: "drain queue", "work productos queue", "process pending tasks", "watch the queue", "is there anything pending", "ask AI on the site needs handling".
version: 0.1.0
---

# ProductOS — Watch Queue

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

- **Inspecting a specific task without claiming** → `productos queue show <id>` (CLI) or read `productos/queue/<id>.md` directly.
- **Releasing a stale claim** (your previous watch crashed mid-task) → `productos queue release <id>` (CLI).
- **One-off edits with no queue task** → just use `productos-edit` or `productos-review` directly.
