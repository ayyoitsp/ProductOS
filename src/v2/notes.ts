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
  const closed = { ...n, state: "done" as const, outcome: said };
  const rest = notes.map((x) => (x.id === id ? closed : x));
  fs.writeFileSync(fileOf(dir), "notes:\n" + rest.map(asYaml).join(""));
  return { ok: true, note: closed, said: `${id} dealt with` };
}

const read = (dir: string): NoteT[] => (fs.existsSync(fileOf(dir)) ? loadCorpus(dir).notes : []);

/** Stable id from content, so carrying the same press in twice is idempotent without a clock. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
