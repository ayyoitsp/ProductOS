import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import {
  BalancesSchema,
  CreateKidSchema,
  ErrorSchema,
  IdParamSchema,
  KidSchema,
  TransactionSchema,
  UpdateKidSchema,
} from "../schemas.js";
import { serializeKid, serializeTransaction } from "../util.js";

export const kidsRouter = new OpenAPIHono();

const listKids = createRoute({
  method: "get",
  path: "/kids",
  tags: ["kids"],
  responses: {
    200: {
      description: "List of kids",
      content: { "application/json": { schema: z.array(KidSchema) } },
    },
  },
});

kidsRouter.openapi(listKids, async (c) => {
  const rows = await db.select().from(schema.kids).orderBy(schema.kids.createdAt);
  return c.json(rows.map(serializeKid), 200);
});

const getBalances = createRoute({
  method: "get",
  path: "/kids/balances",
  tags: ["kids"],
  responses: {
    200: {
      description: "Map of kid id to balance in cents",
      content: { "application/json": { schema: BalancesSchema } },
    },
  },
});

kidsRouter.openapi(getBalances, async (c) => {
  const rows = await db
    .select({
      kidId: schema.transactions.kidId,
      total: sql<number>`COALESCE(SUM(${schema.transactions.amountCents}), 0)`.as("total"),
    })
    .from(schema.transactions)
    .groupBy(schema.transactions.kidId);
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.kidId)] = Number(r.total);
  return c.json(out, 200);
});

const getKid = createRoute({
  method: "get",
  path: "/kids/{id}",
  tags: ["kids"],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Kid", content: { "application/json": { schema: KidSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

kidsRouter.openapi(getKid, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db.select().from(schema.kids).where(eq(schema.kids.id, id));
  if (!row) return c.json({ error: "Kid not found" }, 404);
  return c.json(serializeKid(row), 200);
});

const createKid = createRoute({
  method: "post",
  path: "/kids",
  tags: ["kids"],
  request: {
    body: {
      content: { "application/json": { schema: CreateKidSchema } },
      required: true,
    },
  },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: KidSchema } } },
  },
});

kidsRouter.openapi(createKid, async (c) => {
  const input = c.req.valid("json");
  const [row] = await db
    .insert(schema.kids)
    .values({
      name: input.name.trim(),
      color: input.color,
      avatar: input.avatar ?? null,
    })
    .returning();
  return c.json(serializeKid(row!), 201);
});

const updateKid = createRoute({
  method: "patch",
  path: "/kids/{id}",
  tags: ["kids"],
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: UpdateKidSchema } }, required: true },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: KidSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

kidsRouter.openapi(updateKid, async (c) => {
  const { id } = c.req.valid("param");
  const patch = c.req.valid("json");
  const setVals: Partial<typeof schema.kids.$inferInsert> = {};
  if (patch.name !== undefined) setVals.name = patch.name.trim();
  if (patch.color !== undefined) setVals.color = patch.color;
  if (patch.avatar !== undefined) setVals.avatar = patch.avatar;
  if (Object.keys(setVals).length === 0) {
    const [row] = await db.select().from(schema.kids).where(eq(schema.kids.id, id));
    if (!row) return c.json({ error: "Kid not found" }, 404);
    return c.json(serializeKid(row), 200);
  }
  const [row] = await db
    .update(schema.kids)
    .set(setVals)
    .where(eq(schema.kids.id, id))
    .returning();
  if (!row) return c.json({ error: "Kid not found" }, 404);
  return c.json(serializeKid(row), 200);
});

const deleteKid = createRoute({
  method: "delete",
  path: "/kids/{id}",
  tags: ["kids"],
  request: { params: IdParamSchema },
  responses: { 204: { description: "Deleted" } },
});

kidsRouter.openapi(deleteKid, async (c) => {
  const { id } = c.req.valid("param");
  // transactions cascade-delete via FK; tasks' related_task_id stays.
  await db.delete(schema.kids).where(eq(schema.kids.id, id));
  return c.body(null, 204);
});

const listKidTransactions = createRoute({
  method: "get",
  path: "/kids/{id}/transactions",
  tags: ["kids"],
  request: {
    params: IdParamSchema,
    query: z.object({ limit: z.coerce.number().int().positive().max(500).default(100) }),
  },
  responses: {
    200: {
      description: "Transactions for kid",
      content: { "application/json": { schema: z.array(TransactionSchema) } },
    },
  },
});

kidsRouter.openapi(listKidTransactions, async (c) => {
  const { id } = c.req.valid("param");
  const { limit } = c.req.valid("query");
  const rows = await db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.kidId, id))
    .orderBy(sql`${schema.transactions.createdAt} DESC`)
    .limit(limit);
  return c.json(rows.map(serializeTransaction), 200);
});

const getKidBalance = createRoute({
  method: "get",
  path: "/kids/{id}/balance",
  tags: ["kids"],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "Balance in cents",
      content: { "application/json": { schema: z.object({ cents: z.number().int() }) } },
    },
  },
});

kidsRouter.openapi(getKidBalance, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${schema.transactions.amountCents}), 0)`.as("total"),
    })
    .from(schema.transactions)
    .where(eq(schema.transactions.kidId, id));
  return c.json({ cents: Number(row?.total ?? 0) }, 200);
});
