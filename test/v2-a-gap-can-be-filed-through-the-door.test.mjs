/**
 * ⛔ THREE ROLES IN ONE AFTERNOON COULD NOT RECORD WHAT THE MODEL GAVE THEM NO WAY TO SAY.
 *
 * A framework gap is the one route from "this corpus had to be compromised" to somebody fixing the
 * compromise, and `forced_into` is the field that makes the compromise correctable in one pass
 * instead of becoming the convention. Three separate roles working the hosted corpus reported, each
 * independently and each as an aside, that they could not file one:
 *
 *   - `productos todo add --at http://127.0.0.1:4100/p/prj-… ` resolves `--at` as a DIRECTORY and
 *     throws `No corpus at /Users/peter/personal/productos/http:/127.0.0.1:4100/...`
 *   - the one door refuses the document: `"framework-gaps.yaml" is not part of a corpus`
 *
 * So each of them wrote their findings into a report and said, correctly, that filing against
 * ProductOS's own record instead would put a consumer corpus's gaps in the wrong repository — the
 * exact misfiling `--at` exists to prevent. Every one of those gaps survived only because a human
 * read a report.
 *
 * ⛔ AND THE DOOR'S REFUSAL WAS STRICTER THAN ITS OWN REASON. Its comment says a key the corpus does
 * not enumerate "would be written and then dropped by `writeBack` with a cheerful ok" — which is
 * right, and `corpusFiles` enumerates every root-level `.yaml`/`.yml` BESIDE the eight directories.
 * `framework-gaps.yaml`, `access.yaml` and `style.yaml` are all real corpus documents that survive
 * a round trip; the check simply demanded a directory prefix that a root-level document has not.
 *
 * So what the door accepts is now what the corpus holds, and nothing more.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { intentNamed } = await import("../dist/v2/intents.js");
const { corpusFiles } = await import("../dist/v2/load.js");

function corpus() {
  const dir = path.join(temp("v2gapdoor-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}

const GAPS = `# Framework gaps — TODOs for ProductOS's developers, not for this product.
version: 1
gaps:
  - id: fg-0001
    detected_at: 2026-10-17
    detector: authored
    what: a refusal outcome has no at/view_in/part of its own, so a refusal delivered on another
      feature's screen cannot say where it is read
    evidence: []
    forced_into: "publish-a-statement#statement-publish-modal#refuses: two cases with no part"
    status: open
`;

const ask = (dir) => ({ dir, who: { kind: "cli", actor: "peter" }, pressing: "peter" });

test("a gap record goes through the door", () => {
  const dir = corpus();
  const put = intentNamed("document").run(ask(dir), { key: "framework-gaps.yaml", says: GAPS });
  assert.equal(put.ok, true, `the door refused a gap record: ${put.why}`);
  assert.equal(fs.readFileSync(path.join(dir, "framework-gaps.yaml"), "utf-8"), GAPS);
});

test("and it survives the round trip the door's own warning is about", () => {
  /**
   * ⛔ THE POINT OF THE REFUSAL, KEPT. Accepting a key `writeBack` later drops would be worse than
   * refusing it: the caller is told ok and the document evaporates. So this asserts the document is
   * enumerated as part of the corpus, which is what makes accepting it safe.
   */
  const dir = corpus();
  intentNamed("document").run(ask(dir), { key: "framework-gaps.yaml", says: GAPS });
  const files = corpusFiles(dir);
  assert.ok(
    Object.hasOwn(files, "framework-gaps.yaml"),
    `the corpus does not enumerate the document the door accepted — it would be written and dropped. keys: ${Object.keys(files).slice(0, 12).join(", ")}`
  );
  assert.equal(files["framework-gaps.yaml"], GAPS);
});

test("a key the corpus does not hold is still refused", () => {
  /** ⛔ The non-vacuous half: widening this to "anything at the root" is the bug, not the fix. */
  const dir = corpus();
  for (const key of ["README.md", "notes.txt", "package.json", "gaps/one.yaml"]) {
    const put = intentNamed("document").run(ask(dir), { key, says: "whatever" });
    assert.equal(put.ok, false, `the door accepted "${key}", which the corpus does not enumerate`);
    assert.match(put.why, /not part of a corpus/);
  }
});

test("leaving the corpus is refused however it is spelled", () => {
  const dir = corpus();
  for (const key of ["../escape.yaml", "/etc/passwd.yaml", "truth/../../out.yaml"]) {
    const put = intentNamed("document").run(ask(dir), { key, says: "version: 1\n" });
    assert.equal(put.ok, false, `the door accepted "${key}"`);
  }
});
