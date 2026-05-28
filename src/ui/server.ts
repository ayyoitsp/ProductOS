import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../core/paths.js";
import { readConfig } from "../core/config.js";
import {
  listAreas,
  listFeatures,
  readFeatureById,
  topReadmePath,
} from "../core/product.js";
import { readEnvConfig } from "../core/env.js";
import { renderArea, renderFeature, renderHome, renderShell, renderSidebar } from "./renderer.js";

export async function startUiServer(): Promise<void> {
  const paths = resolvePathsOrThrow();
  const config = readConfig(paths);
  const port = config.ui_port;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      const p = url.pathname;

      // JSON API endpoints for the MCP / CLI / external tooling
      if (p === "/api/features") {
        return json(res, listFeatures(paths).map((f) => f.frontmatter));
      }
      if (p === "/api/areas") {
        return json(res, listAreas(paths).map((a) => ({ slug: a.slug, title: a.title, feature_count: a.features.length })));
      }
      if (p === "/api/env") {
        return json(res, { env: readEnvConfig(paths) });
      }
      if (p.startsWith("/api/features/")) {
        const id = p.slice("/api/features/".length);
        const f = readFeatureById(paths, id);
        if (!f) return json(res, { error: "not found" }, 404);
        return json(res, f);
      }

      // Static evidence blobs
      if (p.startsWith("/evidence/")) {
        const blobPath = path.join(paths.root, "evidence", p.slice("/evidence/".length));
        if (fs.existsSync(blobPath) && fs.statSync(blobPath).isFile()) {
          const ct = blobContentType(blobPath);
          res.writeHead(200, { "content-type": ct });
          fs.createReadStream(blobPath).pipe(res);
          return;
        }
        res.writeHead(404).end("not found");
        return;
      }

      // Site rendering
      const areas = listAreas(paths);

      // Home
      if (p === "/" || p === "") {
        const topReadmeFp = topReadmePath(paths);
        const readme = fs.existsSync(topReadmeFp) ? fs.readFileSync(topReadmeFp, "utf-8") : undefined;
        const body = renderHome(areas, readme);
        const sidebar = renderSidebar(areas, "_root");
        return html(res, renderShell("Product Truth", body, sidebar));
      }

      // Area page: /<area>/ or /<area>
      const areaMatch = p.match(/^\/([^/]+)\/?$/);
      if (areaMatch) {
        const slug = areaMatch[1]!;
        const area = areas.find((a) => a.slug === slug);
        if (area) {
          const body = renderArea(area);
          const sidebar = renderSidebar(areas);
          return html(res, renderShell(area.title, body, sidebar));
        }
      }

      // Feature page: /<area>/<feature>
      const featMatch = p.match(/^\/([^/]+)\/([^/]+)\/?$/);
      if (featMatch) {
        const id = `${featMatch[1]}/${featMatch[2]}`;
        const f = readFeatureById(paths, id);
        if (f) {
          const area = areas.find((a) => a.slug === featMatch[1]);
          const body = renderFeature(f, area);
          const sidebar = renderSidebar(areas, id);
          return html(res, renderShell(f.frontmatter.title, body, sidebar));
        }
      }

      // 404
      const sidebar = renderSidebar(areas);
      html(
        res,
        renderShell(
          "Not found",
          `<div class="empty-state">No product truth at <code>${p}</code>.</div>`,
          sidebar
        ),
        404
      );
    } catch (e) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(`server error: ${(e as Error).message}`);
    }
  });

  server.listen(port, () => {
    console.log(pc.green("✓"), `Product truth: ${pc.cyan(`http://localhost:${port}`)}`);
    console.log(pc.dim(`  rendering ${path.relative(process.cwd(), paths.root)}/products/`));
    console.log(pc.dim(`  changes to markdown are picked up on next page load — no rebuild needed.`));
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

function blobContentType(fp: string): string {
  const ext = path.extname(fp).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".json") return "application/json";
  if (ext === ".yaml" || ext === ".yml") return "application/yaml";
  return "application/octet-stream";
}
