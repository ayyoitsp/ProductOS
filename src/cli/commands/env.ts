import { Command } from "commander";
import { spawn } from "node:child_process";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import {
  Env,
  EnvCommand,
  EnvConfig,
  HealthCheck,
  readEnvConfig,
  resolveEnv,
  resolveRecord,
  resolveEnvVars,
} from "../../core/env.js";

export function envCommand(): Command {
  const cmd = new Command("env").description("Drive a dev environment (used by Claude during validation)");

  cmd
    .command("list")
    .description("List configured environments")
    .action(() => {
      const config = loadOrExit();
      for (const [name, env] of Object.entries(config.envs)) {
        const def = name === config.default_env ? pc.green(" (default)") : "";
        const tags: string[] = [];
        if (env.external) tags.push("external");
        if (env.read_only) tags.push("read-only");
        const tagStr = tags.length ? pc.dim(` [${tags.join(", ")}]`) : "";
        console.log(`  ${pc.cyan(name)}${def}${tagStr}  ${env.description ?? ""}`);
      }
    });

  cmd
    .command("up [name]")
    .description("Run setup commands + healthcheck for the named env (default: default_env)")
    .action(async (name?: string) => {
      const config = loadOrExit();
      const { name: resolved, env } = resolveEnv(config, name);
      console.log(pc.dim(`env: ${resolved}`));
      for (const c of env.setup) await runSequential(c);
      if (env.healthcheck) {
        if (!(await waitForHealthcheck(env.healthcheck))) {
          console.error(pc.red(`✗ healthcheck did not pass after ${env.healthcheck.retries} retries`));
          process.exit(1);
        }
        console.log(pc.green("✓"), `${resolved} up and healthy`);
      } else {
        console.log(pc.green("✓"), `${resolved} up (no healthcheck configured)`);
      }
    });

  cmd
    .command("check [name]")
    .description("Run only the healthcheck for the named env")
    .action(async (name?: string) => {
      const config = loadOrExit();
      const { name: resolved, env } = resolveEnv(config, name);
      if (!env.healthcheck) {
        console.log(pc.yellow("!"), `no healthcheck configured for env "${resolved}"`);
        return;
      }
      const ok = await waitForHealthcheck(env.healthcheck);
      if (ok) console.log(pc.green("✓"), `${resolved} healthy`);
      else {
        console.error(pc.red("✗"), `${resolved} not healthy`);
        process.exit(1);
      }
    });

  cmd
    .command("reset [name]")
    .description("Run reset_per_run commands for the named env")
    .action(async (name?: string) => {
      const config = loadOrExit();
      const { name: resolved, env } = resolveEnv(config, name);
      if (env.read_only) {
        console.error(pc.red("✗"), `env "${resolved}" is read_only — refusing to reset`);
        process.exit(1);
      }
      if (env.reset_per_run.length === 0) {
        console.log(pc.dim(`(no reset_per_run commands configured for ${resolved})`));
        return;
      }
      for (const c of env.reset_per_run) await runSequential(c);
      console.log(pc.green("✓"), `${resolved} reset`);
    });

  cmd
    .command("down [name]")
    .description("Run teardown commands for the named env")
    .action(async (name?: string) => {
      const config = loadOrExit();
      const { name: resolved, env } = resolveEnv(config, name);
      if (env.read_only) {
        console.error(pc.red("✗"), `env "${resolved}" is read_only — refusing to tear down`);
        process.exit(1);
      }
      if (env.teardown.length === 0) {
        console.log(pc.dim(`(no teardown commands configured for ${resolved})`));
        return;
      }
      for (const c of env.teardown) await runSequential(c);
      console.log(pc.green("✓"), `${resolved} down`);
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
      env: { ...process.env, ...(c.env ? resolveRecord(c.env) : {}) },
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
      const headers = hc.headers ? resolveRecord(hc.headers) : undefined;
      const r = await fetch(resolveEnvVars(hc.url), { signal: ac.signal, headers });
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
