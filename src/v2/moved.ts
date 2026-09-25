/**
 * ⛔ WHAT THE CODE HAS DECIDED SINCE THIS TRUTH WAS WRITTEN, IN THE COMMITS' OWN WORDS.
 *
 * Peter: "we should also walk git history, right?"
 *
 * Right, and it is the stronger half. A recorded commit tells you THAT things moved; the history
 * tells you WHAT moved and WHY — and in this codebase the why is written down. The commit that
 * deleted the per-deal pricing grid quoted the operator ("Computed work and editable cells all need
 * to be ripped out") and said of itself "this deletes rather than builds". That is a product
 * decision in its author's words, and the corpus describing that screen had not heard about it.
 *
 * A diff could not have told anybody that. Two people reading source by hand found it, after one of
 * them disbelieved the other — which is the cost this exists to remove.
 *
 * ⛔ IT REPORTS, IT NEVER RECONCILES. Whether the corpus should follow the code or the code should
 * follow the corpus is a product judgement and belongs to a person. This says: these commits
 * touched what this feature is about, here is what they say about themselves, go and look.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import type { Corpus } from "./load.js";

export interface Moved {
  scope: string;
  view: string;
  /** The component the drawing was generated from. */
  from: string;
  /** The commit it was generated at, if one was recorded. */
  at?: string;
  /** Commits touching that file since, newest first. */
  since: Array<{ sha: string; when: string; subject: string; body: string }>;
  /** ⛔ Said out loud rather than implied by an empty list. */
  why?: string;
}

const git = (repo: string, args: string[]): string => {
  try {
    return execFileSync("git", ["-C", repo, ...args], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};

/** The commit a repo is at now, or undefined where it is not a repo. */
export const headOf = (repo: string): string | undefined => git(repo, ["rev-parse", "HEAD"]) || undefined;

/**
 * ⛔ THE REPO A FILE ACTUALLY BELONGS TO — asked of the file, never assumed from config.
 *
 * The first cut derived the repo from `web.components_dir`, which points at the project's own
 * checkout, while the route being read was in a detached worktree at a different commit. So it
 * recorded the drawing as having come from the project's HEAD when it came from somewhere else
 * entirely: provenance that is WRONG, which is worse than none, because nothing downstream can
 * tell and every comparison built on it is silently against the wrong baseline.
 *
 * A worktree has its own HEAD and `--show-toplevel` from the file's own directory finds it.
 */
export function repoOf(file: string): { root: string; head?: string } | undefined {
  const dir = path.dirname(path.resolve(file));
  const root = git(dir, ["rev-parse", "--show-toplevel"]);
  if (!root) return undefined;
  return { root, head: git(dir, ["rev-parse", "HEAD"]) || undefined };
}

/**
 * Walk what has happened to each drawn screen's source since the drawing was made.
 *
 * `repo` is the codebase the corpus describes; the drawings record paths relative to it.
 */
export function whatMoved(corpus: Corpus, repo: string): Moved[] {
  const out: Moved[] = [];
  for (const { scope } of corpus.scopes) {
    for (const v of scope.views) {
      if (v.exists === "withdrawn" || !v.drawn_from) continue;
      const rel = path.isAbsolute(v.drawn_from) ? path.relative(repo, v.drawn_from) : v.drawn_from;
      const row: Moved = { scope: scope.id, view: v.id, from: rel, at: v.drawn_at, since: [] };

      if (!v.drawn_at) {
        /**
         * ⛔ NOT SILENTLY SKIPPED. A drawing with no commit recorded cannot be compared with
         * anything, and reporting nothing for it reads as "nothing has changed" — which is the
         * failure this whole module exists to stop, reproduced inside it.
         */
        row.why = "no commit was recorded when this was drawn, so nothing can be compared";
        out.push(row);
        continue;
      }

      /** ⛔ `--follow` so a renamed component is still the same component. */
      const log = git(repo, ["log", "--follow", `${v.drawn_at}..HEAD`, "--format=%H%x1f%ci%x1f%s%x1f%b%x1e", "--", rel]);
      if (!log) {
        // Either nothing happened, or the recorded commit is not in this repo. Tell them apart.
        if (!git(repo, ["cat-file", "-t", v.drawn_at])) row.why = `the commit it was drawn at (${v.drawn_at.slice(0, 9)}) is not in this repository`;
        out.push(row);
        continue;
      }
      for (const rec of log.split("\x1e")) {
        const [sha, when, subject, body] = rec.trim().split("\x1f");
        if (!sha) continue;
        row.since.push({ sha: sha.slice(0, 9), when: (when ?? "").slice(0, 10), subject: subject ?? "", body: (body ?? "").trim() });
      }
      out.push(row);
    }
  }
  return out;
}
