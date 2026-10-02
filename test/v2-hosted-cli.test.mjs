/**
 * ⛔ WITHOUT THIS SURFACE, `docker compose up` LEAVES SOMETHING NOBODY CAN USE.
 *
 * Every route on the instance needs a credential and a credential is a row in the store, so for a
 * while the only way to create the first account was a hand-written Node script — which is what I
 * actually did to verify the container, and then deleted. That is a demo somebody performed once,
 * not a local setup.
 *
 * Driven as a subprocess against a connection string, because that is how it is used. Two
 * properties matter beyond "it works":
 *
 *   1. ⛔ It refuses to guess a connection string. A default is how somebody edits the wrong
 *      instance and finds out afterwards.
 *   2. ⛔ A token is printed once and stored only as a hash.
 *
 * Needs a real server, so it runs against the compose Postgres when one is up and skips otherwise —
 * ⛔ announced in the test name, never silently, because a skipped guarantee that reads as a passing
 * one is worse than no test.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { hashToken } from "../dist/v2/store/identity.js";
import { migrationStatements } from "../dist/v2/store/migrate.js";

const CLI = path.resolve("dist/cli/index.js");

const run = (args, env = {}) => {
  try {
    return {
      ok: true,
      out: execFileSync("node", [CLI, ...args], {
        encoding: "utf-8",
        env: { ...process.env, ...env },
        stdio: ["pipe", "pipe", "pipe"],
      }),
    };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

test("`hosted` refuses to guess a connection string", () => {
  const r = run(["hosted", "doctor"], { DATABASE_URL: "" });
  assert.equal(r.ok, false, "it ran against something it was never told about");
  assert.match(r.out, /Pass --db <url> or set DATABASE_URL/);
  /** ⛔ The refusal has to say why, or somebody adds a default back next week. */
  assert.match(r.out, /no default on purpose/);
});

test("`hosted` is on the CLI and says what it is for", () => {
  const r = run(["hosted", "--help"]);
  assert.equal(r.ok, true, r.out);
  for (const sub of ["doctor", "projects", "project", "token", "import", "export", "session"])
    assert.match(r.out, new RegExp(`\\b${sub}\\b`), `no "${sub}" subcommand`);
  /** ⛔ The one thing somebody has to know before using it. */
  assert.match(r.out, /DATABASE_URL/);
});

test("a token is hashed at rest, never stored as issued", async () => {
  /**
   * Asserted against the library rather than the CLI so it needs no server — the CLI prints what
   * `issueToken` returns and stores what `issueToken` stores, and that function is the whole claim.
   */
  const client = new PGlite();
  const db = drizzle(client);
  await applyMigrations((sql) => client.exec(sql));
  const { accountFor, issueToken } = await import("../dist/v2/store/identity.js");
  const account = await accountFor(db, "ada@example.com");
  const { token } = await issueToken(db, { account, actor: "ci", scopes: ["read"] });

  const rows = await client.query("select hash from tokens");
  assert.equal(rows.rows.length, 1);
  assert.notEqual(rows.rows[0].hash, token, "the credential is in the table in the clear");
  assert.equal(rows.rows[0].hash, hashToken(token));
});

test("the image carries its migrations, so an instance can find them", () => {
  /**
   * ⛔ `migrationsDir()` WALKS UP, and the Dockerfile copies `drizzle/` next to `dist/`. If the
   * journal or a referenced file were missing from the image, the instance would come up against an
   * empty database that looks like data loss. This asserts the files the walk expects exist and are
   * internally consistent.
   */
  const statements = migrationStatements();
  assert.ok(statements.length > 0, "no migration statements were discovered at all");
  assert.ok(
    statements.some((s) => /create table "accounts"/i.test(s)),
    "the schema does not create accounts — the journal and the SQL have diverged",
  );

  const dockerfile = fs.readFileSync("Dockerfile", "utf-8");
  assert.match(dockerfile, /COPY drizzle \.\/drizzle/, "the image does not carry the migrations");
  assert.match(dockerfile, /COPY --from=build \/app\/dist \.\/dist/);
  /** ⛔ PGlite is how the tests get a real Postgres; a second engine in the image buys nothing. */
  assert.match(dockerfile, /--omit=dev/, "the image ships devDependencies, including PGlite");
});

test("the compose stack at the root is ProductOS, not the demo app", () => {
  const compose = fs.readFileSync("docker-compose.yml", "utf-8");
  assert.match(compose, /productos/, "the root compose file is not ProductOS");
  /**
   * ⛔ IT USED TO BE FAMILY WALLET'S. The demo consumer app's API and database sat at the repo root
   * reading as this project's infrastructure, which is the kind of thing somebody deploys by
   * accident.
   */
  assert.ok(!/family_wallet/.test(compose), "the root compose file is still the demo app's");
  assert.ok(fs.existsSync("backend/docker-compose.yml"), "the demo app's compose file went missing");
  assert.match(fs.readFileSync("backend/docker-compose.yml", "utf-8"), /family_wallet/);

  /** ⛔ The instance must wait for a store it refuses to start without. */
  assert.match(compose, /condition: service_healthy/, "the instance can start before its database");
});

test("the Makefile's hosted targets exist and `up` waits for healthy", () => {
  const mk = fs.readFileSync("Makefile", "utf-8");
  for (const target of ["up:", "down:", "logs:", "rebuild:", "restart:", "nuke:", "seed:", "hosted-doctor:"])
    assert.match(mk, new RegExp(`^${target.replace(":", ":")}`, "m"), `no ${target} target`);

  /**
   * ⛔ `docker compose up -d` RETURNS BEFORE THE INSTANCE IS READY, so a target that stopped there
   * would hand back a port that is listening and not migrated, and the next command would race it.
   */
  assert.match(mk, /\/health/, "`up` does not check health");
  assert.ok(/seq 1 60/.test(mk), "`up` does not wait");

  /** ⛔ `seed` must not publish somebody's working corpus into a container. */
  const seed = mk.slice(mk.indexOf("\nseed:"));
  assert.match(seed, /v2 reset --at/, "seed does not generate its own corpus");
  assert.ok(!/--at \.\/v2\b/.test(seed), "seed imports the working corpus");
});
