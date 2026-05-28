import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { Trace } from "./types.js";
import { ProductosPaths } from "./paths.js";
import { traceFilePath } from "./ids.js";

export function writeTrace(paths: ProductosPaths, trace: Trace): string {
  const fp = traceFilePath(paths, trace.truth_id);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, YAML.stringify(trace, { lineWidth: 0 }), "utf-8");
  return fp;
}

export function readTrace(paths: ProductosPaths, truthId: string): Trace | null {
  const fp = traceFilePath(paths, truthId);
  if (!fs.existsSync(fp)) return null;
  const raw = YAML.parse(fs.readFileSync(fp, "utf-8"));
  return Trace.parse(raw);
}
