import path from "node:path";
import fs from "node:fs";

export interface ProductosPaths {
  repoRoot: string;
  root: string;             // <repo>/productos
  configFile: string;       // <repo>/productos/config.yaml
  contextDir: string;       // <repo>/productos/context
  productsDir: string;      // <repo>/productos/products
  capabilitiesDir: string;  // <repo>/productos/capabilities
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

/**
 * One definition of the layout, so the two roots cannot drift apart.
 *
 * ⛔ A SECOND COPY OF THIS WAS THE OBVIOUS WAY TO GIVE `--at` ITS OWN ROOT, and a layout
 * written twice is a layout that disagrees with itself the first time a directory is added
 * to one of them.
 */
function under(root: string, repoRoot: string): ProductosPaths {
  return {
    repoRoot,
    root,
    configFile: path.join(root, "config.yaml"),
    contextDir: path.join(root, "context"),
    productsDir: path.join(root, "products"),
    // ⛔ A SIBLING of products/, not a child. A capability is the middle layer:
    // it describes an interface without prescribing how subsystems keep it, and
    // many features across many areas depend on one. Nesting it under a product
    // area would make its area part of its identity permanently, which is the
    // strict hierarchy OVERVIEW calls a lie.
    capabilitiesDir: path.join(root, "capabilities"),
    trackingDir: path.join(root, "tracking"),
    feedbackDir: path.join(root, "feedback"),
    queueDir: path.join(root, "queue"),
    localDir: path.join(root, ".local"),
    cacheDir: path.join(root, ".local", "cache"),
    blobsDir: path.join(root, ".local", "blobs"),
    historyDir: path.join(root, ".local", "history"),
  };
}

export function pathsFor(repoRoot: string): ProductosPaths {
  return under(path.join(repoRoot, "productos"), repoRoot);
}

/**
 * A corpus addressed by `--at` is its own root.
 *
 * ⛔ A GAP FILED WHILE AUTHORING A CORPUS SOMEWHERE ELSE LANDED IN WHATEVER REPO THE SHELL
 * HAPPENED TO BE STANDING IN. `todo` was the one verb with no `--at`, so it walked up from
 * `cwd` like a v1 command — and 33 gaps found in one product were recorded against another
 * product's, every `forced_into` naming a scope that root has never contained. Filed against
 * the wrong product they are worse than lost: they are indistinguishable from that product's
 * own, so reading the backlog tells you the model cannot express things it expresses fine.
 */
export function pathsAtCorpus(corpusDir: string): ProductosPaths {
  const root = path.resolve(corpusDir);
  if (!fs.existsSync(root)) throw new Error(`No corpus at ${root} — \`--at\` names the corpus directory.`);
  return under(root, root);
}

export function ensureDirs(p: ProductosPaths): void {
  for (const d of [p.root, p.contextDir, p.productsDir, p.capabilitiesDir, p.trackingDir, p.feedbackDir, p.queueDir, p.localDir, p.cacheDir, p.blobsDir, p.historyDir]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

/**
 * The codebase a corpus describes, from the corpus's own location.
 *
 * ⛔ ONE ANSWER, because three callers were about to compute it three ways. A drawing records its
 * source as a path relative to this root — `frontend/app/components/…` — and a caller that resolved
 * that root differently would be checking a file that is not the one the drawing named, and
 * reporting either a phantom absence or a phantom presence. Returns undefined where there is no
 * project, which is a corpus with no codebase and not an error.
 */
export function projectRootOf(corpusDir: string): string | undefined {
  try {
    return path.dirname(path.dirname(resolvePathsOrThrow(corpusDir).configFile));
  } catch {
    return undefined;
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
