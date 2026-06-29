import path from "node:path";
import fs from "node:fs";

export interface ProductosPaths {
  repoRoot: string;
  root: string;             // <repo>/productos
  configFile: string;       // <repo>/productos/config.yaml
  contextDir: string;       // <repo>/productos/context
  productsDir: string;      // <repo>/productos/products
  trackingDir: string;      // <repo>/productos/tracking
  feedbackDir: string;      // <repo>/productos/feedback
  queueDir: string;         // <repo>/productos/queue (tasks for a Claude worker to drain)
  localDir: string;         // <repo>/productos/.local (gitignored)
  cacheDir: string;
  blobsDir: string;
  historyDir: string;       // <repo>/productos/.local/history (per-feature snapshots for undo)
}

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
    contextDir: path.join(root, "context"),
    productsDir: path.join(root, "products"),
    trackingDir: path.join(root, "tracking"),
    feedbackDir: path.join(root, "feedback"),
    queueDir: path.join(root, "queue"),
    localDir: path.join(root, ".local"),
    cacheDir: path.join(root, ".local", "cache"),
    blobsDir: path.join(root, ".local", "blobs"),
    historyDir: path.join(root, ".local", "history"),
  };
}

export function ensureDirs(p: ProductosPaths): void {
  for (const d of [p.root, p.contextDir, p.productsDir, p.trackingDir, p.feedbackDir, p.queueDir, p.localDir, p.cacheDir, p.blobsDir, p.historyDir]) {
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
