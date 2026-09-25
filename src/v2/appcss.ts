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
    return { css: "", from: [], missing: [] };
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
  return { css: css.trim(), from, missing, mockClass: cfg.web.mock_container_class };
}
