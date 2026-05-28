/**
 * Backwards-compatible re-exports that delegate to the active Store (sqlite
 * or remote). Existing call sites import from "@/db/operations".
 */

import { store } from "@/store";
import { InterestConfig, Kid, Task, Transaction, TxType } from "./schema";

export function listKids(): Promise<Kid[]> {
  return store().listKids();
}

export function getKid(id: number): Promise<Kid | null> {
  return store().getKid(id);
}

export function createKid(
  name: string,
  color: string,
  avatar: string | null = null
): Promise<number> {
  return store().createKid(name, color, avatar);
}

export function updateKid(
  id: number,
  patch: Partial<Pick<Kid, "name" | "color" | "avatar">>
): Promise<void> {
  return store().updateKid(id, patch);
}

export function deleteKid(id: number): Promise<void> {
  return store().deleteKid(id);
}

export function getBalance(kidId: number): Promise<number> {
  return store().getBalance(kidId);
}

export function getAllBalances(): Promise<Record<number, number>> {
  return store().getAllBalances();
}

export function listActiveTasks(): Promise<Task[]> {
  return store().listActiveTasks();
}

export function createTask(
  name: string,
  amount_cents: number,
  recurring: boolean
): Promise<number> {
  return store().createTask(name, amount_cents, recurring);
}

export function updateTask(
  id: number,
  patch: Partial<Pick<Task, "name" | "amount_cents" | "recurring">>
): Promise<void> {
  return store().updateTask(id, patch);
}

export function deleteTask(id: number): Promise<void> {
  return store().deleteTask(id);
}

export function completeTask(
  taskId: number,
  kidId: number,
  opts?: { amount_cents?: number; name?: string; comment?: string }
): Promise<void> {
  return store().completeTask(taskId, kidId, opts);
}

export function listTransactions(kidId: number, limit?: number): Promise<Transaction[]> {
  return store().listTransactions(kidId, limit);
}

export function addTransaction(
  kidId: number,
  amount_cents: number,
  reason: string,
  type: TxType
): Promise<number> {
  return store().addTransaction(kidId, amount_cents, reason, type);
}

export function deleteTransaction(id: number): Promise<void> {
  return store().deleteTransaction(id);
}

export function getInterestConfig(): Promise<InterestConfig> {
  return store().getInterestConfig();
}

export function setInterestConfig(patch: Partial<InterestConfig>): Promise<void> {
  return store().setInterestConfig(patch);
}
