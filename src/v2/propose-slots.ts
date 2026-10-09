/**
 * Proposed answers to `refuses`, `fails` and `again`, read out of the component a screen was drawn
 * from.
 *
 * ⛔ WHY THIS EXISTS. These three slots are the ones a corpus leaves empty, and not by a little: on
 * bilrost, **45 of 54 exchanges answer none of the three**. Every state a screen can be in is
 * derived from them — `derive-states.ts` turns `refuses` into a case per outcome, `fails` into a
 * failed region, `again` into a busy control — so an empty trio is the reason a screen has nothing
 * to show but its happy path. Asking an author to fill 135 slots by hand is the thing this project
 * exists not to do.
 *
 * ⛔ IT LIFTS WORDS, IT NEVER WRITES THEM. The same line `propose.ts` holds for style, held here for
 * sentences — and it binds harder, because `told` is copy a user reads. Every proposed message is a
 * string literal that is already in the component. Where the code plainly refuses something but
 * says it in no words of its own, the question is raised with **no candidate**: a blank a person
 * fills is honest, and a sentence this file made up would be indistinguishable from one somebody
 * agreed to.
 *
 * ⛔ AND IT PROPOSES, SO EVERY ANSWER ARRIVES `open`. Nothing here is stated truth. A proposal is a
 * `Standing` of kind `open` carrying a question and candidates, which is the shape `v2 decide`
 * already renders and `--pick` already settles — so this adds a source of answers and not one new
 * way to agree to one. The human picks. That division is the project's oldest.
 *
 * ⛔ WHAT A CANDIDATE'S `consequence` MAY SAY, which is the one thing here that could have become a
 * guess. `consequence` is required and asks what follows if this is the answer — a judgement, and
 * unliftable. But one consequence is a *fact* about a code-read candidate: this is what the built
 * screen does today, so agreeing ratifies shipped behaviour and anything else is a change to it.
 * That is true of every candidate in this file and is stated identically on each, rather than each
 * getting a bespoke sentence nobody wrote.
 */
import fs from "node:fs";
import path from "node:path";
import type { Exchange, Scope, View } from "./schema.js";

/** A string literal found in the component, and where. */
export interface Lifted {
  text: string;
  line: number;
}

export interface ProposedCandidate {
  says?: string;
  outcomes?: { name: string; when: string; told: string }[];
  none?: boolean;
  consequence: string;
}

export interface SlotProposal {
  scope: string;
  exchange: string;
  slot: "refuses" | "fails" | "again";
  question: string;
  candidates: ProposedCandidate[];
  /** The component it was read from, repo-relative, for the report. */
  from: string;
  /** Lines in that component that are the evidence. */
  evidence: number[];
}

/**
 * ⛔ The one consequence this file is allowed to state, because it is the only one that is a fact
 * rather than a reading. Identical on every candidate on purpose — a bespoke sentence per candidate
 * is where invented content would enter.
 */
const RATIFIES =
  "This is what the built screen does today, so agreeing to it makes the shipped behaviour the agreed answer — and anything else is a change to what ships.";

/**
 * Words that are a developer talking to a developer, never a user.
 *
 * ⛔ Without this the first candidate off a real component proposed `told: "Failed to fetch"` and
 * `told: "unexpected response from /api/deals"` — a stack's words, filed as the sentence a borrower
 * reads.
 */
const NOT_USER_FACING =
  /\b(undefined|null|NaN|TODO|FIXME|XXX|unexpected|unknown error|failed to fetch|api|http|json|payload|endpoint|stack|console|debug|err|exception|typeerror|500|404|400)\b/i;

/**
 * Is this string a sentence somebody could read on a screen?
 *
 * ⛔ Deliberately strict. A rejected literal costs a blank a person fills in; an accepted one that
 * is really a variable name or a css class costs a sentence a reviewer may stamp.
 */
export function readableMessage(text: string): boolean {
  const t = text.trim();
  if (t.length < 10 || t.length > 200) return false;
  if (NOT_USER_FACING.test(t)) return false;
  // A message has spaces and no code punctuation.
  if (!/\s/.test(t)) return false;
  if (/[<>{}$`|\\]|=>|::|\/\//.test(t)) return false;
  if (t.includes("/") && !/\s\/\s/.test(t)) return false;
  if (!/^[A-Za-z]/.test(t)) return false;
  if (t.split(/\s+/).length < 2) return false;

  /**
   * ⛔ A TAILWIND CLASS LIST IS NOT A SENTENCE, and the first version proposed one as the words a
   * borrower reads: `told: "mb-6 rounded-md border border-red-200 bg-red-50 p-4"`, lifted off the
   * error box's own className two lines from the branch that renders it.
   *
   * The earlier guard was `^[a-z-]+(\s+[a-z0-9:-]+)+$`, which the very first token defeats — `mb-6`
   * has a digit, so `[a-z-]+` never matched and the whole test fell through.
   */
  const words = t.split(/\s+/);
  const classy = words.filter((w) => /^[a-z]+[a-z0-9]*(-[a-z0-9]+)+$/.test(w) || /^[a-z-]+:[a-z0-9-]+$/.test(w)).length;
  if (classy >= 2 || classy / words.length > 0.4) return false;

  /**
   * ⛔ `isConfigured: false` READS AS A SENTENCE TO A REGEX. A key and a value is code, wherever it
   * was found — and it reached `says` on the settings screen.
   */
  if (/^[A-Za-z_][A-Za-z0-9_]*\s*:\s*(true|false|null|undefined|-?\d|['"]?[a-z]+['"]?$)/.test(t)) return false;

  /**
   * ⛔ A FIELD LABEL IS NOT A REFUSAL. `"Reason (required)"` is what the field is called, not what
   * the asker is told when it is empty — and it was proposed as `told` on three exchanges.
   */
  if (/\((required|optional)\)$/i.test(t)) return false;

  return true;
}

/** Every single/double/backtick-quoted literal in the source, with its line. */
export function literals(src: string): Lifted[] {
  const out: Lifted[] = [];
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) {
      const text = m[2].replace(/\\(['"`])/g, "$1");
      if (text) out.push({ text, line: i + 1 });
    }
  });
  return out;
}

/**
 * The literal nearest a line, within a window — how a message is tied to the branch that shows it.
 *
 * ⛔ Nearest and not first: a component has many literals, and the one on the error branch is the
 * one beside it. A window, because a message is sometimes a line or two below its condition.
 */
function messageNear(src: string[], lits: Lifted[], line: number, window = 4): Lifted | undefined {
  return lits
    .filter((l) => {
      /**
       * ⛔ A MESSAGE COMES AFTER THE BRANCH THAT SHOWS IT, NEVER BEFORE. Searching symmetrically
       * picked up the heading above an error block — `"Sizing Results"` proposed as what the asker
       * is told when pricing cannot be computed.
       */
      if (l.line < line || l.line - line > window) return false;
      /** ⛔ And never a literal that is dressing the box rather than filling it. */
      if (/\bclass(Name)?\s*=|\bclsx\b|\bcn\(|\bvariant\s*[=:]/.test(src[l.line - 1] ?? "")) return false;
      return readableMessage(l.text);
    })
    .sort((a, b) => a.line - b.line)[0];
}

/**
 * ⛔ SPLIT THE CAMEL BEFORE LOWERCASING, or the boundary is gone before it can become a hyphen:
 * `propertyAddress` named a case `propertyaddress`, which is the address a ruling is delivered to.
 */
const slug = (s: string): string =>
  s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "unnamed";

/**
 * What this component says happens when the thing cannot be done.
 *
 * Evidence: a branch keyed on an error — `isError`, `error &&`, a `catch` — with a readable literal
 * beside it.
 */
export function failsFrom(src: string, lits: Lifted[]): { candidate?: ProposedCandidate; evidence: number[] } | undefined {
  const lines = src.split("\n");
  const hits: number[] = [];
  lines.forEach((line, i) => {
    if (/\bisError\b|\berror\s*(\?\?|\?|&&|instanceof)|\bcatch\s*\(|\bonError\b|\bisLoadingError\b/.test(line)) hits.push(i + 1);
  });
  if (!hits.length) return undefined;

  for (const h of hits) {
    const msg = messageNear(lines, lits, h);
    if (msg)
      return {
        candidate: {
          says: `The asker is told "${msg.text.trim()}" and is left on the screen with nothing loaded in place of what they asked for.`,
          consequence: RATIFIES,
        },
        evidence: [h, msg.line],
      };
  }
  // The branch exists and says nothing of its own. A question with no answer is the honest result.
  return { evidence: hits.slice(0, 3) };
}

/**
 * What this component does when the ask arrives twice.
 *
 * Evidence: the committing control is disabled while the first ask is in flight. That is a
 * structural fact, so the sentence is the same wherever the guard is — it is not copy, it is what
 * the guard does.
 */
export function againFrom(src: string): { candidate: ProposedCandidate; evidence: number[] } | undefined {
  const lines = src.split("\n");
  const guard: number[] = [];
  lines.forEach((line, i) => {
    if (/disabled\s*=\s*\{[^}]*\b(isPending|isSubmitting|isLoading|loading|saving|busy|pending)\b/i.test(line)) guard.push(i + 1);
  });
  if (!guard.length) return undefined;
  return {
    candidate: {
      says:
        "While the first ask is still being answered the control cannot be pressed, so asking twice is not possible from this screen and a second press does nothing.",
      consequence: RATIFIES,
    },
    evidence: guard.slice(0, 3),
  };
}

/**
 * What this component refuses, and in whose words.
 *
 * Evidence: a validation message tied to a named field — a zod message, a `setError`, or a required
 * check — where the message is readable.
 */
/**
 * What each check actually tests, in words — so `when` is read off the check rather than written.
 *
 * ⛔ THIS TABLE IS WHY `refuses` CAN BE PROPOSED AT ALL. `when` is required and cannot be lifted:
 * the first version filled every one with "what was given does not pass the check this screen
 * already applies to it", which is vague enough to be unfalsifiable and was prose I wrote, not
 * anything the component says. A reviewer stamping that has agreed to nothing.
 *
 * A zod method, by contrast, states its own test exactly. `.min(1)` IS "it was left empty". So the
 * trigger comes from the method and the words come from the message, and neither is invented.
 */
const WHEN_FROM_CHECK: Record<string, (arg: string, field: string) => string> = {
  min: (arg, f) => (arg.trim() === "1" ? `the ${f} is left empty` : `the ${f} is shorter than ${arg.trim()}`),
  nonempty: (_a, f) => `the ${f} is left empty`,
  max: (arg, f) => `the ${f} is longer than ${arg.trim()}`,
  email: (_a, f) => `the ${f} is not an email address`,
  url: (_a, f) => `the ${f} is not a web address`,
  positive: (_a, f) => `the ${f} is not greater than zero`,
  int: (_a, f) => `the ${f} is not a whole number`,
  gt: (arg, f) => `the ${f} is not greater than ${arg.trim()}`,
  lt: (arg, f) => `the ${f} is not less than ${arg.trim()}`,
};

export function refusesFrom(src: string, lits: Lifted[]): { candidate?: ProposedCandidate; evidence: number[] } | undefined {
  const lines = src.split("\n");
  const outcomes: { name: string; when: string; told: string }[] = [];
  const evidence: number[] = [];
  const seen = new Set<string>();

  lines.forEach((line, i) => {
    /**
     * ⛔ ONLY A CHECK THAT CARRIES ITS OWN MESSAGE. The dropped third heuristic was "a literal near
     * the word required", and what it found was `"Reason (required)"` — the field's label, proposed
     * as the sentence shown when the field is empty, on three exchanges at once.
     */
    /**
     * ⛔ TWO SHAPES, AND READING ONLY ONE MADE HALF THE CHECKS INVISIBLE. `.min(1, "…")` carries a
     * bound and then the message; `.email("…")` carries only the message. Requiring a comma meant
     * every single-argument check — `email`, `url`, `nonempty`, `positive`, `int` — was skipped in
     * silence, which is the quietest kind of miss: a generator that finds nothing looks exactly
     * like a component with nothing to find.
     */
    const z =
      line.match(/\.(min|max|regex|gt|lt)\s*\(\s*([^,)]*?)\s*,\s*(['"`])(.+?)\3/) ??
      line.match(/\.(email|url|nonempty|positive|int)\s*\(\s*()(['"`])(.+?)\3/);
    if (!z) return;
    const [, method, arg, , message] = z;
    if (!readableMessage(message)) return;
    const phrase = WHEN_FROM_CHECK[method];
    /** `regex` states no test a person can read, so it gets no `when` and therefore no candidate. */
    if (!phrase) return;
    const field = fieldNameAbove(lines, i);
    if (!field) return;
    const name = slug(field);
    if (seen.has(name)) return;
    seen.add(name);
    outcomes.push({ name, when: phrase(arg, humanise(field)), told: message.trim() });
    evidence.push(i + 1);
  });

  if (!outcomes.length) {
    // Is there validation at all, with nothing readable to lift?
    const any: number[] = [];
    lines.forEach((line, i) => {
      if (/\bzodResolver\b|\bsafeParse\b|\bsetError\b|\brequired\b|\bvalidate\b/.test(line)) any.push(i + 1);
    });
    return any.length ? { evidence: any.slice(0, 3) } : undefined;
  }
  return { candidate: { outcomes, consequence: RATIFIES }, evidence };
}

/** The nearest field name above a validation line — zod chains hang off a key. */
function fieldNameAbove(lines: string[], from: number): string | undefined {
  for (let i = from; i >= Math.max(0, from - 4); i--) {
    const m = lines[i].match(/^\s*(['"]?)([a-zA-Z_][a-zA-Z0-9_]*)\1\s*:/);
    if (m && !["message", "required", "params", "path", "then", "catch"].includes(m[2])) return m[2];
  }
  return undefined;
}

/** `propertyAddress` → `property address`, so a sentence reads like one. */
function humanise(field: string): string {
  return field
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();
}

const QUESTIONS = {
  refuses: "What does this refuse, and what is the asker told when it does?",
  fails: "What is the asker left with when this cannot be done?",
  again: "What happens when this is asked twice?",
} as const;

/** Is a slot already answered? An `open` standing counts — somebody is already being asked. */
function answered(e: Exchange, slot: "refuses" | "fails" | "again"): boolean {
  const f = (e as unknown as { slots?: Record<string, Record<string, unknown>> }).slots?.[slot];
  if (!f) return false;
  const standing = f.standing as { kind?: string } | undefined;
  return Boolean(
    f.says ||
      (f.outcomes as unknown[] | undefined)?.length ||
      f.cannot_fail ||
      f.none ||
      standing?.kind === "out_of_scope" ||
      standing?.kind === "open"
  );
}

/**
 * Read the component a screen was drawn from, and propose what it says about the three slots.
 *
 * ⛔ Only for exchanges that arrive at a screen with a `drawn_from`. The other kind — a
 * system-asked exchange with no view — has no component to read, and on bilrost that is 27 of the
 * 45. This file does not reach them and does not pretend to: a sweep that proposed sentences for
 * `limit-resolution` out of nothing is the failure mode, not the feature.
 */
export function proposeSlots(scope: Scope, project: string): SlotProposal[] {
  const views = new Map((scope.views ?? []).map((v) => [v.id, v]));
  const cache = new Map<string, { src: string; lits: Lifted[] } | null>();
  const out: SlotProposal[] = [];

  for (const e of scope.exchanges ?? []) {
    const view: View | undefined = e.at?.view ? views.get(e.at.view) : undefined;
    const rel = view?.drawn_from;
    if (!rel) continue;

    let read = cache.get(rel);
    if (read === undefined) {
      const full = path.isAbsolute(rel) ? rel : path.resolve(project, rel);
      try {
        const src = fs.readFileSync(full, "utf-8");
        read = { src, lits: literals(src) };
      } catch {
        read = null;
      }
      cache.set(rel, read);
    }
    if (!read) continue;

    /**
     * ⛔ WHOSE FAILURE IS IT. A screen holds several asks, and the first version gave all of them
     * the same one: `deals-list`, `clear-filters` and `new-deal-button` each received *"the asker
     * is told «Failed to load deals»"*, because the evidence was found in the file and the file
     * was reached through all three.
     *
     * Clearing a filter does not fail the way loading the list fails. `at` already draws the line —
     * an exchange with no `part` is the screen's own ask, and one with a `part` is that control's —
     * so page-wide evidence belongs to the former and nothing else. A control's own slots need
     * evidence beside that control, which this file does not yet locate; it proposes nothing rather
     * than proposing the screen's answer three times.
     */
    if (e.at?.part) continue;

    const { src, lits } = read;
    const found: Partial<Record<"refuses" | "fails" | "again", { candidate?: ProposedCandidate; evidence: number[] }>> = {
      refuses: refusesFrom(src, lits),
      fails: failsFrom(src, lits),
      again: againFrom(src),
    };

    for (const slot of ["refuses", "fails", "again"] as const) {
      if (answered(e, slot)) continue;
      const hit = found[slot];
      if (!hit) continue;
      out.push({
        scope: scope.id,
        exchange: e.id,
        slot,
        question: QUESTIONS[slot],
        candidates: hit.candidate ? [hit.candidate] : [],
        from: rel,
        evidence: hit.evidence,
      });
    }
  }
  return out;
}
