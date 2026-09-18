import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import crypto from "node:crypto";
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

/**
 * Per-section human validation for a context doc.
 *
 * ⛔ PER SECTION, never per file. Each `## heading` is independently citable
 * (`principles#numbers-feel-rewarding`), so accepting a whole file would bless
 * fifteen principles with one click — the bulk-accept failure that makes a
 * corpus worse than none, because every entry in it is then labelled reviewed.
 *
 * ⛔ Context needs this MORE than behaviors do, not less. A proposal
 * contradicting a principle is wrong before it is evaluated against anything
 * else, so context governs every behavior beneath it — and agents can write
 * context (`productos_propose_context`). Without a stamp here, an agent defines
 * the rules its own proposals are judged against.
 *
 * `hash` covers the section's text. Editing the wording silently drops the
 * validation, exactly as editing a claim does: you cannot validate a sentence
 * and then change the sentence.
 */
/**
 * YAML parses an unquoted ISO timestamp into a Date, so a stamp written by the
 * CLI comes back as a Date and a hand-written one comes back as a string.
 * Accept both and normalise — the same reason `tracking.ts` has this helper.
 */
function dateLike() {
  return z
    .union([z.string(), z.date()])
    .transform((v) => (v instanceof Date ? v.toISOString() : v));
}

export const ContextSectionMeta = z.object({
  verified: z.boolean().optional(),
  verified_by: z.string().optional(),
  verified_at: dateLike().optional(),
  /** Hash of the section text this stamp covered. */
  hash: z.string().optional(),
});
export type ContextSectionMeta = z.infer<typeof ContextSectionMeta>;

/**
 * Currency for a DECISION section — deliberately not validation.
 *
 * Per OVERVIEW: "Decisions carry no validation state — a decision isn't
 * falsifiable, it's a record of a choice." What changes is whether it still
 * GOVERNS. The record is immutable; the ruling is not.
 *
 * `revisit_after` exists because a decision from ten months ago encodes
 * ten-month-old constraints, and treating it as permanent converts an old
 * trade-off into an unexamined rule.
 */
export const DecisionSectionMeta = z.object({
  status: z.enum(["active", "under-review", "superseded"]).optional(),
  decided_at: dateLike().optional(),
  revisit_after: dateLike().optional(),
  /** Anchor of the decision that replaced this one. */
  superseded_by: z.string().optional(),
  /** Each time someone looked again and let it stand. */
  reaffirmed: z
    .array(z.object({ at: dateLike(), by: z.string().optional(), note: z.string().optional() }))
    .default([]),
});
export type DecisionSectionMeta = z.infer<typeof DecisionSectionMeta>;

export const ContextFrontmatter = z.object({
  title: z.string().optional(),
  order: z.number().optional(),
  /** Keyed by section anchor. Validation for most docs; currency for decisions. */
  sections: z.record(z.string(), ContextSectionMeta.and(DecisionSectionMeta)).default({}),
});
export type ContextFrontmatter = z.infer<typeof ContextFrontmatter>;

export interface ContextSection {
  /** Anchor slug, e.g. "numbers-feel-rewarding" — what a citation names. */
  anchor: string;
  title: string;
  /** The section's own text, excluding the heading. */
  text: string;
}

/** Same slug rule the renderer uses when it injects heading ids. */
export function sectionAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    // ⛔ The cap lives HERE and nowhere else. The renderer had its own copy of
    // this function with a cap and this one had none, so any heading over the
    // limit produced two different anchors: the page rendered one id and the
    // lookup asked for another. Nothing failed — the badge simply never
    // appeared, which is the worst way for an identity function to be wrong.
    .slice(0, 80);
}

/**
 * Split a context body into its `##` sections.
 *
 * Anything before the first `##` is preamble — guidance about how to fill the
 * file in — and is deliberately not a section: it is not citable and there is
 * nothing in it for a human to accept.
 */
export function parseSections(body: string): ContextSection[] {
  const out: ContextSection[] = [];
  const lines = body.split("\n");
  let current: ContextSection | null = null;
  // ⛔ Fenced blocks are not headings. A context doc that shows an example of
  // another context doc — or any markdown sample — contains `## ` lines that
  // are content, and treating them as sections invents citable anchors nobody
  // wrote and splits the real section they sit inside.
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      if (current) current.text += line + "\n";
      continue;
    }
    const m = inFence ? null : /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (current) out.push(current);
      const title = m[1]!;
      current = { anchor: sectionAnchor(title), title, text: "" };
    } else if (current) {
      current.text += line + "\n";
    }
  }
  if (current) out.push(current);
  return out.map((s) => ({ ...s, text: s.text.trim() }));
}

export function hashSection(text: string): string {
  return crypto.createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}

export type ContextSectionState = "unvalidated" | "validated" | "stale";

/**
 * Is this section human-accepted, and does the stamp still cover what it says?
 *
 * `stale` is an edit after acceptance — the wording changed under a stamp, so
 * the stamp no longer describes anything anyone read.
 */
export function contextSectionState(
  section: ContextSection,
  meta: ContextSectionMeta | undefined
): ContextSectionState {
  if (!meta?.verified) return "unvalidated";
  if (meta.hash && meta.hash !== hashSection(section.text)) return "stale";
  return "validated";
}

export type DecisionRuling = "active" | "under-review" | "superseded" | "due-for-review";

/** Does this decision still govern? Separate axis from validation. */
export function decisionRuling(
  meta: DecisionSectionMeta | undefined,
  today: string
): DecisionRuling {
  if (meta?.status === "superseded") return "superseded";
  if (meta?.status === "under-review") return "under-review";
  if (meta?.revisit_after && meta.revisit_after <= today) return "due-for-review";
  return "active";
}

export interface ContextDocument {
  /** Stem of the filename, e.g. "principles" from "principles.md". */
  name: string;
  /** Human-readable title; falls back to a capitalized name. */
  title: string;
  /** Lower = sorted earlier on the site/sidebar. */
  order: number;
  /** Markdown body (no frontmatter). */
  body: string;
  /** Per-section validation / currency registry, keyed by anchor. */
  sections: Record<string, ContextSectionMeta & DecisionSectionMeta>;
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

/**
 * Area-scoped context: `productos/products/<area>/context/*.md`.
 *
 * ⛔ Resolution is GLOBAL FIRST, THEN AREA — they are separate namespaces, not
 * an override chain. A global principle and an area principle with the same
 * name are two different rules, cited differently (`principles#x` vs
 * `pricing/principles#x`), because silently shadowing a product-wide rule with
 * an area-local one is how a rule stops applying without anyone deciding that.
 *
 * What actually needs to be area-scoped: principles and glossary, almost
 * always. Non-goals sometimes. Goals, personas and voice are what make
 * something a product rather than an area — allowed, expected to be empty.
 */
export function areaContextDir(paths: ProductosPaths, area: string): string {
  return path.join(paths.productsDir, area, "context");
}

export function listAreaContext(paths: ProductosPaths, area: string): ContextDocument[] {
  const dir = areaContextDir(paths, area);
  if (!fs.existsSync(dir)) return [];
  const out: ContextDocument[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".md")) continue;
    if (entry.toLowerCase() === "readme.md") continue;
    const doc = readContextFile(path.join(dir, entry), entry.replace(/\.md$/, ""));
    if (doc) out.push(doc);
  }
  return out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/**
 * A capability system's own vocabulary, at `capabilities/<system>/context/`.
 *
 * ⛔ Congruent to an area's, and it was the missing half. A reviewer working in the
 * subsystem with the densest private vocabulary on the site — `registry`, `build`,
 * `prepared model`, `binding`, `ladder`, `stamp`, `MemoSpec`, `connect time`, none
 * defined — found that product and area pages both carry a glossary and capability
 * system pages carry none:
 *
 *   "Since none of the three capability systems has one, I cannot tell whether the tool
 *    cannot hold it or whether all three authors skipped it. Either way, the subsystem
 *    with the densest private vocabulary on the site is the one with nowhere to define
 *    it."
 *
 * That ambiguity — tool cannot vs nobody did — is the thing the model is supposed to
 * keep separable, so the asymmetry cost twice.
 */
export function systemContextDir(paths: ProductosPaths, system: string): string {
  return path.join(paths.capabilitiesDir, system, "context");
}

export function listSystemContext(paths: ProductosPaths, system: string): ContextDocument[] {
  const dir = systemContextDir(paths, system);
  if (!fs.existsSync(dir)) return [];
  const out: ContextDocument[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".md")) continue;
    if (entry.toLowerCase() === "readme.md") continue;
    const doc = readContextFile(path.join(dir, entry), entry.replace(/\.md$/, ""));
    if (doc) out.push(doc);
  }
  return out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/**
 * Every citable context section in the corpus, keyed as a citation reads it:
 * `principles#x` globally, `pricing/principles#x` for an area.
 */
export function allContextSections(
  paths: ProductosPaths,
  areas: string[]
): Map<string, { section: ContextSection; doc: ContextDocument }> {
  const out = new Map<string, { section: ContextSection; doc: ContextDocument }>();
  const add = (prefix: string, docs: ContextDocument[]) => {
    for (const d of docs) {
      for (const s of parseSections(d.body)) {
        out.set(`${prefix}${d.name}#${s.anchor}`, { section: s, doc: d });
      }
    }
  };
  add("", listContext(paths));
  for (const a of areas) add(`${a}/`, listAreaContext(paths, a));
  // Capability systems cite as `capabilities/<system>/glossary#term`, so the key keeps
  // the tree prefix — a system and an area sharing a name are different namespaces.
  const capRoot = paths.capabilitiesDir;
  if (fs.existsSync(capRoot)) {
    for (const s of fs.readdirSync(capRoot)) {
      if (!fs.statSync(path.join(capRoot, s)).isDirectory()) continue;
      add(`capabilities/${s}/`, listSystemContext(paths, s));
    }
  }
  return out;
}

/** One reader for both trees — global and area context are the same shape. */
export function readContextFile(fp: string, name: string): ContextDocument | null {
  if (!fs.existsSync(fp)) return null;
  const parsed = matter(fs.readFileSync(fp, "utf-8"));
  const fm = ContextFrontmatter.parse(parsed.data);
  return {
    name,
    title: fm.title ?? capitalize(name.replace(/-/g, " ")),
    order: fm.order ?? 999,
    body: parsed.content.trim(),
    sections: fm.sections,
    filepath: fp,
  };
}

export function readContext(
  paths: ProductosPaths,
  name: string
): ContextDocument | null {
  return readContextFile(contextFilePath(paths, name), name);
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

/**
 * Rewrite only the `sections` registry, preserving title, order and body.
 *
 * Deliberately narrow: stamping acceptance must never be able to alter the
 * text that was accepted. A writer that round-tripped the whole document could
 * reformat the body in the same operation, leaving a stamp whose hash covers
 * something nobody read.
 */
export function writeContextSections(
  paths: ProductosPaths,
  name: string,
  sections: Record<string, unknown>
): string {
  const fp = contextFilePath(paths, name);
  const raw = fs.readFileSync(fp, "utf-8");
  const parsed = matter(raw);
  const fm: Record<string, unknown> = { ...parsed.data };
  if (Object.keys(sections).length > 0) fm.sections = sections;
  else delete fm.sections;
  const fmStr = `---\n${YAML.stringify(fm, { lineWidth: 0 })}---\n\n`;
  fs.writeFileSync(fp, `${fmStr}${parsed.content.trim()}\n`, "utf-8");
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
