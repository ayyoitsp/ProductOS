import path from "node:path";
import fs from "node:fs";

export interface ProductosPaths {
  repoRoot: string;
  root: string;             // <repo>/productos
  configFile: string;       // <repo>/productos/config.yaml
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
  return { repoRoot, root, configFile: path.join(root, "config.yaml") };
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
  fs.mkdirSync(p.root, { recursive: true });
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
