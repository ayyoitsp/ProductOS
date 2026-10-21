/**
 * ⛔ ONE LOG, TWO READERS. The page reads it as a stream; a session reads it as an inbox.
 *
 * Peter: "we're designing for the ideal scenario. we can do whatever we want. let's go hosted
 * first. mcp main interface, a loop back path that claude sessions will poll from for now."
 *
 * The property the hosted design rests on is that neither client owns anything — the page does not
 * hold state the session cannot see, and the session does not hold a directory the page cannot see.
 * Every seam this repo has hit came from two surfaces each believing they held the truth, so there
 * is exactly one record of *what happened*, and both sides are readers of it.
 *
 * ⛔ WHAT THIS IS NOT. It is not product truth and it is not a verdict. A verdict says *a person
 * judged this*; an event says *this happened, at this moment, and somebody may owe work because of
 * it*. Filed as a verdict an event would read as agreement; filed as truth it would ship in a
 * packet. It is infrastructure, and whether it should be more than that is an open question in the
 * plan rather than something decided here.
 *
 * ⛔ SEQ IS THE LINE NUMBER, NOT A STORED FIELD — and that is load-bearing, not a shortcut. Two
 * processes appending at once would otherwise have to agree on a counter, which means reading the
 * file to write to it, which is the race. An append that does not need to know how many events
 * precede it cannot lose to one that lands at the same moment.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * ⛔ WHAT A SESSION OWES EACH ONE IS THE REASON THESE ARE SEPARATE KINDS.
 *
 * A note is the only event that carries work, and conflating it with the rest is how "I saw your
 * feedback" comes to mean "your feedback happened". The others are information: the truth has
 * already moved by the time they are written, and a session that reads them owes nothing but to
 * know.
 */
export const EVENT_KINDS = [
  /** A human judged something. The truth already moved; there is nothing to do. */
  "press",
  /** A question nobody had answered now has a ruling. Worth looking at what it unblocks. */
  "question-answered",
  /** Somebody asked for a change. ⛔ The only kind that carries work. */
  "note",
  /** A note was dealt with, and what was done about it. */
  "note-closed",
  /** Truth moved underneath — another session, a migration, CI. Reload before authoring. */
  "corpus-changed",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface LoggedEvent {
  /** 1-based position in the log. Derived on read; never stored. */
  seq: number;
  kind: EventKind;
  /** The instant, not the day. A cursor over day-resolution timestamps cannot order a burst. */
  at: string;
  by: string;
  /** How the thing that caused this was obtained, when that is a meaningful question. */
  via?: string;
  /** What it is about: a ref, a scope, a note id. */
  ref: string;
  /**
   * ⛔ THE DOCUMENT A PAGE WRITE CHANGED, and it is not `ref`.
   *
   * `ref` is a PRODUCT reference — a scope, a prototype id, a statement — which is the right thing
   * for a reader and useless to anything that has to decide whether a file may be overwritten. An
   * import that mapped one to the other would be guessing in the one place a wrong answer deletes
   * somebody's work: a disk import overwrote every document unconditionally and destroyed a 55KB
   * feature and then a set of dimensions somebody had just named on the page.
   *
   * So a write that moves a corpus document says which one, and the importer keeps those.
   */
  wrote?: string;
  /** One line a person can read, in the tense of the thing that happened. */
  says: string;
  /**
   * ⛔ THE FIELD THAT MAKES "CARRIES WORK" DATA RATHER THAN A SPECIAL CASE IN EVERY READER.
   *
   * The id of the thing that must be finished before a cursor may advance past this event. Only a
   * note has one. A reader that had to ask "is this kind the one with work in it" would answer it
   * differently in each of the three places that ask.
   */
  work?: string;
}

/** What `append` is handed. Everything except the position, which the file decides. */
export type NewEvent = Omit<LoggedEvent, "seq">;

const fileOf = (dir: string): string => path.join(dir, "events", "log.jsonl");

/**
 * Append one event. Never fails the caller: a write that could refuse would make the log a gate on
 * recording truth, and the act it is describing has already happened by the time we are here.
 */
export function append(dir: string, e: NewEvent): void {
  const file = fileOf(dir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // One line, one write — so a concurrent append interleaves between lines and never inside one.
  fs.appendFileSync(file, JSON.stringify({ ...e, says: flat(e.says) }) + "\n");
}

/** Every event, in order, numbered by position. */
export function readLog(dir: string): LoggedEvent[] {
  const file = fileOf(dir);
  if (!fs.existsSync(file)) return [];
  const out: LoggedEvent[] = [];
  let seq = 0;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    seq++;
    try {
      const parsed = JSON.parse(line) as NewEvent;
      out.push({ ...parsed, seq });
    } catch {
      /**
       * ⛔ A TORN LINE STILL COUNTS. Skipping it without consuming a position would renumber every
       * event after it, and a cursor held by a session that read the file a moment earlier would
       * then point at something else entirely.
       */
      out.push({ seq, kind: "corpus-changed", at: "", by: "", ref: "", says: "an event that could not be read" });
    }
  }
  return out;
}

/** The last position in the log, which is what a reader that wants only new events starts from. */
export const head = (dir: string): number => readLog(dir).length;

const flat = (s: string): string => s.replace(/\s+/g, " ").trim();

/** One line per event, for a terminal and for the page's stream — so the two cannot disagree. */
export function lineFor(e: LoggedEvent): string {
  const tag = e.kind === "note" ? "NOTE " : e.kind === "note-closed" ? "DONE " : e.kind === "corpus-changed" ? "MOVED" : "ACT  ";
  const via = e.via ? ` via ${e.via}` : "";
  return `${tag} ${e.says}${via}`;
}

/**
 * Tail the log. ⛔ THE SHAPE BOTH READERS USE — the page's stream and a terminal watcher are the
 * same call with a different `emit`, so the two can never disagree about what happened.
 *
 * It blocks on the filesystem rather than polling a model: no cost at all until something is
 * appended, and then one announcement carrying the event.
 */
export function watchLog(
  dir: string,
  opts: { emit: (e: LoggedEvent) => void; from?: number }
): { stop: () => void } {
  const file = fileOf(dir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  /** Default: only what happens NEXT. Replaying history on connect floods a reader with last week. */
  let at = opts.from ?? readLog(dir).length;

  const sweep = (): void => {
    const all = readLog(dir);
    for (const e of all) if (e.seq > at) opts.emit(e);
    if (all.length > at) at = all.length;
  };

  let timer: NodeJS.Timeout | undefined;
  const bump = (): void => {
    if (timer) clearTimeout(timer);
    // ⛔ A settle window, so a burst of appends is one sweep rather than one per line.
    timer = setTimeout(sweep, 60);
  };

  /**
   * ⛔ THE FILE, NOT ITS DIRECTORY — AND THE DIRECTORY WATCH REPORTED NOTHING AT ALL ON macOS.
   *
   * Measured, because this had been "the mechanism" for months and was not one:
   *
   *     platform              darwin
   *     append → dir watch    0 events
   *     append → file watch   1 event
   *     new file → dir watch  0 events     <- it failed at its own stated purpose too
   *
   * So on every Mac the only thing that ever fired was the interval below, which was 30 seconds.
   * "A change made anywhere reaches a page somebody has open" meant up to half a minute — on the
   * surface whose whole design rests on the page updating itself, and on the machine everybody
   * develops against.
   *
   * ⛔ AND THE TEST FOR IT WAS HANGING RATHER THAN FAILING, which is why nobody knew. `v2-live` tore
   * down its SSE request and its server on the LAST LINE OF THE BODY, so the failed assertion
   * skipped both and the process hung with the event loop held open — reporting nothing at all
   * through a gate that captures output. Fixing the teardown is what made this visible.
   *
   * ⛔ THE FILE IS CREATED SO IT CAN BE WATCHED. `fs.watch` throws on a path that does not exist,
   * and the log does not exist until something is recorded — which is exactly when a reader is
   * waiting. An empty file is what `readLog` already returns `[]` for, so nothing downstream can
   * tell the difference.
   */
  let watcher: fs.FSWatcher | undefined;
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, "");
    watcher = fs.watch(file, { persistent: true }, bump);
  } catch {
    // Some filesystems cannot watch at all. The interval below is then the whole mechanism.
  }
  /**
   * ⛔ A BACKSTOP THAT IS ACTUALLY A BACKSTOP — 30 SECONDS WAS A SECOND BUG HIDING BEHIND THE FIRST.
   *
   * The reasoning for a long period was sound when the watch was believed to work: fs.watch misses
   * events over some network and container filesystems, and a reader that has silently stopped
   * noticing is worse than one that never started, because it looks up to date. But a period only
   * has to be slow enough not to matter and fast enough to be a floor rather than the answer.
   *
   * ⛔ AND AN APPEND-ONLY LOG CAN STILL BREAK A FILE WATCH. `v2-watch` records that these logs are
   * "rewritten wholesale on a close" — a rewrite-and-rename replaces the inode the watch holds, and
   * the handle then watches a file nobody writes to again. That case is real, silent, and exactly
   * what this interval is for, so it must be short enough that a reader notices within a second
   * rather than within a minute.
   *
   * One read of a small file per second, in a process that is already running and already holding a
   * connection open — which is the trade the old comment described and then did not take.
   */
  const floor = setInterval(sweep, 1_000);

  return {
    stop: () => {
      if (timer) clearTimeout(timer);
      clearInterval(floor);
      watcher?.close();
    },
  };
}


/**
 * ⛔ A NOTE THE LOG NEVER SAW IS A REQUEST NOBODY WILL EVER BE TOLD ABOUT.
 *
 * Found on the first real corpus this was pointed at. It held one open note — Peter's, about
 * pricing being read back from the workbook — filed before any of this existed. The page counted it
 * (`presence` reads the corpus) and the inbox did not (it reads the log), so the two surfaces gave
 * opposite answers to "is there anything waiting", and the one a session reads said no.
 *
 * That is precisely the failure this design exists to prevent, and a corpus older than the log will
 * be the normal case for a long time. So the log is COMPLETED rather than assumed complete: every
 * open note with no event carrying it gets one.
 *
 * ⛔ IDEMPOTENT, AND KEYED ON THE NOTE'S OWN ID. Appending a second event for a note already in the
 * log would pin the cursor behind work that is done the moment the first one is closed — and the
 * duplicate would come back on every read forever.
 *
 * ⛔ AND IT ONLY EVER ADDS. Nothing here rewrites or renumbers, because a cursor a session is
 * holding points at a position, and moving what lives at that position is worse than the gap.
 */
export function carryOpenNotesIntoTheLog(dir: string, notes: Array<{ id: string; about: string; says: string; by: string; at: string; via: string; state: string }>): number {
  const known = new Set(readLog(dir).map((e) => e.work).filter(Boolean));
  let added = 0;
  for (const n of notes) {
    if (n.state !== "open" || known.has(n.id)) continue;
    append(dir, {
      kind: "note",
      /** The day it was asked, as an instant, so it sorts before anything recorded since. */
      at: /^\d{4}-\d{2}-\d{2}$/.test(n.at) ? `${n.at}T00:00:00.000Z` : n.at,
      by: n.by,
      via: n.via,
      ref: n.about,
      says: `${n.by} asked for a change to ${n.about} — ${n.says}`,
      work: n.id,
    });
    added++;
  }
  return added;
}
