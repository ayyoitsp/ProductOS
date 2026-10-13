/**
 * ⛔ A SET OF ALTERNATIVES WITH NOTHING SAYING WHAT THEY ARE ALTERNATIVES ABOUT.
 *
 * Peter: *"we should have a first class "prototype selection' at the root of prototypes. the
 * multiple prototypes should be supported by the framework - what it splits on should be up to the
 * project/user driving it"*.
 *
 * Several prototypes were already expressible and entirely unsupported. `prototypes.yaml` was
 * hand-authored — the only thing the CLI did with it was fail to find one and print a YAML snippet
 * to copy — and the surface drew a row of bare buttons that appeared only when a corpus happened to
 * have more than one. So the first question a reader has, *these are versions of WHAT?*, had no
 * answer anywhere in the model.
 *
 * ⛔ FIVE THINGS, AND THEY FAIL DIFFERENTLY:
 *
 *   1. the axis is the project's own sentence, and nothing infers it
 *   2. everything else about an option is derived — including how much of the product it reaches,
 *      which is what separates a second way through the product from one hopeful screen
 *   3. a prototype is declared by a command, and a front door that is not a screen is refused
 *      BEFORE anything is written
 *   4. the drawing sweep carries `splits_on` through — it wrote `{ prototypes }` and nothing else,
 *      so the first redraw after somebody stated the axis would have deleted it
 *   5. the selection reaches the page with its question on it
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { execFileSync } from "node:child_process";

const { loadCorpus } = await import("../dist/v2/load.js");
const { selectionOf, gapsIn } = await import("../dist/v2/selection.js");
const { renderScopePage } = await import("../dist/v2/page.js");
const { checkCorpus } = await import("../dist/v2/check.js");

const cli = (args) => execFileSync("node", ["dist/cli/index.js", ...args], { encoding: "utf8" });

function corpus() {
  const dir = path.join(temp("v2sel-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}

const views = (dir) => {
  const c = loadCorpus(dir);
  return c.scopes.flatMap((e) => (e.scope.views ?? []).map((v) => `${e.scope.id}#${v.id}`));
};

test("a prototype is declared by a command, not typed into a file", () => {
  const dir = corpus();
  const ref = views(dir)[0];
  const out = cli(["v2", "prototypes", "new", "CRE — loan processor", "--starts-at", ref, "--is", "loan processor", "--into", dir]);
  assert.match(out, /cre-loan-processor/, "the id was not derived from the title");

  const c = loadCorpus(dir);
  assert.equal(c.prototypes.length, 1);
  assert.equal(c.prototypes[0].title, "CRE — loan processor");
  /**
   * ⛔ BARE, BECAUSE THIS CORPUS HAS NO AXIS YET. `--is` keys by the first axis where one is stated;
   * before any is, inventing a key nobody chose would be the guess this model refuses elsewhere.
   */
  assert.equal(c.prototypes[0].is, "loan processor");
  assert.equal(c.prototypes[0].starts_at, ref);
});

test("⛔ a front door that is not a screen is refused before anything is written", () => {
  /**
   * An option that opens on nothing renders as a confident row leading to a blank, and the page
   * cannot say anything more useful about it than that — whereas here the corpus is in hand.
   */
  const dir = corpus();
  let threw = false;
  try {
    cli(["v2", "prototypes", "new", "Nowhere", "--starts-at", "no-scope#no-screen", "--into", dir]);
  } catch (e) {
    threw = true;
    assert.match(String(e.stderr), /no screen "no-scope#no-screen"/);
  }
  assert.ok(threw, "a prototype opening on a screen that does not exist was accepted");
  assert.equal(fs.existsSync(path.join(dir, "prototypes.yaml")), false, "it wrote the file anyway");
});

test("the axis is the project's own sentence, and the set carries it", () => {
  const dir = corpus();
  const [a, b] = views(dir).length > 1 ? views(dir) : [views(dir)[0], views(dir)[0]];
  cli(["v2", "prototypes", "new", "Admin", "--starts-at", a, "--is", "admin", "--into", dir]);
  const out = cli(["v2", "prototypes", "splits-on", "Which role is this for?", "--into", dir]);
  assert.match(out, /Which role is this for\?/);

  const sel = selectionOf(loadCorpus(dir));
  assert.equal(sel.question, "Which role is this for?");
  assert.deepEqual(sel.axes.length, 1, "one question is one axis");
  assert.equal(sel.options[0].is[sel.axes[0].id], "admin");
  assert.equal(sel.lands, "admin", "nothing says which option a reader lands in");
  assert.ok(b);
});

test("⛔ nothing infers the axis — a corpus that never said it has no question", () => {
  /**
   * *"what it splits on should be up to the project/user driving it"*. A classifier reading two
   * titles and concluding "role" would be a guess wearing a decision's clothes — the same objection
   * as `Note.kind`. Absent is absent, and the surface says so rather than labelling it.
   */
  const dir = corpus();
  const ref = views(dir)[0];
  cli(["v2", "prototypes", "new", "Admin", "--starts-at", ref, "--is", "admin", "--into", dir]);
  cli(["v2", "prototypes", "new", "Loan processor", "--starts-at", ref, "--is", "processor", "--into", dir]);
  const sel = selectionOf(loadCorpus(dir));
  assert.equal(sel.question, undefined, "something invented a question nobody wrote");
  assert.match(gapsIn(sel).map((g) => g.says).join("\n"), /nothing saying what they are alternatives about/);
});

test("how much of the product each one reaches is derived, not typed", () => {
  /**
   * The only thing that tells a reader whether "Admin" is a second way through the product or a
   * single screen somebody filed hopefully — and it is a fact about the truth, so nobody writes it.
   */
  const dir = corpus();
  const ref = views(dir)[0];
  cli(["v2", "prototypes", "new", "Admin", "--starts-at", ref, "--into", dir]);
  const sel = selectionOf(loadCorpus(dir));
  assert.equal(typeof sel.options[0].reaches, "number");
  assert.equal(sel.options[0].opensOn !== undefined, true, "it cannot name the screen it opens on");
  /** No `is` written anywhere in the file — the number is not coming from one. */
  assert.doesNotMatch(fs.readFileSync(path.join(dir, "prototypes.yaml"), "utf-8"), /reaches/);
});

test("⛔ the drawing sweep carries the axis through rather than deleting it", () => {
  /**
   * `v2 prototypes` wrote `{ prototypes: out }` and nothing else, so the first run after somebody
   * stated what the set splits on would have silently removed the one field on that file only a
   * person can write — a generator throwing away an author's sentence.
   */
  const dir = corpus();
  const ref = views(dir)[0];
  cli(["v2", "prototypes", "new", "Admin", "--starts-at", ref, "--is", "admin", "--into", dir]);
  cli(["v2", "prototypes", "splits-on", "Which role is this for?", "--into", dir]);
  cli(["v2", "prototypes", "--into", dir]);
  const raw = YAML.parse(fs.readFileSync(path.join(dir, "prototypes.yaml"), "utf-8"));
  assert.equal(raw.splits_on, "Which role is this for?", "the sweep deleted what it splits on");
  assert.equal(raw.prototypes[0].is, "admin", "the sweep deleted a prototype's answer");
});

test("⛔ handover and the page agree about what a door opens on — one predicate, not two", () => {
  /**
   * ⛔ THEY HAD ALREADY DIVERGED, WITHIN AN HOUR, IN THE DIRECTION THAT TEACHES PEOPLE TO IGNORE
   * THE PAGE.
   *
   * `check` resolved a front door with `resolveView`, which accepts a bare view id inside a scope
   * as well as `<scope>#<view>`. `gapsIn` tested a map keyed only as `<scope>#<view>`. So
   * `starts_at: balance` — a perfectly good door — passed handover and was REPORTED BROKEN on the
   * page a reviewer reads:
   *
   *     check  → passes, the ref resolves
   *     gapsIn → "Fine" opens on balance, which is not a screen in this corpus
   *
   * One condition with two implementations, diverging by one clause. This asserts the two agree on
   * BOTH spellings and on a genuinely broken door, which is the only form of the assertion that
   * cannot pass by both sides being wrong together.
   */
  const dir = corpus();
  const qualified = views(dir)[0];
  const bare = qualified.split("#").pop();

  const verdicts = (startsAt) => {
    fs.writeFileSync(
      path.join(dir, "prototypes.yaml"),
      `prototypes:\n  - id: p\n    title: A way\n    starts_at: ${startsAt}\n`
    );
    const c = loadCorpus(dir);
    const sel = selectionOf(c);
    return {
      page: gapsIn(sel).some((g) => g.kind === "prototype-opens-on-nothing"),
      handover: checkCorpus(dir).findings.some((f) => f.kind === "a-prototype-opens-on-nothing"),
      names: sel.options[0].opensOn,
    };
  };

  const q = verdicts(qualified);
  assert.deepEqual([q.page, q.handover], [false, false], `a ${qualified} door was called broken`);
  assert.ok(q.names, "the chooser cannot name the screen a qualified door opens on");

  /** ⛔ The bare id — the case that was a false positive on the page and silent at handover. */
  const b = verdicts(bare);
  assert.deepEqual([b.page, b.handover], [false, false], `a bare "${bare}" door was called broken`);
  assert.equal(b.names, q.names, "the two spellings name different screens");

  /** ⛔ And a door that really opens on nothing is caught by BOTH, or this test proves only silence. */
  const broken = verdicts("no-scope#no-such-screen");
  assert.deepEqual([broken.page, broken.handover], [true, true], "a door onto nothing was missed by one of them");
  assert.equal(broken.names, undefined);
});

test("the selection reaches the page, with its question on it", () => {
  const dir = corpus();
  const ref = views(dir)[0];
  cli(["v2", "prototypes", "new", "Admin only", "--starts-at", ref, "--is", "admin", "--into", dir]);
  cli(["v2", "prototypes", "splits-on", "Which role is this for?", "--into", dir]);
  const c = loadCorpus(dir);
  const html = renderScopePage(c, c.scopes[0].scope.id) ?? "";
  assert.match(html, /Which role is this for\?/, "the question is not on the page");
  assert.match(html, /class="wpick-is">admin/, "an option does not say which side of the split it is");
  /** ⛔ And with ONE prototype it is still there — that is the state where a reader most needs it. */
  assert.match(html, /class="wsel"/, "the selection disappeared because there was only one option");
});
