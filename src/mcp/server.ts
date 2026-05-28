import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools.js";
import { resolvePathsOrThrow } from "../core/paths.js";

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: "productos", version: "0.0.3" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name);
    if (!tool) {
      throw new Error(`unknown tool: ${req.params.name}`);
    }
    try {
      const paths = resolvePathsOrThrow();
      const result = await tool.handler(req.params.arguments ?? {}, paths);
      return {
        content: [
          { type: "text", text: JSON.stringify(result, null, 2) },
        ],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: (e as Error).message }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stderr is fine for log messages; stdout is the MCP transport.
  process.stderr.write("productos MCP server running on stdio\n");
}
