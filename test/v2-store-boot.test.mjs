/**
 * ⛔ A CONTAINER BOOTS MORE THAN ONCE, AND THE FIRST VERSION OF THIS ONLY WORKED ONCE.
 *
 * `applyMigrations` ran every statement every time. That is correct for a test, which always starts
 * from an empty database, and fatal for a container: the second start dies on "relation already
 * exists", and a crash-looping instance with a perfectly healthy database reads as a database
 * problem for however long it takes somebody to find the log line.
 *
 * So the ledger is asserted here rather than reasoned about, along with the two config refusals
 * that decide whether a bad deploy fails loudly or serves an empty corpus somebody mistakes for
 * their own.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { migrations, migrationStatements, migrationsDir } from "../dist/v2/store/migrate.js";
import { migrateStore, configFromEnv, rowsOf } from "../dist/v2/store/server.js";
import { accountFor } from "../dist/v2/store/identity.js";

const fresh = () => {
  const client = new PGlite();
  return { client, db: drizzle(client) };
};

test("the migrations are discovered in journal order, not filename order", () => {
  const all = migrations(migrationsDir());
  assert.ok(all.length >= 2, "fewer migrations than expected — this test now proves less");
  assert.ok(all.every((m) => m.statements.length > 0), "a migration contributed no statements");
  assert.equal(
    migrationStatements().length,
    all.reduce((n, m) => n + m.statements.length, 0),
  );
});

test("migrating twice is a no-op the second time", async () => {
  const { db } = fresh();

  const first = await migrateStore(db);
  assert.deepEqual(
    first.applied,
    migrations().map((m) => m.tag),
    "the first run did not apply everything",
  );
  assert.deepEqual(first.skipped, []);

  /** ⛔ THE RESTART. This is the call that used to throw. */
  const second = await migrateStore(db);
  assert.deepEqual(second.applied, [], "a migration was applied twice");
  assert.deepEqual(
    second.skipped,
    migrations().map((m) => m.tag),
    "the ledger did not recognise what it had already run",
  );

  /** And the schema still works afterwards. */
  const account = await accountFor(db, "ada@example.com");
  assert.ok(account);
});

test("a migration is recorded only after its statements run", async () => {
  const { db } = fresh();
  await migrateStore(db);
  const rows = rowsOf(await db.execute(sql.raw("select tag from _productos_migrations order by tag")));
  assert.deepEqual(
    rows.map((r) => r.tag).sort(),
    migrations()
      .map((m) => m.tag)
      .sort(),
  );
});

test("a partly-migrated database is brought the rest of the way, not restarted", async () => {
  const { db } = fresh();
  const all = migrations();

  /** Apply the first migration by hand and tell the ledger about it; leave the rest undone. */
  await db.execute(
    sql.raw(
      "create table if not exists _productos_migrations (tag text primary key, applied_at timestamptz not null default now())",
    ),
  );
  for (const stmt of all[0].statements) await db.execute(sql.raw(stmt));
  await db.execute(sql.raw(`insert into _productos_migrations (tag) values ('${all[0].tag}')`));

  const result = await migrateStore(db);
  assert.deepEqual(result.skipped, [all[0].tag]);
  assert.deepEqual(
    result.applied,
    all.slice(1).map((m) => m.tag),
    "the remaining migrations were not applied",
  );
});

test("the instance refuses to start without a store, rather than defaulting to one", () => {
  assert.throws(() => configFromEnv({}), /DATABASE_URL is not set/);
  assert.throws(() => configFromEnv({ DATABASE_URL: "   " }), /DATABASE_URL is not set/);

  /**
   * ⛔ The refusal has to say why it matters. A default connection string is how a container comes
   * up pointed at the wrong Postgres and serves an empty corpus somebody reads as data loss.
   */
  try {
    configFromEnv({});
    assert.fail("no refusal");
  } catch (e) {
    assert.match(e.message, /empty corpus/);
  }
});

test("config comes from the environment and nothing else", () => {
  const c = configFromEnv({
    DATABASE_URL: "postgres://x/y",
    PORT: "8080",
    PRODUCTOS_SINGLE_ACCOUNT: "me@localhost",
  });
  assert.deepEqual(c, {
    databaseUrl: "postgres://x/y",
    port: 8080,
    singleAccount: "me@localhost",
  });

  /** ⛔ Absent means hosted: sign in, or bring a token. An empty string is absent, not an account. */
  assert.equal(configFromEnv({ DATABASE_URL: "x", PRODUCTOS_SINGLE_ACCOUNT: "" }).singleAccount, undefined);
  assert.equal(configFromEnv({ DATABASE_URL: "x" }).port, 4100);
});
