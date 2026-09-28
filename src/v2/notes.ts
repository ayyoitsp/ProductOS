/**
 * ⛔ ONE PLACE A NOTE IS FILED, for the same reason there is one `perform`.
 *
 * Three callers file notes — the served page, the CLI, and whoever carries rows in from a
 * published page's database — and the last time three callers each did their own writing,
 * `gateFor` diverged from `check` by one clause and made two of five seed exchanges permanently
 * un-acceptable. The server used to assemble this YAML by hand.
 *
 * A note is NOT product truth and NOT a verdict: see the `Note` comment in `schema.ts`. Nothing
 * here touches `truth/`, `rules/` or `verdicts/`.
 */
import fs from "node:fs";
import path from "node:path";
import { Note, type Note as NoteT } from "./schema.js";
import type { Via } from "./acts.js";
import { loadCorpus } from "./load.js";
import { append } from "./log.js";

export interface Filed {
  ok: true;
  note: NoteT;
  said: string;
}
export interface NotFiled {
  ok: false;
  why: string;
  detail?: string[];
}

const fileOf = (dir: string): string => path.join(dir, "notes", "notes.yaml");

/** YAML for one note. Every string quoted — a `says` reading "Resolve an organization's stages" broke an attribute once already. */
const asYaml = (n: NoteT): string =>
  [
    `  - id: ${n.id}`,
    `    about: ${JSON.stringify(n.about)}`,
    `    says: ${JSON.stringify(n.says)}`,
    `    by: ${JSON.stringify(n.by)}`,
    `    at: ${n.at}`,
    `    via: ${n.via}`,
    `    state: ${n.state}`,
    ...(n.outcome ? [`    outcome: ${JSON.stringify(n.outcome)}`] : []),
    /**
     * ⛔ WRITTEN BACK, or a claim would survive exactly until the next thing rewrote this file —
     * which is a lease that silently stops existing at the moment a second session appears.
     */
    ...(n.claimed_by ? [`    claimed_by: ${JSON.stringify(n.claimed_by)}`] : []),
    ...(n.claimed_until ? [`    claimed_until: ${JSON.stringify(n.claimed_until)}`] : []),
  ].join("\n") + "\n";

export interface Filing {
  about: string;
  says: string;
  by: string;
  via: Via;
  /** The day it was asked for. Supplied by the caller because a carried-in row already has one. */
  at: string;
  /** The id from the row it was carried in under, so carrying the same row twice files one note. */
  id?: string;
}

/**
 * Append a request. Append-only, like the verdict log: a note is a record that somebody asked,
 * not a field that gets overwritten once somebody decides what to do about it.
 */
export function fileNote(dir: string, f: Filing): Filed | NotFiled {
  const says = f.says.trim();
  if (!says) return { ok: false, why: "an empty note is a click nobody can act on" };
  const id = f.id?.trim() || `n-${Math.abs(hash(`${f.about}|${says}|${f.by}|${f.at}`)).toString(36)}`;
  const candidate = {
    id,
    about: f.about.trim() || "the whole corpus",
    says,
    by: f.by.trim(),
    at: f.at,
    via: f.via,
    state: "open" as const,
  };
  const parsed = Note.safeParse(candidate);
  if (!parsed.success)
    return { ok: false, why: "that is not a note anybody could act on", detail: parsed.error.issues.map((i) => i.message) };

  /**
   * ⛔ Filing the same row twice would give one request two lives, and closing one of them would
   * leave the other open forever — so the second filing is a no-op that says so, rather than a
   * refusal the watcher would have to special-case.
   */
  const already = read(dir).find((n) => n.id === id);
  if (already) return { ok: true, note: already, said: `already filed against ${already.about}` };

  const file = fileOf(dir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "notes:\n";
  fs.writeFileSync(file, existing.trimEnd() + "\n" + asYaml(parsed.data));
  /**
   * ⛔ THE ONE EVENT THAT CARRIES WORK, and `work` is why: an inbox cursor must not advance past
   * this until somebody has authored the change and said what they did. Every other event is
   * information — the truth moved before it was written.
   */
  append(dir, {
    kind: "note",
    at: new Date().toISOString(),
    by: parsed.data.by,
    via: parsed.data.via,
    ref: parsed.data.about,
    says: `${parsed.data.by} asked for a change to ${parsed.data.about} — ${parsed.data.says}`,
    work: parsed.data.id,
  });
  return { ok: true, note: parsed.data, said: `noted against ${parsed.data.about}` };
}

/**
 * Close one, saying what was done.
 *
 * ⛔ `outcome` is required by the schema, and this is why: a closed note with no account of what
 * happened cannot be told apart from one somebody dropped because they did not fancy it. "The
 * truth was wrong and I fixed it" and "we are not doing this" are both fine; silence is not.
 */
export function closeNote(dir: string, id: string, outcome: string): Filed | NotFiled {
  const said = outcome.trim();
  if (said.length < 10)
    return { ok: false, why: "say what happened — a closed note with no account of it is indistinguishable from one that was dropped" };
  const notes = read(dir);
  const n = notes.find((x) => x.id === id);
  if (!n) return { ok: false, why: `no note "${id}"`, detail: notes.filter((x) => x.state === "open").map((x) => `${x.id} — ${x.about}`) };
  if (n.state === "done") return { ok: false, why: `${id} was already dealt with`, detail: [n.outcome ?? ""] };

  /**
   * ⛔ Rewritten in place, not appended. This is the one mutation notes allow, and it is the state
   * of a request rather than the record of it — the words the person wrote never change.
   */
  /**
   * ⛔ The claim goes with it. A done note holding a lease is a lease nothing will ever release,
   * and the next reader has to special-case "claimed, but finished" to know it is not work.
   */
  const closed = { ...n, state: "done" as const, outcome: said, claimed_by: undefined, claimed_until: undefined };
  const rest = notes.map((x) => (x.id === id ? closed : x));
  fs.writeFileSync(fileOf(dir), "notes:\n" + rest.map(asYaml).join(""));
  /**
   * ⛔ ANNOUNCED, because the person who asked is reading the page and has no other way to learn
   * that anything happened. A queue that empties silently is the one they stop trusting.
   */
  append(dir, {
    kind: "note-closed",
    at: new Date().toISOString(),
    by: n.by,
    ref: n.about,
    says: `${id} dealt with — ${said}`,
  });
  return { ok: true, note: closed, said: `${id} dealt with` };
}

/** Every note as it currently stands — the inbox needs the lease, not just the words. */
export const readNotes = (dir: string): NoteT[] => read(dir);

/**
 * Take a lease on a note, or say who already holds one.
 *
 * ⛔ CHECKED AND TAKEN IN ONE PLACE. Two sessions asking "is it free?" and then separately saying
 * "mine" is the race this exists to close; a caller that did its own check first would reintroduce
 * it however carefully the second half was written.
 *
 * ⛔ AN EXPIRED LEASE IS NOT A LEASE. Comparing against now rather than clearing expired claims on
 * a timer means nothing has to be running for a dead session's work to come back.
 */
export function claimNote(dir: string, id: string, by: string, until: string): { ok: true; note: NoteT } | { ok: false; heldBy: string; until: string } {
  const notes = read(dir);
  const n = notes.find((x) => x.id === id);
  if (!n) return { ok: false, heldBy: "", until: "" };
  if (n.claimed_by && n.claimed_by !== by && n.claimed_until && n.claimed_until > new Date().toISOString())
    return { ok: false, heldBy: n.claimed_by, until: n.claimed_until };
  const held = { ...n, claimed_by: by, claimed_until: until };
  fs.writeFileSync(fileOf(dir), "notes:\n" + notes.map((x) => (x.id === id ? held : x)).map(asYaml).join(""));
  return { ok: true, note: held };
}

/** Hand a note back without closing it — the session is stopping, and somebody else may as well go. */
export function releaseNote(dir: string, id: string): void {
  const notes = read(dir);
  if (!notes.some((x) => x.id === id)) return;
  fs.writeFileSync(
    fileOf(dir),
    "notes:\n" + notes.map((x) => (x.id === id ? { ...x, claimed_by: undefined, claimed_until: undefined } : x)).map(asYaml).join("")
  );
}

/** Whether a note is being worked on right now, by somebody other than the asker. */
export const heldNow = (n: NoteT, now = new Date().toISOString()): boolean =>
  Boolean(n.claimed_by && n.claimed_until && n.claimed_until > now);

const read = (dir: string): NoteT[] => (fs.existsSync(fileOf(dir)) ? loadCorpus(dir).notes : []);

/** Stable id from content, so carrying the same press in twice is idempotent without a clock. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
