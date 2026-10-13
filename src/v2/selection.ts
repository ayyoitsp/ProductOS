/**
 * The choice a reader makes before they walk anything — which prototype they are in.
 *
 * ⛔ A SET OF ALTERNATIVES WITH NOTHING SAYING WHAT THEY ARE ALTERNATIVES ABOUT.
 *
 * Peter: *"we should have a first class "prototype selection' at the root of prototypes. the
 * multiple prototypes should be supported by the framework - what it splits on should be up to the
 * project/user driving it"*.
 *
 * Several prototypes were already expressible, and the surface rendered them as a row of unlabelled
 * buttons that appeared only when there happened to be more than one. So the first thing a reader
 * needs — *these are two versions of WHAT?* — was the one thing no part of the model held. A product
 * split by role, one split by whether you have signed in, and one split by line of business are
 * three different claims about the product, and all three drew the same picture.
 *
 * ⛔ THE AXIS IS THE PROJECT'S, AND IT IS STATED RATHER THAN GUESSED. *"what it splits on should be
 * up to the project/user driving it"* — so `splits_on` is a sentence somebody wrote, and a selection
 * with no question is reported rather than labelled "Role" by something that read two titles and
 * guessed. Same objection as `Note.kind`: a classifier here would be a guess wearing a decision's
 * clothes.
 *
 * ⛔ AND EVERYTHING ELSE HERE IS DERIVED, INCLUDING THE SIZE OF EACH ONE. How much of the product a
 * prototype actually reaches is the only thing that tells a reader whether "Admin" is a second way
 * through the product or a single screen somebody filed hopefully — and it is a fact about the
 * truth, so nobody types it.
 */
import type { Corpus } from "./load.js";
import { walkOf } from "./walk.js";

export interface Option {
  id: string;
  title: string;
  /** This one's answer to the question — absent until somebody says it. */
  is?: string;
  startsAt: string;
  /** The screen it opens on, by name, or absent where `starts_at` reaches nothing. */
  opensOn?: string;
  /** How many screens are reachable from its front door. Derived from the walk. */
  reaches: number;
  /** Whether a drawing exists for the screen it opens on — an option that opens on a blank is worth knowing about. */
  drawn: boolean;
  /** Whether it has its own chrome, or wears the product's default. */
  chrome: boolean;
}

export interface Selection {
  /** The question, in the project's own words. Absent until stated. */
  question?: string;
  options: Option[];
  /**
   * ⛔ WHICH ONE A READER LANDS IN, AND IT IS THE FIRST RATHER THAN A FLAG.
   *
   * A `default: true` on one prototype is a second record of ordering the file already carries, and
   * two of them marked default is a state nothing could resolve. The author orders the list; the
   * first is where a reader starts.
   */
  lands: string | undefined;
}

export function selectionOf(c: Corpus): Selection {
  const protos = c.prototypes ?? [];
  const titles = new Map<string, string>();
  const drawn = new Set<string>();
  for (const entry of c.scopes)
    for (const v of entry.scope.views ?? []) {
      const ref = `${entry.scope.id}#${v.id}`;
      titles.set(ref, v.title ?? v.id);
      if (v.sketch_html || v.sketch) drawn.add(ref);
    }

  const options = protos.map((p): Option => {
    /**
     * ⛔ THE WALK FROM THIS DOOR, NOT THE WHOLE CORPUS. The point of several prototypes is that each
     * reaches a different part of the product, so a count taken over everything would print the same
     * number beside every option and say nothing.
     */
    const walk = walkOf(c, p.starts_at);
    return {
      id: p.id,
      title: p.title,
      is: p.is,
      startsAt: p.starts_at,
      opensOn: titles.get(p.starts_at),
      reaches: walk.reachable.size,
      drawn: drawn.has(p.starts_at),
      chrome: Boolean(p.shell_html),
    };
  });

  return { question: c.splitsOn, options, lands: options[0]?.id };
}

/**
 * What is wrong with this selection, in the words a reader would use.
 *
 * ⛔ SEPARATE FROM THE DERIVATION, so a surface can show the selection and a check can report the
 * gaps without either one deciding what the other says. Both read the same list.
 */
export function gapsIn(s: Selection): string[] {
  const gaps: string[] = [];
  if (s.options.length > 1 && !s.question)
    gaps.push(
      `${s.options.length} prototypes with nothing saying what they are alternatives about — state it with \`splits_on\``
    );
  /**
   * ⛔ A MISSING ANSWER COUNTS WHETHER OR NOT THE QUESTION HAS BEEN WRITTEN DOWN YET.
   *
   * Keyed on `question` alone, this fired for nobody in the one corpus built to provoke it: no
   * question stated, so no answer was owed, so three prototypes answering an axis and a fourth
   * answering nothing read as entirely consistent. If any option says which side of the split it is
   * then a split is in play, and the one that says nothing is the hole — exactly the state a
   * half-authored set is in, which is when somebody is looking.
   */
  const anyAnswers = s.options.some((o) => o.is);
  if (s.question || anyAnswers)
    for (const o of s.options)
      if (!o.is)
        gaps.push(
          s.question
            ? `"${o.title}" gives no answer to "${s.question}" — say which one it is with \`is\``
            : `"${o.title}" says nothing about which side of the split it is, while others do`
        );
  /**
   * ⛔ TWO OPTIONS WITH THE SAME ANSWER IS THE ONE A READER CANNOT SEE PAST. The chooser shows two
   * rows and both say "admin", so the split it claims to be is not the split it is.
   */
  const seen = new Map<string, string[]>();
  for (const o of s.options) if (o.is) seen.set(o.is, [...(seen.get(o.is) ?? []), o.title]);
  for (const [is, which] of seen) if (which.length > 1) gaps.push(`${which.join(" and ")} both answer "${is}"`);
  for (const o of s.options)
    if (!o.opensOn) gaps.push(`"${o.title}" opens on ${o.startsAt}, which is not a screen in this corpus`);
  return gaps;
}
