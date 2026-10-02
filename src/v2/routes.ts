/**
 * Which component renders a screen — worked out from the corpus, not typed by a person.
 *
 * ⛔ WHY THIS EXISTS. Peter: *"why isn't this done? we've re-idnexed multiple times. fix product OS
 * so that it ALWAYS generates. why hasn't it been generating properly?"*
 *
 * Six of sixty-six screens had ever been drawn from the code. Not because drawing was broken —
 * `draw` works — but because every layer defaulted to not drawing: the generator had one caller,
 * taking one view at a time with `--route` supplied by hand; `migrate` carried a drawing forward
 * and never made one, so re-indexing was never a drawing path at all; and `check` filed the
 * omission as a note, so a corpus with sixty undrawn screens passed the gate meant to stop it
 * being handed over.
 *
 * A generator a person has to aim, once per screen, is a generator that runs for the first screen
 * somebody cares about and no others.
 *
 * ⛔ AND IT MUST NOT GUESS. The obvious resolver — kebab id to PascalCase filename — points
 * `overview-tab` at `loan-pipeline/OverviewTab.tsx`, which is a different product's tab. A drawing
 * is read as what the product looks like, so the wrong component is worse than no component: it is
 * authoritative and false, and nothing downstream can tell. A name is a coincidence; what a screen
 * SAYS is evidence.
 */
import fs from "node:fs";
import path from "node:path";
import type { Corpus } from "./load.js";
import type { View } from "./schema.js";
import { parseFrontmatter } from "../core/frontmatter.js";

export interface Resolution {
  /** The component, relative to the repo root. */
  file: string;
  /** Labels this view declares that the component contains verbatim. */
  matched: string[];
  /** How many labels there were to match. */
  of: number;
  /** The next best candidate, so a close call can be reported rather than taken. */
  runnerUp?: { file: string; matched: number };
}

export interface Unresolved {
  why: "no-labels" | "no-candidate" | "too-close";
  /** Said to a person, naming what was tried. */
  detail: string;
  candidates?: Array<{ file: string; matched: number }>;
}

/** Source files worth considering. */
function candidateFiles(root: string): string[] {
  const out: string[] = [];
  /**
   * ⛔ WORKTREES AND VENDORED CHECKOUTS, OR A FILE TIES WITH A COPY OF ITSELF.
   *
   * The first sweep reported four screens as unresolvable because "two components hold 4 of 7
   * labels each" — and the two were the same file, once in the repo and once under
   * `.claude/worktrees/`. A margin rule is exactly right and was being defeated by a duplicate, so
   * the honest-looking refusal was noise.
   */
  const skip = new Set([
    "node_modules", ".next", "dist", "build", ".git", "coverage", "__snapshots__",
    ".claude", ".worktrees", "worktrees", "vendor", ".venv",
  ]);
  const walk = (dir: string, depth: number): void => {
    if (depth > 12) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (skip.has(e.name)) continue;
        walk(full, depth + 1);
      } else if (/\.(tsx|jsx)$/.test(e.name) && !/\.(test|spec|stories)\./.test(e.name)) {
        out.push(full);
      }
    }
  };
  walk(root, 0);
  return out;
}

/**
 * What a view claims is on it, as strings a component would contain.
 *
 * ⛔ Part LABELS, not ids. An id is ours; a label is the product's own words, which is exactly what
 * appears in the markup — and the reason this works at all.
 */
export function fingerprintOf(view: View): string[] {
  const out = new Set<string>();
  for (const p of view.parts ?? []) {
    const l = (p.label ?? "").trim();
    // Short strings match everywhere. "No" inside "Northgate" is how a part once bound to the
    // wrong text, and the same arithmetic would pick the wrong component here.
    if (l.length >= 4) out.add(l);
  }
  return [...out];
}

/**
 * The component that renders this view, or why we will not say.
 *
 * ⛔ A MARGIN, NOT A MAXIMUM. Taking the top score outright means a two-to-one call is reported
 * with the same confidence as five-to-nothing. Where the runner-up is close the honest answer is
 * that we do not know — a person naming the route takes a second, and an undetected wrong drawing
 * survives for as long as nobody checks it against the product.
 */
export function resolveRoute(
  view: View,
  opts: { repoRoot: string; searchRoots?: string[] }
): Resolution | Unresolved {
  const fp = fingerprintOf(view);
  if (fp.length === 0)
    return {
      why: "no-labels",
      detail:
        "this screen declares no parts with labels, so there is nothing of its own to find it by — give it its parts, or name the route by hand",
    };

  const roots = (opts.searchRoots?.length ? opts.searchRoots : [opts.repoRoot]).map((r) =>
    path.resolve(opts.repoRoot, r)
  );
  const seen = new Set<string>();
  const scored: Array<{ file: string; matched: string[] }> = [];
  for (const root of roots) {
    for (const file of candidateFiles(root)) {
      if (seen.has(file)) continue;
      seen.add(file);
      let body: string;
      try {
        body = fs.readFileSync(file, "utf-8");
      } catch {
        continue;
      }
      const matched = fp.filter((l) => body.includes(l));
      if (matched.length) scored.push({ file, matched });
    }
  }
  scored.sort((a, b) => b.matched.length - a.matched.length);

  const best = scored[0];
  const next = scored[1];
  const enough = Math.max(2, Math.ceil(fp.length * 0.5));
  /**
   * ⛔ THREE INDEPENDENT SIGNALS BEAT ONE FLAT THRESHOLD — and still never a name on its own.
   *
   * `fannie-program-settings` holds 5 of 13 labels in `FannieMaeProgramSettings.tsx`, two and a
   * half times the next candidate, with every word of its id in the filename. A flat half-the-
   * labels rule refused that, which is the wrong kind of caution: a screen whose wording has
   * drifted since it was written is exactly the screen most worth redrawing. The name is still
   * never enough by itself — it is the third leg, and the evidence and the margin are the others.
   */
  const strongEnough =
    best &&
    best.matched.length >= 2 &&
    nameEchoes(view.id, best.file) &&
    best.matched.length >= 2 * (next?.matched.length ?? 0);
  if (!strongEnough && (!best || best.matched.length < enough))
    return {
      why: "no-candidate",
      detail: `nothing holds ${enough} of this screen's ${fp.length} labels — it may not be built yet, or its words have changed`,
      candidates: scored.slice(0, 3).map((s) => ({ file: rel(opts.repoRoot, s.file), matched: s.matched.length })),
    };
  /**
   * ⛔ A NAME BREAKS A TIE AND NEVER MAKES A CASE. On its own it points `overview-tab` at another
   * product's tab; between two components that hold the same evidence it is the only thing left,
   * and `publish-gates-modal` choosing `PublishRollGatesModal` over `PublishStatementModal` is the
   * call a person would make in a second.
   */
  if (next && next.matched.length === best.matched.length) {
    const tied = scored.filter((s) => s.matched.length === best.matched.length);
    const named = tied.filter((s) => nameEchoes(view.id, s.file));
    if (named.length === 1)
      return {
        file: rel(opts.repoRoot, named[0]!.file),
        matched: named[0]!.matched,
        of: fp.length,
        runnerUp: { file: rel(opts.repoRoot, tied.find((t) => t !== named[0])!.file), matched: best.matched.length },
      };
  }
  if (next && next.matched.length >= best.matched.length)
    return {
      why: "too-close",
      detail: `two components hold ${best.matched.length} of ${fp.length} labels each, so which one renders this screen is a guess`,
      candidates: [best, next].map((s) => ({ file: rel(opts.repoRoot, s.file), matched: s.matched.length })),
    };

  return {
    file: rel(opts.repoRoot, best.file),
    matched: best.matched,
    of: fp.length,
    runnerUp: next ? { file: rel(opts.repoRoot, next.file), matched: next.matched.length } : undefined,
  };
}

export function isResolved(r: Resolution | Unresolved): r is Resolution {
  return (r as Resolution).file !== undefined;
}

/** Does the filename carry the distinctive words of this view's id? */
function nameEchoes(viewId: string, file: string): boolean {
  const base = path.basename(file).replace(/\.[jt]sx$/, "").toLowerCase();
  const words = viewId.split("-").filter((w) => w.length >= 4);
  if (!words.length) return false;
  return words.every((w) => base.includes(w));
}

function rel(root: string, file: string): string {
  return path.relative(root, file) || file;
}

/** Every view in the corpus, with the scope it belongs to. */
export function everyView(corpus: Corpus): Array<{ scope: string; view: View }> {
  const out: Array<{ scope: string; view: View }> = [];
  for (const s of corpus.scopes) for (const v of s.scope.views) out.push({ scope: s.scope.id, view: v });
  return out;
}

/**
 * ⛔ AND EVERY VIEW IN THE OTHER LAYOUT, BECAUSE A GENERATOR THAT SWEEPS ONE OF TWO CORPORA IS A
 * CORPUS THAT GOES STALE WITH NOTHING SAYING SO.
 *
 * `draw-write.ts` opens with the argument for this and makes it about the writer: *"Asking the
 * caller which is how a generator ends up only ever run against one of them."* The writer took the
 * lesson and the sweep did not — it loads the Exchange corpus and nothing else, so the screens
 * under `productos/products/` have not been regenerated since whatever produced them stopped
 * existing. Peter, looking at one of those: *"the rendered style for bilrost currently at
 * localhost:7878 doesn't match at all"* — and a third of that page was drawings from a `draw` three
 * versions old, rendering component names as body text.
 *
 * ⛔ A v1 VIEW IS SHIMMED, NOT CONVERTED. Only what a sweep reads is mapped — the labels it is
 * fingerprinted by, and the parts the drawing is wired to. Converting the rest would be a second
 * reading of the v1 schema living here, a long way from the v1 schema.
 */
export function everyViewV1(root: string): Array<{ scope: string; view: View; root: string }> {
  /**
   * ⛔ IT CARRIES ITS OWN ROOT. The writer looks for a scope under the root it is handed, and the
   * two trees do not share one: an Exchange corpus is `<repo>/v2/truth`, a products corpus is
   * `<repo>/productos/products`. Swept with the Exchange corpus's root, every v1 screen reported
   * as redrawn and not one of them was written — the file it landed on was the Exchange file with
   * a similar id, so both trees still parsed, both still rendered, and the stale one stayed stale.
   */
  const out: Array<{ scope: string; view: View; root: string }> = [];
  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) read(p);
    }
  };
  const read = (file: string): void => {
    let doc: { id?: string; ux?: unknown[]; surfaces?: unknown[] };
    try {
      doc = parseFrontmatter(fs.readFileSync(file, "utf-8")).data as typeof doc;
    } catch {
      return;
    }
    if (!doc?.id) return;
    for (const raw of (doc.ux ?? doc.surfaces ?? []) as Array<Record<string, unknown>>) {
      if (!raw || typeof raw.id !== "string") continue;
      const elements = Array.isArray(raw.elements) ? (raw.elements as Array<Record<string, unknown>>) : [];
      out.push({
        root,
        scope: doc.id,
        view: {
          ...(raw as object),
          parts: elements.map((el) => ({
            id: String(el.id ?? ""),
            label: typeof el.label === "string" ? el.label : undefined,
            role: typeof el.kind === "string" ? el.kind : undefined,
          })),
        } as unknown as View,
      });
    }
  };
  walk(path.join(root, "productos", "products"));
  walk(path.join(root, "productos", "capabilities"));
  return out;
}
