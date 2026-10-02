import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

export const SESSION_COOKIE = "productos_session";

function agentSecret(): string {
  const s = process.env.PRODUCTOS_SECRET;
  if (!s) {
    throw new Error("PRODUCTOS_SECRET is not set. Refusing to start — see .env.example");
  }
  return s;
}

function humanSecret(): string {
  const s = process.env.PRODUCTOS_HUMAN_SECRET;
  if (!s) {
    throw new Error("PRODUCTOS_HUMAN_SECRET is not set. Validation would be unprotected.");
  }
  return s;
}

/**
 * API gate — header credential.
 *
 * v0.1 has no user accounts, but "no auth" is not "no access control". A public
 * ingress with nothing in front of it means anyone who finds the URL can read
 * and write a customer's product truth.
 */
export function requireSecret(): MiddlewareHandler {
  const secret = agentSecret();
  return async (c, next) => {
    const provided =
      c.req.header("x-productos-secret") ??
      c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (!provided || !timingSafeEqual(provided, secret)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    return next();
  };
}

/**
 * Human gate — used by validation routes.
 *
 * Accepts either the human header (for scripts) or a browser session cookie,
 * which is only issued in exchange for the human secret. An agent holding the
 * agent token has no path to either.
 */
export function requireHuman(): MiddlewareHandler {
  const secret = humanSecret();
  return async (c, next) => {
    const header = c.req.header("x-productos-human");
    const cookie = getCookie(c, SESSION_COOKIE);
    const ok =
      (header && timingSafeEqual(header, secret)) || (cookie && timingSafeEqual(cookie, secret));
    if (!ok) {
      return c.json(
        {
          error: "human_validation_required",
          message: "Validation requires the human credential. Agents propose; only humans validate.",
        },
        403,
      );
    }
    return next();
  };
}

/** Browser session gate — redirects to the sign-in page rather than 401-ing. */
export function requireSession(): MiddlewareHandler {
  const secret = humanSecret();
  return async (c, next) => {
    const cookie = getCookie(c, SESSION_COOKIE);
    if (!cookie || !timingSafeEqual(cookie, secret)) {
      return c.redirect("/app/signin");
    }
    return next();
  };
}

export function startSession(c: Parameters<MiddlewareHandler>[0], value: string) {
  // `secure` breaks plain-http localhost, so key it off the actual request
  // scheme rather than an env flag — correct in both places without config.
  const isHttps = new URL(c.req.url).protocol === "https:";
  setCookie(c, SESSION_COOKIE, value, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function endSession(c: Parameters<MiddlewareHandler>[0]) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export function checkHumanSecret(value: string): boolean {
  return timingSafeEqual(value, humanSecret());
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
