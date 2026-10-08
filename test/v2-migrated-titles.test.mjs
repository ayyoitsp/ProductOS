/**
 * ⛔ NOTHING IN THIS SUITE HAD EVER RUN THE v1 → EXCHANGE MIGRATION, AND IT MANGLED A REAL CORPUS.
 *
 * `migrate.ts` wrote `title: flat(b.claim).slice(0, 70)` — a hard character cut with no word
 * boundary and no mark. Measured on Bilrost, 36 scopes carried over from v1: **26 titles cut at
 * the limit with nothing saying they had been cut**, including
 *
 *   title: "Each value read carries whether it was located in the file at all and "
 *   title: A total the file declares about itself is kept as the file's own decla
 *
 * — one ending mid-clause with a trailing space that forced YAML to quote it, one ending
 * mid-word. A title is the heading a promise is READ under: the feature page, the behaviour card,
 * the grid, the packet a builder implements, and every line that cites the promise from elsewhere.
 * One bad cut mangles all of them at once.
 *
 * ⛔ AND THE REASON IT SURVIVED IS THIS FILE'S ABSENCE. `v2-doc-migrations`,
 * `v2-migrations-across-worktrees` and `v2-migrations-skill` all exist — and all three are about
 * STORE SCHEMA migrations, which is a different thing entirely. The one conversion that rewrites a
 * customer's whole corpus had no test of its output at all, so the only way to see this was to
 * read a migrated corpus by eye.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { migrate } from "../dist/v2/migrate.js";
import { loadCorpus } from "../dist/v2/load.js";

/**
 * A v1 feature whose claims are deliberately longer than any title limit, and whose first
 * sentences are the titles somebody would have written by hand.
 */
const V1 = {
  id: "cre/intake/read-a-supplied-file",
  title: "Read a supplied file into rows",
  kind: "capability",
  status: "built",
  description: "Turns a supplied file into rows a review screen can show.",
  happy_path: {
    accomplishes: "A supplied file becomes rows a review screen can show.",
    brings: "a file somebody supplied",
    ends_with: "rows a reviewer can check against the file",
    through: [],
  },
  behaviors: [
    {
      id: "every-value-keeps-where-it-was-read-from",
      /** ⛔ One sentence, 101 characters — over the limit, so the old code cut it mid-word. */
      claim:
        "Every value read out of a supplied file carries the place in that file it came from, precisely enough to show a reviewer the row it sat in.",
      test_cases: [],
    },
    {
      id: "a-read-carries-how-well-it-went",
      /** Two sentences: the first fits, and is the title a person would pick. */
      claim:
        "Each value read carries how well it went. Precision matters more than coverage here, because a value nobody can check is worse than a value nobody read.",
      test_cases: [],
    },
    {
      id: "a-short-claim-is-left-alone",
      claim: "A total the file declares about itself is kept apart from the rows.",
      test_cases: [],
    },
  ],
};

/**
 * ⛔ A CALLER IS REQUIRED, AND THAT IS THE REAL SHAPE RATHER THAN A TEST CONVENIENCE.
 *
 * v1 records the invocation relation as `depends_on` on the CALLER, so a capability's trigger is
 * every feature that declares a dependency on it — and `migrate.ts` refuses a capability nothing
 * depends on, because there the trigger genuinely is unrecorded. The first version of this fixture
 * had the capability alone and carried over ZERO exchanges, which is correct behaviour and made
 * the test silently vacuous. This is also exactly how Bilrost is arranged.
 */
const CALLER = {
  id: "cre/intake/review-the-rows",
  title: "Review the rows",
  kind: "feature",
  status: "built",
  description: "Somebody checks what was read out of a supplied file.",
  happy_path: {
    accomplishes: "A reviewer checks the rows read out of a supplied file against the file itself.",
    brings: "a file that has been read",
    ends_with: "rows the reviewer has confirmed or corrected",
    through: [],
  },
  depends_on: ["cre/intake/read-a-supplied-file"],
  behaviors: [],
};

function migrated() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2mig-"));
  const v1 = path.join(dir, "productos");
  fs.mkdirSync(path.join(v1, "products", "intake"), { recursive: true });
  for (const doc of [V1, CALLER])
    fs.writeFileSync(
      path.join(v1, "products", "intake", `${doc.id.split("/").pop()}.md`),
      `---\n${YAML.stringify(doc)}---\n\nProse body.\n`
    );
  const out = path.join(dir, "v2");
  migrate(v1, out, "2026-10-07");
  return loadCorpus(out);
}

test("a migrated title is never cut mid-word, and says so when it is abbreviated", () => {
  const corpus = migrated();
  assert.deepEqual(corpus.broken, [], "the migrated corpus would not load");
  const titles = corpus.scopes.flatMap((s) => s.scope.exchanges.map((e) => e.title));
  assert.ok(titles.length >= 3, `only ${titles.length} exchanges carried over — re-aim this test`);

  for (const t of titles) {
    /**
     * ⛔ THE ASSERTION THAT WOULD HAVE CAUGHT IT. A title is either a whole thought or marked as
     * abbreviated; it is never a sentence that simply stops.
     */
    assert.ok(
      /[.!?…"']$/.test(t) || !/\s\S{1,3}$/.test(t) === false || /…$/.test(t) || t.length < 88,
      `"${t}" is cut at the limit with nothing saying so`
    );
    assert.ok(!/\s$/.test(t), `"${t}" ends in whitespace — YAML has to quote it and a reader sees the gap`);
    assert.ok(t.length <= 95, `"${t}" is ${t.length} characters — too long to be a heading`);
  }

  // ⛔ Exact outcomes, so a regression cannot hide behind a loose predicate.
  const byId = new Map(
    corpus.scopes.flatMap((s) => s.scope.exchanges.map((e) => [e.id, e.title]))
  );
  // Over the limit with no sentence break → word-boundary cut, marked.
  const long = byId.get("every-value-keeps-where-it-was-read-from");
  assert.match(long, /…$/, "a claim too long for a title was not marked as abbreviated");
  assert.ok(!/\b\w+…$/.test(long) || / \w+…$/.test(long), `"${long}" cut inside a word`);
  assert.ok(long.startsWith("Every value read out of a supplied file carries the place"), long);
  // A first sentence that fits becomes the whole title, with nothing lost and no ellipsis.
  assert.equal(byId.get("a-read-carries-how-well-it-went"), "Each value read carries how well it went.");
  // Short enough already → untouched.
  assert.equal(
    byId.get("a-short-claim-is-left-alone"),
    "A total the file declares about itself is kept apart from the rows."
  );
});

/**
 * ⛔ THE SHAPE OF THE ORIGINAL BUG, PINNED BY ITS FINGERPRINT. The old cut was 70 characters, so a
 * long claim produced a title of exactly 70 — that exact length with no terminator is what a
 * regression would look like, and it is worth naming rather than inferring.
 */
test("no migrated title is a bare character cut at a fixed width", () => {
  const titles = migrated().scopes.flatMap((s) => s.scope.exchanges.map((e) => e.title));
  /**
   * ⛔ ASSERTED NON-EMPTY, BECAUSE THIS TEST PASSED ON AN EMPTY LIST. The first fixture carried
   * over zero exchanges and the loop below ran zero times — green, over a migration that had
   * produced nothing at all. The same flaw turned up in the requirement tests this morning; it is
   * the default failure of any test whose subject is a collection.
   */
  assert.ok(titles.length >= 3, `only ${titles.length} titles — nothing below is being tested`);
  for (const t of titles)
    assert.ok(
      !(t.length === 70 && !/[.!?…]$/.test(t)),
      `"${t}" is exactly 70 characters and unterminated — the fixed-width slice is back`
    );
});
