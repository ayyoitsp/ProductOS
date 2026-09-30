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
import { drawFromRoute, driftedFrom, sampleValue } from "../dist/v2/draw.js";

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
  /**
   * ⛔ NOT LOST — which is satisfied by DRAWING it, and drawing it is strictly better than naming
   * it. `states` used to hold every skipped branch including the ones that were then drawn as
   * their own pictures, so a screen whose states all came out as pictures still listed them under
   * "not drawn". Splitting the two made this assertion look at the wrong list; the contract it
   * exists to hold is that the branch survives somewhere a reviewer can reach it.
   */
  assert.ok(
    r.states.some((st) => st.includes("could not load")) ||
      r.drawnStates.some((st) => st.html.includes("could not load")),
    "and it must survive as a state — drawn, or at least named"
  );
  /**
   * ⛔ THIS TEST USED TO DEMAND BOTH ARMS, reasoning that *"taking one silently draws one state and
   * calls it the screen."* The operative word was SILENTLY, and drawing both is worse: the deals
   * list came out with a loading skeleton, an empty state and a populated table stacked on one
   * screen. Peter, looking at it: *"what renders there is ass"*. A superposition of three states is
   * not a picture of any of them.
   *
   * So one arm is drawn — the larger, which is the screen rather than the guard — and the other is
   * REPORTED as a state this drawing does not hold. Not silent, which was the real objection.
   *
   * ⛔ AND "NOT SILENT" IS NOW USUALLY "DRAWN". `states` holds the arms that could only be named;
   * anything that could be drawn moved to `drawnStates` and became a tab. Both satisfy the
   * objection, so both are accepted here — asserting on the naming list alone would fail the day
   * the generator got good enough to draw the thing.
   */
  assert.match(r.html, /class="rows"/, "the screen arm was dropped");
  assert.doesNotMatch(r.html, /class="none"/, "both arms were drawn, which is a picture of no state");
  assert.ok(
    r.states.some((st) => st.includes("nothing here")) ||
      r.drawnStates.some((st) => st.html.includes("nothing here")),
    `the arm it did not draw must survive as a state; got ${JSON.stringify(r.states)} and ${JSON.stringify(
      r.drawnStates.map((st) => st.label)
    )}`
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
       return (<div><button className="go">Save it</button>
         <table><tbody>{deals.map((deal) => (<tr><td>{deal.name}</td><td>{compute(a, b)}</td></tr>))}</tbody></table>
         <p>{renderSortIcon()}</p>
         <input placeholder="Search deals" /></div>)
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
  /**
   * ⛔ THE RULE CHANGED HERE, DELIBERATELY, AND THIS RECORDS WHY.
   *
   * It used to be "never supply a value at all". That produced a deals list whose every cell was a
   * blank grey rectangle — Peter: *"ok, wtf, how are grey bars useful?"* — and he was right: a row
   * of empty boxes cannot tell you whether the columns are the right columns or whether a long
   * sponsor name breaks the layout.
   *
   * What the old rule was PROTECTING is that nobody mistakes an invented figure for something the
   * product does. So a supplied value now announces itself: `productos-sample`, a dotted underline,
   * and the expression it stands for in its title. Legible, and unmistakable. What it must never do
   * is quietly look real.
   */
  /** ⛔ Inside a repeated row — and ONLY there, because a legible wrong value in the chrome around
   *  a list ("Page of $12,400,000") is worse than a blank one. */
  assert.match(r.html, /productos-sample/, "a value-shaped field in a row was left blank instead of sampled");
  assert.match(r.html, /class="productos-sample" title="[^"]+ — sample"/, "a sample must say what it stands for");
  /** In a row with nothing plausible to say: a bar, because the shape is all that is left. */
  assert.match(r.html, /productos-value/, "an unsampled cell must still show the row's shape");
  /** Outside a row: the marked placeholder, unchanged. */
  assert.match(r.html, /productos-unknown/, "an expression outside a row must still be marked");
  /** ⛔ A sampled value is still UNRESOLVED — the drawing supplied it, the product did not. */
  assert.ok(r.unresolved.includes("deal.name"), `a sampled field must still be reported: ${JSON.stringify(r.unresolved)}`);
  assert.ok(r.unresolved.includes("compute(a, b)"), `an unsampled one too: ${JSON.stringify(r.unresolved)}`);

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

/**
 * ⛔ THE BODY OF THE SCREEN LIVED IN A LOCAL RENDER HELPER, AND THE DRAWING DISCARDED IT.
 *
 * Peter, on create-a-deal the moment it first appeared at the top of its feature: *"yay, it's
 * finally fucking there. boo, there's literally NOTHING on it."* The screen drew its title, its
 * three progress dots and six hundred pixels of white, because everything below the chrome is
 * `{renderStep()}` and a call the walker could not follow became one marked ellipsis.
 *
 * Every wizard, tabbed panel and stepped form in any React codebase is written this way. A
 * generator that declines to follow it draws frames and throws away pictures.
 */
test("a local render helper is the body of the screen, and each of its arms is a state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "draw6-"));
  const route = write(
    dir,
    "page.tsx",
    `export default function P() {
       const renderStep = () => {
         switch (state.currentStep) {
           case 'upload_term_sheet':
             return (<div className="one">Upload a term sheet</div>)
           case 'project_details':
             return (<div className="two">Name the deal</div>)
           case 'confirm':
             return (<div className="three">Create the deal</div>)
         }
       }
       return (
         <div className="wrap">
           <h1 className="title">Create Deal from Term Sheet</h1>
           <div className="body">{renderStep()}</div>
         </div>
       )
     }`
  );
  const r = drawFromRoute(route);
  assert.match(r.html, /Upload a term sheet/, "the helper's body was dropped — the screen is a frame around nothing");
  /**
   * ⛔ THE FIRST ARM, NOT THE BIGGEST. A switch is written in the order a person moves through it,
   * so case one is step one. Opening a wizard on its confirmation screen makes the end the subject.
   */
  assert.doesNotMatch(r.html, /Create the deal/, "the screen opened on a later step than the first");
  /**
   * ⛔ AND THE OTHER ARMS ARE DRAWN, which is what the tabs above the picture offer. A five-step
   * wizard holds five screens; four of them are exactly what a reviewer needs to walk.
   */
  const labels = r.drawnStates.map((st) => st.label);
  assert.ok(labels.includes("Project details"), `the other steps were not drawn: ${JSON.stringify(labels)}`);
  assert.ok(labels.includes("Confirm"), `the other steps were not drawn: ${JSON.stringify(labels)}`);
  /** ⛔ Named from the product's own word for the step, not from the code around it. */
  assert.ok(
    r.drawnStates.find((st) => st.label === "Project details")?.html.includes("Name the deal"),
    "a state tab and the picture it shows disagree"
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * ⛔ WHAT A FIELD HOLDS IS NAMED BY ITS LAST SEGMENT. `step.number` matched the stage rule on the
 * word "step" and put "Underwriting" inside an eight-pixel circle — three progress dots reading
 * "erwr", "reen" and "ern hee". Legible and wrong is worse than blank.
 */
test("a counter samples as a number, whatever it hangs off", () => {
  assert.equal(sampleValue("step.number", 0), "1");
  assert.equal(sampleValue("step.number", 1), "2");
  assert.equal(sampleValue("row.index", 2), "3");
  /** And the thing it belongs to still reads as itself. */
  assert.equal(sampleValue("step.label", 0), "Underwriting");
  assert.equal(sampleValue("deal.stage", 1), "Screening");
});
