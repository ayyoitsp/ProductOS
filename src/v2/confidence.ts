/**
 * How well-supported a statement is, and whether a human confirmed it. ⛔ TWO ZONES, NOT ONE AXIS.
 *
 * Peter: *"I think we might want self-learning/weighting for each piece of confirmable evidence —
 * like enough inference that a behavior is true should bump up the confidence if not expiclity
 * decided. so we have a rough scale - like 'human confirmed' on one end, and like '1 inference' on
 * the other end. multiple inteferences would move it towards human confirmed."* And later: *"still
 * too much review surface… when the feature is initially spec'd, or when UX is changed with
 * explicit instructions, and there is confirmation, it should feed into everything that hasn't been
 * confirmed (or confirmed) to make sure there are no discrepancies, and confidence is updated"* —
 * and *"the reason why it has confidence needs to be visible as well"*.
 *
 * ⛔ "MOVES TOWARD HUMAN CONFIRMED" IS A READING OF STRENGTH, NEVER AN IMPLEMENTATION.
 *
 * `confirmed` is a separate field of a different type, not the top value of `strength`. No amount of
 * support can produce it, because nothing here writes it — it comes from `stampFor`, which filters
 * `via: agent` out at the source so one field cannot make the first tenet void. A scale whose top is
 * reachable without a person is worse than no scale, because the whole value of the two states was
 * that nobody could mistake one for the other.
 *
 * ⛔ DERIVED, NEVER STORED, like `stageOf` and `reachOf`. A stored confidence is a number that was
 * true when it was written and is unfalsifiable afterwards.
 */
import type { Corpus } from "./load.js";
import type { Reading } from "./schema.js";
import { stampFor } from "./stamp.js";

/**
 * How strong the support is — ⛔ NAMED TIERS, NOT A NUMBER.
 *
 * A number invites arithmetic nobody can defend: averaging a code path against an interview produces
 * a figure that looks like information and is not. Peter asked for "a rough scale", and rough is the
 * accurate word — these distinguish the four cases somebody would actually act on differently.
 *
 * Every one of these is BELOW the line. `confirmed` is not here on purpose.
 *
 * ⛔ `one-source`, NOT `one-reading`, AND THE RENAME WAS A CORRECTION. A statement whose only
 * support is DERIVED from a confirmed happy path has no readings at all, and the page rendered it
 * as "one reading" — a tier name asserting a reading that does not exist. Found by rendering the
 * page and reading the words rather than by checking that a chip appeared. A source may be borrowed;
 * a reading is a thing somebody wrote down.
 */
export type Strength = "none" | "one-source" | "corroborated" | "strongly-supported";

/** One thing somebody can go and look at. */
export interface SupportUnit {
  reading: string;
  observes: string;
  kind: Reading["basis"]["kind"];
  /** ⛔ The pointer, and the load-bearing half — a support unit nobody can check is an assertion. */
  ref: string;
  at?: string;
}

/**
 * Support this statement did not earn directly, and where it came from.
 *
 * ⛔ `from` AND `because` ARE BOTH REQUIRED, BECAUSE PETER ASKED FOR THE REASON TO BE VISIBLE. An
 * inherited strength with no provenance is the laundering this whole file is arranged to prevent,
 * one render away: a reader sees a statement look stronger with nothing saying why, and the only
 * honest conclusion available to them is that somebody looked at it.
 */
export interface Inherited {
  /** The confirmed ref this came from. */
  from: string;
  how: "shared-support" | "derived";
  /** What links them — the shared basis pointer, or the path that derives it. */
  because: string;
}

export interface Confidence {
  ref: string;
  /**
   * ⛔ A SEPARATE FIELD OF A DIFFERENT TYPE. Not `strength: "confirmed"`. Nothing in this module can
   * set it; it is `stampFor`'s answer, and `stampFor` is the one place that refuses an agent.
   */
  confirmed: { by: string; at: string; through?: string } | null;
  /**
   * The product was seen doing this — ⛔ A THIRD ZONE, AND NOT A TIER OF `strength`.
   *
   * Peter: *"it doesn't give us CONFIRMED state. but it gives us a starting place for how an
   * existing product already behaves. it should also have a level of confirmation that is higher
   * than 'LLM generated'. like, we have human confirmed, we should have a level that is 'product
   * behavior' or something. humans can confirm it."*
   *
   * ⛔ WHY IT IS NOT `strength: "observed"`. `strength` answers HOW MUCH support there is; this
   * answers WHAT KIND. That is the same argument the top of this file makes for keeping `confirmed`
   * out of the scale — a different kind of claim cannot be a rung on a quantity ladder without
   * making the ladder mean two things. Three sources and a walk are independent facts, and a reader
   * deciding what to trust needs both.
   *
   * ⛔ AND IT IS THE ONE ZONE AN AGENT MAY WRITE, WHICH IS SAFE ONLY BECAUSE IT IS FALSIFIABLE. It
   * asserts "the product did this at this URL", which anybody can go and re-run. `confirmed`
   * asserts "a person agreed", which nothing can re-derive — so that one stays unreachable from
   * here, and a walk never sets it.
   *
   * ⛔ DERIVED FROM THE READINGS, NEVER STORED, like everything else here. A stored flag saying the
   * product behaves some way is a claim that was true when written and unfalsifiable after.
   */
  observed: { where: string; at?: string; by?: string } | null;
  /** Confirmed once, and the sentence has moved since. ⛔ Not confirmed, and not nothing either. */
  stale: null | "claim-changed" | "criteria-changed" | "both-changed";
  /** Readings bearing directly on this ref. */
  support: SupportUnit[];
  /**
   * Readings bearing on the exchange this slot belongs to.
   *
   * ⛔ KEPT SEPARATE FROM `support`, AND COUNTED ANYWAY. They are real evidence a reviewer can go
   * and look at, so they move the tier; they are not about this sentence specifically, so the page
   * has to be able to say which is which. Folding them together would make a slot with nothing
   * written about it indistinguishable from one that was examined.
   *
   * Without this, support has to be authored nine times per exchange — once per slot — which is the
   * single largest cost in making the scale usable on a real corpus.
   */
  contained: SupportUnit[];
  /**
   * ⛔ INDEPENDENT BASES, NOT READINGS. Two readings citing the same `basis.ref` are one source, and
   * the difference is the whole meaning of the word corroborated: four observations of one code path
   * is one thing known four ways of saying it.
   */
  sources: number;
  strength: Strength;
  inherited: Inherited[];
}

/**
 * The ref one level up. `money#see-a-balance#answer` → `money#see-a-balance`, and an exchange → null.
 *
 * ⛔ ONE LEVEL, AND NOT UP TO THE SCOPE. A reading about an exchange is about all nine of its slots:
 * "the history is read straight off the ledger rows" is evidence about what the answer is, what it
 * refuses, and what happens on a repeat. A reading about a SCOPE is not evidence about every
 * statement in it — treating it that way would make one observation support thirty claims, and the
 * scale would read strongest in exactly the corpora where least had been looked at.
 */
export function containerOf(ref: string): string | null {
  const parts = ref.split("#");
  return parts.length >= 3 ? parts.slice(0, -1).join("#") : null;
}

/** Readings bearing directly on a ref. */
export const supportFor = (corpus: Corpus, ref: string): SupportUnit[] =>
  corpus.readings
    .filter((r) => r.bears_on === ref)
    .map((r) => ({ reading: r.id, observes: r.observes, kind: r.basis.kind, ref: r.basis.ref, at: r.basis.at }));

/** ⛔ Counted by pointer, so the same source cited twice is not corroboration. */
export const sourcesOf = (support: SupportUnit[]): number => new Set(support.map((s) => s.ref)).size;

/**
 * ⛔ THE CAP IS THE POINT, AND IT IS STRUCTURAL.
 *
 * `strongly-supported` is the ceiling and it is below the line. Peter chose that shared support may
 * raise confidence; the condition he set is that the zones stay visibly distinct, and the way to
 * hold that is for the top of this function to be unreachable from `confirmed` in both directions.
 *
 * ⛔ AND A REF WITH NOTHING READ ABOUT IT DIRECTLY STOPS AT `corroborated`. Inheritance says other
 * statements rest on the same evidence; it never says anybody examined THIS one. Letting inherited
 * support alone reach the top tier would make the strongest reading in the corpus available to a
 * statement nobody has ever looked at, which is the failure in a different costume.
 */
export function strengthOf(ownSources: number, inherited: number): Strength {
  const total = ownSources + inherited;
  if (total === 0) return "none";
  if (ownSources === 0) return total >= 2 ? "corroborated" : "one-source";
  if (total === 1) return "one-source";
  if (total === 2) return "corroborated";
  return "strongly-supported";
}

/** Every ref a verdict has confirmed, with what confirmed it. */
function confirmedRefs(corpus: Corpus): Map<string, { by: string; at: string }> {
  const out = new Map<string, { by: string; at: string }>();
  for (const v of corpus.verdicts) {
    /**
     * ⛔ `target` IS OPTIONAL ON A VERDICT, and that is not an oversight to code around: a `read` of
     * a whole scope and a `waive` carry no single ref. Skipping them here is correct — a confirmation
     * of nothing in particular cannot be inherited FROM, because there is no shared basis to point at.
     */
    if (!v.target) continue;
    const stamp = stampFor(corpus, v.target);
    if (stamp.state === "accepted") out.set(v.target, { by: stamp.by, at: stamp.at });
  }
  return out;
}

/**
 * What this ref inherits from somebody else's confirmation.
 *
 * ⛔ TWO ROUTES, AND THEY ARE NOT EQUALLY SAFE.
 *
 * `derived` is the same claim restated: the views a confirmed happy path names ARE on that path,
 * because the path says so. Confirming it confirmed that, and calling it inference would be false
 * modesty.
 *
 * `shared-support` is the one Peter chose knowingly and the one that needs the reason visible. If a
 * confirmed statement and an unconfirmed one rest on the same code path, the unconfirmed one is
 * better supported than a guess — and nobody has read it. It may move within the lower zone and it
 * carries `from` so the page can say whose confirmation it borrowed.
 */
export function inheritedFor(corpus: Corpus, ref: string): Inherited[] {
  const confirmed = confirmedRefs(corpus);
  if (confirmed.has(ref)) return [];
  const out: Inherited[] = [];

  /** derived: a confirmed happy path names the views it passes through. */
  for (const { scope } of corpus.scopes) {
    const pathRef = `${scope.id}#happy-path`;
    if (!confirmed.has(pathRef)) continue;
    for (const view of scope.happy_path?.through ?? []) {
      /**
       * ⛔ SCOPE-QUALIFIED ONLY. `through` names a view id, and two scopes may each have a screen
       * called `balance` — so matching a bare `ref === view` let a confirmed path in one scope lend
       * its authority to a same-named screen in another. That is the laundering this file is
       * arranged to prevent, arriving through a name collision rather than through a decision.
       */
      if (ref === `${scope.id}#${view}`) {
        out.push({ from: pathRef, how: "derived", because: `on the happy path, through: ${view}` });
      }
    }
  }

  /** shared-support: this ref and a confirmed one rest on the same pointer. */
  const container = containerOf(ref);
  const mine = new Set(
    [...supportFor(corpus, ref), ...(container ? supportFor(corpus, container) : [])].map((s) => s.ref),
  );
  if (mine.size) {
    for (const [cref] of confirmed) {
      for (const s of supportFor(corpus, cref)) {
        if (mine.has(s.ref)) {
          out.push({ from: cref, how: "shared-support", because: s.ref });
        }
      }
    }
  }

  /** ⛔ One entry per (from, because). A basis cited twice is not two inheritances. */
  const seen = new Set<string>();
  return out.filter((i) => {
    const key = `${i.from}|${i.how}|${i.because}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The walk that saw this behaviour, if one did — the newest, since the product moves.
 *
 * ⛔ `walk` ONLY, AND NOT `inspection` OR `screen`. Those are a person looking and a drawing; this
 * zone exists to say an agent drove the product and recorded what happened, which is the one claim
 * about behaviour that can be re-run and disagreed with.
 *
 * ⛔ AND IT IS NARROWER THAN `level.ts`'s `observed` ROUTE, WHICH IS NOT AN OVERSIGHT BUT IS A
 * DIVERGENCE SOMEBODY HAS TO SETTLE — SO IT IS NAMED HERE RATHER THAN FOUND LATER.
 *
 * `level.SEEN_RUNNING` holds six kinds — `test-run`, `screen`, `inspection`, `telemetry`, `log` and
 * now `walk` — and its question is a GATE: may a consumer holding a ticket build from this? A
 * person who looked answers that, so `inspection` belongs there, and the test beside it says so.
 *
 * This field's question is different and the sentence it produces is why: *"a walk, so it is
 * re-runnable and anybody may disagree with it"*. Only an agent driving a named URL earns that
 * clause. A person's inspection is not re-runnable by the reader, and filing one here would print a
 * promise the evidence cannot keep.
 *
 * ⛔ They therefore share a word and not a definition, which is the shape a bug takes later. Nothing
 * renders both today — `level.ts` is wired to no surface yet — so the cheapest honest thing is to
 * say so here. Whoever wires it decides: either this widens to `SEEN_RUNNING` and the page sentence
 * stops promising re-runnability, or this keeps its meaning and gets a word of its own.
 */
export function observedFrom(support: SupportUnit[]): Confidence["observed"] {
  const walks = support.filter((s) => s.kind === "walk");
  if (!walks.length) return null;
  const newest = walks.reduce((a, b) => ((b.at ?? "") > (a.at ?? "") ? b : a));
  return { where: newest.ref, ...(newest.at ? { at: newest.at } : {}) };
}

/** Everything known about how well-founded one statement is. */
export function confidenceOf(corpus: Corpus, ref: string): Confidence {
  const stamp = stampFor(corpus, ref);
  const support = supportFor(corpus, ref);
  const container = containerOf(ref);
  const contained = container ? supportFor(corpus, container) : [];
  const inherited = inheritedFor(corpus, ref);
  /** ⛔ Counted across both, still by pointer — the same code path cited at two grains is one source. */
  const sources = sourcesOf([...support, ...contained]);
  return {
    ref,
    confirmed:
      stamp.state === "accepted"
        ? { by: stamp.by, at: stamp.at, ...(stamp.through ? { through: stamp.through } : {}) }
        : null,
    stale: stamp.state === "never" || stamp.state === "accepted" ? null : stamp.state,
    /**
     * ⛔ FROM A WALK OF THIS STATEMENT, NOT OF ITS EXCHANGE. `contained` support is deliberately
     * counted toward `strength`, because a reading about an exchange genuinely bears on every slot
     * in it. "The product was seen doing THIS" does not inherit that way: a walk that observed what
     * the deals list answers has not observed what it refuses, and letting it say so would put a
     * behaviour claim on seven slots nobody drove.
     */
    observed: observedFrom(support),
    support,
    contained,
    sources,
    strength: strengthOf(sources, inherited.length),
    inherited,
  };
}

/**
 * Why it has the confidence it has, in sentences a person can read. ⛔ THIS IS A REQUIREMENT, NOT A
 * CONVENIENCE: Peter, on being told a confirmation may raise another statement's strength — *"yes,
 * the reason why it has confidence needs to be visible as well"*.
 *
 * Returned as lines rather than rendered, so the page and the CLI say the same thing. A second
 * phrasing of this on a surface would be a second answer to the question the model is supposed to
 * settle.
 */
export function whyConfident(corpus: Corpus, ref: string): string[] {
  const c = confidenceOf(corpus, ref);
  const lines: string[] = [];

  if (c.confirmed) {
    /**
     * ⛔ SAID AS BEING THROUGH THE RULE, NOT AS A DIRECT ACCEPTANCE. Nobody stamped this slot; they
     * stamped the rule whose sentence fills it. A page showing a plain "confirmed" here would be
     * claiming a judgement about this exchange that nobody made — the words are agreed, the choice
     * to let that rule govern HERE is the selector's, and a reader is entitled to know which.
     */
    lines.push(
      c.confirmed.through
        ? `${c.confirmed.by} confirmed the rule ${c.confirmed.through} on ${c.confirmed.at}, and it supplies every word of this.`
        : `${c.confirmed.by} confirmed this on ${c.confirmed.at}.`,
    );
    /**
     * ⛔ SAID ON THE CONFIRMED STATEMENT ITSELF, because that is the row a reader would otherwise
     * skip. A green stamp over a statement that something was observed about afterwards is the one
     * place in a corpus where the surface is most confident and the truth is least settled.
     */
    const d = discrepancyFor(corpus, ref);
    if (d)
      lines.push(
        `⛔ ${d.since.length} observation${d.since.length === 1 ? "" : "s"} recorded since — ` +
          `${d.since.map((s) => `${s.kind} at ${s.ref}`).join(", ")} — and nobody has looked again.`,
      );
  }
  else if (c.stale)
    lines.push(
      `Confirmed once, and the ${c.stale === "both-changed" ? "sentence and its criteria have" : c.stale === "claim-changed" ? "sentence has" : "criteria have"} changed since — so it is not confirmed now.`,
    );
  else lines.push("Nobody has confirmed this.");

  /**
   * ⛔ SAID IMMEDIATELY AFTER THE CONFIRMATION LINE, AND IN THE SAME BREATH AS WHAT IT IS NOT.
   *
   * "The product was seen doing this" is the sentence most able to be mistaken for "this is right",
   * and the two are independent: a walk of a product with a bug records the bug faithfully. So the
   * line states what was seen, where, and that nobody has agreed it is what the product SHOULD do —
   * which is the distinction the corpus exists to hold.
   */
  if (c.observed)
    lines.push(
      `The product was seen doing this at ${c.observed.where}${c.observed.at ? ` on ${c.observed.at}` : ""} — ` +
        `a walk, so it is re-runnable and anybody may disagree with it. ` +
        `⛔ It says how the product behaves today, not that this is what it should do; only a person can say that.`,
    );

  for (const s of c.support) lines.push(`Read from ${s.kind} at ${s.ref}: ${s.observes}`);
  if (!c.support.length) lines.push("Nothing has been observed about it directly.");
  /** ⛔ Said as being about the exchange, or it reads as having been written about this sentence. */
  for (const s of c.contained)
    lines.push(`About the whole exchange, from ${s.kind} at ${s.ref}: ${s.observes}`);

  /**
   * ⛔ Named, every time, or the strength is a number with no argument behind it.
   *
   * ⛔ AND THE WARNING IS CONDITIONAL, which the first cut got wrong on the page. It appended
   * "Nobody has read this statement itself" to every shared-support line — including on a statement
   * with two readings of its own, where it is simply false. Caught by rendering it and reading the
   * sentence rather than by checking that a sentence appeared.
   *
   * The warning is the whole point when it IS true: borrowed strength on something nobody examined
   * is the case Peter accepted knowingly, and it must say so. Crying it on a well-read statement is
   * how a reader learns to skip the line.
   */
  for (const i of c.inherited) {
    lines.push(
      i.how === "derived"
        ? `Follows from ${i.from}, which is confirmed — ${i.because}.`
        : `Rests on the same evidence as ${i.from}, which is confirmed: ${i.because}.`,
    );
  }
  /**
   * ⛔ ONCE, AT THE END, AND ONLY WHEN IT IS TRUE — AND THE FIRST CUT HAD IT ON THE WRONG BRANCH.
   *
   * It appended "Nobody has read this statement itself" to every shared-support line, which is
   * false on a statement with readings of its own. Caught by rendering the page and READING the
   * sentence, rather than by asserting that a sentence appeared.
   *
   * ⛔ And moving it revealed the branch was unreachable where it had been written. Shared support
   * requires a pointer in common, so a ref with no readings cannot inherit that way at all — the
   * only inheritance available to an unread statement is `derived`. The warning therefore belongs
   * to the condition, not to the route: borrowed strength on something nobody examined is the case
   * Peter accepted knowingly, and it has to say so however it was borrowed.
   */
  if (c.inherited.length && c.support.length === 0 && c.contained.length === 0)
    lines.push("⛔ Nobody has read this statement itself — all of its support is borrowed.");

  if (c.strength === "strongly-supported" || c.strength === "corroborated")
    lines.push(`${c.sources} independent source${c.sources === 1 ? "" : "s"}, so: ${c.strength}. ⛔ Still not confirmed.`);

  return lines;
}

/**
 * Evidence that arrived after somebody agreed, and which nobody has looked at since.
 *
 * ⛔ THE HALF PETER ASKED FOR THAT CONFIRMATION ALONE DOES NOT GIVE: *"it should feed into
 * everything that hasn't been confirmed (or confirmed) to make sure there are no discrepancies"*.
 * A confirmation is a judgement about a statement AT A MOMENT. Evidence recorded after it is the
 * one thing that can make that judgement wrong without anybody touching the sentence — and today
 * the stamp stays green, because `stampFor` only notices the claim and its criteria moving.
 *
 * ⛔ BY DATE, NOT BY PROSE. This project has already paid for word-counting: the over-assertion gate
 * showed what matching sentences costs, and `check` says so where it refuses to do it. A reading
 * dated after a verdict is an exact, checkable fact. Whether it actually contradicts the statement
 * is a question for a person — which is the point: this produces a QUESTION, never a verdict about
 * the corpus.
 *
 * ⛔ AND IT IS NOT A FINDING ABOUT THE CORPUS. An author cannot fix it by editing anything. The only
 * thing that resolves it is somebody looking again, so it belongs in the queue beside an open slot
 * rather than in a list of defects.
 */
export interface Discrepancy {
  ref: string;
  /** Who agreed, and when. */
  confirmed: { by: string; at: string };
  /** The readings that landed afterwards. */
  since: SupportUnit[];
}

/** Dates as the corpus writes them: `2026-10-05`. ⛔ Compared as strings, which is why that shape matters. */
const after = (a?: string, b?: string): boolean => !!a && !!b && a > b;

/** One ref: is there evidence newer than the agreement? */
export function discrepancyFor(corpus: Corpus, ref: string): Discrepancy | null {
  const stamp = stampFor(corpus, ref);
  if (stamp.state !== "accepted") return null;
  /**
   * ⛔ Both grains, because containment means a reading about the exchange is evidence about this
   * statement — and the same reading arriving late is the same problem at either grain.
   */
  const container = containerOf(ref);
  const all = [...supportFor(corpus, ref), ...(container ? supportFor(corpus, container) : [])];
  const since = all.filter((s) => after(s.at, stamp.at));
  return since.length ? { ref, confirmed: { by: stamp.by, at: stamp.at }, since } : null;
}

/** Every confirmed statement with evidence newer than the agreement. */
export function discrepanciesIn(corpus: Corpus): Discrepancy[] {
  const out: Discrepancy[] = [];
  for (const [ref] of confirmedRefs(corpus)) {
    const d = discrepancyFor(corpus, ref);
    if (d) out.push(d);
  }
  return out;
}

/** ⛔ Readings with no date cannot be compared, and silently counting them as old would be the bug. */
export const undatedSupport = (corpus: Corpus, ref: string): SupportUnit[] =>
  supportFor(corpus, ref).filter((s) => !s.at);
