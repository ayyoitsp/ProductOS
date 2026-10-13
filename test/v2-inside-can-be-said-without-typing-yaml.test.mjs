/**
 * ⛔ `within` HAD NO WRITER AT ALL, SO THE ONLY WAY TO SAY IT WAS TO TYPE YAML.
 *
 * Peter: *"we should be able to know the true navigation, leverage screens within screens, like
 * really a walkable single prototype that can link out to the different areas"*.
 *
 * The field has existed since the walk did. No command, no MCP tool, nothing — so the one relation
 * that turns a pile of screens into a product was reachable only by hand-editing a truth file,
 * which is the trap this project opens its own instructions with. And it shows: the corpus it was
 * built for has `within` on **0 of 17** screens and fifteen front doors.
 *
 * ⛔ WHAT IS PINNED HERE IS NOT "IT WRITES A FIELD". Four things, each of which has a way of being
 * quietly wrong:
 *
 *   1. the corpus still PARSES afterwards — this is line surgery on somebody's truth file, and the
 *      sibling writer in this module has corrupted a corpus twice by getting the block bounds wrong
 *   2. saying it twice REPLACES rather than appends — two `within` on one view will not load
 *   3. a loop is refused, because a walk given one either loops or silently drops a step
 *   4. both ends are resolved, so a hand-typed ref pointing at nothing is caught here and not by a
 *      reader clicking it
 *
 * ⛔ AND IT MUST ACTUALLY CHANGE THE WALK, which is the only assertion that cannot pass while the
 * feature does nothing: a screen that appears inside another is no longer its own front door.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const { loadCorpus } = await import("../dist/v2/load.js");
const { walkOf } = await import("../dist/v2/walk.js");
const { intentNamed } = await import("../dist/v2/intents.js");

const cli = (args) => execFileSync("node", ["dist/cli/index.js", ...args], { encoding: "utf8" });

function corpus() {
  const dir = path.join(temp("v2inside-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}

/** Two views in one scope, so there is something that can hold something. */
const pair = (dir) => {
  const c = loadCorpus(dir);
  const scope = c.scopes.find((e) => (e.scope.views ?? []).length > 1);
  assert.ok(scope, "the seed has no scope with two screens, so this file is not about anything");
  const [a, b] = scope.scope.views;
  return { scope: scope.scope.id, child: `${scope.scope.id}#${a.id}`, holder: `${scope.scope.id}#${b.id}` };
};

test("a containment is one call, and the corpus still parses", () => {
  const dir = corpus();
  const { child, holder } = pair(dir);
  const before = walkOf(loadCorpus(dir)).entries.length;

  const out = cli(["v2", "inside", child, "--of", holder, "--at", dir]);
  assert.match(out, /appears inside/);

  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], "the write left a truth file that will not load");
  const written = c.scopes.flatMap((e) => e.scope.views ?? []).filter((v) => v.within);
  assert.equal(written.length, 1, "exactly one screen should say what it is inside");
  assert.equal(written[0].within, holder);

  /** ⛔ The assertion that cannot pass while the feature does nothing. */
  assert.equal(walkOf(c).entries.length, before - 1, "a contained screen is still its own front door");
});

test("saying it again replaces, rather than writing a second one", () => {
  /** Two `within` on one view will not load at all — "duplicated mapping key". */
  const dir = corpus();
  const { scope, child, holder } = pair(dir);
  const third = (() => {
    const views = loadCorpus(dir).scopes.find((e) => e.scope.id === scope).scope.views;
    return views.length > 2 ? `${scope}#${views[2].id}` : holder;
  })();

  cli(["v2", "inside", child, "--of", holder, "--at", dir]);
  cli(["v2", "inside", child, "--of", third, "--at", dir]);

  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], "saying it twice produced a file that will not load");
  const mine = c.scopes.flatMap((e) => e.scope.views ?? []).filter((v) => v.within);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].within, third, "the second statement did not win");

  const raw = fs.readFileSync(path.join(dir, "truth", `${scope}.md`), "utf-8");
  const onViews = raw.split("\n").filter((l) => /^\s{4}within:/.test(l));
  assert.equal(onViews.length, 1, `${onViews.length} \`within\` lines on views — it appended instead of replacing`);
});

test("⛔ a loop is refused", () => {
  const dir = corpus();
  const { child, holder } = pair(dir);
  cli(["v2", "inside", child, "--of", holder, "--at", dir]);
  let said = "";
  try {
    said = cli(["v2", "inside", holder, "--of", child, "--at", dir]);
  } catch (e) {
    said = String(e.stdout) + String(e.stderr);
  }
  assert.match(said, /would make a loop/, "two screens each inside the other was accepted");
  const c = loadCorpus(dir);
  assert.equal(c.scopes.flatMap((e) => e.scope.views ?? []).filter((v) => v.within).length, 1, "it wrote the loop anyway");
});

test("⛔ a screen cannot appear inside itself", () => {
  const dir = corpus();
  const { child } = pair(dir);
  let said = "";
  try {
    said = cli(["v2", "inside", child, "--of", child, "--at", dir]);
  } catch (e) {
    said = String(e.stdout) + String(e.stderr);
  }
  assert.match(said, /cannot appear inside itself/);
  assert.equal(loadCorpus(dir).scopes.flatMap((e) => e.scope.views ?? []).filter((v) => v.within).length, 0);
});

test("⛔ both ends are resolved — a ref pointing at nothing is caught here, not by a reader", () => {
  const dir = corpus();
  const { child } = pair(dir);
  for (const [a, b, why] of [
    ["no-scope#no-view", child, "the screen being placed"],
    [child, "no-scope#no-view", "the screen it is placed inside"],
  ]) {
    let said = "";
    try {
      said = cli(["v2", "inside", a, "--of", b, "--at", dir]);
    } catch (e) {
      said = String(e.stdout) + String(e.stderr);
    }
    assert.match(said, /no screen "no-scope#no-view"/, `${why} was not resolved`);
  }
  assert.deepEqual(loadCorpus(dir).broken, []);
});

test("with no arguments it reports and writes nothing", () => {
  const dir = corpus();
  const before = fs.readFileSync(path.join(dir, "truth", `${pair(dir).scope}.md`), "utf-8");
  const out = cli(["v2", "inside", "--at", dir]);
  assert.match(out, /0 of \d+ screens say what they appear inside/);
  assert.match(out, /front doors/);
  assert.match(out, /productos v2 inside/, "it does not say how to say one");
  assert.equal(fs.readFileSync(path.join(dir, "truth", `${pair(dir).scope}.md`), "utf-8"), before, "the report wrote to the corpus");
});

test("⛔ the same thing, through the page's door — and the clearing removes the line", () => {
  /**
   * `v2 inside` is a CLI command, which is the defect Peter had just corrected one message earlier:
   * *"I should be able to drive this from the listener/input, right??? why could you possibly need
   * this?"* So the intent is the real surface and this asserts it against the real writer.
   *
   * ⛔ AND CLEARING MUST REMOVE THE LINE, NOT WRITE AN EMPTY ONE. `within: ""` is a reference that
   * resolves to nothing, which `check` refuses — so the obvious implementation of "take it back"
   * would leave the corpus refusing handover for a reason the author could not see.
   */
  const dir = corpus();
  const { child, holder } = pair(dir);
  const who = { kind: "cli", actor: "peter" };
  const ask = { dir, who, pressing: "peter" };
  const inside = intentNamed("inside");
  assert.ok(inside, "there is no `inside` intent, so the page cannot say this");
  assert.equal(inside.gate, "author", "stating containment must not mint consent");

  const put = inside.run(ask, { view: child, of: holder });
  assert.equal(put.ok, true, put.why);
  assert.match(put.detail.join(" "), /ways? into this product now/, "it does not say what changed");
  let c = loadCorpus(dir);
  assert.deepEqual(c.broken, []);
  assert.equal(c.scopes.flatMap((e) => e.scope.views ?? []).filter((v) => v.within).length, 1);

  const back = inside.run(ask, { view: child, of: "" });
  assert.equal(back.ok, true, back.why);
  c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], "clearing left a corpus that will not load");
  assert.equal(c.scopes.flatMap((e) => e.scope.views ?? []).filter((v) => v.within).length, 0, "the containment was not taken back");
  const raw = fs.readFileSync(path.join(dir, "truth", `${pair(dir).scope}.md`), "utf-8");
  assert.doesNotMatch(raw, /^\s{4}within:/m, "it wrote an empty `within` instead of removing the line");

  /** ⛔ And the refusals hold here too, or the page is the way around them. */
  assert.equal(inside.run(ask, { view: child, of: child }).ok, false, "a screen was allowed inside itself");
  assert.equal(inside.run(ask, { view: child, of: "no-scope#no-view" }).ok, false, "a containment in nothing was accepted");
  inside.run(ask, { view: child, of: holder });
  assert.match(inside.run(ask, { view: holder, of: child }).why ?? "", /loop/, "a loop was accepted through the page");
});
