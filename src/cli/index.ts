import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { serveCommand } from "./commands/serve.js";
import { productCommand } from "./commands/product.js";
import { feedbackCommand } from "./commands/feedback.js";
import { gapsCommand } from "./commands/gaps.js";
import { doctorCommand } from "./commands/doctor.js";
import { envCommand } from "./commands/env.js";
import { byokCommand } from "./commands/byok.js";
import { configureCommand } from "./commands/configure.js";
import { scanCommand } from "./commands/scan.js";
import { reviewCommand } from "./commands/review.js";
import { areaCommand } from "./commands/area.js";
import { historyCommand, undoCommand } from "./commands/history.js";
import { testCommand } from "./commands/test.js";

const program = new Command();

program
  .name("productos")
  .description("Product truth for AI-native teams — structured documentation of what your product does, dynamically rendered as a viewable site.")
  .version("0.1.0");

program.addCommand(initCommand());
program.addCommand(serveCommand());
program.addCommand(envCommand());
program.addCommand(productCommand());
program.addCommand(feedbackCommand());
program.addCommand(byokCommand());
program.addCommand(configureCommand());
program.addCommand(scanCommand());
program.addCommand(reviewCommand());
program.addCommand(areaCommand());
program.addCommand(historyCommand());
program.addCommand(undoCommand());
program.addCommand(gapsCommand());
program.addCommand(testCommand());
program.addCommand(doctorCommand());

await program.parseAsync(process.argv);
