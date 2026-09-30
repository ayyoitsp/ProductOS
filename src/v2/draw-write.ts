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

const INDENT = "    ";

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

export function writeSketchHtml(
  root: string,
  scopeId: string,
  viewId: string,
  html: string,
  prov?: Provenance,
  text?: string,
  states?: WrittenState[]
): string | undefined {
  const scopeLeaf = scopeId.split("/").pop()!;
  for (const file of candidates(root)) {
    const raw = fs.readFileSync(file, "utf-8");
    // The scope this file holds, however its id is spelled in either layout.
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
      const at = lines.findIndex((l, i) => i > start && i < end && /^\s*states:\s*$/.test(l));
      if (at >= 0) {
        let stop = at + 1;
        const pad = (/^(\s*)/.exec(lines[at]!)![1] ?? "").length;
        while (stop < end && (lines[stop] === "" || (/^\s/.test(lines[stop]!) && (/^(\s*)/.exec(lines[stop]!)![1] ?? "").length > pad))) stop++;
        lines.splice(at, stop - at);
        end -= stop - at;
      }
    }
    for (const key of ["sketch_html", "sketch"]) {
      const has = lines.findIndex((l, i) => i > start && i < end && new RegExp(`^\\s*${key}:\\s*[|>]`).test(l));
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
      `${INDENT}sketch_html: |`,
      ...html.split("\n").map((l) => `${INDENT}  ${l}`),
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
    fs.writeFileSync(file, lines.join("\n"));
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
export function writeLeadsTo(root: string, from: string, to: string): boolean {
  const [scopeId, viewId, partId] = from.split("#");
  if (!scopeId || !viewId || !partId) return false;
  const scopeLeaf = scopeId.split("/").pop()!;
  for (const file of candidates(root)) {
    const raw = fs.readFileSync(file, "utf-8");
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
    fs.writeFileSync(file, lines.join("\n"));
    return true;
  }
  return false;
}
