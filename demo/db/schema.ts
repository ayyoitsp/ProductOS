/**
 * SQLite is the local store. Money is in CENTS (integers) everywhere —
 * we only format to dollars at the display edge.
 */

export interface Kid {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Task {
  id: number;
  name: string;
  amount_cents: number;
  assigned_to_kid_id: number | null; // null = anyone
  recurring: 0 | 1;                  // 1 = stays available after completion
  active: 0 | 1;                     // 0 = soft-deleted or completed (one-time)
  created_at: string;
}

export type TxType = "task" | "interest" | "earn" | "spend" | "adjustment";

export interface Transaction {
  id: number;
  kid_id: number;
  amount_cents: number;              // positive credit, negative debit
  reason: string;
  type: TxType;
  related_task_id: number | null;
  created_at: string;
}

export interface SettingRow {
  key: string;
  value: string;
}

export interface InterestConfig {
  enabled: boolean;
  rate_pct: number;                  // e.g. 5.0 = 5%, 1000 = 1000% (unbounded)
  days: number[];                    // 0=Sun .. 6=Sat
  last_applied: string | null;       // ISO date "YYYY-MM-DD" of last application
}

export const SQL_INIT = `
CREATE TABLE IF NOT EXISTS kids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  assigned_to_kid_id INTEGER REFERENCES kids(id),
  recurring INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kid_id INTEGER NOT NULL REFERENCES kids(id),
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  type TEXT NOT NULL,
  related_task_id INTEGER REFERENCES tasks(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_kid ON transactions(kid_id, created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const DEFAULT_SETTINGS: Record<string, string> = {
  interest_enabled: "0",
  interest_rate_pct: "5.0",
  interest_days: JSON.stringify([0]), // Sundays
  interest_last_applied: "",
};
