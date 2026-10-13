import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * ⛔ THE RUNTIME IMAGE HAS NO DEV DEPENDENCIES, SO AN EAGER `typescript` IMPORT BREAKS EVERY VERB.
 *
 * `import ts from "typescript"` at the top of a module means that in an install without dev
 * dependencies — the runtime image — module resolution fails before any code runs, for verbs that
 * have nothing to do with compiling. `v2 analyse` died in the container that way.
 *
 * ⛔ AND THIS IS A TEST BECAUSE PROSE ALREADY FAILED. `draw.ts` was made lazy and carried a long ⛔
 * comment explaining exactly this hazard. It was fixed, merged, and DEPLOYED — and `v2 analyse`
 * still died in the container, on `design.js`, which had the same eager import all along. Nobody
 * editing `design.ts` was reading `draw.ts`. Same reason the `mkdtempSync` guard exists.
 */

const SRC = "src";

const sources = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const at = path.join(dir, e.name);
    return e.isDirectory() ? sources(at) : at.endsWith(".ts") ? [at] : [];
  });

test("no module imports the compiler eagerly", () => {
  const offenders = [];
  for (const file of sources(SRC)) {
    const text = fs.readFileSync(file, "utf-8");
    for (const [i, line] of text.split("\n").entries()) {
      /** ⛔ `import type` is erased at build and costs nothing at runtime — only a VALUE import counts. */
      if (/^\s*import\s+(?!type\b)[^;]*from\s+["']typescript["']/.test(line)) {
        offenders.push(`${file}:${i + 1}  ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these load the compiler at import time, which breaks every CLI verb in the runtime image:\n  ${offenders.join("\n  ")}`,
  );
});

test("the compiler has exactly one loader, so a fix cannot miss a module", () => {
  const loaders = sources(SRC).filter((f) => /createRequire\(import\.meta\.url\)\(["']typescript["']\)/.test(fs.readFileSync(f, "utf-8")));
  assert.deepEqual(loaders, ["src/v2/compiler.ts"], "the lazy loader is duplicated, or has moved");
});

/**
 * ⛔ AND THE PROOF IS A REAL RESOLUTION, NOT A GREP. The two tests above read source text; this one
 * asks node whether the built CLI loads with `typescript` genuinely unreachable, which is the thing
 * the container does and the thing that actually broke.
 */
test("the built CLI loads with the compiler unreachable", () => {
  const dist = "dist/cli/index.js";
  if (!fs.existsSync(dist)) return; /** a source-only checkout; the greps above still hold */

  /**
   * A scratch node_modules containing everything EXCEPT typescript, reached by pointing node's
   * resolution at a directory that shadows it. Simpler and more faithful: run with a loader that
   * refuses to resolve the package at all.
   */
  const hook = path.resolve("test/support/no-typescript.mjs");
  const out = execFileSync(process.execPath, ["--import", hook, dist, "v2", "analyse", "--help"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.doesNotMatch(out, /Cannot find package 'typescript'/, "the CLI still resolves the compiler at import time");
});
