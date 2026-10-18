/**
 * ⛔ A SESSION READING A BEHAVIOUR THROUGH ANY MCP READ CAN TELL AN AGREED SENTENCE FROM A DRAFT.
 *
 * The gap, from the review: *"the other MCP reads — productos_exchange_record,
 * productos_exchange_questions, productos_exchange_grid, productos_exchange_page, and the packet
 * entries for claims — do not return the level, so a session reading a behaviour through them
 * cannot tell an agreed sentence from a draft without a second call"*.
 *
 * So this drives the tools the way MCP calls them — the registered handlers, against a seed corpus —
 * after one slot is agreed to on the page by a person and another gets a sentence suggested by an
 * agent token through the same door. Each read must say `accepted` for the first and `suggested` for
 * the second, and the levels must be `levelOf`'s, not a second derivation that agrees today.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const { exchangeTools } = await import("../dist/mcp/v2-tools.js");
const { intentNamed, refuseIntent, incomplete } = await import("../dist/v2/intents.js");
const { loadCorpus } = await import("../dist/v2/load.js");
const { levelOf } = await import("../dist/v2/level.js");

const CLI = path.resolve("dist/cli/index.js");
const AGREED = "money#see-a-balance#with";
const DRAFT = "money#record-earning#with";

function say(dir, intent, fields, who) {
  const i = intentNamed(intent);
  assert.ok(i, `the door does not take "${intent}"`);
  const asking = { dir, who, pressing: who.actor };
  return refuseIntent(i, asking, fields) ?? incomplete(i, fields) ?? i.run(asking, fields);
}

/** One slot a person agreed to on the page, one slot an agent suggested a sentence into. */
const corpusDir = (() => {
  let made;
  return () => {
    if (made) return made;
    const dir = path.join(temp("productos-every-read-level-"), "v2");
    execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
    const pressed = say(dir, "accept", { ref: AGREED, by: "peter", via: "page" }, {
      kind: "browser",
      actor: "peter",
      scopes: ["read", "author"],
    });
    assert.equal(pressed.ok, true, JSON.stringify(pressed));
    const suggested = say(
      dir,
      "suggest",
      { ref: DRAFT, says: "A note longer than eighty characters is cut off with an ellipsis.", from: "the form's maxLength" },
      { kind: "token", actor: "groomer", scopes: ["read", "author"] },
    );
    assert.equal(suggested.ok, true, JSON.stringify(suggested));
    /** ⛔ The premise, from the one module that answers it — not from the reads under test. */
    const c = loadCorpus(dir);
    assert.equal(levelOf(c, AGREED).level, "accepted");
    assert.equal(levelOf(c, DRAFT).level, "suggested");
    return (made = dir);
  };
})();

const call = async (name, args) => {
  const t = exchangeTools.find((x) => x.name === name);
  assert.ok(t, `no tool ${name} on the MCP surface`);
  return t.handler({ dir: corpusDir(), ...args }, { root: "/nowhere" });
};

test("the record carries each decision's ref level now, beside the person's own `because`", async () => {
  const r = await call("productos_exchange_record", { ref: "money#see-a-balance" });
  const d = r.decisions.find((x) => x.ref === AGREED && x.act === "accept");
  assert.ok(d, `no acceptance of ${AGREED} in the record: ${r.decisions.map((x) => x.ref).join(", ")}`);
  assert.equal(d.level, "accepted");
  assert.equal(d.route, "accepted-here");
});

test("a question carries its level, and an owed one reads open", async () => {
  const r = await call("productos_exchange_questions", { scope: "tasks" });
  const q = r.questions.find((x) => x.ref === "tasks#complete-a-task#at_once");
  assert.ok(q, `no question at tasks#complete-a-task#at_once: ${r.questions.map((x) => x.ref).join(", ")}`);
  assert.equal(q.level, "open");
  assert.equal(q.route, "unruled");
  /** ⛔ Every question whose ref has a level carries it — a level on one and not its neighbour is a guess. */
  const c = loadCorpus(corpusDir());
  for (const x of r.questions) {
    const l = levelOf(c, x.ref);
    assert.equal(x.level, "error" in l ? undefined : l.level, `${x.ref} disagrees with levelOf`);
  }
});

test("the grid leads each cell with its level, so an agreed slot and a draft read differently", async () => {
  const { grid } = await call("productos_exchange_grid", { scope: "money" });
  const lines = grid.split("\n");
  const head = lines.find((l) => /^\s+may\s+with\s/.test(l));
  assert.ok(head, grid);
  const col = head.indexOf("with");
  const cellOf = (exchange) => {
    const row = lines.find((l) => l.startsWith(`${exchange} `));
    assert.ok(row, `no row for ${exchange}:\n${grid}`);
    return row.slice(col).trim().split(/\s+/)[0];
  };
  assert.match(cellOf("see-a-balance"), /^a/, `the agreed slot does not read agreed:\n${grid}`);
  assert.match(cellOf("record-earning"), /^s/, `the suggested slot does not read suggested:\n${grid}`);
  assert.match(grid, /a agreed\s+d derived\s+s suggested\s+o open/, "the letters are not explained in plain words");
});

test("the packet's slot lines say agreed or suggested in plain words", async () => {
  const { packet } = await call("productos_exchange_packet", { scope: "money" });
  const section = (title) => {
    const at = packet.indexOf(`## ${title}`);
    assert.ok(at >= 0, `no section ${title}`);
    const next = packet.indexOf("\n## ", at + 3);
    return packet.slice(at, next < 0 ? undefined : next);
  };
  const c = loadCorpus(corpusDir());
  const titleOf = (ref) =>
    c.scopes.find((s) => s.scope.id === "money").scope.exchanges.find((e) => e.id === ref.split("#")[1]).title;
  assert.match(section(titleOf(AGREED)), /^- \*\*with\*\* \*\(agreed\)\*/m);
  assert.match(section(titleOf(DRAFT)), /^- \*\*with\*\* \*\(suggested\)\*/m);
  /** ⛔ Plain words, never a route name. */
  assert.doesNotMatch(packet, /accepted-here|landed-by-software|accepted-through-a-rule/);
});

test("the page puts the level on each behaviour row, so an HTML read can tell them apart too", async () => {
  const { html } = await call("productos_exchange_page", { scope: "money" });
  const levelOfRow = (ref) => {
    const at = html.indexOf(`data-ref="${ref}"`);
    assert.ok(at >= 0, `no row for ${ref} on the page`);
    const end = html.indexOf("</tr>", at);
    const m = /data-level="([a-z]+)"/.exec(html.slice(at, end));
    assert.ok(m, `the row for ${ref} carries no level`);
    return m[1];
  };
  assert.equal(levelOfRow(AGREED), "accepted");
  /** The slot the agent wrote into now says two things, so its rows are per statement. */
  const c = loadCorpus(corpusDir());
  const drafted = c.scopes.find((s) => s.scope.id === "money").scope.exchanges.find((e) => e.id === "record-earning").slots.with.says;
  const added = drafted[drafted.length - 1];
  assert.equal(levelOfRow(`${DRAFT}#${added.id}`), "suggested");
});

test("every read that now carries a level says so in its description", () => {
  for (const name of ["productos_exchange_record", "productos_exchange_questions", "productos_exchange_grid", "productos_exchange_packet", "productos_exchange_page"])
    assert.match(exchangeTools.find((t) => t.name === name).description, /level/, `${name} does not mention the level`);
});
