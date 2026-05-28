import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { z } from "zod";
import { ProductosPaths } from "./paths.js";

/**
 * Product Truth is structured documentation about what the product DOES.
 * It is the single artifact peter wants ProductOS to manage:
 *
 *   - It is version-controlled, diffable in PRs, reviewed alongside code
 *   - When designing a new feature, you consult this to understand the system
 *   - When shipping a feature, you update this in the same PR
 *   - It can be rendered as a viewable website (rendered dynamically, not committed)
 *
 * The artifact is a tree of markdown files under productos/products/:
 *   productos/products/<area>/<feature>.md
 *   productos/products/<area>/README.md      (area index)
 *   productos/products/README.md             (top-level overview)
 *
 * Each feature file has:
 *   - YAML frontmatter declaring structured behaviors (the atomic claims)
 *   - Markdown body for narrative prose, screenshots, caveats, UX notes
 */

export const BehaviorStatus = z.enum([
  "planned",     // intended, code not yet there
  "proposed",    // code exists, claim proposed, not yet verified
  "verified",    // human (or trusted policy) confirmed claim holds
  "stale",       // code referenced changed since last verification
  "contested",   // evidence contradicts the claim
  "deprecated",  // explicitly retired
]);
export type BehaviorStatus = z.infer<typeof BehaviorStatus>;

export const FeatureStatus = z.enum([
  "planned",
  "shipped",
  "deprecated",
]);
export type FeatureStatus = z.infer<typeof FeatureStatus>;

export const EvidenceKind = z.enum([
  "code",          // a file:lines reference into the codebase
  "response",      // a captured API response (path to JSON blob)
  "screenshot",    // a PNG capture of UI state
  "trace",         // a multi-step recording (Playwright trace, narrative, etc.)
  "narrative",     // free-form prose written by Claude or a human
  "test-result",   // a test pass/fail capture
  "query",         // a DB query + result
]);
export type EvidenceKind = z.infer<typeof EvidenceKind>;

export const Evidence = z.object({
  kind: EvidenceKind,
  ref: z.string().optional(),         // file:lines or external URL
  path: z.string().optional(),        // path to a blob inside productos/.local/blobs or productos/evidence
  captured_at: dateLike().optional(),
  captured_by: z.string().optional(),
  description: z.string().optional(),
  body: z.string().optional(),        // for narrative kind: the inline prose
});
export type Evidence = z.infer<typeof Evidence>;

export const Behavior = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "Behavior ids must be kebab-case"),
  claim: z.string().min(10),
  status: BehaviorStatus.default("proposed"),
  last_verified: dateLike().optional(),
  verified_by: z.string().optional(),
  evidence: z.array(Evidence).default([]),
  notes: z.string().optional(),
});
export type Behavior = z.infer<typeof Behavior>;

export const FeatureFrontmatter = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9/_-]*$/, "Feature ids are slash-delimited, kebab-case, e.g. auth/signup"),
  title: z.string(),
  status: FeatureStatus.default("shipped"),
  owners: z.array(z.string()).default([]),
  implements: z.array(z.string()).default([]),    // code paths the feature lives in
  related: z.array(z.string()).default([]),        // other feature ids
  behaviors: z.array(Behavior).default([]),
  proposed_by: z.string().optional(),
  proposed_at: dateLike().optional(),
});
export type FeatureFrontmatter = z.infer<typeof FeatureFrontmatter>;

export interface FeatureDocument {
  frontmatter: FeatureFrontmatter;
  body: string;
  filepath: string;          // absolute path to the .md file
  url_path: string;          // route like /auth/signup
}

export interface AreaDocument {
  slug: string;              // e.g. "auth"
  title: string;
  body: string;              // README.md content
  features: FeatureDocument[];
  filepath: string;
}

function dateLike() {
  return z.union([z.string(), z.date()]).transform((v) =>
    v instanceof Date ? v.toISOString() : v
  );
}

// ---------------------------------------------------------------------------
// Paths

export function productsRoot(paths: ProductosPaths): string {
  return path.join(paths.root, "products");
}

export function featureFilePath(paths: ProductosPaths, id: string): string {
  // id like "auth/signup" → productos/products/auth/signup.md
  return path.join(productsRoot(paths), `${id}.md`);
}

export function areaReadmePath(paths: ProductosPaths, area: string): string {
  return path.join(productsRoot(paths), area, "README.md");
}

export function topReadmePath(paths: ProductosPaths): string {
  return path.join(productsRoot(paths), "README.md");
}

export function ensureProductsDirs(paths: ProductosPaths): void {
  fs.mkdirSync(productsRoot(paths), { recursive: true });
}

// ---------------------------------------------------------------------------
// Read

export function readFeature(filepath: string): FeatureDocument {
  const raw = fs.readFileSync(filepath, "utf-8");
  const parsed = matter(raw);
  const frontmatter = FeatureFrontmatter.parse(parsed.data);
  const url_path = "/" + frontmatter.id;
  return { frontmatter, body: parsed.content.trim(), filepath, url_path };
}

export function readFeatureById(paths: ProductosPaths, id: string): FeatureDocument | null {
  const fp = featureFilePath(paths, id);
  if (!fs.existsSync(fp)) return null;
  return readFeature(fp);
}

/** Walk productos/products/ for all feature files (.md, excluding README.md). */
export function listFeatures(paths: ProductosPaths): FeatureDocument[] {
  const root = productsRoot(paths);
  if (!fs.existsSync(root)) return [];
  const out: FeatureDocument[] = [];
  walk(root, (file) => {
    if (!file.endsWith(".md")) return;
    if (path.basename(file).toLowerCase() === "readme.md") return;
    try {
      out.push(readFeature(file));
    } catch (e) {
      // Skip malformed files but warn on stderr.
      process.stderr.write(`productos: ${path.relative(paths.repoRoot, file)} failed to parse: ${(e as Error).message}\n`);
    }
  });
  out.sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));
  return out;
}

/** Walk productos/products/ for all areas (top-level directories). */
export function listAreas(paths: ProductosPaths): AreaDocument[] {
  const root = productsRoot(paths);
  if (!fs.existsSync(root)) return [];
  const features = listFeatures(paths);
  const byArea = new Map<string, FeatureDocument[]>();
  for (const f of features) {
    const area = f.frontmatter.id.split("/")[0]!;
    const arr = byArea.get(area) ?? [];
    arr.push(f);
    byArea.set(area, arr);
  }
  const out: AreaDocument[] = [];
  for (const slug of fs.readdirSync(root)) {
    const dir = path.join(root, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    const readme = areaReadmePath(paths, slug);
    let title = slug;
    let body = "";
    if (fs.existsSync(readme)) {
      const parsed = matter(fs.readFileSync(readme, "utf-8"));
      title = parsed.data.title ?? slug;
      body = parsed.content.trim();
    }
    out.push({
      slug,
      title,
      body,
      features: byArea.get(slug) ?? [],
      filepath: readme,
    });
  }
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}

// ---------------------------------------------------------------------------
// Write

export function writeFeature(paths: ProductosPaths, doc: FeatureDocument): void {
  const fp = featureFilePath(paths, doc.frontmatter.id);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const fm = YAML.stringify(doc.frontmatter, { lineWidth: 0, blockQuote: "literal" });
  const content = `---\n${fm}---\n\n${doc.body.trim()}\n`;
  fs.writeFileSync(fp, content, "utf-8");
}

export function writeAreaReadme(
  paths: ProductosPaths,
  area: string,
  title: string,
  body: string
): void {
  const fp = areaReadmePath(paths, area);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const fm = YAML.stringify({ title }, { lineWidth: 0 });
  fs.writeFileSync(fp, `---\n${fm}---\n\n${body.trim()}\n`, "utf-8");
}

// ---------------------------------------------------------------------------
// Helpers

function walk(dir: string, fn: (file: string) => void): void {
  for (const entry of fs.readdirSync(dir)) {
    const fp = path.join(dir, entry);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) walk(fp, fn);
    else fn(fp);
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
