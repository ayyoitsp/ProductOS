import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { serveCommand } from "./commands/serve.js";
import { truthCommand } from "./commands/truth.js";
import { testCommand } from "./commands/test.js";
import { gapsCommand } from "./commands/gaps.js";
import { doctorCommand } from "./commands/doctor.js";

const program = new Command();

program
  .name("productos")
  .description("Product correctness management for AI-native teams")
  .version("0.0.1");

program.addCommand(initCommand());
program.addCommand(serveCommand());
program.addCommand(truthCommand());
program.addCommand(testCommand());
program.addCommand(gapsCommand());
program.addCommand(doctorCommand());

await program.parseAsync(process.argv);
