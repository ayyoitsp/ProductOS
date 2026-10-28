import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { ProductosPaths } from "./paths.js";

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
  /**
   * ⛔ WHAT SOMEBODY CANNOT DO, IN PRODUCT TERMS — AND IT IS REQUIRED BECAUSE THE LIST WENT STALE.
   *
   * Peter, reading his own backlog: *"i really don't understand what fg-0001 is, wtf are these
   * descriptions?"* and *"tell me the actual IMPACT, not a wordy thing about holding slots.. none of
   * that makes sense"*.
   *
   * ⛔ THE WORDING WAS NOT THE REAL COST. `what` is written by the author who hit the gap, in the
   * vocabulary of the layer they were standing in — "a slot holds one standing", "`of:` names one
   * existing statement". That is accurate and it is unreadable, and unreadable has a consequence:
   * re-reading four records to ask "is this still true?" costs enough that nobody does it. So on the
   * day this field was added, **two of four gaps were already fixed and still read `open`** — fg-0001
   * closed by the `adds a statement` work and fg-0004 by `blocks` on an existing question, both
   * earlier in the same session that recorded them.
   *
   * A backlog where half the entries are false is worse than no backlog: it agrees with whatever
   * was believed when it was written, which is the same failure as a count that measures the wrong
   * thing and confirms the hypothesis.
   *
   * ⛔ SO THIS FIELD IS WRITTEN FOR SOMEBODY WHO DID NOT HIT THE GAP. It names the act a person
   * cannot perform and what they do instead — "you get asked about one sentence at a time, so a slot
   * saying eleven things takes eleven round trips". That sentence can be CHECKED by trying it, which
   * is what makes a stale record findable. `what` cannot: verifying it means reading the source.
   */
  /**
   * ⛔ OPTIONAL HERE AND REQUIRED BY `todo add`, WHICH IS THE PROJECT'S OWN RULE FOR THIS LAYER:
   * the `model` area may never *"make a field required on the day it lands — a schema change nobody
   * can adopt gets reverted"*.
   *
   * ⛔ AND THE REASON IS NOT POLITENESS TO OUR OWN FOUR RECORDS. Every CONSUMER repo has its own
   * `productos/framework-gaps.yaml`. Required, this field stops those files PARSING — measured by
   * making it required and watching `todo` die on the one record I could see:
   * `framework-gaps.yaml failed to parse: expected string, received undefined`. The four I can
   * backfill are not the population; the ones I cannot reach are.
   */
  costs: z.string().min(10).optional(),
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
  writeGaps(paths, [...existing, next]);
  return next;
}

function writeGaps(paths: ProductosPaths, all: FrameworkGap[]): void {
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
}

/**
 * Settle a gap: closed, accepted or won't-fix, with a reason.
 *
 * ⛔ THERE WAS NO COMMAND FOR THIS, SO THE ONLY WAY TO CLOSE A GAP WAS TO HAND-EDIT THE
 * FILE — and the first thing that went wrong was exactly what you would predict. Nine gaps
 * were closed in one session and the tenth, whose fix had just shipped and been verified in
 * `main`, was left `open` and then REPORTED as closed. Peter asked "any other framework
 * gaps?" and the honest answer was six, not five, because of a step with no forcing
 * function behind it.
 *
 * Hand-editing also broke this file twice in one session — a duplicate YAML key, after
 * which `todo` printed "No open framework gaps". The worst possible failure for the record
 * of what the model cannot express: it reads as a finished backlog.
 *
 * ⛔ A RESOLUTION IS REQUIRED, and the reason is the one the rest of this repo gives for
 * every refusal: a gap closed with no account of how leaves the next session unable to tell
 * a gap that was FIXED from a gap somebody stopped caring about — and `forced_into` is
 * still sitting in a corpus licensing the compromise either way.
 */
export function settleFrameworkGap(
  paths: ProductosPaths,
  id: string,
  status: Extract<FrameworkGap["status"], "closed" | "accepted" | "wont-fix">,
  resolution: string
): FrameworkGap {
  const all = readFrameworkGaps(paths);
  const gap = all.find((g) => g.id === id);
  if (!gap) {
    throw new Error(
      `no framework gap ${id}. Open gaps: ${all.filter((g) => g.status === "open").map((g) => g.id).join(", ") || "none"}`
    );
  }
  if (!resolution.trim()) throw new Error(`closing ${id} needs a resolution — what changed, or why it is not a gap`);
  const settled = FrameworkGap.parse({ ...gap, status, resolution: resolution.trim() });
  writeGaps(
    paths,
    all.map((g) => (g.id === id ? settled : g))
  );
  return settled;
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
/**
 * Every field name a schema source declares.
 *
 * ⛔ THE PREVIOUS PATTERN FOUND 37 OF THE 146 FIELDS IN `v2/schema.ts`, AND THE ANSWER IT
 * GAVE WAS ZERO EITHER WAY — the shape CLAUDE.md warns about, in the one mechanism built
 * to stop this record rotting. Two reasons, both measured rather than reasoned about:
 *
 *   · it required EXACTLY two spaces of indentation, so every field nested inside another
 *     object was invisible — 37 of 146
 *   · it required `z.` on the same line as the name, so a field whose chain is wrapped by
 *     the formatter is invisible. `rests_on: z` + newline + `.array(…)` is how the field
 *     this was found by is actually written, and `set_by` too
 *
 * Both are formatting, which is the worst thing for a detector to depend on: the field is
 * declared, shipped and tested, and whether this notices turns on where a line broke.
 */
export function shippedFields(schemaSource: string): string[] {
  return [
    ...new Set(
      [...schemaSource.matchAll(/^\s+([a-z_][a-z0-9_]*):\s*z\b/gm)].map((m) => m[1]!)
    ),
  ];
}

export function gapsWhoseFieldShipped(
  gaps: FrameworkGap[],
  schemaSource: string
): Array<{ gap: FrameworkGap; fields: string[] }> {
  const shipped = shippedFields(schemaSource);
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
