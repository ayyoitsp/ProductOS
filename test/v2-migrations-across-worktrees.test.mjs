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
import { temp } from "./support/temp.mjs";
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
  const dir = temp("productos-mig-");
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

/**
 * ⛔ TEXT ASSERTIONS MUST NOT READ COMMENTS, AND BOTH OF THESE EXIST BECAUSE THEY DID.
 *
 * `doesNotMatch(compose, /\$\{PRODUCTOS_STACK:-/)` fired against a comment in `docker-compose.yml`
 * that QUOTES the old defaulted form while explaining why it is gone — so the assertion failed on
 * the documentation of the fix. And slicing a Makefile target "up to the next target" swallowed the
 * following target's recipe, so an assertion about `dev-guard` was reading `staging-guard`.
 *
 * So: `effective` drops comment lines, and `recipe` returns only the tab-indented lines of one
 * target. A comment can then say anything it needs to without breaking a test.
 */
const effective = (text) =>
  text.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");

const recipe = (mk, name) => {
  const i = mk.indexOf(`\n${name}:`);
  assert.ok(i >= 0, `there is no ${name} target`);
  const lines = mk.slice(i + 1).split("\n").slice(1);
  const out = [];
  for (const l of lines) {
    /**
     * ⛔ MAKE'S OWN COMMENTS ARE TAB-INDENTED TOO, SO THEY WERE IN THE RECIPE. An assertion looking
     * for `git status --porcelain` passed on a COMMENT mentioning it — the same defect as a test
     * matching the prose that explains a fix rather than the fix. Dropped here, once.
     */
    if (l.startsWith("\t") && !/^\t@?#/.test(l)) out.push(l);
    else if (l.startsWith("\t")) continue;
    else if (out.length) break;
    else if (l.trim() === "" || l.startsWith("#")) continue;
    else break;
  }
  assert.ok(out.length, `${name} has no recipe — it is a name that always succeeds`);
  return out.join("\n");
};

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

/**
 * ⛔ 4100 IS STAGING, AND NO CHECKOUT MAY DERIVE IT — INCLUDING THE MAIN ONE.
 *
 * This asserted the opposite: that the main checkout resolves to `productos` on 4100 and only a
 * worktree gets its own stack. That was right while 4100 meant "dev serves what is merged". Peter:
 * *"Treat 4100 as staging for now"* — which changes the layout rather than the vocabulary, because
 * staging belongs to a deployed instance and not to anybody's checkout.
 *
 * So every checkout, main included, now gets `productos-dev-<slug>` on a derived port, and there is
 * no branch of `scripts/stack.sh` that can answer 4100. Found while wiring `make up`: from the main
 * checkout it wanted 4100, which the staging container was holding.
 */
/**
 * ⛔ `main` IS RESERVED, AND A WORKTREE DIRECTORY MAY BE CALLED THAT — WHICH TOOK THE SUITE RED.
 *
 * The main checkout is named `main` whatever its path; every other checkout is named after its
 * directory. So a worktree at `…/scratchpad/main` resolved to `productos-dev-main` on 4286 — the
 * same compose project and the same two ports as the main checkout. Two trees under one project
 * share one volume and one database, which is the single thing a stack per worktree exists to
 * prevent, arriving back through the NAME rather than through the port arithmetic.
 *
 * The test below catches it on this machine only while such a worktree happens to exist. This one
 * catches it always, by asking the script directly.
 */
test("a worktree named main does not take the main checkout's stack", () => {
  const main = execFileSync("./scripts/stack.sh", [".", "staging-stack"], { encoding: "utf-8" });
  assert.ok(main.trim().length > 0, "the script did not answer at all");

  const mine = stack(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" }).trim());

  /** A real worktree whose directory is literally `main`, which is the colliding shape. */
  const parent = temp("productos-wt-");
  const at = path.join(parent, "main");
  execFileSync("git", ["worktree", "add", "--detach", at, "HEAD"], { stdio: "ignore" });
  try {
    const named = stack(at);
    const theMainCheckout = stack(
      execFileSync("git", ["worktree", "list"], { encoding: "utf-8" }).trim().split("\n")[0].split(" ")[0],
    );
    assert.equal(theMainCheckout.PRODUCTOS_STACK, "productos-dev-main", "the reserved name moved");
    assert.notEqual(
      named.PRODUCTOS_STACK,
      theMainCheckout.PRODUCTOS_STACK,
      "a worktree called main took the main checkout's compose project — one volume, two trees",
    );
    assert.notEqual(named.PORT, theMainCheckout.PORT, "and its port");
    assert.notEqual(named.PG_PORT, theMainCheckout.PG_PORT, "and its postgres port");
    assert.notEqual(named.PORT, mine.PORT, "it also collided with this checkout");

    /** ⛔ Stable: the same answer asked twice, and asked from inside the worktree. */
    assert.equal(stack(at).PRODUCTOS_STACK, named.PRODUCTOS_STACK, "the name is not stable");
    assert.match(named.PRODUCTOS_STACK, /^productos-dev-main-[0-9a-f]{4}$/, "not disambiguated by a path hash");
  } finally {
    execFileSync("git", ["worktree", "remove", "--force", at], { stdio: "ignore" });
  }
});

test("no checkout resolves to staging's stack or either of its ports", () => {
  const staging = {
    stack: execFileSync("./scripts/stack.sh", [".", "staging-stack"], { encoding: "utf-8" }).trim(),
    port: execFileSync("./scripts/stack.sh", [".", "staging-port"], { encoding: "utf-8" }).trim(),
  };
  assert.equal(staging.stack, "productos-staging");
  assert.equal(staging.port, "4100");

  /**
   * ⛔ EVERY WORKTREE GIT KNOWS ABOUT, not a fixture — the thing asserted is that no real checkout
   * on this machine can reach staging.
   */
  const checkouts = execFileSync("git", ["worktree", "list"], { encoding: "utf-8" })
    .trim()
    .split("\n")
    .map((l) => l.split(" ")[0]);
  assert.ok(checkouts.length >= 1);

  const ports = new Set();
  const pgPorts = new Set();
  for (const w of checkouts) {
    const s = stack(w);
    assert.notEqual(s.PRODUCTOS_STACK, staging.stack, `${w} resolved to staging's project`);
    assert.notEqual(s.PORT, staging.port, `${w} resolved to staging's port`);
    assert.notEqual(s.PG_PORT, "5432", `${w} resolved to the default postgres port`);
    assert.match(s.PRODUCTOS_STACK, /^productos-dev-/, `${w} is not named as a dev stack`);
    /** ⛔ 42xx, not 41xx — 41xx is where one-off ProductOS containers get parked next to staging. */
    assert.ok(Number(s.PORT) >= 4200, `${w} is on ${s.PORT}, inside the 41xx family`);
    assert.ok(Number(s.PG_PORT) >= 5500, `${w} has postgres on ${s.PG_PORT}`);
    assert.ok(!ports.has(s.PORT), `${w} wants ${s.PORT}, which another checkout already has`);
    assert.ok(!pgPorts.has(s.PG_PORT), `${w} wants postgres ${s.PG_PORT}, already taken`);
    ports.add(s.PORT);
    pgPorts.add(s.PG_PORT);
  }

  /** ⛔ The same answer from another directory, or `make stacks` would be fiction. */
  const abs = path.resolve("scripts/stack.sh");
  assert.equal(
    execFileSync(abs, [checkouts[0]], { cwd: os.tmpdir(), encoding: "utf-8" }).trim(),
    execFileSync(abs, [checkouts[0]], { encoding: "utf-8" }).trim(),
  );
});

/**
 * ⛔ THE STACK IDENTITY IS REQUIRED, NOT DEFAULTED, BECAUSE THE DEFAULT WAS STAGING.
 *
 * `docker-compose.yml` read `${PRODUCTOS_STACK:-productos}` and `${PORT:-4100}`. With none of the
 * Makefile's exports in the environment, a bare `docker compose up` in this checkout therefore
 * claimed staging's project name and staging's port. It happened twice while this was being built:
 * once from a worktree whose branch lacked `scripts/stack.sh`, and once from a plain shell, which
 * got as far as `Bind for 0.0.0.0:4100 failed: port is already allocated`.
 *
 * A guard that enumerates the ways round a bad default is strictly worse than not having the bad
 * default. So compose refuses and names the command that sets it.
 */
test("compose refuses to run without being told which stack it is", () => {
  const compose = effective(fs.readFileSync("docker-compose.yml", "utf-8"));
  for (const [v, why] of [
    ["PRODUCTOS_STACK", "the project name"],
    ["PORT", "the app port"],
    ["PG_PORT", "the store port"],
  ]) {
    assert.match(compose, new RegExp(`\\$\\{${v}:\\?`), `${why} is defaulted rather than required`);
    assert.doesNotMatch(compose, new RegExp(`\\$\\{${v}:-`), `${why} still has a silent default`);
  }
  /** ⛔ And no dev stack may reach an external store: the local file names its own Postgres flatly. */
  assert.match(compose, /DATABASE_URL: postgres:\/\/productos:productos@postgres:5432\/productos/,
    "the local stack can still inherit DATABASE_URL from .env, which is how `make up` reached Neon");
  assert.doesNotMatch(compose, /DATABASE_URL: \$\{DATABASE_URL/,
    "an external store can still win for the dev stack");

  /** The real proof, not the text: compose itself refuses with the variable named. */
  let refused = "";
  try {
    execFileSync("docker", ["compose", "-f", "docker-compose.yml", "config"], {
      encoding: "utf-8",
      env: { ...process.env, PRODUCTOS_STACK: "", PORT: "", PG_PORT: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    refused = `${e.stderr ?? ""}${e.stdout ?? ""}`;
  }
  assert.match(refused, /PRODUCTOS_STACK/, "compose did not refuse an unset stack identity");
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
    assert.match(mk, new RegExp(`^${t}:[^\\n]*\\bstaging-guard\\b`, "m"), `${t} can reach the shared store without the guard`);
  }
  /**
   * ⛔ THE TARGET MUST HAVE A RECIPE, NOT JUST A NAME. A careless edit removed `staging-guard`'s
   * body while three targets still named it as a prerequisite, and make answers "Nothing to be
   * done for `staging-guard'" — which reads exactly like a guard that passed. Staging was
   * unguarded and every text-matching assertion here still held.
   */
  assert.match(mk, /^staging-guard:\n\t/m, "staging-guard has no recipe — it is a name that always succeeds");
  const rbody = recipe(mk, "staging-guard");
  /**
   * ⛔ THE QUESTION CHANGED, AND THIS ASSERTION WAS THE OLD ONE. It demanded that staging-guard
   * compare THIS_WT against MAIN_WT — i.e. refuse every worktree, using "is a worktree" as a proxy
   * for "carries unmerged work".
   *
   * The proxy is usually right and was wrong about the one case that matters. The MAIN checkout is
   * where feature branches are worked on, so it is the dirtiest tree on the machine, and it passed;
   * a checkout kept permanently on main for nothing but deploying was refused. The proxy pointed the
   * deploy at the wrong tree in both directions.
   *
   * ⛔ AND `COPY src ./src` IS WHY THE TREE MATTERS AT ALL: the image is built from the WORKING TREE,
   * not the commit, so "HEAD is in origin/main" never covered it. A clean HEAD with sixteen
   * uncommitted files ships those files to the shared store while git reports a clean commit — which
   * nearly happened here.
   *
   * So the condition asserted is the one that was always meant, and it is strictly stronger.
   */
  /** ⛔ The tree check lives in `MERGED_CHECK` — one home; see `v2-deploy-gate` for why theirs won. */
  assert.match(rbody, /MERGED_CHECK/, "staging-guard does not reach the working-tree check");
  assert.match(rbody, /rev-parse origin\/main/, "the guard does not compare against origin/main");
  assert.doesNotMatch(rbody, /merge-base --is-ancestor/, "an ancestor check lets a commit BEHIND origin/main deploy");
  /**
   * ⛔ THE GUARD ASKS GIT, NOT THE SCRIPT, AND THIS IS THE ASSERTION THAT WOULD HAVE CAUGHT IT. A
   * worktree on a branch without `scripts/stack.sh` makes `$(shell ...)` empty, compose uses its
   * default, and the default is dev. A throwaway worktree did exactly that and was stopped only by
   * `Bind for 0.0.0.0:4100 failed`.
   */
  const body = recipe(mk, "dev-guard");
  /**
   * ⛔ dev-guard COMPARES AGAINST STAGING'S IDENTITY, NOT AGAINST WHICH WORKTREE THIS IS.
   *
   * It used to ask git whether this was the main checkout, because back then the main checkout was
   * allowed to own 4100 and a worktree was not. With 4100 belonging to staging, the question is no
   * longer "who am I" but "did I somehow resolve to staging" — which is true of the main checkout
   * too, and was, twice. Asking git would now pass exactly the case that went wrong.
   *
   * The worktree question still exists, in `staging-guard`, where it is the right question:
   * asserted below.
   */
  assert.match(body, /STAGING_STACK/, "dev-guard does not compare against staging's project name");
  assert.match(body, /STAGING_PORT/, "dev-guard does not compare against staging's port");
  /**
   * ⛔ THE MERGE CHECK IS ONE COPY SHARED BY BOTH GUARDS, so this asserts the call here and the
   * question itself in the define — two stacks both landing on 4100 is two places to forget.
   */
  /**
   * ⛔ dev-guard NO LONGER ASKS WHETHER HEAD IS MERGED, AND THAT IS THE POINT OF A DEV STACK.
   * It used to, because the stack it guarded WAS the instance on 4100. Now every checkout has its
   * own stack on its own port, so running an unmerged branch there is the entire reason it exists;
   * refusing it would have made the thing being built useless. The merged question belongs to
   * staging, where it is about a deployed instance rather than a checkout.
   */
  assert.doesNotMatch(body, /MERGED_CHECK/, "dev-guard refuses an unmerged branch, which is what a dev stack is for");
  assert.match(body, /STAGING_STACK/, "dev-guard does not compare against staging's identity");
  assert.match(mk, /^define MERGED_CHECK$/m, "the merge check is not shared");
  /**
   * ⛔ THE WORKTREE QUESTION IS GONE FROM STAGING, AND STAYS IN DEV. `dev-guard` still asks which
   * checkout this is, because a worktree resolving to staging's stack and port is a real mistake it
   * must catch. `staging-guard` asks the stronger thing instead — clean, and identical to
   * origin/main — which makes "am I a worktree" irrelevant there.
   *
   * `merge-base --is-ancestor` survives only in `MERGED_CHECK`, which `dev-guard` uses: dev may run
   * anything merged. Staging demands identity, because an ancestor is a stale deploy.
   */
  /**
   * ⛔ `dev-guard` DELIBERATELY DOES NOT ASK WHETHER HEAD IS MERGED — a dev stack is FOR an unmerged
   * branch, and refusing that would make the thing useless. `MERGED_CHECK` therefore survives with
   * exactly one caller, staging-guard, where it is now belt-and-braces behind the identity check.
   */
  assert.doesNotMatch(body, /MERGED_CHECK/, "dev-guard refuses an unmerged branch, which is what a dev stack is for");
  assert.match(mk, /merge-base --is-ancestor HEAD origin\/main/, "the merge check is gone entirely");
  /**
   * ⛔ THE OVERRIDE REACHES EVERY CHECK, OR IT ADVERTISES AN ESCAPE HATCH IT DOES NOT HAVE.
   *
   * The tree check moved to `MERGED_CHECK`, which staging-guard already calls behind its own
   * `DEV_ANYWAY` test — so one gate covers it. The identity check is separate and needs its own.
   */
  assert.match(rbody, /\[ -z "\$\(DEV_ANYWAY\)" \][\s\S]*MERGED_CHECK/, "DEV_ANYWAY cannot get past the tree check");
  assert.match(rbody, /\[ -z "\$\(DEV_ANYWAY\)" \][\s\S]*rev-parse origin\/main/, "DEV_ANYWAY cannot get past the identity check");
  assert.match(mk, /DEV_ANYWAY/, "there is no way to override it on purpose");
  assert.match(mk, /^up: dev-guard migrations-check$/m, "up does not check the numbering before starting");
});
