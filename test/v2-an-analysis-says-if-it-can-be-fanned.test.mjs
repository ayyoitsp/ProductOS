/**
 * ⛔ "PER FEATURE" WAS READ AS PERMISSION TO FAN TWENTY, AND IT COST THREE DISJOINT TREES.
 *
 * `grain` says what one unit IS, so a sweep can count what is left. It says nothing about whether
 * twenty units can be handed to twenty roles at once — but `per feature · decomposer` on the
 * listing is an instruction in everything but name, and that is how it was used.
 *
 * ⛔ MEASURED, NOT ARGUED. Three decomposers were fanned over three pricing features that obviously
 * share machinery:
 *
 *     3 runs, 15 distinct subsystem ids
 *     proposed by MORE THAN ONE run:        0
 *     parts leaning on another run's tree:  0
 *
 * The same concepts came out under different names — the workbook boundary as `master-worksheet`
 * and as `cre-templates`, the template's declared fields as `template-sources` (write side) and
 * `reported-figures` (read side). Not disagreement about the product: they cannot see each other.
 * Each run predicted it of the others and was right.
 *
 * So an analysis now declares `settleFirst` when its units cannot be worked independently, and
 * `capabilities` carries it: "one subsystem serves many features" is a whole-corpus judgement, and
 * the role's own definition says a one-to-one mirror has recorded nothing.
 *
 * ⛔ AND IT IS NOT A BLANKET FLAG. `requirements` and `drawings` are genuinely independent — a
 * requirement belongs to one claim, a drawing to one screen — so a test that only checked "the
 * field is surfaced" would pass on a build that marked everything unfannable and stopped all
 * parallel work. The fourth test below is that one.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");

const dir = path.join(temp("v2fan-"), "v2");
execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });

const { ANALYSES } = await import(path.resolve("dist/v2/analyse.js"));

function run(args) {
  const out = { stdout: "", stderr: "" };
  try {
    out.stdout = execFileSync("node", [CLI, "v2", "analyse", ...args, "--at", dir], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    out.stdout = e.stdout ?? "";
    out.stderr = e.stderr ?? "";
  }
  return out;
}

/** Captures stderr separately, which the pipe-cleanliness test depends on. */
function runSplit(args) {
  const res = execFileSync(
    "bash",
    [
      "-c",
      `node ${JSON.stringify(CLI)} v2 analyse ${args.map((a) => JSON.stringify(a)).join(" ")} --at ${JSON.stringify(dir)} 2>/tmp/pos-fan-err.txt; echo "---STDERR---"; cat /tmp/pos-fan-err.txt`,
    ],
    { encoding: "utf-8" }
  );
  const [stdout, stderr] = res.split("---STDERR---");
  return { stdout, stderr: stderr ?? "" };
}

test("capabilities declares that it cannot be fanned, with a reason", () => {
  const a = ANALYSES.find((x) => x.name === "capabilities");
  assert.ok(a, "there is no capabilities analysis");
  assert.ok(a.settleFirst, "capabilities does not say it must be settled first — a session will fan it again");
  assert.ok(a.settleFirst.what?.length > 20, "it does not say WHAT has to be settled");
  /** ⛔ A reason somebody could argue with, which is the standard a waiver is held to elsewhere. */
  assert.match(
    a.settleFirst.because,
    /disjoint|different names|per-feature|whole-corpus/i,
    `the reason is not arguable: ${a.settleFirst.because}`
  );
});

test("the listing says it, because that is where somebody decides how to run it", () => {
  const { stdout } = run([]);
  assert.match(stdout, /capabilities/, "the listing does not mention capabilities");
  assert.match(
    stdout,
    /not fannable/i,
    "the listing shows `per feature · decomposer` and nothing warning against fanning it"
  );
});

/**
 * ⛔ THE ONE THAT PROTECTS THE PIPE. `--refs` exists to be fanned over — one ref per line. A warning
 * on stdout would corrupt every consumer, so it has to go to stderr and stdout must stay exactly
 * refs. Both halves asserted, because either alone is satisfiable by the wrong fix.
 */
test("--refs keeps stdout pipeable and puts the warning on stderr", () => {
  const { stdout, stderr } = runSplit(["capabilities", "--refs"]);
  const lines = stdout.split("\n").filter((l) => l.trim());
  assert.ok(lines.length > 0, "no refs were printed at all");
  for (const l of lines) {
    assert.match(
      l.trim(),
      /^[a-z0-9-]+$/,
      `stdout carries something that is not a ref, so a pipe reading this breaks: ${JSON.stringify(l)}`
    );
  }
  assert.match(stderr, /cannot be fanned/i, "the person fanning it is never told, which is when it matters most");
  assert.match(stderr, /because/i, "the warning does not carry the reason");
});

/**
 * ⛔ NOT A BLANKET FLAG. If every analysis were marked unfannable, the three tests above would pass
 * and all parallel work would have stopped. A requirement belongs to one claim and a drawing to one
 * screen; neither needs to know what another unit decided.
 */
test("the analyses that genuinely are independent are not marked", () => {
  const independent = ANALYSES.filter((a) => a.name !== "capabilities");
  assert.ok(independent.length >= 2, `only ${independent.length} other analyses — this check is too weak`);
  for (const a of independent) {
    assert.equal(
      a.settleFirst,
      undefined,
      `${a.name} is marked unfannable, which stops parallel work that has no shared judgement in it`
    );
  }
  const { stdout } = run([]);
  const marked = stdout.split("\n").filter((l) => /not fannable/i.test(l));
  assert.equal(marked.length, 1, `${marked.length} rows warn against fanning; exactly one should`);
});
