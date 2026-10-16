/**
 * ⛔ WHAT MAY REACH 4100, AND THE PROXY THAT GOT IT WRONG.
 *
 * Peter: *"going to have this session focused only on redeploying 4100 as changes come in, making
 * sure the main branch is clean before deploy"*.
 *
 * `staging-guard` refused every worktree outright, using "is a worktree" as a proxy for "carries
 * unmerged work". The proxy is usually right and was wrong about the one case that matters — a
 * checkout kept permanently on main for nothing but deploying — while the MAIN checkout, where
 * feature branches are actually worked on, passed. So it pointed the deploy at the dirtiest tree on
 * the machine and refused the cleanest.
 *
 * ⛔ AND `COPY src ./src` IS WHY THE TREE MATTERS, which another session caught: the image is built
 * from the WORKING TREE, not the commit. "HEAD is in origin/main" was never the whole question — a
 * clean HEAD with sixteen uncommitted files ships those files to the shared store while git reports
 * a clean commit. That nearly happened: this session committed another session's in-flight work by
 * running `git add -A` in a checkout that had been switched to their branch underneath it.
 *
 * The condition now asked is the one that was always meant: clean, and MERGED — see the test below
 * for why identity could not be asked where it was being asked.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const mk = fs.readFileSync("Makefile", "utf-8");

/** Only the tab-indented recipe lines of one target — comments and the next target excluded. */
const recipe = (name) => {
  const i = mk.indexOf(`\n${name}:`);
  assert.ok(i >= 0, `there is no ${name} target`);
  const out = [];
  for (const l of mk.slice(i + 1).split("\n").slice(1)) {
    /**
     * ⛔ MAKE'S OWN COMMENTS ARE TAB-INDENTED TOO, SO THEY WERE IN THE RECIPE. An assertion looking
     * for `git status --porcelain` passed on a COMMENT mentioning it — the same defect as a test
     * matching the prose that explains a fix rather than the fix. Dropped here, once.
     */
    if (l.startsWith("\t") && !/^\t@?#/.test(l)) out.push(l);
    else if (l.startsWith("\t")) continue;
    else if (out.length) break;
  }
  assert.ok(out.length, `${name} has no recipe — a name that always succeeds`);
  return out.join("\n");
};

test("something checks the working tree, because the image is built from the tree", () => {
  /**
   * ⛔ IN `MERGED_CHECK`, NOT IN `staging-guard`, AND THAT IS A DELIBERATE DEDUPLICATION. Both halves
   * were written twice on the same afternoon by two sessions. Theirs won: it is path-scoped to the
   * set `.dockerignore` lets into the build context, so it cannot cry about a scratch file that can
   * never reach the image — and those are the guards people learn to bypass. It is also driven
   * against scratch repositories by `v2-staging-serves-what-is-merged`, rather than text-matched.
   */
  const merged = mk.slice(mk.indexOf("define MERGED_CHECK"), mk.indexOf("endef"));
  assert.match(merged, /git status --porcelain/, "⛔ nothing checks the working tree — COPY src ./src ships it");
  assert.match(merged, /-- src/, "the tree check is not scoped to what the image actually copies");
  /** ⛔ And it must be reachable from staging, or it guards nothing. */
  assert.match(recipe("staging-guard"), /MERGED_CHECK/, "staging-guard does not call the tree check");
  /** ⛔ Exactly one home. Two copies drift, and one of them would be the one nobody updated. */
  assert.doesNotMatch(recipe("staging-guard"), /git status --porcelain/, "the tree check is duplicated");
});

/**
 * ⛔ THIS TEST USED TO DEMAND EQUALITY, AND THE REASON IT GAVE WAS RIGHT. It said: "IDENTICAL, NOT
 * `merge-base --is-ancestor`. An ancestor check passes for a commit BEHIND origin/main, which is a
 * stale deploy nobody asked for." That is true, and an earlier attempt to loosen this guard was
 * caught here, correctly, because it removed the refusal and put nothing in its place.
 *
 * ⛔ BUT EQUALITY COULD NOT BE ASKED WHERE IT WAS BEING ASKED. `rebuild-remote` depends on
 * `staging-guard`, so the question lands AFTER the suite — about twelve minutes in — and it
 * re-fetches first. On an afternoon when main merged every five minutes, no sha was still the tip by
 * the time its own gate reached the rebuild:
 *
 *     ✓ clean, and identical to origin/main at dcf496e
 *     # tests 1141 / # pass 1141 / # fail 0
 *     ✓ backups/productos-remote-20261016-144457.sql.gz (2.1M)
 *     → deploying dcf496e to productos-staging on 4100
 *     make[1]: *** [staging-guard] Error 1
 *
 * Green suite, backup taken, refused at the last step. Staging sat six PRs stale while every deploy
 * was refused for being out of date — the one failure mode the freshness rule existed to prevent,
 * reached by enforcing it. And the refusal's own message was TRUE, so it read as the guard working.
 *
 * ⛔ SO FRESHNESS MOVES FROM ENFORCED TO REPORTED, AND THE REPORT IS PINNED HERE. Being behind is
 * legitimate — it is how a bad cut gets rolled back — and unnoticed staleness is the thing that
 * actually costs: it is how a session reports a fix live that it never shipped. A warning nobody
 * asserts would be deleted by the next person who found it noisy, which is why the count is a
 * requirement and not a courtesy.
 *
 * What is NOT given up: unmerged code still cannot deploy, and the working tree must still be clean
 * on every path that reaches the image. Both are asserted below and in `v2-staging-serves-what-is-merged`,
 * where the condition is lifted out of the Makefile and driven against real repositories.
 */
test("the guard asks whether this is merged, and says so when it is not the tip", () => {
  const g = recipe("staging-guard");
  assert.match(g, /merge-base --is-ancestor HEAD origin\/main/, "the guard no longer asks whether this is merged at all");
  /**
   * ⛔ THE COUNT, NOT MERELY A WARNING. "this may not be the tip" is advice; a number is a fact that
   * differs between the two cases, and a reader can act on it. `rev-list --count` is what makes the
   * line unable to pass when it has nothing to report.
   */
  assert.match(g, /rev-list --count HEAD\.\.origin\/main/, "the guard cannot say HOW far behind it is");
  assert.match(g, /NOT the tip/, "being behind is no longer announced — stale deploys are silent again");
});

test("⛔ and it no longer refuses on being a worktree, which was the wrong question", () => {
  const g = recipe("staging-guard");
  assert.doesNotMatch(g, /this is a worktree/, "the proxy is back, and it refuses the deploy checkout");
  /** The reasoning has to survive in the file, or the next reader restores the proxy. */
  assert.match(mk, /THE QUESTION IS NOT "AM I A WORKTREE"/);
});

test("nothing reaches staging without the guard, and deploy adds build and the suite", () => {
  for (const t of ["up-remote", "rebuild-remote", "restart-remote", "deploy-check"])
    assert.match(mk, new RegExp(`^${t}:[^\\n]*\\bstaging-guard\\b`, "m"), `${t} can reach staging unguarded`);
  assert.match(mk, /^deploy: deploy-check$/m, "deploy skips the gate");

  const d = recipe("deploy-check");
  assert.match(d, /npm run build/, "a deploy that does not compile would be caught only by the container dying");
  assert.match(d, /migrations-check\.mjs/);

  /**
   * ⛔ THE SUITE MOVED OUT OF THE GATE AND INTO `suite-now`, AND THIS ASSERTION FOLLOWED IT.
   *
   * Running 600 tests inside the deploy is the strongest gate and does not finish here: ten minutes
   * idle, unbounded at load 102 with workers starved to 0.2% CPU, and killed twice for exceeding
   * what a single command may run. A gate that cannot finish stops 4100 being deployed at all,
   * which is worse than what it prevents.
   *
   * ⛔ SO IT IS ASSERTED, NOT SKIPPED, AND THE ASSERTION CARRIES A SHA. A bare `SKIP_TESTS=1` is a
   * flag somebody sets once and forgets; a sha cannot be stale without being wrong.
   */
  /**
   * ⛔ THE SUITE MUST BE BOUNDED, OR THE GATE DIES WITH NO OUTPUT AND NO VERDICT.
   *
   * `npm test` was `node --test test/*.test.mjs` with no per-test timeout, so a single test that
   * hangs takes the whole run with it — and because `suite-now` captures the output, a killed run
   * prints NOTHING. That ate four gate attempts in one session: killed, zero bytes, no failing test
   * named, nothing to act on. `v2-watch` was the one hanging, under load, and it took isolating it
   * file by file to find out.
   *
   * ⛔ A HANG AND A FAILURE ARE NOT THE SAME EVENT AND MUST NOT LOOK THE SAME. With a bound, the
   * same test reports `not ok - it says nothing until something is recorded, then says what` and
   * the run completes. Without one, the gate looks like infrastructure trouble and gets re-run.
   *
   * 300s per test against a slowest observed test of ~24s — roughly twelve times headroom, so load
   * does not turn a slow test into a red one, while a true hang is unbounded and still caught.
   */
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
  assert.match(
    pkg.scripts.test,
    /--test-timeout=\d+/,
    "npm test has no per-test timeout, so one hanging test kills the gate run with no output at all",
  );
  assert.ok(
    Number(/--test-timeout=(\d+)/.exec(pkg.scripts.test)[1]) >= 60000,
    "the bound is tight enough that a slow test on a loaded machine would read as a failure",
  );

  const suite = recipe("suite-now");
  assert.match(suite, /npm test/, "nothing runs the suite any more");
  assert.match(suite, /# fail 0/, "the suite's result is not actually checked");
  /**
   * ⛔ AND `# fail 0` ALONE IS A HOLE, BECAUSE A TIMEOUT IS COUNTED IN NEITHER TALLY.
   *
   *     not ok 1 - a test that never finishes
   *     # tests 1   # pass 0   # fail 0
   *
   * So the gate's original condition was satisfied by a suite containing a timed-out test, and it
   * would have reported green and deployed. Found while proving that the new `--test-timeout` turns
   * a hang into a verdict: it does, and the verdict was one the gate could not read.
   */
  /**
   * ⛔ ASSERTED ON THE CONDITION, NOT ON THE WORDS. A first attempt matched `/not ok/`, which the
   * recipe has always contained — the line that PRINTS the failures. It passed with the guard
   * removed, i.e. it tested nothing. The guard is the `grep -q` used as a test.
   */
  assert.match(
    suite,
    /grep -qE '\^not ok'/,
    "suite-now trusts the fail tally alone, which a timed-out test does not appear in",
  );

  assert.match(suite, /SUITE_VERIFIED=/, "suite-now does not print the assertion to paste, so the two halves will drift");

  assert.match(d, /suite-now/, "deploy-check neither runs the suite nor can accept an assertion for it");
  assert.match(d, /SUITE_VERIFIED/, "there is no way to assert a suite result");
  /** ⛔ And the assertion is refused unless it names the commit about to deploy. */
  assert.match(d, /rev-parse HEAD/, "the asserted sha is not compared against what would deploy");
  assert.match(d, /not evidence about this one/, "the refusal does not say why another commit's result will not do");

  /**
   * ⛔ A DEPLOY MUST ASK WHETHER THE LIVE SCRIPTS PARSE, BECAUSE NOTHING ELSE IT CHECKS CAN SEE IT.
   *
   * A string literal broken across two real lines inside a template string reaches the browser as
   * `Invalid or unexpected token`, and the browser abandons the whole script — every button on the
   * page dies at once. tsc is clean, the suite is green, `/health` is green, the status is 200 and
   * the markup is right. The only observable is a console error on load, which nobody watches.
   */
  const dep = recipe("deploy");
  assert.match(dep, /backup-remote/, "it deploys without backing the store up first");
  assert.match(dep, /live-scripts-parse/, "a deploy never asks whether the page's scripts parse");
  /**
   * ⛔ AND WHETHER THE PAGE IS TALKING ABOUT THE PRODUCT OR ABOUT THE TOOL. `state it with
   * \`splits_on\`` reached a reviewer. The suite had an assertion against exactly that and could not
   * reach the line — so this one runs against the page that went out.
   */
  assert.match(dep, /no-field-names-on-a-page/, "a deploy never asks whether a field name reached a reader");
  /**
   * ⛔ AND WHETHER THE PAGE CAN REACH ITS OWN ENDPOINTS. Every write from a hosted page 404d for as
   * long as the hosted page existed — a root-relative url loses the project, and the LOCAL stack
   * serves at the root, where the defect cannot occur. So every path anybody tests against is the
   * one that works, and only the served page can answer.
   */
  assert.match(dep, /page-can-reach-what-it-fetches/, "a deploy never asks whether the page's own urls resolve");
  /** ⛔ `--from`, so the page list is the instance's own answer rather than one somebody maintains. */
  assert.match(dep, /--from/, "the script check runs against a hand-written page list, which goes stale");
  assert.match(dep, /remote-doctor/, "nothing reads the store after the deploy");
  /** ⛔ After, not before: a deploy healthy against a half-migrated store is the failure to catch. */
  assert.ok(dep.indexOf("rebuild-remote") < dep.indexOf("remote-doctor"), "the store is read before the deploy lands");
});

test("⛔ the image can be built from the commit — the lockfile is in it", () => {
  /**
   * `package-lock.json` was gitignored, in a generic "Node / TS" block — the boilerplate pattern for
   * a LIBRARY. This project ships a Dockerfile that does `COPY package.json package-lock.json ./`
   * and then `npm ci`, which refuses to run without a lockfile. So the image could not be built from
   * a commit at all: a fresh clone has no lockfile, the COPY fails, and the build dies. It worked
   * only on machines that happened to have one lying around.
   *
   * ⛔ AND THE DOCKERFILE'S OWN STATED INVARIANT WAS UNENFORCEABLE. It says the image is a pure
   * function of the lockfile — while the lockfile was not in the commit the image claims to be a
   * function of. Two people building the same commit could get different images and nothing would
   * say so.
   *
   * Found by a git worktree being unable to `npm install`: the deploy checkout had no lockfile and
   * no node_modules, and `npm run build` appeared to work only because node resolved tsc by walking
   * up to the main checkout's modules.
   */
  const tracked = execFileSync("git", ["ls-files", "package-lock.json"], { encoding: "utf-8" }).trim();
  assert.equal(tracked, "package-lock.json", "⛔ the lockfile is not in the commit, so the image cannot be rebuilt from it");

  const ignored = (() => {
    try {
      execFileSync("git", ["check-ignore", "-q", "package-lock.json"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();
  assert.equal(ignored, false, "the lockfile is gitignored again");

  /** ⛔ And the Dockerfile must still be the thing that depends on it, or this test guards nothing. */
  const dockerfile = fs.readFileSync("Dockerfile", "utf-8");
  assert.match(dockerfile, /COPY package\.json package-lock\.json/);
  assert.match(dockerfile, /npm ci/, "the image no longer installs from the lock, so this assertion is stale");

  /** ⛔ The build context must carry it. The allowlist in .dockerignore is easy to forget. */
  const di = fs.readFileSync(".dockerignore", "utf-8");
  assert.match(di, /^!package-lock\.json$/m, "the lockfile is excluded from the build context");
});
