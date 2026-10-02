import { FeatureDocument, isUndefinedBehavior } from "./product.js";
import type { FeatureTracking } from "./tracking.js";

/**
 * Deterministic feature audit. No LLM — pure pattern checks against the
 * Product Truth schema. Surfaces signals the skill / AI editor can then
 * help the user act on.
 *
 * Severities:
 *   - high: dangling refs, zero coverage on shipped features
 *   - medium: thin coverage, implementation-language in claims
 *   - low: missing optional metadata, naming polish
 */

export type AuditSeverity = "high" | "medium" | "low";

export interface AuditFinding {
  severity: AuditSeverity;
  kind: string;          // short tag: "thin-ux-coverage", "no-test-cases", etc.
  message: string;       // human-readable, one line
  feature_id: string;
  // Optional targeting hints — useful when the AI editor needs to act on the finding
  ux_id?: string;
  behavior_id?: string;
  element_id?: string;
}

const INTERACTIVE_KINDS = [
  "button", "input", "link", "cta", "select",
  "checkbox", "radio", "toggle", "stepper", "card", "row",
];

// Regex hits for implementation-leaning claim language.
const IMPL_LANGUAGE_PATTERNS = [
  /\bPOST\b|\bGET\b|\bPUT\b|\bDELETE\b|\bPATCH\b/,
  /\/api\//i,
  /HTTP\s*\d{3}/i,
  /\bstatus\s*(code\s*)?[34]\d\d\b/i,
  /\.tsx?\b|\.jsx?\b|\.py\b|\.go\b/,
  /\bfunction\s+\w+\(/,
  /\bclass\s+[A-Z]\w+/,
  /\bschema\b|\btable\b|\bcolumn\b/i,
];

// Behavior id smells: names a widget interaction rather than a rule.
const WIDGET_NAME_SUFFIX = /-(click|tap|button|press)$/;

// Feature-id smell: starts with an action verb, suggesting it's a sub-feature
// carved out of a noun-feature (e.g. "run-analysis" should probably be inside
// "risk-analysis"). When the feature also has few behaviors, that's the
// pre-decomposition pattern productos-scope explicitly warns against.
const ACTION_VERB_PREFIX = /^(run|trigger|view|show|see|get|create|delete|update|edit|add|remove|open|close|launch|start|stop|enable|disable|toggle)-/;

export function auditFeature(
  feature: FeatureDocument,
  allFeatures?: FeatureDocument[],
  tracking?: FeatureTracking | null,
  /** Set when the container's product / area / capability system has no README. */
  missingGroupingReadme?: string
): AuditFinding[] {
  const fm = feature.frontmatter;
  const findings: AuditFinding[] = [];
  const featureId = fm.id;

  // Feature-level
  if (!fm.description || fm.description.trim().length === 0) {
    findings.push({
      severity: "low",
      kind: "no-description",
      message: "Feature has no description.",
      feature_id: featureId,
    });
  }
  // ---- A grouping without a description is unnamed ----
  //
  // ⛔ HIGH, and learned the hard way: a corpus once rendered ten capabilities as a
  // flat list of verbs — "limit resolution", "deliver a version" — with nothing
  // anywhere saying what subsystem offered them. A directory name is not a
  // description, and the model asserts that a product, an area and a capability
  // system each have an identity.
  if (missingGroupingReadme) {
    findings.push({
      severity: "high",
      kind: "grouping-without-a-description",
      message: missingGroupingReadme,
      feature_id: featureId,
    });
  }

  // ⛔ Body checks are HIGH, and they are here rather than in a skill because
  // a skill saying "the body is required" demonstrably does not work — a scope
  // run following that exact instruction still produced a feature with no body
  // at all. An agent can ignore an instruction; it cannot ignore a finding that
  // reappears on every `productos gaps`.
  const body = feature.body.trim();
  if (body.length === 0) {
    findings.push({
      severity: "high",
      kind: "no-body",
      message:
        "Feature has no body. Behaviors say what is true; only the body says what " +
        "the thing IS and how its domain works. Without it the page reads as a list " +
        "of assertions about something the reader has not been told about.",
      feature_id: featureId,
    });
  } else if (body.length < 400 || !/^##\s/m.test(body)) {
    findings.push({
      severity: "medium",
      kind: "thin-body",
      message:
        "Feature body is thin. Aim for what it is, how it works in product terms, " +
        "the boundary it deliberately holds, and who works here.",
      feature_id: featureId,
    });
  }

  // The substrate must never surface in product truth. A filename or route in
  // the body is usually a sign that a real concept has no field and got written
  // as prose instead — which is how `kind:` and `question:` came to exist.
  const substrate = body.match(
    /\b[\w./-]+\.(md|ts|tsx|js|jsx|py|go|sql|ya?ml|json)\b|\b(?:table|column)s?\s+`?\w+`?|\brow \d+\b/i
  );
  if (substrate) {
    findings.push({
      severity: "medium",
      kind: "substrate-in-body",
      message:
        `Body names the storage substrate ("${substrate[0]}"). Readers never see ` +
        "files, tables or routes — the hosted service has no files at all. If the " +
        "fact has nowhere to live, it needs a field, not prose.",
      feature_id: featureId,
    });
  }

  // Lifecycle and validation have exactly one home each. Prose restating either
  // becomes a second record with no forcing function, and it rots silently.
  const provenance = body.match(
    /[✅📋🔄]|\b[A-Z]{2,5}-\d{2,6}\b|\bas of\b.*\bbranch\b|\bconverted from\b|\bnot built\b|\bspec (?:said|dated)\b/
  );
  if (provenance) {
    findings.push({
      severity: "medium",
      kind: "provenance-in-body",
      message:
        `Body carries provenance or status ("${provenance[0]}"). Lifecycle is ` +
        "`status:`, validation is a human stamp, and history belongs in git — prose " +
        "restating any of them is a competing record that goes stale silently.",
      feature_id: featureId,
    });
  }

  // ---- A declared-but-unscoped screen ----
  //
  // Reported so it cannot sit there silently: a stub is a promise to come back,
  // and an un-walked screen has unknown behavior. Medium, not high — declaring
  // the stub is the correct move and strictly better than the alternative of
  // filing its behaviors somewhere false.
  for (const u of fm.ux ?? []) {
    if (!u.stub) continue;
    const anchored = fm.behaviors.filter((b) => !b.deprecated && b.surface === u.id).length;
    findings.push({
      severity: "medium",
      kind: "unscoped-surface",
      message:
        `UX view "${u.id}" is a stub — declared but never walked${
          u.runtime ? ` (runs in ${u.runtime})` : ""
        }. ${anchored} behavior(s) anchor to it, and its real behavior is unknown until ` +
        `somebody scopes it.`,
      feature_id: featureId,
      ux_id: u.id,
    });

    // (stub-specific checks continue below)
    // ⛔ A stub whose only behaviors are about its own emptiness. A reader asked to
    // build one found the single anchored behavior was "an unbuilt tab says it is
    // unbuilt" — a claim about the placeholder — and concluded the model had no shape
    // for intent at all: "the brief in §2, the actual work product of my first day, has
    // nowhere to live." The shape exists (behaviors on a planned container, marked
    // `stated`); nobody had used it. A stub exists so an unscoped screen has a home,
    // not so it can hold a claim about being unscoped.
    const substantive = fm.behaviors.filter(
      (b) =>
        !b.deprecated &&
        b.surface === u.id &&
        !/\b(not built|unbuilt|placeholder|coming soon|says it is)\b/i.test(b.claim)
    ).length;
    if (substantive === 0) {
      findings.push({
        severity: "medium",
        kind: "stub-with-no-intent",
        message:
          `UX view "${u.id}" is a stub and nothing says what it must DO — only that it ` +
          "is not built. Write the intended behaviors: a screen somebody is going to " +
          "build needs its promises recorded before the code, which is the whole point " +
          "of a planned container.",
        feature_id: featureId,
        ux_id: u.id,
      });
    }
  }

  // ⛔ A SURFACE NOBODY WALKED, WITHOUT SAYING SO. `unscoped-surface` only fires on
  // `stub: true` — an honest declaration. This is the dishonest version: a surface with
  // claims anchored to it and no drawing and no named parts, which renders as a designed
  // screen and is a filename.
  //
  // Peter, on a corpus where five of eleven feature surfaces were in this state: "no UX.
  // how can the product PM agents decide this is ok w/o any UX?"
  for (const u of fm.ux) {
    if (u.stub) continue;
    const anchored = fm.behaviors.filter((b) => !b.deprecated && b.surface === u.id).length;
    const hasSketch = (u.sketch ?? "").trim().length > 0 || (u.sketch_html ?? "").trim().length > 0;
    const els = (u.elements ?? []).length;
    if (anchored > 0 && !hasSketch && els === 0) {
      findings.push({
        severity: "high",
        kind: "surface-never-walked",
        message:
          `UX view "${u.id}" carries ${anchored} behavior(s) and has no sketch and no ` +
          "named elements. A screen with claims anchored to it and nothing drawn was " +
          "never walked — mark it `stub: true` if that is the truth, or walk it. As it " +
          "stands it reads as a designed screen and is a name.",
        feature_id: featureId,
        ux_id: u.id,
      });
    }
  }

  // ⛔ ONE SCREEN CARRYING A FEATURE'S WORTH OF CLAIMS. A surface can be drawn, have named
  // parts, and still be a single box standing in for a whole interface: twenty-five claims
  // anchored to eleven elements means the modals, the empty state, the error state and the
  // loading state are all missing, because each of those is a thing a user sees and none
  // of them was declared.
  for (const u of fm.ux) {
    if (u.stub) continue;
    const anchored = fm.behaviors.filter((b) => !b.deprecated && b.surface === u.id).length;
    const els = (u.elements ?? []).length;
    if (anchored >= 12 && els > 0 && anchored > els * 1.5) {
      findings.push({
        severity: "medium",
        kind: "surface-carrying-a-feature",
        message:
          `UX view "${u.id}" carries ${anchored} behaviors across only ${els} named ` +
          `elements. A screen that does ${anchored} things has states somebody has not ` +
          "declared — a modal, an empty state, a failure state, a loading state. Split it " +
          "into the views a user actually sees, and anchor each claim to the one it " +
          "belongs to.",
        feature_id: featureId,
        ux_id: u.id,
      });
    }
  }

  // ⛔ A SCREEN WHOSE BEHAVIORS ARE ALL HAPPY PATH. The per-behavior check counts test
  // cases and flags happy-path-only; nothing counted BEHAVIORS per surface, so a screen
  // could carry eleven success-path claims and no failure state and look complete:
  //
  //   "Eleven of nineteen behaviors here describe the happy path and nobody notices. The
  //    checker counts test cases per behavior and flags happy-path-only; nothing counts
  //    behaviors per surface and flags success-path-only."
  //
  // The words are deliberately broad — a surface with three or more interactive elements
  // and not one claim about refusing, failing or being empty is a screen nobody has
  // thought about going wrong.
  const NEGATIVE = /\b(not|never|no |cannot|can't|refus|reject|fail|error|empty|absent|unavailable|missing|invalid|blank|instead of|rather than|unreadable|without)\b/i;
  for (const u of fm.ux) {
    if (u.stub) continue;
    const interactive = (u.elements ?? []).filter((e) =>
      INTERACTIVE_KINDS.includes((e.kind ?? "").toLowerCase())
    ).length;
    if (interactive < 3) continue;
    const anchored = fm.behaviors.filter((b) => !b.deprecated && b.surface === u.id);
    if (anchored.length === 0) continue;
    const negative = anchored.filter((b) => NEGATIVE.test(b.claim)).length;
    if (negative === 0) {
      findings.push({
        severity: "medium",
        kind: "surface-success-path-only",
        message:
          `UX view "${u.id}" has ${anchored.length} behavior(s) and not one of them says ` +
          "what happens when something is refused, fails, or is absent. A screen with no " +
          "failure state is a screen nobody has thought about going wrong — and the empty " +
          "state is what a user sees on day one.",
        feature_id: featureId,
        ux_id: u.id,
      });
    }
  }

  // ---- A capability may not carry screen-level evidence ----
  //
  // ⛔ REFUSED, not advised. A capability has no screens, so a claim that can
  // only be demonstrated by opening one is a feature behavior wearing the wrong
  // container. This is the check that catches the classification error at its
  // root: an add-in, a task pane, a mobile view or an unscoped screen all look
  // like "has no UI" from inside one repo, and all three are features. Anything
  // testable only through a screen belongs to whichever container owns it.
  if (fm.kind === "capability") {
    for (const b of fm.behaviors) {
      if (b.deprecated || isUndefinedBehavior(b)) continue;
      const e2e = b.test_cases.filter((tc) => !tc.deprecated && tc.level === "e2e");
      if (e2e.length > 0) {
        findings.push({
          severity: "high",
          kind: "capability-with-screen-evidence",
          message:
            `Behavior "${b.id}" is on a capability but has ${e2e.length} end-to-end ` +
            `case(s) — it can only be demonstrated through a screen, so it belongs to the ` +
            `feature that owns that screen. If no container owns it, the screen is ` +
            `unscoped: scope it rather than filing the behavior here.`,
          feature_id: featureId,
          behavior_id: b.id,
        });
      }
      // A capability claim narrating a person acting is a feature claim. The
      // actor is the tell, and it is cheaper to catch than the test level
      // because it shows up while the claim is being written.
      const actor = b.claim.match(
        /\b(?:the\s+)?(analyst|user|parent|kid|administrator|admin|loan officer|underwriter|reader|customer|operator)\b\s+\w*(?:s\b|es\b)?/i
      );
      if (actor) {
        findings.push({
          severity: "medium",
          kind: "capability-claim-narrates-a-person",
          message:
            `Behavior "${b.id}" is on a capability but its claim describes a person ` +
            `("${actor[0].trim()}") doing something. A capability promises an interface to ` +
            `other containers; a person acting is a feature, on the surface where they act.`,
          feature_id: featureId,
          behavior_id: b.id,
        });
      }
    }
  }

  // `depends_on` must name a capability that exists. A dangling or
  // wrong-kind dependency makes the blast-radius view quietly wrong rather
  // than visibly broken, which is the worst failure mode for a derived view.
  for (const dep of fm.depends_on) {
    const target = allFeatures?.find((x) => x.frontmatter.id === dep);
    if (!allFeatures) break;
    if (!target) {
      findings.push({
        severity: "high",
        kind: "dangling-dependency",
        message: `Depends on "${dep}", which does not exist.`,
        feature_id: featureId,
      });
    } else if (target.frontmatter.kind !== "capability") {
      findings.push({
        severity: "medium",
        kind: "depends-on-a-feature",
        message:
          `Depends on "${dep}", which is a feature rather than a capability. ` +
          "Either the relationship is `affected_by`, or the shared part is a " +
          "capability nobody has named yet.",
        feature_id: featureId,
      });
    }
  }

  if (fm.behaviors.length === 0) {
    findings.push({
      severity: "high",
      kind: "no-behaviors",
      message: `Feature has 0 behaviors${fm.status === "built" ? " (status: built)" : ""}.`,
      feature_id: featureId,
    });
  } else if (fm.status === "built") {
    const anyTests = fm.behaviors.some((b) => b.test_cases.length > 0);
    if (!anyTests) {
      findings.push({
        severity: "high",
        kind: "built-no-test-cases",
        message: "Feature is built but no behavior has any test cases.",
        feature_id: featureId,
      });
    }
  }
  // Pre-decomposition smell: feature id starts with an action verb
  // (run-, trigger-, view-, etc.) AND the feature itself is narrow
  // (≤ 4 behaviors AND ≤ 1 UX view). This is the exact pattern of an AI
  // carving a sub-feature out of a larger noun-feature instead of scoping
  // the whole thing. Suggest the parent noun.
  const slug = featureId.split("/").pop() ?? "";
  const verbMatch = slug.match(ACTION_VERB_PREFIX);
  if (verbMatch && fm.behaviors.length <= 4 && fm.ux.length <= 1) {
    const noun = slug.slice(verbMatch[0].length); // strip the "run-" prefix
    findings.push({
      severity: "medium",
      kind: "possibly-pre-decomposed",
      message: `Feature id "${featureId}" starts with the verb "${verbMatch[0].replace("-", "")}" and is narrow (${fm.behaviors.length} behavior${fm.behaviors.length === 1 ? "" : "s"}, ${fm.ux.length} UX view${fm.ux.length === 1 ? "" : "s"}). Was this scoped as a sub-feature when the parent "${noun}" should have been scoped whole?`,
      feature_id: featureId,
    });
  }

  // UX views
  const uxIds = new Set(fm.ux.map((u) => u.id));
  for (const u of fm.ux) {
    const anchored = fm.behaviors.filter((b) => b.surface === u.id);
    const interactive = u.elements.filter((e) =>
      INTERACTIVE_KINDS.some((k) => (e.kind || "").toLowerCase().includes(k))
    );
    if (interactive.length >= 2 && anchored.length <= 1) {
      findings.push({
        severity: "high",
        kind: "thin-ux-coverage",
        message: `UX view "${u.id}" has ${interactive.length} interactive elements but only ${anchored.length} behavior${anchored.length === 1 ? "" : "s"} anchored. Likely missing rules (validation, defaults, disabled-state, focus, error-paths).`,
        feature_id: featureId,
        ux_id: u.id,
      });
    }
    for (const el of u.elements) {
      const isNavLike = /button|link|cta|card|row/.test((el.kind || "").toLowerCase());
      if (isNavLike && !el.leads_to) {
        // Heuristic: only flag if the id reads navigational ("kid-card",
        // "view-detail", "open-X", "go-to-Y", or ends in -card/-row/-link)
        const nameSuggestsNav = /(card|row|link|button|cta|tab)$/.test(el.id) ||
          /^(view|open|go|see|show)-/.test(el.id);
        // ⛔ In-place actions must NOT carry leads_to — productos-scope §3a says
        // so explicitly for submits, steppers, deletes and toggles. Flagging
        // them here told authors to add a destination to a button that has
        // none, which is worse than the missing field: the renderer then makes
        // a submit look like navigation.
        const isInPlaceAction =
          /^(submit|save|confirm|cancel|delete|remove|apply|publish|discard|reset|close|dismiss|clear|send|toggle)([-_]|$)/.test(
            el.id
          ) ||
          /(submit|save|confirm|cancel|delete|remove|apply|publish|discard|reset|close|dismiss|clear|send|toggle)([-_]button)?$/.test(
            el.id
          );
        if (nameSuggestsNav && !isInPlaceAction) {
          findings.push({
            severity: "medium",
            kind: "missing-leads-to",
            message: `Element "${u.id}.${el.id}" looks navigational but has no leads_to.`,
            feature_id: featureId,
            ux_id: u.id,
            element_id: el.id,
          });
        }
      }
      if (!el.label && /button|link|cta|card|row|input/.test((el.kind || "").toLowerCase())) {
        findings.push({
          severity: "low",
          kind: "missing-label",
          message: `Element "${u.id}.${el.id}" has no label — flow chart shows the id as the action ("${el.id.replace(/-/g, " ")}").`,
          feature_id: featureId,
          ux_id: u.id,
          element_id: el.id,
        });
      }
    }
  }

  // Behaviors
  for (const b of fm.behaviors) {
    // ⛔ An UNDEFINED behavior is exempt from every claim-quality check below.
    // It has no claim, so it cannot have test cases, cannot be human-validated,
    // and cannot contain implementation language. Auditing it as though it were
    // a claim produces three high findings for one honestly-recorded open
    // question — which teaches authors to stop recording them.
    if (isUndefinedBehavior(b)) {
      // ⛔ "Settled by product." in `notes` is a structured fact written as prose, and
      // it was the shape every question in a real corpus used. As prose it cannot be
      // listed, counted or chased — nobody can ask "what is product sitting on?" — so
      // a named owner has exactly the same effect as no owner.
      if (!b.asked_of && /\b(settled|decided|answered|owned)\s+by\b/i.test(b.notes ?? "")) {
        findings.push({
          severity: "medium",
          kind: "question-owner-in-prose",
          message:
            `Behavior "${b.id}" names who settles it in \`notes\` rather than in ` +
            "`asked_of`. Move it: a question whose owner is prose cannot be chased.",
          feature_id: featureId,
          behavior_id: b.id,
        });
      }
      if (!b.asked_of) {
        findings.push({
          severity: "low",
          kind: "question-with-no-owner",
          message:
            `Behavior "${b.id}" asks a question nobody owes an answer to. Set ` +
            "`asked_of` — an unowned question stays open by default.",
          feature_id: featureId,
          behavior_id: b.id,
        });
      }
      if (b.blocks === undefined) {
        findings.push({
          severity: "low",
          kind: "question-blocks-unknown",
          message:
            `Behavior "${b.id}" does not say what it blocks. Set \`blocks\` — an empty ` +
            "list is a real and useful answer (\"the rest can ship without this\"), but " +
            "nobody having worked it out flattens a hard blocker and a nice-to-have " +
            "into the same warning.",
          feature_id: featureId,
          behavior_id: b.id,
        });
      }
      if (b.test_cases.length > 0) {
        findings.push({
          severity: "high",
          kind: "undefined-with-test-cases",
          message:
            `Behavior "${b.id}" is undefined (it asks a question) but carries test ` +
            "cases. There is no claim for them to demonstrate — either write the " +
            "claim and drop the question, or drop the cases.",
          feature_id: featureId,
          behavior_id: b.id,
        });
      }
      continue;
    }

    // ⛔ A declared-but-unwalked screen with nothing said about what it must DO. A reader
  // asked to build one found the only behavior on it was `an-unbuilt-tab-says-it-is-
  // unbuilt` — a claim about the placeholder — and concluded there was no shape for
  // intent at all: "the brief in §2, the actual work product of my first day, has
  // nowhere to live." There is a shape; nobody had used it. A stub exists so an unscoped
  // screen has a home, not so it can hold a claim about its own emptiness.
  // ⛔ THE HIGHEST-COST AMBIGUITY A FRESH READER FOUND, in the one form that can be
    // detected mechanically. A claim enumerating several specific values, with nothing
    // saying whose values they are, reads as a rule of the product to one engineer and
    // as one customer's data to another — "both will pass every existing test". The
    // threshold is deliberately several distinct decimals: one number in a claim is
    // usually a genuine product rule ("at most one outstanding per address"), while a
    // ladder of them is almost always somebody's configuration.
    if (!b.holds_for) {
      const decimals = new Set(
        (b.claim.match(/\b\d+\.\d+\b/g) ?? []).filter((n) => Number(n) !== 0)
      );
      if (decimals.size >= 3) {
        findings.push({
          severity: "medium",
          kind: "unscoped-literals",
          message:
            `Behavior "${b.id}" states ${decimals.size} specific values and does not ` +
            "say whose they are. Either set `holds_for` to name the scope, or — more " +
            "often correct — move the values out and claim the rule about them, " +
            "because a value that varies by customer is that customer's data and " +
            "belongs nowhere in product truth.",
          feature_id: featureId,
          behavior_id: b.id,
        });
      }
    }

    // ⛔ THE SAME TRAP, ONE LEVEL DOWN, AND IT IS WORSE THERE. A reviewer found the most
    // dangerous single artefact on a site was not a claim but a test case:
    //
    //   "Test case 1, stated with no qualification: 'the first is column J, the second L,
    //    the third N.' I guessed it is template-derived and I am not confident. The test
    //    case reads as a specification and would pass forever with J/L/N hard-coded. An
    //    engineer who does hard-code it is doing precisely what the test case told them
    //    to. There is no way to say 'true now, wrong after the change we have already
    //    decided to make.'"
    //
    // A claim is prose an engineer interprets; a test case is an instruction they
    // implement. So an unscoped literal in a case is more binding than the same literal
    // in the claim above it, and it is checked whether or not the claim was scoped.
    for (const tc of b.test_cases) {
      if (tc.deprecated) continue;
      const blob = [tc.given, tc.when, tc.then, tc.steps, tc.description]
        .filter(Boolean)
        .join(" ");
      const literals = new Set(
        (blob.match(/\b[A-Z]\b(?=[,\s.)])/g) ?? []).filter((x) => /[A-Z]/.test(x))
      );
      const decimals = new Set((blob.match(/\b\d+\.\d+\b/g) ?? []).filter((n) => Number(n) !== 0));
      if (!b.holds_for && (decimals.size >= 3 || literals.size >= 3)) {
        findings.push({
          severity: "medium",
          kind: "test-case-pins-a-literal",
          message:
            `Test case ${tc.id} on "${b.id}" pins specific values with nothing saying ` +
            "whose they are. A case is an instruction an engineer implements, so an " +
            "unscoped literal here is more binding than the same one in the claim — it " +
            "licenses hard-coding. Scope it, or state the rule and put the values in a " +
            "fixture.",
          feature_id: featureId,
          behavior_id: b.id,
        });
      }
    }

    // ---- Confidence must be earned, not asserted ----
    //
    // ⛔ An agent will claim the highest tier available unless something stops
    // it, which would make the whole signal noise. `stated` and `observed` are
    // claims ABOUT EVIDENCE, so they require the evidence; `guessed` requires
    // nothing, which is what makes it safe to be honest with.
    const bt = tracking?.behaviors?.[b.id];

    // ⛔ A citation nobody can follow. A reviewer found the authority for the single
    // most load-bearing rule on a page given as "PRD section 5.3":
    //
    //   "A document I do not have. The site cites it as the authority for the single
    //    most load-bearing rule on the page and does not link it. Evidence kinds include
    //    code citations with file and line; a document citation has no shape, so it was
    //    written as free text."
    //
    // A code ref at least names a file an engineer can open. A bare document name is a
    // claim of evidence with nothing behind it — which is `guessed` wearing `observed`'s
    // clothes.
    if (bt?.basis) {
      for (const bb of bt.basis) {
        if (bb.kind !== "document") continue;
        const reachable =
          /^https?:\/\//.test(bb.ref) || /[\/\\]/.test(bb.ref) || /\.\w{2,5}\b/.test(bb.ref);
        if (!reachable) {
          findings.push({
            severity: "medium",
            kind: "unreachable-citation",
            message:
              `Behavior "${b.id}" rests on document "${bb.ref}", which nobody reading ` +
              "this can open. Give a path or a link, or quote the sentence it relies on " +
              "— an authority a reader cannot reach is not evidence, it is a reference " +
              "to somebody's memory.",
            feature_id: featureId,
            behavior_id: b.id,
          });
        }
      }
    }

    if (bt?.confidence && bt.confidence !== "guessed" && bt.basis.length === 0) {
      findings.push({
        severity: "high",
        kind: "confidence-without-basis",
        message:
          `Behavior "${b.id}" claims ${bt.confidence} confidence with no basis. ` +
          `Cite what it rests on — a quoted sentence, a document section, a file:line — ` +
          `or lower it to "guessed", which needs no evidence and is not a defect.`,
        feature_id: featureId,
        behavior_id: b.id,
      });
    }
    // A proposal with no confidence at all cannot be triaged, so a reviewer has
    // no way to spend their attention where it matters.
    if (!bt?.confidence && bt?.status === "proposed" && !isUndefinedBehavior(b)) {
      findings.push({
        severity: "medium",
        kind: "no-confidence",
        message:
          `Behavior "${b.id}" was proposed without a confidence. A reviewer cannot tell ` +
          `a claim a person stated from one an agent inferred, so review has no order.`,
        feature_id: featureId,
        behavior_id: b.id,
      });
    }

    // A citation naming nothing is worse than none: the behavior claims to
    // defer to a rule, and the rule cannot be found to check.
    //
    // ⛔ THE SHAPE HAS THREE FORMS, and this pattern accepted one. It required
    // `^[a-z0-9-]+#[a-z0-9-]+$` — no slash — while GLOSSARY.md documents product-scoped
    // context as `cre/glossary#option` and subsystem context as
    // `capabilities/cre-templates/glossary#ladder`. So **13 of 37 citations in a real
    // corpus were reported malformed for following the documentation**, and the noise hid
    // the ones that were genuinely wrong: a `cre/principles#…` naming an anchor that
    // lives in the GLOBAL principles is a real error, and it rendered identically to the
    // false positives.
    //
    // A check that is wrong about its own documented syntax trains authors out of the
    // feature it is protecting.
    for (const ref of b.cites) {
      if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*#[a-z0-9-]+$/.test(ref)) {
        findings.push({
          severity: "medium",
          kind: "malformed-citation",
          message:
            `Behavior "${b.id}" cites "${ref}", which is not <doc>#<section>. ` +
            "Product-scoped context is `<product>/<doc>#<section>`; a subsystem's is " +
            "`capabilities/<system>/<doc>#<section>`.",
          feature_id: featureId,
          behavior_id: b.id,
        });
      }
    }

    // Dangling surface anchor
    if (b.surface && !uxIds.has(b.surface)) {
      findings.push({
        severity: "high",
        kind: "dangling-surface-anchor",
        message: `Behavior "${b.id}" anchors to UX view "${b.surface}" which doesn't exist.`,
        feature_id: featureId,
        behavior_id: b.id,
      });
    }
    // Dangling element anchor
    if (b.surface && b.element) {
      const u = fm.ux.find((x) => x.id === b.surface);
      if (u && !u.elements.some((e) => e.id === b.element)) {
        findings.push({
          severity: "high",
          kind: "dangling-element-anchor",
          message: `Behavior "${b.id}" anchors to element "${b.element}" on "${b.surface}" — element doesn't exist there.`,
          feature_id: featureId,
          behavior_id: b.id,
        });
      }
    }
    // Test cases
    if (b.test_cases.length === 0 && !b.deprecated) {
      findings.push({
        severity: fm.status === "built" ? "high" : "medium",
        kind: "no-test-cases",
        message: `Behavior "${b.id}" has 0 test cases.`,
        feature_id: featureId,
        behavior_id: b.id,
      });
    } else if (b.test_cases.length === 1 && !b.deprecated) {
      findings.push({
        severity: "medium",
        kind: "happy-path-only",
        message: `Behavior "${b.id}" has only 1 test case (likely happy path). Add an error or edge case.`,
        feature_id: featureId,
        behavior_id: b.id,
      });
    }
    // Shipped behaviors without a human-validated stamp.
    if (!b.deprecated && fm.status === "built" && !b.verified) {
      findings.push({
        severity: "medium",
        kind: "built-not-verified",
        message: `Behavior "${b.id}" is in a built feature but has no human-validated stamp. Use \`productos verify ${featureId} ${b.id}\` after confirming the claim.`,
        feature_id: featureId,
        behavior_id: b.id,
      });
    }
    // Implementation language in claim
    if (b.claim) {
      for (const re of IMPL_LANGUAGE_PATTERNS) {
        if (re.test(b.claim)) {
          findings.push({
            severity: "medium",
            kind: "impl-language",
            message: `Behavior "${b.id}" claim contains implementation language. Suggest rewriting in product terms.`,
            feature_id: featureId,
            behavior_id: b.id,
          });
          break;
        }
      }
    }
    // Widget-named id
    if (WIDGET_NAME_SUFFIX.test(b.id)) {
      findings.push({
        severity: "low",
        kind: "widget-named-behavior",
        message: `Behavior id "${b.id}" names a widget interaction rather than a rule. Suggest a rule-style id (e.g. "amount-must-be-positive" not "submit-button-click").`,
        feature_id: featureId,
        behavior_id: b.id,
      });
    }
  }

  // Stable order: by severity, then by kind.
  const sevRank = (s: AuditSeverity) => (s === "high" ? 0 : s === "medium" ? 1 : 2);
  findings.sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || a.kind.localeCompare(b.kind));
  return findings;
}

// ===========================================================================
// AREA ROLL-UP — aggregate findings across every feature in an area.
// ===========================================================================

export interface AreaAuditSummary {
  area_slug: string;
  feature_count: number;
  features: Array<{
    feature_id: string;
    title: string;
    counts: { high: number; medium: number; low: number; total: number };
  }>;
  totals: { high: number; medium: number; low: number; total: number };
}

export function auditArea(
  areaSlug: string,
  features: FeatureDocument[]
): AreaAuditSummary {
  const perFeature = features.map((f) => {
    const findings = auditFeature(f);
    const counts = {
      high: findings.filter((x) => x.severity === "high").length,
      medium: findings.filter((x) => x.severity === "medium").length,
      low: findings.filter((x) => x.severity === "low").length,
      total: findings.length,
    };
    return {
      feature_id: f.frontmatter.id,
      title: f.frontmatter.title,
      counts,
    };
  });
  perFeature.sort((a, b) => b.counts.high - a.counts.high || b.counts.total - a.counts.total);
  const totals = perFeature.reduce(
    (acc, x) => ({
      high: acc.high + x.counts.high,
      medium: acc.medium + x.counts.medium,
      low: acc.low + x.counts.low,
      total: acc.total + x.counts.total,
    }),
    { high: 0, medium: 0, low: 0, total: 0 }
  );
  return {
    area_slug: areaSlug,
    feature_count: features.length,
    features: perFeature,
    totals,
  };
}

export function renderAreaAuditAscii(summary: AreaAuditSummary): string {
  if (summary.feature_count === 0) return "  (no features in this area)";
  if (summary.totals.total === 0) return "  (no issues across this area — looks clean)";
  const lines: string[] = [];
  lines.push(
    `  Totals: ${summary.totals.high} high, ${summary.totals.medium} medium, ${summary.totals.low} low across ${summary.feature_count} feature${summary.feature_count === 1 ? "" : "s"}.`
  );
  lines.push("");
  for (const f of summary.features) {
    if (f.counts.total === 0) continue;
    const tag = `H:${f.counts.high} M:${f.counts.medium} L:${f.counts.low}`;
    lines.push(`    ${f.feature_id.padEnd(30, " ")}  ${tag}`);
  }
  return lines.join("\n");
}

export function renderAuditAscii(findings: AuditFinding[]): string {
  if (findings.length === 0) return "  (no issues — looks clean)";
  const groups: Record<AuditSeverity, AuditFinding[]> = { high: [], medium: [], low: [] };
  for (const f of findings) groups[f.severity].push(f);

  const lines: string[] = [];
  let n = 1;
  for (const sev of ["high", "medium", "low"] as AuditSeverity[]) {
    if (groups[sev].length === 0) continue;
    lines.push(`  ${sev.toUpperCase()}:`);
    for (const f of groups[sev]) {
      lines.push(`    ${String(n).padStart(2, " ")}. ${f.message}`);
      n++;
    }
  }
  return lines.join("\n");
}
