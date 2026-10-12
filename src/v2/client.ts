/**
 * ⛔ `--at` TAKES AN INSTANCE AS WELL AS A DIRECTORY, AND REFS DO NOT CHANGE.
 *
 * `<scope>#<view>#<slot>#<id>` is already instance-independent, which is why this is a CLIENT change
 * and not a model change. Nothing about what a corpus says depends on where it is kept.
 *
 *     --at ./v2                          a directory
 *     --at https://x.productos.dev/cre   an instance, and a corpus on it
 *
 * ⛔ IT REFUSES RATHER THAN FALLING BACK. An instance that cannot be reached must never degrade into
 * reading whatever happens to be on this disk: two people would then be agreeing to two different
 * corpora, both reporting ✓, and the divergence would surface weeks later as a stamp over a sentence
 * nobody recognises. "The truth is elsewhere and I cannot reach it" is a worse day and a better
 * outcome.
 *
 * ⛔ AND READING IS A CACHE, NOT A COPY. A read command mirrors the instance into a temporary
 * directory, uses it, and throws it away. Nothing is ever written back into it — every act goes to
 * the instance over HTTP — so there is no second place a corpus can be edited.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CORPUS_DIRS } from "./load.js";
import type { Act, Via } from "./acts.js";

export const looksLikeInstance = (at: string | undefined): boolean => /^https?:\/\//i.test(at ?? "");

export interface Instance {
  url: string;
  token?: string;
}

/** ⛔ The trailing slash is stripped once, here, so no caller builds a URL with two of them. */
export function instanceOf(at: string, token?: string): Instance {
  return { url: at.replace(/\/+$/, ""), token: token || process.env.PRODUCTOS_TOKEN || undefined };
}

export class Unreachable extends Error {
  constructor(readonly url: string, readonly cause: unknown) {
    super(
      `cannot reach the instance at ${url} — the truth is there, not here\n` +
        `  ${cause instanceof Error ? cause.message : String(cause)}\n` +
        `  ⛔ nothing has been read from this machine instead. A local corpus standing in for an ` +
        `unreachable one is how two people agree to two different things and both see a tick.`
    );
  }
}

const headers = (i: Instance): Record<string, string> => ({
  "content-type": "application/json",
  ...(i.token ? { authorization: `Bearer ${i.token}` } : {}),
});

async function call(i: Instance, route: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${i.url}${route}`, { ...init, headers: headers(i) });
  } catch (e) {
    throw new Unreachable(i.url, e);
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /** ⛔ An HTML error page parsed as "no" is a refusal nobody can act on. Say what came back. */
    throw new Error(`${i.url}${route} answered ${res.status} with something that is not JSON:\n  ${text.slice(0, 200)}`);
  }
  if (!res.ok && res.status !== 422) {
    const why = (body as { why?: string }).why ?? `${res.status}`;
    const detail = (body as { detail?: string[] }).detail ?? [];
    throw new Error([why, ...detail.map((d) => `  ${d}`)].join("\n"));
  }
  return body;
}

/**
 * Mirror an instance's corpus into a scratch directory and return it.
 *
 * ⛔ SCRATCH, AND NAMED SO. Anything that looks like a working copy invites somebody to edit it, and
 * an edit there is a change nothing will ever carry back — a note filed against a corpus that does
 * not know about it.
 */
/**
 * ⛔ WHAT A MIRROR IS, LEFT IN THE MIRROR — because the thing that reads it next may not be a
 * command.
 *
 * `openAt` already says a mirror is "a cache of a read, not a working copy", and every ProductOS
 * write path refuses an instance URL through `refuseUrl`. Neither protects the case that actually
 * loses work: a ROLE is handed this directory and writes into it with the host's own Write and Edit
 * tools. ProductOS cannot intercept those. The role succeeds, reports what it wrote, the scratch
 * directory is reaped, and the work is gone with no error anywhere.
 *
 * ⛔ SO THE GUARD IS THE FILESYSTEM, NOT A CHECK. A check is something a writer has to call, and
 * the writer here is somebody else's tool. Read-only permissions are enforced by the OS against
 * every writer there will ever be, and they fail loudly — `EACCES` naming this path — which is the
 * whole difference from the silent version.
 */
export const MIRROR_MARKER = "THIS-IS-A-MIRROR.md";

/** Whether a directory is a throwaway read of an instance rather than a corpus anybody owns. */
export function isMirror(dir: string): boolean {
  return fs.existsSync(path.join(dir, MIRROR_MARKER));
}

/**
 * Mark a directory as a mirror and make its documents unwritable.
 *
 * ⛔ EXPORTED SO THE GUARD ITSELF CAN BE TESTED, and that is not a convenience. The first test for
 * this built its own mirror and chmod'd the fixture, so deleting the lock from `mirror()` left it
 * green — a test asserting that `chmod` works rather than that this code calls it. Reaching the
 * real `mirror()` needs a running instance, which would make the guard skip on every machine
 * without one. So the mechanism is one function, the test calls it, and a source assertion holds
 * `mirror()` to calling it.
 */
export function lockMirror(dir: string, from: string): void {
  /**
   * ⛔ A SENTENCE A PERSON OR A ROLE READS BEFORE THEY TRY, because a permission error alone says
   * only that something is read-only — not that the truth lives somewhere else and what to do
   * instead.
   */
  fs.writeFileSync(
    path.join(dir, MIRROR_MARKER),
    [
      "# This is a mirror, not a corpus",
      "",
      `A read of ${from}, taken for one command and about to be thrown away.`,
      "",
      "⛔ **Do not write here.** Nothing written in this directory reaches the instance, and this",
      "directory is deleted without being read. The files are deliberately read-only so that an",
      "attempt fails loudly instead of quietly succeeding and losing the work.",
      "",
      "The truth is on the instance. To change it:",
      "",
      "- a human act — accept, rule, read, defer, waive — goes over HTTP: `productos v2 accept <ref> --at <url>`",
      "- an answer on a filed request — `productos v2 notes say` / `notes done --at <url>`",
      "- ⛔ authoring a scope, a part or a requirement has no instance path yet. Export the corpus,",
      "  work in that directory, and import it back:",
      "",
      "```",
      `productos hosted export <projectId> --out ./corpus`,
      "# work there",
      "productos hosted import ./corpus --into <projectId>",
      "```",
      "",
      "*(Written by `mirror()` in src/v2/client.ts — see the note there for why this is enforced by",
      "file permissions rather than by a check.)*",
      "",
    ].join("\n")
  );
  /**
   * ⛔ READ-ONLY, FILES ONLY. The directories stay writable: making them read-only would stop the
   * reaper removing the scratch tree, and a mirror that cannot be cleaned up is a different bug.
   * What has to fail is editing a document somebody mistook for the corpus.
   */
  const lock = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) lock(full);
      else fs.chmodSync(full, 0o444);
    }
  };
  lock(dir);
}

export async function mirror(i: Instance): Promise<string> {
  const body = (await call(i, "/api/v2/corpus")) as { files?: Record<string, string> };
  const files = body.files ?? {};
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "productos-instance-")), "corpus");
  for (const sub of CORPUS_DIRS) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  lockMirror(dir, i.url);
  return dir;
}

export interface Outcome {
  ok: boolean;
  said?: string;
  why?: string;
  detail?: string[];
}

/**
 * Record one of the acts on the instance. ⛔ `via` travels; the instance decides if it may.
 *
 * ⛔ THE ACT IS THE INTENT. `{intent: "accept"}` rather than `{intent: "act", act: "accept"}` —
 * keeping an envelope inside the envelope would be the five old routes wearing a new shape.
 */
export const act = (i: Instance, act: Act, ref: string, via: Via, extra: Record<string, unknown> = {}): Promise<Outcome> =>
  say_(i, act, { ref, via, ...extra });

/**
 * Carry in a press this instance did not observe.
 *
 * ⛔ `by` and `via` are the PRESSER's. The instance stamps who carried it from the token, which is
 * the one identity a courier can honestly supply about itself.
 */
/**
 * Say one thing to an instance.
 *
 * ⛔ ONE DOOR, AND THE NAMED INTENT IS WHAT ROUTES IT. Peter: *"add a single input, get rid of the
 * specific commands. the input should still route to the right subsystem"*. Five client functions
 * used to hold five URLs; they hold one, and the thing being asked for travels in the body where
 * the registry can dispatch on it.
 *
 * ⛔ The intent is never inferred from the words. See `intents.ts` — a classifier mis-reading a
 * sentence as `accept` would mint consent nobody gave.
 */
const say_ = (i: Instance, intent: string, body: Record<string, unknown>): Promise<Outcome> =>
  call(i, "/api/v2/in", { method: "POST", body: JSON.stringify({ intent, ...body }) }) as Promise<Outcome>;

export const carry = (
  i: Instance,
  a: { act: Act; ref: string; by: string; via: Via } & Record<string, unknown>
): Promise<Outcome> => say_(i, "carry", a);

export const note = (i: Instance, about: string, says: string, by?: string): Promise<Outcome> =>
  say_(i, "note", { about, says, by });

export const inbox = (i: Instance, o: { since?: number; claim?: string; limit?: number }): Promise<unknown> =>
  call(i, "/api/v2/inbox", { method: "POST", body: JSON.stringify(o) });

/**
 * ⛔ THE REPLY, OVER THE WIRE. `notes say` had no remote branch, so against an instance it read the
 * local directory called `v2` and either failed or — worse — replied in the wrong corpus.
 */
export const say = (i: Instance, note: string, says: string, by?: string): Promise<Outcome> =>
  say_(i, "say", { note, says, by });

/**
 * The conversation on an instance — what was asked, and what has been said back.
 *
 * ⛔ READING IT HAD NO REMOTE PATH EITHER, so `notes --at <url>` parsed a URL as a directory. A
 * listener that cannot list what is waiting on the instance it is listening to is not listening.
 */
export const thread = (i: Instance, about?: string[]): Promise<unknown> =>
  call(i, `/api/v2/thread${about?.length ? `?about=${encodeURIComponent(about.join("|"))}` : ""}`);

/** ⛔ And the close, for the same reason: until it is closed the request comes back on every poll. */
export const close = (i: Instance, note: string, outcome: string): Promise<Outcome> =>
  say_(i, "close", { note, outcome });

/** What a press would cover, before making it. ⛔ See the preview route — consent shown its object. */
export const preview = (i: Instance, act: Act, ref: string, extra: Record<string, unknown> = {}): Promise<unknown> =>
  call(i, "/api/v2/preview", { method: "POST", body: JSON.stringify({ act, ref, ...extra }) });

export const whoami = (i: Instance): Promise<unknown> => call(i, "/api/v2/whoami");

export const presence = (i: Instance): Promise<unknown> => call(i, "/api/v2/presence");
