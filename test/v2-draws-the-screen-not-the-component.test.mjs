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

test("a screen is drawn inside the layouts its route sits in", () => {
  const { root } = app();
  const page = path.join(root, "app/(app)/deals/page.tsx");

  /** ⛔ The group layout, not the root one: `app/layout.tsx` renders html/body and cannot nest. */
  const around = layoutsAround(page);
  assert.deepEqual(
    around.map((f) => path.relative(root, f)),
    ["app/(app)/layout.tsx"],
    "the layout chain is wrong — the root layout must be skipped and the group layout found"
  );

  const out = drawFromRoute(page, {});
  assert.match(out.html, /<nav class="w-64 border-r">Nav<\/nav>/, "the drawing has no app chrome");
  assert.match(out.html, /<h1 class="type-display">Deals<\/h1>/, "the page's own content was lost");
  /** The page goes INSIDE the shell, which is the whole point of composing them. */
  assert.ok(
    out.html.indexOf("w-64 border-r") < out.html.indexOf("type-display"),
    "the page was placed before its chrome rather than inside it"
  );
  assert.doesNotMatch(out.html, /<html|<body/, "the root layout's html/body reached a drawing");
  assert.doesNotMatch(out.html, /<!--children-->/, "the slot was left unfilled");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a product with no layouts draws exactly as it did", () => {
  /** ⛔ The composition must be invisible to a product that is not laid out this way. */
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
