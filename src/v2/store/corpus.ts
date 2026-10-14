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
/**
 * ⛔ AN IMPORT OVERWROTE EVERY DOCUMENT UNCONDITIONALLY, AND IT DESTROYED REAL WORK TWICE.
 *
 * This was `for (key of files) await store.put(key, …)` with no comparison of any kind. The hosted
 * page is now where somebody authors — dimensions, placements, containment, a note's reply — and
 * every one of those lands in the STORE. So a routine disk import, run after any local redraw,
 * silently replaced them with whatever the checkout happened to have.
 *
 * It cost a 55KB feature earlier in the day — 52 parts and 68 behaviours that existed only in the
 * store — recovered from a backup. Then it ate the dimensions Peter had just named on the page, and
 * his reply was *"not that important, i can add it back later"*, which is the generous reading of a
 * tool deleting his work without a word.
 *
 * ⛔ THE GUARD IS NOT "REFUSE IF THEY DIFFER". Every import after a redraw differs — that is what an
 * import IS — so that refuses everything and gets turned off within a day. The question is narrower:
 * does the STORE hold a page-authored change that the disk copy cannot know about?
 *
 * The log answers it with no new bookkeeping. A page write records `corpus-changed` with the
 * document it wrote, so: a document is AT RISK when its store copy differs from disk AND the log has
 * a page-authored write for it dated after the disk file was last written. Both facts are already
 * recorded; neither side has to remember an import happened.
 *
 * ⛔ AND IT REFUSES RATHER THAN MERGING. Merging two versions of product truth is a judgement about
 * which claim is right, and nothing here may make that. It names the documents, leaves them alone,
 * imports the rest, and `--anyway` is one flag away for somebody who knows the disk copy is the one
 * they want.
 */
export interface AtRisk {
  key: string;
  /** Who authored it on the page, and what they did — so the refusal says what it is protecting. */
  by: string;
  says: string;
  at: string;
}

export async function importFromDisk(
  store: ProjectStore,
  root: string,
  opts: { anyway?: boolean } = {},
): Promise<{ imported: string[]; kept: AtRisk[] }> {
  const files = corpusFiles(root);
  const already = await store.documents();

  /**
   * Page-authored writes, newest per document. ⛔ `wrote` NAMES THE DOCUMENT, because `ref` is a
   * product ref — a scope, a prototype id — and mapping one to a file would be a guess in the one
   * place a wrong answer deletes somebody's work.
   */
  const authored = new Map<string, AtRisk>();
  if (!opts.anyway) {
    let cursor = 0;
    for (;;) {
      const batch = await store.since(cursor, 500);
      if (!batch.length) break;
      for (const e of batch) {
        cursor = Math.max(cursor, e.seq);
        const p = (e.payload ?? {}) as { kind?: string; via?: string; wrote?: string; by?: string; says?: string; at?: string };
        if (p.kind !== "corpus-changed" || p.via !== "page" || !p.wrote) continue;
        authored.set(p.wrote, { key: p.wrote, by: p.by ?? "somebody", says: p.says ?? "changed it", at: p.at ?? "" });
      }
      if (batch.length < 500) break;
    }
  }

  const imported: string[] = [];
  const kept: AtRisk[] = [];
  for (const key of Object.keys(files).sort()) {
    const mine = files[key]!;
    const theirs = already[key];
    const risk = authored.get(key);
    /**
     * ⛔ ALL THREE CONDITIONS. Identical content is not a risk however it was authored; a document
     * nobody touched on the page is not a risk however much it differs; and a page write that
     * predates the disk file was already carried back, so overwriting it changes nothing.
     */
    if (risk && theirs !== undefined && theirs !== mine && newerThanFile(risk.at, path.join(root, key))) {
      kept.push(risk);
      continue;
    }
    await store.put(key, mine);
    imported.push(key);
  }
  return { imported, kept };
}

/** Whether a page write happened after the disk file was last written. */
function newerThanFile(at: string, file: string): boolean {
  const when = Date.parse(at);
  if (!when) return true; // ⛔ An undated write is treated as at risk: the safe direction is to keep it.
  try {
    return when > fs.statSync(file).mtimeMs;
  } catch {
    return true; // ⛔ No file on disk means disk cannot be the newer copy.
  }
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
