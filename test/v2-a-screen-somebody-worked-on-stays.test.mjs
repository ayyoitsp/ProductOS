/**
 * ⛔ THE SWEEP IS THE CHEAPEST THING IN A CORPUS AND IT WAS OVERWRITING THE MOST EXPENSIVE.
 *
 * Peter: *"we should add some internal tracking to screens - when screens haven't had review yet
 * (including product truth), we can freely regenerate. once they have been operated on, they should
 * stay locked. from there, only direct user input changes things."*
 *
 * `v2 draw --all` rewrote every screen it could resolve, every run. That is right while a screen is
 * a first guess and wrong the moment somebody reads one and says something, because from then on
 * the corpus holds a judgement the generator never heard of and cannot reproduce.
 *
 * ⛔ FOUR THINGS HAVE TO HOLD AND THEY FAIL DIFFERENTLY, which is why this is four assertions and
 * not one:
 *
 *   1. an untouched screen is still swept — otherwise the lock has killed the sweep, and the sweep
 *      is the whole reason sixty screens were ever drawn
 *   2. a screen with a note on it is left exactly as it was, byte for byte
 *   3. the generator's OWN readings do not hold a screen — `draw` writes one per run, so counting
 *      every reading would have the first sweep locking the corpus against the second, and `--all`
 *      would go inert after one run with nothing saying why
 *   4. naming the screen still redraws it — *"only direct user input changes things"*, and a lock
 *      that could not be aimed past would leave a reviewed screen unredrawable forever
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const { loadCorpus } = await import("../dist/v2/load.js");
const { holdsOn, isHeld, THE_GENERATOR } = await import("../dist/v2/held.js");

const ONE = `export function Balance({ total }: { total: string }) {
  return (<section><h1>Balance</h1><p className="total">{total}</p><button type="submit">Record earning</button></section>);
}
`;
/** A visibly different component, so a redraw is detectable by its bytes alone. */
const TWO = `export function Balance({ total }: { total: string }) {
  return (<section><h1>Balance and history</h1><p className="total">{total}</p><p>Every earning you have recorded</p><button type="submit">Record earning</button><button type="button">Export</button></section>);
}
`;

/** Bigger again, for the deliberate redraw — see the note where it is used. */
const THREE = `export function Balance({ total }: { total: string }) {
  return (<section><h1>Balance, history and every earning</h1><p className="total">{total}</p><p>Every earning you have recorded, newest first</p><p>Nothing here yet</p><button type="submit">Record earning</button><button type="button">Export</button><button type="button">Print</button></section>);
}
`;

function corpus() {
  const root = temp("v2held-");
  const dir = path.join(root, "corpus");
  const app = path.join(root, "app");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(app, "Balance.tsx"), ONE);
  /**
   * ⛔ ONE REPOSITORY HOLDING BOTH, WHICH IS THE SHAPE THIS RUNS IN. The fixture used to make `app`
   * its own repository beside a corpus in no repository at all. `draw <ref> --route` records
   * `drawn_from` relative to the route's repository, and `draw --all --into <corpus>` resolves it
   * against the corpus's — so in the fixture they were two different roots, the sweep could never
   * find the component again, and this test failed on every machine for a reason no product has.
   */
  const git = (...a) => execFileSync("git", ["-C", root, ...a], { stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "a component");
  return { root, dir, app };
}

const cli = (args, opts = {}) =>
  execFileSync("node", ["dist/cli/index.js", ...args], { encoding: "utf8", ...opts });

const { dir, app } = corpus();
const view = loadCorpus(dir).scopes.find((s) => s.scope.id === "money").scope.views[0].id;
const ref = `money#${view}`;

/** Drawn once, from the first component, so there is something to protect. */
cli(["v2", "draw", ref, "--route", path.join(app, "Balance.tsx"), "--into", dir]);
const drawnOnce = loadCorpus(dir).scopes.find((s) => s.scope.id === "money").scope.views[0].sketch_html;
assert.ok(drawnOnce?.includes("Balance"), "the fixture never drew anything, so nothing below means anything");

test("⛔ the generator's own reading does not hold the screen — or one sweep locks out the next", () => {
  /**
   * `draw` records every run as a reading. This is the trap the whole feature sits next to: derive
   * a lock from readings without asking who wrote them, and `--all` works once and then silently
   * never does anything again.
   */
  const c = loadCorpus(dir);
  const mine = c.readings.find((r) => r.bears_on === ref);
  assert.ok(mine, "draw stopped recording its run as a reading, so this test is no longer about anything");
  assert.equal(mine.basis.by, THE_GENERATOR, "the generated reading does not say a machine made it");
  const v = c.scopes.find((s) => s.scope.id === "money").scope.views[0];
  assert.equal(isHeld(c, "money", v), false, "the generator held the screen against itself");

  /**
   * ⛔ AND IT MUST HOLD FOR A READING DRAWN BEFORE `basis.by` EXISTED, which is every one in every
   * corpus already on disk. On the first real corpus this ran against, all eight holds were exactly
   * this: generated readings with no author, so the feature's opening act would have been to lock
   * eight screens on the strength of the generator's own work. It passed on the fixture and was
   * wrong on the corpus.
   */
  const older = { ...mine, basis: { ...mine.basis, by: undefined } };
  assert.equal(
    isHeld({ ...c, readings: [older] }, "money", v),
    false,
    "a generated reading with no author held the screen — every corpus drawn before today locks itself"
  );
});

test("an untouched screen is still swept — the lock did not kill the sweep", () => {
  fs.writeFileSync(path.join(app, "Balance.tsx"), TWO);
  const out = cli(["v2", "draw", "--all", "--into", dir]);
  const after = loadCorpus(dir).scopes.find((s) => s.scope.id === "money").scope.views[0].sketch_html;
  assert.notEqual(after, drawnOnce, "a screen nobody has touched was left alone");
  assert.match(after, /Balance and history/, "the sweep did not pick up the new component");
  assert.doesNotMatch(out, /left alone/, "it reported holding a screen nobody had worked on");
});

test("a note on the screen leaves it exactly as it was", () => {
  const before = loadCorpus(dir).scopes.find((s) => s.scope.id === "money").scope.views[0].sketch_html;
  cli([
    "v2",
    "notes",
    "add",
    "the total should lead with the currency",
    "--about",
    ref,
    "--by",
    "peter",
    "--at",
    dir,
  ]);

  const c = loadCorpus(dir);
  const v = c.scopes.find((s) => s.scope.id === "money").scope.views[0];
  const held = holdsOn(c, "money", v);
  assert.equal(held.length, 1, "a note about the screen did not hold it");
  assert.equal(held[0].what, "note");

  /** The component moves again. The sweep must now walk past it. */
  fs.writeFileSync(path.join(app, "Balance.tsx"), ONE);
  const out = cli(["v2", "draw", "--all", "--into", dir]);
  const after = loadCorpus(dir).scopes.find((s) => s.scope.id === "money").scope.views[0].sketch_html;
  assert.equal(after, before, "the sweep overwrote a screen somebody had worked on");
  assert.match(out, /left alone/, "it skipped the screen and said nothing — indistinguishable from redrawing it");
  assert.match(out, new RegExp(ref.replace("#", "#")), "the report does not name which screen it held");
});

test("naming it redraws it, and says whose work it is replacing", () => {
  /**
   * *"from there, only direct user input changes things."* Naming the screen IS that input. A lock
   * with no way past it would leave a reviewed screen unredrawable the first time its component
   * changed, which is worse than the overwrite — what a person is owed is being told.
   */
  const before = loadCorpus(dir).scopes.find((s) => s.scope.id === "money").scope.views[0].sketch_html;
  /**
   * ⛔ BIGGER THAN WHAT IS THERE, or this trips the separate guard against a sweep with no
   * `components_dir` flattening a drawing — which would make this test pass for the wrong reason.
   */
  fs.writeFileSync(path.join(app, "Balance.tsx"), THREE);
  const out = cli(["v2", "draw", ref, "--route", path.join(app, "Balance.tsx"), "--into", dir]);
  const after = loadCorpus(dir).scopes.find((s) => s.scope.id === "money").scope.views[0].sketch_html;
  assert.notEqual(after, before, "naming the screen did not redraw it");
  assert.match(out, /somebody has worked on this screen/, "it replaced somebody's work without saying so");
  assert.match(out, /a note by/, "the warning does not say how the screen came to be held");
});

test("⛔ product truth counts too — his parenthetical, and it is the half with no note on it", () => {
  /**
   * *"when screens haven't had review yet (including product truth)"*. A screen with no note can
   * still be one whose every sentence somebody agreed to this morning; redrawing it from a changed
   * component walks the picture away from the agreement underneath it with nothing saying so.
   */
  const { dir: fresh } = corpus();
  const c0 = loadCorpus(fresh);
  const scope = c0.scopes.find((s) => s.scope.id === "money").scope;
  const v = scope.views[0];
  const exchange = scope.exchanges[0];
  assert.ok(exchange, "the seed has no exchange, so there is no truth to agree to");

  /** The screen claims to show one of this scope's sentences… */
  const file = path.join(fresh, "truth", "money", `${scope.id}.yaml`);
  const onDisk = fs.existsSync(file) ? file : null;
  const target = `${exchange.id}#asks`;
  const held = holdsOn(
    { ...c0, verdicts: [{ kind: "accept", by: "peter", at: "2026-10-13", target: `money#${target}`, via: "page", resolves: [], blocked_by: [] }] },
    "money",
    { ...v, shows: [target] }
  );
  assert.equal(held.length, 1, "a verdict on truth the screen shows did not hold the screen");
  assert.equal(held[0].what, "verdict");
  assert.equal(held[0].by, "peter");

  /** …and a verdict on some other scope's truth does not touch it. */
  const elsewhere = holdsOn(
    { ...c0, verdicts: [{ kind: "accept", by: "peter", at: "2026-10-13", target: "other#thing#asks", via: "page", resolves: [], blocked_by: [] }] },
    "money",
    { ...v, shows: [target] }
  );
  assert.equal(elsewhere.length, 0, "an act on unrelated truth held the screen");
  assert.ok(onDisk !== undefined);
});
