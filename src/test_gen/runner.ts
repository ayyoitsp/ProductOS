import { spawn } from "node:child_process";
import { ProductosConfig } from "../core/config.js";

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Spawn the user's test command. Streams stdout/stderr to the parent. */
export function runUserTests(config: ProductosConfig): Promise<RunResult> {
  return new Promise((resolve) => {
    const cmd = config.stack.test_command || "npm test";
    const [bin, ...args] = cmd.split(/\s+/);
    const child = spawn(bin!, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => {
      const s = b.toString();
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr.on("data", (b) => {
      const s = b.toString();
      stderr += s;
      process.stderr.write(s);
    });
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}
