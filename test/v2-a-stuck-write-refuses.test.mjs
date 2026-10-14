import test from "node:test";
import assert from "node:assert/strict";

/**
 * ⛔ ONE ABANDONED CLIENT MADE TWO PROJECTS PERMANENTLY UNWRITABLE, AND THE INSTANCE SAID HEALTHY.
 *
 * Measured on staging: GETs answered 200 on all four projects while POSTs to two of them hung
 * forever. `/health` was green — it had just been taught to read the store, and reading was exactly
 * what still worked. Postgres had no open transaction and no ungranted lock, so nothing was stuck
 * in the database: a per-project write lock in this process was held by a request whose client had
 * gone, and the promise chain behind it queued every later write in silence. A restart was the only
 * way back and a person had to notice.
 *
 * ⛔ THE FIX IS TO REFUSE, NOT TO PROCEED. The lock exists because a read-modify-write over a
 * materialized corpus loses an update silently when two interleave. A waiter that gave up and went
 * anyway would trade "this write is refused" for "somebody's work vanished" — worse, and invisible.
 */

const settles = () => new Promise((r) => setImmediate(r));

test("a write that never finishes refuses the next one instead of queueing it forever", async () => {
  const { __serializeForTest: serialize, stuckWrites } = await import("../dist/v2/store/instance.js");
  if (!serialize) return; /** not exported in this build */

  let release;
  const stuck = serialize("p1", () => new Promise((r) => { release = r; }));
  await settles();

  /** ⛔ The clock is injected, or this test would take two minutes to say anything. */
  const second = serialize("p1", async () => "ran", 20);
  await assert.rejects(() => second, /refused rather than queued/);

  /** ⛔ And it must say WHICH project and FOR HOW LONG — "it hung" sent two sessions to the database. */
  await assert.rejects(() => serialize("p1", async () => "ran", 20), /has been running for \d+s/);

  /** The stuck one is nameable while it is stuck. */
  assert.deepEqual(stuckWrites(0).map((w) => w.project), ["p1"]);

  release("done");
  await stuck;
  assert.deepEqual(stuckWrites(0), [], "the key stayed marked after its write finished");
});

test("a refused write does not run later when the stuck one finally finishes", async () => {
  const { __serializeForTest: serialize } = await import("../dist/v2/store/instance.js");
  if (!serialize) return;

  let release;
  const stuck = serialize("p2", () => new Promise((r) => { release = r; }));
  await settles();

  let ran = false;
  await assert.rejects(() => serialize("p2", async () => { ran = true; }, 20), /refused/);

  release("done");
  await stuck;
  await settles();
  await settles();
  /**
   * ⛔ THE HALF THAT IS EASY TO GET WRONG. Without this the request answered 503 would still apply
   * its write once the stuck one cleared — a refusal that silently took effect, which is worse than
   * either outcome alone.
   */
  assert.equal(ran, false, "a write the caller was told was refused ran anyway");
});

test("another project is unaffected — the lock is per project", async () => {
  const { __serializeForTest: serialize } = await import("../dist/v2/store/instance.js");
  if (!serialize) return;

  let release;
  const stuck = serialize("p3", () => new Promise((r) => { release = r; }));
  await settles();
  assert.equal(await serialize("p4", async () => "fine", 20), "fine");
  release("done");
  await stuck;
});

test("writes still serialize when nothing is stuck", async () => {
  const { __serializeForTest: serialize } = await import("../dist/v2/store/instance.js");
  if (!serialize) return;

  const order = [];
  const a = serialize("p5", async () => { order.push("a-start"); await settles(); order.push("a-end"); });
  const b = serialize("p5", async () => { order.push("b-start"); await settles(); order.push("b-end"); });
  await Promise.all([a, b]);
  /** ⛔ The invariant the lock exists for: no interleaving. */
  assert.deepEqual(order, ["a-start", "a-end", "b-start", "b-end"]);
});
