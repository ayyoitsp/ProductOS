/**
 * Are this tree's migrations numbered in a way that survives a merge?
 *
 *   node scripts/migrations-check.mjs            # this tree, and against origin/main
 *   node scripts/migrations-check.mjs main       # against a named ref instead
 *
 * ⛔ THE GIT HALF LIVES HERE AND NOT IN `src/`. Whether a number is taken on another branch is a
 * question about a checkout, not about the model — and the branch may have no remote, which has to
 * be "could not ask" rather than a failure.
 */
import { execFileSync } from "node:child_process";
import { migrationCollisions, journalOf, migrationsDir } from "../dist/v2/store/migrate.js";

const ref = process.argv[2] ?? "origin/main";
const dir = migrationsDir();

let against;
let asked = ref;
try {
  const raw = execFileSync("git", ["show", `${ref}:drizzle/meta/_journal.json`], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  against = JSON.parse(raw).entries ?? [];
} catch {
  /** ⛔ Not a failure. A fresh clone with no remote, or a repo before that file existed. */
  asked = null;
}

const found = migrationCollisions(dir, against);
const here = journalOf(dir);

if (!found.length) {
  console.log(`✓ ${here.length} migrations, numbered cleanly${asked ? ` and no collision with ${asked}` : ""}`);
  if (!asked) console.log(`  (could not read ${ref} — the comparison against it was skipped)`);
  process.exit(0);
}

console.error(`✗ ${found.length} problem${found.length === 1 ? "" : "s"} with how these are numbered:\n`);
for (const f of found) console.error(`  ${f.kind}\n    ${f.says}\n`);
console.error(
  "Renumbering is the fix, and it is safe: the ledger keys on a hash of the statements as well as\n" +
    "the tag, so a migration already applied under its old number is recognised rather than re-run.",
);
process.exit(1);
