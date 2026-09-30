import fs from "node:fs";
import { spawn } from "node:child_process";
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
      try {
        const child = spawn(process.execPath, process.argv.slice(1), {
          detached: true,
          stdio: "inherit",
          env: process.env,
        });
        child.unref();
      } catch (e) {
        console.log(pc.yellow(`(could not restart automatically: ${(e as Error).message} — run productos serve again)`));
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
