/**
 * The hosted instance: the same API, addressed by project, with a store behind it.
 *
 * ⛔ ONE ROUTE LIST, NOT TWO. `productos serve` is not a preview of a hosted thing — it IS the
 * thing, with a directory behind it instead of a database. So this does not reimplement a single
 * route. It resolves who is asking, authorizes a project, and hands the request to `v2Route` with
 * the store's corpus in front of it. A route that existed in only one of the two would make the
 * local case a lesser experience, and the gate protecting a corpus that names a real client would
 * become a punishment for using it.
 *
 * ⛔ THE CLIENT NEEDED NO CHANGE AT ALL. `instanceOf(at)` already treats `--at` as a base URL and
 * appends `/api/v2/...`, so `--at https://host/p/prj-abc` addresses a project on an instance with
 * the code that already shipped. Refs are instance-independent, which is why this stayed a server
 * change.
 *
 * ⛔ AND THE SCRATCH DIRECTORY IS A CACHE, NOT A SECOND AUTHORITY — the same argument `mirror()`
 * already makes for reads, held for writes too. The store is read at the start of a request and
 * written at the end of it; nothing survives in between, nothing is served from it, and a write
 * that would land on a corpus that moved underneath is REFUSED rather than applied. See
 * `writeBack`, which is where the honest cost of this adapter is written down.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { CORPUS_DIRS, corpusFiles, loadCorpus, type Corpus } from "../load.js";
import { appendedLines, sessionsIn, writeLog, writeSessions } from "./corpus.js";
import { published, streamFor } from "./pushes.js";
import { PRESENCE_MS } from "../presence.js";
import { v2Route } from "../serve.js";
import { type Db, isRefusal, type ProjectStore, type StoredEvent, storeFor } from "./access.js";
import { principalFrom } from "./identity.js";
import { projects } from "./schema.js";
import { eq } from "drizzle-orm";

export interface InstanceOptions {
  db: Db;
  /**
   * ⛔ THE LOCAL CASE, AND IT IS NOT A BYPASS. A session id the instance issued for the one account
   * it runs as — see `singleAccount`. Absent when hosted, where a cookie or a bearer is the only
   * way in.
   */
  localSession?: string;
}

const json = (res: http.ServerResponse, body: unknown, status = 200): void => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body, null, 2));
};

const COOKIE = "productos_session";
const cookieOf = (req: http.IncomingMessage): string | undefined => {
  const raw = String(req.headers.cookie ?? "");
  const hit = raw
    .split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === COOKIE)?.[1];
  return hit ? decodeURIComponent(hit) : undefined;
};

/**
 * `/p/<project-id>/<rest>` — ⛔ the project is in the path, never in a tool argument or a body.
 *
 * ⛔ `.` AND `..` ARE EXCLUDED EXPLICITLY. An id is not a path and nothing here touches a filesystem
 * with it, so a traversal segment reaches no file — but it does become a lock key and an audit
 * string, and "the id that cannot name a project" is a worse thing to carry around than a rejected
 * request. Cheap to forbid, and the character class would otherwise allow it because ids may
 * contain dots.
 */
const PROJECT_PATH = /^\/p\/(?!\.\.?(?:\/|$))([A-Za-z0-9_.:@+-]{1,200})(\/.*)?$/;

export function projectOf(pathname: string): { id: string; rest: string } | null {
  const m = PROJECT_PATH.exec(pathname);
  if (!m) return null;
  return { id: m[1]!, rest: m[2] || "/" };
}

/**
 * ⛔ ONE WRITER PER PROJECT AT A TIME, IN THIS PROCESS.
 *
 * Read-modify-write over a materialized corpus loses an update if two requests interleave, and the
 * loss is silent — the second write simply does not contain the first. This serializes them.
 *
 * ⛔ AND IT IS NOT ENOUGH FOR MORE THAN ONE REPLICA, WHICH IS WRITTEN DOWN RATHER THAN HOPED ABOUT.
 * Two instances against one database are two of these maps. The precondition check in `writeBack`
 * is what catches that case — it refuses rather than overwriting — but a deployment that scales out
 * needs a database-level lock, and `min-replicas 1` is a constraint until it has one.
 */
const writing = new Map<string, Promise<unknown>>();

/** When the write currently holding each key started, so a stuck one can be named. */
const since = new Map<string, number>();

/**
 * ⛔ HOW LONG A CALLER WILL WAIT FOR THE PROJECT'S CURRENT WRITE, AND WHY IT IS GENEROUS.
 *
 * The largest corpus on staging — 151 documents, 127 scopes — answers a write in about 4 seconds.
 * 120s is thirty times that, so this cannot fire on a slow write; it fires on a write that is never
 * going to finish.
 */
const WAIT_MS = 120_000;

/** Projects whose current write has been running longer than `ms`. Read-only; costs nothing. */
export function stuckWrites(ms: number = WAIT_MS): Array<{ project: string; seconds: number }> {
  const now = Date.now();
  return [...since.entries()]
    .filter(([, at]) => now - at > ms)
    .map(([project, at]) => ({ project, seconds: Math.round((now - at) / 1000) }));
}

/**
 * ⛔ A WAITER GIVES UP AND REFUSES. IT DOES NOT PROCEED, AND IT DOES NOT WAIT FOREVER.
 *
 * This chained promises with no bound. A `work()` that never settles — a client that vanished while
 * the server was inside `writeBack` — blocked the chain PERMANENTLY, and every later write on that
 * project queued behind it in silence. Found on staging: GETs answered on all four projects while
 * POSTs to two of them hung forever, `/health` green, the log silent, Postgres with no open
 * transaction and no ungranted lock. One abandoned client had made two projects unwritable, and a
 * restart was the only route back.
 *
 * ⛔ REFUSING IS THE FIX, AND PROCEEDING WOULD NOT BE. The lock exists because a read-modify-write
 * over a materialized corpus loses an update silently when two interleave. A waiter that times out
 * and goes anyway would trade "this write is refused" for "somebody's work vanished" — a worse
 * failure, and an invisible one. So the invariant is kept and the caller is told.
 */
function serialize<T>(key: string, work: () => Promise<T>, waitMs: number = WAIT_MS): Promise<T> {
  let abandoned = false;

  /**
   * ⛔ THE CHAIN IS EXACTLY AS IT WAS, AND THE TIMEOUT IS ON THE CALLER'S PROMISE ONLY.
   *
   * A first version installed the timed-out waiter's own REJECTED promise as the new chain. That
   * settles immediately, so the next caller saw a free key and ran its write WHILE THE STUCK ONE WAS
   * STILL GOING — losing the serialization this lock exists for, which is a silent lost update: the
   * worse failure, traded for the one being fixed.
   *
   * So ordering is untouched: if the prior write never settles, the key stays blocked and every
   * caller is REFUSED. That is the honest end state — the instance needs a restart, and now it says
   * so instead of hanging.
   */
  const chain = (writing.get(key) ?? Promise.resolve()).then(
    () => guarded(),
    () => guarded(),
  );

  function guarded(): Promise<T> {
    /**
     * ⛔ AND WORK A CALLER HAS GIVEN UP ON MUST NOT RUN LATER. Without this, a request answered 503
     * could still apply its write minutes afterwards if the stuck one ever finished — a refusal that
     * silently took effect, which is worse than either outcome on its own.
     */
    if (abandoned) return Promise.reject(new Error("this write was refused before it started"));
    since.set(key, Date.now());
    return (async () => {
      try {
        return await work();
      } finally {
        since.delete(key);
      }
    })();
  }

  writing.set(
    key,
    chain.catch(() => undefined),
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  const refusal = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      abandoned = true;
      const held = since.get(key);
      const secs = held ? Math.max(1, Math.round((Date.now() - held) / 1000)) : Math.max(1, Math.round(waitMs / 1000));
      /** ⛔ Named, with the age, because "it hung" sent two sessions to the database first. */
      const e = new Error(
        `another write to this project has been running for ${secs}s and has not finished, so this ` +
          `one was refused rather than queued behind it — the instance needs a restart`,
      ) as Error & { status?: number };
      e.status = 503;
      reject(e);
    }, waitMs);
  });

  return Promise.race([chain, refusal]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * Hold a response so it can still be replaced by a refusal.
 *
 * ⛔ A PROXY OVER THE REAL RESPONSE, NOT A REIMPLEMENTATION OF ONE. Only the four things `v2Route`
 * actually calls are intercepted; everything else passes through to the socket, so a route reaching
 * for something unusual behaves as it always did rather than hitting a stub that silently does
 * nothing. If it ever streams on a mutating request, `write` below is where that shows up.
 */
function capture(res: http.ServerResponse): {
  proxy: http.ServerResponse;
  flush: () => void;
  discard: () => void;
} {
  let status = 200;
  let headers: http.OutgoingHttpHeaders = {};
  const chunks: Buffer[] = [];
  let ended = false;

  const proxy = new Proxy(res, {
    get(target, prop, receiver) {
      if (prop === "writeHead") {
        return (code: number, h?: http.OutgoingHttpHeaders) => {
          status = code;
          if (h) headers = { ...headers, ...h };
          return proxy;
        };
      }
      if (prop === "setHeader") {
        return (name: string, value: string | string[]) => {
          headers[name] = value;
          return proxy;
        };
      }
      if (prop === "write") {
        return (chunk: string | Buffer) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          return true;
        };
      }
      if (prop === "end") {
        return (chunk?: string | Buffer) => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          ended = true;
          return proxy;
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as http.ServerResponse;

  return {
    proxy,
    flush: () => {
      if (!ended && chunks.length === 0) return;
      res.writeHead(status, headers);
      res.end(Buffer.concat(chunks));
    },
    /** ⛔ Throws the captured bytes away WITHOUT touching the socket, so the caller can answer. */
    discard: () => {
      chunks.length = 0;
      ended = false;
    },
  };
}

/**
 * Everything a request runs against: the corpus, the log, and what both looked like going in.
 *
 * ⛔ ONE FUNCTION, SHARED WITH THE MCP LAYER, BECAUSE THE LOG IS THE EASY HALF TO FORGET. The first
 * version of this materialized documents only. `acts.ts` and `notes.ts` append to
 * `events/log.jsonl` inside a request, so every one of those appends was written into a directory
 * that was then deleted — and nothing failed, because `carryOpenNotesIntoTheLog` re-derives events
 * for open notes and quietly covered for it. A press, a `question-answered`, or a cursor that had
 * to outlive one request was simply lost, and the inbox looked like it was working.
 */
export interface Materialized {
  dir: string;
  documents: Record<string, string>;
  /** How many log lines the request was given. Anything past this is what it appended. */
  logHad: number;
  /** Who the store said was listening going in. Anything newer than this is a heartbeat to keep. */
  listening: Array<{ session: string; at: string }>;
  /** The corpus this read already parsed, for the routes that want one. Absent on a write. */
  corpusFor?: () => Corpus;
  /**
   * Whether this directory is shared with other in-flight reads.
   *
   * ⛔ IT MUST NOT BE DELETED WHEN THE REQUEST ENDS. The teardown removed the directory
   * unconditionally, which is right for one a request owns and wrong for one the next reader is
   * about to use — and a request deleting another's corpus mid-read is the worst possible version
   * of this optimisation.
   */
  shared?: boolean;
}

/**
 * The corpus this process last read out of a project, and what it was at when it did.
 *
 * ⛔ 19 MB WAS READ OUT OF NEON TO SERVE EVERY PAGE VIEW — `documents()` alone is 1729ms against
 * the instance for 169 rows, measured. Two page views a second apart read the same 19 MB twice, and
 * the second one learned nothing the first had not.
 *
 * ⛔ KEYED ON A FINGERPRINT, NOT ON TIME. A TTL would serve a corpus somebody has just changed, and
 * the whole guarantee of this surface is that what you are reviewing is what is there. The
 * fingerprint covers the document count, the latest write, the latest deprecation and the log's
 * last `seq` — so a write, a deprecation or an appended event all miss the cache, and nothing else
 * does.
 *
 * ⛔ AND THE DIRECTORY IS STILL BUILT PER REQUEST, deliberately. Handing two requests one directory
 * would be faster again and would share mutable state between them: `writeBack` diffs the files on
 * disk against what the request was given, so a stray write by one request would be read as the
 * other's. The expensive part was the network, not the 51ms of local writes.
 */
const READ = new Map<
  string,
  {
    fp: string;
    documents: Record<string, string>;
    events: StoredEvent[];
    dir?: string;
    /**
     * ⛔ THE PARSED CORPUS, because laying the documents out and then parsing them back is the last
     * thing every request was doing with bytes it already had — ~374ms of YAML per page view on
     * Bilrost's corpus. Held beside the directory it was parsed from, and dropped with it.
     */
    corpus?: Corpus;
  }
>();

/** ⛔ A bound, because a corpus is ~19 MB in memory and an instance serves many projects. */
const READ_CEILING = 4;

/**
 * Forget what this process read, because it has just changed it.
 *
 * ⛔ BELT AND BRACES OVER THE FINGERPRINT, AND THE REASON IS A NARROW BUT REAL HOLE IN IT.
 * `updatedAt` is stamped by whichever node performs the write, not by the database — so two writers
 * with skewed clocks can leave `max(updated_at)` unmoved while the content changed, and a write
 * that touches an existing document without appending an event moves neither the count nor `seq`.
 * The window needs clock skew AND an equal document count AND no logged event, which is why it is
 * narrow rather than impossible.
 *
 * Calling this after a write removes the case entirely for the process that did the writing, which
 * is every write that goes through this instance. Across processes the fingerprint is still what
 * decides, and that is worth saying out loud rather than implying it is exact.
 */
/**
 * How many lines the materialized log holds, for a directory that was already laid out.
 *
 * ⛔ `writeLog` RETURNED THIS AS A SIDE EFFECT OF WRITING, and `appendedLines` slices by position —
 * so reusing a directory still has to know where the request's own appends will start. Counting is
 * what writing was being used for.
 */
function countLogLines(dir: string): number {
  try {
    return fs
      .readFileSync(path.join(dir, "events", "log.jsonl"), "utf-8")
      .split("\n")
      .filter((l) => l.trim()).length;
  } catch {
    return 0;
  }
}

/** Stop sharing this project's laid-out directory — it is no longer known to be pristine. */
export function forgetDir(projectId: string): void {
  const entry = READ.get(projectId);
  if (entry) {
    entry.dir = undefined;
    /**
     * ⛔ AND THE CORPUS PARSED FROM IT. Keeping a corpus whose directory has been thrown away for
     * not being pristine would be the staleness this is careful about, one level up — the files are
     * suspect, so what was read out of them is too.
     */
    entry.corpus = undefined;
  }
}

export function forgetRead(projectId: string): void {
  READ.delete(projectId);
}

export async function materializeProject(store: ProjectStore, mutating = false): Promise<Materialized> {
  /**
   * ⛔ PRESENCE IS NEVER CACHED, AND IT IS THE REASON THIS IS NOT ONE ROUND TRIP ANY MORE.
   * `/api/v2/presence` is a GET like any other and the answer changes without the corpus changing,
   * so it is read every time — in parallel with the fingerprint, which is the only other thing
   * needed to find out whether anything else has to be read at all.
   */
  /**
   * ⛔ A WRITE ASKS FOR THE FINGERPRINT TOO, AND I BRIEFLY MADE IT NOT — WHICH WAS SLOWER.
   *
   * The reasoning that looked right: the fingerprint decides whether a cached read may be reused,
   * and a write never reuses the DIRECTORY, so why pay for it. The measurement disagreed — the
   * write went from 9 queries to 10. A write still needs `before`, the documents as they were when
   * it started, and a matching fingerprint is exactly the proof that the cached copy still IS that.
   * Skipping it traded one cheap trip for two expensive reads.
   *
   * ⛔ WHAT MUST NOT HAPPEN IS CACHING FROM A WRITE, which is a different thing and is enforced
   * below: recording a fingerprint taken BEFORE a write would leave the next reader matching on a
   * corpus that has since moved.
   */
  const [fp, listening] = await Promise.all([store.fingerprint(), store.listening(PRESENCE_MS)]);

  const had = READ.get(store.projectId);
  let documents: Record<string, string>;
  let events: StoredEvent[];

  if (had && had.fp === fp) {
    documents = had.documents;
    events = had.events;
  } else {
    /**
     * ⛔ ONE ROUND TRIP, NOT TWO. The documents and the log are independent reads, and
     * asking for the second only after the first arrived cost a full trip — 90ms against
     * Neon, on every single request, for nothing. `scripts/bench-store.mjs` is where that
     * number came from and is how to check it again.
     */
    [documents, events] = await Promise.all([store.documents(), store.since(0, LOG_CEILING)]);
    /** ⛔ Oldest out first, so a busy instance holds a bounded number of corpora. */
    if (!mutating && READ.size >= READ_CEILING && !READ.has(store.projectId)) {
      const oldest = READ.keys().next().value;
      if (oldest !== undefined) READ.delete(oldest);
    }
    /**
     * ⛔ NOTHING IS REMEMBERED FROM A WRITE. The fingerprint was taken before the write landed, so
     * storing it would hand the next reader a match against a corpus that has since moved.
     */
    if (!mutating) READ.set(store.projectId, { fp, documents, events });
  }

  /**
   * ⛔ THE SAME DIRECTORY AGAIN, WHEN THE REQUEST CANNOT WRITE TO IT.
   *
   * Every request wrote all 169 documents to a fresh temp directory, read them back, parsed them,
   * and deleted them — profiled across 18 requests on Bilrost's corpus, that floor was ~1.0s of
   * writing, ~1.6s of reading and ~2.9s of YAML. A 35-byte presence answer paid it.
   *
   * ⛔ ONLY WHEN THE REQUEST IS NOT MUTATING, and the reason is `writeBack`: it diffs the files on
   * disk against what the request was given, so a request that writes into a SHARED directory
   * would have its writes read as somebody else's. A mutating request therefore still gets its own,
   * exactly as before.
   *
   * ⛔ AND A DIRTY SHARED DIRECTORY IS THROWN AWAY RATHER THAN TRUSTED. If a non-mutating request
   * does somehow change a file, `writeBack` sees it, and `forgetDir` drops the directory so the
   * next reader lays out a clean one. The invariant is that a shared directory is pristine; it is
   * not an assumption that nothing ever writes to it.
   */
  const reusable = !mutating && had && had.fp === fp && had.dir && fs.existsSync(had.dir);
  const dir = reusable ? had!.dir! : materialize(documents);
  const logHad = reusable ? countLogLines(dir) : writeLog(dir, events);
  writeSessions(dir, listening);
  if (!mutating) {
    const entry = READ.get(store.projectId);
    if (entry) entry.dir = dir;
  }
  /**
   * ⛔ A GETTER, SO A ROUTE THAT DOES NOT NEED A CORPUS DOES NOT PARSE ONE. Presence reads notes and
   * nothing else; making it pay for a parse to answer "is anybody listening" is the cost this whole
   * sweep has been removing.
   *
   * ⛔ AND NEVER FOR A WRITE. A write edits the directory and then expects to read what it wrote, so
   * a corpus parsed before its own edit would be a request that cannot see its own work — the same
   * reason a writer is handed its own directory rather than the shared one.
   */
  const corpusFor = mutating
    ? undefined
    : () => {
        const entry = READ.get(store.projectId);
        if (entry?.fp === fp && entry.corpus) return entry.corpus;
        const parsed = loadCorpus(dir);
        if (entry?.fp === fp) entry.corpus = parsed;
        return parsed;
      };

  return { dir, documents, logHad, listening, shared: Boolean(!mutating), corpusFor };
}

/**
 * ⛔ A BOUND, SO A LONG-LIVED PROJECT DOES NOT MATERIALIZE AN UNBOUNDED FILE ON EVERY REQUEST.
 *
 * It is high enough that no real corpus reaches it soon, and it is a known limit rather than a
 * silent one: `seq` is the line position `readLog` assigns, so truncating the FRONT of the log
 * would renumber everything and move every cursor somebody is holding. Compaction therefore needs
 * a cursor migration, and is not something to do by lowering this number.
 */
export const LOG_CEILING = 100_000;

/** Lay the store's corpus out as a directory the existing routes can read. */
export const materializeFor = (files: Record<string, string>): string => materialize(files);

function materialize(files: Record<string, string>): string {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "productos-project-")), "corpus");
  for (const sub of CORPUS_DIRS) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf-8");
  }
  return dir;
}

/**
 * Keep whatever the request recorded about who is listening.
 *
 * ⛔ A DIFF, NOT A BLIND UPSERT. Every request materializes the living listeners so
 * `/api/v2/presence` can answer, so writing all of them back would re-stamp `at` for sessions that
 * did nothing this request — and a listener that died ten minutes ago would be reported alive for
 * as long as anybody else kept making requests. Only a row the request actually MOVED is a
 * heartbeat.
 */
async function keepHeartbeats(
  store: ProjectStore,
  dir: string,
  before: Array<{ session: string; at: string }>,
): Promise<void> {
  const was = new Map(before.map((w) => [w.session, w.at]));
  /**
   * ⛔ THE BEATS GO TOGETHER, NOT ONE ROUND TRIP EACH. This awaited inside the loop, so a project
   * with four listeners cost four serial writes — and against Neon a trivial write is ~175ms of
   * trip whatever it carries, on every request, including the presence poll the page runs.
   *
   * ⛔ AND EACH STILL FAILS ALONE. One listener's bad row must not fail the request it rode in on,
   * which is why this is `allSettled` over per-beat try/catch rather than a transaction: a lost
   * beat is a surface that lapses, not a broken write.
   */
  const beats: Array<Promise<void>> = [];
  for (const w of sessionsIn(dir)) {
    if (was.get(w.session) === w.at) continue;
    const at = new Date(w.at);
    if (Number.isNaN(at.getTime())) continue;
    beats.push(
      store.saw(w.session, at).catch(() => {
        // Presence is a convenience; losing one beat is a surface that lapses, not a broken write.
      })
    );
  }
  await Promise.all(beats);
}

/**
 * Put back whatever the request changed, and refuse if the corpus moved underneath.
 *
 * ⛔ THE PRECONDITION IS THE WHOLE POINT. Without it, a request that started from a stale
 * materialization would write its own idea of every document it touched and quietly erase whatever
 * landed in between — the "two surfaces each believing they held the truth" failure, reintroduced
 * by an adapter meant to avoid it. So every path this request intends to write is compared against
 * what the store holds NOW, and a disagreement is a refusal rather than a merge nobody asked for.
 */
export async function writeBack(
  store: ProjectStore,
  before: Record<string, string>,
  dir: string,
  logHad?: number,
): Promise<{ changed: string[]; logged: number } | { conflict: string[] }> {
  const after = corpusFiles(dir);
  const changed = Object.keys(after).filter((k) => after[k] !== before[k]);
  const removed = Object.keys(before).filter((k) => !(k in after));

  /**
   * ⛔ THE LOG IS PART OF WHAT A REQUEST PRODUCED, NOT A SIDE EFFECT OF IT. An act that records a
   * verdict also announces it, and a session is woken by the announcement — so dropping the
   * appended lines leaves a corpus that moved and nobody told.
   */
  const appended = logHad === undefined ? [] : appendedLines(dir, logHad);

  if (changed.length === 0 && removed.length === 0 && appended.length === 0) {
    return { changed: [], logged: 0 };
  }

  /**
   * ⛔ ONLY THE PATHS THIS REQUEST TOUCHED. This asked for every document in the project — 19 MB on
   * Bilrost's corpus — to compare the handful it changed, and then discarded the rest. The question
   * is unchanged: does each path this request touched still hold what it held when it started.
   */
  const touched = [...new Set([...changed, ...removed])];
  const now = await store.sourcesOf(touched);
  const conflict = touched.filter((k) => (now[k] ?? undefined) !== (before[k] ?? undefined));
  if (conflict.length) return { conflict };

  /**
   * ⛔ THE CACHED READ GOES BEFORE THE WRITES, NOT AFTER THEM. Dropping it afterwards leaves a
   * window in which this process has written and another request can still be handed what was read
   * before — small, and exactly the kind of window that turns into "the page showed me old truth".
   */
  forgetRead(store.projectId);

  /**
   * ⛔ THE DOCUMENT WRITES GO TOGETHER — they touch different paths, so waiting for each before
   * sending the next bought a round trip per file. A placement save changes one file and did not
   * care; a sweep that redraws forty screens paid forty trips in series.
   *
   * ⛔ AND THE APPENDS BELOW DELIBERATELY DO NOT. An event's `seq` is allocated under the primary
   * key — two appends racing both compute the same next number, the key rejects the loser and it
   * retries. Firing them together would manufacture exactly the collisions the retry exists to
   * survive, and turn N trips into N plus the retries. Serial is the cheaper correct answer there.
   */
  await Promise.all([
    ...changed.map((key) => store.put(key, after[key]!)),
    /** ⛔ Deprecated, never deleted — the store has no delete path to call. */
    ...removed.map((key) => store.deprecate(key)),
  ]);

  /**
   * ⛔ IN ORDER, AND AFTER THE DOCUMENTS. An event announcing a change that is not in the store yet
   * would wake a session to read truth that has not landed.
   */
  /**
   * ⛔ WHAT LANDED, SO IT CAN BE ANNOUNCED. `store.append` hands back the `seq` it allocated, which
   * is the position `readLog` would have derived — so these rows are already in the shape a reader
   * of the log expects, and `published` does not have to go and read them again.
   */
  const landed: StoredEvent[] = [];
  for (const e of appended) {
    const { kind, ...rest } = e as { kind?: string };
    const k = String(kind ?? "corpus-changed");
    const seq = await store.append(k, rest as Record<string, unknown>);
    landed.push({ seq, kind: k, payload: rest as Record<string, unknown>, at: new Date() });
  }

  /**
   * ⛔ ANNOUNCED HERE, WHERE THE WRITE LANDED — not beside each act.
   *
   * `/api/v2/live` is the page's only way to find out that somebody pressed something, and on this
   * path it announced nothing at all: the watcher behind it tails a file in the materialized corpus,
   * which this request deletes on the way out. A publish written beside each `perform` instead would
   * be one every author has to remember, and the one that forgot would be a press no page ever heard
   * about — the same argument the comment above about synthesizing events makes in reverse.
   *
   * ⛔ AFTER the rows are in, never before. A reader woken by an event it cannot then read would go
   * and find the old truth, and cache it.
   */
  published(store.projectId, landed);

  return { changed: [...changed, ...removed], logged: appended.length };
}

/**
 * Handle a project-addressed request. Returns `false` when the path is not ours.
 */
export async function instanceRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  opts: InstanceOptions,
): Promise<boolean> {
  const addressed = projectOf(pathname);
  if (!addressed) return false;

  const who = await principalFrom(
    opts.db,
    req.headers as Record<string, string | undefined>,
    cookieOf(req) ?? opts.localSession,
  );

  /**
   * ⛔ NOBODY IS A 401, NOT A PRINCIPAL WITH NOTHING. `principalFrom` returns `null` for a request
   * it cannot identify precisely so this decision has to be made here — a `browser` principal that
   * the instance cannot account for would sail straight through `mayRecord`.
   */
  if (!who) {
    return (
      json(
        res,
        {
          ok: false,
          why: "not signed in",
          detail: [
            "a press has to be attributable to an account, or a verdict claims a human agreed and nothing can say which human",
          ],
        },
        401,
      ),
      true
    );
  }

  const reached = await storeFor(opts.db, who).project(addressed.id);
  /** ⛔ 404 for both "not yours" and "does not exist" — see `unreachable` in `access.ts`. */
  if (isRefusal(reached)) return json(res, reached, 404), true;

  /**
   * ⛔ THE OBVIOUS URL HAS TO WORK, OR THE 404 IS THE PRODUCT.
   *
   * `v2Route`'s allowlist claims `/v2` and `/api/v2/*` and nothing else, so `/p/<id>/` fell through
   * to a not-found — and that is the URL a person is handed, types, and guesses. Found by actually
   * opening what `make seed` printed, which was wrong for exactly this reason.
   */
  if (addressed.rest === "/" || addressed.rest === "") {
    res.writeHead(302, { location: `/p/${addressed.id}/v2` });
    res.end();
    return true;
  }

  const mutating = req.method !== "GET" && req.method !== "HEAD";

  const run = async (): Promise<boolean> => {
    const { dir, documents: before, logHad, listening: wasListening, shared, corpusFor } = await materializeProject(reached, mutating);
    /**
     * ⛔ A MUTATING RESPONSE IS HELD UNTIL THE WRITE LANDS, OR THE CALLER IS TOLD 200 FOR A WRITE
     * THAT WAS REFUSED. The delegate answers as soon as it has performed the act against the
     * materialized corpus, which is BEFORE `writeBack` has had its say — so for anything that can
     * write, the response is captured and flushed only once the store has actually taken it.
     *
     * ⛔ GETs ARE NOT BUFFERED, DELIBERATELY. `/api/v2/live` holds a connection open and streams;
     * buffering that would produce a page that never hears anything and looks up to date, which is
     * the one failure in this design nobody can detect from the outside.
     */
    const held = mutating ? capture(res) : null;
    try {
      const handled = await v2Route(req, held ? held.proxy : res, addressed.rest, {
        dir,
        corpusFor,
        who,
        /**
         * ⛔ THE STREAM READS THE STORE, NOT THE DIRECTORY IT WAS HANDED.
         *
         * `dir` is deleted in the `finally` below, and an SSE response outlives this function by
         * design — so the default source (a watcher on `events/log.jsonl`) was watching a path that
         * had been removed, and `/api/v2/live` emitted nothing on every hosted instance while
         * holding the connection open and heartbeating. `logHad` is where the log stood when this
         * request was given it, which is exactly "from now" for a reader connecting at this moment.
         */
        stream: streamFor(reached, logHad),
        /**
         * ⛔ THE ACCOUNT, NOT THE PROCESS'S OS USER. For a browser press `serve.ts` already takes
         * `who.actor`; this covers the two places that fell back to the local account.
         */
        by: who.kind === "browser" ? who.actor : undefined,
      });
      if (!handled) {
        held?.discard();
        return false;
      }

      /**
       * ⛔ BEFORE `writeBack`, AND NOT GATED ON IT. A heartbeat is not part of the corpus and must
       * not share its fate: a claiming inbox read whose document write loses a conflict still
       * happened, and the listener that made it is still listening. Reporting it as absent because
       * somebody else's press landed first is the "nobody is working" lie in a narrower window.
       */
      await keepHeartbeats(reached, dir, wasListening);

      /**
       * ⛔ A READ THAT CHANGED A FILE MEANS THE SHARED DIRECTORY IS NO LONGER PRISTINE, and the
       * invariant that makes sharing safe is that it is. So `writeBack` is still asked on every
       * request — it is what notices — and the directory stops being shared the moment it has
       * anything in it that the store does not. This is the assumption made falsifiable rather
       * than trusted.
       */
      const result = await writeBack(reached, before, dir, logHad);
      if (shared && "changed" in result && (result.changed.length > 0 || result.logged > 0)) {
        forgetDir(addressed.id);
        fs.rmSync(path.dirname(dir), { recursive: true, force: true });
      }
      if ("conflict" in result) {
        held?.discard();
        return (
          json(
            res,
            {
              ok: false,
              why: "the corpus moved underneath this request, so nothing was written",
              detail: [
                `changed elsewhere: ${result.conflict.join(", ")}`,
                "⛔ refused rather than merged — overwriting somebody else's press is worse than making you repeat it",
                "read it again, then record the act again",
              ],
            },
            409,
          ),
          true
        );
      }

      /**
       * ⛔ NOTHING IS SYNTHESIZED HERE, DELIBERATELY.
       *
       * An earlier version appended a `corpus-changed` when the delegate had written documents but
       * announced nothing. It looked like a safety net and behaved like noise: a CLAIMING INBOX
       * READ writes `notes/notes.yaml` to record the lease, so every poll by every session appended
       * an event saying the corpus changed. The log grew on reads.
       *
       * `acts.ts` and `notes.ts` announce what they did, in the words a reader sees. A write path
       * that moves a document and says nothing is a gap in THAT path, and papering over it here
       * both hides it and fills the log with events nobody can act on.
       */
      held?.flush();
      return true;
    } catch (e) {
      held?.discard();
      throw e;
    } finally {
      /**
       * ⛔ A SHARED DIRECTORY IS NOT THIS REQUEST'S TO DELETE. It belongs to the read cache and the
       * next reader is about to use it; removing it here would hand somebody an empty corpus — or
       * delete one out from under a request still reading it. One per project, replaced when the
       * fingerprint moves, so this does not grow.
       */
      if (!shared) fs.rmSync(path.dirname(dir), { recursive: true, force: true });
    }
  };

  /** Reads do not need the lock; anything that might write does. */
  return mutating ? serialize(addressed.id, run) : run();
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function createProject(
  db: Db,
  opts: { id: string; owner: string; slug: string; name: string; repoLabel?: string },
): Promise<void> {
  await db.insert(projects).values({
    id: opts.id,
    ownerId: opts.owner,
    slug: opts.slug,
    name: opts.name,
    repoLabel: opts.repoLabel ?? null,
  });
}

/**
 * Resolve the human-typable alias to the address.
 *
 * ⛔ AND THE ALIAS IS NOT THE ADDRESS. A slug is unique per owner and both parts can change — a
 * rename, or a transfer. A client config pins the id; this exists for somebody typing a URL.
 */
export async function projectBySlug(
  db: Db,
  owner: string,
  slug: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: projects.id, owner: projects.ownerId })
    .from(projects)
    .where(eq(projects.slug, slug));
  return rows.find((r) => r.owner === owner)?.id ?? null;
}

/**
 * ⛔ EXPORTED FOR A TEST, WITH THE CLOCK INJECTABLE. The real wait is two minutes; a test that
 * waited it would be a test nobody runs. The production path never passes the third argument.
 */
export const __serializeForTest = serialize;
