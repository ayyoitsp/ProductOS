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
export function writeSketchHtml(root: string, scopeId: string, viewId: string, html: string): string | undefined {
  const scopeLeaf = scopeId.split("/").pop()!;
  for (const file of candidates(root)) {
    const raw = fs.readFileSync(file, "utf-8");
    // The scope this file holds, however its id is spelled in either layout.
    if (!new RegExp(`^id:\\s*["']?[^\\n]*\\b${scopeLeaf}["']?\\s*$`, "m").test(raw)) continue;
    const lines = raw.split("\n");
    const start = lines.findIndex((l) => l.trim() === `- id: ${viewId}`);
    if (start < 0) continue;

    // The end of this view block: the next sibling entry, or the next top-level key.
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^\s*- id: /.test(lines[i]!) || (lines[i] && !/^\s/.test(lines[i]!))) {
        end = i;
        break;
      }
    }

    // Drop an existing drawing, whatever its indent.
    const has = lines.findIndex((l, i) => i > start && i < end && /^\s*sketch_html:\s*\|/.test(l));
    if (has >= 0) {
      let stop = has + 1;
      const pad = (/^(\s*)/.exec(lines[has]!)![1] ?? "").length;
      while (stop < end && (lines[stop] === "" || (/^\s/.test(lines[stop]!) && (/^(\s*)/.exec(lines[stop]!)![1] ?? "").length > pad))) stop++;
      lines.splice(has, stop - has);
      end -= stop - has;
    }

    const at = lines.findIndex((l, i) => i > start && i < end && /^\s*(elements|parts):\s*$/.test(l));
    const insert = at >= 0 ? at : end;
    const block = [`${INDENT}sketch_html: |`, ...html.split("\n").map((l) => `${INDENT}  ${l}`)];
    lines.splice(insert, 0, ...block);
    fs.writeFileSync(file, lines.join("\n"));
    return file;
  }
  return undefined;
}
