import { Command } from "commander";
import os from "node:os";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { nowIso, readFeatureById, writeFeature } from "../../core/product.js";

/**
 * `productos verify <feature_id> <behavior_id> [--by name]`     — stamp verified
 * `productos unverify <feature_id> <behavior_id>`                — clear it
 *
 * Per-behavior human-validation stamps in the Product Truth markdown so the
 * renderer can show a ✓ on each behavior summary line.
 */

export function verifyCommand(): Command {
  return new Command("verify")
    .description("Mark a behavior as human-validated (visible as ✓ in the renderer)")
    .argument("<feature_id>", "Feature id like 'wallet/kid-balance'")
    .argument("<behavior_id>", "Behavior id within the feature")
    .option("--by <name>", "Who is verifying; defaults to your OS username")
    .action((featureId: string, behaviorId: string, opts: { by?: string }) => {
      const paths = resolvePathsOrThrow();
      const doc = readFeatureById(paths, featureId);
      if (!doc) {
        console.error(pc.red("✗"), `Feature ${featureId} not found`);
        process.exit(1);
      }
      const b = doc.frontmatter.behaviors.find((x) => x.id === behaviorId);
      if (!b) {
        console.error(pc.red("✗"), `Behavior ${behaviorId} not found on ${featureId}`);
        process.exit(1);
      }
      b.verified = true;
      b.verified_at = nowIso();
      b.verified_by = opts.by || os.userInfo().username || "unknown";
      writeFeature(paths, doc);
      console.log(pc.green("✓"), `Verified ${featureId}#${behaviorId} by ${b.verified_by} at ${b.verified_at}`);
    });
}

export function unverifyCommand(): Command {
  return new Command("unverify")
    .description("Clear the human-validated stamp on a behavior")
    .argument("<feature_id>", "Feature id")
    .argument("<behavior_id>", "Behavior id")
    .action((featureId: string, behaviorId: string) => {
      const paths = resolvePathsOrThrow();
      const doc = readFeatureById(paths, featureId);
      if (!doc) {
        console.error(pc.red("✗"), `Feature ${featureId} not found`);
        process.exit(1);
      }
      const b = doc.frontmatter.behaviors.find((x) => x.id === behaviorId);
      if (!b) {
        console.error(pc.red("✗"), `Behavior ${behaviorId} not found on ${featureId}`);
        process.exit(1);
      }
      delete b.verified;
      delete b.verified_at;
      delete b.verified_by;
      writeFeature(paths, doc);
      console.log(pc.green("✓"), `Cleared verification on ${featureId}#${behaviorId}`);
    });
}
