import { sql } from "drizzle-orm";
import { db, schema } from "./index.js";

const DEFAULTS: Record<string, string> = {
  interest_enabled: "0",
  interest_rate_pct: "5.0",
  interest_days: JSON.stringify([0]),
  interest_last_applied: "",
};

export async function ensureDefaultSettings(): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await db
      .insert(schema.settings)
      .values({ key, value })
      .onConflictDoNothing({ target: schema.settings.key });
  }
}
