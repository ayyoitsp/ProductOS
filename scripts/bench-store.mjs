/**
 * How long a round trip to the store actually takes, and how many a request makes.
 *
 * ⛔ BECAUSE THE ARITHMETIC WAS WRONG. I estimated 150–250ms added per page against a
 * hosted Postgres from five round trips at a guessed RTT. The real figure was 1.2s,
 * and `/health` at 1ms proved the render was free — so the estimate was wrong about
 * the per-trip cost, not about the count. A number somebody measured beats a number
 * somebody derived, and this is the thing to re-run after any change that claims to
 * make the store faster.
 *
 * Usage:
 *   node scripts/bench-store.mjs                 # the DATABASE_URL in .env
 *   node scripts/bench-store.mjs --compare-direct # and the same host without -pooler
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import postgres from "postgres";

const envvar = (name) =>
  execFileSync("./scripts/envvar.sh", [".env", name], { encoding: "utf-8" }).trim();

const mask = (u) => u.replace(/\/\/[^@]*@/, "//***@");

async function bench(label, url, rounds = 8) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`select 1`; // connect + TLS, not measured
    const times = [];
    for (let i = 0; i < rounds; i++) {
      const t = process.hrtime.bigint();
      await sql`select 1`;
      times.push(Number(process.hrtime.bigint() - t) / 1e6);
    }
    times.sort((a, b) => a - b);
    const med = times[Math.floor(times.length / 2)];

    /** A corpus read, as the instance actually issues it: five trips, sequential. */
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 5; i++) await sql`select 1`;
    const five = Number(process.hrtime.bigint() - t0) / 1e6;

    /** The same five, concurrent — what they would cost if they did not wait on each other. */
    const t1 = process.hrtime.bigint();
    await Promise.all(Array.from({ length: 5 }, () => sql`select 1`));
    const parallel = Number(process.hrtime.bigint() - t1) / 1e6;

    console.log(`${label}`);
    console.log(`  ${mask(url)}`);
    console.log(`  one round trip (median of ${rounds}):  ${med.toFixed(1)}ms`);
    console.log(`  five, sequential (a page today):      ${five.toFixed(0)}ms`);
    console.log(`  five, concurrent (the ceiling):       ${parallel.toFixed(0)}ms`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const url = envvar("DATABASE_URL");
if (!url) {
  console.error("no DATABASE_URL in .env");
  process.exit(1);
}

await bench("pooled", url);

if (process.argv.includes("--compare-direct") && url.includes("-pooler")) {
  console.log();
  await bench("direct (no -pooler)", url.replace("-pooler", ""));
}
