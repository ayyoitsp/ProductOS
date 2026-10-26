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
/**
 * Open a page in the real browser.
 *
 * Pass HTML and it is written to a temp file and loaded over `file://`. Pass `{ url }` instead —
 * with `html` as `null` — and the browser navigates there, which is the only way to test anything
 * that needs an ORIGIN: an `EventSource` on a relative path, a fetch, a cookie. A `file://` page
 * cannot resolve `/api/v2/live` at all, so the behaviour under test never occurs and the test
 * passes over nothing.
 */
/**
 * ⛔ A WIDTH, BECAUSE SOME LAYOUTS ONLY EXIST AT ONE.
 *
 * The side menu lives inside `@media (min-width: 62rem)` — a 19rem column cannot be afforded in a
 * narrow window, and the control that moves the menu there is itself hidden below that width. So a
 * test that drove the side menu in the default headless window measured the TOP menu and reported
 * the side rules as not applying, which reads as the code being broken.
 *
 * Default unchanged, so every existing test measures exactly what it measured before.
 */
/**
 * Every browser this process started and has not reaped yet.
 *
 * ⛔ THE SUITE LEFT 378 CHROME PROCESSES HOLDING 19.9 GB, AND IT TOOK THE MACHINE WITH IT.
 *
 * Twice in one day the Docker daemon stopped answering — `docker ps` hanging past 120s — and the
 * instance Peter reviews on went down with it. Load 528, swap 35.3 GB of 36.9 used. The cause was
 * neither Docker nor the deploy: it was this file, across repeated suite runs.
 *
 * ⛔ AND `close()` IS NOT THE LEAK — measured: 10 processes while open, 0 after. The leak is every
 * path that never REACHES close():
 *
 *   · `openPage` throwing after the spawn — no debugging endpoint, or the WebSocket refusing. The
 *     caller never receives a handle, so nobody can close what was already started.
 *   · a run interrupted or killed part-way, which is what a session red-checking a test does over
 *     and over.
 *
 * `temp()` already settled this shape for DIRECTORIES — "a trailing rmSync sits at the end of the
 * test, so it is not reached when an assertion fails". The same argument holds for a process, and
 * nothing was applying it.
 *
 * So: one registry, one exit hook, and a kill that takes the CHILDREN with it.
 */
const alive = new Set();
let reaping = false;
const reapAll = () => {
  if (reaping) return;
  reaping = true;
  for (const kill of [...alive]) {
    try {
      kill();
    } catch {
      /* a browser already gone is the outcome we wanted */
    }
  }
  alive.clear();
};
/**
 * ⛔ ON SIGNALS TOO, NOT ONLY `exit`. Ctrl-C or a `kill` on the test runner never fires `exit`, and
 * an interrupted run is the one that leaks hardest — which is how this reached 378.
 */
process.once("exit", reapAll);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(sig, () => {
    reapAll();
    process.exit(sig === "SIGINT" ? 130 : 143);
  });
}

export async function openPage(html, { exe = findBrowser(), url, width, height } = {}) {
  if (!exe) throw new Error("no browser");
  /**
   * ⛔ `temp()` RATHER THAN `mkdtempSync`, EVEN THOUGH THE TEARDOWN BELOW ALREADY REMOVES THIS. The
   * teardown is reached when a test finishes; the exit hook is reached when it throws, which is the
   * run that litters hardest. Both, because they cover different exits.
   */
  const dir = temp("productos-dom-");
  const file = path.join(dir, "page.html");
  if (html != null) fs.writeFileSync(file, html);
  const target = url ?? `file://${file}`;

  const proc = spawn(
    exe,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--remote-debugging-port=0",
      ...(width ? [`--window-size=${width},${height ?? 900}`] : []),
      `--user-data-dir=${path.join(dir, "profile")}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  /**
   * Kill the browser.
   *
   * ⛔ THE PARENT, AND NOT `detached` + A GROUP KILL — MEASURED, HAVING FIRST WRITTEN THE OTHER ONE.
   *
   * Chrome forks a renderer, a GPU process, a network service and a zygote, so killing the parent
   * and orphaning the rest is a plausible story for where 378 processes came from. It is not what
   * happens: with the group kill removed and only `proc.kill` left, every test in
   * `v2-a-browser-is-never-left-running` still passes, because Chrome's children exit when the
   * browser process does. An unfalsifiable mechanism is what this project refuses by name
   * elsewhere, so it is gone.
   *
   * ⛔ AND `detached` WOULD HAVE MADE THINGS WORSE. Undetached, the browser sits in the runner's own
   * process group and dies with a group signal — a free safety net. Detaching removes that and
   * makes survival depend entirely on the hook above.
   */
  const killTree = () => {
    try {
      proc.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  };
  alive.add(killTree);

  /**
   * ⛔ EVERYTHING PAST THE SPAWN RUNS INSIDE THIS, because each step can throw while the caller
   * still has no handle. "browser did not report a debugging endpoint" used to leave a whole Chrome
   * running with nobody holding a reference to it.
   */
  try {

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

  const { targetId } = await cdp.send("Target.createTarget", { url: target });
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
    /**
     * Set the viewport to an exact size, including sizes a window cannot be.
     *
     * ⛔ `--window-size=390,844` DOES NOT GIVE YOU A 390px PAGE. Chrome floors a window at about
     * 500px wide, so a phone-width measurement taken that way reports `innerWidth === 500` and
     * every assertion about the phone layout is made about a layout no phone ever sees. Asked for
     * 390, measured 500, and the overflow being hunted begins at 430.
     *
     * Device metrics are not a window, so they go where the window cannot. ⛔ And the width is
     * READ BACK by the caller rather than assumed: a measurement carries its conditions, and the
     * condition here is the one that was silently wrong.
     */
    async resize(width, height = 844) {
      await cdp.send(
        "Emulation.setDeviceMetricsOverride",
        { width, height, deviceScaleFactor: 1, mobile: false },
        sessionId
      );
      /** ⛔ Layout is asynchronous after an override; without this the first read is the old size. */
      await until(() => evaluate(`window.innerWidth === ${width}`), `the viewport to become ${width}px`);
    },
    /**
     * Wait for something the page does asynchronously, with the failure naming what never happened.
     *
     * ⛔ THE BUDGET IS THE CALLER'S, because 15s is a claim about the MACHINE and not about the page.
     * A whole-suite run has many browsers alive at once, and a wait that is generous when a file
     * runs alone times out in the pack — a flake that reads as a product defect and sends somebody
     * looking for one. A caller waiting on a first arrival knows it is paying for browser startup
     * too and can say so.
     */
    waitFor: (expression, what, ms) => until(() => evaluate(expression), what, ms),
    async close() {
      try {
        ws.close();
      } catch {
        /* already gone */
      }
      alive.delete(killTree);
      killTree();
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
  } catch (e) {
    /**
     * ⛔ REAPED BEFORE THE THROW, so a failure to START a browser does not leave one running. This
     * is the path that produced most of the 378: the caller gets an exception and never a handle,
     * so without this nobody on earth can close what was spawned.
     */
    alive.delete(killTree);
    killTree();
    throw e;
  }
}
