/**
 * ⛔ THE SKILL IS THE LAYER, AND A SKILL NOBODY CHECKS IS PROSE.
 *
 * Peter: *"No, let the Claude sessions deal with it. Just make a skill so they know how to resolve
 * and handle migrations in general"*.
 *
 * So the detection gaps are deliberately not code — they are instructions, and that is a decision,
 * not an omission. Which makes this test the only thing standing between those instructions and
 * quietly disappearing in a later edit: `CLAUDE.md` opens on the observation that a rule with a ⛔
 * on it was violated four times and only a failing build stopped it.
 *
 * ⛔ IT ASSERTS THE RULES THAT COST SOMETHING TO LOSE, NOT THE PROSE. Each one below is either a
 * behaviour driven in this session or a hazard with no mechanical check behind it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";

const SKILL = "skills/productos-migrations/SKILL.md";
const body = fs.readFileSync(SKILL, "utf-8");

test("the skill is installable and declares itself", () => {
  /** ⛔ `productos*` is how the installer globs them, so the directory name is load-bearing. */
  assert.ok(fs.existsSync(SKILL));
  assert.match(body, /^---\nname: productos-migrations\n/, "the frontmatter name must match the directory");
  /** Versions stay at 0.1.0 during the design phase — CLAUDE.md. */
  assert.match(body, /^version: 0\.1\.0$/m);
  const description = /description: (.+)/.exec(body)?.[1] ?? "";
  for (const trigger of ["migration conflict", "migrated by newer code", "renumber"]) {
    assert.ok(description.includes(trigger), `nothing would fire this skill on "${trigger}"`);
  }
});

test("it carries the three facts the rest of it depends on", () => {
  assert.match(body, /no down migrations|There are no down migrations/i, "it does not say migrations are forward-only");
  assert.match(body, /statements_sha|hash of the statements/, "it does not say the ledger keys on content");
  assert.match(body, /_journal\.json/, "it does not name the journal as the source of order");
});

test("⛔ never edit an applied migration — with the evidence, not just the rule", () => {
  assert.match(body, /Never edit or delete a migration that has been applied/i);
  /**
   * ⛔ THE DRIVEN OUTPUT IS IN THE SKILL ON PURPOSE. "Don't do this" is ignorable; "here is the run
   * where the column silently did not appear" is not. Verified in this session: the edit is skipped
   * on a store that already applied the tag and applied on a fresh one — one journal, two schemas.
   */
  assert.match(body, /columns present:\s+id/, "the driven proof was removed and only the rule is left");
  assert.match(body, /add a new migration/i, "it says what not to do without saying what to do");
});

test("it says how to resolve a numbering collision, and which side renumbers", () => {
  assert.match(body, /git mv drizzle\//, "there is no concrete renumber step");
  assert.match(body, /"idx"|idx.*→|idx" → /, "it does not mention editing idx — renaming the file alone is not enough");
  /** ⛔ THE DIRECTION IS THE WHOLE DECISION. Renumbering main's side breaks every store that has it. */
  assert.match(body, /Never renumber a migration that is already on main|main's number stands/i,
    "it does not say which side renumbers");
  assert.match(body, /git does not conflict on the two `?\.sql/i,
    "it does not warn that the .sql files merge cleanly — which is why the collision survives a clean merge");
});

test("⛔ it names the conflict nothing detects, and what to do instead of a check", () => {
  /**
   * The gap Peter chose to leave to a session rather than to code: two migrations touching the same
   * object under different numbers. If the skill stops naming it, nothing in this repo does.
   */
  assert.match(body, /nothing detects|nothing reported/i, "the undetected conflict is not named");
  assert.match(body, /already exists/, "it does not say how that failure actually arrives");
  assert.match(body, /git diff --stat origin\/main\.\.\.HEAD -- drizzle\//,
    "it tells somebody to read both sides without giving them the command");
  assert.match(body, /if not exists/, "it does not offer the conditional form as a resolution");
});

test("the ahead-of-the-code refusal is explained before its override", () => {
  assert.match(body, /PRODUCTOS_ALLOW_SCHEMA_AHEAD/);
  /** ⛔ ORDER MATTERS: an override documented first is the one somebody reaches for first. */
  assert.ok(
    body.indexOf("Switch to a branch that has it") < body.indexOf("PRODUCTOS_ALLOW_SCHEMA_AHEAD=1"),
    "the override is offered before the three real answers",
  );
  assert.match(body, /Do not reach for the override first/i);
});

test("it says which stack a checkout may bring up", () => {
  assert.match(body, /make stacks/);
  assert.match(body, /dev serves what is merged/i);
  /** ⛔ The one that writes to somebody else's data, so the one worth pinning. */
  assert.match(body, /Never `?make up-remote/i, "it does not forbid the managed store from a worktree");
  assert.match(body, /DEV_ANYWAY/);
});

test("it says to back up before anything that could lose a corpus", () => {
  assert.match(body, /make backup-remote/);
  assert.match(body, /make backup\b/);
});

test("every command it tells a session to run exists", () => {
  const mk = fs.readFileSync("Makefile", "utf-8");
  /** ⛔ A skill naming a target that does not exist is worse than silence — it reads as checked. */
  for (const t of ["migrations-check", "stacks", "backup-remote", "backup", "restore-remote", "restore", "up", "up-remote"]) {
    assert.match(mk, new RegExp(`^${t}:`, "m"), `the skill names make ${t}, which does not exist`);
  }
  for (const m of body.matchAll(/`make ([a-z-]+)/g)) {
    assert.match(mk, new RegExp(`^${m[1]}:`, "m"), `the skill names make ${m[1]}, which does not exist`);
  }
});
