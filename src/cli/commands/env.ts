import { Command } from "commander";
import { spawn } from "node:child_process";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import {
  EnvCommand,
  EnvConfig,
  HealthCheck,
  readEnvConfig,
} from "../../core/env.js";

export function envCommand(): Command {
  const cmd = new Command("env").description("Drive the dev environment (used by Claude during validation)");

  cmd
    .command("up")
    .description("Run setup commands, then run healthcheck")
    .action(async () => {
      const env = loadOrExit();
      for (const c of env.setup) await runSequential(c);
      if (env.healthcheck) {
        if (!(await waitForHealthcheck(env.healthcheck))) {
          console.error(pc.red(`✗ healthcheck did not pass after ${env.healthcheck.retries} retries`));
          process.exit(1);
        }
        console.log(pc.green("✓"), "env up and healthy");
      } else {
        console.log(pc.green("✓"), "env up (no healthcheck configured)");
      }
    });

  cmd
    .command("check")
    .description("Run only the healthcheck")
    .action(async () => {
      const env = loadOrExit();
      if (!env.healthcheck) {
        console.log(pc.yellow("!"), "no healthcheck configured in env.yaml");
        return;
      }
      const ok = await waitForHealthcheck(env.healthcheck);
      if (ok) console.log(pc.green("✓"), "env healthy");
      else {
        console.error(pc.red("✗"), "env not healthy");
        process.exit(1);
      }
    });

  cmd
    .command("reset")
    .description("Run reset_per_run commands (between validation runs)")
    .action(async () => {
      const env = loadOrExit();
      if (env.reset_per_run.length === 0) {
        console.log(pc.dim("(no reset_per_run commands configured)"));
        return;
      }
      for (const c of env.reset_per_run) await runSequential(c);
      console.log(pc.green("✓"), "env reset");
    });

  cmd
    .command("down")
    .description("Run teardown commands")
    .action(async () => {
      const env = loadOrExit();
      if (env.teardown.length === 0) {
        console.log(pc.dim("(no teardown commands configured)"));
        return;
      }
      for (const c of env.teardown) await runSequential(c);
      console.log(pc.green("✓"), "env down");
    });

  return cmd;
}

function loadOrExit(): EnvConfig {
  const paths = resolvePathsOrThrow();
  const env = readEnvConfig(paths);
  if (!env) {
    console.error(pc.red("✗ No productos/env.yaml — run `productos init claude` to scaffold one."));
    process.exit(1);
  }
  return env;
}

function runSequential(c: EnvCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    if (c.description) console.log(pc.dim("→"), c.description);
    console.log(pc.dim("$"), c.command);
    const child = spawn(c.command, {
      shell: true,
      stdio: "inherit",
      cwd: c.cwd,
      env: { ...process.env, ...c.env },
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`command timed out after ${c.timeout_seconds}s: ${c.command}`));
    }, c.timeout_seconds * 1000);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else {
        console.error(pc.red(`✗ command exited with code ${code}`));
        process.exit(code ?? 1);
      }
    });
  });
}

async function waitForHealthcheck(hc: HealthCheck): Promise<boolean> {
  for (let i = 0; i < hc.retries; i++) {
    if (await tryHealthcheck(hc)) return true;
    if (i < hc.retries - 1) await sleep(hc.retry_delay_ms);
  }
  return false;
}

async function tryHealthcheck(hc: HealthCheck): Promise<boolean> {
  if (hc.url) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), hc.timeout_seconds * 1000);
      const r = await fetch(hc.url, { signal: ac.signal });
      clearTimeout(t);
      return r.status === hc.expect_status;
    } catch {
      return false;
    }
  }
  if (hc.command) {
    return new Promise((resolve) => {
      const child = spawn(hc.command!, { shell: true, stdio: "ignore" });
      child.on("close", (code) => resolve(code === 0));
    });
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
