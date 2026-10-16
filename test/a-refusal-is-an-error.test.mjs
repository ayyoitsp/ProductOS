/**
 * ⛔ A REFUSAL REACHES AN MCP CALLER AS AN ERROR, NOT AS A SUCCESS THAT WROTE NOTHING.
 *
 * Found while reviewing the MCP interface. The hosted route marked two kinds of refusal — the ones
 * `guardArgs` raised, and a write conflict — and let a third through unmarked: the one the TOOL
 * returned. So `productos_in` refusing a token's claim of `via: page` came back as a successful
 * tool call with `{ ok: false }` buried in its text, and a model reading the protocol carries on as
 * though its act had been recorded.
 *
 * ⛔ It was invisible for as long as the act tools existed, because theirs were caught upstream by
 * `guardArgs`. Retiring them made the door the only path, and this the only reporting.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

const src = () => fs.readFileSync(path.join(process.cwd(), "src/v2/store/mcp.ts"), "utf-8");

test("⛔ a handler that returns { ok: false } is reported as an error", () => {
  /**
   * Read off the source: standing a hosted instance up to prove one branch costs more than the
   * branch is worth, and the end-to-end case is already covered by the store suite — a token
   * claiming `via: page` over the wire, which asserts `isError` on the response.
   */
  const s = src();
  assert.match(s, /\.ok === false/, "nothing distinguishes a refused result from a successful one");
  assert.match(s, /\.\.\.\(refused \? \{ isError: true \} : \{\}\)/, "the flag is no longer set from that test");
});

test("⛔ and a result that is not a refusal is still a plain success", () => {
  /**
   * The opposite failure: marking everything an error would make a read look like a refusal, and a
   * caller that cannot tell them apart is exactly what this is about, pointed the other way.
   */
  /**
   * \u26d4 ANCHORED ON THE PREDICATE ITSELF, because `const refused =` appears TWICE in this file —
   * `guardArgs` has one — and the first version of this test read that one instead. It passed while
   * asserting nothing about the branch it was named for, which is the failure this whole file is
   * about, one level up.
   */
  const s = src();
  const i = s.indexOf(".ok === false");
  assert.ok(i > 0, "the predicate is gone");
  const branch = s.slice(i, i + 400);
  assert.match(branch, /isError: true/, "a refusal is no longer marked");
  assert.ok(
    !/isError: false/.test(branch),
    "a success is being marked explicitly, which no caller expects and which makes a read look refused"
  );
});

test("the two refusals that were already marked still are", () => {
  /** A fix that moved the marking rather than adding to it would read identically in a diff. */
  const s = src();
  const guard = s.indexOf('return { content: [{ type: "text", text: JSON.stringify(guarded, null, 2) }], isError: true };');
  assert.ok(guard > 0, "guardArgs refusals stopped being marked");
  assert.match(s, /isError: true,\s*\n\s*content: \[/, "the write-conflict refusal stopped being marked");
});
