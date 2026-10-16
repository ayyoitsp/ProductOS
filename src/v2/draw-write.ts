/**
 * Writing a generated drawing back into whichever corpus holds the screen.
 *
 * ⛔ IT FINDS THE VIEW RATHER THAN BEING TOLD WHERE IT LIVES. A v1 corpus keeps screens under
 * `ux:` in `products/<area>/<feature>.md`; a v2 corpus keeps them under `views:` in
 * `truth/<scope>.md`. Asking the caller which is how a generator ends up only ever run against one
 * of them.
 *
 * ⛔ AND IT REPLACES, never appends. A generator that stacks a new drawing beside the old one makes
 * the second run produce a file with two, and nothing says which the renderer takes.
 */
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { THE_GENERATOR } from "./held.js";
import { drawingRel } from "./load.js";

const INDENT = "    ";

/**
 * Where a writer's bytes come from and go — the counterpart of `Store` in `load.ts`.
 *
 * ⛔ TWO WRITABLE COPIES OF ONE CORPUS, AND NOTHING MERGING THEM.
 *
 * Peter: *"what is a 'disk file' anyways? why aren't we operating this on 4100 where we're supposed
 * to? what's going on?"*
 *
 * He is right and the answer is embarrassing. Every writer here reached for `fs` directly, so a
 * generator could only ever write to a DIRECTORY — and the page writes to the INSTANCE. The loop was
 * therefore: draw into a checkout, push the whole thing to the instance, and lose whatever anybody
 * had authored there. The guard in `importFromDisk` stops that happening silently; it does not stop
 * there being two copies.
 *
 * ⛔ `load.ts` ALREADY SOLVED THIS AND THE WRITERS IGNORED IT. Its header says it plainly: the
 * filesystem is *"STORAGE BEHIND THE API, not something a client knows about"*, so there is one
 * parser and exactly two implementations of "give me these bytes". This is the same seam for the
 * other direction, so there is one line-surgery implementation and two places it can land.
 *
 * ⛔ AND IT IS SYNCHRONOUS, DELIBERATELY. The surgery is the part that has corrupted a corpus twice
 * by getting block bounds wrong; making it async to suit a network would rewrite all of it for a
 * reason that has nothing to do with correctness. An instance's documents are fetched up front into
 * a map, the existing writers run against that, and whatever moved is sent back — which is exactly
 * what `memoryStore` does for reading.
 */
export interface Pages {
  /** Every file that could hold a scope, as keys this `Pages` can read. */
  list: () => string[];
  read: (file: string) => string;
  write: (file: string, source: string) => void;
  /**
   * A document named relative to the corpus root, as a key THIS `Pages` uses.
   *
   * ⛔ BECAUSE TWO WRITERS CREATE A DOCUMENT RATHER THAN EDITING ONE — a drawn reading and the
   * prototypes file. Editing finds its file by looking; creating has to name one, and a name is
   * where the two implementations genuinely differ: a directory wants an absolute path and a store
   * wants its own key. Asking the caller to know which would put the filesystem back in its hands.
   */
  keyFor: (relative: string) => string;
}

/** A corpus as a directory. What every local command uses. */
export function diskPages(root: string): Pages {
  return {
    list: () => candidates(root),
    read: (file) => fs.readFileSync(file, "utf-8"),
    write: (file, source) => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, source);
    },
    keyFor: (relative) => path.join(root, relative),
  };
}

/**
 * A corpus somebody already handed us, keyed as the store keys it.
 *
 * ⛔ IT RECORDS WHAT MOVED rather than writing anywhere, because the caller is the only thing that
 * knows how to put a document back — and a writer that posted for itself would be a second client
 * of the one door.
 */
export function heldPages(files: Record<string, string>): Pages & { moved: () => string[] } {
  const now = { ...files };
  const touched = new Set<string>();
  return {
    list: () => Object.keys(now),
    read: (file) => now[file] ?? "",
    write: (file, source) => {
      now[file] = source;
      touched.add(file);
    },
    /** ⛔ The store's own key, which is the relative path — see `corpusFiles`. */
    keyFor: (relative) => relative,
    moved: () => [...touched],
  };
}


/** Every markdown file that could hold a scope, in either corpus layout. */
function candidates(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) out.push(p);
    }
  };
  walk(path.join(root, "productos", "products"));
  walk(path.join(root, "productos", "capabilities"));
  walk(path.join(root, "truth"));
  walk(path.join(root, "products"));
  walk(path.join(root, "capabilities"));
  return out;
}

/**
 * Replace (or insert) `sketch_html` on one view. Returns the file written, or undefined if the view
 * is nowhere in this corpus.
 */
export interface Provenance {
  /** The component it was generated from, relative to the repo. */
  from: string;
  /** The commit that component was at. ⛔ Absent where the repo could not be read, never guessed. */
  at?: string;
}

export interface WrittenState {
  when: string;
  label: string;
  html: string;
}

/**
 * Find one view's block in whichever truth file holds its scope.
 *
 * ⛔ ONE IMPLEMENTATION, because the two hard parts here have each already cost a corpus and a
 * second copy of either would cost it again.
 *
 * The first is which FILE: the leaf match is what lets one writer serve both corpus layouts, and on
 * its own it crosses between them. The second is where a view's block ENDS — found by indent, never
 * by `- id:` alone, because a view's `parts:` are children and every one of them starts `- id:`.
 * Stopping at the first part declared the view over early, so a generated block sitting after
 * `parts:` fell outside the window, survived the deletion pass, and got a full second copy spliced
 * in beside it: two `sketch_html`, "duplicated mapping key at line 107", a corpus that would not
 * load.
 *
 * Extracted when `within` needed to be written by a second caller. A session that copied this logic
 * instead would be writing the same two bugs again, in a file where nobody would think to look.
 */
export function locateView(
  pages: Pages,
  scopeId: string,
  viewId: string
): { file: string; lines: string[]; start: number; end: number } | undefined {
  const scopeLeaf = scopeId.split("/").pop()!;
  const files = pages.list();
  const holds = (raw: string, id: string): boolean =>
    new RegExp(`^id:\\s*["']?${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']?\\s*$`, "m").test(raw);
  const ordered = [
    ...files.filter((f) => holds(pages.read(f), scopeId)),
    ...files.filter((f) => !holds(pages.read(f), scopeId)),
  ];
  for (const file of ordered) {
    const raw = pages.read(file);
    if (!new RegExp(`^id:\\s*["']?[^\\n]*\\b${scopeLeaf}["']?\\s*$`, "m").test(raw)) continue;
    const lines = raw.split("\n");
    const start = lines.findIndex((l) => l.trim() === `- id: ${viewId}`);
    if (start < 0) continue;

    const depth = (l: string): number => (/^(\s*)/.exec(l)![1] ?? "").length;
    const mine = depth(lines[start]!);
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i]!;
      if (!l.trim()) continue;
      /** A top-level key ends every nested block under it. */
      if (!/^\s/.test(l)) { end = i; break; }
      /** A sibling list entry: same indent as this view's own dash, and a dash of its own. */
      if (depth(l) <= mine && /^\s*- /.test(l)) { end = i; break; }
      /** A key at or above this view's indent is the end of the list this view is in. */
      if (depth(l) < mine) { end = i; break; }
    }
    return { file, lines, start, end };
  }
  return undefined;
}

/**
 * Record which screen a screen appears inside.
 *
 * ⛔ A COMMAND, BECAUSE THE ONLY WAY TO SAY THIS WAS TO HAND-EDIT A TRUTH FILE.
 *
 * `within` has existed since the walk did, and nothing could write it. So the one relation that
 * turns a pile of screens into a product was reachable only by typing YAML — which is the trap this
 * project names at the top of its own instructions, and it shows: the corpus it was built for has
 * `within` on 0 of 17 screens and fifteen front doors.
 *
 * ⛔ IT IS STILL THE AUTHOR'S FACT. Nothing here infers containment; the command exists so that
 * stating it is one call with the reference checked, rather than a hand edit that silently points at
 * nothing.
 */
/**
 * Set one scalar-valued key on a view, or remove it.
 *
 * ⛔ ONE WRITER FOR THE SHAPE, rather than a copy per field. `within` had this to itself; the second
 * field needing it — `holds_for`, which says who a drawing is for — would have been a second
 * function with the same four subtleties in it, and the fourth one of those is already a comment
 * about a corpus somebody could not have intended and could not see the cause of.
 *
 * ⛔ The value arrives already written as YAML, because the two callers mean different things by it:
 * a containment is a string, a combination is a map. Formatting it here would mean this function
 * knowing every field's type, which is the schema's job.
 */
export function writeViewKey(
  pages: Pages,
  scopeId: string,
  viewId: string,
  key: string,
  yaml: string
): string | undefined {
  const found = locateView(pages, scopeId, viewId);
  if (!found) return undefined;
  const { file, lines, start, end } = found;
  const indent = (() => {
    for (let i = start + 1; i < end; i++) if (lines[i]!.trim()) return /^(\s*)/.exec(lines[i]!)![1] ?? INDENT;
    return INDENT;
  })();
  /** Replace an existing one rather than adding a second — a view with two is a view that will not parse. */
  const at = lines.findIndex((l, i) => i > start && i < end && new RegExp(`^\\s*${key}:`).test(l));
  /**
   * ⛔ EMPTY REMOVES THE LINE, it does not write an empty one. `within: ""` is a reference that
   * resolves to nothing, which `check` refuses — so taking a containment back through the obvious
   * call would have left the corpus in a state the author could not have intended and could not see
   * the cause of. The same is true of `holds_for: {}`: a combination of nothing is not "everywhere",
   * it is a map the next reader has to guess about.
   */
  if (!yaml) {
    if (at >= 0) {
      lines.splice(at, 1);
      pages.write(file, lines.join("\n"));
    }
    return file;
  }
  const line = `${indent}${key}: ${yaml}`;
  if (at >= 0) lines[at] = line;
  else lines.splice(start + 1, 0, line);
  pages.write(file, lines.join("\n"));
  return file;
}

/** Which screen a screen appears inside. ⛔ Empty takes it back — see `writeViewKey`. */
export function writeWithin(pages: Pages, scopeId: string, viewId: string, within: string): string | undefined {
  return writeViewKey(pages, scopeId, viewId, "within", within ? JSON.stringify(within) : "");
}

/**
 * Who a drawing is for. ⛔ An empty map takes it back, and that is the only way to say "everybody":
 * absence means everywhere, so there is no combination that means it.
 */
export function writeHoldsFor(
  pages: Pages,
  scopeId: string,
  viewId: string,
  holds: Record<string, string>
): string | undefined {
  const keys = Object.keys(holds);
  return writeViewKey(
    pages,
    scopeId,
    viewId,
    "holds_for",
    keys.length ? `{ ${keys.map((k) => `${k}: ${JSON.stringify(holds[k])}`).join(", ")} }` : ""
  );
}

export function writeSketchHtml(
  pages: Pages,
  scopeId: string,
  viewId: string,
  html: string,
  prov?: Provenance,
  text?: string,
  /**
   * The screen's OWN states, derived from a component. Absent where there is no component to derive
   * them from — `propose` passes none, and a view's generated states go with the drawing it
   * replaces.
   *
   * ⛔ NOT A PART'S STATES, WHICH ARE A DIFFERENT THING AND SOMEBODY'S AUTHORED WORK. See the
   * splice below: conflating the two silently deleted them on every run.
   */
  states?: WrittenState[]
): string | undefined {
  const scopeLeaf = scopeId.split("/").pop()!;
  /**
   * ⛔ THE WHOLE ID FIRST, AND THE LEAF ONLY WHERE NOTHING CARRIES THE WHOLE ID.
   *
   * The leaf match is what lets one writer serve both layouts, and on its own it crosses between
   * them: a repo holding `truth/deal-list.md` (`id: deal-list`) and
   * `productos/products/cre/deals/deal-list.md` (`id: cre/deals/deal-list`) has two files whose id
   * ends in the same word, and both drawings landed on whichever came first in the walk. One tree
   * then held the other tree's screen and the second tree was never written at all — invisible,
   * because both files still parse and both still render.
   */
  const files = pages.list();
  const holds = (raw: string, id: string): boolean =>
    new RegExp(`^id:\\s*["']?${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']?\\s*$`, "m").test(raw);
  const ordered = [
    ...files.filter((f) => holds(pages.read(f), scopeId)),
    ...files.filter((f) => !holds(pages.read(f), scopeId)),
  ];
  for (const file of ordered) {
    const raw = pages.read(file);
    // The scope this file holds, however its id is spelled in either layout.
    const whose = /^id:\s*["']?([^"'\n]+)["']?\s*$/m.exec(raw)?.[1]?.trim();
    if (!new RegExp(`^id:\\s*["']?[^\\n]*\\b${scopeLeaf}["']?\\s*$`, "m").test(raw)) continue;
    const lines = raw.split("\n");
    const start = lines.findIndex((l) => l.trim() === `- id: ${viewId}`);
    if (start < 0) continue;

    /**
     * The end of this view block: the next SIBLING entry, or the next top-level key.
     *
     * ⛔ A SIBLING IS FOUND BY INDENT, NEVER BY `- id:` ALONE — and getting that wrong wrote a
     * second drawing into a file that already had one, leaving a corpus that would not parse.
     *
     * A view's `parts:` are children, and every one of them starts `- id:`. So this stopped at the
     * first PART and declared the view over there. Any generated block sitting after `parts:` —
     * which is exactly where this writer puts it when `parts` is inline `[]` — then fell outside
     * the window, survived the deletion pass, and got a full second copy spliced in beside it.
     *
     * Two `drawn_from`, two `sketch_html`, two `states`: "duplicated mapping key at line 107". It
     * needs no unusual corpus to hit, only a screen whose parts were written after its drawing,
     * which is the ordinary way round — the drawing comes from the code, the parts come from a
     * person, and people write them second.
     */
    const depth = (l: string): number => (/^(\s*)/.exec(l)![1] ?? "").length;
    const mine = depth(lines[start]!);
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i]!;
      if (!l.trim()) continue;
      /** A top-level key ends every nested block under it. */
      if (!/^\s/.test(l)) { end = i; break; }
      /** A sibling list entry: same indent as this view's own dash, and a dash of its own. */
      if (depth(l) <= mine && /^\s*- /.test(l)) { end = i; break; }
      /** A key at or above this view's indent is the end of the list this view is in. */
      if (depth(l) < mine) { end = i; break; }
    }

    // Drop an existing drawing, whatever its indent.
    // Drop the previous provenance lines too, or a regenerated drawing keeps the old one's.
    for (const key of ["drawn_from", "drawn_at"]) {
      const at = lines.findIndex((l, i) => i > start && i < end && new RegExp(`^\\s*${key}:`).test(l));
      if (at >= 0) {
        lines.splice(at, 1);
        end--;
      }
    }
    /**
     * ⛔ BOTH RENDERINGS ARE REPLACED, AND THAT IS THE WHOLE POINT OF THIS CHANGE.
     *
     * This used to drop `sketch_html` alone and leave `sketch` — the hand-drawn ASCII — exactly
     * where it was. So regenerating a screen produced one file holding the new drawing beside an
     * ASCII sketch of the screen that had been deleted, with nothing marking which was current. It
     * happened on a real corpus: a pricing grid redrawn from the panel that replaced it, with
     * "2 staged pricing edits" and a "Review and publish" button still in the sketch underneath.
     *
     * A packet reads the ASCII, so it cannot simply be dropped — it is generated instead, from the
     * same parse, and neither is anybody's to maintain.
     */
    /**
     * ⛔ THE STATES ARE REGENERATED TOO, or a screen redrawn from a component that no longer has an
     * empty state keeps offering one. They are output, exactly like the drawing above them.
     */
    {
      /**
       * ⛔ THE VIEW'S OWN `states:`, NEVER A PART'S — AND THEY ARE DIFFERENT THINGS.
       *
       * `View.states` is generated: keyed on `when`, the condition in the code, redrawn whenever
       * the component moves. `Part.states` is AUTHORED: keyed on `kind`, a word a person chose,
       * with what somebody is told while the part is in that condition.
       *
       * This matched `/^\s*states:\s*$/` at ANY indent inside the view's window — and a part's
       * `states:` is inside that window, because parts are children of the view. So it found the
       * first one, which on a view whose parts carry authored states is the AUTHORED block, spliced
       * it out, and wrote generated view-level states in its place. Two authors reported the loss
       * independently; one lost them on only ONE of two sibling parts, which is exactly what
       * "the first match wins" looks like from the outside.
       *
       * The view's keys sit at `INDENT`. A part's sit deeper. That is the whole distinction.
       */
      const at = lines.findIndex(
        (l, i) => i > start && i < end && new RegExp(`^${INDENT}states:\\s*$`).test(l)
      );
      if (at >= 0) {
        let stop = at + 1;
        const pad = (/^(\s*)/.exec(lines[at]!)![1] ?? "").length;
        while (stop < end && (lines[stop] === "" || (/^\s/.test(lines[stop]!) && (/^(\s*)/.exec(lines[stop]!)![1] ?? "").length > pad))) stop++;
        lines.splice(at, stop - at);
        end -= stop - at;
      }
    }
    for (const key of ["sketch_html", "sketch"]) {
      /**
       * ⛔ A QUOTED SCALAR COUNTS TOO, AND IT DID NOT. This matched only `key: |` and `key: >`, so a
       * drawing written as `sketch_html: "<div…>"` survived every redraw — and once the new drawing
       * moved to its own file, that leftover was a stale picture nobody could get rid of. The reader
       * now prefers the file, so this is no longer load-bearing for correctness; it is what actually
       * removes the old bytes from the document rather than leaving megabytes of dead HTML in it.
       */
      const has = lines.findIndex(
        (l, i) => i > start && i < end && new RegExp(`^\\s*${key}:\\s*([|>]|["'])`).test(l)
      );
      if (has < 0) continue;
      let stop = has + 1;
      const pad = (/^(\s*)/.exec(lines[has]!)![1] ?? "").length;
      while (stop < end && (lines[stop] === "" || (/^\s/.test(lines[stop]!) && (/^(\s*)/.exec(lines[stop]!)![1] ?? "").length > pad))) stop++;
      lines.splice(has, stop - has);
      end -= stop - has;
    }

    const at = lines.findIndex((l, i) => i > start && i < end && /^\s*(elements|parts):\s*$/.test(l));
    const insert = at >= 0 ? at : end;
    /**
     * ⛔ WRITTEN BESIDE THE DRAWING, because provenance kept anywhere else is provenance that goes
     * stale separately from the thing it describes.
     */
    const block = [
      /**
       * ⛔ QUOTED, BOTH OF THEM. A commit that happens to be all digits parses as a NUMBER in YAML,
       * and the schema then refuses the whole file — a corpus that will not load because of a
       * provenance line, on the one-in-however-many sha with no letters in it. A path can contain a
       * colon or a leading digit for the same reason. Found by a test fixture using an all-zero sha.
       */
      ...(prov ? [`${INDENT}drawn_from: ${JSON.stringify(prov.from)}`] : []),
      ...(prov?.at ? [`${INDENT}drawn_at: ${JSON.stringify(prov.at)}`] : []),
      /**
       * ⛔ THE TEXT FIRST, because it is the one a person reads in a packet and in a terminal, and
       * the HTML below it is one very long line nobody scrolls past.
       */
      ...(text
        ? [`${INDENT}sketch: |`, ...text.split("\n").map((l) => `${INDENT}  ${l}`)]
        : []),
      /**
       * ⛔ THE DRAWING IS NO LONGER IN THE DOCUMENT. It goes to `drawings/<scope>/<view>.html`, and
       * what stays here is the sentence-level record: where it was drawn from, the ASCII sketch a
       * person reads in a terminal, and the states.
       *
       * Peter: *"i don't understand why everything is so big? why isn't stuff broken down?"* —
       * measured on Bilrost, 14.8 MB of a 17.5 MB corpus was 83 `sketch_html` values, and one
       * feature was a single 5.1 MB row that is 98% HTML. Inside a row they cannot be skipped: the
       * store is keyed by path with the source as one text column, so every page view and every
       * save read all 14.8 MB whether anybody wanted a picture or not.
       *
       * ⛔ AND THE CORPUS MIGRATES ITSELF, which is why this needs no migration mechanism. The
       * deletion pass above already strips an inline `sketch_html`, the reader honours both layouts,
       * and `v2 draw --all` is part of the normal ritual — so a corpus moves one screen at a time as
       * screens are redrawn, and a corpus nobody redraws keeps working untouched.
       *
       * ⛔ A STATE'S OWN DRAWING STAYS INLINE FOR NOW, deliberately and not by oversight: the view's
       * main drawing is the bulk, and moving the states means a second key shape
       * (`<view>.<n>.html`) and a second reader. One shape at a time, so a corpus is never half in
       * a layout nobody has read.
       */
      ...(states?.length
        ? [
            `${INDENT}states:`,
            ...states.flatMap((st) => [
              `${INDENT}  - when: ${JSON.stringify(st.when)}`,
              `${INDENT}    label: ${JSON.stringify(st.label)}`,
              `${INDENT}    sketch_html: |`,
              ...st.html.split("\n").map((l) => `${INDENT}      ${l}`),
            ]),
          ]
        : []),
    ];
    lines.splice(insert, 0, ...block);
    pages.write(file, lines.join("\n"));
    /**
     * ⛔ THE PICTURE, BESIDE THE DOCUMENT RATHER THAN INSIDE IT — and written AFTER the document, so
     * a corpus is never left holding a drawing no view mentions. The other order would leave an
     * orphan on any failure between the two.
     *
     * `keyFor` exists for exactly this: its own comment says two writers CREATE a document rather
     * than editing one, and naming it is where a directory and a store genuinely differ.
     */
    /**
     * ⛔ UNDER THE ID THE DOCUMENT ACTUALLY CARRIES, NOT THE ONE WE WERE PASSED — and getting this
     * wrong put one tree's drawing in another tree's folder.
     *
     * The comment above explains why the FILE is found by whole-id-then-leaf: one writer serves both
     * corpus layouts, where a scope is `deal-list` in one and `cre/deals/deal-list` in the other. So
     * the caller may hand over either spelling, while `loadCorpus` looks for a drawing under
     * `scope.id` as the document spells it. Writing under the passed id meant the drawing landed
     * somewhere the reader never looks, and `v2-mock-wears-the-theme` caught it as "the products
     * tree got the other tree's drawing".
     */
    pages.write(pages.keyFor(drawingRel(whose ?? scopeId, viewId)), html);
    return file;
  }
  return undefined;
}


/**
 * Record where a control leads, on the part itself.
 *
 * ⛔ WRITTEN INTO THE CORPUS RATHER THAN HELD IN THE RENDERER, because a graph the page works out
 * fresh each time is a graph nobody can correct. This is a decision software made; a person
 * overrules it by editing the line, and nothing regenerates it away.
 */
export function writeLeadsTo(pages: Pages, from: string, to: string): boolean {
  const [scopeId, viewId, partId] = from.split("#");
  if (!scopeId || !viewId || !partId) return false;
  const scopeLeaf = scopeId.split("/").pop()!;
  for (const file of pages.list()) {
    const raw = pages.read(file);
    if (!new RegExp(`^id:\\s*["']?[^\\n]*\\b${scopeLeaf}["']?\\s*$`, "m").test(raw)) continue;
    const lines = raw.split("\n");
    const viewAt = lines.findIndex((l) => l.trim() === `- id: ${viewId}`);
    if (viewAt < 0) continue;
    /** The part inside that view — the next `- id: <part>` before the next view or top-level key. */
    let partAt = -1;
    for (let i = viewAt + 1; i < lines.length; i++) {
      const line = lines[i]!;
      if (line && !/^\s/.test(line)) break;
      if (/^  - id: /.test(line)) break;
      if (line.trim() === `- id: ${partId}`) {
        partAt = i;
        break;
      }
    }
    if (partAt < 0) continue;
    const pad = /^(\s*)/.exec(lines[partAt]!)![1] ?? "";
    /** Already recorded — a person's line wins, and this never overwrites one. */
    for (let i = partAt + 1; i < lines.length; i++) {
      if (/^\s*- id: /.test(lines[i]!) || (lines[i] && !/^\s/.test(lines[i]!))) break;
      if (/^\s*leads_to:/.test(lines[i]!)) return false;
    }
    lines.splice(partAt + 1, 0, `${pad}  leads_to: ${JSON.stringify(to)}`);
    pages.write(file, lines.join("\n"));
    return true;
  }
  return false;
}

/**
 * Record the drawing as a reading. ⛔ IF IT CAN BE GENERATED, GENERATE IT.
 *
 * `Provenance` is already a `Reading.basis` in all but name: the component that was read and the
 * commit it was at. A screen drawn from a component is an OBSERVATION about the built product —
 * "this is what it renders, as of this commit" — with an exact pointer somebody can go and check.
 * Leaving it to be hand-typed is the trap `CLAUDE.md` opens on, and it is why `readings/` sat empty
 * in every corpus while the one unit of support the confidence scale counts had to be written by
 * hand nine times per exchange.
 *
 * ⛔ WHAT IT OBSERVES IS CAREFULLY NARROW. It says the screen is rendered by that component, and
 * nothing about whether the behaviour is right — which is exactly what a `kind: screen` basis means
 * and what a reviewer needs it to mean. A generator that wrote "this behaviour is correct" would be
 * software asserting truth, which is the boundary this project holds everywhere else.
 *
 * ⛔ AND IT NEVER CONFIRMS ANYTHING. It is support, below the line, and the line is crossed only by
 * a person's act. One generated source is a reason to ask a shorter question, never not to ask.
 */
export function writeDrawnReading(pages: Pages, scopeId: string, viewId: string, prov: Provenance): string {
  const id = `drawn-${scopeId}-${viewId}`;
  const file = pages.keyFor(path.join("readings", `${id}.yaml`));
  /** ⛔ `at` is the commit, not a date — so the discrepancy check cannot compare it. Said, not guessed. */
  const lines = [
    "readings:",
    `  - id: ${id}`,
    `    bears_on: ${scopeId}#${viewId}`,
    `    observes: this screen is rendered by ${prov.from}${prov.at ? ` at ${prov.at}` : ""}, and the drawing beside it was generated from that component`,
    "    basis:",
    "      kind: screen",
    `      ref: ${JSON.stringify(prov.from)}`,
    ...(prov.at ? [`      quote: ${JSON.stringify(`at commit ${prov.at}`)}`] : []),
    /**
     * ⛔ WHO OBSERVED IT, BECAUSE IT WAS NOT A PERSON — and a corpus had no way to tell.
     *
     * A reading is an observation somebody made by looking, and that is what makes one evidence
     * that a screen has been worked on. These are not: the generator writes one per run, so a hold
     * derived from readings would have had the first sweep locking the corpus against the second
     * and `--all` going inert for no stated reason. Saying so here is the whole distinction.
     */
    `      by: ${THE_GENERATOR}`,
    "",
  ];
  pages.write(file, lines.join("\n"));
  return file;
}

/**
 * Write the prototypes file — one writer, so the axis cannot be dropped by one caller.
 *
 * ⛔ THREE COMMANDS WRITE THIS FILE AND ONLY ONE OF THEM HAD HEARD OF `splits_on`.
 *
 * The chrome sweep wrote `YAML.stringify({ prototypes: out })`, which is right up until the file
 * gains a field the sweep does not know about — and then the first redraw after somebody states what
 * their prototypes split on silently deletes it. A generator throwing away the one thing on that
 * file only a person can write.
 *
 * Patching the single caller would have left the same hole open for the next command to write
 * prototypes, so the shape lives here beside the other corpus writers and every caller goes through
 * it.
 *
 * ⛔ AND IT OMITS THE KEY RATHER THAN WRITING AN EMPTY ONE. `splits_on: ""` is a question somebody
 * asked and left blank; absent is nobody having said yet. Those are different states and every
 * surface distinguishes them.
 */
export function writePrototypes(pages: Pages, protos: unknown[], splitsOn?: string | Array<{ id: string; label: string; values?: string[] }>): string {
  const file = pages.keyFor("prototypes.yaml");
  pages.write(
    file,
    YAML.stringify(splitsOn ? { splits_on: splitsOn, prototypes: protos } : { prototypes: protos })
  );
  return file;
}
