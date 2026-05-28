import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import {
  InterestConfigSchema,
  UpdateInterestConfigSchema,
} from "../schemas.js";

const KEYS = {
  enabled: "interest_enabled",
  rate: "interest_rate_pct",
  days: "interest_days",
  last: "interest_last_applied",
} as const;

async function readSetting(key: string, fallback: string): Promise<string> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  return row?.value ?? fallback;
}

async function writeSetting(key: string, value: string): Promise<void> {
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

export async function getInterestConfig() {
  const enabled = (await readSetting(KEYS.enabled, "0")) === "1";
  const rate = Number(await readSetting(KEYS.rate, "5.0"));
  const days = JSON.parse(await readSetting(KEYS.days, "[0]")) as number[];
  const last = await readSetting(KEYS.last, "");
  return {
    enabled,
    rate_pct: Number.isFinite(rate) ? rate : 0,
    days: Array.isArray(days) ? days : [],
    last_applied: last || null,
  };
}

export async function setInterestConfig(patch: {
  enabled?: boolean;
  rate_pct?: number;
  days?: number[];
  last_applied?: string | null;
}): Promise<void> {
  if (patch.enabled !== undefined) await writeSetting(KEYS.enabled, patch.enabled ? "1" : "0");
  if (patch.rate_pct !== undefined) await writeSetting(KEYS.rate, String(patch.rate_pct));
  if (patch.days !== undefined) await writeSetting(KEYS.days, JSON.stringify(patch.days));
  if (patch.last_applied !== undefined)
    await writeSetting(KEYS.last, patch.last_applied ?? "");
}

export const settingsRouter = new OpenAPIHono();

const getRoute = createRoute({
  method: "get",
  path: "/settings/interest",
  tags: ["settings"],
  responses: {
    200: {
      description: "Interest config",
      content: { "application/json": { schema: InterestConfigSchema } },
    },
  },
});

settingsRouter.openapi(getRoute, async (c) => {
  return c.json(await getInterestConfig(), 200);
});

const putRoute = createRoute({
  method: "put",
  path: "/settings/interest",
  tags: ["settings"],
  request: {
    body: {
      content: { "application/json": { schema: UpdateInterestConfigSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Updated interest config",
      content: { "application/json": { schema: InterestConfigSchema } },
    },
  },
});

settingsRouter.openapi(putRoute, async (c) => {
  const input = c.req.valid("json");
  await setInterestConfig(input);
  return c.json(await getInterestConfig(), 200);
});
