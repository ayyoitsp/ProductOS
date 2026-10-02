import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { elements, surfaces } from "../db/schema.js";

export const surfacesRoute = new Hono();

const SurfaceInput = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "surface id must be kebab-case"),
  title: z.string().min(1),
  path: z.string().optional(),
  /** Interface structure only — where things sit, not how they look. */
  sketch: z.string().optional(),
  sketchHtml: z.string().optional(),
  notes: z.string().optional(),
});

const ElementInput = z.object({
  surfaceId: z.string(),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  kind: z.string().min(1),
  label: z.string().optional(),
  notes: z.string().optional(),
  leadsTo: z.string().optional(),
});

surfacesRoute.get("/", async (c) => {
  const rows = await db.select().from(surfaces).where(isNull(surfaces.deprecatedAt));
  return c.json({ surfaces: rows });
});

surfacesRoute.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [surface] = await db.select().from(surfaces).where(eq(surfaces.id, id));
  if (!surface) return c.json({ error: "not_found", id }, 404);
  const els = await db
    .select()
    .from(elements)
    .where(and(eq(elements.surfaceId, id), isNull(elements.deprecatedAt)));
  return c.json({ surface, elements: els });
});

/** Surfaces are top-level: one screen can serve many features. */
surfacesRoute.put("/", async (c) => {
  const parsed = SurfaceInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid", issues: parsed.error.issues }, 400);

  const [row] = await db
    .insert(surfaces)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: surfaces.id,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();
  return c.json({ surface: row });
});

surfacesRoute.put("/elements", async (c) => {
  const parsed = ElementInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid", issues: parsed.error.issues }, 400);
  const e = parsed.data;

  const [surface] = await db.select().from(surfaces).where(eq(surfaces.id, e.surfaceId));
  if (!surface) return c.json({ error: "unknown_surface", surfaceId: e.surfaceId }, 404);

  if (e.leadsTo) {
    const [target] = await db.select().from(surfaces).where(eq(surfaces.id, e.leadsTo));
    if (!target) return c.json({ error: "unknown_leads_to", leadsTo: e.leadsTo }, 404);
  }

  const [row] = await db
    .insert(elements)
    .values(e)
    .onConflictDoUpdate({
      target: [elements.surfaceId, elements.id],
      set: { kind: e.kind, label: e.label, notes: e.notes, leadsTo: e.leadsTo },
    })
    .returning();
  return c.json({ element: row });
});

/** The flow graph — surface → surface via element `leadsTo`. */
surfacesRoute.get("/:id/flow", async (c) => {
  const id = c.req.param("id");
  const els = await db
    .select()
    .from(elements)
    .where(and(eq(elements.surfaceId, id), isNull(elements.deprecatedAt)));
  return c.json({
    from: id,
    transitions: els
      .filter((e) => e.leadsTo)
      .map((e) => ({ via: e.id, label: e.label, to: e.leadsTo })),
  });
});
