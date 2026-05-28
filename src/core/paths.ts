import path from "node:path";
import fs from "node:fs";

export interface ProductosPaths {
  repoRoot: string;
  root: string;             // <repo>/productos
  configFile: string;       // <repo>/productos/config.yaml
  truthDir: string;         // <repo>/productos/truth
  tracesDir: string;        // <repo>/productos/traces
  fixturesDir: string;      // <repo>/productos/fixtures
  testsDir: string;         // <repo>/productos/tests
  localDir: string;         // <repo>/productos/.local
  cacheDir: string;         // <repo>/productos/.local/cache
  blobsDir: string;         // <repo>/productos/.local/blobs
  runtimeDb: string;        // <repo>/productos/.local/runtime.db
}

/** Walk up from `start` to find a directory containing a `productos/` folder. */
export function findRepoRoot(start: string = process.cwd()): string | null {
  let dir = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(dir, "productos"))) return dir;
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function pathsFor(repoRoot: string): ProductosPaths {
  const root = path.join(repoRoot, "productos");
  return {
    repoRoot,
    root,
    configFile: path.join(root, "config.yaml"),
    truthDir: path.join(root, "truth"),
    tracesDir: path.join(root, "traces"),
    fixturesDir: path.join(root, "fixtures"),
    testsDir: path.join(root, "tests"),
    localDir: path.join(root, ".local"),
    cacheDir: path.join(root, ".local", "cache"),
    blobsDir: path.join(root, ".local", "blobs"),
    runtimeDb: path.join(root, ".local", "runtime.db"),
  };
}

export function ensureDirs(p: ProductosPaths): void {
  for (const d of [
    p.root,
    p.truthDir,
    p.tracesDir,
    p.fixturesDir,
    p.testsDir,
    p.localDir,
    p.cacheDir,
    p.blobsDir,
  ]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export function resolvePathsOrThrow(start: string = process.cwd()): ProductosPaths {
  const repoRoot = findRepoRoot(start);
  if (!repoRoot) {
    throw new Error(
      `Not inside a git repo or a ProductOS project. ` +
        `Run \`productos init claude\` first (from the root of your repo).`
    );
  }
  return pathsFor(repoRoot);
}
