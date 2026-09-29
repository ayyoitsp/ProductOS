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
  /** Branches not drawn: the screen's other states, named so they are not lost silently. */
  states: string[];
  /** Parts the corpus declares that the drawing does not show. */
  undrawn: string[];
  /**
   * ⛔ THE SAME SCREEN AS PLAIN TEXT, FROM THE SAME PARSE — not a second drawing somebody keeps up.
   *
   * A packet is text handed to whoever builds the thing, and HTML is no use there, so the corpus
   * has always carried an ASCII sketch beside the generated one. It was hand-typed, and it was
   * therefore wrong the day after the component changed: a grid redrawn from the panel that
   * replaced it sat in one file beside an ASCII sketch still showing "2 staged pricing edits" and a
   * "Review and publish" button that had been deleted. Two renderings of one screen, one generated
   * and one typed, with nothing saying which was current.
   *
   * So both come from here. Nobody maintains this.
   */
  text: string;
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
  /** Branches not drawn: the screen's other states, named so they are not lost silently. */
  states: string[];
  /** Sample values for a placeholder, by the identifier that produced it. */
  sample: (hint: string) => string | undefined;
  /** The file being read, so a co-located component resolves before a same-named one elsewhere. */
  sameFile?: string;
  /**
   * ⛔ NAMES THAT ARE ICONS, WHICH THE DRAWING MUST NOT SPELL OUT.
   *
   * An unresolved component is named rather than dropped — right for a control, wrong for an icon.
   * The deals list came out reading "Building2", "SearchIcon", "XIcon", "ChevronLeft",
   * "ChevronRight" in the middle of the screen, which is not a wireframe of anything. Peter, on
   * seeing it: *"what renders there is ass"*. Known by where they are imported from, which is a
   * fact in the file rather than a guess about the name.
   */
  icons: Set<string>;
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
  /**
   * ⛔ THE BIGGEST RETURN, NOT THE FIRST.
   *
   * Taking the first `return` that holds JSX gets the guard: real components open with
   * `if (isPending) return <Skeleton/>` or `if (!data) return <Empty/>`, so the drawing came out as
   * a loading skeleton. Three screens regenerated to 101, 111 and 233 bytes — smaller and emptier
   * than the hand-typed ones they replaced, which is a generator producing a worse artefact while
   * reporting success.
   *
   * The main render is the largest by source span. That is a heuristic and it is a good one: a
   * guard is a line, a screen is a page. Where it is wrong the drawing is visibly a guard, which a
   * reviewer can see — unlike the silent version, where it looked like the screen.
   */
  const fromBody = (body: ts.Node): ts.Node | undefined => {
    let best: ts.Node | undefined;
    let widest = 0;
    const seek = (n: ts.Node): void => {
      if (ts.isReturnStatement(n) && n.expression) {
        const e = ts.isParenthesizedExpression(n.expression) ? n.expression.expression : n.expression;
        if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) {
          const span = e.getEnd() - e.getStart();
          if (span > widest) {
            widest = span;
            best = e;
          }
        }
      }
      ts.forEachChild(n, seek);
    };
    seek(body);
    return best;
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
    /**
     * ⛔ A SCREEN IS ONE STATE AT A TIME, AND THIS USED TO DRAW ALL OF THEM AT ONCE.
     *
     * `emit(whenTrue) + emit(whenFalse)` put the loading skeleton, the empty state and the populated
     * table on one screen, stacked — so the deals list showed "No deals yet" directly above a search
     * field and a pager. Peter: *"what renders there is ass"*. A superposition of three states is
     * not a picture of any of them, and a reviewer cannot tell which parts belong together.
     *
     * So one branch is chosen, and the rule is the one this file already argues for elsewhere: the
     * bigger side is the screen, the smaller is the guard. Loading and empty guards are skipped by
     * name first, because a skeleton can be long.
     *
     * ⛔ WHAT IS SKIPPED IS REPORTED. Those branches are the view's other STATES — the thing this
     * drawing cannot yet hold — and losing them silently is how a screen comes to claim it has one
     * appearance. `draw` says what it left out.
     */
    /**
     * ⛔ NARROW ON PURPOSE. The first version treated any condition containing `!` as an empty-state
     * guard, which threw away `rightIcon && !rightElement` and `hint && !error` — ordinary optional
     * content — and the deals list lost its search field and its New Deal button. A drawing missing
     * controls the product has is the thin drawing again, reached by trying to fix the opposite
     * problem. These match the two things that genuinely are other states, and nothing else.
     */
    const GUARD = /\b(isLoading|loading|isPending|pending|isFetching|busy|skeleton)\b/i;
    const EMPTY = /(===\s*0|!\s*\w+(?:\.\w+)*\.length\b|\blength\s*===\s*0\b|\bisEmpty\b|\bnoResults\b)/i;
    const pick = (cond: ts.Node, a: ts.Node, b: ts.Node): string => {
      const c = cond.getText();
      const span = (n: ts.Node): number => n.getEnd() - n.getStart();
      let chosen: ts.Node;
      let skipped: ts.Node;
      if (GUARD.test(c) || EMPTY.test(c)) { chosen = b; skipped = a; }
      else if (span(a) >= span(b)) { chosen = a; skipped = b; }
      else { chosen = b; skipped = a; }
      const other = skipped.getText().replace(/\s+/g, " ").slice(0, 60);
      if (other.trim()) ctx.states.push(`when ${c.replace(/\s+/g, " ").slice(0, 50)}: ${other}`);
      return emit(chosen, ctx);
    };
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      const c = e.left.getText();
      /** `{!deals.length && <Empty/>}` — a state, not the screen. Recorded and not drawn. */
      if (GUARD.test(c) || EMPTY.test(c)) {
        ctx.states.push(`when ${c.replace(/\s+/g, " ").slice(0, 50)}: ${e.right.getText().replace(/\s+/g, " ").slice(0, 60)}`);
        return "";
      }
      return emit(e.right, ctx);
    }
    if (ts.isConditionalExpression(e)) return pick(e.condition, e.whenTrue, e.whenFalse);
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
    /**
     * ⛔ A LOCAL JSX VARIABLE IS CONTENT, NOT A SLOT — and treating it as one deleted a button.
     *
     * `const newDealButton = (<button>…New Deal</button>)` used as `{newDealButton}` is an ordinary
     * way to keep a long render readable. Dropping bare identifiers took the New Deal button and
     * the search field straight off the deals list, which is the thin drawing arrived at while
     * fixing placeholder noise. Looked up in the file being read, so it costs nothing when absent.
     */
    if (ts.isIdentifier(e) && ctx.sameFile) {
      const local = localJsx(ctx.sameFile, e.text);
      if (local) return emit(local, ctx);
    }
    ctx.unresolved.push(hint);
    /**
     * ⛔ A SLOT IS NOT CONTENT. A bare identifier here is almost always a prop a caller would fill —
     * `actions`, `title`, `label`, `rightIcon` — and marking each one put twenty hatched ellipses on
     * a screen whose real text is four words. They are noise pretending to be information, and they
     * crowd out the parts of the drawing that are real.
     *
     * An expression with structure — a call, a member access, `deals.map(...)` — IS content the
     * screen would show, and stays marked, because omitting it silently produces the thin drawing.
     */
    if (ts.isIdentifier(e)) return "";
    return `<span class="productos-unknown" title="${text(hint)}">&hellip;</span>`;
  }
  if (!ts.isJsxElement(n) && !ts.isJsxSelfClosingElement(n)) return "";

  const open = ts.isJsxElement(n) ? n.openingElement : n;
  const tag = open.tagName.getText();
  const children = ts.isJsxElement(n) ? n.children.map((c) => emit(c, ctx)).join("") : "";

  // A component of the app's own: inline what it returns, one level at a time.
  if (/^[A-Z]/.test(tag)) {
    /**
     * ⛔ THE SAME FILE FIRST. A component directory is full of files whose exported component is a
     * thin wrapper over a co-located one — `export default function X() { return <XCard/> }` — and
     * resolving only by filename missed every one of them. `FannieMaeProgramSettings` is 1,162
     * lines and generated to 111 bytes: a wrapper, and an unresolved div where the screen was.
     */
    const file = ctx.sameFile && returnedJsx(ctx.sameFile, tag) ? ctx.sameFile : ctx.resolve(tag);
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
            /**
             * ⛔ AND A LOCAL HELD IN A VARIABLE, RESOLVED HERE WHERE IT STILL EXISTS.
             *
             * `<PageHeader actions={newDealButton} />` names something declared a few lines up in
             * the ROUTE. By the time `{actions}` is reached the reader is inside PageHeader.tsx,
             * where that name means nothing — so the New Deal button vanished from the deals list
             * even after locals were resolvable, because it was resolved in the wrong file. Bound at
             * the call site, which is the only place it is in scope.
             */
            else if (ts.isIdentifier(v) && ctx.sameFile) {
              const local = localJsx(ctx.sameFile, v.text);
              if (local) bound.set(name, emit(local, { ...ctx, depth: ctx.depth + 1 }));
            }
          }
        }
        const sub: Ctx = { ...ctx, depth: ctx.depth + 1, props: bound, sameFile: file };
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
    /**
     * ⛔ AN ICON IS DRAWN AS A MARK. Spelling it out puts the word "ChevronRight" in the middle of a
     * pagination control, which is not a wireframe of anything — and there were five of them on one
     * screen. It is still recorded as unresolved, because the drawing genuinely does not know what
     * the glyph looks like; what changes is that it stops lying about the screen's text.
     */
    if (ctx.icons.has(tag)) {
      ctx.unresolved.push(`<${tag}> (icon)`);
      return `<span class="productos-icon" role="img" aria-label="${text(tag)}"></span>`;
    }
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
    if (ts.isStringLiteral(a.initializer)) {
      attrs.push(`${name}="${text(a.initializer.text)}"`);
      continue;
    }
    /**
     * ⛔ AN ATTRIBUTE BOUND FROM THE CALL SITE IS STILL THE PRODUCT'S OWN WORDS.
     *
     * Only string literals survived here, so `<TextField placeholder="Search deals…" />` inlined to
     * a bare `<input />`: the primitive writes `placeholder={placeholder}`, an expression, and the
     * text was dropped one layer below where it was written. The deals list drew an empty box where
     * the product has a labelled search field. Bound props are already resolved for children; this
     * is the same lookup, for the attributes a reader can see.
     */
    if (ts.isJsxExpression(a.initializer) && a.initializer.expression) {
      const v = a.initializer.expression;
      if (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) attrs.push(`${name}="${text(v.text)}"`);
      else if (ts.isIdentifier(v) && ctx.props.has(v.text)) {
        const bound = ctx.props.get(v.text)!;
        /** Only if it is plain text — a bound prop can be rendered markup, which is not an attribute. */
        if (!/[<>]/.test(bound)) attrs.push(`${name}="${text(bound)}"`);
      }
    }
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

/**
 * `const <name> = (<jsx/>)` in a file, if it is there.
 *
 * Cached per file: `emit` asks for several names per render and re-parsing a 1,200-line route for
 * each one is the difference between a drawing and a pause.
 */
const localCache = new Map<string, Map<string, ts.Node>>();
function localJsx(file: string, name: string): ts.Node | undefined {
  let found = localCache.get(file);
  if (!found) {
    found = new Map<string, ts.Node>();
    try {
      const src = ts.createSourceFile(file, fs.readFileSync(file, "utf-8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const walk = (n: ts.Node): void => {
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
          const init = ts.isParenthesizedExpression(n.initializer) ? n.initializer.expression : n.initializer;
          if (ts.isJsxElement(init) || ts.isJsxSelfClosingElement(init) || ts.isJsxFragment(init)) found!.set(n.name.text, init);
        }
        ts.forEachChild(n, walk);
      };
      walk(src);
    } catch {
      /* an unreadable file simply has no locals */
    }
    localCache.set(file, found);
  }
  return found.get(name);
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
  /**
   * Names imported from an icon package, in this file and in anything it inlines. Collected up
   * front because `emit` walks several files and an icon is an icon wherever it came from.
   */
  const icons = new Set<string>();
  const learnIcons = (file: string): void => {
    let body: string;
    try {
      body = fs.readFileSync(file, "utf-8");
    } catch {
      return;
    }
    for (const m of body.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
      if (!/lucide|heroicons|react-icons|@tabler\/icons|phosphor|@radix-ui\/react-icons/i.test(m[2] ?? "")) continue;
      for (const raw of (m[1] ?? "").split(",")) {
        const name = raw.split(" as ").pop()!.trim();
        if (name) icons.add(name);
      }
    }
  };
  learnIcons(routeFile);
  for (const f of index.values()) learnIcons(f);

  const ctx: Ctx = {
    icons,
    resolve: (name) => index.get(name),
    sameFile: routeFile,
    depth: 0,
    from: new Set([path.basename(routeFile)]),
    unresolved: [],
    states: [],
    props: new Map(),
    sample: (hint) => {
      const s = opts.sample ?? {};
      for (const [k, v] of Object.entries(s)) if (hint.includes(k)) return v;
      return undefined;
    },
  };
  const jsx = returnedJsx(routeFile);
  if (!jsx) return { html: "", from: [...ctx.from], unresolved: ["the route exports no component this can read"], undrawn: [], states: [], text: "" };
  const plain = emit(jsx, ctx);
  const wired = opts.parts?.length ? wireParts(plain, opts.parts) : { html: plain, matched: new Set<string>() };
  /**
   * ⛔ A PART THE DRAWING DOES NOT SHOW IS REPORTED, NEVER DROPPED. Silently omitting it makes the
   * drawing look complete while a control the corpus claims exists is nowhere on it.
   */
  const undrawn = (opts.parts ?? []).filter((p) => !wired.matched.has(p.id) && !p.decorative).map((p) => p.id);
  return { html: wired.html, from: [...ctx.from], unresolved: [...new Set(ctx.unresolved)], undrawn, states: [...new Set(ctx.states)], text: asText(wired.html) };
}

/**
 * The drawing as plain text.
 *
 * ⛔ DERIVED FROM THE DRAWING, NOT FROM THE COMPONENT A SECOND TIME. Two passes over the same source
 * is two things that can disagree, and they would — one would learn about a new element and the
 * other would not. This reads what was just emitted, so the two renderings cannot describe different
 * screens.
 *
 * ⛔ AN OUTLINE, NOT A BOX. The sketches this replaces were box-drawn by hand and beautiful, and
 * that is precisely why nobody regenerated them. Column widths cannot be computed from markup
 * without inventing a layout, and an invented layout is a claim about a screen nobody made. Indented
 * text says what is there and in what order, which is the part a builder needs, and it says nothing
 * it does not know.
 */
export function asText(html: string): string {
  const out: string[] = [];
  const stack: string[] = [];
  /** Inside a marker we have already printed: its children would repeat what the marker said. */
  let skipBelow = -1;
  /** A component marker whose next text child would just repeat its name. */
  let skipComponentName = "";
  let text = "";
  const indent = (): string => "  ".repeat(Math.min(stack.length, 8));
  const flush = (): void => {
    const t = text.replace(/\s+/g, " ").trim();
    if (t) out.push(indent() + t);
    text = "";
  };
  /** The tags that start their own line. Anything else is part of the sentence it sits in. */
  const BLOCK = /^(div|section|header|footer|main|aside|nav|form|ul|ol|li|table|thead|tbody|tr|p|h[1-6]|details|summary|dl|dt|dd|figure|blockquote)$/;

  for (const tok of html.split(/(<[^>]+>)/)) {
    if (!tok) continue;
    if (tok[0] !== "<") {
      if (skipBelow >= 0) continue;
      const t = decode(tok);
      /** ⛔ A component marker's only child is usually its own name. Once is enough. */
      if (skipComponentName && t.trim() === skipComponentName) {
        skipComponentName = "";
        continue;
      }
      skipComponentName = "";
      text += t;
      continue;
    }
    const close = tok[1] === "/";
    const name = (tok.match(/^<\/?([a-zA-Z0-9]+)/) ?? [])[1]?.toLowerCase() ?? "";
    const selfClosing = /\/>$/.test(tok) || VOID.has(name);

    if (close) {
      const depth = stack.length - 1;
      stack.pop();
      /** ⛔ The marker's own close is what ends the skip — nested closes inside it must not. */
      if (skipBelow >= 0 && depth <= skipBelow) skipBelow = -1;
      else if (skipBelow >= 0) continue;
      if (name === "button") text += text.trimEnd().endsWith("[") ? " … ]" : " ]";
      else if (BLOCK.test(name)) flush();
      continue;
    }

    if (skipBelow >= 0) {
      if (!selfClosing) stack.push(name);
      continue;
    }

    /**
     * ⛔ A PLACEHOLDER KEEPS WHAT IT COULD NOT READ. "…" alone tells a builder nothing; the
     * expression tells them which part of the screen is a guess and what it was going to be.
     */
    const component = (tok.match(/data-component="([^"]*)"/) ?? [])[1];
    const title = (tok.match(/title="([^"]*)"/) ?? [])[1];
    if (/productos-unknown/.test(tok) || component) {
      text += component ? ` «${component}» ` : ` …(${decode(title ?? "")}) `;
      if (!selfClosing) {
        stack.push(name);
        /**
         * ⛔ ONLY A PLACEHOLDER WITH NOTHING IN IT IS SKIPPED.
         *
         * A `productos-unknown` span for an expression holds one ellipsis, and printing it after the
         * marker gives "…(rows.map(…))…". But the SAME class wraps a component the drawer could not
         * inline — `«TableShell»` — and that one has the real table under it. Skipping both dropped
         * the entire options grid out of the text, which is the one thing a builder most needs to
         * see, in exchange for tidying up a duplicate ellipsis.
         */
        if (!component) skipBelow = stack.length - 1;
        else skipComponentName = component;
      }
      continue;
    }

    if (name === "input" || name === "textarea") {
      const ph = (tok.match(/placeholder="([^"]*)"/) ?? [])[1];
      text += ph ? ` [ ${decode(ph)} ] ` : " [            ] ";
      if (!selfClosing) stack.push(name);
      continue;
    }
    if (name === "br") {
      flush();
      continue;
    }
    if (name === "button") {
      /** Spaces both sides so the label reads as a thing you press once whitespace is collapsed. */
      text += " [ ";
      stack.push(name);
      continue;
    }
    if (name === "td" || name === "th") {
      if (text.trim()) text += "  |  ";
      stack.push(name);
      continue;
    }
    if (BLOCK.test(name)) {
      flush();
      if (!selfClosing) stack.push(name);
      continue;
    }
    if (!selfClosing) stack.push(name);
  }
  flush();
  /** ⛔ Consecutive blanks collapse: nesting produces them and they are not information. */
  const lines = out.filter((l, i) => l.trim() || (out[i - 1] ?? "").trim());
  if (!lines.length) return "";
  /**
   * ⛔ THE FIRST LINE CANNOT BE DEEPER THAN ANY AFTER IT, OR THE CORPUS WILL NOT LOAD.
   *
   * A YAML literal block takes its indentation from its first non-empty line, and a later line
   * shallower than that ends the block mid-sentence — so the scope stops parsing and every command
   * reports it as broken. It is not a formatting nicety: this drawing opens inside two nested
   * elements and closes at the top level, so the natural outline is exactly the shape YAML refuses.
   *
   * Caught by the test that loads the corpus back after drawing into it, which is why that test
   * loads it rather than reading the file. Writing a generated artefact that the parser then
   * refuses is the one failure a generator must not have.
   */
  const min = Math.min(...lines.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
  const flat = lines.map((l) => l.slice(min));
  flat[0] = flat[0]!.trimStart();
  return flat.join("\n");
}

const decode = (s: string): string =>
  s
    .replace(/&hellip;/g, "…")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");

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
