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
import http from "node:http";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import type { Db } from "./access.js";
import { applyMigrations } from "./migrate.js";
import { instanceRoute } from "./instance.js";
import { projectMcpRoute } from "./mcp.js";
import { singleAccount } from "./identity.js";

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
  const client = postgres(databaseUrl, {
    max: 10,
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
export async function migrateStore(db: Db): Promise<{ applied: string[]; skipped: string[] }> {
  const run = async (statement: string): Promise<unknown> => db.execute(sql.raw(statement));
  return applyMigrations(run, undefined, async () =>
    rowsOf<{ tag: string }>(await db.execute(sql.raw("select tag from _productos_migrations"))).map(
      (r) => r.tag,
    ),
  );
}

export async function startHosted(
  config: HostedConfig = configFromEnv(),
): Promise<{ server: http.Server; url: string; close: () => Promise<void> }> {
  const { db, close } = openStore(config.databaseUrl);

  const migrated = await migrateStore(db);
  if (migrated.applied.length) {
    process.stderr.write(`[productos] applied migrations: ${migrated.applied.join(", ")}\n`);
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
