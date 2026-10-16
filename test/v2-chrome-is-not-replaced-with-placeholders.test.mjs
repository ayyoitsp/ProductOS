/**
 * ⛔ ONE RUN REPLACED TWO GOOD SHELLS WITH PLACEHOLDERS. 17,891 BYTES TO 2,192.
 *
 * `v2 prototypes` redraws EVERY prototype's chrome, not the one being worked on. Run against a
 * corpus with no `components_dir`, it cannot inline sub-components — so it wrote 362 bytes of
 * placeholder over two 7,882-byte shells that had the application's real sidebar in them.
 *
 * ⛔ AND THE GUARD ALREADY EXISTED NEXT DOOR. `v2 draw` refuses exactly this, in as many words:
 * *"this would replace an 11,759-byte drawing with 4,145 bytes and no component inlined — that is
 * what a missing `components_dir` looks like"*. An author hit that refusal the same day and
 * reported it working; this command had nothing.
 *
 * ⛔ "THE CHROME IS OUTPUT, NOT A DOCUMENT" IS TRUE AND WAS THE TRAP. Output is only safely
 * regenerable while the conditions that produced it still hold. The command printed that sentence
 * in its own closing line and then destroyed work on the strength of it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");

/** A corpus whose prototype already has a big chrome, and no components dir to rebuild it from. */
function corpusWithChrome(bytes = 8000) {
  const dir = path.join(temp("chrome-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  const big = "<div class=" + JSON.stringify("sidebar") + ">" + "x".repeat(bytes) + "</div>";
  fs.writeFileSync(
    path.join(dir, "prototypes.yaml"),
    [
      "prototypes:",
      "  - id: a-way-in",
      "    title: A way in",
      "    starts_at: money#balance",
      "    shell_from: app/(app)/deals/page.tsx",
      "    shell_html: " + JSON.stringify(big),
      "",
    ].join("\n")
  );
  /**
   * A route with a layout wrapping it — ⛔ INSIDE A ROUTE GROUP, not at the `app` root.
   *
   * `layoutsAround` skips a layout whose directory IS `app` and breaks there, so a fixture whose
   * only layout is `app/layout.tsx` gets no chrome at all and the command returns before the guard.
   * That cost three attempts: "nothing wraps that route" looks like a broken fixture and is the
   * function telling you the truth.
   */
  const group = path.join(dir, "..", "app", "(app)");
  fs.mkdirSync(path.join(group, "deals"), { recursive: true });
  fs.writeFileSync(
    path.join(group, "layout.tsx"),
    [
      "export default function Layout({ children }: { children: React.ReactNode }) {",
      '  return (<div className="flex h-screen bg-gray-50">',
      '    <div className="w-64 bg-white border-r border-gray-200">',
      '      <a href="/deals">Deals</a><a href="/incoming">Incoming</a>',
      "    </div>",
      "    <main>{children}</main>",
      "  </div>);",
      "}",
      "",
    ].join("\n")
  );
  fs.writeFileSync(path.join(group, "deals", "page.tsx"), "export default function P(){return <div/>}\n");
  return dir;
}

/**
 * The first prototype's chrome size.
 *
 * ⛔ Measured off the raw file rather than the loader, because the claim is about what was WRITTEN
 * — a guard that preserved the value in memory and wrote placeholders would pass a loader check.
 */
const shellOf = (dir) => {
  const raw = fs.readFileSync(path.join(dir, "prototypes.yaml"), "utf-8");
  /**
   * ⛔ COUNT THE SENTINEL, NOT THE LINE. The writer reformats a long `shell_html` into a folded
   * block, so reading the rest of the `shell_html:` line returned the block indicator — four
   * characters — and the test reported the chrome destroyed when it was intact. Counting the
   * marker is proof about the CONTENT and survives any reformatting.
   */
  return (raw.match(/x/g) ?? []).length;
};

const run = (dir, extra = []) => {
  try {
    return execFileSync("node", [CLI, "v2", "prototypes", "--into", dir, ...extra], {
      encoding: "utf-8",
      cwd: path.join(dir, ".."),
    });
  } catch (e) {
    return String(e.stdout ?? "") + String(e.stderr ?? "");
  }
};

test("a chrome with real markup in it is not replaced by placeholders", () => {
  const dir = corpusWithChrome();
  const before = shellOf(dir);
  assert.ok(before > 5000, `the fixture did not start with a big chrome (${before})`);

  const out = run(dir);

  /** ⛔ The non-zero first: it says what it refused and why. */
  assert.match(out, /would replace a \d+-byte chrome/, "it did not refuse");
  assert.match(out, /components_dir/, "it does not say what the cause is");
  assert.equal(shellOf(dir), before, "⛔ the chrome was overwritten anyway");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a prototype with no chrome yet is still given one", () => {
  /**
   * ⛔ WITHOUT THIS THE GUARD IS JUST A BLOCK. The case that matters is a NEW prototype beside
   * established ones: refusing everything would mean a new way through the product could never get
   * its shell while any older one existed.
   */
  const dir = corpusWithChrome();
  const raw = fs.readFileSync(path.join(dir, "prototypes.yaml"), "utf-8");
  fs.writeFileSync(
    path.join(dir, "prototypes.yaml"),
    raw + ["  - id: a-second-way-in", "    title: A second way in", "    starts_at: money#balance", "    shell_from: app/(app)/deals/page.tsx", ""].join("\n")
  );
  const out = run(dir);
  assert.match(out, /a-second-way-in — chrome from/, "a prototype with nothing to lose was refused too");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--anyway is the way through, so a chrome that really did shrink can be written", () => {
  const dir = corpusWithChrome();
  const before = shellOf(dir);
  run(dir, ["--anyway"]);
  assert.ok(shellOf(dir) < before, "--anyway did not let the smaller chrome through");
  fs.rmSync(dir, { recursive: true, force: true });
});
