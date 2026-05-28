import { InterestConfig, Kid, Task, Transaction, TxType } from "@/db/schema";

export interface Store {
  // Kids
  listKids(): Promise<Kid[]>;
  getKid(id: number): Promise<Kid | null>;
  createKid(name: string, color: string, avatar: string | null): Promise<number>;
  updateKid(
    id: number,
    patch: Partial<Pick<Kid, "name" | "color" | "avatar">>
  ): Promise<void>;
  deleteKid(id: number): Promise<void>;

  // Balances
  getBalance(kidId: number): Promise<number>;
  getAllBalances(): Promise<Record<number, number>>;

  // Tasks
  listActiveTasks(): Promise<Task[]>;
  createTask(name: string, amount_cents: number, recurring: boolean): Promise<number>;
  updateTask(
    id: number,
    patch: Partial<Pick<Task, "name" | "amount_cents" | "recurring">>
  ): Promise<void>;
  deleteTask(id: number): Promise<void>;
  completeTask(
    taskId: number,
    kidId: number,
    opts?: { amount_cents?: number; name?: string; comment?: string }
  ): Promise<void>;

  // Transactions
  listTransactions(kidId: number, limit?: number): Promise<Transaction[]>;
  addTransaction(
    kidId: number,
    amount_cents: number,
    reason: string,
    type: TxType
  ): Promise<number>;
  deleteTransaction(id: number): Promise<void>;

  // Interest
  getInterestConfig(): Promise<InterestConfig>;
  setInterestConfig(patch: Partial<InterestConfig>): Promise<void>;
  applyInterestIfDue(): Promise<{ applied: boolean; credited: number }>;
  applyInterestNow(): Promise<{ credited: number }>;
}
