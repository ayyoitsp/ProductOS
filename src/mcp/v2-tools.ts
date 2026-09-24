/**
 * ⛔ THE EXCHANGE MODEL, OVER MCP — INCLUDING THE FIVE ACTS, DELIBERATELY.
 *
 * A boundary test used to fail the build if any MCP tool could perform an act, on the reasoning
 * that *MCP is what a model reaches for unprompted*. It was opened on purpose: a person answering
 * in conversation, or pressing a button on a page Claude rendered for them, is the review loop
 * this product exists to make cheap, and neither can happen if only a CLI can record.
 *
 * **So the guarantee changed, and the replacement has to be real.** What is gone: "a model cannot
 * produce a verdict." What is here instead:
 *
 *   - `via` is REQUIRED on every act — which surface obtained the consent. Never defaulted, so
 *     the weakest provenance cannot silently wear the strongest name, and every reader surface
 *     prints it.
 *   - `by` is required and refuses placeholders. Recorded, never authenticated — as it always was.
 *   - the reasoning floors are charged against the HUMAN's own words, which is why picking an
 *     option files the drafter's argument in `option_said` instead of prepending it to `because`.
 *   - `check` still refuses a stamp whose content moved. That is the only defence here that never
 *     depended on trusting the caller, and it is unchanged.
 *
 * ⛔ AND NO TOOL HERE PERFORMS AN ACT ITSELF. Every one is a wrapper over `acts.perform`, the
 * single place the five acts exist. A handler with its own copy would be the `gateFor`/`check`
 * divergence again — one clause apart, invisible, in both directions.
 */
import { z } from "zod";
import path from "node:path";
import fs from "node:fs";
import type { ProductosPaths } from "../core/paths.js";
import { loadCorpus } from "../v2/load.js";
import { checkCorpus, summarise } from "../v2/check.js";
import { gridFor, renderGridText, actsFor, gateFor } from "../v2/grid.js";
import { compilePacket } from "../v2/packet.js";
import { questionsFor, descendants } from "../v2/settle.js";
import { decisionsUnder, howItWasDecided } from "../v2/record.js";
import { renderScopePage, standalone } from "../v2/page.js";
import { perform, preview, VIA, type Act, type Payload } from "../v2/acts.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown, paths: ProductosPaths) => Promise<unknown>;
}

/**
 * Where the corpus is.
 *
 * ⛔ Resolved the same way for every tool, and overridable, because a session may be pointed at a
 * pristine copy — the review loop is only trustworthy if it can be re-run from a known state.
 */
const AtDir = z.object({
  dir: z.string().describe("corpus directory; defaults to <repo>/v2").optional(),
});
const dirOf = (args: { dir?: string }, paths: ProductosPaths): string =>
  args.dir ? path.resolve(args.dir) : path.resolve(path.dirname(paths.productsDir), "..", "v2");

/** ⛔ Shared by every act, so no tool can omit one half of the provenance. */
const Consent = {
  by: z.string().describe("the person who decided — recorded, never authenticated, and it outlives the session"),
  via: z
    .enum(["page", "question", "chat", "cli", "agent"])
    .describe(
      "how their consent was obtained: page = they pressed a button on a rendered page showing what it covered; question = they chose from options in the question interface; chat = they answered in conversation; cli = they typed it. Never guess this — it is the record of HOW they agreed. ⛔ agent = NOBODY AGREED: software landed a default so a reviewer has something to disagree with rather than a blank. It never satisfies a gate and it never reads as agreement. Use it only when no person was asked, and never as a substitute for asking."
    ),
};

// Minimal local converter so this module does not depend on tools.ts internals.
function jsonSchemaOf(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, def] of Object.entries(schema.shape)) {
    let inner: z.ZodTypeAny = def;
    while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault) inner = inner._def.innerType;
    const s: Record<string, unknown> =
      inner instanceof z.ZodBoolean
        ? { type: "boolean" }
        : inner instanceof z.ZodNumber
          ? { type: "number" }
          : inner instanceof z.ZodArray
            ? { type: "array", items: { type: "string" } }
            : inner instanceof z.ZodEnum
              ? { type: "string", enum: inner.options }
              : { type: "string" };
    if (def.description) s.description = def.description;
    properties[key] = s;
    if (!def.isOptional()) required.push(key);
  }
  return { type: "object", properties, required, additionalProperties: false };
}

const tool = <T extends z.ZodObject<z.ZodRawShape>>(
  name: string,
  description: string,
  input: T,
  handler: (a: z.infer<T>, paths: ProductosPaths) => Promise<unknown> | unknown
): McpTool => ({
  name,
  description,
  inputSchema: jsonSchemaOf(input),
  handler: async (raw, paths) => handler(input.parse(raw ?? {}), paths),
});

// ===========================================================================
// READ — everything a model needs to hold a review conversation.
// ===========================================================================

const scopesTool = tool(
  "productos_exchange_scopes",
  "Every scope in the Exchange corpus as a tree, with how much each is holding: questions nobody has answered, and behaviours ready to agree to. Start here — this answers 'which feature should we look at next'.",
  AtDir,
  (a, paths) => {
    const dir = dirOf(a, paths);
    const corpus = loadCorpus(dir);
    const acts = actsFor(corpus);
    return {
      dir,
      broken: corpus.broken.map((b) => ({ file: b.file, why: b.why.split("\n")[0] })),
      scopes: corpus.scopes.map(({ scope }) => {
        const ids = descendants(corpus, scope.id);
        const qs = questionsFor(corpus, scope.id);
        return {
          id: scope.id,
          title: scope.title,
          in: scope.in ?? null,
          exchanges: scope.exchanges.length,
          open: qs.filter((q) => !q.parked).length,
          parked: qs.filter((q) => q.parked).length,
          ready_to_agree_to: acts.acceptable.filter((r) => ids.some((i) => r.startsWith(`${i}#`))).length,
        };
      }),
    };
  }
);

const questionsTool = tool(
  "productos_exchange_questions",
  "What is undecided in one scope and everything beneath it — each question, what it costs to guess wrong, the drafted options with the argument for each, what has actually been observed, and what else answering it would settle. This is what you present to a person; do not answer it for them.",
  AtDir.extend({ scope: z.string().describe("scope id") }),
  (a, paths) => {
    const dir = dirOf(a, paths);
    const corpus = loadCorpus(dir);
    if (!corpus.scopes.some((s) => s.scope.id === a.scope)) throw new Error(`no scope "${a.scope}"`);
    return { dir, scope: a.scope, questions: questionsFor(corpus, a.scope) };
  }
);

const gridTool = tool(
  "productos_exchange_grid",
  "What a scope behaviours and where each behaviour came from — one row per exchange, one column per slot, marked for said-here, inherited from an org-wide rule, deliberately unanswered, unsettled, or blank.",
  AtDir.extend({ scope: z.string() }),
  (a, paths) => {
    const dir = dirOf(a, paths);
    const corpus = loadCorpus(dir);
    const out = descendants(corpus, a.scope)
      .map((id) => gridFor(corpus, id))
      .filter((g): g is NonNullable<typeof g> => !!g && g.rows.length > 0)
      .map((g) => renderGridText(g));
    if (!out.length) throw new Error(`no scope "${a.scope}", or nothing beneath it behaviours anything`);
    return { dir, grid: out.join("\n\n") };
  }
);

const packetTool = tool(
  "productos_exchange_packet",
  "What a builder receives for one scope: every behaviour in full, the words the sentences use, what demonstrates each, the holes, and whether a human has read it end to end.",
  AtDir.extend({ scope: z.string() }),
  (a, paths) => {
    const dir = dirOf(a, paths);
    const p = compilePacket(loadCorpus(dir), a.scope);
    if (!p) throw new Error(`no scope "${a.scope}"`);
    return { dir, packet: p };
  }
);

const checkTool = tool(
  "productos_exchange_check",
  "What this corpus refuses and what it merely notes. Run it before asking anyone to review, and never work around a refusal — if one has no honest answer, that is a finding about the model and worth saying so.",
  AtDir,
  (a, paths) => {
    const dir = dirOf(a, paths);
    const { corpus, findings } = checkCorpus(dir);
    return {
      dir,
      summary: summarise(findings),
      refuses: findings.filter((f) => f.severity === "refuse"),
      notes: findings.filter((f) => f.severity === "note"),
      shape: findings.filter((f) => f.severity === "shape"),
    };
  }
);

const recordTool = tool(
  "productos_exchange_record",
  "Every act of human judgement recorded against a ref or anything beneath it — who, when, HOW their consent was obtained, what was chosen, the argument for it, and the options that lost. Read this before re-opening a settled question: it exists so decisions are not argued again from nothing.",
  AtDir.extend({ ref: z.string().describe("a scope, an exchange, a slot, or a rule id") }),
  (a, paths) => {
    const dir = dirOf(a, paths);
    const ds = decisionsUnder(loadCorpus(dir), a.ref);
    return { dir, ref: a.ref, decisions: ds.map((d) => ({ ...d, how: howItWasDecided(d) })) };
  }
);

const pageTool = tool(
  "productos_exchange_page",
  "Render one scope as a self-contained HTML page a person can read — the questions with their options, the grid, every behaviour in full, and what was already decided. Write it to a file and show it to them; it is read-only unless served, so the acts on it are visibly inert.",
  AtDir.extend({
    scope: z.string(),
    out: z.string().describe("file path to write the HTML to").optional(),
  }),
  (a, paths) => {
    const dir = dirOf(a, paths);
    const corpus = loadCorpus(dir);
    const page = renderScopePage(corpus, a.scope);
    if (!page) throw new Error(`no scope "${a.scope}"`);
    const title = corpus.scopes.find((s) => s.scope.id === a.scope)?.scope.title ?? a.scope;
    const doc = standalone(title, page);
    if (!a.out) return { dir, html: doc };
    const full = path.resolve(a.out);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, doc);
    return { dir, wrote: full, bytes: doc.length };
  }
);

const whatItCoversTool = tool(
  "productos_exchange_what_it_covers",
  "What a person would be agreeing to, computed without recording anything. Show them this BEFORE asking them to agree — an acceptance used to print what it covered in the same breath as writing it, which left no point at which anybody could decline.",
  AtDir.extend({
    act: z.enum(["accept", "rule", "read", "waive", "defer"]),
    ref: z.string().describe("for accept: scope#exchange or a rule id. for read: a scope. otherwise: scope#exchange#slot"),
  }),
  (a, paths) => {
    const dir = dirOf(a, paths);
    const payload = (a.act === "accept" ? { target: a.ref } : a.act === "read" ? { scope: a.ref, buildable: false } : { slot: a.ref, because: "" }) as Payload;
    return { dir, ...preview(dir, a.act as Act, payload) };
  }
);

const gateTool = tool(
  "productos_exchange_can_be_agreed_to",
  "Whether one exchange or rule is in a state to be agreed to, and if not, exactly what is blocking it. A stamp on an unsettled claim reads identically to a considered one, which is why this refuses rather than warns.",
  AtDir.extend({ ref: z.string().describe("scope#exchange, or a rule id") }),
  (a, paths) => {
    const dir = dirOf(a, paths);
    const g = gateFor(loadCorpus(dir), a.ref);
    if (!g) throw new Error(`no exchange or rule "${a.ref}"`);
    return { dir, ref: a.ref, ...g };
  }
);

// ===========================================================================
// THE FIVE ACTS. Each requires `by` and `via`; each is a wrapper over `perform`.
// ===========================================================================

const act = <T extends z.ZodObject<z.ZodRawShape>>(
  name: string,
  description: string,
  input: T,
  toPayload: (a: z.infer<T>) => { act: Act; payload: Payload }
): McpTool =>
  tool(name, description, input.extend(Consent).merge(AtDir), (a, paths) => {
    const { act: which, payload } = toPayload(a as z.infer<T>);
    const dir = dirOf(a as { dir?: string }, paths);
    const via = (a as { via: (typeof VIA)[number] }).via;
    const r = perform(dir, which, payload, { by: (a as { by: string }).by, via });
    /**
     * ⛔ A refusal is RETURNED, not thrown, because it carries what to do instead — and the
     * caller is about to present those options to a person. `server.ts` turns a throw into a
     * bare message, which would drop them.
     */
    return { dir, ...r };
  });

const agreeAct = act(
  "productos_exchange_agree_to",
  "Record that a person has read one whole exchange, or one org-wide rule, and agrees to it. Show them what it covers first — call productos_exchange_what_it_covers. Refuses if anything in it is unsettled, because a stamp on an unsettled claim reads the same as a considered one.",
  z.object({ ref: z.string().describe("scope#exchange, or a rule id") }),
  (a) => ({ act: "accept", payload: { target: a.ref } })
);

const settleAct = act(
  "productos_exchange_settle",
  "Settle an unsettled slot with what a person decided. Either `pick` a drafted option by number OR write `says` yourself — never both: together they record the argument for an option that was not taken. `because` must be the PERSON'S reasoning in their own words, never an option's argument and never yours; it is what stops the decision being argued again.",
  z.object({
    slot: z.string().describe("scope#exchange#slot, scope#exchange#slot#case, or a rule id"),
    because: z.string().describe("the person's own reasoning, in their words"),
    pick: z.number().describe("choose drafted option N, as numbered by productos_exchange_questions").optional(),
    says: z.string().describe("the sentence they wrote, when no drafted option is right").optional(),
    stands: z.enum(["this", "the other", "neither"]).describe("required when the slot is disputed: which side holds").optional(),
    then: z.string().describe("required when settling an org-wide rule: what would show it holding").optional(),
    refuses: z.boolean().describe("for a case asking WHETHER it refuses at all; false retires the case").optional(),
    defersTo: z.string().describe("an org-wide rule that still holds here, which this sentence narrows").optional(),
    insteadOf: z.string().describe("an org-wide rule that does NOT hold here, which this sentence replaces").optional(),
    alsoConsidered: z.string().describe("what was rejected and why it lost; filled from the unpicked options if omitted").optional(),
  }),
  (a) => ({
    act: "rule",
    payload: {
      slot: a.slot,
      because: a.because,
      pick: a.pick,
      says: a.says,
      stands: a.stands,
      then: a.then,
      refuses: a.refuses,
      defersTo: a.defersTo,
      insteadOf: a.insteadOf,
      alsoConsidered: a.alsoConsidered,
    },
  })
);

const latitudeAct = act(
  "productos_exchange_grant_latitude",
  "Record that a person deliberately leaves one slot unanswered, so a builder decides it. A stronger claim than saying nobody knows, and priced accordingly — the reasoning has to be one a reader can weigh, because a builder is about to be told this is theirs. Do NOT use this to clear a question nobody has thought about; that is what parking is for.",
  z.object({ slot: z.string(), because: z.string().describe("why this is not ours to answer") }),
  (a) => ({ act: "waive", payload: { slot: a.slot, because: a.because } })
);

const parkAct = act(
  "productos_exchange_park",
  "Record that a person has read a question and is not answering it now. It stays unsettled, its exchange stays gated, and no packet can be built from it — parking is not an answer. `until` must be an event, not a date: a date is wrong the day it passes and nobody notices.",
  z.object({
    slot: z.string(),
    because: z.string().describe("why not now"),
    until: z.string().describe("what brings it back — an event"),
  }),
  (a) => ({ act: "defer", payload: { slot: a.slot, because: a.because, until: a.until } })
);

const readThroughAct = act(
  "productos_exchange_record_read_through",
  "Record that a person read a whole scope end to end and whether they could build from it. The one signal nothing can compute. `buildable: true` is refused while anything in it is unanswered OR parked — 'I could build this' and 'we have not decided that' cannot both be true.",
  z.object({
    scope: z.string(),
    buildable: z.boolean().describe("could they build from it, as it stands"),
    blockedBy: z.array(z.string()).describe("slot refs that stopped them, when they could not").optional(),
    note: z.string().optional(),
  }),
  (a) => ({
    act: "read",
    payload: { scope: a.scope, buildable: a.buildable, blockedBy: a.blockedBy, note: a.note },
  })
);

/** ⛔ Named so the act tools are identifiable as a group by anything auditing this surface. */
export const EXCHANGE_ACT_TOOLS: McpTool[] = [agreeAct, settleAct, latitudeAct, parkAct, readThroughAct];

export const EXCHANGE_READ_TOOLS: McpTool[] = [
  scopesTool,
  questionsTool,
  gridTool,
  packetTool,
  checkTool,
  recordTool,
  pageTool,
  whatItCoversTool,
  gateTool,
];

export const exchangeTools: McpTool[] = [...EXCHANGE_READ_TOOLS, ...EXCHANGE_ACT_TOOLS];
