import { Command } from "commander";
import { spawn } from "node:child_process";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import {
  EnvCommand,
  EnvConfig,
  HealthCheck,
  readEnvConfig,
  resolveEnv,
  resolveRecord,
  resolveEnvVars,
} from "../../core/env.js";

type Action = "up" | "check" | "reset" | "down";
const ACTIONS: ReadonlySet<string> = new Set<Action>(["up", "check", "reset", "down"]);

export function envCommand(): Command {
  return new Command("env")
    .description("Drive a dev environment")
    .addHelpText(
      "after",
      `\nUsage:
  productos env list                     list all configured envs
  productos env                          shorthand for 'env list'
  productos env <name>                   show one env's details (default env if name omitted)
  productos env <name> up                run setup commands + healthcheck
  productos env <name> check             healthcheck only
  productos env <name> reset             run reset_per_run (refused if read_only)
  productos env <name> down              run teardown (refused if read_only)

You can also omit <name> and ProductOS will use the default env:
  productos env up                       same as 'productos env <default_env> up'
  productos env check                    same as 'productos env <default_env> check'
`
    )
    .argument("[name_or_action]", "env name, or 'list', or an action when used without a name")
    .argument("[action]", "up | check | reset | down")
    .action(async (a: string | undefined, b: string | undefined) => {
      // No args, or 'list' → list envs
      if (!a || a === "list") return doList();

      // If first arg is an action, treat as `env <action>` with default env.
      if (ACTIONS.has(a) && !b) return doAction(a as Action, undefined);

      // If first arg is an env name and second is an action → run action
      if (b) {
        if (!ACTIONS.has(b)) {
          console.error(
            pc.red(`Unknown action "${b}". Expected: up | check | reset | down`)
          );
          process.exit(1);
        }
        return doAction(b as Action, a);
      }

      // Just an env name → show its details
      return doShow(a);
    });
}

function doList(): void {
  const config = loadOrExit();
  console.log(pc.bold("Configured environments:"));
  for (const [name, env] of Object.entries(config.envs)) {
    const def = name === config.default_env ? pc.green(" (default)") : "";
    const tags: string[] = [];
    if (env.external) tags.push("external");
    if (env.read_only) tags.push("read-only");
    const tagStr = tags.length ? pc.dim(` [${tags.join(", ")}]`) : "";
    console.log(`  ${pc.cyan(name)}${def}${tagStr}  ${env.description ?? ""}`);
  }
}

function doShow(name: string): void {
  const config = loadOrExit();
  const { name: resolved, env } = resolveEnv(config, name);
  console.log(pc.bold(`Env: ${resolved}`), config.default_env === resolved ? pc.green("(default)") : "");
  if (env.description) console.log(pc.dim(env.description));
  console.log();
  if (env.external) console.log(pc.yellow("  external") + pc.dim("  — ProductOS does not own this env"));
  if (env.read_only) console.log(pc.yellow("  read-only") + pc.dim("  — reset/down are refused"));
  if (env.services.length) {
    console.log(pc.bold("Services:"));
    for (const s of env.services) {
      console.log(`  - ${s.name}${s.url ? "  " + pc.cyan(s.url) : ""}${s.description ? "  " + pc.dim(s.description) : ""}`);
    }
  }
  console.log(pc.bold("Setup:"), env.setup.length ? `${env.setup.length} command(s)` : pc.dim("(none)"));
  console.log(
    pc.bold("Healthcheck:"),
    env.healthcheck?.url
      ? pc.cyan(env.healthcheck.url)
      : env.healthcheck?.command
      ? pc.dim(env.healthcheck.command)
      : pc.dim("(none)")
  );
  console.log(
    pc.bold("Reset:"),
    env.read_only ? pc.dim("(disabled — read_only)") : env.reset_per_run.length ? `${env.reset_per_run.length} command(s)` : pc.dim("(none)")
  );
  console.log(
    pc.bold("Teardown:"),
    env.read_only ? pc.dim("(disabled — read_only)") : env.teardown.length ? `${env.teardown.length} command(s)` : pc.dim("(none)")
  );
  if (env.test_env) {
    console.log(pc.bold("test_env:"));
    for (const [k, v] of Object.entries(env.test_env)) console.log(`  ${k}=${v}`);
  }
}

async function doAction(action: Action, name?: string): Promise<void> {
  const config = loadOrExit();
  const { name: resolved, env } = resolveEnv(config, name);

  if (action === "up") {
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
    return;
  }

  if (action === "check") {
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
    return;
  }

  if (action === "reset") {
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
    return;
  }

  if (action === "down") {
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
    return;
  }
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
