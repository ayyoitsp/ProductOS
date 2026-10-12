/**
 * ⛔ THE NEIGHBOURHOOD WALK CLIMBED OUT OF THE PROJECT, AND IT COST FIFTY-TWO SECONDS A CALL.
 *
 * Peter, on the suite: *"still running the suite??? … 57 per call to what? what are we testing
 * exactly in the suite?"*
 *
 * `drawFromRoute` reads a route's component off disk and draws the screen, which means resolving
 * `<Wizard/>` to a file. Two index sources: the configured `components_dir`, and **the route's own
 * neighbourhood** — four levels up and back down. The second exists for a real defect: `create-deal`
 * drew 190 bytes because its wizard lived in `app/(app)/projects/create/components/`, beside its
 * route and nowhere near the configured directory.
 *
 * ⛔ BUT `up < 4` HAD NO NOTION OF WHERE THE PROJECT ENDS. Measured on a ONE-LINE `.tsx` file:
 *
 *     route four levels under a quiet directory        6 ms
 *     the identical file in the system temp directory  52,140 ms
 *
 * From a route in `/var/folders/…/T/draw5-x/`, one level up IS the system temp root — thousands of
 * directories from every process on the machine, each given a recursive descent. The brake was
 * `seen < 200`, counting `.tsx` files FOUND: in a tree with none it never engages. The slowest test
 * in the suite was 216 seconds of this, 27% of a thirteen-minute run, for three assertions about
 * whitespace.
 *
 * ⛔ AND IT WAS A CORRECTNESS BUG TOO, which is what these tests are mostly about. Four levels above
 * `app/(app)/deals/page.tsx` in a monorepo leaves the package — and a namesake component in a
 * SIBLING project would be indexed and drawn into this screen, with the drawing looking fine.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drawFromRoute } from "../dist/v2/draw.js";

function tree(files) {
  const root = temp("drawnb-");
  for (const [p, s] of Object.entries(files)) {
    const f = path.join(root, p);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, s);
  }
  return root;
}

const WIZARD = `export function Wizard() { return <div className="wizard">the wizard</div> }`;
const SHARED = `export function Shared() { return <div className="shared">shared</div> }`;
const STRANGER = `export function Stranger() { return <div className="stranger">from another project</div> }`;

test("a component beside the route is still found, and so is one at the project root", () => {
  const root = tree({
    "proj/package.json": "{}",
    "proj/app/deals/components/Wizard.tsx": WIZARD,
    "proj/components/Shared.tsx": SHARED,
    "proj/app/deals/page.tsx": `export default function P() { return <div><Wizard/><Shared/></div> }`,
  });
  const r = drawFromRoute(path.join(root, "proj/app/deals/page.tsx"));

  /** ⛔ The defect the neighbourhood walk exists for. Bounding it must not take this away. */
  assert.match(r.html, /wizard/, "a component beside the route is no longer found — create-deal draws 190 bytes again");
  /**
   * ⛔ The project root is INDEXED, then the climb stops. A `components/` directory at the top of a
   * package is exactly where a shared component lives, so stopping before it would be the same
   * defect one level higher.
   */
  assert.match(r.html, /shared/, "a component at the project root is not found, so the climb stops too early");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a namesake in a sibling project is not drawn into this screen", () => {
  const root = tree({
    "proj/package.json": "{}",
    "proj/app/deals/page.tsx": `export default function P() { return <div><Stranger/></div> }`,
    /** A different project, a sibling of `proj` — reachable in four levels, not in this package. */
    "outside/package.json": "{}",
    "outside/components/Stranger.tsx": STRANGER,
  });
  const r = drawFromRoute(path.join(root, "proj/app/deals/page.tsx"));
  assert.ok(
    !/from another project/.test(r.html),
    "a component from a sibling project was indexed and drawn — the walk left the package"
  );
  /** ⛔ And it is REPORTED unresolved rather than silently dropped: a drawing that quietly omits
   *  something is the defect `unresolved` exists to prevent. */
  assert.ok(
    r.unresolved.some((u) => u.includes("Stranger")),
    `nothing said Stranger could not be resolved: ${JSON.stringify(r.unresolved)}`
  );
  fs.rmSync(root, { recursive: true, force: true });
});

/**
 * ⛔ A ROUTE IN NO PROJECT AT ALL IS THE CASE THAT RAN FOR FIFTY-TWO SECONDS, because there is no
 * root to stop at. Only the second bound catches it: directories VISITED, not files found.
 *
 * ⛔ AND THIS IS A SOURCE ASSERTION, BECAUSE A TIMING TEST DID NOT DISCRIMINATE. The first version
 * built three hundred sibling directories and asserted the draw took under ten seconds — and it
 * PASSED with both bounds removed, because three hundred empty directories are fast. What made the
 * real case 52 seconds was a system temp directory holding the accumulated trees of hundreds of
 * earlier runs, and that cannot be synthesized cheaply or reliably.
 *
 * So the behaviour is asserted where it is deterministic — the drawing still works outside a
 * project — and the bound is asserted where it is visible. The same choice `v2-steers-steer` makes
 * about the install adapter: assert the shape that makes the guarantee true, when doing it for real
 * is not available.
 */
test("a route outside any project still draws, and the descent is bounded by directories visited", () => {
  const root = tree({ "a/b/c/page.tsx": `export default function P() { return <div className="x">hi</div> }` });
  for (let i = 0; i < 50; i++) fs.mkdirSync(path.join(root, `junk-${i}/deep`), { recursive: true });

  const r = drawFromRoute(path.join(root, "a/b/c/page.tsx"));
  assert.match(r.html, /class="x"/, "a route outside any project no longer draws at all");
  fs.rmSync(root, { recursive: true, force: true });

  const src = fs.readFileSync("src/v2/draw.ts", "utf-8");
  /**
   * ⛔ `seen` counts FILES FOUND and was the only brake — in a tree with no `.tsx` files it never
   * engages, which is the whole bug. The cap that matters counts directories entered.
   */
  assert.match(src, /visited\+\+/, "nothing counts the directories the neighbourhood walk enters");
  assert.match(
    src,
    /while \(stack\.length && seen < 200 && visited < AT_MOST_DIRS\)/,
    "the descent is no longer bounded by directories visited — a tree with no .tsx files runs to exhaustion again"
  );
  assert.match(
    src,
    /if \(isRoot\(dir\) \|\| path\.dirname\(dir\) === dir \|\| visited >= AT_MOST_DIRS\) break;/,
    "the climb no longer stops at the project root"
  );
});
