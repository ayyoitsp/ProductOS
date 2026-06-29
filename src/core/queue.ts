import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { z } from "zod";
import { ProductosPaths } from "./paths.js";

/**
 * Work queue: productos/queue/<id>.md.
 *
 * Each file is one unit of work for a Claude worker to drain. The web UI
 * (or any other producer — CLI, MCP, future webhooks) writes a task here;
 * the productos-watch-queue skill spawns a subagent that polls, claims,
 * does the work, and marks the task complete.
 *
 * Why files on disk: durable across restart, multi-process safe (the
 * server, the CLI, and N Claude sessions all see the same queue),
 * inspectable with `ls productos/queue/`, and one of the four file-based
 * stores ProductOS already uses (product / tracking / feedback / queue).
 *
 * Claim is atomic via file rename — `<id>.md` becomes `<id>.claimed.md`.
 * If two workers race the same task, only one rename succeeds.
 */

export const TaskState = z.enum(["pending", "claimed", "done", "failed", "abandoned"]);
export type TaskState = z.infer<typeof TaskState>;

export const TaskKind = z.enum([
  "address-feedback",      // process a user-submitted contest / reject reason
  "freeform",              // free-text request typed into the "Ask AI" box on a behavior
]);
export type TaskKind = z.infer<typeof TaskKind>;

export const TaskPriority = z.enum(["low", "normal", "high"]);
export type TaskPriority = z.infer<typeof TaskPriority>;

function dateLike() {
  return z.union([z.string(), z.date()]).transform((v) =>
    v instanceof Date ? v.toISOString() : v
  );
}

export const TaskTarget = z.object({
  feature: z.string().optional(),
  behavior: z.string().optional(),
});
export type TaskTarget = z.infer<typeof TaskTarget>;

export const TaskFrontmatter = z.object({
  id: z.string(),
  created_at: dateLike(),
  created_by: z.string().default("vet-ui"),
  kind: TaskKind,
  state: TaskState.default("pending"),
  priority: TaskPriority.default("normal"),
  target: TaskTarget.default({}),
  feedback_id: z.string().optional(),

  claimed_at: dateLike().optional(),
  claimed_by: z.string().optional(),

  completed_at: dateLike().optional(),
  completed_by: z.string().optional(),
  result_summary: z.string().optional(),
});
export type TaskFrontmatter = z.infer<typeof TaskFrontmatter>;

export interface TaskEntry {
  frontmatter: TaskFrontmatter;
  body: string;
  filepath: string;
}

// ---------------------------------------------------------------------------
// Paths

function fileNameFor(id: string, state: TaskState): string {
  // Pending tasks: <id>.md. Claimed/done/failed: <id>.<state>.md.
  // The rename IS the state transition for claim.
  return state === "pending" ? `${id}.md` : `${id}.${state}.md`;
}

function pathFor(paths: ProductosPaths, id: string, state: TaskState): string {
  return path.join(paths.queueDir, fileNameFor(id, state));
}

export function ensureQueueDir(paths: ProductosPaths): void {
  fs.mkdirSync(paths.queueDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Read / Write

function serialize(entry: TaskEntry): string {
  const fm = YAML.stringify(entry.frontmatter, { lineWidth: 0, blockQuote: "literal" });
  return `---\n${fm}---\n\n${entry.body.trim()}\n`;
}

function readFile(filepath: string): TaskEntry {
  const raw = fs.readFileSync(filepath, "utf-8");
  const parsed = matter(raw);
  return {
    frontmatter: TaskFrontmatter.parse(parsed.data),
    body: parsed.content.trim(),
    filepath,
  };
}

/** Find a task by id regardless of state (scans the queue dir). */
export function readTaskById(paths: ProductosPaths, id: string): TaskEntry | null {
  if (!fs.existsSync(paths.queueDir)) return null;
  for (const entry of fs.readdirSync(paths.queueDir)) {
    if (!entry.startsWith(id)) continue;
    if (!entry.endsWith(".md")) continue;
    try {
      const t = readFile(path.join(paths.queueDir, entry));
      if (t.frontmatter.id === id) return t;
    } catch {
      // Skip malformed
    }
  }
  return null;
}

export function listTasks(
  paths: ProductosPaths,
  filter?: { state?: TaskState; feature?: string; kind?: TaskKind }
): TaskEntry[] {
  if (!fs.existsSync(paths.queueDir)) return [];
  const out: TaskEntry[] = [];
  for (const entry of fs.readdirSync(paths.queueDir)) {
    if (!entry.endsWith(".md")) continue;
    try {
      const t = readFile(path.join(paths.queueDir, entry));
      if (filter?.state && t.frontmatter.state !== filter.state) continue;
      if (filter?.feature && t.frontmatter.target.feature !== filter.feature) continue;
      if (filter?.kind && t.frontmatter.kind !== filter.kind) continue;
      out.push(t);
    } catch (e) {
      process.stderr.write(`productos: queue/${entry} failed to parse: ${(e as Error).message}\n`);
    }
  }
  // Highest priority first, then oldest first.
  const rank: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };
  out.sort((a, b) =>
    rank[a.frontmatter.priority] - rank[b.frontmatter.priority] ||
    a.frontmatter.created_at.localeCompare(b.frontmatter.created_at)
  );
  return out;
}

// ---------------------------------------------------------------------------
// Mutations

export interface EnqueueArgs {
  kind: TaskKind;
  body: string;
  created_by?: string;
  priority?: TaskPriority;
  target?: TaskTarget;
  feedback_id?: string;
}

export function enqueueTask(paths: ProductosPaths, args: EnqueueArgs): TaskEntry {
  ensureQueueDir(paths);
  const id = newTaskId(args.target);
  const entry: TaskEntry = {
    frontmatter: TaskFrontmatter.parse({
      id,
      created_at: new Date().toISOString(),
      created_by: args.created_by ?? "vet-ui",
      kind: args.kind,
      state: "pending",
      priority: args.priority ?? "normal",
      target: args.target ?? {},
      feedback_id: args.feedback_id,
    }),
    body: args.body,
    filepath: "",
  };
  const fp = pathFor(paths, id, "pending");
  fs.writeFileSync(fp, serialize(entry), "utf-8");
  entry.filepath = fp;
  return entry;
}

/**
 * Atomic claim: rename pending → claimed file. fs.renameSync fails if the
 * source doesn't exist, which is how we detect a race (another worker
 * already claimed it). Returns null on race.
 */
export function claimTask(paths: ProductosPaths, id: string, by: string): TaskEntry | null {
  const src = pathFor(paths, id, "pending");
  const dst = pathFor(paths, id, "claimed");
  if (!fs.existsSync(src)) return null;
  try {
    fs.renameSync(src, dst);
  } catch {
    return null;
  }
  const t = readFile(dst);
  t.frontmatter.state = "claimed";
  t.frontmatter.claimed_at = new Date().toISOString();
  t.frontmatter.claimed_by = by;
  fs.writeFileSync(dst, serialize(t), "utf-8");
  t.filepath = dst;
  return t;
}

/** Move claimed → done|failed|abandoned. Body of the task gets a resolution stamp. */
export function completeTask(
  paths: ProductosPaths,
  id: string,
  outcome: "done" | "failed" | "abandoned",
  args: { by?: string; summary?: string } = {}
): TaskEntry {
  const t = readTaskById(paths, id);
  if (!t) throw new Error(`Task "${id}" not found`);
  if (t.frontmatter.state !== "claimed") {
    throw new Error(`Task "${id}" is not claimed (state: ${t.frontmatter.state}); complete only valid after claim`);
  }
  const src = pathFor(paths, id, "claimed");
  const dst = pathFor(paths, id, outcome);
  t.frontmatter.state = outcome;
  t.frontmatter.completed_at = new Date().toISOString();
  t.frontmatter.completed_by = args.by ?? t.frontmatter.claimed_by ?? "ai-runtime";
  if (args.summary) t.frontmatter.result_summary = args.summary;
  // Write to destination, then unlink source. (Can't rename and overwrite
  // atomically across all filesystems, so two-step.)
  fs.writeFileSync(dst, serialize(t), "utf-8");
  if (fs.existsSync(src) && src !== dst) fs.unlinkSync(src);
  t.filepath = dst;
  return t;
}

/** Return a stuck claimed task to pending (the watcher crashed mid-task). */
export function releaseStaleClaim(paths: ProductosPaths, id: string): TaskEntry | null {
  const src = pathFor(paths, id, "claimed");
  const dst = pathFor(paths, id, "pending");
  if (!fs.existsSync(src)) return null;
  const t = readFile(src);
  t.frontmatter.state = "pending";
  delete t.frontmatter.claimed_at;
  delete t.frontmatter.claimed_by;
  fs.writeFileSync(dst, serialize(t), "utf-8");
  fs.unlinkSync(src);
  t.filepath = dst;
  return t;
}

// ---------------------------------------------------------------------------
// IDs

/** Generate a new task id: q-yyyymmddhhmmss-<slug>-<rand>. */
export function newTaskId(target?: TaskTarget): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  const slug = target?.behavior
    ? `${(target.feature ?? "feature").replace(/[^a-z0-9]/gi, "-")}-${target.behavior}`
    : target?.feature?.replace(/[^a-z0-9]/gi, "-") ?? "task";
  const rand = Math.random().toString(36).slice(2, 6);
  return `q-${yyyy}${mm}${dd}${hh}${mi}${ss}-${slug}-${rand}`;
}
