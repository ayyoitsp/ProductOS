/**
 * ⛔ A CAPABILITY REACHES A ROLE'S TOOL LIST AND ITS PROMPT, OR IT REACHES NOBODY.
 *
 * `ask-the-corpus` landed in the registry and the adapter together: twelve judges, nine read tools
 * each, resolved against the server this checkout registered, and a document printing the
 * capability beside every role that holds it. And not one prompt body said a word about it — so
 * every one of those reviewers would have opened a corpus by reading its files, exactly as before,
 * with nine tools in a list and no reason to prefer them. The surface the consumer path depends on
 * stays unexercised by the roles that know this model best, which was the entire argument for
 * handing it to them.
 *
 * ⛔ THIS IS THE MOST-MISSED LAYER AND IT HAS BEEN MISSED THE SAME WAY BEFORE. `instruct` is the
 * layer `framework-not-just-output` exists for: a schema field no skill names is a field that only
 * ever appears where somebody typed it by hand. That test walks the fields an *author* writes. A
 * capability is not a field, so nothing walked it — and a capability no prompt names is the same
 * defect wearing different clothes.
 *
 * ⛔ AND IT IS A TABLE, SO THE NEXT CAPABILITY CANNOT LAND HALF-REACHED EITHER. Every member of
 * `CAPABILITIES` must appear in `MUST_BE_NAMED` below, either with what counts as naming it or with
 * a reason it needs no prose. Adding one to the model forces that decision rather than leaving it
 * to be noticed later by a person.
 *
 * ⛔ WHAT THIS CANNOT CHECK is whether the prose is any good — which is why the pasted-block
 * assertion is here too. One paragraph copied into twelve files passes every check that counts
 * mentions, and it is the shape that rots: it cannot be right for all twelve, so it is edited for
 * none of them.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { AGENTS, AUTHORS, CAPABILITIES } from "../dist/core/jobs.js";
import { toolsFor } from "../dist/adapters/claude.js";

/** ⛔ A real registration, not the plain one: from a worktree the server is `productos-<slug>`. */
const SERVER = "productos-some-worktree";
const PREFIX = `mcp__${SERVER}__`;

/** The nine, by ProductOS's own name — read off the capability rather than listed again here. */
const READS = toolsFor(["ask-the-corpus"], SERVER)
  .filter((t) => t.startsWith(PREFIX))
  .map((t) => t.slice(PREFIX.length));

const ROLES = [...AGENTS, ...AUTHORS].filter((r) => r.prompt);
const bodyOf = (r) => fs.readFileSync(r.prompt, "utf-8");
const readsNamedIn = (text) => READS.filter((t) => text.includes(t));
/** ⛔ Prose wraps. A sentence split across two lines is the same sentence, and a line-anchored regex says it is not. */
const flat = (s) => s.replace(/\s+/g, " ").trim();

/**
 * The part of a prompt that is about asking the corpus: from the first read tool it names to well
 * past the last. ⛔ Scoped, because the assertions below are about what this section says — a
 * "never write anything" from somewhere else in the brief must not satisfy them.
 */
function corpusSection(text) {
  const hits = READS.flatMap((t) => {
    const i = text.indexOf(t);
    return i < 0 ? [] : [[i, i + t.length]];
  });
  if (!hits.length) return "";
  const from = Math.min(...hits.map(([a]) => a));
  const to = Math.max(...hits.map(([, b]) => b));
  return text.slice(Math.max(0, from - 400), Math.min(text.length, to + 700));
}

/**
 * What counts as a prompt having been told about a capability it holds.
 *
 * ⛔ `null` IS AN ANSWER AND NEEDS A REASON. Most capabilities are a host's ordinary tools; a brief
 * that says "read the corpus" has already told the role to use `Read`, and demanding the word would
 * buy nothing. The ones that need prose are the ones where the role would otherwise do the job a
 * worse way and never know — which is precisely `ask-the-corpus`, where the worse way is the way
 * every one of these roles already worked.
 */
const MUST_BE_NAMED = {
  "read-files": null, // every role has it, and every brief is already an instruction to read
  "search-files": null, // likewise — "grep it" appears in the briefs that want it
  "run-commands": null, // the briefs that need a command print the command
  "fetch-url": null, // the two roles holding it are told to read a URL, in those words
  "show-a-page": null, // the session's, not a subagent's; no prompt here declares it
  "see-a-page": null, // the briefs that hold it open with "bring the product up" and "look at both"
  "ask-the-human": null, // ⛔ no judge and no author may hold it — the prose about it is a refusal
  "write-corpus": null, // an author's whole brief is what to write; naming the tool adds nothing
  /**
   * ⛔ The one that must be in the prose, because a judge holding it has a working habit to break:
   * it has always read a corpus off disk, and nine tools appearing in its list give it no reason
   * to stop. The useful content is which question each read answers better than a grep does.
   */
  "ask-the-corpus": {
    named: (text) => readsNamedIn(text).length >= 2,
    want: "names at least two of ProductOS's read tools, and says what each answers that a file does not",
  },
};

test("every capability says whether a prompt has to name it", () => {
  for (const c of CAPABILITIES)
    assert.ok(
      c in MUST_BE_NAMED,
      `the capability "${c}" is in the model and this table has never decided whether a role holding it ` +
        `must be told so. Add it — with what counts as naming it, or with the reason it needs no prose.`
    );
  for (const c of Object.keys(MUST_BE_NAMED))
    assert.ok(CAPABILITIES.includes(c), `"${c}" is in this table and no longer a capability`);
});

test("a role that can ask the corpus is told what to ask, in its own prompt", () => {
  const asking = ROLES.filter((r) => r.needs.includes("ask-the-corpus"));
  assert.ok(asking.length >= 8, `only ${asking.length} roles declare ask-the-corpus — re-read the registry`);

  for (const r of asking) {
    const text = bodyOf(r);
    assert.ok(
      MUST_BE_NAMED["ask-the-corpus"].named(text),
      `"${r.name}" is handed ProductOS's nine read tools and ${r.prompt} never mentions them. It will ` +
        `read the corpus off disk like it always has, and the surface a consumer actually holds goes ` +
        `unexercised by the roles that know this model best. Write it the section: ` +
        MUST_BE_NAMED["ask-the-corpus"].want
    );
    /**
     * ⛔ NEVER THE PREFIX. It is per-checkout — `productos` in the main tree, `productos-<slug>` in
     * a worktree — so a prompt spelling out `mcp__productos__…` tells half the machines this is
     * developed on to call a tool that does not exist.
     */
    assert.doesNotMatch(
      text,
      /mcp__productos(-[a-z0-9-]+)?__/,
      `${r.prompt} spells a ProductOS tool with a server prefix. The prefix belongs to the install, ` +
        `and a hardcoded one is wrong in every checkout but the one it was written in.`
    );
  }
});

/**
 * ⛔ THE OTHER DIRECTION, AND THE NEWCOMER IS WHY IT MATTERS. A prompt naming a tool its role was
 * not handed is an instruction that fails halfway through a run; for the newcomer it is worse than
 * that — the capability is withheld so that nothing has told it what a scope or an exchange is
 * before it opens the URL, and a prompt naming `productos_exchange_scopes` leaks exactly that
 * through the one door the capability list closed.
 */
test("a role that cannot ask the corpus is not told to", () => {
  for (const r of ROLES.filter((r) => !r.needs.includes("ask-the-corpus"))) {
    const named = readsNamedIn(bodyOf(r));
    assert.deepEqual(
      named,
      [],
      `"${r.name}" does not hold ask-the-corpus and ${r.prompt} names ${named.join(", ")} — either the ` +
        `instruction is unrunnable, or, for the newcomer, it has just been told what ProductOS is.`
    );
  }
  const nc = AGENTS.find((a) => a.name === "newcomer");
  assert.ok(nc, "the newcomer is gone");
  assert.doesNotMatch(
    fs.readFileSync(nc.prompt, "utf-8"),
    /ask-the-corpus|productos_|MCP/i,
    "the newcomer's brief mentions ProductOS's own surface — a reviewer who has been told cannot detect that the page failed to tell them"
  );
});

/**
 * ⛔ PROSE THAT IS PRESENT AND USELESS PASSES EVERY MENTION-COUNTING CHECK. A `coherence` judge
 * asking whether a corpus contradicts itself wants different reads from a `coverage` judge asking
 * whether each claim is pinned by something that fails on its own. One block in twelve files cannot
 * be right for all twelve, so it gets maintained for none.
 */
test("what each judge is told to ask is its own, not one block pasted twelve times", () => {
  const asking = ROLES.filter((r) => r.needs.includes("ask-the-corpus"));
  const sections = new Map();
  for (const r of asking) {
    const s = flat(corpusSection(bodyOf(r)));
    assert.ok(s, `"${r.name}" has no section about asking the corpus`);
    const twin = [...sections].find(([, v]) => v === s);
    assert.ok(!twin, `"${r.name}" and "${twin?.[0]}" carry the same paragraph — tailor it or drop one`);
    sections.set(r.name, s);
  }
  /** ⛔ And which of the nine each names differs, because their questions differ. */
  const picks = new Set(asking.map((r) => readsNamedIn(bodyOf(r)).join("+")));
  assert.ok(
    picks.size >= 8,
    `${asking.length} judges name only ${picks.size} distinct sets of reads — a judge told to call all ` +
      `nine has been told nothing about which answers its question`
  );
});

/**
 * ⛔ THREE OF THE NINE READ LIKE THE FIRST HALF OF AN ACT, AND ONE OF THEM PUTS BYTES ON DISK.
 * `what_it_covers` computes what somebody would be agreeing to; `can_be_agreed_to` reports what is
 * blocking a stamp; `page` takes a path and writes the HTML to it. A judge that read those as
 * permission to proceed would be minting consent, which is the one thing nothing in this system may
 * do — and `productos_in`, the tool that could, is deliberately absent from what it holds. So where
 * a prompt names one of the three, it says in the same breath that nothing was changed.
 */
test("where a read looks like an act, the prompt says it changes nothing", () => {
  const LOOKS_LIKE_AN_ACT = ["productos_exchange_what_it_covers", "productos_exchange_can_be_agreed_to", "productos_exchange_page"];
  const SAYS_SO = /records? nothing|changes nothing|without recording|no act (is )?in your (tool )?list|only thing you can write|hold reads|read half/i;

  for (const r of ROLES.filter((r) => r.needs.includes("ask-the-corpus"))) {
    const section = flat(corpusSection(bodyOf(r)));
    const risky = LOOKS_LIKE_AN_ACT.filter((t) => section.includes(t));
    if (!risky.length) continue;
    assert.match(
      section,
      SAYS_SO,
      `"${r.name}" is told to call ${risky.join(", ")} and nowhere in that section says it records nothing. ` +
        `That is the read a judge could mistake for permission to act.`
    );
  }
});
