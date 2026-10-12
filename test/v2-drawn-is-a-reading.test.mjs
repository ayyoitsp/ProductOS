/**
 * ⛔ A SCREEN DRAWN FROM A COMPONENT IS AN OBSERVATION, AND NOTHING WAS RECORDING IT.
 *
 * `v2 draw` already knew the component path and the commit it was at — `Provenance { from, at }`,
 * which is a `Reading.basis` in all but name — and put both only into the drawing's provenance. So
 * the one unit of support the confidence scale counts had to be hand-written, which is a large part
 * of why `readings/` was empty in every corpus including the one being reviewed.
 *
 * `CLAUDE.md`: if it can be generated, generate it. A typed artefact cannot be re-derived when the
 * source changes, so it is wrong the day after it is written.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const { loadCorpus } = await import("../dist/v2/load.js");
const { confidenceOf, whyConfident } = await import("../dist/v2/confidence.js");

const COMPONENT = `export function Balance({ total }: { total: string }) {
  return (<section><h1>Balance</h1><p className="total">{total}</p><button type="submit">Record earning</button></section>);
}
`;

/** A seed corpus, and a component in a real git repo so provenance resolves. */
function drawn() {
  const root = temp("v2drawn-");
  const corpusDir = path.join(root, "corpus");
  const compDir = path.join(root, "app");
  fs.cpSync("v2-seed", corpusDir, { recursive: true });
  fs.mkdirSync(compDir, { recursive: true });
  fs.writeFileSync(path.join(compDir, "Balance.tsx"), COMPONENT);
  const git = (...a) => execFileSync("git", ["-C", compDir, ...a], { stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "a component");

  const view = loadCorpus(corpusDir).scopes.find((s) => s.scope.id === "money").scope.views[0].id;
  execFileSync(
    "node",
    ["dist/cli/index.js", "v2", "draw", `money#${view}`, "--route", path.join(compDir, "Balance.tsx"), "--into", corpusDir],
    { stdio: "ignore" },
  );
  return { root, corpusDir, view };
}

const { root, corpusDir, view } = drawn();

test("drawing a screen records a reading that loads", () => {
  const file = path.join(corpusDir, "readings", `drawn-money-${view}.yaml`);
  assert.ok(fs.existsSync(file), "no reading was written beside the drawing");
  const corpus = loadCorpus(corpusDir);
  assert.deepEqual(corpus.broken, [], "the generated reading does not parse");
  const r = corpus.readings.find((x) => x.id === `drawn-money-${view}`);
  assert.ok(r, "the reading is on disk and did not load");
  assert.equal(r.bears_on, `money#${view}`);
  assert.equal(r.basis.kind, "screen");
  assert.match(r.basis.ref, /Balance\.tsx/, "the pointer does not name the component, so nobody can go and look");
  assert.match(r.basis.quote ?? "", /^at commit [0-9a-f]{7,}/, "the commit is not recorded");
});

test("it counts as support, and the page can say where it came from", () => {
  const corpus = loadCorpus(corpusDir);
  const c = confidenceOf(corpus, `money#${view}`);
  assert.equal(c.sources, 1);
  assert.equal(c.strength, "one-source");
  /** ⛔ AND IT CONFIRMS NOTHING. It is support, below the line, which only a person's act crosses. */
  assert.equal(c.confirmed, null, "a generated reading produced a confirmation");
  assert.match(whyConfident(corpus, `money#${view}`).join("\n"), /Read from screen at .*Balance\.tsx/);
});

test("⛔ what it observes is narrow — the screen is rendered by that component, and nothing more", () => {
  /**
   * A generator that wrote "this behaviour is correct" would be software asserting truth, which is
   * the boundary this project holds everywhere else. `kind: screen` means what it says: this is what
   * the product renders, not that anybody agrees it should.
   */
  const r = loadCorpus(corpusDir).readings.find((x) => x.id === `drawn-money-${view}`);
  assert.match(r.observes, /is rendered by/);
  assert.doesNotMatch(r.observes, /correct|right|should|agreed|confirmed/i);
});

test("no provenance, no reading — it is never guessed", () => {
  /**
   * `Provenance.at` is documented as absent where the repo could not be read, never guessed. A
   * component outside a git repo therefore yields no provenance, and a reading invented without a
   * checkable pointer would be the opposite of the point.
   */
  const dir = temp("v2nogit-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const loose = path.join(dir, "Loose.tsx");
  fs.writeFileSync(loose, COMPONENT);
  execFileSync("node", ["dist/cli/index.js", "v2", "draw", `money#${view}`, "--route", loose, "--into", dir], {
    stdio: "ignore",
  });
  assert.ok(
    !fs.existsSync(path.join(dir, "readings", `drawn-money-${view}.yaml`)),
    "a reading was written with no provenance behind it",
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test("redrawing replaces the reading rather than adding a second", () => {
  /** ⛔ One id, one file. Two readings about one drawing would read as corroboration of itself. */
  execFileSync(
    "node",
    [
      "dist/cli/index.js", "v2", "draw", `money#${view}`,
      "--route", path.join(root, "app", "Balance.tsx"), "--into", corpusDir,
    ],
    { stdio: "ignore" },
  );
  const corpus = loadCorpus(corpusDir);
  const mine = corpus.readings.filter((x) => x.id === `drawn-money-${view}`);
  assert.equal(mine.length, 1, `redrawing produced ${mine.length} readings for one screen`);
  assert.equal(confidenceOf(corpus, `money#${view}`).sources, 1);
});

test.after(() => fs.rmSync(root, { recursive: true, force: true }));
