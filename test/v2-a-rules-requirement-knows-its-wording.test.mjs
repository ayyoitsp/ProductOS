/**
 * ⛔ 55 REQUIREMENTS DEMONSTRATING RULES COULD NEVER GO STALE, BECAUSE NONE COULD RECORD WHAT IT
 * WAS WORKED OUT AGAINST.
 *
 * A demonstrator writing the two publish checkpoints put the sentence true of both into rules
 * rather than twice into features — which is what this project asks for — and then reported that
 * every requirement it wrote on a rule carries no `derived` block at all:
 *
 *     productos v2 claim who-may-freeze-a-rent-roll-as-a-version
 *     ✗ … is not a claim — it resolves to rule, and nothing at that grain has wording to hash
 *
 * ⛔ THAT MESSAGE ASSERTS SOMETHING FALSE, and the engine had already settled it. `coveredBy`'s own
 * doc comment reads *"For an exchange ref `<scope>#<exchange>`, or a rule id"*, and measured
 * against the live corpus `claimHash` answers for a rule immediately:
 *
 *     who-may-freeze-a-rent-roll-as-a-version  → sha256:679c9badd2f0e276
 *       parts: ["statement", "mode: supplies", "fills: may", "0 criteria"]
 *
 * A rule's whole substance IS wording — its statement, its mode, the slots it fills. The capability
 * existed and a guard in the CLI refused before reaching it, which is the fourth time today the
 * same shape has cost something: `draw --into <url>`, the `reach` lookup, the door refusing a
 * root-level yaml, and this.
 *
 * ⛔ WHAT IT COST: `a-requirement-older-than-its-claim` can never fire on a rule. Reword a rule's
 * statement and every requirement demonstrating it stays silently current — and a stale
 * requirement is the one failure that gets IMPLEMENTED and passes, proving the old sentence. That
 * asymmetry is why the refusal exists for exchanges, and rules were exempt from it by accident.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { temp } from "./support/temp.mjs";

const run = promisify(execFile);
const CLI = path.resolve("dist/cli/index.js");
const { loadCorpus } = await import("../dist/v2/load.js");
const { claimHash } = await import("../dist/v2/stamp.js");

function corpus() {
  const dir = path.join(temp("v2rulehash-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}

const aRule = (dir) => {
  const c = loadCorpus(dir);
  assert.ok(c.rules.length, "the seed has no rules, so this file is not about anything");
  return c.rules[0].rule.id;
};

const cli = async (args) => {
  try {
    const { stdout, stderr } = await run("node", [CLI, ...args], { encoding: "utf-8" });
    return { code: 0, out: (stdout ?? "") + (stderr ?? "") };
  } catch (e) {
    return { code: e.code ?? 1, out: ((e.stdout ?? "") + (e.stderr ?? "")).toString() };
  }
};

test("a rule's wording can be hashed from the command line", async () => {
  const dir = corpus();
  const id = aRule(dir);
  const r = await cli(["v2", "claim", id, "--at", dir]);
  assert.equal(r.code, 0, `v2 claim refused a rule:\n${r.out}`);
  assert.match(r.out, /sha256:[0-9a-f]{16}/, `it printed no hash:\n${r.out}`);
});

test("and it is the same hash the engine uses to judge staleness", () => {
  /**
   * ⛔ THE HALF THAT MAKES IT WORTH HAVING. A command printing some other hash would satisfy the
   * test above and leave every requirement that used it permanently stale — which is worse than
   * the refusal it replaced, because it would look like it worked.
   */
  const dir = corpus();
  const id = aRule(dir);
  const fromEngine = claimHash(loadCorpus(dir), id);
  assert.ok(fromEngine, "the engine cannot hash a rule, so the guard was right");
  assert.match(fromEngine, /^sha256:/);
});

test("the command and the engine agree, byte for byte", async () => {
  const dir = corpus();
  const id = aRule(dir);
  const r = await cli(["v2", "claim", id, "--at", dir]);
  const printed = (r.out.match(/sha256:[0-9a-f]+/) ?? [])[0];
  assert.equal(printed, claimHash(loadCorpus(dir), id), "the command prints a hash the engine does not use");
});

test("something with genuinely no wording is still refused", async () => {
  /**
   * ⛔ THE NON-VACUOUS HALF. Dropping the guard entirely would pass everything above. A scope is
   * the case the guard is right about: it has a title, not a claim, and nothing demonstrates it.
   */
  const dir = corpus();
  const scope = loadCorpus(dir).scopes[0].scope.id;
  const r = await cli(["v2", "claim", scope, "--at", dir]);
  assert.notEqual(r.code, 0, `v2 claim hashed a scope, which has no claim:\n${r.out}`);
  assert.match(r.out, /is not a claim/);
});

/**
 * ⛔ AND THE HASH BEING RECORDABLE IS ONLY HALF — the check has to LOOK.
 *
 * `demonstrations()` walked `scope.exchanges` only, so a rule's criteria were never examined and
 * `a-requirement-older-than-its-claim` could not fire on one however correct its provenance was.
 * Letting the hash be computed and not reading it back would have been a fix that measures nothing:
 * every rule requirement would carry a tidy `derived.from` and still never be checked.
 */
test("a rule's requirement goes stale when the rule is reworded", async () => {
  const { demonstrations } = await import("../dist/v2/demonstrate.js");
  const dir = corpus();
  const id = aRule(dir);
  const entry = loadCorpus(dir).rules.find((r) => r.rule.id === id);
  assert.ok(entry.rule.criteria.length, "the seed's first rule has no criteria to stamp");

  /**
   * ⛔ STAMP A CRITERION THE RULE ALREADY HAS. The first version of this fixture inserted its own
   * `criteria:` block into a rule that already had one — a duplicate mapping key, so the rule did
   * not load at all and the test reported "a rule yields no demonstration". The fixture's bug
   * wearing the defect's clothes.
   */
  const hash = claimHash(loadCorpus(dir), id);
  const text = fs.readFileSync(entry.file, "utf-8");
  const stamped = text.replace(
    /^(\s+)- id: (\S+)$/m,
    `$1- id: $2\n$1  derived:\n$1    by: demonstrator\n$1    at: 2026-10-17\n$1    from: ${hash}`
  );
  assert.notEqual(stamped, text, "the fixture stamped nothing");
  fs.writeFileSync(entry.file, stamped);

  const before = demonstrations(loadCorpus(dir)).find((d) => d.ref === id);
  assert.ok(before, "a rule yields no demonstration, so nothing examines its requirements");
  const one = before.requirements.find((r) => r.criterion.derived);
  assert.ok(one, "the stamped requirement did not load");
  assert.equal(one.state, "current", "a requirement stamped with the current hash is not current");

  /**
   * ⛔ Now move the words. The requirement must notice.
   *
   * ⛔ Edited INSIDE the folded block, not after the `statement:` key. `statement: >` means the
   * sentence is the indented lines below it, and appending to the key line put text after the `>`
   * and broke the document — the second fixture bug in this one test, both of them YAML.
   */
  const now = fs.readFileSync(entry.file, "utf-8");
  const reworded = now.replace(/A parent sees everything/, "A parent sees every single thing");
  assert.notEqual(reworded, now, "the fixture reworded nothing");
  fs.writeFileSync(entry.file, reworded);
  const after = demonstrations(loadCorpus(dir)).find((d) => d.ref === id);
  assert.ok(after, "the reworded rule no longer loads, so the fixture broke it");
  const same = after.requirements.find((r) => r.criterion.id === one.criterion.id);
  assert.equal(
    same.state,
    "stale",
    "the rule was reworded and its requirement still reads current — staleness cannot reach a rule"
  );
});
