import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/**
 * ⛔ DETECTION LANDED AND THE REMEDY DID NOT, WHICH IS WORSE IN ONE SPECIFIC WAY.
 *
 * `/health` reports a project whose write is stuck, with its age. Twice in one day that fired
 * correctly — `{"ok":false,"writes":"stuck","because":"prj-… has had a write running for 1850s"}` —
 * and nothing acted on it: `RestartPolicy: no`, `RestartCount: 0`, the probe failing every 30s. A
 * signal that looks like it will self-heal and does not is a worse position than no signal, because
 * it can be trusted.
 *
 * ⛔ AND DOCKER DOES NOT RESTART A CONTAINER FOR FAILING A HEALTHCHECK. An earlier commit of mine
 * said "Docker will restart on it" and that was wrong twice over: the policy was `no`, AND a
 * restart policy acts on the process EXITING rather than on health. The healthcheck only sets a
 * status an orchestrator may read; plain compose reads nothing.
 */

test("a write stuck past the deadline ends the process, and says so first", async () => {
  const { watchForAStuckWrite } = await import("../dist/v2/store/watchdog.js");

  const said = [];
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = (s) => { said.push(String(s)); return true; };
  let ended = null;
  try {
    const w = watchForAStuckWrite(1, 5, () => [{ project: "prj-x", seconds: 900 }], (c) => { ended = c; });
    await new Promise((r) => setTimeout(r, 40));
    w.stop();
  } finally {
    process.stderr.write = write;
  }

  assert.equal(ended, 1, "a write stuck past the deadline did not end the process");
  /** ⛔ The project and the age, or the restart reads as a crash. */
  assert.match(said.join(""), /prj-x/, "it does not say which project");
  assert.match(said.join(""), /900s/, "it does not say how long");
  assert.match(said.join(""), /restart policy/, "it does not say the restart is deliberate");
});

test("nothing stuck ends nothing", async () => {
  const { watchForAStuckWrite } = await import("../dist/v2/store/watchdog.js");
  let ended = null;
  const w = watchForAStuckWrite(1, 5, () => [], (c) => { ended = c; });
  await new Promise((r) => setTimeout(r, 40));
  w.stop();
  assert.equal(ended, null, "it ended the process with nothing stuck");
});

/**
 * ⛔ FIVE TIMES THE REFUSAL DEADLINE, NOT EQUAL TO IT. A waiter already gives up at 120s and says
 * why, which is the right first answer. Ending the process is for what has not moved in ten minutes.
 */
test("the exit deadline is far above the refusal deadline", () => {
  const boot = fs.readFileSync("src/v2/store/watchdog.ts", "utf-8");
  const exitAfter = Number(/EXIT_AFTER_MS\s*=\s*([\d_]+)/.exec(boot)?.[1]?.replace(/_/g, ""));
  const inst = fs.readFileSync("src/v2/store/instance.ts", "utf-8");
  const refuseAfter = Number(/WAIT_MS\s*=\s*([\d_]+)/.exec(inst)?.[1]?.replace(/_/g, ""));
  assert.ok(exitAfter > 0 && refuseAfter > 0, "one of the deadlines is not a number");
  assert.ok(
    exitAfter >= refuseAfter * 3,
    `exiting after ${exitAfter}ms against a refusal at ${refuseAfter}ms — a restart must not be the first answer`,
  );
});

/** ⛔ And the policy, because the watchdog exiting with no policy is a container that stays down. */
test("staging has a restart policy, or ending the process just ends it", () => {
  const compose = fs.readFileSync("docker-compose.remote.yml", "utf-8");
  const body = compose.replace(/^\s*#.*$/gm, "");
  assert.match(body, /restart:\s*(unless-stopped|always)/, "the staging service has no restart policy");
});
