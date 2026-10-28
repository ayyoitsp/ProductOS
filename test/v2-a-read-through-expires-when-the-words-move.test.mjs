/**
 * ⛔ `buildable: true` WAS TRUE FOREVER, AND IT WAS THE LAST THING IN THE GATE THAT COULD BE.
 *
 * Peter: *"let's fix read:true indefinitely for sure"*.
 *
 * A read-through is the one signal nothing can compute, and it was the only thing `readinessOf`
 * depends on that recorded no provenance. Both derived layers already carry `derived.from` against
 * exactly this failure — a criterion goes `stale` when its claim is reworded, a capability when what
 * it serves is. The human act carried nothing. So somebody could read a feature end to end, say they
 * could build it, and have that stand after every sentence in it had been rewritten.
 *
 * ⛔ IT IS THE HARDEST OF THE THREE TO NOTICE, which is why it survived while the other two were
 * built with hashes from the start: a stale stamp is byte-identical to a current one. Nothing on any
 * surface differed, so the only way to find it was to ask what the record was tied to and get no
 * answer.
 *
 * ⛔ AND THREE STATES, NOT TWO. "Nobody read this" and "somebody read it and the words moved" route
 * to different acts — get it read, versus show them what changed — and a verdict that collapsed them
 * would send a reviewer back to a first reading of something they have already read.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { temp } from "./support/temp.mjs";
import { answerTheMachineryAxis } from "./support/machinery.mjs";

const { loadCorpus, resolveRules } = await import("../dist/v2/load.js");
const { readinessOf } = await import("../dist/v2/readiness.js");
const { buildableReads, readHashFor, questionsFor } = await import("../dist/v2/settle.js");
const { checkCorpus } = await import("../dist/v2/check.js");
const { perform } = await import("../dist/v2/acts.js");
const { SLOTS } = await import("../dist/v2/schema.js");
const { claimHash } = await import("../dist/v2/stamp.js");
const { readinessOf: packetReadiness } = await import("../dist/v2/packet.js");

const EX = "money#see-a-balance";

/** Everything a traversal can check, so the read-through is the only variable. */
function ready(prefix) {
  const dir = temp(prefix);
  fs.cpSync("v2-seed", dir, { recursive: true });
  const { inherited } = resolveRules(loadCorpus(dir));
  for (const id of new Set(SLOTS.map((x) => inherited.get(`${EX}#${x}`)?.id).filter(Boolean)))
    perform(dir, "accept", { target: id }, { by: "peter", via: "page", because: "yes" });
  for (const slot of SLOTS)
    perform(dir, "accept", { target: `${EX}#${slot}` }, { by: "peter", via: "page", because: "yes" });
  answerTheMachineryAxis(dir, EX);
  return dir;
}

/** The corpus with the one requirement the seed is missing, re-applied after every reload. */
function corpusOf(dir) {
  const c = loadCorpus(dir);
  c.scopes
    .find((s) => s.scope.id === "money")
    .scope.exchanges.find((e) => e.id === "see-a-balance")
    .criteria.push({
      id: "6",
      slot: "at_once",
      kind: "instance",
      then: "both people looking see the same figure",
      derived: { by: "demonstrator", at: "2026-10-17", from: claimHash(c, `${EX}#at_once`) },
    });
  return c;
}

const ok = (r) => {
  assert.ok(!("error" in r), `readiness refused: ${r.error}`);
  return r;
};

/** Reword one sentence of the exchange that was read. */
function reword(dir) {
  const f = `${dir}/truth/money.md`;
  const src = fs.readFileSync(f, "utf-8");
  const out = src.replace(
    "What the kid has now, and everything recorded against them most recent first,",
    "What the kid has now, and the twenty most recent movements against them,"
  );
  assert.notEqual(out, src, "the sentence this test rewords has changed; find the new wording");
  fs.writeFileSync(f, out);
}

/**
 * ⛔ READY, THEN ONE SENTENCE MOVES, THEN NOT READY — the whole feature in one fixture, and the
 * middle state is the one that could not be reached before.
 */
test("a yes stops counting the moment a sentence it covered is reworded", () => {
  const dir = ready("v2read-expires-");
  const said = perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" });
  assert.equal(said.ok, true, said.why);
  /** ⛔ Said out loud on the act, so nobody meets it later as the tool losing their stamp. */
  assert.ok(
    said.detail.some((d) => /reword any of them and this scope needs reading again/.test(d)),
    `the act does not warn that this expires: ${JSON.stringify(said.detail)}`
  );

  const before = ok(readinessOf(corpusOf(dir), EX));
  assert.equal(before.ready, true, before.because);
  assert.equal(before.read.latest.by, "peter");
  assert.equal(before.read.latest.stale, false);
  assert.ok(before.read.latest.of, "the act recorded no hash, so nothing could ever expire");
  assert.deepEqual(before.read.spent, []);

  reword(dir);

  const after = ok(readinessOf(corpusOf(dir), EX));
  assert.equal(after.ready, false, "a yes recorded against words that have since changed still made it ready");
  assert.equal(after.read.spent.length, 1);
  assert.equal(after.read.spent[0].by, "peter");
  assert.equal(after.read.spent[0].stale, true);
  assert.deepEqual(buildableReads(loadCorpus(dir), EX), [], "a stale yes is still counted as a yes");

  /**
   * ⛔ AND IT IS NOT REPORTED AS UNREAD. Somebody did read it; telling them nobody had is false and
   * sends them to a first reading of something they have already read.
   */
  assert.equal(after.read.unread, false);
  assert.doesNotMatch(after.because, /nobody has read this end to end/);
  assert.match(after.because, /the words have moved since/);
  assert.match(after.because, /show them what changed rather than asking again from scratch/);
});

/**
 * ⛔ THE HASH COVERS SENTENCES, NOT SLOTS. A slot saying nine things is nine of them, and hashing
 * the slot would let eight be rewritten under a stamp — the same grain mistake `of` exists to stop
 * in the criteria layer, which the v1 migration made and had to undo.
 */
test("rewording a sibling exchange does not expire a reading of this one", () => {
  const dir = ready("v2read-grain-");
  perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" });
  const was = readHashFor(loadCorpus(dir), EX);

  const f = `${dir}/truth/money.md`;
  const src = fs.readFileSync(f, "utf-8");
  const out = src.replace("The kid has that much more than they had before.", "The kid is credited with that much.");
  assert.notEqual(out, src, "the sibling sentence this test rewords has changed; find the new wording");
  fs.writeFileSync(f, out);

  assert.equal(readHashFor(loadCorpus(dir), EX), was, "a sibling behaviour's reword changed this one's hash");
  const r = ok(readinessOf(corpusOf(dir), EX));
  assert.equal(r.ready, true, r.because);
  assert.deepEqual(r.read.spent, []);
});

/**
 * ⛔ A READING WRITTEN BEFORE THIS FIELD EXISTED IS NOT STALE — it is unprovenanced, which is a
 * different fact and a different instruction. Calling it stale would tell somebody their words had
 * moved when nothing says they had.
 */
test("a reading with no hash does not count, is not called stale, and is not refused", () => {
  const dir = ready("v2read-legacy-");
  perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" });

  const f = `${dir}/verdicts/reads.yaml`;
  const src = fs.readFileSync(f, "utf-8");
  const out = src.replace(/\n\s*covers_read: \S+/, "");
  assert.notEqual(out, src, "the act stopped writing covers_read, so this test covers nothing");
  fs.writeFileSync(f, out);

  const c = corpusOf(dir);
  assert.deepEqual(c.broken, [], JSON.stringify(c.broken));
  const r = ok(readinessOf(c, EX));

  assert.equal(r.ready, false, "a yes tied to no particular words cleared the gate");
  assert.equal(r.read.spent.length, 1);
  assert.equal(r.read.spent[0].stale, false, "⛔ unprovenanced is not stale — nothing says the words moved");
  assert.equal(r.read.spent[0].of, undefined);
  assert.equal(r.read.unread, false);
  assert.match(r.because, /nothing recorded which words they read/);

  const found = checkCorpus(dir).findings.filter((x) => x.kind.startsWith("read-through-"));
  assert.equal(found.length, 1, `expected one, got ${JSON.stringify(found.map((x) => x.kind))}`);
  assert.equal(found[0].kind, "read-through-against-nothing-recorded");
  /** ⛔ A note: a refusal would fire on every corpus carrying an older reading at once. */
  assert.equal(found[0].severity, "note");
});

test("check names a stale reading, as a note, and tells somebody to show them the diff", () => {
  const dir = ready("v2read-check-");
  perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" });
  assert.deepEqual(
    checkCorpus(dir).findings.filter((x) => x.kind.startsWith("read-through-")),
    [],
    "a current reading was reported as a problem"
  );

  reword(dir);
  const found = checkCorpus(dir).findings.filter((x) => x.kind.startsWith("read-through-"));
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, "read-through-older-than-what-it-read");
  assert.equal(found[0].severity, "note");
  assert.match(found[0].what, /read this end to end on \d{4}-\d{2}-\d{2} and could build from it/);
  assert.match(found[0].fix, /not from scratch/);
});

/**
 * ⛔ A NO DOES NOT EXPIRE, and that asymmetry is deliberate. "I could build this" is a claim about
 * particular words, so it dies with them. "I could not build this" named something that stopped
 * somebody — and a reword is not evidence they were wrong, it is the thing that might fix it. The
 * act that retracts a no is another reading, by a person.
 */
test("a recorded no survives a reword, because withdrawing it is somebody's act", () => {
  const dir = ready("v2read-no-");
  perform(
    dir,
    "read",
    { scope: EX, buildable: false, blockedBy: [`${EX}#after`], note: "no owner for the figure" },
    { by: "peter", via: "page" }
  );
  const before = ok(readinessOf(corpusOf(dir), EX));
  assert.equal(before.read.stopped.length, 1);

  reword(dir);
  const after = ok(readinessOf(corpusOf(dir), EX));
  assert.equal(after.read.stopped.length, 1, "a reword silently cleared somebody's refusal to build");
  assert.equal(after.ready, false);
  assert.match(after.because, /could NOT build from it/);
  /** ⛔ And it is not also reported as spent — a no was never a yes that expired. */
  assert.deepEqual(after.read.spent, []);
});

/** ⛔ Re-reading it clears it, which is the whole loop and the thing a reader needs to be able to do. */
test("reading it again after the reword makes it ready, with nothing else touched", () => {
  const dir = ready("v2read-again-");
  perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" });
  reword(dir);
  assert.equal(ok(readinessOf(corpusOf(dir), EX)).ready, false);

  /** ⛔ Acceptance went stale with the reword too, so agreeing again is part of the honest loop. */
  for (const slot of SLOTS)
    perform(dir, "accept", { target: `${EX}#${slot}` }, { by: "peter", via: "page", because: "still yes" });
  answerTheMachineryAxis(dir, EX);
  const again = perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" });
  assert.equal(again.ok, true, again.why);

  const r = ok(readinessOf(corpusOf(dir), EX));
  assert.equal(r.ready, true, r.because);
  assert.deepEqual(r.read.spent, [], "the superseded reading is still counted against it");
  assert.equal(r.read.latest.stale, false);
});

/**
 * A `money` with nothing undecided anywhere in it — ⛔ WHAT THE PACKET'S OWN VERDICT NEEDS.
 *
 * `packet.readinessOf` is scope-grained, and `money` holds three behaviours besides the one these
 * tests settle. Without ruling those, its hole list is never empty and `ready: false` is decided by
 * something other than the reading — a test that passes for the wrong reason, which is worse than
 * one that renders nothing.
 *
 * ⛔ The rulings are real sentences, not placeholders, because `rule` refuses the alternatives and
 * is right to: `what-a-kid-sees-of-a-sibling` needs what would show it holding, and
 * `record-spending#after` already said something, so a ruling that dropped it is refused with the
 * sentence it would have lost printed back. Both refusals are the fixture being told what the model
 * requires, and both were hit before this was written.
 */
const RULINGS = {
  "what-a-kid-sees-of-a-sibling": {
    says: "A kid sees only what is theirs, and never another kid's figure or movements.",
    then: "a kid opening the app sees their own figure and no sibling's",
  },
  "money#record-spending#after": {
    says:
      "The kid has that much less than they had before. An amount larger than what the kid has is " +
      "refused rather than taking them below nothing.",
  },
  "money#record-spending#again": {
    says: "Recording the same spending twice records it twice; nothing is merged.",
  },
};

function nothingUndecided(dir) {
  for (const q of questionsFor(loadCorpus(dir), "money")) {
    const r = RULINGS[q.ref];
    assert.ok(r, `the seed asks something this fixture has no ruling for: ${q.ref}`);
    const out = perform(
      dir,
      "rule",
      { slot: q.ref, ...r, because: "a fixture needs this scope to have nothing undecided in it" },
      { by: "peter", via: "page" }
    );
    assert.equal(out.ok, true, `${q.ref}: ${out.why}`);
  }
  assert.deepEqual(questionsFor(loadCorpus(dir), "money"), [], "the fixture left questions open");
  return dir;
}

/**
 * ⛔ THE PAGE PRINTED "READY TO BUILD: YES" OVER A READING WHOSE SENTENCES HAD ALL BEEN REWRITTEN.
 *
 * `page.ts` imports `readinessOf` from `packet.ts` — deliberately, so the page and the packet cannot
 * differ — and that function had learned to respect a recorded NO and not that a yes expires. So the
 * laundering `covers_read` closed survived on the one surface Peter reviews on, which is the second
 * time these two verdicts have drifted by exactly one clause.
 */
test("the verdict the page renders requires a reading that still stands", () => {
  const dir = nothingUndecided(ready("v2read-packet-"));

  /** ⛔ No holes and still not ready, which used to render as "0 things here are undecided". */
  const unread = packetReadiness(loadCorpus(dir), "money");
  assert.deepEqual(unread.holes, [], "the fixture leaves holes, so nothing below tests the reading");
  assert.equal(unread.ready, false, "a scope nobody has read reported as ready to build");
  assert.equal(unread.read, false);

  assert.equal(perform(dir, "read", { scope: "money", buildable: true }, { by: "peter", via: "page" }).ok, true);
  const before = packetReadiness(loadCorpus(dir), "money");
  assert.equal(before.ready, true, "a current reading did not satisfy the verdict the page renders");
  assert.equal(before.read, true);

  reword(dir);

  const after = packetReadiness(loadCorpus(dir), "money");
  assert.deepEqual(after.holes, [], "the reword opened a hole, so this is not testing the reading");
  assert.equal(after.ready, false, "⛔ the page would print Ready to build: yes over a reading that no longer counts");
  /**
   * ⛔ AND IT CAN STILL TELL A READER WHICH OF THE TWO NO-HOLE STATES THIS IS. Both are
   * `ready: false, holes: []`, and they route to different people — get it read, versus show the
   * reader what moved. A boolean alone would send both to the first.
   */
  assert.equal(after.read, true, "a scope somebody read and whose words moved reported as never read");
});
