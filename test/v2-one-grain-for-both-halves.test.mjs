/**
 * ⛔ A FRACTION WHOSE HALVES COUNT DIFFERENT THINGS.
 *
 * The overview renders `"${agreed} of ${agreed + gated.length} behaviours have been agreed to"`,
 * where `agreed` counted accept VERDICT ROWS at any grain — exchange, slot, statement, rule — and
 * `gated` counts EXCHANGES. So the numerator and the denominator were never counting the same kind
 * of thing, and the word "behaviours" described only one of them.
 *
 * ⛔ WHY IT MATTERS NOW AND NOT BEFORE. Peter has confirmed acceptance is per-ref: one press on an
 * exchange writes one ordinary acceptance per sentence beneath it. The moment that lands, a single
 * press turns one verdict row into nine — so a figure that counts rows against exchanges does not
 * drift, it multiplies. The seed would read "17 of 20" where it read "2 of 5".
 *
 * Found by the agent building the per-ref press, which could not fix it because the page was
 * another agent's file.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { loadCorpus } from "../dist/v2/load.js";
import { actsFor } from "../dist/v2/grid.js";
import { coveredBy } from "../dist/v2/stamp.js";

/** The seed, plus acceptances recorded against whatever refs we name. */
function seedAccepting(...refs) {
  const dir = temp("one-grain-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const corpus = loadCorpus(dir);
  const verdicts = refs.map((ref, i) => {
    const now = coveredBy(corpus, ref);
    assert.ok(now, `${ref} resolves to nothing in the seed — pick a ref that exists`);
    return {
      kind: "accept",
      by: "peter",
      at: "2026-10-16",
      target: ref,
      via: "page",
      covers_slots: now.slots,
      covers_criteria: now.criteria,
      because: `agreeing to ${ref}, with a reason long enough to clear the floor`,
      resolves: [],
    };
  });
  /**
   * ⛔ `verdicts:`, AND THE KEY IS THE WHOLE FIXTURE. The first version wrote `accepts:` — invented,
   * not copied — so the file parsed to nothing, no acceptance existed, and the test reported the
   * fix as not working. The seed carries no `verdicts/` directory at all, so there was nothing
   * nearby to imitate and nothing to contradict the guess.
   *
   * ⛔ And `via: page`, never `agent`: `stampFor` filters an agent's verdict out at the source, so a
   * fixture built with `via: agent` would record an acceptance that correctly counts for nothing.
   * bilrost's only accept verdict is exactly that, which is why it reads `never`.
   */
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "verdicts", "accepts.yaml"),
    `verdicts:\n${verdicts
      .map((v) =>
        Object.entries(v)
          .map(([k, val], i) => `  ${i === 0 ? "- " : "  "}${k}: ${Array.isArray(val) ? "[]" : JSON.stringify(val)}`)
          .join("\n"),
      )
      .join("\n")}\n`,
  );
  const out = loadCorpus(dir);
  assert.equal(out.verdicts.filter((v) => v.kind === "accept").length, refs.length, "the fixture's verdicts did not load");
  return out;
}

test("⛔ what is agreed and what is gated are counted at the same grain", () => {
  /**
   * One press on one SENTENCE. `gated` counts exchanges, so if the agreed half counts verdict rows
   * the two are incomparable — and the fraction claims a behaviour was agreed when a sentence was.
   */
  const ref = "money#record-earning#answer";
  const c = seedAccepting(ref);
  const a = actsFor(c);

  assert.ok(Array.isArray(a.agreed), "actsFor does not report what has been agreed, so the page has to invent it");
  /** Every ref it reports is a sentence — three segments — exactly like `written`. */
  for (const r of a.agreed)
    assert.equal(r.split("#").length, 3, `${r} is not a sentence ref, so it cannot be counted against sentences`);
  assert.ok(a.agreed.includes(ref), "the accepted sentence is not in the agreed list");
});

test("agreed and owed partition the settled sentences, with nothing counted twice", () => {
  /**
   * ⛔ THE PROPERTY THAT MAKES A FRACTION HONEST. A settled sentence is either agreed or owed, never
   * both and never neither — so `agreed + owed` is a denominator that means something.
   */
  const ref = "money#record-earning#answer";
  const c = seedAccepting(ref);
  const a = actsFor(c);
  const both = a.agreed.filter((r) => a.written.includes(r));
  assert.deepEqual(both, [], "a sentence is being counted as agreed AND as owed");
});

test("a corpus nobody has agreed to reports nothing agreed", () => {
  /**
   * ⛔ The zero side. CLAUDE.md: a zero is not a check unless you can say what a failing zero looks
   * like — so this is asserted beside the non-zero case above, never alone.
   */
  const dir = temp("one-grain-none-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const a = actsFor(loadCorpus(dir));
  assert.deepEqual(a.agreed, [], "a pristine corpus reports sentences as agreed");
  assert.ok(a.written.length > 0, "the pristine seed reports nothing owed either, so this proves nothing");
});
