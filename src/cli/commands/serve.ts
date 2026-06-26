import { Command } from "commander";
import pc from "picocolors";
import { startMcpServer } from "../../mcp/server.js";
import { startUiServer } from "../../ui/server.js";
import { maybeEnableHotReload } from "../../core/hot-reload.js";

export function serveCommand(): Command {
  return new Command("serve")
    .description("Render product truth as a website on localhost, or run the MCP server")
    .option("--mcp", "Run only the MCP server (stdio — spawned by Claude Code via .claude/settings.json)")
    .option("--ui", "Run only the rendered-site UI")
    .option("-p, --port <port>", "UI port (overrides config + $PORT)", (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 65535) {
        throw new Error(`Invalid port: ${v}`);
      }
      return n;
    })
    .action(async (opts: { mcp?: boolean; ui?: boolean; port?: number }) => {
      // Hot reload only fires when running from a dev install (src/ exists
      // as a sibling of dist/). Published npm installs see no behavior change.
      // Skip when running --mcp standalone since the watcher's stdout would
      // pollute the MCP stdio channel.
      if (!opts.mcp || opts.ui) {
        maybeEnableHotReload();
      }
      if (opts.mcp && !opts.ui) return startMcpServer();
      if (opts.ui && !opts.mcp) return startUiServer({ port: opts.port });
      // Default to UI only — MCP is spawned by the runtime, not by humans.
      console.log(pc.dim("(MCP is spawned by Claude Code per .claude/settings.json — not started here.)"));
      await startUiServer({ port: opts.port });
    });
}
