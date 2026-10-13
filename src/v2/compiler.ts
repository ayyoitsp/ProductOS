/**
 * ⛔ THE TYPESCRIPT COMPILER, LOADED WHEN SOMETHING COMPILES — AND LOADED IN ONE PLACE.
 *
 * `typescript` is a devDependency. `import ts from "typescript"` at the top of a module means that
 * in any install without dev dependencies — the runtime image, notably — **every CLI verb dies on
 * module resolution**, including the ones that never touch a compiler. The hosted service escapes
 * only because it boots `store/boot.js` and never reaches here.
 *
 * ⛔ THIS FILE EXISTS BECAUSE THE FIX WAS APPLIED TO ONE MODULE AND NOT THE OTHER. `draw.ts` was
 * made lazy, shipped, and deployed — and `v2 analyse` still died in the container, now on
 * `design.js`, which had the same eager import twenty lines into a file about reading source text.
 * A long ⛔ comment in `draw.ts` explaining precisely this hazard did not stop it, because nobody
 * editing `design.ts` was reading `draw.ts`.
 *
 * ⛔ AND NOT BY MOVING IT TO `dependencies`, which is the other obvious fix: that ships a whole
 * compiler in the runtime image to serve a path the service never takes.
 *
 * ⛔ A PROXY RATHER THAN `await import`, BECAUSE THE USES ARE SYNCHRONOUS — 206 in `draw.ts` and 57
 * in `design.ts`. Making them async would mean rewriting every function that calls them for a
 * module-loading concern, a large change to working code in exchange for nothing a reader of those
 * functions would understand. `createRequire` is synchronous, so the first property access resolves
 * it and every call site stays exactly as it was. Type positions (`ts.Node`, `ts.Identifier`) never
 * touch the proxy at all; TypeScript elides them.
 */
import { createRequire } from "node:module";
import type * as TS from "typescript";

let compiler: typeof TS | undefined;

/** What the compiler is wanted for, so a failure names the thing somebody asked for. */
export function compilerFor(what: string): typeof TS {
  return new Proxy({} as typeof TS, {
    get(_target, prop) {
      if (!compiler) {
        try {
          compiler = createRequire(import.meta.url)("typescript") as typeof TS;
        } catch {
          /**
           * ⛔ Named, because the failure this replaces was `Cannot find module 'typescript'` from a
           * verb that had nothing to do with compiling, and that sent somebody looking in the wrong
           * place for an hour.
           */
          throw new Error(
            `${what} needs the TypeScript compiler, which is a development dependency and is not ` +
              "installed here. Run `npm install` in a checkout, or work from the truth and the " +
              "design system instead of from a component.",
          );
        }
      }
      return (compiler as unknown as Record<string | symbol, unknown>)[prop];
    },
  });
}
