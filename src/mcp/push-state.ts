/**
 * ⛔ WHETHER A SESSION WILL EVER BE TOLD, AS SOMETHING THE SESSION CAN ASK.
 *
 * Peter, after a request sat in a queue and nothing happened: "but why wasn't our message listener
 * responding? I don't get it"
 *
 * It had not failed. It had never started: the push resolves its corpus from where the MCP server
 * was launched, the session was working a corpus somewhere else entirely, and the resolution failure
 * returned quietly. From inside the session the two states are indistinguishable — "nothing has
 * happened yet" and "nothing that happens will ever reach you" both look like an empty inbox.
 *
 * ⛔ That is the §7 failure this project calls the worst of them: a surface that has stopped
 * following looks exactly like one where nothing has occurred, and somebody acts on it. It is on the
 * page for the browser. This is the same thing for a session.
 *
 * A module of its own so the tools can read it without importing the server that sets it, which
 * imports the tools.
 */
export interface PushState {
  /** The corpus a push would come from, if one is running. */
  watching?: string;
  /** Why nothing is being watched, when nothing is. ⛔ Never empty when `watching` is absent. */
  why?: string;
}

let state: PushState = { why: "the server has not started watching anything yet" };

export const setPush = (s: PushState): void => {
  state = s;
};

export const pushState = (): PushState => state;

/**
 * What to tell a session reading its inbox.
 *
 * ⛔ IT NAMES THE CORPUS, not just "on" or "off". The failure that prompted this was a push that was
 * running perfectly — over a different corpus from the one being worked — so a boolean would have
 * answered "yes, you will be told" and been wrong.
 */
export function howYouWillBeTold(dir: string): string {
  const s = pushState();
  if (!s.watching) return `⛔ nothing will wake you — ${s.why ?? "no reason recorded"}. Poll this tool; it is the backstop and it always works.`;
  if (s.watching !== dir)
    return (
      `⛔ a push is running, but over ${s.watching} — NOT the corpus you are reading. Nothing that happens here will reach you. ` +
      `Poll this tool, or start the server where this corpus lives (PRODUCTOS_V2_DIR=${dir}).`
    );
  return `you will be woken when a request arrives here; polling stays as the backstop`;
}
