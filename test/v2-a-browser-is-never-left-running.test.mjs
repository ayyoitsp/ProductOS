/**
 * ⛔ THE SUITE LEFT 378 CHROME PROCESSES HOLDING 19.9 GB, AND IT TOOK THE MACHINE DOWN TWICE.
 *
 * Both times the symptom was the Docker daemon: `docker ps` hanging past 120s, then answering
 * "cannot connect to the daemon", and the instance Peter reviews on going with it — *"uhm,
 * localhost:4100 is not responding..."*. Load 528, swap 35.3 GB of 36.9 used.
 *
 * ⛔ IT WAS NOT DOCKER AND NOT THE DEPLOY. It was this harness, across repeated suite runs by the
 * session doing the deploying. Diagnosing it as a Docker fault the first time cost a restart of
 * every stack on the machine and taught nothing.
 *
 * ⛔ AND `close()` WAS NEVER THE BUG — measured before changing anything: 10 processes while a page
 * is open, 0 after closing it. Which is why nobody had found this; the obvious path was correct.
 * The leak is every path that never REACHES close():
 *
 *   · `openPage` throwing AFTER the spawn — no debugging endpoint, or the WebSocket refusing. The
 *     caller receives an exception instead of a handle, so nothing can close what is already running.
 *   · a run interrupted or killed part-way — which is what red-checking a test does, repeatedly.
 *
 * `temp()` settled this shape for DIRECTORIES and its reasoning transfers exactly: *"a trailing
 * rmSync sits at the end of the test, so it is not reached when an assertion fails, and a red run
 * litters exactly like an unfixed one"*.
 *
 * ⛔ EVERY MEASUREMENT HERE RUNS IN A CHILD WITH ITS OWN `TMPDIR`, AND THE FIRST VERSION DID NOT.
 *
 * It counted every harness browser on the machine. `node --test` runs files in parallel, so other
 * files' browsers landed inside the before/after window and all three tests failed in the pack
 * while passing alone — a flake that reads as a product defect, and the exact thing the harness's
 * own `waitFor` comment warns about. A private TMPDIR makes the count name THIS test's browsers
 * and nothing else, so it is immune to whatever else is running.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { browserOrSkip } from "./support/chrome.mjs";

const HARNESS = new URL("./support/chrome.mjs", import.meta.url).pathname;

/** Processes running against a profile under this directory, and nothing else on the machine. */
const running = (where) => {
  try {
    return Number(execSync(`pgrep -f "user-data-dir=${where}" | wc -l`).toString().trim());
  } catch {
    return 0;
  }
};

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait until nothing is left under `where`, and report how many were if the wait runs out.
 *
 * ⛔ A FIXED SETTLE WAS A TIMING CLAIM ABOUT THE MACHINE, and it failed as one: 3000ms was ample
 * alone and left 2 processes still dying inside a full parallel suite. Reaping is asynchronous —
 * the hook sends SIGKILL and the kernel takes as long as it takes — so the thing to assert is that
 * it EVENTUALLY reaches zero, not that it has at some instant somebody picked.
 *
 * ⛔ And it still discriminates: with the hook removed nothing ever reaps, so this spends the whole
 * deadline and then fails with the count — which is the red-check it has to keep passing.
 */
const gone = async (where, ms = 45000) => {
  const until = Date.now() + ms;
  let n = running(where);
  while (n > 0 && Date.now() < until) {
    await settle(500);
    n = running(where);
  }
  return n;
};

/** A child node process with its own TMPDIR, so every browser it starts is attributable to it. */
function child(script, tmp) {
  return spawn(process.execPath, ["--input-type=module", "-e", script], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, TMPDIR: tmp },
  });
}

const waitForLine = (kid, needle, ms) =>
  new Promise((resolve, reject) => {
    let out = "";
    const give = setTimeout(() => reject(new Error(`never printed ${needle}: ${out.slice(0, 300)}`)), ms);
    kid.stdout.on("data", (d) => {
      out += d.toString();
      if (out.includes(needle)) {
        clearTimeout(give);
        resolve(out);
      }
    });
    kid.stderr.on("data", (d) => (out += d.toString()));
    kid.on("exit", (c) => {
      clearTimeout(give);
      reject(new Error(`exited early (${c}): ${out.slice(0, 400)}`));
    });
  });

test("a browser is reaped when its page is closed, children and all", async () => {
  if (!browserOrSkip()) return;
  const tmp = temp("reap-closed-");
  const kid = child(
    `const { openPage } = await import("${HARNESS}");
     const page = await openPage("<!doctype html><p>one</p>");
     await page.evaluate("1+1");
     console.log("OPEN:" + ${JSON.stringify("")} );
     await new Promise((r) => setTimeout(r, 1500));
     await page.close();
     console.log("CLOSED");`,
    tmp
  );
  await waitForLine(kid, "OPEN:", 180000);
  /**
   * ⛔ A NON-ZERO FIRST, OR THE ZERO BELOW IS NOT A CHECK. Chrome forks several processes per
   * browser; a 1 would leave the cascade untested and a 0 would mean this is reading the wrong
   * thing — "a zero proves nothing unless you can say what a failing zero looks like".
   */
  const open = running(tmp);
  assert.ok(open >= 2, `one browser accounts for ${open} processes under its own TMPDIR — not measuring Chrome`);

  await waitForLine(kid, "CLOSED", 30000).catch(() => {});
  await new Promise((r) => kid.once("exit", r));
  assert.equal(await gone(tmp), 0, "processes outlived close()");
});

test("⛔ a browser that fails to start is reaped too — the path that leaked most", async () => {
  if (!browserOrSkip()) return;
  const tmp = temp("reap-failed-");
  /**
   * ⛔ A FAKE BROWSER THAT STARTS AND NEVER REPORTS AN ENDPOINT, and the first version of this test
   * did not discriminate at all.
   *
   * It passed `process.execPath`, which exits immediately — so nothing lingered whether or not the
   * reaping existed, and removing the reaping left the test green. A test that cannot fail is not
   * evidence, which is the rule this file is otherwise built on.
   *
   * So: a process that LIVES, prints nothing, and is handed the same argv Chrome would get. The
   * endpoint wait times out, `openPage` throws, and the only thing that can stop this process
   * outliving the run is openPage reaping on its way out.
   */
  const fake = path.join(tmp, "fake-browser");
  fs.writeFileSync(fake, "#!/bin/sh\nwhile :; do sleep 1; done\n");
  fs.chmodSync(fake, 0o755);
  const kid = child(
    `const { openPage } = await import("${HARNESS}");
     try {
       await openPage("<!doctype html><p>two</p>", { exe: ${JSON.stringify("")} || ${JSON.stringify(fake)} });
       console.log("NO-THROW");
     } catch (e) {
       console.log("THREW:" + e.message.slice(0, 60));
     }`,
    tmp
  );
  const out = await waitForLine(kid, "THREW", 180000);
  assert.match(out, /THREW/, "the launch was expected to fail");
  /**
   * ⛔ THE CHILD IS KILLED RATHER THAN WAITED FOR, and waiting is what made the red-check HANG
   * instead of fail.
   *
   * With the reaping removed, the un-reaped process holds the child's stdio pipes open, so the child
   * never exits and a test awaiting its exit waits forever. A hang is the worst possible failure
   * report: it looks like an infrastructure problem and says nothing about the defect.
   *
   * SIGKILL also makes the measurement stricter — it skips the child's own exit hook, so the only
   * thing that can have reaped the process is openPage's catch, which is what this test is about.
   */
  kid.kill("SIGKILL");
  /** ⛔ Counted by the profile path, which the fake receives in its argv exactly as Chrome would. */
  assert.equal(await gone(tmp), 0, "a failed launch left its process behind — the leak that reached 378");
});

test("⛔ an interrupted run reaps on its way out, because that is the run that leaks hardest", async () => {
  if (!browserOrSkip()) return;
  const tmp = temp("reap-killed-");
  /**
   * The child opens a browser and is then killed — no `finally`, no `close()`, exactly what happens
   * when somebody stops a suite part-way. The exit hook is the only thing that can save it, so this
   * is the test that would have prevented today.
   *
   * ⛔ SIGTERM, NOT SIGKILL. Nothing can run a handler through SIGKILL, so no implementation could
   * ever pass that; SIGTERM is what a runner, a CI cancel and Ctrl-C actually send.
   */
  const kid = child(
    `const { openPage } = await import("${HARNESS}");
     const page = await openPage("<!doctype html><p>three</p>");
     await page.evaluate("1+1");
     console.log("READY");
     await new Promise(() => {});`,
    tmp
  );
  /**
   * ⛔ A GENEROUS BUDGET, BECAUSE THIS WAITS ON A BROWSER STARTING INSIDE A FULL SUITE. At 60s it
   * passed alone and timed out in the pack, which is precisely what the harness's own `waitFor`
   * comment warns about: *"15s is a claim about the MACHINE and not about the page"*. A reap test
   * that flakes under load is worse than none — it reads as the leak coming back.
   */
  await waitForLine(kid, "READY", 180000);
  assert.ok(running(tmp) >= 2, "the child did not actually start a browser");

  kid.kill("SIGTERM");
  await new Promise((r) => kid.once("exit", r));
  assert.equal(await gone(tmp), 0, "processes survived an interrupted run — the hook did not reap");
});

test("⛔ a failed launch gives its slot back, or three of them deadlock the suite", async () => {
  if (!browserOrSkip()) return;
  /**
   * ⛔ THE BUG THAT ONLY EXISTS IN THE MERGE OF TWO CORRECT CHANGES.
   *
   * The cap (`browser-slots.mjs`) takes a permit before the spawn and frees it in `close()`. The
   * reaping above frees the PROCESS on the way out of a failed launch. Composed naively, a launch
   * that throws reaps the process and keeps the permit forever — so at a cap of three, three failed
   * launches leave every later browser test waiting on permits nobody holds.
   *
   * ⛔ A DEADLOCK IS THE LEAST DIAGNOSABLE FAILURE THERE IS: the suite simply stops, with no
   * assertion to read. So it is pinned by COUNTING PERMITS rather than by waiting to see whether the
   * next caller gets one — the slow version of this test would be indistinguishable from a hang.
   */
  const tmp = temp("reap-slot-");
  const held = () => {
    const home = path.join(tmp, "productos-browser-slots");
    try {
      return fs.readdirSync(home).length;
    } catch {
      return 0;
    }
  };
  const fake = path.join(tmp, "fake-browser");
  fs.writeFileSync(fake, "#!/bin/sh\nwhile :; do sleep 1; done\n");
  fs.chmodSync(fake, 0o755);

  const kid = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const { openPage } = await import("${HARNESS}");
       try { await openPage("<p>x</p>", { exe: ${JSON.stringify(fake)} }); console.log("NO-THROW"); }
       catch (e) { console.log("THREW"); }`,
    ],
    { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, TMPDIR: tmp, PRODUCTOS_BROWSER_SLOTS: "1" } }
  );
  await waitForLine(kid, "THREW", 180000);
  kid.kill("SIGKILL");
  await settle(1500);
  assert.equal(held(), 0, `${held()} permit(s) still held after a launch that threw — at a cap of 1 the next browser test waits forever`);
});
