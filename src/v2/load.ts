/**
 * Reading an Exchange corpus off disk.
 *
 * Layout — ⛔ deliberately NOT path-as-id. In v1 a container's id was its path, which
 * produced stranded edges on every move and a container id that was not a routable link.
 * Here ids are slugs and the filename is a convenience, so re-filing is free and `move`
 * stops being a command that has to carry a graph.
 *
 *   truth/<slug>.md          one Scope — frontmatter + prose body (framing only, governs nothing)
 *   rules/<name>.md          one Rule per file
 *   capabilities/<slug>.md   one subsystem — engineering's answer to the truth. Never truth itself.
 *   readings/<slug>.yaml     observations. Never truth.
 *   verdicts/<slug>.yaml     a human's acts. Append-only. No machine writer.
 */
import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "../core/frontmatter.js";
import YAML from "yaml";
import { Scope, Rule, Subsystem, Reading, Verdict, Charter, type SlotName , saysText, type Says, Note, Steer, Access, Style, Prototype, PrototypeFile } from "./schema.js";

export interface V2Paths {
  root: string;
  truth: string;
  rules: string;
  capabilities: string;
  readings: string;
  verdicts: string;
}

export function v2Paths(root: string): V2Paths {
  return {
    root,
    truth: path.join(root, "truth"),
    rules: path.join(root, "rules"),
    capabilities: path.join(root, "capabilities"),
    readings: path.join(root, "readings"),
    verdicts: path.join(root, "verdicts"),
  };
}

/**
 * A document that would not load, and enough of itself to be named to a person.
 *
 * ⛔ IT CARRIES ITS OWN `id`/`title`/`in`, AND THAT IS THE WHOLE POINT. Peter, looking at an area
 * whose Deal Overview had gone: *"wtf? overview just disappeared?"*. It had not — it failed the
 * Part refinement, this recorded it, and the page printed the reason faithfully: a zod path and a
 * quoted label, naming no screen. So the surfaces could report the defect and still not answer
 * *which of my screens is missing*, and reading it as a deletion was correct from what was shown.
 *
 * ⛔ AND THE FILE IS NOT THE ANSWER — nothing a reader sees may mention the storage. The name has
 * to come from the document's own words. These three fields parse cleanly on every real failure,
 * because the failures are deeper in: a bad part, a bad state, an unknown key. So the identity is
 * available exactly when it is needed.
 */
export type Unloadable = {
  file: string;
  why: string;
  /** Its own id, where the document got that far. */
  id?: string;
  /** What it calls itself — what a reader is shown. */
  title?: string;
  /** Which container it belongs to, so the menu can keep its place rather than dropping it. */
  in?: string;
};

export interface Corpus {
  paths: V2Paths;
  scopes: Array<{ scope: Scope; body: string; file: string }>;
  /**
   * The product-wide documents — goals, principles, personas and the rest.
   *
   * ⛔ A SEPARATE LIST, not folded into a scope's prose, because each section is agreed to on its own
   * and prose has no addressable parts. See `Charter` in the schema for why they are not rules.
   */
  charter: Array<{ charter: Charter; body: string; file: string }>;
  /**
   * Requests for change, addressed to whoever authors.
   *
   * ⛔ Kept apart from `verdicts` on purpose — see `Note` in the schema. A judgement about truth and
   * a request to change it are different things, and one list holding both would let a request be
   * read as a decision.
   */
  notes: Note[];
  /**
   * ⛔ Context that steers the work without being a claim about the product. Half of it is opaque
   * by design — see `Steer`. Nothing here is ever a verdict.
   */
  steers: Steer[];
  /**
   * ⛔ The roles or permissions this product has. Empty where it has no such concept — see
   * `access:` in the corpus config, which is what says whether that emptiness is a hole.
   */
  access: Access[];
  /**
   * What this product looks like — the application's own stylesheet, carried by the corpus.
   *
   * ⛔ ABSENT IS NOT EMPTY. A corpus with no snapshot renders its drawings unstyled, and `check`
   * says so; a corpus whose snapshot is empty was taken against a product that names no
   * stylesheets. Only one of those is a gap, and a `Style` with `css: ""` cannot be told from a
   * missing one if this is widened to a default.
   */
  style?: Style;
  /**
   * The ways through this product — each with its own front door and its own chrome.
   *
   * ⛔ SEVERAL, NOT ONE. An unauthenticated flow and a signed-in one do not share a menu; two
   * lending businesses in one codebase do not share a walk. See `Prototype`.
   */
  prototypes: Prototype[];
  /** The question the prototype selection asks, in the project own words. Absent until stated. */
  splitsOn?: string | Array<{ id: string; label: string; values?: string[] }>;
  rules: Array<{ rule: Rule; body: string; file: string }>;
  /**
   * The subsystems beneath the product, and roughly what each does.
   *
   * ⛔ A SEPARATE TREE FROM `scopes`, AND THAT IS THE WHOLE REASON IT EXISTS. One subsystem serves
   * many features and one feature leans on several subsystems, so the engineering decomposition
   * cannot be derived from the product's own grouping — which is why v1 kept its own tree, and why
   * collapsing it into `Exchange.asked_by` lost information rather than simplifying.
   *
   * ⛔ NEVER TRUTH. A capability is engineering's answer to the truth: it flows from the design,
   * and no product acceptance reaches it. Peter: *"capabilities are something engineers can/should
   * agree on in the future"* — so each one is addressable and hashed from the day it lands, and
   * nothing yet agrees to any of them.
   */
  subsystems: Array<{ subsystem: Subsystem; body: string; file: string }>;
  readings: Reading[];
  verdicts: Verdict[];
  /** Files that would not parse, with why. ⛔ Reported, never thrown — one malformed file
   *  crashing every command with a stack trace and no filename happened in v1. */
  broken: Unloadable[];
}

/**
 * ⛔ WHERE THE BYTES COME FROM, AS A PARAMETER — because the hosted design says the filesystem is
 * STORAGE BEHIND THE API, not something a client knows about.
 *
 * Peter: "let's go hosted first."
 *
 * A corpus that must never leave the machine runs an instance on the machine and gets the identical
 * loop; a corpus on an instance is reached over HTTP. If those two used different parsers, the local
 * case would degrade into a lesser experience and the gate that protects a corpus naming a real
 * client would become a punishment for using it. So there is one loader, one set of refusals, one
 * set of `broken` messages — and exactly two implementations of "give me these bytes".
 */
export interface Store {
  /** Files directly under `dir` with one of these extensions, as full keys, sorted. */
  list: (dir: string, ext: string[]) => string[];
  read: (file: string) => string;
  /**
   * Whether one named file is there.
   *
   * ⛔ ASKED OF THE STORE, NOT OF `fs`. A corpus is a directory locally and a set of rows hosted,
   * and `loadCorpus` is the one reader for both — reaching for `fs.existsSync` here would work on a
   * laptop and answer "no drawing" for every screen on the instance, which is the shape of bug this
   * file already carries two ⛔ comments about.
   *
   * ⛔ AND NOT `list`-AND-FILTER, which was the alternative. Listing a directory to ask about one
   * file is a question nobody reading it would recognise, and it is one readdir per scope for an
   * answer about one path.
   */
  has: (file: string) => boolean;
}

/** The corpus as a directory. What every local command uses. */
export const diskStore: Store = {
  list: (dir, ext) =>
    !fs.existsSync(dir)
      ? []
      : fs
          .readdirSync(dir)
          .filter((f) => ext.some((e) => f.endsWith(e)))
          .map((f) => path.join(dir, f))
          .sort(),
  read: (file) => fs.readFileSync(file, "utf-8"),
  has: (file) => fs.existsSync(file),
};

/**
 * A corpus somebody already handed us, keyed by the same paths a directory would use.
 *
 * ⛔ THE KEYS ARE PATHS AND THAT IS NOT A LEAK. Nothing a READER sees mentions them — this is the
 * wire between two halves of one program, and a file-shaped key here is no more product truth than
 * a column name is. What would be a leak is one of these reaching a page.
 */
/**
 * What may be in a corpus directory: the sentences, and a screen's picture.
 *
 * ⛔ `.html` IS HERE BECAUSE A DRAWING IS ITS OWN FILE NOW, and leaving it out was silent data
 * loss rather than a missing read. `writeBack` diffs `corpusFiles(dir)` against the documents the
 * request was given — so a drawing the store holds and this does not see appears as REMOVED, and
 * every hosted write would have deprecated every drawing in the project.
 */
const CORPUS_EXT = /\.(md|ya?ml|html)$/;

/**
 * Everything under one corpus directory, at whatever depth it sits.
 *
 * ⛔ RECURSIVE, FOR THE SAME REASON. `drawings/<scope>/<view>.html` is two levels down and this
 * read one — so the drawing `materialize` had just written to disk was invisible on the way back,
 * which is the other half of the same defect.
 */
function walk(here: string, prefix: string, out: Record<string, string>): void {
  for (const entry of fs.readdirSync(here, { withFileTypes: true })) {
    const at = path.join(here, entry.name);
    /** ⛔ Keys are POSIX, because they are store paths — a Windows separator would be a new row. */
    const key = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      walk(at, key, out);
      continue;
    }
    if (!entry.isFile() || !CORPUS_EXT.test(entry.name)) continue;
    out[key] = fs.readFileSync(at, "utf-8");
  }
}

/**
 * Every file a corpus is made of, keyed by the path a directory would give it.
 *
 * ⛔ THE COUNTERPART OF `memoryStore`, AND THEY MUST STAY THAT WAY. An instance reads a corpus with
 * this and a remote client parses it with that, so a directory this misses is a directory the
 * remote copy silently does not have — and the two would disagree about what the corpus says while
 * both reported themselves healthy.
 */
/**
 * Where a screen's picture lives, relative to the corpus root.
 *
 * ⛔ ONE HOME FOR THE KEY, because the reader and the writer must agree and a second copy of this
 * expression would agree on the day it was written and never again. `loadCorpus` reads it onto
 * `View.sketch_html`; `writeSketchHtml` writes it beside the document.
 *
 * ⛔ AND IT IS THE KEY THE PAGE ALREADY USES — `data-mock="<scope>#<view>"` and
 * `/api/v2/mocks?refs=` address a drawing by that pair, so the file layout and the wire agree
 * rather than needing a translation nobody maintains.
 */
export const drawingRel = (scopeId: string, viewId: string): string => `drawings/${scopeId}/${viewId}.html`;

export const CORPUS_DIRS = [
  "truth",
  /**
   * ⛔ A SCREEN'S PICTURE IS ITS OWN FILE, BECAUSE IT WAS 85% OF THE CORPUS AND NOBODY COULD NOT
   * READ IT.
   *
   * Peter: *"i don't understand why everything is so big? why isn't stuff broken down?"* and then
   * *"why can't we just not re-read the images?"*. Measured on Bilrost: 17.5 MB of corpus, of which
   * **14.8 MB was 83 `sketch_html` values** — the sentences, rules, readings and verdicts together
   * were 2.7 MB. One feature, `pl-deal-workspace`, was a single 5.1 MB row that is 98% HTML.
   *
   * ⛔ AND INSIDE A ROW THEY CANNOT BE SKIPPED. The store is keyed by path with the source as one
   * text column, so `select path, source` hands back the drawing whether anybody wanted it or not —
   * which is why every page view, and every save, read all 14.8 MB. "Just do not re-read the
   * images" is only available once they are their own entry.
   *
   * ⛔ NO SCHEMA CHANGE, which is what makes this cheap: `documents` is already one row per PATH, so
   * splitting the file splits the row. And a diff improves — today a drawing is a single-line YAML
   * scalar of megabytes that no review can read, where this is one HTML file per screen.
   */
  "drawings",
  "rules",
  "charter",
  "readings",
  "notes",
  "verdicts",
  "capabilities",
  /**
   * ⛔ ADDED LATE, AND IT HAD BEEN SILENTLY MISSING. `loadCorpus` has read `steers/` since steers
   * existed; this list did not have it, so every steer was invisible over `--at <url>` and absent
   * from the hosted store — where the store is the AUTHORITY, so a missed file is not a stale read
   * but a deletion. Caught by `test/v2-corpus-complete.test.mjs`, which compares the two instead of
   * trusting that somebody updated both.
   */
  "steers",
] as const;

/**
 * Every file a corpus is made of, keyed by the path a directory would give it.
 *
 * ⛔ AND "WHICH DIRECTORIES" WAS THE WRONG QUESTION. `access.yaml` lives at the corpus ROOT, not in
 * a directory, so a list of subdirectories could never have carried it however carefully it was
 * maintained. Root-level YAML is enumerated too, which is what makes this match the parser rather
 * than merely resemble it.
 *
 * ⛔ `events/` IS STILL EXCLUDED, DELIBERATELY. The event log is how a session is told what
 * happened; it is not a claim about the product, and a `documents` row would put it in markdown
 * export and in a packet.
 */
export function corpusFiles(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const sub of CORPUS_DIRS) {
    const here = path.join(root, sub);
    if (!fs.existsSync(here)) continue;
    walk(here, sub, out);
  }
  if (fs.existsSync(root)) {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.ya?ml$/.test(entry.name)) continue;
      out[entry.name] = fs.readFileSync(path.join(root, entry.name), "utf-8");
    }
  }
  return out;
}

export const memoryStore = (root: string, files: Record<string, string>): Store => {
  /** Keys are relative to the corpus root; `v2Paths` hands absolute ones in. One conversion, here. */
  const rel = (p: string): string => (p.startsWith(root) ? p.slice(root.length).replace(/^[/\\]/, "") : p);
  return {
    list: (dir, ext) => {
      const base = rel(dir);
      /**
       * ⛔ THE ROOT IS A DIRECTORY TOO, AND THIS RETURNED NOTHING FOR IT. `rel(root)` is the empty
       * string, so the filter below asked for keys starting with `"/"` and found none — which made
       * `access.yaml` unreadable over the wire and out of the hosted store even once `corpusFiles`
       * carried it. Half a fix is indistinguishable from none here, because both ends report
       * themselves healthy.
       */
      const atRoot = base === "";
      return Object.keys(files)
        .filter((k) => (atRoot ? !k.includes("/") : k.startsWith(base + "/") && !k.slice(base.length + 1).includes("/")))
        .filter((k) => ext.some((e) => k.endsWith(e)))
        .sort()
        .map((k) => path.join(root, k));
    },
    read: (file) => files[rel(file)] ?? "",
    /** ⛔ `in`, not truthiness — an empty file is a file, and a screen may legitimately be blank. */
    has: (file) => rel(file) in files,
  };
};


/**
 * ⛔ A refusal a reader cannot act on is a refusal that gets worked around.
 *
 * Zod's `.message` is a JSON dump of the whole issue array; the first three lines of it are
 * `[`, `{`, `"code": "custom",` — which is what `check` was printing. Somebody looking at
 * that learns only that something is wrong somewhere in the file, so they go and edit until
 * it stops complaining. Path and message, one line each, or the mechanism is decorative.
 */
function why(e: unknown): string {
  const zerr = e as { issues?: Array<{ path: Array<string | number>; message: string }> };
  if (Array.isArray(zerr?.issues)) {
    return zerr
      .issues!.map((i) => `${i.path.length ? i.path.join(".") : "(root)"} — ${i.message}`)
      .join("; ");
  }
  return (e as Error).message.split("\n")[0]!;
}

/**
 * ⛔ A FILE THE LOADER CANNOT MAKE SENSE OF IS REPORTED, NOT SKIPPED.
 *
 * Every one of these collections read `raw.<key> ?? []`, so a file holding a single bare object —
 * the reading's own fields at the top level, which is what an author writes when they follow the
 * example rather than the schema — yielded an empty list, looped zero times, and pushed nothing to
 * `broken`. The file was discarded in total silence.
 *
 * Measured on a real corpus mid-index: **129 of 208 reading files dropped**, `loadCorpus` reporting
 * `0` broken readings, and twenty-odd authors who had each written their evidence with file:line
 * pointers and had no way to discover none of it was being read. A file that says nothing the
 * loader understands was indistinguishable from a file that says nothing.
 *
 * ⛔ IT IS THE INVERSE OF THE TWO FINDINGS FIXED IN #132 AND STRICTLY WORSE. Those fired on correct
 * output, which is noisy and self-announcing. This goes quiet on incorrect output, which is the
 * failure nobody can detect from the outside — the shape `check` exists to prevent and the one
 * `GLOSSARY.md` warns is costly in both directions.
 *
 * ⛔ AN EMPTY OR COMMENT-ONLY FILE IS STILL FINE. `YAML.parse` gives `null` for both, and a blank
 * file is visibly blank to whoever opens it — there is no hidden content to lose. What is reported
 * is a file that plainly holds SOMETHING the loader was not asked for.
 */
function itemsIn(raw: unknown, key: string, file: string, broken: Unloadable[]): unknown[] {
  if (raw === null || raw === undefined) return [];
  if (typeof raw !== "object" || Array.isArray(raw)) {
    broken.push({ file, why: `this is not a \`${key}:\` file — the loader expects a mapping with \`${key}:\` in it` });
    return [];
  }
  const held = raw as Record<string, unknown>;
  /**
   * ⛔ AN EMPTY OBJECT IS NOTHING, AND THE CALLERS HAND ME ONE. Each does
   * `YAML.parse(readFile(file)) ?? {}`, so an empty or comment-only file arrives here as `{}`
   * rather than as null — and my first version reported every one of them. A blank file is visibly
   * blank to whoever opens it; there is no hidden content to lose, so reporting it is noise.
   */
  if (Object.keys(held).length === 0) return [];
  /**
   * ⛔ THE LIST FIRST, AND A BARE ENTRY ONLY AFTER IT — because for one collection the wrapper key
   * and an entry's own field are the SAME WORD.
   *
   * A steer carries `steers: generation`. So a steer written the documented way, as one bare entry,
   * has `steers:` at its top level and the obvious ordering — "is the key there? then it is a list"
   * — read the entry's own enum as a malformed wrapper and reported the file broken. My first
   * version did exactly that, and the test for the four collections a person writes is what caught
   * it; `readings`, `notes` and `access` all happen not to collide, so nothing else would have.
   */
  const v = key in held ? held[key] : undefined;
  if (Array.isArray(v)) return v;
  /** `readings:` with nothing under it is a deliberate empty answer, not a malformed file. */
  if (key in held && (v === null || v === undefined)) return [];
  /**
   * ⛔ ONE BARE ENTRY IS THE DOCUMENTED SHAPE, AND IT WAS THE ONE SHAPE THAT DID NOT LOAD.
   *
   * `agents/productos-scoper.md` shows a reading as a file of its own, named after it, with the
   * entry's fields at the top level and no wrapper:
   *
   *     # readings/<something>.yaml
   *     id: analysts-retype-sponsor
   *     observes: analysts re-type the sponsor name rather than search for it
   *     bears_on: deal-list#see-the-list
   *
   * So an author who followed the instruction EXACTLY wrote a file the loader discarded — 143 of
   * one corpus's 222 reading files, every one of them correct by the only description of the
   * format they were given. Reporting those as broken would be telling twenty authors that the
   * documented shape is a mistake; the loader was the mistake.
   *
   * ⛔ `id` IS THE TEST, not "some key I recognise". Accepting any unrecognised mapping would
   * swallow a genuinely malformed file, which is the silence this whole function exists to end.
   *
   * ⛔ AND IT LINES UP EXACTLY WITH WHO WRITES WHAT, which is why it is the right test rather than
   * a convenient one. `Reading`, `Note`, `Steer` and `Access` all key on `id` — those are the four
   * a person or an author writes by hand, and the four the documented bare shape applies to.
   * `Verdict` has no `id`, and a verdict is never hand-authored: it is a stamp, written only
   * through `accept` or `rule`, by a person, via an intent. So a bare verdict file is still
   * reported — correctly, because nobody was ever told to write one.
   */
  if ("id" in held) return [held];
  /** ⛔ Name what IS there, so the author can see their own fields and spot the missing wrapper. */
  const got = Object.keys(held).slice(0, 4).join(", ");
  broken.push({
    file,
    why: `no \`${key}:\` list at the top level and no \`id:\` either, so nothing in this file was read — it holds ${got ? `\`${got}\`` : "no recognised keys"}. Either one entry's own fields, or a \`${key}:\` list`,
  });
  return [];
}

/**
 * Just the notes, for the callers that only ever wanted the notes.
 *
 * ⛔ `/api/v2/presence` PARSED 17.5 MB TO COUNT A HANDFUL OF OPEN NOTES, AND THE PAGE POLLS IT.
 *
 * Measured through the real request path on Bilrost's corpus: a 35-BYTE presence answer cost
 * 400-1000ms. Profiled across 18 requests, the floor underneath every one of them was YAML parsing
 * ~2.9s, reading the files back ~1.6s and writing them out ~1.0s — because the request materializes
 * the whole corpus to disk, reads it back, parses it, and deletes it. For "is anybody listening",
 * none of that is wanted.
 *
 * `notes/` is a handful of small `.yaml` files. Reading them is the same loop `loadCorpus` runs,
 * lifted so one fact has one home — ⛔ NOT a second implementation of it, which would be the usual
 * cost of a narrow reader and is why this is extracted rather than written.
 */
export function notesIn(root: string, broken?: Array<{ file: string; why: string }>, store: Store = diskStore): Note[] {
  const out: Note[] = [];
  /** ⛔ Through the Store, like `loadCorpus` — so a corpus held in memory answers this too. */
  for (const file of store.list(path.join(v2Paths(root).root, "notes"), [".yaml", ".yml"])) {
    try {
      const raw = YAML.parse(store.read(file)) ?? {};
      for (const n of itemsIn(raw, "notes", file, broken ?? [])) out.push(Note.parse(n));
    } catch (e) {
      broken?.push({ file, why: why(e) });
    }
  }
  return out;
}

export function loadCorpus(root: string, store: Store = diskStore): Corpus {
  const paths = v2Paths(root);
  const readDir = (dir: string, ext: string[]): string[] => store.list(dir, ext);
  const readFile = (file: string): string => store.read(file);
  const broken: Corpus["broken"] = [];
  const scopes: Corpus["scopes"] = [];
  const rules: Corpus["rules"] = [];
  const subsystems: Corpus["subsystems"] = [];
  const charter: Corpus["charter"] = [];

  /**
   * Where a screen's picture lives, as a path under the corpus root.
   *
   * ⛔ `<scope>/<view>.html`, WHICH IS ALREADY THE KEY THE PAGE USES. `data-mock="<scope>#<view>"`
   * and `/api/v2/mocks?refs=` address drawings by exactly this pair, so the file layout and the
   * wire format agree rather than needing a translation nobody maintains.
   */
  const drawingPath = (scopeId: string, viewId: string): string =>
    path.join(paths.root, drawingRel(scopeId, viewId));

  for (const file of readDir(paths.truth, [".md"])) {
    if (path.basename(file).toLowerCase() === "readme.md") continue;
    /**
     * ⛔ READ BEFORE IT IS VALIDATED, so a document that fails can still say which screen it is.
     * Assigned as we go: whatever was recovered before the throw is what the alarm and the menu
     * get, and a document too malformed to name itself simply names nothing.
     */
    let named: Pick<Unloadable, "id" | "title" | "in"> = {};
    try {
      const p = parseFrontmatter(readFile(file));
      const d = (p.data ?? {}) as Record<string, unknown>;
      const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : undefined);
      named = { id: str("id"), title: str("title"), in: str("in") };
      const scope = Scope.parse(p.data);
      /**
       * ⛔ A DRAWING ON DISK WINS, AND AN INLINE ONE STILL WORKS. Corpora written before the split
       * carry `sketch_html` in the document, and a corpus may not stop loading because the layout
       * moved on — the doc-migration moves them when it runs, and until it does both read.
       *
       * ⛔ AND IT IS SET ONTO `sketch_html`, DELIBERATELY. Everything downstream — the renderer, the
       * wiring, the states, the mock bank — asks a View for its `sketch_html`, so assembling it here
       * means the storage shape changed and the model did not. A second field would have been a
       * second question every reader has to ask.
       */
      for (const v of scope.views) {
        const where = drawingPath(scope.id, v.id);
        /**
         * ⛔ THE FILE WINS, AND PREFERRING THE INLINE ONE WAS A REAL BUG I SHIPPED FOR AN HOUR.
         *
         * The first version skipped a view that already had `sketch_html`, reasoning that an
         * un-migrated corpus should keep working. It does — but it also meant a STALE inline
         * drawing beat a freshly written file, silently and forever. Caught by
         * `v2-a-worse-drawing-does-not-win`, whose fixture writes the drawing as a QUOTED scalar
         * while the writer's deletion pass only matched block scalars, so the old one survived the
         * redraw and the new one was invisible.
         *
         * The right precedence is the simple one: the file is where drawings are written, so the
         * file is what a drawing IS. An inline one is a fallback for a corpus that has not been
         * redrawn yet, and a leftover is then harmless rather than authoritative.
         */
        if (store.has(where)) v.sketch_html = store.read(where);
      }
      scopes.push({ scope, body: p.content.trim(), file });
    } catch (e) {
      broken.push({ file, why: why(e), ...named });
    }
  }
  for (const file of readDir(paths.rules, [".md"])) {
    try {
      const p = parseFrontmatter(readFile(file));
      rules.push({ rule: Rule.parse(p.data), body: p.content.trim(), file });
    } catch (e) {
      broken.push({ file, why: why(e) });
    }
  }
  for (const file of readDir(paths.capabilities, [".md"])) {
    if (path.basename(file).toLowerCase() === "readme.md") continue;
    try {
      const p = parseFrontmatter(readFile(file));
      subsystems.push({ subsystem: Subsystem.parse(p.data), body: p.content.trim(), file });
    } catch (e) {
      broken.push({ file, why: why(e) });
    }
  }

  for (const file of readDir(path.join(paths.root, "charter"), [".md"])) {
    if (path.basename(file).toLowerCase() === "readme.md") continue;
    try {
      const p = parseFrontmatter(readFile(file));
      charter.push({ charter: Charter.parse(p.data), body: p.content.trim(), file });
    } catch (e) {
      broken.push({ file, why: why(e) });
    }
  }
  charter.sort((a, b) => (a.charter.order ?? 99) - (b.charter.order ?? 99));

  const readings: Reading[] = [];
  for (const file of readDir(paths.readings, [".yaml", ".yml"])) {
    try {
      const raw = YAML.parse(readFile(file)) ?? {};
      for (const r of itemsIn(raw, "readings", file, broken)) readings.push(Reading.parse(r));
    } catch (e) {
      broken.push({ file, why: why(e) });
    }
  }
  const notes: Note[] = notesIn(root, broken, store);
  /**
   * ⛔ WHAT STEERS THIS PROJECT, which is not product truth and not a note either. See `Steer` in
   * the schema for why those are three different things.
   */
  const steers: Steer[] = [];
  for (const file of readDir(path.join(paths.root, "steers"), [".yaml", ".yml"])) {
    try {
      const raw = YAML.parse(readFile(file)) ?? {};
      for (const x of itemsIn(raw, "steers", file, broken)) steers.push(Steer.parse(x));
    } catch (e) {
      broken.push({ file, why: why(e) });
    }
  }
  /**
   * ⛔ THE ROLES AND PERMISSIONS THE PRODUCT HAS, read once and shared by every feature.
   *
   * One file rather than one per item, unlike rules: a role cannot be judged on its own — what
   * matters is whether the set of them carves the product sensibly, and that is only visible with
   * all of them in front of you.
   */
  const access: Access[] = [];
  for (const file of readDir(paths.root, [".yaml", ".yml"]).filter((f) => /access\.ya?ml$/.test(f))) {
    try {
      const raw = YAML.parse(readFile(file)) ?? {};
      for (const x of itemsIn(raw, "access", file, broken)) access.push(Access.parse(x));
    } catch (e) {
      broken.push({ file, why: why(e) });
    }
  }
  /**
   * ⛔ ROOT-LEVEL, LIKE `access.yaml`, AND FOR THE SAME REASON — it is one fact about the whole
   * product rather than one per scope, and a root file is what `corpusFiles` enumerates, so it
   * reaches the store, a packet and an export with nothing else to keep in step.
   */
  let prototypes: Prototype[] = [];
  /**
   * ⛔ CARRIED SEPARATELY, BECAUSE IT IS A FACT ABOUT THE SET AND NOT ABOUT ANY ONE OF THEM. The
   * question the selection asks belongs to the collection — putting it on each prototype would be
   * the same sentence stored four times with nothing keeping them equal.
   */
  let splitsOn: string | Array<{ id: string; label: string; values?: string[] }> | undefined;
  for (const file of readDir(paths.root, [".yaml", ".yml"]).filter((f) => /prototypes\.ya?ml$/.test(f))) {
    try {
      /**
       * ⛔ `readFile`, NOT `fs.readFileSync` — this was the one loader bypassing the store.
       *
       * Every other read here goes through `store.read`, which is the whole reason a corpus on an
       * instance and a corpus in a directory are parsed by one loader. This one reached for the
       * filesystem directly, so on any store that is not a directory it would throw ENOENT into the
       * silent catch below and a product's prototypes would simply not exist — no finding, no
       * message, an empty selection that looks exactly like a corpus that never declared one.
       *
       * ⛔ IT IS NOT BROKEN TODAY AND THAT IS NOT A DEFENCE. The hosted instance materialises the
       * corpus, so the live page shows both prototypes — I checked before changing it rather than
       * after. What it means is that the failure is one deployment decision away from being real,
       * and invisible when it arrives.
       */
      const raw = YAML.parse(readFile(file)) ?? {};
      if (raw.prototypes) {
        const parsed = PrototypeFile.parse(raw);
        prototypes = parsed.prototypes;
        splitsOn = parsed.splits_on;
      } else if (Object.keys(raw).length) {
        /**
         * ⛔ A FILE SOMEBODY WROTE, THROWN AWAY WITHOUT A WORD.
         *
         * `if (raw.prototypes)` with no else meant a prototypes file whose top-level key was
         * anything else loaded as EMPTY rather than refusing. The deploying session wrote a fixture
         * to a shape I had described badly — a `set:` key instead of `prototypes:` — and
         * `loadCorpus` returned zero prototypes and zero errors, so a malformed file was
         * indistinguishable from a corpus that had none. They lost a round of work to it.
         *
         * `broken` is exactly the channel for this and every sibling loader uses it. An empty file
         * stays silent: a stub somebody has not filled in yet is not a mistake.
         */
        broken.push({
          file,
          why: `no \`prototypes:\` at the top level — found ${Object.keys(raw)
            .slice(0, 3)
            .map((k) => `\`${k}\``)
            .join(", ")}, so every prototype in this file was ignored`,
        });
      }
    } catch (e) {
      /** ⛔ SAID, NOT SWALLOWED — the only loader here that discarded its own parse errors. */
      broken.push({ file, why: why(e) });
    }
  }
  let style: Style | undefined;
  for (const file of readDir(paths.root, [".yaml", ".yml"]).filter((f) => /style\.ya?ml$/.test(f))) {
    try {
      const raw = YAML.parse(readFile(file)) ?? {};
      if (raw.style) style = Style.parse(raw.style);
    } catch (e) {
      broken.push({ file, why: why(e) });
    }
  }
  const verdicts: Verdict[] = [];
  for (const file of readDir(paths.verdicts, [".yaml", ".yml"])) {
    try {
      const raw = YAML.parse(readFile(file)) ?? {};
      for (const v of itemsIn(raw, "verdicts", file, broken)) verdicts.push(Verdict.parse(v));
    } catch (e) {
      broken.push({ file, why: why(e) });
    }
  }
  return { paths, scopes, rules, subsystems, charter, notes, readings, verdicts, steers, access, style, prototypes, splitsOn, broken };
}

// ---------------------------------------------------------------------------
// Rule resolution — which rules fill which slot on which exchange.

export interface Resolved {
  /** `<scope>#<exchange>#<slot>` → the `supplies` rule that IS the answer here, because
   *  nothing local said one. Empty where the exchange spoke for itself. */
  inherited: Map<string, Rule>;
  /** `<scope>#<exchange>#<slot>` → every `constrains` rule that adds a requirement here,
   *  ⛔ INCLUDING where the slot is stated locally. A stated slot does not escape a
   *  constraint; treating it as an escape is what made v1 principles decorative. */
  constrained: Map<string, Rule[]>;
  /** `<scope>#<exchange>#<slot>` → a `supplies` rule that would have answered a slot the
   *  author declared unsettled. ⛔ Neither wins silently: the org has an answer and the
   *  author says nobody does, and only a person can say which is stale. */
  contested: Map<string, Rule[]>;
  /** `<scope>#<exchange>#<slot>` → every `supplies` rule this slot's own sentence pushed
   *  aside. ⛔ Recorded whatever the local standing is, because the escape that mattered was
   *  the quiet one: an ordinary `says:` looked identical to a slot no rule had ever reached. */
  displaced: Map<string, Rule[]>;
  /** rule id → the exchange refs it reaches. ⛔ Needed to invert a selector and report a
   *  rule that governs nothing, which is the failure a v1 principle could not surface. */
  reach: Map<string, string[]>;
  /**
   * `<scope>#<exchange>#<slot>` → the UNSETTLED rules whose selector lands here and which would
   * fill it once somebody answers them.
   *
   * ⛔ THE DIFFERENCE BETWEEN 643 BLANKS AND 7 QUESTIONS, WHICH IS THE DIFFERENCE BETWEEN A
   * REVIEWABLE CORPUS AND A WALL.
   *
   * An unsettled rule was skipped before its selector was even evaluated, on the reasoning that
   * "a rule nobody has decided governs nothing, so the slots it would have filled read as the
   * blanks they are". That is right in a corpus where a blank is rare and wrong in every real one:
   * migrating a shipped product produced 643 slot-blanks that were SEVEN questions — what may
   * anyone ask, what do they bring, what does it refuse, and so on — asked once per exchange
   * because nothing could ask them once.
   *
   * A hole with one home is answerable. The same hole copied 88 times is noise, and noise is how
   * a reviewer stops reviewing.
   */
  awaiting: Map<string, Rule[]>;
}

/**
 * What rule reaches what, worked out once per corpus.
 *
 * ⛔ THIS WAS 62.6% OF THE TIME IT TOOK TO SERVE A PAGE, and not because it is slow — because it was
 * recomputed from scratch for every scope.
 *
 * Measured on 17.5 MB of real Bilrost: the page a reader arrives at took **8.1 seconds** to render,
 * of which `selects` was 6.5s of self time. `resolveRules` walks every scope x every exchange x
 * every rule, and twelve call sites ask for it — `gridFor` once per scope (127 times on that
 * corpus), `renderExchanges` once per scope, `stampFor` once per ref. So the whole-corpus walk ran
 * hundreds of times to render one section.
 *
 * ⛔ A `WeakMap` ON THE CORPUS, WHICH IS THE PATTERN THIS CODEBASE ALREADY USES — `goesCache` in
 * `page.ts` does exactly this for the same reason. Keying on the object rather than on an id is
 * what makes it correct rather than merely fast: a corpus is produced fresh by `loadCorpus`, so a
 * changed corpus is a different object and gets its own answer. Nothing has to remember to
 * invalidate anything, which is the only kind of cache worth having on a derivation.
 *
 * ⛔ AND IT IS A PURE FUNCTION OF `c`, asserted by the fact that every one of those twelve callers
 * passes nothing else. If it ever takes a second argument, this memo is wrong and has to key on it.
 */
const resolved = new WeakMap<Corpus, Resolved>();

export function resolveRules(c: Corpus): Resolved {
  const had = resolved.get(c);
  if (had) return had;
  const out = resolveRulesUncached(c);
  resolved.set(c, out);
  return out;
}

function resolveRulesUncached(c: Corpus): Resolved {
  const inherited = new Map<string, Rule>();
  const awaiting = new Map<string, Rule[]>();
  const constrained = new Map<string, Rule[]>();
  const contested = new Map<string, Rule[]>();
  const displaced = new Map<string, Rule[]>();
  const reach = new Map<string, string[]>();
  for (const { rule } of c.rules) reach.set(rule.id, []);

  for (const { scope } of c.scopes) {
    const ancestry = lineage(c, scope.id);
    for (const ex of scope.exchanges) {
      for (const { rule } of c.rules) {
        if (!selects(rule, scope, ex, ancestry, c)) continue;
        /**
         * ⛔ A rule nobody has decided still does not GOVERN — it supplies no sentence and nothing
         * inherits from it. What changed is that where it would have landed is now recorded, so the
         * hole can be reported once at the rule instead of once per slot. See `awaiting`.
         */
        if (rule.standing && rule.standing.kind !== "stated") {
          for (const filled of rule.fills) {
            const ref = `${scope.id}#${ex.id}#${filled}`;
            if (ex.excepts.some((x) => x.rule === rule.id)) continue;
            // Only where the exchange itself says nothing — a local sentence is an answer, and an
            // unsettled local standing is already reported on its own terms.
            if (ex.slots[filled] !== undefined) continue;
            awaiting.set(ref, [...(awaiting.get(ref) ?? []), rule]);
          }
          continue;
        }
        // ⛔ A rule answers a SET of slots now. A `constrains` rule about work in flight
        // genuinely lands on `answer` and on `fails`, and forcing one slot made the corpus
        // file a `fails` criterion under `answer`.
        for (const filled of rule.fills) {
        const ref = `${scope.id}#${ex.id}#${filled}`;
        // ⛔ An exception is itself a statement needing a reason, not a silent opt-out.
        // It is the ONLY way out of a rule, and it is the same way out for both modes.
        if (ex.excepts.some((x) => x.rule === rule.id)) continue;
        /**
         * ⛔ `reach` COUNTS WHERE A RULE ACTUALLY LANDS, NOT WHERE ITS SELECTOR POINTS.
         *
         * This is the number `acts` prints beside a rule as "how far one accept reaches" —
         * the one figure telling a reviewer how carefully to read before making the
         * highest-leverage decision in the corpus. It was incremented as soon as the
         * selector matched, so it counted exchanges that had excepted the rule and
         * exchanges whose own sentence displaced it: roughly double the truth, in the worst
         * possible place to be optimistic.
         *
         * A consequence worth keeping: a rule displaced everywhere it selects now reaches
         * zero and gets reported as governing nothing, which is exactly what has happened.
         */
        // ⛔ Once per exchange, not once per slot — a rule answering two slots of one
        // exchange reaches one exchange, and `acts` prints this as "how far one accept
        // reaches" to a person deciding how carefully to read.
        const lands = () => {
          const hit = reach.get(rule.id)!;
          const id = `${scope.id}#${ex.id}`;
          if (!hit.includes(id)) hit.push(id);
        };
        if (rule.mode === "constrains") {
          // ⛔ No stated-slot escape. Whatever this exchange answers, it answers THIS too.
          constrained.set(ref, [...(constrained.get(ref) ?? []), rule]);
          lands();
          continue;
        }
        /**
         * `supplies` fills an ABSENT slot and nothing else.
         *
         * ⛔ It used to fill anything not standing `stated`, which quietly resolved every
         * standing an author had gone out of their way to declare. A slot marked
         * `underdetermined` — the author saying "this has two builds, do not guess" —
         * rendered as the rule's answer, so the framework did the exact thing it exists to
         * prevent, and did it invisibly.
         *
         * An absent slot is silence, and silence is what a rule is for. Every other
         * standing is a sentence, and a rule does not overrule a sentence; where the two
         * disagree, `check` reports it as something a person must reconcile.
         */
        const local = ex.slots[filled];
        /**
         * ⛔ A RULE DEFERRED TO IS A RULE THAT GOVERNS, and it counted as reaching nothing.
         *
         * Writing the shared refusal vocabulary the schema advertises rules as the home for
         * produced `displaces-a-rule-without-saying-so` on two exchanges AND
         * `rule-governs-nothing / widen the selector, or delete it` on the rule itself.
         * Declaring the honest `defers_to` on both cleared the first two and left the third —
         * so the corpus still could not be handed over, and `acts` printed `0 exchanges`
         * beside it in the table whose only job is to show leverage.
         */
        if ((local?.defers_to ?? []).some((d) => d.rule === rule.id)) {
          constrained.set(ref, [...(constrained.get(ref) ?? []), rule]);
          lands();
          continue;
        }
        if (local !== undefined) {
          /**
           * ⛔ EVERY DISPLACEMENT IS RECORDED. Which one it is decides how it renders and
           * whether `check` refuses it, but none of them is silent any more.
           *
           * `out_of_scope` is here deliberately. "We deliberately do not answer this" while
           * an org-wide rule DOES answer it deletes the org guarantee rather than deferring
           * to it — a reviewer used it to remove idempotency from a money write, and the
           * identical button one row down still inherited it. Two contradictory answers to
           * one press, and nothing said so.
           */
          displaced.set(ref, [...(displaced.get(ref) ?? []), rule]);
          if (local.standing.kind !== "stated") {
            contested.set(ref, [...(contested.get(ref) ?? []), rule]);
          }
          continue;
        }
        inherited.set(ref, rule);
        lands();
        }
      }
    }
  }
  return { inherited, constrained, contested, displaced, reach, awaiting };
}

/**
 * Every scope whose vocabulary this one may use: its ancestry, plus what it declares it
 * rests on, transitively.
 *
 * ⛔ `depends_on` CARRIES VOCABULARY, OR THE CONTAINER GETS FORCED BACK INTO EXISTENCE.
 *
 * Terms flowed only down `in:`. So two sibling scopes sharing one word had three options:
 * duplicate it (a permanent `one-word-defined-twice` note), refuse to use it (`not-a-word-here`,
 * a refusal), or **invent a parent scope to hold it** — and that third one is
 * `capabilities/<system>/<behaviour>` reappearing in the vocabulary channel, an author made to
 * mint a container in order to file a thing. A reviewer followed the note's own fix text,
 * minted the container, and got a scope that compiles a packet with one glossary entry and
 * no behaviours.
 *
 * `depends_on` already meant "this rests on that" and contributed nothing anywhere. It is the
 * edge that should carry a word between siblings, and now does.
 */
export function vocabularyReach(c: Corpus, id: string): string[] {
  const seen = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const s = c.scopes.find((x) => x.scope.id === cur)?.scope;
    if (!s) continue;
    if (s.in) queue.push(s.in);
    for (const d of s.depends_on) queue.push(d);
  }
  return [...seen];
}

export function lineageOf(c: Corpus, id: string): string[] {
  return lineage(c, id);
}

function lineage(c: Corpus, id: string): string[] {
  const out: string[] = [];
  let cur = c.scopes.find((s) => s.scope.id === id)?.scope;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur.id);
    cur = cur.in ? c.scopes.find((s) => s.scope.id === cur!.in)?.scope : undefined;
  }
  return out;
}

export function selectsFor(
  rule: Rule,
  scope: Scope,
  ex: Exchangeish,
  ancestry: string[],
  c: Corpus
): boolean {
  return selects(rule, scope, ex, ancestry, c);
}

function selects(
  rule: Rule,
  scope: Scope,
  ex: Exchangeish,
  ancestry: string[],
  c: Corpus
): boolean {
  const s = rule.scope;
  // ⛔ Qualified only, and it no longer short-circuits the home test below — a named list was
  // a way past the containment check that `in:` exists to enforce.
  if (s.only && !s.only.includes(`${scope.id}#${ex.id}`)) return false;
  /**
   * ⛔ THE HOME TEST, AT THE TOP — it was written correctly and nested one block too deep,
   * inside `if (s.term)`. So a rule with no term reached every product in the corpus.
   */
  /**
   * ⛔ CONTAINMENT, NOT VOCABULARY REACH.
   *
   * `vocabularyReach` walks `depends_on`, so `Rule.in` — the field added to stop cross-product
   * leakage — was satisfied by a vocabulary edge. A separate root product declaring
   * `depends_on: [family-wallet]` had four slots supplied by the wallet's rules, and the
   * packet handed a volunteer at a school tuck shop *"Only a parent may change what a kid
   * has"*. Removing the line took that corpus from `0 blank` to four honest `slot-blank`
   * refusals.
   *
   * The asymmetry was visible one line down: `under:` already had a containment-only test and
   * `in:` did not, which is why the one rule scoped `under:` stayed out and all six scoped
   * `in:` leaked. Sharing a word is not being part of something.
   */
  const home = rule.in ?? s.under;
  if (home && !lineage(c, scope.id).includes(home)) return false;
  if (s.under && !ancestry.includes(s.under)) return false;
  if (s.asked_by && ex.asked_by !== s.asked_by) return false;
  if (s.tag && !tagsFor(c, scope, ancestry).includes(s.tag)) return false;
  // ⛔ Through the same resolver the rest of the corpus uses. A behaviour arriving on another
  // area's screen must be governed by the rules that screen's controls attract, or the
  // selector says one thing and the picture says another.
  const at = viewOfAsk(c, scope, ex.at);
  if (s.view_kind) {
    if (!at || at.view.view_kind !== s.view_kind) return false;
  }
  if (s.part_role) {
    const p = at?.view.parts.find((x) => x.id === ex.at?.part);
    if (!p || p.role !== s.part_role) return false;
  }
  /**
   * ⛔ `acts_on` MEANS TWO DIFFERENT THINGS AND THEY WERE CONFLATED.
   *
   * **With a term** it narrows which list the term must be in — "every exchange that CHANGES
   * money" as against "every exchange that merely reads it".
   *
   * **Without one** it is about the exchange itself: does it write anything at all.
   *
   * Conflating them meant `acts_on: reads` + a term ALSO required `changes` to be empty. So
   * adding one truthful line — `changes: [balance]` — made a read-authorization rule stop
   * SELECTING an exchange whose own sentence was *"Anybody holding the shared device may see
   * the family total, including a kid."* Nothing entered `displaced`, so
   * `displaces-a-rule-without-saying-so` could not fire and the author was never asked to
   * declare anything. **Being more truthful about the exchange removed the guard.**
   */
  if (!s.term) {
    if (s.acts_on === "reads" && ex.changes.length) return false;
    if (s.acts_on === "changes" && !ex.changes.length) return false;
  }
  if (s.term) {
    /**
     * ⛔ THE WORD HAS TO BE THE SAME WORD, not merely the same spelling.
     *
     * `term` matched any scope anywhere declaring that string, so a rule from one product
     * governed another product's exchanges. Term legality was already resolved through
     * `vocabularyReach`; reach was not. Both now resolve the same way: the rule's home has to
     * be able to see the scope, which is exactly what "the same word" means here.
     */

    // ⛔ `acts_on` narrows WHICH list the term has to be in, so "every exchange that
    // CHANGES money" is finally sayable and "every exchange that merely reads it" is too.
    const pool =
      s.acts_on === "reads" ? ex.reads : s.acts_on === "changes" ? ex.changes : [...ex.reads, ...ex.changes];
    /**
     * ⛔ A MEMBER OF A CLOSED TERM IS THAT TERM, and the selector matched by string equality.
     *
     * `Scope.terms.closed`/`members` declares a containment relation between words, read by
     * the vocabulary check, the packet and nothing that governs. So declaring
     * `money: {closed: true, members: [balance]}` and writing `changes: [balance]` — both
     * true — took an exchange that changes what a kid has clean out of every `term: money`
     * rule. Zero refusals; the grid printed bare ticks on `may` and `at_once` where every
     * other money-writing row reads `↑R6` and `↑R5`; the rules appeared in no `⊗` list, no
     * `≥` list and no note; `acts` offered it and `accept` stamped it.
     *
     * The same exchange's two TERM-LESS rules fired `displaces-a-rule-without-saying-so` and
     * charged a written reason each. Two identity models for one word with the load-bearing
     * one untyped — verbatim the failure `Rule.in`'s own comment says was fixed.
     */
    const members = (word: string): string[] => {
      const out = [word];
      for (const id of vocabularyReach(c, scope.id)) {
        const def = c.scopes.find((x) => x.scope.id === id)?.scope.terms[word];
        if (def?.closed) out.push(...(def.members ?? []));
      }
      return out;
    };
    if (!members(s.term).some((w) => pool.includes(w))) return false;
  }
  return true;
}

type Exchangeish = Scope["exchanges"][number];

function tagsFor(c: Corpus, scope: Scope, ancestry: string[]): string[] {
  const out = new Set<string>(scope.tags);
  for (const id of ancestry) {
    const s = c.scopes.find((x) => x.scope.id === id)?.scope;
    for (const t of s?.tags ?? []) out.add(t);
  }
  return [...out];
}

/** Every word a criterion on this slot is allowed to introduce. See check's §5.3 rule. */
/**
 * ⛔ Crude stemming, on purpose.
 *
 * Without it, a slot saying "not even that they exist" did not license a criterion saying
 * "the kid exists", and a scope declaring the term `parent` did not license "both parents".
 * Every one of those was reported as the criterion asserting something new, which is how a
 * detector that catches real over-assertion also becomes one nobody trusts.
 */
function stem(w: string): string {
  return w
    .replace(/[.,;:]+$/, "")
    .replace(/(ies)$/, "y")
    .replace(/(sses|shes|ches|xes)$/, "")
    .replace(/(ing|ed|es|s)$/, "");
}

export function permittedVocabulary(
  c: Corpus,
  scope: Scope,
  ex: Exchangeish,
  slot: SlotName,
  inheritedSays?: string,
  alsoSays: string[] = []
): Set<string> {
  const words = new Set<string>();
  const add = (s?: string) => {
    for (const w of (s ?? "").toLowerCase().split(/[^a-z0-9.%$-]+/)) {
      if (!w) continue;
      words.add(w);
      words.add(stem(w));
    }
  };
  const fill = ex.slots[slot];
  add(saysText(fill?.says));
  add(inheritedSays);
  /**
   * ⛔ Every rule that lands on this slot, `supplies` AND `constrains`.
   *
   * Only the supplying rule was admitted. So a criterion demonstrating conformance to
   * `empty-reads-as-empty` — *"then the figure reads as unset, not as zero"* — was refused
   * for introducing "unset" and "zero", the two words the rule it demonstrates is made of.
   * The corpus's own best criteria were the ones this rejected.
   */
  for (const s of alsoSays) add(s);
  add(fill?.within);
  for (const o of fill?.outcomes ?? []) {
    add(o.name);
    add(o.when);
    add(o.told);
  }
  add(fill?.cannot_fail);
  add(ex.title);
  /**
   * ⛔ The whole exchange, not this slot alone.
   *
   * One ask with one answer is one thought, and a criterion routinely reaches across it —
   * a `with` criterion says what is recorded, which is the `answer`'s word. Reading each
   * slot in isolation made ordinary paraphrase look like invention, while doing nothing
   * about the actual failure, which is a `then` naming things NO slot says.
   */
  for (const other of Object.values(ex.slots)) {
    add(saysText(other?.says));
    add(other?.cannot_fail);
    for (const o of other?.outcomes ?? []) {
      add(o.name);
      add(o.when);
      add(o.told);
    }
  }
  for (const id of vocabularyReach(c, scope.id)) {
    const s = c.scopes.find((x) => x.scope.id === id)?.scope;
    for (const [term, def] of Object.entries(s?.terms ?? {})) {
      add(term);
      // ⛔ The definition text too, not only the word. `money` is declared as "what a kid
      // has, and every ACT that changes it" — so a criterion saying "act" is using the
      // product's own declared vocabulary, and reporting it as an invention taught authors
      // to avoid the words their own glossary establishes.
      add(def.means);
      for (const m of def.members ?? []) add(m);
    }
  }
  /**
   * ⛔ ONLY THE PART THE ASK ARRIVES AT — not every part on the view.
   *
   * Admitting every label leaked the sketch into the permitted vocabulary: the row label
   * "Sat Tidy your room" licensed `sat`, `tidy`, `your` and `room` for criteria on every
   * slot of every exchange at that view. A drawing is not a behaviour, and it must not widen
   * what a criterion is allowed to assert.
   */
  const v = scope.views.find((x) => x.id === ex.at?.view);
  const p = v?.parts.find((x) => x.id === ex.at?.part);
  if (p) {
    add(p.id);
    add(p.label);
  }
  return words;
}

/**
 * ⛔ THE DISPUTE INDEX — the "by construction" the schema was claiming and did not have.
 *
 * `schema.ts` says a dispute "names every slot it cannot hold with, so it renders on all of
 * them by construction." There was no such construction: `check` iterated the declaring
 * slot's targets, the grid rendered the declaring cell, and nothing indexed back. So the
 * slot on the other side of the contradiction rendered a clean `✓` and compiled into the
 * packet as settled truth — and the builder handed that flow, plausibly not the same person,
 * implemented a sentence the corpus says cannot hold.
 *
 * This is what makes it symmetric: one pass, both directions, built once and read by
 * `check`, `grid` and `packet` so the three cannot drift apart.
 */
export function disputeIndex(c: Corpus): Map<string, Array<{ from: string; because: string }>> {
  const out = new Map<string, Array<{ from: string; because: string }>>();
  const put = (ref: string, from: string, because: string) =>
    out.set(ref, [...(out.get(ref) ?? []), { from, because }]);
  for (const { scope } of c.scopes) {
    for (const ex of scope.exchanges) {
      for (const slot of Object.keys(ex.slots) as SlotName[]) {
        const fill = ex.slots[slot]!;
        if (fill.standing.kind !== "disputed") continue;
        const here = `${scope.id}#${ex.id}#${slot}`;
        const because = fill.standing.because ?? "";
        put(here, here, because);
        for (const target of fill.standing.targets ?? []) {
          if (target === here) continue;
          put(target, here, because);
        }
      }
    }
  }
  return out;
}

/**
 * Resolve `at.view` to the view it names, anywhere in the corpus.
 *
 * ⛔ A VIEW HAD IDENTITY ONLY INSIDE ITS OWN SCOPE, WHICH FORCED GROUPING BY SCREEN.
 *
 * A behaviour that arrives on another area's screen had three exits and all of them were wrong:
 * naming the view bare was refused (`arrives-nowhere`), naming it qualified was refused too,
 * and declaring it on the shared ancestor was refused because views do not inherit. So the
 * only legal moves were re-filing the behaviour under whoever owns the screen — grouping by
 * screen rather than by what owns the behaviour, which is `capabilities/<system>/<behaviour>` one
 * level over — or DUPLICATING the view, which a reviewer did: zero refusals, two views with
 * the same id in two scopes, two different answers on one control, and
 * `one-press-two-answers` escaped entirely because it keys per scope.
 *
 * `<scope>#<view>` is the qualified form. A bare id still resolves locally first, so nothing
 * already written changes meaning.
 */
/**
 * The view an ask arrives at, whichever way it was written.
 *
 * ⛔ ONE PLACE, BECAUSE `at.view` AND `at.view_in` ARE ONE QUESTION. A person-asked exchange names
 * either a view in its own scope or `<scope>#<view>` in another (fg-0005 — a scoper may not read
 * the sibling scope that owns the screen, so insisting on a local view pushed reader actions back
 * into machinery). Four call sites read `at.view` as a definite string; without this they would
 * each have had to know about the second form, and three of them would have been written to ignore
 * it.
 *
 * ⛔ `resolveView` ALREADY RESOLVED THE CROSS-SCOPE FORM — it has handled `<scope>#<view>` since
 * before this existed. Only choosing between the two fields was missing, so this is deliberately
 * the whole of the change rather than a second resolver.
 */
export function viewOfAsk(
  c: Corpus,
  scope: Scope,
  at: { view?: string; view_in?: string } | undefined
): { scope: string; view: Scope["views"][number] } | undefined {
  const ref = at?.view ?? at?.view_in;
  return ref ? resolveView(c, scope, ref) : undefined;
}

export function resolveView(
  c: Corpus,
  scope: Scope,
  ref: string
): { scope: string; view: Scope["views"][number] } | undefined {
  const local = scope.views.find((v) => v.id === ref);
  if (local) return { scope: scope.id, view: local };
  if (ref.includes("#")) {
    const [scopeId, viewId] = ref.split("#");
    const other = c.scopes.find((s) => s.scope.id === scopeId)?.scope;
    const v = other?.views.find((x) => x.id === viewId);
    if (other && v) return { scope: other.id, view: v };
    return undefined;
  }
  // An unqualified id that is not local: resolvable only if exactly one scope declares it,
  // so an ambiguous reference is an error rather than a coin toss.
  const hits = c.scopes.flatMap((s) => s.scope.views.filter((v) => v.id === ref).map((v) => ({ scope: s.scope.id, view: v })));
  return hits.length === 1 ? hits[0] : undefined;
}

/**
 * Whether a thing exists, reading through every container above it.
 *
 * ⛔ `exists` WAS READ ONE HOP, SO WITHDRAWING A CONTAINER DID NOTHING AT ALL.
 *
 * `exists: withdrawn` on the root scope produced `check` output byte-identical to pristine,
 * zero mentions of "withdrawn", all three exchanges still offered by `acts`, and an unchanged
 * packet — because the three sites that read it all did `ex.exists ?? scope.exists`, one hop.
 * Withdrawing a whole area of a product was a no-op.
 *
 * And the message on the finding that DID fire said "it is excluded from packets and from the
 * accept queue while it says this", which was false in both halves.
 */
export function existsOf(c: Corpus, scopeId: string, exchangeExists?: string): string {
  if (exchangeExists) return exchangeExists;
  for (const id of lineage(c, scopeId)) {
    const e = c.scopes.find((s) => s.scope.id === id)?.scope.exists;
    // `withdrawn` anywhere above wins: a behaviour inside a removed area is removed.
    if (e === "withdrawn") return "withdrawn";
    if (e === "intended") return "intended";
  }
  return "kept";
}

/**
 * Slots that genuinely cannot be answered until the answer is.
 *
 * ⛔ AND THE CONDITION, WHICH WAS WRONG IN THREE COPIES.
 *
 * The constant was written out separately in `check.ts`, `grid.ts` and `packet.ts`, and all
 * three fired on any non-`stated` standing. So an `answer` that STATES a full sentence and
 * carries only an `about` residual masked `refuses`, `fails`, `again` and `at_once`: a money
 * write went to `25 slots · 0 blank`, `check` exited 0, and the packet printed *"follows from
 * the answer above… Not a hole; not yours to fill"* three times, for slots nobody had said
 * anything about.
 *
 * The schema's own `about` comment says the opposite — a slot with `about` has an agreed
 * sentence, and what follows from it is knowable. The mask is for an answer with NO sentence.
 */
/**
 * ⛔ `after` IS DOWNSTREAM TOO. What an ask leaves behind cannot be stated by anyone who does not
 * yet know what the ask does — so while `answer` has no sentence at all, a blank `after` is the
 * consequence of that hole and not a second one. The mask fires only on a wholly unanswered
 * `answer`; a sentence with an unruled aspect leaves everything below it knowable.
 */
export const DOWNSTREAM_OF_ANSWER: SlotName[] = ["after", "refuses", "fails", "again", "at_once"];

export function answerIsUnknown(fill: { says?: Says; standing: { kind: string } } | undefined): boolean {
  if (!fill) return false;
  const k = fill.standing.kind;
  if (k === "stated" || k === "out_of_scope") return false;
  // ⛔ A sentence is a sentence. An unruled thing ABOUT it does not make the rest unknowable.
  return !fill.says;
}
