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

/**
 * ⛔ THE ONLY FAILURE HERE THAT PRODUCES A DRAWING NOBODY CAN TELL IS WRONG.
 *
 * Peter, on CRE create-a-deal: *"creating a CRE/multifamily deal does NOT go through a term sheet.
 * it is a manual form only, asking for property and borrower name."* He was right, and the corpus
 * had said otherwise for months.
 *
 * The create route switches on project type and returns one of six unrelated screens, then falls
 * through to a default. `guardedBy` recognised only `if`, so every switch arm read as an UNGUARDED
 * return and the pick became largest-by-span — it drew the processing wizard: a five-step
 * term-sheet flow belonging to a different product, in full, and reported success.
 *
 * Everything else this generator gets wrong makes a drawing that looks thin. This one made a
 * drawing that looked like the product.
 */
test("a switch arm is a state, and drawing one of several products is said out loud", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "draw7-"));
  write(dir, "MultifamilyForm.tsx", `export function MultifamilyForm() { return <div className="mf">New Multifamily Deal</div> }`);
  write(dir, "RentAnalysisForm.tsx", `export function RentAnalysisForm() { return <div className="ra">Rent Analysis</div> }`);
  write(dir, "BenchmarkForm.tsx", `export function BenchmarkForm() { return <div className="bm">Benchmark</div> }`);
  write(dir, "ProcessingWizard.tsx", `export function ProcessingWizard() { return <div className="pw">Create Deal from Term Sheet — a long wizard with many steps</div> }`);
  const route = write(
    dir,
    "page.tsx",
    `import { MultifamilyForm } from './MultifamilyForm'
     import { RentAnalysisForm } from './RentAnalysisForm'
     import { BenchmarkForm } from './BenchmarkForm'
     import { ProcessingWizard } from './ProcessingWizard'
     export default function P() {
       if (type) {
         switch (type) {
           case 'multifamily':   return <MultifamilyForm />
           case 'rent_analysis': return <RentAnalysisForm />
           case 'benchmark':     return <BenchmarkForm />
         }
       }
       return <ProcessingWizard />
     }`
  );
  const r = drawFromRoute(route, { componentsDir: dir });

  /**
   * ⛔ IT STILL PICKS — refusing to draw anything would leave the screen with no picture, which
   * `check` refuses for good reason. What changes is that the pick is no longer silent.
   */
  assert.equal(r.forks.length, 1, `expected exactly one fork, got ${JSON.stringify(r.forks)}`);
  const [f] = r.forks;
  assert.equal(f.on, "type", "the fork must name what it turns on");
  assert.ok(
    f.others.includes("MultifamilyForm") && f.others.includes("RentAnalysisForm"),
    `the other screens must be named so somebody can pick: ${JSON.stringify(f.others)}`
  );
  assert.ok(f.others.length >= 3, "a fork that names one alternative is not telling anybody enough");

  /**
   * ⛔ AND THE ARMS ARE DRAWN, not merely named. A switch arm is a guard, so each becomes a state
   * with the product's own word on its tab — which is how somebody looking at the picture can see
   * that the screen they meant is one of the ones this did not open on.
   */
  const labels = r.drawnStates.map((st) => st.label);
  assert.ok(labels.includes("Multifamily"), `the arms must be drawn as states: ${JSON.stringify(labels)}`);
  assert.ok(
    r.drawnStates.find((st) => st.label === "Multifamily")?.html.includes("New Multifamily Deal"),
    "a state tab and the picture it shows disagree"
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

/** ⛔ And a screen that forks nowhere reports no fork — a warning on every drawing is a warning on none. */
test("a route that renders one screen reports no fork", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "draw8-"));
  const route = write(
    dir,
    "page.tsx",
    `export default function P() {
       if (isLoading) return <div className="sk">Loading</div>
       return <div className="real"><h1>The screen</h1></div>
     }`
  );
  const r = drawFromRoute(route);
  assert.deepEqual(r.forks, [], "a loading guard is a state, not a fork between products");
  assert.match(r.html, /class="real"/, "the guard was drawn as the screen");
  fs.rmSync(dir, { recursive: true, force: true });
});


/**
 * ⛔ A CONTROL WITH NO WORDS ON IT IS UNREVIEWABLE, AND THREE UNRELATED BUGS MADE 118 OF THEM.
 *
 * Peter: *"i can't tell if clicking on next is actually navigating"*. The button had nothing on it.
 * One corpus, 555 controls, 118 blank — from three separate causes that all end as a blank
 * coloured rectangle a reviewer cannot judge and cannot identify:
 *
 *   1. a ternary between two string literals — `pick` handed a bare node to `emit`, which knows
 *      JSX and a JsxExpression wrapper and nothing else, so it returned ""
 *   2. parenthesised JSX — `{ok && (<Icon/>)}` failed every isJsxElement test and fell through to
 *      the unreadable-value path
 *   3. an icon-only button — nothing wrong with the drawing, and still nothing a reviewer can read
 */
test("a control always carries words, whatever made it empty", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "draw9-"));
  const route = write(
    dir,
    "page.tsx",
    `import { Trash2 } from 'lucide-react'
     export default function P() {
       return (
         <div className="wrap">
           <button className="submit">{isCreating ? 'Creating…' : 'Continue'}</button>
           <button className="chev">{canPage && (<Trash2 className="h-4" />)}</button>
           <button className="icon" aria-label="Remove this row"><Trash2 /></button>
         </div>
       )
     }`
  );
  const r = drawFromRoute(route);

  /**
   * ⛔ AND IT IS THE IDLE LABEL, NOT THE BUSY ONE. `isCreating ? 'Creating…' : 'Continue'` picked
   * by span put the screen mid-submit on the happy path. Busy is a guard; the word for it is not
   * always "loading".
   */
  assert.match(r.html, /Continue/, "a ternary between two string literals rendered as nothing");
  assert.doesNotMatch(r.html, /Creating…/, "the happy path opened on the busy label");

  /** ⛔ Parentheses are not content — two handlers unwrapped them locally and the top never did. */
  assert.match(r.html, /productos-icon/, "parenthesised JSX fell through to the unreadable path");

  /** ⛔ An icon-only control takes its name from what the source already says, never from a guess. */
  assert.match(r.html, /Remove this row/, "an aria-labelled control was left with no words on it");

  /** ⛔ The real assertion: nothing that can be pressed is blank. */
  const blanks = [...r.html.matchAll(/<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/g)].filter(
    (m) => !/[A-Za-z0-9]/.test(m[2].replace(/<[^>]*>/g, ""))
  );
  assert.equal(blanks.length, 0, `${blanks.length} control(s) drew with no words on them`);
  fs.rmSync(dir, { recursive: true, force: true });
});

/** ⛔ A state tab names the moment, not the expression: "Creating", not "when state.isCreating". */
test("a state is named in the product's words, never in the code's", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "draw10-"));
  const route = write(
    dir,
    "page.tsx",
    `export default function P() {
       if (folderFailure) return <div className="ff">The folder could not be set up</div>
       if (state.isCreating) return <div className="cr">Creating your deal</div>
       if (state.creationError) return <div className="ce">That did not work</div>
       return <div className="main"><h1>New Multifamily Deal</h1><p>Start with the property.</p></div>
     }`
  );
  const labels = drawFromRoute(route).drawnStates.map((st) => st.label);
  assert.ok(labels.includes("Creating"), `a busy flag must name the moment: ${JSON.stringify(labels)}`);
  assert.ok(labels.includes("Folder failure"), `a bare flag names itself: ${JSON.stringify(labels)}`);
  /**
   * ⛔ AND SO DOES ONE REACHED THROUGH THE OBJECT HOLDING IT. `state.creationError` read as
   * "when state.creationError" — the prefix is the code's bookkeeping, the last segment is the
   * product's word. Widening the Error test to catch it instead flattened "Folder failure" above
   * into "Error", which is why both are asserted here together.
   */
  assert.ok(labels.includes("Creation error"), `a flag on an object names itself too: ${JSON.stringify(labels)}`);
  for (const l of labels) assert.doesNotMatch(l, /^when /, `"${l}" shows the reviewer code they are not reading`);
  fs.rmSync(dir, { recursive: true, force: true });
});


/** ⛔ JSX text is HTML. "We&apos;ll" meant an apostrophe and rendered as those nine characters. */
test("an entity the source already wrote is not escaped twice", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "draw11-"));
  const route = write(
    dir,
    "page.tsx",
    `export default function P() {
       return <div><p>We&apos;ll keep it up to date</p><p>Smith &amp; Co</p><p>Jones & Sons</p></div>
     }`
  );
  const r = drawFromRoute(route);
  assert.doesNotMatch(r.html, /&amp;apos;/, "a source entity was escaped a second time");
  assert.match(r.html, /We&apos;ll/, "the entity itself was lost");
  /** ⛔ And a bare ampersand in ordinary prose is still escaped, exactly as before. */
  assert.match(r.html, /Jones &amp; Sons/, "a bare ampersand stopped being escaped");
  fs.rmSync(dir, { recursive: true, force: true });
});
