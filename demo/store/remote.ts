import { InterestConfig, Kid, Task, Transaction, TxType } from "@/db/schema";
import { Store } from "./types";

const DEFAULT_BASE = "http://localhost:4000";

function baseUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  return env && env.length > 0 ? env.replace(/\/$/, "") : DEFAULT_BASE;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      if (j?.error) detail = j.error;
    } catch {
      // ignore
    }
    throw new Error(`API ${method} ${path} failed: ${res.status} ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class RemoteStore implements Store {
  async listKids(): Promise<Kid[]> {
    return request("GET", "/kids");
  }

  async getKid(id: number): Promise<Kid | null> {
    try {
      return await request("GET", `/kids/${id}`);
    } catch {
      return null;
    }
  }

  async createKid(name: string, color: string, avatar: string | null): Promise<number> {
    const k = await request<Kid>("POST", "/kids", { name, color, avatar });
    return k.id;
  }

  async updateKid(
    id: number,
    patch: Partial<Pick<Kid, "name" | "color" | "avatar">>
  ): Promise<void> {
    await request("PATCH", `/kids/${id}`, patch);
  }

  async deleteKid(id: number): Promise<void> {
    await request("DELETE", `/kids/${id}`);
  }

  async getBalance(kidId: number): Promise<number> {
    const r = await request<{ cents: number }>("GET", `/kids/${kidId}/balance`);
    return r.cents;
  }

  async getAllBalances(): Promise<Record<number, number>> {
    const r = await request<Record<string, number>>("GET", "/kids/balances");
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(r)) out[Number(k)] = v;
    return out;
  }

  async listActiveTasks(): Promise<Task[]> {
    return request("GET", "/tasks");
  }

  async createTask(name: string, amount_cents: number, recurring: boolean): Promise<number> {
    const t = await request<Task>("POST", "/tasks", { name, amount_cents, recurring });
    return t.id;
  }

  async updateTask(
    id: number,
    patch: Partial<Pick<Task, "name" | "amount_cents" | "recurring">>
  ): Promise<void> {
    const payload: Record<string, unknown> = { ...patch };
    if ("recurring" in payload) payload.recurring = !!payload.recurring;
    await request("PATCH", `/tasks/${id}`, payload);
  }

  async deleteTask(id: number): Promise<void> {
    await request("DELETE", `/tasks/${id}`);
  }

  async completeTask(
    taskId: number,
    kidId: number,
    opts?: { amount_cents?: number; name?: string; comment?: string }
  ): Promise<void> {
    await request("POST", `/tasks/${taskId}/complete`, { kid_id: kidId, ...opts });
  }

  async listTransactions(kidId: number, limit = 100): Promise<Transaction[]> {
    return request("GET", `/kids/${kidId}/transactions?limit=${limit}`);
  }

  async addTransaction(
    kidId: number,
    amount_cents: number,
    reason: string,
    type: TxType
  ): Promise<number> {
    const tx = await request<Transaction>("POST", "/transactions", {
      kid_id: kidId,
      amount_cents,
      reason,
      type,
    });
    return tx.id;
  }

  async deleteTransaction(id: number): Promise<void> {
    await request("DELETE", `/transactions/${id}`);
  }

  async getInterestConfig(): Promise<InterestConfig> {
    return request("GET", "/settings/interest");
  }

  async setInterestConfig(patch: Partial<InterestConfig>): Promise<void> {
    await request("PUT", "/settings/interest", patch);
  }

  async applyInterestIfDue(): Promise<{ applied: boolean; credited: number }> {
    return request("POST", "/interest/apply-if-due");
  }

  async applyInterestNow(): Promise<{ credited: number }> {
    return request("POST", "/interest/apply-now");
  }
}
