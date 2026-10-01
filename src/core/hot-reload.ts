import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";

/**
 * Hot reload for `productos serve` when running from a development install
 * (npm link from this repo, or from anywhere src/ exists as a sibling of dist/).
 *
 * Pattern: this in-process watcher fires when dist/ changes (typically because
 * `tsc --watch` or `make watch` just rebuilt). It calls process.exit(RESTART_CODE);
 * the launcher in bin/productos.js sees that exit code and re-spawns the child.
 *
 * In a published npm install (no sibling src/), this is a no-op — the watcher
 * never installs, the binary behaves normally.
 *
 * Linux note: fs.watch's `recursive: true` is supported on macOS + Windows,
 * not Linux. For Linux dev installs we fall back to watching the top-level
 * dist/ dir non-recursively (catches new files but not edits in nested dirs)
 * — adequate for the common case where tsc rewrites top-level files first.
 */

export const RESTART_CODE = 50;

/**
 * Does this built module actually load?
 *
 * ⛔ EXPORTED SO IT CAN BE PROVEN WITH A REAL BROKEN FILE. The thing being prevented is a dead port
 * mid-review, and a test that greps the source for the word "spawnSync" proves nothing about
 * whether a file that will not parse is caught. This one writes an unparseable module and asks.
 *
 * ⛔ A SEPARATE PROCESS, because an import that throws in THIS one may already have run half of a
 * module's side effects, and a failed probe must leave the running server exactly as it was.
 */
export function loads(file: string): { ok: true } | { ok: false; why: string } {
  const probe = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `await import(${JSON.stringify(pathToFileURL(file).href)})`],
    { encoding: "utf-8", timeout: 10_000, env: process.env }
  );
  return probe.status === 0 ? { ok: true } : { ok: false, why: probe.stderr || "it did not load, and said nothing" };
}
const DEBOUNCE_MS = 300;

export function maybeEnableHotReload(): void {
  const here = fileURLToPath(import.meta.url);

  // Only fire when running from compiled dist/. tsx-run paths handle their
  // own watching via `tsx watch`, so don't double-watch.
  if (!here.includes(`${path.sep}dist${path.sep}`)) return;

  // Walk up to find <repo>. dist/core/hot-reload.js → dist/core → dist → repo.
  const distDir = path.resolve(path.dirname(here), "..");
  const repoRoot = path.dirname(distDir);
  const srcDir = path.join(repoRoot, "src");

  // No src/ sibling = published install, not a dev install. Bail.
  if (!fs.existsSync(srcDir)) return;

  // Opt-out env var for users who want the normal behavior even in a dev install.
  if (process.env.PRODUCTOS_NO_HOT_RELOAD === "1") return;

  console.log(
    pc.dim(`↻ Hot reload enabled — watching ${path.relative(repoRoot, distDir)}/ for changes (PRODUCTOS_NO_HOT_RELOAD=1 to disable).`)
  );

  let restartScheduled = false;
  const onChange = (filename: string | null) => {
    if (!filename) return;
    if (!filename.endsWith(".js")) return;
    if (restartScheduled) return;
    restartScheduled = true;
    setTimeout(() => {
      console.log(pc.dim(`\n↻ ${filename} changed — restarting productos serve...`));
      /**
       * ⛔ RESTART ITSELF. THIS USED TO EXIT AND HOPE.
       *
       * Exiting with a restart code only works under a supervisor that watches for it. Started any
       * other way — a shell, a background job, anything — the process simply DIED on the first
       * rebuild, and the person at the browser was left with a dead port and no message. It cost an
       * entire session: every rebuild silently killed the server, so a page that looked stale was
       * actually a page nobody was serving, and I kept explaining fixes to somebody looking at the
       * previous build.
       *
       * Spawning a replacement first means the restart happens whoever started it. The supervisor
       * path still works — it sees the same exit code — and the unsupervised path stops being a
       * silent failure.
       */
      /**
       * ⛔ AND IT CHECKS THE NEW BUILD BEFORE HANDING OVER, BECAUSE A BROKEN ONE KILLED THE SERVER
       * THREE TIMES IN ONE SESSION.
       *
       * The comment above fixed "exit and hope nobody is watching". This is the next failure along:
       * spawn a replacement, exit immediately, and if the replacement cannot LOAD — a syntax error
       * in the file that just changed — the old server is gone and the new one dies on startup. The
       * port goes dead mid-review, and the person at the browser sees a page that will not load with
       * nothing saying why.
       *
       * It happened three times here on the same defect: a backtick inside a template literal, which
       * this repo has broken itself on repeatedly. Each time the review surface went down and stayed
       * down until somebody noticed.
       *
       * ⛔ SO THE CHANGED FILE IS IMPORTED IN A THROWAWAY PROCESS FIRST. If it will not load, the
       * old server KEEPS SERVING the previous build and says what is wrong. A stale page somebody
       * can read beats a dead port every time, and the error arrives where the person is looking.
       */
      /**
       * ⛔ PROBE WHAT THE REPLACEMENT WILL NEED, NOT WHAT HAPPENED TO CHANGE.
       *
       * The first cut imported the changed file. A build writes many files, and the watcher fires
       * on whichever lands first — so it validated `core/jobs.js`, which was fine, restarted, and
       * the replacement died on `v2/page.js`, which was not. Seventh time the review surface went
       * down mid-session.
       *
       * The server's own entry transitively imports every renderer and route it needs, so one
       * import answers the only question that matters: will the process that is about to replace
       * this one come up?
       */
      const entry = path.join(distDir, "ui", "server.js");
      const changed = fs.existsSync(entry) ? entry : filename ? path.join(distDir, filename) : undefined;
      if (changed && /\.m?js$/.test(changed) && fs.existsSync(changed)) {
        const probe = loads(changed);
        if (!probe.ok) {
          const why = probe.why.split("\n").filter(Boolean).slice(0, 3).join("\n   ");
          console.log(pc.red(`✗ the new build does not load — staying on the previous one, which is still serving`));
          console.log(pc.dim(`   ${why}`));
          console.log(pc.dim(`   fix it and save again; this will pick the next build up automatically`));
          return;
        }
      }
      try {
        const child = spawn(process.execPath, process.argv.slice(1), {
          detached: true,
          stdio: "inherit",
          env: process.env,
        });
        child.unref();
      } catch (e) {
        console.log(pc.yellow(`(could not restart automatically: ${(e as Error).message} — run productos serve again)`));
        return;
      }
      process.exit(RESTART_CODE);
    }, DEBOUNCE_MS);
  };

  try {
    fs.watch(distDir, { recursive: true }, (_event, filename) => onChange(filename));
  } catch {
    // recursive not supported on this platform — fall back to top-level only.
    try {
      fs.watch(distDir, (_event, filename) => onChange(filename));
    } catch (e) {
      console.log(pc.yellow(`(hot reload disabled: ${(e as Error).message})`));
    }
  }
}
