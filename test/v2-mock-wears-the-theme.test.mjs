/**
 * ⛔ A MOCK THAT CANNOT WEAR THE PRODUCT'S STYLE FAILS BY LOOKING FINE.
 *
 * Peter: *"the rendered style for bilrost currently at localhost:7878 doesn't match at all"*.
 *
 * Three separate defects produced that sentence, and not one of them raised anything. A drawing
 * still rendered in every case — laid out, legible, reviewable — it was simply a different
 * product's drawing. There is nothing downstream to catch that, because the only thing a reviewer
 * compares the drawing against is the drawing.
 *
 *   1. One tree read `web.stylesheet` and the configuration set `web.stylesheets`, so the route it
 *      linked answered 404 and every mock on it rendered in browser defaults.
 *   2. A design system's theme is scoped to `html[data-theme=…]`, which cannot match inside the
 *      shadow root a mock lives in. Sixteen theme rules shipped into the page; none could apply.
 *   3. Nothing in the model said WHICH scheme the product ships, so even reachable, the mock had no
 *      way to opt in — the application's own opt-in is an attribute a developer sets.
 *
 * Each test below pins one of them. They are deliberately about the rewritten bytes and the
 * emitted markup rather than about how a page looks, because what went wrong was invisible.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { scopeToShadow, themesIn, appStyleFor, resolveTheme, snapshotStyle, styleOf, styleDrift } from "../dist/v2/appcss.js";
import YAML from "yaml";
import { renderScopePage } from "../dist/v2/page.js";
import { renderShell } from "../dist/ui/renderer.js";
import { loadCorpus } from "../dist/v2/load.js";
import { everyViewV1 } from "../dist/v2/routes.js";
import { writeSketchHtml } from "../dist/v2/draw-write.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

test("a theme scoped to the document root is reachable inside a mock", () => {
  const css = "html[data-theme='brand'] { --primary: camel }";
  const out = scopeToShadow(css, "mk");
  assert.match(out, /:host\(\[data-theme='brand'\]\)/, "the theme can never match where a mock lives");
  assert.doesNotMatch(out, /html\[data-theme='brand'\]\s*\{/, "the unreachable selector was left behind");
});

test("a comment above a rule is not read as part of its selector", () => {
  /**
   * ⛔ THE BUG THAT SURVIVED THE FIRST FIX, AND THE REASON THIS TEST IS SEPARATE.
   *
   * A comment arrives attached to the selector that follows it, and prose is full of commas and
   * semicolons — the two characters the rewrite splits on. A comma cut `html[data-theme='brand']`
   * away from the start of its own selector; a semicolon cut the prelude open mid-comment and left
   * the tail of a sentence as the leading compound. In the stylesheet this came from, four of five
   * schemes came through as selectors that can never match, and the one that worked was the one
   * somebody had documented without using a comma.
   */
  const css = [
    "/* Scheme: brand — camel, cream, greige; the anchors are #A08165 and #E0D5CB. */",
    "html[data-theme='brand'] { --primary: camel }",
  ].join("\n");
  const out = scopeToShadow(css, "mk");
  assert.match(out, /:host\(\[data-theme='brand'\]\)/, "a comma or a semicolon in prose disabled the rewrite");
  assert.match(out, /Scheme: brand/, "the comment was dropped rather than stepped over");
});

test("the rewrite touches host-level selectors and nothing else", () => {
  const cases = [
    [":root { --x: 1 }", ":host, :root { --x: 1 }"],
    ["body { margin: 0 }", ".mk { margin: 0 }"],
    ["html[data-theme] body { color: red }", ":host([data-theme]) .mk { color: red }"],
    // Untouched: a word that merely contains "body", and one that only appears inside a value.
    [".nobody, .body-text { color: red }", ".nobody, .body-text { color: red }"],
    ['a[href="body"] { color: red }', 'a[href="body"] { color: red }'],
    // Untouched: an at-rule prelude is not a selector list, but the rules inside it still are.
    [
      "@media (min-width: 40px) { html[data-theme='x'] { color: red } }",
      "@media (min-width: 40px) { :host([data-theme='x']) { color: red } }",
    ],
  ];
  for (const [input, want] of cases) assert.equal(scopeToShadow(input, "mk"), want, input);
});

test("the rewrite leaves a real stylesheet's structure byte-for-byte intact", () => {
  /**
   * ⛔ page.ts argued that a hand-rolled transform over somebody else's CSS fails quietly, and that
   * is still the risk this carries. It is held to the narrowest claim that would have caught a
   * quiet failure: every brace and every declaration survives, in the same number.
   */
  const css = [
    "@layer base { :root { --a: 1; --b: 2 } }",
    "@media (prefers-color-scheme: dark) { html.dark { --a: 3 } }",
    "@supports (display: grid) { .g { display: grid } }",
    "@keyframes spin { from { transform: rotate(0) } to { transform: rotate(1turn) } }",
    ".a, .b:is(.c, .d) > e[f=',g'] { color: red }",
    "/* a comment; with a comma */ html[data-theme='x'] body { color: red }",
  ].join("\n");
  const out = scopeToShadow(css, "mk");
  const count = (s, re) => (s.match(re) ?? []).length;
  assert.equal(count(out, /\{/g), count(css, /\{/g), "braces were lost or invented");
  assert.equal(count(out, /\}/g), count(css, /\}/g), "braces were lost or invented");
  assert.equal(count(out, /;/g), count(css, /;/g), "declarations were lost or invented");
});

test("the schemes a stylesheet defines are read off it, not guessed", () => {
  const css = "html[data-theme='brand'] { --a: 1 } :root[data-theme=mono] { --a: 2 } html[data-theme] { --b: 3 }";
  assert.deepEqual(themesIn(css), ["brand", "mono"], "a scheme was invented or missed");
  assert.deepEqual(themesIn(".a { color: red }"), [], "a stylesheet with no schemes reported one");
});

test("every mock on a generated page opts into the product's scheme", () => {
  const corpus = loadCorpus("v2-seed");
  const scope = corpus.scopes.find((s) => s.scope.views.some((v) => v.parts.length));
  const view = scope.scope.views.find((v) => v.parts.length);
  const withHtml = structuredClone(corpus);
  withHtml.scopes
    .find((s) => s.scope.id === scope.scope.id)
    .scope.views.find((v) => v.id === view.id).sketch_html = '<div class="flex"><button>Go</button></div>';

  const html = renderScopePage(withHtml, scope.scope.id, {
    linkBase: "/v2",
    appCss: "html[data-theme='brand'] { --x: camel }",
    theme: "brand",
  });
  assert.match(html, /<div class="proto html" data-theme="brand">/, "the mock does not opt into the scheme");
  assert.match(
    html,
    /<template id="app-css" data-theme="brand">/,
    "a host made in script has nowhere to read the scheme from"
  );

  // ⛔ And with no scheme named, nothing is stamped — unthemed is what the application itself does,
  //    and a default here would be this tool choosing a product's colours for it.
  //    (`data-theme` on the page's own :root is this surface's light/dark switch, a different
  //    vocabulary on a different element — so the assertion is about the mock and the template.)
  const bare = renderScopePage(withHtml, scope.scope.id, { linkBase: "/v2", appCss: ":root { --x: 1 }" });
  assert.match(bare, /<div class="proto html">/, "a scheme nobody chose was stamped on a mock");
  assert.match(bare, /<template id="app-css">/, "a scheme nobody chose was published to the hosts");
});

test("the review tree carries the application's stylesheet with it", () => {
  /**
   * ⛔ THE DEFECT PETER WAS LOOKING AT. This tree linked a route that served `web.stylesheet`
   * alone; the configuration in front of him set `web.stylesheets`, so the link 404ed and every
   * drawing rendered unstyled. It reads one list now, through the same function the other tree
   * reads, which is why this asserts on the shell rather than on a route.
   */
  const shell = renderShell("x", '<div class="ux-mock"><template><div class="flex">hi</div></template></div>', "", {
    appCss: "html[data-theme='brand'] { --x: camel } .flex { display: flex }",
    theme: "brand",
  });
  assert.match(shell, /<template id="app-css" data-theme="brand">/, "the application's CSS does not travel with the page");
  assert.match(shell, /:host\(\[data-theme='brand'\]\)/, "the theme was carried in a form that cannot match");
  assert.doesNotMatch(shell, /_user-style\.css/, "the page still links a route instead of carrying the bytes");

  const none = renderShell("x", "<p>hi</p>", "");
  assert.doesNotMatch(none, /<template id="app-css"/, "an empty stylesheet template shipped anyway");
});

test("a mock's markup never sits loose in the review page", () => {
  /**
   * The application's CSS styles `*`, `body` and `:root`. Loose in this document it restyles the
   * review surface into the thing under review — which happened once and took the page apart.
   */
  const shell = renderShell("x", '<div class="ux-mock"><template><div class="flex">hi</div></template></div>', "", {
    appCss: ".flex { display: flex }",
  });
  const mock = /<div class="ux-mock">([\s\S]*?)<\/div>\s*<\/template>/.exec(shell);
  assert.ok(mock, "the mock is not wrapped in a template at all");
  assert.match(mock[1], /^<template>/, "the mock's markup is in the page rather than in a template");
});

test("the scheme can point at where the product declares it, instead of copying it", () => {
  /**
   * ⛔ Peter, told the literal form existed: *"NEXT_PUBLIC_DS_THEME is the only live theme, we
   * always use that — use this theme. how would productOS remember this?"* By not remembering it.
   * A scheme name written into this config is a second record of a fact that already has a home,
   * and nothing makes the two agree: the app's flag moves, the copy does not, and every drawing
   * from then on is of the old scheme and looks exactly as authoritative as it did before.
   */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-theme-"));
  fs.mkdirSync(path.join(root, "app"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "app", ".env.local"),
    ["# the product's own flag", "OTHER=x", "export NEXT_PUBLIC_DS_THEME='brand'  # a trailing note", ""].join("\n")
  );
  assert.deepEqual(resolveTheme(root, "app/.env.local#NEXT_PUBLIC_DS_THEME"), {
    theme: "brand",
    from: { file: "app/.env.local", key: "NEXT_PUBLIC_DS_THEME", found: true },
  });

  // A literal still works, and is still a copy somebody chose to keep.
  assert.deepEqual(resolveTheme(root, "brand"), { theme: "brand" });

  // ⛔ A key nobody declared resolves to nothing AND SAYS SO. Unthemed is a legitimate answer; an
  //    unthemed drawing nobody decided on is not, and the two look identical on the page.
  for (const [raw, file] of [
    ["app/.env.local#NOT_SET", "app/.env.local"],
    ["nope/.env#NEXT_PUBLIC_DS_THEME", "nope/.env"],
  ]) {
    const r = resolveTheme(root, raw);
    assert.equal(r.theme, undefined, `${raw} invented a scheme`);
    assert.deepEqual(r.from, { file, key: raw.split("#")[1], found: false }, `${raw} did not say where it looked`);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test("a face the stylesheet loads travels with the drawing", () => {
  /**
   * ⛔ A MISSING FACE DOES NOT ERROR, IT FALLS BACK. A product whose display face is a serif renders
   * in whatever serif the machine has — close enough to look deliberate, wrong enough that no line
   * of type on the page can be judged. There is nowhere for a mock to fetch one from: a published
   * page is under a CSP that blocks every fetch, and `serve` has no route into a build directory.
   */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-faces-"));
  fs.mkdirSync(path.join(root, "productos"), { recursive: true });
  fs.mkdirSync(path.join(root, "build", "css"), { recursive: true });
  fs.mkdirSync(path.join(root, "build", "media"), { recursive: true });
  fs.writeFileSync(path.join(root, "build", "media", "face.woff2"), Buffer.from([0x77, 0x4f, 0x46, 0x32]));
  fs.writeFileSync(
    path.join(root, "build", "css", "app.css"),
    [
      "@font-face { font-family: Brand; src: url(../media/face.woff2) format('woff2') }",
      "@font-face { font-family: Gone; src: url(../media/absent.woff2) }",
      "@font-face { font-family: Rooted; src: url(/_next/static/media/face.woff2) }",
      ".x { background: url(https://example.com/a.png) }",
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(root, "productos", "config.yaml"),
    ["version: 0.0.1", "web:", "  stylesheets:", "    - build/css/app.css", ""].join("\n")
  );

  const app = appStyleFor(root);
  assert.match(app.css, /url\(data:font\/woff2;base64,d09GMg==\)/, "the face did not travel with the page");
  assert.deepEqual(app.inlined, ["face.woff2"]);
  // ⛔ Named, never dropped quietly: a budget that silently loses a face is a page claiming to show
  //    the product's type while lying about part of it.
  assert.deepEqual(app.unreachable, ["../media/absent.woff2", "/_next/static/media/face.woff2"]);
  // Somewhere else entirely is not ours to fetch, and is left exactly as written.
  assert.match(app.css, /url\(https:\/\/example\.com\/a\.png\)/, "an external URL was touched");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a sweep finds the screens in both corpus layouts, and writes each into its own", () => {
  /**
   * ⛔ A GENERATOR THAT SWEEPS ONE OF TWO CORPORA IS A CORPUS THAT GOES STALE WITH NOTHING SAYING
   * SO. `draw-write.ts` opens with that argument and makes it about the writer; the sweep above it
   * loaded the Exchange corpus and nothing else, so the products tree kept whatever an older
   * `draw` left in it — component names rendered as body text on a page somebody was reviewing.
   *
   * ⛔ AND EACH TREE IS WRITTEN IN ITS OWN ROOT. The writer finds a scope by the leaf of its id, so
   * `cre/deals/deal-list` and `deal-list` are the same scope to it: swept with one root, every v1
   * screen reported as redrawn, each one landed on the Exchange file with the similar id, and the
   * products tree was never touched. Both trees still parsed, so nothing anywhere said a word.
   */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-sweep-"));
  const put = (rel, body) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  };
  put(
    "productos/products/cre/deals/deal-list.md",
    ["---", "id: cre/deals/deal-list", "ux:", "  - id: deals-list", "    title: Deals", "    elements:", "      - id: new-deal", "        kind: button", "        label: New Deal", "---", ""].join("\n")
  );
  put("v2/truth/deal-list.md", ["---", "id: deal-list", "views:", "  - id: deals-list", "    title: Deals", "---", ""].join("\n"));

  const found = everyViewV1(root);
  assert.equal(found.length, 1, "the products tree was not swept at all");
  assert.equal(found[0].scope, "cre/deals/deal-list", "a v1 screen lost the scope it belongs to");
  assert.equal(found[0].root, root, "a v1 screen does not carry the tree it has to be written back into");
  // ⛔ The labels are what a route is resolved by, so an unshimmed element list is a screen that
  //    reports "nothing to find it by" and is skipped for the life of the corpus.
  assert.deepEqual(found[0].view.parts, [{ id: "new-deal", label: "New Deal", role: "button" }]);

  // The writer, handed each tree's own root, puts each drawing in that tree and not the other.
  const v1 = writeSketchHtml(root, "cre/deals/deal-list", "deals-list", "<b>one</b>");
  const v2 = writeSketchHtml(path.join(root, "v2"), "deal-list", "deals-list", "<b>two</b>");
  assert.equal(v1, path.join(root, "productos/products/cre/deals/deal-list.md"));
  assert.equal(v2, path.join(root, "v2/truth/deal-list.md"));
  assert.match(fs.readFileSync(v1, "utf-8"), /<b>one<\/b>/, "the products tree got the other tree's drawing");
  assert.match(fs.readFileSync(v2, "utf-8"), /<b>two<\/b>/, "the Exchange tree got the other tree's drawing");
  fs.rmSync(root, { recursive: true, force: true });
});

/** A repo with a corpus, a design system and a built stylesheet — enough to snapshot from. */
function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-style-"));
  const put = (rel, body) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  };
  put("build/media/face.woff2", Buffer.from([0x77, 0x4f, 0x46, 0x32]).toString("binary"));
  fs.writeFileSync(path.join(root, "build/media/face.woff2"), Buffer.from([0x77, 0x4f, 0x46, 0x32]));
  put("ds/tokens.css", ":root { --primary: blue }");
  put(
    "build/app.css",
    ["html[data-theme='brand'] { --primary: camel }", "@font-face { font-family: B; src: url(media/face.woff2) }"].join("\n")
  );
  put(
    "productos/config.yaml",
    ["version: 0.0.1", "web:", "  theme: brand", "  stylesheets:", "    - ds/tokens.css", "    - build/app.css", ""].join("\n")
  );
  fs.mkdirSync(path.join(root, "v2", "truth"), { recursive: true });
  put(
    "v2/truth/thing.md",
    ["---", "id: thing", "title: Thing", "views:", "  - id: screen", "    title: Screen", "---", ""].join("\n")
  );
  return { root, corpus: path.join(root, "v2"), put };
}

test("the corpus carries the design libraries, rather than referencing a repo", () => {
  /**
   * ⛔ Peter: *"we should copy the appropriate css files in - were we referencing the repo before?"*
   * We were, at render time, which is why a hosted instance rendered forty-four drawings and not one
   * byte of the application's CSS: it materializes a project into a temp directory and there is no
   * repository above it. Measured on a real store before this was written.
   */
  const { root, corpus } = project();
  const style = snapshotStyle(root, "2026-10-02");
  assert.equal(style.theme, "brand");
  assert.deepEqual(style.sources.map((s) => s.path), ["ds/tokens.css", "build/app.css"]);
  assert.ok(style.sources.every((s) => s.sha.length === 16 && s.bytes > 0), "a source carries no digest to catch it going stale");
  assert.match(style.css, /--primary: blue/);
  // The face travels, because the file it names will not exist wherever this is read.
  assert.match(style.css, /url\(data:font\/woff2;base64,/);
  assert.deepEqual(style.faces, ["face.woff2"]);
  // ⛔ NOT scoped here: scoping belongs to whichever surface renders it, and baking it in would make
  //    the snapshot right for one renderer and silently wrong for the next.
  assert.match(style.css, /html\[data-theme='brand'\]/);

  // And a page built from the corpus alone — no repository consulted — wears it.
  fs.writeFileSync(path.join(corpus, "style.yaml"), YAML.stringify({ style }));
  const loaded = loadCorpus(corpus);
  assert.deepEqual(loaded.broken, [], "style.yaml did not parse");
  const html = renderScopePage(loaded, "thing", { linkBase: "/v2", ...styleOf(loaded) });
  assert.match(html, /<template id="app-css" data-theme="brand">/, "the page does not carry the corpus's style");
  assert.match(html, /:host\(\[data-theme='brand'\]\)/, "the theme was carried in a form that cannot match");
  assert.match(html, /url\(data:font\/woff2/, "the faces did not reach the page");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a snapshot can be caught having gone stale, and says so only where it can tell", () => {
  /**
   * ⛔ Peter: *"we should have something that keeps the design libraries in sync."* A copy with no
   * fingerprint of its source cannot be kept in sync — it looks identical the day it is taken and
   * the year after, and the only symptom of a stale one is that every drawing is of a product that
   * has moved on, rendered just as confidently as a current one.
   */
  const { root, corpus, put } = project();
  const style = snapshotStyle(root, "2026-10-02");
  fs.writeFileSync(path.join(corpus, "style.yaml"), YAML.stringify({ style }));

  let drift = styleDrift(corpus, style);
  assert.equal(drift.known, true);
  assert.deepEqual([drift.moved, drift.gone, drift.added], [[], [], []], "a fresh snapshot reported as stale");

  put("ds/tokens.css", ":root { --primary: camel }");
  drift = styleDrift(corpus, style);
  assert.deepEqual(drift.moved, ["ds/tokens.css"], "an edited stylesheet was not noticed");

  put("ds/extra.css", ".x { color: red }");
  fs.writeFileSync(
    path.join(root, "productos/config.yaml"),
    ["version: 0.0.1", "web:", "  theme: brand", "  stylesheets:", "    - ds/tokens.css", "    - ds/extra.css", ""].join("\n")
  );
  drift = styleDrift(corpus, style);
  assert.deepEqual(drift.added, ["ds/extra.css"], "a stylesheet somebody added was not noticed");
  assert.deepEqual(drift.gone, ["build/app.css"], "a stylesheet somebody dropped was not noticed");

  /**
   * ⛔ "I CANNOT TELL" IS A THIRD ANSWER, AND IT IS THE HOSTED ONE. An instance has no repository to
   * compare against; reporting in-sync there would assert something nothing checked, on exactly the
   * surface where nobody can go and look.
   */
  const alone = fs.mkdtempSync(path.join(os.tmpdir(), "productos-nowhere-"));
  assert.deepEqual(styleDrift(alone, style), { known: false }, "a corpus with no repository claimed to know");
  assert.deepEqual(styleDrift(corpus, undefined), { known: false }, "a corpus with no snapshot claimed to know");
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(alone, { recursive: true, force: true });
});

test("the list of stylesheets is what gets read, not the single one", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-appcss-"));
  fs.mkdirSync(path.join(root, "productos"), { recursive: true });
  fs.mkdirSync(path.join(root, "styles"), { recursive: true });
  fs.writeFileSync(path.join(root, "styles", "tokens.css"), ":root { --a: 1 }");
  fs.writeFileSync(path.join(root, "styles", "theme.css"), "html[data-theme='brand'] { --a: 2 }");
  fs.writeFileSync(
    path.join(root, "productos", "config.yaml"),
    [
      "version: 0.0.1",
      "web:",
      "  theme: brand",
      "  stylesheets:",
      "    - styles/tokens.css",
      "    - styles/theme.css",
      "    - styles/gone.css",
      "",
    ].join("\n")
  );
  const app = appStyleFor(root);
  assert.equal(app.from.length, 2, "the list was not read");
  assert.deepEqual(app.missing, ["styles/gone.css"], "a path that resolves to nothing was not reported");
  assert.equal(app.theme, "brand");
  assert.deepEqual(app.themes, ["brand"], "the schemes in the stylesheets were not read");
  fs.rmSync(root, { recursive: true, force: true });
});
