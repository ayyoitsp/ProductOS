import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { z } from "zod";
import { ProductosPaths } from "./paths.js";

/**
 * Context = the overarching layer above features.
 *
 * Each context file is markdown with light frontmatter:
 *
 *   ---
 *   title: Design principles
 *   order: 2
 *   ---
 *
 *   # Design principles
 *
 *   ## Numbers feel rewarding
 *   ...
 *
 * Conventional category names: goals, principles, personas, non-goals, voice.
 * Users can add more (e.g. tone, accessibility) — the system doesn't enforce
 * which categories exist, just renders whatever's in productos/context/.
 *
 * Each `## heading` inside a file becomes an anchorable id when rendered, so
 * features can cite e.g. `principles#numbers-feel-rewarding` in their notes.
 */

export const ContextFrontmatter = z.object({
  title: z.string().optional(),
  order: z.number().optional(),
});
export type ContextFrontmatter = z.infer<typeof ContextFrontmatter>;

export interface ContextDocument {
  /** Stem of the filename, e.g. "principles" from "principles.md". */
  name: string;
  /** Human-readable title; falls back to a capitalized name. */
  title: string;
  /** Lower = sorted earlier on the site/sidebar. */
  order: number;
  /** Markdown body (no frontmatter). */
  body: string;
  /** Absolute path on disk. */
  filepath: string;
}

// ---------------------------------------------------------------------------
// Paths

export function contextRoot(paths: ProductosPaths): string {
  return paths.contextDir;
}

export function contextFilePath(paths: ProductosPaths, name: string): string {
  return path.join(paths.contextDir, `${name}.md`);
}

// ---------------------------------------------------------------------------
// Read

export function listContext(paths: ProductosPaths): ContextDocument[] {
  const dir = paths.contextDir;
  if (!fs.existsSync(dir)) return [];
  const out: ContextDocument[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".md")) continue;
    const name = entry.replace(/\.md$/, "");
    if (name.toLowerCase() === "readme") continue;
    try {
      out.push(readContext(paths, name)!);
    } catch (e) {
      process.stderr.write(
        `productos: context/${entry} failed to parse: ${(e as Error).message}\n`
      );
    }
  }
  out.sort(
    (a, b) =>
      a.order - b.order || a.name.localeCompare(b.name)
  );
  return out;
}

export function readContext(
  paths: ProductosPaths,
  name: string
): ContextDocument | null {
  const fp = contextFilePath(paths, name);
  if (!fs.existsSync(fp)) return null;
  const raw = fs.readFileSync(fp, "utf-8");
  const parsed = matter(raw);
  const fm = ContextFrontmatter.parse(parsed.data);
  return {
    name,
    title: fm.title ?? capitalize(name.replace(/-/g, " ")),
    order: fm.order ?? 999,
    body: parsed.content.trim(),
    filepath: fp,
  };
}

export function readContextReadme(paths: ProductosPaths): string | null {
  const fp = path.join(paths.contextDir, "README.md");
  if (!fs.existsSync(fp)) return null;
  return fs.readFileSync(fp, "utf-8");
}

// ---------------------------------------------------------------------------
// Write

export function writeContext(
  paths: ProductosPaths,
  doc: { name: string; title?: string; order?: number; body: string }
): string {
  const fp = contextFilePath(paths, doc.name);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const fm: Record<string, unknown> = {};
  if (doc.title) fm.title = doc.title;
  if (doc.order != null) fm.order = doc.order;
  const fmStr = Object.keys(fm).length ? `---\n${YAML.stringify(fm, { lineWidth: 0 })}---\n\n` : "";
  fs.writeFileSync(fp, `${fmStr}${doc.body.trim()}\n`, "utf-8");
  return fp;
}

// ---------------------------------------------------------------------------
// Strategy = all context concatenated. Used for prompt context.

export function getStrategy(paths: ProductosPaths): string {
  const docs = listContext(paths);
  if (docs.length === 0) return "";
  const sections = docs.map((d) => `## ${d.title}\n\n${d.body.trim()}`);
  return sections.join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
