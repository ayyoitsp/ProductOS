import fs from "node:fs";
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
