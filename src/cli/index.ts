import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { todoCommand } from "./commands/todo.js";
import { learnCommand } from "./commands/learn.js";
import { v2Command } from "./commands/v2.js";
import { hostedCommand } from "./commands/hosted.js";

/**
 * ⛔ FIVE VERBS, AND NONE OF THEM IS THE RETIRED MODEL.
 *
 * Peter: *"there should be no 'v1 anything'. there should be no 'local corpus'. that should be
 * completely stripped"* and *"yes, always hosted server"*. The v1 verbs (product, feedback, area,
 * scan, review, serve and the rest) read a `productos/products/` tree nothing writes any more, and
 * `serve` was the one way to look at a corpus from a directory instead of from the instance.
 */
const program = new Command();

program
  .name("productos")
  .description("Product truth for AI-native teams — kept on a hosted instance, read and written over MCP, the page, and the page's chat.")
  .version("0.1.0");

program.addCommand(initCommand());
program.addCommand(hostedCommand());
program.addCommand(learnCommand());
program.addCommand(todoCommand());
program.addCommand(v2Command());

await program.parseAsync(process.argv);
