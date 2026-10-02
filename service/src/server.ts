import { Hono } from "hono";
import { logger } from "hono/logger";
import { requireSecret } from "./lib/auth.js";
import { containersRoute } from "./routes/containers.js";
import { behaviorsRoute } from "./routes/behaviors.js";
import { validationsRoute } from "./routes/validations.js";
import { packetRoute } from "./routes/packet.js";
import { contextRoute } from "./routes/context.js";
import { surfacesRoute } from "./routes/surfaces.js";
import { edgesRoute } from "./routes/edges.js";
import { testCasesRoute } from "./routes/testcases.js";
import { appRoutes } from "./app/routes.js";
import { createRemoteMcpRoute } from "./mcp/remote.js";

export function createServer() {
  const app = new Hono();

  app.use("*", logger());

  app.get("/health", (c) => c.json({ ok: true, service: "productos", version: "0.1.0" }));

  // Two entry points, two credentials. /api/* takes the agent token in a header;
  // /app/* takes a browser session issued only in exchange for the human secret.
  app.use("/api/*", requireSecret());
  app.route("/app", appRoutes);

  app.get("/", (c) => c.redirect("/app"));

  app.route("/api/containers", containersRoute);
  app.route("/api/behaviors", behaviorsRoute);
  app.route("/api/validations", validationsRoute); // additionally human-gated
  app.route("/api/packet", packetRoute);
  app.route("/api/context", contextRoute);
  app.route("/api/surfaces", surfacesRoute);
  app.route("/api/edges", edgesRoute);
  app.route("/api/testcases", testCasesRoute);

  // Remote MCP (Streamable HTTP) — its own bearer auth, so it is mounted
  // outside the /api/* header gate.
  app.route(
    "/mcp",
    createRemoteMcpRoute(Number(process.env.PORT ?? 4100), process.env.PRODUCTOS_SECRET!),
  );

  // Still to land: /app — server-rendered authoring UI

  app.notFound((c) => c.json({ error: "not_found" }, 404));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal_error", message: err.message }, 500);
  });

  return app;
}
