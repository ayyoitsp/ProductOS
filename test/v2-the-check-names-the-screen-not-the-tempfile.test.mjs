/**
 * ⛔ A REFUSAL ABOUT A HOSTED CORPUS NAMED A TEMP DIRECTORY ON WHOEVER'S LAPTOP RAN THE CHECK.
 *
 * What a reviewer actually saw, twice today, while two documents were mid-write:
 *
 *     ✗ /var/folders/kt/trqnb0ys409gt7nt1s_7qx040000gn/T/productos-instance-bIoD17/corpus/truth/publish-pricing.md will-not-parse
 *
 * An instance materializes a project into a temp directory per request, so that path names a
 * directory that did not exist a minute earlier and will not exist a minute later. It is not
 * wrong — it is where the bytes were — it is simply unusable by every reader: a person cannot
 * open it, and the author who must fix the document is looking for the screen's name.
 *
 * ⛔ THE FIX IS A REUSE, NOT A NEW FIELD. `Unloadable` already carries the document's own
 * `title`/`id`, recovered before validation runs, added when the page's alarm had the same defect
 * and Peter asked *"wtf? overview just disappeared?"*. The page was taught to name the screen;
 * `check` — the other surface that reports the same thing — was not. One fix applied to one of two
 * places is how a defect survives being fixed.
 *
 * ⛔ AND THE FALLBACK IS THE BASENAME, NEVER THE FULL PATH. A document too malformed to say what it
 * is called still has to be findable by the author fixing it, and `truth/money.md` is actionable
 * where 94 characters of someone else's temp root is not.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { checkCorpus } = await import("../dist/v2/check.js");

const broken = (dir) => checkCorpus(dir).findings.filter((f) => f.kind === "will-not-parse");

/**
 * A corpus materialized where a hosted one is: a temp directory with no repository above it.
 *
 * ⛔ Built with `temp()` and `mkdirSync`, never `mkdtempSync` — which this suite forbids outright,
 * because 45 of 74 test files once left 58,932 directories in the system temp root and the suite's
 * own litter became the suite's input. The guard caught the first version of this file.
 */
function hostedLike(breakIt) {
  const root = path.join(temp("v2hosted-"), `productos-instance-${Math.abs(breakIt.toString().length)}`);
  const dir = path.join(root, "corpus");
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync("v2-seed", dir, { recursive: true });
  const file = path.join(dir, "truth", "money.md");
  fs.writeFileSync(file, breakIt(fs.readFileSync(file, "utf-8")));
  return dir;
}

test("it names the screen, not the file it happened to be in", () => {
  /** A document that parses as YAML and fails validation — the real case, every time. */
  const dir = hostedLike((t) => t.replace(/^(\s+)role: navigates$/m, "$1role: navigates\n$1leads_to: ''"));
  const found = broken(dir);
  assert.ok(found.length, "the fixture did not break the document, so this proves nothing");
  const where = found[0].where;
  assert.doesNotMatch(where, /^\//, `the refusal names an absolute path: ${where}`);
  assert.doesNotMatch(where, /var\/folders|productos-instance-|\/T\//, `it leaks the temp root: ${where}`);
  assert.match(where, /Money|money/, `it does not name the document: ${where}`);
});

test("a document too malformed to name itself falls back to its basename", () => {
  /** ⛔ Not the whole path. Findable by the author, without a machine-specific temp root. */
  const dir = hostedLike(() => "---\n: : :\n---\n");
  const found = broken(dir);
  assert.ok(found.length, "the fixture did not break the document");
  const where = found[0].where;
  assert.doesNotMatch(where, /var\/folders|productos-instance-/, `it leaks the temp root: ${where}`);
  assert.ok(where.length < 40, `the fallback is not short enough to be a name: ${where}`);
  assert.match(where, /money\.md/, `the fallback does not say which document: ${where}`);
});

test("the reason still travels with it", () => {
  /** ⛔ Naming the screen must not cost the explanation — that trade was the old banner's bug. */
  const dir = hostedLike((t) => t.replace(/^(\s+)role: navigates$/m, "$1role: navigates\n$1leads_to: ''"));
  const found = broken(dir);
  assert.ok(found[0].what && found[0].what.length > 20, "the finding lost its reason");
});
