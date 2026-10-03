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
/**
 * ⛔ A TYPE FROM THE MODEL, because the stages a route runs at are the stages a feature HAS. Two
 * enumerations of them — one for the routing table and one for the truth — is how a route comes to
 * gate on a stage no feature can ever be at.
 */
import type { Stage } from "../v2/schema.js";


/**
 * ⛔ WHO WOULD HAVE DONE THIS, IN A TEAM THAT HAD PEOPLE.
 *
 * Peter: *"i'm not convinced we have the right roles. I'd rather build around 'traditional' roles
 * first — product manager, engineer, designer, QA — and then break the roles down within those.
 * doesn't need to be formalized, but we should be able to describe the roles based on who would
 * have done each task."*
 *
 * Thirteen roles, and no way to see whether that was a team or a list. Laying them out by the seat
 * a person would have sat in is what made the holes visible — nobody asked whether a screen was any
 * GOOD, whether a feature could be BUILT as written, or whether a criterion would DEMONSTRATE its
 * claim rather than merely pass. None of those three was findable by reading the roles one at a time.
 *
 * ⛔ A DESCRIPTION, NOT A PERMISSION SYSTEM. Nothing is gated on it, and it is not a hierarchy.
 * What it buys is being able to look at the registry and see a team with holes in it.
 *
 * ⛔ "THE FRAMEWORK ITSELF" IS A SEAT, AND THE DISTINCTION IS NOT WHAT IT FIRST LOOKS LIKE.
 * Two reviewers here do not review anybody's product; they review ProductOS. Peter, on the first
 * attempt to sort them: *"consistency shouldn't be product OS only — we need to make sure the
 * product truth is consistent itself, why is that product OS itself? same as sufficiency."*
 *
 * He is right about the QUESTIONS and the answer is not a reclassification:
 *
 *   — Asking whether a CORPUS contradicts itself was a job nobody held. `consistency` reads only
 *     `src/` paths; it cannot see a corpus at all. So `coherence` was added rather than the other
 *     one relabelled, because moving it would have left the layer-skipping failure unwatched to
 *     cover a gap, and traded one blind spot for another.
 *   — Asking whether a corpus is sufficient to build from is `newcomer`, and always was. What was
 *     wrong was the NAME: "sufficiency" claimed that ground while asking about the model. Two roles
 *     whose names claim the same question is how one of them stops being run.
 */
export const DISCIPLINES = ["product", "design", "engineering", "quality", "the framework itself"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

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
  /**
   * ⛔ LOOK AT A RUNNING PRODUCT — drive a browser and see what comes back.
   *
   * Peter: *"we should have an agent that can view our actually rendered site and match up the UX"*
   * and *"the designer agent should be able to look at existing sites and a design system to put
   * together the screens"*.
   *
   * Every role here has read the product by reading its SOURCE. That is enough to know what a
   * component does and not enough to know what it looks like — which is the whole question when the
   * job is drawing a screen or saying whether a drawing matches the thing it describes. A corpus
   * can be perfectly faithful to the code and describe a layout nobody would recognise.
   *
   * ⛔ Distinct from `fetch-url`, which brings back markup. This is rendering: a page as a person
   * would meet it, with its own CSS applied and its own JavaScript run.
   */
  "see-a-page",
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
  /**
   * Whether the running instance can be updated, restarted, and put back.
   *
   * ⛔ ADDED BECAUSE A REAL CHANGE COULD NOT BE ROUTED. Backup and restore for the managed store
   * landed in the Makefile, and the Makefile was on nobody's map — so the only kind that fit was
   * `generator`, whose files are the corpus generators, and the only way to close the record was to
   * waive a layer that had actually been reached. The repo ships a hosted instance now; operating
   * it is a layer of this system, not a detail beneath it.
   */
  "operate",
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
    /**
     * ⛔ `core/jobs.ts` AND `core/change.ts` ARE ON THE MAP TOO. They were not, and the coverage
     * test that makes the map trustworthy only walks `src/v2` — so the file that implements the map
     * was the one place it did not cover, which a reviewer caught immediately.
     */
    files: [
      "src/v2/schema.ts",
      "src/v2/load.ts",
      "src/v2/ref.ts",
      "src/core/jobs.ts",
      "src/core/change.ts",
      /**
       * ⛔ WHAT A PROJECT CAN SAY ABOUT ITSELF IS PART OF THE MODEL, AND IT WAS ON NOBODY'S MAP.
       *
       * A design system with four schemes and nothing in the model naming which one the product
       * ships is a field that does not exist — so every drawing rendered in the fallback colours,
       * for weeks, with no layer anywhere able to ask the question. Peter: *"the rendered style for
       * bilrost currently at localhost:7878 doesn't match at all"*. The same argument the surface
       * list already makes for `src/ui/server.ts`: a file missing from the map is a place no
       * reviewer will look.
       */
      "src/core/config.ts",
      /**
       * ⛔ AND THE STORE'S OWN SHAPE, WHICH WAS ON NOBODY'S MAP EITHER.
       *
       * Peter, on the hosted instance: *"i mean we're adding a feature, don't we need a schema
       * change to support it?"* The answer is in this file — a corpus document is a ROW, so a new
       * kind of document needs no DDL — and nothing on the map pointed at it, so the question had
       * no home to be answered from. A whole subsystem absent from the map is a subsystem every
       * reviewer asking "is this concept present everywhere" will silently skip.
       */
      "src/v2/store/schema.ts",
    ],
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
    /**
     * ⛔ `adapters/claude.ts` DERIVES, and what it derives is a guarantee rather than a number: an
     * agent's tool list from the capabilities it declares. That is where "a judge never gets a
     * writing tool" and "an author is never handed a question" are enforced rather than hoped, and
     * it was on no area — so the file holding two of the model's load-bearing refusals was one no
     * reviewer would think to open.
     */
    files: [
      "src/v2/grid.ts",
      "src/v2/stamp.ts",
      "src/v2/settle.ts",
      "src/v2/acts.ts",
      "src/v2/record.ts",
      "src/v2/spoken.ts",
      "src/v2/connects.ts",
      "src/v2/steers.ts",
      /**
       * ⛔ AUTHORIZATION IS A GATE, AND THESE ARE WHERE IT IS DECIDED. `storeFor(db, who).project(id)`
       * is the only route to a document and it authorizes first; `identity.ts` is what a principal
       * is at all. They belong beside `gateFor` for the same reason `adapters/claude.ts` does — the
       * guarantee is enforced here rather than hoped for, and a reviewer asked whether a rule holds
       * everywhere needs to be sent to the file that holds it.
       */
      "src/v2/store/access.ts",
      "src/v2/store/identity.ts",
      /** ⛔ Reading the record of what was corrected is a derivation over it, and writes nothing. */
      "src/core/learn.ts",
      "src/adapters/claude.ts",
    ],
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
    /**
     * ⛔ `core/agents-doc.ts` GENERATES TOO, AND WAS ON NO AREA AT ALL.
     *
     * It produces AGENTS.md and the preset block inside every skill — both from the registry, both
     * with a test asserting the committed copy has not drifted. A generator missing from the map is
     * a generator no reviewer will look at, which is the exact failure `core/jobs.ts` and
     * `core/change.ts` were added here to stop.
     */
    files: [
      "src/v2/migrate.ts",
      "src/v2/draw.ts",
      "src/v2/draw-write.ts",
      "src/v2/routes.ts",
      "src/v2/propose.ts",
      "src/v2/appcss.ts",
      "src/core/agents-doc.ts",
      /** ⛔ The design system index: a generator source like `draw`, reading a product's own vocabulary. */
      "src/v2/design.ts",
      /**
       * ⛔ MOVING A CORPUS AND MOVING IT FORWARD ARE BOTH GENERATION. `corpus.ts` turns a directory
       * into rows and back byte-identically; `doc-migrations.ts` rewrites stored documents when the
       * corpus schema moves, which is the one thing in the system that edits truth without a person
       * — it leaves a record for exactly that reason, and a layer nobody reviews is the worst place
       * for that to live. `migrate.ts` and `boot.ts` move the store's own shape forward.
       */
      "src/v2/store/corpus.ts",
      "src/v2/store/doc-migrations.ts",
      "src/v2/store/migrate.ts",
      "src/v2/store/boot.ts",
    ],
    needs: ["read-files", "run-commands", "search-files", "write-corpus"],
  },
  {
    name: "operate",
    does: "Bring an instance up, update it, and get its database back",
    /**
     * ⛔ THIS AREA EXISTS BECAUSE ITS FILES WERE ON NOBODY'S MAP.
     *
     * `rebuild`, `restart`, `backup` and `restore` all reached for a `postgres` container that the
     * managed-store stack does not have — so the four commands you need to update the instance
     * serving the corpus, and to not lose it, could not be run against it. Every one of them read
     * as general and was about the local stack only. Nothing was asked to notice, because no area
     * claimed the Makefile.
     */
    never: [
      "name a command for one stack as though it serves both — a target that assumes a container reads as general and silently is not",
      "take a connection string in argv: it is a credential, and make echoes its own lines",
      "destroy or replace a store nobody named, or without a confirmation somebody has to type",
      "report success for a dump that is empty, or that cannot replace a schema already there",
    ],
    owns: ["operate"],
    files: ["Makefile", "Dockerfile", "docker-compose.yml", "docker-compose.remote.yml", "scripts/"],
    needs: ["read-files", "run-commands"],
  },
  {
    name: "surface",
    does: "Put truth in front of a person and offer them the acts they are entitled to",
    never: [
      "derive: ask the derive layer rather than computing a second answer",
      "offer an act the gate has not allowed — an enabled-looking button that records nothing is worse than no button",
      "show a filename, a table name or a branch name. The hosted service has no files",
      "record that a person agreed on anything but a person's press. A token may author, may land a default as `agent`, and may carry a press somebody made — it may never mint one, and no scope grants that",
      "fall back to a local corpus when an instance cannot be reached. Refuse, and say the truth is elsewhere",
    ],
    owns: ["surface"],
    files: [
      "src/v2/page.ts",
      "src/v2/prototype.ts",
      "src/v2/serve.ts",
      /**
       * ⛔ THE PROCESS THAT HOSTS EVERY SURFACE, AND IT WAS ON NO AREA. `v2Route` is mounted here,
       * the port is bound here, and the one line that told anybody where the page was reachable is
       * here — which is how a corpus naming a real client came to answer the whole network while
       * printing "localhost". A file missing from the map is a place no reviewer will look.
       */
      "src/ui/server.ts",
      /**
       * ⛔ AND THE TREE THAT SERVER LANDS ON. `/` is this renderer; `/v2` is page.ts. One of them
       * was on the map and the other was not, and the one that was not spent months rendering
       * every drawing unstyled — it linked a route that served `web.stylesheet` while the project
       * in front of it set `web.stylesheets`. A reviewer asked whether a concept is present
       * everywhere needs both trees on the list, or "everywhere" means "the half somebody added".
       */
      "src/ui/renderer.ts",
      /**
       * ⛔ THE HOSTED SURFACES, WHICH ARE NOW THE PRODUCT RATHER THAN A PREVIEW OF ONE. `serve.ts`
       * said it first — "`productos serve` is not a preview of a hosted thing, it IS the thing" —
       * and the instance that serves a project, the MCP endpoint a session reaches it through, and
       * the operator CLI that is the only way a corpus gets in were on no area at all. Three
       * surfaces a reviewer would never be sent to.
       */
      "src/v2/store/server.ts",
      "src/v2/store/instance.ts",
      "src/v2/store/mcp.ts",
      "src/v2/store/choose.ts",
      "src/cli/commands/hosted.ts",
      "src/v2/packet.ts",
      "src/v2/notes.ts",
      "src/v2/watch.ts",
      /**
       * ⛔ THE LOOP BELONGS HERE, NOT UNDER THE MODEL. An event is not product truth — it is the
       * record that something happened and that somebody may owe work because of it. What it is
       * for is putting a press in front of whoever can act on it, which is this job exactly.
       */
      "src/v2/log.ts",
      "src/v2/inbox.ts",
      "src/v2/presence.ts",
      /**
       * ⛔ IDENTITY IS A SURFACE CONCERN AND THAT IS THE POINT. Who is asking is decided where a
       * request arrives — not in the model, which has no notion of a request, and not in derive,
       * which would then be computing over a principal. `mayRecord` is the one function the
       * guarantee lives in, and it belongs beside the routes that ask it.
       */
      "src/v2/identity.ts",
      "src/v2/client.ts",
      "src/v2/write.ts",
      "src/v2/wire.ts",
      "src/v2/moved.ts",
      "src/cli/commands/v2.ts",
      "src/mcp/v2-tools.ts",
    ],
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
    /**
     * ⛔ BOTH PLACES A FUTURE SESSION IS TOLD WHAT TO WRITE, AND `agents` WAS MISSING.
     *
     * This was `["skills"]` alone, from when there were eight skills each carrying its own
     * authoring rules. When they became one, those rules moved to the scoper — the only role that
     * writes a scope — and this list did not follow. So for every change since, `change check`
     * looked for the authoring instruction in the one place it is no longer kept, and the only way
     * past was to waive a layer that had actually been reached.
     *
     * ⛔ That is the worse failure of the two: a waiver is supposed to be a decision somebody could
     * argue with, and a waiver for work that was done empties it of meaning everywhere else.
     *
     * Found by the check refusing an instruction I had written into the scoper, which is the
     * cascade catching a hole in its own map.
     */
    files: ["skills", "agents"],
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
  /** ⛔ Whose seat this is. See `DISCIPLINES` — it describes a team, it does not gate anything. */
  discipline: Discipline;
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
    discipline: "the framework itself",
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
    prompt: "agents/productos-consistency.md",
  },
  {
    name: "coverage",
    discipline: "quality",
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
    prompt: "agents/productos-coverage.md",
  },
  {
    /**
     * ⛔ WAS CALLED `generated`, WHICH NAMED NOTHING. Peter: *"not sure what generated even is?"* —
     * about the reviewer that catches somebody TYPING a screen a command should have produced,
     * which is the single most-repeated mistake in this project's history. A reviewer whose name
     * does not say what it asks is a reviewer nobody thinks to run.
     *
     * ⛔ And it reviews a CORPUS, not us: its sources are the corpus and that corpus's git log.
     * It was briefly filed under the framework, which would have aimed it at the wrong repository.
     */
    name: "hand-authored",
    discipline: "quality",
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
    prompt: "agents/productos-hand-authored.md",
  },
  {
    name: "truthfulness",
    discipline: "engineering",
    /**
     * ⛔ THIS ASKED "does the corpus say what the code actually does?" AND THAT MADE THE CODE THE
     * STANDARD.
     *
     * It was the only explicit statement anywhere about how the corpus and the codebase relate, so
     * in the absence of the target-state principle it became the definition: a session inherited it
     * and shipped a check that refused any screen not drawn from a component.
     *
     * The corpus is the TARGET. Where it and the code disagree, that is drift, and which one is
     * wrong is a person's call — usually the code, since the corpus is what should be built. So this
     * reviewer reports the disagreement and never adjudicates it.
     */
    asks: "Where does what was built disagree with the target the corpus describes?",
    because:
      "Both tenets rest on knowing this and nothing checks it. A corpus can be internally perfect, " +
      "fully agreed, and have drifted from what shipped — and the only surface that would notice is " +
      "somebody reading both, which nobody does. ⛔ A disagreement is NOT a corpus defect: the corpus " +
      "is the target, so the usual resolution is that the code has not caught up. Report the gap and " +
      "let a person say which side moves.",
    reads: [
      "the corpus under review — every claim",
      "the codebase it describes — the routes, the components, the handlers",
      "productos/config.yaml — where the code is",
    ],
    finds: [
      "a claim the built product contradicts — which may mean the code is behind, not that the claim is wrong",
      "a behaviour the code exhibits that no claim mentions",
      "a screen the corpus calls for that the application does not have, or a screen it has that no truth describes",
      "a happy path whose stated outcome the code does not produce",
    ],
    never: [
      "write anything — it reports the disagreement and names both sides",
      "change the corpus to match the code: the code may be the thing that is wrong, and deciding which is a person's call",
      "assume the code is right",
    ],
    needs: ["read-files", "search-files", "run-commands"],
    judges: true,
    prompt: "agents/productos-truthfulness.md",
  },
  {
    name: "newcomer",
    discipline: "product",
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
    discipline: "engineering",
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
    /**
     * ⛔ WAS CALLED `sufficiency`, WHICH READ AS A QUESTION ABOUT A CORPUS. It is a question about
     * the MODEL — whether this thing can express a real product at all. "Is this corpus sufficient
     * to build from" is what `newcomer` asks, from a seat that has never read our source.
     */
    name: "can-the-model-say-it",
    discipline: "the framework itself",
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
    prompt: "agents/productos-can-the-model-say-it.md",
  },
  {
    name: "completeness",
    discipline: "product",
    asks: "Can somebody get from the start of this feature to the end of it, or does the path stop somewhere?",
    because:
      "Peter found two dead ends by hand, one after the other, on a corpus all seven other reviewers " +
      "would have passed: a folder step with no way out, then a folder step with no way on. Every " +
      "existing reviewer looks at the PARTS — is the concept everywhere, is the claim pinned, could " +
      "a PM build this screen. A PM can build a screen that goes nowhere, because the screen is " +
      "fully described. Nobody was looking at the path, and a feature whose steps are each correct " +
      "and do not join up is a feature nobody can use.",
    reads: [
      "each scope's happy path — what it says somebody accomplishes, and the screens it passes through",
      "those screens in order: what a person has when they arrive, and which control takes them on",
      "where each control leaves somebody — the `answer` and `after` of the exchange it performs",
      "the prototype as rendered, because a path that is described and not walkable is the failure",
    ],
    finds: [
      "a screen in the happy path with no control that leads to the next one",
      "a state a control puts somebody in with no way out of it",
      "a happy path whose last screen does not reach what `ends_with` claims",
      "a step that needs something no earlier step gives somebody",
      "a screen reachable only by pressing a tab a real product would not have",
      "a feature whose screens are each fully described and do not join into anything",
    ],
    never: [
      "write anything, or fix a path it finds broken",
      "treat a missing step as an authoring mistake without saying so — a path that cannot be expressed is ours, and the two need different people",
      "judge whether the destination is the RIGHT destination — that is a product decision, and this asks only whether somebody can get there",
    ],
    needs: ["read-files", "search-files", "run-commands"],
    judges: true,
    prompt: "agents/productos-completeness.md",
  },
  {
    name: "rendered",
    discipline: "design",
    asks: "Does the drawing match the product a person actually sees?",
    because:
      "Every reviewer here reads SOURCE. `truthfulness` compares the corpus against the code, which " +
      "catches a screen describing behaviour the code does not have — and passes a screen that is " +
      "faithful to the code and looks nothing like the running product. A drawing is the one artefact " +
      "in this model whose correctness is visual, and nothing had ever looked at it beside the thing " +
      "it claims to depict. Peter: *\"we should have an agent that can view our actually rendered " +
      "site and match up the UX\"*.",
    reads: [
      "productos/env.yaml, and whatever it says brings this product up",
      "the running product, screen by screen, as a person meets it",
      "the same screens on the ProductOS page, drawn",
      "what the corpus says is on each — the parts, and what the exchanges promise",
    ],
    finds: [
      "a drawing showing a state the product never opens on — a loading or empty branch drawn as the screen",
      "a control the product has and the drawing does not, or the reverse",
      "a label that differs between the two: the drawing says Continue and the product says Next",
      "a layout the drawing invents — fields in an order the product does not use, a step that is one screen in the product and two in the drawing",
      "a screen the corpus calls intended that the product already has",
      "⛔ a drawing that matches the code and not the product — the gap no source-reading reviewer can see",
    ],
    never: [
      "write anything, or correct a drawing it finds wrong",
      "treat a difference as the CORPUS being wrong — product truth is the target state, and the product being different is drift, which is a finding about the build",
      "judge whether the design is good. It asks whether the drawing depicts the product, never whether either is attractive",
      "report a difference it could not see — if the environment would not come up, say that instead",
    ],
    needs: ["read-files", "search-files", "run-commands", "see-a-page"],
    judges: true,
    prompt: "agents/productos-rendered.md",
  },
  /**
   * ⛔ THE FOUR BELOW WERE FOUND BY LAYING THE OTHERS OUT BY SEAT, AND NOT BEFORE.
   * Each one is a question somebody on a real team asks every week and nothing here asked once.
   */
  {
    name: "coherence",
    discipline: "product",
    asks: "Does this corpus contradict itself?",
    because:
      "Peter: *\"we need to make sure the product truth is consistent itself\"* — and nothing did. " +
      "`consistency` asks the same question about ProductOS and reads only our source; it cannot " +
      "open a corpus. So a corpus could promise a thing on a feature page and refuse it on the " +
      "screen that holds it, use one word for two concepts, or carry a rule contradicting a " +
      "statement, and every check would pass: each file is individually well-formed, and " +
      "contradiction is a property of the pair. ⛔ The author is the worst possible person to " +
      "notice, because they know which of the two they meant.",
    reads: [
      "every scope in the corpus — a contradiction is never visible from one",
      "the vocabulary across all of them — the same word, and whether it means the same thing twice",
      "each statement against the rules and criteria said to govern it",
      "what each screen promises against what the feature holding it claims",
    ],
    finds: [
      "two scopes promising different things about the same screen or the same entity",
      "one term carrying two meanings, or two terms carrying one — the first is worse",
      "a rule that forbids what a statement elsewhere asserts",
      "a criterion that would pass while the claim above it is false",
      "an exchange whose refusal contradicts another exchange's happy path",
    ],
    never: [
      "write anything",
      "⛔ decide which side of a contradiction is correct — report both and who must choose",
      "report a difference between target state and built code — that is drift, and truthfulness holds it",
    ],
    needs: ["read-files", "search-files", "run-commands"],
    judges: true,
    prompt: "agents/productos-coherence.md",
  },
  {
    name: "design-critique",
    discipline: "design",
    asks: "Is this the right screen for what it has to do?",
    because:
      "Nothing here has ever asked whether a screen is any GOOD. `rendered` looks at pictures and " +
      "explicitly refuses this — it asks only whether the drawing matches the built product, so a " +
      "faithful drawing of a bad screen passes it cleanly. `completeness` asks whether a path ends, " +
      "which a terrible flow can also satisfy. A corpus is supposed to be sufficient to build from; " +
      "building the wrong screen from a clear description is still the wrong screen.",
    reads: [
      "the screens of one feature, in the order somebody meets them",
      "what each one is for, and what it asks a person to do or decide",
      "the design system, so a critique names the part that exists rather than inventing one",
      "the other screens of this product that do a comparable job",
    ],
    finds: [
      "a screen asking for something it already knows, or could decide itself",
      "a decision put to somebody who has not been shown what it costs",
      "two screens where the work would fit on one, or one carrying what needs two",
      "a control whose outcome a person cannot predict before pressing it",
      "a pattern invented here that this product already solves elsewhere, differently",
      "⛔ an empty, error or loading state the screen must have and does not",
    ],
    never: [
      "write anything",
      "⛔ restyle — this is about whether the screen is right, never about taste in colour or spacing",
      "⛔ object that no component renders it: a screen the product SHOULD have is the target state",
    ],
    needs: ["read-files", "search-files", "run-commands", "see-a-page"],
    judges: true,
    prompt: "agents/productos-design-critique.md",
  },
  {
    name: "buildability",
    discipline: "engineering",
    asks: "Could somebody start on this on Monday, and what would surprise them?",
    because:
      "⛔ The second tenet is that product truth must be sufficient to build from without " +
      "interpretation, and nobody checked it from a builder's seat. `newcomer` comes closest and " +
      "is a product manager — it catches what a corpus fails to EXPLAIN, not what it fails to " +
      "DECIDE. The gap between those is every question that only appears once somebody tries: " +
      "where the data comes from, what happens to work in progress, which of two screens owns a " +
      "piece of state. Each is cheap to answer now and expensive to discover mid-implementation, " +
      "where it gets answered by whoever is typing.",
    reads: [
      "one feature, as somebody who has to implement it and may not ask the author",
      "every screen's controls, and what each is said to commit",
      "what the feature says it depends on, and whether that thing says the same",
      "the criteria, as the definition of done they would be held to",
    ],
    finds: [
      "a decision the corpus leaves to whoever implements it, without saying it is theirs to make",
      "a state change with no stated source of truth, or two screens both claiming it",
      "a failure that would certainly happen and is not described — ⛔ offline, concurrent edit, half-finished work",
      "a criterion that cannot be demonstrated without inventing a fact the corpus does not supply",
      "an ordering or permission assumption that is load-bearing and unwritten",
    ],
    never: [
      "write anything",
      "⛔ estimate, or argue the scope is too large — the question is whether it is BUILDABLE, not whether it is cheap",
      "⛔ treat 'no code exists yet' as a finding: a corpus may never require code to exist",
      "⛔ ask for implementation detail — how it gets built is the builder's, and demanding it is the opposite of this job",
    ],
    needs: ["read-files", "search-files", "run-commands"],
    judges: true,
    prompt: "agents/productos-buildability.md",
  },
  {
    name: "test-design",
    discipline: "quality",
    asks: "Would this criterion actually show the claim holding — or would it just pass?",
    because:
      "⛔ `coverage` asks whether a claim HAS something attached and `evidencer` finds what to " +
      "attach; neither reads the criterion to see whether it would demonstrate anything. A test " +
      "named createsDeal that asserts a mock was called satisfies both of them and proves nothing " +
      "about the product. This is the one way the two tenets can both be met on paper by a corpus " +
      "that is worthless: a human validated it, it is clear enough to build from, and every claim " +
      "is pinned by something that cannot fail.",
    reads: [
      "each claim, and the criteria said to show it",
      "what the criterion actually asserts, and against what",
      "the claim's own wording, to see whether the assertion is about the same thing",
      "what the feature refuses or fails at — the cases a happy-path criterion will never reach",
    ],
    finds: [
      "a criterion that asserts a call happened rather than an outcome being true",
      "a criterion that cannot fail — true whatever the product does",
      "a criterion narrower than the claim above it, so the claim is only partly shown",
      "⛔ a claim about refusing or failing, shown only by a criterion that succeeds",
      "a criterion whose setup assumes the thing it is meant to establish",
    ],
    never: [
      "write anything, including a better criterion — ⛔ naming the defect is the output",
      "run the tests — this is about what a criterion would SHOW, not whether it currently passes",
      "⛔ report a missing criterion: that is coverage's question, and reporting it here hides this one",
    ],
    needs: ["read-files", "search-files", "run-commands"],
    judges: true,
    prompt: "agents/productos-test-design.md",
  },
];

/**
 * ⛔ THE ONE QUESTION NOBODY WAS ASKING, FOUND BY A PERSON WALKING INTO IT TWICE.
 *
 * Peter: *"one of our agents most assuredly should check that the happy path is 'complete'. this
 * most certainly isn't."* He is right, and the evidence is how he found out: by pressing Continue
 * on a prototype, reaching the folder step, and having nowhere to go. Twice in one session — a dead
 * end, then a screen he could not get past.
 *
 * Seven reviewers, and every one of them would have passed that corpus. `consistency` asks whether
 * a concept reaches every layer. `coverage` asks whether each claim is pinned. `truthfulness` asks
 * where the build disagrees with the target. `newcomer` asks whether a PM could build from it — and
 * a PM CAN build a folder step that goes nowhere, because the screen is fully described. Each of
 * them looks at the parts. Nobody was looking at the path.
 *
 * ⛔ COMPLETENESS IS A PROPERTY OF THE WHOLE FEATURE, WHICH IS WHY IT NEEDS AN AGENT. A check can
 * ask whether each step leads to the next — and one now does. It cannot ask whether the sequence
 * adds up to the thing the happy path claims somebody accomplishes, because that is a reading of
 * what the product is for against what the screens actually let somebody do.
 */
/**
 * ⛔ THE AUTHORS — AND THEY ARE A SEPARATE REGISTRY, NOT A FLAG ON THE ONE ABOVE.
 *
 * Peter: *"we should model them as subagents, that the skills are shims into.."*
 *
 * Before this, authoring was the one job with no role behind it. Eight skills did it, all in the
 * main session, serially — so the first pass over a codebase was one context grinding through
 * thirty features while five reviewers stood ready to judge the result. The reviewers were modelled
 * and the authors were not, which is the wrong way round: authoring is where the parallelism is.
 *
 * ⛔ TWO REGISTRIES SO THAT BOTH GUARANTEES ARE STRUCTURAL. `Agent.judges: true` is a required
 * literal — that is how "every one judges and none may write" is enforced by the type rather than
 * by a check somebody has to remember to run. Adding `writes?: true` to the same interface would
 * have dissolved it into a flag two agents could get wrong. So: a second interface, whose own
 * required literal says the inverse.
 *
 * ⛔ EVERY AUTHOR WRITES AND NONE MAY SETTLE. The exact mirror of the judges' rule, and it is what
 * makes this a model rather than a refactor. An author may propose, populate, draw and regenerate.
 * It may never produce a verdict, answer an open question, or mark anything walked or validated —
 * because a subagent that obtains consent is a consent path with no record of how consent was
 * obtained, which is the whole thing `Verdict.via` exists to prevent.
 *
 * Held three ways, not one:
 *   - no author declares `ask-the-human`, so no host hands one a question tool;
 *   - what an author hits and cannot resolve becomes a `question:` with no claim, or a framework
 *     gap — both of which are writing something down, which authors may do;
 *   - anything an author does record carries `via: agent`, which never counts as agreement.
 */
export interface Author {
  name: string;
  /** ⛔ Whose seat this is. See `DISCIPLINES` — it describes a team, it does not gate anything. */
  discipline: Discipline;
  /** The question it answers. ⛔ One question, same rule as a judge. */
  asks: string;
  /** Why this is a role and not a step in a script — the failure that made it one. */
  because: string;
  /** What it must load before it can write anything. */
  reads: string[];
  /** What it puts into the corpus, so two authors cannot both believe they own a field. */
  writes: string[];
  never: string[];
  needs: Capability[];
  /**
   * What it is fanned out over, or absent when it runs once.
   *
   * ⛔ THE FIELD THE WHOLE IDEA IS FOR. A role with no axis is a step in a script; naming the axis
   * is what tells a skill whether to spawn one of these or thirty.
   */
  each?: string;
  /** true = writes and never settles. ⛔ The inverse literal of `Agent.judges`. */
  authors: true;
  /** Where its prompt lives, or absent if it has not been written — said out loud, never implied. */
  prompt?: string;
}

export const AUTHORS: Author[] = [
  {
    name: "surveyor",
    discipline: "product",
    asks: "What does this product consist of — which areas, and which features in each?",
    because:
      "The first thing anybody does with a codebase is the thing least suited to being done feature " +
      "by feature: deciding what the features ARE. Done inside a per-feature pass it is decided " +
      "thirty times, differently, by whoever happens to be reading that file — which is how a whole " +
      "product came to be filed as a single area and ten capabilities came out as a flat list of " +
      "operations with no subsystem named anywhere.",
    reads: [
      "the codebase's routes and top-level directories — where the product divides itself",
      "productos/config.yaml — what has already been said about where things live",
      "any existing corpus, so a second run extends rather than re-partitions",
    ],
    writes: ["the areas, as scopes", "each feature as a scope inside its area, with a title and nothing else"],
    never: [
      "write what a feature promises — naming it and describing it are different jobs, and doing both in one pass is how a survey becomes thirty shallow scopes nobody can review",
      "re-partition an area that already exists because a new reading of the code suggests a different cut — say so instead, and let somebody decide",
      "file a whole product as one area, which is the failure this role exists to stop",
    ],
    needs: ["read-files", "search-files", "run-commands", "write-corpus"],
    authors: true,
    prompt: "agents/productos-surveyor.md",
  },
  {
    name: "scoper",
    discipline: "product",
    asks: "What does this one feature promise, and where does somebody meet it?",
    because:
      "This is the role the whole idea is for: the only part of authoring that genuinely parallelises, " +
      "and the part a single session does worst because by feature nine it is writing the shape it " +
      "wrote for feature eight. Thirty features is thirty contexts, each reading only its own code.",
    reads: [
      "its own scope, and nothing about any other feature",
      "the code that implements it, where code exists",
      "GLOSSARY.md and the skill — what the eight slots are, and what belongs in each",
    ],
    writes: [
      "the happy path — what the feature is FOR, first",
      "views and their parts",
      "exchanges, and what each slot says",
      "criteria — what would show a sentence holding",
      "`question:` on anything it cannot resolve, with no claim beside it",
    ],
    never: [
      "answer a question it raised — an author that resolves its own ambiguity has recorded a decision nobody made",
      "read another feature's scope to stay consistent with it: consistency across scopes is a reviewer's question, and an author reaching for it produces thirty copies of one guess",
      "write a screen's picture — that is generated, and typing one is the defect this project has repeated most",
      "stamp anything walked, validated or accepted",
    ],
    needs: ["read-files", "search-files", "run-commands", "write-corpus"],
    each: "feature",
    authors: true,
    prompt: "agents/productos-scoper.md",
  },
  {
    name: "designer",
    discipline: "design",
    asks: "What should this screen look like, where no code renders it?",
    because:
      "Peter: *\"why can't generate be an agent? like a designer type agent?\"* — and the objection " +
      "this replaces was aimed at the wrong half. `draw` reads a component and is mechanical; it " +
      "must never be an agent. The other half is not mechanical at all: a screen the product should " +
      "have and nothing renders yet has to be drawn from what it promises and the application's own " +
      "idiom. That branch was a switch statement stacking one part per row, which is why the corpus " +
      "carries screens with no picture and why `check` refuses them — nobody can review a title.",
    reads: [
      "the screen's own truth — its parts, and what the exchanges at it promise",
      "⛔ the running product, LOOKED AT rather than read — the real screens this one has to sit beside",
      "the design system, where the product has one: its components, its spacing, its type scale",
      "the idiom this application already uses, learned from its own components",
      "sibling screens in the same area that DO have drawings, so it looks like the same product",
    ],
    writes: ["a drawing for a screen no component renders, stamped with what it was designed from"],
    never: [
      "draw a screen a component renders — `draw` wins wherever code exists, and a designed picture over real code is a claim about the product that nothing checked",
      "invent what a screen promises: it draws what the truth already says, and a screen with nothing said gets a question, not a guess",
      "write a drawing that does not say on its face that it was designed rather than observed — a reviewer who cannot tell which they are looking at may validate a screen the product does not have",
    ],
    needs: ["read-files", "search-files", "run-commands", "write-corpus", "see-a-page", "fetch-url"],
    each: "screen no component renders",
    authors: true,
    prompt: "agents/productos-designer.md",
  },
  {
    name: "evidencer",
    discipline: "quality",
    asks: "What already demonstrates each of these claims?",
    because:
      "A corpus written from code arrives with every criterion unproven, and the proof usually " +
      "already exists somewhere in the repository under a name nobody would search for. Left to the " +
      "same pass that wrote the claim, it does not happen: the author has just finished deciding " +
      "what is true and is the worst placed person to go looking for whether anything shows it.",
    reads: [
      "every criterion in the scope, and what each would take to demonstrate",
      "the repository's existing tests, fixtures and recorded runs",
    ],
    writes: ["evidence against criteria, each naming what it is and where it came from"],
    never: [
      "write a test — it reports the hole; closing it is somebody's engineering decision",
      "count a passing test as validation: a test says the code does this, and the corpus asks whether a person agreed it should",
      "attach evidence it has not read, on the strength of a matching name",
    ],
    needs: ["read-files", "search-files", "run-commands", "write-corpus"],
    authors: true,
    prompt: "agents/productos-evidencer.md",
  },
];

/**
 * ⛔ THE COMMANDS, DECLARED — because `--help` is not a list, it is an inventory of whatever
 * happens to be registered.
 *
 * Peter: *"is our overall architecture ok? we generally just have 'commands' and 'agents' to back
 * the commands. have we maintained a list anywhere?"* The agents were maintained and generated with
 * a test against drift; the commands were not maintained at all. Fifty-four of them, the only list
 * being `--help`, nothing tying a command to the layer that owns it, and nothing failing when one
 * shipped with no home or stopped being used.
 *
 * ⛔ AND IT IS NOT A SECOND COPY OF `--help`. A doc listing commands is exactly the thing that
 * rots; what makes this maintained is `who` and `track`, which `--help` cannot know and which are
 * the two questions actually worth asking about a command:
 *
 *   who   — a person, or the model. "Never hand a human a flag" is a rule this project keeps, and
 *           it was keepable only by remembering it. A command marked `claude` that turns up in a
 *           skill's instructions to a person is now a visible contradiction.
 *   track — v1 or the Exchange model. Two parallel tracks have been running for months and nothing
 *           said which commands belong to which, so the retired half stayed indistinguishable from
 *           the live half at the only moment it matters: somebody reading the list.
 */
export interface Verb {
  /** As it is typed. ⛔ Including the parent, because `v2 read` and `read` are different commands. */
  name: string;
  does: string;
  /** Which layer this serves, so a command with no home is visible. */
  owns: Layer;
  /**
   * ⛔ WHO RUNS IT. A person, the model on their behalf, or both.
   *
   * The skills say "never hand a human a flag" and the only thing enforcing it was somebody
   * remembering. A command this marks `claude` appearing in instructions addressed to a person is
   * a contradiction somebody can now see.
   *
   * ⛔ `operator` IS A FOURTH AUDIENCE, AND IT WAS MISSING UNTIL HOSTING NEEDED IT.
   *
   * Whoever runs an instance is a person at a terminal, but they are NOT the product's user — the
   * premise this project keeps is that a PM needs a browser and nothing else, and `forPeople()`
   * guards it with a cap. Marking `productos hosted token new` as `person` tripped that cap, and
   * the refusal was right about the number while wrong about the fact: eight provisioning commands
   * are not eight things a PM has to learn.
   *
   * Both alternatives were lies. `claude` would claim a model runs it, which is the mislabel this
   * field exists to catch; raising the cap would delete the check that protects the premise. So the
   * vocabulary gained the value it was missing — which is what this project does when something
   * true has nowhere to live, instead of writing it as prose.
   */
  who: "person" | "claude" | "both" | "operator";
  /** Which of the two parallel models it belongs to. */
  track: "v1" | "exchange" | "both";
}

export const COMMANDS: Verb[] = [
  // ─── setting up, and the surfaces a person actually opens ───────────────────────────────────
  { name: "init", does: "Install ProductOS into an AI runtime and scaffold a corpus", owns: "instruct", who: "claude", track: "both" },
  { name: "serve", does: "Render product truth as a website, or run the MCP server", owns: "surface", who: "person", track: "both" },
  { name: "configure", does: "Interactive configuration, section by section", owns: "instruct", who: "person", track: "both" },
  { name: "doctor", does: "Check the install, the runtime, and the state of the truth", owns: "check", who: "person", track: "both" },
  { name: "env", does: "Drive a dev environment", owns: "surface", who: "claude", track: "both" },
  { name: "byok", does: "Toggle and report the state of bring-your-own-key verification", owns: "surface", who: "person", track: "both" },
  { name: "todo", does: "Framework gaps — where the model could not express what the corpus needed", owns: "check", who: "both", track: "both" },
  /**
   * ⛔ `check`, BECAUSE IT DETECTS AND DOES NOT FIX — the same layer `todo` sits in, and for the
   * same reason: both read a record and report what is wrong with the shape of it. Nothing it finds
   * is applied by it, and the only routes onward are `v2 change` and `v2 steer`, both of which
   * require a person.
   */
  { name: "learn", does: "What the record of feedback says about how this project works — computed, never written back", owns: "check", who: "both", track: "both" },

  // ─── operating a hosted instance ────────────────────────────────────────────────────────────
  /**
   * ⛔ THESE SIT BELOW THE AUTH BOUNDARY, AND THAT IS WHY THEY ARE A SEPARATE FAMILY.
   *
   * Every route on an instance needs a credential, and a credential is a row in the store — so a
   * tool that had to authenticate before it could create the first account could never create it.
   * Provisioning is the one job that legitimately holds `DATABASE_URL` instead of a token: having
   * the connection string IS the authorization.
   *
   * ⛔ AND NONE OF THEM CAN RECORD A VERDICT. Nothing here calls `perform`, because a provisioning
   * tool that could stamp agreement would be a way to mint human consent from a shell.
   */
  { name: "hosted", does: "Operate a hosted instance: accounts, projects, tokens, and corpus in and out", owns: "surface", who: "operator", track: "exchange" },
  { name: "hosted doctor", does: "Whether the store can be reached, the schema is current, and what is in it", owns: "check", who: "operator", track: "exchange" },
  { name: "hosted projects", does: "Every project in the store, with its owner and how much it holds", owns: "surface", who: "operator", track: "exchange" },
  { name: "hosted project", does: "Create a project, owned by an account that is made if it is new", owns: "surface", who: "operator", track: "exchange" },
  { name: "hosted token", does: "Issue, list and revoke what something automated holds to reach a project", owns: "surface", who: "operator", track: "exchange" },
  /**
   * ⛔ ITS OWN VERB RATHER THAN A FLAG ON `import`, BECAUSE IMPORT CLOBBERS. That one puts every
   * file in a directory, so delivering a style with it would overwrite everything authored on the
   * instance since the corpus arrived — silently, since the result still parses and still renders.
   */
  { name: "hosted style", does: "Push the application's design libraries into a project, touching no other document", owns: "generate", who: "operator", track: "exchange" },
  { name: "hosted import", does: "Put a corpus directory into a project on an instance", owns: "generate", who: "operator", track: "exchange" },
  { name: "hosted export", does: "Write a project's corpus out as a directory, byte for byte", owns: "generate", who: "operator", track: "exchange" },
  { name: "hosted session", does: "A browser session for one account, which is what makes a press provable", owns: "surface", who: "operator", track: "exchange" },

  // ─── the Exchange model ─────────────────────────────────────────────────────────────────────
  /** ⛔ The parent is a command too — `productos v2` with no verb lists the tree. */
  { name: "v2", does: "The Exchange model — the tree every verb below it hangs from", owns: "surface", who: "both", track: "exchange" },
  { name: "v2 check", does: "What this corpus refuses, and what it merely reports", owns: "check", who: "claude", track: "exchange" },
  { name: "v2 grid", does: "The behaviours a scope states, and where each one stands", owns: "derive", who: "claude", track: "exchange" },
  { name: "v2 acts", does: "How many acts of human judgement this corpus carries", owns: "derive", who: "claude", track: "exchange" },
  { name: "v2 packet", does: "Compile the execution packet for one scope", owns: "generate", who: "claude", track: "exchange" },
  { name: "v2 next", does: "What to ask somebody next about one feature", owns: "derive", who: "claude", track: "exchange" },
  { name: "v2 page", does: "Render one scope as a page a person can review", owns: "surface", who: "claude", track: "exchange" },
  { name: "v2 publishable", does: "Emit the interactive page for publishing, if the corpus allows it", owns: "surface", who: "claude", track: "exchange" },

  // the five acts. ⛔ A person performs these; the CLI is how the model records what they chose.
  { name: "v2 accept", does: "Record that somebody has read one exchange and agrees to it", owns: "derive", who: "claude", track: "exchange" },
  { name: "v2 rule", does: "Settle an unsettled slot — the ruling, and why", owns: "derive", who: "claude", track: "exchange" },
  { name: "v2 read", does: "Record that somebody read a scope end to end", owns: "derive", who: "claude", track: "exchange" },
  { name: "v2 waive", does: "Declare that something is deliberately not answered", owns: "derive", who: "claude", track: "exchange" },
  { name: "v2 defer", does: "Park a question somebody has read and is not answering yet", owns: "derive", who: "claude", track: "exchange" },
  { name: "v2 decide", does: "Work one scope's open questions, with what guessing wrong would cost", owns: "surface", who: "claude", track: "exchange" },

  // generating. ⛔ If it can be generated, generate it — these are why hand-authoring is a defect.
  { name: "v2 generate", does: "Regenerate everything generable: screens, their states, and the graph", owns: "generate", who: "claude", track: "exchange" },
  /**
   * ⛔ THE ONE GENERATOR THAT NEEDS THE REPOSITORY, WHICH IS WHY IT IS ITS OWN VERB. Every other
   * step reads the corpus; this reads the application's design libraries and copies them in, so a
   * drawing looks like the product on an instance that has no checkout anywhere near it.
   */
  { name: "v2 style", does: "Copy the application's design libraries into the corpus, and say when they have moved since", owns: "generate", who: "claude", track: "exchange" },
  { name: "v2 draw", does: "Generate one screen from the codebase", owns: "generate", who: "claude", track: "exchange" },
  { name: "v2 propose", does: "Generate a screen from a view's own parts, where no code renders it", owns: "generate", who: "claude", track: "exchange" },
  { name: "v2 connect", does: "Work out what each control leads to, from what the corpus says", owns: "derive", who: "claude", track: "exchange" },
  { name: "v2 migrate", does: "Convert a v1 corpus into the Exchange model", owns: "generate", who: "claude", track: "exchange" },
  { name: "v2 moved", does: "Walk what the code has decided since each screen was drawn", owns: "check", who: "claude", track: "exchange" },

  // the conversation, and keeping ourselves honest
  { name: "v2 notes", does: "What people asked to be changed, what they were looking at, and the replies", owns: "surface", who: "claude", track: "exchange" },
  { name: "v2 inbox", does: "What has happened since a given position", owns: "surface", who: "claude", track: "exchange" },
  { name: "v2 watch", does: "Wait, and print a line whenever somebody records an act or asks for a change", owns: "surface", who: "claude", track: "exchange" },
  { name: "v2 whoami", does: "What an instance thinks you are, and what it will let you do", owns: "surface", who: "claude", track: "exchange" },
  { name: "v2 change", does: "Record a piece of feedback and drive it into every layer it must reach", owns: "instruct", who: "claude", track: "exchange" },
  /**
   * ⛔ `instruct`, BECAUSE A GENERATION STEER LANDS IN AN AUTHOR'S INSTRUCTIONS. It is tempting to
   * file this under `surface` — the verb is in the CLI and a person reads the list. But what the
   * verb produces is appended to every author's prompt at install, which makes it the same layer
   * `init` and `v2 change` serve: what a future session will be told.
   */
  { name: "v2 steer", does: "What this project has learned — habits that shape what gets made, never what it promises", owns: "instruct", who: "both", track: "exchange" },
  { name: "v2 agents", does: "The roles: what each asks, and which skill orchestrates which", owns: "instruct", who: "both", track: "exchange" },
  { name: "v2 reset", does: "Restore a corpus from the pristine seed, so every run starts identical", owns: "generate", who: "claude", track: "exchange" },

  // ─── v1, still here and no longer where the work is ─────────────────────────────────────────
  { name: "check", does: "Check a v1 corpus against the model", owns: "check", who: "claude", track: "v1" },
  { name: "product", does: "Inspect v1 product truth and update tracking", owns: "surface", who: "claude", track: "v1" },
  { name: "area", does: "Show an area's features, flow, and audit roll-up", owns: "surface", who: "claude", track: "v1" },
  { name: "review", does: "A conversational REPL to edit a v1 feature in plain English", owns: "surface", who: "person", track: "v1" },
  { name: "scan", does: "LLM-driven scan of a codebase to create a v1 feature", owns: "generate", who: "person", track: "v1" },
  { name: "move", does: "Re-file a v1 feature or area, repointing every reference", owns: "generate", who: "claude", track: "v1" },
  { name: "history", does: "Recent snapshots of a v1 feature", owns: "surface", who: "claude", track: "v1" },
  { name: "undo", does: "Restore a previous on-disk version of a v1 feature", owns: "generate", who: "claude", track: "v1" },
  { name: "decide", does: "Answer an open question on a v1 behaviour", owns: "derive", who: "claude", track: "v1" },
  { name: "ask", does: "Raise an ambiguity, a question, or a proposal as a reader", owns: "surface", who: "claude", track: "v1" },
  { name: "read", does: "Record that somebody read a v1 container end to end", owns: "derive", who: "claude", track: "v1" },
  { name: "next", does: "The v1 decisions waiting on somebody, ranked", owns: "derive", who: "claude", track: "v1" },
  { name: "verify", does: "Mark a v1 behaviour as human-validated", owns: "derive", who: "claude", track: "v1" },
  { name: "unverify", does: "Clear the human-validated stamp on a v1 behaviour", owns: "derive", who: "claude", track: "v1" },
  { name: "gaps", does: "Gaps in v1 truth, tracking and open feedback", owns: "check", who: "claude", track: "v1" },
  { name: "feedback", does: "Manage the v1 feedback queue", owns: "surface", who: "claude", track: "v1" },
  { name: "queue", does: "Inspect and manage the v1 work queue", owns: "surface", who: "claude", track: "v1" },
  { name: "test", does: "Test scaffolding and result ingestion", owns: "pin", who: "claude", track: "v1" },
];

/** ⛔ Said out loud: which commands belong to the track that is no longer where the work is. */
export const retiring = (): Verb[] => COMMANDS.filter((c) => c.track === "v1");

/** Everything a PERSON is expected to type. ⛔ The rest are the model's, and a skill must not offer them. */
/**
 * Commands aimed at the product's user.
 *
 * ⛔ `operator` IS EXCLUDED, AND NOT AS A LOOPHOLE. The cap this feeds exists to protect "a PM needs
 * a browser and nothing else". Provisioning an instance is a different job for a different person,
 * and counting it would make the number say something about the product that is not true. What
 * stops this becoming a dumping ground is that `forOperators` is just as visible — a command filed
 * there to dodge the cap is a command claiming nobody using the product will ever type it.
 */
export const forPeople = (): Verb[] => COMMANDS.filter((c) => c.who === "person" || c.who === "both");

/** Whoever runs an instance. ⛔ Never the product's user — see `who` on `Verb`. */
export const forOperators = (): Verb[] => COMMANDS.filter((c) => c.who === "operator");

/**
 * ⛔ THE PRESET — WHICH ROLES EACH SKILL ORCHESTRATES, AND WHAT IT MAY NOT HAND OFF.
 *
 * Peter: *"when the user sends a message we should ensure it flows through the agents as
 * appropriate — so we should have a main orchestrator that determines which agents should be
 * used, right?"* and then, sharper: *"so like a tree, for the old skills like 'align' or
 * 'exchange', we have a preset for which agents to orchestrate consistently"*.
 *
 * ⛔ THE ORCHESTRATOR IS THE SESSION, AND IT CANNOT BE A SUBAGENT. It is the only thing talking to
 * the person, and talking to the person is the one job that may never be delegated — an author
 * that could obtain consent would be obtaining it with no record of how. So what is modelled here
 * is not an orchestrating agent; it is the ROUTING, declared, so the session is reading a table
 * rather than deciding from memory which roles a request needs.
 *
 * That distinction is the same one `CASCADE` makes and for the same reason: a routing decided from
 * memory is decided differently every time, and the step that gets skipped is always the one
 * nobody is watching. Here that step is `keeps` — the part the skill must do itself. Spawning four
 * agents and forgetting that somebody still has to AGREE is exactly how a corpus ends up fully
 * written, fully checked, and validated by nobody.
 *
 * ⛔ `keeps` IS THE LOAD-BEARING FIELD. A preset with an empty `keeps` is a skill that delegated
 * everything, which for anything touching truth is a skill that has delegated the consent.
 */
/**
 * ⛔ THE STAGE A ROUTE RUNS AT.
 *
 * Peter: *"wait, what are our main stages? we should have 'specification', 'ready for review',
 * 'ready for build' - ready for review is when the builders get involved.. design and product have
 * signed off, more or less"*.
 *
 * The first attempt at this gated the engineering and QA reads behind a sentence of my own —
 * "a human has agreed to this truth" — which was the right instinct aimed at nothing. It named a
 * condition no part of the model computed, so the gate could only ever be a reminder, and I said so
 * at the time: the grain was a guess.
 *
 * The stages are the grain. `Stage` in the schema names them and `stageOf` derives each one from
 * the stamps, so a route's precondition is now a thing that can be ANSWERED about a feature rather
 * than remembered about a workflow. ⛔ And it is where the builders enter: `ready for review` is the
 * stage, not a politeness — product and design have signed off, and that is what makes an
 * engineer's reading worth having instead of a cost estimate on a draft.
 */

export interface Shim {
  /**
   * What somebody is asking for. ⛔ A ROUTE, NOT A SKILL — there is one skill now.
   *
   * Peter: *"hmm, these don't seem right, why do we need skills and commands?"* He was right to
   * push. A skill was carrying three different things: which roles to spawn (already declared
   * here), the authoring rules (one document, delivered eight times), and a v1 workflow (1,903
   * lines for a track the work had left). Only the first is a skill's job.
   *
   * So the eight became routes under one entry point. A command is what the system can DO; a role
   * is WHO does a piece of it; a skill is only how a host lets somebody ask by name — and that
   * needs one of them, not eight bodies of prose.
   */
  route: string;
  does: string;
  /** What somebody types or says to mean this route. */
  when: string;
  /**
   * The roles it spawns, in order. `fan` = one per unit of its role's axis; otherwise one.
   *
   * ⛔ REVIEWERS BELONG HERE TOO, AND FOUR ROUTES USED TO HAVE NONE.
   *
   * This list only ever named authors, so every route that reviewed something said *"running the
   * reviewers"* in `keeps` — prose, where a field belonged. The consequence: the question "which
   * roles does this route orchestrate?" had no answer for any reviewer, in a registry whose entire
   * job is answering it. Four routes read as orchestrating nothing at all.
   *
   * ⛔ A ROLE IN NO ROUTE IS A ROLE NOBODY RUNS, and that is now a test rather than a hope. It is
   * how two reviewers turned out to be reachable only by somebody remembering they existed.
   *
   * Order is meaningful and mixed on purpose: authors write, then reviewers judge what was
   * written. Which of the two a role is never stated here — it is derived from the registries, so
   * a judge cannot be listed as if it wrote something.
   */
  steps: Array<{ role: string; fan?: boolean; why: string }>;
  /**
   * ⛔ What this route performs ITSELF, because it may not be delegated. Every act of judgement
   * lives here, and so does every question put to a person.
   */
  keeps: string[];
  /**
   * ⛔ The stage a feature must be at for this route to run. Absent means any — a route that reads
   * a whole corpus or reviews the framework is not about one feature's stage at all.
   *
   * Derived by `stageOf`, never stored, so this is checkable rather than advisory. See `Stage`.
   */
  at?: Stage;
}

export const SHIMS: Shim[] = [
  {
    route: "scope a feature",
    does: "Turn one in-flight feature into product truth",
    when: "scope the deals list · spec this feature · what should this screen promise",
    /** ⛔ The first stage, and the only one where truth is still being written. */
    at: "specification",
    steps: [
      { role: "scoper", why: "the feature written in a context holding nothing but that feature" },
      { role: "designer", fan: true, why: "screens the product should have and nothing renders yet" },
      /**
       * ⛔ PRODUCT AND DESIGN ONLY, AND IT STOPS. Peter: *"we need to a rough scope, nail down human
       * truth before we need to involve engineers/qa"*.
       *
       * This briefly spawned an engineering and a QA read in the same pass, which asked two people
       * to judge whether a draft could be built and whether its criteria proved anything — before
       * anybody had agreed the draft was the product. Those two roles moved to `ready it for build`,
       * which cannot run until somebody has.
       *
       * What stays is what a person needs in order TO agree: does the thing join up, and are these
       * the right screens. Both are questions about the truth itself, which is the thing being
       * validated.
       */
      { role: "completeness", why: "whether somebody can get from the start of this feature to the end of it" },
      { role: "design-critique", fan: true, why: "whether these are the right screens for the job, not just complete ones" },
    ],
    keeps: [
      "the conversation about what this feature is for — a purpose inferred from code is a purpose nobody chose",
      "putting every open question to the person, in their own interface",
      "every act of judgement, and never answering one on their behalf",
      "⛔ stopping here. The engineering and QA reads are a different route and it cannot run until somebody has agreed to this — an engineer costing a draft produces a decision nobody made",
    ],
  },
  {
    route: "scan a codebase",
    does: "Turn a whole codebase into a first corpus",
    when: "full scan · index this repo · propose truth for everything",
    steps: [
      { role: "surveyor", why: "decide what the product consists of once, before anything describes a feature" },
      { role: "scoper", fan: true, why: "every feature written in its own context, reading only its own code" },
      { role: "designer", fan: true, why: "a picture for every screen no component renders — a screen with none cannot be reviewed" },
      { role: "evidencer", why: "what the repository already demonstrates, found by somebody who did not write the claims" },
      { role: "completeness", fan: true, why: "every feature walked end to end, because a first corpus is where paths fail to join" },
      { role: "coherence", why: "⛔ the whole corpus at once — thirty scopers writing in isolation is exactly how one word comes to mean two things" },
      { role: "hand-authored", why: "whether anything was typed that a generator should have produced — on a run this large, nobody would notice" },
    ],
    keeps: [
      "running `productos v2 generate`, because a screen a component renders is DRAWN and never designed — it sweeps BOTH corpus layouts and copies the design libraries in first, so a drawing looks like the product wherever the corpus is read rather than only beside a checkout",
      "running `productos v2 check` before anybody is asked to look",
      "putting the survey in front of a person before thirty scopers start against a partition that is wrong",
      "every act of judgement — nothing here is validated by having been written",
    ],
  },
  /**
   * ⛔ THE HALF THAT WAITS. Peter: *"nail down human truth before we need to involve
   * engineers/qa"* — so this is where they get involved, and `after` is what makes that more than
   * an intention.
   *
   * Running it early is not merely wasteful. An engineering read of a draft comes back phrased as
   * fact ("this needs a source of truth for X"), and a session acting on it is now building toward
   * a shape nobody validated — with a reviewer's authority behind it. The order is the protection.
   */
  {
    route: "hand it to the builders",
    does: "The engineering and QA read, once product and design have signed off",
    when: "ready for review · is this buildable · can we start on this · engineering review · would these tests prove anything",
    at: "ready for review",
    steps: [
      { role: "buildability", why: "whether somebody could start on Monday — the second tenet, read from a builder's seat" },
      { role: "test-design", why: "whether each criterion would show its claim holding, rather than merely pass" },
    ],
    keeps: [
      "⛔ checking somebody actually agreed before spawning either of these — the precondition is the whole point of the split",
      "deciding what to do with what comes back: a question the corpus must settle goes to the person, never to the builder",
      "every act of judgement — an engineer saying it is buildable is not somebody agreeing it is right",
    ],
  },
  {
    route: "map evidence",
    does: "Find what already demonstrates the claims a corpus makes",
    when: "map my tests · what covers this · align evidence",
    steps: [
      { role: "evidencer", why: "the whole of the search, by a role that cannot mistake a green test for agreement" },
      /**
       * ⛔ COVERAGE AND NOT `test-design`, WHICH IS THE SPLIT PETER ASKED FOR APPLIED HERE TOO.
       *
       * Whether a claim HAS evidence is bookkeeping and safe to ask about a draft. Whether a
       * criterion would PROVE anything is a QA judgement about the truth itself, and this route can
       * be entered cold — so asking it here is asking QA to rule on something nobody has agreed to.
       * It lives in `ready it for build`, behind the precondition.
       */
      { role: "coverage", why: "whether each claim is pinned by something that fails on its own" },
    ],
    keeps: [
      "the decision about what to do with a criterion nothing demonstrates",
      "⛔ not reading a coverage number as quality — whether those criteria would show anything is `ready it for build`, after somebody has agreed",
      "never letting coverage be reported as validation",
    ],
  },
  {
    route: "check it communicates",
    does: "Find out whether a corpus can be built from by somebody who has not read it",
    when: "run a PM review · fresh eyes · would somebody understand this",
    steps: [
      { role: "newcomer", fan: true, why: "a product manager handed a URL, who has never seen ProductOS and may not read its source" },
      /**
       * ⛔ NO ENGINEERING READ HERE, THOUGH IT FIT WELL. This route runs BEFORE anybody is asked to
       * review, so `buildability` would have been an engineer costing a draft — the exact thing the
       * `scope a feature` split exists to prevent, arriving by a second door. What a corpus fails
       * to DECIDE is still worth knowing; it is asked in `ready it for build`, once there is
       * something agreed to decide about.
       */
      { role: "can-the-model-say-it", why: "whether a confusion is the corpus's fault or ours — the routing this whole route exists to get right" },
    ],
    /**
     * ⛔ NO AUTHORS AT ALL, AND THAT IS THE POINT. An author anywhere in this would be ANSWERING
     * the confusions the reviewers came back with, which is the single most valuable output there
     * is: a newcomer confused about something you could clear up in one sentence is a finding, and
     * clearing it up destroys it.
     */
    keeps: [
      "running the reviewers, which judge and never write",
      "routing what comes back: a framework gap to us, a corpus finding to the author",
      "never answering a newcomer's confusion — writing it down is the output",
    ],
  },
  {
    route: "look at the product",
    does: "Compare the drawings against the product a person actually sees",
    when: "does this match · check the prototype against the app",
    steps: [
      { role: "rendered", fan: true, why: "whether the drawing matches the product a person actually sees" },
      { role: "design-critique", fan: true, why: "⛔ and whether it is any good — `rendered` refuses this, so a faithful drawing of a bad screen passes it" },
      { role: "truthfulness", why: "where the built product disagrees with the target, reported as drift and never as the corpus being wrong" },
    ],
    keeps: [
      "bringing the environment up, and saying so when it will not come up",
      "running the reviewer that looks, which judges and never writes",
      "never treating a difference as the corpus being wrong — the corpus is the target state",
    ],
  },
  {
    route: "drain the queue",
    does: "Work what people have asked for, and answer them where they asked",
    when: "drain the queue · anything waiting · did anyone press anything",
    steps: [],
    keeps: [
      "deciding which route each request belongs to, and running it",
      "replying where they asked — ⛔ a `pos:` is answered concisely, and the framework is what changes",
      "every act of judgement",
    ],
  },
  /**
   * ⛔ THIS ROUTE DID NOT EXIST, AND TWO REVIEWERS WERE REACHABLE ONLY BY MEMORY.
   *
   * Every route here reviews somebody's product. Nothing routed to the roles that review PRODUCTOS
   * — `consistency` and `architecture` were in the registry, written, installed, and named by no
   * route at all, so they ran when a session happened to remember them. Both exist because of
   * failures in this repo that no file-scoped review could see, which is exactly the kind of check
   * that stops happening when nothing asks for it.
   *
   * Giving the framework its own seat is what made that visible: once the roles were grouped by who
   * would have done the work, two of them had no work coming to them.
   */
  {
    route: "review ProductOS itself",
    does: "Review the framework, not anybody's product",
    when: "review the framework · did we skip a layer · is this the right architecture · can the model say this",
    steps: [
      { role: "consistency", why: "whether a concept reached every layer, or stopped at the one that was convenient" },
      { role: "architecture", why: "whether these are the right subsystems with the right boundaries, and whether it would work" },
      { role: "coverage", why: "whether each defect we fixed is pinned by something that fails on its own" },
      { role: "can-the-model-say-it", why: "whether the model can express a real product, and whether a person can review what it produces" },
    ],
    keeps: [
      "⛔ deciding what to change — these four judge the framework and may not touch it",
      "running it after a change to `src/` or `skills/`, which is when a layer gets skipped",
      "recording what came back with `productos v2 change`, in the words it came back in",
    ],
  },
  {
    route: "edit one thing",
    does: "A surgical change to truth somebody already agreed to",
    when: "rename this · set leads_to · change this one field",
    steps: [],
    /**
     * ⛔ TOO SMALL TO DELEGATE, AND SAYING SO IS WORTH A ROW. Spawning a scoper for a one-field
     * change costs a whole context to rename an id — and a table with a hole in it reads as an
     * oversight somebody later fills in.
     */
    keeps: ["the edit itself — one field is not worth a context, and a scoper would rewrite around it"],
  },
];

/** ⛔ There is one skill. Its routes are above; this is the directory it lives in. */
export const SKILL = "productos";

/** One route by name, or nothing. */
export const shimFor = (route: string): Shim | undefined => SHIMS.find((s) => s.route === route);

/**
 * ⛔ A step naming a role that does not exist is a preset that fails when it is run rather than
 * when it is written. Checked by a test, because the registry is the kind of thing edited by hand.
 */
export const danglingSteps = (): Array<{ route: string; role: string }> =>
  SHIMS.flatMap((s) =>
    s.steps
      /** ⛔ EITHER REGISTRY. A step used to resolve only against authors, which is why no route could name a reviewer. */
      .filter((st) => !AUTHORS.some((a) => a.name === st.role) && !AGENTS.some((a) => a.name === st.role))
      .map((st) => ({ route: s.route, role: st.role }))
  );

/**
 * ⛔ A ROLE NO ROUTE NAMES IS A ROLE NOBODY RUNS.
 *
 * `consistency` and `architecture` were written, installed, and named by no route — so they ran
 * only when a session remembered they existed, which for the two roles that review ProductOS
 * itself means they ran least often exactly when the framework was changing fastest. Nothing could
 * detect that, because every individual part of it was present and correct.
 */
export const unrouted = (): string[] => {
  const named = new Set(SHIMS.flatMap((s) => s.steps.map((st) => st.role)));
  return [...AGENTS, ...AUTHORS].map((r) => r.name).filter((n) => !named.has(n));
};

/** Which seat each role sits in, for reading the registry as a team rather than a list. */
export const byDiscipline = (): Array<{ discipline: Discipline; roles: Array<Agent | Author> }> =>
  DISCIPLINES.map((d) => ({
    discipline: d,
    roles: [...AUTHORS, ...AGENTS].filter((r) => r.discipline === d),
  })).filter((g) => g.roles.length);

/** ⛔ Said out loud rather than implied: which agents exist as a prompt and which are named only here. */
export const unwritten = (): Agent[] => AGENTS.filter((a) => !a.prompt);

/** The same, for authors. A role named here with no prompt cannot be installed and says so. */
export const unwrittenAuthors = (): Author[] => AUTHORS.filter((a) => !a.prompt);

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
  /**
   * A new thing the model can say.
   *
   * ⛔ `derive` AND `generate` WERE MISSING, AND THAT IS HOW `happy_path` SKIPPED THE MIGRATOR.
   *
   * The first cut routed a concept to model, surface, check, instruct and pin. So by construction a
   * new field was never required to reach the migrator — and `happy_path` did not, while the gate
   * that depends on it refuses to offer any behaviour in a scope without one. The result, measured
   * on a real 34-scope corpus: nineteen features waiting on a purpose, zero behaviours offered,
   * zero exchanges acceptable. A whole corpus made unreviewable by a routing table that could not
   * ask the question.
   *
   * Every layer, for a concept. If one genuinely does not apply — plenty of concepts are nothing to
   * do with a generator — waive it with a reason, which is a decision somebody can disagree with
   * rather than a gap nobody was asked about.
   */
  concept: ["model", "derive", "generate", "surface", "check", "instruct", "pin"],
  /** A change to what is computed, inherited or gated. */
  derivation: ["derive", "surface", "check", "pin"],
  /** A change to how something is shown or offered. */
  surface: ["surface", "pin"],
  /** A change to how output is produced. */
  generator: ["generate", "pin"],
  /** A change to how a future session must work. */
  instruction: ["instruct", "pin"],
  /**
   * A change to how the running instance is updated, restarted, backed up or restored.
   *
   * ⛔ Pinned like everything else. An operations command is the one kind of code nobody runs until
   * the day it matters, which is the worst possible day to find out it assumed the other stack —
   * exactly what `backup` and `restore` did.
   */
  operations: ["operate", "pin"],
};
export const KINDS = Object.keys(CASCADE);
