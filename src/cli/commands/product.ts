import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import {
  FeatureFrontmatter,
  listAreas,
  listFeatures,
  readFeatureById,
  writeFeature,
} from "../../core/product.js";

export function productCommand(): Command {
  const cmd = new Command("product").description("Inspect and manage product truth (features and behaviors)");

  cmd
    .command("list")
    .description("List features (or areas with --areas)")
    .option("--areas", "List areas instead of features")
    .option("--area <area>", "Filter to one area")
    .action((opts: { areas?: boolean; area?: string }) => {
      const paths = resolvePathsOrThrow();
      if (opts.areas) {
        const areas = listAreas(paths);
        if (areas.length === 0) {
          console.log(pc.dim("(no areas — run `productos init claude` to scaffold)"));
          return;
        }
        for (const a of areas) {
          console.log(`  ${pc.cyan(a.slug)}  ${pc.dim(`(${a.features.length} feature${a.features.length === 1 ? "" : "s"})`)}  ${a.title}`);
        }
        return;
      }
      let features = listFeatures(paths);
      if (opts.area) features = features.filter((f) => f.frontmatter.id.startsWith(opts.area + "/"));
      if (features.length === 0) {
        console.log(pc.dim(`(no features${opts.area ? ` in ${opts.area}` : ""})`));
        return;
      }
      for (const f of features) {
        const status = formatStatus(f.frontmatter.status);
        const beh = f.frontmatter.behaviors.length;
        console.log(`  ${pc.cyan(f.frontmatter.id)}  ${status}  ${pc.dim(`${beh} behavior${beh === 1 ? "" : "s"}`)}  ${f.frontmatter.title}`);
      }
      console.log(pc.dim(`\n${features.length} feature${features.length === 1 ? "" : "s"}`));
    });

  cmd
    .command("show <id>")
    .description("Show a single feature in detail")
    .action((id: string) => {
      const paths = resolvePathsOrThrow();
      const f = readFeatureById(paths, id);
      if (!f) {
        console.error(pc.red(`Feature "${id}" not found`));
        process.exit(1);
      }
      const fm = f.frontmatter;
      console.log(pc.bold(fm.title), pc.dim(`(${fm.id})`));
      console.log(pc.dim(`status: ${fm.status}  ·  ${fm.behaviors.length} behavior(s)`));
      if (fm.owners.length) console.log(pc.dim(`owners: ${fm.owners.join(", ")}`));
      if (fm.implements.length) {
        console.log(pc.bold("Implements:"));
        for (const p of fm.implements) console.log("  -", p);
      }
      if (fm.related.length) console.log(pc.dim(`related: ${fm.related.join(", ")}`));
      console.log();
      if (fm.behaviors.length) {
        console.log(pc.bold("Behaviors:"));
        for (const b of fm.behaviors) {
          console.log(`  ${pc.cyan(b.id)}  ${formatBehaviorStatus(b.status)}`);
          console.log(`    ${b.claim}`);
          if (b.evidence.length) {
            console.log(pc.dim(`    evidence: ${b.evidence.map((e) => e.kind).join(", ")}`));
          }
          if (b.last_verified) console.log(pc.dim(`    last verified ${b.last_verified}${b.verified_by ? ` by ${b.verified_by}` : ""}`));
        }
      }
      if (f.body) {
        console.log();
        console.log(pc.bold("Notes:"));
        console.log(indent(f.body, "  "));
      }
      console.log();
      console.log(pc.dim(`source: ${path.relative(process.cwd(), f.filepath)}`));
    });

  cmd
    .command("verify <feature_id> <behavior_id>")
    .description("Mark a behavior as verified (records who & when)")
    .action((featureId: string, behaviorId: string) => {
      const paths = resolvePathsOrThrow();
      const doc = readFeatureById(paths, featureId);
      if (!doc) {
        console.error(pc.red(`Feature "${featureId}" not found`));
        process.exit(1);
      }
      const b = doc.frontmatter.behaviors.find((bb) => bb.id === behaviorId);
      if (!b) {
        console.error(pc.red(`Behavior "${behaviorId}" not found on ${featureId}`));
        process.exit(1);
      }
      b.status = "verified";
      b.last_verified = new Date().toISOString();
      b.verified_by = process.env.USER ?? "cli-user";
      writeFeature(paths, doc);
      console.log(pc.green("✓"), `${featureId}#${behaviorId} verified`);
    });

  cmd
    .command("contest <feature_id> <behavior_id>")
    .description("Mark a behavior as contested (claim disagrees with reality)")
    .option("--reason <reason>", "One-line reason; appended to behavior notes")
    .action((featureId: string, behaviorId: string, opts: { reason?: string }) => {
      const paths = resolvePathsOrThrow();
      const doc = readFeatureById(paths, featureId);
      if (!doc) {
        console.error(pc.red(`Feature "${featureId}" not found`));
        process.exit(1);
      }
      const b = doc.frontmatter.behaviors.find((bb) => bb.id === behaviorId);
      if (!b) {
        console.error(pc.red(`Behavior "${behaviorId}" not found on ${featureId}`));
        process.exit(1);
      }
      b.status = "contested";
      if (opts.reason) {
        b.notes = (b.notes ? b.notes + "\n\n" : "") + `Contested: ${opts.reason}`;
      }
      writeFeature(paths, doc);
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
  if (s === "deprecated") return pc.dim("● deprecated");
  return s;
}

function indent(s: string, prefix: string): string {
  return s.split("\n").map((l) => prefix + l).join("\n");
}
