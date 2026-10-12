/**
 * ⛔ THE ONE SURFACE THAT WORKS FOR EVERY CORPUS.
 *
 * A published page can be pressed inside Claude, but publishing sends the corpus to claude.ai —
 * which is exactly what a work corpus naming a real client must never do. This one serves the
 * same page from the machine that owns the truth: nothing leaves, the press is recorded
 * synchronously, and `via: page` says so.
 *
 * ⛔ It performs no act itself. Every route hands off to `acts.perform`, which is the only place
 * the five acts exist. A handler that re-implemented one would be the `gateFor`/`check`
 * divergence again, this time between the browser and the terminal.
 */
import type http from "node:http";
import { loadCorpus, corpusFiles } from "./load.js";
import { renderScopePage, standalone } from "./page.js";
import { perform, preview, payloadFrom, VIA, ACTS, type Act, type Via } from "./acts.js";
/**
 * ⛔ NOTHING FROM `notes.js` AND NO AUTHORITY CHECK IS IMPORTED HERE ANY MORE, which is the shape
 * of the change rather than tidying. Filing, replying and closing a request — and the gate each
 * needs — moved to `intents.ts`, so this file routes and does not decide.
 */
import { styleOf } from "./appcss.js";
import { watchLog, lineFor, type LoggedEvent } from "./log.js";
import { inbox, DEFAULT_LEASE_MS } from "./inbox.js";
import { working } from "./presence.js";
import { principalOf, localAccount, type Principal } from "./identity.js";
import { intentNamed, refuseIntent, incomplete, theIntents, describeIntents } from "./intents.js";


export interface V2Routes {
  /** The corpus directory this server is serving. */
  dir: string;
  /**
   * ⛔ WHO IS ASKING, WHEN SOMETHING ABOVE THIS ALREADY KNOWS.
   *
   * Locally nothing does, so this is absent and `principalOf` answers from the request — one person
   * is at the machine. Hosted, the instance authenticated an account and issued the session the
   * press arrived on, and THAT is the principal every write path must be asked about. Passing it in
   * rather than re-deriving it here keeps `mayRecord` the one decision: a second opinion about
   * whether a request is a browser or a token would be a second place the guarantee could be wrong.
   */
  who?: Principal;
  /**
   * Where the live stream gets its events, when the corpus on disk is not where they land.
   *
   * ⛔ ONE FORMATTER, TWO SOURCES — NOT TWO FEEDS. `watchLog` tails `events/log.jsonl`, which is
   * the whole story for a directory and NOTHING on a hosted instance: there the corpus is
   * materialized into a temp directory that the request deletes on the way out, so the watcher was
   * left watching a path that no longer existed. It emitted nothing, ever, and said so to nobody —
   * the page held an open connection, received its heartbeats, and looked completely up to date
   * while every press went unannounced.
   *
   * ⛔ WHY THIS IS INJECTED RATHER THAN BRANCHED ON. The comment above `/api/v2/live` says the page
   * and the session read the SAME log because two feeds would be two answers to "what happened".
   * A second SSE handler in the hosted adapter is exactly that second feed. So the frames, the
   * heartbeat and the retry stay here, in one place, and only where the events come FROM changes.
   */
  stream?: (emit: (e: LoggedEvent) => void) => { stop: () => void };
  /**
   * Whose name goes on a press.
   *
   * ⛔ THIS IS `fg-0002`, ANSWERED. Locally `by` is the OS account of the process — evidence about
   * where the server runs, not about who pressed, which is wrong the moment a press arrives from
   * another machine. Hosted there is a real account, so the gap closes rather than being worked
   * around.
   */
  by?: string;
}

const json = (res: http.ServerResponse, body: unknown, status = 200): void => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body, null, 2));
};

const html = (res: http.ServerResponse, body: string, status = 200): void => {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
};

const readJson = (req: http.IncomingMessage): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });

/**
 * ⛔ THE LIST OF ACTS USED TO LIVE HERE, AND THAT IS WHY IT ONCE DISAGREED WITH THE TYPE.
 *
 * It was a private const in this file, maintained by hand beside an `Act` union that is not — so
 * `withdraw` was in the type and not in the list, the trash icon rendered and was refused by the
 * server as an unknown act, and every refusal built from the list said "not one of the five acts"
 * while the list held six. It is `ACTS` in `acts.ts` now, beside the type it enumerates.
 */

/**
 * ⛔ THE SESSION COOKIE THE INSTANCE ISSUES, which is what makes `via: page` a thing the instance
 * OBSERVED rather than a thing the request claimed.
 *
 * Locally it authenticates nobody — one person is at this machine. What it does even here is tell a
 * browser apart from a token, which is the whole relay boundary; and it gives a verdict an audit
 * trail back to a particular tab rather than to "someone, at some point".
 */
const COOKIE = "productos_session";
function sessionOf(req: http.IncomingMessage, res: http.ServerResponse): string {
  const raw = String(req.headers.cookie ?? "");
  const found = raw.split(";").map((c) => c.trim().split("=")).find(([k]) => k === COOKIE)?.[1];
  if (found) return decodeURIComponent(found);
  const fresh = `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  // ⛔ HttpOnly: a session id a script can read is a session id a script can carry into a token.
  res.setHeader("set-cookie", `${COOKIE}=${fresh}; Path=/; HttpOnly; SameSite=Lax`);
  return fresh;
}

/** The name a press is recorded under when nothing better is known. See `identity.ts`. */
/**
 * ⛔ WHOSE NAME GOES ON A PRESS, AND WHY IT IS STILL THE LOCAL ACCOUNT.
 *
 * The server binds every interface, so a press can arrive from another machine — and `by` is the
 * OS account of the process, which is evidence about where the server runs and not about who
 * pressed. A verdict says a human agreed; that one can name the wrong human.
 *
 * ⛔ AND ASKING WAS WORSE. The first cut refused an unattributable press and told the person to say
 * who they were. Peter hit it immediately, reviewing over a remote session — the exact case he had
 * just asked for — and got "Not sent" for his trouble, then: *"don't even ask right now"*. He is
 * right. A guarantee that blocks the work it protects is a guarantee somebody turns off, and this
 * is a single-operator machine on a private network where the local account IS the answer.
 *
 * So it stays as it was, deliberately, and `isLocal` exists so the question is answerable the day
 * this serves more than one person. Recorded as fg-0002 rather than left as a silent compromise.
 */
const LOOPBACK = /^(::1|(::ffff:)?127(\.\d{1,3}){3})$/;

/** Whether a request came from this machine. ⛔ Anchored at both ends, so a hostname cannot pass. */
export const isLocal = (req: http.IncomingMessage): boolean => LOOPBACK.test(req.socket.remoteAddress ?? "");

const whoIsPressing = (_req: http.IncomingMessage, override?: string): string => override ?? localAccount();

/**
 * Handle a `/v2` request. Returns `false` when the path is not ours, so the v1 server can carry
 * on — v2 is a parallel track and must not shadow a single v1 route.
 */
export async function v2Route(req: http.IncomingMessage, res: http.ServerResponse, p: string, opts: V2Routes): Promise<boolean> {
  const { dir } = opts;
  /**
   * ⛔ ONE LIST, AND IT IS THE INSTANCE API. `productos serve` is not a preview of a hosted thing —
   * it IS the thing, deployed locally, with a directory behind it instead of a database. A route
   * that existed only in one of the two would make the local case a lesser experience, and the gate
   * that protects a corpus naming a real client would become a punishment for using it.
   */
  const OURS = [
    /**
     * ⛔ ONE INPUT, AND IT REPLACED FIVE. `/act`, `/carry`, `/note`, `/say` and `/close` were five
     * routes whose first ten lines were each a different authority check, so a sixth would have
     * arrived with its own copy or with none.
     *
     * Peter: *"the generic door can mint consent - it's a human input. yes, add a single input, get
     * rid of the specific commands. the input should still route to the right subsystem"*.
     *
     * ⛔ And he is right that the door may mint consent, which is the part I had wrong: the gate was
     * never the route. `mayRecord` reads the PRINCIPAL and the claimed `via`, so it refuses a token
     * claiming a person pressed something no matter which path the request came down. `INTENTS`
     * declares the authority per intent; this list no longer carries one entry per thing anybody
     * can do.
     */
    "/api/v2/in",
    "/api/v2/live",
    "/api/v2/inbox",
    "/api/v2/preview",
    "/api/v2/corpus",
    "/api/v2/whoami",
    "/api/v2/presence",
    /**
     * ⛔ ON THE LIST, OR IT DOES NOT EXIST. The handler below was written, built and shipped, and
     * every request to it 404ed — because this allowlist is what decides whether `v2Route` claims a
     * path at all, and a route added to the body alone is a route nothing routes to.
     */
    "/api/v2/thread",
  ];
  if (p !== "/v2" && !p.startsWith("/v2/") && !OURS.includes(p)) return false;

  /**
   * ⛔ WHO IS ASKING, DECIDED ONCE, BEFORE ANY ROUTE RUNS.
   *
   * The guarantee the whole design rests on is that a session can never mint consent — and a
   * guarantee enforced inside three handlers is a guarantee enforced inside two of them within a
   * month. So the principal is established here and `mayRecord` is asked by every write path.
   */
  const session = sessionOf(req, res);
  const who = opts.who ?? principalOf(req.headers as Record<string, string | undefined>, session);

  /**
   * ⛔ THE PAGE UPDATES ITSELF, WHICH IS WHAT MAKES THIS ONE INTERFACE RATHER THAN THREE.
   *
   * Peter: "there's still no 'single interface' to go through ProductOS. that's the root ask here."
   *
   * He was right and I had been answering a transport question. Everything he needs happens in
   * three places — read it in one, decide it in another, have the consequence authored in a third —
   * and the only surface where all three can converge is this one: it shows the feature, a press
   * writes to the corpus synchronously, and a watcher tells whoever is working. The single thing
   * missing was that when the truth changed underneath, the page went on showing the old one until
   * somebody reloaded by hand.
   *
   * So the corpus pushes. One connection, held open, an event per change — read from the SAME
   * event log a session polls as an inbox, so the page and whoever is authoring cannot disagree
   * about what happened. Two feeds would be two answers to that question, and the one nobody was
   * looking at would be the one that dropped a press.
   */
  if (req.method === "GET" && p === "/api/v2/live") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write("retry: 2000\n\n");
    const emit = (e: LoggedEvent): void => {
      res.write(`event: changed\ndata: ${JSON.stringify(lineFor(e))}\n\n`);
    };
    const { stop } = opts.stream ? opts.stream(emit) : watchLog(dir, { emit });
    /**
     * ⛔ A HEARTBEAT, because a silent stream is indistinguishable from a dead one to every proxy
     * between here and the browser — and a reader whose page has quietly stopped updating is worse
     * off than one who knows it never did.
     */
    /**
     * ⛔ A NAMED EVENT, NOT AN SSE COMMENT. A comment keeps proxies from closing the connection but
     * is invisible to the page — so the page could not tell a live stream from a dead one, which is
     * the failure mode a reader cannot detect for themselves and will act on. It counts as a beat
     * for the browser AND for the script watching for silence.
     */
    const beat = setInterval(() => res.write(`event: beat\ndata: ${JSON.stringify(new Date().toISOString())}\n\n`), 25_000);
    res.write(`event: beat\ndata: ${JSON.stringify(new Date().toISOString())}\n\n`);
    req.on("close", () => {
      clearInterval(beat);
      stop();
    });
    return true;
  }

  /**
   * ⛔ THE CORPUS OVER THE WIRE, so `--at <url>` reads the same bytes a directory would give it.
   *
   * ⛔ IT SERVES SOURCE, NOT A PARSED MODEL. One parser, one set of refusals, one set of `broken`
   * messages — a server that parsed first would be a second implementation of the model, and the
   * remote client would quietly disagree with the local one about what a corpus says. That the keys
   * are paths is not a leak: this is the wire between two halves of one program, and nothing a
   * READER sees comes through here.
   */
  if (req.method === "GET" && p === "/api/v2/corpus") {
    if (!who.scopes.includes("read")) return json(res, { ok: false, why: "this token may not read this corpus" }, 403), true;
    return json(res, { dir, files: corpusFiles(dir) }), true;
  }

  /**
   * ⛔ WHAT THIS INSTANCE THINKS YOU ARE. A client that cannot ask this has to infer its own
   * permissions from a refusal it gets halfway through doing something.
   */
  if (req.method === "GET" && p === "/api/v2/whoami") {
    return json(res, { kind: who.kind, actor: who.actor, session: who.session, scopes: who.scopes, mints_human_consent: false }), true;
  }

  /**
   * ⛔ THE OTHER HALF OF THE CONVERSATION, WHICH THE PAGE COULD NOT SHOW.
   *
   * Peter: *"i'm going to drive things mostly through product OS now, but let's add a 2-way window
   * so you can send messages back as well"*.
   *
   * The composer could file a request and nothing could answer it where he was standing. Every
   * reply had to happen in a chat window he is deliberately moving away from — so the surface he
   * reviews in was write-only, and the answer to "did anybody read this" was to go somewhere else
   * and ask.
   *
   * ⛔ SCOPED TO WHAT HE IS LOOKING AT, same as the composer above it. A thread of everything ever
   * said about the whole corpus is a log; the thread about THIS screen is a conversation.
   */
  if (req.method === "GET" && p === "/api/v2/thread") {
    /** ⛔ `p` arrives with the query already stripped, so the ref is read from the raw url. */
    /**
     * ⛔ THE TRAIL, NOT THE LEAF. Standing on a screen, the composer captures "Creating a deal /
     * screen: Create a deal" — so a note filed earlier against the FEATURE was invisible from the
     * screen inside it, and the window came up empty on the one page with a conversation on it.
     *
     * What somebody is looking at is every ref on the way down to where they are standing.
     */
    const q = new URL(req.url ?? "/", "http://localhost").searchParams;
    const refs = q.getAll("about").flatMap((x) => x.split("|")).map((x) => x.trim()).filter(Boolean);
    const all = loadCorpus(dir).notes;
    const mine = refs.length ? all.filter((n) => refs.includes(n.about)) : all;
    return (
      json(res, {
        notes: mine.map((n) => ({
          id: n.id,
          about: n.about,
          says: n.says,
          by: n.by,
          at: n.at,
          kind: n.kind ?? "corpus",
          state: n.state,
          outcome: n.outcome ?? null,
          replies: n.replies ?? [],
        })),
      }),
      true
    );
  }

  /**
   * ⛔ IS ANYBODY LISTENING. A press into nothing looks exactly like a press somebody picked up
   * within the second, and the person who made it will go on pressing and then stop trusting the
   * surface. The page asks this and says so out loud.
   */
  if (req.method === "GET" && p === "/api/v2/presence") {
    const waiting = loadCorpus(dir).notes.filter((n) => n.state === "open");
    return json(res, { working: working(dir), waiting: waiting.length }), true;
  }

  /**
   * ⛔ WHAT YOU WOULD BE AGREEING TO, BEFORE THE WRITE AND AS ITS OWN CALL.
   *
   * A reviewer named the defect this closes: *"there is no point at which a person can decline."*
   * The terminal used to show the sentences in the same breath as recording them. `preview` is
   * therefore separate from `perform`, and it has to be reachable over the wire too — otherwise
   * `--at <url>` is the one way of working where consent is taken without showing its object.
   */
  if (req.method === "POST" && p === "/api/v2/preview") {
    const body = await readJson(req);
    const act = String(body.act ?? "") as Act;
    if (!ACTS.includes(act)) return json(res, { ok: false, why: `"${body.act}" is not one of the five acts` }, 400), true;
    return json(res, preview(dir, act, payloadFrom(act, String(body.ref ?? ""), body))), true;
  }

  /**
   * ⛔ THE SESSION'S HALF OF THE LOOP, over the same log the page streams.
   *
   * Peter: "mcp main interface, a loop back path that claude sessions will poll from for now."
   *
   * POST rather than GET, because reading this inbox CLAIMS what it returns — a lease per note, so
   * a session on a laptop and one in the cloud do not both author the same request and overwrite
   * each other. A read that changes who owns the work is not a GET, and calling it one would
   * eventually put it behind a cache.
   *
   * ⛔ Every decision about cursors, claiming and what counts as work lives in `inbox`. This
   * handler reads the wire and hands over — the same reason no route here performs an act.
   */
  if (req.method === "POST" && p === "/api/v2/inbox") {
    const body = await readJson(req);
    const claim = typeof body.claim === "string" && body.claim.trim() ? body.claim.trim() : undefined;
    return (
      json(
        res,
        inbox(dir, {
          since: Number(body.since ?? 0) || 0,
          claim,
          limit: body.limit === undefined ? undefined : Number(body.limit),
          leaseMs: body.lease_ms === undefined ? DEFAULT_LEASE_MS : Number(body.lease_ms),
        })
      ),
      true
    );
  }

  /**
   * ⛔ ONE INPUT, ROUTED BY A NAMED INTENT — replacing `/act`, `/carry`, `/note`, `/say` and `/close`.
   *
   * Peter: *"don't we have a 'generic' way to message the system? and have it do whatever is
   * needed? why do we need so many endpoints?"* and then *"the generic door can mint consent - it's
   * a human input. yes, add a single input, get rid of the specific commands. the input should still
   * route to the right subsystem"*.
   *
   * ⛔ THE DOOR MAY MINT CONSENT, AND MY OBJECTION TO THAT WAS CONFUSED. I argued a generic endpoint
   * would let a model's request arrive wearing a person's authority. The gate was never the route:
   * `mayRecord` reads the PRINCIPAL and the claimed `via`, and refuses a token claiming a person
   * pressed something however it asks. Five routes were five copies of one authority check, not
   * five authorities — which is why a sixth would have arrived with its own copy or with none.
   *
   * ⛔ AND THE INTENT IS NAMED, NEVER INFERRED. `CLAUDE.md`: *"The tag sets `Note.kind`; nothing
   * infers it. A classifier reading the sentence would be a guess wearing a decision's clothes."*
   * That binds harder here — a classifier mis-reading a sentence as `accept` mints consent nobody
   * gave. An unknown intent is refused with the list.
   */
  /**
   * ⛔ THE DOOR DESCRIBES ITSELF, ON THE SAME PATH IT TAKES ORDERS ON.
   *
   * Peter: *"let's make sure we have a re-usable way to send messages to product OS, and appropriate
   * context/routing hints… eventually i'd like to be able to send mcp commands or have a slack
   * channel monitor that would take commands and route to the appropriate place"*.
   *
   * The door existed and could not say what it would take. `theIntents()` returned eleven names and
   * nothing else — not what each does, not what authority it needs, not one field — while its own
   * comment claimed it existed "so a caller never has to read this file to find the list". True of
   * the names, and the names are the part nobody needed help with. So the second client (MCP) and
   * the third (Slack) would each hardcode a contract they could not see, and `OWED`'s comment
   * already records what that costs: a refusal naming a remedy the surface never offered, twice.
   *
   * ⛔ GENERATED FROM `INTENTS`, NEVER WRITTEN OUT HERE. A hand-kept description beside a registry
   * is the same defect as a hand-kept list beside a union: it agrees on the day it is written.
   *
   * ⛔ GET ON THE POST PATH, DELIBERATELY. "What can I say to you" and "here is what I am saying"
   * are one conversation, so a caller that found the door has found its manual.
   */
  if (req.method === "GET" && p === "/api/v2/in") {
    return (
      json(res, {
        door: "/api/v2/in",
        how: "POST { intent, ...fields }",
        gates: {
          consent: "a person agreed — ⛔ a token can never claim this, whatever it asks",
          relay: "carrying a press somebody else made, keeping whose it was",
          author: "this principal's own words, claiming nothing about what anybody agreed to",
          open: "anybody may",
        },
        intents: describeIntents(),
        /** ⛔ The rule a relay must obey, carried WITH the contract rather than left in a file. */
        never: "nothing here guesses an intent, or what a request is about, from a sentence",
      }),
      true
    );
  }

  if (req.method === "POST" && p === "/api/v2/in") {
    const body = await readJson(req);
    const name = String(body.intent ?? "").trim();
    const intent = intentNamed(name);
    if (!intent)
      return (
        json(
          res,
          {
            ok: false,
            why: name ? `"${name}" is not something you can ask for` : "say which intent you mean",
            detail: [
              theIntents().join(" · "),
              "⛔ nothing here guesses an intent from a sentence",
              "GET this same path for what each one does and the fields it takes",
            ],
          },
          400
        ),
        true
      );
    const asking = { dir, who, pressing: whoIsPressing(req, opts.by) };
    /**
     * ⛔ TWO QUESTIONS, IN THIS ORDER, WITH DIFFERENT STATUSES.
     *
     * 403 is "you may not"; 422 is "you have not said enough". A relay does opposite things with
     * them — forbidden stops and tells a person, incomplete supplies the field and retries — so one
     * status for both turns a retryable mistake into what reads as a permissions outage.
     *
     * ⛔ AND THE AUTHORITY IS FIRST. Listing an operation's fields and only then refusing the
     * authority to perform it hands out its shape to a caller probing what it can reach.
     */
    const refused = refuseIntent(intent, asking, body);
    if (refused) return json(res, refused, 403), true;
    const short = incomplete(intent, body);
    if (short) return json(res, short, 422), true;
    const r = intent.run(asking, body);
    return json(res, r, r.ok ? 200 : 422), true;
  }


  if (req.method === "GET") {
    const corpus = loadCorpus(dir);
    const scope = p === "/v2" ? undefined : decodeURIComponent(p.slice("/v2/".length));
    /**
     * ⛔ `/v2` LANDS ON A REAL SCOPE, NOT AN INDEX OF ONE ITEM. Every scope tree has a root, and
     * the page already renders the whole subtree beneath whatever it is given — so an index page
     * listing one link would be a click for nothing. The nav is on the page.
     */
    const target = scope ?? corpus.scopes.find((s) => !s.scope.in)?.scope.id;
    if (!target) return html(res, standalone("Nothing here", `<main><h1>No corpus at <code>${dir}</code></h1></main>`), 404), true;
    /**
     * ⛔ THE APPLICATION'S OWN CSS, FROM THE CORPUS — NOT FROM A DISK BESIDE IT.
     *
     * This read `appStyleFor(dir)`, which resolves a repository above the corpus. An instance
     * materializes a project into a temp directory and there is no repository above that, so every
     * hosted drawing rendered unstyled while this exact line kept working locally. One source for
     * both, or the case with a checkout behind it is the one that always looks fine.
     */
    const page = renderScopePage(corpus, target, {
      interactive: true,
      records: "http",
      ...styleOf(corpus),
      linkBase: "/v2",
      by: whoIsPressing(req, opts.by),
      recordsTo: `written into ${dir}`,
    });
    if (!page) {
      const known = corpus.scopes.map((s) => s.scope.id);
      return (
        html(
          res,
          standalone(
            "Not found",
            `<main><h1>No scope "${target}"</h1><p>${known.map((k) => `<a href="/v2/${k}">${k}</a>`).join(" · ")}</p></main>`
          ),
          404
        ),
        true
      );
    }
    const title = corpus.scopes.find((s) => s.scope.id === target)?.scope.title ?? target;
    return html(res, standalone(title, page)), true;
  }

  return false;
}
