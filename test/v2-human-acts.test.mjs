/**
 * ⛔ THE FOUR WAYS AN ACT OF HUMAN JUDGEMENT COULD BE MADE FALSE, PINNED.
 *
 * Every one of these was found by a reviewer driving the CLI, and every one of them produces
 * a corpus that passes `check` while carrying a person's name on a claim they did not make.
 * Tenet 1 is "a human has validated this"; these are the paths that made the stamp cheap.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { settle } from "../dist/v2/settle.js";
import { Verdict } from "../dist/v2/schema.js";

const CLI = path.resolve("dist/cli/index.js");
const REASON =
  "A reason long enough to carry the argument, which is the whole price of the strongest act in the schema.";

function seed() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2acts-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}

/** Runs the CLI and returns { code, out } — these assertions are about REFUSALS. */
function cli(args) {
  try {
    const out = execFileSync("node", [CLI, "v2", ...args], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/**
 * ⛔ `corpus.broken` was read by `check` and by nothing else, so one unparseable file — the
 * commonest hand-edit there is — let a person's "I read this and could build from it" be
 * recorded over a corpus missing part of itself.
 */
test("no act is recorded over a corpus that did not load", () => {
  const dir = seed();
  fs.appendFileSync(path.join(dir, "truth", "tasks.md"), "\n\tbad:\t[oops, unquoted\n");
  for (const args of [
    ["accept", "tasks#complete-a-task", "--by", "peter"],
    ["read", "family-wallet", "--by", "peter", "--buildable", "yes"],
    ["rule", "tasks#complete-a-task#at_once", "--says", "Whoever presses first claims it.", "--because", REASON, "--by", "peter"],
    ["waive", "tasks#complete-a-task#at_once", "--because", REASON, "--by", "peter"],
    ["defer", "tasks#complete-a-task#at_once", "--because", REASON, "--until", "a second family runs the trial", "--by", "peter"],
    // A packet is what a builder is handed, so it is refused on the same grounds.
    ["packet", "tasks"],
  ]) {
    const r = cli([...args, "--at", dir]);
    assert.equal(r.code, 1, `${args[0]} ran over a broken corpus`);
    assert.match(r.out, /would not load/, `${args[0]} did not say what was broken`);
  }
  // Nothing was written by any of them.
  assert.equal(fs.existsSync(path.join(dir, "verdicts", "rulings.yaml")), false);
  assert.equal(fs.existsSync(path.join(dir, "verdicts", "reads.yaml")), false);
});

/**
 * ⛔ "I could build from this" and "we have not decided this" cannot both be true. The guard
 * filtered parked questions out, so deferring one and then stamping the scope was legal —
 * while `packet` for that same scope printed the deferral as an open hole.
 */
test("a parked question blocks buildable yes, and waiving it unblocks", () => {
  const dir = seed();
  const parked = cli([
    "defer", "tasks#complete-a-task#at_once",
    "--because", REASON, "--until", "a second family runs the trial on one device",
    "--by", "peter", "--at", dir,
  ]);
  assert.equal(parked.code, 0, parked.out);

  const claimed = cli(["read", "tasks", "--by", "peter", "--buildable", "yes", "--at", dir]);
  assert.equal(claimed.code, 1, "stamped buildable over a parked question");
  assert.match(claimed.out, /parked question/);
  // The honest exits are offered, and `waive` is one of them — deferring is not an answer,
  // granting latitude deliberately is.
  assert.match(claimed.out, /v2 waive tasks#complete-a-task#at_once/);
  assert.match(claimed.out, /--buildable no/);
  assert.equal(fs.existsSync(path.join(dir, "verdicts", "reads.yaml")), false);

  // Saying you could NOT build from it is always recordable — that is the signal nothing computes.
  const honest = cli(["read", "tasks", "--by", "peter", "--buildable", "no", "--at", dir]);
  assert.equal(honest.code, 0, honest.out);
});

/**
 * ⛔ `--pick` prepended the candidate's own `consequence` to `because`, and the Verdict gate
 * parses whatever is in `because`. So the forty-character reasoning floor — the entire price
 * of a ruling — was cleared by a sentence a model wrote, and the log recorded that argument
 * under a person's name.
 */
test("picking an option does not pay the ruler's reasoning floor", () => {
  const dir = seed();
  const cheap = cli([
    "rule", "what-a-kid-sees-of-a-sibling", "--pick", "2", "--because", "yes",
    "--then", "a kid's screen shows another kid's name and no total",
    "--by", "peter", "--at", dir,
  ]);
  assert.equal(cheap.code, 1, "a three-character reason cleared the floor");
  assert.match(cheap.out, /because/);

  const real = cli([
    "rule", "what-a-kid-sees-of-a-sibling", "--pick", "2", "--because", REASON,
    "--then", "a kid's screen shows another kid's name and no total",
    "--by", "peter", "--at", dir,
  ]);
  assert.equal(real.code, 0, real.out);
  const log = fs.readFileSync(path.join(dir, "verdicts", "rulings.yaml"), "utf-8");
  // The ruler's reasoning is theirs alone…
  assert.match(log, /because: "A reason long enough/);
  assert.doesNotMatch(log, /because: "Chose option/);
  // …and the chosen option's argument survives the ruling, attributed to the option.
  assert.match(log, /chose: "option 2"/);
  assert.match(log, /option_said:/);
});

/** The two fields exist on the schema, so the log above is not carrying unvalidated keys. */
test("chose and option_said are Verdict fields, not free-form log text", () => {
  const v = Verdict.safeParse({
    kind: "rule", by: "peter", at: "2026-09-21", via: "cli", settles: "a#b#answer",
    says: "It is recorded like any other.", because: REASON,
    chose: "option 2", option_said: "The argument the drafter made for it.",
  });
  assert.equal(v.success, true, JSON.stringify(v.error?.issues));
});

/**
 * ⛔ `slot.outcomes = about.outcomes` is a wholesale replacement and `outcomes` is inside the
 * act's declared reach, so the write guard waved it through: picking an option on a `refuses`
 * slot deleted every named refusal already agreed there, recorded nothing, and left a corpus
 * that was then acceptable.
 */
test("a refuses ruling cannot silently delete an agreed refusal", () => {
  const dir = seed();
  const before = settle(
    dir, "tasks#complete-a-task#refuses", "irrelevant — outcomes carry the answer",
    "peter", "2026-09-21", REASON,
    { outcomes: [{ name: "rejected-once", when: "a parent already rejected this", told: "the parent has to offer it again" }] }
  );
  assert.equal(before.ok, false, "dropped already-waiting with no refusal");
  assert.match(before.why, /already-waiting/);
  assert.match(before.why, /--refuses no/, "did not name the act that retires a case");

  // Keeping it and adding one is a legitimate ruling.
  const ok = settle(
    dir, "tasks#complete-a-task#refuses", "irrelevant — outcomes carry the answer",
    "peter", "2026-09-21", REASON,
    {
      outcomes: [
        { name: "already-waiting", when: "the same task is already waiting for a parent", told: "it is already waiting, with no second completion recorded" },
        { name: "rejected-once", when: "a parent already rejected this", told: "the parent has to offer it again" },
      ],
    }
  );
  assert.equal(ok.ok, true, ok.why);

  // And `none: true` over agreed cases is the same deletion by another route.
  const dir2 = seed();
  const none = settle(
    dir2, "tasks#complete-a-task#refuses", "irrelevant — nothing is refused",
    "peter", "2026-09-21", REASON, { none: true }
  );
  assert.equal(none.ok, false, "claimed nothing is refused over an agreed refusal");
  assert.match(none.why, /already-waiting/);
});
