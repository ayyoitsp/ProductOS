/**
 * ⛔ THE SIXTH ACT HAD NO SURFACE, AND A WHOLE FEATURE COULD NOT BE TAKEN OUT AT ALL.
 *
 * Peter: *"just delete the fucking orphans"* — twelve scopes the carried-tree conversion left at the
 * product root — and then, when told the only route was editing twelve files: *"create a 'delete'
 * interface if you need to, so you odn't touch the files directly"*.
 *
 * Two separate absences, and the first one is the surprising one:
 *
 *   · `withdraw` is in `Act`, in `ACTS`, in `perform`, implemented in `settle`, and the HTTP door
 *     already accepted it — and NOTHING could invoke it. No CLI verb, no intents entry, no MCP
 *     tool. An act nobody could perform, which is why it looked absent.
 *   · and it refused a scope: *"this takes out one statement, one slot, or one whole exchange"*.
 *     The grain Peter was asking about was the only grain missing.
 *
 * ⛔ A FEATURE IS MARKED, NEVER DELETED, AND FOR A DIFFERENT REASON THAN AN EXCHANGE IS. An agreed
 * exchange keeps its id so a verdict does not point at nothing. A feature keeps its id because it is
 * what OTHER documents point at — `depends_on` resolves to it — so deleting the file would turn
 * every reference into a dangling ref and `check` would refuse for the removal itself. `existsOf`
 * already cascades `withdrawn` down the lineage, so marking the feature takes its behaviours with it.
 *
 * ⛔ AND THE MENU HAS TO HONOUR IT, which was a third gap. `exists: withdrawn` was read for a VIEW
 * and for an EXCHANGE and nowhere for a scope, so a feature somebody had taken out still had a row,
 * a tab and an address: a menu entry leading to a page about something gone.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage } from "../dist/v2/page.js";
import { withdraw } from "../dist/v2/settle.js";
import { ACTS } from "../dist/v2/acts.js";

const CLI = path.resolve("dist/cli/index.js");
const seed = () => {
  const dir = temp("v2out-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
};

/**
 * The seed is three scopes — a root and two leaves — which is too small for two of these checks.
 *
 * ⛔ The menu suppresses itself below two rows ("no tree where there is nothing to navigate"), so
 * withdrawing one of two leaves empties it for a reason that has nothing to do with withdrawal; and
 * nothing in the seed NESTS, so the cascade has no second level to reach. Both were my fixture being
 * wrong about the corpus, not the code being wrong — recorded here so the next reader does not
 * re-diagnose it.
 */
const withExtras = () => {
  const dir = seed();
  const add = (id, title, parent) =>
    fs.writeFileSync(
      path.join(dir, "truth", `${id}.md`),
      `---\nid: ${id}\ntitle: ${title}\nin: ${parent}\nexists: kept\n---\n\nAdded so the tree has room.\n`
    );
  add("chores", "Chores", "family-wallet");
  add("allowances", "Allowances", "family-wallet");
  add("one-off-chores", "One-off chores", "chores");
  return dir;
};
const aFeature = (dir) => {
  const c = loadCorpus(dir);
  const leaf = c.scopes.find((s) => s.scope.in && s.scope.exchanges.length);
  assert.ok(leaf, "the seed has no nested feature with behaviours");
  return leaf.scope.id;
};

test("a whole feature can be taken out, and its id stays resolvable", () => {
  const dir = seed();
  const id = aFeature(dir);
  const r = withdraw(dir, id, "claude", new Date("2026-10-26").toISOString().slice(0, 10), "it belongs elsewhere", false);
  assert.ok(r.ok, `withdrawing a feature was refused: ${r.ok ? "" : r.why}`);
  assert.equal(r.mode, "withdrawn", "a feature was DELETED — its id is what other documents point at");

  /** ⛔ The document is still there and still loads; only its standing changed. */
  const after = loadCorpus(dir);
  assert.equal(after.broken.length, 0, `the corpus stopped loading: ${after.broken.map((b) => b.why).join(" | ")}`);
  const still = after.scopes.find((s) => s.scope.id === id);
  assert.ok(still, "the feature vanished from the corpus — a reference to it would now dangle");
  assert.equal(still.scope.exists, "withdrawn");
});

test("⛔ and the cascade is the point — everything beneath it goes too", async () => {
  const dir = withExtras();
  const { existsOf } = await import("../dist/v2/load.js");
  const c0 = loadCorpus(dir);
  const container = c0.scopes.find((s) => c0.scopes.some((k) => k.scope.in === s.scope.id) && s.scope.in);
  assert.ok(container, "the fixture has no nested container to withdraw");
  const child = c0.scopes.find((k) => k.scope.in === container.scope.id).scope.id;
  assert.equal(existsOf(c0, child), "kept", "the child was not kept to begin with");

  const r = withdraw(dir, container.scope.id, "claude", "2026-10-26", "taken out", false);
  assert.ok(r.ok, r.ok ? "" : r.why);
  assert.equal(existsOf(loadCorpus(dir), child), "withdrawn", "withdrawing a container left its children standing");
});

test("a withdrawn feature is not in the menu, and one that is kept still is", () => {
  const dir = withExtras();
  const id = "allowances";
  const root = loadCorpus(dir).scopes.find((s) => !s.scope.in).scope.id;
  const page = (d) =>
    renderScopePage(loadCorpus(d), root, { interactive: true, linkBase: "/v2", only: [root, "overview"] });

  /** ⛔ A NON-ZERO FIRST: it has to be in the menu before being taken out, or the absence proves nothing. */
  assert.match(page(dir), new RegExp(`data-scope="${id}"`), "the feature was not in the menu to begin with");
  /** ⛔ A sibling, NOT a descendant — a descendant goes with the cascade and would prove the opposite. */
  const kept = "chores";

  const r = withdraw(dir, id, "claude", "2026-10-26", "taken out", false);
  assert.ok(r.ok, r.ok ? "" : r.why);
  const after = page(dir);
  assert.doesNotMatch(after, new RegExp(`data-scope="${id}"`), "a withdrawn feature still has a row in the menu");
  if (kept) assert.match(after, new RegExp(`data-scope="${kept}"`), "withdrawing one feature emptied the menu");
});

test("⛔ the act is reachable from the CLI, which it never was", () => {
  const dir = seed();
  const id = aFeature(dir);
  assert.ok(ACTS.includes("withdraw"), "withdraw is not in ACTS");

  const out = execFileSync(
    process.execPath,
    [CLI, "v2", "withdraw", id, "--because", "a carried capability that belongs to the other tree", "--by", "claude", "--via", "agent", "--at", dir],
    { encoding: "utf-8" }
  );
  assert.match(out, /withdrew/, `the CLI did not perform the act: ${out}`);
  assert.equal(loadCorpus(dir).scopes.find((s) => s.scope.id === id).scope.exists, "withdrawn");
  /**
   * ⛔ AND IT SAYS THE TRUE REASON. The message was "somebody had agreed to it", which is true of an
   * agreed exchange and false of a feature — a withdrawal reporting a consent that never happened.
   */
  assert.doesNotMatch(out, /somebody had agreed/, "it claims somebody agreed to a feature nobody agreed to");
  assert.match(out, /other documents point at/, "it does not say why a feature is marked rather than removed");
});

test("⛔ and it still refuses what it cannot record", () => {
  const dir = seed();
  const c = loadCorpus(dir);
  const scope = c.scopes.find((s) => s.scope.exchanges.length);
  /** A rule is not a thing this takes out, and the refusal names what it will take. */
  const r = withdraw(dir, "not-a-real-feature", "claude", "2026-10-26", "x", false);
  assert.equal(r.ok, false, "a ref naming nothing was accepted");

  /** Withdrawing the same feature twice is refused rather than silently rewritten. */
  const first = withdraw(dir, scope.scope.id, "claude", "2026-10-26", "x", false);
  assert.ok(first.ok, first.ok ? "" : first.why);
  const again = withdraw(dir, scope.scope.id, "claude", "2026-10-26", "x", false);
  assert.equal(again.ok, false, "withdrawing an already-withdrawn feature was accepted");
  assert.match(again.why, /already withdrawn/);
});
