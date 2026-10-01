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
import { perform, preview, payloadFrom, VIA, type Act, type Via } from "./acts.js";
import { fileNote } from "./notes.js";
import { appStyleFor } from "./appcss.js";
import { watchLog, lineFor } from "./log.js";
import { inbox, DEFAULT_LEASE_MS } from "./inbox.js";
import { working } from "./presence.js";
import { mayRecord, mayRelay, principalOf, localAccount } from "./identity.js";


export interface V2Routes {
  /** The corpus directory this server is serving. */
  dir: string;
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

const ACTS: readonly Act[] = ["accept", "rule", "read", "waive", "defer"] as const;


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
const whoIsPressing = (): string => localAccount();

/**
 * Handle a `/v2` request. Returns `false` when the path is not ours, so the v1 server can carry
 * on — v2 is a parallel track and must not shadow a single v1 route.
 */
export async function v2Route(req: http.IncomingMessage, res: http.ServerResponse, p: string, { dir }: V2Routes): Promise<boolean> {
  /**
   * ⛔ ONE LIST, AND IT IS THE INSTANCE API. `productos serve` is not a preview of a hosted thing —
   * it IS the thing, deployed locally, with a directory behind it instead of a database. A route
   * that existed only in one of the two would make the local case a lesser experience, and the gate
   * that protects a corpus naming a real client would become a punishment for using it.
   */
  const OURS = [
    "/api/v2/act",
    "/api/v2/note",
    "/api/v2/live",
    "/api/v2/inbox",
    "/api/v2/carry",
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
  const who = principalOf(req.headers as Record<string, string | undefined>, session);

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
    const { stop } = watchLog(dir, {
      emit: (e) => res.write(`event: changed\ndata: ${JSON.stringify(lineFor(e))}\n\n`),
    });
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
   * ⛔ CARRYING A PRESS IS THE ONE THING A SESSION MAY DO WITH SOMEBODY ELSE'S CONSENT.
   *
   * A person can press somewhere this instance cannot see — a published page's database, another
   * instance. Losing that because the courier was automated would be worse than carrying it. So the
   * verdict keeps the PRESSER's name and `via`, and records who carried it; the courier's identity
   * never becomes the presser's.
   */
  if (req.method === "POST" && p === "/api/v2/carry") {
    const body = await readJson(req);
    const refusedRelay = mayRelay(who);
    if (refusedRelay) return json(res, refusedRelay, 403), true;
    const act = String(body.act ?? "") as Act;
    if (!ACTS.includes(act)) return json(res, { ok: false, why: `"${body.act}" is not one of the five acts`, detail: [ACTS.join(" · ")] }, 400), true;
    const via = String(body.via ?? "") as Via;
    if (!VIA.includes(via)) return json(res, { ok: false, why: `"${via}" is not a way consent could have been obtained` }, 400), true;
    const by = String(body.by ?? "").trim();
    if (!by) return json(res, { ok: false, why: "a carried press has to name who made it — that is the whole point of carrying it rather than recording it" }, 400), true;
    const r = perform(dir, act, payloadFrom(act, String(body.ref ?? ""), body), { by, via, relayedBy: who.actor });
    return json(res, r, r.ok ? 200 : 422), true;
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
   * ⛔ A NOTE IS NOT AN ACT, so it is a different route and a different file.
   *
   * Routing it through `/api/v2/act` would have been less code and would have made a request for
   * change indistinguishable from a judgement about truth at the one place both arrive.
   */
  if (req.method === "POST" && p === "/api/v2/note") {
    const body = await readJson(req);
    /**
     * ⛔ Filed through `fileNote`, not written here. This handler used to assemble the YAML itself,
     * which is the `gateFor`/`check` shape again — two writers for one file, diverging by whichever
     * field one of them forgot.
     */
    const r = fileNote(dir, {
      about: String(body.about ?? ""),
      says: String(body.says ?? ""),
      by: typeof body.by === "string" && body.by.trim() ? body.by.trim() : whoIsPressing(),
      via: "page",
      at: new Date().toISOString().slice(0, 10),
    });
    return json(res, r.ok ? { ok: true, said: r.said } : r, r.ok ? 200 : 422), true;
  }

  if (req.method === "POST" && p === "/api/v2/act") {
    const body = await readJson(req);
    const act = String(body.act ?? "") as Act;
    if (!ACTS.includes(act)) return json(res, { ok: false, why: `"${body.act}" is not one of the five acts`, detail: [ACTS.join(" · ")] }, 400), true;

    const via = (typeof body.via === "string" ? body.via : "page") as Via;
    if (!VIA.includes(via)) return json(res, { ok: false, why: `"${via}" is not a way consent could have been obtained`, detail: [VIA.join(" · ")] }, 400), true;

    const payload = payloadFrom(act, String(body.ref ?? ""), body);

    /**
     * ⛔ THE BOUNDARY, AT THE POINT OF THE WRITE. A token asking to record `via: page` is claiming a
     * person agreed, and no person is holding a token. Refused whatever it claims — see `mayRecord`,
     * and `carry` below for the one thing a session may legitimately do with somebody else's press.
     */
    const refused = mayRecord(who, via);
    if (refused) return json(res, refused, 403), true;

    /**
     * ⛔ A BROWSER PRESS IS RECORDED AS THE ACCOUNT THE INSTANCE AUTHENTICATED, not as a name the
     * request asked for. `by` from the wire was the last thing here anybody could forge.
     */
    const by = who.kind === "browser" ? who.actor : typeof body.by === "string" && body.by.trim() ? body.by.trim() : who.actor;
    const r = perform(dir, act, payload, { by, via });
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
    // The app's own CSS, so a mock written in its class names looks like the application.
    const app = appStyleFor(dir);
    const page = renderScopePage(corpus, target, {
      interactive: true,
      records: "http",
      appCss: app.css || undefined,
      mockClass: app.mockClass,
      linkBase: "/v2",
      by: whoIsPressing(),
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
