import { getDb, nowIso, todayKey } from "@/db";
import {
  DEFAULT_SETTINGS,
  InterestConfig,
  Kid,
  Task,
  Transaction,
  TxType,
} from "@/db/schema";
import { Store } from "./types";

export class SqliteStore implements Store {
  async listKids(): Promise<Kid[]> {
    const db = await getDb();
    return db.getAllAsync<Kid>("SELECT * FROM kids ORDER BY created_at ASC");
  }

  async getKid(id: number): Promise<Kid | null> {
    const db = await getDb();
    return db.getFirstAsync<Kid>("SELECT * FROM kids WHERE id = ?", [id]);
  }

  async createKid(name: string, color: string, avatar: string | null): Promise<number> {
    const db = await getDb();
    const r = await db.runAsync(
      "INSERT INTO kids (name, color, avatar, created_at) VALUES (?, ?, ?, ?)",
      [name.trim(), color, avatar, nowIso()]
    );
    return r.lastInsertRowId;
  }

  async updateKid(
    id: number,
    patch: Partial<Pick<Kid, "name" | "color" | "avatar">>
  ): Promise<void> {
    const db = await getDb();
    const cur = await db.getFirstAsync<Kid>("SELECT * FROM kids WHERE id = ?", [id]);
    if (!cur) return;
    const next = { ...cur, ...patch };
    await db.runAsync(
      "UPDATE kids SET name = ?, color = ?, avatar = ? WHERE id = ?",
      [next.name.trim(), next.color, next.avatar, id]
    );
  }

  async deleteKid(id: number): Promise<void> {
    const db = await getDb();
    await db.runAsync("DELETE FROM transactions WHERE kid_id = ?", [id]);
    await db.runAsync(
      "UPDATE tasks SET assigned_to_kid_id = NULL WHERE assigned_to_kid_id = ?",
      [id]
    );
    await db.runAsync("DELETE FROM kids WHERE id = ?", [id]);
  }

  async getBalance(kidId: number): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ total: number | null }>(
      "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM transactions WHERE kid_id = ?",
      [kidId]
    );
    return row?.total ?? 0;
  }

  async getAllBalances(): Promise<Record<number, number>> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ kid_id: number; total: number }>(
      "SELECT kid_id, COALESCE(SUM(amount_cents), 0) AS total FROM transactions GROUP BY kid_id"
    );
    const out: Record<number, number> = {};
    for (const r of rows) out[r.kid_id] = r.total;
    return out;
  }

  async listActiveTasks(): Promise<Task[]> {
    const db = await getDb();
    return db.getAllAsync<Task>(
      "SELECT * FROM tasks WHERE active = 1 ORDER BY created_at DESC"
    );
  }

  async createTask(name: string, amount_cents: number, recurring: boolean): Promise<number> {
    const db = await getDb();
    const r = await db.runAsync(
      "INSERT INTO tasks (name, amount_cents, assigned_to_kid_id, recurring, active, created_at) VALUES (?, ?, NULL, ?, 1, ?)",
      [name.trim(), amount_cents, recurring ? 1 : 0, nowIso()]
    );
    return r.lastInsertRowId;
  }

  async updateTask(
    id: number,
    patch: Partial<Pick<Task, "name" | "amount_cents" | "recurring">>
  ): Promise<void> {
    const db = await getDb();
    const cur = await db.getFirstAsync<Task>("SELECT * FROM tasks WHERE id = ?", [id]);
    if (!cur) return;
    const next = { ...cur, ...patch };
    await db.runAsync(
      "UPDATE tasks SET name = ?, amount_cents = ?, recurring = ? WHERE id = ?",
      [next.name, next.amount_cents, next.recurring, id]
    );
  }

  async deleteTask(id: number): Promise<void> {
    const db = await getDb();
    await db.runAsync("DELETE FROM tasks WHERE id = ?", [id]);
  }

  async completeTask(
    taskId: number,
    kidId: number,
    opts?: { amount_cents?: number; name?: string; comment?: string }
  ): Promise<void> {
    const db = await getDb();
    const task = await db.getFirstAsync<Task>(
      "SELECT * FROM tasks WHERE id = ?",
      [taskId]
    );
    if (!task) throw new Error("Task not found");

    const name = opts?.name?.trim() || task.name;
    const comment = opts?.comment?.trim();
    const reason = comment ? `${name} — ${comment}` : name;
    const amount = opts?.amount_cents ?? task.amount_cents;

    await this.addTransaction(kidId, amount, reason, "task", taskId);

    if (!task.recurring) {
      await db.runAsync("UPDATE tasks SET active = 0 WHERE id = ?", [taskId]);
    }
  }

  async listTransactions(kidId: number, limit = 100): Promise<Transaction[]> {
    const db = await getDb();
    return db.getAllAsync<Transaction>(
      "SELECT * FROM transactions WHERE kid_id = ? ORDER BY created_at DESC LIMIT ?",
      [kidId, limit]
    );
  }

  async addTransaction(
    kidId: number,
    amount_cents: number,
    reason: string,
    type: TxType,
    relatedTaskId: number | null = null
  ): Promise<number> {
    const db = await getDb();
    const r = await db.runAsync(
      "INSERT INTO transactions (kid_id, amount_cents, reason, type, related_task_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [kidId, amount_cents, reason, type, relatedTaskId, nowIso()]
    );
    return r.lastInsertRowId;
  }

  async deleteTransaction(id: number): Promise<void> {
    const db = await getDb();
    await db.runAsync("DELETE FROM transactions WHERE id = ?", [id]);
  }

  async readSetting(key: string): Promise<string> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [key]
    );
    return row?.value ?? DEFAULT_SETTINGS[key] ?? "";
  }

  async writeSetting(key: string, value: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value]
    );
  }

  async getInterestConfig(): Promise<InterestConfig> {
    const enabled = (await this.readSetting("interest_enabled")) === "1";
    const rate_pct = Number(await this.readSetting("interest_rate_pct"));
    const days = JSON.parse(await this.readSetting("interest_days")) as number[];
    const last = await this.readSetting("interest_last_applied");
    return {
      enabled,
      rate_pct: Number.isFinite(rate_pct) ? rate_pct : 0,
      days: Array.isArray(days) ? days : [],
      last_applied: last || null,
    };
  }

  async setInterestConfig(c: Partial<InterestConfig>): Promise<void> {
    if (c.enabled !== undefined)
      await this.writeSetting("interest_enabled", c.enabled ? "1" : "0");
    if (c.rate_pct !== undefined)
      await this.writeSetting("interest_rate_pct", String(c.rate_pct));
    if (c.days !== undefined)
      await this.writeSetting("interest_days", JSON.stringify(c.days));
    if (c.last_applied !== undefined)
      await this.writeSetting("interest_last_applied", c.last_applied ?? "");
  }

  async applyInterestIfDue(): Promise<{ applied: boolean; credited: number }> {
    const cfg = await this.getInterestConfig();
    if (!cfg.enabled) return { applied: false, credited: 0 };
    const today = todayKey();
    if (cfg.last_applied === today) return { applied: false, credited: 0 };
    const dow = new Date().getDay();
    if (!cfg.days.includes(dow)) return { applied: false, credited: 0 };

    const balances = await this.getAllBalances();
    let credited = 0;
    for (const [kidIdStr, balance] of Object.entries(balances)) {
      if (balance <= 0) continue;
      const interest = Math.round((balance * cfg.rate_pct) / 100);
      if (interest <= 0) continue;
      await this.addTransaction(
        Number(kidIdStr),
        interest,
        `Interest (${cfg.rate_pct}%)`,
        "interest"
      );
      credited++;
    }
    await this.setInterestConfig({ last_applied: today });
    return { applied: true, credited };
  }

  async applyInterestNow(): Promise<{ credited: number }> {
    const cfg = await this.getInterestConfig();
    const balances = await this.getAllBalances();
    let credited = 0;
    for (const [kidIdStr, balance] of Object.entries(balances)) {
      if (balance <= 0) continue;
      const interest = Math.round((balance * cfg.rate_pct) / 100);
      if (interest <= 0) continue;
      await this.addTransaction(
        Number(kidIdStr),
        interest,
        `Interest (${cfg.rate_pct}%)`,
        "interest"
      );
      credited++;
    }
    await this.setInterestConfig({ last_applied: todayKey() });
    return { credited };
  }
}
