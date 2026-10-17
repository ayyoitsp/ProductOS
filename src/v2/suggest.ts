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

export type Wrote = { ok: true; file: string; ref: string; said: string } | { ok: false; why: string; detail?: string[] };

const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `<scope>#<exchange>#<slot>[#<statement>]`, read apart. */
function slotRef(ref: string): { scope: string; exchange: string; slot: SlotName; statement?: string } | { error: string } {
  const parts = ref.split("#");
  if (parts.length < 3 || parts.length > 4 || parts.some((p) => !p))
    return { error: `"${ref}" is not a slot — expected <scope>#<exchange>#<slot>, e.g. money#record-spending#after` };
  const [scope, exchange, slot, statement] = parts;
  if (!(SLOT_NAMES as readonly string[]).includes(slot))
    return { error: `"${slot}" is not a slot — one of ${SLOT_NAMES.join(", ")}` };
  return { scope, exchange, slot: slot as SlotName, statement };
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
  if (r.statement) return { ok: false, why: "a suggestion is added to a slot, not to one of its statements — drop the last part of the ref" };
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
    candidates?: unknown[];
    by: string;
  }
): Wrote {
  const r = slotRef(o.ref);
  if ("error" in r) return { ok: false, why: r.error };
  const f = open(root, r.scope, r.exchange);
  if ("error" in f) return { ok: false, why: f.error };
  const fill = (f.slots[r.slot] ??= {});
  const was = fill.standing as Record<string, unknown> | undefined;
  if (was && was.kind && was.kind !== "stated")
    return {
      ok: false,
      why: `${o.ref} is already ${was.kind}${was.question ? `: "${String(was.question).trim()}"` : ""}`,
      detail: ["one question per slot — answer or reword the one that is there"],
    };
  fill.standing = {
    kind: "open",
    question: o.question.trim(),
    ...(o.about ? { about: o.about.trim() } : {}),
    ...(r.statement ? { of: r.statement } : {}),
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
