/**
 * ⛔ 62.6% OF THE TIME IT TOOK TO SERVE A PAGE WENT INTO ONE PURE FUNCTION, RECOMPUTED PER SCOPE.
 *
 * Peter: *"isn't 10s still pretty slow?"* — about a TTFB that was still 10s after the page itself
 * had gone from 49.8 MB to 2.98 MB.
 *
 * It was, and the cause was not the store and not the machine. Measured on 17.5 MB of REAL Bilrost
 * pulled off the instance — the first time I had timed the real corpus rather than a synthetic one,
 * which is the whole reason this was invisible for a day:
 *
 *     materialize   48ms
 *     loadCorpus   374ms
 *     render      8139ms    ← the page a reader arrives at, 2.01 MB
 *
 * Profiled rather than guessed: `selects` was 6,538ms of self time, `resolveRules` 1,061ms,
 * `lineage` 547ms. `resolveRules` walks every scope x every exchange x every rule, and TWELVE call
 * sites ask for it — `gridFor` once per scope (127 on that corpus), `renderExchanges` once per
 * scope, `stampFor` once per ref. A whole-corpus walk, hundreds of times, to render one section.
 *
 *     render   8139ms → 297ms    (27x)
 *     all of it 29796ms → 1079ms (28x)
 *
 * ⛔ AND THE TEST IS ABOUT STALENESS, NOT SPEED. A memo on a derivation that returns a stale answer
 * is worse than a slow one — the corpus is what somebody is reviewing. So what is asserted here is
 * that the answer is keyed on the corpus OBJECT: the same corpus gets the same answer, and a
 * different corpus gets its own. `loadCorpus` produces a fresh object, so a changed corpus cannot
 * collide with the old one and nothing has to remember to invalidate anything.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");
const { loadCorpus, resolveRules } = await import(path.resolve("dist/v2/load.js"));

/** A seed corpus, which carries rules — without them this file asserts nothing. */
function seed() {
  const dir = path.join(temp("v2resolve-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  return dir;
}

const dir = seed();
const corpus = loadCorpus(dir);

test("the corpus carries rules that reach something, or nothing below is a test", () => {
  assert.ok(corpus.rules.length > 0, "the seed has no rules");
  const r = resolveRules(corpus);
  const reached = [...r.reach.values()].reduce((n, xs) => n + xs.length, 0);
  assert.ok(reached > 0, "no rule reaches any exchange, so there is no derivation here to cache");
});

test("the same corpus is worked out once", () => {
  const a = resolveRules(corpus);
  const b = resolveRules(corpus);
  /**
   * ⛔ IDENTITY, NOT EQUALITY. Deep-equal would pass on a function that recomputed the same answer
   * every time, which is exactly the 8 seconds this removes.
   */
  assert.equal(a, b, "resolveRules returned a different object for the same corpus — it is not memoized");
  assert.equal(a.inherited, b.inherited, "the maps inside it were rebuilt");
});

/**
 * ⛔ THE ONE THAT MATTERS. If two corpora shared an answer, a reviewer would be shown rules that
 * apply to somebody else's product — which is the leak `Rule.in` exists to stop, reintroduced by a
 * cache rather than by a selector.
 */
test("a different corpus gets its own answer", () => {
  const other = loadCorpus(seed());
  assert.notEqual(corpus, other, "the two corpora are the same object, so this proves nothing");

  const a = resolveRules(corpus);
  const b = resolveRules(other);
  assert.notEqual(a, b, "two different corpora were handed one answer — the memo is not keyed on the corpus");
});

/**
 * ⛔ AND A CHANGED CORPUS IS SEEN, which is the staleness question asked the way it actually
 * happens: a rule is edited, the corpus is re-read, and the next reader must get the new answer.
 */
test("a corpus re-read after a rule changes resolves differently", () => {
  const where = seed();
  const before = resolveRules(loadCorpus(where));

  /** Narrow a rule's reach by giving it a home nothing is under. */
  const rules = fs.readdirSync(path.join(where, "rules"));
  assert.ok(rules.length > 0, "the seed wrote no rules to edit");
  const file = path.join(where, "rules", rules[0]);
  const text = fs.readFileSync(file, "utf-8");
  fs.writeFileSync(file, text.replace(/^id: (.*)$/m, "id: $1\nin: nothing-is-under-this"));

  const after = resolveRules(loadCorpus(where));
  const count = (r) => [...r.reach.values()].reduce((n, xs) => n + xs.length, 0);
  assert.notEqual(
    count(after),
    count(before),
    `the edited rule reaches the same ${count(before)} exchanges as before — a re-read corpus was served a cached answer`
  );
});

/** ⛔ The memo must not have changed WHAT it answers, only how often it works it out. */
test("the answer is the same one it always gave", () => {
  const twice = loadCorpus(dir);
  const a = resolveRules(corpus);
  const b = resolveRules(twice);

  /** Two separate reads of the same bytes must agree on every map, key for key. */
  for (const key of ["inherited", "constrained", "contested", "displaced", "reach", "awaiting"]) {
    assert.ok(a[key], `resolveRules no longer returns ${key}`);
    assert.deepEqual(
      [...a[key].keys()].sort(),
      [...b[key].keys()].sort(),
      `${key} differs between two reads of the same corpus`
    );
  }
});
