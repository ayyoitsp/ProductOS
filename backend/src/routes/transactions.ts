import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import {
  CreateTransactionSchema,
  ErrorSchema,
  IdParamSchema,
  TransactionSchema,
} from "../schemas.js";
import { serializeTransaction } from "../util.js";

export const transactionsRouter = new OpenAPIHono();

const create = createRoute({
  method: "post",
  path: "/transactions",
  tags: ["transactions"],
  request: {
    body: {
      content: { "application/json": { schema: CreateTransactionSchema } },
      required: true,
    },
  },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: TransactionSchema } } },
  },
});

transactionsRouter.openapi(create, async (c) => {
  const input = c.req.valid("json");
  const [row] = await db
    .insert(schema.transactions)
    .values({
      kidId: input.kid_id,
      amountCents: input.amount_cents,
      reason: input.reason,
      type: input.type,
    })
    .returning();
  return c.json(serializeTransaction(row!), 201);
});

const remove = createRoute({
  method: "delete",
  path: "/transactions/{id}",
  tags: ["transactions"],
  request: { params: IdParamSchema },
  responses: { 204: { description: "Deleted" }, 404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } } },
});

transactionsRouter.openapi(remove, async (c) => {
  const { id } = c.req.valid("param");
  await db.delete(schema.transactions).where(eq(schema.transactions.id, id));
  return c.body(null, 204);
});
