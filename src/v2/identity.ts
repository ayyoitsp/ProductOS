/**
 * ⛔ A SESSION CAN NEVER MINT CONSENT. IT CAN ONLY CARRY ONE.
 *
 * Tenet 1 is *a human validated this*, and until now it has been honour-system: the CLI writes
 * whatever `--by` it is handed, and `via: agent` is filtered at `stampFor` because we wrote it that
 * way. Nothing stopped a model recording `via: page` and a name.
 *
 * An instance is the first place it becomes PROVABLE, because the instance issued the browser
 * session that pressed the button and therefore knows the press did not come from a token. So:
 *
 *   - a press from a browser session the instance issued → a verdict, `via: page`, actor = that
 *     session's account
 *   - anything arriving on an agent token → REFUSED AS A VERDICT, whatever it claims. It may
 *     author. It may decide (`via: agent`, which is a default and not agreement). It may relay a
 *     press somebody else made — and the relay carries the PRESS's identity, never the token's.
 *
 * ⛔ AND NO TOKEN SCOPE EXISTS THAT MINTS HUMAN CONSENT. Not "no token has it by default" — the
 * scope is not in the vocabulary, the same way no capability a judge can declare maps to a writing
 * tool. A permission that can be granted is a permission somebody eventually grants.
 *
 * ⛔ WHAT THIS COSTS, SAID PLAINLY: an agent that genuinely knows the answer still cannot record
 * agreement, so a person must press even when the answer is obvious. That is the intended cost. The
 * alternative is a corpus whose validation means *something in the pipeline believed this*, which
 * is worth nothing to the person betting a quarter's roadmap on it.
 */
import fs from "node:fs";
import os from "node:os";
import { isHuman, type Via } from "./acts.js";

/**
 * ⛔ THE WHOLE VOCABULARY. Read what is there, author drafts, carry somebody else's press.
 *
 * There is deliberately no fourth entry. `accepted-by-human` is not a scope that is off by default;
 * it is a scope that does not exist, so no configuration file, no migration and no well-meaning
 * future commit can turn it on. `mintsHumanConsent` below is the test's handle on that absence.
 */
export const TOKEN_SCOPES = ["read", "author", "relay"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

/**
 * ⛔ THE PROPERTY, AS A FUNCTION SOMETHING CAN ASSERT ON. An absence cannot be tested by reading
 * the list and nodding at it; this is what a boundary test calls for every scope in the vocabulary
 * and requires to be false everywhere, so adding a scope that grants it fails the build.
 */
export const mintsHumanConsent = (_scope: TokenScope): boolean => false;

export interface Principal {
  /**
   * `browser` — the instance issued this session and observed the press itself.
   * `token`   — something automated is holding a credential. It cannot have pressed anything.
   */
  kind: "browser" | "token";
  /** The account, not a string somebody typed. For a local instance, whoever is at the machine. */
  actor: string;
  /** Which browser session, for audit. Absent on a token. */
  session?: string;
  scopes: readonly TokenScope[];
}

export interface Refusal {
  ok: false;
  why: string;
  detail?: string[];
}

/** Ways consent can be obtained from a PERSON. ⛔ `agent` is not among them and never will be. */
export const HUMAN_VIA: readonly Via[] = ["page", "question", "chat", "cli"] as const;

/**
 * May this principal record a verdict claiming this `via`?
 *
 * ⛔ THE ONE FUNCTION THE GUARANTEE LIVES IN. Every write path asks it — the HTTP route, the relay,
 * and anything added later — because a boundary enforced at three call sites is a boundary enforced
 * at two of them within a month.
 */
export function mayRecord(p: Principal, via: Via): Refusal | null {
  if (!isHuman(via)) {
    // `via: agent` is a default, not agreement. It satisfies no gate, so authoring is enough.
    return p.scopes.includes("author")
      ? null
      : {
          ok: false,
          why: "this token may not write to the corpus",
          detail: [`it holds: ${p.scopes.join(" · ") || "nothing"}`, "it needs `author` to land a default a reviewer can disagree with"],
        };
  }
  if (p.kind === "browser") return null;
  return {
    ok: false,
    why: `a token cannot record "${via}" — that claims a person agreed, and no person is holding a token`,
    detail: [
      "⛔ no token scope mints human consent. It is not off by default; it is not in the vocabulary.",
      "what a session CAN do: record `via: agent`, which is a default and satisfies no gate — or relay a press a person actually made, with `carry`, which records THEIR identity and not the token's",
      "if a person is in the room, ask them, and let them press",
    ],
  };
}

/**
 * ⛔ RELAYING IS NOT RECORDING, AND THE VERDICT SAYS SO.
 *
 * A press made somewhere this instance cannot see — a published page's database, another instance —
 * is still a person's press, and losing it because the courier was automated would be worse than
 * carrying it. But the corpus must never claim this instance watched it happen. So a relayed
 * verdict carries the presser's `by` and `via`, and `relayed_by` naming the courier: what is
 * trustworthy about it and what is taken on somebody's word, in the record rather than in a memory.
 */
export function mayRelay(p: Principal): Refusal | null {
  return p.scopes.includes("relay")
    ? null
    : {
        ok: false,
        why: "this token may not carry somebody else's press",
        detail: [`it holds: ${p.scopes.join(" · ") || "nothing"}`, "it needs `relay`"],
      };
}

// ---------------------------------------------------------------------------
// Where tokens come from.

export interface ConfiguredToken {
  token: string;
  actor: string;
  scopes: TokenScope[];
}

/**
 * Tokens an instance honours.
 *
 * ⛔ INSTANCE CONFIGURATION, NOT CORPUS TRUTH. A credential filed in the corpus would be published
 * with it, travel in every packet, and survive every `reset` that restores a pristine copy.
 *
 * `PRODUCTOS_TOKENS` — inline JSON, for a container.
 * `PRODUCTOS_TOKENS_FILE` — a path, for anything else.
 */
export function configuredTokens(env: NodeJS.ProcessEnv = process.env): ConfiguredToken[] {
  const raw = env.PRODUCTOS_TOKENS ?? (env.PRODUCTOS_TOKENS_FILE && fs.existsSync(env.PRODUCTOS_TOKENS_FILE) ? fs.readFileSync(env.PRODUCTOS_TOKENS_FILE, "utf-8") : "");
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as ConfiguredToken[];
    return (Array.isArray(parsed) ? parsed : []).map((t) => ({
      token: String(t.token ?? ""),
      actor: String(t.actor ?? "an unnamed token"),
      /** ⛔ Unknown scope names are DROPPED, not passed through. A typo that grants nothing is safe;
       *  a typo carried into a permission check is a scope nobody audited. */
      scopes: (Array.isArray(t.scopes) ? t.scopes : []).filter((s): s is TokenScope => (TOKEN_SCOPES as readonly string[]).includes(s)),
    })).filter((t) => t.token);
  } catch {
    return [];
  }
}

/**
 * Who is making this request.
 *
 * ⛔ A BEARER TOKEN IS ALWAYS A TOKEN, EVEN IF IT ALSO SENDS A COOKIE. Deciding "browser" from the
 * presence of a session cookie would let anything automated mint human consent by holding one, and
 * a cookie is the easiest thing in this system to copy.
 */
export function principalOf(
  headers: Record<string, string | string[] | undefined>,
  session: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): Principal {
  const auth = String(headers.authorization ?? "");
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer) {
    const known = configuredTokens(env).find((t) => t.token === bearer);
    return { kind: "token", actor: known?.actor ?? "an unrecognised token", scopes: known?.scopes ?? [] };
  }
  return { kind: "browser", actor: localAccount(), session, scopes: ["read", "author"] };
}

/**
 * The account a local instance runs as.
 *
 * ⛔ STILL NOT AUTHENTICATION, AND THE COMMENT STAYS UNTIL IT IS. One person is at this machine and
 * the instance watched them press the button, which is the claim `via: page` actually makes. What
 * hosting adds is an account this cannot forge; what it does not change is that a stamp is
 * trustworthy because `check` refuses it once its content moves.
 */
export const localAccount = (): string => os.userInfo().username || "whoever-is-at-this-machine";
