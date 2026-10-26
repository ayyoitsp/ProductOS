/**
 * ⛔ ONE THING LEARNED IS ONE THING WRITTEN, AND IT LANDS AS SUGGESTED.
 *
 * Peter: *"WRITE STRAIGHT INTO THE CORPUS as SUGGSTED. there is no 'HOLD' as a note state."*
 *
 * An agent grooming a piece of work could write back only a whole document or a note to a person.
 * `suggest` adds one sentence and `ask` raises one question, both straight into the truth, and
 * neither can look agreed. These drive both through the door and read the result back through the
 * readers a consumer actually uses — `levelOf`, `readinessOf`, `questionsFor` — because a write that
 * lands and reads as the wrong level is the failure that matters, not the YAML it produced.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";
import { intentNamed, refuseIntent, incomplete } from "../dist/v2/intents.js";
import { loadCorpus } from "../dist/v2/load.js";
import { levelOf } from "../dist/v2/level.js";
import { readinessOf, BUILDABLE } from "../dist/v2/readiness.js";
import { questionsFor } from "../dist/v2/settle.js";
import { stampFor } from "../dist/v2/stamp.js";

const CLI = path.resolve("dist/cli/index.js");

function seed() {
  const dir = path.join(temp("productos-small-writes-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  return dir;
}

/** An agent token, as the hosted server builds one: it may author, and it watched nobody. */
const agent = (dir) => ({ dir, who: { kind: "token", actor: "groomer", scopes: ["read", "author"] }, pressing: "groomer" });

function say(dir, intent, fields, asking = agent(dir)) {
  const i = intentNamed(intent);
  assert.ok(i, `the door does not take "${intent}"`);
  return refuseIntent(i, asking, fields) ?? incomplete(i, fields) ?? i.run(asking, fields);
}

test("a suggested sentence lands in the slot and reads as suggested, by an agent", () => {
  const dir = seed();
  const before = fs.readFileSync(path.join(dir, "truth/money.md"), "utf-8");
  const r = say(dir, "suggest", {
    ref: "money#see-a-balance#answer",
    says: "A kid's money shows the amount owed in red when it is below nothing.",
    from: "ticket WAL-12, the comment from the trial family",
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.notEqual(fs.readFileSync(path.join(dir, "truth/money.md"), "utf-8"), before, "nothing was written");

  const corpus = loadCorpus(dir);
  const ex = corpus.scopes.find((s) => s.scope.id === "money").scope.exchanges.find((e) => e.id === "see-a-balance");
  const says = ex.slots.answer.says;
  assert.ok(Array.isArray(says), "the slot did not become a list of statements");
  assert.equal(says.length, 2, "the sentence that was there was not kept beside the new one");
  assert.equal(says[0].id, "it", "the original sentence lost the id statements() gives it");
  const added = says[1];
  assert.deepEqual(added.wrote, { hand: "agent", as: "groomer", from: "ticket WAL-12, the comment from the trial family" });

  /** ⛔ The reader a consumer uses, not the YAML. */
  const lvl = levelOf(corpus, `money#see-a-balance#answer#${added.id}`);
  assert.ok(!BUILDABLE.includes(lvl.level), `a sentence an agent landed reads ${lvl.level}`);
});

test("a suggestion is unagreed: it holds readiness back until a person agrees to it", () => {
  const dir = seed();
  const r = say(dir, "suggest", {
    ref: "money#record-earning#with",
    says: "A note longer than eighty characters is cut off with an ellipsis.",
    from: "the form component's maxLength",
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  const ready = readinessOf(loadCorpus(dir), "money#record-earning");
  assert.equal(ready.ready, false);
  const mine = ready.unagreed.find((u) => u.ref.startsWith("money#record-earning#with#a-note"));
  assert.ok(mine, `readiness does not list the suggested sentence among what is unagreed: ${ready.unagreed.map((u) => u.ref).join(", ")}`);
  assert.ok(!BUILDABLE.includes(mine.level), `it reads ${mine.level}`);
  assert.notEqual(mine.wrote.is, "unrecorded", "readiness lost who wrote it, so a grooming agent cannot tell it needs a question");
});

test("a suggestion stales an agreement on the slot rather than wearing it", () => {
  const dir = seed();
  /** A person agrees to the slot first, on the page. */
  const pressed = say(dir, "accept", { ref: "money#see-a-balance#with", by: "peter", via: "page" }, {
    dir,
    who: { kind: "browser", actor: "peter", scopes: ["read", "author"] },
    pressing: "peter",
  });
  assert.equal(pressed.ok, true, JSON.stringify(pressed));
  assert.equal(stampFor(loadCorpus(dir), "money#see-a-balance#with").state, "accepted");

  const r = say(dir, "suggest", {
    ref: "money#see-a-balance#with",
    says: "And which month, when the person asks for a month's history.",
    from: "ticket WAL-14",
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.notEqual(
    stampFor(loadCorpus(dir), "money#see-a-balance#with").state,
    "accepted",
    "an agent's sentence was covered by an agreement made before it existed"
  );
});

test("a suggestion is refused where it cannot be honest, and nothing is written", () => {
  const dir = seed();
  const file = path.join(dir, "truth/money.md");
  const before = fs.readFileSync(file, "utf-8");
  const cases = [
    [{ ref: "money#see-a-balance#after", says: "The balance is cached for an hour afterwards.", from: "the cache layer" }, /says nothing happens/],
    [{ ref: "money#see-a-balance#refuses", says: "A kid cannot see a sibling at all, ever.", from: "the access rule" }, /named refusals/],
    [{ ref: "money#see-a-balance", says: "A kid's balance is a number.", from: "the component" }, /not a slot/],
    [{ ref: "money#see-a-balance#answer", says: "A kid's balance is a number.", from: "x" }, /worked out from/],
    [{ ref: "money#nobody#answer", says: "A kid's balance is a number.", from: "the component" }, /no behaviour/],
  ];
  for (const [fields, why] of cases) {
    const r = say(dir, "suggest", fields);
    assert.equal(r.ok, false, `${JSON.stringify(fields)} was accepted`);
    assert.match(r.why, why);
  }
  assert.equal(fs.readFileSync(file, "utf-8"), before, "a refused suggestion still wrote");
});

test("a raised question gates the behaviour and reaches the person it is asked of", () => {
  const dir = seed();
  const r = say(dir, "ask", {
    ref: "money#see-a-balance#at_once",
    question: "When two parents record at once, does each see the other's record before theirs saves?",
    asked_of: "peter",
    blocks: [],
    about: "whether a change one person makes appears for the other before their own save lands",
    candidates: [
      { replaces: "the whole sentence", says: "Each parent sees the other's record appear as soon as it saves, and their own lands after it.", consequence: "Nobody records the same thing twice by accident, at the cost of a list that moves under them." },
      { replaces: "the whole sentence", says: "Each parent sees the other's record only after their own save, with both then shown in order.", consequence: "Nothing moves while somebody is typing, and two parents can record the same thing twice." },
    ],
    cost: "Guessing wrong is either a list that jumps while a parent types, or duplicated pocket money.",
  });
  assert.equal(r.ok, true, JSON.stringify(r));

  const corpus = loadCorpus(dir);
  const q = questionsFor(corpus, "money").find((x) => x.ref === "money#see-a-balance#at_once");
  assert.ok(q, "the question is not in the queue");
  assert.equal(q.candidates.length, 2);
  /** Drafted answers nobody has chosen — the level that model gives an open question with options. */
  const lvl = levelOf(corpus, "money#see-a-balance#at_once");
  assert.equal(lvl.route, "drafted", `the question reads as ${lvl.level}/${lvl.route}`);
  const ready = readinessOf(corpus, "money#see-a-balance");
  assert.equal(ready.ready, false, "a behaviour with a question nobody has answered reads as ready");
  assert.ok(ready.holes.some((h) => JSON.stringify(h).includes("money#see-a-balance#at_once")), "the question is not one of readiness's holes");

  /** ⛔ The sentence that was there survives; a question annotates it, it does not replace it. */
  const ex = corpus.scopes.find((s) => s.scope.id === "money").scope.exchanges.find((e) => e.id === "see-a-balance");
  assert.match(String(ex.slots.at_once.says), /Two people looking at once/);
  assert.equal(ex.slots.at_once.standing.raised_by, "groomer");
});

test("a second question on the same slot is refused, and so is one with no owner", () => {
  const dir = seed();
  const again = say(dir, "ask", {
    ref: "money#record-spending#after",
    question: "Is an overspend shown as owed or as negative?",
    asked_of: "peter",
    blocks: [],
  });
  assert.equal(again.ok, false);
  assert.match(again.why, /already open/);

  const unowned = say(dir, "ask", { ref: "money#see-a-balance#fails", question: "Does a failed load retry on its own?", blocks: [] });
  assert.equal(unowned.ok, false, "a question nobody owes was raised");
});

test("neither small write is available to a token that may not author", () => {
  const dir = seed();
  const reader = { dir, who: { kind: "token", actor: "viewer", scopes: ["read"] }, pressing: "viewer" };
  for (const [intent, fields] of [
    ["suggest", { ref: "money#see-a-balance#answer", says: "A kid's balance is a number.", from: "the component" }],
    ["ask", { ref: "money#see-a-balance#fails", question: "Does a failed load retry on its own?", asked_of: "peter", blocks: [] }],
  ]) {
    const r = say(dir, intent, fields, reader);
    assert.equal(r.ok, false, `${intent} was taken from a read-only token`);
    assert.match(r.why, /may not write/);
  }
});
