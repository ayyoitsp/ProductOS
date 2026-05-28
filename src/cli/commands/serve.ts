import { Command } from "commander";
import pc from "picocolors";
import { startMcpServer } from "../../mcp/server.js";
import { startUiServer } from "../../ui/server.js";

export function serveCommand(): Command {
  return new Command("serve")
    .description("Run the MCP server, the vet UI, or both (default: both)")
    .option("--mcp", "Run only the MCP server (stdio)")
    .option("--ui", "Run only the vet UI (HTTP)")
    .action(async (opts: { mcp?: boolean; ui?: boolean }) => {
      // If neither flag, run both. If --mcp alone, run only mcp (stdout is the MCP transport).
      // We intentionally don't run both in one process when --mcp is requested,
      // because that pollutes stdio.
      if (opts.mcp && !opts.ui) {
        await startMcpServer();
        return;
      }
      if (opts.ui && !opts.mcp) {
        await startUiServer();
        return;
      }
      // Default: both. UI on http, MCP on stdio is meaningless from the user's
      // terminal (Claude Code spawns its own `productos serve --mcp` subprocess).
      // So the practical default is: UI only.
      console.log(pc.dim("(MCP server is auto-spawned by Claude Code via .claude/settings.json — not started here.)"));
      await startUiServer();
    });
}
