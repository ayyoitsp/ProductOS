/**
 * Re-filing a container or an area — one operation over the whole corpus.
 *
 * ⛔ A container's id IS its path. So `mv` alone leaves the id inside the file
 * claiming the old location, every `depends_on` / `affected_by` / `leads_to` edge
 * aimed at a container that no longer exists, and the tracking sidecar stranded where
 * nothing reads it. That state passes validation on the moved file and has silently
 * lost the graph, which is why re-filing is a tool rather than an instruction — the
 * CLI and the MCP server both call this, and neither offers a partial move.
 */
import fs from "node:fs";
import path from "node:path";
import { ProductosPaths } from "./paths.js";
import {
  CAPABILITY_AREA,
  featureFilePath,
  listAllContainers,
  productsRoot,
  readFeatureById,
} from "./product.js";
import { trackingFilePath } from "./tracking.js";

export interface MovePair {
  from_id: string;
  to_id: string;
  /** A container file, or an area directory. */
  kind: "container" | "area";
  from_path: string;
  to_path: string;
}

export interface EdgeFix {
  /** The container holding the reference. */
  where: string;
  field: string;
  from: string;
  to: string;
}

export interface MovePlan {
  moves: MovePair[];
  edges: EdgeFix[];
  root: MovePair;
}

/** Refused with a reason the caller can print verbatim. */
export class MoveRefused extends Error {
  constructor(
    message: string,
    readonly why: string
  ) {
    super(message);
    this.name = "MoveRefused";
  }
}

function groupDirPath(paths: ProductosPaths, id: string): string {
  if (id === CAPABILITY_AREA || id.startsWith(CAPABILITY_AREA + "/")) {
    const rest = id.slice(CAPABILITY_AREA.length).replace(/^\//, "");
    return rest ? path.join(paths.capabilitiesDir, rest) : paths.capabilitiesDir;
  }
  return path.join(productsRoot(paths), id);
}

export function planMove(
  paths: ProductosPaths,
  rawFrom: string,
  rawDest: string,
  as?: string
): MovePlan {
  const from = rawFrom.replace(/^\/+|\/+$/g, "");
  const dest = rawDest.replace(/^\/+|\/+$/g, "");

  // ⛔ Never across trees. What a container is depends on what triggers it, and
  // moving a feature into `capabilities/` would assert a change this operation
  // cannot know is true. Rewriting it deliberately is the only honest path.
  const fromCap = from.startsWith(CAPABILITY_AREA + "/");
  const destCap = dest === CAPABILITY_AREA || dest.startsWith(CAPABILITY_AREA + "/");
  if (fromCap !== destCap) {
    throw new MoveRefused(
      "Refusing to move between the product tree and the capability tree.",
      `A feature is not a capability: which it is depends on what triggers it, so moving "${from}" to "${dest}" would assert something about the product this operation cannot know. Rewrite it deliberately instead.`
    );
  }

  const slug = as ?? from.split("/").pop()!;
  const toId = dest ? `${dest}/${slug}` : slug;

  if (toId === from) {
    throw new MoveRefused("Nothing to do.", `"${from}" is already there.`);
  }
  if (toId.startsWith(from + "/")) {
    throw new MoveRefused(
      "Refusing to move an area into itself.",
      `"${toId}" is inside "${from}".`
    );
  }

  const destDir = groupDirPath(paths, dest);
  if (dest && !fs.existsSync(destDir)) {
    throw new MoveRefused(
      `No such destination: "${dest}".`,
      `Create it first — an area needs a README.md saying what it is before anything can live in it: mkdir -p ${path.relative(
        paths.repoRoot,
        destDir
      )} and write its README.`
    );
  }

  const container = readFeatureById(paths, from);
  const all = listAllContainers(paths);
  const moves: MovePair[] = [];
  let root: MovePair;

  if (container) {
    root = {
      from_id: from,
      to_id: toId,
      kind: "container",
      from_path: featureFilePath(paths, from),
      to_path: featureFilePath(paths, toId),
    };
    moves.push(root);
  } else if (fs.existsSync(groupDirPath(paths, from))) {
    root = {
      from_id: from,
      to_id: toId,
      kind: "area",
      from_path: groupDirPath(paths, from),
      to_path: groupDirPath(paths, toId),
    };
    moves.push(root);
    // Every container inside the area moves with it and gets a new id.
    for (const c of all) {
      if (!c.frontmatter.id.startsWith(from + "/")) continue;
      const rest = c.frontmatter.id.slice(from.length + 1);
      moves.push({
        from_id: c.frontmatter.id,
        to_id: `${toId}/${rest}`,
        kind: "container",
        from_path: c.filepath,
        to_path: featureFilePath(paths, `${toId}/${rest}`),
      });
    }
  } else {
    throw new MoveRefused(
      `No such feature or area: "${from}".`,
      `Nothing is filed at that id.`
    );
  }

  if (fs.existsSync(root.to_path)) {
    throw new MoveRefused(
      `"${toId}" already exists.`,
      `Moving onto it would overwrite it. Pick another destination, or pass a new slug.`
    );
  }

  const rename = new Map(
    moves.filter((m) => m.kind === "container").map((m) => [m.from_id, m.to_id])
  );
  const edges: EdgeFix[] = [];
  for (const c of all) {
    const fm = c.frontmatter;
    const check = (field: string, values: string[]) => {
      for (const v of values) {
        const bare = v.split("#")[0]!;
        const to = rename.get(bare);
        if (to) edges.push({ where: fm.id, field, from: v, to: v.replace(bare, to) });
      }
    };
    check("depends_on", fm.depends_on);
    check("affected_by", fm.affected_by ?? []);
    for (const view of fm.ux) {
      for (const el of view.elements ?? []) {
        if (el.leads_to) check(`ux/${view.id}/${el.id}.leads_to`, [el.leads_to]);
      }
    }
  }

  return { moves, edges, root };
}

export function applyMove(paths: ProductosPaths, plan: MovePlan): void {
  const rename = new Map(
    plan.moves.filter((m) => m.kind === "container").map((m) => [m.from_id, m.to_id])
  );

  // 1. The file or directory itself.
  fs.mkdirSync(path.dirname(plan.root.to_path), { recursive: true });
  fs.renameSync(plan.root.from_path, plan.root.to_path);

  // 2. The id inside each moved container, and its tracking sidecar.
  for (const m of plan.moves) {
    if (m.kind !== "container") continue;
    if (fs.existsSync(m.to_path)) rewriteId(m.to_path, m.from_id, m.to_id);
    const fromTrack = trackingFilePath(paths, m.from_id);
    if (!fs.existsSync(fromTrack)) continue;
    const toTrack = trackingFilePath(paths, m.to_id);
    fs.mkdirSync(path.dirname(toTrack), { recursive: true });
    fs.renameSync(fromTrack, toTrack);
    const body = fs.readFileSync(toTrack, "utf-8");
    fs.writeFileSync(
      toTrack,
      body.replace(
        new RegExp(`^feature_id:\\s*["']?${escapeRe(m.from_id)}["']?\\s*$`, "m"),
        `feature_id: ${m.to_id}`
      ),
      "utf-8"
    );
  }

  // 3. Every reference from anywhere in the corpus. Re-listed after the move so the
  //    moved files are found at their new paths.
  for (const c of listAllContainers(paths)) {
    const body = fs.readFileSync(c.filepath, "utf-8");
    let next = body;
    for (const [fromId, toId] of rename) {
      // ⛔ BOTH boundaries are load-bearing.
      //
      // On the right: an id is followed by end-of-line, a quote, `#`, or punctuation,
      // never by another path segment — so `cre/deals` cannot eat `cre/deals-archive`.
      //
      // On the left: an id is never preceded by `/`. Without that, step 2 has already
      // rewritten `id: pricing/seat-estimator` to `id: teamspace/pricing/seat-estimator`
      // and this pass then finds the OLD id still sitting inside the new one and
      // rewrites it again, into `teamspace/teamspace/pricing/seat-estimator`. That
      // happened: an area moved, every id inside it doubled its prefix, and the corpus
      // read as two empty areas because nothing resolved to them any more.
      next = next.replace(
        new RegExp(`(?<![\\w/-])${escapeRe(fromId)}(?=$|["'\\s#,\\]])`, "gm"),
        toId
      );
    }
    if (next !== body) fs.writeFileSync(c.filepath, next, "utf-8");
  }
}

/** Plan and (unless `dryRun`) perform the move. */
export function runMove(
  paths: ProductosPaths,
  from: string,
  dest: string,
  opts: { as?: string; dryRun?: boolean } = {}
): MovePlan & { applied: boolean } {
  const plan = planMove(paths, from, dest, opts.as);
  if (!opts.dryRun) applyMove(paths, plan);
  return { ...plan, applied: !opts.dryRun };
}

function rewriteId(filepath: string, fromId: string, toId: string): void {
  const body = fs.readFileSync(filepath, "utf-8");
  fs.writeFileSync(
    filepath,
    body.replace(new RegExp(`^id:\\s*["']?${escapeRe(fromId)}["']?\\s*$`, "m"), `id: ${toId}`),
    "utf-8"
  );
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
