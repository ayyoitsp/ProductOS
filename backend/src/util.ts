import type { Kid, Task, Transaction } from "./db/schema.js";

export function serializeKid(k: Kid) {
  return {
    id: k.id,
    name: k.name,
    color: k.color,
    avatar: k.avatar ?? null,
    created_at: k.createdAt.toISOString(),
  };
}

export function serializeTask(t: Task) {
  return {
    id: t.id,
    name: t.name,
    amount_cents: t.amountCents,
    recurring: t.recurring,
    active: t.active,
    created_at: t.createdAt.toISOString(),
  };
}

export function serializeTransaction(tx: Transaction) {
  return {
    id: tx.id,
    kid_id: tx.kidId,
    amount_cents: tx.amountCents,
    reason: tx.reason,
    type: tx.type as "task" | "interest" | "earn" | "spend" | "adjustment",
    related_task_id: tx.relatedTaskId ?? null,
    created_at: tx.createdAt.toISOString(),
  };
}
