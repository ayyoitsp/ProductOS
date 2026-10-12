import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

/**
 * ⛔ THIS FILE EXISTS BECAUSE STAGING WENT DOWN, AND BECAUSE NOTHING COULD HAVE CAUGHT IT.
 *
 * `make deploy` dumps the store and then recreates the container about forty seconds later. Every
 * dump pg_dump writes begins with
 *
 *     SELECT pg_catalog.set_config('search_path', '', false);
 *
 * and the third argument `false` means SESSION-scoped, not transaction-scoped. Against a
 * transaction pooler that server connection returns to the pool carrying an EMPTY search_path, and
 * the next client inherits it. The next client was the booting container, whose first statement is
 * `create table if not exists _productos_migrations` — which failed with 3F000, no schema has been
 * selected to create in. The deploy ninety minutes earlier survived by drawing a different
 * connection, which is why this looked transient and is not.
 *
 * Three defences, each tested here, because any one of them alone leaves the failure reachable.
 */

const read = (p) => fs.readFileSync(p, "utf-8");
/** ⛔ Comments stripped before matching, or a test passes on the prose that explains it. */
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

test("the app names its schema, so an ambient pooled search_path cannot decide where it looks", () => {
  const server = code("src/v2/store/server.ts");
  assert.match(
    server,
    /connection:\s*\{[^}]*search_path:\s*"public"/,
    "openStore does not pin search_path — one poisoned pooled connection takes boot down again",
  );
  /**
   * ⛔ A STARTUP PARAMETER, NOT A `SET`. A `SET` would leak back into the pool exactly the way
   * pg_dump's does, which is the disease rather than the cure.
   */
  assert.doesNotMatch(
    server,
    /\bset\s+search_path\b/i,
    "a SET leaks into the pool for the next client, which is the bug this is fixing",
  );
});

test("the dump goes through the direct endpoint, so it never poisons a pool", () => {
  const mk = read("Makefile");
  const recipe = mk.split(/^backup-remote:/m)[1].split(/^\S/m)[0];
  assert.match(recipe, /unpooled\.sh/, "backup-remote dumps through whatever .env says, pooler included");

  /** The helper itself: a Neon pooled host loses `-pooler`, and nothing else is touched. */
  const un = (u) => execFileSync("./scripts/unpooled.sh", [u], { encoding: "utf-8" });
  assert.equal(
    un("postgresql://u:p@ep-weathered-waterfall-b5fdgnp0-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"),
    "postgresql://u:p@ep-weathered-waterfall-b5fdgnp0.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require",
  );
  assert.equal(
    un("postgres://postgres:postgres@localhost:5432/productos"),
    "postgres://postgres:postgres@localhost:5432/productos",
    "a local URL must survive untouched",
  );
  /** ⛔ `-pooler` inside a PASSWORD or a DATABASE NAME is not a host and must not be rewritten. */
  assert.equal(
    un("postgresql://u:a-pooler.b@ep-x.neon.tech/neondb"),
    "postgresql://u:a-pooler.b@ep-x.neon.tech/neondb",
    "a credential containing -pooler. was rewritten as though it were the host",
  );
  assert.equal(
    un("postgresql://u:p@ep-x.neon.tech/db-pooler.main"),
    "postgresql://u:p@ep-x.neon.tech/db-pooler.main",
    "a database name containing -pooler. was rewritten as though it were the host",
  );
});

test("boot prints the cause, because the wrapper message is the part anybody could guess", () => {
  const boot = code("src/v2/store/boot.ts");
  assert.match(boot, /because/, "boot says nothing beyond drizzle's own wrapper message");
  assert.match(boot, /\bcause\b/, "boot never walks .cause, where the sqlstate actually is");
  assert.match(boot, /\bcode\b/, "boot does not report the error code — the whole diagnosis is the code");
});

test("the schema step retries a connection-shaped fault, and refuses to retry a refusal", async () => {
  const { migrateWithRetries } = await import("../dist/v2/store/server.js");
  const { SchemaAheadError } = await import("../dist/v2/store/migrate.js");

  /** A fake Db whose first N executes fail the way a poisoned pooled connection does. */
  const flaky = (failures, code) => {
    let n = 0;
    return {
      execute: async () => {
        if (n++ < failures) {
          const e = new Error("Failed query: create table if not exists _productos_migrations");
          e.cause = Object.assign(new Error("no schema has been selected to create in"), { code });
          throw e;
        }
        return [];
      },
    };
  };

  const noWait = async () => {};
  const ok = await migrateWithRetries(flaky(2, "3F000"), 4, noWait);
  assert.ok(Array.isArray(ok.applied), "a fault that clears on the third attempt should boot");

  await assert.rejects(
    () => migrateWithRetries(flaky(99, "3F000"), 3, noWait),
    /Failed query/,
    "a fault that never clears must still fail rather than loop",
  );

  /** ⛔ A real refusal is a true answer. Retrying it turns a clear refusal into a slow one. */
  let asked = 0;
  const ahead = { execute: async () => { asked += 1; throw new SchemaAheadError(["0009_from_the_future"]); } };
  await assert.rejects(() => migrateWithRetries(ahead, 4, noWait), /0009_from_the_future/);
  assert.equal(asked, 1, "SchemaAheadError was retried — a store migrated by newer code is not transient");

  /** Our own logic errors carry no sqlstate, and must not be retried either. */
  let plain = 0;
  const bug = { execute: async () => { plain += 1; throw new Error("undefined is not a function"); } };
  await assert.rejects(() => migrateWithRetries(bug, 4, noWait), /undefined is not a function/);
  assert.equal(plain, 1, "a programming error was retried four times instead of failing once");
});
