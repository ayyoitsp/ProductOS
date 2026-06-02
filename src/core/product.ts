import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { z } from "zod";
import { ProductosPaths } from "./paths.js";

/**
 * Product Truth lives in productos/products/<area>/<feature>.md.
 * It is implementation-neutral: claims are written in product language,
 * not in API/endpoint/file terms.
 *
 * Operational metadata (which files implement the feature, which code
 * lines back which behavior, who last verified what) lives in a sidecar
 * at productos/tracking/<area>/<feature>.yaml — see tracking.ts.
 *
 * The two files are linked by feature_id and behavior id. Together they
 * compose what an operator sees on the rendered site, but they are
 * editable independently:
 *
 *   - Product truth changes are documentation changes (PR reviewed for
 *     correctness of the claim).
 *   - Tracking changes are operational (verification stamps, code-ref
 *     refresh, history); high-traffic but lower-stakes.
 */

export const FeatureStatus = z.enum(["planned", "shipped", "deprecated"]);
export type FeatureStatus = z.infer<typeof FeatureStatus>;

export const TestCaseLevel = z.enum(["unit", "integration", "api", "e2e"]);
export type TestCaseLevel = z.infer<typeof TestCaseLevel>;

export const TestCase = z.object({
  id: z.number().int().positive(),
  description: z.string().min(3),
  given: z.string().optional(),
  when: z.string().optional(),
  then: z.string().optional(),
  steps: z.string().optional(),
  /** Which testing layer this case is best run at. Drives template choice in the scaffolder. */
  level: TestCaseLevel.optional(),
  /** Free-form hint about the harness shape (e.g. "supertest", "playwright-webServer"). */
  harness_hint: z.string().optional(),
  /** Pointer to an existing test that already covers this case (file path or file:line). Set by `productos test align`. */
  coverage_ref: z.string().optional(),
  deprecated: z.boolean().optional(),
  deprecated_reason: z.string().optional(),
  replaced_by: z.number().int().positive().optional(),
});
export type TestCase = z.infer<typeof TestCase>;

export const Behavior = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "Behavior ids must be kebab-case"),
  claim: z.string().min(10),
  notes: z.string().optional(),
  test_cases: z.array(TestCase).default([]),
  deprecated: z.boolean().optional(),
  deprecated_reason: z.string().optional(),
});
export type Behavior = z.infer<typeof Behavior>;

export const FeatureFrontmatter = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9/_-]*\/[a-z0-9][a-z0-9_-]*$/, "Must be area/slug"),
  title: z.string(),
  status: FeatureStatus.default("shipped"),
  description: z.string().optional(),
  behaviors: z.array(Behavior).default([]),
});
export type FeatureFrontmatter = z.infer<typeof FeatureFrontmatter>;

export interface FeatureDocument {
  frontmatter: FeatureFrontmatter;
  body: string;
  filepath: string;
  url_path: string;
}

export interface AreaDocument {
  slug: string;
  title: string;
  body: string;
  features: FeatureDocument[];
  filepath: string;
}

// ---------------------------------------------------------------------------
// Paths

export function productsRoot(paths: ProductosPaths): string {
  return path.join(paths.root, "products");
}

export function featureFilePath(paths: ProductosPaths, id: string): string {
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
  return {
    frontmatter,
    body: parsed.content.trim(),
    filepath,
    url_path: "/" + frontmatter.id,
  };
}

export function readFeatureById(paths: ProductosPaths, id: string): FeatureDocument | null {
  const fp = featureFilePath(paths, id);
  if (!fs.existsSync(fp)) return null;
  return readFeature(fp);
}

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
      process.stderr.write(`productos: ${path.relative(paths.repoRoot, file)} failed to parse: ${(e as Error).message}\n`);
    }
  });
  out.sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));
  return out;
}

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
  fs.writeFileSync(fp, `---\n${fm}---\n\n${doc.body.trim()}\n`, "utf-8");
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
