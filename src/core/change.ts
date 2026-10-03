/**
 * ⛔ WHAT SOMEBODY SAID, AND WHETHER IT REACHED EVERY LAYER IT HAD TO.
 *
 * Peter: "i want to be able to have user changes cascade into all the different areas." And, after
 * the fourth time a piece of feedback was answered by editing the output: "what do we have to do so
 * that my feedback applies to the framework?"
 *
 * The answer is not another paragraph of instruction — there already was one, in bold, with the
 * exact grep to run, and it was read and violated anyway. Editing the output is always the shortest
 * path to making a complaint stop, and nothing failed when that path was taken.
 *
 * So a change is a record: the words verbatim, the kind of change they are, and the layers that
 * kind must reach. Each layer is then VERIFIED by running something — not by ticking a box — and
 * the change cannot be closed while one is unverified and unwaived.
 *
 * ⛔ THE WORDS ARE QUOTED, NEVER PARAPHRASED. A paraphrase is where the requirement quietly becomes
 * the thing that was convenient to build: "screens overall are very thin" summarised as "improve
 * the screens" loses the only part that was checkable.
 */
import fs from "node:fs";
import path from "node:path";
import { areaOf } from "./jobs.js";
import YAML from "yaml";
import { z } from "zod";
import { CASCADE, KINDS, LAYERS, type Layer } from "./jobs.js";

export const ChangeRecord = z
  .object({
    id: z.string().min(1),
    /** ⛔ Their words. Not a summary of them. */
    said: z.string().min(3),
    at: z.string().min(4),
    kind: z.enum(KINDS as [string, ...string[]]),
    /**
     * Per layer: what in the codebase is supposed to satisfy it. A name a verifier can look for —
     * a schema field, a finding kind, a test file, a command.
     */
    reaches: z.record(z.string(), z.string()).default({}),
    /**
     * ⛔ A WAIVED LAYER CARRIES ITS REASON. "Not applicable" with no argument is how a cascade
     * becomes a formality; the reason is what somebody can disagree with later.
     */
    waived: z.record(z.string(), z.string()).default({}),
    closed: z.string().optional(),
  })
  .strict();
export type ChangeRecord = z.infer<typeof ChangeRecord>;

export interface LayerVerdict {
  layer: Layer;
  /** What was supposed to satisfy it. */
  by?: string;
  ok: boolean;
  /** What was actually looked for, so a false pass is arguable. */
  how: string;
  waived?: string;
}

const dirOf = (root: string): string => path.join(root, "changes");
export const changeFile = (root: string, id: string): string => path.join(dirOf(root), `${id}.yaml`);

export function readChanges(root: string): ChangeRecord[] {
  const dir = dirOf(root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => ChangeRecord.parse(YAML.parse(fs.readFileSync(path.join(dir, f), "utf-8"))))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function writeChange(root: string, rec: ChangeRecord): string {
  const file = changeFile(root, rec.id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, YAML.stringify(rec, { lineWidth: 0 }));
  return file;
}

export function nextId(root: string): string {
  const seen = readChanges(root).map((c) => parseInt(c.id, 10)).filter((n) => !Number.isNaN(n));
  return String((seen.length ? Math.max(...seen) : 0) + 1).padStart(4, "0");
}

/**
 * ⛔ EVERY LAYER IS VERIFIED BY LOOKING, AND WHAT WAS LOOKED FOR IS REPORTED.
 *
 * A checkbox someone ticks is the thing this replaces. These are deliberately crude — a name
 * present in the right file — because a crude check that runs is worth more than a precise one
 * nobody can implement. Each verdict carries `how`, so a pass that is wrong can be argued with
 * rather than trusted.
 */
export function verify(root: string, rec: ChangeRecord): LayerVerdict[] {
  const required = CASCADE[rec.kind] ?? [];
  const read = (p: string): string => {
    const f = path.join(root, p);
    return fs.existsSync(f) ? fs.readFileSync(f, "utf-8") : "";
  };
  const anyUnder = (dir: string, needle: string): boolean => {
    const here = path.join(root, dir);
    if (!fs.existsSync(here)) return false;
    const walk = (d: string): boolean => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          if (walk(p)) return true;
          /**
           * ⛔ `.sh` AND `.yml` ARE HERE BECAUSE THE OPERATE LAYER IS. Its files are a Makefile, two
           * compose files and a shell script — restricting the walk to the three extensions the
           * framework itself is written in would have made every operations change unverifiable,
           * which is the hole that area was added to close.
           */
        } else if (/\.(ts|md|mjs|sh|yml|yaml)$/.test(e.name) && fs.readFileSync(p, "utf-8").includes(needle)) return true;
      }
      return false;
    };
    return walk(here);
  };

  return required.map((layer): LayerVerdict => {
    const by = rec.reaches[layer];
    const waived = rec.waived[layer];
    if (waived) return { layer, by, ok: true, how: "waived", waived };
    if (!by) return { layer, ok: false, how: `nothing named for ${layer}` };

    /**
     * ⛔ THE FILES COME FROM THE ARCHITECTURE MAP, NOT FROM A LIST HERE.
     *
     * These were hardcoded per layer, so a change that genuinely reached a layer through a NEW file
     * could not be verified: `routes.ts`, `propose.ts` and `spoken.ts` all landed in the generate
     * and derive layers and none of them was on any list. `close` refuses while a layer is
     * unreached, so the only way past it was to waive something that was actually done — which
     * turns the waiver from a decision into paperwork and empties it of meaning.
     *
     * `src/core/jobs.ts` already declares which files each layer owns, and a test fails when
     * AGENTS.md drifts from it. One home for that fact; this reads it.
     */
    const owned = (): string[] => {
      const area = areaOf(layer);
      return area?.files ?? [];
    };
    const inOwnedFiles = (): boolean => {
      for (const f of owned()) {
        const body = read(f);
        if (body && body.includes(by)) return true;
      }
      return false;
    };

    switch (layer) {
      case "instruct": {
        /**
         * ⛔ THE LAYER THAT GETS SKIPPED. A concept perfect in the schema that no future session
         * writes only ever appears where somebody typed it by hand. Four times.
         *
         * ⛔ AND THE DIRECTORIES COME FROM THE MAP, which the comment above already insisted on and
         * this case went on ignoring: it was hardcoded to `skills/`. When eight skills became one,
         * the authoring rules moved to the scoper in `agents/` — so from then on this looked for
         * the authoring instruction in the one place it is no longer kept, and the only way past
         * was to waive a layer that had actually been reached. A waiver is meant to be a decision
         * somebody could argue with; granting one for work that was done empties it everywhere.
         */
        const dirs = areaOf(layer)?.files ?? ["skills"];
        return {
          layer,
          by,
          ok: dirs.some((d) => anyUnder(d, by)),
          how: `"${by}" in ${dirs.map((d) => `${d}/`).join(" or ")}`,
        };
      }
      case "pin":
        return { layer, by, ok: anyUnder("test", by), how: `"${by}" in test/` };
      default: {
        /**
         * Every other layer is a set of source files, declared by the area that owns it. A directory
         * on the list is walked, so an area can name `src/v2/` and gain files without editing this.
         */
        const files = owned();
        if (!files.length) return { layer, by, ok: false, how: `no files declared for ${layer} in jobs.ts` };
        const hit =
          inOwnedFiles() ||
          files.some((f) => f.endsWith("/") && anyUnder(f.replace(/\/$/, ""), by));
        return { layer, by, ok: hit, how: `"${by}" in ${files.length === 1 ? files[0] : `the ${layer} files`}` };
      }
    }
  });
}

export const missing = (v: LayerVerdict[]): LayerVerdict[] => v.filter((x) => !x.ok);
export const allLayers = (): readonly Layer[] => LAYERS;
