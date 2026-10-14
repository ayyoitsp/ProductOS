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
const { intentNamed } = await import("../dist/v2/intents.js");

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
  /** ⛔ Matched on the KIND, not on my own prose — rewording the sentence must not break a test
   *     that is about whether anything was inferred. That is the same mistake `check` made when it
   *     classified gaps by regex, two days ago. */
  assert.ok(
    gapsIn(sel).some((g) => g.kind === "prototypes-split-on-nothing"),
    "a set with no dimension named did not say so"
  );
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

test("the selection reaches the page as a control per dimension", () => {
  /**
   * ⛔ WHAT THIS ASSERTED BEFORE WAS THE BARF. It checked the question was somewhere on the page and
   * that an option carried a label — both true of the thing Peter looked at and said *"wtf is this?
   * this doesn't seem like a selector of any kind, seems like a barf of information"*. A row of
   * labelled boxes satisfies "the selection reaches the page" and is not a selector.
   *
   * So the assertion is now the shape: one control per dimension, its values as the options, and
   * the combinations carried so that choosing finds the prototype.
   */
  const dir = corpus();
  const ref = views(dir)[0];
  cli(["v2", "prototypes", "new", "Admin only", "--starts-at", ref, "--into", dir]);
  const intent = intentNamed("splits-on");
  const put = intent.run({ dir, who: { kind: "cli", actor: "peter" }, pressing: "peter" }, {
    axes: [{ label: "Role", values: ["admin", "loan processor"] }],
  });
  assert.equal(put.ok, true, put.why);

  const c = loadCorpus(dir);
  const sel = selectionOf(c);
  assert.deepEqual(sel.axes[0].values, ["admin", "loan processor"], "the values did not land");
  assert.equal(sel.at.length, 2, "the combinations were not derived from the values");

  const html = renderScopePage(c, c.scopes[0].scope.id) ?? "";
  assert.match(html, /data-walk-dim="role"/, "there is no control for the dimension");
  assert.match(html, /<span class="wdim-n">Role<\/span>/, "the control is not labelled with the dimension's name");
  /**
   * ⛔ THE COMBINATIONS MAP IS GONE, AND THAT IS THE IMPROVEMENT. It was a second derivation of what
   * each prototype specifies, carried beside the rows that already said it — and two derivations of
   * one fact is what this project spends most of its rules on. The dropdowns are filters now, so
   * every row answers for itself from `data-is` and a combination nothing covers is simply an empty
   * list rather than a lookup that misses.
   */
  assert.doesNotMatch(html, /id="walk-combos"/, "the combinations map came back beside the rows that already say this");
  assert.match(html, /data-proto-row="[^"]+" data-is=/, "a prototype row does not carry what it specifies");
  /** ⛔ And a value nothing covers is named rather than silently absent. */
  assert.match(gapsIn(sel).map((g) => g.says).join("\n"), /nothing covers loan processor/);
  /** ⛔ A field name must never reach a reader — this listed `splits_on` in a bulleted complaint. */
  assert.doesNotMatch(html, /splits_on/, "a schema field name is on a reader's page");
});

test("⛔ no field name reaches a reader in ANY state — including the one with no dimensions", () => {
  /**
   * ⛔ THE ASSERTION ABOVE PASSED WHILE THE DEFECT WAS LIVE, and that is the lesson in this file.
   *
   * It renders a corpus that HAS dimensions, so the gap printing the field name — "state it with
   * `splits_on`", which only fires when nothing names one — never ran. A page with the field name on
   * it was being asserted not to have the field name, by a fixture that could not reach the line.
   * The deploying session found it on the live page, at an offset, outside any script.
   *
   * ⛔ SO EVERY STATE THE SURFACE HAS IS RENDERED HERE: no dimensions with one prototype, no
   * dimensions with several, a dimension with no values, and a dimension with values half placed.
   * The leak was in exactly one of them, which is why one fixture was not enough.
   */
  const states = [
    {
      what: "two prototypes, no dimensions — the state the leak was in",
      build: (dir) => {
        const ref = views(dir)[0];
        cli(["v2", "prototypes", "new", "Admin", "--starts-at", ref, "--into", dir]);
        cli(["v2", "prototypes", "new", "Processor", "--starts-at", ref, "--into", dir]);
      },
    },
    {
      what: "one prototype, no dimensions",
      build: (dir) => cli(["v2", "prototypes", "new", "Only one", "--starts-at", views(dir)[0], "--into", dir]),
    },
    {
      what: "a dimension with no values",
      build: (dir) => {
        cli(["v2", "prototypes", "new", "Admin", "--starts-at", views(dir)[0], "--into", dir]);
        cli(["v2", "prototypes", "splits-on", "Role", "--into", dir]);
      },
    },
    {
      what: "a dimension with values, half placed",
      build: (dir) => {
        const ref = views(dir)[0];
        cli(["v2", "prototypes", "new", "Admin", "--starts-at", ref, "--into", dir]);
        cli(["v2", "prototypes", "new", "Processor", "--starts-at", ref, "--into", dir]);
        const ask = { dir, who: { kind: "cli", actor: "p" }, pressing: "p" };
        intentNamed("splits-on").run(ask, { axes: [{ label: "Role", values: ["admin", "loan processor"] }] });
        intentNamed("prototype").run(ask, { id: "admin", is: { role: "admin" } });
      },
    },
  ];

  /**
   * ⛔ THE NAMES WITH AN UNDERSCORE IN THEM, which is a property of the NAME rather than of what else
   * happens to be on the page. `is`, `in` and `title` are schema keys and ordinary English; a list
   * including them would cry wolf on correct pages, and a gate that cries wolf once gets routed
   * around — the deploying session's argument against the `${` check, applied here.
   */
  const KEYS = [
    "splits_on",
    "starts_at",
    "sketch_html",
    "drawn_from",
    "drawn_at",
    "bears_on",
    "shell_from",
    "shell_html",
    "view_kind",
    "happy_path",
    "covers_slots",
    "asked_of",
  ];

  for (const state of states) {
    const dir = corpus();
    state.build(dir);
    const c = loadCorpus(dir);
    const html = renderScopePage(c, c.scopes[0].scope.id, { interactive: true }) ?? "";
    /** Markup only: a key inside the live script is an identifier, not something a reader reads. */
    const markup = html.replace(/<script[\s\S]*?<\/script>/g, "");
    for (const key of KEYS)
      assert.ok(!markup.includes(key), `"${key}" is on a reader's page — state: ${state.what}`);
    /** ⛔ And the gap sentences themselves, which is where the leak was. */
    for (const g of gapsIn(selectionOf(c)))
      for (const key of KEYS)
        assert.ok(!g.says.includes(key), `"${key}" is in a sentence a reader is shown: ${g.says}`);
  }
});

test("⛔ a prototype can be taken back — declaring without removing is a one-way door", () => {
  /**
   * Found by `v2-a-capability-a-reviewer-cannot-reach` on its first run: `prototype` could declare
   * and change, and nothing could remove. Somebody who added one by mistake from a browser, with no
   * terminal, had no route back at all — the same hole `within` had until the same day.
   *
   * ⛔ NO TOMBSTONE, DELIBERATELY. A prototype is a way through the product, not a claim anybody
   * agreed to: nothing points at its id, so there is nothing to strand. Compare `exists: withdrawn`
   * on a screen, which exists precisely because statements DO point at it.
   */
  const dir = corpus();
  const ref = views(dir)[0];
  cli(["v2", "prototypes", "new", "Admin", "--starts-at", ref, "--into", dir]);
  cli(["v2", "prototypes", "new", "Processor", "--starts-at", ref, "--into", dir]);
  cli(["v2", "prototypes", "splits-on", "Which role is this for?", "--into", dir]);

  const intent = intentNamed("prototype");
  const ask = { dir, who: { kind: "cli", actor: "peter" }, pressing: "peter" };

  const gone = intent.run(ask, { id: "admin", remove: true });
  assert.equal(gone.ok, true, gone.why);
  assert.match(gone.said, /took back Admin/);
  assert.match(gone.detail.join(" "), /1 way through this product left/);

  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], "the removal left a file that will not load");
  assert.deepEqual(c.prototypes.map((p) => p.id), ["processor"], "it removed the wrong one, or none");
  /** ⛔ The axis survives a removal — it belongs to the set, not to any member of it. */
  assert.equal(c.splitsOn?.[0]?.label ?? c.splitsOn, "Which role is this for?");

  /** ⛔ And removing one that is not there is refused rather than silently fine. */
  assert.equal(intent.run(ask, { id: "admin", remove: true }).ok, false, "removing a prototype twice reported success");
});
