import { Hono } from "hono";
import { eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { contextItems, decisions } from "../db/schema.js";

export const contextRoute = new Hono();

const ContextInput = z.object({
  id: z.string().min(1),
  kind: z.enum(["goal", "principle", "persona", "non_goal", "voice", "glossary"]),
  title: z.string().min(1),
  body: z.string().min(1),
  owner: z.string().optional(),
});

contextRoute.get("/", async (c) => {
  const rows = await db.select().from(contextItems).where(isNull(contextItems.deprecatedAt));
  return c.json({ context: rows });
});

contextRoute.put("/", async (c) => {
  const parsed = ContextInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid", issues: parsed.error.issues }, 400);

  const [row] = await db
    .insert(contextItems)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: contextItems.id,
      set: { title: parsed.data.title, body: parsed.data.body, updatedAt: new Date() },
    })
    .returning();
  return c.json({ item: row });
});

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

const DecisionInput = z.object({
  id: z.string().regex(/^d-\d+$/, "decision id must be d-NNN"),
  title: z.string().min(1),
  decidedOn: z.string(),
  owner: z.string().optional(),
  context: z.string().min(1),
  alternatives: z.array(z.string()).default([]),
  chosen: z.string().min(1),
  body: z.string().optional(),
  revisitAfter: z.string().optional(),
});

contextRoute.get("/decisions", async (c) => {
  const rows = await db.select().from(decisions);
  return c.json({ decisions: rows });
});

/**
 * Create a decision. The record is immutable — there is no update route for
 * `context`, `alternatives`, or `chosen`. A decision that no longer holds is
 * superseded (below), never rewritten, so the original reasoning survives.
 */
contextRoute.post("/decisions", async (c) => {
  const parsed = DecisionInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid", issues: parsed.error.issues }, 400);
  const d = parsed.data;

  const [existing] = await db.select().from(decisions).where(eq(decisions.id, d.id));
  if (existing) {
    return c.json(
      {
        error: "decision_immutable",
        message: `${d.id} already exists. Decisions are never rewritten — supersede it with a new decision instead.`,
      },
      409,
    );
  }

  const [row] = await db
    .insert(decisions)
    .values({
      ...d,
      decidedOn: new Date(d.decidedOn),
      revisitAfter: d.revisitAfter ? new Date(d.revisitAfter) : null,
    })
    .returning();
  return c.json({ decision: row }, 201);
});

/** Reopening is normal, not exceptional. */
contextRoute.post("/decisions/:id/review", async (c) => {
  const [row] = await db
    .update(decisions)
    .set({ status: "under_review" })
    .where(eq(decisions.id, c.req.param("id")))
    .returning();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ decision: row });
});

/** Upheld on revisit — informative in its own right. */
contextRoute.post("/decisions/:id/reaffirm", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db.select().from(decisions).where(eq(decisions.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);

  const [row] = await db
    .update(decisions)
    .set({
      status: "active",
      reaffirmed: [...existing.reaffirmed, new Date().toISOString()],
    })
    .where(eq(decisions.id, id))
    .returning();
  return c.json({ decision: row });
});

contextRoute.post("/decisions/:id/supersede", async (c) => {
  const body = await c.req.json();
  const supersededBy = z.string().parse(body.supersededBy);
  const [row] = await db
    .update(decisions)
    .set({ status: "superseded", supersededBy })
    .where(eq(decisions.id, c.req.param("id")))
    .returning();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ decision: row });
});
