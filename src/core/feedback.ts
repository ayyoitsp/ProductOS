import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { z } from "zod";
import { ProductosPaths } from "./paths.js";

/**
 * Feedback queue: productos/feedback/<id>.md.
 * One file per feedback entry. State machine:
 *   open       — newly submitted, awaiting Claude (or someone) to process
 *   claimed    — someone is working on it
 *   processed  — applied; the edits are visible in the product truth /
 *                tracking diffs; entry kept as audit
 *
 * Each entry targets a feature (and optionally a specific behavior),
 * and carries free-form prose from the human or external source. Claude
 * reads open entries, interprets them, proposes edits via the MCP
 * write tools, then marks them processed.
 */

export const FeedbackState = z.enum(["open", "claimed", "processed"]);
export type FeedbackState = z.infer<typeof FeedbackState>;

export const FeedbackTarget = z.object({
  feature: z.string().optional(),
  behavior: z.string().optional(),
});
export type FeedbackTarget = z.infer<typeof FeedbackTarget>;

/** YAML deserializes ISO-8601 strings as Date — coerce to ISO string. */
function dateLike() {
  return z.union([z.string(), z.date()]).transform((v) =>
    v instanceof Date ? v.toISOString() : v
  );
}

export const FeedbackFrontmatter = z.object({
  id: z.string(),
  created_at: dateLike(),
  created_by: z.string().default("vet-ui"),
  source: z.string().default("vet-ui"),    // where the feedback came from
  target: FeedbackTarget.default({}),
  state: FeedbackState.default("open"),
  resolved_at: dateLike().optional(),
  resolved_by: z.string().optional(),
});
export type FeedbackFrontmatter = z.infer<typeof FeedbackFrontmatter>;

export interface FeedbackEntry {
  frontmatter: FeedbackFrontmatter;
  body: string;
  filepath: string;
}

// ---------------------------------------------------------------------------
// Paths

export function feedbackDir(paths: ProductosPaths): string {
  return path.join(paths.root, "feedback");
}

export function feedbackFilePath(paths: ProductosPaths, id: string): string {
  return path.join(feedbackDir(paths), `${id}.md`);
}

export function ensureFeedbackDir(paths: ProductosPaths): void {
  fs.mkdirSync(feedbackDir(paths), { recursive: true });
}

// ---------------------------------------------------------------------------
// Read / Write

export function readFeedback(filepath: string): FeedbackEntry {
  const raw = fs.readFileSync(filepath, "utf-8");
  const parsed = matter(raw);
  return {
    frontmatter: FeedbackFrontmatter.parse(parsed.data),
    body: parsed.content.trim(),
    filepath,
  };
}

export function readFeedbackById(paths: ProductosPaths, id: string): FeedbackEntry | null {
  const fp = feedbackFilePath(paths, id);
  if (!fs.existsSync(fp)) return null;
  return readFeedback(fp);
}

export function listFeedback(
  paths: ProductosPaths,
  filter?: { state?: FeedbackState; feature?: string }
): FeedbackEntry[] {
  const dir = feedbackDir(paths);
  if (!fs.existsSync(dir)) return [];
  const out: FeedbackEntry[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".md")) continue;
    try {
      const f = readFeedback(path.join(dir, entry));
      if (filter?.state && f.frontmatter.state !== filter.state) continue;
      if (filter?.feature && f.frontmatter.target.feature !== filter.feature) continue;
      out.push(f);
    } catch (e) {
      process.stderr.write(`productos: ${entry} failed to parse: ${(e as Error).message}\n`);
    }
  }
  out.sort((a, b) => a.frontmatter.created_at.localeCompare(b.frontmatter.created_at));
  return out;
}

export function writeFeedback(paths: ProductosPaths, entry: FeedbackEntry): string {
  const fp = feedbackFilePath(paths, entry.frontmatter.id);
  ensureFeedbackDir(paths);
  const fm = YAML.stringify(entry.frontmatter, { lineWidth: 0, blockQuote: "literal" });
  fs.writeFileSync(fp, `---\n${fm}---\n\n${entry.body.trim()}\n`, "utf-8");
  return fp;
}

/** Generate a new feedback id: yyyymmdd-hhmmss-<slug>-NNN. */
export function newFeedbackId(target: FeedbackTarget): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  const slug = target.behavior
    ? `${target.feature?.replace(/[^a-z0-9]/gi, "-") ?? "feature"}-${target.behavior}`
    : target.feature?.replace(/[^a-z0-9]/gi, "-") ?? "general";
  const rand = Math.random().toString(36).slice(2, 6);
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}-${slug}-${rand}`;
}
