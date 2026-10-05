/**
 * ⛔ A DRAWING THAT IS FAITHFUL TO A COMPONENT AND UNLIKE THE SCREEN.
 *
 * Peter, looking at one: *"the 'creating a deal' screenshots look nothing like our UX"*. Compared
 * against its source element by element, the drawing was exact — every section in order, 7 of 7
 * field labels verbatim, the required-asterisk distinction preserved. It still did not look like
 * the product, for three reasons that have nothing to do with fidelity to the file it was given:
 *
 *  1. IT WAS GIVEN THE WRONG UNIT. A screen is a ROUTE, and in this framework a route is its
 *     layouts plus its page. Every page in the application sits inside `AppLayout` — "the app shell
 *     (sidebar + padded main column)" — and not one drawing in the corpus had a sidebar, because
 *     this walked a page and had no concept of a layout at all.
 *  2. IT DREW CLOSED THINGS OPEN. Whether `{x && …}` is a state was decided by matching `x` against
 *     a list of words — `isOpen`, `showFoo`. The account menu is `const [open] = useState(false)`,
 *     which is on none of those lists, so the shell rendered with its dropdown hanging open. Same
 *     cause as three modal scrims stacked on one screen at 50% black each.
 *  3. IT TURNED A HELPER'S ARGUMENT INTO A CLASS. `className={inputClass('projectName')}` emitted
 *     `class="projectName"` — a field name wearing a class attribute, styling nothing while looking
 *     like styling. Every input on the form rendered as a browser-default box.
 *
 * None of the three is visible to a test that asks whether the drawing matches its source file.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { drawFromRoute, layoutsAround } from "../dist/v2/draw.js";

/** A Next-shaped app: a root layout, a group layout with chrome, and a page inside it. */
function app() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-route-"));
  const put = (rel, body) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  };
  put("app/layout.tsx", "export default function Root({children}){ return (<html><body>{children}</body></html>) }");
  put(
    "app/(app)/layout.tsx",
    `export default function Shell({children}){
       return (<div className="flex h-screen"><nav className="w-64 border-r">Nav</nav><main className="flex-1">{children}</main></div>)
     }`
  );
  put(
    "app/(app)/deals/page.tsx",
    `export default function Page(){
       return (<div className="p-6"><h1 className="type-display">Deals</h1></div>)
     }`
  );
  return { root, put };
}

test("a drawing is the screen's own content, not the application around it", () => {
  /**
   * ⛔ THIS ASSERTED THE OPPOSITE, AND THE REVERSAL IS THE POINT.
   *
   * Composing each route's layouts around its page was built to answer "the screenshots look
   * nothing like our UX" — and the missing shell genuinely was one reason. Seeing it, Peter:
   * *"i don't think we need to show the full menu in every page, we should just show the relevant
   * inline page"*. The shell is identical on every screen, so after the first it carries no
   * information, takes room from the part under review, and drags its own unresolved icons in.
   *
   * ⛔ `layoutsAround` IS KEPT AND TESTED BELOW. Knowing which shell a screen sits in is worth
   * having; drawing it on all seventeen is not.
   */
  const { root } = app();
  const page = path.join(root, "app/(app)/deals/page.tsx");
  const out = drawFromRoute(page, {});
  assert.match(out.html, /<h1 class="type-display">Deals<\/h1>/, "the page's own content was lost");
  assert.doesNotMatch(out.html, /w-64 border-r/, "the application's nav was drawn around the screen");
  assert.doesNotMatch(out.html, /<html|<body/, "a layout reached the drawing");
  fs.rmSync(root, { recursive: true, force: true });
});

test("which shell a screen sits in is still answerable", () => {
  /** ⛔ The root `app/layout.tsx` is never one of them: it renders html/body and cannot nest. */
  const { root } = app();
  const page = path.join(root, "app/(app)/deals/page.tsx");
  assert.deepEqual(
    layoutsAround(page).map((f) => path.relative(root, f)),
    ["app/(app)/layout.tsx"],
    "the layout chain is wrong — the root layout must be skipped and the group layout found"
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("a product with no layouts has no chain to report", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-flat-"));
  const file = path.join(root, "Screen.tsx");
  fs.writeFileSync(file, 'export default function S(){ return (<div className="p-6">Hi</div>) }');
  assert.deepEqual(layoutsAround(file), []);
  assert.match(drawFromRoute(file, {}).html, /^<div class="p-6">Hi<\/div>$/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("what a screen shows before anybody touches it is read, not guessed from the name", () => {
  /**
   * ⛔ `open` is on no list of open-ish words, and `const [open, setOpen] = useState(false)` says
   * exactly what the screen looks like at rest. A declaration beats a word match.
   */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-state-"));
  const file = path.join(root, "Menu.tsx");
  fs.writeFileSync(
    file,
    `export default function Menu(){
       const [open, setOpen] = useState(false)
       return (<div className="rel"><button>Account</button>{open && (<ul className="drop"><li>Sign out</li></ul>)}</div>)
     }`
  );
  const out = drawFromRoute(file, {});
  assert.match(out.html, /<button>Account<\/button>/, "the trigger was dropped with the menu");
  assert.doesNotMatch(out.html, /Sign out/, "a menu that starts closed was drawn open");
  /** ⛔ Not drawn is not discarded — it is offered as one of the screen's states. */
  assert.ok(
    out.states.some((s) => s.includes("open")) || out.drawnStates.some((s) => s.html.includes("Sign out")),
    "the closed branch was dropped silently instead of being offered as a state"
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("a local class helper is resolved; a class-list call still has its arguments harvested", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-cls-"));
  const file = path.join(root, "Form.tsx");
  fs.writeFileSync(
    file,
    `export default function Form(){
       const inputClass = (field: string) => \`w-full px-3 border \${bad(field) ? 'border-red-500' : 'border-gray-300'}\`
       return (<div><input className={inputClass('projectName')} /><span className={clsx('flex', 'gap-2')} /></div>)
     }`
  );
  const out = drawFromRoute(file, {});
  /** ⛔ The helper's BODY, so the input is styled the way the product styles it. */
  assert.match(out.html, /w-full/, "the helper's class list was not resolved");
  assert.match(out.html, /px-3/);
  /** ⛔ And its ARGUMENT is not a class — it is what the helper was asked about. */
  assert.doesNotMatch(out.html, /class="[^"]*projectName/, "a field name was emitted as a class");
  /** ⛔ `clsx('flex','gap-2')` is the opposite case: there the arguments ARE the class list. */
  assert.match(out.html, /flex/, "a class-list call stopped contributing its arguments");
  assert.match(out.html, /gap-2/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("a conditional class draws the resting arm, not both", () => {
  /**
   * ⛔ THIS TOOK BOTH ARMS DELIBERATELY, and it was wrong once the shell arrived. A nav item is
   * `active ? 'bg-brand text-white' : 'text-gray-600'`; with both, every item in the sidebar
   * carried the selected background at once — a nav where everything is the current page, which is
   * a screen that cannot exist. The false arm is what the element looks like before anything
   * happens to it, which is the same rule as reading `useState(false)`.
   */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-cond-"));
  const file = path.join(root, "Nav.tsx");
  fs.writeFileSync(
    file,
    `export default function Nav(){
       return (<a className={active ? 'bg-brand text-white' : 'text-gray-600'}>Deals</a>)
     }`
  );
  const out = drawFromRoute(file, {});
  assert.match(out.html, /text-gray-600/, "the resting arm was dropped");
  assert.doesNotMatch(out.html, /bg-brand/, "the selected arm was drawn onto an item at rest");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a component handed a prop that is false at rest renders nothing at rest", () => {
  /**
   * ⛔ NEITHER HALF IS VISIBLE ALONE. The call site renders `<Modal isOpen={x} />` unconditionally,
   * and the component guards on a prop the drawer had no value for — so a modal body was drawn
   * into the sidebar, and therefore into every screen that has one. The fix asks the component's
   * own source what it does when the prop is false rather than guessing from the prop's name.
   */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-modal-"));
  const put = (rel, body) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  };
  put(
    "components/Picker.tsx",
    `export default function Picker({ isOpen }){
       if (!isOpen) return null
       return (<div className="modal">Please select the deal</div>)
     }`
  );
  put(
    "Shell.tsx",
    `import Picker from './components/Picker'
     export default function Shell(){
       const [pickerOpen, setPickerOpen] = useState(false)
       return (<div className="rail"><span>Nav</span><Picker isOpen={pickerOpen} /></div>)
     }`
  );
  const out = drawFromRoute(path.join(root, "Shell.tsx"), { componentsDir: path.join(root, "components") });
  assert.match(out.html, /<span>Nav<\/span>/, "the shell itself was lost");
  assert.doesNotMatch(out.html, /Please select the deal/, "a modal that is closed at rest was drawn open");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a list written down in the source draws as that list", () => {
  /**
   * ⛔ Peter, on an earlier version of this: *"ok, wtf, how are grey bars useful?"* A navigation is
   * `menuItems.map(item => <a>{item.label}</a>)` over object literals in a config module. Those are
   * the product's own words, sitting in the repository — drawn as three blank rows, the sidebar on
   * every screen was a column of grey bars.
   *
   * ⛔ IT STILL INVENTS NOTHING: literals only, and an array it cannot resolve falls back to the
   * three-row shape exactly as before.
   */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-list-"));
  const put = (rel, body) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  };
  put("config/menu.ts", `export const menuItems = [{ label: 'Deals', path: '/deals' }, { label: 'Borrowers', path: '/b' }]`);
  put(
    "Nav.tsx",
    `import { menuItems } from './config/menu'
     export default function Nav(){
       const visible = onlyAllowed(menuItems)
       return (<nav>{visible.map((item) => (<a>{item.label}</a>))}</nav>)
     }`
  );
  const out = drawFromRoute(path.join(root, "Nav.tsx"), {});
  assert.match(out.html, /Deals/, "a label written in the source was drawn as a blank bar");
  assert.match(out.html, /Borrowers/, "only the first item was drawn");
  /** ⛔ Through a plain call — `onlyAllowed(menuItems)` — which is how a real permission filter reads. */
  assert.doesNotMatch(out.html, /productos-value[^>]*item\.label/, "the label fell through to a placeholder");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a name is an icon in the file that imported it, not everywhere", () => {
  /**
   * ⛔ lucide EXPORTS `Link`, AND SO DOES `next/link`. Icon names were collected from every file
   * into one set, so every `<Link>` in the application — the element wrapping each nav label — was
   * drawn as an icon glyph and swallowed its children. The sidebar had the right number of rows and
   * no words in any of them, which is a very convincing way to look broken.
   */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-icon-"));
  const put = (rel, body) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  };
  /** Another file in the index imports Link from an icon package. */
  put("components/Toolbar.tsx", `import { Link } from 'lucide-react'
     export default function Toolbar(){ return (<div><Link /></div>) }`);
  put(
    "Page.tsx",
    `import Link from 'next/link'
     export default function Page(){ return (<nav><Link href="/d">Deals</Link></nav>) }`
  );
  const out = drawFromRoute(path.join(root, "Page.tsx"), { componentsDir: path.join(root, "components") });
  assert.match(out.html, /Deals/, "a routing component was drawn as an icon and ate its label");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a value the drawing cannot read says what it is", () => {
  /**
   * ⛔ A NAMED SLOT IS NOT A SAMPLE. Peter: *"what are those orange striped ...s??????? why is
   * there blocked out text in the exmaples on set up deal folder? Northgate apparements <blank>
   * <blank>% name match????"* — a hatched ellipsis mid-sentence and two empty bars in a row. They
   * were honest and they read as redaction.
   *
   * Writing "project name" claims nothing about what the value IS, which is the objection to
   * sampling outside a list row; it names the slot the product fills, which is true and legible.
   * Only a plain path gets one — a template literal or a call has no single word it is the name
   * of, and those keep the ellipsis rather than inventing one.
   */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-slot-"));
  fs.writeFileSync(
    path.join(root, "Page.tsx"),
    `export default function P(){ return (<div>
       <p>Configure the folder for {projectHints.projectName}</p>
       <h2>{matches.length} Matching Folders Found</h2>
       <p>{listOf(everything, SETTINGS)}</p>
     </div>) }`
  );
  const out = drawFromRoute(path.join(root, "Page.tsx"), {});
  assert.match(out.html, /project name/, "a field the drawing cannot read stayed blocked out");
  assert.doesNotMatch(out.html, /productos-unknown[^>]*projectHints/, "a nameable field still wears the warning stripes");
  /** ⛔ A count reads as a count: "length Matching Folders Found" was the field name in the sentence. */
  assert.match(out.html, /class="productos-slot"[^>]*>n</, "a count was named after its field instead of standing in as a number");
  /** ⛔ And an expression with no name of its own is still marked rather than guessed at. */
  assert.match(out.html, /productos-unknown/, "an unnameable expression was given a name anyway");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a table cell takes its sample from the column it sits in", () => {
  /**
   * ⛔ THE EXPRESSION OFTEN SAYS NOTHING, AND THE HEADER ALWAYS DOES. The deals list renders every
   * column through one cell component, so the STAGE column's expression is `displayLabel` — which
   * matched the name rule and printed a deal name under a header reading STAGE, three rows of it,
   * beside a DEAL column saying the same thing. CREATED is a `new Date(...)` call, which is
   * structure rather than a field, so it drew as an empty grey bar.
   *
   * Peter: *"we should populate template values with ones that make sense!"*
   */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-col-"));
  fs.writeFileSync(
    path.join(root, "Page.tsx"),
    `export default function P(){ return (<table>
       <thead><tr><th>Deal</th><th>Stage</th><th>Created</th></tr></thead>
       <tbody>{deals.map((deal) => (<tr>
         <td>{deal.name}</td>
         <td><span className="badge">{displayLabel}</span></td>
         <td>{new Date(deal.createdAt).toLocaleDateString('en-GB')}</td>
       </tr>))}</tbody>
     </table>) }`
  );
  const out = drawFromRoute(path.join(root, "Page.tsx"), {});
  assert.match(out.html, /Underwriting|Screening|Term sheet/, "the stage column did not read as a stage");
  /** ⛔ Even wrapped in a badge: the cell is searched, not required to BE the marker. */
  assert.doesNotMatch(out.html, /badge[^>]*>\s*<span class="productos-sample"[^>]*>Northgate/, "a deal name is still filed under Stage");
  assert.match(out.html, /2026/, "a date column drew as an empty bar");
  /** ⛔ A column whose expression names a real field keeps it — the heading is the fallback. */
  assert.match(out.html, /Northgate Apartments/, "the deal column lost the name its own field gave it");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a value standing in a sentence is content, not a slot for a caller", () => {
  /**
   * ⛔ `Page {page} of {pageCount}` DREW AS "Page  of  ". A bare identifier that is all an element
   * contains really is usually a slot — `actions`, `title`, `rightIcon` — and marking those put
   * twenty hatched ellipses on a screen whose real text was four words. But nobody writes "Page "
   * and " of " around a slot, and the pager read like a broken string.
   */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-sentence-"));
  fs.writeFileSync(
    path.join(root, "Page.tsx"),
    `export default function P(){ return (<div>
       <span>Page {page} of {pageCount}</span>
       <section>{children}</section>
     </div>) }`
  );
  const out = drawFromRoute(path.join(root, "Page.tsx"), {});
  assert.match(out.html, /Page\s*<span[^>]*>n<\/span>\s*of\s*<span[^>]*>n<\/span>/, "the pager lost its numbers");
  /** ⛔ And a lone child is still read as a slot, which is what kept those screens clean. */
  assert.doesNotMatch(out.html, /<section>\s*<span class="productos-(slot|unknown)"/, "a caller's slot was marked as missing content");
  fs.rmSync(root, { recursive: true, force: true });
});
