import * as SQLite from "expo-sqlite";
import { SQL_INIT, DEFAULT_SETTINGS } from "./schema";

const DB_NAME = "family-wallet.db";

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(SQL_INIT);
  // Migrations: add columns that may be missing on older DBs.
  try {
    await db.execAsync("ALTER TABLE kids ADD COLUMN avatar TEXT");
  } catch {
    // Column already exists — ignore.
  }
  // Seed default settings if missing.
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.runAsync(
      "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
      [key, value]
    );
  }
  _db = db;
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayKey(): string {
  // YYYY-MM-DD in local time (interest is a local-day concept).
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const c = String(abs % 100).padStart(2, "0");
  return `${sign}$${dollars}.${c}`;
}

export function parseMoney(input: string): number | null {
  // Accept "5", "5.00", "$5.00", "0.50"
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
