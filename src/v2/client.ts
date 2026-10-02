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
  return dir;
}

export interface Outcome {
  ok: boolean;
  said?: string;
  why?: string;
  detail?: string[];
}

/** Record one of the five acts on the instance. ⛔ `via` travels; the instance decides if it may. */
export const act = (i: Instance, act: Act, ref: string, via: Via, extra: Record<string, unknown> = {}): Promise<Outcome> =>
  call(i, "/api/v2/act", { method: "POST", body: JSON.stringify({ act, ref, via, ...extra }) }) as Promise<Outcome>;

/**
 * Carry in a press this instance did not observe.
 *
 * ⛔ `by` and `via` are the PRESSER's. The instance stamps who carried it from the token, which is
 * the one identity a courier can honestly supply about itself.
 */
export const carry = (
  i: Instance,
  a: { act: Act; ref: string; by: string; via: Via } & Record<string, unknown>
): Promise<Outcome> => call(i, "/api/v2/carry", { method: "POST", body: JSON.stringify(a) }) as Promise<Outcome>;

export const note = (i: Instance, about: string, says: string, by?: string): Promise<Outcome> =>
  call(i, "/api/v2/note", { method: "POST", body: JSON.stringify({ about, says, by }) }) as Promise<Outcome>;

export const inbox = (i: Instance, o: { since?: number; claim?: string; limit?: number }): Promise<unknown> =>
  call(i, "/api/v2/inbox", { method: "POST", body: JSON.stringify(o) });

/** What a press would cover, before making it. ⛔ See the preview route — consent shown its object. */
export const preview = (i: Instance, act: Act, ref: string, extra: Record<string, unknown> = {}): Promise<unknown> =>
  call(i, "/api/v2/preview", { method: "POST", body: JSON.stringify({ act, ref, ...extra }) });

export const whoami = (i: Instance): Promise<unknown> => call(i, "/api/v2/whoami");

export const presence = (i: Instance): Promise<unknown> => call(i, "/api/v2/presence");
