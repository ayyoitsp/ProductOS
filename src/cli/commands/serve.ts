import { Command } from "commander";
import pc from "picocolors";
import { startMcpServer } from "../../mcp/server.js";
import { startUiServer } from "../../ui/server.js";

export function serveCommand(): Command {
  return new Command("serve")
    .description("Render product truth as a website on localhost, or run the MCP server")
    .option("--mcp", "Run only the MCP server (stdio — spawned by Claude Code via .claude/settings.json)")
    .option("--ui", "Run only the rendered-site UI")
    .action(async (opts: { mcp?: boolean; ui?: boolean }) => {
      if (opts.mcp && !opts.ui) return startMcpServer();
      if (opts.ui && !opts.mcp) return startUiServer();
      // Default to UI only — MCP is spawned by the runtime, not by humans.
      console.log(pc.dim("(MCP is spawned by Claude Code per .claude/settings.json — not started here.)"));
      await startUiServer();
    });
}
