/**
 * Applying the checked-in migrations, against anything that can run a statement.
 *
 * ⛔ ONE MIGRATION PATH, NOT ONE PER DRIVER. The tests run against an in-process Postgres and the
 * container runs against a managed one; if those applied schema by different mechanisms, the thing
 * the tests proved would not be the thing that ships. So this takes a `run` function and the caller
 * supplies the driver — which is the same trick `loadCorpus` plays with `Store`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ⛔ FOUND BY WALKING UP, NOT BY A PATH RELATIVE TO `dist/`. This file is imported from `src/` under
 * `tsx` and from `dist/` once built, and a hardcoded `../../../drizzle` is correct in exactly one of
 * those. A missing migrations directory then looks like a database with no tables.
 */
export function migrationsDir(from: string = fileURLToPath(import.meta.url)): string {
  let here = path.dirname(from);
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(here, "drizzle");
    if (fs.existsSync(path.join(candidate, "meta", "_journal.json"))) return candidate;
    const up = path.dirname(here);
    if (up === here) break;
    here = up;
  }
  throw new Error(`no migrations directory found above ${from} — expected drizzle/meta/_journal.json`);
}

/**
 * Each migration, in journal order, with its statements.
 *
 * ⛔ ORDER COMES FROM THE JOURNAL, NOT FROM SORTING FILENAMES. `_journal.json` is what drizzle-kit
 * maintains and what records the intended sequence; filename sort happens to agree today and stops
 * agreeing the first time one is renamed.
 */
export function migrations(dir: string = migrationsDir()): Array<{ tag: string; statements: string[] }> {
  const journal = JSON.parse(fs.readFileSync(path.join(dir, "meta", "_journal.json"), "utf-8")) as {
    entries: Array<{ tag: string }>;
  };
  return journal.entries.map((entry) => ({
    tag: entry.tag,
    statements: fs
      .readFileSync(path.join(dir, `${entry.tag}.sql`), "utf-8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean),
  }));
}

/** Every statement across every migration. Used by tests, which always start from an empty database. */
export const migrationStatements = (dir?: string): string[] =>
  migrations(dir).flatMap((m) => m.statements);

const LEDGER = `create table if not exists _productos_migrations (
  tag text primary key,
  applied_at timestamptz not null default now()
)`;

/**
 * Apply whatever has not been applied.
 *
 * ⛔ IDEMPOTENT, BECAUSE A CONTAINER BOOTS MORE THAN ONCE. The first cut of this ran every statement
 * every time, which works exactly once: the second start dies on `relation already exists`, and a
 * crash-looping container with a healthy database looks like a database problem for as long as it
 * takes somebody to read the log.
 *
 * ⛔ AND THE LEDGER IS WRITTEN AFTER THE STATEMENTS, NOT BEFORE. Recording a migration that then
 * failed would skip it forever and leave a schema nobody can reconstruct from the table.
 *
 * `run` takes raw SQL so the caller supplies the driver — tests drive an in-process Postgres and the
 * container drives a managed one, and a single mechanism means the thing the tests proved is the
 * thing that ships.
 */
export async function applyMigrations(
  run: (sql: string) => Promise<unknown>,
  dir?: string,
  applied?: () => Promise<string[]>,
): Promise<{ applied: string[]; skipped: string[] }> {
  const all = migrations(dir);
  if (!applied) {
    /** No ledger reader: an empty target, which is what every test starts from. */
    for (const m of all) for (const stmt of m.statements) await run(stmt);
    return { applied: all.map((m) => m.tag), skipped: [] };
  }

  await run(LEDGER);
  const already = new Set(await applied());
  const done: string[] = [];
  const skipped: string[] = [];
  for (const m of all) {
    if (already.has(m.tag)) {
      skipped.push(m.tag);
      continue;
    }
    for (const stmt of m.statements) await run(stmt);
    await run(`insert into _productos_migrations (tag) values ('${m.tag.replace(/'/g, "''")}')`);
    done.push(m.tag);
  }
  return { applied: done, skipped };
}
