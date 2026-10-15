/**
 * What one request did, said in one line.
 *
 * ⛔ THE INSTANCE COULD NOT TELL ANYBODY WHERE A REQUEST'S TIME WENT, AND IT COST A DAY.
 *
 * Peter: *"should we add logs or instrumentation? this is ridiculous"*. He is right, and the
 * evidence is the whole of PT-0007. Every number came from a bespoke harness, and the harness was
 * wrong about the environment SIX TIMES in one session:
 *
 *   · a synthetic corpus instead of Bilrost's — the real render was 18x slower
 *   · a corpus read from FILES while the instance reads a store
 *   · a browser probe that measured `about:blank`
 *   · a CPU profile of an empty corpus, reporting the render as free
 *   · a local store with no network, so round trips were invisible
 *   · `PRODUCTOS_AUTH` on, while the instance runs it off — so the trip counts I reported were for
 *     a configuration nobody is running
 *
 * The deploy session fared no better from outside: three TTFB readings of the same unchanged page
 * came back 71.7s, 40.9s and 26.7s, and a 273 kB page took 5.8s in the same minute. Nobody could
 * say why, because nothing on the inside was counting.
 *
 * ⛔ SO THIS COUNTS WHAT NO HARNESS CAN GUESS AT: how many times the request crossed the network,
 * how long it waited there, and whether the corpus it served was read or reused. Those three answer
 * every question this sweep had to build a tool for.
 *
 * ⛔ AND IT IS PER REQUEST UNDER CONCURRENCY, which is why this is `AsyncLocalStorage` and not a
 * counter. The instance serves overlapping requests — the deploy session's own isolation check
 * fired four at once — and a module-level counter would attribute one request's queries to another,
 * which is a measurement that lies rather than one that is merely missing.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface Trace {
  queries: number;
  dbMs: number;
  /** Whether the corpus came out of the read cache, was laid out again, or was never wanted. */
  corpus: "cached" | "read" | "untouched";
  /** Whether the materialized directory was reused rather than written out again. */
  dir: "reused" | "laid-out" | "untouched";
}

const store = new AsyncLocalStorage<Trace>();

/** Run something with a fresh trace, and hand the trace back alongside whatever it returned. */
export async function traced<T>(fn: () => Promise<T>): Promise<{ out: T; trace: Trace }> {
  const trace: Trace = { queries: 0, dbMs: 0, corpus: "untouched", dir: "untouched" };
  const out = await store.run(trace, fn);
  return { out, trace };
}

/** The trace this request is in, if it is in one. ⛔ Absent off the request path, never a throw. */
export const nowTracing = (): Trace | undefined => store.getStore();

export function noteQuery(ms: number): void {
  const t = store.getStore();
  if (!t) return;
  t.queries++;
  t.dbMs += ms;
}

export function noteCorpus(how: Trace["corpus"]): void {
  const t = store.getStore();
  if (t) t.corpus = how;
}

export function noteDir(how: Trace["dir"]): void {
  const t = store.getStore();
  if (t) t.dir = how;
}

/**
 * Count every statement against the request that made it.
 *
 * ⛔ AT DRIZZLE, NOT AT THE DRIVER — and the first version of this got that wrong in the way this
 * repo warns about most. I hooked `postgres-js`, which is what SHIPS, so the count was zero under
 * PGlite, which is what the TESTS run. An untested counter is a counter that silently breaks, and
 * `server.ts` already carries a ⛔ about the two drivers disagreeing. Drizzle's logger fires for
 * both, so what the suite exercises is what the instance does.
 *
 * ⛔ A COUNT, NOT A DURATION, AND THAT LIMIT IS REAL. The logger fires when a statement is issued
 * and says nothing about when it came back, so there is no honest per-query time here — `db=5q` is
 * exact and `db=5q/412ms` would be invented. The count is the number that mattered anyway: what
 * made the hosted page slow was how many times it crossed the network, and I twice drew the wrong
 * conclusion from counting that by hand.
 */
export const queryCounter = { logQuery: (): void => noteQuery(0) };

/**
 * One line per request, on stderr beside everything else the instance says.
 *
 * ⛔ GREPPABLE AND FIXED-SHAPE, because the point is to be able to ask "which requests were slow
 * and what were they waiting on" without writing a parser. `db=` is the half a harness cannot see
 * from outside, and `corpus=` is the one that says whether the caching is actually working — the
 * question I could only answer today by grepping a container's `dist`.
 */
export function line(
  method: string,
  path: string,
  status: number,
  bytes: number,
  ms: number,
  trace: Trace
): string {
  const parts = [
    `${method} ${path}`,
    String(status),
    `${bytes}b`,
    `${ms}ms`,
    `db=${trace.queries}q`,
    `corpus=${trace.corpus}`,
    `dir=${trace.dir}`,
  ];
  return `[productos] ${parts.join(" ")}\n`;
}

/**
 * ⛔ OFF BY DEFAULT WOULD MAKE THIS USELESS, which is the lesson of it having been absent. A log
 * nobody turned on is a log nobody has when they need it — and the moment anybody needs this, the
 * slow request has already happened. `PRODUCTOS_QUIET=1` is the way out for anyone who wants
 * silence, rather than a flag somebody has to know to set first.
 */
export const tracingOn = (env: NodeJS.ProcessEnv = process.env): boolean => env.PRODUCTOS_QUIET !== "1";
