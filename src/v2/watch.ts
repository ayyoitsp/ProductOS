/**
 * ⛔ TELL ME WHEN SOMETHING IS RECORDED. DO NOT ASK ME TO KEEP ASKING.
 *
 * Peter: "Stop the monitor now. We need a better way to monitor than to poll endlessly."
 *
 * He is right, and the polling was not a design — it was the only thing available for a PUBLISHED
 * page, whose database can only be read through the tool that published it. Nothing on that path
 * can push, so a watcher there is a loop that costs a model call per tick and reports "nothing"
 * almost every time. Forty-odd of those in one session.
 *
 * The served surface has no such problem: a press writes to disk synchronously. So this blocks on
 * the filesystem and prints one line per NEW record — no model call until something actually
 * happens, and then one, with the record in it.
 *
 * ⛔ PER RECORD, NOT PER FILE CHANGE. A file event says "verdicts.yaml is different", which is not
 * something anybody can act on: the append-only logs are rewritten wholesale by a close, an editor
 * touches them, and a single act can fire several events. What a person wants to know is "peter
 * agreed to X" — so this diffs the loaded corpus against what it has already announced and says
 * only what is new.
 */
import fs from "node:fs";
import path from "node:path";
import { loadCorpus } from "./load.js";

export interface WatchOptions {
  /** Print what is already recorded before waiting. Off by default: a watcher that replays history on
   *  startup floods the first notification with things somebody dealt with last week. */
  replay?: boolean;
  /** Settle time after a file event, so one act rewriting a log is one announcement. */
  quietMs?: number;
  /** Where each line goes. Injected so a test can capture it without a subprocess. */
  emit?: (line: string) => void;
}

/** One line per record, in the tense of the thing that happened. */
function lineFor(kind: "act" | "note", r: Record<string, unknown>): string {
  if (kind === "note")
    return `NOTE  ${String(r.by)} asked for a change to ${String(r.about)} — ${String(r.says).replace(/\s+/g, " ").slice(0, 160)}`;
  const target = String(r.target ?? r.scope ?? "");
  const extra = r.because ? ` — ${String(r.because).replace(/\s+/g, " ").slice(0, 120)}` : "";
  return `ACT   ${String(r.by)} ${String(r.kind)} ${target} via ${String(r.via)}${extra}`;
}

/**
 * Watch a corpus and emit a line per new act or note. Resolves only when `stop()` is called, so a
 * caller can await it; the returned `stop` is what a test and a signal handler both use.
 */
export function watchCorpus(dir: string, opts: WatchOptions = {}): { stopped: Promise<void>; stop: () => void } {
  const emit = opts.emit ?? ((l: string) => console.log(l));
  const quiet = opts.quietMs ?? 150;
  const seen = new Set<string>();

  /** ⛔ A key per record, from its own identity — not an index. A log rewritten in a different order
   *  would otherwise re-announce everything it holds. */
  const keyOf = (kind: string, r: Record<string, unknown>) =>
    `${kind}|${String(r.id ?? "")}|${String(r.kind ?? "")}|${String(r.target ?? r.scope ?? r.about ?? "")}|${String(r.at ?? "")}|${String(r.by ?? "")}`;

  const sweep = (announce: boolean) => {
    let corpus;
    try {
      corpus = loadCorpus(dir);
    } catch {
      // A half-written file is normal mid-save. The next event will catch it.
      return;
    }
    for (const v of corpus.verdicts) {
      const k = keyOf("act", v as unknown as Record<string, unknown>);
      if (seen.has(k)) continue;
      seen.add(k);
      if (announce) emit(lineFor("act", v as unknown as Record<string, unknown>));
    }
    for (const n of corpus.notes) {
      const k = keyOf("note", n as unknown as Record<string, unknown>);
      if (seen.has(k)) continue;
      seen.add(k);
      if (announce) emit(lineFor("note", n as unknown as Record<string, unknown>));
    }
  };

  // Prime the seen set so only what happens NEXT is announced.
  sweep(Boolean(opts.replay));

  let timer: NodeJS.Timeout | undefined;
  const bump = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => sweep(true), quiet);
  };

  /**
   * ⛔ WATCH THE DIRECTORIES THAT HOLD RECORDS, NOT THE WHOLE CORPUS. `truth/` and `rules/` are
   * rewritten by every migration and by every ruling, so watching them would announce nothing and
   * fire constantly. Acts and notes are the only things a person is waiting to hear about.
   */
  const watchers: fs.FSWatcher[] = [];
  for (const sub of ["verdicts", "notes", "readings"]) {
    const here = path.join(dir, sub);
    fs.mkdirSync(here, { recursive: true });
    try {
      watchers.push(fs.watch(here, { persistent: true }, bump));
    } catch {
      // Some filesystems cannot watch. The interval below is the floor, not the mechanism.
    }
  }

  /**
   * ⛔ A SLOW BACKSTOP, AND IT IS NOT THE MECHANISM. fs.watch misses events over some network and
   * container filesystems, and a watcher that silently stops noticing is worse than one that polls.
   * Thirty seconds, costing nothing — it is a filesystem read in a process that is already running,
   * not a model call.
   */
  const floor = setInterval(() => sweep(true), 30_000);

  let done: () => void;
  const stopped = new Promise<void>((r) => (done = r));
  const stop = () => {
    if (timer) clearTimeout(timer);
    clearInterval(floor);
    for (const w of watchers) w.close();
    done();
  };
  return { stopped, stop };
}
