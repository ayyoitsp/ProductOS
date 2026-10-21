/**
 * ⛔ ONE SCALE, AND NOTHING ANYWHERE TEACHES A SECOND ONE.
 *
 * Peter: *"I think we probably just need a confidence scale for derived, and get rid of
 * suggested/open, along with attributions"*, then — when I called the collapse lossy — *"i don't
 * understand - doesn't worked-out -> derived just have higher confidence than
 * worked-out-from-draft?"*, and finally *"we should just be distilling slightly differently"*.
 *
 * That last sentence is the accurate description of what was wrong. Every ingredient already
 * existed and was correct: `confidence.ts` had the rungs, `stampFor` had the human line, `Standing`
 * had the open questions, `Authorship` had the hand. What `level.ts` added was FOUR INVENTED NAMES
 * on top of all of it — `accepted`, `derived`, `suggested`, `open` — so a reader had to learn a
 * second vocabulary before the first one meant anything.
 *
 * ⛔ AND BOTH WERE BEING TAUGHT AT ONCE, which is how this survived. `skills/productos/SKILL.md`
 * documented the four level names in one section and `none · one source · corroborated · strongly
 * supported` thirty lines later, as though they were different facts about a claim. They were the
 * same fact, counted twice.
 *
 * ⛔ SO THIS IS THE CHECK THAT PROSE COULD NOT BE. The old names are ordinary English words — a
 * comment may say "a suggestion", a refusal may say "nobody has agreed" — so the test cannot ban
 * the strings. What it bans is the thing that made them a second scale: naming one as a LEVEL.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

const { LEVEL_WORD, LEVEL_WORD: WORDS } = await import("../dist/v2/level.js");
const { BUILDABLE } = await import("../dist/v2/readiness.js");

/** Every `.ts` and `.md` ProductOS is written in, so neither the code nor the teaching can drift. */
function sources() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const at = path.join(dir, e.name);
      if (e.isDirectory()) walk(at);
      else if (/\.(ts|md)$/.test(e.name)) out.push(at);
    }
  };
  for (const d of ["src", "skills"]) if (fs.existsSync(d)) walk(d);
  return out;
}

test("the scale has one rung per thing a reader acts on differently, and `accepted` is one of them", () => {
  const rungs = Object.keys(LEVEL_WORD);
  assert.ok(rungs.includes("accepted"), "the human line is not on the scale");
  /** ⛔ The three names the collapse removed, as LEVELS. */
  for (const gone of ["derived", "suggested", "open"]) {
    assert.ok(!rungs.includes(gone), `\`${gone}\` is still a rung — the second vocabulary survived`);
  }
  /** ⛔ Non-vacuous: a scale of one or two rungs would pass the line above and be useless. */
  assert.ok(rungs.length >= 4, `only ${rungs.length} rungs, so there is no scale to speak of`);
  /** ⛔ And every rung reads as something distinct: the grid renders the first letter of each. */
  const first = rungs.map((r) => LEVEL_WORD[r][0]);
  assert.equal(new Set(first).size, first.length, `two rungs share a first letter: ${first.join("")}`);
});

test("the gate is a set of rungs, and it has rungs on both sides of it", () => {
  const rungs = Object.keys(LEVEL_WORD);
  /**
   * ⛔ BOTH SIDES NON-EMPTY, which is the whole content of "a gate". A `BUILDABLE` holding every
   * rung is a gate that admits everything; one holding none makes every corpus unbuildable, which
   * is the usability review's complaint arriving from the other direction.
   */
  const below = rungs.filter((r) => !BUILDABLE.includes(r));
  assert.ok(BUILDABLE.length >= 2, `${BUILDABLE.length} rungs are buildable`);
  assert.ok(below.length >= 2, `${below.length} rungs are below the gate`);
  /** ⛔ And `accepted` is never below it — tenet 1 would be unreadable if it were. */
  assert.ok(BUILDABLE.includes("accepted"), "a sentence a person agreed to is not buildable");
  /** ⛔ Nor is the bottom rung ever above it. */
  assert.ok(!BUILDABLE.includes("none"), "a claim nothing supports is buildable");
});

/**
 * ⛔ NOTHING NAMES AN OLD LEVEL AS A LEVEL — AND THE PATTERN IS THE POINT.
 *
 * Banning the words would be wrong: `suggest` is an intent, `derived` is a field on a criterion and
 * a value of `Inherited.how`, `open` is a `Standing` kind and a note's state. All of those are
 * correct and unrelated. What must not exist is any of them appearing where a LEVEL goes, which is
 * what a second vocabulary looks like in code: `level: "suggested"`, `.level === "open"`,
 * `counts.derived`.
 */
test("nothing in the source or the skills names an old level as a level", () => {
  const BAD = [
    /\blevel:\s*"(derived|suggested|open)"/,
    /\.level\s*===\s*"(derived|suggested|open)"/,
    /\blevel\s*===\s*"(derived|suggested|open)"/,
    /counts\.(derived|suggested)\b/,
    /LEVEL_WORD\[\s*"(derived|suggested|open)"\s*\]/,
  ];
  const found = [];
  for (const f of sources()) {
    const text = fs.readFileSync(f, "utf-8");
    for (const re of BAD) {
      const m = re.exec(text);
      if (m) found.push(`${f} → ${m[0]}`);
    }
  }
  assert.deepEqual(found, [], "these name a level that no longer exists, so two scales are being taught at once");
});

/**
 * ⛔ AND THE SKILL TEACHES THE RUNGS IT ACTUALLY HAS. The instruct layer is the one `CLAUDE.md` calls
 * the most-missed and the most consequential: the model can be perfect while every future session
 * writes the old shape, because the skill never mentioned the new one.
 */
test("the skill names every rung, and the two things that are not rungs", () => {
  const skill = fs.readFileSync("skills/productos/SKILL.md", "utf-8");
  for (const rung of Object.keys(WORDS)) {
    assert.ok(skill.includes(rung), `the skill never mentions \`${rung}\`, so nothing will write it`);
  }
  /** ⛔ The flag and the hand, because a scale that absorbed either would be answering two questions. */
  assert.match(skill, /`owed`/, "the skill does not say a question owed is a flag beside the scale");
  assert.match(skill, /`wrote`|hand: person/, "the skill does not say authorship is separate from the scale");
});
