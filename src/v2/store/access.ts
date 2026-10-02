/**
 * ⛔ THE ONLY DOOR TO A DOCUMENT, AND IT TAKES A PROJECT ON THE WAY IN.
 *
 * Shared rows mean one missing `WHERE` leaks a customer's roadmap. A review habit does not survive
 * a year of edits, so the boundary is made unwritable instead: this module exports no function that
 * returns a document accessor, and `ProjectStore`'s methods take no project id. The only way to get
 * one is `storeFor(db, who).project(id)`, which authorizes first. An unscoped query therefore does
 * not typecheck — the same move as "no delete route exists", one layer down.
 *
 * ⛔ THE SCOPE IS THE PROJECT, NOT THE OWNER. So this survives the owner model changing: an owning
 * group arriving above accounts later does not touch a line in here.
 */
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Refusal } from "../identity.js";
import { authIsOff } from "./identity.js";
import { documents, events, projectMembers, projects } from "./schema.js";

/** Any drizzle Postgres instance. ⛔ The driver is the caller's business — see `migrate.ts`. */
export type Db = PgDatabase<PgQueryResultHKT, Record<string, unknown>, Record<string, never>>;

/**
 * Who is asking, in the terms this layer needs.
 *
 * ⛔ `kind` IS CARRIED THROUGH UNCHANGED AND NEVER RECOMPUTED HERE. Whether a request is a browser
 * session or a token is decided once, in `principalOf`, and consent is gated on it in `mayRecord`.
 * A second opinion about it in the store would be a second place the guarantee could be wrong.
 */
export interface Who {
  kind: "browser" | "token";
  /** The account. For a token, the account that issued it. */
  account: string;
  /** Empty means every project the account can reach — ⛔ never every project. */
  reach: readonly string[];
}

export interface StoredEvent {
  seq: number;
  kind: string;
  payload: Record<string, unknown>;
  at: Date;
}

/** A corpus, already scoped. ⛔ No method here takes a project id, by design. */
export interface ProjectStore {
  readonly projectId: string;

  /**
   * Every document, keyed by the path a directory would give it.
   *
   * ⛔ THE SHAPE `memoryStore` ALREADY EATS. One parser reads a corpus whether it came off a disk,
   * over HTTP or out of here, so there is one set of refusals and one set of `broken` messages. A
   * store that parsed for itself would be a second implementation of the model.
   */
  documents(): Promise<Record<string, string>>;

  put(path: string, source: string, projection?: Record<string, unknown>): Promise<void>;
  /** ⛔ Nothing is deleted. */
  deprecate(path: string): Promise<void>;

  append(kind: string, payload?: Record<string, unknown>): Promise<number>;
  since(cursor: number, limit?: number): Promise<StoredEvent[]>;
}

export interface Reachable {
  /** Projects this principal may address, as ids. */
  reachable(): Promise<string[]>;
  /** ⛔ Authorizes, then scopes. A `Refusal` is the only other thing it can return. */
  project(id: string): Promise<ProjectStore | Refusal>;
}

/**
 * ⛔ ONE REFUSAL FOR "NO SUCH PROJECT" AND "NOT YOURS", DELIBERATELY.
 *
 * Telling the two apart lets anybody holding one token enumerate every project id on the instance
 * by watching which ones answer differently — the customer list, for free, with no write access and
 * nothing in a log that looks like an attack. So the message is identical and says nothing about
 * existence.
 */
const unreachable = (id: string): Refusal => ({
  ok: false,
  why: `no project here that you can reach: ${id}`,
  detail: [
    "either it does not exist or it is not yours — ⛔ this refusal does not say which, on purpose",
    "a credential that can tell those apart can enumerate every customer on the instance",
  ],
});

export const isRefusal = (x: ProjectStore | Refusal): x is Refusal => (x as Refusal).ok === false;

export function storeFor(db: Db, who: Who): Reachable {
  async function reachable(): Promise<string[]> {
    /**
     * ⛔ WITH AUTH OFF, EVERY PROJECT IS REACHABLE — or the switch does not do what it says.
     *
     * Leaving this narrowed to the one account's own projects would keep handing out 404s for
     * anything created under a different address, which is the exact confusion `PRODUCTOS_AUTH=off`
     * exists to remove. The isolation seam itself is untouched: `project(id)` still goes through
     * this function, so there is still exactly one place that decides, and turning auth back on
     * restores the boundary without a code change.
     */
    if (authIsOff()) {
      const all = await db.select({ id: projects.id }).from(projects);
      return all.map((r) => r.id);
    }

    /**
     * ⛔ CONCURRENT, BECAUSE THEY DO NOT NEED EACH OTHER AND A ROUND TRIP IS 90ms.
     *
     * Measured against Neon in us-east-2: one trip ~90ms, five sequential 611ms, the
     * same five concurrent 157ms. These two selects were awaited in series for no
     * reason — owned projects and shared ones are independent, so waiting for the
     * first before asking for the second bought a whole trip per request. Against a
     * local Postgres that was invisible; against a hosted one it is most of the page.
     */
    const [owned, shared] = await Promise.all([
      db.select({ id: projects.id }).from(projects).where(eq(projects.ownerId, who.account)),
      db
        .select({ id: projectMembers.projectId })
        .from(projectMembers)
        .where(eq(projectMembers.accountId, who.account)),
    ]);

    const all = new Set<string>([...owned.map((r) => r.id), ...shared.map((r) => r.id)]);

    // ⛔ A token's `reach` NARROWS what its account can see and can never widen it. So this is an
    // intersection, never a union — a revoked membership must take the token's access with it.
    if (who.reach.length === 0) return [...all];
    return who.reach.filter((id) => all.has(id));
  }

  return {
    reachable,
    async project(id) {
      if (!(await reachable()).includes(id)) return unreachable(id);
      return projectStore(db, id);
    },
  };
}

function projectStore(db: Db, projectId: string): ProjectStore {
  return {
    projectId,

    async documents() {
      const rows = await db
        .select({ path: documents.path, source: documents.source })
        .from(documents)
        .where(and(eq(documents.projectId, projectId), isNull(documents.deprecatedAt)));
      const out: Record<string, string> = {};
      for (const r of rows) out[r.path] = r.source;
      return out;
    },

    async put(path, source, projection) {
      await db
        .insert(documents)
        .values({ projectId, path, source, projection: projection ?? null })
        .onConflictDoUpdate({
          target: [documents.projectId, documents.path],
          set: { source, projection: projection ?? null, updatedAt: new Date(), deprecatedAt: null },
        });
    },

    async deprecate(path) {
      await db
        .update(documents)
        .set({ deprecatedAt: new Date() })
        .where(and(eq(documents.projectId, projectId), eq(documents.path, path)));
    },

    /**
     * ⛔ `seq` IS ALLOCATED UNDER THE PRIMARY KEY, NOT TRUSTED FROM A READ. Two sessions appending
     * at once both compute the same next number; the key rejects the loser and it retries. A
     * sequence shared across projects would be the easy alternative, and would make one project's
     * cursor move because a different project changed.
     */
    async append(kind, payload = {}) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const [row] = await db
          .select({ max: sql<number>`coalesce(max(${events.seq}), 0)` })
          .from(events)
          .where(eq(events.projectId, projectId));
        const seq = Number(row?.max ?? 0) + 1;
        try {
          await db.insert(events).values({ projectId, seq, kind, payload });
          return seq;
        } catch (e) {
          if (!/duplicate key|unique/i.test((e as Error).message ?? "")) throw e;
        }
      }
      throw new Error(`could not allocate an event seq for ${projectId} after 8 attempts`);
    },

    async since(cursor, limit = 100) {
      return db
        .select({ seq: events.seq, kind: events.kind, payload: events.payload, at: events.at })
        .from(events)
        .where(and(eq(events.projectId, projectId), gt(events.seq, cursor)))
        .orderBy(asc(events.seq))
        .limit(limit);
    },
  };
}
