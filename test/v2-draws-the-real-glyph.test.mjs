/**
 * ⛔ AN ICON IS A SHAPE THE APPLICATION ALREADY HAS, NOT A GREY SQUARE.
 *
 * Peter, with screenshots of the real new-deal flow open beside the drawing: *"this looks nothing
 * like our UX"*. Four hundred and twenty glyphs across that corpus were rendering as flat boxes —
 * a sidebar as a column of bars, a folder picker as a row of squares, every status marker a hole.
 *
 * Nothing here invents a shape: the path data is read out of the icon package the application
 * depends on, at the version installed beside it, and a name that resolves to no icon file keeps
 * the square and stays recorded as unresolved.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { lucideSvg } from "../dist/v2/icons.js";

/** A stand-in for an installed `lucide-react`, with one real icon and one aliased name. */
function app() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-icons-"));
  const icons = path.join(root, "node_modules/lucide-react/dist/esm/icons");
  fs.mkdirSync(icons, { recursive: true });
  fs.writeFileSync(
    path.join(icons, "folder.mjs"),
    `const __iconNode = [["path", { d: "M20 20a2 2 0 0 0 2-2V8Z", key: "1kt360" }]];\n` +
      `const Folder = createLucideIcon("folder", __iconNode);\nexport { __iconNode, Folder as default };`
  );
  fs.writeFileSync(
    path.join(icons, "triangle-alert.mjs"),
    `const __iconNode = [["path", { d: "m21.73 18-8-14Z", key: "c3131f" }], ["line", { x1: "12", x2: "12", y1: "9", y2: "13", key: "x" }]];\n` +
      `export { __iconNode };`
  );
  fs.writeFileSync(
    path.join(icons, "..", "lucide-react.mjs"),
    `export { default as AlertTriangle, default as TriangleAlert } from './icons/triangle-alert.mjs';\n` +
      `export { default as Folder } from './icons/folder.mjs';`
  );
  const page = path.join(root, "app/page.tsx");
  fs.mkdirSync(path.dirname(page), { recursive: true });
  fs.writeFileSync(page, "x");
  return { root, page };
}

test("an icon draws as the shape the application installed", () => {
  const { root, page } = app();
  const svg = lucideSvg("Folder", page);
  assert.ok(svg, "the icon the application has was not found beside it");
  assert.match(svg, /<svg/, "an icon must draw as an icon");
  assert.match(svg, /M20 20a2 2 0 0 0 2-2V8Z/, "the path drawn is not the one the package holds");
  assert.match(svg, /stroke="currentColor"/, "an icon that ignores its colour is a black box in a themed page");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a renamed icon resolves through the package's own alias, not a table kept here", () => {
  /**
   * ⛔ THE ONE THAT MATTERED MOST. lucide v1 renamed `AlertTriangle` to `TriangleAlert` and kept the
   * old name as an alias; the application still writes the old one, and sixty-eight occurrences —
   * by far the most common icon in the corpus — fell back to a grey square. Nothing about the pair
   * is derivable from the spelling, so the index is read rather than a rename table maintained here
   * that would rot at the next upgrade.
   */
  const { root, page } = app();
  const svg = lucideSvg("AlertTriangle", page);
  assert.ok(svg, "an aliased name fell back to a grey square");
  assert.match(svg, /m21\.73 18-8-14Z/, "the alias resolved to the wrong glyph");
  assert.match(svg, /<line /, "an icon with several elements lost all but the first");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a trailing Icon is a local habit, and is not part of the name", () => {
  /** Applications import `{ Folder as FolderIcon }` constantly; there is no `folder-icon.mjs`. */
  const { root, page } = app();
  assert.ok(lucideSvg("FolderIcon", page), "the package has no folder-icon.mjs and never will");
  fs.rmSync(root, { recursive: true, force: true });
});

test("the call site's classes ride along, because that is how an icon is sized", () => {
  /** Dropped, every icon renders at the 24px default in the inherited colour. */
  const { root, page } = app();
  const svg = lucideSvg("Folder", page, "h-4 w-4 text-gray-400");
  assert.match(svg, /class="h-4 w-4 text-gray-400"/, "the icon lost the size and colour it was given");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a name with no icon behind it draws nothing rather than a guess", () => {
  /**
   * ⛔ THE REFUSAL IS THE POINT. Falling back to some near-match shape would put a glyph on the
   * screen that the product does not have, and a drawing nobody can trust about icons is worse
   * than one that says plainly it does not know this one.
   */
  const { root, page } = app();
  assert.equal(lucideSvg("NotAnIconAtAll", page), undefined, "a name the package does not export produced a shape anyway");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a product with no icon package installed is not an error", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-noicons-"));
  const page = path.join(root, "page.tsx");
  fs.writeFileSync(page, "x");
  assert.equal(lucideSvg("Folder", page), undefined, "a product that uses no icon package must still draw");
  fs.rmSync(root, { recursive: true, force: true });
});
