/**
 * ⛔ THE SESSION'S HALF OF THE LOOP — the same log the page streams, read with a cursor.
 *
 * A person presses something on a page and an open session has to find out. The page already reads
 * the event log as a stream; this is the other reader, and it is deliberately the SAME log. Two
 * feeds would be two answers to "what happened", and the one nobody was looking at would be the one
 * that dropped the press.
 *
 * Three properties, each of which is a failure this is built to survive:
 *
 * ⛔ 1. A CURSOR, NOT "WHAT IS NEW SINCE YOU ASKED". A session that dies mid-authoring reconnects
 *       and gets the same events again, because the cursor only advances past work once the work is
 *       done. A feed that forgets on disconnect loses exactly the presses that arrived while
 *       something was broken — the ones most likely to matter.
 *
 * ⛔ 2. READING CLAIMS. A session on a laptop and one in the cloud both poll. Without a claim both
 *       author the same note and the second overwrites the first, and neither ever finds out. The
 *       lease is on the note, not on the feed: locking the feed would make a second session useless
 *       when its entire value is being a second pair of hands.
 *
 * ⛔ 3. WHAT SOMEBODY ELSE IS HOLDING IS REPORTED, NOT HIDDEN. A second session that simply saw an
 *       empty inbox could not tell "nothing to do" from "somebody else got there first", and those
 *       call for opposite behaviour.
 *
 * ⛔ WHAT THIS DOES NOT DO: wake anybody. Polling is a network question and costs no tokens;
 * WAKING a model is what costs context, and forty wakes that find nothing is the thing that made
 * Peter say "Stop the monitor now." So this answers cheaply and as often as anyone likes, and
 * whatever drives it decides what is worth waking a session for.
 */
import { readLog, carryOpenNotesIntoTheLog, type LoggedEvent } from "./log.js";
import { claimNote, heldNow, readNotes } from "./notes.js";
import { seen } from "./presence.js";

export interface InboxOptions {
  /** Deliver events after this position. 0 or absent means from the beginning. */
  since?: number;
  /**
   * The session asking. Present means "claim what you give me" — absent means a look without
   * taking anything, which is what a status display wants.
   */
  claim?: string;
  /** How long a claim holds before the work comes back. */
  leaseMs?: number;
  /** Most events to return in one answer. */
  limit?: number;
}

/** Work another session is already doing, so this one can say so rather than guess. */
export interface HeldElsewhere {
  seq: number;
  work: string;
  says: string;
  by: string;
  until: string;
}

export interface InboxRead {
  events: LoggedEvent[];
  held: HeldElsewhere[];
  /**
   * ⛔ WHERE TO RESUME AFTER A RESTART — the low-water mark, not the end of the log. Everything at
   * or below this is settled: no note under it is still waiting to be authored. A session that
   * crashed and comes back with this number is handed its unfinished work again.
   */
  next_cursor: number;
  /**
   * The end of the log. A session that is alive and polling in a loop carries THIS between polls,
   * so settled information is not re-read every second; it falls back to `next_cursor` only when it
   * has lost its place. Both are returned because the two questions are genuinely different, and a
   * single number would silently answer the wrong one for one of the two callers.
   */
  head: number;
  more: boolean;
}

/** Fifteen minutes: long enough to author a change, short enough that a dead session is not missed for an hour. */
export const DEFAULT_LEASE_MS = 15 * 60 * 1000;

export function inbox(dir: string, opts: InboxOptions = {}): InboxRead {
  /**
   * ⛔ REPORTED HERE, so no caller can forget. A page that says "nobody is working" while somebody
   * is working is worse than one that says nothing, and the surface that got it wrong would always
   * be the one whose author did not know presence existed.
   *
   * Only a claiming read counts: a status display looking at the queue is not somebody working it.
   */
  if (opts.claim) seen(dir, opts.claim);
  const notes = readNotes(dir);
  /**
   * ⛔ BEFORE READING, NOT AFTER. A corpus written before the log existed holds open notes the log
   * has never heard of, and without this the page counts them as waiting while the inbox reports
   * nothing to do — two surfaces, opposite answers, and the one a session reads says no. Idempotent
   * and additive; see `carryOpenNotesIntoTheLog`.
   */
  carryOpenNotesIntoTheLog(dir, notes as unknown as Parameters<typeof carryOpenNotesIntoTheLog>[1]);
  const all = readLog(dir);
  const byId = new Map(notes.map((n) => [n.id, n]));
  const now = new Date();
  const nowIso = now.toISOString();

  /** Work an event carries that nobody has finished. Anything else is information. */
  const unfinished = (e: LoggedEvent): boolean => {
    if (!e.work) return false;
    const n = byId.get(e.work);
    /**
     * ⛔ A NOTE THE LOG MENTIONS AND THE CORPUS DOES NOT IS NOT TREATED AS WORK. Otherwise a note
     * deleted by hand would pin the cursor behind an event nobody can ever close, and every poll
     * would re-deliver the whole tail of the log forever.
     */
    return !!n && n.state === "open";
  };

  const since = Math.max(0, Math.floor(opts.since ?? 0));
  const head = all.length;

  /** ⛔ Over the WHOLE log, not the delivered window: a cursor that skipped work it had not shown
   *  this time would be a promise the next restart could not keep. */
  const firstStuck = all.find(unfinished);
  const next_cursor = firstStuck ? firstStuck.seq - 1 : head;

  const held: HeldElsewhere[] = [];
  const events: LoggedEvent[] = [];
  let more = false;
  const limit = opts.limit && opts.limit > 0 ? Math.floor(opts.limit) : Infinity;

  for (const e of all) {
    if (e.seq <= since) continue;
    if (events.length >= limit) {
      more = true;
      break;
    }
    if (unfinished(e)) {
      const n = byId.get(e.work!)!;
      /**
       * ⛔ Its own claim comes back. That IS the crash case: the same session id reconnecting has
       * not finished, still owes the work, and is the one holding the lease on it.
       */
      if (heldNow(n, nowIso) && n.claimed_by !== opts.claim) {
        held.push({ seq: e.seq, work: n.id, says: e.says, by: n.claimed_by!, until: n.claimed_until! });
        continue;
      }
      if (opts.claim) {
        const until = new Date(now.getTime() + (opts.leaseMs ?? DEFAULT_LEASE_MS)).toISOString();
        const got = claimNote(dir, n.id, opts.claim, until);
        /**
         * ⛔ The claim can still lose — another session may have taken it between the read above and
         * the write. Reported as held rather than delivered, because delivering it anyway is the
         * exact double-authoring this is here to prevent.
         */
        if (!got.ok && got.heldBy) {
          held.push({ seq: e.seq, work: n.id, says: e.says, by: got.heldBy, until: got.until });
          continue;
        }
      }
    }
    /**
     * ⛔ `work` MEANS "THIS STILL OWES YOU SOMETHING", so it is stripped once it does not.
     *
     * The field is permanent on the log line — it is which note the event was about — and every
     * consumer of a DELIVERED event reads it as a request still waiting: the CLI prints
     * `← owes work`, the MCP read lists it under `owed`, and a relay wakes a session for it. So a
     * session resuming from `next_cursor` was handed notes somebody had already closed, labelled as
     * work it owed, and the only way to find out otherwise was to read the corpus and compare —
     * which is exactly the comparison this function exists to have already done.
     *
     * ⛔ `unfinished` IS THE ONE DEFINITION, reused rather than restated. `next_cursor` is computed
     * from it above, so a second rule here is how the cursor and the field come to disagree about
     * the same note.
     */
    events.push(e.work && !unfinished(e) ? { ...e, work: undefined } : e);
  }

  return { events, held, next_cursor, head, more };
}
