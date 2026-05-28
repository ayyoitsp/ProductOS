import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { listFeatures } from "../../core/product.js";

export function gapsCommand(): Command {
  return new Command("gaps")
    .description("Print gaps in product truth (proposed/stale/contested behaviors, planned features without code)")
    .action(() => {
      const paths = resolvePathsOrThrow();
      const features = listFeatures(paths);

      const byKind = new Map<string, { feature_id: string; behavior_id?: string; detail?: string }[]>();
      const add = (kind: string, entry: { feature_id: string; behavior_id?: string; detail?: string }) => {
        const arr = byKind.get(kind) ?? [];
        arr.push(entry);
        byKind.set(kind, arr);
      };

      for (const f of features) {
        const fm = f.frontmatter;
        if (fm.status === "planned" && fm.implements.length === 0)
          add("planned-no-impl", { feature_id: fm.id, detail: "no code path linked" });
        if (fm.behaviors.length === 0)
          add("no-behaviors", { feature_id: fm.id, detail: "feature has no behaviors documented" });
        for (const b of fm.behaviors) {
          if (b.status === "proposed") add("proposed", { feature_id: fm.id, behavior_id: b.id });
          if (b.status === "stale") add("stale", { feature_id: fm.id, behavior_id: b.id });
          if (b.status === "contested") add("contested", { feature_id: fm.id, behavior_id: b.id, detail: b.notes });
          if (b.status === "verified" && b.evidence.length === 0)
            add("verified-no-evidence", { feature_id: fm.id, behavior_id: b.id, detail: "verified but no evidence attached" });
        }
      }

      const total = [...byKind.values()].reduce((s, a) => s + a.length, 0);
      console.log(pc.bold(`${total} gap${total === 1 ? "" : "s"} across ${features.length} feature${features.length === 1 ? "" : "s"}`));

      const order = ["contested", "stale", "proposed", "verified-no-evidence", "no-behaviors", "planned-no-impl"];
      for (const kind of order) {
        const items = byKind.get(kind);
        if (!items || items.length === 0) continue;
        console.log(pc.bold(`\n${labelFor(kind)} (${items.length})`));
        for (const it of items) {
          const where = it.behavior_id ? `${it.feature_id}#${it.behavior_id}` : it.feature_id;
          console.log(`  ${colorFor(kind)("●")} ${pc.cyan(where)}${it.detail ? "  " + pc.dim(it.detail) : ""}`);
        }
      }

      if (total === 0) console.log(pc.dim("\n  (no gaps — every behavior is verified with evidence)"));
    });
}

function labelFor(kind: string): string {
  return ({
    contested: "Contested (external evidence disagrees)",
    stale: "Stale (code changed since verification)",
    proposed: "Awaiting verification",
    "verified-no-evidence": "Verified but no evidence attached",
    "no-behaviors": "Features with no behaviors",
    "planned-no-impl": "Planned features with no code yet",
  } as Record<string, string>)[kind] ?? kind;
}

function colorFor(kind: string): (s: string) => string {
  return ({
    contested: pc.red,
    stale: pc.yellow,
    proposed: pc.yellow,
    "verified-no-evidence": pc.yellow,
    "no-behaviors": pc.dim,
    "planned-no-impl": pc.blue,
  } as Record<string, (s: string) => string>)[kind] ?? pc.dim;
}
