/**
 * ⛔ EVERY CAPABILITY CHECK RAN ONE DIRECTION, AND IT WAS THE DIRECTION THAT CATCHES ENGINEERS.
 *
 * Peter: *"does buildability also ensure capabilities are mapped from a feature?"*
 *
 * It did not, and nor did anything else. Driven on the shipped seed before answering:
 *
 *     subsystems                           0
 *     behaviours served by any machinery   0 of 5
 *     findings about it                    0
 *     readinessOf fields mentioning it     none
 *
 * `a-capability-that-serves-nothing`, `a-capability-serves-nothing-here` and
 * `a-capability-serves-only-other-machinery` all walk from the tree toward the product — a part that
 * exists for nothing, a part pointing at a ref that is gone, a part that only ever serves other
 * parts. All three catch somebody inventing scope. Walking the other way — a promise nobody has
 * worked the parts out for — had no finding, no role asking it, and no place in the gate.
 *
 * It is `untested`'s twin, and the two derived layers were made generable from current truth in the
 * same decision: *"capabilities should be generated based on current truth, have the accepted state
 * feed in. test cases should be generated too."* One of them got a gate.
 *
 * ⛔ AND THIS ONE REPORTS RATHER THAN GATES, which is a gap and not a preference — see `fg-0020`. A
 * behaviour can legitimately need no new machinery and the model has nowhere to say so, so a refusal
 * could only ever be cleared by inventing a part. That is verbatim what `none: true` exists to stop:
 * *"a model that refused to let anyone say so would push an author into inventing a state change
 * just to fill the slot."* The assertions below pin that it does NOT block.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { temp } from "./support/temp.mjs";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { loadCorpus } = await import("../dist/v2/load.js");
const { readinessOf } = await import("../dist/v2/readiness.js");
const { unserved, unservedIn } = await import("../dist/v2/demonstrate.js");
const { checkCorpus } = await import("../dist/v2/check.js");
const { renderScopePage, standalone } = await import("../dist/v2/page.js");
const { perform } = await import("../dist/v2/acts.js");
const { resolveRules } = await import("../dist/v2/load.js");
const { SLOTS } = await import("../dist/v2/schema.js");
const { claimHash } = await import("../dist/v2/stamp.js");

const EX = "money#see-a-balance";

const seed = (prefix) => {
  const dir = temp(prefix);
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
};

/**
 * A subsystem offering one capability, serving whatever is named.
 *
 * ⛔ Written as a file because there is no `decompose` intent — the decomposer edits the corpus
 * directly, which is itself worth knowing and is why this fixture looks like this.
 */
function machineryFor(dir, serves) {
  /** ⛔ `capabilities/`, which is what the loader reads — the directory kept its v1 name. */
  fs.mkdirSync(`${dir}/capabilities`, { recursive: true });
  fs.writeFileSync(
    `${dir}/capabilities/ledger.md`,
    [
      "---",
      "id: ledger",
      "title: The ledger",
      "does: Holds what each kid has, and every movement against it, as one ordered record.",
      "offers:",
      "  - id: current-figure",
      "    does: Answers with a kid's standing figure, derived from every movement recorded against them.",
      "    serves:",
      ...serves.map((s) => `      - ${s}`),
      "---",
      "",
      "# The ledger",
      "",
      "Placeholder body for a fixture.",
      "",
    ].join("\n")
  );
}

const ok = (r) => {
  assert.ok(!("error" in r), `readiness refused: ${r.error}`);
  return r;
};

/**
 * ⛔ THREE DISTINGUISHABLE ANSWERS, because for a feature whose list is empty today a zero is not a
 * weak check — it is what shipping nothing produces. `unserved` returning `[]` is also what a
 * function that always returns `[]` produces.
 */
test("unmapped, partly mapped, and mapped are three different answers", () => {
  const bare = seed("v2parts-bare-");
  const nothing = unserved(loadCorpus(bare), "money", "see-a-balance");
  assert.ok(nothing.length >= 2, `expected several unserved promises, got ${JSON.stringify(nothing)}`);
  assert.ok(nothing.includes(`${EX}#answer`), `${EX}#answer is not in ${JSON.stringify(nothing)}`);

  /** One promise mapped: the list shrinks by exactly that one, and keeps the rest. */
  const some = seed("v2parts-some-");
  machineryFor(some, [`${EX}#answer`]);
  const partly = unserved(loadCorpus(some), "money", "see-a-balance");
  assert.ok(!partly.includes(`${EX}#answer`), "a promise a part serves is still reported as unserved");
  assert.deepEqual(
    partly,
    nothing.filter((r) => r !== `${EX}#answer`),
    "mapping one promise changed the answer for another"
  );

  /** Everything mapped: empty, and demonstrably not empty-by-construction. */
  const all = seed("v2parts-all-");
  machineryFor(all, nothing);
  assert.deepEqual(unserved(loadCorpus(all), "money", "see-a-balance"), []);
});

/**
 * ⛔ A PART SERVING A SLOT ANSWERS FOR THE SENTENCES INSIDE IT. Somebody worked the machinery out at
 * slot grain; demanding one part per sentence would report a mapped slot as unmapped and send a
 * decomposer back to split a part it had no reason to split.
 */
/**
 * A slot rewritten to say three things, so the statement grain is exercised at all.
 *
 * ⛔ CONSTRUCTED, BECAUSE THE SEED HAS NONE. Checked rather than assumed: `statements()` returns
 * several only where `says` is a YAML list, and no slot in the shipped seed is written that way. So
 * the branch of `unserved` that walks sentences had no fixture in existence — the same reason the
 * blank-slot case had to be built by hand.
 */
function threeStatementsAt(dir) {
  const f = `${dir}/truth/money.md`;
  const src = fs.readFileSync(f, "utf-8");
  const was = [
    "      again:",
    "        says: >",
    "          Looking twice shows the same thing, plus anything recorded in between. Looking",
    "          changes nothing and is never refused for having been done before.",
    "",
  ].join("\n");
  const now = [
    "      again:",
    "        says:",
    "          - id: same-thing",
    "            says: Looking twice shows the same thing it showed the first time.",
    "          - id: plus-since",
    "            says: Anything recorded in between is there on the second look.",
    "          - id: never-refused",
    "            says: Looking is never refused for having been done before.",
    "",
  ].join("\n");
  const out = src.replace(was, now);
  assert.notEqual(out, src, "the slot this fixture rewrites has been reworded — find the new wording");
  fs.writeFileSync(f, out);
  return ["same-thing", "plus-since", "never-refused"].map((id) => `${EX}#again#${id}`);
}

/**
 * ⛔ A PART SERVING A SLOT ANSWERS FOR THE SENTENCES INSIDE IT. Somebody worked the machinery out at
 * slot grain; demanding one part per sentence would report a mapped slot as unmapped and send a
 * decomposer back to split a part it had no reason to split.
 */
test("a slot saying three things is reported sentence by sentence, and one part over the slot covers all three", () => {
  const dir = seed("v2parts-grain-");
  const mine = threeStatementsAt(dir);

  /** ⛔ Three refs, not one — a slot saying three things with one part is a third mapped. */
  const before = unserved(loadCorpus(dir), "money", "see-a-balance");
  for (const r of mine) assert.ok(before.includes(r), `${r} is not reported — got ${JSON.stringify(before)}`);
  assert.ok(!before.includes(`${EX}#again`), "the slot was reported whole as well as sentence by sentence");

  /** One part naming the SLOT covers every sentence in it. */
  machineryFor(dir, [`${EX}#again`]);
  const after = unserved(loadCorpus(dir), "money", "see-a-balance");
  for (const r of mine) assert.ok(!after.includes(r), `${r} is unserved though a part serves the slot it is in`);

  /** ⛔ And a part naming ONE sentence covers only that one. */
  const narrow = seed("v2parts-grain-narrow-");
  threeStatementsAt(narrow);
  machineryFor(narrow, [mine[0]]);
  const left = unserved(loadCorpus(narrow), "money", "see-a-balance");
  assert.ok(!left.includes(mine[0]), `${mine[0]} is unserved though a part names it exactly`);
  assert.ok(left.includes(mine[1]), "a part naming one sentence silently covered its neighbour");
  assert.ok(left.includes(mine[2]), "a part naming one sentence silently covered its neighbour");
});

/**
 * ⛔ IT IS IN THE VERDICT AND IT DOES NOT BLOCK — `fg-0020`. This is the assertion that keeps the
 * gap honest: the day somebody adds a way to say "this needs nothing new", this test is what says
 * the gate was deliberately left open until then.
 */
test("readiness reports unserved promises on both sides of the verdict, and gates on neither", () => {
  const dir = seed("v2parts-verdict-");
  const r = ok(readinessOf(loadCorpus(dir), EX));

  assert.ok(r.unserved.length, "the seed has no subsystems, so its promises cannot be served");
  assert.match(r.because, /no machinery against/);
  assert.match(r.because, /Reported, not blocking/);

  /**
   * ⛔ NOTHING IT CONTRIBUTES IS A HOLE — `holes` is the gating list, so a list that quietly joined
   * it would pass every assertion above while blocking every corpus in existence.
   *
   * ⛔ And NOT disjoint from `untested`, which the first version of this test asserted and was wrong
   * about: a claim with no test and no machinery is two independent facts about one sentence, owed
   * by two different roles. Overlap is the normal case on a corpus nobody has derived either layer
   * for, and demanding they not overlap would have forced one of the two to go quiet.
   */
  for (const ref of r.unserved) assert.ok(!r.holes.some((h) => h.ref === ref), `${ref} became a hole`);
  assert.ok(
    r.unserved.some((ref) => r.untested.includes(ref)),
    "the fixture no longer exercises a sentence that is both untested and unserved"
  );

  /**
   * ⛔ THE PROOF IT DOES NOT GATE: the same corpus reaching `ready: true` with the list non-empty.
   * Asserting only "ready is false here" would be satisfied by a build that did gate on it.
   */
  const { inherited } = resolveRules(loadCorpus(dir));
  for (const id of new Set(SLOTS.map((s) => inherited.get(`${EX}#${s}`)?.id).filter(Boolean)))
    perform(dir, "accept", { target: id }, { by: "peter", via: "page", because: "yes" });
  for (const slot of SLOTS)
    perform(dir, "accept", { target: `${EX}#${slot}` }, { by: "peter", via: "page", because: "yes" });
  perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" });

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

  const ready = ok(readinessOf(c, EX));
  assert.equal(ready.ready, true, ready.because);
  assert.ok(ready.unserved.length, "the fixture stopped exercising the case");
  assert.match(ready.because, /^Ready to build/);
  assert.match(ready.because, /no machinery against/, "a ready verdict dropped the report instead of carrying it");
});

/**
 * ⛔ THE CHECK'S SILENCE AT ZERO IS A DECISION, AND IT WAS NEARLY OVERTURNED.
 *
 * `behaviours-no-subsystem-answers` has asked this question all along, under
 * `if (corpus.subsystems.length)` — which is why the probe behind this file found nothing on the
 * seed, and why the first repair attempted was deleting that guard. `v2-capabilities` pins it with
 * its reason: *"A corpus that has not started this must not be told it is incomplete at something
 * it has not begun."*
 *
 * That is right about `check`, which audits a whole corpus unasked and has a queue-length ratchet
 * to stop it nagging — the ratchet caught the attempt, taking the seed from 14 decisions owed to 19
 * against 14 reviewable things. It is wrong about `readinessOf`, which is ASKED by somebody about to
 * build one thing, and where "no part serves this" and "nobody has decomposed anything" read
 * identically. So the two surfaces split: this one stays quiet, `unserved` above does not.
 *
 * ⛔ WHAT DID CHANGE HERE IS THE GRAIN, and the denominator comes from the same walk — "11 of 5" is
 * what comparing a statement count against a behaviour count produces.
 */
test("check stays silent with no capability layer, and counts statements once there is one", () => {
  const bare = seed("v2parts-check-");
  assert.deepEqual(
    checkCorpus(bare).findings.filter((f) => f.kind === "behaviours-no-subsystem-answers"),
    [],
    "a corpus that has not begun decomposing was told it is incomplete at it"
  );

  /** One part, so the layer exists — and now the rest must be reported. */
  const some = seed("v2parts-check-some-");
  machineryFor(some, [`${EX}#answer`]);
  const found = checkCorpus(some).findings.filter((f) => f.kind === "behaviours-no-subsystem-answers");
  assert.equal(found.length, 1, "reported per statement instead of once");
  assert.equal(found[0].severity, "note", "a refusal here can only be cleared by inventing a part — fg-0020");
  assert.match(found[0].fix, /nowhere yet to say so — fg-0020/);

  /** ⛔ Both halves of the fraction from one walk, at statement grain. */
  const c = loadCorpus(some);
  const [n, , m] = found[0].where.split(" ");
  const ids = c.scopes.map((x) => x.scope.id);
  assert.equal(Number(n), unservedIn(c, ids).length);
  assert.equal(Number(m), unservedIn(c, ids, undefined, true).length);
  assert.ok(
    Number(m) > c.scopes.reduce((t, x) => t + x.scope.exchanges.length, 0),
    `${m} is not finer than the behaviour count, so the grain is not being exercised`
  );
  assert.ok(Number(n) < Number(m), "the one served promise is not reflected in the numerator");

  /** And it goes quiet once every part exists, which is the half that makes it a check. */
  const mapped = seed("v2parts-check-clean-");
  const mc = loadCorpus(mapped);
  machineryFor(
    mapped,
    unservedIn(
      mc,
      mc.scopes.map((x) => x.scope.id)
    )
  );
  assert.deepEqual(
    checkCorpus(mapped).findings.filter((f) => f.kind === "behaviours-no-subsystem-answers"),
    []
  );
});

const { exe, skip } = browserOrSkip();

/**
 * ⛔ RENDERED, BECAUSE A RENDERING CLAIM THAT WAS NEVER RENDERED IS A GUESS — and because the one
 * surface Peter reviews on is the page.
 *
 * Two things are asserted and the second is the one that would rot: the line is there, and it is
 * OUTSIDE the ready/not-ready verdict. Printed inside the blocked branch it would read as one of
 * the things stopping a builder; printed only there it would vanish on every ready feature, which
 * is exactly where somebody is about to start.
 *
 * ⛔ AND IT NAMES BEHAVIOURS, NEVER REFS. Nothing a reader sees may carry an address — so the test
 * asserts the absence of `#`, which is what a leak would look like.
 */
test("the page says which promises have no machinery, outside the verdict", { skip }, async () => {
  const dir = seed("v2parts-page-");
  machineryFor(dir, [`${EX}#answer`]);
  const html = standalone("money", renderScopePage(loadCorpus(dir), "money", { interactive: false }));
  const page = await openPage(html, { exe });
  try {
    const seen = await page.evaluate(`(() => {
      const el = document.querySelector(".verdict-parts");
      const list = document.querySelector(".verdict-parts-list");
      const verdict = document.querySelector(".verdict");
      return {
        text: el ? el.textContent.trim() : null,
        shown: el ? getComputedStyle(el).display !== "none" : false,
        items: list ? [...list.querySelectorAll("li")].map((x) => x.textContent.trim()) : [],
        insideVerdict: Boolean(verdict && el && verdict.contains(el)),
      };
    })()`);

    assert.ok(seen.text, "the page says nothing about promises with no machinery");
    assert.ok(seen.shown, "the line is in the markup and not displayed — the defect a markup assertion would miss");
    assert.match(seen.text, /no part of the system against/);
    assert.match(seen.text, /Not a decision anybody owes/);
    assert.equal(seen.insideVerdict, false, "it is inside the verdict, so it reads as something blocking the build");
    assert.ok(seen.items.length, "it gives a count with nothing named");
    for (const t of seen.items) assert.ok(!t.includes("#"), `a reader was shown an address: ${t}`);
  } finally {
    await page.close();
  }
});
