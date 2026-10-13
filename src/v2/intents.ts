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
import { perform, payloadFrom, VIA, ACTS, OWED, ALSO, type Act, type Via } from "./acts.js";
import { closeNote, fileNote, replyToNote } from "./notes.js";
import { mayRecord, mayRelay, type Principal } from "./identity.js";
import fs from "node:fs";
import path from "node:path";
import { CORPUS_DIRS, loadCorpus } from "./load.js";
import { append } from "./log.js";
import { writePrototypes, writeWithin } from "./draw-write.js";
import { walkOf } from "./walk.js";
import { axesOf, answersOf } from "./schema.js";
import { doorOpensOn } from "./selection.js";

/** An axis id from its question, so nobody is asked to invent a slug for a sentence they just wrote. */
const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "split";

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

/**
 * One field an intent will read, in the words a caller should be shown.
 *
 * ⛔ DECLARED, BECAUSE `run` READING `body.x` IS NOT A CONTRACT ANYBODY ELSE CAN SEE.
 *
 * Every `run` below reaches into `body` by hand. That is fine for the page, which was written
 * beside it, and useless for everything else: an MCP bridge, a Slack relay or any second client
 * cannot learn what to send without reading this file, so each one hardcodes a copy and the copies
 * rot. `theIntents` already claimed to exist "so a caller never has to read this file to find the
 * list" — true of the names and false of everything that makes a name usable.
 */
export interface Field {
  name: string;
  /** What it is. Shown to whoever is being asked, so it is a sentence and not a type. */
  says: string;
  /** Refused when absent. ⛔ Enforced in `refuseIntent`, so this cannot drift into decoration. */
  required: boolean;
  /** A paragraph rather than a word, so a surface knows to offer a textarea. */
  long?: boolean;
  /** The length the schema will charge, said UP FRONT rather than as a refusal. */
  floor?: number;
  /** ⛔ This field's own words when it is absent, where they beat anything generic. */
  ifMissing?: string;
}

export interface Intent {
  name: string;
  gate: Gate;
  does: string;
  /** ⛔ What it reads. Generated into discovery and charged by `refuseIntent`. */
  takes: Field[];
  run: (a: Asking, body: Record<string, unknown>) => Outcome;
}

/** ⛔ Carried by every act, so no intent re-describes them and none forgets one. */
const REF: Field = { name: "ref", says: "What it is about — a scope, a slot or an exchange ref", required: true };
const VIA_F: Field = { name: "via", says: `How consent was obtained: ${VIA.join(" | ")}`, required: false };
const BY_F: Field = { name: "by", says: "Who it was — ignored for a browser press, which is recorded as the authenticated account", required: false };

/** `OWED` is what a person must be asked for; `ALSO` is what will be read if offered. */
const fieldsFor = (act: Act): Field[] => [
  REF,
  ...(OWED[act] ?? []).map((f) => ({ name: f.name, says: f.label, required: true, long: f.long, floor: f.floor })),
  ...(ALSO[act] ?? []).map((f) => ({ name: f.name, says: f.label, required: false, long: f.long })),
  VIA_F,
  BY_F,
];

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
    takes: fieldsFor(act),
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
    takes: [
      { name: "act", says: `Which act was pressed: ${ACTS.join(" | ")}`, required: true },
      REF,
      { name: "by", says: "⛔ Who actually pressed it. Required here — that is the whole point of carrying rather than recording", required: true },
      { name: "via", says: `How they pressed it: ${VIA.join(" | ")}`, required: true },
    ],
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
    takes: [
      {
        name: "about",
        says: "What they were looking at — a scope, or a ref down to the part. ⛔ Never inferred from the words: a request filed against the wrong thing is worse than one that asked",
        required: true,
      },
      { name: "says", says: "What should change, in their words", required: true, long: true },
      { name: "by", says: "Who is asking — defaults to whoever the instance authenticated", required: false },
    ],
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
    takes: [
      {
        name: "key",
        says: `Which document, relative to the corpus root — e.g. truth/money.md. One of: ${CORPUS_DIRS.join(" / ")}`,
        required: true,
        ifMissing: "say which document",
      },
      { name: "says", says: "The whole document. ⛔ Replaces it — this is not a patch", required: true, long: true },
    ],
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
  /**
   * ⛔ THE SPLIT IS SET FROM WHERE HE IS STANDING, NOT BY A COMMAND SOMEBODY ELSE RUNS.
   *
   * Peter, after I asked him what his prototypes split on and where a door went: *"again, why do you
   * fucking need to know this? I need you to make framework changes. I should be able to drive this
   * from the listener/input, right??? why could you possibly need this?"*
   *
   * He is right and the mistake was mine in a specific way: I built `v2 prototypes splits-on` and
   * `v2 prototypes new`, which require a session at a terminal in a checkout. He reviews in a
   * browser. So the capability existed and he could not reach it, and I turned that into a question
   * for him instead of a door — which is the whole shape of thing this project exists to stop.
   *
   * ⛔ `author`, NOT `consent`. Saying what a product's prototypes split on is somebody writing
   * product truth, not agreeing to it. Nothing here stamps.
   */
  {
    name: "splits-on",
    gate: "author",
    does: "Say what this product's prototypes are alternatives about — one axis, or several",
    takes: [
      {
        name: "axes",
        says: '⛔ The dimensions, in order, each with its values — e.g. [{"asks":"Role","values":["admin","loan processor"]},{"asks":"Product line","values":["CRE","private lending"]}]. A bare sentence still works and means one dimension with no values, which is a label rather than a selector',
        required: true,
      },
    ],
    run: (a, body) => {
      const raw = body.axes;
      /**
       * ⛔ ONE SENTENCE AND A LIST BOTH ARRIVE HERE, because a single axis is the common case and
       * making somebody write JSON for it would be a door nobody uses.
       */
      const axes: Array<{ id: string; asks: string; values: string[] }> = [];
      const parse = (v: unknown): void => {
        if (typeof v === "string") {
          const asks = v.trim();
          if (asks) axes.push({ id: slugify(asks), asks, values: [] });
          return;
        }
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const o = v as { id?: unknown; asks?: unknown; values?: unknown };
          const asks = str(o.asks).trim();
          if (!asks) return;
          /**
           * ⛔ THE VALUES COME WITH THE DIMENSION, because without them there is nothing to choose
           * between and the surface is a list of what exists rather than a selector. Peter: *"let's
           * allow users to specify their own dimensions ... and let them specify the values"*.
           *
           * ⛔ DEDUPED AND ORDER-KEPT. Two identical values make one dropdown entry unreachable,
           * and sorting them would reorder somebody's own list for no reason.
           */
          const values: string[] = [];
          if (Array.isArray(o.values))
            for (const raw of o.values) {
              const value = str(raw).trim();
              if (value && !values.includes(value)) values.push(value);
            }
          axes.push({ id: str(o.id).trim() || slugify(asks), asks, values });
        }
      };
      if (Array.isArray(raw)) for (const v of raw) parse(v);
      else parse(raw);
      if (!axes.length)
        return { ok: false, why: "say what they are alternatives about, in your own words", detail: ['e.g. "Which product line?"'] };
      /** ⛔ Two axes with one id would make a prototype's answers unaddressable. */
      const ids = new Set<string>();
      for (const ax of axes) {
        if (ids.has(ax.id))
          return { ok: false, why: `two axes called "${ax.id}"`, detail: ["each needs its own id — that is what a prototype's answers key on"] };
        ids.add(ax.id);
      }
      const corpus = loadCorpus(a.dir);
      writePrototypes(a.dir, corpus.prototypes, axes);
      append(a.dir, {
        kind: "corpus-changed",
        at: new Date().toISOString(),
        by: a.who.actor,
        via: "page",
        ref: "prototypes",
        says: `prototypes split on ${axes.map((x) => x.asks).join(" and ")}`,
      });
      const owed = corpus.prototypes.filter((p) => {
        const answers = answersOf(p.is, axes);
        return axes.some((ax) => !answers[ax.id]);
      });
      return {
        ok: true,
        said: `they split on ${axes.map((x) => x.asks).join(" and ")}`,
        detail: owed.length ? [`${owed.length} of ${corpus.prototypes.length} do not say where they sit yet: ${owed.map((p) => p.title).join(", ")}`] : [],
      };
    },
  },
  /**
   * ⛔ AND A PROTOTYPE ITSELF — declared, moved, or placed on the axes, from the page.
   *
   * Same reason as above. The door that was missing is not "run a command for me"; it is being able
   * to say *this one is the private-lending admin, and it opens here* while looking at the thing.
   */
  {
    name: "prototype",
    gate: "author",
    does: "Declare a way through the product, or say where an existing one sits",
    takes: [
      { name: "id", says: "Which prototype. A new id declares one; an existing id changes that one", required: true },
      { name: "title", says: "What to call it, in the words a reader would use. Required when declaring", required: false },
      { name: "startsAt", says: "The screen somebody comes in on, as <scope>#<view>", required: false },
      { name: "is", says: 'Where it sits, keyed by axis id — e.g. {"line":"private lending","role":"admin"}', required: false },
      { name: "shellFrom", says: "A route whose layouts are its chrome, where the codebase is reachable", required: false },
      {
        name: "remove",
        says: "⛔ Take this prototype back. A reviewer who declared one by mistake could otherwise never undo it — the one-way hole `within` had",
        required: false,
      },
    ],
    run: (a, body) => {
      const id = str(body.id).trim();
      if (!id) return { ok: false, why: "say which prototype" };
      const corpus = loadCorpus(a.dir);

      /**
       * ⛔ TAKING ONE BACK, BECAUSE DECLARING WITHOUT REMOVING IS A ONE-WAY DOOR.
       *
       * Found by the check for capabilities a reviewer cannot reach, on its first run — the same
       * class as `within` having a writer and no way to unsay it. Somebody who declares a prototype
       * by mistake, from a browser, with no terminal, had no route back at all.
       *
       * ⛔ IT IS NOT A TOMBSTONE, AND THAT IS NOT AN INCONSISTENCY. A prototype is a way through the
       * product, not a claim somebody agreed to: nothing points at its id, so there is nothing to
       * strand. Compare `exists: withdrawn` on a screen, which exists precisely because statements
       * DO point at it.
       */
      if (body.remove === true || str(body.remove) === "true") {
        const going = corpus.prototypes.find((p) => p.id === id);
        if (!going) return { ok: false, why: `no prototype "${id}" here` };
        writePrototypes(a.dir, corpus.prototypes.filter((p) => p.id !== id), corpus.splitsOn);
        append(a.dir, {
          kind: "corpus-changed",
          at: new Date().toISOString(),
          by: a.who.actor,
          via: "page",
          ref: `prototype:${id}`,
          says: `took back ${going.title}`,
        });
        const left = corpus.prototypes.length - 1;
        return {
          ok: true,
          said: `took back ${going.title}`,
          detail: [
            left
              ? `${left} way${left === 1 ? "" : "s"} through this product left`
              : "no prototypes left — nothing declares a front door now",
          ],
        };
      }
      const axes = axesOf(corpus.splitsOn, corpus.prototypes);
      const existing = corpus.prototypes.find((p) => p.id === id);
      const title = str(body.title).trim() || existing?.title;
      if (!title) return { ok: false, why: `"${id}" is new, so say what to call it`, detail: ["title"] };
      const startsAt = str(body.startsAt).trim() || existing?.starts_at;
      if (!startsAt) return { ok: false, why: `"${title}" needs a front door`, detail: ["startsAt, as <scope>#<view>"] };
      /**
       * ⛔ THE DOOR IS RESOLVED BEFORE ANYTHING IS WRITTEN, through the same predicate `check` uses.
       * A door onto nothing is refused at handover anyway; catching it here means the person who
       * typed it hears about it instead of the next reader who clicks it.
       */
      if (!doorOpensOn(corpus, startsAt))
        return {
          ok: false,
          why: `no screen "${startsAt}" in this corpus, so nothing can open on it`,
          detail: ["name it as <scope>#<view>"],
        };
      /** Answers merge, so saying the role does not wipe the product line. */
      const answers: Record<string, string> = { ...answersOf(existing?.is, axes) };
      const given = body.is;
      if (given && typeof given === "object" && !Array.isArray(given))
        for (const [k, v] of Object.entries(given as Record<string, unknown>)) {
          const value = str(v).trim();
          if (value) answers[k] = value;
          else delete answers[k];
        }
      else if (typeof given === "string" && given.trim() && axes[0]) answers[axes[0].id] = given.trim();

      const next = {
        id,
        title,
        starts_at: startsAt,
        ...(Object.keys(answers).length ? { is: answers } : {}),
        ...(str(body.shellFrom).trim() || existing?.shell_from ? { shell_from: str(body.shellFrom).trim() || existing?.shell_from } : {}),
        /** ⛔ The chrome and the menu are output, and they are kept — a placement is not a redraw. */
        ...(existing?.shell_html ? { shell_html: existing.shell_html } : {}),
        nav: existing?.nav ?? [],
        from: existing?.from ?? [],
      };
      const protos = existing
        ? corpus.prototypes.map((p) => (p.id === id ? next : p))
        : [...corpus.prototypes, next];
      writePrototypes(a.dir, protos, corpus.splitsOn);
      append(a.dir, {
        kind: "corpus-changed",
        at: new Date().toISOString(),
        by: a.who.actor,
        via: "page",
        ref: `prototype:${id}`,
        says: existing ? `moved ${title}` : `declared ${title}`,
      });
      const owed = axes.filter((ax) => !answers[ax.id]);
      return {
        ok: true,
        said: `${existing ? "changed" : "declared"} ${title}, opening on ${startsAt}`,
        detail: [
          ...(Object.keys(answers).length ? [axes.map((ax) => `${ax.asks} ${answers[ax.id] ?? "—"}`).join(" · ")] : []),
          ...(owed.length ? [`still says nothing about: ${owed.map((ax) => ax.asks).join(", ")}`] : []),
          /** ⛔ Said out loud: the chrome is drawn from a repository an instance does not have. */
          ...(next.shell_from && !next.shell_html ? ["its chrome is not drawn yet — that needs a checkout"] : []),
        ],
      };
    },
  },
  /**
   * ⛔ CONTAINMENT, FROM THE PAGE — THE SAME DEFECT AS THE SPLIT, ONE COMMAND LATER.
   *
   * `v2 inside` landed an hour after Peter said *"I should be able to drive this from the
   * listener/input, right??? why could you possibly need this?"*, and it is a CLI command: a
   * terminal, in a checkout, for a fact a person states while looking at the screen it is about.
   * Exactly the thing he had just corrected, written again.
   *
   * ⛔ WHICH SCREEN HOLDS WHICH IS THE RELATION A WALK IS BUILT FROM, so being unable to say it from
   * the page is what leaves a corpus at 15 front doors. A capability that cannot be reached from
   * where the person is standing is not a capability — the deploying session's words, and they are
   * right: it is a door onto nothing one level up.
   */
  {
    name: "inside",
    gate: "author",
    does: "Say which screen a screen appears inside — or take that back",
    takes: [
      { name: "view", says: "The screen that appears inside another, as <scope>#<view>", required: true },
      {
        name: "of",
        says: "The screen it appears inside, as <scope>#<view>. ⛔ Empty takes it back — the screen becomes its own way in again",
        required: false,
      },
    ],
    run: (a, body) => {
      const ref = str(body.view).trim();
      const of = str(body.of).trim();
      if (!ref) return { ok: false, why: "say which screen" };
      const corpus = loadCorpus(a.dir);
      const here = doorOpensOn(corpus, ref);
      if (!here) return { ok: false, why: `no screen "${ref}" in this corpus` };
      /** The scope that actually holds it, so a bare id still writes to the right file. */
      const holder = corpus.scopes
        .flatMap((e) => (e.scope.views ?? []).map((v) => ({ scope: e.scope.id, view: v })))
        .find((x) => `${x.scope}#${x.view.id}` === ref || x.view.id === ref);
      if (!holder) return { ok: false, why: `no screen "${ref}" in this corpus` };

      if (!of) {
        const file = writeWithin(a.dir, holder.scope, holder.view.id, "");
        if (!file) return { ok: false, why: `could not find "${ref}" to change` };
        append(a.dir, { kind: "corpus-changed", at: new Date().toISOString(), by: a.who.actor, via: "page", ref, says: `${here.title} is no longer inside anything` });
        return { ok: true, said: `${here.title} is its own way in again` };
      }

      if (!doorOpensOn(corpus, of)) return { ok: false, why: `no screen "${of}" in this corpus, so nothing can appear inside it` };
      if (of === ref || of === holder.view.id || `${holder.scope}#${holder.view.id}` === of)
        return { ok: false, why: "a screen cannot appear inside itself" };
      /**
       * ⛔ A LOOP IS REFUSED HERE, not discovered by the walk. Two screens each inside the other is
       * not a product, and a walk given one either loops or silently drops a step.
       */
      const chain = new Set<string>([`${holder.scope}#${holder.view.id}`, holder.view.id]);
      let up: string | undefined = of;
      while (up) {
        if (chain.has(up)) return { ok: false, why: `that would make a loop, through ${up}` };
        chain.add(up);
        const step: string = up;
        const qualified = step.includes("#");
        const scopePart = qualified ? step.split("#")[0] : undefined;
        const viewPart = qualified ? step.split("#")[1] : step;
        const found = corpus.scopes
          .flatMap((e) => (e.scope.views ?? []).map((x) => ({ scope: e.scope.id, view: x })))
          .find((x) => (scopePart ? x.scope === scopePart && x.view.id === viewPart : x.view.id === viewPart));
        up = found?.view.within;
      }

      const file = writeWithin(a.dir, holder.scope, holder.view.id, of);
      if (!file) return { ok: false, why: `could not find "${ref}" to write it into` };
      append(a.dir, { kind: "corpus-changed", at: new Date().toISOString(), by: a.who.actor, via: "page", ref, says: `${here.title} appears inside ${of}` });
      /** ⛔ The number that changed, because it is the point: a contained screen is not a front door. */
      const after = walkOf(loadCorpus(a.dir));
      return {
        ok: true,
        said: `${here.title} appears inside ${doorOpensOn(corpus, of)?.title ?? of}`,
        detail: [`${after.entries.length} way${after.entries.length === 1 ? "" : "s"} into this product now`],
      };
    },
  },
  {
    name: "say",
    gate: "author",
    does: "Answer on a filed request without deciding it is finished",
    takes: [
      { name: "note", says: "The request's id, as the inbox gave it to you", required: true },
      { name: "says", says: "What to tell them. Their surface, so write it for them and not for a changelog", required: true, long: true },
      { name: "by", says: "Who is replying", required: false },
    ],
    run: (a, body) => replyToNote(a.dir, str(body.note), str(body.by) || a.who.actor, str(body.says)),
  },
  {
    name: "close",
    gate: "author",
    does: "Answer a filed request and take it off the queue",
    takes: [
      { name: "note", says: "The request's id", required: true },
      {
        name: "outcome",
        says: 'What was actually done — including "we are not doing this". ⛔ A closed request with no account of what happened cannot be told from one somebody dropped',
        required: true,
        long: true,
      },
    ],
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
/**
 * Required fields a request has not supplied.
 *
 * ⛔ FALSY IS NOT ABSENT. `buildable: false` and `pick: 0` are answers. The first version refused
 * `pick: 0`, which is a drafted option somebody chose.
 *
 * ⛔ AND NEITHER IS BLANK. A whitespace `says` on `document` means "a deletion wearing a write", and
 * its own `run` says exactly that — a generic "needs `says`" here threw that away. Only the intent
 * knows what an empty answer MEANS, so an answer that was given reaches it, however thin.
 */
export const missingFrom = (intent: Intent, body: Record<string, unknown>): Field[] =>
  intent.takes.filter((f) => f.required && (body[f.name] === undefined || body[f.name] === null));

/**
 * ⛔ WHAT THE DOOR WILL TAKE, AS DATA — so no second client has to read this file.
 *
 * Generated from `INTENTS`, which is what stops it drifting: a new intent, or a field added to an
 * existing one, appears here without anybody remembering to say so. A hand-maintained copy of this
 * is exactly the dead end `OWED`'s own comment records happening twice — a refusal naming a remedy
 * the surface never offered.
 */
export const describeIntents = (): Array<{ name: string; does: string; gate: Gate; takes: Field[] }> =>
  INTENTS.map((i) => ({ name: i.name, does: i.does, gate: i.gate, takes: i.takes }));

/**
 * May this principal do this at all — and NOTHING about whether they said enough.
 *
 * ⛔ THE TWO QUESTIONS ARE SEPARATE, AND FOLDING THEM TOGETHER BROKE THREE TESTS THAT SAID SO.
 *
 * I made this charge the field contract too. `v2-one-input` already asserted the opposite, in the
 * plainest possible way: `refuseIntent(carry, token-with-relay, {})` must be `null` — an empty body
 * is not a permission problem. Authority and completeness are answered by different people for
 * different reasons, and a caller does opposite things with the answers: forbidden means stop and
 * tell somebody, incomplete means supply the field and retry.
 *
 * So this stayed what it was, and `incomplete` below is the other question. The route asks both, in
 * that order.
 */
export function refuseIntent(intent: Intent, a: Asking, body: Record<string, unknown>): Outcome | null {
  /**
   * ⛔ THE AUTHORITY FIRST, THE FIELDS SECOND, AND NEVER THE OTHER WAY ROUND.
   *
   * Telling a caller which fields a thing needs, and only then refusing it the authority to do it,
   * hands out the shape of an operation nobody may perform — and does it in the one place where a
   * token is probing what it can reach. So the gate decides before anything is described.
   */
  return gateRefuses(intent, a, body);
}

/**
 * Required fields this request has not supplied — asked AFTER the gate, never before.
 *
 * ⛔ THE ORDER IS A BOUNDARY, NOT A PREFERENCE. Describing an operation's fields and only then
 * refusing the authority to perform it hands out its shape, in the one place a token is probing
 * what it can reach. So the caller must already be allowed before it is told what to send.
 */
export function incomplete(intent: Intent, body: Record<string, unknown>): Outcome | null {
  const short = missingFrom(intent, body);
  if (!short.length) return null;
  return {
    ok: false,
    /**
     * ⛔ A FIELD MAY KEEP ITS OWN SENTENCE. `document` said "say which document", which is better
     * than anything generic — a generic message that replaces a specific one is a regression
     * wearing a refactor.
     */
    why: short.length === 1 && short[0]!.ifMissing ? short[0]!.ifMissing : `${intent.name} needs ${short.map((f) => `\`${f.name}\``).join(", ")}`,
    detail: [...short.map((f) => `${f.name} — ${f.says}`), "⛔ nothing here is guessed from the other fields"],
  };
}

function gateRefuses(intent: Intent, a: Asking, body: Record<string, unknown>): Outcome | null {
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
