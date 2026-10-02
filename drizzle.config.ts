import { defineConfig } from "drizzle-kit";

/**
 * ⛔ `generate` + `migrate`, never `push`. Migrations are checked in under `drizzle/` so the
 * container applies the same statements the tests ran against, in the same order. `drizzle-kit
 * push` also fails on a schema whose primary keys are natural text columns — it tries to drop a
 * constraint it cannot — which the v1 service already learned the hard way.
 */
export default defineConfig({
  schema: "./src/v2/store/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost/productos" },
});
