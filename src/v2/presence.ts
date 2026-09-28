/**
 * ⛔ IS ANYBODY LISTENING — because a press into nothing is the failure mode that looks like success.
 *
 * A person reads a feature, presses *change this*, and the page thanks them. If no session is open,
 * nothing happens to that request — possibly for days — and the page said exactly what it says when
 * somebody picks it up within the second. They will press three more times and then stop trusting
 * the surface.
 *
 * So the instance records which sessions have read the inbox and when, and the page can say
 * *nobody is working, and there are four requests waiting*. That is not a promise about response
 * time; it is the difference between a queue and a void.
 *
 * ⛔ ON DISK, NOT IN THE SERVER'S MEMORY. The session polling is usually a different process from
 * the one serving the page — a terminal, a relay, an agent on another machine — and presence held
 * in the web server would report "nobody is working" while somebody was working. Storage behind the
 * API, like everything else here.
 */
import fs from "node:fs";
import path from "node:path";

export interface Working {
  session: string;
  /** When it last read the inbox. */
  at: string;
}

/** ⛔ Generous: a session between wakes is still working. Short enough that a dead one goes quiet. */
export const PRESENCE_MS = 5 * 60 * 1000;

const fileOf = (dir: string): string => path.join(dir, "events", "sessions.json");

const read = (dir: string): Working[] => {
  const f = fileOf(dir);
  if (!fs.existsSync(f)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(f, "utf-8")) as Working[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Note that a session is alive.
 *
 * ⛔ CALLED BY THE INBOX ITSELF, not by each caller of it. Presence a caller has to remember to
 * report is presence that is right for the surface whose author remembered — and the page would
 * then say nobody is working whenever the session in question used the other one.
 */
export function seen(dir: string, session: string): void {
  if (!session.trim()) return;
  const at = new Date().toISOString();
  const rest = read(dir).filter((w) => w.session !== session);
  const f = fileOf(dir);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  /** Only the living are kept, so the file cannot grow without bound over a long-lived instance. */
  const alive = rest.filter((w) => Date.parse(w.at) > Date.now() - PRESENCE_MS);
  fs.writeFileSync(f, JSON.stringify([...alive, { session, at }], null, 2));
}

/** Who has read the inbox recently. */
export function working(dir: string, withinMs = PRESENCE_MS): Working[] {
  const floor = Date.now() - withinMs;
  return read(dir).filter((w) => Date.parse(w.at) > floor);
}
