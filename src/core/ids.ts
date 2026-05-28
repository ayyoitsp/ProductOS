import fs from "node:fs";
import path from "node:path";
import { ProductosPaths } from "./paths.js";

/** Next available T-XXXX id by scanning existing truth files. */
export function nextTruthId(paths: ProductosPaths): string {
  if (!fs.existsSync(paths.truthDir)) return "T-0001";
  const max = fs
    .readdirSync(paths.truthDir)
    .map((f) => f.match(/^T-(\d+)\.md$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => parseInt(m[1]!, 10))
    .reduce((a, b) => Math.max(a, b), 0);
  return `T-${String(max + 1).padStart(4, "0")}`;
}

export function truthFilePath(paths: ProductosPaths, id: string): string {
  return path.join(paths.truthDir, `${id}.md`);
}

export function traceFilePath(paths: ProductosPaths, id: string): string {
  return path.join(paths.tracesDir, `${id}.trace.yaml`);
}
