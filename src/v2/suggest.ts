/**
 * The two small writes: one suggested claim, one raised question.
 *
 * ⛔ PETER: *"WRITE STRAIGHT INTO THE CORPUS as SUGGSTED. there is no 'HOLD' as a note state."*
 *
 * Before this, an agent grooming a piece of work had two ways to write back what it learned: the
 * `document` intent, which replaces a whole file in a schema no tool describes, and a `note`, which
 * is free text addressed to a person. The first is all or nothing and the second is not truth at
 * all. So adding one sentence meant fetching a whole feature, editing YAML by hand and sending it
 * back — and a question an agent noticed went into a note nobody's model could read.
 *
 * ⛔ STRAIGHT IN, AND IT IS STILL ONLY A SUGGESTION. What makes it safe to write without a person
 * is that nothing here can look agreed:
 *
 *  - a claim lands with `wrote: {hand: agent, as, from}`, so `levelOf` reports it `suggested` and
 *    `readiness` counts it as unagreed until a person stamps it. Adding it to a slot changes that
 *    slot's words, so any stamp on the slot goes stale — which is correct: nobody agreed to the
 *    new sentence.
 *  - a question lands as an `open` standing, which gates the exchange and puts it in the queue with
 *    its drafted answers. It is answered on the page by the person it is asked of.
 *
 * Neither writes a verdict, and neither takes a `via`.
 */
import fs from "node:fs";
import YAML from "yaml";
import { parseFrontmatter } from "../core/frontmatter.js";
import { Scope, SLOTS as SLOT_NAMES, type SlotName } from "./schema.js";
import { loadCorpus } from "./load.js";
import { claimHash, stampFor } from "./stamp.js";

export type Wrote = { ok: true; file: string; ref: string; said: string } | { ok: false; why: string; detail?: string[] };

const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * `<scope>#<exchange>#<slot>[#<case or statement>]`, read apart.
 *
 * ⛔ THE FOURTH SEGMENT IS NOT RESOLVED HERE, because what it means depends on the slot it lands
 * on and this function has only the string. `REF_MESSAGE` has always said it is "a named refusal
 * or one statement"; this file read it as a statement always. See `grainOf`.
 */
function slotRef(ref: string): { scope: string; exchange: string; slot: SlotName; part?: string } | { error: string } {
  const parts = ref.split("#");
  if (parts.length < 3 || parts.length > 4 || parts.some((p) => !p))
    return { error: `"${ref}" is not a slot — expected <scope>#<exchange>#<slot>, e.g. money#record-spending#after` };
  const [scope, exchange, slot, part] = parts;
  if (!(SLOT_NAMES as readonly string[]).includes(slot))
    return { error: `"${slot}" is not a slot — one of ${SLOT_NAMES.join(", ")}` };
  return { scope, exchange, slot: slot as SlotName, part };
}

/**
 * Which thing in a slot a four-segment ref addresses, and therefore WHERE a standing goes.
 *
 * ⛔ THIS IS fg-0002, AND THE BUG WAS A GUESS DRESSED AS A PARSE. `REF_MESSAGE` says the fourth
 * segment is "a named refusal or one statement"; `ref.ts` resolves it as either; this file assumed
 * statement and wrote `of:` on the SLOT. So two readers disagreed about one address:
 *
 * | | read `#already-paid` as | so it |
 * | --- | --- | --- |
 * | this file, writing | one statement of the slot | wrote the slot's standing, tagged `of:` |
 * | `ref.ts`, reading | a named refusal | read the REFUSAL's standing — which was empty |
 *
 * The question therefore went somewhere nothing asking that address would look: asked at
 * `payouts#pay-for-a-task#refuses#already-paid`, read back at the same ref, the answer was *"already
 * settled — it says what it is"*, with a live question carrying two candidates and a cost sitting
 * one level above it. `RefusalOutcome.standing` has existed the whole time, with its own validated
 * contract — the home was built and nothing could reach it.
 *
 * ⛔ AND A NAME THAT MATCHES NO CASE IS NOW AN ERROR NAMING THE CASES THERE ARE. Previously it
 * became `of: <whatever-was-typed>` with no complaint, so a typo produced a question filed against
 * a statement that does not exist — indistinguishable, on the page, from one correctly filed.
 */
function grainOf(
  fill: Record<string, unknown>,
  slot: SlotName,
  part: string | undefined
): { holder: Record<string, unknown>; isCase: boolean; statement?: string } | { error: string } {
  if (!part) return { holder: fill, isCase: false };
  if (slot === "refuses") {
    const outcomes = (Array.isArray(fill.outcomes) ? fill.outcomes : []) as Array<Record<string, unknown>>;
    const hit = outcomes.find((x) => x && x.name === part);
    if (hit) return { holder: hit, isCase: true };
    /**
     * ⛔ A refusal is named, never described — so `refuses` holds cases and not statements, and a
     * fourth segment here can only be meant as a case. Falling through to `of:` would file the
     * question against a statement the slot cannot have.
     */
    if (outcomes.length)
      return {
        error: `"${part}" is not one of the refusals here — ${outcomes.map((x) => `"${String(x.name)}"`).join(", ")}`,
      };
    return { error: `this refusal slot names no cases yet, so "${part}" addresses nothing — ask at the slot instead` };
  }
  return { holder: fill, isCase: false, statement: part };
}

/** Kebab-case from a sentence, so nobody is asked to invent an id for words they just wrote. */
const idFrom = (says: string): string =>
  says
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 5)
    .join("-") || "suggested";

interface Opened {
  file: string;
  data: Record<string, unknown>;
  content: string;
  slots: Record<string, Record<string, unknown>>;
}

function open(root: string, scope: string, exchange: string): Opened | { error: string } {
  const corpus = loadCorpus(root);
  const entry = corpus.scopes.find((s) => s.scope.id === scope);
  if (!entry) return { error: `no feature "${scope}" in this corpus` };
  const raw = parseFrontmatter(fs.readFileSync(entry.file, "utf-8"));
  const data = raw.data as Record<string, unknown>;
  const ex = ((data.exchanges ?? []) as Array<Record<string, unknown>>).find((x) => x.id === exchange);
  if (!ex) return { error: `no behaviour "${exchange}" in ${scope}` };
  ex.slots ??= {};
  return { file: entry.file, data, content: raw.content, slots: ex.slots as Record<string, Record<string, unknown>> };
}

/** ⛔ Validated as a whole feature before a byte is written, so a refusal leaves the file as it was. */
function save(o: Opened): { ok: true } | { ok: false; why: string; detail: string[] } {
  const parsed = Scope.safeParse(o.data);
  if (!parsed.success)
    return {
      ok: false,
      why: "the feature would not be valid with this in it, so nothing was written",
      detail: parsed.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`),
    };
  fs.writeFileSync(o.file, `---\n${YAML.stringify(o.data, { lineWidth: 96, blockQuote: "literal" })}---\n\n${o.content.trim()}\n`, "utf-8");
  return { ok: true };
}

/**
 * Add one sentence to a slot, as an agent's suggestion.
 *
 * ⛔ IT ADDS, NEVER REPLACES. A slot that already says something keeps every sentence it had, each
 * with the id and the authorship it had; the new one joins them. Rewording somebody's sentence is
 * a different act and goes through the page.
 */
export function suggestClaim(
  root: string,
  o: { ref: string; says: string; as: string; from: string; id?: string }
): Wrote {
  const r = slotRef(o.ref);
  if ("error" in r) return { ok: false, why: r.error };
  if (r.part) return { ok: false, why: "a suggestion is added to a slot, not to one of its statements — drop the last part of the ref" };
  if (r.slot === "refuses")
    return { ok: false, why: "`refuses` holds named refusals, not sentences", detail: ["raise it as a question with drafted outcomes instead (intent: ask)"] };
  const says = o.says.trim();
  if (says.length < 10) return { ok: false, why: "a statement nobody can read is not worth agreeing to — say it in a sentence" };
  if ((o.from ?? "").trim().length < 10)
    return { ok: false, why: "say what this was worked out from — the ticket, the transcript, the component", detail: ["a suggestion with no source is a worry, not something a person can check"] };
  const id = (o.id ?? "").trim() || idFrom(says);
  if (!SEGMENT.test(id)) return { ok: false, why: `"${id}" is not a statement id — one segment, kebab-case` };

  const f = open(root, r.scope, r.exchange);
  if ("error" in f) return { ok: false, why: f.error };
  const wrote = { hand: "agent", as: o.as, from: o.from.trim() };
  const fill = (f.slots[r.slot] ??= {});
  if (fill.none === true)
    return { ok: false, why: `${o.ref} says nothing happens here, so a sentence would contradict it`, detail: ["raise it as a question instead (intent: ask)"] };

  if (fill.says === undefined) {
    fill.says = says;
    fill.wrote = wrote;
  } else {
    /**
     * ⛔ A BARE SENTENCE BECOMES THE STATEMENT `it`, WHICH IS WHAT `statements()` ALREADY CALLS IT.
     * Its authorship moves down with it, so the slot's own `wrote` cannot fall through onto the new
     * sentence and report the agent's words as whoever wrote the first one.
     */
    const list: Array<Record<string, unknown>> = Array.isArray(fill.says)
      ? (fill.says as Array<Record<string, unknown>>)
      : [{ id: "it", says: fill.says, ...(fill.wrote ? { wrote: fill.wrote } : {}) }];
    if (!Array.isArray(fill.says)) delete fill.wrote;
    if (list.some((s) => s.id === id)) return { ok: false, why: `${o.ref} already has a statement "${id}" — give this one its own id` };
    list.push({ id, says, wrote });
    fill.says = list;
  }
  const saved = save(f);
  if (!saved.ok) return saved;
  const at = Array.isArray(fill.says) ? `${o.ref}#${id}` : o.ref;
  return { ok: true, file: f.file, ref: at, said: `suggested at ${at} — it reads as suggested until a person agrees to it` };
}

/**
 * Raise one question on a slot, with the answers drafted.
 *
 * ⛔ A QUESTION, NOT A DECISION. It sets the slot `open`, which gates the behaviour until the person
 * it is asked of picks an answer or writes their own. Whatever the slot already says stays; `about`
 * says which part of it is in question.
 */
export function raiseQuestion(
  root: string,
  o: {
    ref: string;
    question: string;
    asked_of: string;
    blocks: string[];
    cost?: string;
    about?: string;
    /** Say this question better, keeping its options and what it used to say. See the merge branch. */
    rephrase?: boolean;
    /** For a named refusal: which part of the case is in question. See `grainOf`. */
    asks?: "whether" | "when" | "told";
    candidates?: unknown[];
    by: string;
  }
): Wrote {
  const r = slotRef(o.ref);
  if ("error" in r) return { ok: false, why: r.error };
  const f = open(root, r.scope, r.exchange);
  if ("error" in f) return { ok: false, why: f.error };
  const fill = (f.slots[r.slot] ??= {});
  /**
   * ⛔ WHERE THE STANDING GOES IS RESOLVED AGAINST THE LOADED SLOT, NOT THE REF STRING — fg-0002.
   * A named refusal carries its own question; it is not a statement of the slot above it.
   */
  const g = grainOf(fill, r.slot, r.part);
  if ("error" in g) return { ok: false, why: g.error };
  /**
   * ⛔ A CASE NEEDS `asks` AND THE REFUSAL FOR IT IS WORTH MORE THAN A SCHEMA DUMP. The model
   * demands it because three different questions were being answered into one field — *"is this
   * refused at all?"* answered into `told` produced a user-facing message saying it is not refused.
   */
  if (g.isCase && !o.asks)
    return {
      ok: false,
      why: `a question on the refusal "${String(g.holder.name)}" has to say which part of it is in question`,
      detail: [
        "`asks: whether` — does it refuse in this case at all?",
        "`asks: when` — it refuses, but is this the right condition?",
        "`asks: told` — it refuses and the condition is right, but are these the words?",
        "⛔ without it a ruling is written into `told`, so answering \"is this refused at all?\" produces a refusal message saying it is not refused",
      ],
    };
  if (!g.isCase && o.asks)
    return {
      ok: false,
      why: "`asks` names which part of a NAMED REFUSAL is in question, and this ref does not address one",
      detail: ["on a slot or one of its statements, `about` is the field that says which part is unruled"],
    };
  const was = g.holder.standing as Record<string, unknown> | undefined;
  /**
   * ⛔ "ONE QUESTION PER SLOT" WAS NEVER A PRODUCT RULE — it was `SlotFill.standing` being one
   * object, and the refusal it produced said so as though it were a decision.
   *
   * Peter, on the two things it cost: *"per my original prompt - questions should seek to answer
   * MULTIPLE questions in an EFFICIENT manner. no idea why this limitation would exist"* and
   * *"again, one question per slot is not a requirement"*.
   *
   * Two separate failures came out of that one refusal, and they need different answers:
   *
   *  1. **A missing option could never be added.** A question drafted with two candidates was frozen
   *     at whatever its first drafter wrote. `ask` was the only route, it refused an open slot, and
   *     the refusal's own advice — *"reword the one that is there"* — is not an act anything
   *     implements. So a judge's finding became a question, and if one of its options was wrong
   *     nobody could fix it.
   *  2. **A second question about a DIFFERENT statement had nowhere to go.** An eleven-statement
   *     slot can hold eleven genuinely separate questions and could hold one, serialised for no
   *     product reason.
   *
   * ⛔ THIS FIXES (1) HERE AND REPORTS (2) HONESTLY. Adding to the question that is there is a
   * merge, which needs no new grain. Two questions at once needs a standing per STATEMENT — the
   * fourth grain, which `refineStanding` was built to make cheap — and that is a model change, not
   * a merge. Pretending otherwise by overwriting the first question would lose it silently, which
   * is worse than the limit.
   */
  if (was && was.kind && was.kind !== "stated") {
    /**
     * ⛔ A CASE IS ITS OWN GRAIN, so there is nothing to disambiguate: the standing found here
     * belongs to this refusal and no other. `of` keys sameness only among statements of one slot.
     */
    const sameThing = g.isCase || !g.statement || was.of === g.statement;
    /**
     * ⛔ A DIFFERENT STATEMENT IS A DIFFERENT QUESTION, and merging into the one that is there
     * would answer the wrong thing. Named as the gap it is rather than refused as a rule.
     */
    if (!sameThing)
      return {
        ok: false,
        why: `${o.ref} already carries a question about "${String(was.of)}", and this one is about "${g.statement}"`,
        detail: [
          "a slot holds one standing, so two questions about two statements cannot both sit here yet",
          "⛔ this is a limit of the model and not a rule about questions — recorded as a framework gap",
          "meanwhile: settle the one that is there, or ask this at the slot as a whole",
        ],
      };
    /**
     * ⛔ THE SAME QUESTION, WITH MORE ON THE TABLE. Candidates are appended, not replaced — a
     * drafter adding a third reading must not be able to delete the two a person has been weighing.
     * Everything else about the standing is left exactly as it was asked, including who owes it.
     */
    const have = Array.isArray(was.candidates) ? (was.candidates as unknown[]) : [];
    const adding = o.candidates ?? [];
    /**
     * ⛔ `blocks` ON AN EXISTING QUESTION — THE ACT THAT SAYS "THESE ARE ONE DECISION", AND THE ONE
     * THING THE INTERVIEWER COULD NOT DO.
     *
     * Peter, on being handed four questions where two were the same decision: *"the whole point of
     * the feature is to reduce the operator load. it could even be more than one question. that's
     * the intelligence we need from the interviewer."*
     *
     * `blocks` is the model's own way to say *"answering this settles that"*, and the worklist folds
     * questions that name each other into one item. But it could only be set when a question was
     * CREATED — so a role noticing afterwards that two existing questions are one had nowhere to
     * record it, and both kept their `blocks: []`, which positively asserts each settles nothing but
     * itself. Recorded as fg-0004 until now.
     *
     * ⛔ UNIONED, NEVER REPLACED, for the reason candidates are. A later reader adding a third ref
     * must not be able to drop the two already named, and `[]` is a real answer meaning "the rest
     * can ship without this" — so an empty list sent here adds nothing rather than erasing what is
     * there.
     *
     * ⛔ AND IT IS THE ONLY JUDGEMENT IN THIS FILE. Which questions are one decision cannot be
     * computed — it is a reading of what two sentences mean, which is why it is an author's act
     * recorded in a field and not a similarity score. See the worklist's fold for what it does with
     * the field once it is honest.
     */
    const alsoBlocks = (o.blocks ?? []).filter((b) => b !== o.ref);
    /**
     * ⛔ A REWORDING, WHICH IS THE THIRD THING THAT CAN BE ADDED TO A QUESTION ALREADY ASKED.
     *
     * The refusal below used to be the end of the road, and its own reason — *"a question somebody
     * has been weighing is not rewritten under them"* — is about being rewritten SILENTLY. So the
     * previous wording is kept rather than the question being frozen, and `was_asked` is what makes
     * that true instead of a promise.
     *
     * ⛔ EXPLICIT, NEVER INFERRED FROM A DIFFERENT STRING ARRIVING. A caller re-sending a question
     * it thinks is new must not quietly rewrite one somebody is weighing — that is the exact harm.
     * So rewording is a thing the caller ASKS for, and a `question` that differs without it is
     * still refused by the branch below.
     */
    const rewording = o.rephrase && o.question.trim() && o.question.trim() !== String(was.question ?? "").trim();
    if (rewording) {
      const before = String(was.question ?? "").trim();
      const history = Array.isArray(was.was_asked) ? (was.was_asked as string[]) : [];
      if (before) was.was_asked = [...history, before];
      was.question = o.question.trim();
      /** ⛔ The options are untouched. A rewording that changes the choice is not a rewording. */
    }
    if (!adding.length && !alsoBlocks.length && !rewording)
      return {
        ok: false,
        why: `${o.ref} is already ${was.kind}${was.question ? `: "${String(was.question).trim()}"` : ""}`,
        detail: [
          "it is already asked, so there are three things you can do: add another answer (`candidates`), name the other questions this one answer settles (`blocks`), or say it better (`rephrase: true` with the new `question`)",
          "⛔ a rewording keeps what it used to say in `was_asked` and leaves the options alone — somebody weighing it can see exactly what changed",
        ],
      };
    if (adding.length) was.candidates = [...have, ...adding];
    if (alsoBlocks.length) {
      const held = Array.isArray(was.blocks) ? (was.blocks as string[]) : [];
      was.blocks = [...new Set([...held, ...alsoBlocks])];
    }
    if (o.cost && !was.cost) was.cost = o.cost.trim();
    const savedMerge = save(f);
    if (!savedMerge.ok) return savedMerge;
    const said = [
      rewording ? "a better wording, with what it used to say kept" : "",
      adding.length ? `${adding.length} answer${adding.length === 1 ? "" : "s"}` : "",
      alsoBlocks.length ? `${alsoBlocks.length} question${alsoBlocks.length === 1 ? "" : "s"} this one settles` : "",
    ].filter(Boolean);
    return {
      ok: true,
      file: f.file,
      ref: o.ref,
      said: `added ${said.join(" and ")} to the question at ${o.ref}`,
    };
  }
  g.holder.standing = {
    kind: "open",
    question: o.question.trim(),
    ...(o.about ? { about: o.about.trim() } : {}),
    /** ⛔ `asks` on a case, `of` on a statement — never both, and never `of` on a case. */
    ...(g.isCase ? { asks: o.asks } : {}),
    ...(g.statement ? { of: g.statement } : {}),
    ...(o.candidates?.length ? { candidates: o.candidates } : {}),
    ...(o.cost ? { cost: o.cost.trim() } : {}),
    asked_of: o.asked_of,
    blocks: o.blocks,
    raised_by: o.by,
    asked_at: new Date().toISOString().slice(0, 10),
  };
  const saved = save(f);
  if (!saved.ok) return saved;
  return { ok: true, file: f.file, ref: o.ref, said: `asked at ${o.ref} — it is in ${o.asked_of}'s queue until they answer it` };
}

/**
 * Add one testing requirement to a claim, worked out from it as it now reads.
 *
 * ⛔ THE THIRD SMALL WRITE, AND THE ONE THE DEMONSTRATOR HAD NO WAY TO MAKE. Peter: *"make sure
 * appropriate test cases are being generated based on verified product truth"*. The demonstrator's
 * whole output is `criteria` with `derived.from` — and with the corpus hosted, the only way to
 * write one was the `document` intent, replacing a whole feature in YAML no tool describes, with a
 * hash the agent had to fetch and copy by hand.
 *
 * ⛔ THE HASH IS COMPUTED HERE, NEVER TAKEN FROM THE CALLER. `derived.from` is what decides whether
 * a test is current with its claim; a caller that supplied it could mark a test written against
 * yesterday's sentence as current with today's. The server hashes the claim it is about to attach
 * the requirement to, so the two cannot disagree at the moment of writing.
 *
 * ⛔ IT DOES NOT ASK WHETHER THE CLAIM IS AGREED. Peter: *"test cases should be generated too. they
 * should just carry an invalidated state"*. A requirement on a draft reads `suggested` (see
 * `requirementLevel`) and climbs to `derived` when somebody agrees to the claim — so writing it
 * early costs nothing and never hands a builder a test for an unagreed sentence.
 */
export function proposeRequirement(
  root: string,
  o: { ref: string; then?: string; given?: string; when?: string; steps?: string; level?: string; id?: string; by: string },
): Wrote {
  const r = slotRef(o.ref);
  if ("error" in r) return { ok: false, why: r.error };
  const then = (o.then ?? "").trim();
  const steps = (o.steps ?? "").trim();
  if (!then && !steps)
    return { ok: false, why: "a requirement needs a `then` (or `steps`) — otherwise nothing is demonstrated", detail: ["the last line has to be something somebody could observe being false"] };
  const LEVELS = ["unit", "integration", "api", "e2e"];
  if (o.level && !LEVELS.includes(o.level)) return { ok: false, why: `"${o.level}" is not a level — one of ${LEVELS.join(", ")}, or leave it off` };

  const corpus = loadCorpus(root);
  const from = claimHash(corpus, o.ref);
  if (!from) return { ok: false, why: `${o.ref} states nothing to demonstrate`, detail: ["a requirement is worked out from a claim — suggest the claim first (intent: suggest)"] };

  const f = open(root, r.scope, r.exchange);
  if ("error" in f) return { ok: false, why: f.error };
  const ex = ((f.data.exchanges ?? []) as Array<Record<string, unknown>>).find((x) => x.id === r.exchange)!;
  const criteria = ((ex.criteria ??= []) as Array<Record<string, unknown>>);
  const taken = new Set(criteria.map((c) => String(c.id)));
  const id = (o.id ?? "").trim() || String(Math.max(0, ...[...taken].map(Number).filter(Number.isFinite)) + 1);
  if (taken.has(id)) return { ok: false, why: `${r.scope}#${r.exchange} already has a requirement ${id} — ⛔ an id is stable, so a new requirement gets a new one` };

  criteria.push({
    id,
    slot: r.slot,
    /**
     * ⛔ STILL THE RAW SEGMENT HERE, AND DELIBERATELY UNCHANGED BY THE fg-0002 FIX. `Criterion.of`
     * is its own field with its own meaning, and whether a criterion may pin one named refusal is
     * a question about testing requirements, not about where a question goes. Changing it in the
     * same pass would be a guess — see the note left on fg-0002's closure.
     */
    ...(r.part ? { of: r.part } : {}),
    ...(o.given?.trim() ? { given: o.given.trim() } : {}),
    ...(o.when?.trim() ? { when: o.when.trim() } : {}),
    ...(then ? { then } : {}),
    ...(steps ? { steps } : {}),
    ...(o.level ? { level: o.level } : {}),
    derived: { by: o.by, at: new Date().toISOString().slice(0, 10), from },
  });
  const saved = save(f);
  if (!saved.ok) return saved;
  const at = `${r.scope}#${r.exchange}#shows#${id}`;
  const agreed = stampFor(loadCorpus(root), o.ref).state === "accepted";
  return {
    ok: true,
    file: f.file,
    ref: at,
    said: agreed
      ? `requirement ${at} demonstrates ${o.ref}, which somebody agreed to — it reads as derived`
      : `requirement ${at} demonstrates ${o.ref} — nobody has agreed to that claim yet, so it reads as suggested until somebody does`,
  };
}
