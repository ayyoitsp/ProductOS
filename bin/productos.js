#!/usr/bin/env node
// ProductOS launcher.
//
// Spawns the real CLI as a child process. If the child exits with code 50
// (RESTART_CODE in src/core/hot-reload.ts), we re-spawn it — that's how
// `productos serve` picks up source changes during dev without a manual
// restart. For any other exit code, we exit with the same code.
//
// In a published npm install the child never emits exit 50, so this is
// behaviorally identical to a normal one-shot run — just a thin parent.
//
// Forwards stdio + SIGINT/SIGTERM so Ctrl-C still works cleanly.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RESTART_CODE = 50;
const distEntry = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist/cli/index.js"
);

let child = null;

function spawnChild() {
  child = spawn(process.execPath, [distEntry, ...process.argv.slice(2)], {
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    if (code === RESTART_CODE) {
      spawnChild();
      return;
    }
    if (signal) {
      // Re-raise so the parent's exit looks like a normal signal kill.
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
  child.on("error", (err) => {
    if (err && err.code === "ENOENT") {
      console.error("productos: could not find dist/cli/index.js.");
      console.error("Did you run `npm run build`? (Or `make build` / `make watch`.)");
      process.exit(1);
    }
    console.error("productos: failed to spawn —", err.message);
    process.exit(1);
  });
}

function forward(signal) {
  return () => {
    if (child && !child.killed) child.kill(signal);
  };
}

process.on("SIGINT", forward("SIGINT"));
process.on("SIGTERM", forward("SIGTERM"));

spawnChild();
