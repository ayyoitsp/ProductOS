/**
 * The packet — the handoff artifact.
 *
 * Under the north star ("agents autonomously deliver code based on
 * human-validated product truths") this is what the system exists to produce.
 * Everything else is in service of making this correct and complete.
 *
 * What it deliberately does NOT contain: stack, patterns, file layout,
 * architecture. Those come from the repo and AGENTS.md. If an agent builds the
 * wrong thing, the fix is a more precise *product* claim — never technical
 * detail added here (STRATEGY.md, principle 4).
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  behaviors,
  containers,
  contextItems,
  decisions,
  edges,
  signals,
  testCases,
  validations,
} from "../db/schema.js";
import { deriveState, hashClaim } from "./state.js";

export interface PacketBehavior {
  id: string;
  stableId: string;
  claim: string;
  notes: string | null;
  state: string;
  testCases: Array<{ number: number; description: string; given: string | null; when: string | null; then: string | null }>;
  decisions: string[];
}

export interface Packet {
  containerId: string;
  kind: string;
  title: string;
  goal: string | null;
  description: string | null;
  context: Array<{ kind: string; title: string; body: string }>;
  decisions: Array<{ id: string; title: string; chosen: string; context: string }>;
  behaviors: PacketBehavior[];
  dependsOn: Array<{ id: string; title: string; promises: string[] }>;
  mustNotRegress: Array<{ stableId: string; claim: string }>;
  openQuestions: string[];
}

export async function buildPacket(containerId: string): Promise<Packet | null> {
  const [container] = await db.select().from(containers).where(eq(containers.id, containerId));
  if (!container) return null;

  // Baseline claims are deliberately excluded: an agent must never build from
  // anything unvalidated, whatever its origin (ARCHITECTURE.md §2b).
  const claims = await db
    .select()
    .from(behaviors)
    .where(
      and(
        eq(behaviors.containerId, containerId),
        isNull(behaviors.deprecatedAt),
        eq(behaviors.origin, "authored"),
      ),
    );

  const cases = await db
    .select()
    .from(testCases)
    .where(and(eq(testCases.containerId, containerId), isNull(testCases.deprecatedAt)));

  const [allValidations, allSignals, outgoing] = await Promise.all([
    db.select().from(validations).where(eq(validations.containerId, containerId)),
    db.select().from(signals).where(eq(signals.containerId, containerId)),
    db
      .select()
      .from(edges)
      .where(and(eq(edges.fromType, "container"), eq(edges.fromId, containerId))),
  ]);

  // Context always applies — it constrains every claim below it.
  const context = await db.select().from(contextItems).where(isNull(contextItems.deprecatedAt));

  // Decisions reachable from this container's behaviors.
  const behaviorIds = claims.map((b) => `${containerId}#${b.id}`);
  const decisionEdges = behaviorIds.length
    ? await db
        .select()
        .from(edges)
        .where(and(eq(edges.kind, "decided_by"), inArray(edges.fromId, behaviorIds)))
    : [];
  const decisionIds = [...new Set(decisionEdges.map((e) => e.toId))];
  const relevantDecisions = decisionIds.length
    ? await db.select().from(decisions).where(inArray(decisions.id, decisionIds))
    : [];

  const packetBehaviors: PacketBehavior[] = [];
  for (const b of claims) {
    const hash = await hashClaim(b.claim);
    const state = deriveState(
      hash,
      allValidations.filter((v) => v.behaviorId === b.id),
      allSignals.filter((s) => s.behaviorId === b.id),
    );
    packetBehaviors.push({
      id: b.id,
      stableId: `${containerId}#${b.id}`,
      claim: b.claim,
      notes: b.notes,
      state,
      testCases: cases
        .filter((t) => t.behaviorId === b.id)
        .sort((x, y) => x.number - y.number)
        .map((t) => ({
          number: t.number,
          description: t.description,
          given: t.given,
          when: t.when,
          then: t.then,
        })),
      decisions: decisionEdges
        .filter((e) => e.fromId === `${containerId}#${b.id}`)
        .map((e) => e.toId),
    });
  }

  // Capabilities this container depends on: their validated promises are
  // constraints the implementation must hold to.
  const dependsOnIds = outgoing.filter((e) => e.kind === "depends_on").map((e) => e.toId);
  const dependsOn: Packet["dependsOn"] = [];
  for (const capId of dependsOnIds) {
    const [cap] = await db.select().from(containers).where(eq(containers.id, capId));
    if (!cap) continue;
    const capClaims = await db
      .select()
      .from(behaviors)
      .where(and(eq(behaviors.containerId, capId), isNull(behaviors.deprecatedAt)));
    dependsOn.push({ id: cap.id, title: cap.title, promises: capClaims.map((b) => b.claim) });
  }

  // Validated truth elsewhere in the same area — the regression surface.
  //
  // Deliberately excludes containers already listed under `dependsOn`: their
  // promises are stated there, and repeating them here would restate the same
  // fact in one document. Non-redundancy applies to the artifact too — if the
  // packet says a thing twice, a reader has to work out whether the two
  // mentions differ.
  const areaContainers = await db
    .select()
    .from(containers)
    .where(and(eq(containers.area, container.area), isNull(containers.deprecatedAt)));
  const mustNotRegress: Packet["mustNotRegress"] = [];
  const alreadyListed = new Set(dependsOnIds);
  for (const other of areaContainers.filter(
    (x) => x.id !== containerId && !alreadyListed.has(x.id),
  )) {
    const otherClaims = await db
      .select()
      .from(behaviors)
      .where(and(eq(behaviors.containerId, other.id), isNull(behaviors.deprecatedAt)));
    const otherVals = await db
      .select()
      .from(validations)
      .where(eq(validations.containerId, other.id));
    for (const b of otherClaims) {
      const hash = await hashClaim(b.claim);
      if (deriveState(hash, otherVals.filter((v) => v.behaviorId === b.id), []) === "validated") {
        mustNotRegress.push({ stableId: `${other.id}#${b.id}`, claim: b.claim });
      }
    }
  }

  const openQuestions = allSignals
    .filter((s) => !s.resolved)
    .map((s) => `${s.behaviorId ?? containerId}: ${s.summary}`);

  return {
    containerId,
    kind: container.kind,
    title: container.title,
    goal: container.goal,
    description: container.description,
    context: context.map((x) => ({ kind: x.kind, title: x.title, body: x.body })),
    decisions: relevantDecisions.map((d) => ({
      id: d.id,
      title: d.title,
      chosen: d.chosen,
      context: d.context,
    })),
    behaviors: packetBehaviors,
    dependsOn,
    mustNotRegress,
    openQuestions,
  };
}

export function renderPacketMarkdown(p: Packet): string {
  const out: string[] = [];
  out.push(`# ${p.title}`, "", `\`${p.containerId}\` · ${p.kind}`, "");

  // Goal first. An agent given a goal plus constraints has latitude on *how* —
  // which is the point of describing what rather than how. A bare list of
  // behaviors reads as a task list and quietly removes that latitude.
  out.push("## Goal", "");
  out.push(p.goal ?? "_No goal stated. Add one — an agent with no goal has nothing to reason against when the acceptance criteria underspecify._", "");
  if (p.description) out.push(p.description, "");

  out.push("## Constraints", "", "*These bound the work. Everything else is your call.*", "");

  if (p.context.length) {
    out.push("### Product context", "");
    for (const c of p.context) out.push(`- **${c.title}** (${c.kind}) — ${c.body}`);
    out.push("");
  }

  if (p.decisions.length) {
    out.push("### Decisions already made", "", "*Do not relitigate these; they were deliberate.*", "");
    for (const d of p.decisions) {
      out.push(`- **${d.id} — ${d.title}**`, `  - Chosen: ${d.chosen}`, `  - Why: ${d.context}`);
    }
    out.push("");
  }

  if (p.dependsOn.length) {
    out.push("### Promises you can rely on", "");
    for (const d of p.dependsOn) {
      out.push(`**${d.title}** (\`${d.id}\`)`);
      for (const promise of d.promises) out.push(`- ${promise}`);
      out.push("");
    }
  }

  if (p.mustNotRegress.length) {
    out.push("### Must not regress", "", "*Validated elsewhere in this area.*", "");
    for (const m of p.mustNotRegress) out.push(`- \`${m.stableId}\` — ${m.claim}`);
    out.push("");
  }

  out.push("## Acceptance criteria", "", "*What must be observably true when you are done.*", "");
  if (p.behaviors.length === 0) {
    out.push("_None yet — nothing validated to build against._", "");
  }
  for (const b of p.behaviors) {
    out.push(`### \`${b.stableId}\``, "", b.claim, "");
    if (b.notes) out.push(`> ${b.notes}`, "");
    if (b.testCases.length) {
      out.push("Demonstrated by:", "");
      for (const t of b.testCases) {
        const parts = [t.given && `Given ${t.given}`, t.when && `When ${t.when}`, t.then && `Then ${t.then}`]
          .filter(Boolean)
          .join(" · ");
        out.push(`${t.number}. ${t.description}${parts ? ` — ${parts}` : ""}`);
      }
      out.push("");
    }
  }

  if (p.openQuestions.length) {
    out.push("## Open questions", "", "*Unresolved. Ask rather than assume.*", "");
    for (const q of p.openQuestions) out.push(`- ${q}`);
    out.push("");
  }

  out.push(
    "## Latitude",
    "",
    "Stack, patterns, file layout, and architecture are deliberately unspecified — take them from the repo and AGENTS.md. Anything not constrained above is your call.",
    "",
    "If the acceptance criteria are ambiguous, say so rather than guessing. The fix is a more precise product claim, not a technical assumption.",
  );

  return out.join("\n");
}
