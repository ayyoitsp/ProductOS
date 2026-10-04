---
name: productos-migrations
description: How to add, review and resolve conflicts in ProductOS schema migrations, which Docker stack a checkout may bring up, and which checkout a session's CLI and MCP server actually run. Triggers on "add a migration", "change the store schema", "migration conflict", "two migrations numbered the same", "this store was migrated by newer code", "relation already exists on boot", "renumber a migration", "which productos am I running", "my MCP server is watching the wrong corpus", "a skill disappeared", and any work touching src/v2/store/schema.ts, drizzle/ or src/adapters/claude.ts.
version: 0.1.0
---

# Schema migrations

The store's shape lives in `src/v2/store/schema.ts`. Changes to it become numbered SQL files under
`drizzle/`, checked in, and applied by the instance when it boots.

⛔ **This is the one part of ProductOS where being wrong costs data rather than a re-run.** Everything
else here is regenerable; a migration applied to a store with somebody's corpus in it is not.

## ⛔ Three facts everything below follows from

1. **Forward only. There are no down migrations.** Nothing in `drizzle/` can take a migration back
   off. The ways back are: a new migration that undoes it, or restoring a backup.
2. **The ledger keys on the tag *and* a hash of the statements.** `_productos_migrations` holds one
   row per applied migration with a `statements_sha`. This is what makes renumbering safe, and what
   makes editing an applied migration a silent no-op.
3. **Order comes from `drizzle/meta/_journal.json`, never from sorting filenames.** The journal is
   what drizzle-kit maintains; filename order happens to agree today and stops agreeing the first
   time one is renamed.

## Adding one

```bash
# 1. change the target shape
$EDITOR src/v2/store/schema.ts

# 2. generate the SQL from it
npx drizzle-kit generate

# 3. before you commit
make migrations-check      # numbering, here and against origin/main
npm test                   # includes the committed tree's own numbering
```

⛔ **`generate`, never `push`.** `drizzle-kit push` diffs against a live database and invents
statements nobody reviewed, so the thing the tests ran is not the thing that ships. It also fails
outright on this schema — natural text primary keys mean it tries to drop a constraint it cannot.

⛔ **Read the generated SQL before committing it.** A rename in `schema.ts` can generate as a drop
plus an add, which is a column of data gone. If it did, write the migration by hand instead — a
generated file is a draft until somebody has read it.

## ⛔ Never edit or delete a migration that has been applied anywhere

Not to fix a typo, not to add a column you forgot. It is silently ignored, and this was driven
rather than reasoned about:

```
first boot:       applied 0000_init
after editing it: applied nothing, skipped 0000_init
columns present:  id      ← the new column was never added, and nothing said so
```

The ledger already has that tag, so the edit never runs on any store that has it — and it *does*
run on a store created after the edit. One journal, two different schemas, no message either way.

**Instead: add a new migration.** Always. Even for a typo in the last one, even five minutes later,
if it has booted anywhere — including a worktree's own stack.

## Resolving a numbering collision

Two branches both ran `drizzle-kit generate` and both got `0003_*`. What you will see:

- **git conflicts on `_journal.json`** — both branches appended to the same region. Keep **both**
  entries.
- **git does not conflict on the two `.sql` files.** Different names, both add cleanly. This is why
  the collision survives a merge that looked clean.
- `make migrations-check` then names the pair.

Resolve it:

```bash
# ⛔ RENUMBER YOURS — the one that is NOT on main. main's number stands.
git mv drizzle/0003_beta.sql drizzle/0004_beta.sql
# then, in drizzle/meta/_journal.json, that entry's "tag" → "0004_beta" and "idx" → 4
make migrations-check
```

⛔ **Why renumbering is safe, and only because of the hash.** A store that already applied
`0003_beta` recognises `0004_beta` by its statements and records the new name instead of running it
again. Boot says so:

```
[productos] 0003_beta was already applied — recorded now as 0004_beta
```

Before the hash existed, a renamed tag was a tag the ledger had never seen, so its statements ran a
second time and every boot died on `relation already exists`.

⛔ **Never renumber a migration that is already on main.** Other people's stores and the dev instance
have it under that number. Renumber the unmerged side, always.

## ⛔ The conflict nothing detects — you have to read both

Two migrations touching the same thing under *different* numbers. `make migrations-check` reports
nothing, because nothing here reads SQL:

```
0003_stages.sql    alter table deals add column stage text;
0004_pipeline.sql  alter table deals add column stage text;
→ (nothing reported)
```

Both apply on the merged store and the second dies on `column "stage" of relation "deals" already
exists` — at boot, on the shared store, after every check passed.

**So before merging a branch that adds a migration: read every migration the other side added since
you branched.**

```bash
git diff --stat origin/main...HEAD -- drizzle/
git log origin/main --oneline -- drizzle/      # what landed while you were away
```

If both sides touch the same table or column, **fold them into one migration** rather than letting
both run. If they genuinely must stay separate, make the later one conditional (`add column if not
exists`, `create index if not exists`) and say in the SQL why.

## "this store was migrated by newer code"

```
✗ this store was migrated by newer code: the ledger holds "0003_deal_stages",
  which this checkout's drizzle/meta/_journal.json does not contain.
```

The database is ahead of the code. A branch applied a migration, and this checkout has never heard
of it. ⛔ **Do not reach for the override first** — the store's shape is one this code cannot
describe, and there is no down migration to take it off. In order of preference:

1. **Switch to a branch that has it.** Usually right, and usually the branch you just came from.
2. **Point at a store this checkout owns.** From a worktree that is `make up`, which brings up its
   own Postgres. See below.
3. **Restore a backup taken before it was applied** — `make restore FILE=…` locally,
   `make restore-remote FILE=…` for the managed store.
4. `PRODUCTOS_ALLOW_SCHEMA_AHEAD=1` boots anyway, and is the right answer for exactly one case:
   deliberately rolling an instance back to an older build. It reports what it ignored.

## Which stack a checkout may bring up

```bash
make stacks     # every checkout, its project, its two ports, whether it is up
```

- **`productos` on 4100 is dev, and dev serves what is merged.** `make up` refuses a HEAD that is
  not in `origin/main` (`DEV_ANYWAY=1` overrides, deliberately).
- **A worktree gets its own project, its own Postgres and its own two ports**, derived from its
  name. `make up` from a worktree is always safe — its migrations cannot reach anybody else.
- ⛔ **Never `make up-remote`, `rebuild-remote` or `restart-remote` from a worktree.** The managed
  store is one shared database; a branch's migrations there land in the instance everyone reviews
  on. It refuses, and the local stack is the answer.

## Which ProductOS a session is actually running

```bash
productos init claude --update   # ⛔ registers THIS checkout, under a name derived from it
claude mcp list                  # productos (the main checkout) · productos-<worktree> (yours)
```

- **`npm link` is one global slot.** `productos` on PATH is whichever checkout linked last, so never
  conclude anything from `productos --version` or from a bare `productos` in a config file about
  which code ran. `make doctor` prints what the slot currently points at.
- **The MCP server is registered per checkout**, as an absolute path to the checkout `init` was run
  from, under `productos` for the main checkout and `productos-<worktree>` for a worktree. Two
  checkouts coexist in `~/.claude.json` instead of overwriting each other, and the same slug
  `make stacks` uses — so an MCP name and a Docker project name always point at the same tree.
- **`init claude --update` from a worktree installs its skills and removes none.** `~/.claude/skills/`
  is shared by every session on this machine, and a skill absent from a worktree's `skills/` is
  absent from that BRANCH, not from the product. Only the main checkout prunes. ⛔ So after deleting
  or renaming a skill, the removal reaches other sessions when it reaches main — not before.
- ⛔ **`.mcp.json` is not committed here.** It names one machine's checkout absolutely. Run
  `productos init claude --update` and you have it; if you see it in `git status`, something
  un-ignored it.

## ⛔ Before anything that could lose a corpus

```bash
make backup-remote      # the managed store → backups/
make backup             # this stack's local Postgres
```

Take one before: a migration that drops or renames anything, a restore, `make nuke`, and any first
run of a migration against the managed store.

## ⛔ Never

- Edit or delete a migration that has booted anywhere. Add a new one.
- `drizzle-kit push`.
- Hand-write a row into `_productos_migrations`, or hand-delete one. It is the only record of what a
  store has had done to it; a row that does not match reality is worse than no ledger.
- Renumber a migration that is on main.
- Commit a generated migration you have not read.
- Reach for `PRODUCTOS_ALLOW_SCHEMA_AHEAD` to make an error go away.
