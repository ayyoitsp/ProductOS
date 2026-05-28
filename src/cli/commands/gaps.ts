import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { listFeatures } from "../../core/product.js";
import { readTracking } from "../../core/tracking.js";
import { listFeedback } from "../../core/feedback.js";

export function gapsCommand(): Command {
  return new Command("gaps")
    .description("Print gaps in product truth + tracking + open feedback")
    .action(() => {
      const paths = resolvePathsOrThrow();
      const features = listFeatures(paths);
      const groups: Record<string, Array<{ id: string; detail?: string }>> = {
        contested: [],
        stale: [],
        "awaiting-verification": [],
        "no-behaviors": [],
        "planned-no-impl": [],
        "open-feedback": [],
      };
      for (const f of features) {
        const fm = f.frontmatter;
        const t = readTracking(paths, fm.id);
        if (fm.status === "planned" && !t?.implements?.length)
          groups["planned-no-impl"]!.push({ id: fm.id });
        if (fm.behaviors.length === 0) groups["no-behaviors"]!.push({ id: fm.id });
        for (const b of fm.behaviors) {
          const bt = t?.behaviors[b.id];
          const status = bt?.status ?? "proposed";
          if (status === "proposed") groups["awaiting-verification"]!.push({ id: `${fm.id}#${b.id}` });
          if (status === "stale") groups.stale!.push({ id: `${fm.id}#${b.id}` });
          if (status === "contested") groups.contested!.push({ id: `${fm.id}#${b.id}` });
        }
      }
      const fb = listFeedback(paths, { state: "open" });
      for (const e of fb) {
        const where = e.frontmatter.target.feature ?? "(no target)";
        groups["open-feedback"]!.push({ id: e.frontmatter.id, detail: `${where}: ${e.body.slice(0, 70)}` });
      }
      const total = Object.values(groups).reduce((s, a) => s + a.length, 0);
      console.log(pc.bold(`${total} gap${total === 1 ? "" : "s"} across ${features.length} feature${features.length === 1 ? "" : "s"}`));
      for (const [kind, items] of Object.entries(groups)) {
        if (items.length === 0) continue;
        console.log(pc.bold(`\n${labelFor(kind)} (${items.length})`));
        for (const it of items) {
          console.log(`  ${colorFor(kind)("●")} ${pc.cyan(it.id)}${it.detail ? "  " + pc.dim(it.detail) : ""}`);
        }
      }
      if (total === 0) console.log(pc.dim("\n  (no gaps — every behavior is verified, nothing is contested, no open feedback)"));
    });
}

function labelFor(kind: string): string {
  return ({
    contested: "Contested",
    stale: "Stale (code changed since verification)",
    "awaiting-verification": "Awaiting verification",
    "no-behaviors": "Features with no behaviors",
    "planned-no-impl": "Planned features with no implementation tracked",
    "open-feedback": "Open feedback",
  } as Record<string, string>)[kind] ?? kind;
}

function colorFor(kind: string): (s: string) => string {
  return ({
    contested: pc.red,
    stale: pc.yellow,
    "awaiting-verification": pc.yellow,
    "no-behaviors": pc.dim,
    "planned-no-impl": pc.blue,
    "open-feedback": pc.cyan,
  } as Record<string, (s: string) => string>)[kind] ?? pc.dim;
}
