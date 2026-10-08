/**
 * ⛔ THE TOP OF A CORPUS CAN BE SIGNED OFF ON. NOTHING THERE COULD BE, AND THAT WAS THE WORST PLACE
 * FOR THE GAP TO BE.
 *
 * Peter, reading the product-wide documents: *"all the top level stuff should be able to be signed
 * off on."*
 *
 * He is describing tenet one, and it stopped at the feature boundary. On a real corpus: six
 * documents and twenty-six sections — every goal, every design principle, every persona, every
 * non-goal, every decision — and `resolveRef` answered *"not a rule or a scope here"* for all of
 * them. Zero accepts existed against any, and none could have been recorded.
 *
 * ⛔ Every slot in every feature is judged against that material. The gate that withholds a
 * feature's behaviours until its purpose is accepted — the one that exists so nobody spends stamps
 * on details of a purpose about to change — rested on goals nobody had ever put their name to.
 *
 * Three things have to hold together, and the middle one is the one that makes the other two
 * trustworthy: it resolves, **its text is hashed**, and the act accepts it. Without the hash an
 * accept would be permanent — and a stamp that can never go stale is worse than no stamp, because
 * it reads as current forever.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { loadCorpus } from "../dist/v2/load.js";
import { resolveRef } from "../dist/v2/ref.js";
import { stampFor } from "../dist/v2/stamp.js";

function corpus({ clash = false } = {}) {
  const dir = temp("v2top-");
  fs.mkdirSync(path.join(dir, "charter"), { recursive: true });
  fs.mkdirSync(path.join(dir, "truth"), { recursive: true });
  fs.writeFileSync(path.join(dir, "charter", "goals.md"), `---
id: goals
title: Product goals
sections:
  - id: one-place-for-the-truth
    title: One place for the truth
    says: Somebody looking for what the product promises finds it in one place and never in a chat log.
  - id: nobody-types-twice
    title: Nobody types the same thing twice
    says: A fact the product already knows is never asked for again, on any screen.
---
`);
  /** ⛔ A feature whose id collides with a document, to prove the ref refuses rather than picks. */
  fs.writeFileSync(path.join(dir, "truth", `${clash ? "goals" : "pay"}.md`), `---
id: ${clash ? "goals" : "pay"}
title: Pay somebody
exists: kept
happy_path:
  accomplishes: somebody sends money to a person they have paid before
  brings: who they are paying
  ends_with: the money has moved
  through: [the-form]
views: []
exchanges: []
---
`);
  return dir;
}

const cli = (dir, ...a) =>
  execFileSync("node", [path.resolve("dist/cli/index.js"), "v2", ...a, "--at", dir], { encoding: "utf-8" });

test("a section of a product-wide document resolves", () => {
  const c = loadCorpus(corpus());
  assert.deepEqual(c.broken, []);
  const r = resolveRef(c, "goals#one-place-for-the-truth");
  assert.ok(!("error" in r), `a goal could not be referred to: ${JSON.stringify(r)}`);
  assert.equal(r.ref.kind, "section");
});

/** ⛔ And says what the sections ARE when the name is wrong, rather than "no scope". */
test("a section that does not exist says which ones do", () => {
  const r = resolveRef(loadCorpus(corpus()), "goals#nope");
  assert.ok("error" in r);
  assert.match(r.error, /one-place-for-the-truth/, "it refuses without saying what was available");
});

/**
 * ⛔ A DOCUMENT ID IS ONE BARE SEGMENT — exactly the shape of a feature id. Picking one would make a
 * ref silently mean the other thing, which is the failure the case-versus-statement ordering in
 * `ref.ts` was written for and which cost a shipped corpus its unruled cases.
 */
test("a name owned by both a document and a feature is refused, not guessed", () => {
  const r = resolveRef(loadCorpus(corpus({ clash: true })), "goals#one-place-for-the-truth");
  assert.ok("error" in r, "a ref meaning two things resolved to one of them silently");
  assert.match(r.error, /both a product-wide document and a feature/);
});

test("a goal can be agreed to, and the agreement names who", () => {
  const dir = corpus();
  const out = cli(dir, "accept", "goals#one-place-for-the-truth", "--by", "a-person");
  assert.match(out, /accepted/);
  const st = stampFor(loadCorpus(dir), "goals#one-place-for-the-truth");
  assert.equal(st.state, "accepted");
  assert.equal(st.by, "a-person");
});

/**
 * ⛔ THE ONE THAT MAKES THE REST WORTH ANYTHING. An agreement to a goal must break the moment the
 * goal is reworded — otherwise the acceptance that every feature is judged against goes on standing
 * for a sentence nobody read, and nothing anywhere could tell.
 */
test("rewording the section breaks the agreement", () => {
  const dir = corpus();
  cli(dir, "accept", "goals#one-place-for-the-truth", "--by", "a-person");
  const f = path.join(dir, "charter", "goals.md");
  fs.writeFileSync(
    f,
    fs.readFileSync(f, "utf-8").replace("and never in a chat log", "and sometimes in a chat log, which is fine")
  );
  const st = stampFor(loadCorpus(dir), "goals#one-place-for-the-truth");
  assert.equal(st.state, "claim-changed", "a reworded goal still reads as agreed — the stamp is permanent, which is worse than absent");
  assert.equal(st.by, "a-person", "it forgot who had agreed, so there is nothing to go back to");
});

/** ⛔ A neighbouring section is untouched: these are agreed to one at a time, like every other atom. */
test("rewording one section leaves its neighbour's agreement standing", () => {
  const dir = corpus();
  cli(dir, "accept", "goals#nobody-types-twice", "--by", "a-person");
  const f = path.join(dir, "charter", "goals.md");
  fs.writeFileSync(f, fs.readFileSync(f, "utf-8").replace("never in a chat log", "nowhere else at all"));
  assert.equal(stampFor(loadCorpus(dir), "goals#nobody-types-twice").state, "accepted",
    "editing one section invalidated another's agreement, so a document is all-or-nothing after all");
});

test("the page offers the act where it renders the section", () => {
  const dir = corpus();
  const { renderScopePage } = globalThis.__page ?? {};
  void renderScopePage;
  /** Rendered through the CLI so this asserts on what a reader is actually served. */
  const out = path.join(dir, "p.html");
  cli(dir, "page", "pay", "--out", out);
  const html = fs.readFileSync(out, "utf-8");
  assert.match(html, /data-ref="goals#one-place-for-the-truth"/, "a goal is on the page with no ref, so nothing can act on it");
});
