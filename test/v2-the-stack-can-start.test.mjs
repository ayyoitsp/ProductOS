/**
 * ⛔ THE DEV STACK HAS TO BE ABLE TO START, AND TWICE IT COULD NOT.
 *
 * Peter: *"Start a Dev stack and clone the data from staging."* Neither half worked as shipped, and
 * both failures were a number or a name living in two places with nothing comparing them:
 *
 *  1. `$(DEV)` — the dev stack's compose invocation — was used by `up`, `down`, `logs`, `rebuild`,
 *     `restart` and the no-cache build, and DEFINED NOWHERE. Make expands an undefined variable to
 *     the empty string rather than complaining, so `$(DEV) up -d` ran as `up -d` and every one of
 *     those targets died on `make: up: No such file or directory`. On the dev stack, which is now
 *     the only sanctioned way to work from a checkout that is not staging.
 *
 *  2. The local Postgres was pinned to 16 while `PG_CLIENT` — what `backup-remote` dumps the
 *     managed store with — was 18. A dump from staging (Neon 18.6) emits `SET transaction_timeout`,
 *     a 17 addition, and `make restore` died on `unrecognized configuration parameter`. So "clone
 *     staging into your dev stack" was impossible, which is the single thing a dev stack is for.
 *
 * Neither is subtle once seen, and neither was visible to any existing test: the suite checks which
 * stack a checkout resolves to, and never whether the commands that bring it up can run.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";

const MAKEFILE = fs.readFileSync("Makefile", "utf-8");
const COMPOSE = fs.readFileSync("docker-compose.yml", "utf-8");

/**
 * ⛔ PASSED IN, NOT DEFINED — so a name here is a claim that somebody types it on the command line.
 * `make restore FILE=…`, `make checkpoint FROM=…`, `make hosted-doctor STAGING=1`, the two
 * deliberate overrides, and make's own builtins. Anything NOT on this list and not assigned is the
 * `$(DEV)` bug again.
 */
const FROM_THE_COMMAND_LINE = new Set([
  "AS",
  "DEV_ANYWAY",
  "FILE",
  "FROM",
  "REBUILD",
  "STAGING",
  // make's own
  "MAKE",
  "PWD",
]);

test("every variable the Makefile uses is defined, or is one somebody types", () => {
  const used = new Set([...MAKEFILE.matchAll(/\$\(([A-Z][A-Z0-9_]*)\)/g)].map((m) => m[1]));
  const defined = new Set([...MAKEFILE.matchAll(/^([A-Z][A-Z0-9_]*)\s*[:?+]?=/gm)].map((m) => m[1]));

  const dangling = [...used].filter((v) => !defined.has(v) && !FROM_THE_COMMAND_LINE.has(v)).sort();
  assert.deepEqual(
    dangling,
    [],
    `these expand to the empty string, which make does silently:\n  ${dangling.join("\n  ")}\n` +
      `Define them, or add them to FROM_THE_COMMAND_LINE with the target that takes them.`
  );
});

test("the dev stack's compose invocation names both files", () => {
  /**
   * ⛔ BOTH `-f` FLAGS. The overlay carries only the build target — no postgres, no ports, no
   * project name. Brought up alone it would start something shaped like the stack and missing its
   * database, which fails later and somewhere else.
   */
  const dev = /^DEV\s*[:?]?=(.*)$/m.exec(MAKEFILE);
  assert.ok(dev, "$(DEV) is not defined — see this file's header for what that cost");
  assert.match(dev[1], /docker compose/, "$(DEV) does not invoke compose");
  assert.match(dev[1], /-f\s+docker-compose\.yml/, "$(DEV) omits the base file");
  assert.match(dev[1], /-f\s+docker-compose\.dev\.yml/, "$(DEV) omits the dev overlay");
});

test("the Postgres that is dumped from and the one restored into are one version", () => {
  /**
   * ⛔ ONE NUMBER, OR A STAGING DUMP CANNOT LAND IN A DEV STACK. `pg_dump` from a newer server
   * writes statements an older one rejects outright under ON_ERROR_STOP, and the error names a
   * configuration parameter rather than a version — so it reads as a corrupt dump.
   */
  const image = /^PG_IMAGE\s*[:?]?=\s*(\S+)/m.exec(MAKEFILE);
  assert.ok(image, "PG_IMAGE is not defined, so the server and the dump client can drift again");
  assert.match(
    /^PG_CLIENT\s*[:?]?=\s*(.*)$/m.exec(MAKEFILE)?.[1] ?? "",
    /\$\(PG_IMAGE\)/,
    "PG_CLIENT names its own image instead of deriving from PG_IMAGE — that is the drift, restated"
  );
  assert.match(
    COMPOSE,
    /image:\s*\$\{PG_IMAGE:-([^}]+)\}/,
    "docker-compose.yml hardcodes a Postgres image rather than reading PG_IMAGE"
  );
  const composeDefault = /image:\s*\$\{PG_IMAGE:-([^}]+)\}/.exec(COMPOSE)[1];
  assert.equal(
    composeDefault,
    image[1],
    `the Makefile defaults to ${image[1]} and compose to ${composeDefault} — two numbers again`
  );
});

test("an 18+ Postgres image is mounted where 18+ expects it", () => {
  /**
   * ⛔ THE 18 IMAGES MOVED THE MOUNT POINT to `/var/lib/postgresql`, keeping data in a
   * major-version subdirectory inside it. Mounted at the old `…/data`, 18 refuses to start and
   * reports "PostgreSQL data in /var/lib/postgresql/data (unused mount/volume)" — which reads as a
   * failed upgrade even on a volume created seconds earlier, because it is objecting to the layout.
   */
  const major = Number(/postgres:(\d+)/.exec(/^PG_IMAGE\s*[:?]?=\s*(\S+)/m.exec(MAKEFILE)[1])?.[1]);
  assert.ok(Number.isFinite(major), "PG_IMAGE does not name a postgres major version");
  const mount = /productos_data:(\S+)/.exec(COMPOSE)?.[1];
  assert.ok(mount, "the data volume is not mounted anywhere");
  if (major >= 18)
    assert.equal(mount, "/var/lib/postgresql", `postgres:${major} wants the volume one level up from …/data`);
  else assert.equal(mount, "/var/lib/postgresql/data", `postgres:${major} predates the move`);
});
