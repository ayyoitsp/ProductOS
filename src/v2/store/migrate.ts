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
 * Every statement, in journal order.
 *
 * ⛔ ORDER COMES FROM THE JOURNAL, NOT FROM SORTING FILENAMES. `_journal.json` is what drizzle-kit
 * maintains and what records the intended sequence; filename sort happens to agree today and stops
 * agreeing the first time one is renamed.
 */
export function migrationStatements(dir: string = migrationsDir()): string[] {
  const journal = JSON.parse(fs.readFileSync(path.join(dir, "meta", "_journal.json"), "utf-8")) as {
    entries: Array<{ tag: string }>;
  };
  const out: string[] = [];
  for (const entry of journal.entries) {
    const sql = fs.readFileSync(path.join(dir, `${entry.tag}.sql`), "utf-8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

/** Applies every statement in order. Idempotent only if the target is empty — see `migrate.ts` note. */
export async function applyMigrations(
  run: (sql: string) => Promise<unknown>,
  dir?: string,
): Promise<number> {
  const statements = migrationStatements(dir);
  for (const stmt of statements) await run(stmt);
  return statements.length;
}
