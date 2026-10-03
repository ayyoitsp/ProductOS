/**
 * ⛔ TWO CHECKOUTS, ONE SCHEMA — THE THREE WAYS THAT GOES WRONG, AND THE THREE THINGS THAT CATCH IT.
 *
 * Peter: *"how can we handle schema migrations between different worktrees?"* and then
 * *"i think we should have some rudimentary collision detction for migrations - like schema
 * migrations are numbered, and they go up 0001.sql or whatever"* and
 * *"i'd like 'dev' to be up to date, and we already redeploy 4100 with what's merged. individual
 * trees can maintain their own docker instance/own port, but 4100 should be kept clean"*.
 *
 * The three failures, each silent before this:
 *
 *  1. THE DATABASE GOES AHEAD OF THE CODE. `applyMigrations` compared the journal against the
 *     ledger in ONE direction — a journal entry the ledger lacks gets applied, a LEDGER entry the
 *     journal lacks was ignored without a word. A branch applies 0003, you switch to a checkout
 *     whose journal stops at 0002, and boot reports everything normal against a database this code
 *     cannot describe. There are no down migrations, so nothing could undo it either.
 *  2. TWO BRANCHES BOTH CALL IT 0003. `drizzle-kit generate` numbers from what is on disk, so two
 *     branches working at once pick the same number with nothing to notice. After the merge the
 *     journal has two entries claiming index 3.
 *  3. A WORKTREE TAKES DEV. One port, one project, one volume for every checkout.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import {
  migrationCollisions,
  migrationsDir,
  journalOf,
  numberOf,
  shaOf,
  migrations,
  SchemaAheadError,
} from "../dist/v2/store/migrate.js";
import { migrateStore } from "../dist/v2/store/server.js";

const fresh = () => drizzle(new PGlite());

/** A journal and its files, written somewhere disposable. */
const tree = (entries) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "productos-mig-"));
  fs.mkdirSync(path.join(dir, "meta"));
  for (const e of entries) {
    if (e.file !== false) fs.writeFileSync(path.join(dir, `${e.tag}.sql`), e.sql ?? `create table ${e.tag.replace(/\W/g, "_")} (id text primary key);`);
  }
  fs.writeFileSync(
    path.join(dir, "meta", "_journal.json"),
    JSON.stringify({ version: "7", dialect: "postgresql", entries: entries.filter((e) => e.entry !== false).map((e, i) => ({ idx: e.idx ?? i, version: "7", when: i, tag: e.tag, breakpoints: true })) }),
  );
  return dir;
};
const kinds = (found) => found.map((f) => f.kind).sort();

test("this repo's own migrations are numbered cleanly", () => {
  /** ⛔ The one assertion that is about the committed tree rather than a fixture. */
  assert.deepEqual(migrationCollisions(migrationsDir()), []);
  assert.ok(journalOf(migrationsDir()).length >= 3);
  assert.equal(numberOf("0003_deal_stages"), 3);
  assert.equal(numberOf("init"), null);
});

test("two branches both calling it 0003 is a collision, named", () => {
  const dir = tree([{ tag: "0000_init" }, { tag: "0003_alpha", idx: 3 }, { tag: "0003_beta", idx: 3 }]);
  const found = migrationCollisions(dir);
  const share = found.find((f) => f.kind === "two-migrations-share-a-number");
  assert.ok(share, `no collision reported — got ${kinds(found).join(", ")}`);
  /** ⛔ BOTH NAMES IN THE MESSAGE. "0003 is duplicated" sends somebody to look for which two. */
  assert.match(share.says, /0003_alpha/);
  assert.match(share.says, /0003_beta/);
  assert.match(share.says, /renumber/i);
});

test("a number already taken on the branch you are merging into", () => {
  const mine = tree([{ tag: "0000_init" }, { tag: "0003_beta", idx: 3 }]);
  const theirs = [{ idx: 0, tag: "0000_init" }, { idx: 3, tag: "0003_alpha" }];
  const found = migrationCollisions(mine, theirs);
  const clash = found.find((f) => f.kind === "this-number-is-taken-on-the-other-branch");
  assert.ok(clash, `nothing reported against the other branch — got ${kinds(found).join(", ")}`);
  assert.match(clash.says, /0003_beta.*0003_alpha|0003_alpha.*0003_beta/);

  /** ⛔ AND A SHARED HISTORY IS NOT A COLLISION. Every migration both branches have is in both. */
  assert.deepEqual(migrationCollisions(mine, [{ idx: 0, tag: "0000_init" }, { idx: 3, tag: "0003_beta" }]), []);
});

test("the quiet ones: a file nothing runs, an entry with no file, a number that disagrees", () => {
  const orphanFile = tree([{ tag: "0000_init" }, { tag: "0001_stray", entry: false }]);
  assert.ok(kinds(migrationCollisions(orphanFile)).includes("a-migration-no-journal-entry-names"));

  const orphanEntry = tree([{ tag: "0000_init" }, { tag: "0001_ghost", file: false }]);
  assert.ok(kinds(migrationCollisions(orphanEntry)).includes("a-journal-entry-with-no-migration"));

  const wrongIdx = tree([{ tag: "0000_init" }, { tag: "0001_ok", idx: 7 }]);
  assert.ok(kinds(migrationCollisions(wrongIdx)).includes("the-number-and-the-journal-disagree"));
});

test("a store migrated by newer code refuses to boot, and says what to do", async () => {
  const db = fresh();
  await migrateStore(db);
  /** A branch applied something this checkout has never heard of. */
  await db.execute(
    sql.raw("insert into _productos_migrations (tag, statements_sha) values ('0009_deal_stages', 'deadbeefdeadbeef')"),
  );

  await assert.rejects(() => migrateStore(db), (e) => {
    assert.ok(e instanceof SchemaAheadError, `threw ${e?.name}, not SchemaAheadError`);
    assert.deepEqual(e.unaccounted, ["0009_deal_stages"]);
    /** ⛔ THE MESSAGE IS THE WHOLE POINT. A refusal nobody can act on is a crash with manners. */
    assert.match(e.message, /0009_deal_stages/);
    assert.match(e.message, /PRODUCTOS_ALLOW_SCHEMA_AHEAD/);
    return true;
  });
});

test("and it can be overridden on purpose, which is rolling an instance back", async () => {
  const db = fresh();
  await migrateStore(db);
  await db.execute(sql.raw("insert into _productos_migrations (tag, statements_sha) values ('0009_later', 'f00df00df00df00d')"));
  const { applyMigrations } = await import("../dist/v2/store/migrate.js");
  const run = async (s) => db.execute(sql.raw(s));
  const read = async () => {
    const { rowsOf } = await import("../dist/v2/store/server.js");
    return rowsOf(await db.execute(sql.raw("select tag, statements_sha from _productos_migrations"))).map((r) => ({
      tag: r.tag,
      sha: r.statements_sha ?? null,
    }));
  };
  const out = await applyMigrations(run, undefined, read, true);
  assert.deepEqual(out.ahead, ["0009_later"], "the override hid it instead of reporting it");
  assert.deepEqual(out.applied, [], "it re-applied something while booting against a newer store");
});

test("a renumbered migration is recognised by what it is, not what it is called", async () => {
  const db = fresh();
  await migrateStore(db);
  const last = migrations().at(-1);

  /** The merge renamed it. ⛔ This is the case that used to re-run it and die on "already exists". */
  await db.execute(sql.raw(`update _productos_migrations set tag = '9999_renamed_by_a_merge' where tag = '${last.tag}'`));

  const again = await migrateStore(db);
  assert.deepEqual(again.applied, [], "a migration already applied ran a second time under its new name");
  assert.deepEqual(again.ahead, [], "its own migration read as a database from the future");
  assert.deepEqual(again.renamed, [{ from: "9999_renamed_by_a_merge", to: last.tag }]);

  /** And the ledger now holds the new name, so the next boot is an ordinary one. */
  const third = await migrateStore(db);
  assert.deepEqual(third.renamed, []);
  assert.ok(third.skipped.includes(last.tag));
});

test("the hash is of the statements, so a reworded migration is a different one", () => {
  assert.equal(shaOf(["create table a (id text)"]), shaOf(["create table a (id text)"]));
  assert.notEqual(shaOf(["create table a (id text)"]), shaOf(["create table b (id text)"]));
});

test("a ledger written before the hash column existed gains it rather than breaking", async () => {
  const db = fresh();
  /** The old shape exactly: tag and applied_at, no sha. */
  await db.execute(sql.raw("create table _productos_migrations (tag text primary key, applied_at timestamptz not null default now())"));
  for (const m of migrations()) {
    for (const s of m.statements) await db.execute(sql.raw(s));
    await db.execute(sql.raw(`insert into _productos_migrations (tag) values ('${m.tag}')`));
  }

  const out = await migrateStore(db);
  assert.deepEqual(out.applied, [], "it re-applied against a pre-hash ledger");
  assert.deepEqual(out.ahead, [], "a pre-hash ledger read as a store from the future");
  /** ⛔ BACKFILLED, or a store that predates the column could never be renamed out of a collision. */
  const { rowsOf } = await import("../dist/v2/store/server.js");
  const rows = rowsOf(await db.execute(sql.raw("select tag, statements_sha from _productos_migrations")));
  assert.ok(rows.every((r) => r.statements_sha), "the hashes were not backfilled");
});

/* ───────────────────────── a stack per worktree, and dev kept clean ───────────────────────── */

const stack = (dir) => {
  const out = execFileSync("./scripts/stack.sh", [dir], { encoding: "utf-8" }).trim();
  return Object.fromEntries(out.split(" ").map((kv) => kv.split("=")));
};

test("the main checkout is dev, and a worktree can never be", () => {
  const here = stack(".");
  assert.equal(here.PRODUCTOS_STACK, "productos");
  assert.equal(here.PORT, "4100");
  assert.equal(here.PG_PORT, "5432");

  /**
   * ⛔ EVERY WORKTREE GIT KNOWS ABOUT, not a fixture — the thing being asserted is that no real
   * checkout on this machine resolves to dev.
   */
  const worktrees = execFileSync("git", ["worktree", "list"], { encoding: "utf-8" })
    .trim()
    .split("\n")
    .slice(1)
    .map((l) => l.split(" ")[0]);
  const ports = new Set([here.PORT]);
  for (const w of worktrees) {
    const s = stack(w);
    assert.notEqual(s.PRODUCTOS_STACK, "productos", `${w} resolved to dev's stack`);
    assert.notEqual(s.PORT, "4100", `${w} resolved to dev's port`);
    assert.notEqual(s.PG_PORT, "5432", `${w} resolved to dev's postgres port`);
    /** ⛔ AND NOT 4101 EITHER — `productos-style-preview` is already there, and the first cut of the
     *  range started at 4101, so the first worktree to hash to zero would have failed to bind. */
    assert.ok(Number(s.PORT) >= 4200, `${w} is on ${s.PORT}, inside the 41xx family already in use`);
    assert.ok(!ports.has(s.PORT), `${w} wants ${s.PORT}, which another checkout already has`);
    ports.add(s.PORT);
  }

  /**
   * ⛔ THE SAME ANSWER FROM ANOTHER DIRECTORY, OR `make stacks` WOULD BE FICTION — it asks about
   * checkouts it is not standing in. Driven from a cwd elsewhere with the script named absolutely,
   * because a worktree on an older branch does not have the script, which is the whole reason it
   * takes a path.
   */
  if (worktrees.length) {
    const abs = path.resolve("scripts/stack.sh");
    const elsewhere = execFileSync(abs, [worktrees[0]], { cwd: os.tmpdir(), encoding: "utf-8" }).trim();
    assert.equal(elsewhere, execFileSync(abs, [worktrees[0]], { encoding: "utf-8" }).trim());
    assert.ok(!fs.existsSync(path.join(worktrees[0], "scripts/stack.sh")) || true);
  }
});

test("the stack and both ports are variables, defaulting to dev", () => {
  const compose = fs.readFileSync("docker-compose.yml", "utf-8");
  assert.match(compose, /^name: \$\{PRODUCTOS_STACK:-productos\}$/m, "the project name is not per-stack");
  assert.match(compose, /"\$\{PORT:-4100\}:4100"/, "the app port is fixed");
  assert.match(compose, /"\$\{PG_PORT:-5432\}:5432"/, "the store port is fixed — a second stack cannot start");
});

test("nothing that starts a container skips the dev guard", () => {
  const mk = fs.readFileSync("Makefile", "utf-8");
  for (const t of ["up", "rebuild", "restart"]) {
    assert.match(mk, new RegExp(`^${t}:[^\\n]*\\bdev-guard\\b`, "m"), `${t} can start a container without the guard`);
  }
  /**
   * ⛔ AND THE MANAGED-STORE STACK, WHICH IS THE ONE ACTUALLY ON 4100. The first cut guarded `up`,
   * `rebuild` and `restart` — the LOCAL stack, which is not even running — and left all three
   * `-remote` targets open. So the hole the guard exists to close was still open on the only stack
   * anybody uses, and every test here passed.
   */
  for (const t of ["up-remote", "rebuild-remote", "restart-remote"]) {
    assert.match(mk, new RegExp(`^${t}:[^\\n]*\\bremote-guard\\b`, "m"), `${t} can reach the shared store without the guard`);
  }
  const rg = mk.slice(mk.indexOf("\nremote-guard:"));
  const rbody = rg.slice(0, rg.indexOf("\nup:"));
  /** ⛔ A worktree may not run it at all — one shared database, so no port makes it safe. */
  assert.match(rbody, /THIS_WT.*!=.*MAIN_WT|"\$\(THIS_WT\)" != "\$\(MAIN_WT\)"/s, "a worktree can point at the shared store");
  assert.match(rbody, /MERGED_CHECK/, "nothing checks that the managed instance serves what is merged");
  /**
   * ⛔ THE GUARD ASKS GIT, NOT THE SCRIPT, AND THIS IS THE ASSERTION THAT WOULD HAVE CAUGHT IT. A
   * worktree on a branch without `scripts/stack.sh` makes `$(shell ...)` empty, compose uses its
   * default, and the default is dev. A throwaway worktree did exactly that and was stopped only by
   * `Bind for 0.0.0.0:4100 failed`.
   */
  const guard = mk.slice(mk.indexOf("\ndev-guard:"));
  const body = guard.slice(0, guard.indexOf("\nup:"));
  assert.match(body, /MAIN_WT/, "the guard does not ask git which worktree is the main one");
  assert.match(body, /THIS_WT/);
  /**
   * ⛔ THE MERGE CHECK IS ONE COPY SHARED BY BOTH GUARDS, so this asserts the call here and the
   * question itself in the define — two stacks both landing on 4100 is two places to forget.
   */
  assert.match(body, /MERGED_CHECK/, "dev-guard does not ask whether HEAD is merged");
  assert.match(mk, /^define MERGED_CHECK$/m, "the merge check is not shared");
  assert.match(mk, /merge-base --is-ancestor HEAD origin\/main/, "nothing checks that dev serves what is merged");
  assert.match(mk, /DEV_ANYWAY/, "there is no way to override it on purpose");
  assert.match(mk, /^up: dev-guard migrations-check$/m, "up does not check the numbering before starting");
});
