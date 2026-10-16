/**
 * ⛔ AN ACT, PERFORMED WITHOUT A SHELL — because a shell is now exactly what cannot agree.
 *
 * Four test files used to drive `accept`, `rule`, `read`, `waive` and `defer` by spawning the CLI,
 * because that was the shortest way to charge every floor each act charges. It was also, precisely,
 * the forgery `principalAtTheShell` closes: a human `via` recorded from a shell nobody was standing
 * at. Those invocations did not stop working by accident — they were the hole.
 *
 * ⛔ AND THIS IS NOT THE HATCH THAT WAS ARGUED AGAINST. There is no flag and no variable that makes
 * a shell into a person; what this does is call the act module in process, which is the position
 * `serve.ts` is already in — a caller that establishes its own principal rather than one typing at
 * a terminal. `perform` is the act; the CLI is a printer in front of it, and the gate is on who is
 * holding the printer.
 *
 * ⛔ What is therefore NOT covered here, and is covered by the pty case in
 * `v2-an-agents-shell-cannot-agree`: that the CLI itself still lets a person at a terminal through.
 */
import { perform, payloadFrom } from "../../dist/v2/acts.js";

/** One act, with the outcome returned however it went — for the cases asserting a REFUSAL. */
export const press = (dir, act, ref, body = {}, consent = {}) =>
  perform(dir, act, payloadFrom(act, ref, body), { by: "a-person", via: "cli", ...consent });

/**
 * One act that is expected to land. ⛔ Throws the refusal's own words, because the failure these
 * replace — `execFileSync` on a non-zero exit — carried the message, and a bare "it refused" in a
 * stack trace is the thing that makes a red run take an hour.
 */
export function pressed(dir, act, ref, body = {}, consent = {}) {
  const r = press(dir, act, ref, body, consent);
  if (!r.ok) throw new Error([`${act} ${ref} was refused: ${r.why}`, ...(r.detail ?? [])].join("\n    "));
  return r;
}
