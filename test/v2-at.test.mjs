/**
 * ⛔ A WRITE THAT LANDS IN THE WRONG CORPUS AND REPORTS SUCCESS.
 *
 * `notes add` declared `--at` while its parent `notes` declared it too. Commander banked the value
 * on the parent and handed the child its default, so a carry-in meant for a work corpus was written
 * into the seed working copy — and every line of output said ✓. Nothing distinguished it from
 * having worked.
 *
 * Two things hold it shut: no command may re-declare an option its parent already owns, and `at()`
 * refuses a directory that does not look like a corpus instead of quietly creating one.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { v2Command } from "../dist/cli/commands/v2.js";

const CLI = path.resolve("dist/cli/index.js");
const run = (args, cwd) => {
  try {
    return { ok: true, out: execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

test("no v2 command re-declares an option its parent owns", () => {
  const v2 = v2Command();

  const walk = (cmd, ownedAbove) => {
    const mine = cmd.options.map((o) => o.long).filter(Boolean);
    for (const flag of mine)
      assert.ok(
        !ownedAbove.has(flag),
        `"${cmd.name()}" re-declares ${flag}, which a parent already owns — the value goes to the parent and the child silently gets its default`
      );
    const owned = new Set([...ownedAbove, ...mine]);
    for (const sub of cmd.commands) walk(sub, owned);
  };
  walk(v2, new Set());
});

test("a corpus directory that is not one is refused, not written into", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "v2at-"));
  const missing = path.join(tmp, "nowhere");

  const r = run(["v2", "notes", "add", "something that should change", "--about", "x", "--by", "peter", "--at", missing], tmp);
  assert.equal(r.ok, false, "it accepted a directory with no corpus in it");
  assert.match(r.out, /no corpus at/);
  // ⛔ And created nothing. Half-creating a corpus is how the next run finds one and trusts it.
  assert.equal(fs.existsSync(missing), false, `it created ${missing}`);

  /**
   * ⛔ And the default is refused the same way, which is the case that actually bit: the fallback
   * `v2` relative to the shell's cwd is a real directory in the ProductOS checkout, so a dropped
   * `--at` wrote into the seed rather than failing.
   */
  const d = run(["v2", "notes"], tmp);
  assert.equal(d.ok, false, "the default fell back to something it never checked");
  assert.match(d.out, /no corpus at/);
  assert.match(d.out, /run from/, "the refusal has to name where it was run from — the two differing IS the failure");
});

test("--at is honoured on whichever side of a nested verb it is typed", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "v2at2-"));
  const corpus = path.join(tmp, "corpus");
  fs.cpSync("v2-seed", corpus, { recursive: true });
  const elsewhere = path.join(tmp, "elsewhere");
  fs.cpSync("v2-seed", elsewhere, { recursive: true });

  const notes = () => {
    const f = path.join(corpus, "notes", "notes.yaml");
    return fs.existsSync(f) ? fs.readFileSync(f, "utf-8") : "";
  };

  // After the verb.
  const a = run(["v2", "notes", "add", "the tab strip is missing a tab", "--about", "family-wallet", "--by", "peter", "--at", corpus], elsewhere);
  assert.equal(a.ok, true, a.out);
  assert.match(notes(), /missing a tab/, "the note did not land in the corpus --at named");

  // Before the verb.
  const b = run(["v2", "notes", "--at", corpus, "add", "and the balance shows no date", "--about", "family-wallet", "--by", "peter"], elsewhere);
  assert.equal(b.ok, true, b.out);
  assert.match(notes(), /shows no date/);

  // ⛔ And nothing was written to the corpus the command was RUN from.
  const stray = path.join(elsewhere, "notes", "notes.yaml");
  assert.equal(fs.existsSync(stray) && /missing a tab|shows no date/.test(fs.readFileSync(stray, "utf-8")), false, "a note landed in the cwd's corpus");
});
