/**
 * ⛔ SOFTWARE MAY DECIDE, AND IT MAY NEVER COUNT AS SOMEBODY HAVING AGREED.
 *
 * Peter, on who decides how a feature is split: "i think decide and override, but should be obvious
 * to be asked to change."
 *
 * Landing a default is the right call — nineteen features is a lot of accepting, and a blank gives a
 * reviewer nothing to argue with. But the moment a machine's choice is recordable, the first tenet
 * is one field away from void: a corpus reading agreed because software decided it has been
 * validated by nobody, and no surface can tell by looking.
 *
 * So the guarantee is structural rather than careful: `via: agent` records, and is filtered out at
 * the single function every gate in the model asks.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadCorpus } from "../dist/v2/load.js";
import { actsFor } from "../dist/v2/grid.js";
import { stampFor, decidedFor } from "../dist/v2/stamp.js";
import { perform, isHuman, VIA } from "../dist/v2/acts.js";
import { renderScopePage } from "../dist/v2/page.js";

const corpusWithPurpose = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentdec-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
};

test("only `agent` is not consent, and every other way is", () => {
  assert.ok(VIA.includes("agent"), "software has no way to record a decision at all");
  for (const v of VIA) assert.equal(isHuman(v), v !== "agent", `isHuman is wrong about "${v}"`);
});

test("a default software landed never opens a gate", () => {
  const dir = corpusWithPurpose();
  const before = actsFor(loadCorpus(dir));
  const one = before.ungrounded[0].scope;
  assert.equal(before.behaviours.filter((b) => b.startsWith(`${one}#`)).length, 0);

  const r = perform(dir, "accept", { target: `${one}#happy-path` }, { by: "productos-shape", via: "agent" });
  assert.equal(r.ok, true, r.ok ? "" : r.why);

  /**
   * ⛔ THE ONE ASSERTION THIS FILE EXISTS FOR. Every gate asks `stampFor`, so if an agent's record
   * answered "accepted" here, one field would make the first tenet meaningless.
   */
  assert.equal(stampFor(loadCorpus(dir), `${one}#happy-path`).state, "never", "software's decision read as an acceptance");

  const after = actsFor(loadCorpus(dir));
  assert.equal(
    after.behaviours.filter((b) => b.startsWith(`${one}#`)).length,
    0,
    "software agreeing a purpose offered its behaviours for agreement"
  );
  assert.equal(after.acceptable.filter((x) => x.startsWith(`${one}#`)).length, 0, "a whole exchange became acceptable");

  /**
   * ⛔ AND THE ACT'S OWN REPORT DOES NOT CLAIM AGREEMENT. It said "agreed what X is for — every
   * sentence is now offered" while the gate stayed shut. A command whose output contradicts what it
   * did is worse than one that refuses: somebody reads the tick and stops looking.
   */
  assert.doesNotMatch(r.said, /^agreed/, `the report claims agreement: "${r.said}"`);
  assert.match(r.said, /nobody has agreed/i, `the report does not say nobody agreed: "${r.said}"`);
  assert.ok(r.detail.some((d) => /NOT agreement/.test(d)), "the detail does not say this is not agreement");

  fs.rmSync(dir, { recursive: true, force: true });
});

test("it is findable, and said on the thing itself", () => {
  /**
   * ⛔ "should be obvious to be asked to change." A default nobody can see is not a default — it
   * becomes the answer by attrition. So it is reported where the sentence is, and in the queue,
   * distinguishably from a blank.
   */
  const dir = corpusWithPurpose();
  const one = actsFor(loadCorpus(dir)).ungrounded[0].scope;
  perform(dir, "accept", { target: `${one}#happy-path` }, { by: "productos-shape", via: "agent" });
  const c = loadCorpus(dir);

  const landed = decidedFor(c, `${one}#happy-path`);
  assert.equal(landed?.by, "productos-shape", "nothing can find what software decided");

  // The queue distinguishes "software decided and nobody looked" from "nobody has agreed".
  const why = actsFor(c).ungrounded.find((u) => u.scope === one).why;
  assert.match(why, /written for you by productos-shape/, `the queue hides the default: "${why}"`);

  // And the feature itself says so, loudly enough to be argued with.
  const html = renderScopePage(c, c.scopes.find((s) => !s.scope.in).scope.id, { linkBase: "/v2" });
  assert.match(html, /class="decided-for-you"/, "the page does not say a default was written for you");
  assert.match(html, /Nobody has looked at this/, "the page does not say nobody has looked");
  assert.match(html, /productos-shape/, "the page does not say who decided");

  fs.rmSync(dir, { recursive: true, force: true });
});

test("a person agreeing after software decided is the thing that opens the gate", () => {
  const dir = corpusWithPurpose();
  const one = actsFor(loadCorpus(dir)).ungrounded[0].scope;
  perform(dir, "accept", { target: `${one}#happy-path` }, { by: "productos-shape", via: "agent" });
  const r = perform(dir, "accept", { target: `${one}#happy-path` }, { by: "peter", via: "page" });
  assert.equal(r.ok, true, r.ok ? "" : r.why);

  const c = loadCorpus(dir);
  assert.equal(stampFor(c, `${one}#happy-path`).state, "accepted", "a person's agreement did not land");
  assert.equal(stampFor(c, `${one}#happy-path`).by, "peter", "the stamp names the wrong party");
  assert.ok(actsFor(c).behaviours.some((b) => b.startsWith(`${one}#`)), "agreeing it did not offer the behaviours");
  // ⛔ The machine's record is still there — the history of what was decided for whom is not erased.
  assert.ok(decidedFor(c, `${one}#happy-path`), "the default was overwritten rather than superseded");
  fs.rmSync(dir, { recursive: true, force: true });
});
