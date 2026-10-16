/**
 * ⛔ A TICKET IS A SENTENCE IN SOMEBODY ELSE'S WORDS, AND IT HAS TO REACH A REF.
 *
 * The usability review's fourth finding: *"The only entry point is `productos_exchange_scopes`, a
 * tree of ids, titles and counts. There is no search over claims, screens or terms, so mapping
 * 'parents can record spending larger than the balance' to `money#record-spending#after` is left to
 * the agent's guesswork."*
 *
 * That exact query is the first test here, against the seed corpus it was run on, and it asserts
 * the exact ref the review named. The rest assert the three properties without which the search is
 * a worse version of the tree it replaces: every hit is an address something answers to, every hit
 * carries how established it is, and the order can be recomputed by hand from what comes back.
 *
 * ⛔ THE REAL SEED, NOT A BAG OF LISTS. `levelOf` runs through `stampFor`, which hashes the slots
 * and criteria a ref actually has — so a synthetic corpus resolves to nothing and every level
 * answers the same thing, which is `v2-confidence`'s lesson paid for once already.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import("../dist/v2/load.js");
const { resolveRef } = await import("../dist/v2/ref.js");
const { levelOf } = await import("../dist/v2/level.js");
const { find, stem, WEIGHTS } = await import("../dist/v2/find.js");

const seeded = () => {
  const dir = temp("v2find-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return loadCorpus(dir);
};

/** The sentence the review itself could not map. */
const THE_TICKET = "parents can record spending larger than the balance";

test("the review's own ticket lands on the ref the review named", () => {
  const corpus = seeded();
  const r = find(corpus, THE_TICKET);

  assert.equal(r.hits[0].ref, "money#record-spending#after", `the review said this maps to money#record-spending#after; it came back ${r.hits.map((h) => h.ref).join(", ")}`);
  /** ⛔ All five words, and it is the only thing in the corpus that reaches all five. */
  assert.equal(r.hits[0].reached.length, 5);
  assert.equal(r.hits.filter((h) => h.reached.length === 5).length, 1);
  /**
   * ⛔ AND THE REF AN AGENT FEEDS TO THE PACKET IS SECOND. The five testing requirements of this
   * exchange each restate it in full, so without the own-words tie-break they reach four words
   * apiece on borrowed text and push the exchange off the first page.
   */
  assert.equal(r.hits[1].ref, "money#record-spending");
});

test("the hit says what is undecided about it, not merely that it matched", () => {
  const corpus = seeded();
  const top = find(corpus, THE_TICKET).hits[0];

  /**
   * ⛔ THE MVP'S WHOLE POINT. An agent holding this ticket must not start building: the sentence is
   * two drafted answers nobody has chosen between. `suggested` is the gate, and `because` is what
   * it pastes into the ticket.
   */
  assert.equal(top.level.level, "suggested");
  assert.equal(top.level.route, "drafted");
  assert.match(top.level.because, /larger than what the kid has/);

  /**
   * ⛔ AND THE SNIPPET IS THE QUESTION, NOT ONE OF THE THREE DRAFTED ANSWERS THAT RESTATE IT. The
   * answers between them matched more of the query, so picking the snippet the way the list is
   * ranked would have shown a candidate as though it were the claim.
   */
  assert.equal(top.snippet, "Is an amount larger than what the kid has taken off like any other, or refused?");
});

test("a ticket that touches two areas comes back with both", () => {
  const corpus = seeded();
  const r = find(corpus, "a kid looks at their own money and their own tasks", { limit: 40 });

  const features = new Set(r.hits.map((h) => h.ref.split("#")[0]));
  assert.ok(features.has("money"), `money is missing from ${[...features].join(", ")}`);
  assert.ok(features.has("tasks"), `tasks is missing from ${[...features].join(", ")}`);
  /** ⛔ And the org-wide rule that governs both, which is the thing a per-feature tree cannot show. */
  assert.ok(r.hits.some((h) => h.kind === "rule"), "no rule came back for a query about what a kid may see");
});

test("narrowing to one feature keeps the org-wide rules that fill it", () => {
  const corpus = seeded();
  const wide = find(corpus, "a kid may see their own money", { limit: 60 });
  const narrow = find(corpus, "a kid may see their own money", { limit: 60, under: "money" });

  assert.ok(narrow.searched < wide.searched, "narrowing searched just as much as not narrowing");
  assert.ok(narrow.hits.every((h) => !h.ref.startsWith("tasks")), "a ticket filed against money came back with tasks");
  /**
   * ⛔ AND THE RULE SURVIVES THE NARROWING. Every rule in the seed is filed on the root, because
   * `in:` is the vocabulary its selector is written in — so filtering rules the same way as
   * everything else answers `under: "money"` with nothing org-wide at all, losing the sentence that
   * supplies `may` on four of that feature's exchanges in full. That is the half a per-feature tree
   * already cannot show, which is the finding this command exists for.
   */
  assert.ok(
    narrow.hits.some((h) => h.ref === "only-a-parent-moves-money"),
    `the rule that fills money's "may" is missing: ${narrow.hits.map((h) => h.ref).join(", ")}`
  );
});

test("a ticket this product has never described says so, rather than returning the least-bad thing", () => {
  const corpus = seeded();
  const r = find(corpus, "shipment customs broker invoice");

  assert.deepEqual(r.hits, []);
  assert.equal(r.matched, 0);
  /**
   * ⛔ AN ANSWER, NOT AN EMPTY RESULT. A search that always returns five things teaches its caller
   * that the top one is relevant; an agent told nothing here says this proposes it instead of
   * going round again.
   */
  assert.match(r.nothing, /shipment, customs, broker, invoice/);
  assert.match(r.nothing, /propose/);
  /** It still reports what it looked at, so "nothing" cannot be a corpus that failed to load. */
  assert.ok(r.searched > 50, `only ${r.searched} things were searched`);
});

test("every hit is an address the corpus answers to", () => {
  const corpus = seeded();
  /** ⛔ Several queries, because the guarantee is about every grain and one query reaches a few. */
  const kinds = new Set();
  for (const q of [THE_TICKET, "a kid completes a task", "what does balance mean", "the spend form", "cancel", "allowance falls due", "what a parent may do"]) {
    for (const h of find(corpus, q, { limit: 50 }).hits) {
      kinds.add(h.kind);
      /**
       * ⛔ ONE OR THE OTHER, AND NEVER NEITHER. `resolveRef` has no grain for a screen and `levelOf`
       * does; `levelOf` refuses a feature as "holds facts rather than being one" and `resolveRef`
       * resolves it. A ref neither of them knows is an address this search invented, which is the
       * one failure that would make the whole command worse than the tree it replaces.
       */
      const byRef = resolveRef(corpus, h.ref);
      const byLevel = levelOf(corpus, h.ref);
      assert.ok(
        !("error" in byRef) || !("error" in byLevel),
        `${h.ref} (${h.kind}, for "${q}") resolves to nothing: ${byRef.error ?? ""} / ${byLevel.error ?? ""}`
      );
      /** ⛔ And where there is no level, it says why in `levelOf`'s own words rather than going quiet. */
      assert.ok(h.level || h.no_level, `${h.ref} came back with neither a level nor a reason for not having one`);
      if (h.level) assert.ok(h.level.because.length > 10, `${h.ref} has a level with no argument behind it`);
    }
  }
  /**
   * ⛔ AND THE FOUR THE REVIEW NAMED WERE ACTUALLY REACHED. Asserting every ref resolves proves
   * nothing if the walker only ever produced statements — the guarantee is about claims, screens,
   * rules and the product's own vocabulary.
   */
  for (const k of ["statement", "screen", "part", "rule", "term"]) assert.ok(kinds.has(k), `nothing of kind "${k}" was ever returned — it reached ${[...kinds].join(", ")}`);
});

test("the order can be recomputed by hand from what comes back", () => {
  const corpus = seeded();
  const r = find(corpus, THE_TICKET, { limit: 40 });

  for (const h of r.hits) {
    /** ⛔ `why` is the whole of the score — nothing is added that is not shown. */
    const summed = h.why.reduce((n, m) => n + m.weight * m.matched.length, 0);
    assert.equal(summed, h.score, `${h.ref} scores ${h.score} but its stated reasons add to ${summed}`);
    /** Every weight is one of the published entries, so the table and the output cannot drift. */
    for (const m of h.why) assert.equal(m.weight, m.context ? WEIGHTS["around it"] : WEIGHTS[m.field], `${h.ref} weighed ${m.field} at ${m.weight}`);
    /** ⛔ `reached` is the union of what the reasons say, so coverage is auditable too. */
    const union = new Set(h.why.flatMap((m) => m.matched));
    assert.deepEqual([...h.reached].sort(), [...union].sort(), `${h.ref} claims to have reached words its reasons do not name`);
  }

  /** ⛔ COVERAGE FIRST, ALONE AT THE TOP: nothing outranks something that matched more of the query. */
  for (let i = 1; i < r.hits.length; i += 1)
    assert.ok(
      r.hits[i - 1].reached.length >= r.hits[i].reached.length,
      `${r.hits[i].ref} reached ${r.hits[i].reached.length} words and sits below ${r.hits[i - 1].ref}, which reached ${r.hits[i - 1].reached.length}`
    );
});

test("the words around a thing strengthen a hit and never make one", () => {
  const corpus = seeded();
  /**
   * ⛔ WITHOUT THE FLOOR THIS QUERY RETURNS THE WHOLE FEATURE. Every slot, requirement and refusal
   * under `record-spending` carries its exchange's title, so all of them match "spent" — and a
   * search answering a four-word ticket with forty refs is the tree of ids with extra steps.
   */
  const r = find(corpus, "a kid spent", { limit: 60 });
  assert.ok(r.hits.length, "nothing came back at all");
  for (const h of r.hits)
    assert.ok(h.reached_own.length, `${h.ref} is a hit on nothing but the words around it`);
});

test("a snippet is never an id read back to a person", () => {
  const corpus = seeded();
  /**
   * ⛔ THE PROJECT RULE, ENFORCED WHERE IT BREAKS. `balance` matches the slug `see-a-balance` and
   * the word `balance`, and quoting either at a reader is the file-shaped leak the working rules
   * open on. The slug belongs in `ref`, which is for the agent.
   */
  const r = find(corpus, "balance", { limit: 20 });
  const ex = r.hits.find((h) => h.ref === "money#see-a-balance");
  assert.ok(ex, `the exchange about a balance did not come back: ${r.hits.map((h) => h.ref).join(", ")}`);
  assert.equal(ex.snippet, "Somebody looks at what a kid has");

  const term = r.hits.find((h) => h.kind === "term" && h.at === "balance");
  assert.ok(term, "the word itself did not come back");
  assert.match(term.snippet, /What a kid currently has/);
  /** ⛔ And a term has no grain of its own, so it says that rather than inventing an address. */
  assert.equal(term.ref, "family-wallet");
  assert.match(term.no_level, /holds facts rather than being one/);
});

test("the stemmer is crude in both directions, and says what it did", () => {
  /** ⛔ The only property that matters: the query and the corpus go through the same function. */
  for (const [a, b] of [
    ["records", "record"],
    ["recorded", "record"],
    ["recording", "record"],
    ["balances", "balance"],
    ["larger", "large"],
    ["stopped", "stopping"],
  ])
    assert.equal(stem(a), stem(b), `"${a}" and "${b}" do not meet`);

  /** ⛔ And it does not know irregular verbs, which is reported rather than approximated. */
  assert.notEqual(stem("spent"), stem("spending"));

  const corpus = seeded();
  const r = find(corpus, "parents recorded spending");
  assert.deepEqual(r.terms, [
    { word: "parents", as: "parent" },
    { word: "recorded", as: "record" },
    { word: "spending", as: "spend" },
  ]);
});
