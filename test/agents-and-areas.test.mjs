/**
 * ⛔ THE AGENT MODEL IS DATA, SO IT CAN BE CHECKED — and the thing worth checking is not the
 * taxonomy, it is that nothing falls between the agents.
 *
 * Peter: "each agent should understand the context of what they're supposed to do, like an agent
 * that validates everything is consistent, agent that validates test coverage is there."
 *
 * The first cut of this split by layer — one owner for the schema, one for the renderer — and that
 * is the wrong axis for exactly the reason it keeps failing: splitting by layer means nobody owns
 * "is this concept present everywhere it needs to be", which is a property of the whole. So AREAS
 * is territory an agent reads, and AGENTS each answer one question spanning all of it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import {
  AGENTS,
  AREAS,
  AUTHORS,
  SHIMS,
  LAYERS,
  CASCADE,
  KINDS,
  CAPABILITIES,
  areaOf,
  unwritten,
  unwrittenAuthors,
  shimFor,
  danglingSteps,
  unrouted,
  byDiscipline,
  DISCIPLINES,
  SKILL,
} from "../dist/core/jobs.js";
import { agentsDoc, withPreset } from "../dist/core/agents-doc.js";

test("every layer is somebody's territory, exactly once", () => {
  for (const layer of LAYERS) {
    const holders = AREAS.filter((a) => a.owns.includes(layer));
    assert.equal(
      holders.length,
      1,
      `${layer} is held by ${holders.length} areas (${holders.map((h) => h.name).join(", ") || "none"}) — ` +
        `a layer with none is where the next unowned change lands, and one with two is where two sets of ` +
        `prohibitions apply and neither is enforced`
    );
  }
  // And the map points at things that exist, or it is a map of somewhere else.
  for (const area of AREAS)
    for (const f of area.files) assert.ok(fs.existsSync(f), `area "${area.name}" claims ${f}, which is not there`);
});

test("every framework file the v2 track has is on the map", () => {
  /**
   * ⛔ THE POINT OF THE MAP IS THAT "EVERYWHERE" IS ENUMERABLE. An agent asked whether a concept is
   * present everywhere it should be needs a list of everywhere; a file missing from it is a place
   * no agent will look.
   */
  const claimed = new Set(AREAS.flatMap((a) => a.files));
  const missing = fs
    .readdirSync("src/v2")
    .filter((f) => f.endsWith(".ts"))
    .map((f) => `src/v2/${f}`)
    .filter((f) => !claimed.has(f));
  assert.deepEqual(missing, [], `these are part of the framework and on nobody's map:\n  ${missing.join("\n  ")}`);
});

/**
 * ⛔ AND THE DEPLOYMENT IS PART OF THE FRAMEWORK TOO — THE TEST ABOVE WALKED `src/v2` ONLY.
 *
 * So the Makefile, both compose files and the Dockerfile were on nobody's map for as long as the
 * hosted instance has existed. The cost was exact: `rebuild`, `restart`, `backup` and `restore` all
 * reached for a `postgres` container the managed-store stack has none of, and no area claimed the
 * file, so no reviewer was ever pointed at it. A change touching them could not even be routed —
 * the nearest kind was `generator`, whose files are the corpus generators.
 */
test("the files that run the instance are on the map too", () => {
  const claimed = new Set(AREAS.flatMap((a) => a.files));
  const missing = ["Makefile", "Dockerfile", "docker-compose.yml", "docker-compose.remote.yml"].filter(
    (f) => fs.existsSync(f) && !claimed.has(f)
  );
  assert.deepEqual(missing, [], `these bring the instance up and are on nobody's map:\n  ${missing.join("\n  ")}`);
});

test("an agent asks one question, says why it exists, and may not write", () => {
  assert.ok(AGENTS.length >= 4, "the agent model is thinner than the failures it has to catch");
  for (const a of AGENTS) {
    assert.match(a.asks, /\?$/, `"${a.name}" does not state a question — an agent with no question gives no finding`);
    assert.ok(a.because.length > 60, `"${a.name}" does not say what failure it exists to catch`);
    assert.ok(a.reads.length, `"${a.name}" says nothing about the context it must load, so it will answer from a file list`);
    assert.ok(a.finds.length, `"${a.name}" does not say what counts as a finding, so it will report opinions`);
    /**
     * ⛔ NO REVIEWER WRITES. An author cannot review their own work, and a reviewer that repairs
     * what it finds hides how often it fires.
     */
    assert.equal(a.judges, true, `"${a.name}" is not marked as a judge`);
    assert.ok(
      a.never.some((n) => /write|fix|repair|regenerate/i.test(n)),
      `"${a.name}" does not forbid itself from writing`
    );
    // ⛔ Capabilities, not tool names: a spec naming one host's tools is a spec for that host.
    for (const c of a.needs) assert.ok(CAPABILITIES.includes(c), `"${a.name}" needs "${c}", which is not a capability`);
    assert.ok(!a.needs.includes("write-corpus"), `"${a.name}" asks to write a corpus, and it judges`);
  }
});

test("no agent names a model — that is the consumer's choice", () => {
  /**
   * ⛔ Peter: "ideally in the future these job agents will be portable - model agnostic. we should
   * let people assign whatever model they want to each task." An agent that hardcoded one would be
   * portable nowhere; the model is read from the project's config at install time by an adapter.
   */
  const src = fs.readFileSync("src/core/jobs.ts", "utf-8");
  for (const m of ["opus", "sonnet", "haiku", "gpt-", "gemini", "claude-3", "claude-4", "claude-5"])
    assert.ok(!src.toLowerCase().includes(m), `jobs.ts names the model "${m}" — model choice belongs in config`);
  for (const a of AGENTS) assert.ok(!("model" in a), `"${a.name}" carries a model`);
});

test("the cascade routes every kind of change, and only to real layers", () => {
  assert.ok(KINDS.length >= 4, "the cascade covers too few kinds of change to route anything");
  for (const kind of KINDS) {
    const layers = CASCADE[kind];
    assert.ok(layers.length, `"${kind}" reaches nothing`);
    for (const l of layers) {
      assert.ok(LAYERS.includes(l), `"${kind}" routes to "${l}", which is not a layer`);
      assert.ok(areaOf(l), `"${kind}" routes to "${l}", which is on nobody's map`);
    }
    /**
     * ⛔ EVERY KIND REACHES `pin`. The rule this repo keeps breaking is not "change the schema" —
     * it is "leave nothing that fails on its own next time". A kind of change that can be finished
     * without a test is a kind of change that comes back.
     */
    assert.ok(layers.includes("pin"), `a "${kind}" change can be finished without pinning anything`);
  }
  /**
   * ⛔ AND A NEW CONCEPT MUST REACH `instruct`. That is the layer that was skipped four times: a
   * field perfect in the schema that no future session writes.
   */
  assert.ok(CASCADE.concept.includes("instruct"), "a new concept can be finished without telling anyone to write it");
});

test("the agents that have no prompt yet say so", () => {
  // ⛔ Named here and unwritten is honest; named here and silently absent is a registry that lies.
  for (const a of unwritten()) assert.equal(a.prompt, undefined);
  for (const a of AGENTS) if (a.prompt) assert.ok(fs.existsSync(a.prompt), `"${a.name}" points at ${a.prompt}, which is not there`);
});

test("the host's frontmatter is generated, and a judge never gets a writing tool", () => {
  /**
   * ⛔ Peter: "ideally in the future these job agents will be portable - model agnostic."
   *
   * So a prompt file holds the prompt and nothing else. The name, description, tool list and model
   * are one host's dialect, produced at install time from the portable spec plus the project's
   * config. They used to be hand-written into each prompt, which made every agent a Claude agent
   * and made the model something somebody edits inside a prompt.
   */
  /** ⛔ Both registries: an author's prompt is as much a portable spec as a judge's. */
  for (const a of [...AGENTS, ...AUTHORS]) {
    if (!a.prompt) continue;
    const body = fs.readFileSync(a.prompt, "utf-8");
    assert.doesNotMatch(body, /^---\n/, `${a.prompt} carries frontmatter — that belongs to the adapter`);
    for (const m of ["opus", "sonnet", "haiku", "gpt-4", "gemini"])
      assert.ok(!body.toLowerCase().includes(m), `${a.prompt} names the model "${m}"`);
    /**
     * ⛔ And the body names no host's tools. `ask-the-human` is a capability; `AskUserQuestion` is
     * one product's name for it, and a prompt naming it is a prompt for that product only.
     */
    for (const t of ["AskUserQuestion", "WebFetch", "the Bash tool", "the Read tool", "the Grep tool"])
      assert.ok(!body.includes(t), `${a.prompt} names the host tool "${t}" — declare a capability instead`);
  }

  /**
   * ⛔ THE TOOL LIST IS DERIVED FROM CAPABILITIES, and no capability a judge may declare maps to a
   * writing tool. This is where "a reviewer never writes" is enforced rather than hoped: it is not
   * possible to express an agent that judges and can write.
   */
  const adapter = fs.readFileSync("src/adapters/claude.ts", "utf-8");
  const map = /const TOOL_FOR: Record<Capability, string\[\]> = \{([\s\S]*?)\n\};/.exec(adapter);
  assert.ok(map, "the capability-to-tool map moved — re-read it before trusting this test");
  /**
   * ⛔ Read the VALUES, not the prose. The first version of this grepped the extracted block and
   * matched the word "Write" inside the comment explaining why nothing maps to it — a test failing
   * on its own documentation, which is the same class of mistake as asserting on flattened text.
   */
  const mapped = [...map[1].replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\[([^\]]*)\]/g)].flatMap((m) =>
    m[1].split(",").map((t) => t.trim().replace(/"/g, "")).filter(Boolean)
  );
  assert.ok(mapped.length >= 5, `the capability map reads as ${mapped.length} tools — re-read it`);

  /**
   * ⛔ THE GUARANTEE MOVED WHEN A SECOND REGISTRY ARRIVED, AND IT MUST NOT HAVE WEAKENED.
   *
   * This used to assert `"write-corpus": []` — nothing anywhere maps to a writing tool — which was
   * the right rule while every agent judged. Authors now exist and `write-corpus` maps to Write and
   * Edit, so the same guarantee has to be stated where it is actually true: no member of the JUDGE
   * registry may declare the capability that reaches a writing tool.
   *
   * Asserting it on the registry rather than on the map is also stronger than what it replaces.
   * The old form could be satisfied by a map with no writing tool in it while an agent went on
   * declaring `write-corpus` and silently installed with no tools at all.
   */
  const WRITES = /^(Write|Edit|NotebookEdit|MultiEdit)$/;
  const writingCaps = [...map[1].replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/"([\w-]+)":\s*\[([^\]]*)\]/g)]
    .filter(([, , tools]) => tools.split(",").some((t) => WRITES.test(t.trim().replace(/"/g, ""))))
    .map(([, cap]) => cap);
  assert.deepEqual(writingCaps, ["write-corpus"], `these capabilities reach a writing tool: ${writingCaps.join(", ")}`);
  for (const a of AGENTS)
    assert.ok(
      !a.needs.includes("write-corpus"),
      `the judge "${a.name}" declares write-corpus — a reviewer that repairs hides how often it fires`
    );

  /**
   * ⛔ AND THE INVERSE, WHICH IS THE NEW HALF: no author may be handed a question tool.
   *
   * An author has Bash and could type an act command, and the prohibition in its prompt is a
   * prohibition rather than a mechanism — that case is held downstream, because every act records
   * `via`, and an act an author performs records `via: agent`, which never counts as agreement.
   *
   * Asking a person something has no such downstream record. Consent obtained inside a subagent is
   * consent with no account of how it was obtained, which is the whole thing `Verdict.via` exists
   * to prevent. So it is refused here, at the registry.
   */
  for (const a of AUTHORS)
    assert.ok(
      !a.needs.includes("ask-the-human"),
      `the author "${a.name}" declares ask-the-human — a subagent that obtains consent has no record of how`
    );
  assert.ok(AUTHORS.length, "the author registry is empty — authoring has no role behind it again");
  for (const a of AUTHORS)
    assert.ok(a.needs.includes("write-corpus"), `the author "${a.name}" cannot write, which is what an author is`);
});

test("the agent tree document is generated, and has not drifted from the registry", () => {
  /**
   * ⛔ Peter: "let's keep a dedicated doc showing what agents we have."
   *
   * A dedicated doc is the right thing to want and the wrong thing to type. Everything in it is
   * already data — what each agent asks, why it exists, what it reads, what it may never do — so a
   * typed copy is a second record of one fact, and the typed one wins because it is the one people
   * read. Until it is wrong, which nothing detects.
   *
   * This is the same rule the framework applies to screens, turned on its own documentation: if it
   * can be generated, generate it, and fail the build when the committed copy disagrees.
   */
  const committed = fs.readFileSync("AGENTS.md", "utf-8");
  assert.equal(
    committed,
    agentsDoc(),
    "AGENTS.md disagrees with src/core/jobs.ts — regenerate it with `productos v2 agents --out AGENTS.md` rather than editing it"
  );

  // ⛔ And it says it is generated, at the top, where somebody about to edit it will look.
  assert.match(committed.split("\n").slice(0, 6).join("\n"), /Generated from `src\/core\/jobs\.ts`/);

  // Every agent reaches the page, with the part that makes it useful: why it exists.
  for (const a of AGENTS) {
    assert.ok(committed.includes(`### \`${a.name}\``), `${a.name} is not in the document`);
    assert.ok(committed.includes(a.asks), `${a.name}'s question is not in the document`);
    assert.ok(committed.includes(a.because.slice(0, 60)), `${a.name} does not say what failure it exists to catch`);
  }
  // ⛔ And the ones with no prompt are named as such rather than listed as though they run.
  for (const a of AGENTS.filter((x) => !x.prompt))
    assert.match(committed, new RegExp(`\`${a.name}\`.{0,40}no prompt written`, "s"), `${a.name} is listed as though it runs`);
});


/**
 * ⛔ AUTHORING HAD NO ROLE BEHIND IT, AND THAT WAS INVISIBLE BECAUSE NOTHING ASKED.
 *
 * Peter: *"we should model them as subagents, that the skills are shims into.."*. For as long as
 * `AGENTS` was the only registry, eight skills did all the authoring serially in one context while
 * five reviewers stood ready to judge the result. Nothing was wrong in any file; the shape was
 * wrong, and a shape is exactly what no file-scoped check can see.
 */
test("every author writes, none may settle, and none can ask a person anything", () => {
  assert.ok(AUTHORS.length >= 3, "the author registry is empty or nearly so — authoring lost its roles again");

  for (const a of AUTHORS) {
    /** ⛔ The inverse of the judges' literal. Structural: an author that cannot write is not one. */
    assert.equal(a.authors, true, `${a.name} is in AUTHORS without declaring authors: true`);
    assert.ok(a.needs.includes("write-corpus"), `${a.name} cannot write, which is what an author is`);
    assert.ok(
      !a.needs.includes("ask-the-human"),
      `${a.name} declares ask-the-human — consent obtained inside a subagent has no record of how`
    );
    /**
     * ⛔ THE `never` LIST IS THE DEFINING FIELD, same as it is for an area. A role with no
     * prohibition is a role nobody has thought about, and a prompt written from it says nothing.
     */
    assert.ok(a.never.length >= 2, `${a.name} declares fewer than two prohibitions — it has not been thought about`);
    assert.ok(a.asks.trim().endsWith("?"), `${a.name} does not ask a question; a role with no question is a step`);
  }

  /** ⛔ And the two registries stay disjoint — a name in both is an agent wearing the other's clothes. */
  for (const a of AUTHORS)
    assert.ok(!AGENTS.some((j) => j.name === a.name), `"${a.name}" is registered as both an author and a judge`);

  assert.deepEqual(unwrittenAuthors().map((a) => a.name), [], "an author is named in the registry with no prompt");
});

/**
 * ⛔ THE PRESET IS THE ROUTING, AND A ROUTING WITH A HOLE IN IT READS AS AN OVERSIGHT SOMEBODY
 * FILLS IN LATER.
 *
 * Peter: *"so like a tree, for the old skills like 'align' or 'exchange', we have a preset for
 * which agents to orchestrate consistently"*. Every skill gets a row, including the ones that
 * orchestrate nothing — `productos-edit` spawns nobody because one field is not worth a context,
 * and recording that is what stops somebody adding a scoper to it.
 */
test("every route names real roles, and none delegates the settling", () => {
  /**
   * ⛔ ONE SKILL, SEVERAL ROUTES. Peter: *"why do we need skills and commands?"* — a skill was
   * carrying which-roles-to-spawn, the authoring rules, and a v1 workflow. Only the first is a
   * skill's job, so the eight became routes under one entry point.
   */
  assert.equal(fs.readdirSync("skills").filter((d) => fs.existsSync(`skills/${d}/SKILL.md`)).length, 1,
    "there is more than one skill again — the routes belong under one entry point");
  assert.ok(fs.existsSync(`skills/${SKILL}/SKILL.md`), `the one skill is not at skills/${SKILL}`);

  assert.deepEqual(danglingSteps(), [], "a route names a role that is in neither registry");

  /**
   * ⛔ AND EVERY ROLE IS REACHABLE FROM A ROUTE.
   *
   * Four routes used to review things while naming no reviewer — `keeps` said "running the
   * reviewers" and no field said which — so `consistency` and `architecture` sat in the registry
   * reachable only by a session remembering them. Both exist because of failures here that no
   * file-scoped review could see, and both were the least likely to be run.
   */
  assert.deepEqual(unrouted(), [], "a role exists that no route names — it runs only when somebody remembers it");

  /**
   * ⛔ `keeps` IS WHAT MAKES THIS A MODEL RATHER THAN A FAN-OUT. Spawning four agents and forgetting
   * somebody still has to AGREE is how a corpus ends up fully written, fully checked, and validated
   * by nobody — so a route that keeps nothing is refused.
   */
  for (const sh of SHIMS) {
    assert.ok(sh.keeps.length, `the route "${sh.route}" keeps nothing — it has delegated the consent`);
    assert.ok(sh.when.length > 5, `the route "${sh.route}" says nothing about when somebody wants it`);
  }

  /** ⛔ And every route that touches truth keeps the settling by name. */
  for (const name of ["scope a feature", "scan a codebase", "drain the queue"]) {
    const sh = shimFor(name);
    assert.ok(sh, `the route "${name}" is gone`);
    assert.ok(
      sh.keeps.some((k) => /judgement|verdict|accept|consent|question|agree|validat/i.test(k)),
      `"${name}" touches truth and nothing in its keeps says the settling stays with the session`
    );
  }
});

/**
 * ⛔ THE ROUTES HAVE TO REACH THE SKILL, because `instruct` is the layer this project skips. A
 * routing table living only in `jobs.ts` is a table a future session never meets: it reads the
 * skill.
 */
test("the skill carries every route, generated, and has not drifted", () => {
  const f = `skills/${SKILL}/SKILL.md`;
  const body = fs.readFileSync(f, "utf-8");
  assert.match(body, /<!-- productos:preset -->/, `${f} carries no routes`);
  assert.equal(body, withPreset(body, SHIMS), `${f} has drifted — regenerate: productos v2 agents --presets`);
  for (const sh of SHIMS) assert.ok(body.includes(sh.does), `the route "${sh.route}" is not in the skill`);
  /** ⛔ The part outside the markers is hand-authored and must survive regeneration. */
  assert.ok(body.split("<!-- /productos:preset -->")[1].trim().length > 200, `${f} lost its authored body`);
});

/**
 * ⛔ THE REGISTRY HAS TO READ AS A TEAM, NOT A LIST.
 *
 * Peter: *"I'd rather build around 'traditional' roles first — product manager, engineer, designer,
 * QA — and then break the roles down within those. doesn't need to be formalized, but we should be
 * able to describe the roles based on who would have done each task."*
 *
 * Laying thirteen roles out by seat is what surfaced four missing jobs and two names that said
 * nothing. That only works if every role declares its seat and every seat has somebody in it — a
 * discipline with nobody in it is a question this project has stopped asking.
 */
test("every role sits in a discipline, and every discipline has somebody in it", () => {
  for (const r of [...AGENTS, ...AUTHORS]) {
    assert.ok(DISCIPLINES.includes(r.discipline), `"${r.name}" has no seat: ${r.discipline}`);
  }
  const seats = byDiscipline();
  assert.equal(seats.length, DISCIPLINES.length, `a discipline has nobody in it: ${DISCIPLINES.filter((d) => !seats.some((g) => g.discipline === d)).join(", ")}`);

  /**
   * ⛔ THE FRAMEWORK SEAT REVIEWS US AND NEVER A CORPUS, which is the distinction that was wrong
   * the first time it was sorted. Peter: *"consistency shouldn't be product OS only — we need to
   * make sure the product truth is consistent itself."* He was right that the question applies to
   * a corpus, and the answer was a new role rather than moving this one — so if anything in this
   * seat stops reading our own source, the split has quietly collapsed back.
   */
  for (const r of AGENTS.filter((a) => a.discipline === "the framework itself")) {
    assert.ok(
      r.reads.some((x) => /src\/|skills\/|test\/|the model/.test(x)),
      `"${r.name}" sits in the framework seat and reads no part of the framework`
    );
  }
  /** ⛔ And somebody asks the corpus version of the same question. */
  assert.ok(AGENTS.some((a) => a.name === "coherence" && a.discipline === "product"),
    "nothing asks whether a corpus contradicts itself — that was the whole point of splitting the seats");
});

/**
 * ⛔ HUMAN TRUTH IS NAILED DOWN BEFORE ENGINEERING AND QA ARE INVOLVED.
 *
 * Peter: *"i think scope a feature gets broken down a bit - we need to a rough scope, nail down
 * human truth before we need to involve engineers/qa"*.
 *
 * This is tenet one as an ordering, and `scope a feature` had broken it within an hour of the roles
 * being added: it spawned an engineering and a QA read in the same pass as the scoper, so somebody
 * was asked whether a draft could be built before anybody had agreed the draft was the product.
 * Two other routes acquired the same leak by a different door.
 *
 * ⛔ WHY IT IS A TEST AND NOT A SENTENCE: the failure is silent and it reads as thoroughness. More
 * reviewers on a feature looks like more care, and the output comes back phrased as fact — so a
 * session acts on an engineer's reading of truth nobody validated, with a reviewer's authority
 * behind it. Nothing downstream can tell that apart from a decision somebody made.
 */
test("engineering and QA do not read truth nobody has agreed to", () => {
  /**
   * ⛔ THE STAGE, NOT A SENTENCE OF MINE. The first version of this gated on the string "a human
   * has agreed to this truth" — a condition nothing in the model computed, so the gate could only
   * ever be a reminder. Peter named the stages, and `stageOf` derives them, so the precondition is
   * now a thing that can be ANSWERED about a feature.
   */
  const GATED = "ready for review";

  /** The seats that must wait. ⛔ Derived from the registry, so adding a role cannot dodge it. */
  const waits = new Set(
    AGENTS.filter((a) => a.discipline === "engineering" || a.discipline === "quality").map((a) => a.name)
  );

  for (const sh of SHIMS) {
    if (sh.at === GATED) continue;
    /**
     * ⛔ THE LINE IS WHAT THE ROLE JUDGES, NOT WHICH SEAT IT SITS IN.
     *
     * A role that rules on the CONTENT of the truth has to wait — is this buildable, would this
     * criterion prove anything. A role that reports a mechanical property of the artefact does not:
     * it is true or false about a draft, and most useful while the draft is still a draft.
     *
     *   coverage        does this claim have evidence attached — bookkeeping
     *   hand-authored   was this typed when a generator should have made it — ⛔ and it is worth
     *                   MOST before anybody reviews, because a hand-typed screen should not be
     *                   reviewed at all; it should be regenerated
     *   truthfulness    reads the built product against the target, not somebody's unagreed draft
     *   the framework   reviews ProductOS, which is not anybody's product truth
     *
     * This list was written with the first and third only, and the test immediately caught
     * `hand-authored` — which is the distinction being enforced rather than the heuristic that
     * approximated it.
     */
    const allowed = new Set([
      "coverage",
      "hand-authored",
      "truthfulness",
      "architecture",
      "consistency",
      "can-the-model-say-it",
    ]);
    for (const st of sh.steps) {
      if (!waits.has(st.role) || allowed.has(st.role)) continue;
      assert.fail(
        `the route "${sh.route}" spawns \`${st.role}\` and declares no precondition — ` +
          `that asks ${AGENTS.find((a) => a.name === st.role).discipline} to rule on truth nobody has agreed to. ` +
          `Either gate the route with after: "${GATED}", or move the step to a route that is gated.`
      );
    }
  }

  /** ⛔ And the route that was split must still stop, in its own words, where a person takes over. */
  const rough = shimFor("scope a feature");
  assert.ok(rough, "the route that produces rough truth is gone");
  assert.ok(
    rough.keeps.some((k) => /stopping here|hand/i.test(k)),
    "`scope a feature` no longer says it stops — the split is what makes human truth come first, and nothing else records it"
  );
  assert.ok(
    SHIMS.some((sh) => sh.at === GATED && sh.steps.length),
    "nothing picks the feature up after somebody agrees — the engineering and QA reads have been dropped rather than deferred"
  );
});
