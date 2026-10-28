/**
 * ⛔ "THE BOUNDARY IS WRONG" HAS SOMEWHERE TO GO.
 *
 * The interview asks *"is that what this feature is for?"*. Peter answered **"The boundary is
 * wrong"** — and no act could take that answer. `#happy-path` could be ACCEPTED and never REVISED:
 * every route through the door records a decision about a SLOT, a happy path is not one, and the
 * only way to change a word of it was `document`, a whole-file rewrite. The question could be asked
 * and not answered.
 *
 * ⛔ AND THE GATE WAS THE SECOND HALF. `rule` refuses anything not `unsettled`, which is right for a
 * slot — a reader who disagrees with agreed words should leave a question somebody else can see.
 * A happy path has nowhere to hold a question, so that gate made every part of it permanently
 * unrulable. What protects it instead: `because` is required, the verdict records what it replaced,
 * and agreement is separate — so nobody's acceptance survives a correction they did not see.
 *
 * ⛔ `through` IS DELIBERATELY NOT RULABLE. Peter: *"screens really doesn't belong in the
 * 'purpose'."* It is a route of view ids, not prose, and a ruling that replaced it with a sentence
 * would turn a resolvable route into text.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { resolveRef, HAPPY_PARTS } = await import(path.resolve("dist/v2/ref.js"));
const { perform } = await import(path.resolve("dist/v2/acts.js"));
const { interviewFor } = await import(path.resolve("dist/v2/interview.js"));

const SCOPE = "spending";
const corpus = () => {
  const dir = temp("pos-happy-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "truth", "spending.md"),
    `---
id: spending
title: Spending
in: family-wallet
exists: kept
happy_path:
  accomplishes: A parent records that a kid spent some of their money
  brings: the kid, and what was spent
  ends_with: the kid's money is smaller by that amount and the spend is on the list
  not: setting up an allowance that runs on its own
  through: [spend-form]
exchanges:
  - id: record-a-spend
    title: A parent records a spend
    asked_by: person
    at:
      view: spend-form
      part: save-button
    reads: [money, kid]
    changes: [money]
    slots:
      may:
        says: A parent may record a spend for any kid in their family.
---

# Spending
`
  );
  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the fixture does not load: ${c.broken.map((b) => b.why).join("; ")}`);
  return dir;
};

const rule = (dir, ref, says) =>
  perform(
    dir,
    "rule",
    { slot: ref, says, because: "Peter said this part of the boundary was wrong and gave the words that replace it." },
    { by: "peter", via: "chat" }
  );

test("⛔ one part of a happy path can be corrected, and the old words are reported", () => {
  const dir = corpus();
  const NOW = "setting up an allowance that runs on its own, which is its own feature";
  const out = rule(dir, `${SCOPE}#happy-path#not`, NOW);
  assert.ok(out.ok, `the correction was refused: ${String(out.why).split("\n")[0]}`);

  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the corrected corpus does not load: ${c.broken.map((b) => b.why).join("; ")}`);
  assert.equal(c.scopes.find((x) => x.scope.id === SCOPE).scope.happy_path.not, NOW);
  /** ⛔ Everything else in the happy path is untouched — this is a sentence, not a rewrite. */
  const hp = c.scopes.find((x) => x.scope.id === SCOPE).scope.happy_path;
  assert.equal(hp.accomplishes, "A parent records that a kid spent some of their money");
  assert.deepEqual(hp.through, ["spend-form"]);
});

test("⛔ the whole path is refused, and so is the route — the grain is not a free pass", () => {
  /**
   * ⛔ THE TWO NON-SUCCESSES. "A correction worked" on its own is also what a grain that accepts
   * anything produces, so the refusals are the evidence that it does not.
   */
  const dir = corpus();

  const whole = rule(dir, `${SCOPE}#happy-path`, "the whole thing at once");
  assert.equal(whole.ok, false, "the entire happy path was rewritten by one ruling");

  const route = resolveRef(loadCorpus(dir), `${SCOPE}#happy-path#through`);
  assert.ok("error" in route, "`through` resolved as a rulable sentence");
  assert.match(route.error, /route rather than a sentence/);

  const nonsense = resolveRef(loadCorpus(dir), `${SCOPE}#happy-path#nonsense`);
  assert.ok("error" in nonsense);
  for (const part of HAPPY_PARTS) assert.match(nonsense.error, new RegExp(part));
});

test("⛔ an empty correction and a no-op are both refused", () => {
  const dir = corpus();
  assert.equal(rule(dir, `${SCOPE}#happy-path#not`, "   ").ok, false, "a happy path part was emptied by ruling on it");
  assert.equal(
    rule(dir, `${SCOPE}#happy-path#not`, "setting up an allowance that runs on its own").ok,
    false,
    "re-stating the same sentence counted as a correction"
  );
});

test("⛔ the purpose is asked apart from what somebody arrives and leaves with", () => {
  /**
   * Peter: *"this is too much for a single question ... what's it for could be a separate question,
   * arrives with, leaves with can be another question of its own."*
   */
  const dir = corpus();
  const owed = interviewFor(loadCorpus(dir), SCOPE).owed;
  const purpose = owed.find((o) => o.owes === "purpose");
  const handover = owed.find((o) => o.owes === "handover");
  assert.ok(purpose, "nothing asks what this feature is for");
  assert.ok(handover, "what somebody arrives and leaves with is not asked at all");

  /** ⛔ Two questions, two addresses — a worklist refuses one ref asked twice. */
  assert.notEqual(purpose.ref, handover.ref);
  for (const o of [purpose, handover]) assert.ok(o.fills.includes(`${SCOPE}#happy-path`), `${o.owes} does not settle the happy path`);

  /** ⛔ AND THE SCREENS ARE IN NEITHER. "screens really doesn't belong in the 'purpose'." */
  const shown = [purpose, handover].flatMap((o) => (o.about?.already ?? []).map((a) => a.asks));
  assert.ok(!shown.some((x) => /screen/i.test(x)), `the screens are still inside the purpose: ${shown.join(", ")}`);
  assert.ok(!/spend-form/.test(purpose.asks + handover.asks), "a view id reached a question a person reads");

  /** ⛔ And the handover reads as English — `ends_with` is a clause, not a noun phrase. */
  assert.ok(!/leave with the /i.test(handover.asks), `"${handover.asks}"`);
  assert.match(handover.asks, /Afterwards,/);
});
