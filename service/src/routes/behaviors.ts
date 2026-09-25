import { Hono } from "hono";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { behaviors, containers, validations, signals } from "../db/schema.js";
import { lintClaim, hasBlockingFindings } from "../lib/lint.js";
import { findDuplicates } from "../lib/similarity.js";
import { deriveState, hashClaim } from "../lib/state.js";

const BehaviorInput = z.object({
  containerId: z.string(),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "behavior id must be kebab-case"),
  claim: z.string().min(10),
  notes: z.string().optional(),
  lifecycle: z.enum(["planned", "built", "retired"]).default("planned"),
  surfaceId: z.string().optional(),
  elementId: z.string().optional(),
  interaction: z.string().optional(),
  /** Escape hatch for a genuine near-duplicate that is nonetheless distinct. */
  acknowledgeDuplicate: z.boolean().default(false),
});

export const behaviorsRoute = new Hono();

/**
 * Propose or update a behavior.
 *
 * Three gates, in order, all enforced here rather than requested in a prompt:
 *   1. The claim linter rejects implementation language outright.
 *   2. Duplicate detection rejects restatement of an existing claim.
 *   3. The write is an upsert keyed by (containerId, id), never an append.
 */
behaviorsRoute.put("/", async (c) => {
  const parsed = BehaviorInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "invalid", issues: parsed.error.issues }, 400);
  }
  const input = parsed.data;

  const [container] = await db
    .select()
    .from(containers)
    .where(eq(containers.id, input.containerId));
  if (!container) {
    return c.json({ error: "unknown_container", containerId: input.containerId }, 404);
  }

  // Gate 1 — implementation boundary.
  const findings = lintClaim(input.claim);
  if (hasBlockingFindings(findings)) {
    return c.json(
      {
        error: "claim_rejected",
        message:
          "This claim describes implementation. State what a promisee can observe, not the mechanism.",
        findings,
      },
      422,
    );
  }

  // Gate 2 — non-redundancy.
  if (!input.acknowledgeDuplicate) {
    const others = await db
      .select({
        containerId: behaviors.containerId,
        behaviorId: behaviors.id,
        claim: behaviors.claim,
      })
      .from(behaviors)
      .where(and(isNull(behaviors.deprecatedAt), ne(behaviors.id, input.id)));

    const dupes = findDuplicates(input.claim, others);
    if (dupes.length > 0) {
      return c.json(
        {
          error: "duplicate_claim",
          message:
            "This restates an existing claim. Reference it rather than repeating it, or set acknowledgeDuplicate if it is genuinely distinct.",
          matches: dupes.slice(0, 5),
        },
        409,
      );
    }
  }

  // Gate 3 — upsert, not append.
  const [existing] = await db
    .select()
    .from(behaviors)
    .where(and(eq(behaviors.containerId, input.containerId), eq(behaviors.id, input.id)));

  const [row] = await db
    .insert(behaviors)
    .values({
      containerId: input.containerId,
      id: input.id,
      claim: input.claim,
      notes: input.notes,
      lifecycle: input.lifecycle,
      surfaceId: input.surfaceId,
      elementId: input.elementId,
      interaction: input.interaction,
    })
    .onConflictDoUpdate({
      target: [behaviors.containerId, behaviors.id],
      set: {
        claim: input.claim,
        notes: input.notes,
        lifecycle: input.lifecycle,
        surfaceId: input.surfaceId,
        elementId: input.elementId,
        interaction: input.interaction,
        updatedAt: new Date(),
      },
    })
    .returning();

  return c.json(
    {
      behavior: row,
      created: !existing,
      warnings: findings.filter((f) => f.severity === "warning"),
      /** An edited claim drops out of any prior validation — say so plainly. */
      revalidationRequired: Boolean(existing && existing.claim !== input.claim),
    },
    existing ? 200 : 201,
  );
});

behaviorsRoute.get("/:area/:slug/:behaviorId", async (c) => {
  const containerId = `${c.req.param("area")}/${c.req.param("slug")}`;
  const behaviorId = c.req.param("behaviorId");

  const [row] = await db
    .select()
    .from(behaviors)
    .where(and(eq(behaviors.containerId, containerId), eq(behaviors.id, behaviorId)));
  if (!row) return c.json({ error: "not_found" }, 404);

  const [vals, sigs] = await Promise.all([
    db
      .select()
      .from(validations)
      .where(
        and(eq(validations.containerId, containerId), eq(validations.behaviorId, behaviorId)),
      ),
    db
      .select()
      .from(signals)
      .where(and(eq(signals.containerId, containerId), eq(signals.behaviorId, behaviorId))),
  ]);

  const state = deriveState(await hashClaim(row.claim), vals, sigs);
  return c.json({ behavior: row, state });
});

/** Deprecate. No delete path exists. */
behaviorsRoute.post("/:area/:slug/:behaviorId/deprecate", async (c) => {
  const containerId = `${c.req.param("area")}/${c.req.param("slug")}`;
  const behaviorId = c.req.param("behaviorId");
  const reason = (await c.req.json().catch(() => ({}))).reason as string | undefined;

  const [row] = await db
    .update(behaviors)
    .set({ deprecatedAt: new Date(), deprecatedReason: reason, updatedAt: new Date() })
    .where(and(eq(behaviors.containerId, containerId), eq(behaviors.id, behaviorId)))
    .returning();

  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ behavior: row });
});
