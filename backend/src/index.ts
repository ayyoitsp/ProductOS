import { serve } from "@hono/node-server";
import { buildApp } from "./server.js";
import { ensureDefaultSettings } from "./db/seed.js";

const port = Number(process.env.PORT ?? 4000);

async function main() {
  await ensureDefaultSettings();
  const app = buildApp();
  serve({ fetch: app.fetch, port }, (info) => {
    // eslint-disable-next-line no-console
    console.log(`family-wallet api listening on http://localhost:${info.port}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("fatal:", err);
  process.exit(1);
});
