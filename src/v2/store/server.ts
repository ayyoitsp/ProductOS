/**
 * ProductOS as a container: one process, a Postgres behind it, config by env var only.
 *
 * ⛔ CONFIG BY ENV VAR ONLY, SO THE IMAGE IS THE SAME EVERYWHERE. It deploys unchanged to ACA, Cloud
 * Run, Fly, Railway or Render; the host stays a swappable decision and no platform-proprietary
 * primitive gets baked in.
 *
 * ⛔ AND THE LOCAL CASE IS THE SAME SERVICE. Hosted-first is not hosted-only: set
 * `PRODUCTOS_SINGLE_ACCOUNT` and the instance runs for one person with one account — a REAL account
 * and a real session, not a principal that skips the checks. A corpus that must never leave the
 * machine gets the identical loop, because the gate that protects a corpus naming a real client
 * must not become a punishment for using it.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";
import { type Db, isRefusal, storeFor } from "./access.js";
import { applyMigrations } from "./migrate.js";
import { migrateAllDocuments } from "./doc-migrations.js";
import { projects } from "./schema.js";
import { instanceRoute } from "./instance.js";
import { projectMcpRoute } from "./mcp.js";
import { chooseRoute } from "./choose.js";
import { authIsOff, singleAccount } from "./identity.js";

export interface HostedConfig {
  databaseUrl: string;
  port: number;
  /** When set, the instance runs for this one account. ⛔ Absent means hosted: sign in or bring a token. */
  singleAccount?: string;
}

/**
 * ⛔ IT REFUSES TO START WITHOUT A DATABASE RATHER THAN DEFAULTING TO ONE.
 *
 * A default connection string is how a container comes up pointed at the wrong Postgres and serves
 * an empty corpus that looks like a corpus somebody lost. Failing closed is a worse boot and a much
 * better morning.
 */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): HostedConfig {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Refusing to start — an instance with no store would serve an empty " +
        "corpus that is indistinguishable from one somebody lost.",
    );
  }
  return {
    databaseUrl,
    port: Number(env.PORT ?? 4100),
    singleAccount: env.PRODUCTOS_SINGLE_ACCOUNT?.trim() || undefined,
  };
}

export function openStore(databaseUrl: string): { db: Db; close: () => Promise<void> } {
  /**
   * ⛔ COUNT THE QUERIES WHEN SOMETHING IS SLOW, RATHER THAN REASONING ABOUT THEM.
   *
   * Every query to a hosted Postgres costs about the same — a 37KB document read
   * measured the same as `select 1`, so latency is round trips and nothing else. That
   * makes "how many did this request make" the only question worth asking, and it was
   * the one I kept answering by reading code and getting wrong: three by inspection,
   * about nine in fact.
   *
   * `PRODUCTOS_DB_DEBUG=1` prints one line per query. Off by default — it would put a
   * customer's corpus in a log.
   */
  const debug = process.env.PRODUCTOS_DB_DEBUG === "1";
  let n = 0;
  const client = postgres(databaseUrl, {
    max: 10,
    ...(debug
      ? {
          debug: (_conn: number, query: string) => {
            n += 1;
            process.stderr.write(`[db ${String(n).padStart(3)}] ${query.replace(/\s+/g, " ").slice(0, 110)}\n`);
          },
        }
      : {}),
    /**
     * ⛔ A NOTICE IS NOT A FAULT, AND BY DEFAULT IT LOOKS EXACTLY LIKE ONE.
     *
     * `create table if not exists` raises `42P07` on every boot after the first, and postgres-js
     * prints the whole notice object — so a perfectly clean restart logged a thirteen-line block
     * that reads as a database error. That is the same failure the migration ledger exists to
     * prevent, inverted: somebody chasing a problem that is not there instead of missing one that
     * is. Found by restarting the container, which is the only place it shows up.
     *
     * One line, prefixed, so it stays greppable without pretending nothing was said.
     */
    onnotice: (notice) => {
      if (notice.code === "42P07") return; // the ledger already exists; that is the normal case
      process.stderr.write(`[productos] postgres: ${notice.message}\n`);
    },
  });
  return {
    db: drizzle(client) as unknown as Db,
    close: () => client.end({ timeout: 5 }),
  };
}

/**
 * Rows out of a raw `execute`, whichever driver answered.
 *
 * ⛔ THE DRIVER THE TESTS RUN AND THE DRIVER THAT SHIPS DISAGREE ABOUT THIS. `postgres-js` returns
 * an array; PGlite returns `{ rows }`. Assuming either one means the migration ledger reads as
 * empty on the other — and an empty ledger re-applies every migration, which is the exact failure
 * the ledger exists to prevent, now disguised as working code.
 */
export const rowsOf = <T>(result: unknown): T[] =>
  Array.isArray(result) ? (result as T[]) : (((result as { rows?: T[] })?.rows ?? []) as T[]);

/** Bring the schema up to the checked-in migrations. ⛔ Idempotent — a container boots more than once. */
export async function migrateStore(
  db: Db,
): Promise<{ applied: string[]; skipped: string[]; renamed: Array<{ from: string; to: string }>; ahead: string[] }> {
  const run = async (statement: string): Promise<unknown> => db.execute(sql.raw(statement));
  return applyMigrations(run, undefined, async () =>
    rowsOf<{ tag: string; statements_sha: string | null }>(
      await db.execute(sql.raw("select tag, statements_sha from _productos_migrations")),
    ).map((r) => ({ tag: r.tag, sha: r.statements_sha ?? null })),
  );
}

/**
 * Remove scratch directories a dead process left behind.
 *
 * ⛔ `finally` DOES NOT RUN ON SIGKILL, AND THAT IS THE ONLY WAY THESE LEAK. Every request
 * materializes the corpus under `os.tmpdir()` and removes it on the way out, including on a throw —
 * but an OOM kill or a `docker kill` skips that, and nothing swept. One abandoned copy of a corpus
 * per hard kill is small; a container that has been restarting for a month is a disk somebody has
 * to go and look at, and the symptom will not mention ProductOS.
 *
 * ⛔ AGE-GATED, BECAUSE A SECOND INSTANCE MAY BE MID-REQUEST. Inside a container the temp directory
 * is the container's own, so a boot sweep would be safe — but `npm run dev:hosted` shares `/tmp`
 * with whatever else is running, and deleting a live request's corpus would be a far worse bug than
 * the one being fixed. An hour is longer than any request and shorter than anybody cares about.
 */
export function sweepScratch(
  olderThanMs = 60 * 60 * 1000,
  tmp: string = os.tmpdir(),
  now: number = Date.now(),
): string[] {
  const removed: string[] = [];
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(tmp);
  } catch {
    return removed;
  }
  for (const name of entries) {
    if (!name.startsWith("productos-project-")) continue;
    const full = path.join(tmp, name);
    try {
      if (now - fs.statSync(full).mtimeMs < olderThanMs) continue;
      fs.rmSync(full, { recursive: true, force: true });
      removed.push(name);
    } catch {
      /** ⛔ Reported by omission, never thrown — a failed cleanup must not stop an instance booting. */
    }
  }
  return removed;
}

export async function startHosted(
  config: HostedConfig = configFromEnv(),
): Promise<{ server: http.Server; url: string; close: () => Promise<void> }> {
  const swept = sweepScratch();
  if (swept.length) process.stderr.write(`[productos] swept ${swept.length} abandoned scratch directories\n`);

  const { db, close } = openStore(config.databaseUrl);

  const migrated = await migrateStore(db);
  /**
   * ⛔ SAID OUT LOUD, BECAUSE SILENCE HERE IS INDISTINGUISHABLE FROM NOTHING HAVING HAPPENED. A
   * migration recognised under a name a merge changed was applied by a branch, not by this boot;
   * reporting it as applied would be a lie and reporting nothing leaves no trace of the rename.
   */
  for (const r of migrated.renamed) {
    process.stderr.write(`[productos] ${r.from} was already applied — recorded now as ${r.to}\n`);
  }
  if (migrated.ahead.length) {
    process.stderr.write(
      `[productos] ⚠ booting against a store migrated by newer code: ${migrated.ahead.join(", ")} ` +
        `(PRODUCTOS_ALLOW_SCHEMA_AHEAD is set)\n`,
    );
  }
  if (migrated.applied.length) {
    process.stderr.write(`[productos] applied migrations: ${migrated.applied.join(", ")}\n`);
  }

  /**
   * Open the connections before a person is waiting on them.
   *
   * ⛔ AND WHAT THIS DID NOT DO, SINCE I BUILT IT ON A WRONG THEORY. I thought TLS handshakes
   * explained why making independent reads concurrent took a page from 1.2s to 0.9s rather than the
   * 4x the round-trip arithmetic promised. Warming made no measurable difference to a warm request,
   * so that was not it — the real answer was that the page render costs ~0.9s whether the store is
   * in Neon or on localhost, which `scripts/bench-store.mjs` and a local comparison both show.
   *
   * It stays because it still moves the first request's connection setup to boot, which is a small
   * real thing. It is not a latency fix, and the comment says so rather than implying one.
   */
  const warm = Math.max(1, Number(process.env.PRODUCTOS_POOL_WARM ?? 4));
  try {
    await Promise.all(Array.from({ length: warm }, () => db.execute(sql.raw("select 1"))));
    process.stderr.write(`[productos] ${warm} connections warm\n`);
  } catch {
    /** Reported by its absence in the log. */
  }

  /**
   * ⛔ THE DOCUMENTS, BROUGHT FORWARD TOO — AND BEFORE ANYTHING IS SERVED.
   *
   * Peter: *"as we move the schema forward, the server ensures the database is up to date"*. The
   * store's own shape is handled above; this is the other half, because a schema change that
   * removes a key does not merely degrade an old corpus — `check` answers
   * `cannot-judge-this-corpus`, so the corpus is offline until something migrates it.
   *
   * Running it here rather than on first read means nobody opens a page that is about to change
   * underneath them, and the cost is paid once per boot instead of once per request.
   */
  const migratedDocs = await migrateAllDocuments(db, async (projectId) => {
    const [row] = await db.select({ owner: projects.ownerId }).from(projects).where(eq(projects.id, projectId));
    if (!row) return null;
    const reached = await storeFor(db, { kind: "browser", account: row.owner, reach: [] }).project(projectId);
    return isRefusal(reached) ? null : reached;
  });
  for (const a of migratedDocs.applied) {
    process.stderr.write(`[productos] ${a.migration}: brought ${a.documents.length} document(s) up to date\n`);
  }
  if (migratedDocs.failed.length) {
    /** ⛔ Named, because a project that could not be migrated is one somebody has to look at. */
    process.stderr.write(
      `[productos] ⚠ could not migrate documents for: ${migratedDocs.failed.join(", ")}\n`,
    );
  }

  /**
   * ⛔ ONE SESSION FOR THE LOCAL CASE, ESTABLISHED AT BOOT. `singleAccount` is idempotent, so a
   * restart reuses the session rather than minting one per boot and leaving a trail of them.
   */
  const localSession = config.singleAccount
    ? (await singleAccount(db, config.singleAccount)).session
    : undefined;
  if (config.singleAccount) {
    process.stderr.write(`[productos] single-account mode: ${config.singleAccount}\n`);
  }

  /**
   * ⛔ SAID EVERY BOOT, AND NOT QUIETLY. An instance with auth off looks identical to one with auth
   * on until somebody else finds the port — and by then every verdict in it is unprovable. A banner
   * nobody can miss is the only honest way to run in this state.
   */
  if (authIsOff()) {
    process.stderr.write(
      "\n[productos] ⛔ AUTH IS OFF (PRODUCTOS_AUTH=off)\n" +
        "[productos]    Every request is treated as a signed-in person, and every project is reachable.\n" +
        "[productos]    Verdicts written now are ones NOBODY CAN PROVE A HUMAN MADE — tenet 1 does not\n" +
        "[productos]    hold while this is set. Fine on a laptop; never on anything reachable.\n\n",
    );
  }

  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? "/", "http://instance").pathname;

      /**
       * ⛔ HEALTH IS NOT BEHIND AUTH AND SAYS NOTHING ABOUT A CORPUS. A platform probe has no
       * credential, and a health endpoint that leaked project names would be a customer list on an
       * unauthenticated route.
       */
      if (pathname === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, service: "productos", version: "0.1.0" }));
        return;
      }

      /** The root: which product are you looking at. ⛔ Claims only `/` and `/projects`. */
      if (await chooseRoute(req, res, pathname, { db, localSession })) return;

      /** ⛔ MCP first: `/p/<id>/mcp` would otherwise be swallowed by the instance route's catch-all. */
      if (await projectMcpRoute(req, res, pathname, { db, localSession })) return;
      if (await instanceRoute(req, res, pathname, { db, localSession })) return;

      res.writeHead(404, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: "not_found",
          detail: ["a corpus is addressed as /p/<project-id>/…", "MCP is at /p/<project-id>/mcp"],
        }),
      );
    } catch (e) {
      /** ⛔ A thrown error must not take the process down and restart every open connection. */
      process.stderr.write(`[productos] ${(e as Error).stack ?? (e as Error).message}\n`);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "internal_error", message: (e as Error).message }));
      } else {
        res.end();
      }
    }
  });

  await new Promise<void>((resolve) => server.listen(config.port, resolve));
  const url = `http://0.0.0.0:${config.port}`;
  process.stderr.write(`[productos] listening on ${url}\n`);

  return {
    server,
    url,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await close();
    },
  };
}
