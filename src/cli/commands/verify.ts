import { Command } from "commander";
import os from "node:os";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { nowIso, readFeatureById, writeFeature } from "../../core/product.js";
import {
  hashSection,
  parseSections,
  readContext,
  writeContextSections,
} from "../../core/context.js";

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
    .argument("<target>", "Feature id like 'wallet/kid-balance', or a context section like 'principles#some-rule'")
    .argument("[behavior_id]", "Behavior id within the feature — omit when verifying a context section")
    .option("--by <name>", "Who is verifying; defaults to your OS username")
    .action((featureId: string, behaviorId: string, opts: { by?: string }) => {
      const paths = resolvePathsOrThrow();

      // `productos verify principles#numbers-feel-rewarding` — a context
      // section rather than a behavior. Same human-only stamp, same rule that
      // an edit drops it; the target is just upstream of any feature.
      if (featureId.includes("#") && behaviorId === undefined) {
        return verifyContextSection(paths, featureId, opts.by);
      }
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

/**
 * Stamp one `##` section of a context doc as human-accepted.
 *
 * The hash of the section text is recorded so a later edit silently drops the
 * stamp — the same rule behaviors follow. Validating a sentence and then
 * changing the sentence must not leave the stamp standing.
 */
function verifyContextSection(
  paths: ReturnType<typeof resolvePathsOrThrow>,
  ref: string,
  by: string | undefined
): void {
  const [docName, anchor] = ref.split("#");
  if (!docName || !anchor) {
    console.error(pc.red("✗"), `"${ref}" is not <doc>#<section>`);
    process.exit(1);
  }
  const doc = readContext(paths, docName);
  if (!doc) {
    console.error(pc.red("✗"), `Context doc "${docName}" not found`);
    process.exit(1);
  }
  const section = parseSections(doc.body).find((s) => s.anchor === anchor);
  if (!section) {
    console.error(pc.red("✗"), `No section "${anchor}" in ${docName}`);
    process.exit(1);
  }
  const actor = by || os.userInfo().username || "unknown";
  const sections: Record<string, unknown> = { ...doc.sections };
  sections[anchor] = {
    ...(sections[anchor] ?? {}),
    verified: true,
    verified_by: actor,
    verified_at: nowIso(),
    hash: hashSection(section.text),
  };
  writeContextSections(paths, docName, sections);
  console.log(pc.green("✓"), `Accepted ${docName}#${anchor} by ${actor}`);
}
