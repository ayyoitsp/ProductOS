/**
 * ⛔ THE SCREEN IS GENERATED FROM THE CODEBASE. NOBODY TYPES IT.
 *
 * Peter, four times: feedback on a rendered screen is a bug report against ProductOS, and the last
 * one was "DON'T EVER JUST MAKE A CHANGE TO THE OUTPUT. REGENERATE."
 *
 * He is right about the mechanism and not only the etiquette. Eleven screens were hand-written into
 * a corpus, so when he said they were thin the shortest path was to hand-write them again — and the
 * next corpus, and the next session, gets nothing. A hand-authored mock also cannot be re-derived
 * when the application changes, so it is wrong the day after it is written and nothing says so.
 *
 * So: read the route's component, inline the primitives it composes, and emit static HTML with the
 * application's own class names. `productos v2 draw` is re-runnable, which is the whole point — the
 * screens are output, and output is regenerated.
 *
 * ⛔ WHAT IT CANNOT DO, SAID OUT LOUD. This is a transform, not a renderer: it does not execute
 * hooks, resolve data, or evaluate conditions. An expression it cannot read becomes a marked
 * placeholder rather than a guess, because a mock that invents a value teaches a reviewer something
 * the product does not do. Coverage of PARTS and of stated refs is mechanical and complete; the
 * realism of sample values is not, and the placeholders say which is which.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { wireParts, type WireablePart } from "./wire.js";

export interface DrawResult {
  html: string;
  /** Components inlined, so the report can say what the drawing was built from. */
  from: string[];
  /** Expressions that could not be read, left as marked placeholders. */
  unresolved: string[];
  /** Parts the corpus declares that the drawing does not show. */
  undrawn: string[];
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** Props that are behaviour, never markup. */
const DROP_PROP = (name: string): boolean =>
  /^on[A-Z]/.test(name) ||
  ["key", "ref", "draggable", "suppressHydrationWarning"].includes(name) ||
  name.startsWith("data-testid");

const text = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The string parts of a className, whatever shape it is written in. */
function classOf(node: ts.JsxAttributeValue | undefined): string {
  if (!node) return "";
  const out: string[] = [];
  const walk = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    else if (ts.isTemplateExpression(n)) {
      out.push(n.head.text);
      for (const sp of n.templateSpans) {
        /**
         * ⛔ BOTH BRANCHES OF A CONDITIONAL CLASS, and that is deliberate. A tab is
         * `active ? 'border-blue-600' : 'border-transparent'`; taking one arm silently draws one
         * state and calls it the screen. Taking both over-styles a little and shows what the
         * element can look like, which a reviewer can see and correct.
         */
        walk(sp.expression);
        out.push(sp.literal.text);
      }
    } else if (ts.isConditionalExpression(n)) {
      walk(n.whenTrue);
      walk(n.whenFalse);
    } else if (ts.isBinaryExpression(n)) {
      walk(n.left);
      walk(n.right);
    } else if (ts.isJsxExpression(n) && n.expression) walk(n.expression);
    else if (ts.isParenthesizedExpression(n)) walk(n.expression);
  };
  walk(node);
  return [...new Set(out.join(" ").split(/\s+/).filter(Boolean))].join(" ");
}

interface Ctx {
  /** Component name → its source file, for inlining one level at a time. */
  resolve: (name: string) => string | undefined;
  depth: number;
  from: Set<string>;
  unresolved: string[];
  /** Sample values for a placeholder, by the identifier that produced it. */
  sample: (hint: string) => string | undefined;
  /**
   * ⛔ THE CALL SITE'S PROPS, WITHOUT WHICH INLINING IS POINTLESS.
   *
   * `<PageHeader title="CRE Deals" />` renders `{title}` inside the primitive. Inlining the body
   * and not binding the props produced a header whose every word was a placeholder — the drawing
   * had the right structure and said nothing, which is worse than no drawing because it looks
   * finished.
   */
  props: Map<string, string>;
}

/** A component's own returned JSX, found by name in a file. */
function returnedJsx(file: string, name?: string): ts.Node | undefined {
  const src = ts.createSourceFile(file, fs.readFileSync(file, "utf-8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found: ts.Node | undefined;
  const fromBody = (body: ts.Node): ts.Node | undefined => {
    let jsx: ts.Node | undefined;
    const seek = (n: ts.Node): void => {
      if (jsx) return;
      if (ts.isReturnStatement(n) && n.expression) {
        const e = ts.isParenthesizedExpression(n.expression) ? n.expression.expression : n.expression;
        if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) jsx = e;
      }
      ts.forEachChild(n, seek);
    };
    seek(body);
    return jsx;
  };
  /**
   * ⛔ A NAMED EXPORT IS AS ORDINARY AS A DEFAULT ONE. Looking only for `export default` refused
   * the workspace shell outright — `export function DealWorkspaceShell` — and reported "the route
   * exports no component this can read", which reads as the generator being unable to handle the
   * file rather than as a lookup that never tried.
   *
   * So: the name if one was asked for; else the default export; else the exported component whose
   * name matches the file, which is the convention every component directory follows; else the only
   * exported component in the file.
   */
  const byName = new Map<string, ts.Node>();
  let dflt: ts.Node | undefined;
  const exported = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isFunctionDeclaration(n) && n.body && n.name) {
      const mods = n.modifiers ?? [];
      const isExport = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const isDefault = mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
      const jsx = fromBody(n.body);
      if (jsx) {
        byName.set(n.name.text, jsx);
        if (isExport) exported.add(n.name.text);
        if (isDefault) dflt = jsx;
      }
    }
    if (ts.isVariableStatement(n)) {
      const isExport = (n.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      for (const d of n.declarationList.declarations)
        if (ts.isIdentifier(d.name) && d.initializer) {
          const jsx = fromBody(d.initializer);
          if (!jsx) continue;
          byName.set(d.name.text, jsx);
          if (isExport) exported.add(d.name.text);
        }
    }
    ts.forEachChild(n, visit);
  };
  visit(src);

  if (name && byName.has(name)) return byName.get(name);
  if (!name && dflt) return dflt;
  const base = path.basename(file).replace(/\.tsx?$/, "");
  if (byName.has(base) && (!name || name === base)) return byName.get(base);
  if (!name && exported.size === 1) return byName.get([...exported][0]!);
  return found ?? (name ? undefined : dflt);
}

/** Turn one JSX node into HTML. */
function emit(node: ts.Node, ctx: Ctx): string {
  /**
   * ⛔ UNWRAP PARENTHESES FIRST. Every conditional branch in real JSX is written
   * `cond && ( <div…> )`, so a walker that only recognises JSX nodes silently returned nothing for
   * every branch — and the drawing came out as the page header and nothing else. Structurally
   * plausible, completely empty: the thin drawing again, this time produced by the generator.
   */
  const n = ts.isParenthesizedExpression(node) ? node.expression : node;
  if (ts.isJsxFragment(n)) return n.children.map((c) => emit(c, ctx)).join("");
  if (ts.isJsxText(n)) {
    const t = n.text.replace(/\s+/g, " ");
    return t.trim() ? text(t) : t === " " ? " " : "";
  }
  if (ts.isJsxExpression(n)) {
    if (!n.expression) return "";
    const e = n.expression;
    // `{cond && <X/>}` — draw the element: a mock exists to show the states, not to hide them.
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return emit(e.right, ctx);
    if (ts.isConditionalExpression(e)) return emit(e.whenTrue, ctx) + emit(e.whenFalse, ctx);
    if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) return emit(e, ctx);
    if (ts.isStringLiteral(e)) return text(e.text);
    /**
     * ⛔ A VALUE IT CANNOT READ BECOMES A MARKED PLACEHOLDER, NEVER A GUESS. A mock that invents a
     * figure teaches a reviewer something the product does not do, and they cannot tell which
     * numbers were real.
     */
    const hint = e.getText().replace(/\s+/g, " ").slice(0, 40);
    // A prop bound at the call site: the value the application actually passes.
    if (ts.isIdentifier(e) && ctx.props.has(e.text)) return ctx.props.get(e.text)!;
    const s = ctx.sample(hint);
    if (s !== undefined) return text(s);
    ctx.unresolved.push(hint);
    return `<span class="productos-unknown" title="${text(hint)}">&hellip;</span>`;
  }
  if (!ts.isJsxElement(n) && !ts.isJsxSelfClosingElement(n)) return "";

  const open = ts.isJsxElement(n) ? n.openingElement : n;
  const tag = open.tagName.getText();
  const children = ts.isJsxElement(n) ? n.children.map((c) => emit(c, ctx)).join("") : "";

  // A component of the app's own: inline what it returns, one level at a time.
  if (/^[A-Z]/.test(tag)) {
    const file = ctx.resolve(tag);
    if (file && ctx.depth < 4) {
      ctx.from.add(path.basename(file));
      const inner = returnedJsx(file, tag) ?? returnedJsx(file);
      if (inner) {
        /** Bind what the call site passes, so the primitive renders the application's own words. */
        const bound = new Map<string, string>();
        for (const a of open.attributes.properties) {
          if (!ts.isJsxAttribute(a) || !a.initializer) continue;
          const name = a.name.getText();
          if (ts.isStringLiteral(a.initializer)) bound.set(name, text(a.initializer.text));
          else if (ts.isJsxExpression(a.initializer) && a.initializer.expression) {
            const v = a.initializer.expression;
            if (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) bound.set(name, text(v.text));
            else if (ts.isNumericLiteral(v)) bound.set(name, v.text);
            else if (ts.isJsxElement(v) || ts.isJsxSelfClosingElement(v) || ts.isJsxFragment(v))
              bound.set(name, emit(v, { ...ctx, depth: ctx.depth + 1 }));
          }
        }
        const sub: Ctx = { ...ctx, depth: ctx.depth + 1, props: bound };
        const body = emit(inner, sub);
        // `{children}` inside the primitive is where this element's own children belong.
        return body.includes("<!--children-->") ? body.replace("<!--children-->", children) : body + children;
      }
    }
    /**
     * ⛔ AN UNRESOLVED COMPONENT IS NAMED, NOT DROPPED. Silently omitting it produces a screen
     * missing a control the application has — which is the thin drawing again, arrived at
     * mechanically.
     */
    ctx.unresolved.push(`<${tag}>`);
    return `<div class="productos-unknown" data-component="${text(tag)}">${children || text(tag)}</div>`;
  }

  const attrs: string[] = [];
  for (const a of open.attributes.properties) {
    if (!ts.isJsxAttribute(a)) continue;
    const name = a.name.getText();
    if (DROP_PROP(name)) continue;
    if (name === "className") {
      const cls = classOf(a.initializer);
      if (cls) attrs.push(`class="${text(cls)}"`);
      continue;
    }
    if (!a.initializer) {
      attrs.push(name);
      continue;
    }
    if (ts.isStringLiteral(a.initializer)) attrs.push(`${name}="${text(a.initializer.text)}"`);
  }
  const attr = attrs.length ? ` ${attrs.join(" ")}` : "";
  if (VOID.has(tag)) return `<${tag}${attr} />`;
  return `<${tag}${attr}>${children}</${tag}>`;
}

export interface DrawOptions {
  /** Where the app's components live, from `web.components_dir`. */
  componentsDir?: string;
  /**
   * The parts the corpus says this screen has.
   *
   * ⛔ WITHOUT THESE THE GENERATOR PRODUCES A DRAWING NOBODY CAN POINT AT, and the instruction that
   * filled the gap was "say which element is which part, with data-part=" — an edit applied on top
   * of generator output, in a field the next run overwrites. The part list is at the call site; the
   * generator should use it rather than ask.
   */
  parts?: WireablePart[];
  /** Values for expressions, so a placeholder can be a real-looking figure where the author gave one. */
  sample?: Record<string, string>;
}

export function drawFromRoute(routeFile: string, opts: DrawOptions = {}): DrawResult {
  const root = opts.componentsDir;
  const index = new Map<string, string>();
  if (root && fs.existsSync(root)) {
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === "node_modules" || e.name === "__tests__") continue;
          walk(p);
        } else if (/\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name)) index.set(e.name.replace(/\.tsx$/, ""), p);
      }
    };
    walk(root);
  }
  const ctx: Ctx = {
    resolve: (name) => index.get(name),
    depth: 0,
    from: new Set([path.basename(routeFile)]),
    unresolved: [],
    props: new Map(),
    sample: (hint) => {
      const s = opts.sample ?? {};
      for (const [k, v] of Object.entries(s)) if (hint.includes(k)) return v;
      return undefined;
    },
  };
  const jsx = returnedJsx(routeFile);
  if (!jsx) return { html: "", from: [...ctx.from], unresolved: ["the route exports no component this can read"], undrawn: [] };
  const plain = emit(jsx, ctx);
  const wired = opts.parts?.length ? wireParts(plain, opts.parts) : { html: plain, matched: new Set<string>() };
  /**
   * ⛔ A PART THE DRAWING DOES NOT SHOW IS REPORTED, NEVER DROPPED. Silently omitting it makes the
   * drawing look complete while a control the corpus claims exists is nowhere on it.
   */
  const undrawn = (opts.parts ?? []).filter((p) => !wired.matched.has(p.id) && !p.decorative).map((p) => p.id);
  return { html: wired.html, from: [...ctx.from], unresolved: [...new Set(ctx.unresolved)], undrawn };
}

/**
 * ⛔ HAS THIS DRAWING BEEN TYPED OVER, OR HAS ITS SOURCE MOVED?
 *
 * The clause that catches the thing that keeps happening. A generated artefact sitting in a corpus
 * is only trustworthy while it still matches what the generator produces — and the two ways it
 * stops matching are the two things worth knowing:
 *
 *   somebody edited the drawing      → the edit is about to be lost, and was the wrong fix anyway
 *   somebody changed the component   → the drawing is describing an application that has moved on
 *
 * Both look identical in the file, which is why neither was ever noticed. This cannot tell them
 * apart either — but it can say the drawing and the code disagree, which is the part nobody knew.
 *
 * ⛔ It compares content, not timestamps. A modification time says who wrote last, not whether what
 * they wrote is still right, and it is destroyed by a checkout.
 */
export function driftedFrom(routeFile: string, inCorpus: string, opts: DrawOptions = {}): { drifted: boolean; now: string; was: string } {
  const now = drawFromRoute(routeFile, opts).html;
  const norm = (h: string) => h.replace(/\s+/g, " ").trim();
  return { drifted: norm(now) !== norm(inCorpus), now, was: inCorpus };
}
