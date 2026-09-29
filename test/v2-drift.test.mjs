/**
 * ⛔ A CORPUS THAT DESCRIBES A DELETED SCREEN MUST NOT PASS THE GATE, AND A PERSON MUST NOT BE THE
 * ONE WHO NOTICES.
 *
 * Peter, twice, four days apart, on a rendered page: "this is all wrong - pricing happens in the
 * excel, the UI only shows pricing data read back in from workbook - read only" and "this is wrong
 * overall - the analyst only updates the sizing details within excel - the values are read back. so
 * 'pricing' only happens in excel".
 *
 * Both were one fact: a 1,192-line component had been deleted four days earlier, and the corpus went
 * on describing its coordinate rows, its editable limits, its staged edits and its publish button.
 *
 * ⛔ THE EVIDENCE WAS ALREADY THERE AND WAS PHRASED AS A SHRUG. `moved` reported "2 commits since it
 * was drawn" — the same sentence it gives a file somebody renamed a label in. And `check`, which
 * refuses handover for four hundred other things, had no opinion at all, because the whole question
 * had been waived out of it on the reasoning that comparing with history belongs to `moved`.
 *
 * That reasoning was right about commits and wrong about absence: whether a named file EXISTS needs
 * no git, and it is the strongest signal there is.
 *
 * Peter: "and why didn't moved properly regenerate?"
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { whatMoved } from "../dist/v2/moved.js";
import { checkCorpus } from "../dist/v2/check.js";
import { loadCorpus } from "../dist/v2/load.js";
import { howYouWillBeTold, setPush } from "../dist/mcp/push-state.js";

const CLI = path.resolve("dist/cli/index.js");

/** A corpus inside a real project, with one screen drawn from a real file. */
function project(sourceExists) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-drift-"));
  const dir = path.join(root, "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  /** A `productos/` directory is what makes this a project the corpus can name a codebase from. */
  fs.mkdirSync(path.join(root, "productos"), { recursive: true });
  fs.writeFileSync(path.join(root, "productos", "config.yaml"), "web: {}\n");
  const rel = "app/components/TheScreen.tsx";
  if (sourceExists) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), "export const TheScreen = () => null;\n");
  }
  // Point the seed's first screen at that file.
  const corpus = loadCorpus(dir);
  const entry = corpus.scopes.find((s) => s.scope.views.length > 0);
  assert.ok(entry, "the seed has no screen, so this proves nothing");
  const file = entry.file;
  const text = fs.readFileSync(file, "utf-8");
  const view = entry.scope.views[0];
  assert.ok(!/drawn_from:/.test(text), "the seed already records a source — this test would be testing that instead");
  fs.writeFileSync(file, text.replace(`  - id: ${view.id}\n`, `  - id: ${view.id}\n    drawn_from: ${rel}\n`));
  return { root, dir, scope: entry.scope.id, view: view.id, rel };
}

test("a deleted component is reported as DRIFT, not as a fault in the truth", () => {
  /**
   * ⛔ THIS TEST USED TO DEMAND A REFUSAL, AND THAT MADE THE CODE AUTHORITATIVE OVER THE TARGET.
   *
   * The corpus is the target state. A component disappearing means the BUILD moved away from what
   * the product is meant to have — and the usual resolution is that the code is behind. Refusing
   * pressures an author into withdrawing target state to make a check pass, which is backwards.
   *
   * It bit once and got the right answer for the wrong reason: the pricing grid was deleted and the
   * truth about it was indeed wrong — because Peter decided the target had changed. The deletion was
   * evidence; the tool treated it as the decision.
   */
  const p = project(false);
  const f = checkCorpus(p.dir).findings.find((x) => x.kind === "the-code-dropped-this-screen");
  assert.ok(f, "a corpus whose component vanished was told nothing at all");
  assert.equal(f.severity, "note", "drift must not refuse the corpus — the target is not what is wrong");
  assert.equal(f.where, `${p.scope}#${p.view}`);
  assert.match(f.what, /drift/, "it must name what this is");
  /** ⛔ And it must leave the decision with a person, naming both ways it can go. */
  assert.match(f.fix, /decide which side is wrong/);
  assert.match(f.fix, /the code is behind/, "the likelier reading must be offered first");
  assert.doesNotMatch(f.fix, /exists: withdrawn/, "it must not push the author to delete target state");
});

test("check says nothing when the source is still there", () => {
  const p = project(true);
  const f = checkCorpus(p.dir).findings.find((x) => x.kind === "the-code-dropped-this-screen");
  assert.equal(f, undefined, "a screen whose source exists was reported as deleted");
});

test("a corpus with no codebase behind it is not accused of anything", () => {
  /**
   * ⛔ The commonest shape there is — a corpus written before anybody pointed it at a repository.
   * Refusing every screen in it would make the gate a punishment for not having a codebase yet.
   */
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "productos-nocode-")), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  const findings = checkCorpus(dir).findings.filter((x) => x.kind === "the-code-dropped-this-screen");
  assert.deepEqual(findings, []);
});

test("moved reports a vanished source as its own thing, not as commits", () => {
  const p = project(false);
  const row = whatMoved(loadCorpus(p.dir), p.root).find((r) => r.view === p.view);
  assert.ok(row, "the screen was not walked at all");
  assert.equal(row.gone, true, "a deleted component read as an ordinary change");
});

test("moved does not call a living file gone", () => {
  const p = project(true);
  const row = whatMoved(loadCorpus(p.dir), p.root).find((r) => r.view === p.view);
  assert.ok(row);
  assert.ok(!row.gone);
});

test("a session is told when nothing will ever wake it", () => {
  /**
   * ⛔ "Nothing has happened yet" and "nothing that happens will reach you" are the same empty
   * inbox from inside a session, and it will read the second as the first and stop asking. That is
   * what happened: the push was running perfectly, over a different corpus.
   */
  setPush({ why: "no corpus could be resolved" });
  assert.match(howYouWillBeTold("/some/corpus"), /nothing will wake you/);

  setPush({ watching: "/a/different/corpus" });
  const wrong = howYouWillBeTold("/the/one/being/read");
  assert.match(wrong, /NOT the corpus you are reading/);
  assert.match(wrong, /\/a\/different\/corpus/, "it does not name where the push actually is, so nobody can fix it");

  setPush({ watching: "/the/one/being/read" });
  assert.match(howYouWillBeTold("/the/one/being/read"), /you will be woken/);
});
