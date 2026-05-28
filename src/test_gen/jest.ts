import fs from "node:fs";
import path from "node:path";
import { TruthDocument } from "../core/types.js";
import { ProductosPaths } from "../core/paths.js";

/**
 * Materialize a validated Truth's proposed_test into a Jest test file under
 * productos/tests/. We don't transform the test source — we just write it with
 * a header comment so it's traceable back to the Truth.
 */
export function materializeJest(
  paths: ProductosPaths,
  truth: TruthDocument
): string {
  const id = truth.frontmatter.id;
  const test = truth.frontmatter.proposed_test;
  if (!test) {
    throw new Error(`materializeJest: ${id} has no proposed_test`);
  }
  const filename = `${id}.test.ts`;
  const fp = path.join(paths.testsDir, filename);
  fs.mkdirSync(paths.testsDir, { recursive: true });

  const header = renderHeader(truth);
  const content = `${header}\n${test.source.trim()}\n`;
  fs.writeFileSync(fp, content, "utf-8");
  return fp;
}

function renderHeader(truth: TruthDocument): string {
  const f = truth.frontmatter;
  const refs = f.code_ref.length
    ? f.code_ref.map((r) => ` *   - ${r}`).join("\n")
    : " *   (none — claim derived from plan, not code)";
  const lastRun = f.last_test_run
    ? `${f.last_test_run.at} (${f.last_test_run.result})`
    : "(not yet run by productos)";
  return `/**
 * ProductOS test for: ${f.id}
 * Claim: ${JSON.stringify(f.claim)}
 * Type: ${f.type}
 * Status: ${f.status}
 * Derived from:
${refs}
 * Last live run: ${lastRun}
 *
 * Edit this file if needed — the linkage to Truth is by ID in the header,
 * so renames are fine; deletes will be re-materialized on the next
 * \`productos test generate\` unless the Truth is also rejected.
 *
 * To regenerate (after code changes that invalidated the Truth):
 *   productos truth refresh ${f.id}
 */
`;
}
