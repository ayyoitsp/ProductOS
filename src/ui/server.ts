import http from "node:http";
import fs from "node:fs";
import matter from "gray-matter";
import { readFrameworkGaps } from "../core/framework-gaps.js";
import path from "node:path";
import os from "node:os";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../core/paths.js";
import { readConfig, resolveTruthVerificationByok } from "../core/config.js";
import { groupingAdvice } from "../core/grouping.js";
import { buildWorklist, groupWorklist } from "../core/worklist.js";
import {
  listAreas,
  findGroup,
  AreaDocument,
  listFeatures,
  readFeatureById,
  isUndefinedBehavior,
  topReadmePath,
  listCapabilities,
  listAllContainers,
  listCapabilitySystems,
  listProducts,
} from "../core/product.js";
import {
  emptyTrackingFor,
  readTracking,
  recordTransition,
  writeTracking,
} from "../core/tracking.js";
import {
  ensureFeedbackDir,
  FeedbackEntry,
  listFeedback,
  newFeedbackId,
  readFeedbackById,
  writeFeedback,
  FeedbackFrontmatter,
} from "../core/feedback.js";
import { featureReadiness, type FeatureReadiness } from "../core/readiness.js";
import type { ContextSectionState } from "../core/context.js";
import {
  allContextSections,
  listSystemContext,
  contextSectionState,
  listAreaContext,
  listContext,
  readContext,
} from "../core/context.js";
import { processFeedback } from "../byok/processor.js";
import { enqueueTask, listTasks, TaskKind, TaskPriority, TaskState } from "../core/queue.js";
import {
  recordTestResults,
  RecordTestResultsInput,
} from "../core/test-results.js";
import {
  buildSurfaceIndex,
  renderArea,
  renderContextIndex,
  renderFeature,
  renderFeedbackQueue,
  renderHome,
  renderStates,
  renderQueue,
  renderShell,
  renderSidebar,
  renderCapabilitySystem,
  renderProduct,
} from "./renderer.js";

export interface StartUiServerOptions {
  /** Explicit port override. Precedence: opts.port > $PORT > config.ui_port > 7878. */
  port?: number;
}

export async function startUiServer(opts: StartUiServerOptions = {}): Promise<void> {
  const paths = resolvePathsOrThrow();
  const config = readConfig(paths);
  const envPort = process.env.PORT ? Number(process.env.PORT) : NaN;
  const port = opts.port
    ?? (Number.isInteger(envPort) && envPort > 0 && envPort < 65536 ? envPort : undefined)
    ?? config.ui_port;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      const p = url.pathname;

      // ---- POST: verify a behavior ----
      if (req.method === "POST" && p === "/api/verify") {
        const body = await readJson(req);
        const featureId = String(body.feature ?? "");
        const behaviorId = String(body.behavior ?? "");
        if (!featureId || !behaviorId) return json(res, { error: "feature and behavior required" }, 400);
        const feat = readFeatureById(paths, featureId);
        if (!feat) return json(res, { error: "feature not found" }, 404);
        const who = os.userInfo().username || "vet-ui";
        // 1. Stamp the behavior in the Product Truth markdown so the
        //    renderer can show ✓ on the summary line.
        const beh = feat.frontmatter.behaviors.find((b) => b.id === behaviorId);
        if (beh) {
          beh.verified = true;
          beh.verified_at = new Date().toISOString();
          beh.verified_by = who;
          const { writeFeature } = await import("../core/product.js");
          writeFeature(paths, feat);
        }
        // 2. Mirror to tracking sidecar for backward compat.
        const t = readTracking(paths, featureId) ?? emptyTrackingFor(featureId);
        recordTransition(t, behaviorId, "verified", who, {
          status: "verified",
          setVerified: true,
        });
        writeTracking(paths, t);
        return json(res, { ok: true });
      }

      // ---- POST: decide an open question ----
      //
      // ⛔ THE VERB A PRODUCT MANAGER COULD NOT REACH. `productos decide` existed and the
      // page printed it as prose, which two reviewers landed on independently:
      //
      //   "The buttons available to me on that question are Accept / Reword / Not true of
      //    the product / We should not promise this / Leave a note / Ask an agent. None of
      //    them is 'answer it.' Accept would stamp a human approval on a container the
      //    page itself says holds no claim. Reword would let me overwrite the question
      //    with a claim — silently converting an open question into a decided behavior
      //    with no record that it was ever open and no record that I closed it. And the
      //    one affordance that is apparently correct is a command-line invocation printed
      //    as prose on the page, which a PM reading a website cannot reach."
      //
      //   "I am reading a website. I have no such program, the site does not say where to
      //    get one, and these are the only instructions on the page for the action the
      //    page most wants taken."
      //
      // One of them called it the thing that would stop them using the tool. The rules
      // are the CLI's, unchanged: the question is kept, who and why are required, and a
      // behavior that already carries a claim is refused.
      if (req.method === "POST" && p === "/api/decide") {
        const body = await readJson(req);
        const featureId = String(body.feature ?? "");
        const behaviorId = String(body.behavior ?? "");
        const claim = String(body.claim ?? "").trim();
        const because = String(body.because ?? "").trim();
        if (!featureId || !behaviorId) return json(res, { error: "feature and behavior required" }, 400);
        if (claim.length < 10) return json(res, { error: "A claim needs to be a real sentence." }, 400);
        if (because.length < 10) {
          return json(
            res,
            { error: "Say why. The reasoning is what stops this being reopened from scratch next session." },
            400
          );
        }
        const feat = readFeatureById(paths, featureId);
        if (!feat) return json(res, { error: "container not found" }, 404);
        const beh = feat.frontmatter.behaviors.find((b) => b.id === behaviorId);
        if (!beh) return json(res, { error: "behavior not found" }, 404);
        if (!isUndefinedBehavior(beh)) {
          return json(
            res,
            {
              error: beh.answers
                ? `Already decided by ${beh.decided_by ?? "someone"}. Reword the claim instead of re-deciding it.`
                : "This already carries a claim. Editing a settled claim is an edit, not a decision.",
            },
            400
          );
        }
        beh.answers = beh.question;
        beh.claim = claim;
        beh.because = because;
        beh.decided_by = String(body.by ?? "") || os.userInfo().username || "vet-ui";
        beh.decided_at = new Date().toISOString().slice(0, 10);
        delete beh.question;
        delete beh.asked_of;
        delete beh.asked_at;
        // ⛔ `blocks` belongs to a QUESTION. A decided behavior that still claims to
        // block three others is telling a planner the work is stalled on something that
        // was settled — and the whole point of `blocks` is being trustworthy about what
        // is stopping the build.
        delete beh.blocks;
        const { writeFeature } = await import("../core/product.js");
        writeFeature(paths, feat);
        // ⛔ Deliberately NOT accepted by this. Deciding what the product does and
        // confirming a written claim says what the team meant are two acts.
        return json(res, { ok: true, awaiting_review: true });
      }

      // ---- POST: reject a behavior (marks as deprecated in markdown) ----
      if (req.method === "POST" && p === "/api/reject") {
        const body = await readJson(req);
        const featureId = String(body.feature ?? "");
        const behaviorId = String(body.behavior ?? "");
        const reason = body.reason ? String(body.reason) : undefined;
        if (!featureId || !behaviorId) return json(res, { error: "feature and behavior required" }, 400);
        const feat = readFeatureById(paths, featureId);
        if (!feat) return json(res, { error: "feature not found" }, 404);
        const idx = feat.frontmatter.behaviors.findIndex((b) => b.id === behaviorId);
        if (idx < 0) return json(res, { error: "behavior not found" }, 404);

        feat.frontmatter.behaviors[idx]!.deprecated = true;
        if (reason) feat.frontmatter.behaviors[idx]!.deprecated_reason = reason;
        const { writeFeature } = await import("../core/product.js");
        writeFeature(paths, feat);

        const t = readTracking(paths, featureId) ?? emptyTrackingFor(featureId);
        recordTransition(t, behaviorId, "deprecated", os.userInfo().username || "vet-ui", {
          status: "deprecated",
          note: reason,
        });
        writeTracking(paths, t);

        // If the user supplied a reason, queue a task so a Claude drainer
        // can decide whether to soften the claim, fix the impl, or leave
        // deprecated. No reason → it was a deliberate drop, nothing to do.
        if (reason) {
          enqueueTask(paths, {
            kind: "address-feedback",
            target: { feature: featureId, behavior: behaviorId },
            created_by: os.userInfo().username || "vet-ui",
            body: `User rejected behavior \`${behaviorId}\` on \`${featureId}\`.\n\nReason given:\n${reason}\n\nThe behavior is now marked deprecated. Decide whether to: (a) rewrite the claim and undeprecate, (b) leave deprecated and add a replacement behavior, or (c) just confirm the rejection holds. Use productos_get_feature to see context, then act via the MCP edit tools.`,
          });
        }
        return json(res, { ok: true });
      }

      // ---- POST: edit a behavior's claim or notes inline ----
      if (req.method === "POST" && p === "/api/edit-behavior") {
        const body = await readJson(req);
        const featureId = String(body.feature ?? "");
        const behaviorId = String(body.behavior ?? "");
        if (!featureId || !behaviorId) return json(res, { error: "feature and behavior required" }, 400);
        const feat = readFeatureById(paths, featureId);
        if (!feat) return json(res, { error: "feature not found" }, 404);
        const beh = feat.frontmatter.behaviors.find((b) => b.id === behaviorId);
        if (!beh) return json(res, { error: "behavior not found" }, 404);
        if (typeof body.claim === "string" && body.claim.trim().length >= 10) beh.claim = body.claim.trim();
        if (typeof body.notes === "string") beh.notes = body.notes.trim() || undefined;
        const { writeFeature } = await import("../core/product.js");
        writeFeature(paths, feat);

        const t = readTracking(paths, featureId) ?? emptyTrackingFor(featureId);
        recordTransition(t, behaviorId, "edited", os.userInfo().username || "vet-ui", {
          note: "claim/notes edited via vet UI",
        });
        writeTracking(paths, t);
        return json(res, { ok: true });
      }

      // ---- POST: feedback (or contest, which is a feedback subtype) ----
      if (req.method === "POST" && p === "/api/feedback") {
        const body = await readJson(req);
        const target = {
          feature: body.feature ? String(body.feature) : undefined,
          behavior: body.behavior ? String(body.behavior) : undefined,
        };
        const action = String(body.action ?? "feedback");
        const text = String(body.body ?? "").trim();
        if (!text) return json(res, { error: "body required" }, 400);

        const id = newFeedbackId(target);
        const fm = FeedbackFrontmatter.parse({
          id,
          created_at: new Date().toISOString(),
          created_by: os.userInfo().username || "vet-ui",
          source: action === "contest" ? "vet-ui:contest" : "vet-ui",
          target,
          state: "open",
        });
        const entry: FeedbackEntry = { frontmatter: fm, body: text, filepath: "" };
        const fp = writeFeedback(paths, entry);

        // If the user explicitly contested, also flip tracking to status=contested.
        if (action === "contest" && target.feature && target.behavior) {
          const t = readTracking(paths, target.feature) ?? emptyTrackingFor(target.feature);
          recordTransition(t, target.behavior, "contested", os.userInfo().username || "vet-ui", {
            status: "contested",
            note: `Feedback ${id}: ${text.slice(0, 100)}`,
          });
          writeTracking(paths, t);

          // A contest is an active "this is wrong" signal — enqueue a task
          // so a drainer addresses it. (Plain feedback skips this; not every
          // comment needs AI action.)
          enqueueTask(paths, {
            kind: "address-feedback",
            target,
            feedback_id: id,
            created_by: os.userInfo().username || "vet-ui",
            body: `User contested behavior \`${target.behavior}\` on \`${target.feature}\`.\n\nContest text:\n${text}\n\nFeedback file: productos/feedback/${id}.md\n\nRead the feedback in context, decide whether to update the claim, add a test case, or push back via productos_mark_feedback_processed with a resolution note.`,
          });
        }

        // Truth-verification handler: queue (default) or byok (auto-process inline).
        // The queue entry is the authoritative artifact in both cases.
        if (config.operations.truth_verification.handler === "byok") {
          const byok = resolveTruthVerificationByok(config);
          const result = await processFeedback(entry, paths, byok);
          const saved = readFeedbackById(paths, id);
          if (saved && result.kind === "applied") {
            saved.frontmatter.state = "processed";
            saved.frontmatter.resolved_at = new Date().toISOString();
            saved.frontmatter.resolved_by = "byok";
            saved.body = `${saved.body.trim()}\n\n---\n**Auto-processed via BYOK (${byok.provider} ${byok.model}).** Edits applied: ${result.ops.join(", ")}\n\n${result.summary}`;
            writeFeedback(paths, saved);
            return json(res, { ok: true, id, byok: { kind: "applied", ops: result.ops, summary: result.summary } });
          }
          if (saved && result.kind === "needs_review") {
            saved.frontmatter.state = "claimed";
            saved.frontmatter.resolved_by = "byok";
            saved.body = `${saved.body.trim()}\n\n---\n**BYOK flagged for human review:** ${result.reason}`;
            writeFeedback(paths, saved);
            return json(res, { ok: true, id, byok: { kind: "needs_review", reason: result.reason } });
          }
          if (result.kind === "error") {
            return json(res, { ok: true, id, byok: { kind: "error", message: result.message } });
          }
        }

        return json(res, { ok: true, id, path: path.relative(paths.repoRoot, fp) });
      }

      // ---- POST: enqueue a work-queue task from the UX ("Ask AI" button) ----
      if (req.method === "POST" && p === "/api/queue/enqueue") {
        try {
          const body = await readJson(req);
          const kindRaw = body.kind ?? "freeform";
          const kind = TaskKind.parse(kindRaw);
          const text = String(body.body ?? "").trim();
          if (!text) return json(res, { error: "body required" }, 400);
          const priority = body.priority ? TaskPriority.parse(body.priority) : "normal";
          const t = enqueueTask(paths, {
            kind,
            body: text,
            priority,
            created_by: os.userInfo().username || "vet-ui",
            target: {
              feature: body.feature ? String(body.feature) : undefined,
              behavior: body.behavior ? String(body.behavior) : undefined,
            },
          });
          return json(res, { ok: true, id: t.frontmatter.id });
        } catch (e) {
          return json(res, { error: (e as Error).message }, 400);
        }
      }

      // ---- GET: queue contents (for the watcher subagent, debugging, or a future /queue page) ----
      if (req.method === "GET" && p === "/api/queue") {
        const stateParam = url.searchParams.get("state");
        const featureParam = url.searchParams.get("feature");
        const tasks = listTasks(paths, {
          state: stateParam ? TaskState.parse(stateParam) : undefined,
          feature: featureParam ?? undefined,
        });
        return json(res, {
          count: tasks.length,
          tasks: tasks.map((t) => ({ ...t.frontmatter, body: t.body })),
        });
      }

      // ---- POST: receive test results from CI ----
      if (req.method === "POST" && p === "/api/test-results") {
        try {
          const body = await readJson(req);
          const input = RecordTestResultsInput.parse({
            results: Array.isArray(body) ? body : body.results,
            default_source: Array.isArray(body) ? undefined : body.default_source,
          });
          const summary = recordTestResults(paths, input);
          return json(res, summary);
        } catch (e) {
          return json(res, { error: (e as Error).message }, 400);
        }
      }

      // ---- User stylesheet passthrough ----
      // If web.stylesheet is configured, serve the file at /_user-style.css
      // so the rendered shell can <link> to it and the UX mocks pick up
      // the user's actual design system.
      if (p === "/_user-style.css") {
        const cssRel = config.web?.stylesheet;
        if (!cssRel) {
          res.writeHead(404, { "content-type": "text/plain" });
          res.end("no web.stylesheet configured");
          return;
        }
        const cssAbs = path.resolve(paths.repoRoot, cssRel);
        // Prevent path traversal: ensure resolved path stays within repoRoot.
        const repoRootResolved = path.resolve(paths.repoRoot);
        if (!cssAbs.startsWith(repoRootResolved + path.sep)) {
          res.writeHead(403, { "content-type": "text/plain" });
          res.end("stylesheet path escapes repo root");
          return;
        }
        if (!fs.existsSync(cssAbs)) {
          res.writeHead(404, { "content-type": "text/plain" });
          res.end(`stylesheet not found at ${cssRel}`);
          return;
        }
        const cssBody = fs.readFileSync(cssAbs, "utf-8");
        res.writeHead(200, { "content-type": "text/css; charset=utf-8", "cache-control": "no-cache" });
        res.end(cssBody);
        return;
      }

      // ---- JSON API ----
      if (p === "/api/features") return json(res, listAllContainers(paths).map((f) => f.frontmatter));
      if (p === "/api/areas") return json(res, listAreas(paths).map((a) => ({ slug: a.slug, title: a.title, feature_count: a.features.length })));
      if (p.startsWith("/api/features/")) {
        const id = p.slice("/api/features/".length);
        const f = readFeatureById(paths, id);
        if (!f) return json(res, { error: "not found" }, 404);
        return json(res, { product: f, tracking: readTracking(paths, id) });
      }
      if (p === "/api/feedback") return json(res, listFeedback(paths).map((f) => f.frontmatter));
      if (p === "/api/context") return json(res, listContext(paths).map((d) => ({ name: d.name, title: d.title, order: d.order })));
      if (p.startsWith("/api/context/")) {
        const name = p.slice("/api/context/".length);
        const doc = readContext(paths, name);
        if (!doc) return json(res, { error: "not found" }, 404);
        return json(res, doc);
      }

      // ---- Site rendering ----
      const areas = listAreas(paths);
      const capabilities = listCapabilities(paths);
      const capabilitySystems = listCapabilitySystems(paths);
      const products = listProducts(paths);
      const contextDocs = listContext(paths);
      const openFeedbackCount = listFeedback(paths, { state: "open" }).length;
      // Readiness needs the tracking sidecar, which only this layer has paths
      // for — so it is computed here and handed to the pure renderer.
      // Citations resolve across both namespaces: `principles#x` globally,
      // `cre/principles#x` for one product.
      //
      // ⛔ PRODUCT slugs, not area slugs. This passed `areas.map(a => a.slug)`, left over
      // from before areas could nest — back then a top-level slug WAS the product, and
      // after the change it is `deals`, `documents`, `pricing`. So the map was keyed
      // `deals/principles#…` while every citation in the corpus reads
      // `cre/principles#…`, and the result was that EVERY product-scoped citation
      // resolved to nothing: a readiness blocker and an audit finding on each one, both
      // false. A reader found the symptom without the cause — "two write-up notes say
      // the citations are malformed… it detects it and still renders the dead citation."
      const contextStates = new Map<string, ContextSectionState>();
      for (const [ref, { section, doc }] of allContextSections(
        paths,
        products.map((p) => p.slug)
      )) {
        contextStates.set(ref, contextSectionState(section, doc.sections[section.anchor]));
      }
      const trackingFor = (id: string) => readTracking(paths, id);
      // ⛔ TWO PASSES, and the order is the point. A feature's readiness now depends on
      // whether the things it calls are ready, so the things it calls have to be settled
      // first. Capabilities are the leaves of this graph — they depend on nothing —
      // so pass one settles them and pass two can ask.
      //
      // Deliberately not recursive: a capability depending on a capability would make
      // this a graph walk with a cycle risk, and one level is where the value is. A
      // deeper chain surfaces as the middle link being unready, which is the right
      // place to fix it anyway.
      const allContainers = [...capabilities, ...areas.flatMap((a) => a.features)];
      const readiness = new Map<string, FeatureReadiness>();
      const depReady = new Map<string, boolean>();
      for (const c of capabilities) {
        const r = featureReadiness(c, readTracking(paths, c.frontmatter.id), contextStates, allContainers);
        readiness.set(c.frontmatter.id, r);
        depReady.set(c.frontmatter.id, r.ready);
      }
      for (const f of areas.flatMap((a) => a.features)) {
        const r = featureReadiness(
          f,
          readTracking(paths, f.frontmatter.id),
          contextStates,
          allContainers,
          depReady
        );
        readiness.set(f.frontmatter.id, r);
        depReady.set(f.frontmatter.id, r.ready);
      }
      const sb = (activeId?: string) =>
        renderSidebar(
          areas,
          contextDocs,
          activeId,
          openFeedbackCount,
          readiness,
          capabilities,
          capabilitySystems,
          products
        );
      const shellOpts = config.web?.stylesheet
        ? { userStylesheetUrl: "/_user-style.css" }
        : {};

      if (p === "/" || p === "") {
        const fp = topReadmePath(paths);
        // ⛔ Strip the frontmatter. Handed the raw file, marked reads `---\ntitle: X\n---`
        // as a setext heading and the overview page opens with a stray "title: Product
        // Truth" — the YAML rendered as prose.
        // ⛔ Strip the frontmatter AND a leading h1. Handed the raw file, marked reads
        // `---\ntitle: X\n---` as a setext heading, so the overview opened with a
        // stray "title: Product Truth"; and the file's own `# Product Truth` then
        // repeated the page header directly beneath it.
        const readme = fs.existsSync(fp)
          ? matter(fs.readFileSync(fp, "utf-8"))
              .content.trim()
              .replace(/^#\s+.*\n+/, "")
          : undefined;
        const body = renderHome(products, readme, capabilitySystems, readiness, trackingFor);
        return html(res, renderShell("Product Truth", body, sb("_root"), shellOpts));
      }

      if (p === "/_feedback" || p === "/_feedback/") {
        const entries = listFeedback(paths);
        const body = renderFeedbackQueue(entries);
        return html(res, renderShell("Feedback queue", body, sb("_feedback"), shellOpts));
      }

      if (p === "/_context" || p === "/_context/") {
        const body = renderContextIndex(contextDocs, areas);
        return html(res, renderShell("Strategy", body, sb("_context"), shellOpts));
      }

      // Per-doc URLs now redirect into the single-page Strategy view with an
      // anchor. Preserves old links (e.g. `productos/context/principles.md`
      // referenced from a Contract note) without breaking them.
      const ctxMatch = p.match(/^\/_context\/([^/]+)\/?$/);
      if (ctxMatch) {
        const name = ctxMatch[1]!;
        res.writeHead(302, { Location: `/_context#${encodeURIComponent(name)}` });
        res.end();
        return;
      }

      // ⛔ THE GROUPING LEVELS ARE ROUTES. The nav links to every product, group and
      // capability system; without these they were links to 404s, which is worse than
      // not linking at all — it reads as a broken corpus rather than a missing page.
      if (p === "/_queue") {
        const contextDocs: Array<{ doc: unknown; section: unknown; ref: string }> = [];
        for (const [ref, { section, doc }] of allContextSections(
          paths,
          products.map((x) => x.slug)
        )) {
          contextDocs.push({ doc, section, ref });
        }
        const list = buildWorklist(
          allContainers,
          trackingFor,
          contextStates,
          contextDocs as never
        );
        return html(
          res,
          renderShell("Waiting on you", renderQueue(groupWorklist(list)), sb("_queue"), shellOpts)
        );
      }

      if (p === "/_states") {
        return html(res, renderShell("Status words", renderStates(products), sb("_states"), shellOpts));
      }

      const capSystemMatch = p.match(/^\/capabilities\/([^/]+)\/?$/);
      if (capSystemMatch) {
        const sys = capabilitySystems.find((s) => s.slug === capSystemMatch[1]);
        if (sys) {
          const body = renderCapabilitySystem(sys, readiness, trackingFor, listSystemContext(paths, sys.slug));
          return html(res, renderShell(sys.title, body, sb(), shellOpts));
        }
      }

      // ⛔ RESOLVE BY PATH, NOT BY SEGMENT COUNT. Areas nest to whatever depth the
      // product needs, so `/cre/pricing/agency/limit-tiers` is as valid as
      // `/cre/deals/deal-list`. A counted matcher 404s everything past its depth
      // while the sidebar keeps linking to it.
      const id = decodeURIComponent(p.replace(/^\/+|\/+$/g, ""));
      if (id && !id.startsWith("_")) {
        // A container is a file; a group is a directory. Files win: a group named the
        // same as a feature is a corpus error, and `check` reports it.
        const f = readFeatureById(paths, id);
        if (f) {
          const segs = id.split("/");
          const area = areas.find(
            (a) => `${a.product}/${a.slug}` === segs.slice(0, -1).join("/")
          );
          const tracking = readTracking(paths, id);
          // Build a corpus-wide surface→feature index so leads_to can resolve
          // bare surface ids to whichever feature owns them.
          const surfaceIndex = buildSurfaceIndex(listAllContainers(paths));
          const body = renderFeature(
            f,
            area,
            tracking,
            surfaceIndex,
            areas,
            capabilitySystems,
            products,
            listAllContainers(paths),
            readFrameworkGaps(paths)
              .filter((g) => g.status === "open" && g.forced_into === id)
              .map((g) => ({ what: g.what, question: g.question })),
            readiness.get(id),
            allContextSections(paths, products.map((x) => x.slug)),
            listFeedback(paths, { state: "open", feature: id })
          );
          return html(res, renderShell(f.frontmatter.title, body, sb(id), shellOpts));
        }

        const product = products.find((x) => x.slug === id);
        if (product) {
          const advice = groupingAdvice(products, config.grouping, listCapabilities(paths)).filter(
            (a) => a.where === product.slug
          );
          const body = renderProduct(product, listAreaContext(paths, product.slug), readiness, advice, trackingFor);
          return html(res, renderShell(product.title, body, sb(), shellOpts));
        }

        const group = findGroup(products, id);
        if (group) {
          const productSlug = group.segments[0]!;
          const area: AreaDocument = {
            slug: group.segments.slice(1).join("/"),
            product: productSlug,
            title: group.title,
            body: group.body,
            features: group.features,
            filepath: group.filepath,
          };
          // Advice about this group, plus advice about the features filed in it —
          // an oversized feature is a shape problem you fix from the area page.
          const inGroup = new Set(group.features.map((f) => f.frontmatter.id));
          const advice = groupingAdvice(products, config.grouping, listCapabilities(paths)).filter(
            (a) => a.where === group.id || inGroup.has(a.where)
          );
          const body = renderArea(
            area,
            listAreaContext(paths, group.id),
            undefined,
            group,
            products,
            readiness,
            advice,
            trackingFor
          );
          return html(res, renderShell(group.title, body, sb(), shellOpts));
        }
      }

      html(res, renderShell("Not found", `<div class="empty-state">No product truth at <code>${p}</code>.</div>`, sb(), shellOpts), 404);
    } catch (e) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(`server error: ${(e as Error).message}`);
    }
  });

  ensureFeedbackDir(paths);
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(pc.red("✗"), `Port ${port} is already in use.`);
      console.error(pc.dim(`  Try: productos serve --port <other> · or set PORT=<other> · or change ui_port in productos/config.yaml`));
      process.exit(1);
    }
    console.error(pc.red("✗"), `Server error: ${err.message}`);
    process.exit(1);
  });
  server.listen(port, () => {
    console.log(pc.green("✓"), `Product truth: ${pc.cyan(`http://localhost:${port}`)}`);
    console.log(pc.dim(`  product:  ${path.relative(process.cwd(), paths.productsDir)}/`));
    console.log(pc.dim(`  tracking: ${path.relative(process.cwd(), paths.trackingDir)}/`));
    console.log(pc.dim(`  feedback: ${path.relative(process.cwd(), paths.feedbackDir)}/`));
  });
}

function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function html(res: http.ServerResponse, body: string, status = 200): void {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

function json(res: http.ServerResponse, body: unknown, status = 200): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body, null, 2));
}
