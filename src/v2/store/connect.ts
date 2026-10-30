/**
 * Connecting Claude Code to a project, from the page — `/p/<id>/api/v2/tokens`.
 *
 * Peter, on what blocks the MVP: *"`productos connect` and token issuing from the page"*. Sessions
 * connect to `/p/<id>/mcp` with a bearer token, and until this route the only way to get one was
 * `productos hosted token new`, which needs `DATABASE_URL` — so the person who owns the project, on
 * the page they own it from, could not connect anything to it.
 *
 * ⛔ ONLY A PERSON MINTS, AND A TOKEN NEVER DOES. A token that could issue a token would turn any
 * leaked credential into an unbounded supply of fresh ones the leak's owner never sees — and a
 * revocation would chase it forever. So a `token` principal is refused here outright, whatever its
 * scopes, and so is anything the instance cannot identify. The only caller that gets a secret is a
 * `browser` principal: a session the instance itself issued.
 *
 * ⛔ AND WHAT IT MINTS REACHES THIS ONE PROJECT. `reach: []` means *every project the account can
 * reach*, which is what `hosted token new` defaults to and exactly what a press on one project's page
 * must not hand out. The reach is the project in the path — never a body field — so there is nothing
 * to widen.
 *
 * ⛔ THE SECRET IS ANSWERED ONCE AND STORED AS A HASH. `issueToken` keeps only `hashToken(raw)`; this
 * route returns the raw value in the one response that minted it, and nothing — not the list, not a
 * revoke — can show it again.
 */
import http from "node:http";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { TOKEN_SCOPES } from "../identity.js";
import { type Db, isRefusal, storeFor } from "./access.js";
import { issueToken, principalFrom, revokeToken } from "./identity.js";
import { endGrantOf } from "./oauth.js";
import { tokens } from "./schema.js";
import { cookieOf } from "./instance.js";

/** `/p/<id>/api/v2/tokens` and `/p/<id>/api/v2/tokens/<token-id>`. ⛔ Anchored, like the MCP path. */
const TOKENS_PATH =
  /^\/p\/(?!\.\.?(?:\/|$))([A-Za-z0-9_.:@+-]{1,200})\/api\/v2\/tokens(?:\/([A-Za-z0-9_-]{1,100}))?\/?$/;

export const tokensPathOf = (pathname: string): { project: string; token?: string } | null => {
  const m = TOKENS_PATH.exec(pathname);
  return m ? { project: m[1]!, ...(m[2] ? { token: m[2] } : {}) } : null;
};

/** What the audit trail calls a token minted from the page. Not a credential. */
export const PAGE_TOKEN_ACTOR = "Claude Code, connected from the page";

export async function connectRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  opts: { db: Db; localSession?: string },
): Promise<boolean> {
  const addressed = tokensPathOf(pathname);
  if (!addressed) return false;

  const json = (body: unknown, status = 200): true => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(body, null, 2));
    return true;
  };

  const who = await principalFrom(
    opts.db,
    req.headers as Record<string, string | undefined>,
    cookieOf(req) ?? opts.localSession,
  );
  if (!who) {
    return json({ ok: false, why: "not signed in", detail: ["only a signed-in person can connect something to a project"] }, 401);
  }

  /**
   * ⛔ BEFORE REACH, so a token learns nothing about which projects exist by watching this answer
   * change. Every token gets the same 403 for every project id.
   */
  if (who.kind !== "browser") {
    return json(
      {
        ok: false,
        why: "a token cannot issue or revoke tokens",
        detail: ["a person signed in to the page issues them — otherwise one leaked token is a supply of fresh ones"],
      },
      403,
    );
  }

  const reached = await storeFor(opts.db, who).project(addressed.project);
  if (isRefusal(reached)) return json(reached, 404);

  const method = req.method ?? "GET";

  /** This account's tokens for this project — metadata only. ⛔ The secret is gone by now. */
  if (method === "GET" && !addressed.token) {
    const rows = await opts.db
      .select({
        id: tokens.id,
        actor: tokens.actor,
        reach: tokens.reach,
        createdAt: tokens.createdAt,
        lastUsedAt: tokens.lastUsedAt,
      })
      .from(tokens)
      .where(
        and(
          eq(tokens.accountId, who.account),
          isNull(tokens.revokedAt),
          or(isNull(tokens.expiresAt), gt(tokens.expiresAt, new Date())),
        ),
      );
    return json({
      ok: true,
      tokens: rows
        .filter((r) => r.reach.length === 1 && r.reach[0] === addressed.project)
        .map(({ reach: _reach, ...r }) => r),
    });
  }

  if (method === "POST" && !addressed.token) {
    /**
     * ⛔ A JSON BODY, SO A CROSS-SITE FORM CANNOT PRESS THIS. A form post cannot set
     * `content-type: application/json`, and a script on another origin that tries is stopped at the
     * preflight — so the session cookie alone is never enough to mint.
     */
    if (!String(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
      return json({ ok: false, why: "send this as application/json" }, 415);
    }
    const issued = await issueToken(opts.db, {
      account: who.account,
      actor: PAGE_TOKEN_ACTOR,
      scopes: [...TOKEN_SCOPES],
      reach: [addressed.project],
    });
    return json({ ok: true, id: issued.id, token: issued.token, shown: "once" }, 201);
  }

  if (method === "DELETE" && addressed.token) {
    /**
     * ⛔ ONLY YOUR OWN, AND ONLY ONE THAT REACHES EXACTLY THIS PROJECT. Anything else answers the
     * same 404 as a token that does not exist, for the reason `unreachable` gives in `access.ts`.
     */
    const [row] = await opts.db
      .select({ id: tokens.id, reach: tokens.reach, grantId: tokens.grantId })
      .from(tokens)
      .where(and(eq(tokens.id, addressed.token), eq(tokens.accountId, who.account)));
    if (!row || row.reach.length !== 1 || row.reach[0] !== addressed.project) {
      return json({ ok: false, why: `no token here that you can revoke: ${addressed.token}` }, 404);
    }
    await revokeToken(opts.db, row.id);
    /** ⛔ Claude's token renews itself; revoking only the hour it holds would last an hour. */
    await endGrantOf(opts.db, row.grantId);
    return json({ ok: true, revoked: row.id });
  }

  return json({ ok: false, why: `${method} is not something this address does` }, 405);
}
