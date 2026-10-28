/**
 * ⛔ `ready` MEANS A BUILDER CAN START, AND FOR MONTHS IT MEANT THE RECORD WAS TIDY.
 *
 * Peter: *"buildability should be a part of readiness, should not introduce a new 'groomed'
 * concept. don't know what we would use 'ready' for outside of buildability."*
 *
 * `readinessOf` was four emptiness checks — no open question, no unagreed claim, no requirement
 * below the gate, no claim without a test. Every one of them can hold over a corpus where two
 * screens claim the same piece of state and nothing says where the data comes from: each of those
 * is a filled slot, and the arithmetic counts a filled slot as settled. That is the second tenet,
 * and no traversal reaches it.
 *
 * The signal that does already existed. `Verdict kind: read` has carried `buildable` and
 * `blocked_by` since the act shipped — *"the one signal nothing can compute"* — and `compilePacket`
 * bannered it, `check` refused on it, the page rendered it, and **the field a consumer asks before
 * it starts work consulted it nowhere**. Even the packet's own `readinessOf`, the one the page
 * renders, answered `ready: true` above a banner saying a human could not build from it.
 *
 * ⛔ WHAT THIS FILE PINS IS THE ASYMMETRY, which is where this will regress. Three states, not two,
 * and two reach directions, not one:
 *
 *   a recorded yes     required for `ready` — absence of a no is not a yes
 *   a recorded no      blocks, and travels UP and DOWN: a no on one behaviour is a no on its feature
 *   neither stated     satisfies neither gate, and `check` stays quiet rather than refusing
 *
 * A yes travels DOWN only: reading a feature says something about every behaviour in it; reading one
 * behaviour says nothing about its siblings.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { temp } from "./support/temp.mjs";
import { answerTheMachineryAxis } from "./support/machinery.mjs";

const { loadCorpus, resolveRules } = await import("../dist/v2/load.js");
const { readinessOf } = await import("../dist/v2/readiness.js");
const { readinessOf: packetReadiness, compilePacket } = await import("../dist/v2/packet.js");
const { perform } = await import("../dist/v2/acts.js");
const { checkCorpus } = await import("../dist/v2/check.js");
const { SLOTS } = await import("../dist/v2/schema.js");
const { questionsFor } = await import("../dist/v2/settle.js");
const { claimHash } = await import("../dist/v2/stamp.js");

const EX = "money#see-a-balance";

/** The `again` sentence this file blanks, matched exactly so a reword fails loudly. */
const SLOT_TEXT =
  "      again:\n" +
  "        says: >\n" +
  "          Looking twice shows the same thing, plus anything recorded in between. Looking\n" +
  "          changes nothing and is never refused for having been done before.\n";

/**
 * A seed where everything a TRAVERSAL can check about `money#see-a-balance` holds: every slot
 * agreed, every rule that supplies one agreed, every claim demonstrated.
 *
 * ⛔ So the read-through is the only variable left in these cases. Without that, a `ready: false`
 * proves nothing about this change — it would be true for four other reasons.
 */
function settled(prefix) {
  const dir = temp(prefix);
  fs.cpSync("v2-seed", dir, { recursive: true });
  const first = loadCorpus(dir);
  const { inherited } = resolveRules(first);
  for (const id of new Set(SLOTS.map((s) => inherited.get(`${EX}#${s}`)?.id).filter(Boolean)))
    perform(dir, "accept", { target: id }, { by: "peter", via: "page", because: "yes" });
  for (const slot of SLOTS)
    perform(dir, "accept", { target: `${EX}#${slot}` }, { by: "peter", via: "page", because: "yes" });
  return dir;
}

/**
 * ⛔ THE MACHINERY AXIS IS ANSWERED FIRST, because `readinessOf` gates on it since fg-0020 closed.
 * A promise with no part of the system behind it holds a build exactly as an untested claim does,
 * and these fixtures reach `ready: true` — so each has to say what answers its promises, or that
 * nothing has to be built for them. `answerTheMachineryAxis` does the second, which is the honest
 * answer for the seed: it promises things like *"looking is never refused for having been done
 * before"*, and there is nothing to build for that.
 */
/** The corpus, with the one requirement the seed is missing supplied in memory. */
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

/**
 * ⛔ THE THREE OUTCOMES OUT OF ONE FIXTURE, because a zero proves nothing unless you can say what a
 * failing zero looks like. `read.unread` is absent-by-default on a corpus nobody has touched, so
 * asserting only "an unread scope is not ready" would pass on a build that shipped none of this.
 */
test("unread, a recorded no, and a recorded yes are three different answers from the same corpus", () => {
  const dir = settled("v2build-three-");

  const unread = ok(readinessOf(corpusOf(dir), EX));
  assert.equal(unread.ready, false, "every fact agreed and demonstrated, and nobody had read it");
  assert.equal(unread.read.unread, true);
  assert.equal(unread.read.latest, null);
  assert.deepEqual(unread.read.stopped, []);
  assert.match(unread.because, /nobody has read this end to end from a builder's seat/);
  /** ⛔ And it is not reported as any of the four things it is not. */
  assert.deepEqual(unread.holes, []);
  assert.deepEqual(unread.unagreed, []);
  assert.deepEqual(unread.untested, []);

  const said = perform(
    dir,
    "read",
    { scope: EX, buildable: false, blockedBy: [`${EX}#after`], note: "nothing says which screen owns the figure" },
    { by: "peter", via: "page" }
  );
  assert.equal(said.ok, true, said.why);

  const stopped = ok(readinessOf(corpusOf(dir), EX));
  assert.equal(stopped.ready, false);
  assert.equal(stopped.read.stopped.length, 1);
  assert.equal(stopped.read.stopped[0].by, "peter");
  /**
   * ⛔ NOT BOTH SENTENCES. `unread` means neither answer was given, so a recorded no must not also
   * report "nobody has read this" — one verdict contradicting itself about the same scope.
   */
  assert.equal(stopped.read.unread, false);
  assert.doesNotMatch(stopped.because, /nobody has read this end to end/);
  assert.match(stopped.because, /peter read money#see-a-balance end to end .* could NOT build from it/);
  assert.match(stopped.because, /nothing says which screen owns the figure/);
  assert.match(stopped.because, /Nothing computed outranks that/);
  /** ⛔ What they named as stopping them is a hole, through the path an open question already takes. */
  assert.deepEqual(
    stopped.holes.map((h) => h.ref),
    [`${EX}#after`]
  );

  const yes = perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" });
  assert.equal(yes.ok, true, yes.why);

  /**
   * ⛔ THE NO IS STILL ON THE RECORD AND STILL BLOCKS. The verdict log is append-only, so a later
   * yes does not retract an earlier no — withdrawing a finding is its own act, and a gate that let
   * the newest stamp win would make "I could not build this" erasable by restating it.
   */
  const both = ok(readinessOf(corpusOf(dir), EX));
  assert.equal(both.ready, false, "a later yes silently overrode a recorded no");
  assert.equal(both.read.stopped.length, 1);
  assert.equal(both.read.latest.buildable, true, "the newest yes is still reported, it just does not win");
});

test("a recorded yes is what makes it ready — and it names who, because that is the part nothing computed", () => {
  const dir = settled("v2build-yes-");
  answerTheMachineryAxis(dir, EX);
  assert.equal(perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" }).ok, true);

  const r = ok(readinessOf(corpusOf(dir), EX));
  assert.equal(r.ready, true, r.because);
  assert.equal(r.read.unread, false);
  assert.equal(r.read.latest.by, "peter");
  assert.equal(r.read.latest.buildable, true);
  assert.match(r.because, /^Ready to build: peter read this end to end on \d{4}-\d{2}-\d{2} and could build from it;/);
});

/**
 * ⛔ A READING THAT DID NOT ANSWER THE QUESTION HAS NOT ANSWERED IT, and the two gates read that
 * absence in OPPOSITE directions on purpose: the pass is withheld, the refusal stays quiet. Reading
 * it as a no would make `check` refuse every corpus holding a relayed read — *"a refusal firing on
 * all of them is one people switch off"* — and reading it as a yes would pass the gate on exactly
 * the records it cannot interpret.
 */
test("a read-through that states no buildability satisfies neither gate", () => {
  const dir = settled("v2build-silent-");
  fs.appendFileSync(
    `${dir}/verdicts/reads.yaml`,
    ["  - kind: read", `    scope: ${EX}`, "    by: peter", "    at: 2026-10-20", "    via: page", ""].join("\n")
  );

  const r = ok(readinessOf(corpusOf(dir), EX));
  assert.equal(r.ready, false, "a reading that said nothing about buildability read as a yes");
  assert.deepEqual(r.read.stopped, [], "a reading that said nothing about buildability read as a no");

  const found = checkCorpus(dir).findings.filter((f) => f.kind === "a-person-could-not-build-from-this");
  assert.deepEqual(found, [], "check refused a corpus over a reading that made no claim");
});

/**
 * ⛔ THE TWO REACH DIRECTIONS, AND GETTING EITHER BACKWARDS IS EXPENSIVE IN A DIFFERENT WAY.
 *
 * A yes that travelled up would let somebody read the smallest behaviour in a feature and have the
 * whole feature report itself buildable. A no that did not travel up would let a feature stay
 * `ready: true` while a person had declared one of its behaviours unbuildable — which is the defect
 * this whole change is about, one level down.
 */
test("a yes reaches downward only; a no reaches in both directions", () => {
  const dir = settled("v2build-reach-");
  answerTheMachineryAxis(dir, EX);

  /** The parent of `money`, read end to end — its yes stands over the behaviour below. */
  assert.equal(
    perform(dir, "read", { scope: "money#see-a-balance", buildable: true }, { by: "peter", via: "page" }).ok,
    true
  );
  assert.equal(ok(readinessOf(corpusOf(dir), EX)).ready, true);

  /**
   * ⛔ And that yes says nothing about the feature containing it. `money` also holds
   * `record-spending`, with two open questions — so a yes on one behaviour making the feature ready
   * would hand a builder a scope with two undecided slots in it.
   */
  const feature = ok(readinessOf(corpusOf(dir), "money"));
  assert.equal(feature.ready, false);
  assert.equal(feature.read.unread, true, "a behaviour's yes answered for the feature containing it");

  const child = settled("v2build-reach-up-");
  assert.equal(
    perform(child, "read", { scope: EX, buildable: false, blockedBy: [] }, { by: "peter", via: "page" }).ok,
    true
  );
  /** ⛔ Upward: a behaviour nobody could build from is a feature nobody can start on. */
  const above = ok(readinessOf(corpusOf(child), "money"));
  assert.equal(above.read.stopped.length, 1);
  assert.equal(above.ready, false);
  assert.match(above.because, /could NOT build from it/);
  /** ⛔ And it says so, rather than leaving a reader to infer it from a missing sentence. */
  assert.match(above.because, /did not say what stopped them/);
});

/**
 * ⛔ THE PACKET'S OWN VERDICT IS THE ONE THE PAGE RENDERS, AND IT DISAGREED WITH ITS OWN BANNER.
 *
 * `page.ts` imports `readinessOf` from `packet.ts` rather than from `readiness.ts`, deliberately, so
 * the page and the packet cannot disagree. That function's holes come from the traversal, and a
 * person's reading is not a traversal — so the one surface Peter reviews on showed a green
 * readiness directly above a packet whose first line was a human refusing it.
 */
test("the packet's readiness agrees with the banner the same pass prints", () => {
  const dir = settled("v2build-packet-");
  assert.equal(
    perform(dir, "read", { scope: "money", buildable: false, blockedBy: ["money#see-a-balance#after"], note: "no owner for the figure" }, { by: "peter", via: "page" }).ok,
    true
  );
  const corpus = loadCorpus(dir);

  const md = compilePacket(corpus, "money");
  assert.match(md, /could not build from it/, "the banner this test depends on is gone");

  const r = packetReadiness(corpus, "money");
  assert.equal(r.ready, false, "the packet printed a human's refusal and returned ready: true");
  assert.ok(r.holes.includes("money#see-a-balance#after"), `what stopped them is not in ${JSON.stringify(r.holes)}`);
});

/**
 * ⛔ THE ACT AND THE GATE HAVE TO AGREE ABOUT WHAT A HOLE IS, AND ON THIS CASE THEY DID NOT.
 *
 * `questionsIn` opens each slot with `if (!fill) continue`, so a slot nobody has thought about
 * produces no question — correctly, because nobody has been asked. But the act's refusal read only
 * questions while `readinessOf` counts a blank as a hole, so the two lists were disjoint on exactly
 * the purest case:
 *
 *     grid `·` · one hole · zero questions · `read --buildable true` recorded
 *
 * The gate still blocked, so nothing reached a builder. What the corpus held was a person's stamp
 * contradicting its own grid — and the act's stated reason is that *"'I read it and could build it'
 * and 'we have not decided that' cannot both be true."*
 */
test("a slot nobody has thought about stops the act, not only the gate", () => {
  const dir = settled("v2build-blank-");
  const f = `${dir}/truth/money.md`;
  const src = fs.readFileSync(f, "utf-8");
  const cut = src.replace(SLOT_TEXT, "");
  assert.notEqual(cut, src, "the slot this test blanks has been reworded — find the new wording");
  fs.writeFileSync(f, cut);

  /** ⛔ The gate's side, which already worked: a blank is a hole. */
  const r = ok(readinessOf(loadCorpus(dir), EX));
  assert.equal(r.ready, false);
  assert.deepEqual(
    r.holes.map((h) => h.ref),
    [`${EX}#again`]
  );

  /** ⛔ And nobody has been ASKED about it — which is why the act could not see it. */
  const asked = questionsFor(loadCorpus(dir), "money").filter((q) => q.ref.includes("see-a-balance"));
  assert.deepEqual(asked, [], "a blank slot became a question, so this test no longer covers the gap");

  const act = perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" });
  assert.equal(act.ok, false, "a person recorded 'I could build from this' over a slot nobody had thought about");
  assert.match(act.why, /1 slot nobody has thought about/);
  assert.ok(act.detail.includes(`${EX}#again`), `the blank is not named in ${JSON.stringify(act.detail)}`);
  /** ⛔ It routes to deciding or waiving — never to parking, because there is no question to park. */
  assert.deepEqual(
    act.instead.map((i) => i.act),
    ["rule", "waive", "read"]
  );

  /** ⛔ And saying you could NOT build from it is still open to them. That is the whole escape. */
  const said = perform(
    dir,
    "read",
    { scope: EX, buildable: false, blockedBy: [`${EX}#again`] },
    { by: "peter", via: "page" }
  );
  assert.equal(said.ok, true, said.why);
});

/**
 * ⛔ AND THE CORPORA THE OLD ACT ALREADY LET THROUGH.
 *
 * Every `buildable: true` recorded before the refusal above existed is still in the log, written
 * over a blank slot nobody looked for. The verdict log is append-only, so the fix is somebody
 * re-reading rather than an edit — which is why this is a note and not a refusal, and why its `fix`
 * names an act.
 */
test("a stamp written before the refusal existed is found, as a note and not a refusal", () => {
  const dir = settled("v2build-legacy-");

  /** The stamp first, while the slot still says something — which is what the old act allowed. */
  assert.equal(perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" }).ok, true);

  /** Then the slot goes blank, exactly as a later edit to the truth would do. */
  const f = `${dir}/truth/money.md`;
  const src = fs.readFileSync(f, "utf-8");
  const cut = src.replace(SLOT_TEXT, "");
  assert.notEqual(cut, src, "the slot this test blanks has been reworded — find the new wording");
  fs.writeFileSync(f, cut);

  const found = checkCorpus(dir).findings.filter((x) => x.kind === "built-from-a-slot-nobody-decided");
  assert.equal(found.length, 1, `expected one, got ${JSON.stringify(found)}`);
  assert.equal(found[0].severity, "note", "⛔ a refusal here would fire on every corpus carrying an older stamp");
  assert.match(found[0].what, /peter read this on \d{4}-\d{2}-\d{2} and could build from it/);
  assert.match(found[0].what, /one slot says nobody has thought about it: money#see-a-balance#again/);
  assert.match(found[0].fix, /read it through again/);

  /** ⛔ And it says nothing where the corpus is whole, which is the half that makes it a check. */
  const clean = settled("v2build-legacy-clean-");
  assert.equal(perform(clean, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" }).ok, true);
  assert.deepEqual(
    checkCorpus(clean).findings.filter((x) => x.kind === "built-from-a-slot-nobody-decided"),
    []
  );
});
