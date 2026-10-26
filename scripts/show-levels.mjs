/**
 * The validation scale, as it actually comes out of a corpus — every level, every route, with a
 * real example of each and what the model says about it.
 *
 *     node scripts/show-levels.mjs [<corpus dir>]
 *
 * ⛔ READ OFF `levelOf`, NEVER RESTATED. The point of `level.ts` is that there is one computed
 * answer to "how established is this", so a script that described the scale in its own words would
 * be the second answer the module exists to prevent.
 */
import { loadCorpus } from "../dist/v2/load.js";
import { levelsIn, countLevels, LEVEL_WORD } from "../dist/v2/level.js";

/**
 * ⛔ THE SEED HAS NOTHING AGREED, SO THE TOP OF THE SCALE IS INVISIBLE ON IT — and a scale shown
 * only from `suggested` downwards is the half that needs no human. With `--agree` this copies the
 * corpus to a scratch directory and performs a REAL acceptance through `acts.ts`, so `accepted` and
 * `derived` come out of the same `levelOf` as everything else rather than being described.
 *
 * ⛔ A COPY, NEVER THE CORPUS IT WAS POINTED AT. Writing a verdict into somebody's truth to
 * illustrate a scale would be this repo's worst habit: an act recorded without a person.
 */
const args = process.argv.slice(2);
const agree = args.includes("--agree");
const dir0 = args.find((a) => !a.startsWith("--")) ?? "v2-seed";

let dir = dir0;
if (agree) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const os = await import("node:os");
  const { perform } = await import("../dist/v2/acts.js");
  const { gridFor } = await import("../dist/v2/grid.js");
  dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "levels-")), "corpus");
  fs.cpSync(dir0, dir, { recursive: true });
  const first = loadCorpus(dir);
  /** The first exchange that has a grid — the same way the MCP test picks something agreeable. */
  let picked;
  for (const sc of first.scopes) {
    const g = gridFor(first, sc.scope.id);
    if (g.rows.length) { picked = `${sc.scope.id}#${g.rows[0].exchange}`; break; }
  }
  if (!picked) { console.error("nothing in this corpus has a grid to agree to"); process.exit(2); }
  const out = perform(dir, "accept", { target: picked }, { by: "peter", via: "page" });
  console.log(`\n(accepted ${picked} as peter, via page, in a scratch copy — ${out.ok ? "ok" : "REFUSED: " + out.why})`);
}

const corpus = loadCorpus(dir);
if (corpus.broken.length) {
  console.error(`${corpus.broken.length} file(s) would not load: ${corpus.broken.map((b) => b.why.split("\n")[0]).join(" | ")}`);
  process.exit(2);
}

const levels = levelsIn(corpus);
const counts = countLevels(levels);
const total = levels.length || 1;

/**
 * ⛔ THE ORDER IS READ OFF THE MODULE, NOT RESTATED HERE. `LEVEL_WORD` is declared top of scale
 * first, so its key order IS the scale — and a copy in this script is exactly the second
 * vocabulary the collapse to one axis removes. It also broke the moment the rungs changed, which
 * is the cheapest available demonstration of why.
 */
const ORDER = Object.keys(LEVEL_WORD);

console.log(`\n${dir0} — ${levels.length} facts\n`);
console.log("  level       word        count    share   the gate");
console.log("  ─────────────────────────────────────────────────────────────");
for (const name of ORDER) {
  const n = counts[name] ?? 0;
  const bar = "█".repeat(Math.round((n / total) * 28));
  /** ⛔ The consumer's gate sits between `derived` and `suggested` — level.ts says so by name. */
  const gate = name === "derived" ? "  ← may build from this and above" : "";
  console.log(`  ${name.padEnd(11)} ${LEVEL_WORD[name].padEnd(11)} ${String(n).padStart(5)}  ${((n / total) * 100).toFixed(0).padStart(5)}%${gate}`);
  if (bar) console.log(`              ${bar}`);
}

console.log(`\n  how each one got there — every route present, with one real example\n`);
const byRoute = new Map();
for (const l of levels) {
  if (!byRoute.has(l.route)) byRoute.set(l.route, []);
  byRoute.get(l.route).push(l);
}
for (const name of ORDER) {
  const routes = [...byRoute.entries()].filter(([, v]) => v[0].level === name);
  if (!routes.length) continue;
  console.log(`  ${name.toUpperCase()}`);
  for (const [route, got] of routes.sort((a, b) => b[1].length - a[1].length)) {
    const eg = got[0];
    console.log(`    ${route.padEnd(26)} ${String(got.length).padStart(4)}   e.g. ${eg.ref}`);
    console.log(`      ${String(eg.because).replace(/\s+/g, " ").slice(0, 150)}`);
  }
  console.log("");
}

/**
 * ⛔ AND WHAT NOBODY CAN COMPUTE, SAID OUT LOUD. `wrote` is the model's own admission that a
 * sentence an agent inferred and a sentence a person typed are byte-identical in a corpus — so the
 * distribution of `unrecorded` is the size of that gap rather than a curiosity.
 */
const wrote = {};
for (const l of levels) {
  const k = l.wrote?.is === undefined ? String(l.wrote) : l.wrote.is + (l.wrote.by ? ` (${l.wrote.by})` : "");
  wrote[k] = (wrote[k] ?? 0) + 1;
}
/**
 * ⛔ WHICH ROUTES THE MODEL HAS AND THIS CORPUS DOES NOT EXERCISE — because a table showing four
 * rungs and listing only the routes it happened to find reads as the whole model. `derived` is the
 * consumer's gate and it can be EMPTY while the scale above and below it is populated, which is the
 * single most useful thing to know about a corpus's validation state.
 */
const ALL_ROUTES = [
  "accepted-here", "accepted-through-a-rule", "inside-an-acceptance",
  "worked-out", "worked-out-from-a-draft", "follows-an-acceptance", "observed",
  "stale-acceptance", "stale-derivation", "drafted", "landed-by-software", "inferred", "written",
  "unruled", "latitude",
];
const unseen = ALL_ROUTES.filter((r) => !byRoute.has(r));
if (unseen.length) {
  console.log(`  routes the model has and this corpus does not reach (${unseen.length} of ${ALL_ROUTES.length})`);
  for (const u of unseen) console.log(`    ${u}`);
  console.log("");
}

/**
 * ⛔ AND WHO OWES AN ANSWER, WHICH IS NOW A FLAG RATHER THAN A RUNG. Peter: *"Lowest, but flagged
 * separately"*. On the old scale this was the `open` level, which meant a reader could not tell
 * "nothing supports this" from "somebody was asked and has not replied" without reading the route.
 */
const owed = levels.filter((l) => l.owed);
console.log(`  a person owes an answer on ${owed.length} of ${levels.length}`);
for (const l of owed.slice(0, 3)) console.log(`    ${l.level.padEnd(18)} ${l.ref}`);
console.log("");

console.log(`  who wrote it, as far as the corpus RECORDS`);
for (const [k, n] of Object.entries(wrote).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(26)} ${String(n).padStart(4)}   ${((n / total) * 100).toFixed(0)}%`);
}
console.log("");
