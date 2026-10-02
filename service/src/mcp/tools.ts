/**
 * Tool definitions shared by both MCP surfaces.
 *
 * Two transports expose the same tools:
 *   - stdio bridge (src/mcp/index.ts)  — runs on a machine with the codebase
 *   - remote endpoint (src/mcp/remote.ts) — for Claude.ai / hosted clients
 *
 * Both route through the service's own HTTP API rather than touching the DB,
 * so every enforcement gate (claim linter, duplicate rejection, no-delete,
 * human-only validation) applies identically no matter which surface an agent
 * arrives on. A second implementation would be a second place for those to
 * drift, which is the failure this design exists to prevent.
 *
 * Note what is absent: there is no validation tool. Agents propose; only
 * humans validate.
 */

export type ApiFetch = (path: string, init?: RequestInit) => Promise<string>;

export const TOOL_DEFS = [
  {
    name: "productos_get_packet",
    description:
      "Get the implementation packet for a feature or capability: the goal, the constraints that bound it (product context, prior decisions, capability promises, what must not regress), and the acceptance criteria. This is what you build from. Anything not constrained in the packet is your call — take stack, patterns and file layout from the repo. Only validated truth appears here.",
    inputSchema: {
      type: "object" as const,
      properties: {
        container_id: { type: "string", description: "e.g. 'ledger/adjust-balance'" },
        format: { type: "string", enum: ["md", "json"], default: "md" },
      },
      required: ["container_id"],
    },
  },
  {
    name: "productos_list_containers",
    description:
      "List features and capabilities. Features are user-facing; capabilities are promises other features depend on.",
    inputSchema: {
      type: "object" as const,
      properties: { kind: { type: "string", enum: ["feature", "capability"] } },
    },
  },
  {
    name: "productos_get_container",
    description:
      "Read one feature or capability with its behaviors. Call this before proposing changes to it.",
    inputSchema: {
      type: "object" as const,
      properties: { container_id: { type: "string" } },
      required: ["container_id"],
    },
  },
  {
    name: "productos_get_context",
    description:
      "Product context — goals, principles, personas, non-goals, voice, glossary. Read this first: a claim that contradicts a non-goal or principle is wrong before it is evaluated against anything else.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "productos_get_decisions",
    description:
      "Decisions the team already made, with the alternatives considered and why. Read before concluding something is missing — an absence is often deliberate, and that intent exists nowhere in the code.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "productos_propose_container",
    description:
      "Create or update a feature or capability. A feature is triggered by a user action; a capability is a promise other features depend on, triggered by input from elsewhere in the product. Set a goal — one sentence on what this is FOR — so an agent building from it has something to reason against.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "<area>/<slug>, kebab-case" },
        kind: { type: "string", enum: ["feature", "capability"] },
        title: { type: "string" },
        goal: { type: "string", description: "One sentence: what is this for?" },
        description: { type: "string" },
        lifecycle: { type: "string", enum: ["planned", "built", "retired"], default: "planned" },
      },
      required: ["id", "kind", "title"],
    },
  },
  {
    name: "productos_propose_behavior",
    description:
      "Propose a claim about what the product does. State what someone the product makes a promise to can observe — never the mechanism. Claims naming files, endpoints, status codes or SQL are rejected, as are restatements of existing claims. Proposals land unvalidated; only a human can validate them.",
    inputSchema: {
      type: "object" as const,
      properties: {
        container_id: { type: "string" },
        id: { type: "string", description: "kebab-case, stable, immutable" },
        claim: { type: "string" },
        notes: { type: "string" },
      },
      required: ["container_id", "id", "claim"],
    },
  },
  {
    name: "productos_add_test_case",
    description:
      "Add an acceptance criterion to a behavior — a concrete scenario that demonstrates the claim. This is what an agent checks its own work against, so a behavior without any is an intent nobody can verify. Numbers are assigned automatically and never reused.",
    inputSchema: {
      type: "object" as const,
      properties: {
        container_id: { type: "string" },
        behavior_id: { type: "string" },
        description: { type: "string", description: "What this case demonstrates" },
        given: { type: "string", description: "Starting state" },
        when: { type: "string", description: "The action" },
        then: { type: "string", description: "What must be observably true" },
      },
      required: ["container_id", "behavior_id", "description"],
    },
  },
  {
    name: "productos_add_surface",
    description:
      "Define a screen, modal, or view. Capture interface STRUCTURE — what is on it and where things sit — never design (colors, fonts, spacing). Surfaces are top-level: one screen can serve several features. Use an ASCII sketch for layout.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "kebab-case, e.g. 'adjust-modal'" },
        title: { type: "string" },
        path: { type: "string", description: "Route or selector, e.g. '/adjust/:id'" },
        sketch: { type: "string", description: "ASCII layout sketch" },
        sketch_html: {
          type: "string",
          description:
            "Optional high-fidelity HTML mock of the surface. Structure and content only — mirror the real components where you can. Rendered sandboxed.",
        },
        notes: { type: "string" },
      },
      required: ["id", "title"],
    },
  },
  {
    name: "productos_add_element",
    description:
      "Add an interactive element to a surface — button, input, link, stepper. Behaviors anchor to these. `leads_to` records that using it moves the user to another surface, which is what the flow view is built from.",
    inputSchema: {
      type: "object" as const,
      properties: {
        surface_id: { type: "string" },
        id: { type: "string", description: "kebab-case" },
        kind: { type: "string", description: "button | input | link | stepper | ..." },
        label: { type: "string" },
        leads_to: { type: "string", description: "Surface id this navigates to" },
      },
      required: ["surface_id", "id", "kind"],
    },
  },
  {
    name: "productos_link",
    description:
      "Link two nodes in the graph. `depends_on` points a feature at a capability it relies on; `affected_by` relates two features; `decided_by` links a behavior to a decision that constrains it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        kind: {
          type: "string",
          enum: ["depends_on", "uses", "affected_by", "decided_by", "implements"],
        },
        from_type: { type: "string", enum: ["container", "behavior"] },
        from_id: { type: "string" },
        to_type: { type: "string", enum: ["container", "surface", "decision", "code"] },
        to_id: { type: "string" },
      },
      required: ["kind", "from_type", "from_id", "to_type", "to_id"],
    },
  },
];

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  api: ApiFetch,
): Promise<{ text: string; isError: boolean }> {
  const ok = (text: string) => ({ text, isError: false });

  try {
    switch (name) {
      case "productos_get_packet":
        return ok(
          await api(`/api/packet/${args.container_id}?format=${args.format ?? "md"}`),
        );

      case "productos_list_containers":
        return ok(await api(`/api/containers${args.kind ? `?kind=${args.kind}` : ""}`));

      case "productos_get_container":
        return ok(await api(`/api/containers/${args.container_id}`));

      case "productos_get_context":
        return ok(await api("/api/context"));

      case "productos_get_decisions":
        return ok(await api("/api/context/decisions"));

      case "productos_propose_container":
        return ok(
          await api("/api/containers", {
            method: "PUT",
            body: JSON.stringify({
              id: args.id,
              kind: args.kind,
              title: args.title,
              goal: args.goal,
              description: args.description,
              lifecycle: args.lifecycle ?? "planned",
            }),
          }),
        );

      case "productos_propose_behavior":
        return ok(
          await api("/api/behaviors", {
            method: "PUT",
            body: JSON.stringify({
              containerId: args.container_id,
              id: args.id,
              claim: args.claim,
              notes: args.notes,
            }),
          }),
        );

      case "productos_add_test_case":
        return ok(
          await api("/api/testcases", {
            method: "POST",
            body: JSON.stringify({
              containerId: args.container_id,
              behaviorId: args.behavior_id,
              description: args.description,
              given: args.given,
              when: args.when,
              then: args.then,
            }),
          }),
        );

      case "productos_add_surface":
        return ok(
          await api("/api/surfaces", {
            method: "PUT",
            body: JSON.stringify({
              id: args.id,
              title: args.title,
              path: args.path,
              sketch: args.sketch,
              sketchHtml: args.sketch_html,
              notes: args.notes,
            }),
          }),
        );

      case "productos_add_element":
        return ok(
          await api("/api/surfaces/elements", {
            method: "PUT",
            body: JSON.stringify({
              surfaceId: args.surface_id,
              id: args.id,
              kind: args.kind,
              label: args.label,
              leadsTo: args.leads_to,
            }),
          }),
        );

      case "productos_link":
        return ok(
          await api("/api/edges", {
            method: "POST",
            body: JSON.stringify({
              kind: args.kind,
              fromType: args.from_type,
              fromId: args.from_id,
              toType: args.to_type,
              toId: args.to_id,
            }),
          }),
        );

      default:
        return { text: `Unknown tool: ${name}`, isError: true };
    }
  } catch (err) {
    // Surface rejections verbatim — the gates explain themselves, and an agent
    // that sees *why* a claim was refused can fix it. A generic failure can't
    // be acted on.
    return { text: `Error: ${(err as Error).message}`, isError: true };
  }
}
