/**
 * ⛔ A REF WITH EXACTLY ONE CANDIDATE IS NOT A GUESS, AND REFUSING IT MADE SOMEBODY RETYPE IT.
 *
 * Peter, after the page refused his Admin prototype twice:
 *
 *     { "ok": false,
 *       "why": "no screen \\"org-loan-terms#org-loan-terms\\" in this corpus, so nothing can open on it",
 *       "detail": ["name it as <scope>#<view>"] }
 *
 * then: *"should be obvious which to point each one at"*. It was. `org-loan-terms` is a scope holding
 * exactly one screen, so there was one thing that ref could mean — and the refusal sent him to look
 * up a name the corpus already knew, with a detail line that restated the syntax he had used
 * correctly.
 *
 * ⛔ THE DIFFERENCE BETWEEN RESOLUTION AND INFERENCE IS THE COUNT, and both halves are asserted here
 * because only the pair says anything:
 *
 *   · exactly one candidate → resolve it, write the resolved ref back, and SAY what was done
 *   · two or more           → still refuse, and NAME them rather than sending somebody to look
 *
 * A test that only showed the resolution would pass on a build that picks the first of five, which
 * is the classifier this model refuses everywhere.
 *
 * ⛔ AND THE CORRECTION IS WRITTEN BACK. Resolving on every read would leave the unresolvable string
 * in the corpus forever, with every reader repeating the same derivation and `check` going on
 * refusing a corpus that is in fact unambiguous.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import("../dist/v2/load.js");
const { parseFrontmatter } = await import("../dist/core/frontmatter.js");
const { intentNamed } = await import("../dist/v2/intents.js");
const { checkCorpus } = await import("../dist/v2/check.js");
const { theOnlyScreenIn, screensIn, doorOpensOn } = await import("../dist/v2/selection.js");

const ask = (dir) => ({ dir, who: { kind: "cli", actor: "peter" }, pressing: "peter" });

/**
 * A corpus with a one-screen scope and a several-screen scope.
 *
 * ⛔ THE ONE-SCREEN SCOPE IS CONSTRUCTED, because the seed has none — 0, 3 and 2 screens. A fixture
 * that searched for one found nothing and every assertion below failed on the setup rather than on
 * the thing it is about, which is a fixture lying about why it is red.
 *
 * ⛔ AND IT IS BUILT BY TRIMMING A REAL SCOPE rather than hand-writing frontmatter. A scope needs
 * `in`, `exists` and `happy_path` to parse at all; typing a minimal one by hand is how a test ends
 * up asserting against something `loadCorpus` quietly rejects — which has happened in this repo, to
 * a session that wrote a scope file and got a corpus of nothing back.
 */
function corpus() {
  const dir = path.join(temp("v2only-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });

  const c = loadCorpus(dir);
  const many = c.scopes.find((e) => (e.scope.views ?? []).length > 1);
  assert.ok(many, "the seed has no scope with several screens");
  /** A different multi-screen scope, trimmed to one — so the two cases are genuinely different scopes. */
  const trimming = c.scopes.find((e) => (e.scope.views ?? []).length > 1 && e.scope.id !== many.scope.id);
  assert.ok(trimming, "the seed has only one scope with screens, so the two cases cannot differ");

  /**
   * ⛔ THE LOADER'S OWN PARSER, not a regex of my own. My first version required a closing `---` and
   * a body; the seed's scope files are frontmatter ONLY, so every test failed on the fixture with a
   * message about the file's shape rather than about the thing under test. A second parser disagreed
   * with the first, which is the defect this repo keeps finding in its own code.
   */
  const parsed = parseFrontmatter(fs.readFileSync(trimming.file, "utf-8"));
  const front = { ...parsed.data };
  front.views = [front.views[0]];
  const body = parsed.content.trim();
  fs.writeFileSync(trimming.file, `---\n${YAML.stringify(front)}---\n${body ? `\n${body}\n` : ""}`);

  const after = loadCorpus(dir);
  assert.deepEqual(after.broken, [], "trimming the fixture produced a corpus that will not load");
  const one = after.scopes.find((e) => e.scope.id === trimming.scope.id);
  assert.equal((one.scope.views ?? []).length, 1, "the trim did not leave exactly one screen");
  return { dir, one: one.scope, many: after.scopes.find((e) => e.scope.id === many.scope.id).scope };
}

test("⛔ one candidate resolves, and the outcome says what it did", () => {
  const { dir, one } = corpus();
  const intent = intentNamed("prototype");

  /** The shape he typed: the scope's own id where a view id belongs. */
  const out = intent.run(ask(dir), { id: "admin", title: "Admin", startsAt: `${one.id}#${one.id}` });
  assert.equal(out.ok, true, out.why);
  assert.match(out.said, new RegExp(`${one.id}#${one.views[0].id}`), "it did not open on the only screen there");
  /** ⛔ Silently pointing a door somewhere else is a correction nobody agreed to. */
  assert.match(out.detail.join(" "), /is not a screen/, "the correction was not reported");
  assert.match(out.detail.join(" "), /only one in that feature/);

  /** ⛔ And the RESOLVED ref is what landed, not the string he typed. */
  const raw = YAML.parse(fs.readFileSync(path.join(dir, "prototypes.yaml"), "utf-8"));
  assert.equal(raw.prototypes[0].starts_at, `${one.id}#${one.views[0].id}`, "the unresolvable ref was stored");
});

test("⛔ two candidates still refuse, and the refusal names them", () => {
  /**
   * The half that makes the other half honest. Picking the first of several is the guess this model
   * refuses; sending somebody away to find the list is the refusal they learn to ignore.
   */
  const { dir, many } = corpus();
  const out = intentNamed("prototype").run(ask(dir), { id: "p", title: "P", startsAt: `${many.id}#${many.id}` });
  assert.equal(out.ok, false, "a ref with several candidates was resolved anyway");
  assert.match(out.why, /no screen/);
  const said = (out.detail ?? []).join(" ");
  for (const v of many.views) assert.match(said, new RegExp(v.id), `the refusal does not name ${v.id}`);
  assert.equal(fs.existsSync(path.join(dir, "prototypes.yaml")), false, "it wrote the file anyway");
});

test("a ref naming no scope at all is refused with no candidates to offer", () => {
  const { dir } = corpus();
  const out = intentNamed("prototype").run(ask(dir), { id: "p", title: "P", startsAt: "no-such-scope#no-view" });
  assert.equal(out.ok, false);
  assert.match((out.detail ?? []).join(" "), /<scope>#<view>/, "it offers nothing and does not say the shape");
});

test("⛔ a ref that already resolves is left exactly as it is", () => {
  /**
   * The resolution must not fire on a working ref — a door that quietly moved because a scope
   * happens to hold one screen would be the feature rewriting somebody's correct truth.
   */
  const { dir, one } = corpus();
  const good = `${one.id}#${one.views[0].id}`;
  const out = intentNamed("prototype").run(ask(dir), { id: "admin", title: "Admin", startsAt: good });
  assert.equal(out.ok, true, out.why);
  assert.deepEqual(
    (out.detail ?? []).filter((d) => /is not a screen/.test(d)),
    [],
    "it reported a correction it did not make"
  );
  const raw = YAML.parse(fs.readFileSync(path.join(dir, "prototypes.yaml"), "utf-8"));
  assert.equal(raw.prototypes[0].starts_at, good);
});

test("⛔ the predicate itself: one screen resolves, several do not", () => {
  /**
   * Asserted on the function as well as through the intent, because `check` reads it too — and the
   * last time two callers each owned a copy of a door-resolution rule they disagreed within the hour.
   */
  const { dir, one, many } = corpus();
  const c = loadCorpus(dir);
  assert.equal(theOnlyScreenIn(c, `${one.id}#${one.id}`)?.ref, `${one.id}#${one.views[0].id}`);
  assert.equal(theOnlyScreenIn(c, `${many.id}#${many.id}`), undefined, "a scope with several resolved to one");
  assert.equal(theOnlyScreenIn(c, "no-such-scope#x"), undefined);
  /** ⛔ A bare id with no `#` is not a scope-qualified ref and must not be resolved as one. */
  assert.equal(theOnlyScreenIn(c, one.id), undefined);
  assert.deepEqual(
    screensIn(c, `${many.id}#whatever`).sort(),
    many.views.map((v) => `${many.id}#${v.id}`).sort()
  );
});

test("⛔ check names the one candidate rather than restating the syntax", () => {
  /**
   * A corpus can reach `check` with an unresolvable door even now — authored by hand, migrated, or
   * written before this existed — and being told the name is worth most exactly then.
   */
  const { dir, one } = corpus();
  fs.writeFileSync(
    path.join(dir, "prototypes.yaml"),
    `prototypes:\n  - id: admin\n    title: Admin\n    starts_at: ${one.id}#${one.id}\n`
  );
  const found = checkCorpus(dir).findings.find((f) => f.kind === "a-prototype-opens-on-nothing");
  assert.ok(found, "check no longer refuses a door onto nothing");
  assert.match(found.fix, new RegExp(`${one.id}#${one.views[0].id}`), "the refusal does not name the only candidate");
  assert.doesNotMatch(found.fix, /^name a screen that exists/, "it restates the syntax instead of answering");
  /** ⛔ And the predicate the refusal used is the one the intent uses — not a second copy. */
  assert.equal(doorOpensOn(loadCorpus(dir), `${one.id}#${one.id}`), undefined);
});
