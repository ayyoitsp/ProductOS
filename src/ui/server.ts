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
import {
  renderArea,
  renderContextDoc,
  renderContextIndex,
  renderFeature,
  renderFeedbackQueue,
  renderHome,
  renderShell,
  renderSidebar,
} from "./renderer.js";

export async function startUiServer(): Promise<void> {
  const paths = resolvePathsOrThrow();
  const config = readConfig(paths);
  const port = config.ui_port;

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
        const t = readTracking(paths, featureId) ?? emptyTrackingFor(featureId);
        recordTransition(t, behaviorId, "verified", os.userInfo().username || "vet-ui", {
          status: "verified",
          setVerified: true,
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

      if (p === "/" || p === "") {
        const fp = topReadmePath(paths);
        const readme = fs.existsSync(fp) ? fs.readFileSync(fp, "utf-8") : undefined;
        const body = renderHome(areas, readme);
        return html(res, renderShell("Product Truth", body, sb("_root")));
      }

      if (p === "/_feedback" || p === "/_feedback/") {
        const entries = listFeedback(paths);
        const body = renderFeedbackQueue(entries);
        return html(res, renderShell("Feedback queue", body, sb("_feedback")));
      }

      if (p === "/_context" || p === "/_context/") {
        const body = renderContextIndex(contextDocs);
        return html(res, renderShell("Strategy", body, sb()));
      }

      const ctxMatch = p.match(/^\/_context\/([^/]+)\/?$/);
      if (ctxMatch) {
        const name = ctxMatch[1]!;
        const doc = readContext(paths, name);
        if (doc) {
          const body = renderContextDoc(doc, contextDocs);
          return html(res, renderShell(doc.title, body, sb(`_context:${name}`)));
        }
      }

      const areaMatch = p.match(/^\/([^/]+)\/?$/);
      if (areaMatch) {
        const slug = areaMatch[1]!;
        const area = areas.find((a) => a.slug === slug);
        if (area) {
          const body = renderArea(area);
          return html(res, renderShell(area.title, body, sb()));
        }
      }

      const featMatch = p.match(/^\/([^/]+)\/([^/]+)\/?$/);
      if (featMatch) {
        const id = `${featMatch[1]}/${featMatch[2]}`;
        const f = readFeatureById(paths, id);
        if (f) {
          const area = areas.find((a) => a.slug === featMatch[1]);
          const tracking = readTracking(paths, id);
          const body = renderFeature(f, area, tracking);
          return html(res, renderShell(f.frontmatter.title, body, sb(id)));
        }
      }

      html(res, renderShell("Not found", `<div class="empty-state">No product truth at <code>${p}</code>.</div>`, sb()), 404);
    } catch (e) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(`server error: ${(e as Error).message}`);
    }
  });

  ensureFeedbackDir(paths);
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
