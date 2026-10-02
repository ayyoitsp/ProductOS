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
import { readConfig, type ProductosConfig } from "../core/config.js";
import { resolvePathsOrThrow } from "../core/paths.js";

export interface AppStyle {
  css: string;
  /** What was read, so the CLI can say so rather than silently shipping nothing. */
  from: string[];
  /** Named in config and not found — a typo here is byte-identical to an unstyled mock. */
  missing: string[];
  mockClass?: string;
  /** The scheme the product ships, from `web.theme`. Stamped on every mock's host. */
  theme?: string;
  /**
   * Theme schemes this stylesheet defines — the `html[data-theme=X]` names it is scoped to.
   *
   * ⛔ SO THAT "NOBODY CHOSE" IS DISTINGUISHABLE FROM "THERE IS NOTHING TO CHOOSE". A stylesheet
   * with four schemes and no `web.theme` renders mocks in the fallback and looks fine; the only
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
    return { css: "", from: [], missing: [], themes: [] };
  }
  // `stylesheet` is v1's single path; `stylesheets` is the list. Both, in that order.
  const named = [...(cfg.web.stylesheet ? [cfg.web.stylesheet] : []), ...cfg.web.stylesheets];
  const from: string[] = [];
  const missing: string[] = [];
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
      css += `\n/* ${hit} */\n${dropImports(fs.readFileSync(file, "utf-8"))}`;
    }
  }
  const trimmed = css.trim();
  return {
    css: trimmed,
    from,
    missing,
    mockClass: cfg.web.mock_container_class,
    theme: cfg.web.theme,
    themes: themesIn(trimmed),
  };
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
