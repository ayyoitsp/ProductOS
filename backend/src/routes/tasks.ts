import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import {
  CompleteTaskSchema,
  CreateTaskSchema,
  ErrorSchema,
  IdParamSchema,
  TaskSchema,
  TransactionSchema,
  UpdateTaskSchema,
} from "../schemas.js";
import { serializeTask, serializeTransaction } from "../util.js";

export const tasksRouter = new OpenAPIHono();

const listActive = createRoute({
  method: "get",
  path: "/tasks",
  tags: ["tasks"],
  responses: {
    200: {
      description: "Active tasks",
      content: { "application/json": { schema: z.array(TaskSchema) } },
    },
  },
});

tasksRouter.openapi(listActive, async (c) => {
  const rows = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.active, 1))
    .orderBy(sql`${schema.tasks.createdAt} DESC`);
  return c.json(rows.map(serializeTask), 200);
});

const create = createRoute({
  method: "post",
  path: "/tasks",
  tags: ["tasks"],
  request: {
    body: { content: { "application/json": { schema: CreateTaskSchema } }, required: true },
  },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: TaskSchema } } },
  },
});

tasksRouter.openapi(create, async (c) => {
  const input = c.req.valid("json");
  const [row] = await db
    .insert(schema.tasks)
    .values({
      name: input.name.trim(),
      amountCents: input.amount_cents,
      recurring: input.recurring ? 1 : 0,
      active: 1,
    })
    .returning();
  return c.json(serializeTask(row!), 201);
});

const update = createRoute({
  method: "patch",
  path: "/tasks/{id}",
  tags: ["tasks"],
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: UpdateTaskSchema } }, required: true },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: TaskSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

tasksRouter.openapi(update, async (c) => {
  const { id } = c.req.valid("param");
  const patch = c.req.valid("json");
  const setVals: Partial<typeof schema.tasks.$inferInsert> = {};
  if (patch.name !== undefined) setVals.name = patch.name.trim();
  if (patch.amount_cents !== undefined) setVals.amountCents = patch.amount_cents;
  if (patch.recurring !== undefined) setVals.recurring = patch.recurring ? 1 : 0;
  if (Object.keys(setVals).length === 0) {
    const [row] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id));
    if (!row) return c.json({ error: "Task not found" }, 404);
    return c.json(serializeTask(row), 200);
  }
  const [row] = await db
    .update(schema.tasks)
    .set(setVals)
    .where(eq(schema.tasks.id, id))
    .returning();
  if (!row) return c.json({ error: "Task not found" }, 404);
  return c.json(serializeTask(row), 200);
});

const remove = createRoute({
  method: "delete",
  path: "/tasks/{id}",
  tags: ["tasks"],
  request: { params: IdParamSchema },
  responses: { 204: { description: "Deleted" } },
});

tasksRouter.openapi(remove, async (c) => {
  const { id } = c.req.valid("param");
  await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
  return c.body(null, 204);
});

const complete = createRoute({
  method: "post",
  path: "/tasks/{id}/complete",
  tags: ["tasks"],
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: CompleteTaskSchema } }, required: true },
  },
  responses: {
    200: {
      description: "Resulting transaction",
      content: { "application/json": { schema: TransactionSchema } },
    },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

tasksRouter.openapi(complete, async (c) => {
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id));
  if (!task) return c.json({ error: "Task not found" }, 404);

  const name = (input.name?.trim() || task.name);
  const comment = input.comment?.trim();
  const reason = comment ? `${name} — ${comment}` : name;
  const amount = input.amount_cents ?? task.amountCents;

  const [tx] = await db
    .insert(schema.transactions)
    .values({
      kidId: input.kid_id,
      amountCents: amount,
      reason,
      type: "task",
      relatedTaskId: task.id,
    })
    .returning();

  if (task.recurring === 0) {
    await db.update(schema.tasks).set({ active: 0 }).where(eq(schema.tasks.id, task.id));
  }
  return c.json(serializeTransaction(tx!), 200);
});
