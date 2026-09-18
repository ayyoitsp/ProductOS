import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { ProductosPaths } from "./paths.js";
import { FeatureDocument, isUndefinedBehavior } from "./product.js";

/**
 * Framework gaps — TODOs addressed to ProductOS's developers, not to the user.
 *
 * ⛔ THIS IS A DIFFERENT AUDIENCE FROM EVERY OTHER SIGNAL IN THE SYSTEM.
 *
 *   An audit finding says   "your corpus has a mistake" → the author fixes it.
 *   A framework gap says    "the framework has no way to say this" → WE fix it.
 *
 * The distinction is computable, and getting it wrong in either direction is
 * costly. Reporting a framework gap as an author mistake sends someone to
 * rearrange a corpus that has no correct arrangement. Reporting an author
 * mistake as a framework gap buries a real fix in our backlog.
 *
 * ⛔ WHY THIS EXISTS AT ALL, stated plainly because the lesson was expensive:
 *
 * The skills have always said "don't paper over ambiguity" and "don't pick
 * silently — surface ambiguity". In one session an agent violated that seven
 * times, each time by forcing content into the nearest category and moving on:
 * open questions became a parallel list, promise-vs-screen became a table of
 * filenames in prose, area-scoped rules went into a product-wide file,
 * provenance went into a README, and behaviors about an unscoped screen were
 * filed on a capability.
 *
 * Every one of those was a framework gap. Every one was hand-patched, and the
 * hand-patch destroyed the evidence that the framework was deficient — so the
 * same gap was rediscovered from scratch the next time.
 *
 * Prose could not prevent this; it is STRATEGY.md principle 3 exactly. An
 * agent can ignore an instruction, so the forced fit has to be DETECTED rather
 * than discouraged.
 */

function dateLike() {
  return z
    .union([z.string(), z.date()])
    .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v));
}

/** How the gap was found. `authored` = an agent or human hit it and said so. */
export const GapDetector = z.enum([
  /** A capability behavior demonstrable only through a screen. */
  "screen-behavior-on-capability",
  /** A behavior anchors to a surface no container declares. */
  "orphan-surface",
  /** Recorded deliberately: nothing in the model can express this. */
  "authored",
]);
export type GapDetector = z.infer<typeof GapDetector>;

export const FrameworkGap = z.object({
  id: z.string(),
  detected_at: dateLike(),
  detector: GapDetector,
  /** What the framework cannot express, in one or two sentences. */
  what: z.string().min(10),
  /** The decision we owe: what should the model do here? */
  question: z.string().optional(),
  /** Container or behavior ids that demonstrate the gap. */
  evidence: z.array(z.string()).default([]),
  /**
   * Where the content ended up because there was nowhere correct.
   *
   * The most valuable field: it names the compromise, so the corpus can be
   * corrected in one pass once the gap is closed — instead of the compromise
   * quietly becoming the convention.
   */
  forced_into: z.string().optional(),
  status: z.enum(["open", "accepted", "closed", "wont-fix"]).default("open"),
  /** Set when closed — what changed in ProductOS. */
  resolution: z.string().optional(),
});
export type FrameworkGap = z.infer<typeof FrameworkGap>;

const GapFile = z.object({
  version: z.number().default(1),
  gaps: z.array(FrameworkGap).default([]),
});

export function gapsFilePath(paths: ProductosPaths): string {
  return path.join(paths.root, "framework-gaps.yaml");
}

export function readFrameworkGaps(paths: ProductosPaths): FrameworkGap[] {
  const fp = gapsFilePath(paths);
  if (!fs.existsSync(fp)) return [];
  try {
    return GapFile.parse(YAML.parse(fs.readFileSync(fp, "utf-8")) ?? {}).gaps;
  } catch (e) {
    process.stderr.write(`productos: framework-gaps.yaml failed to parse: ${(e as Error).message}\n`);
    return [];
  }
}

/**
 * Append a gap, keyed by (detector, evidence) so re-running a detector does not
 * pile up duplicates. Never rewrites an existing entry's `status` — once a
 * human has triaged a gap, a detector must not un-triage it.
 */
export function recordFrameworkGap(paths: ProductosPaths, gap: Omit<FrameworkGap, "id" | "status"> & { status?: FrameworkGap["status"] }): FrameworkGap | null {
  const existing = readFrameworkGaps(paths);
  // ⛔ `what` is part of the key. Keying on (detector, evidence) alone collapsed
  // every hand-authored gap into one entry, because authored gaps routinely
  // carry no evidence ids — so the second one recorded silently became a
  // duplicate of the first and was dropped.
  const key = (g: { detector: string; evidence: string[]; what: string }) =>
    `${g.detector}::${[...g.evidence].sort().join(",")}::${g.what.trim().slice(0, 120)}`;
  if (existing.some((g) => key(g) === key(gap as never))) return null;

  const next: FrameworkGap = FrameworkGap.parse({
    ...gap,
    id: `fg-${String(existing.length + 1).padStart(4, "0")}`,
    status: gap.status ?? "open",
  });
  const all = [...existing, next];
  fs.mkdirSync(path.dirname(gapsFilePath(paths)), { recursive: true });
  fs.writeFileSync(
    gapsFilePath(paths),
    "# Framework gaps — TODOs for ProductOS's developers, not for this product.\n" +
      "# Each entry is something the model cannot currently express. `forced_into`\n" +
      "# names where the content had to go meanwhile, so the corpus can be corrected\n" +
      "# in one pass once the gap closes.\n" +
      YAML.stringify({ version: 1, gaps: all }, { lineWidth: 90 }),
    "utf-8"
  );
  return next;
}

/**
 * Detect forced fits across the corpus.
 *
 * ⛔ Each detector must decide: can the framework express this correctly today?
 *
 *   YES → not a framework gap. It is an author mistake, and it belongs in the
 *         audit where the author will see it.
 *   NO  → a framework gap, because no rearrangement of the corpus fixes it.
 */
export function detectFrameworkGaps(containers: FeatureDocument[]): Array<Omit<FrameworkGap, "id" | "status">> {
  const out: Array<Omit<FrameworkGap, "id" | "status">> = [];
  const today = new Date().toISOString().slice(0, 10);

  // Every surface any container declares, and who declares it.
  const surfaceOwner = new Map<string, string>();
  for (const c of containers) {
    for (const u of c.frontmatter.ux ?? []) {
      if (!surfaceOwner.has(u.id)) surfaceOwner.set(u.id, c.frontmatter.id);
    }
  }

  for (const c of containers) {
    const fm = c.frontmatter;

    // ---- A screen-shaped behavior sitting on a capability ----
    //
    // A capability has no screens, so a behavior only demonstrable via one is
    // in the wrong place. Whether that is OUR bug or the AUTHOR'S depends
    // entirely on whether a home exists: if some feature declares a surface,
    // the author can move it; if nothing does, the surface itself is unscoped
    // and there is nowhere to move it to.
    if (fm.kind === "capability") {
      const screenish = fm.behaviors.filter(
        (b) =>
          !b.deprecated &&
          !isUndefinedBehavior(b) &&
          b.test_cases.some((tc) => !tc.deprecated && tc.level === "e2e")
      );
      if (screenish.length > 0) {
        // ⛔ Reported WITHOUT trying to compute the right home. Which feature
        // should own a screen-shaped claim is product judgment — the tool
        // cannot know, and an earlier version of this detector tried to guess
        // and consequently never fired on the real case. A non-clean fit is
        // reported as a non-clean fit; deciding where it goes is what the TODO
        // is for.
        out.push({
          detected_at: today,
          detector: "screen-behavior-on-capability",
          what:
            `${fm.id} is a capability, which has no screens, yet ${screenish.length} of its ` +
            `behaviors can only be demonstrated through one. Either they belong to a feature ` +
            `that owns that screen, or the screen has never been scoped.`,
          question:
            "Which container owns these, and should a capability be refused screen-level " +
            "evidence outright — or is there a third kind of container here?",
          evidence: screenish.map((b) => `${fm.id}#${b.id}`),
          forced_into: fm.id,
        });
      }
    }

    // ---- A behavior anchored to a surface nobody declares ----
    //
    // Distinct from the audit's `dangling-surface-anchor`: that one fires when
    // the anchor is wrong within a container that HAS surfaces. This fires when
    // the surface exists in the product and no container has scoped it, which
    // no amount of corpus editing fixes.
    for (const b of fm.behaviors) {
      if (b.deprecated || !b.surface) continue;
      const declaredHere = (fm.ux ?? []).some((u) => u.id === b.surface);
      if (declaredHere || surfaceOwner.has(b.surface)) continue;
      out.push({
        detected_at: today,
        detector: "orphan-surface",
        what:
          `${fm.id}#${b.id} anchors to surface "${b.surface}", which no container in the ` +
          `corpus declares. The screen exists in the product but has never been scoped.`,
        question:
          "Which container should own a surface that is real but unscoped, and should " +
          "anchoring to it be blocked until it is?",
        evidence: [`${fm.id}#${b.id}`],
        forced_into: fm.id,
      });
    }
  }

  return out;
}

/**
 * Open gaps whose named field has since shipped.
 *
 * ⛔ THE RECORD OF WHAT THE MODEL CANNOT EXPRESS ROTS, and nothing noticed. An architect
 * reviewing the framework counted it: **five of fifteen open gaps named fields that were
 * already in the schema.** The cost runs in the direction that matters — a shipped
 * capability reported as missing, so the corpus keeps working around a hole that closed,
 * and `forced_into` keeps licensing a compromise nobody needs any more.
 *
 * This is the framework's own rule — don't restate lifecycle in prose, it rots silently —
 * applied to the framework's own backlog. Which is exactly where it was not applied.
 *
 * A heuristic on purpose: it matches a gap's text against field names that now exist and
 * reports a candidate. It cannot know whether the field actually answers the question —
 * a gap about non-functional requirements mentions `holds_for` in passing and is genuinely
 * still open — so it proposes and never closes.
 */
export function gapsWhoseFieldShipped(
  gaps: FrameworkGap[],
  schemaSource: string
): Array<{ gap: FrameworkGap; fields: string[] }> {
  const shipped = [
    ...schemaSource.matchAll(/^\s{2}([a-z_]+):\s*z\./gm),
  ].map((m) => m[1]!);
  const out: Array<{ gap: FrameworkGap; fields: string[] }> = [];
  for (const gap of gaps) {
    if (gap.status !== "open") continue;
    const text = `${gap.what} ${gap.question ?? ""}`;
    // Only a backtick-quoted field name counts. Prose mentioning the word "blocks" is
    // not a claim about the field, and matching it would flag half the log.
    const named = [...text.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]!);
    const hits = [...new Set(named.filter((n) => shipped.includes(n)))];
    if (hits.length) out.push({ gap, fields: hits });
  }
  return out;
}
