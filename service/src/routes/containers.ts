import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { containers, behaviors } from "../db/schema.js";

const ContainerInput = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/, "id must be <area>/<slug>, kebab-case"),
  kind: z.enum(["feature", "capability"]),
  title: z.string().min(1),
  goal: z.string().optional(),
  description: z.string().optional(),
  lifecycle: z.enum(["planned", "built", "retired"]).default("planned"),
  owner: z.string().optional(),
});

export const containersRoute = new Hono();

containersRoute.get("/", async (c) => {
  const kind = c.req.query("kind");
  const rows = await db
    .select()
    .from(containers)
    .where(
      kind === "feature" || kind === "capability"
        ? and(isNull(containers.deprecatedAt), eq(containers.kind, kind))
        : isNull(containers.deprecatedAt),
    );
  return c.json({ containers: rows });
});

containersRoute.get("/:area/:slug", async (c) => {
  const id = `${c.req.param("area")}/${c.req.param("slug")}`;
  const [row] = await db.select().from(containers).where(eq(containers.id, id));
  if (!row) return c.json({ error: "not_found", id }, 404);

  const claims = await db
    .select()
    .from(behaviors)
    .where(and(eq(behaviors.containerId, id), isNull(behaviors.deprecatedAt)));

  return c.json({ container: row, behaviors: claims });
});

/**
 * Idempotent upsert keyed by the natural id.
 *
 * Not an append. An agent that re-proposes the same container converges on the
 * same row instead of creating a second one — the structural fix for the
 * regenerate-and-duplicate failure mode.
 *
 * `kind` is immutable after creation: a feature and a capability answer to
 * different rules (trigger, promisee, anchoring), so flipping one into the
 * other silently invalidates everything hanging off it.
 */
containersRoute.put("/", async (c) => {
  const parsed = ContainerInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "invalid", issues: parsed.error.issues }, 400);
  }
  const input = parsed.data;
  const area = input.id.split("/")[0]!;

  const [existing] = await db.select().from(containers).where(eq(containers.id, input.id));

  if (existing && existing.kind !== input.kind) {
    return c.json(
      {
        error: "kind_immutable",
        message: `${input.id} already exists as a ${existing.kind}. Deprecate it and create a new id rather than changing kind.`,
      },
      409,
    );
  }

  const [row] = await db
    .insert(containers)
    .values({ ...input, area })
    .onConflictDoUpdate({
      target: containers.id,
      set: {
        title: input.title,
        goal: input.goal,
        description: input.description,
        lifecycle: input.lifecycle,
        owner: input.owner,
        updatedAt: new Date(),
      },
    })
    .returning();

  return c.json({ container: row, created: !existing }, existing ? 200 : 201);
});

/** Retire, never delete. There is deliberately no DELETE route. */
containersRoute.post("/:area/:slug/deprecate", async (c) => {
  const id = `${c.req.param("area")}/${c.req.param("slug")}`;
  const [row] = await db
    .update(containers)
    .set({ deprecatedAt: new Date(), lifecycle: "retired", updatedAt: new Date() })
    .where(eq(containers.id, id))
    .returning();
  if (!row) return c.json({ error: "not_found", id }, 404);
  return c.json({ container: row });
});
