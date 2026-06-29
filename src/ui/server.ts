import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../core/paths.js";
import { readConfig, resolveTruthVerificationByok } from "../core/config.js";
import {
  listAreas,
  listFeatures,
  readFeatureById,
  topReadmePath,
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
import { listContext, readContext } from "../core/context.js";
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
  renderShell,
  renderSidebar,
  visibleAreas,
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
      if (p === "/api/features") return json(res, listFeatures(paths).map((f) => f.frontmatter));
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
      const contextDocs = listContext(paths);
      const openFeedbackCount = listFeedback(paths, { state: "open" }).length;
      const sb = (activeId?: string) =>
        renderSidebar(areas, contextDocs, activeId, openFeedbackCount);
      const shellOpts = config.web?.stylesheet
        ? { userStylesheetUrl: "/_user-style.css" }
        : {};

      if (p === "/" || p === "") {
        const fp = topReadmePath(paths);
        const readme = fs.existsSync(fp) ? fs.readFileSync(fp, "utf-8") : undefined;
        const body = renderHome(visibleAreas(areas), readme);
        return html(res, renderShell("Product Truth", body, sb("_root"), shellOpts));
      }

      if (p === "/_feedback" || p === "/_feedback/") {
        const entries = listFeedback(paths);
        const body = renderFeedbackQueue(entries);
        return html(res, renderShell("Feedback queue", body, sb("_feedback"), shellOpts));
      }

      if (p === "/_context" || p === "/_context/") {
        const body = renderContextIndex(contextDocs);
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

      const areaMatch = p.match(/^\/([^/]+)\/?$/);
      if (areaMatch) {
        const slug = areaMatch[1]!;
        const area = areas.find((a) => a.slug === slug);
        if (area) {
          const body = renderArea(area);
          return html(res, renderShell(area.title, body, sb(), shellOpts));
        }
      }

      const featMatch = p.match(/^\/([^/]+)\/([^/]+)\/?$/);
      if (featMatch) {
        const id = `${featMatch[1]}/${featMatch[2]}`;
        const f = readFeatureById(paths, id);
        if (f) {
          const area = areas.find((a) => a.slug === featMatch[1]);
          const tracking = readTracking(paths, id);
          // Build a corpus-wide surface→feature index so leads_to can resolve
          // bare surface ids to whichever feature owns them.
          const surfaceIndex = buildSurfaceIndex(listFeatures(paths));
          const body = renderFeature(f, area, tracking, surfaceIndex);
          return html(res, renderShell(f.frontmatter.title, body, sb(id), shellOpts));
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
