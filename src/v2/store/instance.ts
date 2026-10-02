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
import { CORPUS_DIRS, corpusFiles } from "../load.js";
import { appendedLines, writeLog } from "./corpus.js";
import { v2Route } from "../serve.js";
import { type Db, isRefusal, type ProjectStore, storeFor } from "./access.js";
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

function serialize<T>(key: string, work: () => Promise<T>): Promise<T> {
  const prior = writing.get(key) ?? Promise.resolve();
  const next = prior.then(work, work);
  writing.set(
    key,
    next.catch(() => undefined),
  );
  return next;
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
}

export async function materializeProject(store: ProjectStore): Promise<Materialized> {
  /**
   * ⛔ ONE ROUND TRIP, NOT TWO. The documents and the log are independent reads, and
   * asking for the second only after the first arrived cost a full trip — 90ms against
   * Neon, on every single request, for nothing. `scripts/bench-store.mjs` is where that
   * number came from and is how to check it again.
   */
  const [documents, events] = await Promise.all([store.documents(), store.since(0, LOG_CEILING)]);
  const dir = materialize(documents);
  const logHad = writeLog(dir, events);
  return { dir, documents, logHad };
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

  const now = await store.documents();
  const conflict = [...changed, ...removed].filter((k) => (now[k] ?? undefined) !== (before[k] ?? undefined));
  if (conflict.length) return { conflict };

  for (const key of changed) await store.put(key, after[key]!);
  /** ⛔ Deprecated, never deleted — the store has no delete path to call. */
  for (const key of removed) await store.deprecate(key);

  /**
   * ⛔ IN ORDER, AND AFTER THE DOCUMENTS. An event announcing a change that is not in the store yet
   * would wake a session to read truth that has not landed.
   */
  for (const e of appended) {
    const { kind, ...rest } = e as { kind?: string };
    await store.append(String(kind ?? "corpus-changed"), rest as Record<string, unknown>);
  }

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
    const { dir, documents: before, logHad } = await materializeProject(reached);
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
        who,
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

      const result = await writeBack(reached, before, dir, logHad);
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
      fs.rmSync(path.dirname(dir), { recursive: true, force: true });
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
