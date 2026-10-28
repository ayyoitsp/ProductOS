/**
 * Conclude that nothing has to be built for a set of promises — fg-0020's field, written as a
 * decomposer would.
 *
 * ⛔ SHARED, BECAUSE GATING `unserved` MADE IT A PRECONDITION OF EVERY `ready: true` FIXTURE. Four
 * test files reached a ready verdict and all four now need a corpus whose machinery axis is
 * answered; four copies of this YAML would be four things to fix when the field moves.
 *
 * ⛔ IT WRITES THE FILE RATHER THAN CALLING A TOOL because there is no `decompose` intent — the
 * decomposer edits the corpus directly. That is worth knowing and is why this looks like this.
 */
import assert from "node:assert/strict";
import fs from "node:fs";

const { loadCorpus } = await import("../../dist/v2/load.js");
const { claimHash } = await import("../../dist/v2/stamp.js");
const { unservedIn } = await import("../../dist/v2/demonstrate.js");

const BECAUSE = "Nothing has to exist for this; it is satisfied by the shape the rest of the behaviour already has.";

/**
 * @param dir     a corpus directory
 * @param refs    `<scope>#<exchange>#<slot>[#<statement>]`, as `unserved` returns them
 * @param derived false to write the entries with no provenance — ⛔ which must NOT clear the gate
 */
export function concludeNothingNeeded(dir, refs, { by = "decomposer", at = "2026-10-28", derived = true } = {}) {
  if (!refs.length) return refs;
  const corpus = loadCorpus(dir);

  /** One file per scope, one block per exchange. */
  const byExchange = new Map();
  for (const ref of refs) {
    const [scope, exchange, slot, of] = ref.split("#");
    const key = `${scope}#${exchange}`;
    const from = claimHash(corpus, ref);
    assert.ok(from, `no claim at ${ref} — this fixture would hash nothing`);
    if (!byExchange.has(key)) byExchange.set(key, { scope, exchange, lines: [] });
    byExchange.get(key).lines.push(
      `      - slot: ${slot}`,
      ...(of ? [`        of: ${of}`] : []),
      `        because: ${BECAUSE}`,
      ...(derived ? [`        derived:`, `          by: ${by}`, `          at: ${at}`, `          from: ${from}`] : [])
    );
  }

  for (const { scope, exchange, lines } of byExchange.values()) {
    const f = `${dir}/truth/${scope}.md`;
    const src = fs.readFileSync(f, "utf-8");
    const marker = `  - id: ${exchange}`;
    const start = src.indexOf(marker);
    assert.notEqual(start, -1, `${exchange} is not in ${scope}.md; this fixture anchors on it`);
    /** The end of this exchange's block: the next one, or the end of the frontmatter. */
    const next = src.indexOf("\n  - id: ", start + marker.length);
    const end = next === -1 ? src.indexOf("\n---", start) : next;
    assert.notEqual(end, -1, `could not find the end of ${exchange}'s block`);

    /**
     * ⛔ REPLACES ANY BLOCK ALREADY THERE, because this is called twice in one fixture now.
     *
     * A reword stales the conclusions as well as the acceptances — that is the point of the hash —
     * so re-answering the machinery axis after one is the honest loop. Appending a second
     * `needs_nothing:` key produced `duplicated mapping key` and the corpus stopped loading, which
     * surfaced as a fixture error two tests away from the cause.
     */
    const block = src.slice(start, end);
    const had = block.indexOf("\n    needs_nothing:");
    const kept = had === -1 ? block : block.slice(0, had);
    const body = "\n    needs_nothing:\n" + lines.join("\n");
    fs.writeFileSync(f, src.slice(0, start) + kept + body + src.slice(end));
  }

  /** ⛔ Parsed back, so a fixture writing unloadable YAML fails here rather than as a wrong answer. */
  const after = loadCorpus(dir);
  assert.deepEqual(after.broken, [], `the fixture wrote YAML the loader refused: ${JSON.stringify(after.broken)}`);
  return refs;
}

/**
 * Conclude nothing-needed for EVERY promise under a ref, so calling it twice is a no-op.
 *
 * ⛔ IT TAKES THE WHOLE SET, NOT THE UNSERVED ONES, AND THAT IS NOT A SHORTCUT. `concludeNothingNeeded`
 * replaces the block it finds, so passing only what is currently unserved deleted the conclusions
 * that were still current — which is the shape a fixture hits the moment a reword stales one of
 * several. Caught by `reading it again after the reword makes it ready`, which went from four
 * unbacked promises to three and said so.
 */
export function answerTheMachineryAxis(dir, ref) {
  const [scope, exchange] = ref.split("#");
  const every = unservedIn(loadCorpus(dir), [scope], exchange, true);
  return concludeNothingNeeded(dir, every);
}
