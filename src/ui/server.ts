import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../core/paths.js";
import { readConfig } from "../core/config.js";
import { listTruth, readTruth, writeTruth, nowIso } from "../core/truth.js";
import { readEnvConfig } from "../core/env.js";

const STATIC_DIR = resolveStaticDir();

function resolveStaticDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "static");
}

export async function startUiServer(): Promise<void> {
  const paths = resolvePathsOrThrow();
  const config = readConfig(paths);
  const port = config.ui_port;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      if (req.method === "GET" && url.pathname === "/") {
        return serveStatic(res, "index.html", "text/html; charset=utf-8");
      }
      if (req.method === "GET" && url.pathname === "/app.js") {
        return serveStatic(res, "app.js", "application/javascript; charset=utf-8");
      }
      if (req.method === "GET" && url.pathname === "/style.css") {
        return serveStatic(res, "style.css", "text/css; charset=utf-8");
      }
      if (req.method === "GET" && url.pathname === "/api/truth") {
        const status = url.searchParams.get("status") ?? undefined;
        const docs = listTruth(paths, { status: status as never });
        return json(res, docs);
      }
      if (req.method === "GET" && url.pathname.startsWith("/api/truth/")) {
        const id = url.pathname.slice("/api/truth/".length);
        const doc = readTruth(paths, id);
        if (!doc) return json(res, { error: "not found" }, 404);
        return json(res, doc);
      }
      if (req.method === "POST" && url.pathname.match(/^\/api\/truth\/[^/]+\/validate$/)) {
        const id = url.pathname.split("/")[3]!;
        const doc = readTruth(paths, id);
        if (!doc) return json(res, { error: "not found" }, 404);
        doc.frontmatter.status = "validated";
        doc.frontmatter.validated_by = process.env.USER ?? "vet-ui";
        doc.frontmatter.validated_at = nowIso();
        writeTruth(paths, doc);
        return json(res, { ok: true, id, status: "validated" });
      }
      if (req.method === "POST" && url.pathname.match(/^\/api\/truth\/[^/]+\/reject$/)) {
        const id = url.pathname.split("/")[3]!;
        const doc = readTruth(paths, id);
        if (!doc) return json(res, { error: "not found" }, 404);
        doc.frontmatter.status = "rejected";
        writeTruth(paths, doc);
        return json(res, { ok: true, id, status: "rejected" });
      }
      if (req.method === "GET" && url.pathname === "/api/env") {
        const env = readEnvConfig(paths);
        return json(res, { configured: !!env, env });
      }
      json(res, { error: "not found" }, 404);
    } catch (e) {
      json(res, { error: (e as Error).message }, 500);
    }
  });

  server.listen(port, () => {
    console.log(pc.green("✓"), `Vet UI: ${pc.cyan(`http://localhost:${port}`)}`);
    console.log(pc.dim(`  Truth in ${path.relative(process.cwd(), paths.truthDir)}/`));
    console.log(pc.dim(`  Validation runs are driven by Claude (it reads productos/env.yaml,`));
    console.log(pc.dim(`  brings up the env, runs the proposed test, records the outcome via MCP).`));
  });
}

function serveStatic(res: http.ServerResponse, name: string, ct: string): void {
  const fp = path.join(STATIC_DIR, name);
  if (!fs.existsSync(fp)) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": ct });
  fs.createReadStream(fp).pipe(res);
}

function json(res: http.ServerResponse, body: unknown, status = 200): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body, null, 2));
}
