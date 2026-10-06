/**
 * ⛔ AN ICON DRAWN AS A GREY SQUARE IS A SCREEN WITH HOLES IN IT.
 *
 * `<FolderIcon />` rendered as an empty marker span, so every folder, chevron, spinner, search and
 * status glyph in the corpus came out as a flat grey box. On a sidebar that is a column of bars; on
 * a folder-picker it is a row of boxes beside every result; next to a heading it reads as a broken
 * image. Peter, with his own screenshots open beside the drawing: *"this looks nothing like our
 * UX"* — and the icons were a large part of what was different.
 *
 * ⛔ IT STILL INVENTS NOTHING. The glyph is read out of the icon package the application itself
 * depends on, at the version it has installed. A name that does not resolve to a real icon file
 * keeps the grey square and stays recorded as unresolved — this never draws a guess at a shape.
 */
import fs from "node:fs";
import path from "node:path";

/** Icon packages whose on-disk form this knows how to read. */
const PACKAGES = ["lucide-react"];

/**
 * `AlertCircle` → `alert-circle`, `FolderIcon` → `folder`, `ArrowUpDown` → `arrow-up-down`.
 *
 * ⛔ THE TRAILING `Icon` IS A LOCAL HABIT, NOT PART OF THE NAME. Applications import
 * `{ Folder as FolderIcon }` constantly, and the package has no `folder-icon.mjs`.
 */
function fileNamesFor(name: string): string[] {
  const kebab = (s: string) =>
    s
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/([A-Za-z])(\d)/g, "$1-$2")
      .toLowerCase();
  const out = [kebab(name)];
  const stripped = name.replace(/Icon$/, "");
  if (stripped && stripped !== name) out.push(kebab(stripped));
  return out;
}

/** The nearest `node_modules/<pkg>/dist/esm/icons` at or above `from`. */
const ICON_DIRS = new Map<string, string | null>();
function iconDirNear(from: string): string | null {
  let dir = path.dirname(path.resolve(from));
  const key = dir;
  if (ICON_DIRS.has(key)) return ICON_DIRS.get(key)!;
  let found: string | null = null;
  for (let i = 0; i < 12 && dir !== path.dirname(dir); i++) {
    for (const pkg of PACKAGES) {
      const here = path.join(dir, "node_modules", pkg, "dist", "esm", "icons");
      if (fs.existsSync(here)) {
        found = here;
        break;
      }
    }
    if (found) break;
    dir = path.dirname(dir);
  }
  ICON_DIRS.set(key, found);
  return found;
}

/**
 * The `__iconNode` array, as SVG children.
 *
 * The package stores each icon as `[["path", { d: "…", key: "…" }], …]` — a plain literal, so it is
 * read rather than evaluated. `key` is React bookkeeping and is dropped.
 */
function childrenOf(source: string): string | undefined {
  const start = source.indexOf("__iconNode");
  if (start < 0) return undefined;
  const open = source.indexOf("[", start);
  const end = source.indexOf("];", open);
  if (open < 0 || end < 0) return undefined;
  const body = source.slice(open, end);
  const parts: string[] = [];
  for (const m of body.matchAll(/\[\s*"([a-zA-Z]+)"\s*,\s*\{([^}]*)\}\s*\]/g)) {
    const el = m[1]!;
    const attrs: string[] = [];
    for (const a of m[2]!.matchAll(/([a-zA-Z-]+)\s*:\s*"([^"]*)"/g)) {
      if (a[1] === "key") continue;
      attrs.push(`${a[1]}="${a[2]!.replace(/"/g, "&quot;")}"`);
    }
    parts.push(`<${el}${attrs.length ? " " + attrs.join(" ") : ""} />`);
  }
  return parts.length ? parts.join("") : undefined;
}

/**
 * Every name the package exports, mapped to the icon file it points at.
 *
 * ⛔ THE PACKAGE'S OWN ALIASES, BECAUSE A RENAME IS NOT GUESSABLE. lucide v1 renamed a pile of
 * icons and kept the old names as aliases: `AlertTriangle` is `triangle-alert.mjs`, `Loader2` is
 * `loader-circle.mjs`, `CheckCircle2` is `circle-check-big.mjs`. Nothing about those pairs can be
 * derived from the spelling, and an application that still writes the old name — most of them do —
 * had every one of those glyphs fall back to a grey square. Sixty-eight of one icon on one corpus.
 *
 * The index states the mapping outright, so it is read rather than reconstructed, and it stays
 * right across package upgrades instead of rotting into a table somebody has to maintain here.
 */
const ALIASES = new Map<string, Map<string, string>>();
function aliasesIn(iconDir: string): Map<string, string> {
  let map = ALIASES.get(iconDir);
  if (map) return map;
  map = new Map<string, string>();
  const esm = path.dirname(iconDir);
  for (const index of ["lucide-react.mjs", "index.mjs", "lucide.mjs"]) {
    const file = path.join(esm, index);
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, "utf-8");
    for (const m of src.matchAll(/export\s*\{([^}]*)\}\s*from\s*["']\.\/icons\/([^"']+)\.mjs["']/g)) {
      const target = m[2]!;
      for (const raw of m[1]!.split(",")) {
        const name = raw.includes(" as ") ? raw.split(" as ").pop()!.trim() : raw.trim();
        if (name && name !== "__iconNode") map.set(name, target);
      }
    }
    if (map.size) break;
  }
  ALIASES.set(iconDir, map);
  return map;
}

const CACHE = new Map<string, string | null>();

/**
 * The real glyph for `name` as inline SVG, or undefined if this is not an icon the app has.
 *
 * ⛔ THE CALL SITE'S CLASSES RIDE ALONG. `<SearchIcon className="h-4 w-4 text-gray-400" />` is how
 * every one of these is sized and coloured; dropped, the icons all render at the 24px default and
 * in the inherited colour, which is its own kind of not-looking-like-the-product.
 */
export function lucideSvg(name: string, fromFile: string, cls = ""): string | undefined {
  const dir = iconDirNear(fromFile);
  if (!dir) return undefined;
  const cacheKey = `${dir}::${name}`;
  let kids = CACHE.get(cacheKey);
  if (kids === undefined) {
    kids = null;
    const aliased = aliasesIn(dir).get(name) ?? aliasesIn(dir).get(name.replace(/Icon$/, ""));
    for (const f of aliased ? [aliased, ...fileNamesFor(name)] : fileNamesFor(name)) {
      const file = path.join(dir, `${f}.mjs`);
      if (!fs.existsSync(file)) continue;
      kids = childrenOf(fs.readFileSync(file, "utf-8")) ?? null;
      if (kids) break;
    }
    CACHE.set(cacheKey, kids);
  }
  if (!kids) return undefined;
  const klass = cls.trim() ? ` class="${cls.trim()}"` : "";
  /**
   * ⛔ width AND height, OR AN UNCLASSED ICON EATS THE SCREEN.
   *
   * An inline <svg> with a viewBox and no intrinsic size resolves to the CSS default — 100% of its
   * container — so the pager's two chevrons rendered about sixty pixels tall and shoved "Previous
   * page" and "Next page" halfway across the control. Peter: *"the pagers are hugely wrong"*. The
   * package sets these two attributes on every icon for exactly this reason, and a class from the
   * call site still beats them, because a CSS declaration outranks a presentation attribute.
   */
  return (
    `<svg${klass} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ` +
    `role="img" aria-label="${name}">${kids}</svg>`
  );
}
