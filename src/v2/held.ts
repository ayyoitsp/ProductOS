/**
 * Whether a person has worked on a screen yet — derived, never ticked.
 *
 * ⛔ A SWEEP THAT OVERWRITES A REVIEWED SCREEN DESTROYS THE ONLY EXPENSIVE THING IN A CORPUS.
 *
 * Peter: *"we should add some internal tracking to screens - when screens haven't had review yet
 * (including product truth), we can freely regenerate. once they have been operated on, they
 * should stay locked. from there, only direct user input changes things."*
 *
 * `v2 draw --all` rewrote every screen it could resolve, every run. That is exactly right while a
 * screen is a first guess — the sweep is the whole reason sixty screens were drawn at all, and
 * asking per screen would have stopped it being a sweep. It stops being right the moment somebody
 * reads a screen and says something about it, because from then on the corpus holds a judgement
 * the generator never heard of and cannot reproduce.
 *
 * ⛔ DERIVED FROM THE ACTS THAT ALREADY EXIST, because a `locked: true` field is a second record of
 * something the corpus already knows with nothing keeping the two in step — and it would be a
 * boolean somebody ticks, which this model refuses everywhere else. Three things count as a person
 * having worked on a screen, and all three were already being written down:
 *
 * | what | why it counts |
 * | --- | --- |
 * | a **note** about the screen | somebody stood in front of it and said something |
 * | a **verdict** on truth it `shows` | the product truth behind it was agreed or ruled — his parenthetical, *"including product truth"* |
 * | a **reading** a person recorded about it | an observation somebody made by looking |
 *
 * ⛔ A DRAWN READING IS NOT A PERSON. `draw` records each run as a reading, so counting every
 * reading would mean the first sweep held the corpus against the second — the generator holding a
 * screen against itself, and `--all` going inert after one run for no stated reason. Its readings
 * now say who wrote them, which is also the only thing in a corpus that tells a machine's
 * observation from somebody's.
 *
 * ⛔ AND A HOLD STOPS THE SWEEP, NOT THE SCREEN. Naming a screen on the command line is direct user
 * input and goes through: *"from there, only direct user input changes things"*. What is refused is
 * the run nobody aimed at this screen in particular.
 */
import type { Corpus } from "./load.js";
import type { View } from "./schema.js";

/** What `draw` writes its own readings as, so they can be told from somebody's. */
export const THE_GENERATOR = "productos v2 draw";

export interface Hold {
  /** What the person did: said something, ruled on the truth, or recorded an observation. */
  what: "note" | "verdict" | "reading";
  by: string;
  at?: string;
  /** Their words, where the act carries any — so a refusal can say what it is protecting. */
  says?: string;
}

/**
 * Whether an act's target touches what a screen claims to show.
 *
 * ⛔ COMPARED AT THE SHALLOWER DEPTH, NOT FOR EQUALITY. A view's `shows` is `<exchange>#<slot>` or
 * `<exchange>#<slot>#<statement>` with the scope implied; a verdict’s `target` is
 * `<scope>#<exchange>#<slot>`. A verdict on a slot covers a screen showing one statement of it, and
 * a screen showing the whole slot is touched by an act on any statement in it. String equality
 * would make the hold depend on which depth an author happened to type, which is not a fact about
 * the product.
 */
function touches(shown: string, about: string): boolean {
  const a = shown.split("#").filter(Boolean);
  const b = about.split("#").filter(Boolean);
  const n = Math.min(a.length, b.length);
  if (!n) return false;
  for (let i = 0; i < n; i++) if (a[a.length - n + i] !== b[b.length - n + i]) return false;
  return true;
}

/** Every act a person has taken on this screen. Empty means nobody has — regenerate freely. */
export function holdsOn(c: Corpus, scopeId: string, view: View): Hold[] {
  const ref = `${scopeId}#${view.id}`;
  const held: Hold[] = [];

  for (const n of c.notes ?? []) {
    /** `about` is whatever they were looking at — a scope, a statement, or a view. */
    if (n.about === ref || n.about === view.id || n.about.endsWith(`#${view.id}`))
      held.push({ what: "note", by: n.by, at: n.at, says: n.says });
  }

  /**
   * ⛔ THE SCREEN'S OWN TRUTH, WHICH IS THE HALF HE PUT IN BRACKETS. A screen with no note on it
   * can still be one whose every sentence somebody agreed to this morning, and redrawing it from a
   * component that has changed since walks the picture away from the agreement underneath it with
   * nothing saying so.
   */
  const shows = view.shows ?? [];
  if (shows.length)
    for (const v of c.verdicts ?? []) {
      const about = v.target ?? "";
      if (!about) continue;
      const scoped = about.startsWith(`${scopeId}#`) ? about.slice(scopeId.length + 1) : about;
      if (shows.some((s) => touches(s, scoped))) held.push({ what: "verdict", by: v.by, at: v.at, says: v.says });
    }

  for (const r of c.readings ?? []) {
    /**
     * ⛔ TWO DISCRIMINATORS, BECAUSE `basis.by` ONLY EXISTS ON READINGS DRAWN FROM TODAY ON.
     *
     * Every corpus drawn before this field was added has its generated readings with no author at
     * all, and on the first real corpus this ran against that was all eight of them — so the
     * feature's first act would have been to lock eight screens on the strength of the generator's
     * own work. It passed on a fresh fixture and was wrong on the corpus, which is the whole reason
     * to run it somewhere real before believing it.
     *
     * The id has named them since the first version of `writeDrawnReading`, so it works backwards
     * through every corpus in existence; `basis.by` is the honest statement going forward. Neither
     * is redundant: an id prefix is a convention and `by` is a fact.
     */
    if ((r.basis?.by ?? "") === THE_GENERATOR || r.id.startsWith("drawn-")) continue;
    const about = r.bears_on ?? "";
    if (about === ref || about.endsWith(`#${view.id}`))
      held.push({ what: "reading", by: r.basis?.by ?? "somebody", says: r.observes });
  }

  return held;
}

/** Whether the sweep must leave this screen alone. */
export function isHeld(c: Corpus, scopeId: string, view: View): boolean {
  return holdsOn(c, scopeId, view).length > 0;
}

/** One line a refusal can print: how it came to be held, and by whom. */
export function whyHeld(held: Hold[]): string {
  const first = held[0];
  const rest = held.length - 1;
  const how = first.what === "verdict" ? `its truth was ruled on by ${first.by}` : `a ${first.what} by ${first.by}`;
  return `${how}${rest > 0 ? ` and ${rest} other act${rest === 1 ? "" : "s"}` : ""}`;
}
