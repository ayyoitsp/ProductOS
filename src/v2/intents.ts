/**
 * One way in, and what each thing somebody can say is allowed to do.
 *
 * ⛔ FIVE WRITE ROUTES BECAME ONE INPUT, AND THE GATES DID NOT MOVE.
 *
 * Peter: *"don't we have a 'generic' way to message the system? and have it do whatever is needed?
 * why do we need so many endpoints?"* and then *"the generic door can mint consent - it's a human
 * input. yes, add a single input, get rid of the specific commands. the input should still route to
 * the right subsystem"*.
 *
 * He is right, and the objection I raised was confused. I argued a generic door would let a model's
 * request arrive wearing a person's authority — but **the gate was never the route**. `mayRecord`
 * takes the PRINCIPAL and the claimed `via`, and refuses a token claiming a person pressed
 * something, whichever path the request came down. Collapsing `/act`, `/carry`, `/note`, `/say` and
 * `/close` into one input moves dispatch, not authority.
 *
 * So the endpoint count was never one-per-feature; it was one-per-authority, with the authority
 * duplicated into each route's first ten lines. This is the authority declared once, per intent,
 * and the dispatch made uniform.
 *
 * ⛔ THE INTENT IS NAMED, NEVER INFERRED. `CLAUDE.md` is explicit about the shape: *"The tag sets
 * `Note.kind`; nothing infers it. A classifier reading the sentence would be a guess wearing a
 * decision's clothes."* That rule is about routing a note by its kind, and it binds harder here —
 * a classifier that mis-reads a sentence as `accept` mints consent nobody gave. A caller says which
 * intent it means, and an unknown one is refused with the list.
 */
import { perform, payloadFrom, VIA, ACTS, type Act, type Via } from "./acts.js";
import { closeNote, fileNote, replyToNote } from "./notes.js";
import { mayRecord, mayRelay, type Principal } from "./identity.js";
import fs from "node:fs";
import path from "node:path";
import { CORPUS_DIRS } from "./load.js";
import { append } from "./log.js";

export interface Outcome {
  ok: boolean;
  said?: string;
  why?: string;
  detail?: string[];
}

/**
 * ⛔ FOUR AUTHORITIES, AND THEY ARE THE REASON THERE WERE EVER SEPARATE ROUTES.
 *
 *  - `consent` — a person agreed. ⛔ `mayRecord` refuses a token claiming this however it asks.
 *  - `relay`   — carrying somebody else's press, recording who carried it. Never becoming them.
 *  - `author`  — this principal's own words. Claims nothing about what anybody agreed to.
 *  - `open`    — anyone looking at the page may do it.
 */
export type Gate = "consent" | "relay" | "author" | "open";

export interface Asking {
  /** The corpus being spoken to. */
  dir: string;
  who: Principal;
  /** Who to record when nothing authenticated — a local page press. */
  pressing: string;
}

export interface Intent {
  name: string;
  gate: Gate;
  does: string;
  run: (a: Asking, body: Record<string, unknown>) => Outcome;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * One act, as an intent of its own.
 *
 * ⛔ ONE INTENT PER ACT RATHER THAN AN `act` INTENT CARRYING A NAME. `{intent: "accept"}` is the
 * thing somebody means; `{intent: "act", act: "accept"}` is the old route with its envelope kept,
 * which is the sprawl this replaced wearing a different shape.
 *
 * ⛔ AND NO COUNT IN ANY SENTENCE HERE. `ACTS` holds six operations while `Verdict.kind` holds the
 * five acts — `withdraw` takes something out rather than recording a judgement. One name over two
 * concepts, and the refusals built from the list said "not one of the five acts", which is true
 * about the five and false about the list. A refusal lists what it will take instead.
 */
function theAct(act: Act): Intent {
  return {
    name: act,
    gate: "consent",
    does: `Record that somebody ${act === "accept" ? "agreed to" : act === "rule" ? "settled" : act === "read" ? "read" : act === "defer" ? "parked" : "waived"} something`,
    run: (a, body) => {
      const via = (typeof body.via === "string" ? body.via : "page") as Via;
      if (!VIA.includes(via))
        return { ok: false, why: `"${via}" is not a way consent could have been obtained`, detail: [VIA.join(" · ")] };
      /**
       * ⛔ A BROWSER PRESS IS RECORDED AS THE ACCOUNT THE INSTANCE AUTHENTICATED, not as a name the
       * request asked for. `by` from the wire was the last thing here anybody could forge.
       */
      const by = a.who.kind === "browser" ? a.who.actor : str(body.by) || a.who.actor;
      return perform(a.dir, act, payloadFrom(act, str(body.ref), body), { by, via });
    },
  };
}

export const INTENTS: Intent[] = [
  ...ACTS.map(theAct),
  {
    name: "carry",
    gate: "relay",
    does: "Carry a press made somewhere this instance could not see, keeping whose it was",
    run: (a, body) => {
      const act = str(body.act) as Act;
      if (!ACTS.includes(act))
        return { ok: false, why: `"${body.act}" is not an act`, detail: [ACTS.join(" · ")] };
      const via = str(body.via) as Via;
      if (!VIA.includes(via)) return { ok: false, why: `"${via}" is not a way consent could have been obtained` };
      const by = str(body.by);
      if (!by)
        return {
          ok: false,
          why: "a carried press has to name who made it — that is the whole point of carrying it rather than recording it",
        };
      return perform(a.dir, act, payloadFrom(act, str(body.ref), body), { by, via, relayedBy: a.who.actor });
    },
  },
  {
    name: "note",
    gate: "open",
    does: "File a request against what this corpus says",
    run: (a, body) =>
      fileNote(a.dir, {
        about: str(body.about),
        says: str(body.says),
        by: str(body.by) || a.pressing,
        via: "page",
        at: new Date().toISOString().slice(0, 10),
      }),
  },
  /**
   * ⛔ AN INTENT, NOT AN ENDPOINT — and I said we needed an endpoint before the door existed.
   *
   * Peter: *"why do we need an endpoint to write a corpus doc?"* We do not. Every piece was already
   * here once the single input landed:
   *
   *  - the door — `/api/v2/in`
   *  - the authority — the `author` gate, which is this principal's own words and claims nothing
   *    about what anybody agreed to
   *  - the persistence — `writeBack` diffs `corpusFiles(dir)` against what the request was given
   *    and stores whatever moved, refusing with a 409 if somebody else moved it underneath
   *
   * So authoring against a hosted corpus needed fifteen lines, not a route. Which is the thing his
   * question about endpoint sprawl was about in the first place: a new capability should cost an
   * intent, and if it costs a route then the door is not doing its job.
   *
   * ⛔ `author`, NEVER `consent`. Writing a document is not somebody agreeing to it — the stamp is a
   * separate act, by a person, through its own intent. A corpus written this way arrives unaccepted
   * and `stampFor` says so, which is the whole of tenet 1 and the reason this gate is the quiet one.
   *
   * ⛔ AND IT IS THE CORPUS'S OWN SHAPE THAT DECIDES WHAT IS WRITABLE. `corpusFiles` is already the
   * one answer to "what is a corpus made of" — `load.ts` says it and `memoryStore` must agree with
   * it — so the key has to be something that enumerates. A path outside it would be written and
   * then silently dropped by `writeBack`, which is worse than a refusal.
   */
  {
    name: "document",
    gate: "author",
    does: "Write one document of the corpus — truth, a rule, a part, a reading",
    run: (a, body) => {
      const key = str(body.key);
      const says = typeof body.says === "string" ? body.says : "";
      if (!key) return { ok: false, why: "say which document", detail: [`e.g. truth/money.md`] };
      /**
       * ⛔ REFUSED RATHER THAN NORMALISED. `..` or an absolute path would write outside the corpus,
       * and a key the corpus does not enumerate would be written and thrown away by `writeBack`
       * with a cheerful ok.
       */
      if (key.includes("..") || key.startsWith("/") || path.isAbsolute(key))
        return { ok: false, why: `"${key}" leaves the corpus`, detail: ["a key is relative, inside one of the corpus's own directories"] };
      const dir = key.includes("/") ? key.slice(0, key.indexOf("/")) : "";
      if (!CORPUS_DIRS.includes(dir as (typeof CORPUS_DIRS)[number]))
        return {
          ok: false,
          why: `"${key}" is not part of a corpus`,
          detail: [CORPUS_DIRS.map((d) => `${d}/…`).join(" · "), "⛔ anything else would be written and then dropped"],
        };
      if (!says.trim()) return { ok: false, why: "a document with nothing in it is a deletion — say what it should hold" };
      const full = path.join(a.dir, key);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, says);
      /**
       * ⛔ IT ANNOUNCES, because `writeBack` deliberately synthesizes nothing: "a write path that
       * moves a document and says nothing is a gap in THAT path". Without this a role could rewrite
       * a feature and no session watching the log would hear.
       */
      append(a.dir, {
        kind: "corpus-changed",
        at: new Date().toISOString(),
        by: a.who.actor,
        via: "cli",
        ref: key,
        says: `wrote ${key}`,
      });
      return { ok: true, said: `wrote ${key}` };
    },
  },
  {
    name: "say",
    gate: "author",
    does: "Answer on a filed request without deciding it is finished",
    run: (a, body) => replyToNote(a.dir, str(body.note), str(body.by) || a.who.actor, str(body.says)),
  },
  {
    name: "close",
    gate: "author",
    does: "Answer a filed request and take it off the queue",
    run: (a, body) => closeNote(a.dir, str(body.note), str(body.outcome)),
  },
];

export const intentNamed = (name: string): Intent | undefined => INTENTS.find((i) => i.name === name);

/**
 * Whether this principal may do this, or why not.
 *
 * ⛔ ONE PLACE, SO A NEW INTENT CANNOT FORGET ITS GATE. Every route used to repeat its own check in
 * its first ten lines, which is how `/say` and `/close` ended up with the same fifteen lines of
 * refusal text twice and how a sixth route would have arrived with none.
 */
export function refuseIntent(intent: Intent, a: Asking, body: Record<string, unknown>): Outcome | null {
  switch (intent.gate) {
    case "consent": {
      /**
       * ⛔ THE BOUNDARY, UNCHANGED BY THE DOOR BEING GENERIC. A token asking to record `via: page`
       * is claiming a person agreed, and no person is holding a token. `mayRecord` reads the
       * principal, so it refuses whatever route the request arrived on — which is exactly why one
       * input is safe, and why I was wrong to argue otherwise.
       */
      const via = (typeof body.via === "string" ? body.via : "page") as Via;
      return mayRecord(a.who, via);
    }
    case "relay":
      return mayRelay(a.who);
    case "author":
      return a.who.scopes.includes("author")
        ? null
        : {
            ok: false,
            why: `this token may not ${intent.name === "close" ? "close a request" : "reply on a request"}`,
            detail: [`it holds: ${a.who.scopes.join(" · ") || "nothing"}`, "it needs `author`"],
          };
    case "open":
      return null;
  }
}

/** What an unknown intent is told, so a caller never has to read this file to find the list. */
export const theIntents = (): string[] => INTENTS.map((i) => i.name);
