/**
 * ⛔ WHICH STEERS ARE IN EFFECT, AND THE ONE PLACE THAT ANSWERS IT.
 *
 * Peter: *"either update the framework, or have 'org/project' addendum to the corpus that will run
 * per org/project - so a self learning loop"* — and, asked how far an addendum should reach:
 * *"Both"*. Install-time, into an author's prompt, and at runtime when something is proposed.
 *
 * ⛔ TWO PATHS, ONE SET. That is the whole reason this file exists. Two readers deciding for
 * themselves which steers count is two answers to "what is this project being told", and the first
 * time they disagree nobody can tell which one shaped the thing in front of them. The adapter and
 * the authors both call `inEffect`; neither filters.
 *
 * ⛔ AND IT WAS ALL INERT. Before this, `Steer` was defined in the schema, loaded by `load.ts`,
 * refused when malformed by `check.ts` and rendered on the charter by `page.ts` — and read by
 * nothing that makes anything. No corpus contained one, and no command wrote one. The ticket
 * proposing a learning loop recorded that steers were "read by the generators"; they were not, so
 * every lesson the loop could have learned would have landed somewhere that changes nothing while
 * reading as closed. The outlet is built first for that reason.
 */
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { Steer } from "./schema.js";
import { AUTHORS, AGENTS, DISCIPLINES } from "../core/jobs.js";

/**
 * The generation steers a project is actually working under.
 *
 * ⛔ `truth` STEERS ARE NOT HERE, and that is not an omission. A steer that constrains the product
 * is a claim somebody agreed to: it belongs on the charter, where a reviewer meets it and can
 * disagree. Feeding it to an author as taste would launder a constraint into a habit — and the
 * schema already refuses the reverse, a truth steer claiming to have been learned.
 *
 * ⛔ A DECLINED STEER IS GONE FROM HERE, not softened. Somebody looked at it and said it is not a
 * rule in this project; a steer that still shapes output after that is a constraint nobody chose.
 */
export function inEffect(steers: readonly Steer[], who?: string): Steer[] {
  const live = steers.filter((s) => s.steers === "generation" && !s.declined);
  return who === undefined ? live : live.filter((s) => reaches(s, who));
}

/**
 * Whether one steer reaches one author, by name.
 *
 * ⛔ AN EMPTY `for` IS EVERY AUTHOR, AND THAT IS WHAT MAKES THIS SAFE TO ADD. Every steer written
 * before targeting existed reaches exactly who it reached yesterday; nothing already in a corpus
 * changes meaning because a field arrived.
 *
 * ⛔ AND IT IS ASKED ABOUT AN AUTHOR, NEVER A JUDGE. The caller is `installClaudeAuthors`, which
 * walks `AUTHORS` — so "could a judge match a discipline?" is a question this function is never in
 * a position to be asked. The guarantee stays where it was: two registries, two functions, one of
 * which appends taste. Naming a judge in `for` is refused by the verb that writes a steer and
 * reported by `check`; neither is load-bearing, because the reaching cannot happen either way.
 */
export function reaches(s: Steer, who: string): boolean {
  /**
   * ⛔ NOT AN AUTHOR, NOT REACHED — INCLUDING BY AN UNTARGETED STEER.
   *
   * The first cut returned `true` for an empty `for` before looking at who was asking, so asking
   * this about `buildability` answered yes. Nothing calls it that way — `installClaudeAuthors`
   * walks `AUTHORS` — but that made the guarantee a property of the caller, which is a comment
   * doing a guarantee's job. Asked about anybody who does not write, the answer is no, here.
   */
  const author = AUTHORS.find((a) => a.name === who);
  if (!author) return false;
  /**
   * ⛔ `?.` BECAUSE A DEFAULT ONLY APPLIES ON PARSE. `for` defaults to `[]` through the schema, so
   * anything loaded from a corpus has it — but a renderer handed a steer built in code does not,
   * and this is called from one. Crashing a page over an absent optional is a worse failure than
   * the one the field exists to prevent.
   */
  if (!s.for?.length) return true;
  return s.for.some((t) => t === who || t === author.discipline);
}

/**
 * What a name in `for` would actually reach — the answer `check` reports on and the verb refuses on.
 *
 * ⛔ A TARGET THAT REACHES NOBODY IS THE `integrator` BUG AGAIN: a value somebody can write that
 * nothing acts on, and which reads as working. Three ways to write one, all of them plausible:
 * a typo (`design` and `designer` are one character apart and mean different things), a judge
 * (`buildability` is a real role and can never be steered), and a discipline with no authors in it
 * — `the framework itself` has two judges and nobody who writes.
 */
export function wouldReach(target: string): { authors: string[]; why?: string } {
  const byName = AUTHORS.find((a) => a.name === target);
  if (byName) return { authors: [byName.name] };
  const judge = AGENTS.find((a) => a.name === target);
  if (judge)
    return {
      authors: [],
      why: `${target} judges — a reviewer told what this project likes can no longer notice the project is wrong`,
    };
  const seat = AUTHORS.filter((a) => a.discipline === target);
  if (seat.length) return { authors: seat.map((a) => a.name) };
  if ((DISCIPLINES as readonly string[]).includes(target))
    return { authors: [], why: `nobody authors in "${target}" — it is a seat of reviewers` };
  return { authors: [], why: `no role or discipline is called "${target}"` };
}

/** Every generation steer somebody has turned off, with the reason they gave. */
export function declined(steers: readonly Steer[]): Steer[] {
  return steers.filter((s) => s.steers === "generation" && Boolean(s.declined));
}

/**
 * What this project has learned, as a block an author's prompt can carry.
 *
 * ⛔ IT SAYS IT IS NOT FRAMEWORK TRUTH, in the text itself. An author handed a flat list of rules
 * cannot tell which of them the model guarantees and which this project merely prefers — and the
 * difference decides what it is allowed to do when one of them is inconvenient. Provenance travels
 * for the same reason it is required on the field: a pattern is only worth following if the next
 * person can go and look at what it was inferred from.
 *
 * Returns an empty string where nothing is in effect, so a caller can append unconditionally
 * without emitting an empty heading.
 */
export function addendum(steers: readonly Steer[], who?: string): string {
  /**
   * ⛔ ASKED PER AUTHOR NOW. Passing nothing still means "everything in force", which is what the
   * settings surface wants; passing a name is what an install does, so a habit about one craft
   * stops arriving in prompts it is noise in.
   */
  const live = inEffect(steers, who);
  if (!live.length) return "";
  const lines = live.map((s) =>
    // ⛔ The provenance is visible, not a comment. An author who cannot see what a habit was
    // inferred from cannot judge whether it applies to the thing in front of them.
    s.learned_from ? `- ${s.says}\n  *learned from: ${s.learned_from}*` : `- ${s.says}`
  );
  return [
    "## What steers this project",
    "",
    "⛔ **Learned here, not framework truth.** These are this project's habits — how things get made,",
    "what keeps coming back in review. Follow them where they fit. Where one of them would make you",
    "write something untrue, the truth wins and the steer is what was wrong.",
    "",
    ...lines,
  ].join("\n");
}

/**
 * Read a corpus's steers off disk, without loading the whole corpus.
 *
 * ⛔ WHY NOT `loadCorpus`. This is called at INSTALL time, where there may be no parseable corpus
 * at all — a project installing ProductOS for the first time has config and nothing else. Loading
 * everything to reach one small file would make installing fail for the people most likely to be
 * installing. A steers file that will not parse is skipped, for the same reason `load.ts` collects
 * broken files rather than throwing: one bad file must not take the command down with it.
 */
export function readSteers(corpusDir: string): Steer[] {
  const dir = path.join(corpusDir, "steers");
  if (!fs.existsSync(dir)) return [];
  const out: Steer[] = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (!/\.(ya?ml)$/.test(f)) continue;
    try {
      const raw = YAML.parse(fs.readFileSync(path.join(dir, f), "utf-8")) ?? {};
      for (const x of raw.steers ?? []) out.push(Steer.parse(x));
    } catch {
      continue;
    }
  }
  return out;
}
