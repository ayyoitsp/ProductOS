/**
 * What connects to what — worked out from the product truth, not from the code.
 *
 * ⛔ WHY NOT THE CODE. Peter: *"doesn't matter what code says. it should be obvious what connects to
 * what, right? like productos should be able to figure this out itself. there's only one thing 'add
 * deal' should do, right?"* — and then: *"code is ONLY reference for initializing/onboarding to
 * product OS"*.
 *
 * He is right, and the reason is the target-state principle: the corpus describes what the product
 * SHOULD be, so a graph derived from `router.push` can only ever connect the screens that happen to
 * exist today. A button on an unbuilt screen leading to another unbuilt screen is a fact about the
 * product, and the corpus already holds it — the control is called "New Deal", the sentence beneath
 * it says it begins creating a deal, and there is a feature called "Creating a deal" with a screen
 * called "Create a deal". Nothing in there requires a codebase.
 *
 * ⛔ AND IT DECIDES, IT DOES NOT AGREE. Software may work this out; a person may overrule it. So a
 * proposed destination carries WHY, in the corpus's own words, and is easy to argue with.
 */
import type { Corpus } from "./load.js";
import type { Scope, View } from "./schema.js";
import { saysText } from "./schema.js";

export interface Connection {
  /** `<scope>#<view>#<part>` — the control. */
  from: string;
  /** `<scope>#<view>` — where it goes. */
  to: string;
  /** The words that made this the answer, so a reader can disagree with it. */
  because: string[];
  score: number;
  /** The next best, and its score, so a close call is visible rather than hidden. */
  runnerUp?: { to: string; score: number };
}

export interface Unconnected {
  from: string;
  label: string;
  why: string;
  closest?: Array<{ to: string; score: number }>;
}

/**
 * ⛔ Words that carry meaning. Without this every control matches every screen through "the", "a"
 * and "of", and the margin rule that keeps this honest never gets a chance to fire.
 */
const STOP = new Set(
  ("a an the of to in on at for from by with and or not is are be been was were this that these those it its" +
   " they them their what which who whom when where how why all any both each few more most other some such" +
   " no nor only own same so than too very can will just should now do does did done has have had having" +
   " begins begin their there here then out up down into over under again once about against between during" +
   " before after above below off further one two three first second new").split(/\s+/)
);

/** Light stemming: enough that "creating" meets "create" and "deals" meets "deal". */
function stem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const suffix of ["ing", "ers", "er", "ed", "es", "s"]) {
    if (w.length > 4 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

function words(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of String(text).split(/[^A-Za-z0-9]+/)) {
    if (!raw) continue;
    if (STOP.has(raw.toLowerCase())) continue;
    const w = stem(raw);
    if (w.length >= 3) out.add(w);
  }
  return out;
}

/** Everything the corpus says about this control: its label, and every sentence anchored to it. */
function saidAbout(
  scope: Scope,
  view: View,
  partId: string
): { all: string; sentences: string; anchored: boolean } {
  const part = (view.parts ?? []).find((p) => p.id === partId);
  const bits: string[] = [part?.label ?? partId];
  const sentences: string[] = [];
  /**
   * ⛔ AN EXCHANGE ANCHORED AT A CONTROL IS ALREADY ABOUT THAT CONTROL, and requiring the prose to
   * repeat the control's name inside its own slot is asking an author to write a fact twice.
   *
   * Peter: *"you can't go past the folder selection screen. is that a framework issue or indexing
   * issue?"* — this half is the framework. The rule below demands a sentence shaped "<the control's
   * label> <a going-verb>" before a commit may reach a screen. That is the right test for a
   * sentence in a SCREEN-level exchange, where several controls share the prose and something has
   * to say which one it is about. It is the wrong test for a slot on an exchange whose `at` names
   * the control: the anchor IS the statement of what it is about.
   */
  /**
   * ⛔ AND A SCREEN-LEVEL EXCHANGE COUNTS, WHERE THE CONTROL HAS NONE OF ITS OWN.
   *
   * A commit control is how a screen's exchange gets ASKED — the detail panel has said so since
   * the last round, in those words. The folder step is one exchange with three ways of answering
   * it: Use This Folder, Create Folder, Choose Different Folder. Its `after` says the analyst is
   * taken to the deal workspace, and requiring each control to carry its own copy of that sentence
   * is asking for three records of one fact so that a matcher can find it.
   *
   * ⛔ ONLY WHERE THE CONTROL HAS NOTHING OF ITS OWN. A control with its own exchange has said
   * what it does, and the screen's sentence is about a different ask.
   */
  const own = scope.exchanges.filter((ex) => ex.at?.view === view.id && ex.at?.part === partId);
  const performs = own.length
    ? own
    : scope.exchanges.filter((ex) => ex.at?.view === view.id && !ex.at?.part);
  /**
   * ⛔ WHERE A PRESS LANDS IS IN `after` AND `answer`, SO ONLY THOSE ARE SCORED FOR IT.
   *
   * Scoring every slot sent "Create Folder" to the documents tab, on the strength of a sentence in
   * its `with` about documents getting their own subfolder — a fact about what the folder contains,
   * matched against a screen because they share a word. The model has always said a commit lands
   * where its answer says; reading the rest of the exchange to decide that is reading the wrong
   * sentences.
   */
  const LANDS_IN = new Set(["after", "answer"]);
  let anchored = false;
  for (const ex of performs) {
    anchored = true;
    bits.push(ex.title ?? "");
    for (const [slot, body] of Object.entries(ex.slots ?? {})) {
      const says = (body as { says?: unknown } | undefined)?.says;
      const texts = typeof says === "string" ? [says] : Array.isArray(says) ? (says as Array<{ says: string }>).map((x) => x.says) : [];
      /**
       * ⛔ AND THEY FEED THE SCORE TOO, NOT ONLY THE VERB TEST. Narrowing the verb test alone left
       * "Create Folder" pointing at the documents tab: the word came from a `with` sentence about
       * what the folder would contain, and that sentence was still in the bag being matched.
       */
      for (const t of texts) if (LANDS_IN.has(slot)) { bits.push(t); sentences.push(t); }
    }
  }
  /**
   * ⛔ THE SENTENCES SEPARATELY FROM THE LABEL. The blob starts with the control's name, so any test
   * for "the label, then a navigation verb" matched whatever happened to follow — which is how
   * "Add columns" acquired a destination from a sentence about what the statement shows on arrival.
   */
  return { all: bits.join(" "), sentences: sentences.join(" "), anchored };
}

/**
 * What a screen IS, weighted by where it is said.
 *
 * ⛔ A WORD IN A TITLE IS WORTH MORE THAN A WORD IN A PARAGRAPH, and flat scoring is why the first
 * run linked "Clear filters" to "Create a deal": both mention deals somewhere, and a happy path is
 * long enough to mention almost anything. A screen's NAME is what it is; its purpose sentence is
 * context.
 */
function weightedOf(scope: Scope, view: View): Map<string, number> {
  const out = new Map<string, number>();
  const add = (text: string, weight: number): void => {
    for (const w of words(text)) out.set(w, Math.max(out.get(w) ?? 0, weight));
  };
  add(scope.happy_path?.accomplishes ?? "", 1);
  add(scope.title ?? scope.id, 3);
  add(view.title ?? view.id, 4);
  return out;
}

/**
 * ⛔ A MARGIN, NOT A MAXIMUM — the same rule the route resolver keeps, for the same reason. A
 * two-to-one call reported as confidently as five-to-nothing is how a wrong arrow gets drawn on a
 * map somebody then trusts.
 */
export function inferConnections(corpus: Corpus): { made: Connection[]; missed: Unconnected[] } {
  const screens: Array<{ id: string; scope: Scope; view: View; weights: Map<string, number> }> = [];
  for (const s of corpus.scopes)
    for (const v of s.scope.views)
      screens.push({ id: `${s.scope.id}#${v.id}`, scope: s.scope, view: v, weights: weightedOf(s.scope, v) });

  const made: Connection[] = [];
  const missed: Unconnected[] = [];

  for (const s of corpus.scopes)
    for (const v of s.scope.views)
      for (const p of v.parts ?? []) {
        if (p.leads_to) continue;
        /**
         * ⛔ A RETURNING CONTROL HAS ALREADY SAID WHERE IT GOES — back to this screen as it was.
         * Scoring it against other screens gave Back and "Choose Different Folder" a destination on
         * the deal workspace, purely because they sit on a screen whose prose mentions it.
         */
        if (p.returns) continue;
        /** ⛔ Only a control that GOES somewhere. A `commits` part lands where its answer slot says. */
        if (p.role !== "navigates" && p.role !== "commits") continue;
        const from = `${s.scope.id}#${v.id}#${p.id}`;
        const { all: said, sentences, anchored } = saidAbout(s.scope, v, p.id);
        /**
         * ⛔ DOES THE SENTENCE SAY IT GOES ANYWHERE? Most controls on a screen act in place —
         * Clear filters, Acknowledge, Publish, Bulk map — and the first run happily connected every
         * one of them to whichever screen shared a word. The model already holds this rule from the
         * other side: `leads_to` is refused on a control that commits, because where it lands is the
         * answer slot rather than a link. So the corpus is asked, not guessed at.
         */
        /**
         * ⛔ THE VERB HAS TO BE ABOUT THIS CONTROL, not merely present in the paragraph.
         *
         * Matching a navigation word anywhere linked "Add columns" to the publish modal, on the
         * strength of a sentence reading *"The statement OPENS on the trailing twelve periods"* —
         * which is what the screen shows when you arrive, not what the button does. The one link
         * that is obviously right reads *"New Deal begins creating a deal"*: the control's own name,
         * then the verb. That shape is the evidence.
         */
        const label = (p.label ?? p.id).trim();
        const NAV = "(begins?|opens?|takes?|goes?|returns?|leads?|starts?|creat\\w*|navigat\\w*)";
        /**
         * ⛔ SKIPPED WHERE THE EXCHANGE IS ANCHORED AT THE CONTROL — see `saidAbout`. What is still
         * required is a going-verb SOMEWHERE in its own slots: a control whose answer describes
         * only what becomes true acts in place, and most of them do.
         */
        /**
         * ⛔ THE PERSON MOVES, NOT THE THING. Reusing NAV here connected "Continue" to the deals
         * list on the strength of *"the deal is CREATED on the CRE deals list"* — a sentence about
         * where a record appears, not about where anybody goes. `creat` belongs in NAV because the
         * label-shaped test reads "New Deal begins CREATING a deal", where the control's own name
         * carries the aboutness. With the anchor carrying it instead, the verb has to do the rest
         * of the work, so it has to be a verb of arrival and take a destination after it.
         */
        const ARRIVES = /\b(takes?|taken|brings?|brought|lands?|arrives?|returns?|goes?|sends?|sent)\b[^.]{0,40}?\b(to|on|at|onto)\b/i;
        const goes = ARRIVES.test(sentences);
        /**
         * ⛔ ADDITIVE, NEVER INSTEAD OF. Replacing the label-shaped test with the arrival test
         * dropped the one link in this corpus a person would draw without thinking — "New Deal
         * begins creating a deal" names its control and its verb, and says nothing about anybody
         * ARRIVING anywhere. Two shapes of evidence, either of which is enough: the control's own
         * name beside a going-verb, or an exchange anchored at the control whose slots say somebody
         * is taken somewhere.
         */
        const namedHere =
          label.length >= 3 &&
          new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[^.]{0,40}?\\b${NAV}\\b`, "i").test(sentences);
        const aboutIt = namedHere || (anchored && goes);
        if (!aboutIt) {
          missed.push({ from, label: p.label ?? p.id, why: "nothing here says this control goes anywhere — it acts on the screen it is on" });
          continue;
        }
        const mine = words(said);
        if (mine.size < 2) {
          missed.push({ from, label: p.label ?? p.id, why: "nothing is said about this control, so there is nothing to match on" });
          continue;
        }
        const scored = screens
          .filter((sc) => sc.id !== `${s.scope.id}#${v.id}`)
          .map((sc) => {
            const hit = [...mine].filter((w) => sc.weights.has(w));
            const score = hit.reduce((n, w) => n + (sc.weights.get(w) ?? 0), 0);
            return { to: sc.id, score, because: hit };
          })
          .sort((a, b) => b.score - a.score);
        const best = scored[0];
        const next = scored[1];
        /** ⛔ At least one TITLE word. A screen matched only through its purpose paragraph is a
         *  coincidence of vocabulary, which is exactly what produced the first run's nonsense. */
        if (!best || best.score < 4) {
          missed.push({
            from,
            label: p.label ?? p.id,
            why: "no screen shares enough of what this control says it does",
            closest: scored.slice(0, 2).map((x) => ({ to: x.to, score: x.score })),
          });
          continue;
        }
        /**
         * ⛔ THE WINNER MUST OWN A WORD OF THE DESTINATION'S NAME THAT THE RUNNER-UP DOES NOT.
         *
         * A margin alone called 9-against-7 a tie and refused to connect "New Deal" to "Create a
         * deal" — which is the one link in this corpus a person would draw without thinking. What
         * separates them is not the gap in the totals, it is that only one of them shares the VERB:
         * both screens are about deals, one is about CREATING them.
         */
        const titleHits = (id: string): Set<string> => {
          const sc = screens.find((x) => x.id === id)!;
          return new Set([...mine].filter((w) => (sc.weights.get(w) ?? 0) >= 3));
        };
        const bestTitle = titleHits(best.to);
        const nextTitle = next ? titleHits(next.to) : new Set<string>();
        const distinguishing = [...bestTitle].filter((w) => !nextTitle.has(w));
        if (next && !distinguishing.length) {
          missed.push({
            from,
            label: p.label ?? p.id,
            why: "two screens match it equally, so which one it goes to is a guess",
            closest: [best, next].map((x) => ({ to: x.to, score: x.score })),
          });
          continue;
        }
        made.push({
          from,
          to: best.to,
          /** ⛔ The words that SEPARATED it, not every word it happened to share. */
          because: distinguishing.length ? distinguishing : best.because,
          score: best.score,
          runnerUp: next ? { to: next.to, score: next.score } : undefined,
        });
      }

  return { made, missed };
}

/**
 * ⛔ WHERE A PRESS LANDS, WORKED OUT FROM WHAT THE SLOT SAYS.
 *
 * Peter: *"i hit continue, and nothing changes. some text below changes, but the prototype doesn't
 * drive."* He is right and it is the whole premise — a prototype that describes navigating instead
 * of navigating is a diagram with extra steps.
 *
 * ⛔ AND IT CANNOT COME FROM A LINK, BY DESIGN. `leads_to` is REFUSED on a `commits` part, because
 * where a commit lands is its `answer` — writing it twice is two records of one fact and they
 * disagree within a week. So the destination is DERIVED from the sentence that already says it:
 * *"the analyst is then asked where its folder is"* against a state called *Folder*.
 *
 * ⛔ FROM THE TRUTH, NEVER THE CODE. Peter: *"code is ONLY reference for initializing/onboarding to
 * product OS"*. The component knows perfectly well that Continue calls `setPhase('folder')` and
 * that is not what this reads — a prototype wired from the implementation shows a reviewer what was
 * built, which is the one thing a target-state corpus must not be steered by.
 *
 * ⛔ AND IT SAYS WHAT IT READ. `because` carries the sentence, so an arrow a reviewer disagrees
 * with is an arrow they can argue with rather than one they have to reverse-engineer.
 */
export interface Landing {
  /** The control pressed. */
  part: string;
  /** Which state of this screen it lands on — index into `states`, so 1 is the first. */
  index: number;
  label: string;
  /** The sentence this was read from, so an arrow can be argued with rather than reverse-engineered. */
  because: string;
}

/**
 * ⛔ A STATE'S NAME IS WHAT IT IS; ITS CONDITION IS CONTEXT — the same weighting the screen matcher
 * above uses, for the same reason. A `when` is code, and code mentions whatever code mentions.
 */
function stateWeights(label: string, when: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const w of words(when)) out.set(w, Math.max(out.get(w) ?? 0, 1));
  for (const w of words(label)) out.set(w, Math.max(out.get(w) ?? 0, 4));
  return out;
}

export function landingsFor(scope: Scope, view: View): Landing[] {
  const states = view.states ?? [];
  if (!states.length) return [];
  const out: Landing[] = [];

  for (const pt of view.parts) {
    /**
     * ⛔ A RETURNING CONTROL NEEDS NO SENTENCE READ, because it already says where it goes. State 0
     * is the screen as it was — the one destination that stays true however the drawing changes.
     */
    if (pt.returns) {
      out.push({ part: pt.id, index: 0, label: view.title ?? view.id, because: "this control returns to the screen as it was" });
      continue;
    }
    if (pt.role !== "commits") continue;
    /**
     * ⛔ THE EXCHANGE AT THE CONTROL FIRST, THEN THE SCREEN'S OWN. A commit control is how a
     * screen's exchange gets asked, so an exchange anchored at the view with no part of its own is
     * the one this control performs — the same reasoning the detail panel uses.
     */
    const at =
      scope.exchanges.find((e) => e.at?.view === view.id && e.at?.part === pt.id) ??
      scope.exchanges.find((e) => e.at?.view === view.id && !e.at?.part);
    if (!at) continue;
    /**
     * ⛔ `after` BEFORE `answer`. What a press LEAVES BEHIND is where you end up; what it GIVES you
     * is usually the thing itself. Both of "the deal is created on the CRE deals list" and "the
     * analyst is then asked where its folder is" are true, and only the second says where you are.
     */
    const because = saysText(at.slots?.after?.says) || saysText(at.slots?.answer?.says);
    if (!because) continue;
    const mine = words(because);
    if (!mine.size) continue;

    const scored = states.map((st, i) => {
      const w = stateWeights(st.label, st.when);
      const score = [...mine].reduce((n, x) => n + (w.get(x) ?? 0), 0);
      /**
       * ⛔ AND HOW MUCH OF THE STATE'S OWN NAME THE SENTENCE ACCOUNTS FOR. "Folder" and "Folder
       * failure" both match the word folder and score identically, so the margin rule rejected
       * both and the prototype drove nowhere. The sentence accounts for all of "Folder" and half
       * of "Folder failure" — which is the difference between the state it names and a state that
       * merely shares a word with it.
       */
      const nameWords = [...words(st.label)];
      const covered = nameWords.length ? nameWords.filter((x) => mine.has(x)).length / nameWords.length : 0;
      return { index: i + 1, label: st.label, score, covered };
    });
    scored.sort((a, b) => b.score - a.score || b.covered - a.covered);
    const best = scored[0];
    const next = scored[1];
    /**
     * ⛔ A MARGIN, NOT A MAXIMUM — the rule this file and the route resolver already keep. A
     * prototype that drives on a two-to-one reading teaches a reviewer a flow the corpus does not
     * claim, and they cannot tell it was a guess.
     */
    if (!best || best.score < 4 || best.covered < 1) continue;
    if (next && next.score >= best.score && next.covered >= best.covered) continue;
    out.push({ part: pt.id, index: best.index, label: best.label, because });
  }
  return out;
}

/**
 * ⛔ CROSS-SCREEN LANDINGS ARE NOT DERIVED HERE, AND THE FIRST VERSION OF THIS DID.
 *
 * It scored a commit's `after` against every screen in the corpus and produced nine arrows, most of
 * them wrong: a "Dismiss" notice landing on the source-versions screen, a "Sign in" landing there
 * too, "Continue" on create-a-deal landing on the deals list because its sentence mentions the list
 * the deal appears on. `inferConnections` above already answers "which screen does this control
 * reach", conservatively, and produced exactly one arrow on the same corpus.
 *
 * Two derivations of one fact is the thing this project keeps paying for. This one answers only the
 * question nothing else answered: which state of THIS screen a press moves to.
 */

/**
 * ⛔ WHICH CONTROL FINISHES THE FLOW — so a walk can END rather than just stop being here.
 *
 * Peter: *"we are going straight to the deals list on completion. but we should be showing a
 * completion screen here.. or maybe we should have a placeholder indicating that the flow is
 * complete? awkwards to go back to the deals list feature from here"*.
 *
 * ⛔ NOT A PLACEHOLDER. The feature already says what finishing means — `happy_path.ends_with`,
 * authored, agreed to, and never once rendered at the end of a walk. A placeholder saying "flow
 * complete" would be a second thing to maintain that says less than the sentence already there.
 *
 * ⛔ AND ARRIVING SOMEWHERE IS NOT FINISHING. A control in the middle of a flow lands on the next
 * screen and the walk continues; a control on the LAST screen of `through` whose destination is
 * another feature is the end of this one. The difference is what makes the jump feel like being
 * dropped: the reviewer had finished and nothing said so, so leaving read as losing their place.
 */
export function finishesFor(scope: Scope, view: View): string[] {
  const through = scope.happy_path?.through ?? [];
  if (!through.length) return [];
  /** Only the last screen of the path can finish it. */
  if (through[through.length - 1] !== view.id) return [];
  const ends = scope.happy_path?.ends_with;
  if (!ends) return [];

  /**
   * ⛔ AND ONLY A CONTROL THAT DOES WHAT FINISHING MEANS.
   *
   * Every commit on the last screen used to count, which is far too blunt: it marked "New Deal" as
   * finishing the deals list. That is a control which LEAVES the feature, and treating it as the
   * end suppressed its link — breaking the one cross-feature connection in the corpus, the one
   * anybody would draw by hand.
   *
   * The feature already says what finishing is. A control finishes it when what the control leaves
   * behind is what the feature says it ends with: *"the deal exists on the CRE deals list, and its
   * sizing model has been written into the folder"* against *"the deal is bound to that folder…
   * taken on to the deal workspace"*. "New Deal" against *"they are in that deal's workspace"*
   * shares almost nothing, which is the right answer — starting a deal is not finishing a list.
   */
  const want = words(ends);
  if (!want.size) return [];
  return view.parts
    .filter((pt) => pt.role === "commits" && !pt.returns)
    .filter((pt) => {
      const at =
        scope.exchanges.find((e) => e.at?.view === view.id && e.at?.part === pt.id) ??
        scope.exchanges.find((e) => e.at?.view === view.id && !e.at?.part);
      if (!at) return false;
      const did = words(`${saysText(at.slots?.after?.says)} ${saysText(at.slots?.answer?.says)}`);
      if (!did.size) return false;
      const shared = [...did].filter((w) => want.has(w)).length;
      /**
       * ⛔ A MARGIN, NOT A SINGLE WORD. Two sentences about the same product share "deal" without
       * being about the same thing, and one match would make every commit a finish again.
       */
      return shared >= 3;
    })
    .map((pt) => pt.id);
}
