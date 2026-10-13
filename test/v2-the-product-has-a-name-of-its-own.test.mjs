/**
 * ⛔ THE PRODUCT'S NAME WAS THE FRAMEWORK'S PLACEHOLDER, IN THE MOST VISIBLE STRING THERE IS.
 *
 * The Bilrost corpus titled its root scope **"Product Truth"**, so every page a reviewer opened was
 * titled after the tool rather than the product. I reported it to Peter twice as something for him
 * to fix and never traced it — which is the real failure, because it is not his corpus being untidy.
 * It is four framework steps:
 *
 *   1. `init` seeds `products/README.md` titled "Product Truth", with "replace me" in the body
 *   2. v1 `check` refuses while the BODY is unreplaced — the guard exists, for the body
 *   3. the v1→v2 migration takes the root scope's title from that README's TITLE
 *   4. v2 `check` had no equivalent guard, so the placeholder name became the product's name
 *
 * CLAUDE.md: *"Nothing a reader sees should mention the storage."* A product named after the
 * documentation tool is the same leak with the substrate swapped for the tool — and three fresh
 * readers landed on the v1 version of this page and concluded the product WAS the documentation
 * tool, which is why step 2 is a refusal rather than a note.
 *
 * ⛔ BOTH ENDS ARE PINNED. The refusal, so a corpus cannot be handed over carrying it; and the
 * migration, so the next corpus does not acquire it in the first place. Fixing only the second
 * leaves every existing corpus wrong; fixing only the first leaves every future one failing a check
 * for something the tool did to them.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

const { checkCorpus } = await import("../dist/v2/check.js");
const { loadCorpus } = await import("../dist/v2/load.js");

/** The seed, with the root scope's title replaced. */
function named(title) {
  const dir = path.join(temp("v2named-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const c = loadCorpus(dir);
  const root = c.scopes.find((e) => !e.scope.in);
  assert.ok(root, "the seed has no root scope, so this test is not about anything");
  const raw = fs.readFileSync(root.file, "utf-8");
  const next = raw.replace(/^title:.*$/m, `title: ${title}`);
  assert.notEqual(next, raw, "the root scope's title was not replaced, so the fixture is a copy of the seed");
  fs.writeFileSync(root.file, next);
  return dir;
}

const fired = (dir) => checkCorpus(dir).findings.filter((f) => f.kind === "the-product-has-no-name-of-its-own");

test("⛔ a product named after this tool is refused", () => {
  for (const placeholder of ["Product Truth", "ProductOS", "The product", "Replace this page", "Untitled"]) {
    const hits = fired(named(placeholder));
    assert.equal(hits.length, 1, `"${placeholder}" was accepted as a product's name`);
    assert.equal(hits[0].severity, "refuse", `"${placeholder}" was reported rather than refused`);
    /** ⛔ The message says what it is, so a reader is not left guessing which string to change. */
    assert.match(hits[0].what, new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(hits[0].fix, /root scope/, "it does not say where the name lives");
  }
});

test("⛔ and it is case- and space-insensitive, or renaming it to 'product truth' passes", () => {
  for (const sneaky of ["  Product Truth  ", "product truth", "PRODUCT TRUTH"]) {
    assert.equal(fired(named(sneaky)).length, 1, `"${sneaky}" slipped through`);
  }
});

test("a product with a name of its own passes", () => {
  /**
   * ⛔ THE HALF THAT STOPS THIS BEING TOO WIDE. A fixture containing only the defect cannot tell you
   * the detector is wrong about everything else — and a check that refuses real product names would
   * be worse than no check.
   */
  for (const real of ["Bilrost", "A kid's money", "Truth or Dare", "Product Hunt"]) {
    assert.deepEqual(fired(named(real)), [], `"${real}" was refused as a placeholder`);
  }
});

test("⛔ only the ROOT is the product's name — a feature may be called anything", () => {
  /**
   * A feature legitimately called "The product" is a feature, not the product. Checking every scope
   * would fire on corpora that are entirely correct, which is the false-positive direction that
   * teaches people to ignore the check.
   */
  const dir = path.join(temp("v2namedleaf-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const c = loadCorpus(dir);
  const leaf = c.scopes.find((e) => e.scope.in);
  assert.ok(leaf, "the seed has no nested scope");
  const raw = fs.readFileSync(leaf.file, "utf-8");
  fs.writeFileSync(leaf.file, raw.replace(/^title:.*$/m, "title: Product Truth"));
  assert.deepEqual(fired(dir), [], "a nested scope was treated as the product's name");
});
