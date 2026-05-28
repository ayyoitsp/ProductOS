import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { interestRouter } from "./routes/interest.js";
import { kidsRouter } from "./routes/kids.js";
import { settingsRouter } from "./routes/settings.js";
import { tasksRouter } from "./routes/tasks.js";
import { transactionsRouter } from "./routes/transactions.js";

export function buildApp(): OpenAPIHono {
  const app = new OpenAPIHono();
  app.use("*", logger());
  app.use("*", cors());

  app.get("/health", (c) => c.json({ ok: true }));

  app.route("/", kidsRouter);
  app.route("/", tasksRouter);
  app.route("/", transactionsRouter);
  app.route("/", settingsRouter);
  app.route("/", interestRouter);

  app.doc("/openapi.json", {
    openapi: "3.0.0",
    info: {
      title: "Family Wallet API",
      version: "0.1.0",
      description:
        "Backend for the Family Wallet demo app. Single-source-of-truth ledger for kids, tasks, transactions, and interest config.",
    },
    servers: [{ url: "http://localhost:4000" }],
  });

  return app;
}
