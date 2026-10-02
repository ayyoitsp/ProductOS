import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools.js";
import { resolvePathsOrThrow } from "../core/paths.js";
import path from "node:path";
import { watchLog, type LoggedEvent } from "../v2/log.js";
import { setPush } from "./push-state.js";

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: "productos", version: "0.1.0" },
    /** ⛔ `logging` is what carries a push. Without it declared, a notification is dropped silently. */
    { capabilities: { tools: {}, logging: {} } }
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

  wakeOnWork(server);

  // stderr is fine for log messages; stdout is the MCP transport.
  process.stderr.write("productos MCP server running on stdio\n");
}


/**
 * ⛔ WHAT IS WORTH A SESSION'S CONTEXT, as a function something can assert on.
 *
 * A press means the truth already moved and there is nothing to do; a NOTE is somebody asking for a
 * change. Only the second is worth waking for — the first rides along on the next inbox read. This
 * is the dial that Peter's "stop the monitor" complaint was actually about, so it is pinned rather
 * than left as an `if` inside a closure nothing can reach.
 */
export const worthWaking = (batch: Array<Pick<LoggedEvent, "work">>): boolean => batch.some((e) => !!e.work);

/**
 * ⛔ THE INSTANCE WAKES THE SESSION, INSTEAD OF THE SESSION ASKING FORTY TIMES.
 *
 * Peter: "Stop the monitor now. We need a better way to monitor than to poll endlessly."
 *
 * ⛔ ADDITIVE, NOT A REPLACEMENT. This delivers the same events with the same cursor, and
 * `productos_exchange_inbox` stays exactly as it was — as the backstop that catches whatever a
 * dropped notification lost. A transport that half-replaced the poll is where an event feed
 * silently stops delivering one class of event, and nothing reports it.
 *
 * ⛔ AND IT ONLY WAKES FOR WORK. The expensive mistake is a wasted wake, not a wasted poll: a wake
 * that finds nothing spends context and returns "nothing new", and forty of those in one session is
 * the complaint above. A press means the truth already moved and there is nothing to do, so it
 * rides along on the next inbox read; a NOTE is somebody asking for a change, and that is worth a
 * session's attention now.
 */
function wakeOnWork(server: Server): void {
  let dir: string;
  /**
   * ⛔ THE CORPUS CAN BE NAMED, because resolving it from where this process happened to be
   * launched is how a push ends up watching the wrong one.
   *
   * That is not hypothetical: a session working a corpus in one repository had its MCP server
   * started in another, so the push ran flawlessly over a corpus nobody was looking at while
   * requests piled up in the one they were. Peter: "but why wasn't our message listener
   * responding? I don't get it".
   */
  const named = process.env.PRODUCTOS_V2_DIR;
  if (named) {
    dir = path.resolve(named);
  } else {
    try {
      const paths = resolvePathsOrThrow();
      dir = path.resolve(path.dirname(paths.productsDir), "..", "v2");
    } catch (e) {
      /**
       * ⛔ RECORDED AND SAID, NOT RETURNED QUIETLY. A silent return leaves a session unable to tell
       * "nothing has happened" from "nothing will ever reach me", and it will read an empty inbox as
       * the first.
       */
      const why = `no corpus could be resolved from where this server was started (${process.cwd()}) — set PRODUCTOS_V2_DIR`;
      setPush({ why });
      process.stderr.write(`productos: nothing will be pushed — ${why}\n`);
      return;
    }
  }
  setPush({ watching: dir });
  process.stderr.write(`productos: pushing requests from ${dir}\n`);

  /** ⛔ A settle window, so one person pressing three times is one wake rather than three. */
  const SETTLE_MS = 400;
  let pending: LoggedEvent[] = [];
  let timer: NodeJS.Timeout | undefined;

  const flush = (): void => {
    const batch = pending;
    pending = [];
    if (!worthWaking(batch)) return;
    void server
      .sendLoggingMessage({
        level: "info",
        logger: "productos",
        data: {
          why: "somebody asked for a change and nobody has authored it yet",
          owed: batch.filter((e) => e.work).map((e) => ({ note: e.work, says: e.says })),
          also: batch.filter((e) => !e.work).map((e) => e.says),
          /** ⛔ The same cursor the poll uses. Two numbering schemes would be two feeds. */
          through: batch[batch.length - 1]!.seq,
          next: "productos_exchange_inbox with a claim — this notification takes no lease",
        },
      })
      /** A client that does not support logging must not take the server down. The poll still works. */
      .catch(() => {});
  };

  watchLog(dir, {
    emit: (e) => {
      pending.push(e);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, SETTLE_MS);
    },
  });
}
