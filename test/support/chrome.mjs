/**
 * ⛔ A REAL BROWSER, BECAUSE THE BUGS THAT HURT MOST ONLY EXIST IN ONE.
 *
 * Three defects in one session lived entirely inside a browser and none of them could be seen from
 * Node: a stylesheet read with `innerHTML` came back with every child combinator escaped and 209
 * rules silently dropped; `@property` initial values are held by the document and not by a shadow
 * root, so every bordered box drew nothing; a page written to own a viewport wasted two thirds of a
 * preview pane. Each was found by hand, in Chrome, by counting. Each could have been found by a
 * test, and the only reason it was not is that nothing here ran a DOM.
 *
 * ⛔ NO NEW DEPENDENCY, AND NO DOWNLOADED BROWSER. This drives the Chrome already on the machine
 * over the DevTools protocol, using the WebSocket that Node has had since 22. A test harness that
 * costs a 150 MB download and a postinstall step is one somebody removes.
 *
 * ⛔ AND IT IS NOT A DOM EMULATOR. jsdom and friends do not resolve a cascade, do not implement
 * adoptedStyleSheets, and do not register `@property` — they would have passed on all three of the
 * bugs above, which is worse than having no test, because it would have said the opposite.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./temp.mjs";

/**
 * Where a browser might be, in order of preference.
 *
 * `PRODUCTOS_TEST_BROWSER` wins, so a machine that keeps Chrome somewhere unusual — or wants to run
 * these against Chromium or Edge — says so once instead of patching this list.
 */
const CANDIDATES = [
  process.env.PRODUCTOS_TEST_BROWSER,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
].filter(Boolean);

export function findBrowser() {
  for (const c of CANDIDATES) {
    try {
      fs.accessSync(c, fs.constants.X_OK);
      return c;
    } catch {
      /* not here */
    }
  }
  return undefined;
}

/**
 * Whether these tests can run, and what to do when they cannot.
 *
 * ⛔ A SKIP THAT NOBODY SEES IS THE FAILURE THIS FILE EXISTS TO END. Absence of a browser skips by
 * default, because a contributor without Chrome should not be blocked — but `PRODUCTOS_REQUIRE_BROWSER=1`
 * turns it into a failure, so wherever it matters that these actually ran, it is an error and not a
 * quiet pass.
 */
export function browserOrSkip() {
  const exe = findBrowser();
  if (exe) return { exe, skip: false };
  if (process.env.PRODUCTOS_REQUIRE_BROWSER === "1")
    throw new Error(
      "no browser found and PRODUCTOS_REQUIRE_BROWSER=1 — set PRODUCTOS_TEST_BROWSER to a Chrome, Chromium or Edge binary"
    );
  return { exe: undefined, skip: "no Chrome, Chromium or Edge on this machine — set PRODUCTOS_TEST_BROWSER to run these" };
}

/** One request/response pair over the DevTools protocol. */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.next = 1;
    this.waiting = new Map();
    ws.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      const pending = this.waiting.get(msg.id);
      if (!pending) return;
      this.waiting.delete(msg.id);
      if (msg.error) pending.reject(new Error(msg.error.message));
      else pending.resolve(msg.result);
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      setTimeout(() => {
        if (this.waiting.delete(id)) reject(new Error(`${method} timed out`));
      }, 20000);
    });
  }
}

const until = async (fn, what, ms = 15000) => {
  const stop = Date.now() + ms;
  for (;;) {
    const got = await fn();
    if (got) return got;
    if (Date.now() > stop) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
};

/**
 * Open `html` in a real browser and return something that can ask it questions.
 *
 * Served from a file rather than a `data:` URL, because a data: document is opaque-origin and the
 * things being tested here — constructable stylesheets, shadow roots — behave differently there.
 */
export async function openPage(html, { exe = findBrowser() } = {}) {
  if (!exe) throw new Error("no browser");
  /**
   * ⛔ `temp()` RATHER THAN `mkdtempSync`, EVEN THOUGH THE TEARDOWN BELOW ALREADY REMOVES THIS. The
   * teardown is reached when a test finishes; the exit hook is reached when it throws, which is the
   * run that litters hardest. Both, because they cover different exits.
   */
  const dir = temp("productos-dom-");
  const file = path.join(dir, "page.html");
  fs.writeFileSync(file, html);

  const proc = spawn(
    exe,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--remote-debugging-port=0",
      `--user-data-dir=${path.join(dir, "profile")}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  /** Chrome prints the endpoint on stderr and only once it is listening. */
  let buf = "";
  const endpoint = await new Promise((resolve, reject) => {
    const give = setTimeout(() => reject(new Error("browser did not report a debugging endpoint")), 20000);
    proc.stderr.on("data", (d) => {
      buf += d.toString();
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
      if (m) {
        clearTimeout(give);
        resolve(m[1]);
      }
    });
    proc.on("exit", (code) => {
      clearTimeout(give);
      reject(new Error(`browser exited (${code}) — ${buf.slice(0, 300)}`));
    });
  });

  const ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("could not connect to the browser")), { once: true });
  });
  const cdp = new Cdp(ws);

  const { targetId } = await cdp.send("Target.createTarget", { url: `file://${file}` });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Runtime.enable", {}, sessionId);

  const evaluate = async (expression) => {
    const r = await cdp.send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sessionId
    );
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "page threw");
    return r.result.value;
  };

  /** The hydration runs on load; nothing can be asked before the document is complete. */
  await until(() => evaluate("document.readyState === 'complete'"), "the page to finish loading");

  return {
    evaluate,
    /** Wait for something the page does asynchronously, with the failure naming what never happened. */
    waitFor: (expression, what) => until(() => evaluate(expression), what),
    async close() {
      try {
        ws.close();
      } catch {
        /* already gone */
      }
      proc.kill("SIGKILL");
      await new Promise((resolve) => {
        if (proc.exitCode !== null || proc.signalCode) return resolve();
        proc.once("exit", resolve);
        setTimeout(resolve, 3000);
      });
      /**
       * ⛔ RETRIED, BECAUSE A KILLED CHROME IS STILL WRITING ITS PROFILE. The first version removed
       * the directory the instant after SIGKILL and failed the test with ENOTEMPTY on
       * `profile/Default` — a teardown failure reported as if the assertion had failed.
       */
      try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      } catch {
        /* a temp directory that outlives the run is not worth failing a test over */
      }
    },
  };
}
