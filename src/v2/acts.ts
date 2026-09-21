/**
 * ⛔ THE FIVE ACTS, IN ONE PLACE — because four surfaces are about to need them.
 *
 * `accept · rule · read · waive · defer` were the bodies of five CLI `.action()` handlers.
 * They are now performed here and printed there, because the CLI is no longer the only caller:
 * MCP, the served page and the press-watcher all record the same acts, and none of them can
 * call `process.exit`.
 *
 * ⛔ THIS IS A MOVE, NOT A REWRITE. Every guard and every ⛔ comment below was earned by a
 * reviewer breaking the thing it now prevents, across sixteen rounds. The one thing that
 * changed shape is how a refusal is reported: `console.error(…); process.exit(1)` became a
 * returned `Refused`, so a caller that is an HTTP handler can say no without killing a server.
 *
 * ⛔ AND IT IS THE ONLY PLACE. The recurring defect in this codebase is a predicate written
 * twice: `gateFor` diverged from `check` by a single clause and made two of the five seed
 * exchanges permanently un-acceptable — invisible on every surface, in both directions. Four
 * copies of an act would be that failure with four times the reach.
 */
import fs from "node:fs";
import path from "node:path";
import { checkCorpus } from "./check.js";
import { loadCorpus, type Corpus } from "./load.js";
import { Verdict, type SlotName } from "./schema.js";
import { gateFor } from "./grid.js";
import { coveredBy, stampFor, staleReason } from "./stamp.js";
import { questionsFor, settle, waive as applyWaiver, govern } from "./settle.js";
import { resolveRef, nothingToDecide } from "./ref.js";

/**
 * How the human's consent was obtained.
 *
 * ⛔ REQUIRED ON EVERY ACT, AND NEVER DEFAULTED.
 *
 * The acts used to be reachable from the CLI alone, and an MCP boundary test failed the build
 * if any model-callable tool could perform one — on the reasoning that MCP is what a model
 * reaches for unprompted. That boundary has been deliberately opened, which means the
 * guarantee "a model cannot produce a verdict" no longer holds and something has to take its
 * place: every stamp now records which surface it came through, so a corpus can be read for
 * the quality of its validation rather than only its presence.
 *
 * A default would defeat the whole point — the weakest provenance would silently wear the
 * strongest name.
 */
export type Via = "page" | "question" | "chat" | "cli";
export const VIA: readonly Via[] = ["page", "question", "chat", "cli"] as const;

export type Act = "accept" | "rule" | "read" | "waive" | "defer";

export interface Consent {
  /** ⛔ Recorded, never authenticated. See `requireName`. */
  by: string;
  via: Via;
}

/**
 * An act that WOULD be honest here, offered instead of the one that was refused.
 *
 * ⛔ STRUCTURED, NOT A COMMAND STRING. Every refusal used to print the CLI invocation that
 * would satisfy it, which is right on a terminal and wrong everywhere else: a page would be
 * telling a reviewer to open a shell, and a question interface has no way to render it at all.
 * The same offer is now a button on the page, an option in a question, and a printed command
 * on the CLI — one source, three renderings.
 */
export interface Instead {
  act: Act | "decide";
  ref: string;
  why: string;
}

export interface Refused {
  ok: false;
  /** The headline, in a reviewer's words. */
  why: string;
  /** What to do about it — printed dim by the CLI, returned as-is everywhere else. */
  detail: string[];
  /** ⛔ The honest exits. A refusal with no way forward is where reviewers stop reviewing. */
  instead?: Instead[];
}
export interface Recorded {
  ok: true;
  /** What was recorded, in one line. */
  said: string;
  detail: string[];
  /** Rules this act's sentence now answers for, which the caller must resolve. */
  displaced?: string[];
}
export type Outcome = Refused | Recorded;

const no = (why: string, detail: string[] = [], instead?: Instead[]): Refused => ({
  ok: false,
  why,
  detail,
  ...(instead?.length ? { instead } : {}),
});
const flat = (s: unknown): string => String(s ?? "").replace(/\s+/g, " ").trim();

export interface AcceptPayload { target: string }
export interface RulePayload {
  slot: string;
  says?: string;
  pick?: number;
  because: string;
  alsoConsidered?: string;
  defersTo?: string;
  insteadOf?: string;
  stands?: string;
  then?: string;
  /** For a case asking `whether`: does it refuse at all? `false` retires the case. */
  refuses?: boolean;
}
export interface ReadPayload { scope: string; buildable: boolean; blockedBy?: string[]; note?: string }
export interface WaivePayload { slot: string; because: string }
export interface DeferPayload { slot: string; because: string; until: string }
export type Payload = AcceptPayload | RulePayload | ReadPayload | WaivePayload | DeferPayload;

// ---------------------------------------------------------------------------
// Shared guards. Each was a defect first.

/**
 * How an option reads, whatever shape its answer takes.
 *
 * ⛔ `refuses` options carry named cases rather than a sentence, because a sentence there is a
 * parse refusal — which is why that slot could not be settled by any command at all.
 */
export const optionText = (c: {
  says?: string;
  outcomes?: Array<{ name: string; when: string; told: string }>;
  none?: boolean;
}): string =>
  c.says
    ? flat(c.says)
    : c.none
      ? "nothing to refuse"
      : (c.outcomes ?? []).map((o) => `refuses ${o.name} when ${o.when} → ${o.told}`).join("; ");

const writeVerdict = (dir: string, file: string, lines: string[]): void => {
  const full = path.join(dir, "verdicts", file);
  const existing = fs.existsSync(full) ? fs.readFileSync(full, "utf-8") : "verdicts:\n";
  fs.mkdirSync(path.dirname(full), { recursive: true });
  // Append-only. A person's acts are a log, never a field that gets overwritten.
  fs.writeFileSync(full, existing.trimEnd() + "\n" + lines.join("\n") + "\n");
};

const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * ⛔ `by` HAS TO BE SOMEBODY.
 *
 * `decide` printed `--by <your name>`, a reviewer ran the printed command, and the verdict file
 * recorded `by: you` — the tool's own recommendation producing a record of consent attributed
 * to nobody. It is not authentication and cannot be; it is the difference between a name and a
 * placeholder.
 */
const PLACEHOLDER_NAME = /^(you|me|someone|somebody|anon|anonymous|user|tbd|n\/?a|\?+)$/i;
const requireName = (by: string): Refused | null =>
  PLACEHOLDER_NAME.test((by ?? "").trim())
    ? no(`"${by}" is not a name — this is the record of who decided, and it outlives the session`)
    : null;

const requireVia = (via: unknown): Refused | null =>
  VIA.includes(via as Via)
    ? null
    : no(`"${String(via)}" is not a way consent could have been obtained`, [
        `one of: ${VIA.join(" · ")}`,
        "this is the record of HOW a person agreed, and nothing can reconstruct it afterwards",
      ]);

/**
 * ⛔ NO ACT OF HUMAN JUDGEMENT IS RECORDED OVER A CORPUS THAT DID NOT LOAD.
 *
 * `corpus.broken` was read by `check` and by nothing else. So a single unparseable file — a
 * stray tab, an unquoted comma in a flow mapping, the two commonest hand-edits there are —
 * left every other surface computing over a corpus missing part of itself, and `accept` and
 * `read` would write a person's name to "I read this and could build from it" over it. The
 * stamp is the one thing in the corpus nothing else can reconstruct, and it was the cheapest
 * thing to make false: break a file, stamp, fix the file, and the stamp reads current.
 */
const ifBroken = (corpus: Corpus, act: string): Refused | null => {
  if (!corpus.broken.length) return null;
  const n = corpus.broken.length;
  return no(
    `${n} file${n === 1 ? "" : "s"} here would not load, so ${act} would stand over a corpus that is missing part of itself`,
    [
      ...corpus.broken.map((b) => `${b.file.split("/").pop() ?? b.file} — ${b.why.split("\n")[0]}`),
      "nothing has been recorded — fix the file and run it again",
    ]
  );
};

const gatesOf = (consent: Consent, corpus: Corpus, what: string): Refused | null =>
  ifBroken(corpus, what) ?? requireName(consent.by) ?? requireVia(consent.via);

// ---------------------------------------------------------------------------
// What you are agreeing to, computed WITHOUT writing.

/**
 * ⛔ SEPARATE FROM `perform`, SO THERE IS A POINT AT WHICH A PERSON CAN DECLINE.
 *
 * A reviewer's finding, confirmed: *"`accept` writes the stamp in the same breath as printing
 * what is being agreed to, and `read` prints nothing at all — there is no point at which a
 * person can decline."* On a CLI that was structural; the text scrolled past as the write
 * landed. A page shows this before the button exists, and an option in a question carries it
 * in the choice itself.
 */
export function preview(dir: string, act: Act, payload: Payload): { ok: true; reads: string[] } | Refused {
  const corpus = loadCorpus(dir);
  const broken = ifBroken(corpus, "a preview");
  if (broken) return broken;

  if (act === "accept") {
    const { target } = payload as AcceptPayload;
    const aim = aimOf(corpus, target);
    if ("ok" in aim) return aim;
    const c = coveredBy(corpus, target);
    if (!c) return no(`no exchange or rule "${target}"`);
    return { ok: true, reads: c.reads };
  }

  if (act === "read") {
    const { scope } = payload as ReadPayload;
    if (!corpus.scopes.some((s) => s.scope.id === scope)) return no(`no scope "${scope}"`);
    const qs = questionsFor(corpus, scope);
    const open = qs.filter((q) => !q.parked);
    const parked = qs.filter((q) => q.parked);
    return {
      ok: true,
      reads: [
        ...(open.length ? [`${open.length} unanswered: ${open.map((q) => q.ref).join(", ")}`] : []),
        ...(parked.length ? [`${parked.length} parked: ${parked.map((q) => q.ref).join(", ")}`] : []),
        ...(!open.length && !parked.length ? ["nothing here is undecided"] : []),
      ],
    };
  }

  const ref = (payload as WaivePayload | DeferPayload | RulePayload).slot;
  const target = resolveRef(corpus, ref);
  if ("error" in target) return no(target.error);
  return {
    ok: true,
    reads: [
      target.unsettled ? `unsettled: ${ref}` : `already settled — ${nothingToDecide(target)}`,
      ...(target.standing?.question ? [flat(target.standing.question)] : []),
    ],
  };
}

/**
 * ⛔ THROUGH THE RESOLVER, LIKE EVERY OTHER VERDICT — this was the one that was not, and
 * `coveredBy` truncated rather than refusing.
 *
 * `v2 accept money#apply-a-standing-allowance#refuses#no-allowance-set` printed the whole
 * exchange, wrote a verdict at that four-segment target, and reported `✓`. `acts` still listed
 * the exchange as ready to accept. Then editing the exchange left `check` refusing at a ghost —
 * `acceptance-is-stale` on a target that can only ever be re-stamped as a ghost. **The one act
 * that makes tenet 1 real could be aimed at nothing, report success, do nothing, and leave the
 * corpus permanently refused** — and the refs a reviewer pastes are exactly the slot- and
 * case-grained ones `check` and `decide` print.
 */
function aimOf(corpus: Corpus, target: string): Refused | { kind: string } {
  const aim = resolveRef(corpus, target);
  if ("error" in aim) return no(aim.error);
  if (aim.ref.kind !== "exchange" && aim.ref.kind !== "rule")
    return no(`${target} is a ${aim.ref.kind} — an acceptance covers one whole exchange, or one rule`, [
      aim.ref.kind === "slot" || aim.ref.kind === "case"
        ? `you are probably after the exchange: ${target.split("#").slice(0, 2).join("#")}`
        : "name an exchange as <scope>#<exchange>, or a rule by its id",
    ]);
  return { kind: aim.ref.kind };
}

// ---------------------------------------------------------------------------

export function perform(dir: string, act: Act, payload: Payload, consent: Consent): Outcome {
  switch (act) {
    case "accept":
      return doAccept(dir, payload as AcceptPayload, consent);
    case "rule":
      return doRule(dir, payload as RulePayload, consent);
    case "read":
      return doRead(dir, payload as ReadPayload, consent);
    case "waive":
      return doWaive(dir, payload as WaivePayload, consent);
    case "defer":
      return doDefer(dir, payload as DeferPayload, consent);
  }
}

function doAccept(dir: string, { target }: AcceptPayload, consent: Consent): Outcome {
  const { corpus, findings } = checkCorpus(dir);
  const bad = gatesOf(consent, corpus, "an acceptance");
  if (bad) return bad;

  const aim = aimOf(corpus, target);
  if ("ok" in aim) return aim;
  const c = coveredBy(corpus, target);
  if (!c) return no(`no exchange or rule "${target}"`);

  /**
   * ⛔ THE GATE, ENFORCED AT THE POINT OF THE ACT AND NOT ONLY IN A LIST.
   *
   * This comment described a gate for a while and the code below it did not implement one: it
   * filtered `severity === "refuse"`, and every unsettled standing is deliberately
   * `severity: "note"` so that writing a hard question down is not punished. So one command
   * stamped a human's name on an exchange whose `at_once` slot held an unanswered question, and
   * the exchange then left the queue in both directions — neither offered nor gated, so nobody
   * would meet it again.
   *
   * `gateFor` is the single predicate, shared with `acts`, so the list that declines to offer
   * something and the act that refuses to stamp it cannot disagree again.
   */
  const gate = gateFor(corpus, target);
  if (gate && !gate.ok) {
    /**
     * ⛔ `decide` TAKES A SCOPE, AND THIS OFFERED IT A RULE ID.
     *
     * `target.split("#")[0]` is the scope when the target is an exchange and the rule's own id when
     * it is a rule — so refusing to stamp a rule printed `productos v2 decide <rule-id>`, which
     * answers *no scope "<rule-id>"*. That is the third time a refusal here has printed a remedy
     * the tool then rejects, and each time it leaves hand-editing YAML as the only exit.
     *
     * A rule is settled by ruling the rule; a slot accusing one is settled by ruling that slot. Both
     * are offered, because which is right is the person's judgement and not ours.
     */
    const isRule = !target.includes("#");
    const accusers = gate.blocking
      .map((b) => /^(\S+#\S+#\S+) declares/.exec(flat(b.says))?.[1])
      .filter((x): x is string => !!x);
    return no(
      `${target} is not in a state to be accepted`,
      [
        ...gate.blocking.map((b) => `${b.slot.padEnd(9)} ${b.kind} — ${flat(b.says)}`),
        "a stamp on an unsettled claim reads exactly like a considered one, which is why this refuses rather than warns",
      ],
      isRule
        ? [
            { act: "rule", ref: target, why: "settle the rule itself" },
            ...accusers.map((a): Instead => ({ act: "rule", ref: a, why: "or settle the slot that contradicts it" })),
          ]
        : [{ act: "decide", ref: target.split("#")[0]!, why: "settle what is blocking it" }]
    );
  }

  /**
   * ⛔ Prefix-matched on a WORD BOUNDARY, not on `#`.
   *
   * `check` reports a criterion-level refusal at `money#see-a-balance criterion 1` — a space,
   * not a `#`. So `startsWith(target + "#")` missed it, and `check` saying "must not be handed
   * over" sat next to `v2 accept` exiting 0 on the same exchange.
   */
  /**
   * ⛔ `acceptance-is-stale` IS THE ONE FINDING THIS ACT EXISTS TO CLEAR.
   *
   * The blocking filter caught it along with everything else, so the first ordinary edit to
   * accepted truth bricked the corpus: `check` refused it, `accept` refused to re-accept it,
   * and the only exit was hand-deleting a human's verdict from the log.
   *
   * Re-accepting after a change is exactly the right act — the reviewer reads the new promise
   * and stamps that. The stamp is computed from the current content, so it cannot launder
   * anything.
   */
  const blocking = findings.filter(
    (f) =>
      f.severity === "refuse" &&
      f.kind !== "acceptance-is-stale" &&
      (f.where === target || (/^[#\s]/.test(f.where.slice(target.length)) && f.where.startsWith(target)))
  );
  if (blocking.length)
    return no(`${target} is not in a state to be accepted`, [
      ...blocking.map((b) => `${b.kind} ${b.what}`),
      "settle these first — a stamp on an unsettled claim reads the same as a considered one",
    ]);

  const was = stampFor(corpus, target);
  const rewrote = was.state !== "never" && was.state !== "accepted" ? staleReason(was) : undefined;

  writeVerdict(dir, "accepts.yaml", [
    `  - kind: accept`,
    `    target: ${target}`,
    `    by: ${consent.by}`,
    `    at: ${today()}`,
    `    via: ${consent.via}`,
    `    covers_slots: ${c.slots}`,
    `    covers_criteria: ${c.criteria}`,
  ]);
  return {
    ok: true,
    said: `accepted ${target}`,
    detail: [
      ...(rewrote ? [`re-accepted: ${flat(rewrote)}`] : []),
      "if any of what you read changes, check refuses this stamp rather than let it read as current",
    ],
  };
}

function doRule(dir: string, o: RulePayload, consent: Consent): Outcome {
  const corpus = loadCorpus(dir);
  const bad = gatesOf(consent, corpus, "a ruling");
  if (bad) return bad;

  // ⛔ One resolver. This act used to read `split("#")[2]` and therefore told a person that a
  // named case was "already settled (stated)" while `check` was reporting the same thing as
  // unruled — refusing to answer the corpus's own headline question.
  const target = resolveRef(corpus, o.slot);
  if ("error" in target) return no(target.error);

  /**
   * ⛔ SAYING WHICH RULE GOVERNS IS NOT A RULING, SO IT WORKS ON A SETTLED SLOT.
   *
   * This is where the loop dead-ended. `--pick 2` settled a slot, `check` then refused the
   * corpus with `displaces-a-rule-without-saying-so`, and the remedy the tool itself printed
   * came back "nothing to rule on, this is already settled". One action recorded a choice and
   * left a corpus that must not be handed over, with no second action available and hand-editing
   * YAML the only exit.
   */
  const onlyGovernance = (o.defersTo || o.insteadOf) && !o.says && !o.pick;
  if (!target.unsettled && !onlyGovernance)
    return no(`nothing to rule on at ${o.slot} — ${nothingToDecide(target)}`);

  if (onlyGovernance) {
    const g = govern(dir, o.slot, { defersTo: o.defersTo, insteadOf: o.insteadOf }, o.because);
    if (!g.ok) return no(g.why);
    writeVerdict(dir, "rulings.yaml", [
      `  - kind: rule`,
      `    settles: ${o.slot}`,
      `    by: ${consent.by}`,
      `    at: ${today()}`,
      `    via: ${consent.via}`,
      `    says: ${JSON.stringify(`${o.defersTo ?? o.insteadOf} ${o.defersTo ? "still holds here" : "does not hold here"}`)}`,
      `    because: ${JSON.stringify(o.because)}`,
    ]);
    return {
      ok: true,
      said: o.defersTo
        ? `${o.defersTo} still holds at ${o.slot}, and the sentence here narrows it`
        : `${o.insteadOf} does not hold at ${o.slot}, and the sentence here replaces it`,
      detail: [],
    };
  }

  /**
   * ⛔ `--stands "the other"` MEANS THIS SENTENCE LOSES, AND IT WAS WRITING IT IN.
   *
   * Ruling with "the other" — *the other one holds and this one does not* — wrote THIS one's
   * sentence into the slot, `check` reported nothing, the packet shipped the loser, and the
   * verdict log recorded the opposite. Strictly worse than before `resolves` existed, because
   * the record now contradicted the corpus in a person's name.
   */
  if (o.stands === "the other") {
    const others = (target.standing?.targets ?? []).filter((x) => x !== o.slot);
    return no(`"the other" says ${others.join(", ")} holds and ${o.slot} does not`, [
      "so this act cannot also write a sentence here — it would ship the side you just said loses",
      `rule the side that stands, naming this one: ${others.join(", ")} with stands: this`,
    ]);
  }
  if (target.standing?.kind === "disputed" && !o.stands) {
    const others = (target.standing.targets ?? []).filter((x) => x !== o.slot);
    return no(`${o.slot} is disputed with ${others.join(", ")} — say what happens to ${others.length === 1 ? "it" : "them"}`, [
      `stands: this        this sentence holds and ${others.join(", ")} does not`,
      `stands: the other   ${others.join(", ")} holds and this does not`,
      `stands: neither     both are wrong, and this ruling replaces both`,
      "the other side is still in the corpus and still accusing this one; without this it would go back into the accept queue with nothing recording the contradiction",
    ], others.map((x): Instead => ({ act: "rule", ref: x, why: "rule this side instead, naming the other" })));
  }

  const r = target.ref;
  const scopeId = r.kind === "slot" || r.kind === "case" ? r.scope : undefined;
  /**
   * ⛔ WHEN THE QUESTION IS `about` ONE ASPECT OF AN AGREED SENTENCE, THE RULING REPLACES THE
   * WHOLE SENTENCE — SO THE PERSON WRITES IT, AND SEES WHAT THEY ARE REPLACING.
   *
   * Picking on such a slot took the candidate — which answers the ASPECT — and made it the
   * entire `says`. A three-clause agreed promise was replaced by one clause; `check` then
   * refused two surviving criteria for over-asserting, and the clause with no criterion
   * vanished with no signal at all.
   */
  const residual =
    r.kind === "slot" && target.standing?.about
      ? corpus.scopes
          .find((s) => s.scope.id === r.scope)
          ?.scope.exchanges.find((e) => e.id === r.exchange)
          ?.slots[r.slot]
      : undefined;
  if (residual?.says) {
    const chosen = o.pick ? target.standing?.candidates?.[o.pick - 1] : undefined;
    if (o.pick && chosen?.replaces === "the whole sentence") {
      // ⛔ A candidate written as the WHOLE replacement sentence is pickable in one act — which
      // is the point. Only a fragment still needs the merged sentence written.
    } else if (o.pick && !o.says) {
      return no(`${o.slot} already says something, and only one thing about it is unruled`, [
        `it says:  ${flat(residual.says)}`,
        `unruled:  ${flat(target.standing!.about!)}`,
        "a ruling here becomes the whole sentence, so picking an option that answers only the unruled part would delete the rest",
        ...(target.standing!.candidates ?? []).map((c, i) => `${i + 1}. ${optionText(c)}`),
      ]);
    }
  }

  // ⛔ Picking is the load-bearing half elsewhere. Choosing a drafted answer is a different act
  // from composing one, and it is the act a reviewer can actually perform.
  let says = o.says;
  let pickedOutcomes: Array<{ name: string; when: string; told: string }> | undefined;
  let pickedNone: boolean | undefined;
  let chose: string | undefined;
  let optionSaid: string | undefined;
  let alsoConsidered = o.alsoConsidered;
  if (o.pick) {
    const q = questionsFor(corpus, scopeId!).find((x) => x.ref === o.slot);
    const c = q?.candidates[o.pick - 1];
    if (!c) return no(`no option ${o.pick} on ${o.slot}`);
    /**
     * ⛔ PICKING AND WRITING TOGETHER RECORDED THE ARGUMENT FOR THE OPTION NOT TAKEN.
     *
     * `pick 1` plus option 2's sentence wrote option 2 into the slot and option 1's argument
     * into `because` as the ruler's own reasoning — so the verdict log read, under a person's
     * name, the argument for the option that was not implemented. `check` reported nothing.
     */
    if (o.says)
      return no("picking takes an option as written; a sentence of your own is the other act", [
        `option ${o.pick} says: ${optionText(c)}`,
        "use one or the other — together they record the argument for an option you did not take",
      ]);
    // ⛔ A `refuses` option answers with named cases. Writing `says` there is a parse refusal,
    // which is why picking on that slot used to error on the command `decide` had just printed.
    says = c.says ?? optionText(c);
    pickedOutcomes = c.outcomes;
    pickedNone = c.none;
    /**
     * ⛔ THE OPTION'S ARGUMENT GOES IN ITS OWN FIELD, NOT INTO THE RULER'S `because`.
     *
     * This used to prepend the candidate's `consequence` to `because`, and the Verdict gate
     * parses whatever is in `because`. So a ruler typing "yes" cleared the forty-character
     * reasoning floor on a sentence a model drafted, and the log recorded that argument as the
     * person's own. The floor is the whole price of the strongest act in the schema.
     *
     * Keeping it is still necessary — a ruling deletes `standing.candidates`, and
     * `also_considered` records only the losers, so this is the chosen option's argument's only
     * remaining home. It is just not the ruler's.
     */
    chose = `option ${o.pick}`;
    optionSaid = c.consequence ? flat(c.consequence) : undefined;
    /**
     * ⛔ THE OPTIONS THAT LOST GO IN THE RECORD.
     *
     * Picking deleted the losing option from the corpus entirely — zero occurrences in the
     * truth file and zero in the verdict log. A decision whose alternatives have vanished gets
     * relitigated from scratch, which is the one thing the verdict log exists to prevent.
     */
    const lost = (target.standing?.candidates ?? [])
      .filter((_, i) => i !== o.pick! - 1)
      .map((x, i) => `option ${i + 1 >= o.pick! ? i + 2 : i + 1}: ${optionText(x)}${x.consequence ? ` — ${flat(x.consequence)}` : ""}`);
    if (lost.length && !alsoConsidered) alsoConsidered = lost.join(" | ");
  }
  if (!says) return no("say what it is — either pick an option or write the sentence");

  /**
   * ⛔ Validated before either side is written, so a ruling can never be half-recorded. The
   * floors live on the Verdict schema; this is the gate that applies them at the point of the
   * act, the same way acceptance gates there rather than only in a list.
   */
  const draft = Verdict.safeParse({
    kind: "rule",
    settles: o.slot,
    by: consent.by,
    at: today(),
    via: consent.via,
    says,
    because: o.because,
    ...(alsoConsidered ? { also_considered: alsoConsidered } : {}),
    ...(chose ? { chose } : {}),
    ...(optionSaid ? { option_said: optionSaid } : {}),
  });
  if (!draft.success)
    return no("that is not a ruling anybody could build from", draft.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`));

  // ⛔ Ruling an org-wide rule has to supply its demonstration in the same act. A decided rule
  // with no conformance criterion is an aspiration, which the schema refuses — and without a
  // way to say it the ruling was refused with nothing the person could do about it.
  if (target.ref.kind !== "rule" && o.then)
    return no("a demonstration belongs to an org-wide ruling, which owes its own", [
      "on a slot, what demonstrates it is a criterion on the exchange — add one there",
    ]);
  if (target.ref.kind === "rule" && !o.then)
    return no(`ruling ${o.slot} needs what would show this holding`, [
      "a rule that says something and demonstrates nothing is an aspiration, and it would reach every exchange its selector touches with nothing to check it against",
    ]);

  /**
   * ⛔ THE TRUTH IS WRITTEN FIRST, THEN THE VERDICT — never the other way round.
   *
   * Recording first left a verdict on file next to unchanged truth whenever the write was
   * refused, which is the exact limbo applying the ruling was meant to remove: the log says a
   * person decided, the corpus says nobody has, and `check` reports `ruled-but-not-written` at
   * somebody who did everything right.
   */
  const applied = settle(dir, o.slot, says, consent.by, today(), o.because, {
    defersTo: o.defersTo,
    insteadOf: o.insteadOf,
    then: o.then,
    refuses: o.refuses,
    outcomes: pickedOutcomes,
    none: pickedNone,
  });
  if (!applied.ok)
    return no(`that ruling cannot be written in: ${applied.why}`, [
      "nothing has been recorded — fix the slot or the ruling and run it again",
    ]);

  writeVerdict(dir, "rulings.yaml", [
    `  - kind: rule`,
    `    settles: ${o.slot}`,
    `    by: ${consent.by}`,
    `    at: ${today()}`,
    `    via: ${consent.via}`,
    `    says: ${JSON.stringify(says)}`,
    `    because: ${JSON.stringify(o.because)}`,
    // ⛔ The sentence this replaced, in the log. A revision is legitimate; losing what it
    // revised is how a corpus quietly stops meaning what somebody agreed to.
    ...(applied.replaced && applied.replaced !== flat(says) ? [`    replaced: ${JSON.stringify(applied.replaced)}`] : []),
    ...(chose ? [`    chose: ${JSON.stringify(chose)}`] : []),
    ...(optionSaid ? [`    option_said: ${JSON.stringify(optionSaid)}`] : []),
    ...(alsoConsidered ? [`    also_considered: ${JSON.stringify(alsoConsidered)}`] : []),
    ...(o.stands
      ? [
          `    resolves:`,
          ...(target.standing?.targets ?? [])
            .filter((x) => x !== o.slot)
            .flatMap((x) => [
              `      - target: ${x}`,
              `        stands: ${JSON.stringify(o.stands)}`,
              `        because: ${JSON.stringify(o.because)}`,
            ]),
        ]
      : []),
  ]);

  return {
    ok: true,
    said: `ruled ${o.slot}, and wrote it into the slot`,
    detail: [
      flat(says),
      ...(o.defersTo ? [`${o.defersTo} still holds here, and your sentence narrows it`] : []),
      ...(o.insteadOf ? [`${o.insteadOf} does not hold here, and your sentence replaces it`] : []),
      "the reasoning is in the verdict log, so this does not get relitigated from scratch",
    ],
    ...(applied.displaced.length && !o.defersTo && !o.insteadOf ? { displaced: applied.displaced } : {}),
  };
}

function doRead(dir: string, o: ReadPayload, consent: Consent): Outcome {
  const corpus = loadCorpus(dir);
  const bad = gatesOf(consent, corpus, "a read-through");
  if (bad) return bad;
  if (!corpus.scopes.some((s) => s.scope.id === o.scope)) return no(`no scope "${o.scope}"`);

  /**
   * ⛔ A person cannot record "I could build from this" over questions nobody has answered —
   * and the surface used to let them, because a container scope has no exchanges of its own so
   * every check passed vacuously.
   *
   * This is not paternalism about their judgement; it is that the claim is not well-formed.
   * "I read it and could build it" and "three things in it are unruled" cannot both be true,
   * and the stamp is the one thing in the corpus nothing else can reconstruct.
   */
  if (o.buildable) {
    /**
     * ⛔ A PARKED QUESTION IS STILL A HOLE, so it blocks this claim too.
     *
     * Filtering parked questions out let a person defer one and then stamp "I could build from
     * it" over the same scope — while `packet` printed the deferral as an open hole. Two
     * records of one scope, disagreeing, and the stamp is the one nothing else can
     * reconstruct. Deferring is legitimate and stays legitimate; what it is not is an answer.
     * The act that says *a builder may decide this themselves* is `waive`, which is why that
     * one is charged an owner, a date and forty characters.
     */
    const qs = questionsFor(corpus, o.scope);
    const parked = qs.filter((q) => q.parked);
    if (parked.length)
      return no(
        `${o.scope} has ${parked.length} parked question${parked.length === 1 ? "" : "s"} — "I could build from this" and "we have not decided this" cannot both be true`,
        [
          ...parked.map((q) => `${q.ref} ${q.kind}`),
          "a parked question is still a hole, and the packet for this scope prints it as one",
        ],
        [
          ...parked.flatMap((q): Instead[] => [
            { act: "rule", ref: q.ref, why: "answer it" },
            { act: "waive", ref: q.ref, why: "grant the builder the latitude deliberately" },
          ]),
          { act: "read", ref: o.scope, why: "say you could NOT build from it, and what stopped you" },
        ]
      );
    const open = qs.filter((q) => !q.parked);
    if (open.length)
      return no(
        `${o.scope} has ${open.length} question${open.length === 1 ? "" : "s"} nobody has answered`,
        open.map((q) => `${q.ref} ${q.kind}`),
        [
          { act: "decide", ref: o.scope, why: "work through them, with what you need to answer each" },
          ...open.map((q): Instead => ({ act: "defer", ref: q.ref, why: "park it, with what brings it back" })),
          { act: "read", ref: o.scope, why: "say you could NOT build from it, and what stopped you" },
        ]
      );
  }

  const blocked = (o.blockedBy ?? []).map((s) => s.trim()).filter(Boolean);
  writeVerdict(dir, "reads.yaml", [
    `  - kind: read`,
    `    scope: ${o.scope}`,
    `    by: ${consent.by}`,
    `    at: ${today()}`,
    `    via: ${consent.via}`,
    `    buildable: ${o.buildable}`,
    ...(blocked.length ? [`    blocked_by: [${blocked.join(", ")}]`] : []),
    ...(o.note ? [`    note: ${JSON.stringify(o.note)}`] : []),
  ]);
  return {
    ok: true,
    said: `${consent.by} read ${o.scope} and ${o.buildable ? "could" : "could NOT"} build from it`,
    detail: o.buildable ? [] : ["this is the one signal nothing can compute — it now appears on every packet for this scope"],
  };
}

function doWaive(dir: string, o: WaivePayload, consent: Consent): Outcome {
  const corpus = loadCorpus(dir);
  const bad = gatesOf(consent, corpus, "a waiver");
  if (bad) return bad;
  const target = resolveRef(corpus, o.slot);
  if ("error" in target) return no(target.error);
  if (target.ref.kind !== "slot" && target.ref.kind !== "case")
    return no(`${o.slot} is not a slot — latitude is granted at one slot, not at a whole exchange`);

  const applied = applyWaiver(dir, o.slot, o.because, consent.by, today());
  if (!applied.ok)
    return no(`that waiver cannot be written in: ${applied.why}`, ["nothing has been recorded"]);
  writeVerdict(dir, "waivers.yaml", [
    `  - kind: waive`,
    `    target: ${o.slot}`,
    `    by: ${consent.by}`,
    `    at: ${today()}`,
    `    via: ${consent.via}`,
    `    because: ${JSON.stringify(o.because)}`,
  ]);
  return {
    ok: true,
    said: `waived ${o.slot} — the packet will tell a builder this is their latitude`,
    detail: [
      "recorded as your act, with your name on it, because this is a stronger claim than saying nobody knows",
    ],
  };
}

function doDefer(dir: string, o: DeferPayload, consent: Consent): Outcome {
  const corpus = loadCorpus(dir);
  const bad = gatesOf(consent, corpus, "a deferral");
  if (bad) return bad;
  const target = resolveRef(corpus, o.slot);
  if ("error" in target) return no(target.error);
  // ⛔ You can only park something unsettled. Parking a settled slot would write a record
  // saying a decision is pending when it is not, and nothing would contradict it.
  if (!target.unsettled) return no(`nothing to park at ${o.slot} — ${nothingToDecide(target)}`);

  const draft = Verdict.safeParse({
    kind: "defer",
    target: o.slot,
    by: consent.by,
    at: today(),
    via: consent.via,
    because: o.because,
    until: o.until,
  });
  if (!draft.success)
    return no("that is not a deferral anybody could act on", draft.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`));

  writeVerdict(dir, "deferrals.yaml", [
    `  - kind: defer`,
    `    target: ${o.slot}`,
    `    by: ${consent.by}`,
    `    at: ${today()}`,
    `    via: ${consent.via}`,
    `    because: ${JSON.stringify(o.because)}`,
    `    until: ${JSON.stringify(o.until)}`,
  ]);
  return {
    ok: true,
    said: `parked ${o.slot} — it stays unsettled and its exchange stays gated`,
    detail: [
      `back when: ${flat(o.until)}`,
      // ⛔ A date is a plan and plans rot: it is wrong the day it passes and nobody notices.
      ...(/^\d{4}-\d{2}-\d{2}$/.test(o.until)
        ? ["a date is weaker than an event — it is wrong the day it passes and nobody notices"]
        : []),
    ],
  };
}

export type { SlotName };
