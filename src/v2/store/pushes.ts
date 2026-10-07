/**
 * ⛔ THE PUSH CHANNEL, FOR AN INSTANCE WHOSE LOG IS IN A DATABASE.
 *
 * `/api/v2/live` is how a page finds out that somebody pressed something, and on a hosted instance
 * it announced nothing at all. `watchLog` tails `events/log.jsonl` beside the corpus; the hosted
 * path materializes the corpus into a temp directory and deletes it in a `finally` as the request
 * returns — so the SSE handler, whose response outlives that request by design, was left watching
 * a directory that no longer existed.
 *
 * ⛔ AND IT FAILED IN THE ONE WAY NOBODY CAN SEE. The connection opened, the heartbeat arrived every
 * twenty-five seconds, and the page looked live. `serve.ts` already names that shape as the one
 * failure in this design nobody can detect from the outside, about buffering the same route; it was
 * already true of the route for a different reason.
 *
 * ⛔ IN PROCESS, WITH A POLL UNDERNEATH — the mechanism and the floor, the same two-part shape
 * `watch.ts` uses. A write lands in the same process that holds the connections almost always, so
 * publishing straight to them costs nothing and arrives immediately. The poll is what makes a
 * SECOND process — another replica, a migration, a CLI pointed at the same store — reach a reader
 * anyway, slowly, instead of silently never.
 *
 * ⛔ IT IS A FLOOR AND NOT THE MECHANISM, and the distinction is the whole reason this is written
 * down: a watcher that quietly stops noticing is worse than one that polls, and a poll presented as
 * the mechanism is how "Stop the monitor now" happened. Nothing here wakes a model. It is one
 * indexed query per open connection per interval, in a process already running.
 */
import type { ProjectStore, StoredEvent } from "./access.js";
import type { LoggedEvent } from "../log.js";

/** ⛔ Thirty seconds. Slow enough to cost nothing, fast enough that a lost publish is a delay. */
export const FLOOR_MS = 30_000;

type Listener = (e: LoggedEvent) => void;

/**
 * ⛔ PER PROJECT. One map keyed by project, because a reader of one corpus being told about another
 * is both a leak and a page that updates when nothing it shows has changed.
 */
const listeners = new Map<string, Set<Listener>>();

/** ⛔ `seq` IS THE POSITION, so a stored row already carries what `readLog` would have derived. */
export const asLogged = (e: StoredEvent): LoggedEvent =>
  ({ seq: e.seq, ...(e.payload as Record<string, unknown>), kind: e.kind }) as unknown as LoggedEvent;

/**
 * Tell everybody listening to one project what just landed.
 *
 * ⛔ CALLED WHERE THE WRITE LANDS, not where the act was decided. A publish beside each `perform`
 * would be a publish every author has to remember, and the one that forgot would be a press that
 * silently never reached a page.
 */
export function published(projectId: string, events: StoredEvent[]): void {
  const here = listeners.get(projectId);
  if (!here?.size) return;
  for (const e of events) {
    const logged = asLogged(e);
    for (const l of [...here]) {
      /** ⛔ One dead connection must not stop the others being told. */
      try {
        l(logged);
      } catch {
        // A writer whose socket has gone. `stop` will remove it.
      }
    }
  }
}

/**
 * The source `/api/v2/live` streams from when a database is behind it.
 *
 * ⛔ FROM NOW, NOT FROM THE BEGINNING — the same default `watchLog` takes. Replaying the log on
 * connect floods a reader with last week, and the inbox is what exists for catching up deliberately.
 */
export function streamFor(store: ProjectStore, from: number, floorMs = FLOOR_MS): (emit: (e: LoggedEvent) => void) => { stop: () => void } {
  return (emit) => {
    let at = from;
    /** ⛔ Monotonic, and shared by both paths: a publish and a poll delivering the same row is the
     *  normal case, and announcing a press twice reads as two presses. */
    const forward = (e: LoggedEvent): void => {
      if (e.seq <= at) return;
      at = e.seq;
      emit(e);
    };

    const listener: Listener = forward;
    const here = listeners.get(store.projectId) ?? new Set<Listener>();
    here.add(listener);
    listeners.set(store.projectId, here);

    let running = false;
    const sweep = async (): Promise<void> => {
      /** ⛔ Not re-entrant: a slow store would otherwise stack queries until it fell over. */
      if (running) return;
      running = true;
      try {
        for (const e of await store.since(at, 200)) forward(asLogged(e));
      } catch {
        // A store that cannot be read right now is a delay, never a closed connection.
      } finally {
        running = false;
      }
    };
    const floor = setInterval(() => void sweep(), floorMs);
    floor.unref?.();

    return {
      stop: () => {
        clearInterval(floor);
        here.delete(listener);
        if (!here.size) listeners.delete(store.projectId);
      },
    };
  };
}
