/**
 * Applying the checked-in migrations, against anything that can run a statement.
 *
 * ⛔ ONE MIGRATION PATH, NOT ONE PER DRIVER. The tests run against an in-process Postgres and the
 * container runs against a managed one; if those applied schema by different mechanisms, the thing
 * the tests proved would not be the thing that ships. So this takes a `run` function and the caller
 * supplies the driver — which is the same trick `loadCorpus` plays with `Store`.
 */
import crypto from "node:crypto";
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
export function migrations(dir: string = migrationsDir()): Array<{ tag: string; statements: string[]; sha: string }> {
  const journal = JSON.parse(fs.readFileSync(path.join(dir, "meta", "_journal.json"), "utf-8")) as {
    entries: Array<{ tag: string }>;
  };
  return journal.entries.map((entry) => {
    const statements = fs
      .readFileSync(path.join(dir, `${entry.tag}.sql`), "utf-8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    return { tag: entry.tag, statements, sha: shaOf(statements) };
  });
}

/**
 * What a migration IS, independent of what it is called.
 *
 * ⛔ THE LEDGER KEYED ON THE NAME, AND THE NAME IS THE ONE PART THAT CHANGES. Two branches each run
 * `drizzle-kit generate` and both get an `0003_*`; merging forces one to be renumbered, and a
 * renamed tag is a tag the ledger has never seen — so its statements run a second time against a
 * schema that already has them, and every boot dies on `relation already exists`. `migrations()`
 * above already refuses to trust filenames for ORDER, for the same reason, one layer up.
 */
export const shaOf = (statements: string[]): string =>
  crypto.createHash("sha256").update(statements.join("\n--\n")).digest("hex").slice(0, 16);

/** Every statement across every migration. Used by tests, which always start from an empty database. */
export const migrationStatements = (dir?: string): string[] =>
  migrations(dir).flatMap((m) => m.statements);

/**
 * ⛔ TWO BRANCHES BOTH CALLING THEIR MIGRATION 0003, FOUND BEFORE THE MERGE RATHER THAN AFTER.
 *
 * Peter: *"i think we should have some rudimentary collision detction for migrations - like schema
 * migrations are numbered, and they go up 0001.sql or whatever"*.
 *
 * The number is the whole mechanism — journal order, filename, and the sequence a reader assumes
 * when deciding what runs after what — and `drizzle-kit generate` picks it from whatever is on
 * disk, so two branches working at once both reach for the same one with nothing to notice. After
 * the merge the tree has two 0003s and the journal has two entries claiming index 3, and which one
 * runs first depends on which branch wrote the journal last.
 *
 * ⛔ AND RENUMBERING IS WHAT YOU DO ABOUT IT, WHICH IS ONLY SAFE BECAUSE OF THE LEDGER ABOVE. A
 * renamed tag used to mean a migration already applied running a second time; the content hash now
 * recognises it. Without that, this check could report a collision and the only fix would break
 * every store that had already applied either side.
 */
export interface Collision {
  kind:
    | "two-migrations-share-a-number"
    | "the-journal-names-one-twice"
    | "the-number-and-the-journal-disagree"
    | "a-migration-no-journal-entry-names"
    | "a-journal-entry-with-no-migration"
    | "this-number-is-taken-on-the-other-branch";
  says: string;
}

/** The number a migration is filed under — `0003_deal_stages` is 3. */
export const numberOf = (tag: string): number | null => {
  const m = /^(\d+)/.exec(tag);
  return m ? Number(m[1]) : null;
};

export interface JournalEntry {
  idx?: number;
  tag: string;
}

/** The raw journal, unresolved — `migrations()` throws on a missing file, and this has to report it. */
export function journalOf(dir: string = migrationsDir()): JournalEntry[] {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, "meta", "_journal.json"), "utf-8")) as {
    entries?: JournalEntry[];
  };
  return raw.entries ?? [];
}

/**
 * Everything wrong with how this tree's migrations are numbered, and anything that would collide
 * with `against` — the journal on the branch you are about to merge into.
 *
 * ⛔ REPORTS, AND IS NOT THE THING THAT REFUSES. The caller decides: a test fails the build on the
 * ones that are true of this tree alone, and `make migrations-check` additionally asks about main,
 * which needs a git that may have no remote.
 */
export function migrationCollisions(
  dir: string = migrationsDir(),
  against?: JournalEntry[],
): Collision[] {
  const found: Collision[] = [];
  const entries = journalOf(dir);
  const byNumber = new Map<number, string[]>();
  const seenTags = new Map<string, number>();

  for (const e of entries) {
    seenTags.set(e.tag, (seenTags.get(e.tag) ?? 0) + 1);
    const n = numberOf(e.tag);
    if (n === null) {
      found.push({ kind: "the-number-and-the-journal-disagree", says: `"${e.tag}" is not numbered` });
      continue;
    }
    if (e.idx !== undefined && e.idx !== n) {
      found.push({
        kind: "the-number-and-the-journal-disagree",
        says: `"${e.tag}" is filed under ${n} and the journal calls it index ${e.idx}`,
      });
    }
    byNumber.set(n, [...(byNumber.get(n) ?? []), e.tag]);
    if (!fs.existsSync(path.join(dir, `${e.tag}.sql`))) {
      found.push({
        kind: "a-journal-entry-with-no-migration",
        says: `the journal names "${e.tag}" and there is no ${e.tag}.sql`,
      });
    }
  }

  for (const [tag, times] of seenTags) {
    if (times > 1) found.push({ kind: "the-journal-names-one-twice", says: `"${tag}" appears ${times} times` });
  }

  for (const [n, tags] of byNumber) {
    if (tags.length > 1) {
      found.push({
        kind: "two-migrations-share-a-number",
        says: `${String(n).padStart(4, "0")} is used by ${tags.map((t) => `"${t}"`).join(" and ")} — renumber the later one`,
      });
    }
  }

  /**
   * ⛔ A FILE NOTHING RUNS IS THE QUIET ONE. `migrations()` walks the journal, so a `.sql` left out
   * of it is never applied and never mentioned — and it looks exactly like a migration that is
   * working, right up to the first store that needs it.
   */
  const named = new Set(entries.map((e) => e.tag));
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".sql")) continue;
    const tag = f.slice(0, -4);
    if (!named.has(tag)) {
      found.push({ kind: "a-migration-no-journal-entry-names", says: `${f} is in no journal entry, so nothing runs it` });
    }
  }

  if (against) {
    const theirs = new Map<number, string[]>();
    for (const e of against) {
      const n = numberOf(e.tag);
      if (n !== null) theirs.set(n, [...(theirs.get(n) ?? []), e.tag]);
    }
    const theirTags = new Set(against.map((e) => e.tag));
    for (const e of entries) {
      if (theirTags.has(e.tag)) continue;
      const n = numberOf(e.tag);
      if (n === null) continue;
      const clash = (theirs.get(n) ?? []).filter((t) => t !== e.tag);
      if (clash.length) {
        found.push({
          kind: "this-number-is-taken-on-the-other-branch",
          says: `"${e.tag}" is new here and ${String(n).padStart(4, "0")} is already ${clash
            .map((t) => `"${t}"`)
            .join(" and ")} there — renumber before merging`,
        });
      }
    }
  }

  return found;
}

const LEDGER = `create table if not exists _productos_migrations (
  tag text primary key,
  applied_at timestamptz not null default now()
)`;

/**
 * ⛔ ADDED TO THE LEDGER, NOT TO `drizzle/`. The ledger is what decides which migrations to run, so
 * a migration that alters it could not be applied without already being tracked by the column it
 * adds. `if not exists` so an existing store gains it on the next boot.
 */
const LEDGER_SHA = `alter table _productos_migrations add column if not exists statements_sha text`;

/** What the ledger holds: what was applied, and what it actually was. */
export interface AppliedRow {
  tag: string;
  sha: string | null;
}

/**
 * Thrown when the store has been migrated by code this checkout does not contain.
 *
 * ⛔ THE COMPARISON ONLY EVER RAN ONE WAY, WHICH IS THE WORKTREE FAILURE EXACTLY. A journal entry
 * missing from the ledger gets applied; a LEDGER entry missing from the journal was ignored without
 * a word. So a branch applies `0003`, you switch to a checkout whose journal stops at `0002`, and
 * boot reports everything normal — against a database whose shape this code cannot describe. While
 * `0003` only added things that is harmless; the first time one adds a `not null` column or drops
 * one, the failure arrives as a Postgres error naming a column and nothing naming the cause.
 *
 * There are no down migrations, so this cannot be undone here — which is the argument for refusing
 * rather than warning. Set PRODUCTOS_ALLOW_SCHEMA_AHEAD to boot anyway, which is a real need when
 * deliberately rolling an instance back to an older build.
 */
export class SchemaAheadError extends Error {
  constructor(readonly unaccounted: string[]) {
    super(
      `this store was migrated by newer code: the ledger holds ${unaccounted
        .map((t) => `"${t}"`)
        .join(", ")}, which this checkout's drizzle/meta/_journal.json does not contain. ` +
        `Switch to a branch that has ${unaccounted.length === 1 ? "it" : "them"}, point DATABASE_URL at ` +
        `this checkout's own database, or restore a backup taken before ${unaccounted.length === 1 ? "it was" : "they were"} applied. ` +
        `Set PRODUCTOS_ALLOW_SCHEMA_AHEAD=1 to boot against it anyway.`,
    );
    this.name = "SchemaAheadError";
  }
}

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
  applied?: () => Promise<AppliedRow[]>,
  allowAhead: boolean = !!process.env.PRODUCTOS_ALLOW_SCHEMA_AHEAD,
): Promise<{ applied: string[]; skipped: string[]; renamed: Array<{ from: string; to: string }>; ahead: string[] }> {
  const all = migrations(dir);
  const lit = (v: string) => `'${v.replace(/'/g, "''")}'`;
  if (!applied) {
    /** No ledger reader: an empty target, which is what every test starts from. */
    for (const m of all) for (const stmt of m.statements) await run(stmt);
    return { applied: all.map((m) => m.tag), skipped: [], renamed: [], ahead: [] };
  }

  await run(LEDGER);
  await run(LEDGER_SHA);
  const rows = await applied();
  const byTag = new Map(rows.map((r) => [r.tag, r]));
  const bySha = new Map(rows.filter((r) => r.sha).map((r) => [r.sha as string, r]));

  /**
   * ⛔ BOTH DIRECTIONS. A ledger row is accounted for if this journal names it, or if this journal
   * contains the same statements under a different name — the second clause is what keeps a
   * renumbered migration from reading as a database from the future.
   */
  const shas = new Set(all.map((m) => m.sha));
  const tags = new Set(all.map((m) => m.tag));
  const ahead = rows.filter((r) => !tags.has(r.tag) && !(r.sha && shas.has(r.sha))).map((r) => r.tag);
  if (ahead.length && !allowAhead) throw new SchemaAheadError(ahead);

  const done: string[] = [];
  const skipped: string[] = [];
  const renamed: Array<{ from: string; to: string }> = [];
  for (const m of all) {
    const byName = byTag.get(m.tag);
    if (byName) {
      /** ⛔ Backfilled, so a store that predates the column stops being un-renameable. */
      if (!byName.sha) await run(`update _productos_migrations set statements_sha = ${lit(m.sha)} where tag = ${lit(m.tag)}`);
      skipped.push(m.tag);
      continue;
    }
    const sameStatements = bySha.get(m.sha);
    if (sameStatements) {
      /** Applied already, under the name it had before a merge renumbered it. */
      await run(`update _productos_migrations set tag = ${lit(m.tag)} where tag = ${lit(sameStatements.tag)}`);
      renamed.push({ from: sameStatements.tag, to: m.tag });
      skipped.push(m.tag);
      continue;
    }
    for (const stmt of m.statements) await run(stmt);
    await run(`insert into _productos_migrations (tag, statements_sha) values (${lit(m.tag)}, ${lit(m.sha)})`);
    done.push(m.tag);
  }
  return { applied: done, skipped, renamed, ahead };
}
