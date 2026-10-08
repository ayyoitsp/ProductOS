/**
 * ⛔ A BUILT STYLESHEET CAN BE OLDER THAN THE CODE IT WAS COMPILED FROM.
 *
 * A utility-first stylesheet holds exactly the classes that existed at build time. The bilrost
 * build was from 25 July and its components had two further months of classes in them, so `-left-5`
 * had no rule at all: a positioned ribbon fell back to `left: auto` and painted straight down the
 * middle of the deal workspace.
 *
 * Every digest matched. The files had not changed — the build had simply stopped keeping up with
 * them — so nothing in the corpus, the snapshot or the check had anything to say, and the drawing
 * looked wrong for no stated reason. That is the failure this ends: not fixing the stylesheet,
 * which ProductOS cannot do, but stopping a stale one from being invisible.
 */
import test from "node:test";
import { temp } from "./support/temp.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { checkCorpus } from "../dist/v2/check.js";

/**
 * A real corpus beside an application, with a stylesheet of a given day.
 *
 * ⛔ THE SEED, NOT A HAND-ROLLED STUB. The style findings sit below the parse gate — deliberately,
 * so a corpus that cannot be read is reported as that and not as nine downstream symptoms — and a
 * stub that does not parse produces no style finding at all. Written that way first, and the test
 * failed for a reason that had nothing to do with what it was testing.
 */
function corpus({ sources, codeAt }) {
  const repo = temp("productos-stale-");
  const at = path.join(repo, "v2");
  fs.cpSync("v2-seed", at, { recursive: true });
  /** ⛔ Nested under `style:` — that is the shape the loader reads, and a flat one loads as nothing. */
  fs.writeFileSync(
    path.join(at, "style.yaml"),
    YAML.stringify({ style: { theme: "x", css: ".a{color:red}", sources } })
  );
  const app = path.join(repo, "frontend", "app");
  fs.mkdirSync(app, { recursive: true });
  const page = path.join(app, "page.tsx");
  fs.writeFileSync(page, "export default function P(){ return null }");
  const t = new Date(codeAt).getTime() / 1000;
  fs.utimesSync(page, t, t);
  return { repo, at };
}

const behind = (at) => checkCorpus(at).findings.find((f) => f.kind === "style-behind-the-code");
const BUILT = (built_at) => [{ path: "frontend/.next/static/chunks/x.css", sha: "bbbb", bytes: 10, built_at }];

test("a stylesheet built before the code it styles is reported", () => {
  const { repo, at } = corpus({ sources: BUILT("2026-07-25"), codeAt: "2026-10-02T12:00:00Z" });
  const f = behind(at);
  assert.ok(f, "a stylesheet two months behind the components said nothing at all");
  assert.match(f.what, /2026-07-25/, "the finding does not say when it was built");
  assert.match(f.what, /2026-10-02/, "the finding does not say how far the code has moved");
  fs.rmSync(repo, { recursive: true, force: true });
});

test("a current build is not reported", () => {
  /** ⛔ Or the note is noise, and a noisy check is one people learn to scroll past. */
  const { repo, at } = corpus({ sources: BUILT("2026-10-03"), codeAt: "2026-10-02T12:00:00Z" });
  assert.equal(behind(at), undefined, "a build newer than the code was called stale");
  fs.rmSync(repo, { recursive: true, force: true });
});

test("a hand-written stylesheet is never behind, because it IS the source", () => {
  /**
   * ⛔ ONLY A BUILD OUTPUT IS JUDGED THIS WAY. A stylesheet somebody maintains by hand cannot be
   * "older than the code it was compiled from" — nothing compiled it — and reporting one would send
   * an author to rebuild something that has no build.
   */
  const { repo, at } = corpus({
    sources: [{ path: "styles/app.css", sha: "aaaa", bytes: 10, built_at: "2020-01-01" }],
    codeAt: "2026-10-02T12:00:00Z",
  });
  assert.equal(behind(at), undefined, "a hand-written stylesheet was reported as a stale build");
  fs.rmSync(repo, { recursive: true, force: true });
});
