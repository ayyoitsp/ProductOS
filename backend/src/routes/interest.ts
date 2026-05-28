import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { ApplyNowResultSchema, ApplyResultSchema } from "../schemas.js";
import { getInterestConfig, setInterestConfig } from "./settings.js";

function todayKey(d = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchBalances(): Promise<Record<string, number>> {
  const rows = await db
    .select({
      kidId: schema.transactions.kidId,
      total: sql<number>`COALESCE(SUM(${schema.transactions.amountCents}), 0)`.as("total"),
    })
    .from(schema.transactions)
    .groupBy(schema.transactions.kidId);
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.kidId)] = Number(r.total);
  return out;
}

async function creditAt(rate: number): Promise<number> {
  const balances = await fetchBalances();
  let credited = 0;
  for (const [kidIdStr, balance] of Object.entries(balances)) {
    if (balance <= 0) continue;
    const interest = Math.round((balance * rate) / 100);
    if (interest <= 0) continue;
    await db.insert(schema.transactions).values({
      kidId: Number(kidIdStr),
      amountCents: interest,
      reason: `Interest (${rate}%)`,
      type: "interest",
    });
    credited++;
  }
  return credited;
}

export const interestRouter = new OpenAPIHono();

const applyIfDue = createRoute({
  method: "post",
  path: "/interest/apply-if-due",
  tags: ["interest"],
  responses: {
    200: {
      description: "Result of conditional apply",
      content: { "application/json": { schema: ApplyResultSchema } },
    },
  },
});

interestRouter.openapi(applyIfDue, async (c) => {
  const cfg = await getInterestConfig();
  if (!cfg.enabled) return c.json({ applied: false, credited: 0 }, 200);
  const today = todayKey();
  if (cfg.last_applied === today) return c.json({ applied: false, credited: 0 }, 200);
  const dow = new Date().getDay();
  if (!cfg.days.includes(dow)) return c.json({ applied: false, credited: 0 }, 200);
  const credited = await creditAt(cfg.rate_pct);
  await setInterestConfig({ last_applied: today });
  return c.json({ applied: true, credited }, 200);
});

const applyNow = createRoute({
  method: "post",
  path: "/interest/apply-now",
  tags: ["interest"],
  responses: {
    200: {
      description: "Result of unconditional apply",
      content: { "application/json": { schema: ApplyNowResultSchema } },
    },
  },
});

interestRouter.openapi(applyNow, async (c) => {
  const cfg = await getInterestConfig();
  const credited = await creditAt(cfg.rate_pct);
  await setInterestConfig({ last_applied: todayKey() });
  return c.json({ credited }, 200);
});
