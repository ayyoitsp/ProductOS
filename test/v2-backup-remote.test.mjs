/**
 * ⛔ A BACKUP OF THE MANAGED STORE, AND THE FOUR WAYS IT COULD BE A FILE THAT ONLY LOOKS LIKE ONE.
 *
 * Peter, now running against Neon: *"let's add a simple way to backup the database now so we can
 * keep making changes to the corpus and ensuring we don't break anything. can be manually, outside
 * of the server - just a way to copy the db down and restore it via the .env variable"*
 *
 * ⛔ THE TARGETS THAT ALREADY EXISTED CANNOT DO THIS, AND THEY LOOK LIKE THEY CAN. `backup` and
 * `restore` both run `docker compose exec postgres`, and on a managed store there IS no postgres
 * container — that is the whole point of that stack. The same trap as `rebuild`/`restart`: a name
 * that implies it works everywhere, about the local stack only.
 *
 * This asserts the Makefile's contract rather than running Docker. The behaviour was driven: a real
 * dump of the live store restored TWICE into a throwaway Postgres 18 with zero errors, and the row
 * counts matched what `remote-doctor` reports — accounts 2, projects 4, documents 84, events 1.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";

const mk = fs.readFileSync("Makefile", "utf-8");
/** The body of one target, up to the next target or a blank-line boundary. */
const target = (name) => {
  const i = mk.indexOf(`\n${name}:`);
  assert.ok(i > 0, `there is no ${name} target`);
  const rest = mk.slice(i + 1);
  const end = rest.search(/\n[a-zA-Z][a-zA-Z0-9_.-]*:/);
  return end < 0 ? rest : rest.slice(0, end);
};

test("the managed store has its own backup and restore", () => {
  for (const t of ["backup-remote", "restore-remote"]) assert.ok(target(t).length > 40, `${t} is empty`);
  /** ⛔ Neither may reach for the local stack's container, which does not exist here. */
  for (const t of ["backup-remote", "restore-remote"])
    assert.ok(!/docker compose exec postgres/.test(target(t)), `${t} runs against the local postgres container`);
});

/**
 * ⛔ THE CLIENT MAJOR IS NOT A DETAIL. This store is PostgreSQL 18 and the local stack pins 16;
 * `pg_dump` REFUSES a server newer than itself. Reaching for the version already in the compose
 * file produces a mismatch error rather than a backup — which is how a backup command ends up never
 * being run a second time.
 */
test("the client is pinned to a major that can read the store", () => {
  /**
   * ⛔ ONE NUMBER, NOT TWO — AND THIS ASSERTION USED TO SPELL THE SECOND ONE OUT.
   *
   * It pinned the literal `PG_CLIENT ?= postgres:18-alpine`, which was right about the major and
   * wrong about where it lives. The local Postgres was separately `postgres:16-alpine` in the
   * compose file, so a dump taken with the 18 client carried `SET transaction_timeout` — a 17
   * addition — and restoring it into a dev stack died under ON_ERROR_STOP on "unrecognized
   * configuration parameter". That message names a parameter rather than a version, so it reads as
   * a corrupt dump. Found by a worktree session trying to clone staging into its own stack.
   *
   * `PG_CLIENT` now derives from `PG_IMAGE`, which compose also reads, so the server and the client
   * cannot drift apart. Asserting the derivation rather than the number is what keeps this true
   * after the next version bump instead of failing on it.
   */
  assert.match(mk, /^PG_IMAGE\s*[:?]?=\s*postgres:(\d+)/m, "the Postgres version is not named in one place");
  assert.match(mk, /^PG_CLIENT \?= \$\(PG_IMAGE\)/m, "the dump client does not derive from PG_IMAGE — the two can drift");
  const major = Number(/^PG_IMAGE\s*[:?]?=\s*postgres:(\d+)/m.exec(mk)?.[1]);
  assert.ok(major >= 18, `PG_IMAGE is postgres:${major}, and pg_dump refuses a server newer than itself`);
  const b = target("backup-remote");
  assert.match(b, /\$\(PG_CLIENT\)/, "backup-remote does not use the pinned client");
  assert.match(target("restore-remote"), /\$\(PG_CLIENT\)/, "restore-remote does not use the pinned client");
});

/**
 * ⛔ `--clean --if-exists`, OR THE DUMP IS NOT RESTORABLE AND NOBODY FINDS OUT UNTIL THEY NEED IT.
 * The instance applies migrations on boot, so by the time anybody restores, the schema already
 * exists and a plain dump dies on "type already exists". The local `backup` learned this by
 * destroying its volume; this one inherits the lesson rather than repeating it.
 */
test("the dump can replace a schema that already exists, and says so if it cannot", () => {
  const b = target("backup-remote");
  assert.match(b, /--clean --if-exists/, "the dump cannot restore over an existing schema");
  assert.match(b, /DROP TABLE IF EXISTS/, "nothing checks that the dump actually carries the drops");
  assert.match(b, /test -s \$\$out/, "an empty dump is accepted as a backup");
  /** ⛔ Neon's roles are not ours, so ownership and grants would fail on restore elsewhere. */
  assert.match(b, /--no-owner --no-privileges/, "the dump carries owners and grants from a store we do not own");
});

/** ⛔ A credential in argv lands in `ps` on a shared machine, and in make's own echo of the line. */
test("the connection string is passed by environment, never argv", () => {
  for (const t of ["backup-remote", "restore-remote"]) {
    const body = target(t);
    assert.match(body, /-e PGURL=/, `${t} does not pass the URL by environment`);
    assert.ok(!/pg_dump "\$\$url"|psql "\$\$url"/.test(body), `${t} puts the connection string in argv`);
  }
});

/**
 * ⛔ RESTORING A MANAGED STORE IS THE ONE OPERATION HERE NOTHING LOCAL CAN UNDO. `make nuke` only
 * ever cost a Docker volume; this replaces a database that may be the only copy.
 */
test("restoring the managed store is guarded and names what it will replace", () => {
  const r = target("restore-remote");
  assert.match(r, /test -n "\$\(FILE\)"/, "it would restore without being told which file");
  assert.match(r, /type the word replace/, "it replaces a managed store with no confirmation");
  assert.match(r, /sed -E 's#\/\/\[\^@\]\*@#\/\/\*\*\*@#'/, "it names the store without masking the credential");
  assert.match(r, /ON_ERROR_STOP=1/, "a failed statement mid-restore would be reported as success");
  /**
   * ⛔ AND THE INSTANCE IS RESTARTED. It resolved its session id at boot and a restore replaces the
   * table under it, so every page answers 401 on a perfectly good database — which reads as the
   * restore having failed. The local `restore` found this by restoring and then opening a page.
   */
  assert.match(r, /docker-compose\.remote\.yml restart productos/, "a restore leaves the instance holding a session id that no longer exists");
});
