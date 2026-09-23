/**
 * What an acceptance covered, and how it breaks.
 *
 * ⛔ THIS IS THE FILE WITHOUT WHICH TENET 1 IS DECORATION, AND IT WAS MISSING.
 *
 * `Verdict.covers_slots` and `Verdict.covers_criteria` existed as fields and were read by
 * nothing. Every consumer reduced acceptance to a set of target NAMES. So three
 * independent reviewers did the same thing: accept `money#record-earning`, then reverse
 * the accepted sentence — *"the amount is added to what the kid has"* became *"taken off,
 * rounded down"*, *"deducted from the family account"*, *"minus a handling deduction,
 * hidden from the kid"* — and the packet still read **accepted**, with `check` silent.
 *
 * One of them found the worse version: reword an accepted org-wide RULE, and both
 * exchanges that inherited it stay stamped while now promising the opposite failure
 * semantics. One file nobody accepted against changed the behaviour of six exchanges.
 *
 * So the hash covers three things, and the third is the one that is easy to forget:
 *
 *   1. the slot text the exchange states itself
 *   2. the criteria set — separately, so adding a criterion breaks only the criteria half
 *   3. **the id AND STATEMENT of every rule resolved into it** — because an exchange's
 *      behaviour is not only what it says, and a reviewer who accepted it accepted the
 *      resolved behaviour they were shown
 *
 * Two hashes rather than one, because the two things go stale for different reasons and
 * conflating them makes a new criterion look like a reversed claim.
 */
import { createHash } from "node:crypto";
import { SLOTS, type Verdict , type SlotName, saysText, statements} from "./schema.js";
import { resolveRules, vocabularyReach, type Corpus } from "./load.js";

const h = (s: string) => "sha256:" + createHash("sha256").update(s).digest("hex").slice(0, 16);

/** Whitespace-insensitive, because a reflow is not a change of meaning. */
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Every value in a parsed object, in key order, as one string.
 *
 * ⛔ Key order is sorted rather than declaration order, so reordering YAML does not read as
 * a change of meaning — and every leaf goes through `norm`, so neither does a reflow.
 */
export function canon(v: unknown): string {
  if (v === null || v === undefined) return "~";
  if (typeof v === "string") return norm(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  return `{${Object.keys(v as object)
    .sort()
    .map((k) => `${k}:${canon((v as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

export interface Covered {
  slots: string;
  criteria: string;
  /** What went into the slot hash, as labels. */
  parts: string[];
  /** ⛔ The actual sentences, for the moment of consent. `parts` described the SHAPE of each
   *  slot — "stated here" — which is not what a person is agreeing to. */
  reads: string[];
  /** ⛔ How many criteria the stamp covers. The preview said "and its criteria as they stand
   *  now" while showing none, on an exchange that had none. */
  criteriaCount: number;
}

/** For an exchange ref `<scope>#<exchange>`, or a rule id. */
export function coveredBy(corpus: Corpus, target: string): Covered | null {
  const { inherited, constrained } = resolveRules(corpus);

  const rule = corpus.rules.find((r) => r.rule.id === target);
  if (rule) {
    // A rule's own statement and criteria. ⛔ Its statement is hashed here AND into every
    // exchange it reaches, so rewording it breaks the rule's stamp and every downstream one.
    return {
      // Same reasoning as the slot half: everything the rule carries except its criteria,
      // which are hashed separately so adding one does not read as a reworded statement.
      slots: h(canon({ ...rule.rule, criteria: undefined })),
      criteria: h(canon(rule.rule.criteria)),
      parts: [`statement`, `mode: ${rule.rule.mode}`, `fills: ${rule.rule.fills}`, `${rule.rule.criteria.length} criteria`],
      criteriaCount: rule.rule.criteria.length,
      reads: [
        `${rule.rule.statement ? norm(rule.rule.statement) : "⛔ this rule says nothing yet"}`,
        `  ${rule.rule.mode === "supplies" ? "supplies" : "constrains"} ${rule.rule.fills.join(" and ")} wherever its selector reaches`,
        // ⛔ The named cases. A human stamped "the shared refusal vocabulary" without being
        // shown a single word of the vocabulary — `stamp.ts` hashed them and `packet.ts`
        // printed them, and the one surface at the moment of consent did not.
        ...(rule.rule.outcomes ?? []).map(
          (o) => `  refuses ${o.name} when ${norm(o.when)} → ${norm(o.told)}`
        ),
        ...rule.rule.criteria.map((c) => `  shown by: ${norm([c.given, c.when, c.then, c.steps].filter(Boolean).join(", "))}`),
      ],
    };
  }

  /**
   * ⛔ A STAMP MAY COVER ONE BEHAVIOUR, and until now the smallest thing it could cover was a
   * whole exchange with all eight of its slots settled.
   *
   * That is the wrong grain for a reviewer and it made review impossible on a real corpus: 47
   * exchanges, 329 blanks, so nothing was ever acceptable and there was nothing a person could
   * agree to. But the sentences were there — `GLOSSARY.md` calls one falsifiable claim "the atom",
   * and that is what somebody reads and has an opinion about.
   *
   * Everything the exchange-grained stamp covers still applies: the envelope decides which rules
   * reach the slot, the terms are the words the sentence is written in, and the screen is what the
   * reviewer was looking at. What narrows is the CONTENT — this slot's fill, and only the criteria
   * filed against it.
   */
  const [scopeId, exId, slotName] = target.split("#");
  const scope = corpus.scopes.find((s) => s.scope.id === scopeId)?.scope;
  const ex = scope?.exchanges.find((e) => e.id === exId);
  if (!scope || !ex) return null;
  const only: SlotName | undefined =
    slotName && (SLOTS as readonly string[]).includes(slotName) ? (slotName as SlotName) : undefined;
  if (slotName && !only) return null;
  /**
   * ⛔ ONE STATEMENT, when the ref names one.
   *
   * A slot may say thirteen things. Hashing all thirteen for a stamp on one of them means agreeing
   * to the twelfth stales the stamp on the first, and a reviewer re-reads a sentence nobody touched.
   * The statement's own text is what it covers; the envelope, the terms and the screen still count,
   * because they are what the sentence MEANS.
   */
  const saidId = target.split("#")[3];

  const parts: string[] = [];
  const reads: string[] = [];
  /**
   * ⛔ THE ENVELOPE, NOT ONLY THE SLOTS.
   *
   * The hash covered slot content and nothing else. So after accepting `see-a-balance` a
   * reviewer rewrote its title to *"Anyone at all, including a kid, looks at what any kid
   * has"* and repointed `at` at a different control — `check` reported nothing, `acts` showed
   * no staleness, and the packet read **accepted by alice**. The tool produced a record of
   * consent nobody gave.
   *
   * `asked_by`, `reads` and `changes` are in here for a sharper reason: they decide which
   * org-wide rules reach this exchange. Changing one silently swaps the inherited half of
   * everything the reviewer read.
   */
  /**
   * ⛔ THE WORDS AND THE SCREEN, BECAUSE THE PACKET PRESENTS BOTH AS TRUTH.
   *
   * The hash covered slot text and the exchange envelope. So after accepting `see-a-balance`
   * — whose accepted refusal tells a non-parent *"nothing about this kid, not even that they
   * exist"* — a reviewer rewrote the term `parent` to *"anybody signed in on the shared
   * device, including a kid"* and edited the sketch to show another kid's balance. Zero
   * refusals, nothing stale, and the packet printed both edits above `accepted by alice`.
   *
   * A sentence means what its words mean. Redefining a term the sentence is written in
   * changes the behaviour exactly as rewriting the sentence would, and the screen is what the
   * reviewer was looking at when they agreed.
   */
  const scopeOf = corpus.scopes.find((s) => s.scope.id === scopeId)!.scope;
  const view = ex.at ? scopeOf.views.find((v) => v.id === ex.at!.view) : undefined;
  reads.push(`"${ex.title}", asked by a ${ex.asked_by}${ex.at ? ` at ${ex.at.view}${ex.at.part ? ` · ${ex.at.part}` : ""}` : ex.when ? ` when ${ex.when.triggered_by} (${ex.when.cadence})` : ""}`);
  reads.push("");
  const slotBits: string[] = [
    canon({
      // ⛔ The prose body too. It is printed inside the packet's truth region, three lines
      // under "Everything below is what the product must do" — so after accepting an
      // exchange, five invented behaviours prepended to the scope body (a daily cap, a kid
      // seeing every sibling's balance, an email receipt, rounding, a 24-hour cancel) shipped
      // above `accepted by peter`, one of them contradicting the accepted `refuses`.
      body: corpus.scopes.find((s) => s.scope.id === scopeId)?.body,
      /**
       * ⛔ ONLY THE WORDS THESE SENTENCES USE, not the whole inherited glossary.
       *
       * Hashing every reachable term meant adding one unrelated word — `chore: A task a
       * parent offers that repeats every week` — staled all three acceptances at once, each
       * telling its reviewer *"either a sentence here changed, or an org-wide rule reaching it
       * arrived, left or was reworded."* Neither had. Alice re-reads, finds nothing different,
       * and the only move left is to re-stamp blind — which is how a stamp stops meaning
       * anything.
       *
       * A sentence means what its words mean, so the words IT USES are covered. A word it
       * does not use is not part of the behaviour.
       */
      terms: Object.fromEntries(
        (() => {
          const said = [
            ex.title,
            ...SLOTS.flatMap((s) => {
              const f = ex.slots[s];
              return [f?.says, f?.within, f?.cannot_fail, ...(f?.outcomes ?? []).flatMap((o) => [o.when, o.told])];
            }),
            ...ex.criteria.flatMap((c) => [c.given, c.when, c.then, c.steps]),
            ...ex.reads,
            ...ex.changes,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return vocabularyReach(corpus, scopeId!)
            .flatMap((id) => Object.entries(corpus.scopes.find((s) => s.scope.id === id)?.scope.terms ?? {}))
            .filter(([word]) => said.includes(word.toLowerCase()))
            .sort(([a], [b]) => a.localeCompare(b));
        })()
      ),
      view: view ? { sketch: view.sketch, parts: view.parts, exists: view.exists, walked: view.walked } : undefined,
    }),
    canon({
      title: ex.title,
      asked_by: ex.asked_by,
      at: ex.at,
      when: ex.when,
      // ⛔ And what follows this ask, so a sentence appearing after acceptance breaks the stamp
      // on the exchange that sets it off — the two have to be read together or not at all.
      setsOff: corpus.scopes
        .flatMap((s) => s.scope.exchanges.filter((x) => x.when?.follows?.startsWith(target)).map((x) => `${s.scope.id}#${x.id}:${norm(saysText(x.slots.answer?.says))}`))
        .sort(),
      exists: ex.exists,
      reads: [...ex.reads].sort(),
      changes: [...ex.changes].sort(),
      excepts: ex.excepts,
    }),
  ];
  for (const slot of (only ? [only] : SLOTS) as readonly SlotName[]) {
    const fill = ex.slots[slot];
    const inh = inherited.get(`${target}#${slot}`);
    const cons = constrained.get(`${target}#${slot}`) ?? [];
    const bits: string[] = [slot];
    if (fill) {
      /**
       * ⛔ THE WHOLE PARSED SLOT, CANONICALLY — never a hand-written list of fields.
       *
       * The list used to name `says`, `within`, `cannot_fail`, `none`, `outcomes` and the
       * standing kind, and it omitted `notes` and `instead_of`. Both of those are PRINTED
       * BY THE PACKET as truth a builder works from. So after accepting an exchange it was
       * possible to rewrite its `notes` into four new behaviours — a 24-hour hold, a parent
       * undo, a de-duplication rule contradicting the accepted sentence directly above it,
       * an email receipt — and get zero findings, nothing under "Accepted, and changed
       * since", and all four printed under a human's stamp. Rewriting an `instead_of`
       * reason from "that rule is about writes; nothing is written here" to "concurrency is
       * out of scope for the first release" behaved the same way.
       *
       * A hand-maintained list of what a stamp covers goes stale the first time a field is
       * added and nobody notices — which is exactly what happened when `instead_of` and
       * `candidates` were introduced. `canon` walks whatever the schema parsed, so a new
       * field is covered the moment it exists, and `test/v2-stamp.test.mjs` asserts every
       * key of `SlotFill.shape` changes the hash.
       */
      bits.push(
        canon(
          saidId
            ? { ...fill, says: statements(fill.says).filter((x) => x.id === saidId) }
            : fill
        )
      );
      /**
       * ⛔ NOT ALWAYS "stated here". This line is what a reviewer is shown at the moment
       * of consent, and it read `at_once: stated here` for a slot holding an unanswered
       * question — actively misinforming the person being asked to agree to it.
       */
      const k = fill.standing.kind;
      reads.push(
        `${slot} — ${
          fill.says
            ? norm(saysText(fill.says))
            : fill.none
              ? "nothing to refuse. Stated, not omitted."
              : fill.cannot_fail
                ? `cannot fail: ${norm(fill.cannot_fail)}`
                : k === "out_of_scope"
                  ? `deliberately not answered here: ${norm(fill.standing.because ?? "")}`
                  : (fill.outcomes ?? []).length
                    ? "the named cases below, and nothing else:"
                    : "⛔ NOT SETTLED"
        }`
      );
      for (const o of fill.outcomes ?? [])
        reads.push(`    refuses ${o.name} when ${norm(o.when)} → ${norm(o.told)}`);
      if (fill.within) reads.push(`    within: ${norm(fill.within)}`);
      for (const x of fill.instead_of ?? [])
        reads.push(`    ⊗ ${x.rule} does NOT hold here — ${norm(x.because)}`);
      for (const x of fill.defers_to ?? [])
        reads.push(`    ≥ ${x.rule} still holds here — ${norm(x.because)}`);
      parts.push(
        `${slot}: ${
          k === "stated"
            ? fill.none
              ? "nothing to refuse, stated"
              : fill.cannot_fail
                ? "cannot fail, stated"
                : "stated here"
            : k === "out_of_scope"
              ? "deliberately not answered here"
              : `⛔ ${k.toUpperCase()} — NOT SETTLED`
        }`
      );
    }
    if (inh) {
      // id AND statement — an accept that recorded only the id would survive the rule
      // being rewritten underneath it, which is the worst of the four stale-stamp paths.
      // ⛔ Its OUTCOMES too, not only its statement. An inherited refusal was rewritten into
      // silent data loss plus a weekly cap contradicting the same exchange's accepted `again`
      // slot, under `accepted by alice`, with zero refusals and nothing reported as stale.
      bits.push(`from:${inh.id}`, norm(inh.statement ?? ""), canon(inh.outcomes ?? []));
      reads.push(`${slot} — ${norm(inh.statement ?? "")}  (from ${inh.id})`);
      parts.push(`${slot}: from ${inh.id}`);
    }
    for (const r of cons) {
      bits.push(`also:${r.id}`, norm(r.statement ?? ""), canon(r.outcomes ?? []));
      reads.push(`    and also — ${norm(r.statement ?? "")}  (${r.id})`);
      parts.push(`${slot}: also ${r.id}`);
    }
    // ⛔ Hashed on every slot (an exception changes what the whole exchange behaviours) but
    // READ only on the slot its rule fills — printing it under all seven made one exception
    // look like seven, and buried the sentences a reviewer is actually agreeing to.
    for (const x of ex.excepts) {
      bits.push(`not:${x.rule}`, norm(x.because));
      const r = corpus.rules.find((y) => y.rule.id === x.rule);
      if (r?.rule.fills.includes(slot)) reads.push(`    ⊗ ${x.rule} does not apply here — ${norm(x.because)}`);
    }
    slotBits.push(bits.join("|"));
  }
  /** The criteria this stamp covers — all of them, or just this slot's. */
  const shown = only ? ex.criteria.filter((c) => c.slot === only) : ex.criteria;
  return {
    slots: h(slotBits.join("\n")),
    // ⛔ Only the criteria filed against this slot, or adding one to a sibling would stale a stamp
    // on a sentence nobody touched — the failure `coveredBy` already fixed once for the glossary.
    criteria: h(canon(only ? ex.criteria.filter((c) => c.slot === only) : ex.criteria)),
    parts,
    /**
     * ⛔ THE CRITERIA, NOT A COUNT OF THEM.
     *
     * The preview said *"and its 5 criteria as they stand now"* and showed none — while the
     * stamp covered every word of them. A criterion is what an engineer implements, so a
     * reviewer consenting to five of them unseen is consenting to the list a builder works
     * from. Counting is not showing.
     */
    reads: [
      ...reads,
      ...(shown.length
        ? [
            "",
            "what must be demonstrated:",
            // ⛔ `shown`, not `ex.criteria` — the count was narrowed to the slot and the LIST was
            // not, so accepting one behaviour printed a sibling slot's criterion as the thing being
            // agreed to. A preview that shows the wrong evidence is worse than one that shows none.
            ...shown.map(
              (c) =>
                `  ${c.slot}${c.example ? " (an example)" : ""} — ${norm(
                  [c.given && `given ${c.given}`, c.when && `when ${c.when}`, c.then && `then ${c.then}`]
                    .filter(Boolean)
                    .join(", ") || (c.steps ?? "")
                )}`
            ),
          ]
        : ["", "nothing here says what would show any of it"]),
    ],
    criteriaCount: ex.criteria.length,
  };
}

export type StampState =
  | { state: "accepted"; by: string; at: string }
  | { state: "claim-changed"; by: string; at: string }
  | { state: "criteria-changed"; by: string; at: string }
  | { state: "both-changed"; by: string; at: string }
  | { state: "never" };

/**
 * ⛔ The one question every surface must ask the same way.
 *
 * `grid`, `packet` and `acts` each built their own `accepted` set from target names. Three
 * implementations of one question is three chances to disagree, and the packet's disagreed
 * with reality by printing "accepted separately" for rules with no verdict at all.
 */
export function stampFor(corpus: Corpus, target: string): StampState {
  const accepts = corpus.verdicts.filter((v) => v.kind === "accept" && v.target === target);
  if (!accepts.length) return { state: "never" };
  const latest = accepts[accepts.length - 1]!;
  const now = coveredBy(corpus, target);
  if (!now) return { state: "never" };
  const slotStale = latest.covers_slots !== now.slots;
  const critStale = latest.covers_criteria !== now.criteria;
  const meta = { by: latest.by, at: latest.at };
  if (slotStale && critStale) return { state: "both-changed", ...meta };
  if (slotStale) return { state: "claim-changed", ...meta };
  if (critStale) return { state: "criteria-changed", ...meta };
  return { state: "accepted", ...meta };
}

export function staleReason(s: StampState): string | null {
  switch (s.state) {
    case "claim-changed":
      /**
       * ⛔ Deliberately does not say "a sentence that is no longer here", which was false for
       * a whole class of these.
       *
       * The hash covers the statement of every rule resolved in, so a rule ARRIVING or
       * LEAVING breaks the stamp with no sentence changed anywhere — and re-filing a scope
       * does exactly that. The old wording sent a reviewer to hunt for an edited sentence
       * among seven identical ones, find nothing, and re-accept, which launders the change
       * they were being warned about.
       */
      return `${s.by} accepted this on ${s.at}, and what it states is not what they read — either a sentence here changed, or an org-wide rule reaching it arrived, left or was reworded`;
    case "criteria-changed":
      return `${s.by} accepted this on ${s.at}, and its criteria have changed since — at least one was added or edited after the acceptance and nobody has read it`;
    case "both-changed":
      return `${s.by} accepted this on ${s.at}, and both what it states and what demonstrates it have changed since`;
    default:
      return null;
  }
}

/*
 * ⛔ `acceptVerdict` LIVED HERE, EXPORTED, AND NOTHING EVER CALLED IT.
 *
 * It built an accept Verdict and was dead from the day the CLI wrote its own YAML. Adding
 * `via` to it would have been maintaining a second, unreachable way to construct the strongest
 * record in the model — the exact shape of defect this codebase keeps finding. Acts are
 * performed in one place: `acts.ts`.
 */
