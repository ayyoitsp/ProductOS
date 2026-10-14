/**
 * ⛔ TWO FINDINGS THAT FIRED ON THE SYSTEM'S OWN CORRECT OUTPUT.
 *
 * Both were found by authors indexing a second product line into a 127-scope corpus, and both were
 * reported independently by six of them — which is the only reason they were believed. An author
 * who sees `check` blame them for what a generator wrote learns that `check` is noise, and that is
 * the one thing it cannot afford to be.
 *
 * ⛔ 1. `reading-bears-on-nothing` ON EVERY GENERATED READING. `draw-write.ts` emits
 *       `bears_on: <scope>#<view>` on each reading it creates — the right answer, because an
 *       observation about a DRAWING is about one screen rather than a whole feature. The resolver
 *       took slots, exchanges, scopes and rules and not views, so 62 of them were reported as
 *       resolving to nothing. Every author correctly refused to hand-edit a generated file to
 *       silence it, so the findings just accumulated.
 *
 * ⛔ 2. `an-access-model-this-product-does-not-use` ON A CORPUS THAT PLAINLY HAS ONE. The model came
 *       only from `exchange.access` in a config file found by walking UP from the corpus root — and
 *       a hosted instance materializes a project into a temp directory with no repository above it.
 *       So on every hosted corpus the answer was `neither`, forever, and no author could fix it:
 *       `access.yaml` is carried by `corpusFiles` precisely so it reaches the store, while the
 *       declaration that it exists stayed behind.
 *
 * ⛔ WHAT THESE TESTS MUST NOT DO IS GO QUIET. A fix that makes a resolver accept everything removes
 * the finding and the check together, so each one here asserts a NON-ZERO on something genuinely
 * broken beside the zero on something correct. The first attempt at this reported `0` findings from
 * a fixture that did not parse — the corpus short-circuited, and the zero measured nothing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");
const seed = () => {
  const dir = path.join(temp("bears-on-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  return dir;
};
const check = (dir) => {
  try {
    return execFileSync("node", [CLI, "v2", "check", "--at", dir], { encoding: "utf-8" });
  } catch (e) {
    return `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
};
/** ⛔ A short-circuited corpus reports nothing about anything — so prove it parsed before counting. */
const parsed = (out) => {
  assert.doesNotMatch(out, /will-not-parse/, "the fixture did not parse, so every count below is meaningless");
  assert.doesNotMatch(out, /cannot-judge-this-corpus/, "the corpus short-circuited, so every count below is meaningless");
  return out;
};
const reading = (id, ref) => `
  - id: ${id}
    bears_on: ${ref}
    observes: >
      A fixture written to exercise the resolver, not a real observation of anybody using
      anything, and it says so in case it is ever read as evidence.
    basis:
      kind: trial
      ref: a fixture
      at: 2026-10-13
`;

test("a reading may bear on a view, which is what the generator writes", () => {
  const dir = seed();
  /** ⛔ A scope that actually HAS a view — not every one does, and picking blind made this throw. */
  let id, view;
  for (const f of fs.readdirSync(path.join(dir, "truth")).filter((f) => f.endsWith(".md"))) {
    const src = fs.readFileSync(path.join(dir, "truth", f), "utf-8");
    const at = src.indexOf("views:");
    if (at < 0) continue;
    const sid = /^id:\s*(\S+)/m.exec(src);
    const vid = /^\s*- id:\s*(\S+)/m.exec(src.slice(at));
    if (sid && vid) { id = sid[1]; view = vid[1]; break; }
  }
  assert.ok(id && view, "the seed corpus has no scope with a view, so this test cannot run");

  fs.writeFileSync(
    path.join(dir, "readings", "probe.yaml"),
    "readings:" + reading("probe-a-real-view", `${id}#${view}`) + reading("probe-a-dangling-view", `${id}#no-such-view-at-all`)
  );
  const out = parsed(check(dir));

  /**
   * ⛔ THE NON-ZERO FIRST. A resolver taught to accept anything would pass the assertion below and
   * have stopped checking, which is worse than the finding it replaced.
   */
  assert.match(out, /probe-a-dangling-view/, "a ref naming nothing was accepted — the check has gone blind");
  assert.match(out, /no-such-view-at-all", which does not exist/, "the refusal no longer says what did not resolve");
  assert.doesNotMatch(
    out,
    /probe-a-real-view/,
    "a reading bearing on a real view is still reported as resolving to nothing — this is what fired 62 times"
  );
});

test("a non-empty access list is itself the declaration, because the config cannot travel", () => {
  const dir = seed();
  /**
   * ⛔ NO CONFIG ANYWHERE ABOVE THIS DIRECTORY, which is the hosted case exactly: an instance
   * materializes a project into a temp directory and `resolvePathsOrThrow` finds nothing.
   */
  fs.writeFileSync(
    path.join(dir, "access.yaml"),
    `access:
  - id: may-read-the-deals
    kind: permission
    means: See the lender's own deals and what has been read out of their documents.
`
  );
  /**
   * ⛔ NAME THE PERMISSION SOMEWHERE, AND PROVE IT LANDED.
   *
   * The first version of this test injected `held_by` only if it happened to find a `may:` slot,
   * and passed when it did not — so it passed with the fix REVERTED, which makes it worse than no
   * test. The finding only fires on a `may` that names something, so the injection is the
   * precondition and is asserted.
   */
  let named = 0;
  for (const f of fs.readdirSync(path.join(dir, "truth")).filter((f) => f.endsWith(".md"))) {
    const at = path.join(dir, "truth", f);
    const src = fs.readFileSync(at, "utf-8");
    if (!src.includes("      may:")) continue;
    fs.writeFileSync(at, src.replace("      may:", "      may:\n        held_by: [may-read-the-deals]"));
    named++;
  }
  assert.ok(named > 0, "no `may:` slot was found to name the permission on — the assertion below would pass vacuously");

  const out = parsed(check(dir));
  assert.doesNotMatch(
    out,
    /an-access-model-this-product-does-not-use/,
    "a corpus carrying a permission list was told it has no access model — on a hosted corpus this was unfixable"
  );
});

test("an empty access list still leaves the question to the config", () => {
  const dir = seed();
  /**
   * ⛔ THE DISTINCTION THE CONFIG EXISTS FOR IS KEPT. An absent list is genuinely ambiguous —
   * a product with no roles, or a corpus nobody has got to yet — and only a person can say which.
   * Deriving from emptiness would answer that on their behalf.
   */
  fs.writeFileSync(path.join(dir, "access.yaml"), "access: []\n");
  const out = parsed(check(dir));
  assert.doesNotMatch(out, /will-not-parse/, "an empty access list should still load");
});
