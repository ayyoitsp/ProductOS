/**
 * ⛔ A VIEW AND AN EXCHANGE SHARED A NAME, SO ONE REF STRING MEANT A SCREEN AND AN ASK.
 *
 * In Peter's corpus, `org-loan-terms` had `fannie-program-settings` as BOTH its view id and its
 * exchange id. So `org-loan-terms#fannie-program-settings` named a screen and a behaviour at once,
 * and which one any given surface resolved was a matter of which lookup ran first — a stamp, a
 * reading, a prototype door, a criterion's `of`, `at.view`, `leads_to`, all addressing by the same
 * `<scope>#<name>` shape.
 *
 * ⛔ FOUND BY A ROLE SCOPING THAT FEATURE, NOT BY A CHECK. Its own words: *"nothing detects that
 * collision — worth a check, not a model change"*. It was right in both halves. The model is fine:
 * views and exchanges are different things and may each be named freely. What was missing is anyone
 * noticing when the two namespaces meet inside one scope, which is the only place `<scope>#<name>`
 * becomes ambiguous.
 *
 * ⛔ AND IT WENT UNNOTICED BECAUSE NOTHING HAPPENED. The corpus loaded, the page rendered, the
 * checks passed. `check` already refuses two scopes sharing an id, two exchanges sharing an id and
 * two criteria sharing a number — each with a comment about a reference resolving to one of them
 * silently. This is the same failure with one word changed, and it was the one case not covered.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { checkCorpus } = await import("../dist/v2/check.js");

const collisions = (dir) =>
  checkCorpus(dir).findings.filter((f) => f.kind === "one-name-two-things");

/** The seed, with one scope's view renamed to match one of its own exchanges. */
function corpusWhereAViewAndAnAskShareAName() {
  const dir = path.join(temp("v2collide-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const file = path.join(dir, "truth", "money.md");
  const text = fs.readFileSync(file, "utf-8");
  /**
   * The first EXCHANGE's id, read from the exchanges section.
   *
   * ⛔ Not from the whole document: `views:` comes first, so the first `- id:` in the file is a
   * VIEW. The first version of this fixture took that and then asserted the two differed, which
   * fired its own guard — the guard working, on the fixture rather than the corpus.
   */
  const exId = text.slice(text.indexOf("exchanges:")).match(/^  - id:\s*(\S+)$/m)[1];
  const views = text.slice(text.indexOf("views:"), text.indexOf("exchanges:"));
  const viewId = views.match(/^  - id:\s*(\S+)$/m)[1];
  assert.notEqual(viewId, exId, "the seed already collides, so this fixture proves nothing");
  const out =
    text.slice(0, text.indexOf("views:")) +
    views.replace(`- id: ${viewId}`, `- id: ${exId}`) +
    text.slice(text.indexOf("exchanges:"));
  fs.writeFileSync(file, out);
  return { dir, name: exId, viewId };
}

test("a view and an exchange sharing a name is refused", () => {
  const { dir, name } = corpusWhereAViewAndAnAskShareAName();
  const found = collisions(dir);
  assert.equal(found.length, 1, `expected one collision, got ${JSON.stringify(found)}`);
  assert.equal(found[0].severity, "refuse");
  assert.match(found[0].what, new RegExp(name), "the finding does not name the colliding id");
  /** ⛔ It has to say what breaks, or a reader cannot tell why two names matter. */
  assert.match(
    `${found[0].what} ${found[0].fix}`,
    /screen|ask|behaviour/i,
    "the finding does not say which two things the one name means"
  );
});

test("the seed as shipped has no collision", () => {
  /**
   * ⛔ THE NON-VACUOUS HALF. A check that fires on everything would pass the test above, and this
   * corpus is the one every other test builds on — if it refused here, the refusal is wrong.
   */
  const dir = path.join(temp("v2nocollide-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  assert.deepEqual(collisions(dir), []);
});

test("the same name in two different scopes is fine", () => {
  /**
   * ⛔ ONLY INSIDE ONE SCOPE IS IT AMBIGUOUS. `a#thing` and `b#thing` resolve perfectly; refusing
   * those would ban every ordinary name — "balance", "overview", "settings" — across a product.
   */
  const dir = path.join(temp("v2crossscope-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const money = fs.readFileSync(path.join(dir, "truth", "money.md"), "utf-8");
  const viewId = money.slice(money.indexOf("views:")).match(/^  - id:\s*(\S+)$/m)[1];
  fs.writeFileSync(
    path.join(dir, "truth", "elsewhere.md"),
    `---\nid: elsewhere\ntitle: Somewhere else entirely\nin: family-wallet\nexists: kept\n` +
      `exchanges:\n  - id: ${viewId}\n    title: An ask that happens to share a screen's name\n` +
      `    asked_by: person\n    reads: []\n    changes: []\n    slots: {}\n    criteria: []\n---\n\n# Somewhere else\n`
  );
  assert.deepEqual(collisions(dir), [], "a name reused in another scope was refused");
});
