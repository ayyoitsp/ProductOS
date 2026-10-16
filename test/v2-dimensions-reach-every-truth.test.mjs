/**
 * ⛔ A DIMENSION REACHES EVERY FEATURE, AND EVERY TRUTH INSIDE ONE.
 *
 * Peter: *"we need dimensions to carry through to all features, so we can have different variations
 * PER feature. and the dimensions should affect the truths as well"*.
 *
 * Dimensions arrived as `splits_on` in `prototypes.yaml`, where a dimension could only pick one of a
 * handful of whole walkthroughs. A product that genuinely differs by role differs per FEATURE, in
 * what each one promises — so the home moves to the product, and one field (`holds_for`) says which
 * combination a screen or a sentence is for.
 *
 * ⛔ THE DEFAULT IS THE LOAD-BEARING PART, AND IT IS ASSERTED FIRST. Unsaid means EVERYWHERE, never
 * nowhere: a truth with no `holds_for` holds under every combination. The opposite default would
 * silently empty every feature of any corpus that declared a dimension, which is the whole installed
 * base — so that is tested before anything the feature adds.
 *
 * ⛔ AND THE DANGEROUS CASE IS A TYPO, WHICH FAILS IN THE SAFE-LOOKING DIRECTION. A dimension id is a
 * free-text key, so `roles: admin` is a dimension nobody declared — and a dimension nobody asked
 * about excludes nothing, so the variant does not disappear, it quietly becomes universal. A screen
 * meant for one role gets shown to all of them with nothing saying so. That is why `check` refuses
 * it, and why that refusal is tested in both directions here.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import("../dist/v2/load.js");
const { parseFrontmatter } = await import("../dist/core/frontmatter.js");
const { checkCorpus } = await import("../dist/v2/check.js");
const { holdsUnder, dimensionsOf, variesBy, variantsIn, unknownHolds, sayCombination } = await import(
  "../dist/v2/dimensions.js"
);

/**
 * The seed, with dimensions declared on the product and one feature given a per-role screen.
 *
 * ⛔ EDITED THROUGH THE LOADER'S OWN PARSER, not a regex of mine. My own frontmatter regex required a
 * closing fence and a body the seed's scope files do not have — a second parser disagreeing with the
 * first is a defect this repo has already had.
 */
function corpusWith({ dims, holdsFor } = {}) {
  const dir = path.join(temp("v2dims-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });

  const files = fs.readdirSync(path.join(dir, "truth"));
  const edit = (file, change) => {
    const at = path.join(dir, "truth", file);
    const parsed = parseFrontmatter(fs.readFileSync(at, "utf-8"));
    const front = { ...parsed.data };
    change(front);
    const body = parsed.content.trim();
    fs.writeFileSync(at, `---\n${YAML.stringify(front)}---\n${body ? `\n${body}\n` : ""}`);
  };

  /** The product is the scope with no `in`. */
  const rootFile = files.find((f) => {
    const front = parseFrontmatter(fs.readFileSync(path.join(dir, "truth", f), "utf-8")).data;
    return front && !front.in;
  });
  assert.ok(rootFile, "the seed has no product-level scope");
  if (dims) edit(rootFile, (front) => void (front.dimensions = dims));

  /** A feature with screens, so a variant has somewhere to live. */
  const withViews = files.find((f) => {
    const front = parseFrontmatter(fs.readFileSync(path.join(dir, "truth", f), "utf-8")).data;
    return front && (front.views ?? []).length > 0;
  });
  assert.ok(withViews, "the seed has no feature with a screen");
  let varied;
  if (holdsFor) {
    edit(withViews, (front) => {
      front.views[0] = { ...front.views[0], holds_for: holdsFor };
      varied = front.id;
    });
  } else {
    varied = parseFrontmatter(fs.readFileSync(path.join(dir, "truth", withViews), "utf-8")).data.id;
  }

  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], `the fixture does not load: ${JSON.stringify(c.broken)}`);
  return { dir, corpus: c, varied };
}

const ROLES = [
  { id: "role", label: "Role", values: ["admin", "loan processor"] },
  { id: "line", label: "Product line", values: ["CRE", "private lending"] },
];

test("⛔ unsaid means everywhere — the default the installed base depends on", () => {
  /**
   * Three readings of one predicate, because the asymmetry is the whole design: a truth that says
   * nothing is never excluded, a reader who asks nothing excludes nothing, and only a stated
   * disagreement excludes.
   */
  assert.equal(holdsUnder(undefined, {}), true, "a truth with no combination was excluded");
  assert.equal(holdsUnder(undefined, { role: "admin" }), true, "an unqualified truth was hidden from a reader");
  assert.equal(holdsUnder({ role: "admin" }, {}), true, "a variant was hidden from a reader who asked for nothing");
  assert.equal(holdsUnder({ role: "admin" }, { role: "admin" }), true, "a matching variant was excluded");
  /** ⛔ The one case that excludes. Without this the predicate is `true` and proves nothing. */
  assert.equal(holdsUnder({ role: "admin" }, { role: "loan processor" }), false, "a disagreeing variant was shown");
  /** A dimension the truth is silent about does not exclude it, even when the reader chose one. */
  assert.equal(holdsUnder({ role: "admin" }, { role: "admin", line: "CRE" }), true, "silence on a second dimension excluded");
});

test("⛔ the product declares the dimensions, and the older spelling still reads", () => {
  const { corpus } = corpusWith({ dims: ROLES });
  const dims = dimensionsOf(corpus);
  assert.deepEqual(
    dims.map((d) => d.id),
    ["role", "line"],
    "the product's dimensions are not what the product declared"
  );
  assert.deepEqual(dims[0].values, ["admin", "loan processor"]);

  /** ⛔ A corpus with no product dimensions falls back to `splits_on`, so nothing already written breaks. */
  const { dir } = corpusWith({});
  fs.writeFileSync(
    path.join(dir, "prototypes.yaml"),
    ["splits_on:", "  - id: role", "    label: Role", "    values: [admin]", "prototypes: []", ""].join("\n")
  );
  const older = dimensionsOf(loadCorpus(dir));
  assert.deepEqual(
    older.map((d) => d.id),
    ["role"],
    "a corpus using the older spelling lost its dimensions"
  );
});

test("⛔ a feature says what it varies by, derived from what is actually there", () => {
  /**
   * ⛔ DERIVED, NEVER DECLARED. A feature does not announce "I vary by role"; it either has truths
   * that differ by role or it does not. Asserted in both directions, because "varies by nothing" is
   * also what a build that cannot read `holds_for` at all reports.
   */
  const plain = corpusWith({ dims: ROLES });
  assert.deepEqual(variesBy(plain.corpus, plain.varied), [], "a feature with no variants claims to vary");

  const split = corpusWith({ dims: ROLES, holdsFor: { role: "admin" } });
  const by = variesBy(split.corpus, split.varied);
  assert.deepEqual(
    by.map((d) => d.id),
    ["role"],
    "a feature with a per-role screen does not report varying by role"
  );
  assert.deepEqual(variantsIn(split.corpus, split.varied), [{ role: "admin" }], "the variant itself is not reported");
  assert.equal(sayCombination({ role: "admin" }, by), "Role admin", "the combination does not read as a person would");
});

test("⛔ a screen that holds for one role is hidden from another, and shown to nobody in particular", () => {
  /**
   * The feature as a reader meets it: the same corpus answers differently for two readers, and
   * answers with everything for a reader who has not chosen.
   */
  const { corpus, varied } = corpusWith({ dims: ROLES, holdsFor: { role: "admin" } });
  const views = corpus.scopes.find((e) => e.scope.id === varied).scope.views;
  assert.ok(views.length >= 1, "the fixture's feature has no screens");

  const shown = (asked) => views.filter((v) => holdsUnder(v.holds_for, asked)).map((v) => v.id);
  const all = views.map((v) => v.id);

  assert.deepEqual(shown({}), all, "a reader who chose nothing was shown less than everything");
  assert.deepEqual(shown({ role: "admin" }), all, "the admin was not shown the admin's screen");
  /** ⛔ The reading that distinguishes this from a feature that does nothing. */
  assert.notDeepEqual(shown({ role: "loan processor" }), all, "the processor was shown the admin's screen");
  assert.equal(shown({ role: "loan processor" }).includes(views[0].id), false, "the variant leaked to another role");
});

test("⛔ check refuses a combination the product never declared", () => {
  /**
   * ⛔ THE SILENT FAILURE. `roles` is not `role`, and a dimension nobody declared excludes nothing —
   * so without this the variant quietly holds under every combination and the screen meant for one
   * role is shown to all of them.
   */
  const { dir } = corpusWith({ dims: ROLES, holdsFor: { roles: "admin" } });
  const found = checkCorpus(dir).findings.find((f) => f.kind === "a-variant-names-an-undeclared-dimension");
  assert.ok(found, "an undeclared dimension is accepted, so a typo makes a variant universal in silence");
  assert.match(found.what, /roles/, "the refusal does not name the dimension that is wrong");
  assert.match(found.fix, /role/, "the refusal does not name the dimensions the product does have");
  assert.equal(found.severity, "refuse", "a variant shown to everybody by accident is only a note");

  /** ⛔ And the correct spelling is NOT refused — the matcher is not simply firing on everything. */
  const fine = corpusWith({ dims: ROLES, holdsFor: { role: "admin" } });
  assert.deepEqual(
    checkCorpus(fine.dir).findings.filter((f) => f.kind.startsWith("a-variant-names-")),
    [],
    "a correctly spelled variant is refused"
  );
});

test("⛔ check refuses a value the dimension does not have, and only where values are declared", () => {
  const { dir } = corpusWith({ dims: ROLES, holdsFor: { role: "auditor" } });
  const found = checkCorpus(dir).findings.find((f) => f.kind === "a-variant-names-an-undeclared-value");
  assert.ok(found, "a value the dimension never listed is accepted");
  assert.match(found.what, /auditor/, "the refusal does not name the value that is wrong");
  assert.match(found.fix, /admin/, "the refusal does not name the values that would work");

  /**
   * ⛔ A DIMENSION WITH NO VALUES CANNOT JUDGE A VALUE. Saying otherwise would refuse every corpus
   * mid-authoring — somebody names a dimension before they have listed what it can be.
   */
  const open = corpusWith({ dims: [{ id: "role", label: "Role", values: [] }], holdsFor: { role: "anything" } });
  assert.deepEqual(
    checkCorpus(open.dir).findings.filter((f) => f.kind === "a-variant-names-an-undeclared-value"),
    [],
    "a dimension with no declared values is judging its values anyway"
  );
  /** But the dimension itself is still known, so that is not refused either. */
  assert.deepEqual(unknownHolds(open.corpus), [], "a half-authored dimension is reported as unknown");
});
