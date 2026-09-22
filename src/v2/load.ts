/**
 * Reading an Exchange corpus off disk.
 *
 * Layout — ⛔ deliberately NOT path-as-id. In v1 a container's id was its path, which
 * produced stranded edges on every move and a container id that was not a routable link.
 * Here ids are slugs and the filename is a convenience, so re-filing is free and `move`
 * stops being a command that has to carry a graph.
 *
 *   truth/<slug>.md          one Scope — frontmatter + prose body (framing only, governs nothing)
 *   rules/<name>.md          one Rule per file
 *   readings/<slug>.yaml     observations. Never truth.
 *   verdicts/<slug>.yaml     a human's acts. Append-only. No machine writer.
 */
import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "../core/frontmatter.js";
import YAML from "yaml";
import { Scope, Rule, Reading, Verdict, Charter, type SlotName } from "./schema.js";

export interface V2Paths {
  root: string;
  truth: string;
  rules: string;
  readings: string;
  verdicts: string;
}

export function v2Paths(root: string): V2Paths {
  return {
    root,
    truth: path.join(root, "truth"),
    rules: path.join(root, "rules"),
    readings: path.join(root, "readings"),
    verdicts: path.join(root, "verdicts"),
  };
}

export interface Corpus {
  paths: V2Paths;
  scopes: Array<{ scope: Scope; body: string; file: string }>;
  /**
   * The product-wide documents — goals, principles, personas and the rest.
   *
   * ⛔ A SEPARATE LIST, not folded into a scope's prose, because each section is agreed to on its own
   * and prose has no addressable parts. See `Charter` in the schema for why they are not rules.
   */
  charter: Array<{ charter: Charter; body: string; file: string }>;
  rules: Array<{ rule: Rule; body: string; file: string }>;
  readings: Reading[];
  verdicts: Verdict[];
  /** Files that would not parse, with why. ⛔ Reported, never thrown — one malformed file
   *  crashing every command with a stack trace and no filename happened in v1. */
  broken: Array<{ file: string; why: string }>;
}

function readDir(dir: string, ext: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => ext.some((e) => f.endsWith(e)))
    .map((f) => path.join(dir, f))
    .sort();
}


/**
 * ⛔ A refusal a reader cannot act on is a refusal that gets worked around.
 *
 * Zod's `.message` is a JSON dump of the whole issue array; the first three lines of it are
 * `[`, `{`, `"code": "custom",` — which is what `check` was printing. Somebody looking at
 * that learns only that something is wrong somewhere in the file, so they go and edit until
 * it stops complaining. Path and message, one line each, or the mechanism is decorative.
 */
function why(e: unknown): string {
  const zerr = e as { issues?: Array<{ path: Array<string | number>; message: string }> };
  if (Array.isArray(zerr?.issues)) {
    return zerr
      .issues!.map((i) => `${i.path.length ? i.path.join(".") : "(root)"} — ${i.message}`)
      .join("; ");
  }
  return (e as Error).message.split("\n")[0]!;
}

export function loadCorpus(root: string): Corpus {
  const paths = v2Paths(root);
  const broken: Corpus["broken"] = [];
  const scopes: Corpus["scopes"] = [];
  const rules: Corpus["rules"] = [];
  const charter: Corpus["charter"] = [];

  for (const file of readDir(paths.truth, [".md"])) {
    if (path.basename(file).toLowerCase() === "readme.md") continue;
    try {
      const p = parseFrontmatter(fs.readFileSync(file, "utf-8"));
      scopes.push({ scope: Scope.parse(p.data), body: p.content.trim(), file });
    } catch (e) {
      broken.push({ file, why: why(e) });
    }
  }
  for (const file of readDir(paths.rules, [".md"])) {
    try {
      const p = parseFrontmatter(fs.readFileSync(file, "utf-8"));
      rules.push({ rule: Rule.parse(p.data), body: p.content.trim(), file });
    } catch (e) {
      broken.push({ file, why: why(e) });
    }
  }

  for (const file of readDir(path.join(paths.root, "charter"), [".md"])) {
    if (path.basename(file).toLowerCase() === "readme.md") continue;
    try {
      const p = parseFrontmatter(fs.readFileSync(file, "utf-8"));
      charter.push({ charter: Charter.parse(p.data), body: p.content.trim(), file });
    } catch (e) {
      broken.push({ file, why: why(e) });
    }
  }
  charter.sort((a, b) => (a.charter.order ?? 99) - (b.charter.order ?? 99));

  const readings: Reading[] = [];
  for (const file of readDir(paths.readings, [".yaml", ".yml"])) {
    try {
      const raw = YAML.parse(fs.readFileSync(file, "utf-8")) ?? {};
      for (const r of raw.readings ?? []) readings.push(Reading.parse(r));
    } catch (e) {
      broken.push({ file, why: why(e) });
    }
  }
  const verdicts: Verdict[] = [];
  for (const file of readDir(paths.verdicts, [".yaml", ".yml"])) {
    try {
      const raw = YAML.parse(fs.readFileSync(file, "utf-8")) ?? {};
      for (const v of raw.verdicts ?? []) verdicts.push(Verdict.parse(v));
    } catch (e) {
      broken.push({ file, why: why(e) });
    }
  }
  return { paths, scopes, rules, charter, readings, verdicts, broken };
}

// ---------------------------------------------------------------------------
// Rule resolution — which rules fill which slot on which exchange.

export interface Resolved {
  /** `<scope>#<exchange>#<slot>` → the `supplies` rule that IS the answer here, because
   *  nothing local said one. Empty where the exchange spoke for itself. */
  inherited: Map<string, Rule>;
  /** `<scope>#<exchange>#<slot>` → every `constrains` rule that adds a requirement here,
   *  ⛔ INCLUDING where the slot is stated locally. A stated slot does not escape a
   *  constraint; treating it as an escape is what made v1 principles decorative. */
  constrained: Map<string, Rule[]>;
  /** `<scope>#<exchange>#<slot>` → a `supplies` rule that would have answered a slot the
   *  author declared unsettled. ⛔ Neither wins silently: the org has an answer and the
   *  author says nobody does, and only a person can say which is stale. */
  contested: Map<string, Rule[]>;
  /** `<scope>#<exchange>#<slot>` → every `supplies` rule this slot's own sentence pushed
   *  aside. ⛔ Recorded whatever the local standing is, because the escape that mattered was
   *  the quiet one: an ordinary `says:` looked identical to a slot no rule had ever reached. */
  displaced: Map<string, Rule[]>;
  /** rule id → the exchange refs it reaches. ⛔ Needed to invert a selector and report a
   *  rule that governs nothing, which is the failure a v1 principle could not surface. */
  reach: Map<string, string[]>;
  /**
   * `<scope>#<exchange>#<slot>` → the UNSETTLED rules whose selector lands here and which would
   * fill it once somebody answers them.
   *
   * ⛔ THE DIFFERENCE BETWEEN 643 BLANKS AND 7 QUESTIONS, WHICH IS THE DIFFERENCE BETWEEN A
   * REVIEWABLE CORPUS AND A WALL.
   *
   * An unsettled rule was skipped before its selector was even evaluated, on the reasoning that
   * "a rule nobody has decided governs nothing, so the slots it would have filled read as the
   * blanks they are". That is right in a corpus where a blank is rare and wrong in every real one:
   * migrating a shipped product produced 643 slot-blanks that were SEVEN questions — what may
   * anyone ask, what do they bring, what does it refuse, and so on — asked once per exchange
   * because nothing could ask them once.
   *
   * A hole with one home is answerable. The same hole copied 88 times is noise, and noise is how
   * a reviewer stops reviewing.
   */
  awaiting: Map<string, Rule[]>;
}

export function resolveRules(c: Corpus): Resolved {
  const inherited = new Map<string, Rule>();
  const awaiting = new Map<string, Rule[]>();
  const constrained = new Map<string, Rule[]>();
  const contested = new Map<string, Rule[]>();
  const displaced = new Map<string, Rule[]>();
  const reach = new Map<string, string[]>();
  for (const { rule } of c.rules) reach.set(rule.id, []);

  for (const { scope } of c.scopes) {
    const ancestry = lineage(c, scope.id);
    for (const ex of scope.exchanges) {
      for (const { rule } of c.rules) {
        if (!selects(rule, scope, ex, ancestry, c)) continue;
        /**
         * ⛔ A rule nobody has decided still does not GOVERN — it supplies no sentence and nothing
         * inherits from it. What changed is that where it would have landed is now recorded, so the
         * hole can be reported once at the rule instead of once per slot. See `awaiting`.
         */
        if (rule.standing && rule.standing.kind !== "stated") {
          for (const filled of rule.fills) {
            const ref = `${scope.id}#${ex.id}#${filled}`;
            if (ex.excepts.some((x) => x.rule === rule.id)) continue;
            // Only where the exchange itself says nothing — a local sentence is an answer, and an
            // unsettled local standing is already reported on its own terms.
            if (ex.slots[filled] !== undefined) continue;
            awaiting.set(ref, [...(awaiting.get(ref) ?? []), rule]);
          }
          continue;
        }
        // ⛔ A rule answers a SET of slots now. A `constrains` rule about work in flight
        // genuinely lands on `answer` and on `fails`, and forcing one slot made the corpus
        // file a `fails` criterion under `answer`.
        for (const filled of rule.fills) {
        const ref = `${scope.id}#${ex.id}#${filled}`;
        // ⛔ An exception is itself a statement needing a reason, not a silent opt-out.
        // It is the ONLY way out of a rule, and it is the same way out for both modes.
        if (ex.excepts.some((x) => x.rule === rule.id)) continue;
        /**
         * ⛔ `reach` COUNTS WHERE A RULE ACTUALLY LANDS, NOT WHERE ITS SELECTOR POINTS.
         *
         * This is the number `acts` prints beside a rule as "how far one accept reaches" —
         * the one figure telling a reviewer how carefully to read before making the
         * highest-leverage decision in the corpus. It was incremented as soon as the
         * selector matched, so it counted exchanges that had excepted the rule and
         * exchanges whose own sentence displaced it: roughly double the truth, in the worst
         * possible place to be optimistic.
         *
         * A consequence worth keeping: a rule displaced everywhere it selects now reaches
         * zero and gets reported as governing nothing, which is exactly what has happened.
         */
        // ⛔ Once per exchange, not once per slot — a rule answering two slots of one
        // exchange reaches one exchange, and `acts` prints this as "how far one accept
        // reaches" to a person deciding how carefully to read.
        const lands = () => {
          const hit = reach.get(rule.id)!;
          const id = `${scope.id}#${ex.id}`;
          if (!hit.includes(id)) hit.push(id);
        };
        if (rule.mode === "constrains") {
          // ⛔ No stated-slot escape. Whatever this exchange answers, it answers THIS too.
          constrained.set(ref, [...(constrained.get(ref) ?? []), rule]);
          lands();
          continue;
        }
        /**
         * `supplies` fills an ABSENT slot and nothing else.
         *
         * ⛔ It used to fill anything not standing `stated`, which quietly resolved every
         * standing an author had gone out of their way to declare. A slot marked
         * `underdetermined` — the author saying "this has two builds, do not guess" —
         * rendered as the rule's answer, so the framework did the exact thing it exists to
         * prevent, and did it invisibly.
         *
         * An absent slot is silence, and silence is what a rule is for. Every other
         * standing is a sentence, and a rule does not overrule a sentence; where the two
         * disagree, `check` reports it as something a person must reconcile.
         */
        const local = ex.slots[filled];
        /**
         * ⛔ A RULE DEFERRED TO IS A RULE THAT GOVERNS, and it counted as reaching nothing.
         *
         * Writing the shared refusal vocabulary the schema advertises rules as the home for
         * produced `displaces-a-rule-without-saying-so` on two exchanges AND
         * `rule-governs-nothing / widen the selector, or delete it` on the rule itself.
         * Declaring the honest `defers_to` on both cleared the first two and left the third —
         * so the corpus still could not be handed over, and `acts` printed `0 exchanges`
         * beside it in the table whose only job is to show leverage.
         */
        if ((local?.defers_to ?? []).some((d) => d.rule === rule.id)) {
          constrained.set(ref, [...(constrained.get(ref) ?? []), rule]);
          lands();
          continue;
        }
        if (local !== undefined) {
          /**
           * ⛔ EVERY DISPLACEMENT IS RECORDED. Which one it is decides how it renders and
           * whether `check` refuses it, but none of them is silent any more.
           *
           * `out_of_scope` is here deliberately. "We deliberately do not answer this" while
           * an org-wide rule DOES answer it deletes the org guarantee rather than deferring
           * to it — a reviewer used it to remove idempotency from a money write, and the
           * identical button one row down still inherited it. Two contradictory answers to
           * one press, and nothing said so.
           */
          displaced.set(ref, [...(displaced.get(ref) ?? []), rule]);
          if (local.standing.kind !== "stated") {
            contested.set(ref, [...(contested.get(ref) ?? []), rule]);
          }
          continue;
        }
        inherited.set(ref, rule);
        lands();
        }
      }
    }
  }
  return { inherited, constrained, contested, displaced, reach, awaiting };
}

/**
 * Every scope whose vocabulary this one may use: its ancestry, plus what it declares it
 * rests on, transitively.
 *
 * ⛔ `depends_on` CARRIES VOCABULARY, OR THE CONTAINER GETS FORCED BACK INTO EXISTENCE.
 *
 * Terms flowed only down `in:`. So two sibling scopes sharing one word had three options:
 * duplicate it (a permanent `one-word-defined-twice` note), refuse to use it (`not-a-word-here`,
 * a refusal), or **invent a parent scope to hold it** — and that third one is
 * `capabilities/<system>/<promise>` reappearing in the vocabulary channel, an author made to
 * mint a container in order to file a thing. A reviewer followed the note's own fix text,
 * minted the container, and got a scope that compiles a packet with one glossary entry and
 * no promises.
 *
 * `depends_on` already meant "this rests on that" and contributed nothing anywhere. It is the
 * edge that should carry a word between siblings, and now does.
 */
export function vocabularyReach(c: Corpus, id: string): string[] {
  const seen = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const s = c.scopes.find((x) => x.scope.id === cur)?.scope;
    if (!s) continue;
    if (s.in) queue.push(s.in);
    for (const d of s.depends_on) queue.push(d);
  }
  return [...seen];
}

export function lineageOf(c: Corpus, id: string): string[] {
  return lineage(c, id);
}

function lineage(c: Corpus, id: string): string[] {
  const out: string[] = [];
  let cur = c.scopes.find((s) => s.scope.id === id)?.scope;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur.id);
    cur = cur.in ? c.scopes.find((s) => s.scope.id === cur!.in)?.scope : undefined;
  }
  return out;
}

export function selectsFor(
  rule: Rule,
  scope: Scope,
  ex: Exchangeish,
  ancestry: string[],
  c: Corpus
): boolean {
  return selects(rule, scope, ex, ancestry, c);
}

function selects(
  rule: Rule,
  scope: Scope,
  ex: Exchangeish,
  ancestry: string[],
  c: Corpus
): boolean {
  const s = rule.scope;
  // ⛔ Qualified only, and it no longer short-circuits the home test below — a named list was
  // a way past the containment check that `in:` exists to enforce.
  if (s.only && !s.only.includes(`${scope.id}#${ex.id}`)) return false;
  /**
   * ⛔ THE HOME TEST, AT THE TOP — it was written correctly and nested one block too deep,
   * inside `if (s.term)`. So a rule with no term reached every product in the corpus.
   */
  /**
   * ⛔ CONTAINMENT, NOT VOCABULARY REACH.
   *
   * `vocabularyReach` walks `depends_on`, so `Rule.in` — the field added to stop cross-product
   * leakage — was satisfied by a vocabulary edge. A separate root product declaring
   * `depends_on: [family-wallet]` had four slots supplied by the wallet's rules, and the
   * packet handed a volunteer at a school tuck shop *"Only a parent may change what a kid
   * has"*. Removing the line took that corpus from `0 blank` to four honest `slot-blank`
   * refusals.
   *
   * The asymmetry was visible one line down: `under:` already had a containment-only test and
   * `in:` did not, which is why the one rule scoped `under:` stayed out and all six scoped
   * `in:` leaked. Sharing a word is not being part of something.
   */
  const home = rule.in ?? s.under;
  if (home && !lineage(c, scope.id).includes(home)) return false;
  if (s.under && !ancestry.includes(s.under)) return false;
  if (s.asked_by && ex.asked_by !== s.asked_by) return false;
  if (s.tag && !tagsFor(c, scope, ancestry).includes(s.tag)) return false;
  // ⛔ Through the same resolver the rest of the corpus uses. A promise arriving on another
  // area's screen must be governed by the rules that screen's controls attract, or the
  // selector says one thing and the picture says another.
  const at = ex.at ? resolveView(c, scope, ex.at.view) : undefined;
  if (s.view_kind) {
    if (!at || at.view.view_kind !== s.view_kind) return false;
  }
  if (s.part_role) {
    const p = at?.view.parts.find((x) => x.id === ex.at?.part);
    if (!p || p.role !== s.part_role) return false;
  }
  /**
   * ⛔ `acts_on` MEANS TWO DIFFERENT THINGS AND THEY WERE CONFLATED.
   *
   * **With a term** it narrows which list the term must be in — "every exchange that CHANGES
   * money" as against "every exchange that merely reads it".
   *
   * **Without one** it is about the exchange itself: does it write anything at all.
   *
   * Conflating them meant `acts_on: reads` + a term ALSO required `changes` to be empty. So
   * adding one truthful line — `changes: [balance]` — made a read-authorization rule stop
   * SELECTING an exchange whose own sentence was *"Anybody holding the shared device may see
   * the family total, including a kid."* Nothing entered `displaced`, so
   * `displaces-a-rule-without-saying-so` could not fire and the author was never asked to
   * declare anything. **Being more truthful about the exchange removed the guard.**
   */
  if (!s.term) {
    if (s.acts_on === "reads" && ex.changes.length) return false;
    if (s.acts_on === "changes" && !ex.changes.length) return false;
  }
  if (s.term) {
    /**
     * ⛔ THE WORD HAS TO BE THE SAME WORD, not merely the same spelling.
     *
     * `term` matched any scope anywhere declaring that string, so a rule from one product
     * governed another product's exchanges. Term legality was already resolved through
     * `vocabularyReach`; reach was not. Both now resolve the same way: the rule's home has to
     * be able to see the scope, which is exactly what "the same word" means here.
     */

    // ⛔ `acts_on` narrows WHICH list the term has to be in, so "every exchange that
    // CHANGES money" is finally sayable and "every exchange that merely reads it" is too.
    const pool =
      s.acts_on === "reads" ? ex.reads : s.acts_on === "changes" ? ex.changes : [...ex.reads, ...ex.changes];
    /**
     * ⛔ A MEMBER OF A CLOSED TERM IS THAT TERM, and the selector matched by string equality.
     *
     * `Scope.terms.closed`/`members` declares a containment relation between words, read by
     * the vocabulary check, the packet and nothing that governs. So declaring
     * `money: {closed: true, members: [balance]}` and writing `changes: [balance]` — both
     * true — took an exchange that changes what a kid has clean out of every `term: money`
     * rule. Zero refusals; the grid printed bare ticks on `may` and `at_once` where every
     * other money-writing row reads `↑R6` and `↑R5`; the rules appeared in no `⊗` list, no
     * `≥` list and no note; `acts` offered it and `accept` stamped it.
     *
     * The same exchange's two TERM-LESS rules fired `displaces-a-rule-without-saying-so` and
     * charged a written reason each. Two identity models for one word with the load-bearing
     * one untyped — verbatim the failure `Rule.in`'s own comment says was fixed.
     */
    const members = (word: string): string[] => {
      const out = [word];
      for (const id of vocabularyReach(c, scope.id)) {
        const def = c.scopes.find((x) => x.scope.id === id)?.scope.terms[word];
        if (def?.closed) out.push(...(def.members ?? []));
      }
      return out;
    };
    if (!members(s.term).some((w) => pool.includes(w))) return false;
  }
  return true;
}

type Exchangeish = Scope["exchanges"][number];

function tagsFor(c: Corpus, scope: Scope, ancestry: string[]): string[] {
  const out = new Set<string>(scope.tags);
  for (const id of ancestry) {
    const s = c.scopes.find((x) => x.scope.id === id)?.scope;
    for (const t of s?.tags ?? []) out.add(t);
  }
  return [...out];
}

/** Every word a criterion on this slot is allowed to introduce. See check's §5.3 rule. */
/**
 * ⛔ Crude stemming, on purpose.
 *
 * Without it, a slot saying "not even that they exist" did not license a criterion saying
 * "the kid exists", and a scope declaring the term `parent` did not license "both parents".
 * Every one of those was reported as the criterion asserting something new, which is how a
 * detector that catches real over-assertion also becomes one nobody trusts.
 */
function stem(w: string): string {
  return w
    .replace(/[.,;:]+$/, "")
    .replace(/(ies)$/, "y")
    .replace(/(sses|shes|ches|xes)$/, "")
    .replace(/(ing|ed|es|s)$/, "");
}

export function permittedVocabulary(
  c: Corpus,
  scope: Scope,
  ex: Exchangeish,
  slot: SlotName,
  inheritedSays?: string,
  alsoSays: string[] = []
): Set<string> {
  const words = new Set<string>();
  const add = (s?: string) => {
    for (const w of (s ?? "").toLowerCase().split(/[^a-z0-9.%$-]+/)) {
      if (!w) continue;
      words.add(w);
      words.add(stem(w));
    }
  };
  const fill = ex.slots[slot];
  add(fill?.says);
  add(inheritedSays);
  /**
   * ⛔ Every rule that lands on this slot, `supplies` AND `constrains`.
   *
   * Only the supplying rule was admitted. So a criterion demonstrating conformance to
   * `empty-reads-as-empty` — *"then the figure reads as unset, not as zero"* — was refused
   * for introducing "unset" and "zero", the two words the rule it demonstrates is made of.
   * The corpus's own best criteria were the ones this rejected.
   */
  for (const s of alsoSays) add(s);
  add(fill?.within);
  for (const o of fill?.outcomes ?? []) {
    add(o.name);
    add(o.when);
    add(o.told);
  }
  add(fill?.cannot_fail);
  add(ex.title);
  /**
   * ⛔ The whole exchange, not this slot alone.
   *
   * One ask with one answer is one thought, and a criterion routinely reaches across it —
   * a `with` criterion says what is recorded, which is the `answer`'s word. Reading each
   * slot in isolation made ordinary paraphrase look like invention, while doing nothing
   * about the actual failure, which is a `then` naming things NO slot says.
   */
  for (const other of Object.values(ex.slots)) {
    add(other?.says);
    add(other?.cannot_fail);
    for (const o of other?.outcomes ?? []) {
      add(o.name);
      add(o.when);
      add(o.told);
    }
  }
  for (const id of vocabularyReach(c, scope.id)) {
    const s = c.scopes.find((x) => x.scope.id === id)?.scope;
    for (const [term, def] of Object.entries(s?.terms ?? {})) {
      add(term);
      // ⛔ The definition text too, not only the word. `money` is declared as "what a kid
      // has, and every ACT that changes it" — so a criterion saying "act" is using the
      // product's own declared vocabulary, and reporting it as an invention taught authors
      // to avoid the words their own glossary establishes.
      add(def.means);
      for (const m of def.members ?? []) add(m);
    }
  }
  /**
   * ⛔ ONLY THE PART THE ASK ARRIVES AT — not every part on the view.
   *
   * Admitting every label leaked the sketch into the permitted vocabulary: the row label
   * "Sat Tidy your room" licensed `sat`, `tidy`, `your` and `room` for criteria on every
   * slot of every exchange at that view. A drawing is not a promise, and it must not widen
   * what a criterion is allowed to assert.
   */
  const v = scope.views.find((x) => x.id === ex.at?.view);
  const p = v?.parts.find((x) => x.id === ex.at?.part);
  if (p) {
    add(p.id);
    add(p.label);
  }
  return words;
}

/**
 * ⛔ THE DISPUTE INDEX — the "by construction" the schema was claiming and did not have.
 *
 * `schema.ts` says a dispute "names every slot it cannot hold with, so it renders on all of
 * them by construction." There was no such construction: `check` iterated the declaring
 * slot's targets, the grid rendered the declaring cell, and nothing indexed back. So the
 * slot on the other side of the contradiction rendered a clean `✓` and compiled into the
 * packet as settled truth — and the builder handed that flow, plausibly not the same person,
 * implemented a sentence the corpus says cannot hold.
 *
 * This is what makes it symmetric: one pass, both directions, built once and read by
 * `check`, `grid` and `packet` so the three cannot drift apart.
 */
export function disputeIndex(c: Corpus): Map<string, Array<{ from: string; because: string }>> {
  const out = new Map<string, Array<{ from: string; because: string }>>();
  const put = (ref: string, from: string, because: string) =>
    out.set(ref, [...(out.get(ref) ?? []), { from, because }]);
  for (const { scope } of c.scopes) {
    for (const ex of scope.exchanges) {
      for (const slot of Object.keys(ex.slots) as SlotName[]) {
        const fill = ex.slots[slot]!;
        if (fill.standing.kind !== "disputed") continue;
        const here = `${scope.id}#${ex.id}#${slot}`;
        const because = fill.standing.because ?? "";
        put(here, here, because);
        for (const target of fill.standing.targets ?? []) {
          if (target === here) continue;
          put(target, here, because);
        }
      }
    }
  }
  return out;
}

/**
 * Resolve `at.view` to the view it names, anywhere in the corpus.
 *
 * ⛔ A VIEW HAD IDENTITY ONLY INSIDE ITS OWN SCOPE, WHICH FORCED GROUPING BY SCREEN.
 *
 * A promise that arrives on another area's screen had three exits and all of them were wrong:
 * naming the view bare was refused (`arrives-nowhere`), naming it qualified was refused too,
 * and declaring it on the shared ancestor was refused because views do not inherit. So the
 * only legal moves were re-filing the promise under whoever owns the screen — grouping by
 * screen rather than by what owns the promise, which is `capabilities/<system>/<promise>` one
 * level over — or DUPLICATING the view, which a reviewer did: zero refusals, two views with
 * the same id in two scopes, two different answers on one control, and
 * `one-press-two-answers` escaped entirely because it keys per scope.
 *
 * `<scope>#<view>` is the qualified form. A bare id still resolves locally first, so nothing
 * already written changes meaning.
 */
export function resolveView(
  c: Corpus,
  scope: Scope,
  ref: string
): { scope: string; view: Scope["views"][number] } | undefined {
  const local = scope.views.find((v) => v.id === ref);
  if (local) return { scope: scope.id, view: local };
  if (ref.includes("#")) {
    const [scopeId, viewId] = ref.split("#");
    const other = c.scopes.find((s) => s.scope.id === scopeId)?.scope;
    const v = other?.views.find((x) => x.id === viewId);
    if (other && v) return { scope: other.id, view: v };
    return undefined;
  }
  // An unqualified id that is not local: resolvable only if exactly one scope declares it,
  // so an ambiguous reference is an error rather than a coin toss.
  const hits = c.scopes.flatMap((s) => s.scope.views.filter((v) => v.id === ref).map((v) => ({ scope: s.scope.id, view: v })));
  return hits.length === 1 ? hits[0] : undefined;
}

/**
 * Whether a thing exists, reading through every container above it.
 *
 * ⛔ `exists` WAS READ ONE HOP, SO WITHDRAWING A CONTAINER DID NOTHING AT ALL.
 *
 * `exists: withdrawn` on the root scope produced `check` output byte-identical to pristine,
 * zero mentions of "withdrawn", all three exchanges still offered by `acts`, and an unchanged
 * packet — because the three sites that read it all did `ex.exists ?? scope.exists`, one hop.
 * Withdrawing a whole area of a product was a no-op.
 *
 * And the message on the finding that DID fire said "it is excluded from packets and from the
 * accept queue while it says this", which was false in both halves.
 */
export function existsOf(c: Corpus, scopeId: string, exchangeExists?: string): string {
  if (exchangeExists) return exchangeExists;
  for (const id of lineage(c, scopeId)) {
    const e = c.scopes.find((s) => s.scope.id === id)?.scope.exists;
    // `withdrawn` anywhere above wins: a promise inside a removed area is removed.
    if (e === "withdrawn") return "withdrawn";
    if (e === "intended") return "intended";
  }
  return "kept";
}

/**
 * Slots that genuinely cannot be answered until the answer is.
 *
 * ⛔ AND THE CONDITION, WHICH WAS WRONG IN THREE COPIES.
 *
 * The constant was written out separately in `check.ts`, `grid.ts` and `packet.ts`, and all
 * three fired on any non-`stated` standing. So an `answer` that STATES a full sentence and
 * carries only an `about` residual masked `refuses`, `fails`, `again` and `at_once`: a money
 * write went to `25 slots · 0 blank`, `check` exited 0, and the packet printed *"follows from
 * the answer above… Not a hole; not yours to fill"* three times, for slots nobody had said
 * anything about.
 *
 * The schema's own `about` comment says the opposite — a slot with `about` has an agreed
 * sentence, and what follows from it is knowable. The mask is for an answer with NO sentence.
 */
/**
 * ⛔ `after` IS DOWNSTREAM TOO. What an ask leaves behind cannot be stated by anyone who does not
 * yet know what the ask does — so while `answer` has no sentence at all, a blank `after` is the
 * consequence of that hole and not a second one. The mask fires only on a wholly unanswered
 * `answer`; a sentence with an unruled aspect leaves everything below it knowable.
 */
export const DOWNSTREAM_OF_ANSWER: SlotName[] = ["after", "refuses", "fails", "again", "at_once"];

export function answerIsUnknown(fill: { says?: string; standing: { kind: string } } | undefined): boolean {
  if (!fill) return false;
  const k = fill.standing.kind;
  if (k === "stated" || k === "out_of_scope") return false;
  // ⛔ A sentence is a sentence. An unruled thing ABOUT it does not make the rest unknowable.
  return !fill.says;
}
