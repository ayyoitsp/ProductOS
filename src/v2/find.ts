/**
 * The way in from a ticket — ⛔ A REF AND A LEVEL, OR IT IS NOT WORTH RUNNING.
 *
 * The usability review's fourth finding: *"The only entry point is `productos_exchange_scopes`, a
 * tree of ids, titles and counts. There is no search over claims, screens or terms, so mapping
 * 'parents can record spending larger than the balance' to `money#record-spending#after` is left to
 * the agent's guesswork."*
 *
 * An agent holding a ticket has a sentence in somebody else's words and needs the corpus's own
 * address for it. Every move it makes afterwards — the packet, the open questions, whether it may
 * build — takes a ref. So:
 *
 *  - ⛔ **EVERY HIT CARRIES A REF THAT RESOLVES.** A result that cannot be fed straight back in is a
 *    search that made the agent guess twice. Where a thing has no grain of its own — a term, a
 *    control on a screen — the ref is the nearest thing that does, and the hit says which word or
 *    which control matched. It never invents an address.
 *  - ⛔ **AND A LEVEL.** `levelOf` answers `accepted | derived | suggested | open` with its own
 *    sentence for why. A ticket lands on settled truth and somebody's unconfirmed draft equally
 *    often, and those go to different people; bolting the level on later means the search gets used
 *    without it for however long later takes.
 *  - ⛔ **NO MODEL ANYWHERE IN IT.** Word matching, a stated weight per field, and coverage first.
 *
 * ⛔ WHY THE RANKING IS ARITHMETIC AND NOT A SCORE SOMEBODY TUNED.
 *
 * `Selector`'s comment in the schema names the failure this has to avoid: *"The moment a selector
 * can express anything it becomes a query language nobody can invert."* A ranked list is the same
 * hazard one level down — an agent told these five refs are the relevant ones, with nothing saying
 * why, cannot tell a good answer from a plausible one, and the only recourse is to read the whole
 * corpus, which is the thing it came here to avoid.
 *
 * So the order is four keys a reader can recompute by hand:
 *
 *   1. **How many of your words it reached** — distinct, after stopwords. ⛔ FIRST, AND ALONE AT
 *      THE TOP: nothing can outrank something that matched more of what you typed. That is the one
 *      property that makes a list invertible without reading the code.
 *   2. **How many of those were its own words** rather than its surroundings. ⛔ THE SPECIFICITY
 *      TIE-BREAK, AND IT IS NOT DECORATION. On the review's own query the five testing requirements
 *      of `record-spending` each restate their exchange in full — *"a parent on the spend form, the
 *      parent records an amount spent"* — so they reach four words apiece on borrowed text and
 *      pushed `money#record-spending` itself, the ref an agent feeds to the packet, off the first
 *      page. Specificity is the thing a searcher wants and the thing a restatement cannot fake.
 *   3. **The weight of the fields they landed in**, summed. The table is `WEIGHTS` below, it is
 *      thirteen entries long, and every match returned says which entry it used.
 *   4. The ref, alphabetically, so two equal hits never swap places between runs.
 *
 * ⛔ AND CONTEXT NEVER MAKES A HIT — see `FLOOR`. Everything under an exchange would otherwise
 * match every word in its title, and a query naming a feature would return all eight slots of every
 * behaviour in it.
 */
import { lineageOf, type Corpus } from "./load.js";
import { SLOTS, saysText, statements, type SlotName } from "./schema.js";
import { levelOf, type Level } from "./level.js";

/** What a hit is. ⛔ The grain of the ref, so a caller knows what it is holding. */
export type FindKind =
  | "statement"
  | "refusal"
  | "requirement"
  | "exchange"
  | "screen"
  | "part"
  | "rule"
  | "rule-case"
  | "term"
  | "purpose"
  | "card"
  | "section"
  | "capability";

/**
 * What each field is worth, and ⛔ THE WHOLE OF THE RANKING IS HERE.
 *
 * Keyed by the words a reader is shown rather than by a field name, because the label is what comes
 * back on every match — so the table and the explanation cannot drift apart. Three bands:
 *
 *   5  the sentence itself, and the question where there is no sentence yet. What a ticket is about.
 *   2–4 the words around it that identify it: what it is called, what it refuses with, its own id.
 *   1  ⛔ everything that is somebody else's words — the exchange above a slot, the screen above a
 *      control. Present so a specific hit can be preferred, never enough to make one.
 */
export const WEIGHTS = {
  "what it says": 5,
  "the question nobody has answered": 5,
  /** ⛔ Its own entry rather than sharing the question's, because a standing carries both and one
   *  label on two fields reads as the same field matching twice. */
  "what is undecided here": 5,
  "what the word means": 5,
  "what the asker is told": 4,
  "when it refuses": 4,
  "what it is called": 3,
  "what it demonstrates": 3,
  "its own id": 2,
  "a drafted answer": 2,
  "what guessing wrong costs": 2,
  "the words it reads and changes": 2,
  "the picture": 1,
  "around it": 1,
} as const;

export type FieldName = keyof typeof WEIGHTS;

/**
 * ⛔ CONTEXT NEVER MAKES A HIT, ONLY STRENGTHENS ONE.
 *
 * A slot carries its exchange's title and the words that exchange reads and changes, because
 * "parents can record spending larger than the balance" names the feature in four words and the
 * undecided sentence in one. Without the context, the one undecided sentence reaches a single word
 * of the ticket and ranks below a screen label. With context and no floor, all eight slots of
 * `record-spending` and all eight of `record-earning` come back reaching four words each, which is
 * the tree-of-ids problem with extra steps.
 *
 * So: a unit is a hit only when one of its OWN fields matched. Context is then counted in full —
 * including toward coverage, which is what lifts the sentence that owns the ticket's one specific
 * word above the fifteen that share its surroundings.
 */
export const FLOOR = "a hit must match something of its own — context only strengthens one";

/**
 * Words dropped before searching.
 *
 * ⛔ NO SLOT NAME IS IN HERE, and that is deliberate rather than an oversight to tidy up. `with`,
 * `after` and `again` are function words in English and the names of three of the eight slots, so
 * dropping them would make `productos_find "what happens after"` unable to reach the slot that
 * answers it. The list is short on purpose: a stopword is a word the search cannot see, and a long
 * list is a long list of things nobody can search for.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "been", "but", "by", "can", "do", "does",
  "for", "from", "had", "has", "have", "i", "if", "in", "into", "is", "it", "its", "of", "on",
  "or", "our", "that", "the", "their", "them", "there", "these", "they", "this", "those", "to",
  "was", "we", "were", "what", "when", "where", "which", "will", "would", "you", "your", "than",
  "then", "so", "such", "no", "not", "all", "some", "my",
]);

/** ⛔ `-ing`/`-ed` on a doubled consonant: `stopping` and `stopped` both have to reach `stop`. */
const undouble = (w: string): string => (/([bdfglmnprt])\1$/.test(w) ? w.slice(0, -1) : w);

/**
 * One word, reduced so that `records`, `recorded` and `recording` reach `record`.
 *
 * ⛔ DELIBERATELY CRUDE, AND THE SAME CRUDENESS IS APPLIED TO BOTH SIDES — which is the only
 * property that matters. `larger` becomes `larg` and so does `large`; `answer` becomes `answ`.
 * Neither is a word, and neither has to be: the query and the corpus go through this one function,
 * so two spellings of a thing meet or they do not, and a reader can run it in their head.
 *
 * ⛔ IT DOES NOT KNOW IRREGULAR VERBS, AND SAYING SO IS CHEAPER THAN PRETENDING. `spent` does not
 * reach `spending`. A table of exceptions is a model of English maintained by hand, which is the
 * same thing as a ranked list nobody can invert — so what the matcher cannot do is reported rather
 * than approximated, and `Found.words` shows what each word was searched as.
 */
export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) w = undouble(w.slice(0, -3));
  else if (w.length > 4 && w.endsWith("ed")) w = undouble(w.slice(0, -2));
  if (w.length > 4 && w.endsWith("ly")) w = w.slice(0, -2);
  if (w.length > 4 && w.endsWith("er")) w = w.slice(0, -2);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Every word in a piece of text, lowercased and split on anything that is not a letter or digit. */
const words = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean);

/** One matched field, with everything that went into its contribution. */
export interface Match {
  /** Which field, in the words a reader is shown. A key of `WEIGHTS`. */
  field: FieldName;
  /** ⛔ Whether these are this thing's own words or the words around it — see `FLOOR`. */
  context: boolean;
  /** What that field is worth, per word it matched. */
  weight: number;
  /** Which of the query's words landed here, as they were typed. */
  matched: string[];
  /** The text they landed in. */
  text: string;
}

export interface Finding {
  /**
   * ⛔ RESOLVABLE, AND THE WHOLE REASON THIS COMMAND EXISTS. Hand it to the packet, the questions or
   * the readiness verdict without translating anything.
   */
  ref: string;
  kind: FindKind;
  /** What a reader is shown. ⛔ Never an id — the project rules say ids do not reach a reader. */
  title: string;
  /** Where it sits, in titles. */
  in?: string;
  /** The words that matched, in their sentence. */
  snippet: string;
  /** How established it is, and why. Absent only where nothing at this grain carries one. */
  level?: Level;
  /**
   * ⛔ WHY THERE IS NO LEVEL, IN `levelOf`'S OWN WORDS. A hit with a silently missing level reads as
   * one nobody has looked at; a feature holds facts rather than being one, and saying so is the
   * answer.
   */
  no_level?: string;
  /** ⛔ Which word of the thing it matched, where the ref is one grain coarser than the hit. */
  at?: string;
  /** Every contribution, in the order they were weighed. ⛔ The ranking, shown rather than summarised. */
  why: Match[];
  /** The distinct query words this reached, own fields and context together. ⛔ The first sort key. */
  reached: string[];
  /**
   * The subset of `reached` that landed in this thing's own words.
   *
   * ⛔ THE SECOND SORT KEY, AND IT IS WHAT KEEPS A RESTATEMENT FROM OUTRANKING THE THING IT
   * RESTATES. Never empty — see `FLOOR`.
   */
  reached_own: string[];
  /** The sum of `weight` over every matched word in every matched field. ⛔ The third sort key. */
  score: number;
}

export interface Found {
  query: string;
  /** Each searchable word and what it was searched as. ⛔ So a caller can see what the stemmer did. */
  terms: Array<{ word: string; as: string }>;
  /** What was dropped as a stopword, so nobody wonders where a word went. */
  dropped: string[];
  hits: Finding[];
  /** How many hits there were before `limit`. */
  matched: number;
  /** How many addressable things were searched. */
  searched: number;
  /**
   * ⛔ SAID OUT LOUD WHEN THERE IS NOTHING, RATHER THAN RETURNING THE LEAST-BAD THING.
   *
   * A search that always returns five results teaches its caller that the top one is an answer. An
   * agent holding a ticket about a feature this corpus has never described needs to be told that,
   * because the next move is to propose it rather than to go looking for the ref again.
   */
  nothing?: string;
}

/** A field of a unit, before anything has been matched against it. */
interface Field {
  field: FieldName;
  text: string;
  context: boolean;
}

/** One addressable thing, with the text that identifies it. */
interface Unit {
  ref: string;
  kind: FindKind;
  title: string;
  in?: string;
  at?: string;
  /**
   * The sentence a reader should be shown for this thing, where the match itself is not one.
   *
   * ⛔ BECAUSE A SNIPPET MADE OF AN ID IS A LEAK. `productos_find "balance"` came back with
   * `money#see-a-balance` quoting the words `see-a-balance`, and the term `balance` quoting the
   * word `balance` — both true, both matches on a slug, and both exactly what this project's rules
   * say must never reach a reader. An id is how the hit is addressed; it is never how it is read.
   */
  says?: string;
  /**
   * Which feature this sits in, for `under:`.
   *
   * ⛔ CARRIED RATHER THAN READ OFF THE REF, BECAUSE A RULE'S REF IS ITS OWN ID. Taking the segment
   * before the first `#` works for everything filed under a scope and silently drops every rule.
   * For a rule this is its `in:` — the feature whose vocabulary its selector is written in — which
   * is at or above everything it governs; see how `under` reads it.
   */
  feature?: string;
  fields: Field[];
}

const own = (field: FieldName, text: string | undefined): Field[] =>
  text && text.trim() ? [{ field, text, context: false }] : [];
const around = (text: string | undefined): Field[] =>
  text && text.trim() ? [{ field: "around it" as const, text, context: true }] : [];

/** What a standing holds that somebody searching for an undecided thing would type. */
function standingFields(standing: { question?: string; about?: string; cost?: string; candidates?: Array<{ says?: string; consequence?: string }> } | undefined): Field[] {
  if (!standing) return [];
  const out: Field[] = [
    ...own("the question nobody has answered", standing.question),
    ...own("what is undecided here", standing.about),
    ...own("what guessing wrong costs", standing.cost),
  ];
  for (const c of standing.candidates ?? []) {
    out.push(...own("a drafted answer", c.says));
    out.push(...own("a drafted answer", c.consequence));
  }
  return out;
}

/**
 * Everything in a corpus that has an address, with the words that identify it.
 *
 * ⛔ COARSER GRAINS ARE INCLUDED, UNLIKE `levelsIn`. That function counts facts, so counting an
 * exchange and its eight slots would report the same fact at two grains and make a distribution
 * meaningless. This one answers *what should I read*, and `money#record-spending` is the ref an
 * agent feeds to the packet — so the exchange is a destination even though it is not a fact.
 */
function unitsIn(corpus: Corpus): Unit[] {
  const out: Unit[] = [];
  const titleOf = (id: string): string => corpus.scopes.find((s) => s.scope.id === id)?.scope.title ?? id;

  for (const { scope, body } of corpus.scopes) {
    const scopeWords = `${scope.title} ${scope.id} ${(scope.tags ?? []).join(" ")}`;
    /** ⛔ Stamped once at the end of the feature rather than on nine pushes, so none can be missed. */
    const firstOfThisScope = out.length;

    if (scope.happy_path)
      out.push({
        ref: `${scope.id}#happy-path`,
        kind: "purpose",
        title: `What ${scope.title} is for`,
        in: scope.title,
        fields: [
          ...own("what it says", [scope.happy_path.accomplishes, scope.happy_path.brings, scope.happy_path.ends_with, scope.happy_path.not].filter(Boolean).join(" ")),
          ...own("its own id", scope.id),
          ...around(scopeWords),
          ...around(body),
        ],
      });

    for (const [list, held, label] of [
      ["why", scope.why, "Why"],
      ["risk", scope.risks, "A risk in"],
      ["measure", scope.measures, "A measure of"],
      ["instrument", scope.instruments, "What is recorded in"],
    ] as const)
      for (const card of held ?? [])
        out.push({
          ref: `${scope.id}#${list}#${card.id}`,
          kind: "card",
          title: `${label} ${scope.title}`,
          in: scope.title,
          fields: [
            ...own("what it says", card.says),
            ...own("its own id", card.id),
            ...around(scopeWords),
          ],
        });

    /**
     * ⛔ THE PRODUCT'S OWN VOCABULARY, AND IT IS THE HALF A TICKET MOST NEEDS. A ticket says
     * "balance"; the corpus files that word on the root feature and every exchange that touches it
     * declares it in `reads` or `changes`. The word is the bridge between somebody else's sentence
     * and this product's addresses, which is why a term is searched even though nothing can be
     * agreed to at the grain of a word.
     */
    for (const [word, term] of Object.entries(scope.terms ?? {}))
      out.push({
        ref: scope.id,
        kind: "term",
        title: `"${word}" in ${scope.title}`,
        in: scope.title,
        at: word,
        says: term.means,
        fields: [
          ...own("what it is called", word),
          ...own("what the word means", term.means),
          ...own("what the word means", (term.members ?? []).join(" ")),
          ...own("the question nobody has answered", term.contested?.question),
          ...around(scopeWords),
        ],
      });

    for (const view of scope.views) {
      const viewRef = `${scope.id}#${view.id}`;
      out.push({
        ref: viewRef,
        kind: "screen",
        title: view.title,
        in: scope.title,
        says: view.title,
        fields: [
          ...own("what it is called", view.title),
          ...own("its own id", view.id),
          ...own("what it demonstrates", (view.shows ?? []).join(" ")),
          ...own("the picture", view.sketch),
          ...own("what it is called", (view.states ?? []).map((s) => s.label).join(" ")),
          ...around(scopeWords),
        ],
      });
      /**
       * ⛔ A CONTROL HAS NO GRAIN OF ITS OWN, SO THE REF IS ITS SCREEN AND `at` NAMES THE CONTROL.
       *
       * `ref.ts` addresses a screen and not a part of one, and inventing `<scope>#<view>#<part>`
       * here would hand a caller an address that resolves nowhere — the precise failure this module
       * exists to stop. A ticket naming a button is answered with the screen the button is on, the
       * button named, and the screen's level.
       */
      for (const part of view.parts ?? [])
        out.push({
          ref: viewRef,
          kind: "part",
          title: `${part.label ?? part.id} on ${view.title}`,
          in: `${scope.title} · ${view.title}`,
          at: part.id,
          says: `${part.label ?? part.id} on ${view.title}`,
          fields: [
            ...own("what it is called", part.label),
            ...own("its own id", part.id),
            ...own("what it says", part.repeats),
            /** ⛔ What somebody is told while it is in a condition — "Borrower is required" is the
             *  sentence a ticket quotes, and it lives nowhere else. */
            ...own("what the asker is told", (part.states ?? []).map((s) => s.says ?? "").join(" ")),
            ...own("its own id", (part.states ?? []).map((s) => s.kind).join(" ")),
            ...around(`${view.title} ${scopeWords}`),
          ],
        });
    }

    for (const ex of scope.exchanges) {
      const exRef = `${scope.id}#${ex.id}`;
      const exWords = `${ex.title} ${ex.id} ${[...ex.reads, ...ex.changes].join(" ")}`;
      out.push({
        ref: exRef,
        kind: "exchange",
        title: ex.title,
        in: scope.title,
        says: ex.title,
        fields: [
          ...own("what it is called", ex.title),
          ...own("its own id", ex.id),
          ...own("the words it reads and changes", [...ex.reads, ...ex.changes].join(" ")),
          ...own("what it says", ex.when?.triggered_by),
          ...around(scopeWords),
        ],
      });

      for (const slot of SLOTS as readonly SlotName[]) {
        const fill = ex.slots[slot];
        if (!fill) continue;
        const said = statements(fill.says);
        /**
         * ⛔ STATEMENT-GRAINED WHERE A SLOT SAYS SEVERAL THINGS — the same device `levelsIn` and
         * `demonstrationOf` use. A ticket about one of four sentences should come back with the
         * address of that sentence, not of the paragraph it is in.
         */
        const grains =
          said.length > 1
            ? said.map((s) => ({ ref: `${exRef}#${slot}#${s.id}`, text: s.says }))
            : [{ ref: `${exRef}#${slot}`, text: saysText(fill.says) }];
        for (const g of grains)
          out.push({
            ref: g.ref,
            kind: "statement",
            title: `${ex.title} — ${slot}`,
            says: g.text,
            in: `${scope.title} · ${ex.title}`,
            fields: [
              ...own("what it says", g.text),
              ...standingFields(fill.standing as never),
              ...around(exWords),
              ...around(scopeWords),
            ],
          });

        for (const o of fill.outcomes ?? [])
          out.push({
            ref: `${exRef}#${slot}#${o.name}`,
            kind: "refusal",
            title: `${ex.title} refuses: ${o.name}`,
            says: o.told,
            in: `${scope.title} · ${ex.title}`,
            fields: [
              ...own("what the asker is told", o.told),
              ...own("when it refuses", o.when),
              ...own("its own id", o.name),
              ...standingFields(o.standing as never),
              ...around(exWords),
            ],
          });
      }

      for (const c of ex.criteria)
        out.push({
          ref: `${exRef}#shows#${c.id}`,
          kind: "requirement",
          title: `What ${ex.title} must be shown to do`,
          in: `${scope.title} · ${ex.title}`,
          fields: [
            ...own("what it says", [c.given, c.when, c.then, c.steps].filter(Boolean).join(" ")),
            ...around(exWords),
          ],
        });
    }
    for (let i = firstOfThisScope; i < out.length; i += 1) out[i]!.feature = scope.id;
  }

  for (const { rule, body } of corpus.rules) {
    out.push({
      ref: rule.id,
      kind: "rule",
      title: rule.id,
      says: rule.statement,
      in: rule.in ? titleOf(rule.in) : undefined,
      feature: rule.in,
      fields: [
        ...own("what it says", rule.statement),
        ...own("its own id", rule.id),
        ...own("what it says", rule.why),
        ...standingFields(rule.standing as never),
        ...around(body),
      ],
    });
    for (const o of rule.outcomes ?? [])
      out.push({
        ref: `${rule.id}#${o.name}`,
        kind: "rule-case",
        title: `${rule.id} refuses: ${o.name}`,
        says: o.told,
        in: rule.in ? titleOf(rule.in) : undefined,
        feature: rule.in,
        fields: [
          ...own("what the asker is told", o.told),
          ...own("when it refuses", o.when),
          ...own("its own id", o.name),
          ...standingFields(o.standing as never),
          ...around(rule.statement),
        ],
      });
  }

  for (const { charter } of corpus.charter)
    for (const s of charter.sections)
      out.push({
        ref: `${charter.id}#${s.id}`,
        kind: "section",
        title: `${s.title} — ${charter.title}`,
        says: s.says,
        fields: [
          ...own("what it says", s.says),
          ...own("what it is called", s.title),
          ...own("its own id", s.id),
          ...around(charter.title),
        ],
      });

  for (const { capability } of corpus.capabilities)
    for (const o of capability.offers)
      out.push({
        ref: `${capability.id}#offers#${o.id}`,
        kind: "capability",
        title: `${o.id} — ${capability.title}`,
        in: capability.title,
        says: o.does,
        fields: [
          ...own("what it says", o.does),
          ...own("its own id", o.id),
          ...around(`${capability.title} ${capability.id}`),
        ],
      });

  return out;
}

export interface FindOptions {
  /** How many hits to return. The rest are counted in `matched`. */
  limit?: number;
  /** Only these grains. */
  kinds?: FindKind[];
  /** Only inside this feature, following `in:` — so a ticket filed against one area stays there. */
  under?: string;
  /** ⛔ Raise it to cut the tail: a hit must reach at least this many of your words. */
  reaching?: number;
}

/** A window of text around the first match, so a snippet is the sentence rather than the paragraph. */
function snippetOf(text: string, stems: ReadonlySet<string>, width = 220): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= width) return flat;
  const tokens = flat.split(" ");
  let at = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const w = words(tokens[i]!)[0];
    if (w && stems.has(stem(w))) {
      at = i;
      break;
    }
  }
  let start = 0;
  let len = 0;
  for (let i = 0; i < at; i += 1) len += tokens[i]!.length + 1;
  start = Math.max(0, len - Math.floor(width / 3));
  const cut = flat.slice(start, start + width);
  return `${start > 0 ? "…" : ""}${cut}${start + width < flat.length ? "…" : ""}`;
}

/**
 * What a ticket is about, as refs this corpus answers to.
 *
 * ⛔ DETERMINISTIC END TO END. The same corpus and the same query produce the same list in the same
 * order on every machine, and every position in it is accounted for by `Finding.why` and
 * `Finding.reached`. Nothing here calls a model, and nothing here is tuned.
 */
export function find(corpus: Corpus, query: string, opts: FindOptions = {}): Found {
  const raw = words(query);
  const dropped = raw.filter((w) => STOPWORDS.has(w));
  const asked = raw.filter((w) => !STOPWORDS.has(w));
  /** ⛔ One entry per distinct stem, so typing a word twice does not double its weight. */
  const terms: Array<{ word: string; as: string }> = [];
  for (const w of asked) {
    const as = stem(w);
    if (!terms.some((t) => t.as === as)) terms.push({ word: w, as });
  }
  const stems = new Set(terms.map((t) => t.as));

  const units = unitsIn(corpus);
  /**
   * ⛔ THE SUBTREE, NOT THE ONE FEATURE. `under: "family-wallet"` on the seed means the whole
   * product, and `under: "money"` means money and anything filed inside it — the same `in:` walk
   * every other surface uses, so a ticket filed against an area does not have to name its children.
   * Anything filed under no feature at all is outside every subtree and is excluded.
   */
  const inScope = opts.under
    ? new Set(corpus.scopes.filter((s) => lineageOf(corpus, s.scope.id).includes(opts.under!)).map((s) => s.scope.id))
    : undefined;
  /**
   * ⛔ AND A RULE REACHES DOWNWARD, SO NARROWING TO A FEATURE MUST KEEP THE RULES ABOVE IT.
   *
   * A rule's `in:` is the vocabulary its selector is written in, and every rule in the seed is
   * filed on the root. Filtering rules the same way as everything else therefore answered
   * `under: "money"` with nothing org-wide at all — losing `only-a-parent-moves-money`, which
   * supplies `may` on four of that feature's exchanges in full. The narrowing option would have
   * quietly removed the half of the answer a per-feature tree already cannot show, which is the
   * finding this whole command exists for.
   */
  const above = opts.under ? new Set(lineageOf(corpus, opts.under)) : undefined;
  const searchable = units.filter((u) => {
    if (opts.kinds?.length && !opts.kinds.includes(u.kind)) return false;
    if (!inScope || !above) return true;
    if (!u.feature) return false;
    return inScope.has(u.feature) || ((u.kind === "rule" || u.kind === "rule-case") && above.has(u.feature));
  });

  const base: Found = {
    query,
    terms,
    dropped,
    hits: [],
    matched: 0,
    searched: searchable.length,
  };

  if (!terms.length)
    return {
      ...base,
      nothing: raw.length
        ? `every word of that is a common word the search drops — ${dropped.join(", ")}. Name something from the product: a word it uses, a screen, or what somebody is trying to do`
        : "there is nothing to search for — say what the ticket is about, in its own words",
    };

  const hits: Finding[] = [];
  for (const unit of searchable) {
    const why: Match[] = [];
    const reached = new Set<string>();
    const reachedOwn = new Set<string>();
    let score = 0;
    for (const f of unit.fields) {
      const present = new Set(words(f.text).map(stem));
      const matched = terms.filter((t) => present.has(t.as));
      if (!matched.length) continue;
      const weight = WEIGHTS[f.field];
      /** ⛔ Context is worth one whatever field it came from — it is somebody else's words. */
      const w = f.context ? WEIGHTS["around it"] : weight;
      why.push({ field: f.field, context: f.context, weight: w, matched: matched.map((m) => m.word), text: f.text.replace(/\s+/g, " ").trim() });
      score += w * matched.length;
      for (const m of matched) {
        reached.add(m.word);
        if (!f.context) reachedOwn.add(m.word);
      }
    }
    /** ⛔ `FLOOR`. */
    if (!reachedOwn.size) continue;
    if (opts.reaching && reached.size < opts.reaching) continue;

    /**
     * ⛔ WEIGHT FIRST HERE, UNLIKE THE RANKING, AND THE TWO ARE ANSWERING DIFFERENT QUESTIONS. The
     * order of the list is about which hit matters most, where coverage is the honest measure. A
     * snippet is about which of this one hit's sentences to show, and that is what `WEIGHTS` says:
     * the open question beats three restatements of it in the drafted answers below it, even though
     * those between them matched more words.
     */
    const best = why.filter((m) => !m.context).sort((a, b) => b.weight - a.weight || b.matched.length - a.matched.length)[0]!;
    /**
     * ⛔ NEVER QUOTE AN ID BACK AT A READER. The match may well be on a slug — `see-a-balance` is
     * how "Somebody looks at what a kid has" is addressed — and the slug belongs in `ref`, which is
     * for the agent, not in `snippet`, which is for a person. Same for any match so short it is a
     * label rather than a sentence.
     */
    const readable = (best.field === "its own id" || best.text.length < 60) && unit.says && unit.says !== best.text ? unit.says : best.text;
    hits.push({
      ref: unit.ref,
      kind: unit.kind,
      title: unit.title,
      ...(unit.in ? { in: unit.in } : {}),
      snippet: snippetOf(readable, stems),
      ...(unit.at ? { at: unit.at } : {}),
      why,
      reached: terms.filter((t) => reached.has(t.word)).map((t) => t.word),
      reached_own: terms.filter((t) => reachedOwn.has(t.word)).map((t) => t.word),
      score,
    });
  }

  /**
   * ⛔ Coverage, then how much of it was its own, then weight, then the ref — so the order is
   * reproducible and a reader can recompute any position in it by hand.
   */
  hits.sort(
    (a, b) =>
      b.reached.length - a.reached.length ||
      b.reached_own.length - a.reached_own.length ||
      b.score - a.score ||
      a.ref.localeCompare(b.ref) ||
      a.kind.localeCompare(b.kind)
  );

  const limit = opts.limit ?? 10;
  /**
   * ⛔ THE LEVELS ARE COMPUTED AFTER THE CUT, AND IT IS NOT MICRO-OPTIMISATION. `levelOf` re-resolves
   * every rule in the corpus on each call, so asking it about all four hundred matches to return
   * ten would make the cost of a search quadratic in the corpus and linear in how BADLY the query
   * matched — a vague ticket would be the slowest thing the server does. The level is not a sort
   * key, so nothing about the order depends on having it early.
   */
  const shown = hits.slice(0, limit).map((h) => {
    const l = levelOf(corpus, h.ref);
    return { ...h, ...("error" in l ? { no_level: l.error } : { level: l }) };
  });
  return {
    ...base,
    hits: shown,
    matched: hits.length,
    nothing: hits.length
      ? undefined
      : `nothing in this product says anything about ${terms.map((t) => t.word).join(", ")}. ⛔ This is an answer, not an empty result: the corpus has no address for this yet, so it is something to propose rather than something to look for again`,
  };
}

/** The scope a hit sits in, for a caller grouping a list by feature. */
export const featureOf = (hit: Finding): string => hit.ref.split("#")[0]!;
