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
import os from "node:os";
import { loadCorpus } from "./load.js";
import { renderScopePage, standalone } from "./page.js";
import { perform, VIA, type Act, type Payload, type Via } from "./acts.js";
import { fileNote } from "./notes.js";
import { appStyleFor } from "./appcss.js";

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
 * The name a press is recorded under.
 *
 * ⛔ Recorded, not authenticated — the same as v1's verify button and the same as `--by`. There
 * is no login here and inventing one would imply a guarantee the model does not make; what makes
 * a stamp trustworthy is that `check` refuses it once its content moves.
 */
const whoIsPressing = (): string => os.userInfo().username || "whoever-is-at-this-machine";

/**
 * Handle a `/v2` request. Returns `false` when the path is not ours, so the v1 server can carry
 * on — v2 is a parallel track and must not shadow a single v1 route.
 */
export async function v2Route(req: http.IncomingMessage, res: http.ServerResponse, p: string, { dir }: V2Routes): Promise<boolean> {
  if (p !== "/v2" && !p.startsWith("/v2/") && p !== "/api/v2/act" && p !== "/api/v2/note") return false;

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

    const ref = String(body.ref ?? "");
    /**
     * ⛔ The payload shape per act, assembled here rather than trusted from the wire. `perform`
     * validates everything that matters, but a field arriving under the wrong name would be
     * silently dropped — and a dropped `because` is a ruling recorded with no reasoning.
     */
    const payload: Payload =
      act === "accept"
        ? { target: ref }
        : act === "read"
          ? {
              scope: ref,
              buildable: body.buildable === true || body.buildable === "yes",
              blockedBy: Array.isArray(body.blockedBy) ? body.blockedBy.map(String) : undefined,
              note: body.note === undefined ? undefined : String(body.note),
            }
          : act === "waive"
            ? { slot: ref, because: String(body.because ?? "") }
            : act === "defer"
              ? { slot: ref, because: String(body.because ?? ""), until: String(body.until ?? "") }
              : {
                  slot: ref,
                  because: String(body.because ?? ""),
                  says: body.says === undefined || String(body.says).trim() === "" ? undefined : String(body.says),
                  pick: body.pick === undefined ? undefined : Number(body.pick),
                  stands: body.stands === undefined ? undefined : String(body.stands),
                  then: body.then === undefined ? undefined : String(body.then),
                  defersTo: body.defersTo === undefined ? undefined : String(body.defersTo),
                  insteadOf: body.insteadOf === undefined ? undefined : String(body.insteadOf),
                  refuses: body.refuses === undefined ? undefined : body.refuses === true || body.refuses === "yes",
                };

    const by = typeof body.by === "string" && body.by.trim() ? body.by.trim() : whoIsPressing();
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
