/**
 * ⛔ A CAPABILITY COULD NOT BE VALIDATED BY A HUMAN AT ALL, AND NOTHING REQUIRED THAT IT HAD BEEN.
 *
 * Peter: *"the dependency is a capability dependency, and those should be validated"*, then — after
 * stopping the wrong design — *"we don't need to check the balance moved, we need to ensure the
 * capability of 'ledger' and 'increment balance' has been validated by a human, but not more than
 * that"*.
 *
 * ⛔ THE SECOND SENTENCE IS THE DESIGN, AND WHAT IT RULED OUT WAS ALREADY BEING BUILT. The obvious
 * reading of a dependency between features is a cross-feature test: complete a task, then check the
 * balance moved. That is a thing to BUILD and belongs to whoever builds it. What a corpus owes is
 * narrower and is the part nothing else can supply — the machinery this promise leans on is
 * machinery a person has read and put their name to. So no criterion is derived from an edge and
 * nothing here asserts anything about runtime.
 *
 * ⛔ THERE WAS NO ROUTE TO IT. `aimOf` listed what an acceptance may cover and a capability was not
 * on the list, so the refusal fired before `coveredBy` was ever consulted; and `capabilityLevel`
 * returned `unaccepted` on all three of its branches, which distinguish how well a ROLE worked the
 * part out. A human reading every capability in a corpus could not change one level. The
 * decomposer's own instructions said so: *"Capabilities become agreeable by engineers later; nothing
 * agrees to one today."*
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { temp } from "./support/temp.mjs";
import { answerTheMachineryAxis } from "./support/machinery.mjs";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { loadCorpus } = await import("../dist/v2/load.js");
const { readinessOf } = await import("../dist/v2/readiness.js");
const { answeringParts } = await import("../dist/v2/demonstrate.js");
const { levelOf } = await import("../dist/v2/level.js");
const { perform } = await import("../dist/v2/acts.js");
const { resolveRules } = await import("../dist/v2/load.js");
const { SLOTS } = await import("../dist/v2/schema.js");
const { claimHash } = await import("../dist/v2/stamp.js");
const { renderScopePage, standalone } = await import("../dist/v2/page.js");
const { derivedCapabilities, servesHash } = await import("../dist/v2/demonstrate.js");
const { BUILDABLE } = await import("../dist/v2/readiness.js");

const LEDGER = "ledger#offers#increment-balance";
const CLOCK = "clock#offers#now";

/**
 * A corpus whose promises are answered by a ledger, with a clock UNDERNEATH it.
 *
 * ⛔ The clock is reached only by following the ledger's `serves`, which is how this model already
 * reasons about a part's dependencies — the clock serves the ledger serves the money, and
 * `a-capability-serves-only-other-machinery` walks exactly that chain. Stopping at the first hop
 * would validate the part somebody looked at and nothing beneath it.
 */
function withParts(prefix, { ledgerServes = ["money#see-a-balance#answer", "money#record-earning#after", CLOCK] } = {}) {
  const dir = temp(prefix);
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(`${dir}/capabilities`, { recursive: true });
  fs.writeFileSync(
    `${dir}/capabilities/ledger.md`,
    [
      "---",
      "id: ledger",
      "title: The ledger",
      "does: Holds every movement of a kid's money as an append-only record, and answers what a kid has now.",
      "offers:",
      "  - id: increment-balance",
      "    does: Appends one movement against one kid and returns what the kid has afterwards.",
      "    serves:",
      ...ledgerServes.map((r) => `      - ${r}`),
      "---",
      "",
      "# The ledger",
      "",
    ].join("\n")
  );
  fs.writeFileSync(
    `${dir}/capabilities/clock.md`,
    [
      "---",
      "id: clock",
      "title: The clock",
      "does: Answers what day it is, as one place, so every movement is stamped the same way.",
      "offers:",
      "  - id: now",
      "    does: Answers the current day, in the family's own timezone.",
      "    serves:",
      "      - money#see-a-balance#answer",
      "---",
      "",
      "# The clock",
      "",
    ].join("\n")
  );
  assert.deepEqual(loadCorpus(dir).broken, [], "the fixture wrote a corpus the loader refused");
  return dir;
}

const unvalidatedAt = (dir, ref) => {
  const r = readinessOf(loadCorpus(dir), ref);
  assert.ok(!("error" in r), `readiness refused: ${r.error}`);
  return r.unvalidated.map((p) => p.ref).sort();
};

const agree = (dir, ref) =>
  perform(dir, "accept", { target: ref }, { by: "peter", via: "page", because: "the part is right as it reads" });

/**
 * ⛔ FOUR OUTCOMES OUT OF ONE FIXTURE, because for a corpus with no capabilities the list is empty
 * and so is the list a build shipping none of this would produce.
 */
test("a part with nobody's name on it holds the build, and one human act per part clears it", () => {
  const dir = withParts("v2parts-validate-");

  assert.deepEqual(unvalidatedAt(dir, "money#see-a-balance"), [CLOCK, LEDGER]);

  const first = agree(dir, LEDGER);
  assert.equal(first.ok, true, first.why);
  assert.deepEqual(unvalidatedAt(dir, "money#see-a-balance"), [CLOCK], "agreeing to the ledger cleared the clock too");

  const second = agree(dir, CLOCK);
  assert.equal(second.ok, true, second.why);
  assert.deepEqual(unvalidatedAt(dir, "money#see-a-balance"), []);

  /** ⛔ And the level a human's stamp produces, which all three branches used to refuse. */
  const lv = levelOf(loadCorpus(dir), LEDGER);
  assert.equal(lv.level, "accepted");
  assert.equal(lv.route, "accepted-here");
  assert.match(lv.because, /peter agreed to this part as it reads/);
});

/**
 * ⛔ A STAMP ON A PART DIES WHEN THE PART MOVES, which is what makes it worth having. `coveredBy`
 * carries two hashes for a capability — its own words, and the set of promises it answers — and an
 * acceptance against something nothing hashes could never go stale, which is worse than no stamp.
 */
test("rewording a part drops its validation, and says which half moved", () => {
  const dir = withParts("v2parts-stale-");
  agree(dir, LEDGER);
  agree(dir, CLOCK);
  assert.deepEqual(unvalidatedAt(dir, "money#see-a-balance"), []);

  const f = `${dir}/capabilities/clock.md`;
  const src = fs.readFileSync(f, "utf-8");
  const out = src.replace("in the family's own timezone", "in UTC");
  assert.notEqual(out, src, "the sentence this test rewords has changed; find the new wording");
  fs.writeFileSync(f, out);

  assert.deepEqual(unvalidatedAt(dir, "money#see-a-balance"), [CLOCK]);
  const lv = levelOf(loadCorpus(dir), CLOCK);
  assert.equal(lv.route, "stale-acceptance");
  assert.match(lv.because, /what it does has been reworded since/);

  /** ⛔ Stale is said apart from never, because they are different conversations. */
  const r = readinessOf(loadCorpus(dir), "money#see-a-balance");
  assert.equal(r.unvalidated[0].stale, true);
  assert.equal(r.unvalidated[0].by, "peter");
  assert.match(r.because, /agreed and .*changed since/);
  assert.match(r.because, /show them what moved/);
  assert.doesNotMatch(r.because, /nobody's name on/);
});

/**
 * ⛔ REWORDING A SUBSYSTEM'S OWN DESCRIPTION DOES NOT DROP ITS CAPABILITIES' STAMPS, and the line
 * between the two is what `reads` shows. A person agreeing is shown the subsystem's NAME and the
 * capability's sentence, so both are hashed; the subsystem's `does` is neither shown nor hashed,
 * because rewording it would otherwise invalidate every part beneath it at once.
 */
test("a stamp covers what the person was shown, and nothing wider", () => {
  const dir = withParts("v2parts-grain-");
  agree(dir, LEDGER);
  agree(dir, CLOCK);

  const f = `${dir}/capabilities/ledger.md`;
  const src = fs.readFileSync(f, "utf-8");
  const out = src.replace("append-only record", "ordered log");
  assert.notEqual(out, src, "the subsystem sentence this test rewords has changed");
  fs.writeFileSync(f, out);

  assert.deepEqual(unvalidatedAt(dir, "money#see-a-balance"), [], "a subsystem's own prose dropped its parts' stamps");

  /** ⛔ But its NAME is shown to whoever agrees, so that does move it. */
  const renamed = fs.readFileSync(f, "utf-8").replace("title: The ledger", "title: The movement log");
  fs.writeFileSync(f, renamed);
  assert.deepEqual(unvalidatedAt(dir, "money#see-a-balance"), [LEDGER], "the part was renamed under somebody's stamp");
});

/**
 * ⛔ A PART SHARED BY TWO BEHAVIOURS IS REPORTED FOR BOTH, and it was not. `answeringParts` kept one
 * `seen` set across the whole walk, so a shared part was attributed to whichever behaviour reached
 * it first and `readinessOf` — which filters on that attribution — reported no parts at all for the
 * second. Driven before this was written: a ledger serving both behaviours with an unvalidated clock
 * beneath it came back clean for `record-earning` while blocking `see-a-balance`.
 *
 * ⛔ A gate that answers differently depending on which sibling was walked first is worse than one
 * that does not exist, because it looks like evidence.
 */
test("a part two behaviours lean on holds both of them", () => {
  const dir = withParts("v2parts-shared-");

  const raw = answeringParts(loadCorpus(dir), ["money"]);
  const forEach = new Map();
  for (const p of raw) forEach.set(`${p.answers} ${p.ref}`, p);
  assert.ok(forEach.has(`money#see-a-balance ${LEDGER}`));
  assert.ok(forEach.has(`money#record-earning ${LEDGER}`), "a shared part is attributed to one behaviour only");

  assert.deepEqual(unvalidatedAt(dir, "money#see-a-balance"), [CLOCK, LEDGER]);
  assert.deepEqual(unvalidatedAt(dir, "money#record-earning"), [CLOCK, LEDGER]);

  agree(dir, LEDGER);
  assert.deepEqual(unvalidatedAt(dir, "money#record-earning"), [CLOCK], "the clock beneath the ledger was not reached");
});

/**
 * ⛔ AND A CORPUS WITH NO CAPABILITY LAYER IS NOT HELD BY THIS. It is held by `unserved`, which is
 * the finding that says the parts have not been worked out. Two gates firing on one absence would
 * mean a corpus that has not begun decomposing gets told twice and can clear neither.
 */
test("a corpus with no parts at all is not held by this gate", () => {
  const dir = temp("v2parts-none-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const r = readinessOf(loadCorpus(dir), "money#see-a-balance");
  assert.ok(!("error" in r));
  assert.deepEqual(r.unvalidated, []);
  assert.deepEqual(answeringParts(loadCorpus(dir), ["money"]), []);
  /** ⛔ And `unserved` is the one holding it, which is the right owner for "nobody has decomposed". */
  assert.ok(r.unserved.length, "nothing reports that the parts have not been worked out");
});

const EX = "money#see-a-balance";

/**
 * Everything else a traversal can check, so the unvalidated part is the only thing left.
 *
 * ⛔ WITHOUT THIS THE GATE IS UNPINNED, and the first version of this file was: every case asserted
 * the `unvalidated` LIST and none asserted `ready`, so removing the gate from `readinessOf`
 * entirely left all five green. A list nothing turns on is a report, and the whole point here is
 * that it holds a build.
 *
 * ⛔ The read-through comes LAST, because it hashes every sentence it covered — recorded before the
 * acceptances and it would be stale the moment they landed.
 */
function settledExcept(dir) {
  const { inherited } = resolveRules(loadCorpus(dir));
  for (const id of new Set(SLOTS.map((x) => inherited.get(`${EX}#${x}`)?.id).filter(Boolean)))
    perform(dir, "accept", { target: id }, { by: "peter", via: "page", because: "yes" });
  for (const slot of SLOTS)
    perform(dir, "accept", { target: `${EX}#${slot}` }, { by: "peter", via: "page", because: "yes" });
  answerTheMachineryAxis(dir, EX);
  perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" });
  return dir;
}

/** The corpus with the one requirement the seed is missing, re-applied after every reload. */
function corpusOf(dir) {
  const c = loadCorpus(dir);
  c.scopes
    .find((x) => x.scope.id === "money")
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

/**
 * ⛔ IT HOLDS THE BUILD, which is the assertion the rest of this file was missing.
 *
 * Peter: *"those should be validated"*. Everything else about this behaviour is agreed, demonstrated
 * and read end to end — and it is not ready, because the ledger it leans on has nobody's name on it.
 * One human act per part is the whole remedy, and nothing more is asked.
 */
test("it gates: everything else settled, and an unvalidated part still holds it", () => {
  const dir = settledExcept(withParts("v2parts-gates-"));

  const blocked = readinessOf(corpusOf(dir), EX);
  assert.ok(!("error" in blocked), blocked.error);
  assert.equal(blocked.ready, false, "a promise answered by machinery nobody has read came back ready to build");
  /** ⛔ And it is the parts holding it, not something else this fixture left undone. */
  assert.deepEqual(blocked.holes, []);
  assert.deepEqual(blocked.unagreed, []);
  assert.deepEqual(blocked.untested, []);
  assert.deepEqual(blocked.unserved, []);
  assert.deepEqual(blocked.read.spent, []);
  assert.equal(blocked.read.unread, false);
  assert.deepEqual(
    blocked.unvalidated.map((p) => p.ref).sort(),
    [CLOCK, LEDGER]
  );
  assert.match(blocked.because, /nobody's name on/);

  agree(dir, LEDGER);
  assert.equal(readinessOf(corpusOf(dir), EX).ready, false, "one of two parts validated read as ready");

  agree(dir, CLOCK);
  const ready = readinessOf(corpusOf(dir), EX);
  assert.equal(ready.ready, true, ready.because);
  assert.deepEqual(ready.unvalidated, []);
  assert.match(ready.because, /^Ready to build/);
});

/** ⛔ And a part going stale under a ready feature takes it back out — the gate works both ways. */
test("rewording a validated part makes a ready feature unready again", () => {
  const dir = settledExcept(withParts("v2parts-gates-back-"));
  agree(dir, LEDGER);
  agree(dir, CLOCK);
  assert.equal(readinessOf(corpusOf(dir), EX).ready, true);

  const f = `${dir}/capabilities/ledger.md`;
  const src = fs.readFileSync(f, "utf-8");
  const out = src.replace("Appends one movement against one kid", "Appends a movement");
  assert.notEqual(out, src, "the capability sentence this test rewords has changed");
  fs.writeFileSync(f, out);

  const after = readinessOf(corpusOf(dir), EX);
  assert.equal(after.ready, false, "a part reworded out from under somebody's stamp left the feature ready");
  assert.deepEqual(
    after.unvalidated.map((p) => p.ref),
    [LEDGER]
  );
  assert.equal(after.unvalidated[0].stale, true);
});

/**
 * ⛔ THE SAME SCALE AS A FEATURE'S CLAIM, AND ONE RUNG OF IT WAS BEING DROPPED.
 *
 * Peter: *"we need the same validation concepts for capabilities as for features, right? varying
 * degrees of 'accepted'"*. The scale already reached this layer — `written`, `stale-derivation`,
 * `worked-out`, and now `accepted-here` and `stale-acceptance`. What it did not carry is the
 * distinction between working a part out from AGREED truth and from a draft, and that is the one a
 * gate turns on: `corroborated` is inside `BUILDABLE`, so a part answering promises nobody had
 * agreed to was handed to a builder as established.
 *
 * ⛔ Verbatim the failure `v2-how-established-is-this` pins one layer across — *"a test for a draft
 * passed the gate a builder applies"* — and `derivedCapabilities.agreed` had computed the same fact
 * here all along, documented "reported, never required", with nothing reading it.
 */
test("a part worked out from a draft sits below the line; from agreed truth, above it", () => {
  const dir = withParts("v2parts-rung-", { ledgerServes: ["money#see-a-balance#answer"] });

  /** The decomposer's own provenance, hashed against what it serves — the `serves` SET, not a ref. */
  const f = `${dir}/capabilities/ledger.md`;
  const from = servesHash(loadCorpus(dir), ["money#see-a-balance#answer"]);
  const src = fs.readFileSync(f, "utf-8");
  const out = src.replace(
    "      - money#see-a-balance#answer\n",
    "      - money#see-a-balance#answer\n" +
      "    derived:\n" +
      "      by: decomposer\n" +
      "      at: 2026-10-28\n" +
      `      from: ${from}\n`
  );
  assert.notEqual(out, src, "the fixture's serves line has moved");
  fs.writeFileSync(f, out);
  assert.deepEqual(loadCorpus(dir).broken, [], JSON.stringify(loadCorpus(dir).broken));

  const draft = derivedCapabilities(loadCorpus(dir)).find((x) => x.ref === LEDGER);
  assert.equal(draft.state, "current", "the fixture's hash is wrong, so this measures staleness instead");
  assert.equal(draft.agreed, false);

  const below = levelOf(loadCorpus(dir), LEDGER);
  assert.equal(below.route, "worked-out-from-a-draft");
  assert.ok(!BUILDABLE.includes(below.level), `a part answering a draft reads ${below.level}, which a builder applies`);
  assert.match(below.because, /nobody has agreed to it, so this part answers a draft/);

  /** ⛔ Nothing about the part changes — only whether anybody agreed to what it answers. */
  perform(dir, "accept", { target: "money#see-a-balance#answer" }, { by: "peter", via: "page", because: "yes" });
  const above = levelOf(loadCorpus(dir), LEDGER);
  assert.equal(above.route, "worked-out");
  assert.ok(BUILDABLE.includes(above.level));
  assert.match(above.because, /has not changed since and is agreed/);

  /** ⛔ And a person agreeing to the PART itself outranks either, which is the top of the scale. */
  agree(dir, LEDGER);
  assert.equal(levelOf(loadCorpus(dir), LEDGER).route, "accepted-here");
});

const { exe, skip } = browserOrSkip();

/**
 * ⛔ THE GATE REFUSES ON THIS, SO THE PAGE HAS TO SAY WHICH PARTS ARE WAITING.
 *
 * Peter: *"uh, capabilities have no validation????"* — and the surface he reviews on showed none
 * either. A gate that holds a build for a reason the page does not render is a gate that reads as
 * the tool being broken.
 *
 * ⛔ Computed style, because the words were never the question: `renderState` has always produced
 * this markup for an exchange, so a markup assertion would pass on a build that never called it
 * for a capability.
 */
test("the page says whether a person has put their name to each part", { skip }, async () => {
  const dir = withParts("v2parts-page-");
  const stateOf = async (where) => {
    const page = await openPage(
      standalone("parts", renderScopePage(loadCorpus(where), "family-wallet", { interactive: false })),
      { exe }
    );
    try {
      return await page.evaluate(`(() => {
        const li = [...document.querySelectorAll(".contract")].find((x) => x.dataset.ref === "${LEDGER}");
        if (!li) return null;
        const st = li.querySelector(".beh-state");
        if (!st) return { state: null };
        return { state: st.textContent.replace(/\\s+/g, " ").trim(), cls: st.className, shown: getComputedStyle(st).display !== "none" };
      })()`);
    } finally {
      await page.close();
    }
  };

  const before = await stateOf(dir);
  assert.ok(before, `the page has no row for ${LEDGER}`);
  assert.ok(before.state, "⛔ the page shows nothing about whether this part has been validated");
  assert.ok(before.shown, "it is in the markup and not displayed — the defect a markup assertion would miss");
  assert.match(before.state, /not confirmed/);
  assert.match(before.state, /nobody has agreed to this yet/);

  agree(dir, LEDGER);
  const after = await stateOf(dir);
  assert.match(after.cls, /ok/);
  assert.match(after.state, /confirmed/);
  assert.match(after.state, /by peter/);

  /** ⛔ And a reworded part reads as not confirmed again, for free, through the same two hashes. */
  const f = `${dir}/capabilities/ledger.md`;
  fs.writeFileSync(f, fs.readFileSync(f, "utf-8").replace("Appends one movement against one kid", "Appends a movement"));
  const moved = await stateOf(dir);
  assert.match(moved.cls, /warn/);
  assert.match(moved.state, /not confirmed/);
  assert.match(moved.state, /agreed on .*but/);
});
