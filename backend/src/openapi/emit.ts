import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "../server.js";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../../../openapi.json");

async function main() {
  const app = buildApp();
  const res = await app.request("/openapi.json");
  const spec = await res.json();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(spec, null, 2));
  // eslint-disable-next-line no-console
  console.log(`wrote ${OUT}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
