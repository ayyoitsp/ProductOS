/**
 * Bringing stored documents forward when the corpus schema moves.
 *
 * Peter: *"migration should be server maintained - as we move the schema forward, the server ensures
 * the database is up to date. so we should have tracked migrations"*.
 *
 * ⛔ THIS IS A SECOND KIND OF MIGRATION AND CONFLATING THEM WOULD BE A MISTAKE. `migrate.ts` moves
 * the SHAPE OF THE STORE — tables, columns, indexes — and is tracked in `_productos_migrations`.
 * This moves the CONTENT OF DOCUMENTS, which the store holds as opaque text precisely so it has no
 * opinion about it. One ledger for both would make "the database is current" mean two things.
 *
 * ⛔ WHY IT HAS TO EXIST AT ALL. `walked` was removed from the schema deliberately — there is a ⛔ in
 * `schema.ts` saying so — and nothing migrated the corpora that already used it. The result is not a
 * warning: `check` reports `cannot-judge-this-corpus`, because two files would not load and every
 * other finding would be computed against a corpus missing part of itself. So a schema removal with
 * no migration does not degrade a corpus, it takes it offline.
 *
 * ⛔ AND IT REWRITES TRUTH, SO IT LEAVES A RECORD. `CLAUDE.md` is emphatic that nothing silently
 * rewrites a corpus. Every application appends to the project's event log saying which rule ran and
 * which documents it touched, and the per-project ledger means it runs exactly once. A reader who
 * finds a sentence changed can see what changed it.
 */
import { and, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { Db, ProjectStore } from "./access.js";
import { documentMigrations as ledger, documents, projects } from "./schema.js";
import { rowsOf } from "./server.js";

export interface DocMigration {
  /** Stable, ordered, never reused. ⛔ The ledger stores this, so renaming one re-runs it. */
  id: string;
  /** What moved in the schema, and why a corpus cannot simply be left alone. */
  why: string;
  /**
   * The rewrite. Returns the new source, or `null` to leave the document untouched.
   *
   * ⛔ RETURNING `null` IS NOT THE SAME AS RETURNING THE INPUT. Unchanged documents must not be
   * written at all: a no-op `put` bumps `updated_at` on every document in every project on the
   * first boot after a migration lands, which destroys the only signal anybody has for "what moved
   * recently".
   */
  apply: (path: string, source: string) => string | null;
}

/**
 * ⛔ ONE RULE PER SCHEMA CHANGE, IN ORDER, APPEND-ONLY.
 *
 * A rule is only correct for the shape of document that existed when it was written, so editing an
 * old one changes what already ran against corpora nobody can re-check. Add a new rule instead.
 */
export const DOC_MIGRATIONS: DocMigration[] = [
  {
    id: "0001-drop-walked",
    why:
      "`walked` was removed from `View` — Peter: \"how do we 'walk a screen' so that this never " +
      "shows?\" — and every corpus written before the removal still carries it, which makes the " +
      "whole corpus unjudgeable rather than merely imperfect.",
    apply: (path, source) => {
      if (!path.startsWith("truth/") || !/^\s*walked:\s*(true|false)\s*$/m.test(source)) return null;
      /**
       * ⛔ WHOLE LINES, AND ONLY IN FRONTMATTER-SHAPED INDENTATION. A YAML-reserialise would
       * reformat every document it touched and lose comment placement and key order — and the
       * byte-identical export assertion is over exactly those bytes. Deleting the line the key
       * sits on is the smallest change that makes the file parse.
       */
      const out = source
        .split("\n")
        .filter((line) => !/^\s*walked:\s*(true|false)\s*$/.test(line))
        .join("\n");
      return out === source ? null : out;
    },
  },
];

export interface Applied {
  migration: string;
  documents: string[];
}

/**
 * Apply whatever has not been applied, to one project.
 *
 * ⛔ PER PROJECT, NOT PER INSTANCE. Projects arrive by import at any time, so a corpus added after a
 * migration ran would otherwise never see it — and would be the one broken corpus on an instance
 * that believes it is current.
 */
export async function migrateDocuments(
  db: Db,
  store: ProjectStore,
  registry: DocMigration[] = DOC_MIGRATIONS,
): Promise<Applied[]> {
  const done = new Set(
    rowsOf<{ migration_id: string }>(
      await db.execute(
        sql`select migration_id from ${ledger} where ${ledger.projectId} = ${store.projectId}`,
      ),
    ).map((r) => r.migration_id),
  );

  const applied: Applied[] = [];

  for (const rule of registry) {
    if (done.has(rule.id)) continue;

    const sources = await store.documents();
    const touched: string[] = [];
    for (const [path, source] of Object.entries(sources)) {
      const next = rule.apply(path, source);
      if (next === null) continue;
      await store.put(path, next);
      touched.push(path);
    }

    /**
     * ⛔ RECORDED EVEN WHEN IT CHANGED NOTHING. A rule that found nothing to do has still been
     * applied to this project, and leaving it unrecorded means re-reading every document in every
     * project on every boot, forever.
     */
    await db
      .insert(ledger)
      .values({ projectId: store.projectId, migrationId: rule.id, documents: touched })
      .onConflictDoNothing();

    if (touched.length) {
      /** ⛔ In the log a reader already reads, so a changed sentence has something to point at. */
      await store.append("corpus-migrated", {
        at: new Date().toISOString(),
        by: "the server",
        ref: rule.id,
        says: `brought ${touched.length} document(s) up to date — ${rule.id}`,
        detail: touched,
      });
    }
    applied.push({ migration: rule.id, documents: touched });
  }

  return applied;
}

/**
 * Every project, brought up to date.
 *
 * ⛔ AT BOOT, BEFORE ANYTHING IS SERVED, so nobody reads a corpus that is about to change under
 * them. Best effort per project: one corpus that cannot be migrated must not stop an instance
 * starting, or a single bad document takes every other project down with it.
 */
export async function migrateAllDocuments(
  db: Db,
  reach: (projectId: string) => Promise<ProjectStore | null>,
): Promise<{ projects: number; applied: Applied[]; failed: string[] }> {
  const all = await db.select({ id: projects.id }).from(projects);
  const out: Applied[] = [];
  const failed: string[] = [];

  for (const { id } of all) {
    try {
      const store = await reach(id);
      if (!store) continue;
      out.push(...(await migrateDocuments(db, store)).filter((a) => a.documents.length));
    } catch {
      failed.push(id);
    }
  }
  return { projects: all.length, applied: out, failed };
}

export { documents, inArray, and, eq };
