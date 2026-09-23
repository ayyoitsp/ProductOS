/**
 * Answering a question — the act that was missing.
 *
 * ⛔ THE MECHANISM EXISTED AND THE MOTION DID NOT, WHICH IS TENET 1'S OLDEST FAILURE HERE.
 *
 * Every piece was in place: a slot could stand `open`, `check` could find it, `acts` could
 * route it to an owner, and `Verdict kind: rule` could record a decision. What no surface
 * could do was let a person *answer one*. The ruling was recorded beside the truth and
 * never written into it, so the corpus went on asking a question its own verdict log said
 * had been settled — by the person being asked.
 *
 * Two things fix that, and only together:
 *
 *  1. **A ruling writes the slot.** The human supplies the choice; the tool applies it.
 *     Leaving the two apart created a limbo that made the honest act feel like it had no
 *     effect, and a mechanism with no visible effect stops being used.
 *  2. **It is per-scope, not a global queue.** A person reading one feature wants to
 *     settle that feature's questions while they hold its context. Sending them to a
 *     corpus-wide list means answering happens when somebody sets aside an afternoon for
 *     it, which is never.
 *
 * ⛔ On the obvious objection — is this a tool that writes product truth? The sentence
 * comes from a person, or from a drafted candidate a person picked. What is refused is a
 * model deciding, and that is held by the boundary on the verdict commands: the CLI is the
 * human's surface, and MCP exposes none of this.
 */
import fs from "node:fs";
import { parseFrontmatter } from "../core/frontmatter.js";
import YAML from "yaml";
import { Scope, Rule, type SlotName } from "./schema.js";
import { loadCorpus, resolveRules, selectsFor, lineageOf, type Corpus } from "./load.js";
import { resolveRef } from "./ref.js";
import { removals, refuseBecause } from "./write.js";

export interface Question {
  ref: string;
  scope: string;
  exchange: string;
  exchangeTitle: string;
  slot: SlotName;
  kind: string;
  /** The question, in whatever form the standing carries it. */
  asks: string;
  /** What it costs to guess wrong, where the standing says. */
  cost?: string;
  owed?: string;
  /**
   * Drafted ANSWERS. ⛔ `says` is optional because `refuses` cannot take a sentence — an option
   * there carries named cases or `none`, which is why that slot was unsettleable by any command.
   */
  candidates: Array<{
    says?: string;
    consequence: string;
    replaces?: string;
    outcomes?: Array<{ name: string; when: string; told: string }>;
    none?: boolean;
  }>;
  /** Other slots recorded as waiting on this one. */
  blocks: string[];
  /** Parked by a person, and what brings it back. */
  parked?: { by: string; because: string; until: string };
  /**
   * ⛔ The sentence already agreed here, when only one thing ABOUT it is unruled.
   *
   * Without this, `decide` printed `--pick N` for such a slot and `rule` refused it — the tool
   * refusing the command it had just recommended, on the corpus's first question. A candidate
   * on a residual answers the residual, not the slot, so the act is a revision the person
   * authors and they need to see what they are revising.
   */
  revises?: string;
  /** What is unruled about the agreed sentence. */
  about?: string;
  /** Observations recorded against this exact question. */
  observed: Array<{ says: string; basis: string; at?: string }>;
  /** For a disputed standing — the slots or rules it cannot hold with. */
  conflictsWith: string[];
  /** ⛔ An org-wide ruling owes its demonstration in the same act, or it is an aspiration. */
  needsThen?: boolean;
  /** ⛔ A case asking `whether` needs a yes/no, because the answer decides whether it survives. */
  asksPolarity?: boolean;
  /** ⛔ Every option is a complete replacement sentence, so picking one is safe in one act. */
  candidatesAreWhole?: boolean;
}

/**
 * This scope and everything filed beneath it.
 *
 * ⛔ THE `in:` TREE WAS DECLARED AND UNIMPLEMENTED, AND IT REPORTED SUCCESS.
 *
 * `decide family-wallet` answered "✓ nothing undecided" over a corpus holding three unruled
 * slots, because the root scope has no exchanges of its own. `read family-wallet --buildable
 * yes` recorded a human saying they could build from it, on the same basis. A container that
 * answers for itself alone answers for nothing, since containers are exactly the scopes with
 * no exchanges.
 *
 * Containers nest without limit by design, so every per-scope surface has to mean
 * "this and everything under it".
 */
export function descendants(corpus: Corpus, scopeId: string): string[] {
  const out = [scopeId];
  for (let i = 0; i < out.length; i++)
    for (const { scope } of corpus.scopes)
      if (scope.in === out[i] && !out.includes(scope.id)) out.push(scope.id);
  return out;
}

const norm = (s?: string) => (s ?? "").replace(/\s+/g, " ").trim();

/** Every unsettled slot in one scope and everything beneath it, in reading order. */
export function questionsFor(corpus: Corpus, scopeId: string): Question[] {
  const under = descendants(corpus, scopeId);
  const fromSlots = under.length > 1 ? under.flatMap((id) => questionsIn(corpus, id)) : questionsIn(corpus, scopeId);
  /**
   * ⛔ AN OPEN RULE IS A QUESTION ABOUT THIS SCOPE IF IT REACHES IT, and this walked exchanges
   * only.
   *
   * So the highest-leverage question a corpus can hold appeared in `check` and nowhere a person
   * would meet it: `decide money` reported nothing about a rule that was governing
   * `see-a-balance#answer`, and `read money --buildable yes` was accepted while it stood open.
   * The one question whose single ruling settles a whole class was the one the answering
   * surface did not know about.
   */
  const fromRules = openRuleQuestions(corpus, under);
  return [...fromRules, ...fromSlots];
}

/** Open rules whose selector reaches any exchange in these scopes. */
export function openRuleQuestions(corpus: Corpus, scopeIds: string[]): Question[] {
  const out: Question[] = [];
  for (const { rule } of corpus.rules) {
    const s = rule.standing;
    if (!s || s.kind === "stated") continue;
    const reaches = corpus.scopes
      .filter((x) => scopeIds.includes(x.scope.id))
      .flatMap((x) =>
        x.scope.exchanges
          .filter((ex) => selectsFor({ ...rule, standing: undefined }, x.scope, ex, lineageOf(corpus, x.scope.id), corpus))
          .map((ex) => `${x.scope.id}#${ex.id}`)
      );
    if (!reaches.length) continue;
    out.push({
      ref: rule.id,
      scope: scopeIds[0]!,
      exchange: "(an org-wide rule)",
      exchangeTitle: `Every exchange like these: ${reaches.slice(0, 3).join(", ")}${reaches.length > 3 ? `, +${reaches.length - 3} more` : ""}`,
      slot: rule.fills[0]!,
      kind: `${s.kind} — org-wide`,
      asks: [
        norm(s.question),
        s.about ? `In question: ${norm(s.about)}` : "",
        `Answering it once settles ${rule.fills.join(" and ")} on ${reaches.length} exchange${reaches.length === 1 ? "" : "s"} here, and on every one written after it.`,
        `Until then it governs nothing, and those slots read as the blanks they are.`,
      ]
        .filter(Boolean)
        .join("\n"),
      cost: s.cost,
      owed: s.asked_of,
      candidates: s.candidates ?? [],
      revises: undefined,
      about: s.about,
      observed: corpus.readings
        .filter((rd) => rd.bears_on === rule.id)
        .map((rd) => ({ says: rd.observes, basis: `${rd.basis.kind}: ${rd.basis.ref}`, at: rd.basis.at })),
      conflictsWith: (s.targets ?? []).filter((x) => x !== rule.id),
      blocks: s.blocks ?? [],
      parked: (() => {
        const put = corpus.verdicts.find((v) => v.kind === "defer" && v.target === rule.id);
        return put ? { by: put.by, because: put.because!, until: put.until! } : undefined;
      })(),
      needsThen: true,
    });
  }
  return out;
}

function questionsIn(corpus: Corpus, scopeId: string): Question[] {
  const entry = corpus.scopes.find((s) => s.scope.id === scopeId);
  if (!entry) return [];
  const parked = new Map(corpus.verdicts.filter((v) => v.kind === "defer").map((v) => [v.target!, v]));
  const out: Question[] = [];
  for (const ex of entry.scope.exchanges) {
    for (const [slot, fill] of Object.entries(ex.slots)) {
      if (!fill) continue;
      // ⛔ A named case nobody has ruled is offered for answering like anything else. The
      // whole point of recording it at outcome grain is that it stays a live question.
      for (const o of fill.outcomes ?? []) {
        const ok = o.standing?.kind ?? "stated";
        if (ok === "stated" || ok === "out_of_scope") continue;
        const s = o.standing!;
        out.push({
          ref: `${scopeId}#${ex.id}#${slot}#${o.name}`,
          scope: scopeId,
          exchange: ex.id,
          exchangeTitle: ex.title,
          slot: slot as SlotName,
          kind: `${ok} case`,
          asks: [
            `The case "${o.name}" — when ${o.when} — is not ruled.`,
            s.about ? `In question: ${s.about}` : "",
            (s.candidates ?? []).length === 1 ? `Proposed: ${s.candidates![0]!.says}` : "",
            s.because ? `Because: ${s.because}` : "",
            s.question ?? "",
          ]
            .filter(Boolean)
            .join("\n"),
          cost: s.cost,
          owed: s.asked_of,
          candidates: s.candidates ?? [],
          revises: undefined,
          about: s.about,
          asksPolarity: s.asks === "whether",
          observed: [],
          conflictsWith: [],
          blocks: s.blocks ?? [],
          parked: parked.get(`${scopeId}#${ex.id}#${slot}#${o.name}`)
            ? {
                by: parked.get(`${scopeId}#${ex.id}#${slot}#${o.name}`)!.by,
                because: parked.get(`${scopeId}#${ex.id}#${slot}#${o.name}`)!.because!,
                until: parked.get(`${scopeId}#${ex.id}#${slot}#${o.name}`)!.until!,
              }
            : undefined,
        });
      }
      const k = fill.standing.kind;
      if (k === "stated" || k === "out_of_scope") continue;
      const s = fill.standing;
      const ref = `${scopeId}#${ex.id}#${slot}`;
      const put = parked.get(ref);
      out.push({
        ref,
        scope: scopeId,
        exchange: ex.id,
        exchangeTitle: ex.title,
        slot: slot as SlotName,
        kind: k,
        asks:
          k === "open"
            ? s.question!
            : `Cannot hold with ${(s.targets ?? []).join(", ")}. ${s.because ?? ""}`,
        cost: s.cost,
        owed: s.asked_of,
        /**
         * ⛔ A CANDIDATE'S `says` IS A BEHAVIOUR, WHICH IS NOW TRUE BY CONSTRUCTION.
         *
         * When competing interpretations lived in a separate `readings: string[]`, offering
         * them as pickable copied an ARGUMENT into the slot — *"a repeat is a mis-press,
         * because spending is usually entered once from a receipt…"* — which nobody can
         * implement. Folding that standing into `open` means each option's `says` is what
         * the product does and its `consequence` is the argument for it, so the two can no
         * longer be confused. A `proposal` is one such answer.
         */
        candidates: s.candidates ?? [],
        revises: s.about ? fill.says : undefined,
        candidatesAreWhole:
          (s.candidates ?? []).length > 0 && (s.candidates ?? []).every((c) => c.replaces === "the whole sentence"),
        about: s.about,
        /**
         * ⛔ The corpus held the evidence for the question and withheld it at the moment of
         * deciding. A trial reading indexed on this exact ref — "both kids pressing the same
         * task was observed twice in a fortnight" — never reached the person being asked
         * whether two kids can complete one task.
         */
        observed: corpus.readings
          .filter((rd) => rd.bears_on === ref)
          .map((rd) => ({ says: rd.observes, basis: `${rd.basis.kind}: ${rd.basis.ref}`, at: rd.basis.at })),
        conflictsWith: (s.targets ?? []).filter((x) => x !== ref),
        blocks: s.blocks ?? [],
        parked: put ? { by: put.by, because: put.because!, until: put.until! } : undefined,
      });
    }
  }
  return out;
}

/**
 * Write a ruling into the slot it settles.
 *
 * ⛔ Round-trips the frontmatter through YAML, so the file is reformatted. Acceptable
 * only because v2 frontmatter carries no comments and no meaning in its layout — and it
 * is re-parsed and validated before anything is written, so a ruling can never leave a
 * file that will not load.
 */
export function settle(
  root: string,
  ref: string,
  says: string,
  by: string,
  at: string,
  because: string,
  /** ⛔ A person's declaration about a rule this sentence now answers where. Never inferred. */
  about: {
    defersTo?: string;
    insteadOf?: string;
    then?: string;
    refuses?: boolean;
    /** ⛔ For a `refuses` question: the named cases, which a sentence cannot express. */
    outcomes?: unknown[];
    none?: boolean;
  } = {}
): { ok: true; file: string; displaced: string[]; replaced?: string } | { ok: false; why: string } {
  const corpus = loadCorpus(root);
  // ⛔ Through the one resolver. Four call sites used to split on `#` and read index 2, and
  // three of them got the outcome grain wrong.
  const r = resolveRef(corpus, ref);
  if ("error" in r) return { ok: false, why: r.error };
  /**
   * ⛔ Answering an ORG-WIDE question. One ruling here settles every exchange the selector
   * reaches, including ones nobody has written yet, which is the whole argument for the rule
   * layer existing at all.
   */
  /**
   * ⛔ A shared refusal case, ruled at the grain it is unruled at.
   *
   * Same three questions as a slot's case — whether, when, or what the asker is told — and the
   * same rule for a negative `whether`: the case is retired rather than given a message saying
   * it does not refuse.
   */
  if (r.ref.kind === "rule-case") {
    const rule = corpus.rules.find((x) => x.rule.id === (r.ref as { rule: string }).rule)!;
    const caseName = (r.ref as { name: string }).name;
    const raw = parseFrontmatter(fs.readFileSync(rule.file, "utf-8"));
    const data = raw.data as Record<string, unknown>;
    const outcomes = (data.outcomes as Array<Record<string, unknown>> | undefined) ?? [];
    const o = outcomes.find((x) => x.name === caseName);
    if (!o) return { ok: false, why: `${rule.rule.id} names no case "${caseName}"` };
    const asks = ((o.standing as Record<string, unknown> | undefined)?.asks as string) ?? "told";
    const beforeCase = { ...o };
    let removed: string | undefined;
    if (asks === "whether" && about.refuses === undefined)
      return {
        ok: false,
        why: `"${caseName}" asks WHETHER it refuses — say which with --refuses yes|no, because the answer decides whether this case survives at all`,
      };
    if (asks === "whether" && about.refuses === false) {
      removed = `refuses ${o.name} when ${String(o.when).replace(/\s+/g, " ")} → ${String(o.told).replace(/\s+/g, " ")}`;
      outcomes.splice(outcomes.indexOf(o), 1);
    } else if (asks === "whether") {
      delete o.standing;
      const lost = removals(beforeCase, o, ["standing"]);
      if (lost.length) return { ok: false, why: refuseBecause("Ruling this shared case", ref, lost) };
    } else {
      delete o.standing;
      o[asks === "when" ? "when" : "told"] = says;
      const lost = removals(beforeCase, o, ["standing", asks === "when" ? "when" : "told"]);
      if (lost.length) return { ok: false, why: refuseBecause("Ruling this shared case", ref, lost) };
    }
    const parsed = Rule.safeParse(data);
    if (!parsed.success)
      return { ok: false, why: parsed.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ") };
    fs.writeFileSync(
      rule.file,
      `---\n${YAML.stringify(data, { lineWidth: 96, blockQuote: "literal" })}---\n\n${raw.content.trim()}\n`,
      "utf-8"
    );
    return { ok: true, file: rule.file, displaced: [], replaced: removed };
  }
  if (r.ref.kind === "rule") {
    const file = corpus.rules.find((x) => x.rule.id === r.ref.id)!.file;
    const raw = parseFrontmatter(fs.readFileSync(file, "utf-8"));
    const data = raw.data as Record<string, unknown>;
    const beforeRule = { ...data };
    delete data.standing;
    data.statement = says;
    // The demonstration arrives with the ruling, because a decided rule owes one.
    if (about.then)
      data.criteria = [
        ...((data.criteria as unknown[]) ?? []),
        { id: 1, slot: (data.fills as string[] | string)[0] ?? data.fills, kind: "conformance", then: about.then },
      ];
    const lost = removals(beforeRule, data, ["standing", "statement", "criteria"]);
    if (lost.length) return { ok: false, why: refuseBecause("This ruling", ref, lost) };
    const parsed = Rule.safeParse(data);
    if (!parsed.success)
      return {
        ok: false,
        why: parsed.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; "),
      };
    fs.writeFileSync(
      file,
      `---\n${YAML.stringify(data, { lineWidth: 96, blockQuote: "literal" })}---\n\n${raw.content.trim()}\n`,
      "utf-8"
    );
    return { ok: true, file, displaced: [], replaced: undefined };
  }
  if (r.ref.kind !== "slot" && r.ref.kind !== "case")
    return { ok: false, why: `${ref} is not a slot or a named case — nothing there holds a standing` };
  const { scope: scopeId, exchange: exId, slot: slotName } = r.ref;
  const entry = corpus.scopes.find((s) => s.scope.id === scopeId);
  if (!entry) return { ok: false, why: `no scope "${scopeId}"` };
  const raw = parseFrontmatter(fs.readFileSync(entry.file, "utf-8"));
  const data = raw.data as { exchanges?: Array<{ id: string; slots?: Record<string, unknown> }> };
  const ex = (data.exchanges ?? []).find((e) => e.id === exId);
  if (!ex) return { ok: false, why: `no exchange "${exId}" in ${scopeId}` };
  const slot = (ex.slots ?? {})[slotName] as Record<string, unknown> | undefined;
  if (!slot) return { ok: false, why: `no slot "${slotName}" on ${exId}` };

  /**
   * ⛔ RULING A NAMED CASE TOUCHES THAT CASE AND NOTHING ELSE.
   *
   * Writing `says` onto the whole slot when the question was about one refusal deleted the
   * slot's own open question with no verdict recording it, and left the case's `proposed`
   * standing untouched — so a packet read "It is not refused. It is recorded…" directly above
   * three named refusals, one of them still marked NOT RULED, with the header claiming one
   * hole. Answering one question destroyed a different one.
   */
  if (r.ref.kind === "case") {
    const outcomes = (slot.outcomes as Array<Record<string, unknown>> | undefined) ?? [];
    const caseName = r.ref.name;
    const o = outcomes.find((x) => x.name === caseName);
    if (!o) return { ok: false, why: `no case "${caseName}" on ${exId}'s ${slotName}` };
    /**
     * ⛔ THE QUESTION ON A CASE CAN BE ANY OF THREE THINGS, and this assumed the third.
     *
     * *Whether* it refuses, *when* it refuses, or *what the asker is told*. Every ruling went
     * into `told`, so answering the schema's own documented example — "is spending past
     * nothing refused at all?" — produced `refuses more-than-they-have when the amount is
     * larger than what the kid has → It is not refused.` The user-facing message was
     * destroyed and appeared in no verdict.
     *
     * `asks` says which. Ruling `whether` in the negative RETIRES the case rather than
     * writing a message into it, because a refusal that does not refuse is not a refusal.
     */
    const asks = ((o.standing as Record<string, unknown> | undefined)?.asks as string) ?? "told";
    const beforeCase = { ...o };
    let removedCase: string | undefined;
    const answerField = asks === "when" ? "when" : "told";
    /**
     * ⛔ THE POLARITY IS ASKED FOR, NOT GUESSED FROM THE SENTENCE.
     *
     * A regex decided whether a `whether` ruling meant yes or no. Ruled affirmative it
     * overwrote a kid's refusal message with *"Yes — spending more than the kid has is
     * refused, and nothing is recorded."*; ruled negative it deleted an outcome whose ruling
     * said it was **still refused** — both with nothing recorded about what was replaced.
     * Guessing the meaning of a sentence is exactly what this framework exists to stop.
     */
    if (asks === "whether" && about.refuses === undefined)
      return {
        ok: false,
        why: `"${caseName}" asks WHETHER it refuses — say which with --refuses yes|no, because the answer decides whether this case survives at all`,
      };
    if (asks === "whether" && about.refuses === false) {
      /**
       * ⛔ RULED "it does not refuse", so the case goes — and what it used to say is returned
       * so the verdict can record it.
       *
       * This branch was the one write path with no `removals()` call: it deleted the outcome,
       * printed *"and wrote it into the slot"*, dropped the packet's hole count, and the
       * human's sentence landed nowhere in `truth/` at all.
       */
      removedCase = `refuses ${o.name} when ${String(o.when).replace(/\s+/g, " ")} → ${String(o.told).replace(/\s+/g, " ")}`;
      outcomes.splice(outcomes.indexOf(o), 1);
      if (!outcomes.length) delete slot.outcomes;
    } else if (asks === "whether") {
      /**
       * ⛔ RULED "it does refuse", so the ruling settles WHETHER — it is not the message.
       *
       * It used to be written into `told`, so ruling that spending past nothing IS refused
       * overwrote a nine-year-old's refusal message with *"Yes — spending more than the kid
       * has is refused, and nothing is recorded."* The question was whether, and the answer to
       * whether is not a sentence shown to a child.
       */
      delete o.standing;
      const lostHere = removals(beforeCase, o, ["standing"]);
      if (lostHere.length) return { ok: false, why: refuseBecause("Ruling this case", ref, lostHere) };
    } else {
      delete o.standing;
      o[answerField] = says;
      const lostHere = removals(beforeCase, o, ["standing", answerField]);
      if (lostHere.length) return { ok: false, why: refuseBecause("Ruling this case", ref, lostHere) };
    }
    const next = { ...data, exchanges: data.exchanges };
    const check = Scope.safeParse(next);
    if (!check.success)
      return {
        ok: false,
        why: `the ruling would not parse back: ${check.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ")}`,
      };
    fs.writeFileSync(
      entry.file,
      `---\n${YAML.stringify(next, { lineWidth: 96, blockQuote: "literal" })}---\n\n${raw.content.trim()}\n`,
      "utf-8"
    );
    return { ok: true, file: entry.file, displaced: [], replaced: removedCase };
  }

  /**
   * ⛔ The standing is REPLACED, not merged.
   *
   * Leaving `question`, `readings`, `cost` or `candidates` behind next to a settled slot
   * leaves two records of the same thing: the sentence says it is decided and the leftover
   * fields say nobody has decided. `.strict()` would refuse the file on the next read
   * anyway, which is the schema catching what a merge would have hidden.
   *
   * What the decision WAS is not lost — it is in the verdict log, with the reasoning and
   * what else was considered, which is where a record of a decision belongs.
   */
  /**
   * ⛔ A RULING REPLACES THE ANSWER. It does not add a second one, and it does not leave a
   * waiver standing that now contradicts it.
   *
   * Ruling a slot that held `cannot_fail:` used to leave both on the file — and the packet
   * printed the `cannot_fail`, so the human's ruling appeared nowhere. Worse, the
   * `instead_of` waiving the org rule *"the person is told it was not recorded"* survived,
   * citing the ruler's own argument for telling them. The ruling was not ignored; it was
   * inverted.
   *
   * `instead_of` is cleared and re-derived below from what the new sentence actually
   * displaces, so a waiver can never outlive the answer it was attached to.
   */
  /**
   * ⛔ A RULING SETTLES WHAT WAS ASKED AND NOTHING ELSE.
   *
   * Its declared reach is the standing plus the one field holding the answer. Anything else
   * the write would take with it is refused and named — see `write.ts` for the four ways this
   * used to destroy truth nobody had questioned.
   */
  const beforeSlot = { ...slot };
  // ⛔ Recorded, so the corpus keeps the sentence that used to be there. A ruling that
  // revises an agreed sentence is legitimate; losing the old one without trace is not.
  const wasSaying = typeof slot.says === "string" ? (slot.says as string).replace(/\s+/g, " ").trim() : undefined;
  /**
   * ⛔ THE CLAUSE-LOSS GUARD, ON `--says` TOO. It was closed on `--pick` and left open on the
   * command `decide` prints one line below it.
   *
   * A reviewer answering the residual on `record-spending#answer` reduced the agreed
   * three-clause sentence to *"It is refused, because a kid's money must never read as owed"* —
   * the money coming off, the history entry and the navigation all gone, and an argument
   * written where the behaviour goes. `check` fired only on the now-orphaned CRITERIA, and its
   * remediation told the author to fix the criterion; on a slot with no criteria it was silent.
   *
   * A ruling on a slot whose question was `about` one part must keep the rest. This does not
   * judge prose — it asks whether the sentences that were agreed still appear, which is a
   * question about what was removed, not about what is right.
   */
  if (wasSaying && (beforeSlot.standing as { about?: string } | undefined)?.about) {
    const clauses = wasSaying
      .split(/[,;—]| and (?=the |it |they )/)
      .map((c) => c.trim().replace(/^(and|then|so) /i, ""))
      .filter((c) => c.split(/\s+/).length >= 4);
    const kept = says.replace(/\s+/g, " ").toLowerCase();
    const dropped = clauses.filter((c) => {
      const words = c.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const hits = words.filter((w) => kept.includes(w)).length;
      return words.length >= 3 && hits / words.length < 0.5;
    });
    if (dropped.length)
      return {
        ok: false,
        why:
          `This ruling drops ${dropped.length === 1 ? "a part" : "parts"} of what was already agreed here, ` +
          `and only one thing about it was in question:\n` +
          dropped.map((c) => `      ${c}`).join("\n") +
          `\n\n  It said: ${wasSaying}\n  In question: ${(beforeSlot.standing as { about: string }).about.replace(/\s+/g, " ").trim()}\n` +
          `\n  Write the whole sentence you want, keeping the rest — or if those parts really are ` +
          `wrong too,\n  say so as its own act first.`,
      };
  }
  /**
   * ⛔ THE SETTLED STANDING KEEPS WHO SETTLED IT, so `check` has something to demand a verdict
   * against.
   *
   * The `waive` guard works precisely because a waiver leaves its standing on the file — so
   * `latitude-nobody-granted` can ask "which act was this?". A ruling used to DELETE the
   * standing, leaving a sentence indistinguishable from one an author drafted, and `check` had
   * nothing to hold. Hand-editing an open question into a `says:` therefore closed the
   * corpus's hardest question with zero findings, while the `out_of_scope` route was refused
   * by name.
   */
  slot.standing = { kind: "stated", answered_by: by, answered_at: at };
  /**
   * ⛔ A `refuses` ruling writes NAMED CASES, not a sentence — the one slot where a sentence is
   * a parse refusal, and therefore the one slot no command could settle.
   */
  /**
   * ⛔ A `refuses` RULING MAY ADD CASES. IT MAY NOT SILENTLY DELETE AGREED ONES.
   *
   * `slot.outcomes = about.outcomes` is a wholesale replacement, and `outcomes` is in this
   * act's declared reach — so the write guard waved it through. `--pick` on a slot with an
   * open standing and already-agreed named cases therefore deleted every one of them,
   * recorded nothing about the deletion, and left a corpus that was then acceptable: the
   * refusals a person had read and agreed to were gone, the exchange's stamp read current,
   * and `check` had nothing to say. Named refusals are the slot most likely to carry the
   * money-losing case, and they were the cheapest thing in the model to destroy.
   *
   * The comparison is by name, because a name is the case's identity — re-wording `when` or
   * `told` is a revision, and revisions are what a ruling is for.
   */
  if (about.outcomes || about.none) {
    const had = ((beforeSlot.outcomes as Array<{ name?: string }> | undefined) ?? [])
      .map((o) => String(o.name))
      .filter(Boolean);
    const now = about.outcomes
      ? (about.outcomes as Array<{ name?: string }>).map((o) => String(o.name))
      : [];
    const gone = had.filter((n) => !now.includes(n));
    if (gone.length)
      return {
        ok: false,
        why:
          `This ruling would drop ${gone.length === 1 ? "a refusal" : "refusals"} already agreed here:\n` +
          gone.map((n) => `      ${n}`).join("\n") +
          `\n\n  ${about.none ? "It says there is nothing to refuse, and these say otherwise." : "The option you picked does not mention " + (gone.length === 1 ? "it" : "them") + "."}\n` +
          `  A ruling on this slot may ADD cases or re-word them. Retiring one is its own act,\n` +
          `  because somebody agreed to it:\n` +
          gone.map((n) => `      productos v2 rule ${ref}#${n} --refuses no --says "…" --because "…" --by <you>`).join("\n"),
      };
  }
  if (about.outcomes) slot.outcomes = about.outcomes;
  else if (about.none) slot.none = true;
  else slot.says = says;
  // ⛔ Cleared, then re-derived only from what the person declared in THIS act — the comment
  // above has claimed this since the field existed and the code did not do it, so an
  // `instead_of` authored beside an open slot survived the ruling that replaced its sentence.
  delete slot.instead_of;
  delete slot.defers_to;
  const lostBySettling = removals(beforeSlot, slot, ["standing", "says", "outcomes", "none", "instead_of", "defers_to"]);
  if (lostBySettling.length) return { ok: false, why: refuseBecause("This ruling", ref, lostBySettling) };

  /**
   * ⛔ A ruling that displaces an org-wide rule declares the override, using the reasoning
   * the person just gave.
   *
   * Without this, answering a question correctly produced a refusal the answerer could not
   * have anticipated: the slot went from an unsettled standing (which contests a rule, and is
   * reported as such) to `stated` (which displaces one, and must say so). So the reward for
   * settling a hard question was a new error about a rule they had never mentioned.
   *
   * The `because` is not invented — it is the reasoning attached to the ruling, and "why
   * this slot answers for itself here" is exactly what that reasoning says. If they gave
   * none, the override is still declared, pointing at the verdict log rather than guessing.
   */
  const displaced: string[] = [];
  if (because.trim().length < 40)
    return { ok: false, why: "a ruling needs its reasoning — this function will not write one for you" };
  /**
   * ⛔ THE TOOL NO LONGER DECIDES THAT A RULING OVERRIDES A RULE.
   *
   * It added `instead_of` whenever the new sentence displaced a `supplies` rule. So a ruling
   * that AGREED with `a-repeat-does-nothing-twice` — a verbatim restatement of it — wrote a
   * formal exemption from that rule in the ruler's name, and printed "your answer overrides
   * a-repeat-does-nothing-twice here". Three such rulings and all three money writes carried
   * `⊗`, with the idempotency rule governing no money write at all.
   *
   * Overriding a rule and agreeing with one are different acts and cannot share a record.
   * `check` asks for whichever declaration is missing rather than the tool guessing.
   */
  const { displaced: wouldSupply } = resolveRules(corpus);
  for (const r of wouldSupply.get(ref) ?? []) displaced.push(r.id);
  /**
   * ⛔ Written only because a person said so, and refused if they name a rule that is not in
   * play — a declaration about the wrong rule is worse than none, because it reads as
   * considered.
   */
  for (const [flag, field] of [
    [about.defersTo, "defers_to"],
    [about.insteadOf, "instead_of"],
  ] as const) {
    if (!flag) continue;
    if (!displaced.includes(flag))
      return {
        ok: false,
        why: `${flag} does not answer ${ref}${displaced.length ? ` — the rules that do are ${displaced.join(", ")}` : " — no rule does"}`,
      };
    const existing = (slot[field] as Array<{ rule: string }> | undefined) ?? [];
    slot[field] = [...existing.filter((x) => x.rule !== flag), { rule: flag, because }];
  }
  // Keep a settled slot's own shape intact — outcomes, within, notes and any declared
  // override all survive a ruling, because none of them was the thing in question.

  const next = { ...data, exchanges: data.exchanges };
  const check = Scope.safeParse(next);
  if (!check.success)
    return {
      ok: false,
      why: `the ruling would not parse back: ${check.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ")}`,
    };
  const fm = YAML.stringify(next, { lineWidth: 96, blockQuote: "literal" });
  fs.writeFileSync(entry.file, `---\n${fm}---\n\n${raw.content.trim()}\n`, "utf-8");
  return { ok: true, file: entry.file, displaced, replaced: wasSaying };
}

/**
 * Write a waiver into the slot it leaves unanswered.
 *
 * ⛔ Same shape as `settle`: the truth is written here and the CLI logs the act only once
 * this has succeeded, so a verdict can never sit beside a slot that does not agree with it.
 */
export function waive(
  root: string,
  ref: string,
  because: string,
  by: string,
  at: string
): { ok: true; file: string } | { ok: false; why: string } {
  const corpus = loadCorpus(root);
  const r = resolveRef(corpus, ref);
  if ("error" in r) return { ok: false, why: r.error };
  if (r.ref.kind !== "slot") return { ok: false, why: `${ref} is not a slot` };
  const { scope: scopeId, exchange: exId, slot: slotName } = r.ref;
  const entry = corpus.scopes.find((s) => s.scope.id === scopeId);
  if (!entry) return { ok: false, why: `no scope "${scopeId}"` };
  const raw = parseFrontmatter(fs.readFileSync(entry.file, "utf-8"));
  const data = raw.data as { exchanges?: Array<{ id: string; slots?: Record<string, unknown> }> };
  const ex = (data.exchanges ?? []).find((e) => e.id === exId);
  if (!ex) return { ok: false, why: `no exchange "${exId}" in ${scopeId}` };
  const slot = (ex.slots ?? {})[slotName] as Record<string, unknown> | undefined;
  if (!slot) return { ok: false, why: `no slot "${slotName}" on ${exId}` };
  /**
   * ⛔ A WAIVER OVER AN EXISTING ANSWER IS REFUSED, NOT SILENTLY APPLIED.
   *
   * It used to delete `says`, `none`, `cannot_fail` and `outcomes` — so waiving one slot
   * removed two settled named refusals with no gate and no record. Declaring latitude over
   * something already answered is not granting latitude; it is deleting a behaviour, and it
   * has to be two acts so that the deletion is visible as one.
   */
  const waived = { standing: { kind: "out_of_scope", because, answered_by: by, answered_at: at } };
  const lostByWaiving = removals({ ...slot }, waived, ["standing"]);
  if (lostByWaiving.length) return { ok: false, why: refuseBecause("Waiving this slot", ref, lostByWaiving) };
  for (const k of Object.keys(slot)) delete (slot as Record<string, unknown>)[k];
  Object.assign(slot, waived);
  const next = { ...data, exchanges: data.exchanges };
  const check = Scope.safeParse(next);
  if (!check.success)
    return {
      ok: false,
      why: check.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; "),
    };
  fs.writeFileSync(
    entry.file,
    `---\n${YAML.stringify(next, { lineWidth: 96, blockQuote: "literal" })}---\n\n${raw.content.trim()}\n`,
    "utf-8"
  );
  return { ok: true, file: entry.file };
}

/**
 * Record which org-wide rule governs a slot that already says something.
 *
 * ⛔ A SEPARATE ACT FROM A RULING, because the question is separate: a slot can be perfectly
 * settled and still owe an answer to "does the org rule you displaced still hold here?"
 *
 * Folding it into `rule` left the loop with a dead end — settling a slot produced a corpus
 * that `check` refused, and the remedy the tool printed was rejected because the slot was by
 * then settled.
 */
export function govern(
  root: string,
  ref: string,
  about: { defersTo?: string; insteadOf?: string },
  because: string
): { ok: true; file: string } | { ok: false; why: string } {
  const corpus = loadCorpus(root);
  const r = resolveRef(corpus, ref);
  if ("error" in r) return { ok: false, why: r.error };
  if (r.ref.kind !== "slot") return { ok: false, why: `${ref} is not a slot` };
  if (because.trim().length < 40)
    return { ok: false, why: "say why, in a sentence a reader can weigh — this is a claim about an org-wide rule" };
  const { scope: scopeId, exchange: exId, slot: slotName } = r.ref;
  const entry = corpus.scopes.find((s) => s.scope.id === scopeId);
  if (!entry) return { ok: false, why: `no scope "${scopeId}"` };
  const raw = parseFrontmatter(fs.readFileSync(entry.file, "utf-8"));
  const data = raw.data as { exchanges?: Array<{ id: string; slots?: Record<string, unknown> }> };
  const ex = (data.exchanges ?? []).find((e) => e.id === exId);
  const slot = (ex?.slots ?? {})[slotName] as Record<string, unknown> | undefined;
  if (!slot) return { ok: false, why: `no slot "${slotName}" on ${exId}` };
  const { displaced } = resolveRules(corpus);
  const inPlay = (displaced.get(ref) ?? []).map((x) => x.id);
  for (const [flag, field] of [
    [about.defersTo, "defers_to"],
    [about.insteadOf, "instead_of"],
  ] as const) {
    if (!flag) continue;
    if (!inPlay.includes(flag))
      return {
        ok: false,
        why: `${flag} does not answer ${ref}${inPlay.length ? ` — the rules that do are ${inPlay.join(", ")}` : " — no rule does"}`,
      };
    const existing = (slot[field] as Array<{ rule: string }> | undefined) ?? [];
    slot[field] = [...existing.filter((x) => x.rule !== flag), { rule: flag, because }];
  }
  const next = { ...data, exchanges: data.exchanges };
  const check = Scope.safeParse(next);
  if (!check.success)
    return { ok: false, why: check.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ") };
  fs.writeFileSync(
    entry.file,
    `---\n${YAML.stringify(next, { lineWidth: 96, blockQuote: "literal" })}---\n\n${raw.content.trim()}\n`,
    "utf-8"
  );
  return { ok: true, file: entry.file };
}
