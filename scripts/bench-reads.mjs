/**
 * Which part of a hosted read actually costs the time: the trips, or the bytes?
 *
 * Concurrency took a page from 1.2s to 0.9s and warming the pool changed nothing, so
 * neither the round-trip count nor connection setup explains what is left. This times
 * the three reads a request makes, separately, against the same store.
 */
import { execFileSync } from "node:child_process";
import postgres from "postgres";

const url = execFileSync("./scripts/envvar.sh", [".env", "DATABASE_URL"], { encoding: "utf-8" }).trim();
const sql = postgres(url, { max: 4, onnotice: () => {} });

const ms = async (label, fn) => {
  await fn(); // warm this exact query shape
  const t = process.hrtime.bigint();
  const rows = await fn();
  const took = Number(process.hrtime.bigint() - t) / 1e6;
  const bytes = JSON.stringify(rows).length;
  console.log(`  ${label.padEnd(34)} ${took.toFixed(0).padStart(5)}ms   ${(bytes / 1024).toFixed(1)}KB`);
  return took;
};

const [{ id: project }] = await sql`select id from projects limit 1`;
console.log(`project ${project}\n`);

await ms("select 1", () => sql`select 1`);
await ms("count documents", () => sql`select count(*) from documents where project_id = ${project}`);
await ms("documents: paths only", () => sql`select path from documents where project_id = ${project}`);
await ms("documents: path + source (the read)", () => sql`select path, source from documents where project_id = ${project}`);
await ms("events since 0", () => sql`select seq, kind, payload, at from events where project_id = ${project} order by seq asc limit 100000`);
await ms("max(seq) — a cache check would be this", () => sql`select coalesce(max(seq),0) from events where project_id = ${project}`);

await sql.end({ timeout: 5 });
