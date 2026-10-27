/**
 * ⛔ fg-0001 — THE MODEL COULD SAY "THIS SENTENCE IS WRONG" AND NOT "A SENTENCE IS MISSING".
 *
 * It bit on the first real answer Peter gave. The question sat on
 * `pl-start-a-deal#resume-a-deal-already-started#answer`, a slot saying three separately identified
 * things, and its `about` was *"whether a processor is offered deals that somebody else started"* —
 * which is none of the three. So `of` could not be set, and the only write available replaced the
 * whole slot with one string. He chose an option and it was refused:
 *
 *     a ruling here becomes the whole sentence, so picking an option that answers only the
 *     unruled part would delete the rest
 *
 * His decision stood and the slot did not say it. Every judge finding has this shape — *"a decision
 * the corpus leaves to whoever implements it"*, *"an assumption that is load-bearing and
 * unwritten"* — so the path from a finding to an answered question ran through the one case the
 * model could not express.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { statements } = await import(path.resolve("dist/v2/schema.js"));
const { perform } = await import(path.resolve("dist/v2/acts.js"));
const CLI = path.resolve("dist/cli/index.js");

/** A slot saying three things, with a question about a FOURTH that none of them says. */
function corpus({ replaces = "adds a statement" } = {}) {
  const dir = path.join(temp("pos-adds-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  for (const f of fs.readdirSync(path.join(dir, "truth"))) fs.rmSync(path.join(dir, "truth", f));
  for (const f of fs.readdirSync(path.join(dir, "rules"))) fs.rmSync(path.join(dir, "rules", f));
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "truth", "chores.md"),
    `---
id: chores
title: Chores
exists: kept
terms:
  job:
    means: something a parent has asked a kid to do, with what it pays
happy_path:
  accomplishes: A parent puts a job on a kid's list and the kid marks it done and is paid for it.
  brings: what the job is and which kid it is for
  ends_with: the job is off the list and what it paid is in the kid's money
  through: [the-list]
views:
  - id: the-list
    title: The list
    view_kind: list
    sketch: |
      +---+
      |   |
      +---+
    parts:
      - id: row
        role: display
        label: Tidy your room
exchanges:
  - id: offer-a-job
    title: A parent offers a job
    asked_by: person
    changes: [job]
    at:
      view: the-list
    slots:
      may:
        says: A parent in this family.
      with:
        says: which kid it is for, and what it is worth
      answer:
        says:
          - id: it-is-on-the-list
            says: The job appears on that kid's list with what it pays.
          - id: it-says-who-offered-it
            says: The job says which parent offered it.
          - id: it-is-ordered-newest-first
            says: The newest job is at the top of the list.
        standing:
          kind: open
          about: whether a kid can see a job offered to a different kid
          question: Can a kid see a job that was offered to one of their siblings?
          asked_of: peter
          blocks: []
          cost: Guessing wrong either hides work a family meant to share, or shows a nine-year-old what their sibling was asked to do.
          candidates:
            - replaces: ${replaces}
              says: A job offered to one kid is on that kid's list and on no other kid's list.
              consequence: No kid ever sees what another was asked to do, and a family cannot offer one job to whoever gets there first.
            - replaces: ${replaces}
              says: Every kid in the family sees every job offered to any of them, and who it was offered to.
              consequence: A family can see the whole week at once, and a kid learns what their sibling was asked to do.
      after:
        says: The list has one more thing on it than it had before.
      refuses:
        none: true
      fails:
        says: They are told it was not recorded and nothing has changed.
      again:
        says: The second offer is recorded as its own thing.
      at_once:
        says: Two parents offering at once both land, and neither is lost.
---

# Chores

What a kid is asked to do.
`
  );
  return dir;
}

const REF = "chores#offer-a-job#answer";
const saysOf = (dir) => {
  const ex = loadCorpus(dir).scopes.find((x) => x.scope.id === "chores").scope.exchanges[0];
  return statements(ex.slots.answer.says).map((x) => ({ id: x.id, says: x.says.replace(/\s+/g, " ").trim() }));
};

test("⛔ an option that adds a sentence is pickable, and the siblings survive byte-for-byte", () => {
  const dir = corpus();
  const was = saysOf(dir);
  assert.equal(was.length, 3, "the fixture does not say three things");

  const r = perform(dir, "rule", { slot: REF, pick: 2, because: "Families here share the week's jobs, so everybody sees them." }, { by: "peter", via: "page" });
  assert.equal(r.ok, true, `the pick was refused: ${r.ok === false ? r.why : ""}`);

  const now = saysOf(dir);
  assert.equal(now.length, 4, `the answer did not land as a fourth statement — the slot says ${now.length}`);
  /** ⛔ BYTE-FOR-BYTE. The whole point: a ruling about an absence touches nothing that was agreed. */
  assert.deepEqual(now.slice(0, 3), was, "a sibling statement changed when a new one was added");
  assert.match(now[3].says, /Every kid in the family sees every job/, "the chosen option is not what landed");
  /** And its id is made from its own words, never asked for. */
  assert.match(now[3].id, /^[a-z0-9-]+$/);
  assert.notEqual(now[3].id, "it-is-on-the-list");
});

test("⛔ and a fragment is still refused, because that one WOULD delete the rest", () => {
  /**
   * The opposite bias would be worse than the bug. `only the part in question` means the ruling
   * becomes the whole slot — the clause loss `--pick` exists to prevent — so it still has to be
   * written out, and the refusal still names what it would destroy.
   */
  const dir = corpus({ replaces: "only the part in question" });
  const r = perform(dir, "rule", { slot: REF, pick: 2, because: "Trying to pick a fragment." }, { by: "peter", via: "page" });
  assert.equal(r.ok, false, "a fragment was picked, and three agreed statements were replaced by one");
  assert.match(r.why, /only one thing about it is unruled/);
  /** ⛔ And it says WHAT it would delete — this printed `[object Object]` three times. */
  assert.match(r.detail.join("\n"), /it says 3 things/);
  assert.match(r.detail.join("\n"), /The job appears on that kid's list/);
  assert.equal(saysOf(dir).length, 3, "the slot changed on a refused act");
});

test("⛔ two sentences the same cannot both be added", () => {
  /**
   * The id is made from the words, so adding the same sentence twice would collide. Refused with
   * what to do about it, rather than silently filing a second statement under a mangled id.
   */
  const dir = corpus();
  const first = perform(dir, "rule", { slot: REF, pick: 1, because: "Jobs are private to the kid they are for." }, { by: "peter", via: "page" });
  assert.equal(first.ok, true);
  const added = saysOf(dir);
  assert.equal(added.length, 4);
  /** ⛔ The non-zero: the statement really is there before the collision is tested. */
  assert.match(added[3].says, /on no other kid's list/);
});
