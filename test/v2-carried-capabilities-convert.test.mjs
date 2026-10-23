/**
 * ⛔ THE OLDER CAPABILITY TREE IS CONVERTED INTO THE ONE TREE, AND NOTHING ELSE ANSWERS TO THE WORD.
 *
 * Peter: *"to be clear, i expect there to ONLY be a v2 subsystem/capability tree after this and no
 * confusion, with the existing capabilities migrated to v2"*.
 *
 * The fixture is the shape the v1 migrator wrote: a `capabilities` container, each v1 capability a
 * scope inside it with system-asked exchanges, and the caller recorded as `depends_on` on the caller.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { loadCorpus } from "../dist/v2/load.js";
import { checkCorpus } from "../dist/v2/check.js";
import { capabilityTree } from "../dist/v2/subsystems.js";
import { convertCarriedCapabilities } from "../dist/v2/convert-capabilities.js";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { storeFor, isRefusal } from "../dist/v2/store/access.js";
import { accountFor } from "../dist/v2/store/identity.js";
import { createProject } from "../dist/v2/store/instance.js";
import { migrateDocuments, DOC_MIGRATIONS } from "../dist/v2/store/doc-migrations.js";

const AREA = `---
id: capabilities
title: Capabilities
in: family-wallet
exists: kept
---
What the product's machinery does, carried over from an older tree.
`;

const LEDGER = `---
id: ledger
title: The ledger
in: capabilities
exists: kept
depends_on: [clock]
exchanges:
  - id: record-a-movement
    title: Record a movement
    asked_by: system
    when:
      triggered_by: Money asks for this
      cadence: on-an-event
    slots:
      answer:
        says: Appends one movement against one kid and returns what the kid has afterwards.
    criteria:
      - id: 1
        slot: answer
        given: a kid with $2
        when: a $1 movement is recorded
        then: the kid has $3
  - id: tidy-up
    title: Tidy up old movements
    asked_by: system
    when:
      triggered_by: nobody has said
      cadence: repeating
    slots:
      answer:
        says: Archives movements older than a year.
---
Holds every movement of a kid's money as an append-only record.
`;

const CLOCK = `---
id: clock
title: The clock
in: capabilities
exists: kept
exchanges:
  - id: fire-a-daily-due-date
    title: Fire a daily due date
    asked_by: system
    when:
      triggered_by: The ledger asks for this
      cadence: repeating
    slots:
      answer:
        says: Hands over one subject on the day something falls due for it, once per day.
---
Decides when something is due.
`;

/** A carried scope with somebody's own ask in it — product truth, which must not become machinery. */
const AUDIT = `---
id: audit
title: Audit
in: capabilities
exists: kept
exchanges:
  - id: read-the-audit-log
    title: Read the audit log
    asked_by: person
    at:
      view_in: money#balance
    slots:
      answer:
        says: A parent sees every change anybody made, newest first.
---
Who changed what.
`;

/** The seed, with the area the v1 migrator wrote, and money declaring it rests on the ledger. */
function migrated() {
  const dir = temp("v2convert-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  for (const [f, body] of Object.entries({ "capabilities.md": AREA, "ledger.md": LEDGER, "clock.md": CLOCK, "audit.md": AUDIT }))
    fs.writeFileSync(path.join(dir, "truth", f), body);
  const money = path.join(dir, "truth", "money.md");
  fs.writeFileSync(money, fs.readFileSync(money, "utf-8").replace("in: family-wallet\n", "in: family-wallet\ndepends_on: [ledger]\n"));
  return dir;
}

const filesOf = (dir) => {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(dir, p)] = fs.readFileSync(p, "utf-8");
    }
  };
  walk(dir);
  return out;
};

/** Apply a conversion to a directory the way the store does: write, and take the deprecated away. */
const applied = (dir, c) => {
  for (const [k, v] of Object.entries(c.put)) {
    fs.mkdirSync(path.dirname(path.join(dir, k)), { recursive: true });
    fs.writeFileSync(path.join(dir, k), v);
  }
  for (const k of c.deprecate) fs.rmSync(path.join(dir, k));
  return dir;
};

test("the fixture loads, and before conversion two things answer to the word", () => {
  const corpus = loadCorpus(migrated());
  assert.deepEqual(corpus.broken, []);
  const t = capabilityTree(corpus);
  assert.equal(t.counts.subsystems, 0);
  assert.equal(t.carried.length, 1);
});

test("after conversion there is one tree, and no Capabilities area", () => {
  const dir = migrated();
  const c = convertCarriedCapabilities(filesOf(dir), "2026-10-23");
  assert.ok(c);
  const corpus = loadCorpus(applied(dir, c));
  assert.deepEqual(corpus.broken, [], "every converted document loads");

  const t = capabilityTree(corpus);
  assert.equal(t.carried.length, 0, "the area is gone");
  assert.ok(!corpus.scopes.some((s) => s.scope.id === "capabilities"));
  assert.deepEqual(t.subsystems.map((s) => s.id).sort(), ["clock", "ledger"]);
  assert.match(t.says, /^The capability tree has 2 subsystems offering 3 capabilities\.$/);
  assert.ok(!corpus.scopes.some((s) => s.scope.id === "ledger" || s.scope.id === "clock"), "no machinery left in product truth");
});

test("who calls a part becomes what it serves, through the parts that lean on it", () => {
  const dir = migrated();
  const corpus = loadCorpus(applied(dir, convertCarriedCapabilities(filesOf(dir))));
  const ledger = corpus.subsystems.find((s) => s.subsystem.id === "ledger").subsystem;
  const clock = corpus.subsystems.find((s) => s.subsystem.id === "clock").subsystem;
  assert.deepEqual(ledger.uses, ["clock"]);
  assert.deepEqual(ledger.offers.find((o) => o.id === "record-a-movement").serves, ["money"]);
  assert.equal(ledger.offers.find((o) => o.id === "record-a-movement").does, "Appends one movement against one kid and returns what the kid has afterwards.");
  assert.deepEqual(clock.offers[0].serves, ["money"], "the clock serves the ledger, which serves money");
  assert.equal(ledger.does, "Holds every movement of a kid's money as an append-only record.");
});

test("the feature's own edge is re-spelled to the part, not dropped", () => {
  const dir = migrated();
  const c = convertCarriedCapabilities(filesOf(dir));
  const corpus = loadCorpus(applied(dir, c));
  assert.deepEqual(corpus.scopes.find((s) => s.scope.id === "money").scope.depends_on, ["ledger#offers"]);
  assert.ok(c.report.respelled.some((r) => r.includes("ledger → ledger#offers")));
});

test("nothing a capability cannot hold is lost — it is in the part's own words", () => {
  const dir = migrated();
  const c = convertCarriedCapabilities(filesOf(dir), "2026-10-23");
  const ledger = c.put["capabilities/ledger.md"];
  assert.match(ledger, /## Carried from the earlier capability tree, 2026-10-23/);
  assert.match(ledger, /- test 1: given a kid with \$2, when a \$1 movement is recorded, then the kid has \$3/);
  assert.match(ledger, /- when: Money asks for this/);
});

test("a person's ask stays product truth, out of the area; a part nobody calls is refused by name", () => {
  const dir = migrated();
  const c = convertCarriedCapabilities(filesOf(dir));
  assert.deepEqual(c.report.keptAsProduct, ["audit#read-the-audit-log"]);
  assert.deepEqual(c.report.servesNothing, [], "every ask in the ledger serves what calls the ledger");
  const corpus = loadCorpus(applied(dir, c));
  const audit = corpus.scopes.find((s) => s.scope.id === "audit").scope;
  assert.equal(audit.in, "family-wallet", "filed where the area was");
  assert.deepEqual(audit.exchanges.map((e) => e.id), ["read-the-audit-log"]);
});

test("a part with no caller anywhere converts with nothing it serves, and check refuses it by name", () => {
  const dir = migrated();
  // Nobody depends on audit, and audit has no system ask — so make one that nothing calls.
  fs.writeFileSync(
    path.join(dir, "truth", "orphan.md"),
    CLOCK.replace("id: clock", "id: orphan").replace("title: The clock", "title: The orphan").replace("The ledger asks for this", "nobody has said")
  );
  const c = convertCarriedCapabilities(filesOf(dir));
  assert.deepEqual(c.report.servesNothing, ["orphan#offers#fire-a-daily-due-date"]);
  const { findings } = checkCorpus(applied(dir, c));
  const f = findings.find((x) => x.kind === "a-capability-that-serves-nothing");
  assert.ok(f);
  assert.equal(f.where, "orphan#offers#fire-a-daily-due-date");
  assert.equal(f.severity, "refuse");
});

test("converting adds no refusal of its own", () => {
  const dir = migrated();
  const before = new Set(checkCorpus(dir).findings.filter((f) => f.severity === "refuse").map((f) => `${f.kind} ${f.where}`));
  const after = checkCorpus(applied(dir, convertCarriedCapabilities(filesOf(dir)))).findings.filter(
    (f) => f.severity === "refuse" && !before.has(`${f.kind} ${f.where}`)
  );
  assert.deepEqual(after.map((f) => `${f.kind} ${f.where}: ${f.what}`), []);
});

test("a corpus with no carried area is left alone", () => {
  const dir = temp("v2convert-none-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  assert.equal(convertCarriedCapabilities(filesOf(dir)), null);
});

test("the server runs it once per project, deprecating rather than deleting, and logs it", async () => {
  const client = new PGlite();
  const db = drizzle(client);
  await applyMigrations((sql) => client.exec(sql));
  const owner = await accountFor(db, "ada@example.com");
  const id = "prj-cnv";
  await createProject(db, { id, owner, slug: "cnv", name: "cnv" });
  const store = await storeFor(db, { kind: "browser", account: owner, reach: [] }).project(id);
  assert.ok(!isRefusal(store));
  for (const [k, v] of Object.entries(filesOf(migrated()))) await store.put(k, v);

  const rule = DOC_MIGRATIONS.filter((m) => m.id === "0002-carried-capabilities-become-subsystems");
  assert.equal(rule.length, 1);
  const [first] = await migrateDocuments(db, store, rule);
  assert.ok(first.documents.includes("capabilities/ledger.md"));
  assert.ok(first.documents.includes("truth/capabilities.md"));
  const docs = await store.documents();
  assert.ok(docs["capabilities/ledger.md"]);
  assert.ok(!docs["truth/ledger.md"], "the old scope is no longer served");
  assert.ok(!docs["truth/capabilities.md"]);

  const again = await migrateDocuments(db, store, rule);
  assert.deepEqual(again, [], "the ledger says it ran");
  await client.close();
});

test("a converted capability renders as a contract on How it works, not as a feature", async () => {
  const { renderScopePage } = await import("../dist/v2/page.js");
  const dir = migrated();
  const before = renderScopePage(loadCorpus(dir), "family-wallet");
  assert.match(before, /data-view="ledger" data-ref="ledger" data-label="The ledger"/, "before: the ledger renders as a feature");
  const page = renderScopePage(loadCorpus(applied(dir, convertCarriedCapabilities(filesOf(dir)))), "family-wallet");
  assert.match(page, /<li class="contract" data-ref="ledger#offers#record-a-movement">/);
  assert.match(page, /relied on by <a [^>]*>Money<\/a>, <strong>[^<]*<\/strong>|relied on by <a [^>]*>Money<\/a>/);
  assert.match(page, /<ul class="cap-terms"><li>when: Money asks for this<\/li><li>test 1: given a kid with \$2/);
  assert.doesNotMatch(page, /data-view="ledger"/, "after: no feature page for a part of the system");
  assert.doesNotMatch(page, /data-scope="ledger"/, "and no feature row in the menu");
});
