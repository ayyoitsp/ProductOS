import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { containers, edges } from "../db/schema.js";

export const edgesRoute = new Hono();

const EdgeInput = z.object({
  kind: z.enum(["depends_on", "uses", "affected_by", "decided_by", "implements"]),
  fromType: z.enum(["container", "behavior"]),
  fromId: z.string().min(1),
  toType: z.enum(["container", "surface", "decision", "code"]),
  toId: z.string().min(1),
  note: z.string().optional(),
});

/**
 * Link two nodes.
 *
 * `depends_on` is validated harder than the rest: it must point at a capability,
 * because the altitude model only means anything if the dependency direction is
 * real. A feature depending on another feature is `affected_by`, not
 * `depends_on` — conflating them would make blast-radius queries meaningless.
 */
edgesRoute.post("/", async (c) => {
  const parsed = EdgeInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid", issues: parsed.error.issues }, 400);
  const e = parsed.data;

  if (e.kind === "depends_on") {
    const [target] = await db.select().from(containers).where(eq(containers.id, e.toId));
    if (!target) return c.json({ error: "unknown_target", toId: e.toId }, 404);
    if (target.kind !== "capability") {
      return c.json(
        {
          error: "depends_on_requires_capability",
          message: `${e.toId} is a feature. depends_on points at capabilities; use affected_by between features.`,
        },
        422,
      );
    }
  }

  const [row] = await db.insert(edges).values(e).onConflictDoNothing().returning();
  return c.json({ edge: row ?? e, created: Boolean(row) }, row ? 201 : 200);
});

edgesRoute.get("/:type/:id{.*}", async (c) => {
  const fromType = c.req.param("type");
  const fromId = c.req.param("id");
  const out = await db
    .select()
    .from(edges)
    .where(and(eq(edges.fromType, fromType), eq(edges.fromId, fromId)));
  const incoming = await db
    .select()
    .from(edges)
    .where(and(eq(edges.toType, fromType), eq(edges.toId, fromId)));
  return c.json({ outgoing: out, incoming });
});
