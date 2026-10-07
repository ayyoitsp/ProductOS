/**
 * Moving a corpus between a directory and the store, and reading one out of it.
 *
 * ⛔ THE PARSER IS NOT IN HERE. `loadFromStore` fetches bytes and hands them to `loadCorpus`
 * through `memoryStore` — the same path the remote client already takes. PT-0001 is emphatic that
 * the parser stays the only model: a store that parsed for itself would be a second implementation
 * of it, with its own refusals, and the two would disagree about what a corpus says while both
 * reported themselves healthy.
 *
 * ⛔ WHICH ALSO MAKES EXPORT EXACT BY CONSTRUCTION. A row holds the bytes it was given, so writing
 * every row's `source` to its `path` reproduces the corpus byte-for-byte. That is PT-0001's third
 * "done when" — asserted in `test/v2-store.test.mjs`, not hoped for.
 */
import fs from "node:fs";
import path from "node:path";
import { type Corpus, corpusFiles, loadCorpus, memoryStore } from "../load.js";
import type { ProjectStore, StoredEvent } from "./access.js";

/**
 * Read a whole corpus out of the store.
 *
 * `root` only labels the paths in `broken` messages and in `Corpus.paths` — ⛔ nothing in here
 * touches a filesystem, so it is a name rather than a location. Defaulting it to the project id
 * means a malformed document reports which project it came from, which is what somebody reading an
 * instance's logs actually needs.
 */
export async function loadFromStore(store: ProjectStore, root = store.projectId): Promise<Corpus> {
  const files = await store.documents();
  return loadCorpus(root, memoryStore(root, files));
}

/**
 * Put a directory's corpus into the store.
 *
 * ⛔ `corpusFiles` DECIDES WHAT A CORPUS IS MADE OF, NOT THIS FUNCTION. It is already the
 * counterpart of `memoryStore` and `load.ts` says they must stay that way — a directory this
 * enumerated for itself is a directory the store silently would not have.
 */
export async function importFromDisk(
  store: ProjectStore,
  root: string,
): Promise<{ imported: string[] }> {
  const files = corpusFiles(root);
  const imported: string[] = [];
  for (const key of Object.keys(files).sort()) {
    await store.put(key, files[key]!);
    imported.push(key);
  }
  return { imported };
}

/**
 * The event log, as the lines `readLog` already parses.
 *
 * ⛔ THE LOG IS NOT A CORPUS DOCUMENT, AND MUST NOT BECOME ONE. It is deliberately absent from
 * `CORPUS_DIRS`: a `documents` row would put it in markdown export and in a packet, and *what
 * changed, when, and who caused it* is not a claim about the product.
 * [`hosted-plan.md`](../../../planning/hosted-plan.md) §9 Q6 asks whether it belongs in the model;
 * the answer here is no, so it lives in its own table and is materialized separately.
 *
 * ⛔ AND IT IS ONE LOG, NOT TWO. `acts.ts` and `notes.ts` append to `events/log.jsonl` inside a
 * request. Before this existed, the directory was thrown away and every one of those appends went
 * with it — the inbox only still worked because `carryOpenNotesIntoTheLog` re-derives events for
 * open notes, which silently covered for a log that was being dropped on every call. Anything that
 * was not an open note — a press, a `question-answered`, a cursor that had to survive a request —
 * was simply lost.
 */
export const LOG_FILE = path.join("events", "log.jsonl");

/** Rows out of the table as log lines, in `seq` order. ⛔ `seq` IS the line position for `readLog`. */
export function logLines(events: StoredEvent[]): string {
  return events
    .slice()
    .sort((a, b) => a.seq - b.seq)
    .map((e) => JSON.stringify({ kind: e.kind, ...e.payload }))
    .join("\n")
    .concat(events.length ? "\n" : "");
}

/**
 * Presence, laid out where `presence.ts` already looks for it.
 *
 * ⛔ CARRIED BOTH WAYS, LIKE THE LOG AND FOR THE SAME REASON. The corpus a hosted request runs
 * against is a temp directory deleted when the request ends. `inbox` reports a claiming read by
 * writing this file, so without carrying it back out every heartbeat was written into a directory
 * that was then removed — and `/api/v2/presence`, whose entire job is to say somebody is listening,
 * answered that nobody was on every instance with a database behind it.
 *
 * ⛔ IT IS NOT A CORPUS DOCUMENT AND MUST NOT BECOME ONE. `.json`, outside `CORPUS_DIRS`: a
 * `documents` row would put a heartbeat in markdown export and in a packet. Same argument the log
 * already makes above.
 */
export const SESSIONS_FILE = path.join("events", "sessions.json");

/** What the store knows, laid out so `working()` finds it. */
export function writeSessions(root: string, who: Array<{ session: string; at: string }>): void {
  const target = path.join(root, SESSIONS_FILE);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(who, null, 2), "utf-8");
}

/** Whatever the request recorded. ⛔ Absent or unreadable is "nobody", never a throw mid-request. */
export function sessionsIn(root: string): Array<{ session: string; at: string }> {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, SESSIONS_FILE), "utf-8")) as Array<{ session: string; at: string }>;
    return Array.isArray(parsed) ? parsed.filter((w) => w && typeof w.session === "string" && typeof w.at === "string") : [];
  } catch {
    return [];
  }
}

/** Lay the log out beside the corpus so `readLog` finds it. */
export function writeLog(root: string, events: StoredEvent[]): number {
  const target = path.join(root, LOG_FILE);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, logLines(events), "utf-8");
  return events.length;
}

/**
 * Whatever the request appended beyond what it was given.
 *
 * ⛔ BY POSITION, NOT BY CONTENT. Two identical events are two events — a person pressing the same
 * button twice is two presses — so de-duplicating would quietly drop the second one.
 */
export function appendedLines(root: string, had: number): Array<Record<string, unknown>> {
  const file = path.join(root, LOG_FILE);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf-8").split("\n").filter((l) => l.trim());
  return lines.slice(had).map((line) => {
    try {
      return JSON.parse(line) as Record<string, unknown>;
    } catch {
      return { kind: "corpus-changed", at: "", by: "", ref: "", says: "an event that could not be read" };
    }
  });
}

/**
 * Write the store's corpus out as a directory.
 *
 * ⛔ WRITES `source` VERBATIM — no reformatting, no re-serialising from a parsed model. Round-trip
 * is only byte-identical if nothing on this path has an opinion about how a document should look.
 */
export async function exportToDisk(
  store: ProjectStore,
  root: string,
): Promise<{ written: string[] }> {
  const files = await store.documents();
  const written: string[] = [];
  for (const key of Object.keys(files).sort()) {
    const target = path.join(root, key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, files[key]!, "utf-8");
    written.push(key);
  }
  return { written };
}
