import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Neon over pooled connections: keep the client small and let the pooler work.
const client = postgres(url, { max: 5, prepare: false });

export const db = drizzle(client, { schema });
export { schema };
