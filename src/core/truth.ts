import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import {
  TruthDocument,
  TruthFrontmatter,
  TruthStatus,
} from "./types.js";
import { ProductosPaths } from "./paths.js";
import { truthFilePath } from "./ids.js";

export function readTruth(paths: ProductosPaths, id: string): TruthDocument | null {
  const fp = truthFilePath(paths, id);
  if (!fs.existsSync(fp)) return null;
  return parseTruthFile(fp);
}

export function parseTruthFile(fp: string): TruthDocument {
  const raw = fs.readFileSync(fp, "utf-8");
  const parsed = matter(raw);
  const frontmatter = TruthFrontmatter.parse(parsed.data);
  return { frontmatter, body: parsed.content.trim() };
}

export function writeTruth(
  paths: ProductosPaths,
  doc: TruthDocument
): string {
  const fp = truthFilePath(paths, doc.frontmatter.id);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  // Use YAML directly (gray-matter's serializer mangles multiline strings).
  const yaml = YAML.stringify(doc.frontmatter, {
    lineWidth: 0,
    blockQuote: "literal",
  });
  const content = `---\n${yaml}---\n\n${doc.body.trim()}\n`;
  fs.writeFileSync(fp, content, "utf-8");
  return fp;
}

export function listTruth(
  paths: ProductosPaths,
  filter?: { status?: TruthStatus; feature?: string }
): TruthDocument[] {
  if (!fs.existsSync(paths.truthDir)) return [];
  const docs = fs
    .readdirSync(paths.truthDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parseTruthFile(path.join(paths.truthDir, f)));
  return docs.filter((d) => {
    if (filter?.status && d.frontmatter.status !== filter.status) return false;
    if (filter?.feature && d.frontmatter.scope?.feature !== filter.feature)
      return false;
    return true;
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}
