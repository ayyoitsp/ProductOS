import { z } from "@hono/zod-openapi";

export const KidSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    name: z.string(),
    color: z.string().openapi({ example: "#f97316" }),
    avatar: z.string().nullable(),
    created_at: z.string().openapi({ format: "date-time" }),
  })
  .openapi("Kid");

export const CreateKidSchema = z
  .object({
    name: z.string().min(1),
    color: z.string(),
    avatar: z.string().nullable().optional(),
  })
  .openapi("CreateKidInput");

export const UpdateKidSchema = z
  .object({
    name: z.string().min(1).optional(),
    color: z.string().optional(),
    avatar: z.string().nullable().optional(),
  })
  .openapi("UpdateKidInput");

export const TaskSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    amount_cents: z.number().int(),
    recurring: z.number().int().min(0).max(1),
    active: z.number().int().min(0).max(1),
    created_at: z.string().openapi({ format: "date-time" }),
  })
  .openapi("Task");

export const CreateTaskSchema = z
  .object({
    name: z.string().min(1),
    amount_cents: z.number().int().positive(),
    recurring: z.boolean().default(true),
  })
  .openapi("CreateTaskInput");

export const UpdateTaskSchema = z
  .object({
    name: z.string().min(1).optional(),
    amount_cents: z.number().int().positive().optional(),
    recurring: z.boolean().optional(),
  })
  .openapi("UpdateTaskInput");

export const CompleteTaskSchema = z
  .object({
    kid_id: z.number().int(),
    amount_cents: z.number().int().positive().optional(),
    name: z.string().min(1).optional(),
    comment: z.string().optional(),
  })
  .openapi("CompleteTaskInput");

export const TxTypeSchema = z
  .enum(["task", "interest", "earn", "spend", "adjustment"])
  .openapi("TxType");

export const TransactionSchema = z
  .object({
    id: z.number().int(),
    kid_id: z.number().int(),
    amount_cents: z.number().int(),
    reason: z.string(),
    type: TxTypeSchema,
    related_task_id: z.number().int().nullable(),
    created_at: z.string().openapi({ format: "date-time" }),
  })
  .openapi("Transaction");

export const CreateTransactionSchema = z
  .object({
    kid_id: z.number().int(),
    amount_cents: z.number().int(),
    reason: z.string().min(1),
    type: TxTypeSchema,
  })
  .openapi("CreateTransactionInput");

export const BalancesSchema = z
  .record(z.string(), z.number().int())
  .openapi("Balances");

export const InterestConfigSchema = z
  .object({
    enabled: z.boolean(),
    rate_pct: z.number(),
    days: z.array(z.number().int().min(0).max(6)),
    last_applied: z.string().nullable(),
  })
  .openapi("InterestConfig");

export const UpdateInterestConfigSchema = InterestConfigSchema.partial().openapi(
  "UpdateInterestConfigInput"
);

export const ApplyResultSchema = z
  .object({
    applied: z.boolean(),
    credited: z.number().int(),
  })
  .openapi("ApplyResult");

export const ApplyNowResultSchema = z
  .object({
    credited: z.number().int(),
  })
  .openapi("ApplyNowResult");

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const ErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi("Error");
