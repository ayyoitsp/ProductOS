/**
 * ⛔ AGENTS ARE DEFINED BY THE QUESTION THEY ANSWER ABOUT THE WHOLE SYSTEM — not by which files
 * they are allowed to touch.
 *
 * I first split these by layer: one owner for the schema, one for the renderer, one for the checks.
 * Peter: "i'm not sure if 'by job' was correct. each agent should understand the context of what
 * they're supposed to do, like an agent that validates everything is consistent, agent that
 * validates test coverage is there, etc."
 *
 * He is right, and the reason is the failure this whole design exists to stop. Splitting by layer
 * fragments responsibility: the schema owner adds a field, the renderer owner shows it, the check
 * owner detects it — and NOBODY owns "is this concept actually present everywhere it needs to be",
 * which is the exact question that went unasked four times in a row. Consistency is a property of
 * the whole; an agent scoped to a slice cannot see it by construction.
 *
 * So there are two different things in this file and they must not be confused:
 *
 *   AREAS  — the map of the system. Where things live, and which layers a change must reach.
 *            Territory, not ownership. An agent reads this to know where to look.
 *   AGENTS — one per concern, each answering a question that spans the whole map, each carrying
 *            the context it needs to answer it and the thing it must never do.
 *
 * ⛔ NO AGENT NAMES A MODEL. The model is the consumer's choice, per agent, read from their config
 * at install time by an adapter. And an agent declares CAPABILITIES, not tools — `ask-the-human`
 * rather than `AskUserQuestion` — so the spec is portable and the adapter maps the need onto
 * whatever the host offers, refusing to install an agent whose needs the host cannot meet rather
 * than shipping one that fails halfway through.
 */

/** What a job needs of its host, in terms no host owns. */
export const CAPABILITIES = [
  "read-files",
  "run-commands",
  "search-files",
  /** Put a question to a person and wait. A host without this cannot run a job that settles truth. */
  "ask-the-human",
  /** Write into a corpus. ⛔ Only two jobs have it, and neither judges. */
  "write-corpus",
  /** Read a URL — the newcomer reads a published corpus the way anybody would. */
  "fetch-url",
  /** Show a person a rendered page. */
  "show-a-page",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/**
 * The layers a change can land in. ⛔ These are the cascade's destinations: `kind` on a change
 * record resolves to a set of these, and each one is verified by running something.
 */
export const LAYERS = [
  /** Can the model say it at all. */
  "model",
  /** What is computed, inherited, gated, stamped. */
  "derive",
  /** How output is produced from a source. */
  "generate",
  /** Where a person sees it and acts on it. */
  "surface",
  /** Whether its absence is detectable. */
  "check",
  /** Whether a future session will write it. ⛔ The most-missed, four times over. */
  "instruct",
  /** Whether any of it is pinned. */
  "pin",
] as const;
export type Layer = (typeof LAYERS)[number];

export interface Area {
  name: string;
  /** One line: what this job is for. */
  does: string;
  /**
   * ⛔ THE DEFINING FIELD. What this job must never do, in the words a prompt would use. Splitting
   * by job is worth doing only because these differ; a job with no prohibition is a job that has
   * not been thought about.
   */
  never: string[];
  /** Layers this job owns. Every layer is owned exactly once across all jobs. */
  owns: Layer[];
  /** Source files this job owns, relative to the repo root. Every framework file owned once. */
  files: string[];
  needs: Capability[];
  /**
   * Whether this job is a judge — it reads and reports and writes nothing.
   *
   * ⛔ Judges are run as separate agents on purpose: an author cannot review their own work, and
   * after a few exchanges there is no reader left in the session who has not been told the answer.
   */
  judges?: boolean;
  /** Where its prompt lives. Absent means the prompt has not been written yet, and that is said out loud. */
  prompt?: string;
}

/**
 * ⛔ THE MAP, NOT A DIVISION OF LABOUR. These are the parts of the system and the layers each one
 * holds, so an agent asking "is this concept everywhere it should be" knows where everywhere is.
 * Nobody is assigned to an area; areas are read.
 */
export const AREAS: Area[] = [
  {
    name: "model",
    does: "Decide whether the model can say a thing, and add the field when it cannot",
    never: [
      "render anything — a field that only the renderer knows about is a field no packet carries",
      "touch a corpus: a schema change proved by hand-editing one corpus is proved nowhere",
      "make a field required on the day it lands — a schema change nobody can adopt gets reverted",
    ],
    owns: ["model"],
    files: ["src/v2/schema.ts", "src/v2/load.ts", "src/v2/ref.ts"],
    needs: ["read-files", "run-commands", "search-files"],
  },
  {
    name: "derive",
    does: "Compute what follows from the truth — inheritance, gates, stamps, what is still owed",
    never: [
      "show anything: a number computed here and a number computed in a surface are two answers to one question",
      "let a second implementation of a predicate exist — gateFor diverged from check by one clause and made two of five seed exchanges permanently un-acceptable",
      "treat a deferral as an answer",
    ],
    owns: ["derive"],
    files: ["src/v2/grid.ts", "src/v2/stamp.ts", "src/v2/settle.ts", "src/v2/acts.ts", "src/v2/record.ts"],
    needs: ["read-files", "run-commands", "search-files"],
  },
  {
    name: "generate",
    does: "Produce output from a source — a corpus from a v1 tree, a screen from a component",
    never: [
      "invent: an input it cannot read becomes a marked placeholder, never a guess",
      "drop what it cannot carry silently — it goes to not-carried.yaml, by name",
      "be replaced by hand-authoring. If the output is wrong, the generator is wrong",
    ],
    owns: ["generate"],
    files: ["src/v2/migrate.ts", "src/v2/draw.ts", "src/v2/draw-write.ts", "src/v2/appcss.ts"],
    needs: ["read-files", "run-commands", "search-files", "write-corpus"],
  },
  {
    name: "surface",
    does: "Put truth in front of a person and offer them the acts they are entitled to",
    never: [
      "derive: ask the derive layer rather than computing a second answer",
      "offer an act the gate has not allowed — an enabled-looking button that records nothing is worse than no button",
      "show a filename, a table name or a branch name. The hosted service has no files",
    ],
    owns: ["surface"],
    files: ["src/v2/page.ts", "src/v2/serve.ts", "src/v2/packet.ts", "src/v2/notes.ts", "src/v2/watch.ts", "src/v2/write.ts", "src/cli/commands/v2.ts", "src/mcp/v2-tools.ts"],
    needs: ["read-files", "run-commands", "show-a-page"],
  },
  {
    name: "instruct",
    does: "Tell a future session what to write — the authoring instructions",
    never: [
      "assume a concept is documented because the schema supports it",
      "describe a field without showing the key an author actually types",
    ],
    owns: ["instruct"],
    files: ["skills"],
    needs: ["read-files", "search-files"],
  },
  {
    name: "pin",
    does: "Hold each defect shut — the tests",
    never: [
      "assert on flattened text, or on the property a script just set",
      "pin a rendering claim that was never rendered",
    ],
    owns: ["pin"],
    files: ["test"],
    needs: ["read-files", "run-commands"],
  },
  {
    name: "check",
    does: "Make the absence of something detectable, and say what to do about it",
    never: [
      "fix anything — a detector that repairs its own finding hides how often it fires",
      "report without a fix an author can act on: that moves the problem into a backlog rather than into the model",
      "refuse what a corpus can legitimately be mid-authoring. A note that blocks a handover is a note nobody keeps",
    ],
    owns: ["check"],
    files: ["src/v2/check.ts"],
    needs: ["read-files", "run-commands", "search-files"],
  },
];


/**
 * ⛔ ONE AGENT PER CONCERN, AND THE CONCERN IS A QUESTION ABOUT THE WHOLE.
 *
 * Each of these exists because something went wrong that no slice-scoped reviewer could have seen.
 * The `asks` field is the agent's whole reason to exist, in the form a person would put it; the
 * `reads` field is the context it must load before it can answer, because an agent that answers
 * from a file list gives a file-list answer.
 */
export interface Agent {
  name: string;
  /** The question it answers. ⛔ One question. An agent with two is two agents. */
  asks: string;
  /** Why this question needs asking — the failure it exists to catch. */
  because: string;
  /** What it must load to answer, in the order it should. */
  reads: string[];
  /** What counts as a finding, so it reports defects rather than opinions. */
  finds: string[];
  never: string[];
  needs: Capability[];
  /** true = reads and reports, writes nothing. Every agent here is one; authoring is not review. */
  judges: true;
  /** Where its prompt lives, or absent if it has not been written — said out loud rather than implied. */
  prompt?: string;
}

export const AGENTS: Agent[] = [
  {
    name: "consistency",
    asks: "Is every concept present in every layer it needs to be, or does it exist in one and nowhere else?",
    because:
      "Four times in one session a concept was added to the schema and shown in the renderer while the " +
      "skill was never told, so every future session kept writing the old shape. And `preview` did not " +
      "know a ref that `perform` did, so the surface that shows somebody what they are about to agree " +
      "to refused the one act the feature waits on. No layer-scoped reviewer can see either: both are " +
      "properties of the whole.",
    reads: [
      "src/core/jobs.ts — the map of areas and layers, to know what everywhere means",
      "src/v2/schema.ts — every field an author writes",
      "skills/ — whether each field is named as something to write",
      "src/v2/check.ts — whether its absence is detectable",
      "src/v2/page.ts and src/v2/packet.ts — whether it is shown where a person decides",
      "test/ — whether any of it is pinned",
    ],
    finds: [
      "a schema field no skill tells anyone to write",
      "a concept the renderer shows and no check can detect the absence of",
      "two implementations of one predicate — the gateFor/check divergence shape",
      "a ref grammar one surface knows and another refuses",
      "a field carried by the migrator and dropped by the generator, or the reverse",
    ],
    never: ["write anything", "fix what it finds — a reviewer that repairs hides how often it fires"],
    needs: ["read-files", "search-files", "run-commands"],
    judges: true,
  },
  {
    name: "coverage",
    asks: "Is each defect and each behaviour pinned by something that fails on its own?",
    because:
      "Every bug in this repo was found by a person and prevented by a test written afterwards — and " +
      "the ones with no test came back. A backtick inside a template literal broke the build six times " +
      "while two prose warnings sat above it. What a suite does not assert is what regresses.",
    reads: [
      "test/ — what is asserted, and at what grain",
      "git log — the defects that have actually happened here",
      "src/v2/check.ts — every finding, and whether each is exercised",
      "src/v2/acts.ts — every refusal, and whether each is provoked by a test",
    ],
    finds: [
      "a finding in check.ts that no test provokes",
      "a refusal in acts.ts that nothing asserts",
      "a test asserting on flattened text, or on the property a script just set, rather than on what a reader sees",
      "a rendering claim no test ever rendered",
      "a fixed defect with no test named after it",
    ],
    never: ["write tests itself — it reports the hole; closing it is authoring", "count tests as a measure of anything"],
    needs: ["read-files", "search-files", "run-commands"],
    judges: true,
  },
  {
    name: "generated",
    asks: "Is anything in a corpus hand-authored that a generator should have produced?",
    because:
      "The single most-repeated mistake here, and the one Peter has objected to four times in capitals. " +
      "A typed artefact cannot be re-derived when its source changes, so it is wrong the day after it is " +
      "written and nothing says so — and when somebody reports it wrong, typing it again is always the " +
      "shortest path.",
    reads: [
      "src/v2/draw.ts and src/v2/migrate.ts — what CAN be generated",
      "the corpus under review — what is actually in it",
      "git log on the corpus — whether a change came from a command or from an editor",
    ],
    finds: [
      "a sketch_html a generator could have produced",
      "a corpus file changed in a commit that changed no generator",
      "a value in a corpus that restates something derivable from the code",
      "a generated artefact that has not been regenerated since its source changed",
    ],
    never: ["regenerate anything itself", "treat legitimate authoring — a claim, a question, a purpose — as a generated artefact"],
    needs: ["read-files", "search-files", "run-commands"],
    judges: true,
  },
  {
    name: "truthfulness",
    asks: "Does the corpus say what the code actually does?",
    because:
      "Both tenets rest on this and nothing checks it. A corpus can be internally perfect, fully agreed, " +
      "and describe a product that does not exist — and the only surface that would notice is somebody " +
      "reading both, which nobody does.",
    reads: [
      "the corpus under review — every claim",
      "the codebase it describes — the routes, the components, the handlers",
      "productos/config.yaml — where the code is",
    ],
    finds: [
      "a claim the code contradicts",
      "a behaviour the code exhibits that no claim mentions",
      "a screen the corpus draws that the application does not have, or the reverse",
      "a happy path whose stated outcome the code does not produce",
    ],
    never: [
      "write anything — it reports the disagreement and names both sides",
      "change the corpus to match the code: the code may be the thing that is wrong, and deciding which is a person's call",
      "assume the code is right",
    ],
    needs: ["read-files", "search-files", "run-commands"],
    judges: true,
  },
  {
    name: "newcomer",
    asks: "Could a PM handed this and told to build from it actually do it?",
    because:
      "By the time you have written a corpus you know what it meant to say, so your reading of it is " +
      "worth nothing as evidence that it communicates.",
    reads: ["the published corpus, at its URL, and nothing else"],
    finds: ["what they could not do", "what they could not tell", "where they had to guess"],
    never: [
      "be told what ProductOS is — a reviewer told what a capability is can no longer detect that the corpus failed to say",
      "read OVERVIEW, GLOSSARY, EXAMPLE, the skills or the source",
      "write anything",
    ],
    needs: ["fetch-url", "read-files"],
    judges: true,
    prompt: "agents/productos-newcomer.md",
  },
  {
    name: "architecture",
    asks: "Are these the right subsystems, with the right boundaries, and would it work?",
    because: "The system half of a corpus has no natural reviewer — PRDs stop below it and design docs start above it.",
    reads: ["the capability half of the corpus", "what each capability promises and who depends on it"],
    finds: ["machinery referenced and owned by nothing", "a boundary in the wrong place", "a subsystem that is one promise wearing a subsystem's clothes"],
    never: ["write anything", "judge whether the product is ready to build — that is a different question"],
    needs: ["read-files", "search-files", "run-commands", "fetch-url"],
    judges: true,
    prompt: "agents/productos-architect.md",
  },
  {
    name: "sufficiency",
    asks: "Can this model express a real product, and can a person actually review what it produces?",
    because:
      "This is the agent that should have said 'there is nowhere to state what a feature is for' and " +
      "'nothing can tell a thin drawing from a complete one' before Peter did. It was never run against " +
      "the Exchange model — the v2 skill references no agent at all.",
    reads: ["the model's own definitions", "a real corpus written in it", "what the surfaces show a reviewer"],
    finds: [
      "something a real product needs to say that the model cannot",
      "a distinction the model forces that products do not make",
      "a judgement a reviewer is asked for that they have no basis to make",
    ],
    never: ["write anything", "judge whether one particular product is ready"],
    needs: ["read-files", "search-files", "run-commands"],
    judges: true,
    prompt: "agents/productos-framework.md",
  },
];

/** ⛔ Said out loud rather than implied: which agents exist as a prompt and which are named only here. */
export const unwritten = (): Agent[] => AGENTS.filter((a) => !a.prompt);

/** Which job owns a layer. ⛔ Exactly one, or the partition is broken. */
export function areaOf(layer: Layer): Area | undefined {
  return AREAS.find((a) => a.owns.includes(layer));
}

/**
 * The layers a change of each kind must reach.
 *
 * ⛔ THIS IS THE CASCADE, AND IT IS A TABLE RATHER THAN A JUDGEMENT. "Which layers does this need
 * to touch" answered from memory is answered differently every time, and the answer that gets
 * skipped is always `instruct` — which is why a concept can be perfect in the schema and written by
 * nobody. Deriving it from the kind of change means the routing happens before anyone has a chance
 * to feel finished.
 */
export const CASCADE: Record<string, Layer[]> = {
  /** A new thing the model can say. */
  concept: ["model", "surface", "check", "instruct", "pin"],
  /** A change to what is computed, inherited or gated. */
  derivation: ["derive", "surface", "check", "pin"],
  /** A change to how something is shown or offered. */
  surface: ["surface", "pin"],
  /** A change to how output is produced. */
  generator: ["generate", "pin"],
  /** A change to how a future session must work. */
  instruction: ["instruct", "pin"],
};
export const KINDS = Object.keys(CASCADE);
