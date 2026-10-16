/**
 * ⛔ A PAGE OF TABS IS TEN SCREENS, AND A DRAWING OF ONE MUST NOT CONTAIN THE OTHER NINE.
 *
 * Peter, on the drawn deal overview: *"the prototype for deal overview is nonsensical. there's a
 * ton of things that are not on the actual overview page. the 'real' overview page ends after the
 * job market card. it has the deal card, the map with layers, affordability, job market"*.
 *
 * He was exactly right, and the cause is one shape in his code:
 *
 *     {activeTab === 'overview' && (…deal card, map, affordability, market…)}
 *     {activeTab === 'appraisal' && <AppraisalTab/>}
 *     {activeTab === 'rent-roll' && <RentRollTab/>}            … ten in all
 *
 * None of those match any guard pattern in `draw.ts` — they are not `isLoading`, not `!x.length`,
 * not a prop the caller withheld — so every one fell through to the unconditional emit and ALL TEN
 * panels went into one drawing. The overview carried Appraisal, Rent Roll, Documents and Review.
 *
 * ⛔ WHICH ARM IS THIS SCREEN CANNOT BE READ OUT OF THE CODE, which is what the `forks` comment in
 * that file already says about a different instance of the same problem: it is a fact about the
 * product. So the choice comes from the TRUTH — the view's id and title — and it is reported as a
 * fork either way, because a confident drawing of the wrong tab is worse than a thin one.
 *
 * ⛔ AND IT IS NOT A STATE. A reviewer offered "appraisal" as a state of the overview screen would
 * be told the overview has an Appraisal mode. These go to `forks`, which is the channel for "this
 * drew one of several unrelated screens".
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { drawFromRoute } = await import("../dist/v2/draw.js");

/** The shape of his deal page: one variable, four tabs, each its own panel. */
function tabbedRoute() {
  const dir = temp("v2tabs-");
  const file = path.join(dir, "page.tsx");
  fs.writeFileSync(
    file,
    `export default function DealPage() {
       const activeTab = searchParams.get('tab') || 'overview';
       return (
         <div className="page">
           <h1>A deal</h1>
           {activeTab === 'overview' && (
             <section className="ov"><span>The job market card</span></section>
           )}
           {activeTab === 'appraisal' && (
             <section className="ap"><span>An appraisal table</span></section>
           )}
           {activeTab === 'rent-roll' && (
             <section className="rr"><span>A rent roll grid</span></section>
           )}
           {activeTab === 'documents' && (
             <section className="dc"><span>A documents list</span></section>
           )}
         </div>
       );
     }`
  );
  return file;
}

const route = tabbedRoute();

test("the overview draws its own panel and none of the others", () => {
  const drawn = drawFromRoute(route, { screen: "deal-overview a-deals-overview A deal's overview" });
  assert.match(drawn.html, /The job market card/, "the overview's own content is missing");
  for (const other of ["An appraisal table", "A rent roll grid", "A documents list"]) {
    assert.doesNotMatch(drawn.html, new RegExp(other), `the drawing carries another tab: ${other}`);
  }
});

test("the words of the view pick the arm, so another view draws another panel", () => {
  /**
   * ⛔ THE NON-VACUOUS HALF. A fix that always drew the first arm would pass the test above and be
   * just as wrong — it would simply be wrong about every tab except the first.
   */
  const drawn = drawFromRoute(route, { screen: "deal-documents a-deals-documents Documents" });
  assert.match(drawn.html, /A documents list/, "the documents view did not draw the documents tab");
  assert.doesNotMatch(drawn.html, /The job market card/, "it drew the overview instead");
});

test("and it says it chose, naming the ones it did not draw", () => {
  const drawn = drawFromRoute(route, { screen: "deal-overview a-deals-overview A deal's overview" });
  const fork = drawn.forks.find((f) => f.on.includes("activeTab"));
  assert.ok(fork, `no fork reported. forks were: ${JSON.stringify(drawn.forks)}`);
  assert.equal(fork.chose, "overview");
  assert.deepEqual(fork.others.sort(), ["appraisal", "documents", "rent-roll"]);
});

test("a view whose words match no arm still draws one, and is still reported", () => {
  /** ⛔ Silence would be the worst outcome: a confident drawing of a tab nobody asked for. */
  const drawn = drawFromRoute(route, { screen: "something-else" });
  const fork = drawn.forks.find((f) => f.on.includes("activeTab"));
  assert.ok(fork, "a drawing that guessed an arm reported nothing");
  assert.ok(drawn.html.length > 0, "nothing was drawn at all");
});

test("two arms are left alone — that is a screen and its empty state", () => {
  /**
   * ⛔ THE GUARD ON THE GUARD. `{mode === 'list' && …}{mode === 'empty' && …}` is routinely one
   * screen with a vacancy, and treating it as two screens would hide the empty one from the only
   * surface that shows states. Same threshold `forkOf` uses, for the same reason.
   */
  const dir = temp("v2two-");
  const file = path.join(dir, "two.tsx");
  fs.writeFileSync(
    file,
    `export default function Two() {
       return (
         <div>
           {mode === 'list' && <section><span>Rows of things</span></section>}
           {mode === 'empty' && <section><span>Nothing here yet</span></section>}
         </div>
       );
     }`
  );
  const drawn = drawFromRoute(file, { screen: "things list" });
  assert.ok(
    !drawn.forks.some((f) => f.on.includes("mode")),
    "two arms were reported as a set of unrelated screens"
  );
});

/**
 * ⛔ AND A FRAGMENT IS A PARENT — the shape the real page uses, and the one the first fix missed.
 *
 * Every test above wrapped the tabs in a `<div>`, and they all passed while the deal page drew
 * byte-for-byte what it had before: it writes `const tabContent = (<>{activeTab === '…' && …}</>)`,
 * a FRAGMENT assigned to a const, and the detection ran only for `JsxElement`. 312,651 bytes and
 * ten tabs, with a green test suite and a "no fork" report.
 *
 * Caught by drawing his actual file instead of the fixture. This is that file's shape.
 */
test("a fragment holding the tabs is read the same as an element", () => {
  const dir = temp("v2frag-");
  const file = path.join(dir, "frag.tsx");
  fs.writeFileSync(
    file,
    `export default function DealPage() {
       const tabContent = (
         <>
           {activeTab === 'overview' && <section><span>The job market card</span></section>}
           {activeTab === 'appraisal' && <section><span>An appraisal table</span></section>}
           {activeTab === 'rent-roll' && <section><span>A rent roll grid</span></section>}
           {activeTab === 'documents' && <section><span>A documents list</span></section>}
         </>
       );
       return <div className="page">{tabContent}</div>;
     }`
  );
  const drawn = drawFromRoute(file, { screen: "deal-overview a-deals-overview overview" });
  assert.match(drawn.html, /The job market card/, "the overview's own content is missing");
  assert.doesNotMatch(drawn.html, /An appraisal table/, "a fragment's other tabs were drawn too");
  assert.doesNotMatch(drawn.html, /A rent roll grid/, "a fragment's other tabs were drawn too");
  const fork = drawn.forks.find((f) => f.on.includes("activeTab"));
  assert.ok(fork, "nothing was reported for a fragment's exclusive set");
  assert.equal(fork.chose, "overview");
});
