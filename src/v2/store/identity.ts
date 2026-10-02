/**
 * Who is asking, when the instance is hosted.
 *
 * ⛔ THIS FILE ADDS NO PERMISSION AND CHANGES NO DECISION. `../identity.ts` is still the vocabulary
 * and `mayRecord` is still the one function every write path asks. All that moves here is where the
 * two forgeable stubs got their answers: `localAccount()` was `os.userInfo().username`, and
 * `configuredTokens()` read a JSON blob out of an env var. Neither survives two machines.
 *
 * ⛔ AND THE ONE HOLE THAT HOSTING OPENS IS CLOSED BY A RETURN TYPE.
 *
 * `mayRecord` lets any `browser` principal record a press, because locally that claim is true: one
 * person is at the machine and the instance watched them press the button. Hosted, an anonymous
 * request must therefore NEVER become a `browser` principal — or every unauthenticated caller can
 * mint human consent, which is tenet 1 gone with no audit trail saying when.
 *
 * So `principalFrom` returns `null` for a request it cannot identify, rather than a principal with
 * no scopes. A principal that exists is a principal somebody will eventually pass to `mayRecord`;
 * an absent one has to be handled at the route. Asserted in `test/v2-store-identity.test.mjs`.
 */
import crypto from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { Principal, TokenScope } from "../identity.js";
import { TOKEN_SCOPES } from "../identity.js";
import type { Db } from "./access.js";
import { accounts, loginCodes, sessions, tokens } from "./schema.js";

/** ⛔ A browser principal always carries the account the instance authenticated. */
export interface HostedPrincipal extends Principal {
  account: string;
  reach: readonly string[];
}

const id = (prefix: string): string => `${prefix}-${crypto.randomBytes(12).toString("hex")}`;

/**
 * ⛔ SHA-256, AND THAT IS NOT THE PASSWORD MISTAKE IT LOOKS LIKE.
 *
 * Slow KDFs exist because human-chosen passwords are guessable; these are 32 random bytes, so there
 * is nothing to guess and a brute-force is the same work as brute-forcing the token itself. What
 * hashing buys here is that reading the table does not hand somebody every customer's credentials —
 * which is the actual risk, and the reason the column cannot stay plaintext the way an operator-set
 * env var could.
 */
export const hashToken = (raw: string): string =>
  crypto.createHash("sha256").update(raw, "utf-8").digest("hex");

// ---------------------------------------------------------------------------
// Accounts and signing in
// ---------------------------------------------------------------------------

export async function accountFor(db: Db, email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.email, normalized));
  if (existing) return existing.id;
  const created = id("acct");
  await db.insert(accounts).values({ id: created, email: normalized });
  return created;
}

/**
 * Begin a sign-in. Returns the code to deliver.
 *
 * ⛔ DELIVERY IS NOT IN HERE AND IS NOT PRETENDED TO BE. Emailing the code (or exchanging an OAuth
 * callback for an email) is the host's business; what this module owns is that a session exists only
 * because somebody proved control of an address. Returning the code rather than sending it keeps
 * that seam honest instead of stubbing a mailer that silently drops everything.
 */
export async function requestLogin(
  db: Db,
  email: string,
  ttlMinutes = 15,
): Promise<{ email: string; code: string }> {
  const normalized = email.trim().toLowerCase();
  const code = crypto.randomBytes(16).toString("hex");
  await db.insert(loginCodes).values({
    id: id("lc"),
    email: normalized,
    hash: hashToken(code),
    expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
  });
  return { email: normalized, code };
}

/**
 * Redeem a code for a session.
 *
 * ⛔ SINGLE USE, ENFORCED BY A WRITE RATHER THAN BY DELETING. A code that still works after it has
 * been used is a code in somebody's mail archive that still works, and the window is however long
 * the mailbox lives.
 */
export async function redeemLogin(
  db: Db,
  email: string,
  code: string,
  sessionDays = 30,
): Promise<{ session: string; account: string } | null> {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select({ id: loginCodes.id })
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.email, normalized),
        eq(loginCodes.hash, hashToken(code)),
        isNull(loginCodes.usedAt),
        gt(loginCodes.expiresAt, new Date()),
      ),
    );
  if (!row) return null;

  await db.update(loginCodes).set({ usedAt: new Date() }).where(eq(loginCodes.id, row.id));

  const account = await accountFor(db, normalized);
  const session = id("sess");
  await db.insert(sessions).values({
    id: session,
    accountId: account,
    expiresAt: new Date(Date.now() + sessionDays * 86_400_000),
  });
  return { session, account };
}

export async function endSession(db: Db, session: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, session));
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * Issue a token. ⛔ The raw value is returned once and never stored.
 *
 * Unknown scope names are DROPPED rather than passed through — the same rule `configuredTokens`
 * already applied. A typo that grants nothing is safe; a typo carried into a permission check is a
 * scope nobody audited.
 */
export async function issueToken(
  db: Db,
  opts: { account: string; actor: string; scopes: string[]; reach?: string[] },
): Promise<{ token: string; id: string }> {
  const raw = crypto.randomBytes(32).toString("hex");
  const tokenId = id("tok");
  const scopes = opts.scopes.filter((s): s is TokenScope =>
    (TOKEN_SCOPES as readonly string[]).includes(s),
  );
  await db.insert(tokens).values({
    id: tokenId,
    accountId: opts.account,
    hash: hashToken(raw),
    actor: opts.actor,
    scopes,
    reach: opts.reach ?? [],
  });
  return { token: raw, id: tokenId };
}

export async function revokeToken(db: Db, tokenId: string): Promise<void> {
  await db.update(tokens).set({ revokedAt: new Date() }).where(eq(tokens.id, tokenId));
}

// ---------------------------------------------------------------------------
// The resolver
// ---------------------------------------------------------------------------

/**
 * Identify a request, or decline to.
 *
 * ⛔ A BEARER TOKEN IS ALWAYS A TOKEN, EVEN IF IT ALSO SENDS A SESSION COOKIE. The same rule
 * `principalOf` states: deciding "browser" from the presence of a cookie would let anything
 * automated mint human consent by holding one, and a cookie is the easiest thing here to copy.
 *
 * ⛔ AN UNRECOGNISED TOKEN IS STILL A TOKEN, WITH NOTHING. Returning `null` for it would send it
 * down the same path as an anonymous browser request, and the route's 401 would then be the only
 * thing standing between a guessed credential and a write.
 *
 * Returns `null` only when there is no credential at all — see the file header for why that is a
 * `null` and not a scopeless browser.
 */
export async function principalFrom(
  db: Db,
  headers: Record<string, string | string[] | undefined>,
  session?: string,
): Promise<HostedPrincipal | null> {
  const auth = String(headers.authorization ?? "");
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (bearer) {
    const [row] = await db
      .select({
        id: tokens.id,
        account: tokens.accountId,
        actor: tokens.actor,
        scopes: tokens.scopes,
        reach: tokens.reach,
      })
      .from(tokens)
      .where(and(eq(tokens.hash, hashToken(bearer)), isNull(tokens.revokedAt)));

    if (!row) {
      return { kind: "token", actor: "an unrecognised token", account: "", reach: [], scopes: [] };
    }
    // Best-effort, and deliberately not awaited into the request's critical path.
    await db.update(tokens).set({ lastUsedAt: new Date() }).where(eq(tokens.id, row.id));
    return {
      kind: "token",
      actor: row.actor,
      account: row.account,
      reach: row.reach ?? [],
      scopes: (row.scopes ?? []) as TokenScope[],
    };
  }

  if (session) {
    const [row] = await db
      .select({ account: sessions.accountId, email: accounts.email })
      .from(sessions)
      .innerJoin(accounts, eq(accounts.id, sessions.accountId))
      .where(and(eq(sessions.id, session), gt(sessions.expiresAt, new Date())));
    if (row) {
      /**
       * ⛔ THE ONE PLACE `kind: "browser"` IS MINTED, AND IT REQUIRES A ROW THE INSTANCE WROTE.
       * This is what makes `via: page` provable rather than claimed: the instance issued this
       * session, so it knows the press did not arrive on a token.
       */
      return {
        kind: "browser",
        actor: row.email,
        account: row.account,
        session,
        reach: [],
        scopes: ["read", "author"],
      };
    }
  }

  return null;
}

/**
 * The local case: one account, env-configured, same image and same API.
 *
 * ⛔ HOSTED-FIRST IS NOT HOSTED-ONLY. A corpus that must never leave the machine runs an instance on
 * the machine and gets the identical loop. If the local case degraded, the gate that protects a
 * corpus naming a real client would become a punishment for using it — so this returns a real
 * account and a real session row, not a special principal that skips the checks.
 */
export async function singleAccount(db: Db, email: string): Promise<{ account: string; session: string }> {
  const account = await accountFor(db, email);
  const [existing] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.accountId, account), gt(sessions.expiresAt, new Date())));
  if (existing) return { account, session: existing.id };

  const session = id("sess");
  await db.insert(sessions).values({
    id: session,
    accountId: account,
    expiresAt: new Date(Date.now() + 365 * 86_400_000),
  });
  return { account, session };
}

export { sql };
