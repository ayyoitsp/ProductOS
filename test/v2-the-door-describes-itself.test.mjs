/**
 * ⛔ A DOOR THAT CANNOT SAY WHAT IT TAKES GETS A HARDCODED CLIENT, AND THE COPY ROTS.
 *
 * Peter: *"let's make sure we have a re-usable way to send messages to product OS, and appropriate
 * context/routing hints… eventually i'd like to be able to send mcp commands or have a slack
 * channel monitor that would take commands and route to the appropriate place"*.
 *
 * `/api/v2/in` took eleven named intents and could describe none of them. `theIntents()` returned
 * the names — the one part nobody needed help with — while its own comment claimed it existed "so a
 * caller never has to read this file". Meanwhile `OWED`, the table of what each act owes, was a
 * `const` private to `page.ts`, so the only surface that could learn what to ask for was the one
 * drawing the composer.
 *
 * That is not a hypothetical cost. `OWED`'s own comment records it happening twice: *"a refusal
 * printing a remedy the tool then rejected"*. An MCP bridge and a Slack relay are the third and
 * fourth chances to repeat it, and both were about to be written.
 *
 * ⛔ THE LOAD-BEARING TEST HERE IS "EVERY FIELD A `run` READS IS DECLARED". The rest assert the
 * surface; that one asserts the surface cannot silently fall behind the code, which is the only
 * reason a generated contract is worth more than a documented one.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";
/** ⛔ Through the shared helper, which reaps what it made — see v2-tests-leave-nothing-behind. */
import { temp } from "./support/temp.mjs";

const { v2Route } = await import(path.resolve("dist/v2/serve.js"));
const { INTENTS, describeIntents, missingFrom, refuseIntent, incomplete } = await import(path.resolve("dist/v2/intents.js"));
const { OWED, ALSO } = await import(path.resolve("dist/v2/acts.js"));
const { exchangeTools } = await import(path.resolve("dist/mcp/v2-tools.js"));

const CLI = path.resolve("dist/cli/index.js");

function corpus() {
  const dir = path.join(temp("door-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  return dir;
}

async function served(dir) {
  const server = http.createServer(async (req, res) => {
    if (await v2Route(req, res, new URL(req.url, "http://x").pathname, { dir })) return;
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    stop: () => new Promise((r) => server.close(r)),
    get: (r) => fetch(base + r).then((x) => x.json()),
    post: async (b) => {
      const x = await fetch(base + "/api/v2/in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(b),
      });
      return { status: x.status, body: await x.json().catch(() => ({})) };
    },
  };
}

test("⛔ every field a run() reads is declared, so no caller can be refused for a field nothing offered", () => {
  /**
   * ⛔ READ OUT OF THE SOURCE, NOT OUT OF THE REGISTRY. Comparing `takes` against itself would pass
   * on anything. This finds `body.x` in each intent's own `run` and asks whether `takes` names it —
   * the same shape as `framework-not-just-output`, for the same reason: a field only the code knows
   * about is a field only its author can send.
   */
  const src = fs.readFileSync("src/v2/intents.ts", "utf-8");

  /** Fields read by the shared act payload builder, declared once via OWED/ALSO rather than per act. */
  const shared = new Set(["via", "by", "act", "ref"]);

  const undeclared = [];
  for (const intent of INTENTS) {
    /** The act intents are generated from one `run`; their fields come from OWED + ALSO. */
    const block = blockFor(src, intent.name);
    if (!block) continue;
    const declared = new Set(intent.takes.map((f) => f.name));
    for (const f of new Set([...block.matchAll(/body\.([A-Za-z_]+)/g)].map((m) => m[1]))) {
      if (shared.has(f) || declared.has(f)) continue;
      undeclared.push(`${intent.name}.${f}`);
    }
  }
  assert.deepEqual(
    undeclared,
    [],
    `these are read by an intent and declared by none of them, so only a caller that read the source could send them:\n  ${undeclared.join("\n  ")}`
  );
});

/** One intent's object literal, so a field read by `note` is not credited to `close`. */
function blockFor(src, name) {
  const at = src.indexOf(`name: "${name}",`);
  if (at < 0) return null;
  const next = INTENTS.map((i) => src.indexOf(`name: "${i.name}",`))
    .filter((i) => i > at)
    .sort((a, b) => a - b)[0];
  return src.slice(at, next === undefined ? src.length : next);
}

test("the acts' fields come from OWED and ALSO, which is where payloadFrom reads them", () => {
  /** ⛔ `payloadFrom` is the other half: this says what to ask for, that says where it goes. */
  const payload = fs.readFileSync("src/v2/acts.ts", "utf-8");
  const reads = new Set([...payload.matchAll(/body\.([A-Za-z_]+)/g)].map((m) => m[1]));
  const named = new Set([
    ...Object.values(OWED).flat().map((f) => f.name),
    ...Object.values(ALSO).flat().map((f) => f.name),
    "via",
    "by",
    "act",
    "ref",
  ]);
  const missing = [...reads].filter((f) => !named.has(f));
  assert.deepEqual(missing, [], `payloadFrom reads these and no table names them: ${missing.join(", ")}`);
});

test("OWED has exactly one home, and it is not the renderer", () => {
  /**
   * ⛔ ITS OWN COMMENT SAID "SHARED BY EVERY SURFACE THAT ASKS FOR IT" while it was private to
   * `page.ts`. A second copy is how the page and the door come to disagree about what a person owes.
   */
  const page = fs.readFileSync("src/v2/page.ts", "utf-8");

  /**
   * ⛔ A SECOND *DECLARATION*, NOT A SECOND MENTION — and the difference is why this assertion is
   * fussy. `page.ts` legitimately contains `const OWED = ${JSON.stringify(OWED)};` INSIDE a
   * template literal: the browser script needs the table inlined, and that copy is derived from
   * the import, so it cannot drift. A blanket match on `const OWED` fails on the correct code,
   * which is how a test ends up asserting the opposite of what it meant.
   *
   * What must never come back is a typed object literal — `const OWED: Record<...> = { ... }` —
   * because that one is maintained by hand.
   */
  assert.doesNotMatch(
    page,
    /const OWED\s*:\s*Record</,
    "page.ts declares its own OWED literal again — the page and the door can now disagree about what a person owes"
  );
  assert.match(page, /import \{ OWED \} from "\.\/acts\.js"/, "page.ts no longer reads the shared table");
  /** ⛔ The browser copy is serialised FROM the import, never typed out beside it. */
  assert.match(page, /const OWED = \$\{JSON\.stringify\(OWED\)\}/, "the page's browser copy is no longer derived from the shared table");
  assert.ok(Object.keys(OWED).length >= 5, "acts.ts does not export the table");
});

test("the door describes itself, and the description is generated rather than written out", async () => {
  const dir = corpus();
  const s = await served(dir);
  try {
    const d = await s.get("/api/v2/in");
    assert.equal(d.door, "/api/v2/in");
    assert.match(d.how, /POST \{ intent/);

    /** ⛔ Generated: adding an intent must reach this surface without anybody editing the route. */
    assert.deepEqual(
      d.intents.map((i) => i.name),
      INTENTS.map((i) => i.name),
      "the served description has drifted from the registry"
    );
    for (const i of d.intents) {
      assert.ok(i.does && i.does.length > 10, `${i.name} does not say what it does`);
      assert.ok(["consent", "relay", "author", "open"].includes(i.gate), `${i.name} has no usable gate`);
      assert.ok(Array.isArray(i.takes), `${i.name} declares no fields`);
      for (const f of i.takes) {
        assert.equal(typeof f.required, "boolean", `${i.name}.${f.name} does not say whether it is required`);
        assert.ok(f.says && f.says.length > 5, `${i.name}.${f.name} has no sentence saying what it is`);
      }
    }
    /** ⛔ The rule a relay must obey travels WITH the contract, not in a file it will not read. */
    assert.match(d.never, /guesses an intent, or what a request is about, from a sentence/);
    assert.deepEqual(Object.keys(d.gates).sort(), ["author", "consent", "open", "relay"]);
  } finally {
    await s.stop();
  }
});

test("a missing field is 422 and names what it wanted; it is not 403", async () => {
  const dir = corpus();
  const s = await served(dir);
  try {
    const r = await s.post({ intent: "note" });
    /**
     * ⛔ THE STATUS IS THE WHOLE POINT. Folding the field check into the authority gate answered 403
     * — "you may not" — for a caller who simply had not said enough. A relay told it is forbidden
     * stops and escalates; told it is incomplete it asks for the field. One status for both turns a
     * retryable mistake into what reads as a permissions outage.
     */
    assert.equal(r.status, 422, "a missing field was reported as a permission problem");
    assert.match(r.body.why, /note needs/);
    assert.ok(
      r.body.detail.some((d) => d.startsWith("about —")),
      "the refusal did not say what the missing field means, which is the remedy"
    );

    const ok = await s.post({ intent: "note", about: "money", says: "the door should say what it takes" });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
  } finally {
    await s.stop();
  }
});

test("a field that was given but falsy is an answer, not an omission", () => {
  const read = INTENTS.find((i) => i.name === "read");
  /** ⛔ `buildable: false` and `pick: 0` are answers. The first cut refused both. */
  assert.deepEqual(missingFrom(read, { ref: "money", buildable: false }), []);
  const rule = INTENTS.find((i) => i.name === "rule");
  assert.deepEqual(
    missingFrom(rule, { ref: "money#x", because: "x".repeat(40), pick: 0 }).map((f) => f.name),
    []
  );
});

test("the authority is decided before any field is described", () => {
  /**
   * ⛔ ORDER, NOT JUST OUTCOME. Describing an operation's fields and only then refusing the
   * authority to perform it hands out its shape — in the one place a token is probing what it can
   * reach. So a principal that may not must get `forbidden`, never a field list.
   */
  const token = { kind: "token", actor: "a token", scopes: [] };
  const asking = { dir: "/nowhere", who: token, pressing: "nobody" };
  const accept = INTENTS.find((i) => i.name === "accept");
  const r = refuseIntent(accept, asking, {});
  assert.ok(r, "a scopeless token was allowed to record consent");
  assert.equal(r.ok, false);
  /** ⛔ The gate said no without describing the operation to somebody who may not perform it. */
  assert.doesNotMatch(JSON.stringify(r), /What it is about/, "the refusal described fields to a caller that may not act");
  /** ⛔ And completeness is a different question, asked only of callers already allowed. */
  assert.ok(incomplete(accept, {}), "an empty accept was treated as complete");
  assert.equal(incomplete(accept, { ref: "money" }), null);
});

test("MCP speaks the door's vocabulary, generated from the same registry", () => {
  const door = exchangeTools.find((t) => t.name === "productos_in");
  const manual = exchangeTools.find((t) => t.name === "productos_intents");
  assert.ok(door, "there is no MCP tool for the single input");
  assert.ok(manual, "MCP cannot be asked what the door takes");

  /** ⛔ Generated: every intent is named in the tool a model reads before calling it. */
  for (const i of INTENTS)
    assert.ok(door.description.includes(i.name), `productos_in never mentions the "${i.name}" intent`);

  /** ⛔ And the no-classifier rule is in the description, where the model making the choice sees it. */
  assert.match(door.description, /NEVER INFERRED FROM A SENTENCE/);
  assert.match(door.description, /neither is `about`\/`ref`/i);
});

test("MCP's manual and the door's are the same answer from the same generator", async () => {
  const dir = corpus();
  const s = await served(dir);
  try {
    const overHttp = await s.get("/api/v2/in");
    const overMcp = await exchangeTools.find((t) => t.name === "productos_intents").handler({}, { productsDir: dir });
    /** ⛔ Two transports, one contract. Two answers here would be two things to keep in step. */
    assert.deepEqual(overMcp.intents, describeIntents());
    assert.deepEqual(
      overHttp.intents.map((i) => i.name),
      overMcp.intents.map((i) => i.name)
    );
    assert.equal(overHttp.never, overMcp.never);
  } finally {
    await s.stop();
  }
});

test("⛔ the skill names the door, so the next session does not invent a route", () => {
  /**
   * ⛔ THE INSTRUCTION LAYER, WHICH CLAUDE.md CALLS THE MOST-MISSED — four times over.
   *
   * A door nothing tells a future session about is a door that gets a sixth endpoint built beside
   * it. And the two rules that keep a relay honest live nowhere a relay's author would look: the
   * intent is never inferred, and neither is what a request is about. Peter is explicitly planning
   * "a slack channel monitor that would take commands and route to the appropriate place" — the one
   * place with no page context to read `about` from, and therefore the one most tempted to guess.
   *
   * Asserted rather than trusted, because this file is prose and prose has failed here before.
   */
  const skill = fs.readFileSync("skills/productos/SKILL.md", "utf-8");
  assert.match(skill, /\/api\/v2\/in/, "the skill never names the door");
  assert.match(skill, /productos_intents/, "the skill never says the contract can be asked for");
  assert.match(skill, /never inferred/i, "the skill does not carry the no-classifier rule");
  assert.match(skill, /\babout\b/, "the skill does not mention what a request is about");
  assert.match(skill, /\bcarry\b/, "the skill does not tell a relay to carry a press rather than make one");
  /** ⛔ And the two statuses, because acting on the wrong one is the expensive mistake. */
  assert.match(skill, /403/, "the skill does not say what a forbidden refusal is");
  assert.match(skill, /422/, "the skill does not say what an incomplete refusal is");
});
