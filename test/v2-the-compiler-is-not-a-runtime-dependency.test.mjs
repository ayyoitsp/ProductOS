/**
 * ⛔ A DEVDEPENDENCY WAS IMPORTED AT THE TOP OF A MODULE EVERY CLI VERB REACHES.
 *
 * `src/v2/draw.ts` opened with `import ts from "typescript"`, and `typescript` is in
 * `devDependencies`. So in **any install without dev dependencies — the runtime image, notably —
 * every CLI verb died on module resolution**, including every verb that never draws anything. The
 * hosted service escaped only because it boots `store/boot.js` and never reaches this file.
 *
 * It was live on 4100 when it was found, by the deploy session, and it had nothing to do with that
 * night's deploy — it had been true for as long as `draw.ts` had imported the compiler.
 *
 * ⛔ AND THE FIX IS NOT `dependencies`, WHICH IS THE OBVIOUS ONE. Moving it there ships a whole
 * TypeScript compiler in the runtime image to serve a path the hosted service never takes. The
 * import is made lazy instead: a `createRequire` behind a Proxy, so the compiler is resolved on the
 * first `ts.` property access — when a screen is actually drawn from a component.
 *
 * ⛔ THE CHECK IS THE SHARED CJS MODULE CACHE, NOT A STRING IN THE SOURCE. `import ts from
 * "typescript"` and `createRequire(...)("typescript")` both populate `Module._cache`, which every
 * `require` instance shares — so one cache lookup distinguishes "loaded" from "not loaded" without
 * caring which syntax got it there. A source assertion would pass the day somebody reintroduces the
 * eager import under a different spelling.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { temp } from "./support/temp.mjs";

/** Every `require` instance shares `Module._cache`, so this sees a load by any route. */
const req = createRequire(path.join(process.cwd(), "x.js"));
const compilerLoaded = () => Object.keys(req.cache).some((k) => /node_modules[/\\]typescript[/\\]/.test(k));

test("importing the drawing module does not load the TypeScript compiler", async () => {
  /**
   * ⛔ Asserted BEFORE the import, so a cache already warmed by another test in this file cannot
   * make the real assertion vacuous. `node --test` gives each file its own process, but the order
   * within a file is not something this test should depend on.
   */
  assert.equal(compilerLoaded(), false, "the compiler was already loaded before this test imported anything");

  await import("../dist/v2/draw.js");

  assert.equal(
    compilerLoaded(),
    false,
    "importing dist/v2/draw.js loaded the TypeScript compiler — so every CLI verb that reaches this " +
      "module dies on module resolution in an install without devDependencies"
  );
});

test("drawing a screen from a component does load it, and still draws", async () => {
  const { drawFromRoute } = await import("../dist/v2/draw.js");
  const dir = temp("tslazy-");
  fs.writeFileSync(
    path.join(dir, "page.tsx"),
    `export default function P() { return <div className="x">hi</div> }`
  );

  const r = drawFromRoute(path.join(dir, "page.tsx"));

  /**
   * ⛔ The other half of the claim. Deferring the import is worthless if it defers it forever — the
   * drawing has to still happen, and a lazy module that never resolves would make the first test
   * pass on its own.
   */
  assert.match(r.html, /class="x"/, "the screen no longer draws at all, so the compiler never loaded");
  assert.equal(compilerLoaded(), true, "a screen was drawn from a component without the compiler being loaded");
});

/**
 * ⛔ AND THE PACKAGE FILE STILL SAYS WHAT IT SAID, because the other fix for this bug is a one-line
 * move to `dependencies` and it would make both tests above pass while putting a compiler in the
 * image. This is the assertion that distinguishes the fix taken from the fix avoided.
 */
test("typescript stays a development dependency", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
  assert.ok(
    pkg.devDependencies?.typescript,
    "typescript is no longer a devDependency — if it moved to dependencies, the runtime image now " +
      "carries a compiler for a path the hosted service never takes"
  );
  assert.ok(
    !pkg.dependencies?.typescript,
    "typescript was added to dependencies, which ships the compiler in the runtime image"
  );
});
