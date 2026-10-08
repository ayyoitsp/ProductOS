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

// ─── learning a habit from what people did to the truth ────────────────────────────────────────

/**
 * ⛔ A HABIT NOTICED FROM WHAT PEOPLE ACTUALLY DID, RATHER THAN FROM SOMEBODY TYPING IT.
 *
 * Peter: *"do we suggest steering when users are operating the product truth and suggesting
 * steering or auto-steering? shouldn't be explicit"* — and, asked which: *"In force immediately"*,
 * learned from *"Rulings, and notes with their outcomes"*.
 *
 * ⛔ IT LEARNS ONLY FROM HUMAN ACTS, AND THAT IS THE WHOLE THING HOLDING IT HONEST. A ruling
 * recorded `via: agent` is software's own output; a learner that reads those closes a loop with
 * nothing human left in it, and every pass afterwards is the system agreeing with itself more
 * loudly. `learned_from` would still be populated, and would still be worthless.
 *
 * ⛔ AND IT STATES WHAT WAS OBSERVED, NEVER A PRINCIPLE. "The word `currency` was added in three
 * rulings" is checkable; "amounts are always shown with their currency" is a generalisation nobody
 * made, which is the shape of a decision nobody took. A person reading it can reword it into a
 * principle — and then it is theirs.
 */
export interface Learned {
  /** A stable id, derived from the pattern, so the same observation is not learned twice. */
  id: string;
  /** The habit, as the observation it actually is. */
  says: string;
  /** ⛔ The acts behind it, by their own references, so somebody can go and look at each one. */
  from: string[];
}

/**
 * ⛔ WORDS THAT CARRY NO HABIT. Without this the commonest "pattern" across any two sentences is
 * `the`, and the learner reports grammar back as taste.
 */
const FILLER = new Set(
  ("a an and are as at be been being but by can could did do does for from had has have he her his " +
    "how i if in into is it its may me must my no not of on or our should so than that the their them " +
    "then there these they this to too up us was we were what when where which who will with would you " +
    "your").split(" ")
);

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FILLER.has(w));

const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "habit";

/**
 * What the record of human acts says this project keeps doing.
 *
 * `least` is the number of independent acts a pattern needs. ⛔ Two is a coincidence with a sample
 * size; a learner that reports it teaches people to ignore the output, which costs more than the
 * finding was worth.
 */
export function learnFrom(
  corpus: { verdicts: readonly Verdictish[]; notes: readonly Noteish[]; steers: readonly Steer[] },
  opts: { least?: number } = {}
): Learned[] {
  const least = opts.least ?? 3;
  const out: Learned[] = [];

  /**
   * ⛔ `via !== "agent"`. See the header — this is the refusal the whole concept rests on, and it
   * is one clause, which is exactly why it needs saying out loud here as well.
   */
  const rulings = corpus.verdicts.filter(
    (v) => v.kind === "rule" && v.via !== "agent" && typeof v.says === "string" && typeof v.replaced === "string"
  );

  /** A word repeatedly put IN, or repeatedly taken OUT, across independent rulings. */
  const added = new Map<string, Set<string>>();
  const removed = new Map<string, Set<string>>();
  for (const v of rulings) {
    const before = new Set(words(v.replaced!));
    const after = new Set(words(v.says!));
    const where = v.target ?? "a ruling";
    for (const w of after) if (!before.has(w)) (added.get(w) ?? added.set(w, new Set()).get(w)!).add(where);
    for (const w of before) if (!after.has(w)) (removed.get(w) ?? removed.set(w, new Set()).get(w)!).add(where);
  }

  for (const [word, where] of added)
    if (where.size >= least)
      out.push({
        id: slug(`says-${word}`),
        says: `"${word}" belongs in a sentence here — it was put into ${where.size} rulings that did not have it.`,
        from: [...where].sort(),
      });

  for (const [word, where] of removed)
    if (where.size >= least)
      out.push({
        id: slug(`not-${word}`),
        says: `"${word}" does not belong in a sentence here — it was taken out of ${where.size} rulings.`,
        from: [...where].sort(),
      });

  /**
   * ⛔ THE SAME REASONING GIVEN TWICE IS A STANDING ARGUMENT. A ruling's `because` exists so the
   * question is not relitigated from scratch; one written out again on a third slot has stopped
   * being a judgement about that slot and become how this project thinks.
   */
  const reasons = new Map<string, { why: string; where: Set<string> }>();
  for (const v of rulings) {
    const key = (v.because ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    if (key.length < 15) continue;
    const seen = reasons.get(key) ?? { why: v.because!, where: new Set<string>() };
    seen.where.add(v.target ?? "a ruling");
    reasons.set(key, seen);
  }
  for (const [, r] of reasons)
    if (r.where.size >= least)
      out.push({
        id: slug(`because-${r.why}`),
        says: `${r.why.replace(/\s+/g, " ").trim()} — the same reasoning settled ${r.where.size} separate slots.`,
        from: [...r.where].sort(),
      });

  /**
   * Notes somebody closed. ⛔ A WEAKER SIGNAL AND IT IS TREATED AS ONE: both ends are prose, so the
   * bar is what the asks have in common rather than what any one of them said. Only notes that were
   * acted on count — an open note is a request, not a thing this project does.
   */
  const asks = new Map<string, Set<string>>();
  for (const n of corpus.notes) {
    if (n.state !== "done" || !n.outcome) continue;
    for (const w of new Set(words(n.says ?? ""))) (asks.get(w) ?? asks.set(w, new Set()).get(w)!).add(n.id);
  }
  for (const [word, ids] of asks)
    if (ids.size >= least + 1)
      out.push({
        id: slug(`asked-${word}`),
        says: `"${word}" keeps coming up — ${ids.size} separate requests named it, and all of them were acted on.`,
        from: [...ids].sort(),
      });

  /**
   * ⛔ ANYTHING ALREADY DECLINED IS NOT LEARNED AGAIN. Somebody looked at this and said it is not a
   * rule here; the acts it was drawn from are still in the record, so without this the next pass
   * learns it straight back and the decline is a thing you have to keep doing forever.
   */
  const refused = new Set(corpus.steers.filter((s) => s.declined).map((s) => s.id));
  const known = new Set(corpus.steers.map((s) => s.id));
  return out.filter((l) => !refused.has(l.id) && !known.has(l.id)).sort((a, b) => a.id.localeCompare(b.id));
}

/** The shapes this reads, named loosely on purpose — it needs four fields, not the whole model. */
interface Verdictish {
  kind: string;
  via: string;
  target?: string;
  says?: string;
  replaced?: string;
  because?: string;
}
interface Noteish {
  id: string;
  says?: string;
  state?: string;
  outcome?: string;
}
