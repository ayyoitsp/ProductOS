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
  /**
   * ⛔ WHERE THIS DREW ONE OF SEVERAL UNRELATED SCREENS AND CANNOT KNOW WHICH IS RIGHT.
   * Never empty quietly: a caller that does not report these ships a confident drawing of another
   * product's screen.
   */
  forks: Array<{ on: string; chose: string; others: string[]; where: string }>;
  /** Each of those states, DRAWN — the same walk, taking the arm it normally declines. */
  drawnStates: DrawnState[];
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

/**
 * ⛔ AN ENTITY THE SOURCE ALREADY WROTE IS NOT ESCAPED A SECOND TIME.
 *
 * JSX text is HTML: a component writes `We&apos;ll put the sizing model here` and means an
 * apostrophe. Escaping the ampersand again put the literal characters "We&apos;ll" on the folder
 * step of the create-a-deal prototype — the screen reading as though the product ships raw markup,
 * which is a defect a reviewer would rightly report against the product rather than against us.
 *
 * Only a well-formed entity is spared, so a bare ampersand in ordinary prose — "Smith & Co" — is
 * still escaped exactly as before.
 */
const text = (s: string): string =>
  s
    .replace(/&(?!(#\d{1,6}|#[xX][0-9a-fA-F]{1,5}|[a-zA-Z][a-zA-Z0-9]{1,31});)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** The string parts of a className, whatever shape it is written in. */
/**
 * The expression a locally-declared helper returns, for `className={helper(x)}`.
 *
 * ⛔ ONLY THE SINGLE-EXPRESSION SHAPE — `const f = (…) => <expr>` and a function whose body is one
 * `return`. That is how a class helper is written; anything with branching or statements is a
 * program, and guessing which path it takes would be inventing styling rather than reading it.
 */
function bodyOfLocal(name: ts.Identifier): ts.Expression | undefined {
  const sf = name.getSourceFile();
  let found: ts.Expression | undefined;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name.text && n.initializer) {
      const init = n.initializer;
      if (ts.isArrowFunction(init)) found = ts.isBlock(init.body) ? returnedExpression(init.body) : init.body;
      else if (ts.isFunctionExpression(init)) found = returnedExpression(init.body);
    } else if (ts.isFunctionDeclaration(n) && n.name?.text === name.text && n.body) {
      found = returnedExpression(n.body);
    }
    if (!found) ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return found;
}

/** The expression of a block's only `return`, where there is exactly one. */
function returnedExpression(block: ts.Block): ts.Expression | undefined {
  const returns = block.statements.filter(ts.isReturnStatement);
  return returns.length === 1 ? returns[0]!.expression : undefined;
}

function classOf(node: ts.JsxAttributeValue | undefined, preferTrue = false): string {
  if (!node) return "";
  const out: string[] = [];
  const seen = new Set<ts.Node>();
  const walk = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    else if (ts.isTemplateExpression(n)) {
      out.push(n.head.text);
      for (const sp of n.templateSpans) {
        walk(sp.expression);
        out.push(sp.literal.text);
      }
    } else if (ts.isConditionalExpression(n)) {
      /**
       * ⛔ THE RESTING ARM, NOT BOTH — AND THIS IS A CORRECTION TO A DELIBERATE CHOICE.
       *
       * This took both, reasoning that a tab is `active ? 'border-blue-600' : 'border-transparent'`
       * and "taking one arm silently draws one state and calls it the screen". That is true, and
       * taking both was still worse, which only became visible once drawings included the app
       * shell: every item in the sidebar carried the selected background AND the unselected one, so
       * all of them looked selected at once. A nav where everything is the current page is not
       * "over-styled a little" — it is a screen that cannot exist.
       *
       * The false arm is what the element looks like before anything happens to it, which is the
       * same principle as reading `useState(false)` rather than guessing from a name: a drawing
       * shows the screen at rest, and every other appearance is offered as a state.
       *
       * ⛔ EXCEPT WHEN THIS PASS IS DRAWING THAT STATE, where the true arm IS the screen. `prefer`
       * is how the caller says which one it is asking for.
       */
      walk(preferTrue ? n.whenTrue : n.whenFalse);
    } else if (ts.isBinaryExpression(n)) {
      walk(n.left);
      walk(n.right);
    } else if (ts.isJsxExpression(n) && n.expression) walk(n.expression);
    else if (ts.isParenthesizedExpression(n)) walk(n.expression);
    /**
     * ⛔ A CLASSNAME IS USUALLY WRAPPED IN A CALL, AND THIS WALKED PAST EVERY ONE OF THEM.
     *
     * `className={`flex items-center …${className}`.trim()}` is a CallExpression, not a template —
     * so `TableToolbar`'s outer div came out with NO CLASS, its flex went with it, and the deals
     * list drew its search field, stage filter and Clear filters button stacked down the page. The
     * flex container was not overridden or beaten on specificity; it was never emitted.
     *
     * The same hole swallowed every `clsx(…)`, `cn(…)` and `[…].join(" ")` in the codebase, which
     * is how most real components write a class list. Walking into the callee and its arguments
     * picks the literals out of all of them.
     */
    else if (ts.isCallExpression(n)) {
      /**
       * ⛔ BUT A LOCAL HELPER'S ARGUMENT IS NOT A CLASS — IT IS WHAT THE HELPER IS ASKED ABOUT.
       *
       * Harvesting arguments is right for `clsx('flex','p-4')`, where they ARE the class list. It
       * is wrong for a helper the file defines itself: `className={inputClass('projectName')}`
       * emitted `class="projectName"` — a field name wearing a class attribute, which styles
       * nothing and is a worse answer than no class at all, because it looks like one.
       *
       * The cost was every input on the screen. `inputClass` returns
       * `w-full px-3 py-2 border rounded-md focus:ring-2 …`, so six fields that should carry full
       * width, padding, a border and a focus ring rendered as browser-default boxes — the single
       * biggest reason a drawing of this form did not look like the form. Peter: *"the 'creating a
       * deal' screenshots look nothing like our UX"*.
       *
       * So where the callee is declared in this same file, its BODY is walked instead of its
       * arguments. `seen` guards a helper that calls itself.
       */
      const local = ts.isIdentifier(n.expression) ? bodyOfLocal(n.expression) : undefined;
      if (local && !seen.has(local)) {
        seen.add(local);
        walk(local);
      } else {
        walk(n.expression);
        for (const a of n.arguments) walk(a);
      }
    } else if (ts.isPropertyAccessExpression(n)) walk(n.expression);
    else if (ts.isArrayLiteralExpression(n)) for (const el of n.elements) walk(el);
  };
  walk(node);
  return [...new Set(out.join(" ").split(/\s+/).filter(Boolean))].join(" ");
}

interface Ctx {
  /** Component name → its source file, for inlining one level at a time. */
  resolve: (name: string) => string | undefined;
  /**
   * Props the call site passed as false — a `useState(false)` identifier, or the literal.
   *
   * ⛔ SEPARATE FROM `props`, WHICH HOLDS RENDERED TEXT. "False" is not a string a component shows;
   * it is a fact about which branch the screen takes, and the two were never the same kind of
   * thing.
   */
  falsy: Set<string>;
  /** The element of a resolved list this pass is drawing, and the name the callback gave it. */
  item?: { name: string; fields: Map<string, string> };
  depth: number;
  from: Set<string>;
  unresolved: string[];
  /** Branches not drawn: the screen's other states, named so they are not lost silently. */
  states: string[];
  /** The raw conditions behind those states, so each one can be drawn on a second pass. */
  conditions: string[];
  /**
   * ⛔ WHERE THE ROUTE RENDERS A DIFFERENT PRODUCT DEPENDING ON SOMETHING THIS CANNOT READ.
   *
   * Peter: *"creating a CRE/multifamily deal does NOT go through a term sheet. it is a manual form
   * only"* — and the corpus said otherwise for months. The create route switches on project type
   * and returns one of five unrelated screens, then falls through to a default. This drew the
   * default: a five-step term-sheet wizard, in full, belonging to a different product.
   *
   * It is not a guess this can make correctly. Which of five products a screen IS, is a fact about
   * the product and lives in the truth, never in the code. What it must never do is pick one and
   * say nothing, because a confident drawing of the wrong screen is indistinguishable from a right
   * one — which is strictly worse than the thin drawing everything else in this file fights.
   */
  forks: Array<{ on: string; chose: string; others: string[]; where: string }>;
  /**
   * Inside a repeated row, where an unreadable value is the POINT rather than a defect — the shape
   * of the data is what a reader judges, and a hatch per cell would bury it.
   */
  inRow?: boolean;
  /** Which repeated row this is, so a list reads as several different things. */
  row?: number;
  /**
   * ⛔ DRAW A DIFFERENT STATE WITH THE SAME WALK. A screen is not one picture — it is loading, or
   * empty, or full, or broken — and reporting the branches it skipped told a reviewer they exist
   * without ever showing them. Naming a condition here makes the walk take the arm it normally
   * declines, so every state is drawn by the code that draws the screen.
   */
  prefer?: string;
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
  /**
   * ⛔ A RETURN BEHIND A GUARD IS A STATE, NOT THE SCREEN — and taking the biggest one regardless is
   * how the deal workspace came out reading "Back to CRE Deals / Deal not found".
   *
   * Real components are written as early returns:
   *
   *     if (isLoading)               return <Skeleton/>
   *     if (error || !state.project) return <NotFound/>
   *     return <the actual screen/>
   *
   * The screen's own return is frequently the SMALLEST of the three — it composes a few components
   * while the not-found block spells out its markup inline. Largest-by-span was a good heuristic
   * when the alternative was drawing a loading guard by accident; it is the wrong question once the
   * guards can be recognised. Peter: *"the top piece should generally just have happy path… I see
   * 'deal not found'"*.
   *
   * ⛔ AND THE GUARDS ARE KEPT, not discarded: they are the screen's states, and they are what the
   * tabs above it offer.
   */
  /**
   * ⛔ A SWITCH ARM IS A CONDITION TOO, AND TREATING IT AS UNGUARDED DREW A DIFFERENT PRODUCT.
   *
   * Peter, on the CRE create-a-deal screen: *"creating a CRE/multifamily deal does NOT go through
   * a term sheet. it is a manual form only, asking for property and borrower name."* He is right,
   * and the corpus said otherwise because of this function.
   *
   * The route switches on the project type and returns a different component per arm —
   * multifamily, rent analysis, offering memorandum, benchmark, processing — then falls through to
   * `return <ConsolidatedProjectWizard/>` as a default. Only `if` was recognised here, so all five
   * arms read as UNGUARDED and the pick became largest-by-span. It drew the processing wizard: a
   * five-step term-sheet flow belonging to a different product, rendered in full, legible, and
   * about something else entirely. The generator reported success.
   *
   * That is the worst failure this file has. A thin drawing looks thin; a confident drawing of the
   * wrong screen looks like the product, and a reviewer has no way to tell.
   *
   * ⛔ AND IT LOSES NOTHING, because a guard is not discarded — it becomes a drawn state. A route
   * that renders five products now offers five pictures with the product's own word on each tab,
   * instead of silently being one of them.
   */
  const guardedBy = (n: ts.Node): string | undefined => {
    let at: ts.Node | undefined = n.parent;
    while (at) {
      if (ts.isIfStatement(at) && at.thenStatement && at.thenStatement.pos <= n.pos && n.end <= at.thenStatement.end)
        return at.expression.getText().replace(/\s+/g, " ");
      /**
       * ⛔ NAMED WITH ITS SUBJECT, so the condition reads the way the same state would read as a
       * ternary and `prefer` can match it on a redraw without a second vocabulary. A bare
       * `case 'multifamily':` names a value with nothing to compare it against.
       */
      if (ts.isCaseClause(at)) {
        const sw = at.parent.parent;
        const subject = ts.isSwitchStatement(sw) ? sw.expression.getText() : "";
        return `${subject} === ${at.expression.getText()}`.replace(/\s+/g, " ").trim();
      }
      if (ts.isFunctionDeclaration(at) || ts.isArrowFunction(at) || ts.isFunctionExpression(at)) return undefined;
      at = at.parent;
    }
    return undefined;
  };

  const fromBody = (body: ts.Node): { main?: ts.Node; guards: Array<{ when: string; node: ts.Node }> } => {
    let best: ts.Node | undefined;
    let widest = 0;
    let fallback: ts.Node | undefined;
    let fallbackWidth = 0;
    const guards: Array<{ when: string; node: ts.Node }> = [];
    const seek = (n: ts.Node): void => {
      if (ts.isReturnStatement(n) && n.expression) {
        const e = ts.isParenthesizedExpression(n.expression) ? n.expression.expression : n.expression;
        if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) {
          const span = e.getEnd() - e.getStart();
          const guard = guardedBy(n);
          if (guard) {
            guards.push({ when: guard, node: e });
            if (span > fallbackWidth) { fallbackWidth = span; fallback = e; }
          } else if (span > widest) {
            widest = span;
            best = e;
          }
        }
      }
      ts.forEachChild(n, seek);
    };
    seek(body);
    /** Everything this component returns is behind a guard: draw the biggest, and say nothing false. */
    return { main: best ?? fallback, guards };
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
  /** ⛔ The guarded returns of whichever component is chosen — the screen's states, kept not dropped. */
  const guardsByName = new Map<string, Array<{ when: string; node: ts.Node }>>();
  let dflt: ts.Node | undefined;
  const exported = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isFunctionDeclaration(n) && n.body && n.name) {
      const mods = n.modifiers ?? [];
      const isExport = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const isDefault = mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
      const { main: jsx, guards } = fromBody(n.body);
      if (jsx) {
        byName.set(n.name.text, jsx);
        guardsByName.set(n.name.text, guards);
        if (isExport) exported.add(n.name.text);
        if (isDefault) { dflt = jsx; guardsByName.set("\u0000default", guards); }
      }
    }
    if (ts.isVariableStatement(n)) {
      const isExport = (n.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      for (const d of n.declarationList.declarations)
        if (ts.isIdentifier(d.name) && d.initializer) {
          const { main: jsx, guards } = fromBody(d.initializer);
          if (!jsx) continue;
          byName.set(d.name.text, jsx);
          guardsByName.set(d.name.text, guards);
          if (isExport) exported.add(d.name.text);
        }
    }
    ts.forEachChild(n, visit);
  };
  visit(src);

  const pickName = (): string | undefined => {
    if (name && byName.has(name)) return name;
    const base = path.basename(file).replace(/\.tsx?$/, "");
    if (byName.has(base) && (!name || name === base)) return base;
    if (!name && exported.size === 1) return [...exported][0];
    return undefined;
  };
  const chosen = pickName();
  if (chosen) {
    lastGuards = guardsByName.get(chosen) ?? [];
    return byName.get(chosen);
  }
  if (!name && dflt) {
    lastGuards = guardsByName.get("\u0000default") ?? [];
    return dflt;
  }
  lastGuards = [];
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
  /**
   * ⛔ AN EXPRESSION REACHED DIRECTLY IS STILL AN EXPRESSION.
   *
   * Everything below was gated on the node being a `JsxExpression` — the `{…}` wrapper. But once a
   * ternary picks a branch, that branch is handed back here as a BARE node, and a nested ternary
   * (`isPending ? … : total === 0 ? … : <table>`) is a conditional, not JSX. It fell through to the
   * bottom and returned "", so every deals list drew a header, a filter bar, and a hole where the
   * rows go. Peter: *"not a single deal added to the list"*.
   */
  const asExpression =
    ts.isJsxExpression(n) ||
    ts.isConditionalExpression(n) ||
    ts.isCallExpression(n) ||
    (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken);
  if (asExpression) {
    const wrapped = ts.isJsxExpression(n) ? n.expression : n;
    if (!wrapped) return "";
    /**
     * ⛔ PARENTHESES ARE NOT CONTENT, AND SIXTY-THREE CONTROLS WERE BLANK BECAUSE OF THEM.
     *
     * `{ok && (<ChevronRight/>)}` hands this a ParenthesizedExpression. Every JSX test below asks
     * `isJsxElement` and gets false, so it fell through to the unreadable-value path and drew an
     * empty span — inside a button, which then had nothing on it at all. Real JSX is written with
     * these parentheses far more often than without, and two handlers further down already unwrap
     * them locally; doing it once here is what stops the next branch forgetting.
     */
    const e = ts.isParenthesizedExpression(wrapped) ? wrapped.expression : wrapped;
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
    /** ⛔ An ERROR state is a state too — it drew as an empty pink bar across every screen that has
     *  one, which reads as a defect in the product rather than as a branch nobody is in. */
    /**
     * ⛔ "SOMETHING IS OPEN" IS A STATE TOO. A screen that composes a modal renders it behind a
     * visibility flag, and drawing it unconditionally put an open folder picker and its dimming
     * backdrop over the entire deal workspace — the happy path buried under a dialog nobody opened.
     * Peter: *"the top piece should generally just have happy path"*.
     */
    /**
     * ⛔ WHAT A CONDITION ASSERTS, NOT WHICH WORDS IT CONTAINS — and this file knew that in one
     * place and not the other, which cost a whole screen.
     *
     * Peter, on the folder step: *"it dead ends. no way to complete setup"*. The choices are
     * written `{!folderSetup.isMatching && !folderSetup.error && (<the choices/>)}` — a condition
     * that says explicitly this is NOT the loading state and NOT the error state, which is to say
     * it is the content. GUARD matched the word "error" inside it, so the body of the step was
     * treated as an error guard, skipped, and the drawing showed "Searching for matching
     * folders..." with nothing to press.
     *
     * `labelFor` has stripped negated terms since the day it was written, for exactly this reason
     * — `!isPending && !isError && total === 0` is the EMPTY state, not the loading one. The
     * picker never learned it. One helper now, used by both.
     */
    /**
     * ⛔ AND IT RETURNS NOTHING WHEN EVERY TERM IS NEGATED, WHICH IS THE WHOLE CASE.
     *
     * `!isMatching && !error` asserts nothing positive — it says only what this branch is NOT, and
     * a branch that is not the loading one and not the error one is the content. Falling back to
     * the raw condition here (which `labelFor` does, because a label needs SOMETHING to say) puts
     * the word "error" straight back in front of the test and changes nothing at all. The first
     * version of this fix did exactly that and the folder step stayed a dead end.
     */
    const asserted = (cond: string): string =>
      cond
        .split("&&")
        .map((t) => t.trim())
        .filter((t) => t && !t.startsWith("!"))
        .join(" && ");
    const OPEN = /\b(show[A-Z]\w*|is[A-Z]\w*Open|isOpen|\w*ModalOpen|\w*DialogOpen|picking|editing|confirming)\b/;
    /**
     * ⛔ BUSY IS A STATE, AND THE WORD FOR IT IS NOT ALWAYS "LOADING". This listed the words a
     * component uses while FETCHING and none of the words it uses while SUBMITTING — so
     * `isCreating ? 'Creating…' : 'Continue'` was picked by span, and the button on the happy path
     * read "Creating…", which is the screen mid-submit rather than the screen you meet.
     */
    /**
     * ⛔ AND A WORD BOUNDARY IS THE WRONG EDGE FOR A camelCase SUFFIX. `\berror\b` does not match
     * inside `creationError`, so `{state.creationError && <banner/>}` drew a pink failure banner on
     * the create-a-deal form at rest — with nothing failing, and its message an ellipsis. Same for
     * `uploadError`, `saveError` and every other `somethingError` a real component names. A flag
     * ending in Error is an error flag whatever it is prefixed with.
     */
    const GUARD =
      /\b(isLoading|loading|isPending|pending|isFetching|busy|skeleton|isError|error|isCreating|creating|isSaving|saving|isSubmitting|submitting|isUploading|uploading|isDeleting|deleting|isMutating)\b|\w+(Error|Errors|Failure|Failed)\b/i;
    /**
     * ⛔ `isSomethingIng` IS A BUSY FLAG, WHICHEVER VERB IT IS — and the list above can never be
     * finished by adding words to it. `folderSetup.isMatching` is not in it, so the folder step
     * drew "Searching for matching folders…" ON TOP OF the folder choices: both branches at once,
     * which is a picture of neither. Peter had already said this about the deals list — *"a
     * superposition of three states is not a picture of any of them"*.
     *
     * The naming convention is the rule. A flag called `isXxxing` is a thing in progress, and a
     * screen in progress is a state rather than the screen.
     */
    const DOING = /\bis[A-Z]\w*ing\b/;
    const EMPTY = /(===\s*0|!\s*\w+(?:\.\w+)*\.length\b|\blength\s*===\s*0\b|\bisEmpty\b|\bnoResults\b)/i;
    const pick = (cond: ts.Node, a: ts.Node, b: ts.Node): string => {
      const c = cond.getText();
      /** ⛔ Read what it asserts — see `asserted` above for the screen this cost. */
      const said = asserted(c);
      const span = (n: ts.Node): number => n.getEnd() - n.getStart();
      let chosen: ts.Node;
      let skipped: ts.Node;
      /**
       * ⛔ A PROP THE CALLER PASSED AS FALSE DECIDES THIS, AND IT IS NOT A GUESS.
       *
       * `AppProvider` is `{withAppLayout ? <AppLayout>{children}</AppLayout> : children}`, and the
       * `(standalone)` route group passes `withAppLayout={false}` — that is how an Excel add-in
       * pane says it has no sidebar. Without reading it, the longer branch won on span and the
       * add-in got wrapped in the whole web application's chrome: a task pane inside Excel, drawn
       * with a nav rail beside it. Its drawing went from 17 unresolved placeholders to 48, all of
       * them belonging to a shell it does not have.
       */
      const falseProp = ts.isIdentifier(cond) && ctx.falsy.has(cond.text);
      if (ctx.prefer && c.replace(/\s+/g, " ") === ctx.prefer) { chosen = a; skipped = b; }
      else if (falseProp) { chosen = b; skipped = a; }
      else if (GUARD.test(said) || DOING.test(said) || EMPTY.test(said) || OPEN.test(said)) { chosen = b; skipped = a; }
      else if (span(a) >= span(b)) { chosen = a; skipped = b; }
      else { chosen = b; skipped = a; }
      const other = skipped.getText().replace(/\s+/g, " ").slice(0, 60);
      if (other.trim()) {
        ctx.states.push(`when ${c.replace(/\s+/g, " ").slice(0, 50)}: ${other}`);
        /**
         * ⛔ ONLY THE ROUTE'S OWN BRANCHES ARE STATES OF THE SCREEN. A TextField's `hint && !error`
         * is a state of a text field, and offering it as a state of the deals list put a whole
         * second copy of the screen behind a button called "Error". Depth is the difference between
         * a branch the page takes and one some component takes inside it.
         */
        if (ctx.depth === 0) ctx.conditions.push(c.replace(/\s+/g, " "));
      }
      /**
       * ⛔ THE CHOSEN ARM IS OFTEN NOT JSX, AND EVERY ONE OF THOSE RENDERED AS NOTHING.
       *
       * Peter: *"i can't tell if clicking on next is actually navigating"* — because the button had
       * no words on it. `{state.isCreating ? 'Creating…' : 'Continue'}` is a ternary between two
       * string literals; `pick` chose one and handed the bare node to `emit`, which recognises JSX
       * and a `JsxExpression` wrapper and nothing else. It fell through to the final guard and
       * returned "".
       *
       * So every submit button in the product that swaps its label while busy — which is all of
       * them — drew as a blank coloured rectangle. The screen looked finished and the one control
       * a reviewer needs to identify was unlabelled.
       *
       * Wrapping restores the expression path, which already knows about string literals, samples,
       * props and locals. The `||` handling below has always done exactly this; the two branches
       * simply never agreed.
       */
      return emit(
        ts.isJsxElement(chosen) || ts.isJsxSelfClosingElement(chosen) || ts.isJsxFragment(chosen)
          ? chosen
          : ts.factory.createJsxExpression(undefined, chosen as ts.Expression),
        ctx
      );
    };
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      const c = e.left.getText();
      /**
       * ⛔ A GUARD ON A PROP THE CALLER DID NOT PASS IS FALSE, and we know exactly what was passed.
       *
       * Inside an inlined component, `{required && <span>*</span>}` was drawn unconditionally — so
       * the deals list wore two red required-markers floating above a search box and a stage filter
       * that are not required. This is not a guess about the product: the call site is right there,
       * and it did not pass `required`. Only applied while inlining, where that list is real.
       */
      if (ctx.depth > 0 && ts.isIdentifier(e.left) && ctx.props.size && !ctx.props.has(e.left.text)) return "";
      /**
       * `{!deals.length && <Empty/>}` — a state, not the screen. Recorded and not drawn.
       *
       * ⛔ BUT `{!isMatching && !error && <Content/>}` IS THE SCREEN, and reading the raw text
       * treated it as a guard because the word "error" appears in it. A negated term says what the
       * branch is NOT.
       *
       * ⛔ EMPTY still reads the RAW condition. `!deals.length` is an emptiness test written as a
       * negation — stripping it would make every empty state look like content, which is the
       * opposite mistake and the one this file fixed first.
       */
      /**
       * ⛔ A FACT ABOUT THE CODE BEATS A GUESS ABOUT THE NAME.
       *
       * Everything above this line decides whether `{x && …}` is a state by matching `x` against a
       * list of words — `isOpen`, `showFoo`, `editing`. The sidebar's account menu is `const [open,
       * setOpen] = useState(false)`, and a bare `open` is on none of those lists, so every drawing
       * that included the shell showed the account dropdown hanging open with ORGANIZATION and Sign
       * out in it. Peter: *"the 'creating a deal' screenshots look nothing like our UX"*. Same cause
       * as the three modal scrims stacked on one screen, each at 50% black, compounding to 87%.
       *
       * A declaration says what the screen looks like before anybody touches it, and it says so
       * exactly. Kept ALONGSIDE the word lists rather than replacing them, because those also catch
       * guards on props and on values this cannot see a declaration for.
       */
      const closedAtFirst = ts.isIdentifier(e.left) && falseAtFirst(e.left).has(e.left.text);
      if (closedAtFirst || GUARD.test(asserted(c)) || DOING.test(asserted(c)) || EMPTY.test(c) || OPEN.test(asserted(c))) {
        /** Preferred: this IS the state being drawn, so show what it shows. */
        if (ctx.prefer && c.replace(/\s+/g, " ") === ctx.prefer) return emit(e.right, ctx);
        ctx.states.push(`when ${c.replace(/\s+/g, " ").slice(0, 50)}: ${e.right.getText().replace(/\s+/g, " ").slice(0, 60)}`);
        if (ctx.depth === 0) ctx.conditions.push(c.replace(/\s+/g, " "));
        return "";
      }
      /** ⛔ Same as the ternary: `{ok && 'Saved'}` is a string, and a bare string reaches nothing. */
      return emit(
        ts.isJsxElement(e.right) || ts.isJsxSelfClosingElement(e.right) || ts.isJsxFragment(e.right)
          ? e.right
          : ts.factory.createJsxExpression(undefined, e.right),
        ctx
      );
    }
    if (ts.isConditionalExpression(e)) return pick(e.condition, e.whenTrue, e.whenFalse);
    /**
     * ⛔ `a || "—"` IS A VALUE WITH A FALLBACK, not a branch. Half the cells in a table are written
     * that way — `deal.sponsorName || "—"`, `deal.address || "—"` — and treating the whole thing as
     * one unreadable expression left those columns blank while the ones beside them read fine.
     * The left side is the field; the right is what shows when it is missing.
     */
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      const left = emit(ts.factory.createJsxExpression(undefined, e.left), ctx);
      return left || emit(ts.factory.createJsxExpression(undefined, e.right), ctx);
    }
    /**
     * ⛔ `??` IS THE SAME SHAPE AND WAS NOT HANDLED, which is most of the hatched ellipses on a page.
     *
     * `organization?.name ?? 'Personal account'` carries its own answer: the author wrote what the
     * screen says when the value is absent, and absent is exactly the state a drawing is in. It
     * rendered as `…` with the whole expression in a tooltip — 472 of those across thirteen
     * screens, each one crowding out text that is real.
     *
     * ⛔ READING, NOT GUESSING. The literal is in the source; nothing is invented by showing it.
     */
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      const left = emit(ts.factory.createJsxExpression(undefined, e.left), ctx);
      return left || emit(ts.factory.createJsxExpression(undefined, e.right), ctx);
    }
    /**
     * ⛔ A TEMPLATE LITERAL IS MOSTLY WORDS. `` `Selected Files (${files.length})` `` is three
     * characters of unknown and twelve of product copy, and the whole thing was being thrown away
     * for the three. The static halves are the author's words; each hole is resolved on its own, so
     * a count stays a marked sample and the sentence around it survives.
     */
    if (ts.isTemplateExpression(e)) {
      let out = text(e.head.text);
      for (const sp of e.templateSpans) {
        out += emit(ts.factory.createJsxExpression(undefined, sp.expression), ctx);
        out += text(sp.literal.text);
      }
      return out;
    }
    if (ts.isNoSubstitutionTemplateLiteral(e)) return text(e.text);
    /**
     * ⛔ A LIST DRAWS AS A LIST. Peter: *"nothing renders right for 'deal list'. all screenshots are
     * the same - not a single deal added to the list, just the empty list state..."*
     *
     * `{deals.map(deal => <tr>…</tr>)}` could not be evaluated, so the body of every table in the
     * product was empty — a header, a filter bar, and a hole where the content goes. That is the
     * one part of a deals list a reviewer is actually looking at.
     *
     * ⛔ AND IT INVENTS NOTHING. The ROW is in the source: its cells, their order, which columns are
     * conditional. Repeating that structure draws what the code says the list is made of; the
     * VALUES stay unknown and render as neutral bars, so nobody can mistake a drawn row for real
     * data. The rule this file has always held — never guess a figure — is about values, and it is
     * untouched.
     */
    if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === "map") {
      const cb = e.arguments[0];
      if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) {
        const body = ts.isBlock(cb.body) ? returnedFrom(cb.body) : cb.body;
        const inner = body && ts.isParenthesizedExpression(body) ? body.expression : body;
        if (inner && (ts.isJsxElement(inner) || ts.isJsxSelfClosingElement(inner) || ts.isJsxFragment(inner))) {
          /**
           * ⛔ WHERE THE LIST IS WRITTEN DOWN, DRAW THE LIST — NOT THREE OF ANYTHING.
           *
           * A navigation is `mainMenuItems.map(item => <a>{item.label}</a>)` over an array of
           * object literals in a config module: Dashboard, Monitor, Deals, CRE Deals, Borrowers.
           * Those are not unknown values, they are the product's own words, sitting in the
           * repository. Drawn as three blank rows, the sidebar on every screen was a column of
           * grey bars — Peter has already said what that is worth: *"ok, wtf, how are grey bars
           * useful?"*
           *
           * ⛔ STILL INVENTING NOTHING. This reads literals and stops: an array it cannot resolve
           * falls through to the three-row shape exactly as before, and a field whose value is an
           * expression stays a marked sample. The rule is unchanged — never guess a figure — and a
           * figure written in the source was never a guess.
           */
          const param = cb.parameters[0];
          const items = ts.isIdentifier(e.expression.expression)
            ? literalItems(e.expression.expression, ctx.sameFile)
            : undefined;
          if (items?.length && param && ts.isIdentifier(param.name)) {
            const name = param.name.text;
            return items
              .slice(0, 8)
              .map((fields) => emit(inner, { ...ctx, inRow: true, item: { name, fields } }))
              .join("");
          }
          /** Three: enough to read as a list, few enough that a tile is not all one screen. */
          return [0, 1, 2].map((i) => emit(inner, { ...ctx, inRow: true, row: i })).join("");
        }
      }
    }
    /**
     * ⛔ A CALL TO A LOCAL RENDER HELPER IS CONTENT. See `localRegion` for why this is the whole
     * screen and not a detail: `{renderStep()}` held the entire body of the create-a-deal wizard.
     */
    if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && ctx.sameFile) {
      const region = localRegion(ctx.sameFile, e.expression.text);
      if (region) {
        const wanted = ctx.prefer ? region.arms.find((a) => a.when === ctx.prefer) : undefined;
        const take = wanted ? wanted.node : region.main;
        for (const arm of region.arms) {
          if (arm.node === take || !arm.when) continue;
          ctx.states.push(`when ${arm.when.slice(0, 50)}: ${arm.node.getText().replace(/\s+/g, " ").slice(0, 60)}`);
          /**
           * ⛔ AT ANY DEPTH, UNLIKE AN INLINED COMPONENT'S OWN BRANCHES. The depth rule exists
           * because a TextField's `hint && !error` is a state of a text field, not of the page.
           * A render helper is the other thing entirely: it is the region the page swaps, and the
           * page's chrome is frequently one component down — the wizard's steps are states of the
           * screen even though the switch lives inside `ConsolidatedProjectWizard`.
           */
          ctx.conditions.push(arm.when);
        }
        return emit(take, ctx);
      }
    }
    if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) return emit(e, ctx);
    if (ts.isStringLiteral(e)) return text(e.text);
    /**
     * ⛔ A VALUE IT CANNOT READ BECOMES A MARKED PLACEHOLDER, NEVER A GUESS. A mock that invents a
     * figure teaches a reviewer something the product does not do, and they cannot tell which
     * numbers were real.
     */
    const hint = e.getText().replace(/\s+/g, " ").slice(0, 40);
    /**
     * ⛔ `{children}` IS THE SLOT, AND NOTHING EVER EMITTED THE MARKER FOR IT.
     *
     * The inlining code has always looked for `<!--children-->` to decide where a component's
     * children belong — and nothing produced it, so every `{children}` fell through to the
     * placeholder path instead. Harmless-looking, and it is why the deals list wrapped every cell's
     * text INSIDE a grey bar: `Td` renders `{children}`, that became a bar, and the real content was
     * then inserted into it. Three rows of correct, legible data, painted over.
     *
     * Emitting the marker also retires the guesswork about which element is the slot: a component
     * that says where its children go is believed.
     */
    if (ts.isIdentifier(e) && e.text === "children" && !ctx.props.has("children")) return "<!--children-->";
    // A prop bound at the call site: the value the application actually passes.
    if (ts.isIdentifier(e) && ctx.props.has(e.text)) return ctx.props.get(e.text)!;
    /**
     * ⛔ `{item.label}` WHERE THE LIST WAS RESOLVED — the product's own word, not a bar.
     *
     * Only when this pass is drawing a known element, and only for a field whose value is a literal
     * in the source. Anything else falls through to the sampling below and stays marked, so a
     * resolved list cannot quietly start inventing the fields it could not read.
     */
    if (ts.isPropertyAccessExpression(e) && ctx.item && ts.isIdentifier(e.expression) && e.expression.text === ctx.item.name) {
      const had = ctx.item.fields.get(e.name.text);
      if (had !== undefined) return text(had);
    }
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
    /**
     * ⛔ A LIST OF GREY BARS IS NOT A LIST. Peter: *"ok, wtf, how are grey bars useful?"* — and he is
     * right. A deals list whose every cell is a blank rectangle tells a reviewer nothing about
     * whether the columns are the right columns, whether a name fits, whether the stage reads as a
     * stage. The shape of a row is not the point; the row is.
     *
     * ⛔ AND IT IS MARKED, WHICH IS WHAT KEEPS THE OLD RULE INTACT. "Never guess a figure" exists so
     * nobody mistakes an invented number for something the product does. A sample that announces
     * itself cannot be mistaken — every one carries `productos-sample` and renders with a dotted
     * underline, so a reviewer can tell at a glance which words are the product's and which are
     * ours. What it must never do is quietly look real.
     */
    /**
     * ⛔ ONLY INSIDE A REPEATED ROW. Sampling everywhere put "Northgate Apartments" beside the Stage
     * filter and "Page of $12,400,000" in the pager — a screen that is legible and WRONG, which is
     * worse than one that is blank. A list's cells are what a reviewer judges; the chrome around it
     * holds counts and labels that nobody is reading for plausibility.
     */
    const made = ctx.inRow ? sampleValue(hint, ctx.row ?? 0) : undefined;
    if (made !== undefined) {
      ctx.unresolved.push(hint);
      return `<span class="productos-sample" title="${text(hint)} — sample">${text(made)}</span>`;
    }
    if (ctx.inRow) {
      /** Nothing plausible to put here: the shape is all that is left to show. */
      ctx.unresolved.push(hint);
      return `<span class="productos-value" title="${text(hint)}"></span>`;
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
      /**
       * ⛔ READ IMMEDIATELY. `guardsOfLastRead` is replaced by every later parse, and everything
       * below this line parses something.
       */
      const innerGuards = guardsOfLastRead();
      if (inner) {
        /**
         * ⛔ A FORK IS SIBLING ARMS RETURNING DIFFERENT COMPONENTS — not a loading guard.
         *
         * `if (isPending) return <Skeleton/>` is one screen in two states and is handled as a state
         * everywhere else in this file. What this looks for is the other thing: three or more arms
         * each returning a bare component of its own, which is a router choosing between unrelated
         * screens. Two is deliberately not enough — a screen and its empty state are often written
         * exactly that way.
         */
        const fork = forkOf(innerGuards, inner, path.basename(file));
        if (fork) ctx.forks.push(fork);
        /** Bind what the call site passes, so the primitive renders the application's own words. */
        const bound = new Map<string, string>();
        /** Props the call site passes as false at rest — see the modal case below. */
        const falsy = new Set<string>();
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
            /**
             * ⛔ A PROP THAT IS FALSE AT REST MAKES THE WHOLE COMPONENT NOTHING AT REST.
             *
             * `<ProjectSelectionModal isOpen={isProjectSelectionModalOpen} />` where that is
             * `useState(false)`, and the modal opens `if (!isOpen) return null`. Neither half is
             * visible on its own: the call site renders the element unconditionally, and the
             * component's guard is on a prop this had no value for. So the sidebar drew a modal
             * body — "Please select the deal for which you…" — into every screen that has a
             * sidebar, which is now every screen.
             */
            else if (ts.isIdentifier(v) && falseAtFirst(v).has(v.text)) falsy.add(name);
            else if (v.kind === ts.SyntaxKind.FalseKeyword) falsy.add(name);
            else if (ts.isIdentifier(v) && ctx.sameFile) {
              const local = localJsx(ctx.sameFile, v.text);
              if (local) bound.set(name, emit(local, { ...ctx, depth: ctx.depth + 1 }));
            }
          }
        }
        /**
         * ⛔ ASKED OF THE COMPONENT'S OWN SOURCE, not inferred from the prop's name. `isOpen`,
         * `open`, `visible` and `show` are all written, and a list of them would miss the next one;
         * a file that says `if (!x) return null` has said what it does when x is false.
         */
        if ([...falsy].some((p) => new RegExp(`if\\s*\\(\\s*!\\s*${p}\\s*\\)\\s*return\\s+null`).test(sourceOf(file))))
          return "";
        const sub: Ctx = { ...ctx, depth: ctx.depth + 1, props: bound, falsy, sameFile: file };
        const body = emit(inner, sub);
        // `{children}` inside the primitive is where this element's own children belong.
        if (body.includes("<!--children-->")) return body.replace("<!--children-->", children);
        if (!children) return body;
        /**
         * ⛔ CHILDREN GO INSIDE THE COMPONENT, NOT AFTER IT.
         *
         * `body + children` makes them SIBLINGS of the component's own root — so everything the
         * component was going to lay out escapes its layout. The deals list toolbar is
         * `<div className="flex flex-wrap items-center gap-2">` and its search field, stage filter
         * and Clear filters button all landed outside it, stacked down the page, each on its own
         * line. Peter: *"does this look right?"*
         *
         * It happens whenever a component does not write a literal `{children}` — this one splits
         * them with `React.Children.toArray`, which is ordinary React and unreadable from here.
         * Placing them before the root's closing tag keeps them in the box that was built for them.
         */
        /**
         * ⛔ THE SLOT IS THE EMPTY ELEMENT, NOT THE OUTERMOST ONE.
         *
         * Inserting before the LAST closing tag puts children inside the component's root — which
         * is right for a single box and wrong for every wrapper. `<div class="overflow"><table/></div>`
         * took the deals table's rows AFTER `</table>`, so the markup read
         * `<table></table></div><thead><tr></tr><th>…` — and an HTML parser discards a `<thead>`
         * and a `<tr>` that are not inside a table. Three rows and twenty-four cells, gone at parse
         * time, in a drawing that looked correct as text.
         *
         * A component that renders a container and no content has exactly one empty element, and
         * that is where its children go. `TableToolbar` proves the same rule from the other side:
         * its empty inner `<div class="flex …">` is precisely where `{left}` belongs.
         */
        const empty = [...body.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*>\s*<\/\1>/g)];
        const slot = empty.length ? empty[empty.length - 1]! : undefined;
        if (slot) {
          const at = slot.index! + slot[0].lastIndexOf("</");
          return body.slice(0, at) + children + body.slice(at);
        }
        const close = body.lastIndexOf("</");
        if (close > 0 && /^<\w/.test(body.trim())) return body.slice(0, close) + children + body.slice(close);
        return body + children;
      }
    }
    /**
     * ⛔ A DIALOG IS CLOSED UNLESS SOMETHING SAYS IT IS OPEN.
     *
     * A modal is written as `<Modal open={somethingIsOpen}>` — always present in the tree, with its
     * visibility as a PROP rather than a branch. Inlined unconditionally it renders its overlay and
     * its dimming backdrop, so the deal workspace drew a folder picker over the whole screen with
     * everything behind it greyed out. Peter: *"the top piece should generally just have happy
     * path"*. A screen's happy path does not have a dialog open on it.
     *
     * Only when the flag is an expression we cannot read. `open` hard-coded true is somebody saying
     * it really is always open, and that is drawn.
     */
    const DIALOG = /(modal|dialog|drawer|sheet|popover|overlay|lightbox)$/i;
    if (DIALOG.test(tag)) {
      const openAttr = open.attributes.properties.find(
        (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && /^(open|isOpen|visible|shown)$/.test(a.name.getText())
      );
      const literallyOpen =
        openAttr?.initializer &&
        ts.isJsxExpression(openAttr.initializer) &&
        openAttr.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword;
      if (openAttr && !literallyOpen) {
        ctx.states.push(`when ${openAttr.initializer ? openAttr.initializer.getText().replace(/[{}]/g, "").slice(0, 40) : tag}: <${tag}> is open`);
        return "";
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
    /**
     * ⛔ A TABLE PRIMITIVE DRAWS AS THE ELEMENT IT IS, OR THE ROWS ARE NOT IN THE DOCUMENT AT ALL.
     *
     * `TableShell`, `THead`, `TBody`, `Td`, `Th` are this application's table components, and drawn
     * as generic <div>s they leave every <tr> outside a <table> — which an HTML parser silently
     * DISCARDS. So the deals list held three rows and twenty-four cells in its markup and rendered
     * none of them: twenty-four bars in the source, zero rows in the DOM. Peter had looked at three
     * successive screenshots of the same empty list.
     *
     * This is a structural guess and a narrow one: a component whose name IS a table part almost
     * certainly renders that part, and the alternative is a table that cannot exist.
     */
    const TABLE_PART: Record<string, string> = {
      table: "table", tableshell: "table", thead: "thead", tbody: "tbody",
      tfoot: "tfoot", tr: "tr", td: "td", th: "th", row: "tr",
    };
    const asTable = TABLE_PART[tag.toLowerCase()];
    if (asTable) {
      ctx.unresolved.push(`<${tag}> (drawn as <${asTable}>)`);
      return `<${asTable}>${children}</${asTable}>`;
    }
    /**
     * ⛔ AN ICON IN THE FILE THAT IMPORTED IT, NOT EVERYWHERE ON THE SCREEN.
     *
     * Icon names were collected from the route and every indexed file into one set, so a name any
     * file imported from lucide became an icon in all of them. lucide exports `Link`; so does
     * `next/link`, and every `<Link>` in the application — the element wrapping each nav label —
     * was drawn as an icon glyph, swallowing its children. That is why the sidebar had the right
     * number of rows and no words in them.
     *
     * The import is in the file. Ask the file.
     */
    if (iconHere(ctx.sameFile, tag) || (!ctx.sameFile && ctx.icons.has(tag))) {
      ctx.unresolved.push(`<${tag}> (icon)`);
      return `<span class="productos-icon" role="img" aria-label="${text(tag)}"></span>`;
    }
    /**
     * ⛔ KEEP THE APPLICATION'S OWN CLASSES ON IT, OR THE LAYOUT GOES WITH THE COMPONENT.
     *
     * An unresolved component became a bare `<div class="productos-unknown">`, which throws away the
     * `className` the call site wrote. `<TableToolbar className="flex items-center gap-2">` lost its
     * flex, so the deals list drew its New Deal button, its search field, its stage filter and Clear
     * filters stacked down the page, each on its own line — a toolbar rendered as a column. Peter,
     * looking at it: *"does this look right?"*. It did not.
     *
     * The marker class rides ALONGSIDE the application's classes rather than replacing them, so the
     * drawing keeps the layout it was given and still says it could not read the component.
     */
    ctx.unresolved.push(`<${tag}>`);
    const own = classOf(
      open.attributes.properties.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === "className")
        ?.initializer
    );
    const cls = own ? `${text(own)} productos-unknown` : "productos-unknown";
    return `<div class="${cls}" data-component="${text(tag)}">${children || ""}</div>`;
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
  /**
   * ⛔ A CONTROL WITH NO WORDS ON IT IS UNREVIEWABLE, WHATEVER MADE IT EMPTY.
   *
   * Peter: *"i can't tell if clicking on next is actually navigating"*. The immediate cause there
   * was a ternary between two string literals, fixed above — but that fix left 118 of 555 controls
   * on this corpus still blank, from three unrelated causes: an icon with no text beside it, a
   * label the walk could not read, and a button whose children resolved to nothing at all.
   *
   * They are different bugs and they are the same defect. A reviewer looking at a blank coloured
   * rectangle cannot say whether the product is right, and cannot say what they would be pressing.
   *
   * ⛔ SO THE NAME COMES FROM WHAT IS ALREADY KNOWN, AND IS NEVER INVENTED. An application labels
   * its icon-only buttons for screen readers, which is the same problem solved by the same
   * information: `aria-label`, then `title`, then the icon's own name — each of them something the
   * source says. Marked as ours, so nobody reads it as the product's own word.
   */
  if (/^(button|a)$/.test(tag) && !/>[^<]*[A-Za-z0-9][^<]*</.test(`>${children}<`)) {
    const said = /aria-label="([^"]+)"/.exec(attr)?.[1] ?? /title="([^"]+)"/.exec(attr)?.[1];
    const icon = /class="productos-icon"[^>]*aria-label="([^"]+)"/.exec(children)?.[1];
    const named = said ?? icon;
    if (named)
      return `<${tag}${attr}>${children}<span class="productos-sample" title="${
        said ? "labelled for a screen reader" : "named after its icon"
      }">${named}</span></${tag}>`;
  }
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
  /**
   * ⛔ SET WHILE DRAWING A LAYOUT, SO THE COMPOSITION DOES NOT RECURSE. A layout is drawn by the
   * same walk as a page; without this it would look for its own layouts and find itself.
   */
  inLayout?: boolean;
}

/**
 * ⛔ A SCREEN IS A ROUTE, AND A ROUTE IS ITS LAYOUTS PLUS ITS PAGE.
 *
 * Peter, looking at a drawing: *"the 'creating a deal' screenshots look nothing like our UX"*. The
 * content was faithful; what was missing was everything around it. Every page in the application
 * this was built against sits inside `AppLayout` — *"the app shell (sidebar + padded main column)"*
 * — and not one drawing in the corpus had a sidebar, because this walked a page component and had
 * no concept of a layout at all.
 *
 * That is not a small omission on one screen. It is every screen, missing the one piece of chrome
 * a person sees on all of them, so a reviewer comparing a drawing against the product they use is
 * comparing against something nobody has ever seen.
 *
 * ⛔ THE SLOT ALREADY EXISTED AND NOTHING FILLED IT. `emit` has emitted `<!--children-->` for
 * `{children}` since the inlining code needed it for primitives like `Td`. A layout is a component
 * whose children are the page, so composing them is the same substitution one level up.
 *
 * ⛔ THE ROOT `app/layout.tsx` IS SKIPPED, DELIBERATELY. It renders `<html>` and `<body>`, which
 * cannot nest inside the element a mock lives in, and what it carries that matters — next/font's
 * family variables — is hoisted to the document by `liftFaces` instead.
 *
 * Returns nearest-first. Empty for a product that is not laid out this way, so nothing changes for
 * one that is not.
 */
/**
 * Identifiers a file declares as `useState(false)` — what the screen shows before anybody touches it.
 *
 * ⛔ CACHED PER FILE, because `emit` re-reads a file once per component it inlines and this would
 * otherwise re-scan the same source thirty-eight times on one screen.
 */
/** A file's text, read once. ⛔ `emit` revisits the same component many times on one screen. */
const SOURCE = new Map<string, string>();
function sourceOf(file: string): string {
  let have = SOURCE.get(file);
  if (have === undefined) {
    try {
      have = fs.readFileSync(file, "utf-8");
    } catch {
      have = "";
    }
    SOURCE.set(file, have);
  }
  return have;
}


/**
 * The object literals of an array a name refers to, following locals and one import.
 *
 * ⛔ IT FOLLOWS DERIVATIONS, because a nav is never used raw. `filteredMenuItems` is
 * `menuItemsWithIcons.filter(...)`, which is `mainMenuItems.map(...)`, which is the import. Stopping
 * at the first name would resolve nothing in a real component; each `.map`/`.filter`/`.slice` step
 * narrows or decorates the same list, and the labels survive all of them.
 *
 * ⛔ ONE IMPORT DEEP AND LITERALS ONLY. This is a reader, not an evaluator: a value that is not a
 * string or number in the source is left out, and the caller falls back to drawing the shape.
 */
function literalItems(name: ts.Identifier, fromFile?: string, depth = 0): Array<Map<string, string>> | undefined {
  if (depth > 4) return undefined;
  const sf = name.getSourceFile();
  let decl: ts.Expression | undefined;
  const visit = (n: ts.Node): void => {
    if (decl) return;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name.text && n.initializer)
      decl = n.initializer;
    else ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);

  /** `X.filter(...)` / `X.map(...)` / `X.slice(...)` — the same list, one step on. */
  if (
    decl &&
    ts.isCallExpression(decl) &&
    ts.isPropertyAccessExpression(decl.expression) &&
    /^(filter|map|slice|concat|sort|reverse)$/.test(decl.expression.name.text) &&
    ts.isIdentifier(decl.expression.expression)
  )
    return literalItems(decl.expression.expression, fromFile, depth + 1);

  /**
   * ⛔ AND A PLAIN CALL OVER THE LIST, which is how a real filter is written. The nav is
   * `filterByPermissions(menuItemsWithIcons)` — not a method chain, so following only `.filter`
   * resolved nothing and the sidebar stayed a column of grey bars. A function handed one array and
   * returning a list gives back some of that array; which ones depends on who is looking, and the
   * drawing shows the list the product has rather than one person's view of it.
   */
  if (decl && ts.isCallExpression(decl) && decl.arguments.length === 1 && ts.isIdentifier(decl.arguments[0]!))
    return literalItems(decl.arguments[0] as ts.Identifier, fromFile, depth + 1);

  if (!decl) {
    /** Not declared here: follow the import that brought the name in. */
    const spec = importSpecifierFor(sf, name.text);
    if (!spec || !fromFile) return undefined;
    const target = resolveModule(spec, fromFile);
    if (!target) return undefined;
    const src = ts.createSourceFile(target, sourceOf(target), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let found: Array<Map<string, string>> | undefined;
    const look = (n: ts.Node): void => {
      if (found) return;
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name.text && n.initializer)
        found = itemsOf(n.initializer);
      else ts.forEachChild(n, look);
    };
    ts.forEachChild(src, look);
    return found;
  }
  return itemsOf(decl);
}

/** An array literal's object literals, as plain string fields. */
function itemsOf(e: ts.Expression): Array<Map<string, string>> | undefined {
  if (!ts.isArrayLiteralExpression(e)) return undefined;
  const out: Array<Map<string, string>> = [];
  for (const el of e.elements) {
    if (!ts.isObjectLiteralExpression(el)) continue;
    const fields = new Map<string, string>();
    for (const pr of el.properties) {
      if (!ts.isPropertyAssignment(pr) || !pr.name) continue;
      const key = ts.isIdentifier(pr.name) || ts.isStringLiteral(pr.name) ? pr.name.text : undefined;
      if (!key) continue;
      const v = pr.initializer;
      if (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) fields.set(key, v.text);
      else if (ts.isNumericLiteral(v)) fields.set(key, v.text);
    }
    if (fields.size) out.push(fields);
  }
  return out.length ? out : undefined;
}

/** The module specifier a name was imported from, if it was. */
function importSpecifierFor(sf: ts.SourceFile, name: string): string | undefined {
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const named = st.importClause?.namedBindings;
    if (named && ts.isNamedImports(named) && named.elements.some((el) => el.name.text === name))
      return st.moduleSpecifier.text;
    if (st.importClause?.name?.text === name) return st.moduleSpecifier.text;
  }
  return undefined;
}

/**
 * A module specifier as a file on disk.
 *
 * ⛔ `@/` IS THE CONVENTION AND IT IS NOT GUESSWORK TO FOLLOW IT — but the root it points at is,
 * so it is found by walking up from the importing file to the directory the alias names rather
 * than by assuming a layout.
 */
function resolveModule(spec: string, fromFile: string): string | undefined {
  const tryFile = (base: string): string | undefined => {
    for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
      const full = base.endsWith(ext) ? base : base + ext;
      if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
    }
    return undefined;
  };
  if (spec.startsWith(".")) return tryFile(path.resolve(path.dirname(fromFile), spec));
  const m = /^@\/(.+)$/.exec(spec);
  if (!m) return undefined;
  let dir = path.dirname(path.resolve(fromFile));
  for (let up = 0; up < 10; up++) {
    const hit = tryFile(path.join(dir, m[1]!));
    if (hit) return hit;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}


/**
 * Whether this file imports `name` from an icon package.
 *
 * ⛔ A NAME CAN BE BOTH, and which one it is depends on who imported it. Cached per file because
 * `emit` re-enters the same component many times on one screen.
 */
const ICONS_BY_FILE = new Map<string, Set<string>>();
function iconHere(file: string | undefined, name: string): boolean {
  if (!file) return false;
  let have = ICONS_BY_FILE.get(file);
  if (!have) {
    have = new Set<string>();
    for (const m of sourceOf(file).matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
      if (!/lucide|heroicons|react-icons|@tabler\/icons|phosphor|@radix-ui\/react-icons/i.test(m[2] ?? "")) continue;
      for (const raw of (m[1] ?? "").split(",")) {
        const n = raw.split(" as ").pop()!.trim();
        if (n) have.add(n);
      }
    }
    ICONS_BY_FILE.set(file, have);
  }
  return have.has(name);
}

const CLOSED_AT_FIRST = new Map<string, Set<string>>();
function falseAtFirst(node: ts.Node): Set<string> {
  const sf = node.getSourceFile();
  let have = CLOSED_AT_FIRST.get(sf.fileName);
  if (!have) {
    have = new Set<string>();
    for (const m of sf
      .getFullText()
      .matchAll(/const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*set[A-Za-z_$][\w$]*\s*\]\s*=\s*useState\s*(?:<[^>]*>)?\s*\(\s*false\s*\)/g))
      have.add(m[1]!);
    CLOSED_AT_FIRST.set(sf.fileName, have);
  }
  return have;
}

export function layoutsAround(routeFile: string): string[] {
  const out: string[] = [];
  let dir = path.dirname(path.resolve(routeFile));
  for (let up = 0; up < 12; up++) {
    const atAppRoot = path.basename(dir) === "app";
    const layout = path.join(dir, "layout.tsx");
    if (!atAppRoot && fs.existsSync(layout) && path.resolve(layout) !== path.resolve(routeFile)) out.push(layout);
    if (atAppRoot) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return out;
}

/**
 * `const <name> = (<jsx/>)` in a file, if it is there.
 *
 * Cached per file: `emit` asks for several names per render and re-parsing a 1,200-line route for
 * each one is the difference between a drawing and a pause.
 */
/** The JSX a block-bodied callback returns, if it returns any. */
function returnedFrom(block: ts.Block): ts.Node | undefined {
  let found: ts.Node | undefined;
  const walk = (n: ts.Node): void => {
    if (found) return;
    if (ts.isReturnStatement(n) && n.expression) {
      const e = ts.isParenthesizedExpression(n.expression) ? n.expression.expression : n.expression;
      if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) found = e;
    }
    ts.forEachChild(n, walk);
  };
  walk(block);
  return found;
}

/**
 * A believable stand-in for a value the drawing cannot read, chosen from what the expression is
 * CALLED — `deal.name`, `formatLocation(deal)`, `row.loanAmount`.
 *
 * ⛔ Chosen by name, never invented from nothing, and always rendered marked. The aim is a screen a
 * person can read and judge — whether the columns are right, whether a long sponsor name breaks the
 * layout — not a screen that lies convincingly.
 */
const SAMPLES: Array<[RegExp, string[]]> = [
  [/(sponsor|borrower|owner|company|firm|lender|organi[sz]ation)/i, ["Cedar Ridge Capital", "Northgate Holdings", "Harbor Point Partners"]],
  [/(address|street|line1)/i, ["1420 Northgate Blvd", "88 Harbor Point Rd", "7 Cedar Ridge Way"]],
  [/(city|location|market|region|place)/i, ["Sacramento, CA", "Tacoma, WA", "Mesa, AZ"]],
  [/\bstate\b/i, ["CA", "WA", "AZ"]],
  /** ⛔ `total` is a COUNT far more often than a sum — it put money in a pager. Money says money. */
  [/(loanamount|amount|balance|price|proceeds|\bsum\b|\bcost\b)/i, ["$12,400,000", "$8,150,000", "$21,900,000"]],
  [/(rate|yield|ltv|dscr|percent|spread|coupon)/i, ["6.25%", "5.80%", "6.05%"]],
  [/(units|count|rooms|beds|quantity|docs|documents|total|pages?)/i, ["184", "76", "312"]],
  [/(date|created|updated|modified|\bat\b|when|asof)/i, ["4 Mar 2026", "18 Feb 2026", "27 Jan 2026"]],
  [/(stage|status|state|phase|step)/i, ["Underwriting", "Screening", "Term sheet"]],
  [/(email|mail)/i, ["a.nguyen@example.com", "j.ruiz@example.com", "m.patel@example.com"]],
  [/(user|author|by|analyst|officer|person|member)/i, ["A. Nguyen", "J. Ruiz", "M. Patel"]],
  [/(title|name|label|deal|project|property|asset)/i, ["Northgate Apartments", "Cedar Ridge", "Harbor Point"]],
];

export function sampleValue(hint: string, row: number): string | undefined {
  /** Only a value-shaped expression. A call with arguments or a ternary is structure, not a field. */
  if (!/^[A-Za-z_$][\w$.?\[\]'"()]*$/.test(hint.trim())) {
    /** …unless it is a formatter around one field, which is how most cells are written. */
    const m = /^[A-Za-z_$][\w$]*\(\s*([A-Za-z_$][\w$.]*)\s*\)$/.exec(hint.trim());
    if (!m) return undefined;
    hint = m[1]!;
  }
  /**
   * ⛔ WHAT A FIELD HOLDS IS NAMED BY ITS LAST SEGMENT; THE PREFIX NAMES WHAT IT BELONGS TO.
   *
   * `step.number` matched the stage rule on the word "step" and drew "Underwriting" inside an
   * eight-pixel circle — a wizard whose three progress dots read "erwr", "reen" and "ern hee".
   * Reading the prefix is how a counter came to hold a stage name, and it is wrong for every
   * `x.count`, `x.index`, `x.position` in the product, not just this one.
   */
  const tail = hint.split(/[.?[\]'"()]+/).filter(Boolean).pop() ?? hint;
  if (/^(number|num|index|idx|order|position|pos|rank|seq|sequence)$/i.test(tail)) return String((row % 3) + 1);
  for (const [re, values] of SAMPLES) if (re.test(hint)) return values[row % values.length];
  return undefined;
}

export interface DrawnState {
  /** The condition in the code that produces it, kept verbatim so it can be checked. */
  when: string;
  /** What a reader calls it. */
  label: string;
  html: string;
}

/**
 * What to call a state, from the condition that produces it.
 *
 * ⛔ Named from the code, never invented. Where the condition does not say plainly what it is, the
 * condition itself is the label — an honest "when total === 0" beats a confident wrong word.
 */
function labelFor(cond: string): string {
  /**
   * ⛔ WHAT THE CONDITION ASSERTS, NOT WHICH WORDS IT CONTAINS.
   *
   * `!isPending && !isError && total === 0` is the EMPTY state — it says explicitly that it is not
   * loading — and matching on any occurrence of "isPending" labelled it "Loading". Negated terms
   * are what the state is NOT, so they are dropped before anything is read.
   */
  const asserted = cond
    .split("&&")
    .map((t) => t.trim())
    .filter((t) => !t.startsWith("!"))
    .join(" && ");
  const read = asserted || cond;
  if (/(===\s*0|\blength\s*===\s*0\b|\bisEmpty\b|\bnoResults\b)/i.test(read)) return "Empty";
  /** ⛔ A missing THING reads differently from a failure: "Deal not found" is not "Error". */
  if (/!\s*\w+(\.\w+)*\b|\bnotfound\b|===\s*null|==\s*null/i.test(cond) && !/\blength\b/i.test(cond)) return "Not found";
  if (/\b(isError|error)\b/i.test(read)) return "Error";
  if (/\b(isLoading|loading|isPending|pending|isFetching|skeleton)\b/i.test(read)) return "Loading";
  /**
   * ⛔ BUSY IS NOT LOADING, AND IT IS NOT THE CODE EITHER. A tab reading "when state.isCreating"
   * shows a reviewer the expression they are not reading instead of the moment they are being
   * asked to look at. The verb in the flag is the product's own word for what is happening.
   */
  const doing = /\b(?:is)?(creating|saving|submitting|uploading|deleting|mutating)\b/i.exec(read);
  if (doing) return doing[1]!.charAt(0).toUpperCase() + doing[1]!.slice(1).toLowerCase();
  if (/\b(show[A-Z]\w*|is[A-Z]\w*Open|isOpen|\w*ModalOpen|picking|editing|confirming)\b/.test(cond)) {
    /** Named after what opens, so three dialogs on one screen do not all read "Open". */
    const m = /\b(?:show|is)([A-Z]\w*?)(?:Open|Modal|Dialog)?\b/.exec(cond);
    return m ? `${m[1].replace(/([a-z])([A-Z])/g, "$1 $2")} open` : "Open";
  }
  if (/\b(hasActiveFilters|filtered|search)\b/i.test(read)) return "Filtered";
  /**
   * ⛔ A STEP NAMES ITSELF. `state.currentStep === 'borrower_documents'` labelled a tab "when
   * state.currentStep === 'bor" — the reviewer is shown the code they are not reading instead of
   * the step they are being asked to walk. The literal being compared against IS the name; it is
   * the product's own word for that state, not one invented here.
   */
  const named = /===\s*['"`]([a-z0-9_-]{2,40})['"`]\s*$/i.exec(read.trim());
  if (named) {
    const w = named[1].replace(/[_-]+/g, " ").trim();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  /**
   * ⛔ A BARE FLAG NAMES ITSELF. `folderFailure` is one word the product already uses, and
   * "when folderFailure" is that word with an apology in front of it.
   */
  const bare = /^!?\s*([A-Za-z_$][\w$]*)\s*$/.exec(read.trim());
  if (bare) {
    const w = bare[1]!.replace(/^(is|has|should)(?=[A-Z])/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }
  return `when ${read.slice(0, 32)}`;
}

/**
 * The guarded returns of the component `returnedJsx` last chose.
 *
 * ⛔ A side channel rather than a changed signature, because `returnedJsx` is called from several
 * places that want only the screen — and every one of them would otherwise have to learn about
 * states to keep compiling. Read immediately after the call that produced it.
 */
let lastGuards: Array<{ when: string; node: ts.Node }> = [];
export function guardsOfLastRead(): Array<{ when: string; node: ts.Node }> {
  return lastGuards;
}

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

/**
 * A local render helper, read as a REGION OF THE SCREEN.
 *
 * ⛔ `{renderStep()}` IS THE BODY OF THE SCREEN, NOT AN UNKNOWN — and drawing it as one is why the
 * create-a-deal screen came out as a title, three progress dots and six hundred pixels of nothing.
 * Peter: *"boo, there's literally NOTHING on it"*.
 *
 * A wizard, a tabbed panel and a stepped form are all written the same way: the chrome is inline
 * and the part that changes is a local function switching on the current step. That function is
 * where the screen actually is. Refusing to follow it draws the frame and discards the picture —
 * a drawing that looks generated but shows nothing a reviewer can judge.
 *
 * ⛔ AND EACH ARM IS A STATE, which is what the tabs above the drawing are for. A five-step wizard
 * has five screens in it; one of them is the happy path and the other four are exactly what a
 * reviewer needs to walk. `localJsx` already does this for a bare `{someJsxConst}`; a call is the
 * same thing with parentheses, and it is the far more common shape.
 */
interface Region {
  /** The arm drawn by default: the screen as somebody first meets it. */
  main: ts.Node;
  /** Every arm, in source order, with the condition that reaches it. */
  arms: Array<{ when: string; node: ts.Node }>;
}

const regionCache = new Map<string, Map<string, Region | null>>();

function localRegion(file: string, name: string): Region | undefined {
  let byName = regionCache.get(file);
  if (!byName) {
    byName = new Map<string, Region | null>();
    regionCache.set(file, byName);
  }
  if (byName.has(name)) return byName.get(name) ?? undefined;
  byName.set(name, null);

  let src: ts.SourceFile;
  try {
    src = ts.createSourceFile(file, fs.readFileSync(file, "utf-8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  } catch {
    return undefined;
  }

  let fn: ts.Node | undefined;
  const find = (n: ts.Node): void => {
    if (fn) return;
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === name &&
      n.initializer &&
      (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
    )
      fn = n.initializer;
    else if (ts.isFunctionDeclaration(n) && n.name?.text === name && n.body) fn = n;
    else ts.forEachChild(n, find);
  };
  find(src);
  if (!fn) return undefined;

  const body = (fn as ts.ArrowFunction | ts.FunctionDeclaration).body;
  if (!body) return undefined;
  const isJsx = (e: ts.Node): boolean => ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e);

  /** A concise arrow — `const Row = () => <tr>…</tr>` — has no branches and no returns to find. */
  if (!ts.isBlock(body)) {
    const e = ts.isParenthesizedExpression(body) ? body.expression : body;
    if (!isJsx(e)) return undefined;
    const only: Region = { main: e, arms: [{ when: "", node: e }] };
    byName.set(name, only);
    return only;
  }

  /**
   * ⛔ WHAT REACHES THIS ARM, READ FROM THE SWITCH ITSELF. A `case 'project_details':` is only
   * half a condition — on its own it names a value with nothing to compare it to, and two helpers
   * switching on different things would produce arms that look identical. The subject comes from
   * the `switch`, so the condition reads the way the same state would read as a ternary, and the
   * redraw pass can match it against `prefer` without a second vocabulary.
   */
  const reaching = (n: ts.Node): string | undefined => {
    let at: ts.Node | undefined = n.parent;
    while (at && at !== body) {
      if (ts.isCaseClause(at)) {
        const sw = at.parent.parent;
        const subject = ts.isSwitchStatement(sw) ? sw.expression.getText() : "";
        return `${subject} === ${at.expression.getText()}`.replace(/\s+/g, " ").trim();
      }
      if (ts.isIfStatement(at) && at.thenStatement.pos <= n.pos && n.end <= at.thenStatement.end)
        return at.expression.getText().replace(/\s+/g, " ");
      at = at.parent;
    }
    return undefined;
  };

  const arms: Array<{ when: string; node: ts.Node }> = [];
  let open: ts.Node | undefined;
  const seek = (n: ts.Node): void => {
    /** A callback inside this helper returns for ITSELF, not for the screen. */
    if (n !== body && (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n))) return;
    if (ts.isReturnStatement(n) && n.expression) {
      const e = ts.isParenthesizedExpression(n.expression) ? n.expression.expression : n.expression;
      if (isJsx(e)) {
        const when = reaching(n);
        if (when) arms.push({ when, node: e });
        else if (!open || e.getEnd() - e.getStart() > open.getEnd() - open.getStart()) open = e;
      }
    }
    ts.forEachChild(n, seek);
  };
  seek(body);

  /**
   * ⛔ THE FIRST ARM IS THE HAPPY PATH, and taking the biggest would open the screen on whichever
   * step happens to have the most markup. A `switch` is written in the order a person moves through
   * it: the first case of a wizard's step switch is step one. That is a stronger signal than span,
   * and it is the opposite of the rule for early-return guards, where source order means nothing.
   */
  const main = open ?? arms[0]?.node;
  if (!main) return undefined;
  const found: Region = { main, arms };
  byName.set(name, found);
  return found;
}


/**
 * ⛔ A FORK: SIBLING ARMS EACH RETURNING A DIFFERENT SCREEN.
 *
 * Not a loading guard — `if (isPending) return <Skeleton/>` is one screen in two states, handled
 * as a state everywhere else here. This is the other thing: three or more arms each returning a
 * bare component of its own, which is a router choosing between unrelated products. Two is
 * deliberately not enough, because a screen and its empty state are written exactly that way.
 *
 * ⛔ ONE DETECTOR BECAUSE IT HAPPENS IN TWO PLACES AND ONLY ONE WAS COVERED. The CRE create route
 * forks inside a component the drawing INLINES, which is where this was first written; a route
 * that forks in its own body — the more obvious shape — went unreported, and a test written
 * against the obvious shape is what found it.
 */
function forkOf(
  guards: Array<{ when: string; node: ts.Node }>,
  chosen: ts.Node,
  where: string
): { on: string; chose: string; others: string[]; where: string } | undefined {
  const nameOf = (n: ts.Node): string | undefined => {
    if (ts.isJsxElement(n)) return n.openingElement.tagName.getText();
    if (ts.isJsxSelfClosingElement(n)) return n.tagName.getText();
    return undefined;
  };
  const bare = guards.map((g) => ({ when: g.when, name: nameOf(g.node) })).filter((b) => b.name && /^[A-Z]/.test(b.name));
  const distinct = [...new Set(bare.map((b) => b.name!))];
  if (distinct.length < 3) return undefined;
  const chose = nameOf(chosen);
  /**
   * ⛔ ONLY WHERE THE CHOSEN ARM IS ITSELF ANOTHER SCREEN. A wizard's step switch trips every test
   * above — five arms, five distinct components — but its chrome is a `div` and its steps are
   * already drawn as state tabs above the picture. Reporting that as a fork tells a reviewer
   * something is missing that is on the screen in front of them.
   */
  if (!chose || !/^[A-Z]/.test(chose)) return undefined;
  return {
    on: bare[0]?.when.split("===")[0]?.trim() ?? "something this cannot read",
    chose,
    others: distinct.filter((d) => d !== chose),
    where,
  };
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
        } else if (/\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name)) {
          index.set(e.name.replace(/\.tsx$/, ""), p);
          /**
           * ⛔ AND BY EVERY COMPONENT THE FILE EXPORTS, NOT ONLY ITS NAMESAKE.
           *
           * One file routinely exports several components — `TableToolbar.tsx` exports
           * `TableToolbar` AND `TableToolbarActions`; a table file exports `TableShell`, `THead`,
           * `TBody`, `Td` and `Th`. Indexed by filename alone, every one of those was unresolvable,
           * so the deals list drew its toolbar contents as loose siblings with the layout thrown
           * away and its table as generic divs. Six unresolved components on one screen, all of
           * them sitting in files this index had already walked.
           *
           * A namesake still wins: it is set first and only missing names are added.
           */
          let body = "";
          try {
            body = fs.readFileSync(p, "utf-8");
          } catch {
            body = "";
          }
          for (const m of body.matchAll(/export\s+(?:default\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/g)) {
            const name = m[1]!;
            if (!index.has(name)) index.set(name, p);
          }
        }
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

  /**
   * ⛔ COMPONENTS CO-LOCATED WITH A ROUTE ARE INVISIBLE TO A SINGLE components_dir, AND THAT IS HOW
   * A WHOLE SCREEN DREW AS AN EMPTY BOX.
   *
   * `create-deal` drew 190 bytes: a wrapper around `<ConsolidatedProjectWizard/>`, which lives in
   * `app/(app)/projects/create/components/` — beside its route, which is how the app-directory
   * convention works, and nowhere near the configured `frontend/app/components`. Peter: *"why is
   * there no screen rendering at the top of this feature?"* Because the only thing on it could not
   * be found.
   *
   * So the route's own neighbourhood is indexed too — up to its section root and back down —
   * without widening the configured directory, which stays what it is for everything else. A
   * namesake in components_dir still wins: these are only added where nothing is registered.
   */
  const near = path.dirname(path.resolve(routeFile));
  for (let up = 0, dir = near; up < 4; up++, dir = path.dirname(dir)) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      break;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name === "node_modules" || e.name.startsWith(".")) continue;
      const stack = [path.join(dir, e.name)];
      let seen = 0;
      while (stack.length && seen < 200) {
        const at = stack.pop()!;
        let kids: fs.Dirent[];
        try {
          kids = fs.readdirSync(at, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const k of kids) {
          const full = path.join(at, k.name);
          if (k.isDirectory()) {
            if (k.name === "node_modules" || k.name === "__tests__" || k.name.startsWith(".")) continue;
            stack.push(full);
          } else if (/\.tsx$/.test(k.name) && !/\.(test|spec|stories)\./.test(k.name)) {
            seen++;
            const base = k.name.replace(/\.tsx$/, "");
            if (!index.has(base)) index.set(base, full);
            let body = "";
            try {
              body = fs.readFileSync(full, "utf-8");
            } catch {
              body = "";
            }
            for (const m of body.matchAll(/export\s+(?:default\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/g))
              if (!index.has(m[1]!)) index.set(m[1]!, full);
          }
        }
      }
    }
  }

  const ctx: Ctx = {
    icons,
    resolve: (name) => index.get(name),
    sameFile: routeFile,
    depth: 0,
    from: new Set([path.basename(routeFile)]),
    unresolved: [],
    states: [],
    conditions: [],
    forks: [],
    props: new Map(),
    falsy: new Set(),
    sample: (hint) => {
      const s = opts.sample ?? {};
      for (const [k, v] of Object.entries(s)) if (hint.includes(k)) return v;
      return undefined;
    },
  };
  const jsx = returnedJsx(routeFile);
  /**
   * ⛔ READ IMMEDIATELY, BEFORE ANYTHING ELSE IS PARSED. `emit` calls `returnedJsx` again for every
   * component it inlines — thirty-eight of them on the deals workspace — and each call replaces
   * this. Read after emit, it holds the guards of whichever primitive happened to be read last, and
   * the screen's own states are gone.
   */
  const routeGuards = guardsOfLastRead();
  /**
   * ⛔ THE ROUTE'S OWN BODY FORKS TOO, and this was written only for the inlined case. The CRE
   * create route hides its switch one component down, so that is the shape it was built against —
   * and a route that switches in its own body, which is the more ordinary way to write it, went
   * unreported. Found by a test written against the obvious shape rather than the one in front of
   * me, which is the whole reason to write the obvious one.
   */
  const routeFork = jsx ? forkOf(routeGuards, jsx, path.basename(routeFile)) : undefined;
  if (routeFork) ctx.forks.push(routeFork);
  if (!jsx) return { html: "", from: [...ctx.from], unresolved: ["the route exports no component this can read"], undrawn: [], states: [], forks: [], drawnStates: [], text: "" };
  const plain = emit(jsx, ctx);

  /**
   * ⛔ EVERY STATE THIS SCREEN HAS, DRAWN — not listed.
   *
   * Peter: *"a clickable screenshot at the top of this deals list screen that walks through the
   * various states"*, and then: *"the framework should be able to generate these on a per feature
   * basis"*. So this is not a deals-list feature: any screen whose code branches on loading, empty
   * or error has those states drawn by the same walk that drew the main one, one pass each.
   *
   * ⛔ THE MAIN SCREEN IS A STATE TOO, and it is first. A switcher that opened on "Loading" would
   * make the exception the subject.
   */
  const drawnStates: DrawnState[] = [];
  /**
   * ⛔ EARLY-RETURN GUARDS ARE STATES TOO, and they are where real components keep them. The deals
   * workspace has no state ternary at all — it has three returns, two of them behind `if (isLoading)`
   * and `if (error || !state.project)`. Drawn from the same nodes, so a tab and the screen it shows
   * can never disagree.
   */
  for (const g of routeGuards.slice(0, 6)) {
    let html = "";
    try {
      html = emit(g.node, { ...ctx, states: [], conditions: [], unresolved: [] });
    } catch {
      continue;
    }
    if (!html.trim() || html === plain) continue;
    drawnStates.push({ when: g.when, label: labelFor(g.when), html: opts.parts?.length ? wireParts(html, opts.parts).html : html });
  }
  for (const cond of [...new Set(ctx.conditions)].slice(0, 6)) {
    const sub: Ctx = { ...ctx, prefer: cond, states: [], conditions: [], unresolved: [] };
    let html = "";
    try {
      html = emit(jsx, sub);
    } catch {
      continue;
    }
    /** A state that draws the same thing as the main screen is not a state worth offering. */
    if (!html.trim() || html === plain) continue;
    drawnStates.push({ when: cond, label: labelFor(cond), html: opts.parts?.length ? wireParts(html, opts.parts).html : html });
  }
  /**
   * ⛔ ONE PICTURE PER STATE, AND IT IS THE WHOLE SCREEN. Two conditions can describe the same state
   * — an outer `total === 0` and the inner guard beneath it — and the inner one draws only the card
   * that says "No deals yet", with no header, no filters, nothing around it. A switcher offering
   * both has two buttons called Empty, one of which shows a fragment.
   */
  const best = new Map<string, DrawnState>();
  for (const st of drawnStates) {
    const had = best.get(st.label);
    if (!had || st.html.length > had.html.length) best.set(st.label, st);
  }
  drawnStates.length = 0;
  drawnStates.push(...best.values());
  /**
   * ⛔ THE PAGE GOES INSIDE ITS LAYOUTS, AND THE PARTS ARE WIRED AFTER.
   *
   * Nearest layout first, each one's `<!--children-->` taking what has been built so far — so the
   * outermost ends up outermost, which is the order a browser nests them in. Wiring happens on the
   * composed markup rather than on the page alone, because a part's label can legitimately live in
   * the chrome: a screen whose only "New Deal" button is in the shell would otherwise report its
   * own control as undrawn.
   *
   * ⛔ A LAYOUT THAT DRAWS NOTHING IS SKIPPED RATHER THAN WRAPPED. Several layouts are nothing but
   * providers, and an empty wrapper around the page would push it inside a div for no reason and
   * lose `<!--children-->` in the process.
   */
  let composed = plain;
  if (!opts.inLayout) {
    for (const layout of layoutsAround(routeFile)) {
      let shell: DrawResult;
      try {
        shell = drawFromRoute(layout, { ...opts, parts: undefined, inLayout: true });
      } catch {
        continue;
      }
      if (!shell.html.includes("<!--children-->")) continue;
      composed = shell.html.replace("<!--children-->", composed);
      for (const f of shell.from) ctx.from.add(f);
    }
  }
  const wired = opts.parts?.length ? wireParts(composed, opts.parts) : { html: composed, matched: new Set<string>() };
  /**
   * ⛔ A PART THE DRAWING DOES NOT SHOW IS REPORTED, NEVER DROPPED. Silently omitting it makes the
   * drawing look complete while a control the corpus claims exists is nowhere on it.
   */
  const undrawn = (opts.parts ?? []).filter((p) => !wired.matched.has(p.id) && !p.decorative).map((p) => p.id);
  return {
    html: wired.html,
    from: [...ctx.from],
    unresolved: [...new Set(ctx.unresolved)],
    undrawn,
    /**
     * ⛔ NAMED-BUT-NOT-DRAWN MEANS NOT DRAWN. `states` is the list of appearances this drawing
     * could not show, and it was reporting the ones it had just drawn alongside them — a wizard
     * whose five steps all came out as pictures still printed four of them under "not drawn", so
     * the output of a working generator was indistinguishable from the output of a broken one.
     */
    states: [...new Set(ctx.states)].filter(
      (st) => !drawnStates.some((d) => st.startsWith(`when ${d.when.slice(0, 50)}:`))
    ),
    /** ⛔ Deduped: emit re-walks the route once per state, and a fork reported five times reads as five. */
    forks: [...new Map(ctx.forks.map((f) => [`${f.where}:${f.on}:${f.chose}`, f])).values()],
    drawnStates,
    text: asText(wired.html),
  };
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
