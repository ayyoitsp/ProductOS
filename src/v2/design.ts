/**
 * ⛔ INDEX THE DESIGN SYSTEM, SO A DRAWN SCREEN IS BUILT FROM THE PRODUCT'S OWN PARTS.
 *
 * Peter: *"can we index the actual design system bilrost has with the prototypes now?"*
 *
 * Until this, a generated screen learned its idiom by FREQUENCY — the class strings that showed up
 * most often across the application's components. That is a reasonable guess about what a button
 * looks like and it is only ever a guess: it cannot tell a button from a thing shaped like one, it
 * averages over every variant, and it drifts the moment somebody writes a one-off.
 *
 * A design system is the product saying, authoritatively, what its parts ARE. Where one exists it
 * is not a better source of the same guess — it removes the guess.
 *
 * ⛔ READ, NEVER RUN. Everything here comes out of the source text: the component's exported name,
 * the base classes it always applies, and the variants it offers. Nothing is imported, nothing is
 * rendered, and a design system that does not build is still indexable — which matters, because the
 * screens most worth drawing are the ones being designed while the code is in flux.
 */
import fs from "node:fs";
import path from "node:path";
import type * as TS from "typescript";

import { compilerFor } from "./compiler.js";

/** ⛔ Lazy — see `compiler.ts`. An eager import here killed every CLI verb in the runtime image. */
const ts: typeof TS = compilerFor("indexing a design system");

export interface Variant {
  /** The axis — `variant`, `size`, `tone`. */
  axis: string;
  /** What it may be set to, in the order the source lists them. */
  options: string[];
}

export interface Piece {
  /** As it is imported: `Button`, `TextField`. */
  name: string;
  file: string;
  /** Classes it always applies, whatever the variant. */
  base: string;
  variants: Variant[];
  /** Classes for one spelling of it, so a drawing can be built from a real one. */
  classesFor: Record<string, string>;
}

export interface DesignSystem {
  root: string;
  /** ⛔ Only what the system EXPORTS. A component it keeps to itself is not a part of the product's vocabulary. */
  pieces: Piece[];
  /** What was found and could not be read, so a thin index is never mistaken for a thin system. */
  unread: string[];
}

const text = (n: TS.Node): string => (ts.isStringLiteralLike(n) ? n.text : "");

/**
 * Every name a barrel file exports.
 *
 * ⛔ THE BARREL IS THE VOCABULARY. A directory listing includes helpers, hooks and half-finished
 * things; `export { Button }` is the system saying this is one of its parts.
 */
function exported(root: string): Set<string> {
  const out = new Set<string>();
  for (const entry of ["index.ts", "index.tsx", "src/index.ts", "src/index.tsx"]) {
    const f = path.join(root, entry);
    if (!fs.existsSync(f)) continue;
    const src = ts.createSourceFile(f, fs.readFileSync(f, "utf-8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const walk = (n: TS.Node): void => {
      if (ts.isExportDeclaration(n) && n.exportClause && ts.isNamedExports(n.exportClause))
        for (const e of n.exportClause.elements) {
          /** ⛔ A type is not a part. `type ButtonProps` is how you talk about one. */
          if (!e.isTypeOnly) out.add(e.name.text);
        }
      ts.forEachChild(n, walk);
    };
    walk(src);
  }
  return out;
}

/**
 * The base classes and variants of one component.
 *
 * ⛔ `cva` IS THE SHAPE THIS LOOKS FOR, and it is the convention this system uses: a base string,
 * then a map of axes to the classes each option adds. Where a component is not written that way,
 * the longest literal class string in it is taken as its base — honest, because that is almost
 * always the root element, and reported as weaker evidence than a declared variant map.
 */
function readPiece(name: string, file: string): Piece | undefined {
  let source: TS.SourceFile;
  try {
    source = ts.createSourceFile(file, fs.readFileSync(file, "utf-8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  } catch {
    return undefined;
  }
  let base = "";
  const variants: Variant[] = [];
  const classesFor: Record<string, string> = {};

  const walk = (n: TS.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "cva") {
      const [first, config] = n.arguments;
      if (first) base = text(first);
      if (config && ts.isObjectLiteralExpression(config))
        for (const prop of config.properties) {
          if (!ts.isPropertyAssignment(prop) || prop.name.getText() !== "variants") continue;
          if (!ts.isObjectLiteralExpression(prop.initializer)) continue;
          for (const axis of prop.initializer.properties) {
            if (!ts.isPropertyAssignment(axis) || !ts.isObjectLiteralExpression(axis.initializer)) continue;
            const options: string[] = [];
            for (const opt of axis.initializer.properties) {
              if (!ts.isPropertyAssignment(opt)) continue;
              const key = opt.name.getText().replace(/['"]/g, "");
              options.push(key);
              const cls = text(opt.initializer);
              if (cls) classesFor[`${axis.name.getText()}:${key}`] = cls;
            }
            if (options.length) variants.push({ axis: axis.name.getText().replace(/['"]/g, ""), options });
          }
        }
    }
    ts.forEachChild(n, walk);
  };
  walk(source);

  if (!base) {
    /**
     * ⛔ THE FALLBACK TAKES THE CLASS ON THE THING ITSELF, NOT THE LONGEST ONE IN THE FILE.
     *
     * Longest-wins gave TextField the classes of a decorative wrapper —
     * `absolute inset-y-0 right-0 pointer-events-none` — which is the icon slot beside the input,
     * not the input. A drawing built from that is a screen of empty positioned boxes.
     *
     * A component that wraps a native control is telling you which element IS the control, so that
     * is the one asked. Longest-wins stays as the last resort, for a component that wraps nothing.
     */
    const CONTROL = /^(input|textarea|select|button)$/;
    let onControl = "";
    let longest = "";
    /**
     * ⛔ AND A CLASS LIST HELD IN A LOCAL IS STILL A CLASS LIST.
     *
     * TextField builds its input's classes into a `const` and passes the NAME:
     * `className={inputClasses}`. A reader that only understands literals and templates written in
     * place skipped the input and fell through to the longest plain string in the file — the
     * decorative icon slot beside it. The convention is ordinary; `draw` already resolves locals
     * for the same reason.
     */
    const locals = new Map<string, string>();
    const collect = (n: TS.Node): void => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
        /**
         * ⛔ AND `.trim()` AROUND IT IS NOT STRUCTURE. The convention is
         * `const inputClasses = \`${a} ${b}\`.trim()` — a call expression, so a reader looking for a
         * template found none. `draw` unwraps exactly this shape for exactly this reason.
         */
        let init: TS.Node = n.initializer;
        while (ts.isCallExpression(init) && ts.isPropertyAccessExpression(init.expression))
          init = init.expression.expression;
        if (ts.isParenthesizedExpression(init)) init = init.expression;
        const bits: string[] = [];
        if (ts.isStringLiteralLike(init)) bits.push(init.text);
        else if (ts.isTemplateExpression(init)) {
          /**
           * ⛔ A TEMPLATE'S INTERPOLATIONS ARE OFTEN WHERE THE CLASSES ARE.
           *
           * `\`${baseInputClasses} ${sizeClasses[size]} …\`` has nothing but spaces in its literal
           * chunks — every class is behind an identifier. Reading the chunks alone produced an
           * empty string, so the longest PLAIN string in the file won and TextField was indexed as
           * a decorative icon slot. The named ones resolve; the computed ones (`sizeClasses[size]`)
           * genuinely vary and are left out, which is the honest reading.
           */
          bits.push(init.head.text);
          for (const span of init.templateSpans) {
            const e = span.expression;
            if (ts.isIdentifier(e) && locals.has(e.text)) bits.push(locals.get(e.text)!);
            bits.push(span.literal.text);
          }
        }
        const joined = bits.join(" ").replace(/\s+/g, " ").trim();
        if (joined) locals.set(n.name.text, joined);
      }
      ts.forEachChild(n, collect);
    };
    collect(source);
    const classes = (n: TS.Node): void => {
      if (ts.isJsxAttribute(n) && n.name.getText() === "className" && n.initializer) {
        const v = ts.isJsxExpression(n.initializer) ? n.initializer.expression : n.initializer;
        /**
         * ⛔ A TEMPLATE LITERAL IS STILL A CLASS LIST. TextField composes its input's classes as
         * `${base} ${size} ${focus} …`, so a string-literal-only reader skipped the input entirely
         * and fell through to the longest plain string in the file — the decorative icon slot beside
         * it. The literal CHUNKS of a template are real classes; the interpolations are the parts
         * that vary, and leaving them out is the honest reading rather than a lossy one.
         */
        const pieces: string[] = [];
        if (!v) { ts.forEachChild(n, classes); return; }
        if (ts.isIdentifier(v) && locals.has(v.text)) pieces.push(locals.get(v.text)!);
        else if (ts.isStringLiteralLike(v)) pieces.push(v.text);
        else if (ts.isTemplateExpression(v)) {
          pieces.push(v.head.text, ...v.templateSpans.map((sp) => sp.literal.text));
        } else if (ts.isNoSubstitutionTemplateLiteral(v)) pieces.push(v.text);
        const joined = pieces.join(" ").replace(/\s+/g, " ").trim();
        if (joined) {
          const owner2 = n.parent.parent;
          const tag2 =
            ts.isJsxSelfClosingElement(owner2) ? owner2.tagName.getText()
            : ts.isJsxOpeningElement(owner2) ? owner2.tagName.getText()
            : "";
          if (joined.length > longest.length) longest = joined;
          if (CONTROL.test(tag2) && joined.length > onControl.length) onControl = joined;
        }
        if (v && ts.isStringLiteralLike(v)) {
          if (v.text.length > longest.length) longest = v.text;
          const owner = n.parent.parent;
          const tag =
            ts.isJsxSelfClosingElement(owner) ? owner.tagName.getText()
            : ts.isJsxOpeningElement(owner) ? owner.tagName.getText()
            : "";
          if (CONTROL.test(tag) && v.text.length > onControl.length) onControl = v.text;
        }
      }
      ts.forEachChild(n, classes);
    };
    classes(source);
    /**
     * ⛔ FOR ANYTHING THAT IS NOT A CONTROL, THE ROOT ELEMENT IS THE COMPONENT.
     *
     * Longest-wins gave Card the classes of its HEADING — `type-heading text-neutral-900 mb-4` —
     * so a drawn region would have been styled as a title. What a component IS, is its outermost
     * element; what is inside it is its contents.
     */
    let root = "";
    const rootOf = (n: TS.Node): void => {
      if (root) return;
      if (ts.isReturnStatement(n) && n.expression) {
        let e: TS.Node = n.expression;
        if (ts.isParenthesizedExpression(e)) e = e.expression;
        const open = ts.isJsxElement(e) ? e.openingElement : ts.isJsxSelfClosingElement(e) ? e : undefined;
        if (open)
          for (const a of open.attributes.properties)
            if (ts.isJsxAttribute(a) && a.name.getText() === "className" && a.initializer) {
              const v = ts.isJsxExpression(a.initializer) ? a.initializer.expression : a.initializer;
              if (v && ts.isStringLiteralLike(v)) root = v.text;
              else if (v && ts.isIdentifier(v) && locals.has(v.text)) root = locals.get(v.text)!;
            }
      }
      ts.forEachChild(n, rootOf);
    };
    rootOf(source);
    base = onControl || root || longest;
  }
  if (!base && !variants.length) return undefined;
  return { name, file, base, variants, classesFor };
}

/**
 * Index a design system.
 *
 * ⛔ RETURNS WHAT IT FOUND AND WHAT IT COULD NOT READ. A system indexed to four components out of
 * thirty looks exactly like a system with four components, and a generator built on the first would
 * quietly draw a quarter of the product's vocabulary.
 */
export function indexDesignSystem(root: string): DesignSystem | undefined {
  if (!fs.existsSync(root)) return undefined;
  const names = exported(root);
  const pieces: Piece[] = [];
  const unread: string[] = [];
  const seen = new Set<string>();

  const dirs = [path.join(root, "src", "components"), path.join(root, "components"), path.join(root, "src")];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (!/\.tsx$/.test(entry) || /\.test\.tsx$/.test(entry)) continue;
      const file = path.join(dir, entry);
      const stem = entry.replace(/\.tsx$/, "");
      /**
       * ⛔ EVERY EXPORTED NAME THE FILE HOLDS, not only its namesake. `Table.tsx` is `TableShell`,
       * `THead`, `Th`, `TBody` and `Td` — five parts of the vocabulary in one file, and indexing by
       * filename alone would find none of them.
       */
      const here = [...names].filter((n) => n === stem || fs.readFileSync(file, "utf-8").includes(`export function ${n}`) || fs.readFileSync(file, "utf-8").includes(`export const ${n}`));
      if (!here.length) {
        if (names.has(stem)) unread.push(stem);
        continue;
      }
      for (const n of here) {
        if (seen.has(n)) continue;
        seen.add(n);
        const piece = readPiece(n, file);
        if (piece) pieces.push(piece);
        else unread.push(n);
      }
    }
  }
  /** Named by the system and never found on disk — a vocabulary nobody can draw with. */
  for (const n of names) if (!seen.has(n) && !unread.includes(n)) unread.push(n);
  return { root, pieces: pieces.sort((a, b) => a.name.localeCompare(b.name)), unread: unread.sort() };
}

/**
 * The classes to draw one kind of thing with.
 *
 * ⛔ ASKED FOR BY ROLE, because that is what a part HAS — `commits`, `entry`, `region`. A drawing
 * knows it needs a button; it does not know this system calls that `Button` with `variant:primary`.
 */
export function drawWith(ds: DesignSystem, role: "commits" | "entry" | "display" | "region"): string | undefined {
  const find = (names: string[]): Piece | undefined =>
    ds.pieces.find((p) => names.some((n) => p.name.toLowerCase() === n));
  const piece =
    role === "commits"
      ? find(["button"])
      : role === "entry"
        ? find(["textfield", "input", "typedinput"])
        : role === "region"
          ? find(["card", "collapsiblesection"])
          : find(["pill", "badge"]);
  if (!piece) return undefined;
  /** The primary spelling where there is one, because a drawing shows a product at rest. */
  const primary =
    piece.classesFor["variant:primary"] ?? piece.classesFor["variant:default"] ?? Object.values(piece.classesFor)[0] ?? "";
  return `${piece.base} ${primary}`.trim();
}
