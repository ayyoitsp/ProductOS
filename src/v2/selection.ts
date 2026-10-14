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
import { resolveView, type Corpus } from "./load.js";
import { axesOf, answersOf, type Axis } from "./schema.js";
import { walkOf } from "./walk.js";

/**
 * The screen a prototype's front door names, or nothing.
 *
 * ⛔ ONE PREDICATE, BECAUSE TWO OF THEM HAD ALREADY DISAGREED — within an hour of being written,
 * and in the direction that teaches people to ignore the page.
 *
 * `check` refuses a door onto nothing by resolving with `resolveView`, which accepts a bare view id
 * inside a scope as well as `<scope>#<view>`. `gapsIn` tested a map keyed only as
 * `${scope}#${view}`. So `starts_at: balance` — a perfectly good door — passed handover and was
 * REPORTED BROKEN on the page a reviewer reads:
 *
 *     check  → passes, the ref resolves
 *     gapsIn → "Fine" opens on balance, which is not a screen in this corpus
 *
 * That is the shape this repo already carries a scar from: one condition, two implementations,
 * diverging by one clause. A false positive on the surface is the worse direction — it tells
 * somebody their correct corpus is broken, and the lesson they take is that the page is noise.
 *
 * ⛔ SO BOTH CALL THIS, and neither owns a copy of the rule. It returns the view rather than a
 * boolean so the chooser can name the screen it opens on using the same resolution that decided it
 * exists — a title looked up a second way is the same divergence with a smaller blast radius.
 */
export function doorOpensOn(
  c: Corpus,
  startsAt: string
): { scope: string; title: string } | undefined {
  if (!startsAt) return undefined;
  for (const entry of c.scopes) {
    const hit = resolveView(c, entry.scope, startsAt);
    if (hit) return { scope: hit.scope, title: hit.view.title ?? hit.view.id };
  }
  return undefined;
}

export interface Option {
  id: string;
  title: string;
  /** This one's answer on each axis, keyed by axis id. Empty until somebody says. */
  is: Record<string, string>;
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
  /**
   * The dimensions, in order — each with its name and the values it can take.
   *
   * ⛔ SEVERAL, BECAUSE ONE WAS WRONG THE DAY IT SHIPPED. Peter: *"It's going to split on different
   * products - CRE vs private lending, then also on roles"*. A single question could hold one of
   * those and the other would have had to be folded into the same string.
   *
   * ⛔ AND THE VALUES ARE WHAT MAKE THIS A SELECTOR. *"they should be able to select the appropriate
   * dimensions and that will bring up the right prototype"* — without values a reader gets one
   * button per thing that exists, which is a list and not a choice.
   */
  axes: Axis[];
  /**
   * Every combination the dimensions allow, each with the prototype that covers it — or nothing.
   *
   * ⛔ THE UNCOVERED ONES ARE THE POINT. Two dimensions with two values each is four products a
   * reader can ask for; three prototypes means one of those four does not exist, and that was
   * invisible while the surface could only list what had been declared.
   */
  at: Array<{ values: Record<string, string>; option?: Option }>;
  /** The first dimension's name, where there is one. */
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
  const drawn = new Set<string>();
  for (const entry of c.scopes)
    for (const v of entry.scope.views ?? []) {
      /**
       * ⛔ BOTH SPELLINGS, FOR THE SAME REASON `doorOpensOn` EXISTS. A door may name a screen as
       * `<scope>#<view>` or by its bare id where that is unambiguous, and a set keyed only one way
       * said a valid door's screen had no picture.
       */
      if (v.sketch_html || v.sketch) {
        drawn.add(`${entry.scope.id}#${v.id}`);
        drawn.add(v.id);
      }
    }

  const axes = axesOf(c.splitsOn, protos);
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
      is: answersOf(p.is, axes),
      startsAt: p.starts_at,
      opensOn: doorOpensOn(c, p.starts_at)?.title,
      reaches: walk.reachable.size,
      drawn: drawn.has(p.starts_at),
      chrome: Boolean(p.shell_html),
    };
  });

  /**
   * ⛔ THE CROSS PRODUCT, CAPPED. A product splitting on three dimensions of five values is 125
   * combinations, which is a page nobody reads — and the cap is stated rather than silent, because a
   * surface that quietly stopped at some number would be lying about what the dimensions allow.
   */
  const at: Selection["at"] = [];
  const CEILING = 60;
  const build = (i: number, picked: Record<string, string>): void => {
    if (at.length >= CEILING) return;
    if (i === axes.length) {
      const option = options.find((o) => axes.every((ax) => o.is[ax.id] === picked[ax.id]));
      at.push({ values: { ...picked }, ...(option ? { option } : {}) });
      return;
    }
    const ax = axes[i]!;
    /** A dimension with no values contributes nothing to choose, and must not erase the rest. */
    if (!ax.values.length) return build(i + 1, picked);
    for (const v of ax.values) build(i + 1, { ...picked, [ax.id]: v });
  };
  if (axes.length) build(0, {});

  return { axes, at, question: axes[0]?.label, options, lands: options[0]?.id };
}

/**
 * ⛔ A GAP CARRIES ITS KIND, RATHER THAN A CHECK MATCHING MY PROSE.
 *
 * `check` classified these by regex against the sentence — `/both answer/`, `/opens on/` — so
 * rewording a message silently reclassified a finding. It happened within the hour: "both answer
 * X" became "are both X" when the model gained a second axis, the regex stopped matching, and
 * `two-prototypes-one-answer` was reported as `prototype-answers-nothing`. The foil's MUST_FIRE
 * caught it, which is the only reason it is not still true.
 *
 * ⛔ THE PROSE IS STILL THE PROSE. A reader gets the sentence; a check gets the kind. What is gone
 * is a second place that has to agree with the first about what a sentence means.
 */
export type GapKind =
  | "prototypes-split-on-nothing"
  | "prototype-answers-nothing"
  | "two-prototypes-one-answer"
  | "prototype-opens-on-nothing"
  | "nothing-covers-this";

export interface Gap {
  kind: GapKind;
  says: string;
}

/**
 * What is wrong with this selection, in the words a reader would use.
 *
 * ⛔ SEPARATE FROM THE DERIVATION, so a surface can show the selection and a check can report the
 * gaps without either one deciding what the other says. Both read the same list.
 */
export function gapsIn(s: Selection): Gap[] {
  const gaps: Gap[] = [];
  if (s.options.length > 1 && !s.question)
    gaps.push({
      kind: "prototypes-split-on-nothing",
      /**
       * ⛔ NO FIELD NAME. This said "state it with `splits_on`" and shipped onto a reader's page —
       * the exact thing Peter was objecting to when he called the surface a barf, and the exact
       * thing CLAUDE.md forbids: nothing a reader sees names the storage. A reader does not type
       * keys; they open the dimensions and name one. So the sentence says what to do.
       *
       * ⛔ AND MY TEST FOR IT PASSED. It asserted `splits_on` was absent from a page rendered from a
       * corpus that HAD dimensions — so this gap never fired and the assertion was about a case the
       * fixture could not reach. Caught on the live page by the deploying session, which is the
       * fixture-with-one-state hole I have been naming all week, in the test I wrote to close it.
       */
      says: `${s.options.length} prototypes, and nothing says what they are alternatives about — name a dimension below`,
    });
  /**
   * ⛔ A MISSING ANSWER COUNTS WHETHER OR NOT THE QUESTION HAS BEEN WRITTEN DOWN YET.
   *
   * Keyed on `question` alone, this fired for nobody in the one corpus built to provoke it: no
   * question stated, so no answer was owed, so three prototypes answering an axis and a fourth
   * answering nothing read as entirely consistent. If any option says where it sits then a split is
   * in play, and the one that says nothing is the hole — exactly the state a half-authored set is
   * in, which is when somebody is looking.
   *
   * ⛔ PER AXIS, so a prototype that says which product line it is and nothing about role is HALF
   * answered rather than answered. With one axis folded into one string that state could not exist,
   * which is most of why one axis was wrong.
   */
  const axes = s.axes.length ? s.axes : [{ id: "split", label: "" }];
  const anyAnswers = s.options.some((o) => Object.keys(o.is).length);
  if (s.question || anyAnswers)
    for (const o of s.options)
      for (const ax of axes)
        if (!o.is[ax.id])
          gaps.push({
            kind: "prototype-answers-nothing",
            says: ax.label
              ? `"${o.title}" does not say its ${ax.label.toLowerCase()}`
              : `"${o.title}" says nothing about where it sits, while others do`,
          });
  /**
   * ⛔ TWO OPTIONS AT THE SAME POINT IS THE ONE A READER CANNOT SEE PAST. The chooser shows two rows,
   * both say "CRE · admin", and the split it claims to be is not the split it is.
   *
   * ⛔ THE WHOLE COMBINATION, NOT ONE AXIS. Two prototypes both answering "CRE" is exactly right
   * when one is the admin and one the processor — comparing axis by axis would report every
   * correctly-crossed set as a duplicate, which is the false-positive direction that teaches people
   * to ignore the page.
   */
  const at = new Map<string, string[]>();
  for (const o of s.options) {
    const answered = axes.map((ax) => o.is[ax.id]).filter(Boolean);
    if (answered.length !== axes.length) continue;
    const key = answered.join(" · ");
    at.set(key, [...(at.get(key) ?? []), o.title]);
  }
  for (const [where, which] of at)
    if (which.length > 1)
      gaps.push({ kind: "two-prototypes-one-answer", says: `${which.join(" and ")} are both "${where}"` });
  /**
   * ⛔ AN ANSWER THAT IS NOT ONE OF THE DIMENSION'S VALUES. Once a dimension says what it can be, a
   * prototype claiming something else is unreachable from the selector — a reader can never pick the
   * combination that would show it, so it is declared and invisible.
   */
  for (const ax of s.axes)
    if (ax.values.length)
      for (const o of s.options) {
        const said = o.is[ax.id];
        if (said && !ax.values.includes(said))
          gaps.push({
            kind: "prototype-answers-nothing",
            says: `"${o.title}" says ${ax.label} is "${said}", which is not one of ${ax.values.join(", ")} — nobody can select it`,
          });
      }
  /**
   * ⛔ A COMBINATION NOTHING COVERS, which is the question the whole surface exists to raise. Said
   * as a fact rather than a fault: a product may legitimately have no admin view of one line, and
   * the point is that somebody can now SEE that and decide.
   */
  for (const cell of s.at)
    if (!cell.option && Object.keys(cell.values).length)
      gaps.push({
        kind: "nothing-covers-this",
        says: `nothing covers ${s.axes.map((ax) => cell.values[ax.id]).filter(Boolean).join(" · ")}`,
      });
  for (const o of s.options)
    if (!o.opensOn)
      gaps.push({
        kind: "prototype-opens-on-nothing",
        says: `"${o.title}" opens on ${o.startsAt}, which is not a screen in this corpus`,
      });
  return gaps;
}

