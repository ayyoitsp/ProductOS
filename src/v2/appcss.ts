/**
 * ⛔ THE APPLICATION'S OWN CSS, READ ONCE AND CARRIED WITH THE PAGE.
 *
 * Peter: "we should try to generate what it'd look like from the codebase." A mock written in the
 * real class names is worth nothing without the real values behind them, and those live in the
 * user's stylesheets — a design system plus, usually, a Tailwind build.
 *
 * ⛔ IT TRAVELS AS BYTES. A published page runs under a strict CSP on claude.ai: an external
 * stylesheet is blocked outright, and there is no ProductOS process on the other side to serve one.
 * Linking would render every mock unstyled, which looks like a broken application rather than like
 * a missing file.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readConfig, type ProductosConfig } from "../core/config.js";
import { resolvePathsOrThrow } from "../core/paths.js";
import YAML from "yaml";
import { Style } from "./schema.js";
import type { Corpus } from "./load.js";

export interface AppStyle {
  css: string;
  /** What was read, so the CLI can say so rather than silently shipping nothing. */
  from: string[];
  /**
   * The same list with a digest of each file as it was read.
   *
   * ⛔ OF THE SOURCE BYTES, NOT OF THE RESULT. A digest taken after font inlining changes whenever
   * a face does, which is correct for "has anything moved" and useless for saying WHICH stylesheet
   * somebody edited — and the second is what a person needs in order to decide whether to re-take
   * it.
   */
  sources: Array<{ path: string; sha: string; bytes: number }>;
  /** Named in config and not found — a typo here is byte-identical to an unstyled mock. */
  missing: string[];
  mockClass?: string;
  /** Faces and images carried into the page as bytes, so a mock has the product's own type. */
  inlined: string[];
  /** Named in the stylesheet and not carried — the type on the page is not the product's there. */
  unreachable: string[];
  /**
   * Theme schemes this stylesheet defines — the `html[data-theme=X]` names it is scoped to.
   *
   * ⛔ SO THAT "NOBODY CHOSE" IS DISTINGUISHABLE FROM "THERE IS NOTHING TO CHOOSE". A stylesheet
   * with four schemes and nothing chosen renders mocks in the fallback and looks fine; the only
   * evidence it happened is that the names exist and none was picked, so the names are carried.
   */
  themes: string[];
}

/**
 * ⛔ NO `@import`, EVER. It is the one CSS construct that fetches, and under the artifact's CSP it
 * fails silently — so a stylesheet whose first line imports the rest would ship as an empty file
 * and the mock would render unstyled with nothing anywhere saying why.
 */
const dropImports = (css: string): string => css.replace(/@import\s+[^;]+;/g, "");

/** One level of `*` inside a directory, sorted so the cascade is the same on every machine. */
function expand(root: string, pattern: string): string[] {
  const dir = path.dirname(pattern);
  const base = path.basename(pattern);
  const here = path.resolve(root, dir);
  if (!fs.existsSync(here)) return [];
  const re = new RegExp(`^${base.split("*").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
  return fs
    .readdirSync(here)
    .filter((f) => re.test(f))
    .sort()
    .map((f) => path.posix.join(dir, f));
}

export function appStyleFor(dir: string): AppStyle {
  let cfg: ProductosConfig;
  let root: string;
  try {
    const paths = resolvePathsOrThrow(dir);
    cfg = readConfig(paths);
    root = path.dirname(path.dirname(paths.configFile));
  } catch {
    return { css: "", from: [], sources: [], missing: [], themes: [], inlined: [], unreachable: [] };
  }
  // `stylesheet` is v1's single path; `stylesheets` is the list. Both, in that order.
  const named = [...(cfg.web.stylesheet ? [cfg.web.stylesheet] : []), ...cfg.web.stylesheets];
  const from: string[] = [];
  const sources: AppStyle["sources"] = [];
  const missing: string[] = [];
  // Shared across every stylesheet, because the budget is about the page rather than about a file.
  const budget: Budget = { spent: 0, inlined: [], unreachable: [], seen: new Map() };
  let css = "";
  for (const rel of named) {
    /**
     * ⛔ A GLOB, BECAUSE A BUILD OUTPUT'S NAME IS NOT STABLE.
     *
     * The application this was built against emits its Tailwind as content-hashed chunks —
     * `2g75rzcuqz-sr.css` today, something else after the next build. Config naming one file was
     * config that rots, and it rots into a mock that renders with no utilities at all: right class
     * names, browser-default padding, which looks like a badly written mock rather than a stale
     * path. Picking "the biggest chunk" was worse — I did that, and the biggest was the one WITHOUT
     * the utilities in it.
     */
    const hits = rel.includes("*") ? expand(root, rel) : [rel];
    if (!hits.length) {
      missing.push(rel);
      continue;
    }
    for (const hit of hits) {
      const file = path.resolve(root, hit);
      if (!fs.existsSync(file)) {
        missing.push(hit);
        continue;
      }
      from.push(hit);
      const raw = fs.readFileSync(file, "utf-8");
      sources.push({ path: hit, sha: createHash("sha256").update(raw).digest("hex").slice(0, 16), bytes: raw.length });
      css += `\n/* ${hit} */\n${inlineAssets(dropImports(raw), path.dirname(file), budget)}`;
    }
  }
  const trimmed = css.trim();
  return {
    css: trimmed,
    from,
    sources,
    missing,
    mockClass: cfg.web.mock_container_class,
    themes: themesIn(trimmed),
    inlined: budget.inlined,
    unreachable: budget.unreachable,
  };
}

/**
 * ⛔ A FONT IS A SUBRESOURCE, AND A MOCK HAS NOWHERE TO FETCH ONE FROM.
 *
 * The application's stylesheet declares its faces with `url(../media/….woff2)`, relative to a build
 * directory that does not exist beside this page. Nothing errors: a missing face falls back, so a
 * product whose display face is a serif renders in whatever serif the machine has, and a product
 * whose body face is Geist renders in Helvetica — close enough to look deliberate and wrong enough
 * that nobody can judge a line of type on it.
 *
 * The same argument the stylesheet itself travels on, one step further: a published page is under a
 * CSP that blocks every fetch, and `serve` has no route into somebody's build output. The bytes
 * travel or the face is not there.
 *
 * ⛔ WHAT IS LEFT OUT IS NAMED. A budget that silently drops the twenty-sixth face is a page that
 * says "this is the product's type" and is lying about one weight of it.
 */
const ASSET_BUDGET = 8 * 1024 * 1024;
const ONE_ASSET_MAX = 2 * 1024 * 1024;
const MIME: Record<string, string> = {
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

interface Budget {
  spent: number;
  inlined: string[];
  unreachable: string[];
  /**
   * ⛔ ONE FACE IS ONE COST, however many stylesheets declare it. The build this was written
   * against splits its chunks, and the same woff2 is referenced from several of them — charged per
   * occurrence, a page's worth of type counted two and a half times against its own budget and
   * would start dropping real faces while the bytes were already there.
   */
  seen: Map<string, string>;
}

export function inlineAssets(css: string, dir: string, budget: Budget): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, _q, ref: string) => {
    const url = ref.trim();
    // Already carried, or somewhere else entirely — neither is ours to fetch.
    if (/^(data:|https?:|\/\/|#)/i.test(url)) return whole;
    const clean = url.replace(/[?#].*$/, "");
    const ext = path.extname(clean).toLowerCase();
    const mime = MIME[ext];
    if (!mime) return whole;
    /**
     * A root-relative URL is relative to a server's document root, and there is no server here that
     * knows where that is. Named rather than guessed at: guessing lands on the wrong file as often
     * as the right one, and a wrong font is harder to notice than a missing one.
     */
    const file = url.startsWith("/") ? null : path.resolve(dir, clean);
    if (!file || !fs.existsSync(file)) {
      budget.unreachable.push(url);
      return whole;
    }
    const already = budget.seen.get(file);
    if (already) return already;
    const size = fs.statSync(file).size;
    if (size > ONE_ASSET_MAX || budget.spent + size > ASSET_BUDGET) {
      budget.unreachable.push(`${url} (${Math.round(size / 1024)} KB — over the budget for one page)`);
      return whole;
    }
    budget.spent += size;
    budget.inlined.push(path.basename(clean));
    const carried = `url(data:${mime};base64,${fs.readFileSync(file).toString("base64")})`;
    budget.seen.set(file, carried);
    return carried;
  });
}

/**
 * The scheme names a stylesheet is scoped to — `html[data-theme='bilrost']` → `bilrost`.
 *
 * Read off the selectors rather than from config, because the question this answers is whether the
 * product HAS schemes, and only the stylesheet knows that.
 */
export function themesIn(css: string): string[] {
  const found = new Set<string>();
  for (const m of css.matchAll(/(?:html|:root)\[data-theme\s*=\s*(['"]?)([-\w]+)\1\]/g)) found.add(m[2]);
  return [...found].sort();
}

/**
 * ⛔ A HOST-LEVEL SELECTOR MATCHES NOTHING INSIDE A SHADOW TREE, AND A THEME IS ENTIRELY
 * HOST-LEVEL.
 *
 * A mock is isolated in a shadow root — the only way to inline a whole application's CSS without
 * that CSS restyling the review surface around it. The cost is that `:root`, `html` and `body` name
 * elements in the OUTER document, which the shadow tree does not contain. A design system defines
 * its tokens on exactly those three, so inlined verbatim it hands the mock a stylesheet of
 * variables that resolve to nothing, and a theme layer that applies to nothing.
 *
 * ⛔ IT FAILS BY LOOKING FINE, WHICH IS WHY THIS IS NOT LEFT TO THE STYLESHEET'S AUTHOR. The mock
 * still renders — in whatever the untiled fallbacks are. Peter, looking at a corpus whose mocks had
 * carried the application's theme file in full for weeks: *"the rendered style for bilrost
 * currently at localhost:7878 doesn't match at all"*. Sixteen theme rules were in the page. None of
 * them could ever have matched.
 *
 * ⛔ ONLY THE LEADING COMPOUND IS TOUCHED. page.ts argued a general CSS transform over `@layer`,
 * `@supports`, custom properties and `:is()` would fail quietly on somebody else's stylesheet, and
 * that is still true — so this rewrites the one construct that provably cannot work and leaves
 * every other selector byte-identical. Comments, strings and at-rule preludes are walked past, not
 * parsed.
 */
export function scopeToShadow(css: string, mockClass = "productos-mock"): string {
  let out = "";
  let prelude = "";
  let i = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? css.length : end + 2;
      prelude += css.slice(i, stop);
      i = stop;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c) j += css[j] === "\\" ? 2 : 1;
      prelude += css.slice(i, Math.min(j + 1, css.length));
      i = j + 1;
      continue;
    }
    if (c === "{") {
      /**
       * Everything up to the last `;` is declarations — this block sits inside another rule, and
       * what precedes it is that rule's body, not a selector. CSS nesting makes that reachable.
       */
      /**
       * ⛔ THE COMMENT ABOVE A RULE IS PART OF ITS PRELUDE, AND PROSE IS NOT A SELECTOR.
       *
       * It arrives attached to one, and everything downstream reads the prelude as selector text:
       * a comma in a sentence split `html[data-theme='bilrost']` away from the start of its own
       * selector, and a semicolon in one cut the prelude open mid-comment, leaving the tail of a
       * comment as the leading compound. Four of the five schemes in the stylesheet that prompted this
       * survived as selectors that can never match, and the one that came through was the one
       * somebody had happened to document without using a comma.
       *
       * Lifted out whole, put back in front: a comment's position inside a prelude is cosmetic,
       * and the alternative is tracking offsets through two more rewrites.
       */
      const comments: string[] = [];
      const bare = prelude.replace(/\/\*[\s\S]*?\*\//g, (m) => {
        comments.push(m);
        return "";
      });
      // Everything up to the last `;` is declarations — this rule is nested inside another, and
      // what precedes it is that rule's body rather than a selector. CSS nesting makes that reachable.
      const cut = bare.lastIndexOf(";");
      const head = bare.slice(0, cut + 1);
      const sel = bare.slice(cut + 1);
      out +=
        comments.join("") +
        head +
        (sel.trimStart().startsWith("@") ? sel : rewriteSelectorList(sel, mockClass)) +
        "{";
      prelude = "";
      i++;
      continue;
    }
    if (c === "}") {
      out += prelude + "}";
      prelude = "";
      i++;
      continue;
    }
    prelude += c;
    i++;
  }
  return out + prelude;
}

/**
 * ⛔ A DRAWING IS SHOWN IN A PANE, AND A PAGE WRITTEN FOR A VIEWPORT WASTES MOST OF IT.
 *
 * Peter: *"there's so much empty space above 'new multifamily deal' - why????? can we please just
 * get rid of all this wasted space? WE DON'T HAVE THAT MUCH SCREEN REAL ESTATE to begin with!"*
 *
 * A page's outermost wrapper is written to own the window — `min-h-screen` so the background
 * reaches the bottom of a tall display, `p-6` and `pt-12` so the content is not jammed against the
 * chrome above it. Carried verbatim into a 450px pane, `min-height: 100vh` makes the drawing twice
 * the height of its own frame with everything in the top third, and seventy-two pixels of page
 * padding eat the first sixth of what is left. The screen under review gets a third of the box it
 * was given, and the reviewer scrolls past emptiness to reach it.
 *
 * ⛔ THE RULES ARE THE PAGE'S FRAME, NOT THE SCREEN'S LAYOUT. Only the mock's own root and the one
 * element it wraps are touched, and only their viewport sizing and outer padding. Spacing BETWEEN
 * things — every gap, stack and grid the screen is actually composed of — is the product's design
 * and is left exactly as written. Last, so it wins on order without `!important` on anything but
 * the viewport heights, which Tailwind sets from a utility class of equal weight.
 */
export const PANE_FIT = `
/* productos: a drawing is shown in a pane, not a viewport */
:host { display: block; }
/*
 * ⛔ ANY DEPTH, BECAUSE THE DRAWING IS NOT THE SHADOW ROOT'S FIRST CHILD. The renderer wraps it in
 * the product's own mock container, so a child combinator off :host matches that wrapper and never
 * the page. Written as \`:host > .min-h-screen\` first, which selected nothing at all and looked
 * exactly like the rule having no effect.
 */
:host .min-h-screen, :host .h-screen {
  min-height: 0 !important;
  height: auto !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
/* The centred column inside it carries the page's own top padding — pt-12 here, 48px of nothing. */
:host .min-h-screen > *, :host .h-screen > * {
  padding-top: 0 !important;
}
`;

/** Split on top-level commas — a comma inside `:is(a, b)` or `[x=","]` does not separate selectors. */
function splitTop(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let at = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      parts.push(list.slice(at, i));
      at = i + 1;
    }
  }
  parts.push(list.slice(at));
  return parts;
}

function rewriteSelectorList(list: string, mockClass: string): string {
  return splitTop(list)
    .map((s) => rewriteSelector(s, mockClass))
    .join(",");
}

function rewriteSelector(sel: string, mockClass: string): string {
  const ws = /^\s*/.exec(sel)![0];
  let end = ws.length;
  let depth = 0;
  for (; end < sel.length; end++) {
    const c = sel[end];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && /[\s>+~]/.test(c)) break;
  }
  const compound = sel.slice(ws.length, end);
  const rest = sel.slice(end);
  const m = /^(html|:root)/.exec(compound);
  let scoped = sel;
  if (m) {
    const quals = compound.slice(m[1].length);
    const host = quals ? `:host(${quals})` : ":host";
    /**
     * `:root` keeps its original alongside `:host` — that is what this did before any of the rest
     * existed, and a stylesheet adopted somewhere that is not a shadow root still needs it. `html`
     * gets no such companion: it cannot match in a shadow tree under any circumstances.
     */
    // `rest.trimEnd()` on the first copy only: the whitespace before the brace belongs to the
    // selector list's end, and carried onto both copies it reads as `:host , :root`.
    scoped =
      m[1] === ":root" ? `${ws}${host}${rest.trimEnd()}, ${compound}${rest}` : `${ws}${host}${rest}`;
  }
  /**
   * `body` is the application's page surface; the mock's page surface is the container the markup
   * was wrapped in. A rule reaching for one means the other here.
   */
  return scoped.replace(/(^|[\s>+~(,])body\b(?![-\w])/g, `$1.${mockClass}`);
}


/**
 * ⛔ TAKE THE SNAPSHOT, SO THE CORPUS CARRIES WHAT THE PRODUCT LOOKS LIKE.
 *
 * Peter: *"we should copy the appropriate css files in — were we referencing the repo before?"* We
 * were, at render time, and a hosted instance has no repository to read: it materializes a project
 * into a temp directory with nothing above it, so every drawing rendered in browser defaults while
 * the identical line of code kept working locally.
 *
 * This runs ONCE, where the repository is, and what it produces is a document like any other.
 */
export function snapshotStyle(dir: string, today: string, wearing?: Style): Style {
  const app = appStyleFor(dir);
  /**
   * ⛔ THE CHOICE SURVIVES THE RE-TAKE. Which scheme a project wears is a decision somebody made;
   * the bytes are output. Re-reading the stylesheets must not quietly un-choose it, or the first
   * re-snapshot after a design-system change returns every drawing to the fallback colours — which
   * is this whole defect again, arriving through the command that exists to prevent it.
   *
   * ⛔ AND IT IS DROPPED IF THE SCHEME IS GONE. A choice carried forward onto a stylesheet that no
   * longer defines it applies nothing, and the corpus would claim to be wearing something it is
   * not; `check` can then say the schemes changed, which is true and actionable.
   */
  const theme = wearing?.theme && app.themes.includes(wearing.theme) ? wearing.theme : undefined;
  return {
    theme,
    mock_class: app.mockClass,
    sources: app.sources,
    taken_at: today,
    faces: app.inlined,
    unreachable: app.unreachable,
    offers: app.themes,
    css: app.css,
  };
}

/**
 * Choose which scheme this project wears, without re-reading a single stylesheet.
 *
 * ⛔ A CHOICE, PER PROJECT, AND NOT A REPOSITORY'S SETTING. Peter: *"NEXT_PUBLIC_DS_THEME is a
 * bilrost specific thing, doesn't belong in productos config. we should be able to choose themes
 * per project."* This was `web.theme` in a config file, and briefly a pointer at the application's
 * own env var — which put one customer's variable name into ProductOS's model, and put the decision
 * somewhere the person making it cannot reach. Whoever is reviewing is on an instance, with no
 * checkout, long after the bytes were taken.
 *
 * ⛔ AND IT REFUSES A SCHEME THE STYLESHEETS DO NOT DEFINE, because that failure is invisible: an
 * unknown scheme applies nothing, so the drawings render in the fallback and look exactly as
 * deliberate as a chosen one.
 */
export function wearTheme(style: Style, scheme: string | null): Style {
  if (scheme === null) return { ...style, theme: undefined };
  if (!style.offers.includes(scheme))
    throw new Error(
      `these stylesheets define ${
        style.offers.length ? style.offers.map((t) => `"${t}"`).join(", ") : "no schemes at all"
      }, and "${scheme}" is not among them — an unknown scheme applies nothing and renders as a plausible unthemed product`,
    );
  return { ...style, theme: scheme };
}

/**
 * Has the design system moved since the snapshot was taken?
 *
 * ⛔ IT ANSWERS "I CANNOT TELL" AND THAT IS A THIRD ANSWER, NOT A NO. A hosted instance has no
 * repository to compare against, and reporting "in sync" there would be this tool asserting
 * something it did not check — on precisely the surface where nobody can go and look.
 */
export function styleDrift(
  dir: string,
  style: Style | undefined
): { known: false } | { known: true; moved: string[]; gone: string[]; added: string[] } {
  if (!style) return { known: false };
  let root: string;
  try {
    const paths = resolvePathsOrThrow(dir);
    root = path.dirname(path.dirname(paths.configFile));
  } catch {
    return { known: false };
  }
  const now = appStyleFor(dir);
  if (!now.sources.length && !now.from.length) return { known: false };
  const was = new Map(style.sources.map((s) => [s.path, s.sha]));
  const is = new Map(now.sources.map((s) => [s.path, s.sha]));
  void root;
  return {
    known: true,
    moved: [...is].filter(([p, sha]) => was.has(p) && was.get(p) !== sha).map(([p]) => p),
    gone: [...was.keys()].filter((p) => !is.has(p)),
    added: [...is.keys()].filter((p) => !was.has(p)),
  };
}

/**
 * What a page needs, from the corpus rather than from a disk.
 *
 * ⛔ ONE SOURCE AT RENDER TIME, FOR BOTH CASES. A renderer that read the corpus where it could and
 * a filesystem where it could not would be two products that look identical until somebody
 * publishes one — and the local case is the one with a repository behind it, so it is the case that
 * would always look fine while the hosted one was wrong.
 */
export function styleOf(corpus: Corpus): { appCss?: string; mockClass?: string; theme?: string } {
  return asOptions(corpus.style);
}

/** The same, for a surface holding a `Style` rather than a whole corpus. */
export function asOptions(s: Style | undefined): { appCss?: string; mockClass?: string; theme?: string } {
  if (!s?.css) return {};
  return { appCss: s.css, mockClass: s.mock_class, theme: s.theme };
}

/**
 * ⛔ A FACE CANNOT BE REGISTERED FROM INSIDE A SHADOW ROOT, AND NOTHING SAYS SO.
 *
 * `@font-face` is document-scoped. Put it in a stylesheet a shadow root adopts and it is simply
 * ignored — no error, no warning, and `document.fonts.size` stays at 0. The mock then renders in
 * the fallback the family list names, which for a serif display face is Georgia: close enough to
 * look like a deliberate choice, and wrong.
 *
 * This was measured rather than reasoned about, and it had been shipped: 28 `@font-face` rules
 * carried into the page with every byte of their woff2 inlined, zero faces loaded, every title set
 * in Georgia. The bytes were there the whole time; only their declaration was in the one place a
 * declaration does not count.
 *
 * So the faces are lifted out and emitted at document level, and everything else stays scoped.
 *
 * ⛔ AND THE VARIABLE BINDINGS COME WITH THEM. next/font declares the family on a generated class —
 * `.bona_nova_58b71085-module__Rh9Lnq__variable { --font-bona-nova: "Bona Nova", … }` — which the
 * application puts on `<html>`. A mock host does not carry that class, so the variable is unset and
 * `--font-display: var(--font-bona-nova, Georgia)` falls through to Georgia even once the face
 * loads. A rule that is one class and declares nothing but `--font-*` IS that binding, so it is
 * also applied to the host, which is a mock's equivalent of `<html>`.
 */
export function liftFaces(css: string): { faces: string; rest: string } {
  const faces: string[] = [];
  const rest = css
    .replace(/@font-face\s*\{[^}]*\}/g, (block) => {
      faces.push(block);
      return "";
    })
    /**
     * ⛔ `@property` IS DOCUMENT-SCOPED TOO, AND IT IS WHY EVERY BORDERED BOX WAS INVISIBLE.
     *
     * A registered custom property's `initial-value` is held by the document, not by a shadow root,
     * so inside a mock `var(--tw-border-style)` resolved to nothing. Tailwind v4 writes the border
     * utility as `border-style: var(--tw-border-style); border-width: 1px` — an unresolved style
     * computes as `none`, so a 1px border of no style drew nothing at all. Every input, card and
     * secondary button on every screen rendered as a bare underline or a flat panel, which is a
     * very convincing way to look like somebody else's product.
     *
     * ⛔ EXACTLY THE `@font-face` BUG AGAIN, and the third time this shape has bitten: the at-rules
     * a shadow root ignores have to be hoisted to the document. Peter: *"this looks nothing like
     * our UX"* — the markup was right and had been right the whole time; the border was not drawn.
     */
    .replace(/@property\s+--[-\w]+\s*\{[^}]*\}/g, (block) => {
      faces.push(block);
      return "";
    });
  /**
   * ⛔ NARROW ON PURPOSE: ONE CLASS, AND EVERY DECLARATION A `--font-` CUSTOM PROPERTY. Anything
   * looser starts hoisting a product's own classes onto the host, which restyles a mock by a rule
   * that was never about it. The failure mode of being too narrow is a font variable that stays
   * unset, which is what was already happening.
   */
  /**
   * ⛔ A LOOKBEHIND, BECAUSE THE RULE BEFORE IT EATS THE DELIMITER.
   *
   * This asked for `(^|[}\s])` before the class and the binding was never found — next/font emits
   * the two rules back to back: `.x__className{font-family:Bona Nova,…}.x__variable{--font-bona-
   * nova:…}`. The first matches this same pattern and CONSUMES its own closing brace, so the scan
   * resumes with the second rule's dot at position zero of what is left, with no delimiter in front
   * of it and no `^` either. Matching the rule in isolation worked, which is what made it look like
   * the body test was wrong.
   *
   * Same shape as the comment-stripping bug in `scopeToShadow`: a scan that consumes what the next
   * match needs. Zero-width here, so adjacent rules cannot hide each other.
   */
  for (const m of css.matchAll(/(?<=^|[};\s])(\.[-\w]+)\s*\{([^}]*)\}/g)) {
    const body = m[2].trim();
    if (!body) continue;
    const decls = body.split(";").map((d) => d.trim()).filter(Boolean);
    if (decls.every((d) => /^--font-[-\w]*\s*:/.test(d))) faces.push(`:host, :root { ${decls.join("; ")} }`);
  }
  return { faces: faces.join("\n"), rest };
}

/**
 * The style a corpus directory carries, without loading the whole corpus.
 *
 * ⛔ FOR A SURFACE THAT IS NOT HOLDING A `Corpus`. The v1 tree renders through a different reader
 * entirely and still has to wear the same thing — two sources for what a product looks like is how
 * one tree ends up themed and the other does not, with nothing on either saying which is right.
 */
export function styleAt(corpusDir: string): Style | undefined {
  for (const name of ["style.yaml", "style.yml"]) {
    const file = path.join(corpusDir, name);
    if (!fs.existsSync(file)) continue;
    try {
      const raw = YAML.parse(fs.readFileSync(file, "utf-8")) ?? {};
      if (raw.style) return Style.parse(raw.style);
    } catch {
      /** ⛔ A style that will not parse is no style. `check` is what says so; this only renders. */
      return undefined;
    }
  }
  return undefined;
}
