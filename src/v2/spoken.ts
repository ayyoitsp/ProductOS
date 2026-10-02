/**
 * Which scopes a person has already spoken about — and therefore which ones a regeneration may not
 * overwrite from v1.
 *
 * ⛔ WHY. Peter: *"--force should only take the user feedback and regenerate based on it, taking the
 * user feedback as truth."*
 *
 * `--force` rebuilt the truth tree from the v1 corpus and treated that as authoritative. But v1 is
 * the OLD understanding: its `deal-pricing.md` still carries ninety-seven mentions of staging,
 * overrides, typed cells and a publish gate — the model Peter corrected twice, in writing, on the
 * page — while v2 now says nothing on that screen can be typed into. A rebuild from v1 therefore
 * silently restores the thing he rejected, and the notes recording the rejection are closed, so
 * nothing objects.
 *
 * A regeneration that can undo a human correction is worse than no regeneration: the corpus looks
 * freshly derived and is quietly back to a shape somebody already refused.
 *
 * So a scope a person has acted on is not rebuilt. What they said outranks what v1 remembers.
 */
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

export interface Spoken {
  /** Scope id. */
  scope: string;
  /** Why it is held back, in words a person can check. */
  because: string[];
}

/** The scope a ref belongs to. `deal-pricing#grid#answer#x` → `deal-pricing`. */
export function scopeOfRef(ref: string): string {
  return String(ref).split("#")[0]!.trim();
}

function rows(file: string, key: string): Array<Record<string, unknown>> {
  try {
    const raw = YAML.parse(fs.readFileSync(file, "utf-8")) ?? {};
    const list = (raw as Record<string, unknown>)[key];
    return Array.isArray(list) ? (list as Array<Record<string, unknown>>) : [];
  } catch {
    return [];
  }
}

function eachFile(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

/**
 * Every scope the human record touches, with the reason.
 *
 * ⛔ A CLOSED NOTE COUNTS, AND COUNTS MOST. An open note is a request nobody has acted on yet; a
 * CLOSED one means somebody already changed the truth because of it, and that change is exactly
 * what a rebuild from v1 would throw away. Reading only open notes would protect the scopes nothing
 * had happened to and abandon the ones that had.
 */
export function spokenFor(corpusDir: string): Spoken[] {
  const found = new Map<string, string[]>();
  const note = (scope: string, why: string): void => {
    if (!scope) return;
    const list = found.get(scope) ?? [];
    if (!list.includes(why)) list.push(why);
    found.set(scope, list);
  };

  for (const file of eachFile(path.join(corpusDir, "notes")))
    for (const n of rows(file, "notes")) {
      const scope = scopeOfRef(String(n.about ?? ""));
      const who = String(n.by ?? "somebody");
      const when = String(n.at ?? "");
      note(
        scope,
        n.state === "done"
          ? `a request ${who} made on ${when} was already acted on here`
          : `${who} has an open request about this, made on ${when}`
      );
    }

  for (const file of eachFile(path.join(corpusDir, "verdicts")))
    for (const v of rows(file, "verdicts")) {
      /**
       * ⛔ NOT A VERDICT SOFTWARE PRODUCED. `via: agent` is a decision, never somebody agreeing —
       * and holding a scope back from regeneration on the strength of one would let a model's own
       * output outrank the corpus it was derived from.
       */
      if (String(v.via ?? "") === "agent") continue;
      note(scopeOfRef(String(v.target ?? "")), `${String(v.by ?? "somebody")} stamped something here on ${String(v.at ?? "")}`);
    }

  return [...found.entries()].map(([scope, because]) => ({ scope, because })).sort((a, b) => a.scope.localeCompare(b.scope));
}
