import { serve } from "@hono/node-server";
import { createServer } from "./server.js";

const port = Number(process.env.PORT ?? 4100);
const app = createServer();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`productos service listening on :${info.port}`);
});
