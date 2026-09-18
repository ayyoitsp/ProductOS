import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { behaviors, validations } from "../db/schema.js";
import { requireHuman } from "../lib/auth.js";
import { hashClaim } from "../lib/state.js";

const ValidateInput = z.object({
  containerId: z.string(),
  behaviorId: z.string(),
  actor: z.string().min(1),
});

export const validationsRoute = new Hono();

/** Every route here is human-gated. There is no agent path to validation. */
validationsRoute.use("*", requireHuman());

/**
 * Accept a behavior as true.
 *
 * The question a human is asked is only ever "is this what we intend?" — never
 * "is this true?". Truth about reality comes from signals; intent comes from a
 * person. Blurring the two is what makes review expensive, because a reviewer
 * who thinks they're confirming reality has to go read the code.
 *
 * The claim hash is recorded so a later edit silently drops the behavior back to
 * needs_review. You cannot validate a sentence and then change the sentence.
 */
validationsRoute.post("/", async (c) => {
  const parsed = ValidateInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "invalid", issues: parsed.error.issues }, 400);
  }
  const { containerId, behaviorId, actor } = parsed.data;

  const [behavior] = await db
    .select()
    .from(behaviors)
    .where(and(eq(behaviors.containerId, containerId), eq(behaviors.id, behaviorId)));

  if (!behavior) return c.json({ error: "not_found" }, 404);
  if (behavior.deprecatedAt) {
    return c.json({ error: "deprecated", message: "Cannot validate a deprecated behavior." }, 409);
  }

  const claimHash = await hashClaim(behavior.claim);

  const [row] = await db
    .insert(validations)
    .values({
      id: `v_${crypto.randomUUID()}`,
      containerId,
      behaviorId,
      provenance: "human",
      actor,
      claimHash,
    })
    .returning();

  return c.json({ validation: row, state: "validated" }, 201);
});
