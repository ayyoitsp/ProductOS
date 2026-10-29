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
import { perform, payloadFrom, VIA, ACTS, OWED, ALSO, type Act, type Via, isHuman } from "./acts.js";
import { closeNote, fileNote, replyToNote } from "./notes.js";
import { suggestClaim, raiseQuestion, proposeRequirement } from "./suggest.js";
import { mayRecord, mayRelay, mayClaimHand, watchedAPerson, type Principal } from "./identity.js";
import { parseFrontmatter } from "../core/frontmatter.js";
import YAML from "yaml";
import { authIsOff } from "./store/identity.js";
import fs from "node:fs";
import path from "node:path";
import { CORPUS_DIRS, loadCorpus } from "./load.js";
import { append } from "./log.js";
import { writePrototypes, writeWithin, diskPages, writeHoldsFor } from "./draw-write.js";
import { walkOf } from "./walk.js";
import { axesOf, answersOf, HANDS, NOTE_VIA, type Hand, type NoteVia } from "./schema.js";
import { dimensionsOf, sayCombination, variesBy } from "./dimensions.js";
import { doorOpensOn, theOnlyScreenIn, screensIn } from "./selection.js";

/** An axis id from its question, so nobody is asked to invent a slug for a sentence they just wrote. */
const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "split";

/**
 * A written file as the key the store holds it under.
 *
 * ⛔ THE WRITERS RETURN AN ABSOLUTE PATH and the store is keyed relative to the corpus root, so the
 * two have to be reconciled somewhere. Here, once — a page write that recorded an absolute path
 * would name a document the importer cannot find, which fails in the silent direction.
 */
const keyOf = (dir: string, file: string | undefined): string | undefined =>
  file ? path.relative(dir, file) : undefined;

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
  /**
   * ⛔ CALLER-SUPPLIED BYTES THAT LAND IN THE CORPUS WHOLESALE — scanned at the gate for authorship
   * it is not entitled to claim.
   *
   * Every other field is read apart and rebuilt by a `run`, so nothing a caller types reaches the
   * corpus unexamined: `payloadFrom` names each value it takes, `wroteBy` DERIVES `hand` from the
   * `via` `mayRecord` guards. A raw field is the one shape that defeats that by construction — the
   * caller writes the document, so it writes every field in it, including the ones a command would
   * have computed. `document` was the only one and had no guard at all.
   *
   * ⛔ DECLARED RATHER THAN SPECIAL-CASED ON THE NAME, because the next intent that takes a whole
   * document is the one that would arrive without the check. `gateRefuses` asks about every field
   * marked here, so declaring the field is what asks the question.
   */
  raw?: boolean;
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
/**
 * \u26d4 WHO AGREED — THE SESSION'S WORD WHILE AUTH IS OFF, THE INSTANCE'S ONCE IT IS ON.
 *
 * Peter: *"we're still in unauthenticated mode - let's have the sessions identify the human driving
 * and we'll use that"*.
 *
 * `authIsOff` already says what that mode costs, where it is switched on: *every verdict written
 * while this is set is one NOBODY CAN PROVE A HUMAN MADE.* Given that, the question is not which
 * name is provable — none is — but which is TRUE more often. The alternatives were both worse:
 *
 *   - `localAccount()` is an OS username. It says who owns the laptop, never who is driving the
 *     session, and it arrives looking exactly as authoritative as a real account.
 *   - taking it from the wire unconditionally is what let a token write `by: peter` while
 *     authenticated as `ci-bot` \u2014 driven, and the reason this function exists at all.
 *
 * So: while auth is off, the session says who is at it and that is recorded, because a stated name
 * nobody can prove beats an inferred one nobody checked. The moment auth is on, the instance knows,
 * and the wire is discarded \u2014 the act tools did exactly this and the comment that guarded them
 * is worth keeping: *a name from the wire would let a session write somebody else's agreement and
 * have it read, later, as though that person had been asked.*
 *
 * \u26d4 AND IT NEVER FALLS BACK. With auth off and nobody named, this returns nothing and the act
 * is refused \u2014 a default here would be the OS username wearing a human's name, which is the
 * shape of every bug in this file's history.
 */
export function whoDecided(a: Asking, body: Record<string, unknown>): string | null {
  if (!authIsOff()) return a.who.actor;
  const said = str(body.by).trim();
  return said.length ? said : null;
}

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
       * ⛔ AN ACT IS RECORDED AS THE IDENTITY THE INSTANCE KNOWS — FOR EVERY PRINCIPAL, NOT ONLY A
       * BROWSER. `by` from the wire was the last thing here anybody could forge, and this closed it
       * for a browser press while still taking a token's word for who agreed.
       *
       * ⛔ THAT HOLE WAS INVISIBLE WHILE THE ACT TOOLS EXISTED, because the hosted surface guarded
       * them separately — `guardArgs` set `args.by = who.actor` for anything in `ACT_NAMES`, with
       * the reason written out: *a name from the wire would let a session write somebody else's
       * agreement under `via: agent` and have it read, later, as though that person had been
       * asked.* Retiring those tools made this the only path, and a token calling the door wrote
       * `by: peter` while authenticated as `ci-bot`. Driven, not reasoned about.
       *
       * ⛔ AND IT IS SCOPED TO CONSENT, SO RELAYING STILL WORKS. `carry` is gated `relay`, not
       * `consent`, precisely because its whole job is carrying somebody else's press — it requires
       * `by` and `via` outright and is untouched by this.
       */
      const by = whoDecided(a, body);
      /**
       * \u26d4 NOBODY NAMED, NOTHING RECORDED. With auth off the session's word is the only thing
       * there is; absent it, the honest outcome is a refusal rather than a verdict attributed to
       * whoever owns the machine.
       */
      if (by === null)
        return {
          ok: false,
          why: `${act} is an act of human judgement, and nothing here is authenticated \u2014 say \`by\`, the person driving this session`,
          detail: [
            "by \u2014 who decided. Recorded as stated, because with auth off nothing can prove it",
            "\u26d4 It is not defaulted to the account this runs as: that is who owns the machine, never who is driving",
          ],
        };
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
      {
        name: "probe",
        says:
          "⛔ Set this when a session is checking that writing works and NOBODY is waiting on it. " +
          "A probe is counted nowhere and shown on no surface a person reviews — it is still a real " +
          "write through the whole path, which is the point of it",
        required: false,
      },
      /**
       * ⛔ `via` AND `assumed` WERE MISSING, AND THAT MADE A WHOLE FEATURE UNREACHABLE.
       *
       * This hardcoded `via: "page"` and exposed neither field, so **no caller of the door could
       * file a `review` finding** — the judge → note → interviewer path had exactly one working
       * route, `fileNote` called in-process, which a session against a hosted project does not
       * have. Found by running the interviewer against a live instance: *"no MCP caller can create
       * one, and an interviewer that notices a hole the worklist cannot see has nowhere to record
       * it."*
       *
       * ⛔ AND THE HARDCODE WAS A FORGERY IN ITSELF. Every note through the door claimed a person
       * pressed it on a page. That is the *"and what are those 6 requests, i did not send any
       * requests"* confusion with the door's volume behind it — so `via` now goes through
       * `mayRecord`, the same gate that stops a token claiming somebody agreed.
       */
      {
        name: "via",
        says: `How it arrived: ${NOTE_VIA.join(" | ")}. Defaults to \`agent\` for a session and \`page\` for a press. ⛔ \`review\` is a judge's finding a session wrote down, and it owes \`assumed\``,
        required: false,
      },
      {
        /**
         * ⛔ Without this the distinction exists in the schema and no caller can set it, which is
         * the same as not having it. See `Note.disputes`.
         */
        name: "disputes",
        says:
          "true when this note says the thing it is about should not be asked AS IT STANDS — nonsense, " +
          "or built on a false premise. ⛔ Not for an answer, however strongly put: an answer settles the " +
          "question, a dispute withdraws it. Nothing infers this from the sentence",
        required: false,
      },
      {
        name: "assumed",
        says:
          "⛔ Required on `review`, forbidden elsewhere. What somebody would do if nobody answered " +
          "this, as a `that…` clause — the risk, which is what makes a finding worth a person's " +
          "time rather than a worry. It becomes one of the options when this is drafted into a question",
        required: false,
      },
    ],
    run: (a, body) => {
      /**
       * ⛔ A PROBE CANNOT DISPUTE, AND THE TWO WORDS SAY WHY. A probe is "counted nowhere and shown
       * on no surface a person reviews"; a dispute TAKES SOMEBODY'S QUESTION OFF THEIR QUEUE. One
       * of those claims to be invisible and the other changes what a person is asked, so a note
       * claiming both hides a question with nothing on any surface to say it happened.
       *
       * It could: measured on a seed corpus, a probe carrying `disputes` took answerable questions
       * from 3 to 2. `questionsFor` now ignores probes, so anything already written is inert — this
       * refuses the next one, where the caller can still be told why.
       */
      if (body.probe === true && body.disputes === true)
        return {
          ok: false,
          why: "a probe cannot withdraw a question — it is counted nowhere, and this would take one off somebody's queue with nothing to show for it",
          detail: [
            "drop `probe` if the rejection is real: a dispute is a judgement and belongs on the record",
            "or drop `disputes` if you are checking that writing works — an ordinary probe note is still a real write through the whole path",
          ],
        };

      /**
       * ⛔ THE DEFAULT IS WHAT THE CALLER IS, never what reads best. A browser press is a person on
       * a page; anything else is software, and `agent` is the honest word for it.
       *
       * ⛔ AND IT IS ONLY AS HONEST AS `principalFrom`. This line is right and it produced
       * `via: page` for an agent's token, because `PRODUCTOS_AUTH=off` used to return `browser` for
       * every request that reached it — so the default read the caller correctly and the caller had
       * been misdescribed one layer down. Fixed where the fact lives, not by hardening this: a
       * default of `agent` here would have made a real page press claim to be software, which is
       * the same loss of information with the sign flipped. See `principalFrom`.
       */
      /** ⛔ `NOTE_VIA`, not `VIA` — a request is not consent, and two of its answers are not ways
       *  anybody could have agreed. See `NOTE_VIA` for what the door refused when this read `VIA`. */
      const via = (str(body.via) || (a.who.kind === "browser" ? "page" : "agent")) as NoteVia;
      if (!NOTE_VIA.includes(via))
        return { ok: false, why: `"${via}" is not a way a request could have arrived`, detail: [NOTE_VIA.join(" · ")] };
      /**
       * ⛔ `mayRelay`, NOT `mayRecord` — AND MY FIRST VERSION OF THIS GOT IT WRONG IN A WAY THAT
       * BLOCKED THE CASE IT WAS WRITTEN FOR.
       *
       * The two gates answer different questions:
       *
       *   `mayRecord`  may this principal claim a person AGREED? — consent, and no token ever may
       *   `mayRelay`   may this principal carry what somebody else said? — relay, which is a scope
       *
       * A note is a REQUEST. `via: chat` on one says *where the request arrived from*, not that
       * anybody agreed to anything — and carrying what a person said in a conversation is precisely
       * what a session is for. Gated on `mayRecord`, every such note came back **"a token cannot
       * record \"chat\" — that claims a person agreed"**, which is true of a verdict and false of
       * a request. Found immediately: three of Peter's own answers, relayed from this session,
       * refused on the grounds that he had not agreed to having said them.
       *
       * ⛔ AND A HUMAN `via` STILL COSTS SOMETHING. It needs `relay`, so a read-or-author token
       * cannot put words in a person's mouth; what it can do is file under `agent`, as itself.
       */
      /**
       * ⛔ A HUMAN `via` IS EITHER A PRESS THIS INSTANCE WATCHED, OR A RELAY — and my first two
       * attempts each got one of those halves wrong.
       *
       *   first:  `mayRecord` for everything — refused a session carrying what Peter said in chat,
       *           on the grounds that he had not agreed to having said it. A note is a REQUEST;
       *           `via: chat` says where it arrived from, not that anybody agreed to anything.
       *   second: `mayRelay` for every human `via` — which made a PERSON pressing on the page prove
       *           they held a relay scope. A browser principal holds none, so the ordinary case —
       *           somebody filing a request on their own product — came back *"this token may not
       *           carry somebody else's press"*. Caught by the store suite, four tests over.
       *
       * ⛔ SO BOTH DOORS, AND NEITHER ALONE. `watchedAPerson` is the one that makes a browser press
       * free: the instance saw it happen, so there is nothing to relay. Anything else asserting a
       * human `via` is speaking for somebody who is not here, and that is exactly what `relay` is.
       */
      const watched = watchedAPerson(a.who.kind);
      const forged = isHuman(via) ? (watched ? null : mayRelay(a.who)) : mayRecord(a.who, via);
      if (forged) return forged;
      return fileNote(a.dir, {
        about: str(body.about),
        says: str(body.says),
        by: str(body.by) || a.pressing,
        via,
        /**
         * ⛔ WHO CARRIED IT, DERIVED HERE AND NEVER TAKEN FROM THE BODY.
         *
         * A human `via` reached this line one of two ways and they are not the same claim: the
         * instance watched the press, or `mayRelay` let something automated speak for somebody who
         * is not here. Only the second has a courier, and until now nothing wrote it down — so a
         * request Peter typed on a page and a request a model filed in his name were identical on
         * disk, which is survivable for a message and not for one that withdraws a question.
         *
         * ⛔ THE SAME RULE `Consent.relayedBy` OBEYS: `by` and `via` stay the PRESSER's, and this
         * names the courier beside them. What is trustworthy about the record and what is taken on
         * somebody's word, in the record rather than in a memory.
         *
         * ⛔ AND IT IS THE PRINCIPAL'S ACTOR, not a field. A courier that names itself is not a
         * courier anybody can audit — it is one more string a caller chose.
         */
        ...(isHuman(via) && !watched ? { relayedBy: a.who.actor } : {}),
        at: new Date().toISOString().slice(0, 10),
        /** ⛔ Only ever true where somebody said so. An inferred probe is a request discarded. */
        ...(body.probe === true ? { probe: true as const } : {}),
        ...(str(body.assumed) ? { assumed: str(body.assumed) } : {}),
        ...(body.disputes === true ? { disputes: true } : {}),
      });
    },
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
    /**
     * ⛔ AND IT SAYS WHO IT IS FOR. Peter: *"there should be no 'local corpus'... always hosted
     * server"*. An author session holds this MCP server and a token and nothing else, so this is
     * the only way its work reaches the product — one call per document. `hosted import` is an
     * operator's command and needs a database address no author has.
     */
    does:
      "Write one whole document of the corpus by key — truth, a rule, a part, a reading. ⛔ This is how an author lands its work " +
      "over MCP: one call per document, straight into the hosted project, with no local copy kept as the truth",
    takes: [
      {
        name: "key",
        says: `Which document, relative to the corpus root — e.g. truth/money.md. One of: ${CORPUS_DIRS.join(" / ")}`,
        required: true,
        ifMissing: "say which document",
      },
      {
        name: "says",
        says:
          "The whole document. ⛔ Replaces it — this is not a patch. ⛔ And it is the document's own bytes, so a " +
          "`wrote:` in it is a claim the caller typed rather than one anything derived: `hand: person` is refused " +
          "on a token, which may write `hand: agent` with `from:` instead",
        required: true,
        long: true,
        raw: true,
      },
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
      /**
       * ⛔ A ROOT-LEVEL `.yaml` IS A CORPUS DOCUMENT, and refusing it cost three roles their findings.
       *
       * `corpusFiles` enumerates every root-level `.yaml`/`.yml` BESIDE the eight directories —
       * `framework-gaps.yaml`, `access.yaml`, `style.yaml` are all real documents that survive a
       * round trip. This check demanded a directory prefix, which a root-level document has not, so
       * the door answered `"framework-gaps.yaml" is not part of a corpus` about a file the corpus
       * was already holding.
       *
       * ⛔ WHAT THAT BROKE IS THE RECORD OF WHAT THE MODEL CANNOT SAY. A framework gap is the only
       * route from "this corpus had to be compromised" to somebody fixing the compromise, and
       * `forced_into` is what makes the compromise correctable in one pass rather than becoming the
       * convention. Three roles working the hosted corpus each reported, independently, that they
       * could not file one — the door refused the document and `todo add --at <url>` resolved the
       * url as a directory. Each of their gaps survived only because a person read a report.
       *
       * ⛔ AND THE ORIGINAL REASON IS KEPT, NOT WAIVED. The comment above is right that a key the
       * corpus does not enumerate would be "written and then dropped" by `writeBack` with a
       * cheerful ok. So the test is exactly what `corpusFiles` collects — a directory on the list,
       * or a root-level yaml — and `README.md` or `gaps/one.yaml` is still refused.
       */
      const rootDocument = !key.includes("/") && /\.ya?ml$/.test(key);
      if (!rootDocument && !CORPUS_DIRS.includes(dir as (typeof CORPUS_DIRS)[number]))
        return {
          ok: false,
          why: `"${key}" is not part of a corpus`,
          detail: [
            CORPUS_DIRS.map((d) => `${d}/…`).join(" · "),
            "or a .yaml at the corpus root — framework-gaps.yaml, access.yaml, style.yaml",
            "⛔ anything else would be written and then dropped",
          ],
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
        wrote: key,
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
      const axes: Array<{ id: string; label: string; values: string[] }> = [];
      const parse = (v: unknown): void => {
        if (typeof v === "string") {
          const label = v.trim();
          if (label) axes.push({ id: slugify(label), label, values: [] });
          return;
        }
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const o = v as { id?: unknown; label?: unknown; values?: unknown };
          const label = str(o.label).trim();
          if (!label) return;
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
          axes.push({ id: str(o.id).trim() || slugify(label), label, values });
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
      writePrototypes(diskPages(a.dir), corpus.prototypes, axes);
      append(a.dir, {
        kind: "corpus-changed",
        at: new Date().toISOString(),
        by: a.who.actor,
        via: "page",
        ref: "prototypes",
        wrote: "prototypes.yaml",
        says: `prototypes split on ${axes.map((x) => x.label).join(" and ")}`,
      });
      const owed = corpus.prototypes.filter((p) => {
        const answers = answersOf(p.is, axes);
        return axes.some((ax) => !answers[ax.id]);
      });
      return {
        ok: true,
        said: `they split on ${axes.map((x) => x.label).join(" and ")}`,
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
        writePrototypes(diskPages(a.dir), corpus.prototypes.filter((p) => p.id !== id), corpus.splitsOn);
        append(a.dir, {
          kind: "corpus-changed",
          at: new Date().toISOString(),
          by: a.who.actor,
          via: "page",
          ref: `prototype:${id}`,
          wrote: "prototypes.yaml",
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
      /* ⛔ The one reader, so a placement is judged against the dimensions the product declares. */
      const axes = dimensionsOf(corpus);
      const existing = corpus.prototypes.find((p) => p.id === id);
      const title = str(body.title).trim() || existing?.title;
      if (!title) return { ok: false, why: `"${id}" is new, so say what to call it`, detail: ["title"] };
      const asked = str(body.startsAt).trim() || existing?.starts_at;
      if (!asked) return { ok: false, why: `"${title}" needs a front door`, detail: ["startsAt, as <scope>#<view>"] };
      /**
       * ⛔ THE DOOR IS RESOLVED BEFORE ANYTHING IS WRITTEN, through the same predicate `check` uses.
       * A door onto nothing is refused at handover anyway; catching it here means the person who
       * typed it hears about it instead of the next reader who clicks it.
       */
      let startsAt = asked;
      let corrected: string | undefined;
      if (!doorOpensOn(corpus, startsAt)) {
        /**
         * ⛔ ONE CANDIDATE IS AN ANSWER. Peter, refused twice on `org-loan-terms#org-loan-terms`:
         * *"should be obvious which to point each one at"* — and it was: that scope holds exactly
         * one screen. Refusing sent him to look up a name the corpus already knew.
         *
         * ⛔ AND THE CORRECTION IS WRITTEN BACK, not re-derived on every read. A corpus left holding
         * an unresolvable string makes every reader repeat the same resolution with nothing
         * recording that it was made — and `check` would go on refusing a corpus that is, in fact,
         * unambiguous.
         */
        const only = theOnlyScreenIn(corpus, startsAt);
        if (only) {
          corrected = `${asked} is not a screen; "${only.title}" is the only one in that feature, so that is what it opens on`;
          startsAt = only.ref;
        } else {
          /**
           * ⛔ TWO CANDIDATES IS A QUESTION, AND THE REFUSAL NAMES THEM. Picking the first would be
           * the classifier this model refuses everywhere; sending somebody away to find the list is
           * the refusal they learn to ignore.
           */
          const near = screensIn(corpus, startsAt);
          return {
            ok: false,
            why: `no screen "${startsAt}" in this corpus, so nothing can open on it`,
            detail: near.length ? [`that feature has: ${near.join(" · ")}`] : ["name it as <scope>#<view>"],
          };
        }
      }
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
      writePrototypes(diskPages(a.dir), protos, corpus.splitsOn);
      append(a.dir, {
        kind: "corpus-changed",
        at: new Date().toISOString(),
        by: a.who.actor,
        via: "page",
        ref: `prototype:${id}`,
        wrote: "prototypes.yaml",
        says: existing ? `moved ${title}` : `declared ${title}`,
      });
      const owed = axes.filter((ax) => !answers[ax.id]);
      return {
        ok: true,
        said: `${existing ? "changed" : "declared"} ${title}, opening on ${startsAt}`,
        detail: [
          /** ⛔ SAID OUT LOUD. A door silently pointed somewhere else is a correction nobody agreed to. */
          ...(corrected ? [corrected] : []),
          ...(Object.keys(answers).length ? [axes.map((ax) => `${ax.label} ${answers[ax.id] ?? "—"}`).join(" · ")] : []),
          ...(owed.length ? [`still says nothing about: ${owed.map((ax) => ax.label).join(", ")}`] : []),
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
        const file = writeWithin(diskPages(a.dir), holder.scope, holder.view.id, "");
        if (!file) return { ok: false, why: `could not find "${ref}" to change` };
        append(a.dir, { kind: "corpus-changed", at: new Date().toISOString(), by: a.who.actor, via: "page", ref, wrote: keyOf(a.dir, file), says: `${here.title} is no longer inside anything` });
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

      const file = writeWithin(diskPages(a.dir), holder.scope, holder.view.id, of);
      if (!file) return { ok: false, why: `could not find "${ref}" to write it into` };
      append(a.dir, { kind: "corpus-changed", at: new Date().toISOString(), by: a.who.actor, via: "page", ref, wrote: keyOf(a.dir, file), says: `${here.title} appears inside ${of}` });
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
    /**
     * ⛔ WHO A SCREEN IS FOR, SAID FROM THE PAGE.
     *
     * Peter: *"we need dimensions to carry through to all features, so we can have different
     * variations PER feature"*, and long before that, about the thing that made this necessary:
     * *"I should be able to drive this from the listener/input, right??? why could you possibly need
     * this?"*
     *
     * A field only a hand-edit can set is a field only the sessions that know about it will ever
     * write — which is the hand-authoring trap this project opens on. There is a test asserting that
     * every fact a reviewer states is reachable from the page, and it failed on `View.holds_for`
     * before this existed.
     */
    name: "holds-for",
    gate: "author",
    does: "Say which combination of the product's dimensions a screen is for — or take it back",
    takes: [
      { name: "view", says: "The screen, as <scope>#<view>", required: true },
      {
        name: "is",
        says: "The combination, as dimension id to value. ⛔ Empty takes it back, and that is how a screen becomes everybody's again",
        required: false,
      },
    ],
    run: (a, body) => {
      const ref = str(body.view).trim();
      if (!ref) return { ok: false, why: "say which screen" };
      const corpus = loadCorpus(a.dir);
      const here = doorOpensOn(corpus, ref);
      const holder = corpus.scopes
        .flatMap((e) => (e.scope.views ?? []).map((v) => ({ scope: e.scope.id, view: v })))
        .find((x) => `${x.scope}#${x.view.id}` === ref || x.view.id === ref);
      if (!here || !holder) return { ok: false, why: `no screen "${ref}" in this corpus` };

      const asked = (body.is ?? {}) as Record<string, unknown>;
      const is: Record<string, string> = {};
      for (const [dim, value] of Object.entries(asked)) {
        const v = str(value).trim();
        if (v) is[dim] = v;
      }

      /**
       * ⛔ REFUSED HERE RATHER THAN FOUND BY `check` LATER, because the failure is silent and in the
       * safe-looking direction: a dimension this product never declared narrows nothing, so the
       * screen stays visible to everybody and the author believes they have restricted it.
       */
      const dims = dimensionsOf(corpus);
      for (const [dim, value] of Object.entries(is)) {
        const known = dims.find((d) => d.id === dim);
        if (!known)
          return {
            ok: false,
            why: `this product has no dimension "${dim}", so holding a screen for it would narrow nothing`,
            detail: dims.length
              ? [`it splits on: ${dims.map((d) => `${d.id} (${d.label})`).join(" · ")}`]
              : ["declare the product's dimensions first — they are the product's, not a feature's"],
          };
        if (known.values.length && !known.values.includes(value))
          return {
            ok: false,
            why: `"${value}" is not one of ${known.label}'s values`,
            detail: [`${known.label} is: ${known.values.join(" · ")}`],
          };
      }

      const file = writeHoldsFor(diskPages(a.dir), holder.scope, holder.view.id, is);
      if (!file) return { ok: false, why: `could not find "${ref}" to change` };
      const says = Object.keys(is).length
        ? `${here.title} is what ${sayCombination(is, dims)} sees`
        : `${here.title} is everybody's again`;
      append(a.dir, {
        kind: "corpus-changed",
        at: new Date().toISOString(),
        by: a.who.actor,
        via: "page",
        ref,
        wrote: keyOf(a.dir, file),
        says,
      });
      /**
       * ⛔ AND IT SAYS WHAT THE FEATURE NOW VARIES BY, which is the thing he asked for — a variation
       * per feature is only useful if the feature can be asked what its variations are.
       */
      const varies = variesBy(loadCorpus(a.dir), holder.scope);
      return {
        ok: true,
        said: says,
        detail: varies.length
          ? [`${holder.scope} now varies by ${varies.map((d) => d.label.toLowerCase()).join(" and ")}`]
          : [`${holder.scope} states one thing for everybody again`],
      };
    },
  },
  /**
   * ⛔ THE TWO SMALL WRITES. Peter: *"WRITE STRAIGHT INTO THE CORPUS as SUGGSTED. there is no
   * 'HOLD' as a note state."* An agent that learned one thing writes one thing — not a whole
   * document, and not a note to a person. See `suggest.ts` for why neither can look agreed.
   */
  {
    name: "suggest",
    gate: "author",
    does: "Add one sentence to a slot, recorded as suggested — it reads as unagreed until a person agrees to it",
    takes: [
      { name: "ref", says: "The slot, as <scope>#<exchange>#<slot> — e.g. money#record-spending#after", required: true },
      { name: "says", says: "The sentence, as the slot would state it", required: true, long: true, floor: 10 },
      { name: "from", says: "What it was worked out from — the ticket, the transcript, the component", required: true, floor: 10 },
      { name: "id", says: "A kebab-case id for the statement. Made from the sentence when absent", required: false },
    ],
    run: (a, body) => {
      const r = suggestClaim(a.dir, { ref: str(body.ref), says: str(body.says), from: str(body.from), id: str(body.id) || undefined, as: a.who.actor });
      if (!r.ok) return r;
      append(a.dir, { kind: "corpus-changed", at: new Date().toISOString(), by: a.who.actor, via: "agent", ref: r.ref, wrote: keyOf(a.dir, r.file), says: r.said });
      return { ok: true, said: r.said };
    },
  },
  {
    name: "ask",
    gate: "author",
    does: "Raise one question on a slot, with drafted answers — it gates the behaviour until the person asked answers it",
    takes: [
      {
        name: "ref",
        says: "The slot, as <scope>#<exchange>#<slot>. A fourth segment addresses one part of it: a named refusal on `refuses`, or one statement when the slot says several things",
        required: true,
      },
      { name: "question", says: "The question, as the person who owes it would read it", required: true, floor: 10 },
      { name: "asked_of", says: "Who owes the answer — a person's handle", required: true },
      {
        name: "blocks",
        says: "What cannot ship until it is answered, as refs. ⛔ [] is a real answer meaning the rest can ship; it is never assumed",
        required: true,
      },
      {
        name: "candidates",
        says: 'Drafted answers, each {"says": "…", "consequence": "…"} — two or more need a cost. On `refuses`, an answer is {"outcomes": [{name, when, told}], "consequence": "…"}',
        required: false,
      },
      { name: "cost", says: "What it costs to guess wrong. Required with two or more drafted answers", required: false },
      { name: "about", says: "Which part of what the slot already says is in question. Required when the slot already says something", required: false },
      {
        /**
         * ⛔ THE ONLY ROUTE TO AN OPTION NOBODY CAN PICK. `ask` appends, so without this an option
         * that cannot be applied is permanent until the question is answered — which is the state
         * three questions on a real corpus were in, each carrying four unpickable options.
         */
        name: "withdraw_options",
        says:
          'Options to take off the table: [{"option": 1, "because": "…"}], by the number a person sees. ' +
          "Keeps what each said and why it went, and refuses to leave the question with nothing to pick between. " +
          "⛔ Not for an option you merely disagree with — that is an answer somebody may still choose",
        required: false,
      },
      {
        /**
         * ⛔ THE ONLY ROUTE TO THE 1,315 QUESTIONS ALREADY WORDED BADLY. Without it, improving how
         * this role asks things reaches nothing anybody is currently looking at.
         */
        name: "rephrase",
        says: "Say an already-asked question better. Keeps its options and records what it used to say, so nobody weighing it loses the thread. ⛔ Not for changing the subject — a different decision is a different question",
        required: false,
      },
      {
        /**
         * ⛔ WITHOUT THIS THE WHOLE fg-0002 FIX IS UNREACHABLE FROM WHERE ANYBODY IS. The writer can
         * now put a question on a named refusal, and this is the only door — *"no one will ever use
         * the command line"*. A capability reachable only from a function call is not shipped.
         */
        name: "asks",
        says: "For a named refusal: which part of the case is unruled — `whether` it refuses at all, `when` it refuses, or what the asker is `told`. Required when the ref names a refusal, and meaningless otherwise",
        required: false,
      },
    ],
    run: (a, body) => {
      const blocks = Array.isArray(body.blocks) ? body.blocks.map(String) : null;
      if (!blocks) return { ok: false, why: "say what this blocks, as a list of refs — [] when the rest can ship without it" };
      const r = raiseQuestion(a.dir, {
        ref: str(body.ref),
        question: str(body.question),
        asked_of: str(body.asked_of),
        blocks,
        cost: str(body.cost) || undefined,
        about: str(body.about) || undefined,
        asks: (str(body.asks) || undefined) as "whether" | "when" | "told" | undefined,
        rephrase: body.rephrase === true,
        withdraw_options: Array.isArray(body.withdraw_options)
          ? (body.withdraw_options as Array<Record<string, unknown>>).map((w) => ({
              option: Number(w?.option),
              because: str(w?.because),
            }))
          : undefined,
        candidates: Array.isArray(body.candidates) ? body.candidates : undefined,
        by: a.who.actor,
      });
      if (!r.ok) return r;
      append(a.dir, { kind: "corpus-changed", at: new Date().toISOString(), by: a.who.actor, via: "agent", ref: r.ref, wrote: keyOf(a.dir, r.file), says: r.said });
      return { ok: true, said: r.said };
    },
  },
  /**
   * ⛔ ONE TESTING REQUIREMENT, WORKED OUT FROM ONE CLAIM. The demonstrator's write, made small for
   * the same reason `suggest` was: see `proposeRequirement` for why the hash is the server's.
   */
  {
    name: "demonstrate",
    gate: "author",
    does: "Add one testing requirement to a claim — it reads as suggested until a person agrees to the claim it demonstrates",
    takes: [
      { name: "ref", says: "The claim it demonstrates, as <scope>#<exchange>#<slot>, or <scope>#<exchange>#<slot>#<statement> where the slot says several things", required: true },
      { name: "then", says: "What somebody observes when it holds — something that could be seen being false. Or give `steps`", required: false, long: true },
      { name: "given", says: "The situation it starts from", required: false },
      { name: "when", says: "The one thing somebody does", required: false },
      { name: "steps", says: "Numbered steps, only where given/when/then is the wrong shape (two people at once, a sequence)", required: false, long: true },
      { name: "level", says: "Where somebody stands to observe it: unit | integration | api | e2e. Leave it off when it is an engineering choice", required: false },
      { name: "id", says: "A stable id. Next free number when absent", required: false },
    ],
    run: (a, body) => {
      const r = proposeRequirement(a.dir, {
        ref: str(body.ref),
        then: str(body.then) || undefined,
        given: str(body.given) || undefined,
        when: str(body.when) || undefined,
        steps: str(body.steps) || undefined,
        level: str(body.level) || undefined,
        id: str(body.id) || undefined,
        by: a.who.actor,
      });
      if (!r.ok) return r;
      append(a.dir, { kind: "corpus-changed", at: new Date().toISOString(), by: a.who.actor, via: "agent", ref: r.ref, wrote: keyOf(a.dir, r.file), says: r.said });
      return { ok: true, said: r.said, ref: r.ref };
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

/**
 * ⛔ CONSENT NOBODY WATCHED HAPPEN HAS TO SAY WHO AGREED, AND HOW.
 *
 * Peter, choosing between tightening this and putting seven duplicate tools back: *"1 sounds good"*.
 *
 * The door's `via` defaults to `page` and its `by` falls back to the principal, and both are RIGHT
 * for the page: the instance watched the press, so the account is who pressed and `page` is how.
 * They became wrong the moment a second caller arrived wearing the same principal. Measured before
 * this existed, `productos_in { intent: "accept", fields: { ref } }` from MCP wrote
 *
 *     kind: accept · by: peter · via: page
 *
 * — a record byte-identical to one made by pressing Accept on a rendered page, from a model that
 * was never asked either question. Nothing downstream can tell those apart, because the difference
 * was never written down.
 *
 * ⛔ SO THE RULE IS ABOUT THE PRESS, NOT THE PRINCIPAL. A caller the instance did not watch states
 * both or records nothing. The five act tools this replaced demanded exactly that, with no default
 * on either — and a test said why, in words worth keeping: *the weakest provenance would silently
 * wear the strongest name*.
 *
 * ⛔ AND IT IS STRICTER, NEVER LOOSER. The danger the single door exists to prevent is a transport
 * reaching an authority the page cannot; a transport held to MORE than the page is the safe
 * direction. It is asked here rather than in the caller so the rule has one home.
 */
export function unwitnessed(intent: Intent, body: Record<string, unknown>): Outcome | null {
  if (intent.gate !== "consent") return null;
  const said = (k: string): boolean =>
    typeof body[k] === "string" && (body[k] as string).trim().length > 0;
  const short = ["by", "via"].filter((k) => !said(k));
  if (!short.length) return null;
  return {
    ok: false,
    why: `${intent.name} is an act of human judgement and nothing here watched it happen — say ${short
      .map((f) => `\`${f}\``)
      .join(" and ")}`,
    detail: [
      "by — who decided. \u26d4 Not the account this runs as: the person, recorded, outliving the session",
      `via — how their consent was obtained: ${VIA.join(" | ")}`,
      "\u26d4 `via: page` means somebody pressed a button on a rendered page showing what it covered. If that is not what happened, it is not `page`.",
      "\u26d4 Neither is defaulted here. A default would make the weakest provenance wear the strongest name.",
    ],
  };
}

/**
 * The strongest hand a document's own bytes claim — ⛔ READ STRUCTURALLY, NOT GREPPED.
 *
 * `hand` is `Authorship`'s and nothing else's in the whole schema, so any object in the tree
 * carrying one is a claim about who typed a sentence, at whatever grain it sits — a statement, a
 * named refusal, a slot, a rule. Walking the parsed document therefore answers the question once
 * for every grain there will ever be, where a per-grain reader would have to be extended by
 * whoever adds the fifth and would silently answer `null` until they did.
 *
 * `person` wins over `agent`: a document that claims both contains a claim this caller may not
 * make, and the honest answer to "what is the strongest thing in here" is the one that gets gated.
 *
 * ⛔ AND BYTES NOBODY CAN PARSE STILL LAND ON DISK, so they are not waved through. A document whose
 * YAML is malformed is a document `loadCorpus` will reject and `check` will refuse — and it is
 * still written, still stored by `writeBack`, and one later fix away from being read. So the
 * fallback is a conservative text scan of exactly the one spelling that matters. It is reached only
 * when the structure is unavailable, which keeps prose out of the normal path.
 */
export function handClaimedBy(says: string): Hand | null {
  /**
   * ⛔ BYTES WITH NO `hand:` IN THEM ARE NOT PARSED, and that is not a shortcut — `drawings/` is a
   * corpus directory, a screen's picture is its own document, and `load.ts` measured one feature at
   * 5.1 MB of HTML. Handing that to a YAML parser on every write would make a drawing's cost a
   * function of this guard. The question cannot have a positive answer without this substring.
   */
  if (!/hand\s*:/.test(says)) return null;
  let structure: unknown;
  try {
    const front = parseFrontmatter(says);
    /** A `.md` document states its shape in frontmatter and its framing in prose below it. */
    structure = front.data && Object.keys(front.data).length ? front.data : YAML.parse(says);
  } catch {
    return /(^|[\s{,])hand:\s*["']?person\b/m.test(says) ? "person" : null;
  }
  return handIn(structure);
}

/** The walk itself, separate so the precedence above is stated once. */
function handIn(v: unknown): Hand | null {
  if (!v || typeof v !== "object") return null;
  let found: Hand | null = null;
  if (!Array.isArray(v)) {
    const claimed = (v as Record<string, unknown>).hand;
    if (typeof claimed === "string" && (HANDS as readonly string[]).includes(claimed)) {
      if (claimed === "person") return "person";
      found = "agent";
    }
  }
  for (const child of Array.isArray(v) ? v : Object.values(v as Record<string, unknown>)) {
    const h = handIn(child);
    if (h === "person") return "person";
    if (h) found = h;
  }
  return found;
}

function gateRefuses(intent: Intent, a: Asking, body: Record<string, unknown>): Outcome | null {
  /**
   * ⛔ WHAT THE CALLER TYPED INTO A WHOLE DOCUMENT, BEFORE THE GATE ITS INTENT NAMES.
   *
   * PR #183 put `wrote: {hand, as, from}` on four grains and derived it everywhere a COMMAND writes
   * one — from the `via` `mayRecord` already guards, so the one defended boundary answered both
   * questions. The `document` intent was not a command: it hands over raw bytes, so an agent token
   * holding `author` could type `hand: person` and its inference became indistinguishable from a
   * person's draft. That is the entire distinction the field exists for.
   *
   * ⛔ ASKED FOR EVERY GATE, NOT ONLY `author`. Today only an `author`-gated intent takes raw bytes;
   * a `consent`- or `relay`-gated one that did would otherwise get the old hole back, and a browser
   * principal passes here unchanged so nothing a page can do today changes.
   */
  for (const field of intent.takes) {
    if (!field.raw) continue;
    const given = body[field.name];
    if (typeof given !== "string" || !given.trim()) continue;
    const refused = mayClaimHand(a.who, handClaimedBy(given));
    if (refused) return refused;
  }
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
            why: `this token may not ${intent.name === "close" ? "close a request" : intent.name === "say" ? "reply on a request" : "write to the corpus"}`,
            detail: [`it holds: ${a.who.scopes.join(" · ") || "nothing"}`, "it needs `author`"],
          };
    case "open":
      return null;
  }
}

/** What an unknown intent is told, so a caller never has to read this file to find the list. */
export const theIntents = (): string[] => INTENTS.map((i) => i.name);
