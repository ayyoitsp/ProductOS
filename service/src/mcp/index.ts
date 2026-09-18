#!/usr/bin/env node
/**
 * ProductOS MCP bridge (stdio).
 *
 * Runs locally (or in CI), on a machine that already has the codebase, and
 * talks to the hosted service over HTTP. Code never leaves that machine — the
 * bridge fetches truth and pushes proposals and signals back. ProductOS never
 * clones, never stores source, never holds a repo token (ARCHITECTURE.md §2a).
 *
 * For hosted clients that can't run a local process, the same tools are served
 * over Streamable HTTP at /mcp (src/mcp/remote.ts).
 *
 * This holds the AGENT credential only, and there is no validation tool here —
 * an agent can propose all day and can never mark anything true. The service
 * enforces that independently, so a modified bridge gains nothing.
 *
 *   PRODUCTOS_URL=https://... PRODUCTOS_SECRET=... npm run mcp
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFS, handleToolCall, type ApiFetch } from "./tools.js";

const BASE = process.env.PRODUCTOS_URL?.replace(/\/$/, "");
const SECRET = process.env.PRODUCTOS_SECRET;

if (!BASE || !SECRET) {
  console.error("PRODUCTOS_URL and PRODUCTOS_SECRET must both be set");
  process.exit(1);
}

const api: ApiFetch = async (path, init) => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-productos-secret": SECRET!,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 400)}`);
  return text;
};

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

await server.connect(new StdioServerTransport());
console.error("productos mcp bridge connected");
