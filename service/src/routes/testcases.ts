import { Hono } from "hono";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { behaviors, testCases } from "../db/schema.js";

/**
 * Test cases — the concrete scenarios that demonstrate a claim.
 *
 * These are the packet's acceptance criteria: what must be observably true
 * when the work is done. A behavior without them states an intent an agent
 * can't check itself against.
 *
 * Numbers are assigned server-side and never reused. A case that stops being
 * load-bearing is deprecated, not renumbered, so any test carrying the stable
 * id `<container>#<behavior>/<n>` keeps resolving.
 */
export const testCasesRoute = new Hono();

const TestCaseInput = z.object({
  containerId: z.string(),
  behaviorId: z.string(),
  description: z.string().min(3),
  given: z.string().optional(),
  when: z.string().optional(),
  then: z.string().optional(),
});

testCasesRoute.post("/", async (c) => {
  const parsed = TestCaseInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid", issues: parsed.error.issues }, 400);
  const input = parsed.data;

  const [behavior] = await db
    .select()
    .from(behaviors)
    .where(
      and(eq(behaviors.containerId, input.containerId), eq(behaviors.id, input.behaviorId)),
    );
  if (!behavior) return c.json({ error: "unknown_behavior" }, 404);

  // Next number = max + 1, including deprecated rows, so a number is never
  // reused even after a case is retired.
  const nextRows = await db
    .select({ next: sql<number>`coalesce(max(${testCases.number}), 0) + 1` })
    .from(testCases)
    .where(
      and(
        eq(testCases.containerId, input.containerId),
        eq(testCases.behaviorId, input.behaviorId),
      ),
    );
  const next = nextRows[0]?.next ?? 1;

  const [row] = await db
    .insert(testCases)
    .values({ ...input, number: next })
    .returning();

  return c.json({ testCase: row, stableId: `${input.containerId}#${input.behaviorId}/${next}` }, 201);
});

testCasesRoute.get("/:area/:slug/:behaviorId", async (c) => {
  const containerId = `${c.req.param("area")}/${c.req.param("slug")}`;
  const rows = await db
    .select()
    .from(testCases)
    .where(
      and(
        eq(testCases.containerId, containerId),
        eq(testCases.behaviorId, c.req.param("behaviorId")),
        isNull(testCases.deprecatedAt),
      ),
    );
  return c.json({ testCases: rows.sort((a, b) => a.number - b.number) });
});

/** Deprecate, never delete — the stable id must keep resolving. */
testCasesRoute.post("/:area/:slug/:behaviorId/:number/deprecate", async (c) => {
  const containerId = `${c.req.param("area")}/${c.req.param("slug")}`;
  const [row] = await db
    .update(testCases)
    .set({ deprecatedAt: new Date() })
    .where(
      and(
        eq(testCases.containerId, containerId),
        eq(testCases.behaviorId, c.req.param("behaviorId")),
        eq(testCases.number, Number(c.req.param("number"))),
      ),
    )
    .returning();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ testCase: row });
});
