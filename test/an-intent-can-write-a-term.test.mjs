/**
 * ⛔ A WORD HAS AN ADDRESS, SO AN ANSWER ABOUT A WORD HAS SOMEWHERE TO GO.
 *
 * Peter: *"why can't an intent write a term?"* — and the honest answer was that nothing had built
 * it. `settle.ts` had recorded the blocker as if it were a wall: *"the ref is `<scope>#<word>` and a
 * multi-word term is not one kebab-case segment"*. True of that shape, and it made a whole class of
 * act impossible: the glossary work could ASK *"is this one thing?"* and nothing could record the
 * answer. Same hole `#happy-path#<part>` had been dug out of an hour earlier.
 *
 * ⛔ `<scope>#term#<slug>`, WHICH IS THE GRAMMAR THAT ALREADY EXISTED. I reached for `term:<slug>`
 * first and `REF_PATTERN` refused it, correctly — a segment is kebab-case and a colon is not in it.
 * The convention was already here in `<scope>#<exchange>#shows#<id>`: a bare word naming what the
 * next segment is.
 *
 * ⛔ AND IT CREATES AT THE PRODUCT, because that IS the act the glossary needs — Peter, asked where
 * terms belong: **"One glossary, product-wide."** A word defined in one feature, moved UP to where
 * every feature reads it. Measured when he decided: 188 terms across 62 scopes, 0 at the product.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { resolveRef } = await import(path.resolve("dist/v2/ref.js"));
const { perform } = await import(path.resolve("dist/v2/acts.js"));

const corpus = () => {
  const dir = temp("pos-term-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the fixture does not load: ${c.broken.map((b) => b.why).join("; ")}`);
  return dir;
};

const root = (dir) => loadCorpus(dir).scopes.find((x) => !x.scope.in).scope.id;
const termsAt = (dir, id) => loadCorpus(dir).scopes.find((x) => x.scope.id === id).scope.terms ?? {};

const rule = (dir, ref, says) =>
  perform(
    dir,
    "rule",
    { slot: ref, says, because: "Peter said this word means one thing across the product, so it moves to the glossary where every feature reads it." },
    { by: "peter", via: "chat" }
  );

test("⛔ a word defined on a feature can be moved up to the product", () => {
  const dir = corpus();
  const top = root(dir);
  /** The seed defines its words on the root already, so move one DOWN first to have something to lift. */
  const anyWord = Object.keys(termsAt(dir, top))[0];
  assert.ok(anyWord, "the seed root defines no words, so this test is measuring nothing");

  const MEANS = "What a kid currently has, counted the same way everywhere in this product.";
  const out = rule(dir, `${top}#term#${anyWord.replace(/[^a-z0-9]+/g, "-")}`, MEANS);
  assert.ok(out.ok, `the word could not be written: ${String(out.why).split("\n")[0]}`);

  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the written corpus does not load: ${c.broken.map((b) => b.why).join("; ")}`);
  assert.equal(termsAt(dir, top)[anyWord].means, MEANS);
});

test("⛔ a word nobody has ever written is refused — this is not a door for inventing vocabulary", () => {
  /**
   * ⛔ THE NON-SUCCESS. "A term was written" on its own is also what a door that accepts anything
   * produces. Authoring new vocabulary has its own route; this one moves a word that exists.
   */
  const dir = corpus();
  const x = resolveRef(loadCorpus(dir), `${root(dir)}#term#a-word-nobody-ever-wrote`);
  assert.ok("error" in x, "a word nobody defined resolved to an address");
  assert.match(x.error, /nothing defines a word/);
});

test("⛔ and a word cannot be defined as nothing, or re-stated to no purpose", () => {
  const dir = corpus();
  const top = root(dir);
  const word = Object.keys(termsAt(dir, top))[0];
  const ref = `${top}#term#${word.replace(/[^a-z0-9]+/g, "-")}`;

  assert.equal(rule(dir, ref, "   ").ok, false, "a word was emptied by ruling on it");
  const same = termsAt(dir, top)[word].means;
  assert.equal(rule(dir, ref, same).ok, false, "re-stating the same definition counted as a change");
});

test("⛔ the ref is the grammar that already existed — `term:` is refused, `#term#` resolves", () => {
  /**
   * ⛔ `REF_PATTERN` CAUGHT MY FIRST SHAPE AND IT WAS RIGHT. A segment is kebab-case; a colon is
   * not in it. `<scope>#<exchange>#shows#<id>` had already established how to name what a segment
   * is, and a second spelling for the same idea is a grammar nobody can hold in their head.
   */
  const dir = corpus();
  const top = root(dir);
  const word = Object.keys(termsAt(dir, top))[0].replace(/[^a-z0-9]+/g, "-");

  const good = resolveRef(loadCorpus(dir), `${top}#term#${word}`);
  assert.ok(!("error" in good), `the documented shape does not resolve: ${good.error ?? ""}`);
  assert.equal(good.ref.kind, "term");

  const colon = resolveRef(loadCorpus(dir), `${top}#term:${word}`);
  assert.ok("error" in colon, "a colon-spelled term ref resolved, so there are two grammars");
});
