import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import {
  listAreas,
  listFeatures,
  readFeatureById,
} from "../../core/product.js";
import {
  emptyTrackingFor,
  readTracking,
  recordTransition,
  writeTracking,
} from "../../core/tracking.js";

export function productCommand(): Command {
  const cmd = new Command("product").description("Inspect product truth and update tracking (verify/contest)");

  cmd
    .command("list")
    .description("List features (or areas with --areas)")
    .option("--areas", "List areas instead of features")
    .option("--area <area>", "Filter to one area")
    .action((opts: { areas?: boolean; area?: string }) => {
      const paths = resolvePathsOrThrow();
      if (opts.areas) {
        const areas = listAreas(paths);
        for (const a of areas) {
          console.log(`  ${pc.cyan(a.slug)}  ${pc.dim(`(${a.features.length} feature${a.features.length === 1 ? "" : "s"})`)}  ${a.title}`);
        }
        if (!areas.length) console.log(pc.dim("(no areas)"));
        return;
      }
      let features = listFeatures(paths);
      if (opts.area) features = features.filter((f) => f.frontmatter.id.startsWith(opts.area + "/"));
      for (const f of features) {
        const t = readTracking(paths, f.frontmatter.id);
        const verified = Object.values(t?.behaviors ?? {}).filter((b) => b.status === "verified").length;
        const total = f.frontmatter.behaviors.length;
        console.log(`  ${pc.cyan(f.frontmatter.id)}  ${formatStatus(f.frontmatter.status)}  ${pc.dim(`${verified}/${total} verified`)}  ${f.frontmatter.title}`);
      }
      if (!features.length) console.log(pc.dim(`(no features${opts.area ? ` in ${opts.area}` : ""})`));
    });

  cmd
    .command("show <id>")
    .description("Show a single feature with its tracking")
    .action((id: string) => {
      const paths = resolvePathsOrThrow();
      const f = readFeatureById(paths, id);
      if (!f) {
        console.error(pc.red(`Feature "${id}" not found`));
        process.exit(1);
      }
      const t = readTracking(paths, id);
      const fm = f.frontmatter;
      console.log(pc.bold(fm.title), pc.dim(`(${fm.id})`));
      console.log(pc.dim(`status: ${fm.status}`));
      if (fm.description) console.log(pc.dim(fm.description.split("\n")[0]));
      if (t?.implements?.length) {
        console.log(pc.bold("Implemented in:"));
        for (const p of t.implements) console.log("  -", p);
      }
      console.log();
      if (fm.behaviors.length) {
        console.log(pc.bold("Behaviors:"));
        for (const b of fm.behaviors) {
          const tb = t?.behaviors[b.id];
          const status = tb?.status ?? "unverified";
          console.log(`  ${pc.cyan(b.id)}  ${formatBehaviorStatus(status)}`);
          console.log(`    ${b.claim}`);
          if (tb?.code_refs?.length) console.log(pc.dim(`    code: ${tb.code_refs.join(", ")}`));
          if (tb?.last_verified) console.log(pc.dim(`    last verified ${tb.last_verified}${tb.verified_by ? ` by ${tb.verified_by}` : ""}`));
        }
      }
      console.log();
      console.log(pc.dim(`product:  ${path.relative(process.cwd(), f.filepath)}`));
      if (t) console.log(pc.dim(`tracking: productos/tracking/${id}.yaml`));
    });

  cmd
    .command("verify <feature_id> <behavior_id>")
    .description("Mark a behavior verified (writes to tracking sidecar, records history)")
    .action((featureId: string, behaviorId: string) => {
      const paths = resolvePathsOrThrow();
      const f = readFeatureById(paths, featureId);
      if (!f) { console.error(pc.red(`Feature "${featureId}" not found`)); process.exit(1); }
      if (!f.frontmatter.behaviors.find((b) => b.id === behaviorId)) {
        console.error(pc.red(`Behavior "${behaviorId}" not found on ${featureId}`));
        process.exit(1);
      }
      const t = readTracking(paths, featureId) ?? emptyTrackingFor(featureId);
      recordTransition(t, behaviorId, "verified", os.userInfo().username || "cli", { status: "verified", setVerified: true });
      writeTracking(paths, t);
      console.log(pc.green("✓"), `${featureId}#${behaviorId} verified`);
    });

  cmd
    .command("contest <feature_id> <behavior_id>")
    .description("Mark a behavior contested (writes to tracking sidecar)")
    .option("--reason <reason>", "Optional reason recorded in history")
    .action((featureId: string, behaviorId: string, opts: { reason?: string }) => {
      const paths = resolvePathsOrThrow();
      const f = readFeatureById(paths, featureId);
      if (!f) { console.error(pc.red(`Feature "${featureId}" not found`)); process.exit(1); }
      if (!f.frontmatter.behaviors.find((b) => b.id === behaviorId)) {
        console.error(pc.red(`Behavior "${behaviorId}" not found on ${featureId}`));
        process.exit(1);
      }
      const t = readTracking(paths, featureId) ?? emptyTrackingFor(featureId);
      recordTransition(t, behaviorId, "contested", os.userInfo().username || "cli", { status: "contested", note: opts.reason });
      writeTracking(paths, t);
      console.log(pc.yellow("!"), `${featureId}#${behaviorId} contested`);
    });

  return cmd;
}

function formatStatus(s: string): string {
  if (s === "shipped") return pc.green("● shipped");
  if (s === "planned") return pc.blue("● planned");
  if (s === "deprecated") return pc.dim("● deprecated");
  return s;
}

function formatBehaviorStatus(s: string): string {
  if (s === "verified") return pc.green("● verified");
  if (s === "proposed") return pc.yellow("● proposed");
  if (s === "planned") return pc.blue("● planned");
  if (s === "stale") return pc.yellow("● stale");
  if (s === "contested") return pc.red("● contested");
  if (s === "deprecated" || s === "unverified") return pc.dim(`● ${s}`);
  return s;
}
