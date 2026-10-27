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
 *   - a command typed into a shell SOFTWARE is holding → REFUSED AS A VERDICT, for the same reason
 *     and with the same exits. ⛔ THIS WAS THE LAST DOOR, and it stayed open longest because it
 *     looked like the honest one: both of the other two refusals point at *the person's own CLI*,
 *     and an agent with a Bash tool is holding that CLI. `accept --by peter --via chat` from a
 *     model's shell was byte-identical to a verdict Peter pressed.
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
import { type Hand } from "./schema.js";

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
   * `browser`  — the instance issued this session and observed the press itself.
   * `terminal` — a shell with a person's hands on it: something is attached to this process and
   *              nothing in the environment says software is driving it.
   * `driven`   — a shell SOFTWARE is holding. It typed the command; nobody pressed anything.
   * `token`    — something automated is holding a credential. It cannot have pressed anything.
   */
  kind: (typeof PRINCIPAL_KINDS)[number];
  /** The account, not a string somebody typed. For a local instance, whoever is at the machine. */
  actor: string;
  /** Which browser session, for audit. Absent on a token. */
  session?: string;
  scopes: readonly TokenScope[];
  /**
   * Why this principal is not a person, in the words the refusal leads with. Set on `driven`,
   * because "a shell cannot agree" is useless without *which* shell and *what gave it away*.
   */
  because?: string;
}

/**
 * ⛔ EVERY KIND OF CALLER THERE IS, AS VALUES — so a boundary test can enumerate them.
 *
 * `mintsHumanConsent` is the handle on an absence in the token vocabulary; this is the handle on
 * the same absence across callers. A fifth kind added without a decision about whether it may press
 * fails `watchedAPerson`'s test rather than silently inheriting one side of the boundary.
 */
export const PRINCIPAL_KINDS = ["browser", "terminal", "driven", "token"] as const;

/**
 * ⛔ THE TWO CALLERS A PRESS CAN HAVE COME FROM, AND IT IS NOT A LIST OF WHO IS TRUSTED.
 *
 * A browser session the instance issued, and a terminal a person is standing at. Both are the same
 * claim — *somebody was here and did this* — made on the only evidence each door has. Neither is
 * authentication and the comment on `localAccount` already says so.
 *
 * Everything else may author and may not agree, which is a property rather than a configuration:
 * no flag, no scope and no environment variable moves a kind across this line.
 */
export const watchedAPerson = (kind: Principal["kind"]): boolean => kind === "browser" || kind === "terminal";

export interface Refusal {
  ok: false;
  why: string;
  detail?: string[];
}

/** Ways consent can be obtained from a PERSON. ⛔ `agent` is not among them and never will be. */
export const HUMAN_VIA: readonly Via[] = ["page", "question", "chat", "cli"] as const;

/**
 * ⛔ WHAT EACH DOOR IS AND THE HONEST ROUTE OUT OF IT — one table, two gates, four kinds.
 *
 * A refusal that only says no is where a session stops reviewing and starts looking for the way
 * round, which is how this hole was opened in the first place: two doors were shut this week and
 * both of them pointed at *the person's own CLI*, while an agent was holding that CLI.
 *
 * So the wording is per DOOR, not per gate. "No person is holding a token" is true and useless to a
 * shell, where the true sentence is that software typed the command — and the exit is not the same
 * one either: a token can `carry` somebody's press, a shell cannot, and a person at a keyboard can
 * simply run the thing themselves.
 */
const NOT_A_PERSON: Record<
  "driven" | "token",
  { it: string; nobody: string; absence: string; handAbsence: string; consent: string[]; hand: string[] }
> = {
  token: {
    it: "a token",
    nobody: "no person is holding a token",
    absence: "⛔ no token scope mints human consent. It is not off by default; it is not in the vocabulary.",
    handAbsence: "⛔ no token scope mints a person's hand. It is not off by default; it is not in the vocabulary — the same absence as human consent.",
    consent: [
      "what a session CAN do: record `via: agent`, which is a default and satisfies no gate — or relay a press a person actually made, with `carry`, which records THEIR identity and not the token's",
      "if a person is in the room, ask them, and let them press",
    ],
    hand: [
      "what a session CAN do: write `hand: agent` with `from:` saying what it was worked out from. That is an inference a grooming agent raises as a question, which is the whole reason the field is there",
      "if a person really typed these words, they land it themselves from a page — then the hand is DERIVED from a press the instance watched, rather than typed by whoever is holding the token",
    ],
  },
  driven: {
    /**
     * ⛔ TRUE OF BOTH SHELLS THIS REFUSES, which is why it names neither. A driver's variable and a
     * shell with nothing attached are different facts and `because` says which; the sentence they
     * share is that nobody can be shown to have pressed anything here.
     */
    it: "this shell",
    nobody: "nothing here can be shown to have pressed it",
    absence:
      "⛔ no flag and no environment variable turns this on, and that is deliberate: a switch an agent can set is a switch the agent sets. It is not off by default; it is not in the vocabulary — the same absence as a token scope that mints consent.",
    handAbsence:
      "⛔ no flag and no environment variable mints a person's hand here either — the same absence, for the same reason.",
    consent: [
      "what a session CAN do: record `via: agent` — a default, satisfying no gate, which is the designed path. Land it and let the reviewer disagree with it",
      "if a person is in the room: they run this same command in their own terminal, or press it on the page. Either way the press is theirs, and nothing typed here can stand in for it",
      "if this is a detached shell a person really is driving — `ssh` with no `-t`, every stream redirected — attach one, and the refusal goes away without a flag",
    ],
    hand: [
      "what a session CAN do: write `hand: agent` with `from:` saying what it was worked out from — an inference a grooming agent raises as a question, which is the whole reason the field is there",
      "if a person really typed these words, they land it from their own terminal or from the page, and the hand is DERIVED from that rather than typed by whatever is driving this shell",
    ],
  },
};

/** ⛔ Which door this is. Anything that is not a watched press is one of exactly two refusals. */
const doorOf = (p: Principal): (typeof NOT_A_PERSON)[keyof typeof NOT_A_PERSON] & { because?: string } => ({
  ...NOT_A_PERSON[p.kind === "token" ? "token" : "driven"],
  because: p.because,
});

/**
 * May this principal record a verdict claiming this `via`?
 *
 * ⛔ THE ONE FUNCTION THE GUARANTEE LIVES IN. Every write path asks it — the HTTP route, the relay,
 * the CLI, and anything added later — because a boundary enforced at three call sites is a boundary
 * enforced at two of them within a month. The CLI was the call site that never asked: it wrote
 * whatever `--via` it was handed, so `accept --by peter --via chat` from an agent's Bash tool
 * produced a verdict byte-identical to one Peter pressed.
 */
/**
 * ⛔ `Via | "review"`, because a filed request asks this principal the same question a verdict does
 * — did a person do this — and `review` is the one way of arriving that means nobody asked at all.
 * `isHuman` now names the human set positively, so adding a value cannot quietly make it human.
 */
export function mayRecord(p: Principal, via: Via | "review"): Refusal | null {
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
  if (watchedAPerson(p.kind)) return null;
  const door = doorOf(p);
  return {
    ok: false,
    why: `${door.it} cannot record "${via}" — that claims a person agreed, and ${door.nobody}`,
    detail: [...(door.because ? [door.because] : []), door.absence, ...door.consent],
  };
}

/** The one hand that claims a human typed the words. ⛔ `agent` claims nothing about a person. */
export const HUMAN_HAND: Hand = "person";

/**
 * May this principal submit words that claim a PERSON's hand wrote them?
 *
 * ⛔ THE SAME BOUNDARY AS `mayRecord`, ASKED ABOUT AUTHORSHIP INSTEAD OF AGREEMENT — and
 * deliberately not a second one. `wroteBy` computes `hand` from the `via` `mayRecord` already
 * guards, with its own comment saying why: *"a `--hand person` flag would have been a second gate,
 * enforced nowhere, reachable by anything that can spell."* That held everywhere a COMMAND writes
 * authorship, and nowhere a caller hands over a whole document: the `document` intent writes raw
 * bytes, so an agent token could simply TYPE `hand: person` and its inference became
 * indistinguishable from a person's draft. Which is the entire distinction the field exists for — a
 * grooming agent raises an agent's claim as a question in the ticket, and only stamps a person's.
 *
 * ⛔ SO THE REFUSAL IS THE SAME SHAPE, FOR THE SAME REASON: a browser press the instance watched is
 * a person; a token is not, whatever its bytes claim, and no scope changes that. `mintsHumanConsent`
 * is the handle on that absence for agreement; this function is the one for authorship.
 *
 * ⛔ AND IT IS STILL NOT CONSENT IN EITHER DIRECTION. Letting a browser write `hand: person` says a
 * human typed the sentence. Nothing here stamps it — `stampFor` reads none of this.
 */
export function mayClaimHand(p: Principal, hand: Hand | null): Refusal | null {
  /** Nothing claimed, or `agent` claimed: an inference a reviewer can disagree with. No gate. */
  if (hand !== HUMAN_HAND) return null;
  if (watchedAPerson(p.kind)) return null;
  const door = doorOf(p);
  return {
    ok: false,
    why: `${door.it} cannot write \`hand: person\` — that says a human typed this sentence, and ${door.nobody}`,
    detail: [
      ...(door.because ? [door.because] : []),
      door.handAbsence,
      ...door.hand,
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
 * ⛔ WHAT SAYS SOFTWARE IS HOLDING THIS SHELL.
 *
 * A DENYLIST, AND THEREFORE INCOMPLETE BY CONSTRUCTION — which is why it is not the only arm of
 * the test. A harness nobody here has heard of sets no variable in this list, so if it also hands
 * the process a terminal it reads as a person. The variables catch the harnesses we know; whether
 * anything is attached at all catches the ones we do not.
 *
 * ⛔ AND IT IS ONE-WAY. Nothing in this file reads an environment variable that says *a person IS
 * here* — that would be the switch an agent sets, and it is deliberately not in the vocabulary.
 */
export const DRIVEN_BY: readonly string[] = [
  /** Claude Code: `CLAUDECODE=1`, with the rest set alongside it in every Bash tool call. */
  "CLAUDECODE",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_SESSION_ID",
  /** Set by this harness, and the most honest name in the list. */
  "AI_AGENT",
  /** Cursor's agent, and the trace id it exports into a task shell. */
  "CURSOR_AGENT",
  "CURSOR_TRACE_ID",
  /** Other hosted agents that run commands for a model. */
  "REPLIT_AGENT",
  "AIDER_CHAT",
  "OPENAI_CODEX",
  /**
   * ⛔ CI IS IN THE LIST ON PURPOSE. A build recording that a person agreed is the same forgery
   * wearing a different hat, and CI is where "it passed, so somebody must have read it" comes from.
   */
  "CI",
  "GITHUB_ACTIONS",
] as const;

/** The variable that gave it away, or nothing. ⛔ Named, so the refusal can say which. */
export const whatIsDriving = (env: NodeJS.ProcessEnv = process.env): string | undefined =>
  DRIVEN_BY.find((name) => {
    const v = env[name];
    return v !== undefined && v !== "" && v !== "0" && v.toLowerCase() !== "false";
  });

/** Whether anything at all is attached to this process. ⛔ See `principalAtTheShell`. */
export interface Attached {
  stdin?: boolean;
  stdout?: boolean;
  stderr?: boolean;
}

const attachedNow = (): Attached => ({
  stdin: Boolean(process.stdin?.isTTY),
  stdout: Boolean(process.stdout?.isTTY),
  stderr: Boolean(process.stderr?.isTTY),
});

/**
 * Who is holding this shell — the sibling of `principalOf`, which answers the same question about a
 * request. ⛔ NOT A SECOND BOUNDARY: it produces a principal, and `mayRecord` is still the one
 * decision. The CLI's defect was never that it decided wrongly; it was that it never asked.
 *
 * ⛔ ANY STREAM, NOT STDIN ALONE — because the person is the one this must not break.
 *
 * `stdin.isTTY` is the obvious test and it refuses a person piping input, which is a thing people
 * do (`echo … | productos …`), and a person redirecting output, which is a thing people do more. A
 * terminal on ANY of the three streams means somebody is at one end of this process; all three
 * detached means nobody is at either. tmux and screen pass this — their panes are real terminals.
 *
 * ⛔ AND THE ENVIRONMENT WINS OVER THE TERMINAL. A harness that allocates a pty would otherwise
 * read as a person, so a known driver refuses even with three terminals attached. The cost is
 * named and small: a shell a person opens with an agent's variables still exported is refused, and
 * the refusal says exactly that so they can see why.
 */
export function principalAtTheShell(env: NodeJS.ProcessEnv = process.env, attached: Attached = attachedNow()): Principal {
  const driver = whatIsDriving(env);
  const anywhere = Boolean(attached.stdin || attached.stdout || attached.stderr);
  const scopes: readonly TokenScope[] = ["read", "author"];
  if (driver)
    return {
      kind: "driven",
      actor: `whatever ${driver} names`,
      scopes,
      because: `${driver} is set in this environment, which says software is driving this shell`,
    };
  if (!anywhere)
    return {
      kind: "driven",
      actor: "an unattended shell",
      scopes,
      because: "no terminal is attached to this process — stdin, stdout and stderr are all redirected, so there is nobody to have pressed anything",
    };
  return { kind: "terminal", actor: localAccount(), session: "this terminal", scopes };
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
