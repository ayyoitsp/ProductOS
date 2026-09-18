/**
 * Remote MCP endpoint — Streamable HTTP.
 *
 * This is what makes "a PM uses Claude natively" true. The stdio bridge needs
 * Node, a local process, and env vars, which is engineer-shaped; a hosted
 * client connects to a URL.
 *
 * Division of labour, enforced by surface rather than convention:
 *   - MCP (here)  → propose. Author features, behaviors, goals conversationally.
 *   - The app     → validate. Human judgment, behind the human credential.
 *
 * Tool calls loop back through the service's own HTTP API so every enforcement
 * gate applies identically to a conversational proposal and a scripted one.
 */
import { Hono } from "hono";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFS, handleToolCall, type ApiFetch } from "./tools.js";

/** Loops back through the service's own API so the gates always apply. */
function localApi(port: number, secret: string): ApiFetch {
  return async (path, init) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      ...init,
      headers: {
        "x-productos-secret": secret,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 400)}`);
    return text;
  };
}

function buildServer(api: ApiFetch): Server {
  const server = new Server(
    { name: "productos", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFS as unknown as [],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { text, isError } = await handleToolCall(
      req.params.name,
      (req.params.arguments ?? {}) as Record<string, unknown>,
      api,
    );
    return { content: [{ type: "text" as const, text }], isError };
  });

  return server;
}

export function createRemoteMcpRoute(port: number, secret: string) {
  const app = new Hono();
  const api = localApi(port, secret);

  /**
   * Bearer auth.
   *
   * Enough for Claude Code and scripted clients. Claude.ai custom connectors
   * expect OAuth 2.0 — that is the next piece, and it is also what fixes
   * attribution, since a shared bearer token cannot say *which* human is
   * proposing. Until then this credential is the agent one: it can propose,
   * and it still has no path to validation.
   */
  app.use("*", async (c, next) => {
    const provided = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (!provided || provided !== secret) {
      return c.json(
        { error: "unauthorized", message: "Send Authorization: Bearer <token>" },
        401,
        { "WWW-Authenticate": 'Bearer realm="productos"' },
      );
    }
    return next();
  });

  /**
   * Stateless: a fresh transport per request, no session store.
   *
   * The 2026-07-28 revision removed protocol-level sessions outright, and
   * running stateless means the endpoint survives ACA scaling to more than one
   * replica without sticky routing — a session held in one replica's memory
   * would break the moment a request landed on another.
   */
  app.all("/", async (c) => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = buildServer(api);
    await server.connect(transport);

    return transport.handleRequest(c.req.raw);
  });

  return app;
}
