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
import { execFileSync } from "node:child_process";

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
  /**
   * ⛔ A SUITE RESULT ASSERTED BY A PERSON, NAMING THE COMMIT IT WAS RUN AGAINST. The full suite
   * cannot finish inside the deploy on this machine — ten minutes idle, unbounded at load 102, and
   * killed twice for running longer than one command may. So `make suite-now` runs it and prints
   * the line to paste; `deploy` refuses the assertion unless the sha is exactly what would deploy.
   */
  "SUITE_VERIFIED",
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
  /**
   * ⛔ IT MUST FAIL WITH THE DIAGNOSIS, NOT WITH A TypeError. This indexed `[1]` straight off the
   * match, so against a Makefile with no `PG_IMAGE` at all — which is every version before this
   * commit — all it said was "Cannot read properties of null (reading '1')". That is the shape of
   * failure somebody debugs for ten minutes before realising the test was right.
   */
  const assigned = /^PG_IMAGE\s*[:?]?=\s*(\S+)/m.exec(MAKEFILE);
  assert.ok(assigned, "the Makefile assigns no PG_IMAGE, so the server and client majors are set in two places");
  const major = Number(/postgres:(\d+)/.exec(assigned[1])?.[1]);
  assert.ok(Number.isFinite(major), `PG_IMAGE is "${assigned[1]}", which does not name a postgres major version`);
  const mount = /productos_data:(\S+)/.exec(COMPOSE)?.[1];
  assert.ok(mount, "the data volume is not mounted anywhere");
  if (major >= 18)
    assert.equal(mount, "/var/lib/postgresql", `postgres:${major} wants the volume one level up from …/data`);
  else assert.equal(mount, "/var/lib/postgresql/data", `postgres:${major} predates the move`);
});

/**
 * ⛔ AND THE OTHER DIRECTION: ASK MAKE WHAT IT WOULD ACTUALLY RUN.
 *
 * The four assertions above read the Makefile as text, which is what caught `$(DEV)`. This asks
 * make itself, and it is the cheaper half of the lesson the dev-stack bug taught:
 *
 *   `make up` was verified working, then the guards above it were restructured — and the slice that
 *   replaced them swallowed the two lines defining `DEV` and `BUILT`. Nobody ran `make up` again.
 *   Every test still passed, because the suite asserted which stack a checkout RESOLVES to and
 *   never whether the command that brings it up could run. Make expands an undefined variable to
 *   the empty string in silence, so the recipe became the bare `up -d`.
 *
 * `make -n` expands recipes without executing them, so this needs no Docker and no running stack.
 * A recipe line that was supposed to start a container and no longer mentions `docker` is the exact
 * footprint of a variable that evaporated.
 */
test("every target that starts a container still expands to a docker command", () => {
  const starts = ["up", "rebuild", "restart", "down", "logs"];
  for (const t of starts) {
    let out = "";
    try {
      out = execFileSync("make", ["-n", t], {
        encoding: "utf-8",
        env: { ...process.env, PRODUCTOS_STACK: "probe", PORT: "4999", PG_PORT: "5999" },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      /** A guard refusing is fine — it means make got as far as the recipe. A parse error is not. */
      out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
      assert.doesNotMatch(out, /missing separator|unterminated|\*\*\* /, `make cannot even parse ${t}: ${out.slice(0, 200)}`);
    }

    /**
     * ⛔ THE ASSERTION IS PER LINE, NOT ON THE WHOLE BLOB. `up` prints a 15-line health-poll loop
     * that legitimately contains `docker compose logs`, so a match anywhere would have passed even
     * with the broken `up -d` sitting in it — which is how this bug would have slipped through a
     * lazier version of this test.
     */
    const orphan = out
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^(up|down|logs|restart|build|exec|ps)\b/.test(l));
    assert.deepEqual(
      orphan,
      [],
      `make ${t} would run ${orphan.join(", ")} as a command — a compose variable expanded to nothing`,
    );
  }
});
