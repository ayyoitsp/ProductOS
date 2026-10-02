/**
 * ⛔ PRODUCT TRUTH DESCRIBES THE PRODUCT, NOT HOW THE DESCRIPTION WAS PRODUCED.
 *
 * Peter, reading the deals list: *"'That was not somebody mis-reading the product. The create route
 * chooses between six unrelated screens… the shape of the mistake is the point' ←--- what is this
 * even for? we should never show this in a product description."*
 *
 * It was mine. I had written a paragraph about a GENERATOR BUG into a feature's prose — why a
 * drawing came out wrong, what the route does, what the mistake taught us — and it rendered to a
 * reader as though it were something about their product.
 *
 * ⛔ THE RULE ALREADY EXISTED AND NOTHING ENFORCED IT. CLAUDE.md says it plainly: nothing a reader
 * sees should mention the storage. Prose with a ⛔ on it did not stop me doing it in the same
 * session as writing the rest of that file. This is the forcing function.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { checkCorpus } = await import(path.resolve("dist/v2/check.js"));

const withProse = (prose) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mach-"));
  fs.mkdirSync(path.join(dir, "truth"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "truth", "a.md"),
    `---\nid: a\ntitle: A thing\nviews: []\nexchanges: []\n---\n\n${prose}\n`
  );
  const found = checkCorpus(dir).findings.filter((f) => f.kind === "prose-about-the-machinery");
  fs.rmSync(dir, { recursive: true, force: true });
  return found;
};

/** ⛔ The actual paragraph, verbatim — not a stand-in for it. */
test("the paragraph he found is refused", () => {
  const real =
    "That was not somebody mis-reading the product. The create route chooses between six unrelated " +
    "screens depending on the project type, and the drawing was taken from the default arm. It is " +
    "recorded because the shape of the mistake is the point: a confident description of the wrong " +
    "screen reads exactly like a right one. For a long time the corpus said it was a wizard.";
  const found = withProse(real);
  assert.equal(found.length, 1, "the paragraph that prompted this check is not caught by it");
  assert.equal(found[0].severity, "refuse", "a reader would still meet it — this must block a handover");
});

test("every shape of the leak is caught", () => {
  for (const prose of [
    "Run productos v2 draw to regenerate this screen.",
    "The sketch_html here was generated from the component.",
    "The generator could not read this, so it is approximate.",
    "See truth/deals.md for the rest of it.",
    "This is product truth about the deals list.",
  ])
    assert.equal(withProse(prose).length, 1, `not caught: ${prose}`);
});

/**
 * ⛔ AND ORDINARY ENGLISH IS NOT A LEAK. "drawing", "scope", "state" and "exchange" are words a
 * product description legitimately uses — a check that fired on them would be deleted within a day,
 * which is worse than no check.
 */
test("a product description that happens to use ordinary words is left alone", () => {
  for (const prose of [
    "The analyst reviews the drawing before the loan is sized.",
    "This is out of scope for the first release.",
    "The deal moves to the screening state once documents arrive.",
    "An exchange of documents happens between the borrower and the lender.",
    "Starting a multifamily deal by hand: its name, its borrower, and the property it is against.",
  ])
    assert.deepEqual(withProse(prose), [], `false positive on: ${prose}`);
});
