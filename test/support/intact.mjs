import fs from "node:fs";
import path from "node:path";

/**
 * Run something that writes into this checkout, and put the checkout back exactly as it was.
 *
 * ⛔ A TEST THAT DIRTIES TRACKED FILES MAKES THE SUITE SELF-HEALING, WHICH HIDES A RED MAIN.
 *
 * `6c36230` changed two roles' prompts in `src/core/jobs.ts` and did not regenerate their committed
 * copies, so `every role's installed definition is committed, and matches its source` correctly
 * went red. Then a LATER test ran the installer against `process.cwd()`, which rewrote those two
 * files to match — so the drift was gone, the second full run passed, and the red was unreproducible
 * by anybody who ran the suite twice. The failure healed itself and took the evidence with it.
 *
 * ⛔ AND IT BREAKS THE DEPLOY GATE'S PREMISE. `staging-guard` refuses unless the tree is clean and
 * identical to `origin/main`, because `COPY src ./src` builds the image from the WORKING TREE. A
 * suite that leaves two modified files behind means "I ran the tests" and "I may now deploy" are in
 * conflict, and the honest guard looks broken.
 *
 * ⛔ RESTORED BY BYTES, NEVER BY GIT. `git checkout -- <path>` would discard whatever else was in
 * those files, and in this repo that has already destroyed ~470 lines of somebody's uncommitted
 * work. What is written back is exactly what was read.
 */
export function intact(dirs, fn) {
  const before = new Map();
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const at = path.join(d, e.name);
      if (e.isDirectory()) walk(at);
      else before.set(at, fs.readFileSync(at));
    }
  };
  for (const d of dirs) walk(d);

  try {
    return fn();
  } finally {
    /** Put back what was read, and remove anything the run added. */
    const after = new Set();
    const sweep = (d) => {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const at = path.join(d, e.name);
        if (e.isDirectory()) sweep(at);
        else after.add(at);
      }
    };
    for (const d of dirs) sweep(d);

    for (const [at, bytes] of before) {
      if (!after.has(at) || !fs.readFileSync(at).equals(bytes)) {
        fs.mkdirSync(path.dirname(at), { recursive: true });
        fs.writeFileSync(at, bytes);
      }
    }
    for (const at of after) if (!before.has(at)) fs.rmSync(at);
  }
}
