/**
 * MCP against a project on an instance. ⛔ This is where the relay boundary stops being honour.
 *
 * Peter, on tying a repo to a project: *"it would connect via mcp, so mcp should handle the auth -
 * from there, we should just have a way to identify the appropriate project"*. So the repo keeps a
 * project id, the token authenticates, the path names the project, and the server owns everything
 * that follows.
 *
 * ⛔ AND THE TOOL SURFACE HAD A HOLE THAT ONLY HOSTING MAKES REACHABLE.
 *
 * The act tools take `by` and `via` as ARGUMENTS and hand them straight to `perform` — nothing
 * asks `mayRecord`. Over stdio that is the documented honour system and it is defensible: one
 * person is at the machine and the CLI has the same property. Over a token on a network it is
 * exactly what `hosted-plan.md` §2 says must never exist — *"anything arriving on an agent token →
 * refused as a verdict, whatever it claims"* — and a corpus full of `via: page` stamps nobody can
 * prove a human made cannot be audited after the fact.
 *
 * So three things are taken away from the caller here, before any handler runs:
 *
 *   1. `via` is checked against the principal. A token recording a human `via` is refused.
 *   2. `by` is overwritten with the identity the instance knows. It was the last forgeable field.
 *   3. `dir` is stripped. ⛔ `AtDir` lets a caller name a corpus directory, which is a convenience
 *      locally and an arbitrary-path read against somebody else's server once this is hosted.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ProductosPaths } from "../../core/paths.js";
import { EXCHANGE_ACT_TOOLS, exchangeTools, type McpTool } from "../../mcp/v2-tools.js";
import { mayRecord, type Principal } from "../identity.js";
import type { Via } from "../acts.js";
import { type Db, isRefusal, type ProjectStore, storeFor } from "./access.js";
import { principalFrom } from "./identity.js";
import { materializeProject, writeBack } from "./instance.js";

const MCP_PATH = /^\/p\/(?!\.\.?(?:\/|$))([A-Za-z0-9_.:@+-]{1,200})\/mcp\/?$/;

export const mcpProjectOf = (pathname: string): string | null => MCP_PATH.exec(pathname)?.[1] ?? null;

/** ⛔ Named, so anything auditing this surface can ask which tools are acts without a string match. */
const ACT_NAMES = new Set(EXCHANGE_ACT_TOOLS.map((t) => t.name));

/**
 * Paths for a corpus that has no repo.
 *
 * ⛔ A HOSTED INSTANCE HAS NO CHECKOUT, AND THESE MUST NOT POINT ANYWHERE REAL. `dirOf` is the only
 * consumer and it is overridden by the injected `dir`, so every field here exists to be unused. If
 * a tool ever reaches for one, it should land inside the request's own scratch directory rather
 * than somewhere on the server.
 */
function pathsFor(dir: string): ProductosPaths {
  const root = path.join(dir, ".no-repo");
  return {
    repoRoot: dir,
    root,
    configFile: path.join(root, "config.yaml"),
    contextDir: path.join(root, "context"),
    productsDir: path.join(root, "products"),
    capabilitiesDir: path.join(root, "capabilities"),
    trackingDir: path.join(root, "tracking"),
    feedbackDir: path.join(root, "feedback"),
    queueDir: path.join(root, "queue"),
    localDir: path.join(root, ".local"),
    cacheDir: path.join(root, ".local", "cache"),
    blobsDir: path.join(root, ".local", "blobs"),
    historyDir: path.join(root, ".local", "history"),
  };
}

export interface ToolRefusal {
  ok: false;
  why: string;
  detail?: string[];
}

/**
 * Everything taken away from the caller, as one function a test can drive.
 *
 * ⛔ SEPARATE FROM THE TRANSPORT ON PURPOSE. A boundary that can only be exercised by standing up
 * an HTTP server and speaking JSON-RPC is a boundary that gets asserted once and then trusted; this
 * one is a pure function over (tool, args, principal).
 */
export function guardArgs(
  tool: McpTool,
  raw: unknown,
  who: Principal,
  dir: string,
): { args: Record<string, unknown> } | ToolRefusal {
  const args: Record<string, unknown> = { ...((raw as Record<string, unknown>) ?? {}) };

  /** ⛔ 3. Whatever the caller said about where the corpus is, it is wrong and it is discarded. */
  delete args.dir;

  if (ACT_NAMES.has(tool.name)) {
    const via = String(args.via ?? "") as Via;
    /** ⛔ 1. The one decision. `mayRecord` is asked here exactly as the HTTP write path asks it. */
    const refused = mayRecord(who, via);
    if (refused) return { ok: false, why: refused.why, detail: refused.detail };

    /**
     * ⛔ 2. `by` becomes who the instance says it is.
     *
     * For a browser that is the authenticated account; for a token it is the token's actor, which
     * is the one identity a courier can honestly supply about itself. A name from the wire would
     * let a session write somebody else's agreement under `via: agent` and have it read, later, as
     * though that person had been asked.
     */
    args.by = who.actor;
  }

  args.dir = dir;
  return { args };
}

/** The tool surface for one authorized project, over one request. */
function serverFor(store: ProjectStore, who: Principal): Server {
  const server = new Server(
    { name: "productos", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: exchangeTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = exchangeTools.find((t) => t.name === req.params.name);
    if (!tool) throw new Error(`unknown tool: ${req.params.name}`);

    const { dir, documents: before, logHad } = await materializeProject(store);
    try {
      const guarded = guardArgs(tool, req.params.arguments, who, dir);
      if ("ok" in guarded) {
        /**
         * ⛔ RETURNED, NOT THROWN — the same reason the act tools return refusals. A refusal
         * carries what to do instead, and a throw becomes a bare message with those options
         * dropped, which is how a caller "works around" a boundary.
         */
        return { content: [{ type: "text", text: JSON.stringify(guarded, null, 2) }], isError: true };
      }

      const result = await tool.handler(guarded.args, pathsFor(dir));

      const written = await writeBack(store, before, dir, logHad);
      if ("conflict" in written) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: false,
                  why: "the corpus moved underneath this call, so nothing was written",
                  detail: [
                    `changed elsewhere: ${written.conflict.join(", ")}`,
                    "⛔ refused rather than merged — read it again and repeat the act",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      }
      /** ⛔ Nothing synthesized — see the note in `instance.ts`. A claiming read would log on every poll. */
      /** ⛔ `dir` is a scratch path on the server; it never travels back to a caller. */
      const scrubbed =
        result && typeof result === "object" && "dir" in (result as Record<string, unknown>)
          ? { ...(result as Record<string, unknown>), dir: undefined }
          : result;

      return { content: [{ type: "text", text: JSON.stringify(scrubbed, null, 2) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: (e as Error).message }] };
    } finally {
      fs.rmSync(path.dirname(dir), { recursive: true, force: true });
    }
  });

  return server;
}

/**
 * `/p/<project-id>/mcp` — ⛔ the project is in the path, not in a tool argument.
 *
 * An org-wide token then works across whatever its reach covers, and every call is unambiguous
 * about which corpus it addresses. A single `/mcp` taking a `project` parameter would grow that
 * parameter on every tool and let a session silently address the wrong corpus.
 */
export async function projectMcpRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  opts: { db: Db; localSession?: string },
): Promise<boolean> {
  const projectId = mcpProjectOf(pathname);
  if (!projectId) return false;

  const json = (body: unknown, status: number): true => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body, null, 2));
    return true;
  };

  const who = await principalFrom(
    opts.db,
    req.headers as Record<string, string | undefined>,
    opts.localSession,
  );
  if (!who) {
    return json(
      {
        ok: false,
        why: "this MCP endpoint needs a credential",
        detail: ["issue a token for the project and send it as `Authorization: Bearer <token>`"],
      },
      401,
    );
  }

  const reached = await storeFor(opts.db, who).project(projectId);
  if (isRefusal(reached)) return json(reached, 404);

  const body = await readBody(req);
  const server = serverFor(reached, who);
  /** Stateless: each call materializes and writes back, so there is no session state to keep. */
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  try {
    await transport.handleRequest(req, res, body);
  } finally {
    await transport.close();
    await server.close();
  }
  return true;
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  if (req.method === "GET" || req.method === "DELETE") return undefined;
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString("utf-8");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
