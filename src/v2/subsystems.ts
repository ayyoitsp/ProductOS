/**
 * The capability tree, answered once — for every surface that counts it.
 *
 * ⛔ WHY THIS EXISTS. Peter: *"every claude session connecting to staging is confused by the # of
 * capabilities, if they even exist"*. A session on 4100 said it plainly: *"My analyse capabilities
 * read the Capability/offers schema layer, which is empty — but the actual tree on 4100 is built as
 * scopes filed under a capabilities container, which that command doesn't look at."*
 *
 * Two things were answering to the word "capability":
 *
 *  - **The tree.** Subsystems (`Subsystem`), nesting by `in:`, each offering capabilities
 *    (`Capability`) that `serve` product truth. Engineering's answer, written by `decomposer`.
 *  - **A product area carried from v1.** The v1 migrator filed every v1 capability as a SCOPE under
 *    a container with the fixed id `capabilities`, with system-asked behaviours. That is product
 *    truth about machinery — never the tree — and nothing converts it, because the migrator was
 *    deleted with the rest of v1.
 *
 * So every surface that says how many capabilities there are reads it from here, and here names
 * both halves in one sentence. A count that silently looks at one of them is the defect.
 */
import type { Corpus } from "./load.js";
import { derivedCapabilities } from "./demonstrate.js";
import { descendants } from "./settle.js";
import type { RequirementState } from "./demonstrate.js";

/**
 * The id the v1 migrator gave the container it filed every v1 capability under. Fixed in the
 * migrator (`raw[0] === "capabilities"`), so it is what every migrated corpus carries.
 */
export const CARRIED_AREA_ID = "capabilities";

export interface CarriedArea {
  id: string;
  title: string;
  /** Scopes filed under it that hold behaviours — each was one v1 capability. */
  features: number;
  /** Behaviours across them — v1 operations, carried as system-asked exchanges. */
  behaviours: number;
  /** Every scope id under it, the container included. */
  scopes: string[];
}

export interface CapabilityTree {
  subsystems: Array<{
    id: string;
    title: string;
    does: string;
    in: string | null;
    uses: string[];
    capabilities: Array<{ ref: string; id: string; does: string; serves: string[]; state: RequirementState }>;
  }>;
  counts: { subsystems: number; capabilities: number };
  /** Product areas carried from an older capability tree. ⛔ Product truth, not this tree. */
  carried: CarriedArea[];
  /** One plain sentence naming both, for a session to repeat rather than reconstruct. */
  says: string;
}

/**
 * The product area the v1 migrator made, if this corpus has one.
 *
 * ⛔ BY ID, NOT BY TITLE. A product may legitimately have an area a person titled "Capabilities"; the
 * migrator's container is the one whose id it chose. Title is a fallback only for a container at the
 * top whose id was renamed and whose title was not.
 */
export function carriedAreas(corpus: Corpus): CarriedArea[] {
  const roots = corpus.scopes
    .map((s) => s.scope)
    .filter((s) => s.id === CARRIED_AREA_ID || (!s.in && /^capabilities$/i.test(s.title.trim())));
  return roots.map((root) => {
    const ids = descendants(corpus, root.id);
    const held = corpus.scopes.filter((s) => ids.includes(s.scope.id));
    return {
      id: root.id,
      title: root.title,
      features: held.filter((s) => s.scope.exchanges.length > 0).length,
      behaviours: held.reduce((n, s) => n + s.scope.exchanges.length, 0),
      scopes: ids,
    };
  });
}

/** Every scope id inside a carried area, for surfaces that must not count them as features. */
export function inCarriedArea(corpus: Corpus): Set<string> {
  return new Set(carriedAreas(corpus).flatMap((a) => a.scopes));
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function capabilityTree(corpus: Corpus): CapabilityTree {
  const parts = derivedCapabilities(corpus);
  const subsystems = corpus.subsystems.map(({ subsystem: s }) => ({
    id: s.id,
    title: s.title,
    does: s.does,
    in: s.in ?? null,
    uses: s.uses,
    capabilities: s.offers.map((o) => {
      const ref = `${s.id}#offers#${o.id}`;
      return {
        ref,
        id: o.id,
        does: o.does,
        serves: o.serves,
        state: parts.find((p) => p.ref === ref)?.state ?? "authored",
      };
    }),
  }));
  const counts = {
    subsystems: subsystems.length,
    capabilities: subsystems.reduce((n, s) => n + s.capabilities.length, 0),
  };
  const carried = carriedAreas(corpus);

  const tree = counts.subsystems
    ? `The capability tree has ${plural(counts.subsystems, "subsystem")} offering ${plural(counts.capabilities, "capability", "capabilities")}.`
    : "The capability tree is empty: no subsystems, no capabilities.";
  const area = carried.length
    ? " " +
      carried
        .map(
          (a) =>
            `The product area "${a.title}" (${plural(a.features, "feature")}, ${plural(a.behaviours, "behaviour")}) is an older capability tree carried into product truth — it is not the capability tree, its scopes are not subsystems, and the server converts it into subsystems once per project.`
        )
        .join(" ")
    : "";
  return { subsystems, counts, carried, says: tree + area };
}
