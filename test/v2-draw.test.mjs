/**
 * ⛔ THE GENERATOR HAD NO TEST AT ALL, AND TWO NAMED DEFECTS THAT COULD RETURN SILENTLY.
 *
 * A reviewer put it plainly: `draw.ts` is imported by no test, while the commit that created it
 * says "If `draw` produces the wrong drawing, the defect is in `draw`." Both of its known bugs —
 * parenthesised branches returning nothing, and only `export default` being looked for — produce a
 * drawing that is structurally plausible and empty, which is the failure mode hardest to notice.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { drawFromRoute, driftedFrom } from "../dist/v2/draw.js";

const write = (dir, rel, body) => {
  const f = path.join(dir, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, body);
  return f;
};

test("a parenthesised branch is drawn, not dropped", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "draw-"));
  /**
   * ⛔ Every conditional branch in real JSX is written `cond && ( <div/> )`. A walker that only
   * recognises JSX nodes returned nothing for all of them, and the first real drawing came out as a
   * page header and nothing else.
   */
  const route = write(
    dir,
    "page.tsx",
    `export default function P() {
       return (
         <div className="wrap">
           <h1 className="title">Deals</h1>
           {hasBanner && (<div className="err">a notice</div>)}
           {isError && (<div className="boom">could not load</div>)}
           {empty ? (<p className="none">nothing here</p>) : (<table className="rows"><tbody/></table>)}
         </div>
       )
     }`
  );
  const r = drawFromRoute(route);
  assert.match(r.html, /class="err"/, "an && branch was dropped");
  /**
   * ⛔ But an ERROR branch is a STATE, not the screen. Drawn, it put an empty pink bar across every
   * screen that has one — which reads as a defect in the product rather than a branch nobody is in.
   * Skipped and reported, like loading and empty.
   */
  assert.doesNotMatch(r.html, /class="boom"/, "the error state was drawn as part of the screen");
  assert.ok(r.states.some((st) => st.includes("could not load")), "and it must be reported as a state");
  /**
   * ⛔ THIS TEST USED TO DEMAND BOTH ARMS, reasoning that *"taking one silently draws one state and
   * calls it the screen."* The operative word was SILENTLY, and drawing both is worse: the deals
   * list came out with a loading skeleton, an empty state and a populated table stacked on one
   * screen. Peter, looking at it: *"what renders there is ass"*. A superposition of three states is
   * not a picture of any of them.
   *
   * So one arm is drawn — the larger, which is the screen rather than the guard — and the other is
   * REPORTED as a state this drawing does not hold. Not silent, which was the real objection.
   */
  assert.match(r.html, /class="rows"/, "the screen arm was dropped");
  assert.doesNotMatch(r.html, /class="none"/, "both arms were drawn, which is a picture of no state");
  assert.ok(
    r.states.some((st) => st.includes("nothing here")),
    `the arm it did not draw must be reported as a state; got ${JSON.stringify(r.states)}`
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a named export is read, and the main render is preferred over the guard", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "draw2-"));
  /**
   * ⛔ TWO DEFECTS IN ONE FIXTURE, because they compound. Looking only for `export default` refused
   * a named export outright — "the route exports no component this can read", which reads as
   * incapacity rather than a lookup that never tried. And taking the FIRST return that holds JSX
   * gets the loading guard: three real screens regenerated to 101, 111 and 233 bytes, smaller and
   * emptier than the hand-typed drawings they replaced, with the generator reporting success.
   */
  const route = write(
    dir,
    "Pane.tsx",
    `export function Pane({ title }: { title: string }) {
       if (pending) return <div className="skeleton" />
       return (
         <section className="pane">
           <h2 className="head">{title}</h2>
           <div className="body"><span className="cell">x</span></div>
         </section>
       )
     }`
  );
  const r = drawFromRoute(route);
  assert.doesNotMatch(r.html, /skeleton/, "the drawing is the loading guard");
  assert.match(r.html, /class="pane"/, "the main render was not found");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a co-located component is inlined, and its props are bound", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "draw3-"));
  /**
   * ⛔ A component directory is full of thin wrappers over co-located components. Resolving only by
   * filename missed every one: a 1,162-line settings screen generated to 111 bytes — a wrapper, and
   * an unresolved div where the screen should have been.
   */
  const route = write(
    dir,
    "Settings.tsx",
    `export default function Settings() { return <SettingsCard heading="Fannie Mae" /> }
     function SettingsCard({ heading }: { heading: string }) {
       return <div className="card"><h1 className="h">{heading}</h1></div>
     }`
  );
  const r = drawFromRoute(route);
  assert.match(r.html, /class="card"/, "a co-located component was not inlined");
  // ⛔ And the call site's words: inlining without binding props produces a header that says nothing.
  assert.match(r.html, /Fannie Mae/, "the prop the call site passes was not bound");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("what it cannot read is marked, never guessed — and parts are stamped", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "draw4-"));
  const route = write(
    dir,
    "page.tsx",
    `export default function P() {
       return <div><button className="go">Save it</button><span>{deal.total}</span><span>{total}</span><input placeholder="Search deals" /></div>
     }`
  );
  const r = drawFromRoute(route, {
    parts: [
      { id: "save", role: "commits", label: "Save it" },
      { id: "find", role: "entry", label: "Search deals" },
      { id: "ghost", role: "commits", label: "Nowhere To Be Found" },
    ],
  });
  /**
   * ⛔ A value it cannot read becomes a marked placeholder: a mock that invents a figure teaches a
   * reviewer something the product does not do, and they cannot tell which numbers were real.
   *
   * ⛔ BUT A BARE IDENTIFIER IS A SLOT, NOT CONTENT, and marking those put twenty hatched ellipses
   * on a screen whose real text was four words — `actions`, `title`, `label`, `rightIcon`. They
   * crowd out the parts of the drawing that are real. So the fixture asks about a MEMBER access,
   * which is content the screen would show; a bare `{total}` renders as nothing and is still
   * counted as unresolved.
   */
  assert.match(r.html, /productos-unknown/, "an unreadable expression was guessed at");
  assert.ok(r.unresolved.includes("total"), `unresolved does not name it: ${JSON.stringify(r.unresolved)}`);

  /**
   * ⛔ THE GENERATOR STAMPS `data-part`. The skill used to say "GENERATE IT. DO NOT TYPE IT." and
   * then, two steps later, add the attribute by hand — an edit on generator output in a field the
   * next run discards.
   */
  assert.match(r.html, /data-part="save"/, "a part named in text was not wired");
  assert.match(r.html, /data-part="find"/, "a part named in a placeholder was not wired");
  // ⛔ And a part the drawing does not show is reported, never dropped.
  assert.deepEqual(r.undrawn, ["ghost"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("drift is content, not timestamps", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "draw5-"));
  const route = write(dir, "page.tsx", `export default function P() { return <div className="a">hi</div> }`);
  const same = drawFromRoute(route).html;
  assert.equal(driftedFrom(route, same).drifted, false, "an identical drawing read as drifted");
  /**
   * ⛔ Whitespace is not drift. And a modification time says who wrote last, not whether what they
   * wrote is still right — a checkout destroys it.
   */
  assert.equal(driftedFrom(route, `  ${same}\n`).drifted, false, "reindenting read as drift");
  assert.equal(driftedFrom(route, same.replace("hi", "typed over")).drifted, true, "a hand edit read as current");
  fs.rmSync(dir, { recursive: true, force: true });
});
