/**
 * ⛔ THE REVIEWER'S PAGE — the surface tenet 1 is actually performed on.
 *
 * The CLI was built to verify the model by running it, and then it got handed to a human as
 * though it were the interface. It is not: typing `--pick 2 --because "…"` is a person doing
 * a tool's filing. The acts themselves are unchanged — five of them, each recorded with a
 * name and a date — but the surface a person meets them on is a page with the question, the
 * options, and what it costs to guess wrong.
 *
 * ⛔ THIS FILE DERIVES NOTHING. Every fact on the page comes from `gridFor`, `questionsFor`,
 * `gateFor` or `actsFor`. A second derivation here would be a second answer to "is this
 * settled?", and which one a reader believes would depend on which surface they opened.
 *
 * ⛔ AND IT RECORDS NOTHING. The page presents; the act is recorded by the human's confirmed
 * press, through `settle`/`waive` like every other route. A renderer that writes verdicts
 * would be the MCP boundary broken by a longer path.
 */
import { resolveRules, type Corpus } from "./load.js";
import { scopeToShadow, liftFaces, PANE_FIT } from "./appcss.js";
import { promisesOf, screensOf, type ProtoPromise, type ProtoScreen } from "./prototype.js";
import { inferConnections, landingsFor, finishesFor, stateShowing, routeTable, screenAnswering } from "./connects.js";
import { pictureOf, unpicturedParts, STATE_CSS } from "./states.js";
import { deriveStates } from "./derive-states.js";
import { walkOf, type Walk } from "./walk.js";
import { inEffect, declined as declinedSteers, reaches } from "./steers.js";
import { AUTHORS } from "../core/jobs.js";
import { SLOTS, SLOT_ASKS_SHORT, statements, saysText, nothingHere, type SlotName, type Scope, type Steer, type View, type Part, type Says, type Prototype } from "./schema.js";
import { gridFor, gateFor, actsFor, ruleHomes, stageOf, reachOf, type Grid, type Cell } from "./grid.js";
import { stampFor, decidedFor, whatChangedSince } from "./stamp.js";
/** ⛔ The one table of what an act owes. It lived here and no other surface could read it. */
import { OWED } from "./acts.js";
import { confidenceOf, whyConfident, discrepancyFor } from "./confidence.js";
import { levelOf } from "./level.js";
import { wireParts } from "./wire.js";
import { questionsFor, descendants, type Question } from "./settle.js";
import { interviewFor, contextFor as interviewContext } from "./interview.js";
import { resolveRef } from "./ref.js";
import { demonstrationOf } from "./demonstrate.js";
/** ⛔ The packet's own readiness verdict, not a second one — see `readinessOf`. */
import { readinessOf } from "./packet.js";
import { decisionsOn, decisionsUnder, howItWasDecided, type Decision } from "./record.js";
import { holdsOn, whyHeld } from "./held.js";
import { selectionOf, gapsIn, type Selection, type Option } from "./selection.js";
import { dimensionsOf, sayCombination, variesBy } from "./dimensions.js";
import { capabilityTree, subsystemTrailsOf } from "./subsystems.js";

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** One line of prose, with the corpus's soft line wrapping flattened out. */
const line = (s: unknown): string => esc(String(s ?? "").replace(/\s+/g, " ").trim());

/**
 * ⛔ THE SAME NORMALISING, WITHOUT THE ESCAPING, FOR ANYTHING THE BROWSER WILL WRITE AS TEXT.
 *
 * `line()` escapes for HTML, which is right for markup and wrong for a value that goes into an
 * attribute and is later assigned to `textContent`: the attribute escaping happens once on the way
 * out and once more on the way in, so an area called "Pricing & loan terms" appeared in the
 * breadcrumb as "Pricing &amp;amp; loan terms" — rendered as "Pricing &amp; loan terms". Visible in
 * the crumbs and in the note composer's trail, on every title containing an ampersand or a quote.
 *
 * `esc()` still wraps it at the attribute boundary. This only drops the second pass.
 */
const plain = (s: unknown): string => String(s ?? "").replace(/\s+/g, " ").trim();

/**
 * A ref as an anchor. ⛔ One function, because a link and its target computing the slug
 * separately is how a nav that looks complete 404s on a third of its rows.
 */
const slug = (ref: string): string => ref.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
const anchorOf = (ref: string): string => `at-${slug(ref)}`;

/**
 * The address of a ref — a whole URL where there is a server, a fragment where there is not.
 *
 * ⛔ EVERY LINK ON THE PAGE WAS A FRAGMENT, AND A FRAGMENT IS NOT AN ADDRESS.
 *
 * Peter: *"we should have durable links for everything in product os. no idea why we use anchors
 * for everything."* Counted on the live page: 469 `href="#at-…"` and zero durable links.
 *
 * And the answer to "why" is not that it was a design choice. `/p/<project>/v2/<scope>` already
 * serves that scope's own page — 200, 1.98 MB, today — so the durable link existed and the page
 * never emitted one. The only code path that would is `refLink`'s cross-page branch, and it was
 * built from `linkBase: "/v2"`: root-relative, so on the hosted instance it resolved to `/v2/<id>`
 * and 404ed. Local serving made that look correct. Eighth instance of the class CLAUDE.md opens
 * on — "the environment convenient to measure in is not the environment the thing lives in".
 *
 * ⛔ WHAT A FRAGMENT COSTS is not theoretical: a `#` never reaches the server, so a link to a thing
 * is indistinguishable from a link to the page it is on. It cannot be served, cannot be redirected,
 * and tells an instance nothing about what the reader wanted — which is also why the whole corpus
 * had to ship in one packet before anybody could look at one feature of it.
 *
 * ⛔ A PATH FOR THE SCOPE, A FRAGMENT WITHIN IT — and that is the whole scheme rather than a
 * compromise. A ref below a scope (`money#balance`, a slot, a question) lives ON that scope's page,
 * so its address is that page plus where to look. The path is what the server resolves and the
 * fragment is what the browser does, which is the division every addressable document has.
 *
 * ⛔ AND NO BASE MEANS NO URL TO GIVE. `v2 page --out` writes a file and a published artifact is one
 * page; neither has an address to be durable about, so both keep fragments. The rule that a link is
 * only written where its target will exist is unchanged — see `refLink`.
 */
/** The chain of ids the menu shows above a scope — the crumb trail, which IS the menu. */
export type Trails = Record<string, Array<{ id: string; label: string }>>;

/**
 * Where every scope sits in the menu: the chain of ancestors above it.
 *
 * ⛔ THE TRAIL IS BUILT FROM THE SAME `in:` CHAIN THE TREE IS INDENTED BY. Computing it again in the
 * browser would be a second answer to "where am I", and the two would drift the first time a scope
 * moved. It used to live inside `renderNav`, which was right while it only drew crumbs — and wrong
 * the moment the URL became the menu path, because then the addresses and the breadcrumbs would
 * have been two derivations of one fact.
 *
 * ⛔ EVERY LEVEL IS SOMEWHERE YOU CAN STAND, so every crumb carries the id it navigates to. With
 * labels alone the ancestors were decoration: "Deals" sat above "The deals list" in the trail and
 * in the tree and did nothing in either, which is a link that failed as far as a reader can tell.
 *
 * ⛔ THE ROOT IS NOT A CRUMB. It is the Overview tab, so repeating it at the head of every trail
 * spent the widest part of the line on the one place the tab row already names — and read as a
 * level you could go up to that was in fact a different tab. It is also why `/v2/overview` is the
 * root's address rather than `/v2/<root-id>`.
 */
export function trailsOf(corpus: Corpus): Trails {
  // ⛔ plain(), not line(): these labels are written with textContent in the browser.
  const labelOf = (id: string) => plain(corpus.scopes.find((x) => x.scope.id === id)?.scope.title || id);
  const trail = (id: string): Array<{ id: string; label: string }> => {
    const out: Array<{ id: string; label: string }> = [];
    let at: string | undefined = id;
    const guard = new Set<string>();
    while (at && !guard.has(at)) {
      guard.add(at);
      out.unshift({ id: at, label: labelOf(at) });
      at = corpus.scopes.find((x) => x.scope.id === at)?.scope.in;
    }
    return out;
  };
  const trails: Trails = { overview: [{ id: "overview", label: "Overview" }] };
  for (const { scope } of corpus.scopes) {
    const t = trail(scope.id);
    trails[scope.id] = t.length > 1 ? t.slice(1) : t;
  }
  return trails;
}

/**
 * The address of a ref: the path through the menu to it.
 *
 * ⛔ NO FRAGMENTS. Peter: *"get rid of the fucking anchors. URLs should follow the menu structure"*,
 * and then, asked for the shape: *"v2/overview, v2/product/{feature}/{subfeature}, etc"*.
 *
 * The previous cut gave each scope a flat `/v2/<scope>` and still hung `#at-<scope>` off the end of
 * it, so the address bar read `/v2/part-0#at-part-0` — an address and an anchor saying the same
 * thing twice, in a shape that told a reader nothing about where they were. He called it largely
 * broken and he was right.
 *
 * ⛔ AND THE MENU PATH IS NOT A NEW DERIVATION. `trails` already holds exactly this chain, because
 * it is what the crumbs are drawn from — so the URL and the breadcrumb cannot disagree about where
 * something sits. Computing an ancestry here would be a second answer to a question the page has
 * already answered, which is the thing this repo keeps paying for.
 *
 * ⛔ A REF BELOW A SCOPE CONTINUES THE PATH. `money#balance#may` is `…/money/balance/may`: the `#`
 * separators of a ref are the same nesting the menu shows, so they become segments rather than an
 * anchor. Nothing in an address is a fragment any more.
 *
 * ⛔ EXCEPT WITH NO BASE, where there is no address to speak of — `v2 page --out` writes a file and
 * a published artifact is one page. A fragment is the only thing that can move within either, and
 * writing a URL there would be the defect rather than the fix.
 */
const addressIn =
  (base: string | undefined, trails: Trails) =>
  (ref: string): string => {
    if (!base) return `#${anchorOf(ref)}`;
    const [scope, ...rest] = ref.split("#");
    const menu = trails[scope!]?.map((c) => c.id) ?? [scope!];
    return `${base}/${[...menu, ...rest].map(encodeURIComponent).join("/")}`;
  };

/**
 * The address of a subsystem: `/v2/subsystems/<its own in: chain>`.
 *
 * ⛔ A SEPARATE TREE GETS A SEPARATE ADDRESS SPACE, AND THIS IS WHY IT MUST BE. Four ids in the real
 * corpus name BOTH a product scope and a subsystem — `resolve-a-documents-name` is one — so a flat
 * `/v2/<id>` would be two different pages competing for one address. Heading every subsystem path
 * with the `subsystems` segment keeps the trees apart in the URL the way they are kept apart in the
 * model: Peter, on what the model says, *"product scope sits under product, and they reference
 * capabilities"*.
 *
 * ⛔ AND IT SHARES `addressIn`'S FALLBACK. With no base there is no address to speak of — a
 * published artifact is one page — so it is a fragment, for the same reason and in the same shape.
 */
const subsystemAddressIn =
  (base: string | undefined, trails: Record<string, Array<{ id: string; label: string }>>) =>
  (id: string): string => {
    if (!base) return `#${anchorOf(id ? `subsystems#${id}` : "subsystems")}`;
    /** ⛔ The empty id is the tree itself — the one address above every subsystem. */
    const menu = id ? (trails[id]?.map((c) => c.id) ?? [id]) : [];
    return `${base}/${["subsystems", ...menu].map(encodeURIComponent).join("/")}`;
  };

/** What each slot asks. ⛔ Imported meaning, not a third copy — see `SLOT_ASKS` in the schema. */
const SLOT_LABEL: Record<SlotName, string> = {
  may: "may",
  with: "with",
  answer: "answer",
  after: "after",
  refuses: "refuses",
  fails: "fails",
  again: "again",
  at_once: "at once",
};

export interface PageOptions {
  /**
   * The subsystem this page is standing on, where the address named one.
   *
   * ⛔ SEPARATE FROM `scopeId`, because the two trees do not mix and four ids in the real corpus
   * name one of each. A page is either standing in product truth or in the machinery; conflating
   * them into one "here" is how the current row would get marked in the wrong tree.
   */
  subsystem?: string;
  /**
   * Which views arrive with their content, when the rest should arrive as they are asked for.
   *
   * ⛔ THE PAGE SHIPPED 144 SECTIONS AND SHOWED ONE.
   *
   * Peter: *"we should not be dumping everything in a single packet. we should be loading in the
   * appropriate information, like any other web app. this is ridiculous"*. Bilrost: 12 MB of stored
   * truth into a 49.8 MB document, 157s, 150s of it before the first byte.
   *
   * ⛔ AND THE REVIEW SURFACE DOES NOT GET WORSE, WHICH IS THE WHOLE RISK IN THIS CHANGE AND WAS
   * SETTLED BY READING `VIEW_SWITCH` RATHER THAN BY ARGUING ABOUT IT. `show(name)` already sets
   * `hidden` on every section but one, so reaching another feature is already a press. A section
   * that arrives when it is asked for is the same surface; a DRAWING that needs a press to appear
   * would not be, and that is why deferral is per SECTION and the drawings inside the one being
   * read stay where they are.
   *
   * Undefined renders everything, which is what a standalone file has to do — it has no server to
   * ask.
   */
  only?: string[];
  /**
   * Render one section and nothing else, for the endpoint that serves the rest.
   *
   * The whole page is still computed — the aggregates a section's content depends on are over the
   * subtree — and one section is returned. ⛔ Extracted on sentinels rather than by matching
   * `</section>`, because sections nest and the obvious regex would have returned the first inner
   * close for the two kinds that do.
   */
  fragment?: string;
  /**
   * Whether the acts are live.
   *
   * ⛔ `false` renders them visibly inert rather than omitting them, because a reviewer needs
   * to see what they will be asked to do — and an enabled-looking button that records nothing
   * is the one thing worse than no button.
   */
  interactive?: boolean;
  /** Where a press is recorded, shown to the reader so consent is informed. */
  recordsTo?: string;
  /**
   * ⛔ THE PAGE CALLS PRODUCTOS DIRECTLY, ON THE READER'S OWN MACHINE.
   *
   * Peter: "still kind of awkward — you update it, then i need to manually update the page?
   * there's no first class claude UX we can tap into?"
   *
   * There is, and it was unreachable for a reason that was ours: ProductOS registered its MCP
   * server in a file nothing reads, so it had never appeared to any host and a published page had
   * nothing to call. With it registered where the Claude app looks, a press can invoke the act
   * tool on the viewer's own device — no database, no carrying rows in, nobody in the loop.
   *
   * Set on `records: "mcp"`. The corpus never leaves the machine and the press lands in it
   * synchronously, which is the only arrangement where the page a person reviews in and the truth
   * they are reviewing are the same thing.
   */
  mcpServer?: string;
  /**
   * The application's own CSS, to be inlined inside each mock's shadow root.
   *
   * ⛔ The BYTES, not a path. Whoever builds the page decides whether to read the user's files —
   * the renderer is used from a test, from the CLI and from a server, and one of those reading the
   * filesystem behind the others' backs is how a page starts depending on the cwd it was rendered
   * from.
   */
  appCss?: string;
  /** Wrapper class the app's CSS expects around its own markup, from `web.mock_container_class`. */
  mockClass?: string;
  /**
   * The scheme the product ships, from `web.theme` — stamped on every mock's host.
   *
   * ⛔ THE MOCK OPTS IN THE WAY THE APPLICATION OPTS IN. A themed design system is scoped to an
   * attribute on the document root and does nothing without it, so the host carries that attribute
   * and the rewritten selectors ask for it there. Folding the chosen scheme in unconditionally was
   * the other option and it loses by one point of specificity: `html[data-theme=X]` outranks the
   * Tailwind build's `:root` deliberately, and a theme flattened to `:host` would be outranked by
   * the utilities it is supposed to re-colour — which looks like no theme at all, the exact defect
   * this field exists to end.
   */
  theme?: string;
  /**
   * Prefix for links to OTHER scopes, e.g. `/v2`. Omit for a standalone file, where a link
   * to a sibling page cannot resolve.
   *
   * ⛔ OMITTED MEANS NO CROSS-SCOPE LINK IS RENDERED AT ALL, rather than one that dead-ends.
   * A corpus is a tree of containers by design, so most of what a reviewer wants to reach is
   * in another scope — and a nav whose rows silently do nothing is worse than prose, because
   * they read as "already checked that".
   */
  linkBase?: string;
  /** The name a press is recorded under, so the page can say so before it is pressed. */
  by?: string;
  /**
   * Where a press goes.
   *
   * `"http"` POSTs to the ProductOS server that owns the corpus — nothing leaves the machine,
   * and the act is recorded synchronously. `"db"` writes a row to the artifact's own database,
   * which is the only channel available to a published page: a strict CSP blocks every request
   * to another host, so a page rendered inside Claude cannot reach localhost at all.
   */
  records?: "http" | "db" | "mcp";
}

/**
 * A ref as a link, or as plain text when it cannot resolve from here.
 *
 * ⛔ A NAV ROW THAT DOES NOTHING IS WORSE THAN PROSE — it reads as *already checked that*. v1
 * shipped nav links to pages that 404ed and `CLAUDE.md` calls it out by name, so the rule here
 * is mechanical: a cross-scope target needs a `base`, and without one the ref renders as text.
 */
function refLink(ref: string, ctx: Ctx, label?: string): string {
  /** ⛔ The words, never the address — see `refTitle`. A caller with a better label still wins. */
  const text = label ?? refTitle(ctx.corpus, ref);
  const scope = ref.split("#")[0]!;
  const within = ctx.here.includes(scope);
  /**
   * ⛔ AN IN-PAGE LINK IS ONLY WRITTEN WHERE ITS TARGET WILL EXIST, checked against the anchors this
   * render is actually going to emit.
   *
   * Reasoning that "same scope, therefore anchored" held on the seed and produced **357 dead
   * anchors** on the first real corpus: a gated exchange card offers "decide it" per blocking slot,
   * and a slot waiting on an org-wide question has no anchor of its own because it is answered at
   * the rule. The seed never showed it, because every gated slot there IS a question with a card.
   *
   * Same-scope-ness was never the property that mattered. Whether the anchor gets rendered is.
   */
  /**
   * ⛔ THE ANCHOR IS ASKED FIRST, BEFORE WHICH SCOPE THIS IS FILED UNDER.
   *
   * An org-wide rule's id carries no scope, so `within` was false for every one of them and the
   * rule's own question card — rendered on this page, with this anchor — came out as unlinked text
   * saying "filed under …, which this page does not contain". It was on the page.
   *
   * ⛔ AND THE DESTINATION IS `ctx.url`, NOT A BARE ANCHOR. The durable form is the menu path, so a
   * reader who has found the thing can send somebody to it — a fragment on its own is only an
   * address if you already know which page you were on. Both halves of this were written at once by
   * different sessions; the ordering fix is one, the URL form is the other.
   */
  if (ctx.anchors.has(ref)) return `<a href="${esc(ctx.url(ref))}">${esc(text)}</a>`;
  if (within) return `<span class="unlinked" title="nothing on this page answers that directly">${esc(text)}</span>`;
  /** ⛔ No scope id in the tooltip: a title is something a reader sees, and that is an address. */
  if (!ctx.base) return `<span class="unlinked" title="this page does not contain it">${esc(text)}</span>`;
  return `<a href="${esc(ctx.url(ref))}">${esc(text)}</a>`;
}

/**
 * Any ref, in the words somebody wrote — never the address it is filed under.
 *
 * ⛔ A REF IS SUBSTRATE AND IT WAS REACHING THE READER. Question cards were headed
 * `money#record-spending#after`, rules printed their slug under the sentence, and
 * *"answering this settles 1 other slot"* named the slot by id. Every one of those is an address:
 * it exists so that two surfaces can agree which thing they mean, and this file's own rule is that
 * nothing a reader sees mentions the storage.
 *
 * ⛔ AND IT FALLS BACK TO WORDS, NOT TO THE REF. A ref this corpus cannot name is a bug in the
 * corpus or in whoever built the ref — printing it would be the leak this function exists to stop,
 * dressed up as a diagnostic.
 */
function refTitle(corpus: Corpus, ref: string): string {
  const [sid, eid, slot] = ref.split("#");
  const sc = corpus.scopes.find((x) => x.scope.id === sid)?.scope;
  /** A bare rule id — one segment, no scope under it. */
  if (!eid) {
    const r = corpus.rules.find((x) => x.rule.id === ref);
    if (r) return plain(r.rule.statement || r.rule.standing?.question || "a rule that holds everywhere");
    return plain(sc?.title ?? "somewhere in this product");
  }
  const ex = sc?.exchanges.find((x) => x.id === eid);
  const asks = SLOT_ASKS_SHORT[slot as SlotName];
  const head = plain(ex?.title ?? "");
  if (head && asks) return `${head} — ${asks}`;
  if (head) return head;
  if (asks) return asks;
  return plain(sc?.title ?? "somewhere in this product");
}

/**
 * The address, behind a press, for whoever needs to carry it somewhere else.
 *
 * ⛔ IT IS A COPY BUTTON RATHER THAN TEXT, which is the whole trade. An agent grooming a ticket and
 * a session running the CLI both need the ref; a person reviewing never does, and it was printed
 * for both. On a button it costs one press for whoever wants it and no line of the page for
 * everybody who does not.
 */
function copyRef(ref: string): string {
  return `<button type="button" class="copy-ref" data-copy="${esc(ref)}" title="Copy the address of this, for a ticket or the command line" aria-label="Copy the address of this">copy address</button>`;
}

// ---------------------------------------------------------------------------
// The questions — the reviewer's actual work, so they come first.

interface Ctx {
  /**
   * ⛔ CARRIED, SO A REF CAN BE TURNED INTO WORDS WHEREVER ONE IS RENDERED. Every helper that draws
   * a link had the ref and not the corpus, so the only label it could produce was the ref itself —
   * which is how an address ended up at the head of every question card.
   */
  corpus: Corpus;
  base?: string;
  /**
   * The address of a ref, as a path through the menu.
   *
   * ⛔ ON THE CONTEXT RATHER THAN RECOMPUTED, because it closes over `trails` — and `trails` is what
   * the crumbs are built from, so a link and the breadcrumb above it cannot disagree.
   */
  url: (ref: string) => string;
  here: string[];
  /** Every ref this render will emit an anchor for. */
  anchors: Set<string>;
  /**
   * Whether this page has somewhere to fetch from.
   *
   * ⛔ A THUMBNAIL THAT CAN NEVER FILL IS A SCREEN WITH NO PICTURE, which this repo treats as a real
   * defect. Making every thumbnail lazy regardless produced exactly that: `v2 page --out` wrote a
   * file with 48 blank tiles, no drawings in it, and no server to ask — found by rendering the three
   * modes side by side rather than by it breaking later.
   *
   * So the two wins are separated, because they need different things:
   *
   *   · ONE COPY PER DRAWING needs no server and is always on. Everything that shows a screen
   *     clones from the bank, which is where the 5x went.
   *   · FETCHING ON SCROLL needs an endpoint, so it is only on when the page is served.
   */
  served?: boolean;
}

function renderQuestion(q: Question, i: number, past: Decision[], ctx: Ctx): string {
  const acts: string[] = [];
  const id = `q${i}`;
  /**
   * ⛔ THE OPTIONS CARRY THEIR OWN ARGUMENT AND ARE PRESSABLE ONE AT A TIME.
   *
   * On the CLI this was `--pick N`, which requires the reviewer to have read a numbered list
   * in one command's output and retyped the number into another. The number was never the
   * point; choosing between two stated consequences is.
   */
  const options = q.candidates
    .map((c, n) => {
      const says = c.says
        ? line(c.says)
        : c.none
          ? "<em>nothing to refuse</em>"
          : (c.outcomes ?? [])
              .map((o) => `refuses <strong>${esc(o.name)}</strong> when ${line(o.when)} → ${line(o.told)}`)
              .join("<br>");
      return `
        <div class="opt">
          <div class="opt-n">${n + 1}</div>
          <div class="opt-body">
            <p class="opt-says">${says}</p>
            ${c.consequence ? `<p class="opt-why">${line(c.consequence)}</p>` : ""}
            ${
              c.replaces === "only the part in question"
                ? `<p class="opt-flag">answers only the part in question — a ruling here becomes the whole sentence, so this one has to be written out</p>`
                : ""
            }
            <button class="act" data-act="rule" data-ref="${esc(q.ref)}" data-pick="${n + 1}" data-q="${id}"${
              /**
               * ⛔ A RULE-GRAINED QUESTION IS THE COMMON CASE IN THE QUEUE AND IT WAS THE BROKEN ONE.
               * An org-wide ruling owes what would show it holding; a slot's demonstration is a
               * criterion on its exchange and is not asked for here. The ref tells them apart: a
               * rule id carries no `#`.
               */
              q.ref.includes("#") ? "" : ` data-owes="then"`
            }>
              This one
            </button>
          </div>
        </div>`;
    })
    .join("");

  if (q.revises) {
    /**
     * ⛔ ONE PER LINE WHERE THERE IS MORE THAN ONE, so "this much of it is unruled" is legible
     * against the thing it is part of. Glued into a paragraph, a seven-statement slot gave a
     * reviewer no way to see which of the seven an option would touch.
     */
    const each = q.saysEach ?? [];
    const already =
      each.length > 1
        ? `<ul class="says-each">${each
            .map(
              (x) =>
                `<li${x.inQuestion ? ' class="in-question"' : ""}>${line(x.says)}${
                  x.inQuestion ? ' <span class="tag">this one is unruled</span>' : ""
                }</li>`
            )
            .join("")}</ul>`
        : `<p class="v">${line(q.revises)}</p>`;
    /**
     * ⛔ AND IT NO LONGER CONTRADICTS THE BUTTONS BESIDE IT. This said "has to be written rather
     * than picked" unconditionally, while the options above it each rendered a pressable "This
     * one" — so the page told a reviewer they could not do the thing it was offering. The CLI
     * had `candidatesAreWhole` for exactly this and the page read it nowhere.
     */
    const note = !q.candidates.length
      ? "Nothing is drafted here, so a ruling has to be written out."
      : q.candidatesAreWhole
        ? "Each option is the whole sentence, so picking one replaces it cleanly."
        : each.length > 1
          ? each.some((x) => x.inQuestion)
            ? "Each option replaces the marked statement only. The others stand exactly as they are."
            : "Each option answers only the part in question. The other statements above stand; picking one does not remove them."
          : "Each option answers only the part in question.";
    acts.push(`
      <div class="revises">
        <p class="k">it already says</p>
        ${already}
        <p class="k">and this much of it is unruled</p>
        <p class="v">${line(q.about)}</p>
        <p class="note">${note}</p>
      </div>`);
  }

  return `
    <article class="q${q.parked ? " parked" : ""}" id="${anchorOf(q.ref)}" data-ref="${esc(q.ref)}" data-label="${esc(`undecided · ${refTitle(ctx.corpus, q.ref)}`)}">
      <header>
        ${
          /**
           * ⛔ THE ADDRESS IS GONE FROM THE HEAD OF THE CARD. Every card in the queue was headed
           * `money#record-spending#after` or `what-a-kid-sees-of-a-sibling` — ids, and the project's
           * own rule is that the substrate never reaches a reader.
           *
           * ⛔ AND NOTHING TOOK ITS PLACE, which is the part worth saying. The obvious repair was to
           * print the title there instead, and that is a second copy: the question is the heading
           * immediately below and where it applies is the line under that. A header restating
           * either would be a third rendering of a fact with one home.
           *
           * The ref itself is still reachable — one press, for whoever has to carry it into a
           * ticket or a command.
           */
          ""
        }
        <span class="kind">${esc(q.kind)}</span>
        ${copyRef(q.ref)}
        ${q.parked ? `<span class="badge parked">parked</span>` : ""}
        ${
          q.conflictsWith.length
            ? `<span class="badge bad">disputed with ${q.conflictsWith.map((c) => refLink(c, ctx)).join(", ")}</span>`
            : ""
        }
      </header>
      <h3>${line(q.asks)}</h3>
      ${
        q.exchangeTitle
          ? `<p class="where">on ${
              /**
               * ⛔ A RULE-LEVEL QUESTION HAS NOWHERE TO LINK TO, AND LINKING ANYWAY WAS A DEAD ANCHOR.
               *
               * `openRuleQuestions` puts the human-readable label `(an org-wide rule)` where an
               * exchange id goes, so building a ref from it produced `href="#at-…-an-org-wide-rule"`
               * pointing at nothing. And the obvious repair — link to the rule's own entry — is also
               * wrong: an unsettled rule has no statement, so it governs nothing, so no grid lists
               * it. This card IS the rule's only home on the page.
               */
              /**
               * ⛔ AND A RULE'S LABEL IS NOT PRINTED AS IT ARRIVES. `questionsFor` builds it as
               * *"Every exchange like these: money#see-a-balance"* — a sentence with an address
               * inside it, which reached the reader intact because this trusted the string. A rule
               * reaches whatever its selector reaches; the behaviours it is holding up are named,
               * one per line, by the "answering this settles" list further down this same card.
               */
              q.ref.includes("#")
                ? refLink(`${q.scope}#${q.exchange}`, ctx, q.exchangeTitle)
                : "every behaviour this rule reaches"
            }${q.slot ? ` · ${esc(SLOT_LABEL[q.slot] ?? q.slot)}` : ""}</p>`
          : ""
      }
      ${
        /**
         * ⛔ WHAT THE FEATURE IS FOR, AND WHAT THIS BEHAVIOUR GIVES BACK — THE QUESTION ARRIVED
         * WITH NEITHER.
         *
         * Peter: *"I need context for the questions being asked, not a question out of the blue
         * about a behavior of a feature. always give context in the question"*, and *"explain the
         * question"*.
         *
         * The card had the question, the address of the behaviour, and the slot's label. That is
         * where it is, not what it is about: a reader met *"Does pinning a worked-out figure by
         * hand make it settled?"* with no statement of what the feature is for and no sentence
         * saying what the behaviour does, both of which are in the corpus three lines away.
         *
         * ⛔ TWO SLOTS, NOT EIGHT — see `GROUNDING` in interview.ts for what printing all of them
         * did. `revises` already renders the statements being ruled on, directly below this, so
         * this is deliberately only the grounding a reader needs to judge those.
         */
        (() => {
          const a = interviewContext(ctx.corpus, q.scope, q.ref.includes("#") ? q.exchange : undefined, q.slot);
          const rows = [
            ...(a.purpose ? [{ k: "what this feature is for", v: a.purpose }] : []),
            ...a.already.map((x) => ({ k: x.asks, v: x.says })),
          ];
          if (!rows.length) return "";
          return `<div class="q-ctx">${rows
            .map((r) => `<p><span class="k">${esc(r.k)}</span> ${line(r.v)}</p>`)
            .join("")}</div>`;
        })()
      }
      ${acts.join("")}
      ${q.cost ? `<div class="cost"><p class="k">what guessing wrong costs</p><p>${line(q.cost)}</p></div>` : ""}
      ${
        q.observed.length
          ? `<div class="observed"><p class="k">what has actually been seen</p><ul>${q.observed
              .map((o) => `<li>${line(o.says)} <span class="basis">${line(o.basis)}${o.at ? ` · ${esc(o.at)}` : ""}</span></li>`)
              .join("")}</ul></div>`
          : ""
      }
      ${
        q.blocks.length
          ? `<p class="blocks">answering this settles <strong>${q.blocks.length}</strong> other ${
              q.blocks.length === 1 ? "slot" : "slots"
            }: ${
              /** ⛔ Not in `<code>` any more: these are sentences now, and code type says "address". */
              q.blocks.map((b) => refLink(b, ctx)).join("; ")
            }</p>`
          : ""
      }
      ${options ? `<div class="opts">${options}</div>` : ""}
      ${
        q.parked
          ? `<p class="parked-why">parked by ${esc(q.parked.by)} — ${line(q.parked.because)}<br>
               <span class="k">back when</span> ${line(q.parked.until)}</p>`
          : ""
      }
      <footer class="q-acts">
        <button class="act ghost" data-act="say" data-ref="${esc(q.ref)}" data-q="${id}">Write the answer myself</button>
        ${
          q.parked
            ? ""
            : `<button class="act ghost" data-act="defer" data-ref="${esc(q.ref)}" data-q="${id}">Not now</button>`
        }
        <button class="act ghost" data-act="waive" data-ref="${esc(q.ref)}" data-q="${id}">The builder decides this</button>
      </footer>
      ${
        q.needsThen
          ? `<p class="owes">This is an org-wide rule, so ruling it owes what would show it holding — a rule that demonstrates nothing is an aspiration.</p>`
          : ""
      }
      ${
        q.asksPolarity
          ? `<p class="owes">This case asks <em>whether</em> it refuses at all — the answer decides whether the case survives.</p>`
          : ""
      }
      ${
        /**
         * ⛔ THIS ONE STAYS, AND IT IS NOT THE THING PETER OBJECTED TO.
         *
         * On a behaviour card the log answered a question nobody asked. On a QUESTION, the record
         * is the answer: what was decided, why, which option was chosen and — the reason
         * `also_considered` exists at all — what was rejected. Stripping it here would delete the
         * only thing standing between a settled question and somebody relitigating it from scratch.
         *
         * It is also empty while a question is open, so it never appears as clutter beside
         * something undecided.
         */
        renderRecord(past)
      }
    </article>`;
}

/**
 * What was decided here, and how.
 *
 * ⛔ THE OPTIONS THAT LOST ARE ON THE PAGE. `also_considered` is written on every pick and was
 * rendered nowhere — recorded specifically so a decision would not be relitigated from scratch,
 * and then invisible to the one person about to relitigate it. Same for `chose`, `option_said`
 * and `via`.
 */
/**
 * ⛔ CONFIRMED, OR NOT, BESIDE THE SENTENCE — AND NOT A LOG OF ACTS.
 *
 * Peter: *"if it's confirmed, the state should be obvious, there shouldn't be a list of human
 * judgement record. we should show confirmed or not next to a behavior."*
 *
 * Every behaviour card carried a collapsed "3 acts of human judgement recorded here", which answers
 * a question nobody was asking. What a reviewer needs from a sentence they are about to judge is
 * whether it has been judged — one word, visible without opening anything. The provenance still
 * exists in the verdict log, which is where an audit belongs; a card is a decision surface.
 *
 * ⛔ IT READS THE SAME `stampFor` EVERY GATE READS, so "confirmed" on this page cannot disagree
 * with `check` — three surfaces each built their own accepted-set once, and the packet printed
 * "accepted separately" for rules with no verdict at all.
 *
 * ⛔ AND IT SHOWS A STALE STAMP AS NOT CONFIRMED. If the sentence changed after somebody agreed,
 * `stampFor` says so, and a badge reading "confirmed" over a sentence they never read is the exact
 * failure the stale states exist to catch.
 */
function renderState(corpus: Corpus, ref: string): string {
  const st = stampFor(corpus, ref);
  if (st.state === "accepted")
    return `<p class="beh-state ok"><b>confirmed</b><span>by ${esc(st.by)} on ${esc(st.at)}</span></p>`;
  if (st.state === "never") return `<p class="beh-state"><b>not confirmed</b><span>nobody has agreed to this yet</span></p>`;
  const what =
    st.state === "claim-changed"
      ? "the sentence changed after it was agreed to"
      : st.state === "criteria-changed"
        ? "what would show it changed after it was agreed to"
        : "the sentence and what would show it both changed after it was agreed to";
  return `<p class="beh-state warn"><b>not confirmed</b><span>${esc(st.by)} agreed on ${esc(st.at)}, but ${what}</span></p>`;
}

function renderRecord(ds: Decision[]): string {
  if (!ds.length) return "";
  return `
    <details class="record">
      <summary>${ds.length} act${ds.length === 1 ? "" : "s"} of human judgement recorded here</summary>
      <ol>${ds
        .map(
          (d) => `
        <li>
          <span class="dact">${esc(d.act)}</span>
          <span class="dhow">${line(howItWasDecided(d))}</span>
          ${d.says ? `<p class="dsays">${line(d.says)}</p>` : ""}
          ${d.because ? `<p class="dwhy"><span class="k">because</span> ${line(d.because)}</p>` : ""}
          ${d.chose ? `<p class="dwhy"><span class="k">chose</span> ${line(d.chose)}${d.optionSaid ? ` — the argument for it: ${line(d.optionSaid)}` : ""}</p>` : ""}
          ${d.alsoConsidered ? `<p class="dwhy"><span class="k">also considered</span> ${line(d.alsoConsidered)}</p>` : ""}
          ${d.replaced ? `<p class="dwhy"><span class="k">it used to say</span> ${line(d.replaced)}</p>` : ""}
          ${d.until ? `<p class="dwhy"><span class="k">back when</span> ${line(d.until)}</p>` : ""}
          ${d.buildable === undefined ? "" : `<p class="dwhy">${d.buildable ? "could build from it" : "could NOT build from it"}${d.blockedBy?.length ? ` — stopped by ${d.blockedBy.map((b) => `<code>${esc(b)}</code>`).join(" ")}` : ""}</p>`}
          ${d.note ? `<p class="dwhy">${line(d.note)}</p>` : ""}
        </li>`
        )
        .join("")}</ol>
    </details>`;
}


/**
 * A scope's prose, as paragraphs.
 *
 * ⛔ THE CORPUS KEPT THIS AND THE PAGE NEVER SHOWED IT, so every scope read as blank — the product,
 * every area, every feature. The body is where a reader is told what the thing IS: what the domain
 * is, where the boundary sits, who works here. A page of behaviours with no framing asks somebody to
 * review sentences about a thing nobody has described to them.
 *
 * ⛔ Deliberately not a markdown renderer. Paragraphs, bold, inline code, and a heading dropped
 * because the title is already on screen — anything more and this becomes a parser nobody asked
 * for, with its own bugs, inside a tool about not inventing things.
 */
function renderProse(body: string): string {
  const text = body.trim();
  if (!text) return "";
  const paras = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b && !/^#{1,6}\s/.test(b))
    .map((b) =>
      esc(b.replace(/\s+/g, " "))
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
    );
  return paras.length ? `<div class="prose">${paras.map((b) => `<p>${b}</p>`).join("")}</div>` : "";
}


/**
 * The screens a scope's asks arrive at.
 *
 * ⛔ THE PAGE NEVER SHOWED THESE, and the packet always did. So the surface built for reviewing a
 * behaviour showed the behaviour and not the control it arrives at, while the artefact for BUILDING it
 * showed both — exactly backwards. A reviewer asked whether "Deal row on CRE Deals" is right, with
 * no picture of the list it sits in, is being asked to review a sentence about a screen they have
 * not seen.
 *
 * ⛔ The sketch is interface structure, not design — where things sit and what kind of thing they
 * are. It is rendered verbatim, in a monospaced block, because it was drawn to be read that way and
 * anything cleverer would be this tool inventing a layout.
 */
/**
 * ⛔ A PROTOTYPE, NOT A PICTURE OF ONE.
 *
 * Peter: "we need to actually incorporate real UX. this is useless without UX. it should be able to
 * render prototypes, and per-card show the interactions interactively."
 *
 * He is right, and the reason is the whole review loop: a behaviour like "the deal row refuses" is
 * unjudgeable in the abstract. The reviewer needs to see the row, see what else is on the screen
 * with it, and follow where it goes. A fenced block of box-drawing characters and a flat list of
 * part names below it is a screenshot of a wireframe — nothing on it can be pointed at, and the
 * part list and the drawing sat side by side with no relation between them stated.
 *
 * The model already connects them: an exchange arrives `at: {view, part}`. Nothing rendered it. The
 * old body computed the anchor for exactly this and threw it away (`void at`).
 *
 * ⛔ A published page cannot reach the running app — a strict CSP blocks every external host — so a
 * prototype here is built from what the corpus itself says: the sketch for the layout, the parts
 * for what is interactive, `leads_to` for where each one goes. That is a real constraint and also
 * the right one: a prototype that needed the dev server running would stop being reviewable the
 * moment anybody closed their laptop.
 */

/** The screen's own title, for a caption that names where a sentence lands. */
function viewTitle(corpus: Corpus, scopeId: string, viewId: string): string {
  const v = corpus.scopes.find((s) => s.scope.id === scopeId)?.scope.views.find((x) => x.id === viewId);
  return plain(v?.title || viewId);
}

/** The human name of a part, so a card can offer "show me the deal row" rather than an id. */
function partLabel(corpus: Corpus, scopeId: string, viewId: string, partId: string): string {
  const v = corpus.scopes.find((s) => s.scope.id === scopeId)?.scope.views.find((x) => x.id === viewId);
  const pt = v?.parts.find((p) => p.id === partId);
  return line(pt?.label || partId);
}

/**
 * ⛔ THE PROTOTYPES WERE THREE LEVELS DOWN AND NOTHING POINTED AT THEM.
 *
 * Peter, after they shipped: "are we done? i don't see anything." They were on the twelve leaf
 * feature views, so the only way to reach one was to already know which feature drew it — and the
 * landing surface said nothing about screens existing at all.
 *
 * ⛔ THIS LINKS, IT DOES NOT COPY. Rendering each prototype a second time here would put one
 * screen's controls in two places in the DOM: the same `data-part` twice, so selecting one would
 * resolve to whichever copy came first — possibly the one inside a hidden view. Every fact has one
 * home; this is an index to those homes.
 */
function renderScreenIndex(corpus: Corpus, ids: string[], ctx: Ctx): string {
  const rows = ids.flatMap((id) => {
    const sc = corpus.scopes.find((s) => s.scope.id === id)?.scope;
    if (!sc) return [];
    return sc.views
      .filter((v) => v.exists !== "withdrawn")
      .map((v) => {
        const said = sc.exchanges.filter((e) => e.at?.view === v.id).length;
        const live = v.parts.filter((p) => !p.decorative && p.role !== "display" && p.role !== "region");
        const silent = live.filter((p) => !sc.exchanges.some((e) => e.at?.view === v.id && e.at?.part === p.id)).length;
        return { scope: sc, view: v, said, controls: live.length, silent };
      });
  });
  if (!rows.length) return `<p class="none">Nothing in this product draws a screen.</p>`;
  return `
    <h2>Screens</h2>
    <p class="lede">Every screen this product draws. Open one to click its controls and see what the
    product promises there — and what nothing says yet.</p>
    <table class="worklist">
      <thead><tr><th>Screen</th><th>Where it lives</th><th class="num">Controls</th><th class="num">Say nothing</th><th class="num">Behaviours</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
              <td><button type="button" class="show-part" data-show-part="${esc(`${r.view.id}/`)}">${line(r.view.title)}</button>${
              r.view.exists === "intended" ? ` <span class="n">not built yet</span>` : ""
            }</td>
              <td>${refLink(r.scope.id, ctx, line(r.scope.title || r.scope.id))}</td>
              <td class="num">${r.controls}</td>
              <td class="num${r.silent ? " warn" : ""}">${r.silent || "—"}</td>
              <td class="num">${r.said || "—"}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

/**
 * ⛔ THE SELECTION MARKER HAS TO BE INSIDE THE SHADOW ROOT. Page CSS does not cross the boundary,
 * so the class that says "this is the control you clicked" would have no effect at all — the click
 * would register, the panel would open, and nothing on the screen would show what was selected.
 */
const PT_STYLE = `<style>
  .pt { cursor: pointer; border-radius: 3px; }
  /**
   * ⛔ ONLY THE THINGS A PERSON TOUCHES ADVERTISE THEMSELVES. Marking every part the same way drew
   * a two-pixel underline across whole strips and panels — the version strip, the metrics row, the
   * source-file bar — so the screen read as though everything on it were a control. A region is
   * still clickable; it just does not claim to be a button.
   */
  .pt-commits, .pt-entry, .pt-navigates { box-shadow: inset 0 -2px 0 rgba(37,99,235,.45); }
  .pt-commits:hover, .pt-entry:hover, .pt-navigates:hover { box-shadow: inset 0 -2px 0 rgba(37,99,235,1); }
  .pt-region:hover, .pt-display:hover { outline: 1px dashed rgba(37,99,235,.55); outline-offset: 2px; }
  .pt.on { background: rgba(37,99,235,.10); box-shadow: inset 0 0 0 2px rgba(37,99,235,.9); }
  /**
   * ⛔ WHAT THE GENERATOR COULD NOT READ IS SHOWN AS UNREAD, not left blank. It transforms source,
   * it does not run it: an expression behind a hook or a third-party icon cannot be resolved, and a
   * silent gap there is exactly how a drawing looks finished while showing nothing. Hatched, so a
   * reviewer can see at a glance how much of the screen is actually drawn.
   */
  /** ⛔ A wrapper it could not read still holds the real screen — painting it striped the table. */
  .productos-unknown { border-radius: 2px; }
  .productos-unknown:not(:has(*)) { display: inline-block; min-width: 1.5em; color: #92400e;
    background: repeating-linear-gradient(45deg, rgba(245,158,11,.18) 0 4px, transparent 4px 8px);
    outline: 1px dashed rgba(245,158,11,.6); }
  /**
   * ⛔ A NAMED SLOT READS AS PART OF THE SENTENCE, NOT AS DAMAGE TO IT.
   *
   * The hatched marker is for a value with no name — it has to be conspicuous because there is
   * nothing else to go on. A slot that CAN say "project name" is carrying information, and dressing
   * it in warning stripes made the drawing look corrupted: Peter read the hatching as blocked-out
   * text and asked what had happened to it. Quiet, italic, underlined where it sits in the line.
   */
  .productos-slot { font-style: italic; opacity: .75;
    text-decoration: underline dotted currentColor; text-underline-offset: 2px; }
  [data-component] { display: block; padding: .25rem .4rem; font-size: .75rem; }
  /**
   * ⛔ AN ICON READS AS AN ICON. The drawing does not know the glyph, but it knows the size and the
   * shape of the hole — and a neutral square is a wireframe convention every reader already knows,
   * where the word "ChevronRight" in running text is not.
   */
  /** A cell whose value the drawing does not know: the row's SHAPE is what a reader is judging. */
  /**
   * ⛔ VISIBLE AT TILE SCALE, which is the size it is actually read at. At opacity .14 the rows were
   * in the DOM, correct, and invisible — a list that still looked empty, which is the complaint this
   * whole change exists to answer. Varied widths so a column reads as data rather than as a ruler.
   */
  /** ⛔ Neutral, never the text colour — see the note in the adopted sheet. */
  .productos-value { display: inline-block; min-width: 3.2em; height: .6em; border-radius: 3px;
    background: rgba(130,128,124,.20); vertical-align: -.05em; }
  td .productos-value, th .productos-value { min-width: 4.5em; }
  tr:nth-child(2n) .productos-value { min-width: 5.5em; }
  tr:nth-child(3n) .productos-value { min-width: 3.6em; }
  /** ⛔ A sample announces itself. That is what lets the drawing be legible without lying. */
  .productos-sample { text-decoration: underline dotted rgba(120,113,108,.55); text-underline-offset: 2px; }
  .productos-icon { display: inline-block; width: 1em; height: 1em; vertical-align: -.12em;
    border-radius: 2px; background: rgba(130,128,124,.28); }
  /**
   * ⛔ THE FOCUS MARK CANNOT BE THE ACCENT COLOUR. On a card's copy it landed on the primary
   * button — blue ring, blue button, invisible. The one job of the copy is to say WHICH control the
   * sentence is about, so the mark has to read against the application's own palette rather than
   * share it. Amber with a halo, which survives being drawn on a blue button, a grey row or white.
   */
  .focus { outline: 3px solid #f59e0b; outline-offset: 3px; border-radius: 3px;
    box-shadow: 0 0 0 7px rgba(245,158,11,.22); position: relative; z-index: 1; }
</style>${STATE_CSS}`;
/**
 * ⛔ `STATE_CSS` GOES IN HERE, AND ONLY BECAUSE THE MOCK LIVES IN A SHADOW ROOT.
 *
 * A composed state marks a part with `data-in="invalid"` and lets one stylesheet say what that
 * looks like. Page-level CSS does not cross a shadow boundary, so putting it beside the page's own
 * `STYLE` would have produced states that compose correctly and render as though nothing had
 * happened — a reviewer shown a form with no error on it, agreeing to a sentence about an error.
 *
 * Appended to `PT_STYLE` rather than to each call site: there is one shadow root builder, and a
 * second place to remember would be a second place to forget.
 */

/** Normalised for label matching: the sketch writes "[ × Clear ]" where the part says "Clear filters". */
const forMatch = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Wrap each part's label where it appears in the sketch, so the drawing becomes the control surface.
 *
 * ⛔ ESCAPE FIRST, THEN SPLICE. The sketch is user text full of box-drawing and the odd angle
 * bracket; wrapping before escaping would emit the wrappers as literal text, and escaping after
 * would neuter them. Splices are tracked so a longer label cannot be eaten by a shorter one that
 * sits inside it — "Clear" inside "Clear filters" is exactly the collision.
 */
function liveSketch(view: View, matched: Map<string, boolean>): string {
  const raw = esc(view.sketch!.trimEnd());
  type Hit = { at: number; len: number; part: Part };
  const hits: Hit[] = [];
  const taken: Array<[number, number]> = [];
  const free = (at: number, len: number) => !taken.some(([a, b]) => at < b && a < at + len);

  // Longest label first: a part whose label contains another part's must claim its text first.
  const byLength = [...view.parts].sort((a, b) => (b.label ?? b.id).length - (a.label ?? a.id).length);
  for (const part of byLength) {
    const label = part.label ?? part.id;
    if (!label) continue;
    let at = -1;
    let len = 0;

    /**
     * ⛔ WHOLE WORDS ONLY, AT BOTH ENDS.
     *
     * The part "No deals yet" bound itself to the "No" inside "Northgate" — a row in the drawing —
     * so clicking a deal name reported on the empty state. A control wired to the WRONG text is
     * strictly worse than one left unwired: the reviewer is shown a confident answer about
     * something they did not click, and nothing on screen says the binding was guessed.
     */
    const word = /[a-z0-9]/i;
    const bounded = (i: number, n: number) =>
      i >= 0 && !word.test(raw[i - 1] ?? "") && !word.test(raw[i + n] ?? "") && free(i, n);
    const findBounded = (probe: string): number => {
      for (let i = raw.indexOf(probe); i >= 0; i = raw.indexOf(probe, i + 1)) if (bounded(i, probe.length)) return i;
      return -1;
    };

    // Exact first, then the longest leading run of words the sketch does contain — a drawing
    // abbreviates ("Clear" for "Clear filters") far more often than it renames.
    const whole = findBounded(esc(label));
    if (whole >= 0) {
      at = whole;
      len = esc(label).length;
    } else {
      const words = label.split(/\s+/);
      for (let take = words.length - 1; take >= 1; take--) {
        // ⛔ A single short word is not evidence. "No", "All", "Up" match half a drawing by accident,
        // and a wrong binding is unfalsifiable from the page. Two words, or one long one.
        const probe = esc(words.slice(0, take).join(" "));
        if (take === 1 && probe.length < 5) break;
        const i = findBounded(probe);
        if (i >= 0) {
          at = i;
          len = probe.length;
          break;
        }
      }
    }
    if (at < 0) continue;
    hits.push({ at, len, part });
    taken.push([at, at + len]);
    matched.set(part.id, true);
  }

  hits.sort((a, b) => a.at - b.at);
  let out = "";
  let cursor = 0;
  for (const h of hits) {
    out += raw.slice(cursor, h.at);
    const goes = h.part.leads_to ? ` data-goes="${esc(h.part.leads_to)}"` : "";
    out += `<button type="button" class="pt pt-${esc(h.part.role)}" data-part="${esc(h.part.id)}"${goes}>${raw.slice(h.at, h.at + h.len)}</button>`;
    cursor = h.at + h.len;
  }
  out += raw.slice(cursor);
  return out;
}


/**
 * Wire the parts into generated HTML, so a mock from the codebase is as clickable as a drawing.
 *
 * ⛔ TEXT NODES ONLY. A label like "New Deal" or "Stage" can occur inside an attribute — a class
 * name, a test id, an aria-label — and wrapping it there would splice a button into the middle of
 * an attribute value and silently corrupt the markup. Only the runs between a `>` and the next `<`
 * are candidates.
 *
 * ⛔ AN EXPLICIT `data-part` WINS. A generated mock should say which element is which part rather
 * than leave it to a text match, and one that does is exempt from all of this.
 */
function wireHtml(
  view: View,
  matched: Map<string, boolean>,
  goes?: Map<string, string>,
  scopeId?: string,
  routes?: Array<{ id: string; route: string }>
): string {
  /**
   * ⛔ THE FALLBACK, NOT THE MECHANISM. `draw` writes `data-part` into the corpus at generation
   * time, so a generated drawing arrives already wired. This runs for drawings written before the
   * generator existed, which carry no attribute and would otherwise be unclickable — and it calls
   * the same function, so the two cannot drift.
   */
  const wired = wireParts(view.sketch_html!, view.parts);
  for (const id of wired.matched) matched.set(id, true);
  /**
   * ⛔ A DERIVED DESTINATION IS STAMPED ONTO THE DRAWING, NOT INTO THE CORPUS. A control that
   * commits may not carry a `leads_to`, so the walk is worked out from what the corpus says and
   * attached here — the drawing is output, and this is one more thing generated into it.
   *
   * ⛔ AND THE TWO KINDS OF DESTINATION ARE INDEPENDENT. This used to return here when no derived
   * map was passed, which is how BOTH call sites call it — so a drawn navigation, which needs no
   * derived map at all, was skipped on every screen on the page. Measured: thirty-four drawn
   * navigations in one deals list and not one of them stamped.
   */
  const stamped =
    goes && scopeId
      ? wired.html.replace(/data-part="([^"]+)"/g, (whole, id: string) => {
          const to = goes.get(`${scopeId}#${view.id}#${id}`);
          return to ? `${whole} data-goes="${esc(to)}"` : whole;
        })
      : wired.html;
  if (!routes?.length) return stamped;
  /**
   * ⛔ A CONTROL THE APPLICATION NAVIGATES FROM IS WALKABLE WITHOUT ANYBODY DECLARING IT A PART.
   *
   * Peter, on the drawn deals list: *"no deal links are clickable, none of the individual features
   * got new pages"*. Both halves of that were one defect. The walk ran on declared parts alone, so
   * a screen reached the corpus with every row the product has and nothing to press, and the only
   * route to a walkable row was somebody typing out a part and a destination by hand — for each of
   * a hundred and thirty-four screens.
   *
   * The drawer records where a control goes now, so the destination is already on the element. All
   * that is left is resolving the address to whichever screen answers it, which is the same
   * question the route table answers for declared parts.
   */
  const here = `${scopeId}#${view.id}`;
  return stamped.replace(/<([a-z][a-z0-9]*)\b([^>]*\bdata-goes-to="([^"]+)"[^>]*)>/gi, (whole, tag: string, attrs: string, pushed: string) => {
    if (/\bdata-goes="/.test(attrs)) return whole;
    /**
     * ⛔ THE SAME RESOLUTION THE DERIVED CONNECTIONS USE, NOT A SECOND ONE THAT ONLY LOOKS ALIKE.
     *
     * This was a path-only match while `connects` had learned to read the query, and the two
     * disagreeing is worse than either being wrong alone: all eight tabs on the workspace drew as
     * pressable and all eight went to the same screen. A control that is visibly live and lands
     * somewhere else teaches a reviewer something false about the product, which is the one
     * outcome a drawing must never produce.
     */
    const dest = screenAnswering(pushed, here, routes);
    if (!dest) return whole;
    /**
     * ⛔ MERGED INTO THE CLASS IT ALREADY HAS, never written beside it. The application's own
     * classes are what make the drawing look like the product; a second class attribute is invalid
     * markup and the browser keeps the first, so appending one would have silently thrown away
     * either the product's styling or the mark that says this is pressable.
     */
    const had = /\bclass="([^"]*)"/.exec(attrs);
    const marked = had
      ? attrs.replace(had[0], `class="${had[1]} pt pt-navigates"`)
      : `${attrs} class="pt pt-navigates"`;
    return `<${tag}${marked} data-goes="${esc(dest.id)}">`;
  });
}

/** Everything the corpus states at one part of one screen, and the slots that say nothing. */
function statedAt(scope: Scope, viewId: string, partId: string | undefined): Array<{ ref: string; title: string; said: Array<{ slot: SlotName; text: string }>; blank: SlotName[] }> {
  return scope.exchanges
    .filter((e) => e.at?.view === viewId && (partId ? e.at?.part === partId : !e.at?.part))
    .map((e) => {
      const said: Array<{ slot: SlotName; text: string }> = [];
      const blank: SlotName[] = [];
      for (const slot of SLOTS) {
        const f = e.slots[slot];
        if (!f) {
          blank.push(slot);
          continue;
        }
        const texts = statements(f.says).map((st) => st.says);
        if (texts.length) said.push({ slot, text: texts[0]! });
        else if (f.none) said.push({ slot, text: "nothing happens" });
        else if (f.cannot_fail) said.push({ slot, text: "this cannot fail" });
        else if (f.outcomes?.length) said.push({ slot, text: f.outcomes.map((o) => o.name).join(", ") });
      }
      return { ref: `${scope.id}#${e.id}`, title: e.title, said, blank };
    });
}

/**
 * Derived destinations, worked out once per corpus.
 *
 * ⛔ Memoised because this reads every screen against every control, and a page renders many
 * screens — recomputing it per screen turned a render into a quadratic walk of the whole corpus.
 */
const goesCache = new WeakMap<object, Map<string, string>>();
function goesFor(corpus: Corpus): Map<string, string> {
  let had = goesCache.get(corpus as unknown as object);
  if (!had) {
    had = new Map<string, string>();
    for (const c of inferConnections(corpus).made) had.set(c.from, c.to);
    goesCache.set(corpus as unknown as object, had);
  }
  return had;
}

function renderScreens(scope: Scope, ctx: Ctx, scopeId: string, opts: PageOptions, corpus: Corpus): string {
  const derivedGoes = goesFor(corpus);
  /** Which screen answers which address — so a drawn navigation can be walked, not just displayed. */
  const routes = routeTable(corpus);
  /**
   * ⛔ `:root` DOES NOT MATCH INSIDE A SHADOW TREE, so a design system that defines its tokens
   * there would hand the mock a stylesheet of variables that resolve to nothing — every colour and
   * spacing value empty, which renders as an unstyled page rather than as an error. `:host` is the
   * shadow root's own equivalent, so both are named.
   */
  /**
   * ⛔ THE APP'S CSS IS NOT REPEATED PER MOCK. Inlining it inside each shadow root put 370 KB of
   * stylesheet into the page eleven times — a 4.7 MB document, eleven parses, for one stylesheet.
   * It ships once and every shadow root adopts it; only the marker styles, which are six lines, are
   * inline so a control still looks clickable before any script runs.
   */
  void opts;
  const shown = scope.views.filter((v) => v.exists !== "withdrawn");
  /**
   * ⛔ NO SCREENS IS TWO DIFFERENT FACTS, AND A BLANK SPACE SAYS NEITHER.
   *
   * A feature reached only from other features has no screen because it never had one; a feature
   * whose screens nobody has drawn yet has none because the work is unfinished. Both rendered as
   * the same nothing, so the reader had to guess — and an author with no way to say which wrote
   * "It has no screen of its own." into the `may` slot of all eight exchanges of one feature
   * instead (framework gap fg-0003).
   *
   * So when the scope says why, the page says why. When it does not, the blank still means
   * "nobody has drawn these", which is the reading it always had.
   */
  if (!shown.length) {
    return scope.no_screen
      ? `
    <section class="screens no-screen">
      <p class="no-screen-why">No screen of its own — ${esc(scope.no_screen)}</p>
    </section>`
      : "";
  }
  return `
    <section class="screens">
      ${
        /**
         * ⛔ THE DIMENSIONS BELONG WHERE THE DRAWINGS ARE. Peter: *"let's move the dimensions down
         * into the prototype view on the features"*.
         *
         * I had put the filter in the frame, on the reasoning that a filter on one tab filters
         * nothing — and that answered *"is the dimension filter on every feature page"* by making it
         * global. Which is a different thing: on the breadcrumb line it is a property of the WHOLE
         * SITE, sitting above a product page and a settings surface that have no variants to narrow,
         * and a reader meets it before meeting anything it applies to.
         *
         * Here it is beside the screens it changes. ⛔ And that is the reading his own words always
         * had — a feature's variations are the feature's, so the control for them is the feature's
         * too.
         *
         * ⛔ ABSENT WHERE THE PRODUCT DECLARES NONE, unchanged: a row of empty dropdowns is the "nav
         * row that does nothing" this file refuses by name.
         */
        dimensionFilter(corpus)
      }
      <!--
        ⛔ NO HEADING AND NO INSTRUCTIONS HERE. Peter: *"remove placeholder text like this: The
        screens these arrive on / Click anything on a screen to see what the product promises
        there…"*. A screen a reviewer can see needs no label saying it is a screen, and a surface
        that explains how to click it is a surface that does not look clickable. The controls
        advertise themselves; that was the whole point of marking only the things a person touches.
      -->
      ${shown
        .map((v) => {
          const matched = new Map<string, boolean>();
          /**
           * ⛔ `sketch_html` WINS WHERE IT EXISTS. It is the same screen drawn with the real
           * application's own markup and classes, so it looks like the product rather than like a
           * wireframe — and the part wiring is identical either way, by label.
           */
          /**
           * ⛔ THE REAL MARKUP GOES IN A SHADOW ROOT, WITH THE APP'S OWN CSS INSIDE IT.
           *
           * Peter: "i don't think we should have ascii, we should try to generate what it'd look
           * like from the codebase."
           *
           * A mock written in the application's real class names needs the application's real CSS
           * to look like anything — and that CSS is Tailwind plus a design system, which styles
           * `.flex`, `.p-4`, `*` and `:root`. Inlined into this page it would restyle the page
           * itself: the review surface would start looking like the thing under review, and every
           * later change to their CSS could silently break this page's layout.
           *
           * Rewriting their selectors to scope them was the other option and it is the worse one —
           * a hand-rolled CSS transform over @layer, @supports, custom properties and :is() fails
           * quietly, on their stylesheet, in a way nobody here would notice. A shadow root isolates
           * both directions with no parsing at all.
           *
           * Declarative, so it works with no script: the markup IS the shadow tree on parse.
           */
          /**
           * ⛔ A SCREEN IS WALKED THROUGH ITS STATES, NOT SHOWN IN ONE OF THEM.
           *
           * Peter: *"a clickable screenshot at the top of this deals list screen that walks through
           * the various states"*, and *"the framework should be able to generate these on a per
           * feature basis"*. `draw` generates one drawing per state it finds in the component, so
           * this offers them all — the screen first, because the exception must not become the
           * subject.
           *
           * ⛔ EVERY STATE IS ISOLATED SEPARATELY. They are written in the application's own class
           * names, so they need a shadow root each, exactly as the main drawing does.
           */
          const asMock = (html: string): string =>
            `<div class="proto html"${themeAttr(opts)}><template shadowrootmode="open">${PT_STYLE}<div class="${esc(
              opts.mockClass || "productos-mock"
            )}">${html}</div></template></div>`;
          /**
           * ⛔ THE STATES THE SENTENCES ALREADY DESCRIBE, COMPUTED HERE RATHER THAN STORED.
           *
           * Peter: *"THE WHOLE SYSTEM IS TO MAKE IT EASIER TO INFER SHIT NEEDS TO BE DONE, WHY
           * WOULD WE ASK PEOPLE TO WRITE ANYTHING DOWN?"* — `refuses` carries a case, its trigger
           * and the words an asker reads; `fails` what they are left with; `again` the in-flight
           * moment. Those ARE view states, and nothing was showing them.
           *
           * ⛔ ON READ, NEVER WRITTEN INTO THE CORPUS. A derived state stored in truth is wrong the
           * moment its sentence is reworded, and nothing would say so — the same defect as a
           * hand-written drawing, one level down. Computing it here means it cannot drift.
           *
           * ⛔ AND A DERIVED STATE IS NOT AN AGREED ONE. It is marked on the page, because a tab
           * nobody can tell was worked out by software is a tab somebody agrees to as though a
           * person had written it.
           */
          const stored = v.states ?? [];
          const derived = deriveStates(scope, v).states.filter(
            /** A stored state for the same case wins — somebody has already drawn that one. */
            (d) => !stored.some((s) => s.label.toLowerCase() === d.label.toLowerCase()),
          );
          const states = [...stored, ...derived];
          const isDerived = (i: number): boolean => i >= stored.length;
          /**
           * ⛔ A PRESS HAS TO MOVE THE PICTURE, OR IT IS A DIAGRAM WITH EXTRA STEPS.
           *
           * Peter: *"i hit continue, and nothing changes. some text below changes, but the
           * prototype doesn't drive."* Showing what a control promises was the previous fix and it
           * was half of one — a reviewer validating a flow needs to SEE the next screen, not read
           * that there is one.
           *
           * Where it lands is derived from the truth by `landingsFor`, never from a link: a
           * `commits` part refuses `leads_to` precisely because its destination is its `answer`,
           * and writing it twice is two records of one fact. Stamped onto the drawing here rather
           * than at draw time, because a drawing is stored wired and this is a reading of the
           * sentences beside it — which change without the component changing.
           *
           * ⛔ NOT ONTO A CONTROL ALREADY STANDING WHERE IT WOULD LAND. Four controls on the folder
           * step read as landing on the folder step, because that is what their sentence is about.
           * A button that does nothing visible is exactly the complaint.
           */
          const lands = landingsFor(scope, v);
          /**
           * ⛔ A DERIVED DESTINATION BELONGS ON EVERY STATE, NOT ONLY THE FIRST.
           *
           * Peter: *"you can't go past the folder selection screen"*. The two controls that reach
           * the deal workspace live on the FOLDER state, and `wireHtml` stamps derived destinations
           * only onto the base drawing — so the walk existed, was reported by `generate`, and was
           * nowhere a reviewer could press it. A flow whose last step is on a state is the ordinary
           * case, not an exotic one: that is what a state IS.
           */
          /**
           * ⛔ A CONTROL THAT FINISHES THE FEATURE DOES NOT ALSO OFFER TO LEAVE IT.
           *
           * Peter: *"i thought we had agreed that the completeness here was a separate page, but
           * 'create folder' still links to a different feature"*. He is right, and the two were
           * competing on one button: the same press both ENDED the happy path and carried a
           * derived jump into the deal workspace, so finishing and leaving were indistinguishable.
           *
           * Where the product goes next is still true and still said — the completion names it.
           * What it stops doing is offering it as a press, because the walk is over.
           */
          /**
           * ⛔ A CONTROL THAT MOVES THIS SCREEN ON IS A STEP, NOT AN ENDING — and word overlap
           * cannot tell them apart here.
           *
           * "Continue" leaves behind *"the deal exists on the CRE deals list… the analyst is then
           * asked where its folder is"*; the feature ends with *"the deal exists on the CRE deals
           * list, and its sizing model has been written into the folder"*. Four words in common,
           * and they are not the same event. It was marked as finishing, so it carried a landing on
           * the Done state ON TOP OF its landing on the folder step — two `data-lands` on one
           * button — and the first press jumped the reviewer straight past the step to the end.
           *
           * The screen already knows: a control with a within-screen landing has somewhere to go
           * that is not the end. That is a fact, not a reading of two sentences.
           */
          /**
           * ⛔ A LANDING ON THE STATE YOU ARE ALREADY STANDING ON IS NOT A STEP.
           *
           * The folder controls each read as landing on "Folder" — which is where they are drawn.
           * Counted as stepping, they were excluded from finishing, fell through to the link path,
           * and armed a callout that then had nothing to clear it. Peter: *"now the modal never
           * goes away."*
           *
           * Which state a control is drawn in is in the drawing, so it is asked rather than guessed.
           */
          const drawnIn = (id: string): number[] => {
            const at: number[] = [];
            if (v.sketch_html?.includes(`data-part="${id}"`)) at.push(0);
            states.forEach((st, i) => {
              /** ⛔ The COMPOSED picture — a state may carry conditions and no drawing of its own. */
              if (pictureOf(v, st).includes(`data-part="${id}"`)) at.push(i + 1);
            });
            return at;
          };
          const stepsOn = new Set(lands.filter((l) => !drawnIn(l.part).every((i) => i === l.index)).map((l) => l.part));
          const finishing = new Set([...finishesFor(scope, v)].filter((id) => !stepsOn.has(id)));
          const withGoes = (html: string): string =>
            derivedGoes
              ? html.replace(/data-part="([^"]+)"/g, (whole, id: string) => {
                  const to = derivedGoes.get(`${scopeId}#${v.id}#${id}`);
                  if (!to) return whole;
                  /**
                   * ⛔ NAMED, NOT OFFERED. Where the product goes after a feature is finished is
                   * true and worth saying; making it a press is what put a door out of the feature
                   * on the button that ends it. `data-next` is read for the completion line and
                   * nothing walks it.
                   */
                  return finishing.has(id)
                    ? `${whole} data-next="${esc(to)}"`
                    : `${whole} data-goes="${esc(to)}"`;
                })
              : html;
          /**
           * ⛔ A WALK THAT ENDS SAYS SO, WITH THE FEATURE'S OWN WORDS FOR FINISHING.
           *
           * Peter: *"we are going straight to the deals list on completion… awkwards to go back to
           * the deals list feature from here"*. Arriving somewhere is not finishing, and the jump
           * read as being dropped because the reviewer HAD finished and nothing said so.
           *
           * `happy_path.ends_with` is that sentence, authored and agreed to, and it had never been
           * rendered at the end of a walk. Stamped onto the controls that end the path so the
           * prototype can show it where the press happens.
           */
          const finishes = finishing;
          const ends = scope.happy_path?.ends_with ?? "";
          /**
           * ⛔ THE FINAL STATE IS A SCREEN, NOT A TOOLTIP. Peter, five times: *"why on the create
           * deal screen is there no final state after create deal. i've asked like 5 times."*
           *
           * Every answer before this put the completion in a floating callout — which is a label on
           * a button, not somewhere a reviewer arrives. It also never went away, because it was
           * armed through a path that never recorded what was armed.
           *
           * So finishing is a STATE, the same as every other appearance this screen has: it gets a
           * tab, it gets a frame, and the control that ends the path LANDS on it by exactly the
           * machinery that walks a wizard to its next step. One mechanism, not two.
           */
          const doneAt = states.length + 1;
          const hasDone = finishes.size > 0 && !!ends;
          const nextName = (ref: string | undefined): string => {
            if (!ref) return "";
            const id = ref.split("#")[0]!;
            const sc = corpus.scopes.find((x) => x.scope.id === id);
            return sc ? plain(sc.scope.title ?? id) : id;
          };
          const goesOnTo = [...finishes]
            .map((id) => derivedGoes?.get(`${scopeId}#${v.id}#${id}`))
            .find(Boolean);
          const doneFrame = (): string => `
            <div class="done-card">
              <p class="done-mark">✓ That completes ${line(scope.title ?? scopeId)}</p>
              <p class="done-ends">${line(ends)}</p>
              ${
                goesOnTo
                  ? `<p class="done-next">From here the product goes on to <strong>${esc(nextName(goesOnTo))}</strong>.</p>`
                  : ""
              }
              <p class="done-note">Nothing on this screen happens after this.</p>
            </div>`;
          /** ⛔ The finishing controls LAND here. Same attribute the wizard steps use. */
          const withFinish = (html: string): string =>
            hasDone
              ? html.replace(/data-part="([^"]+)"/g, (whole, id: string) =>
                  finishes.has(id) ? `${whole} data-lands="${doneAt}" data-lands-why="${esc(ends)}"` : whole
                )
              : html;
          const withLands = (html: string, here: number): string =>
            lands.reduce(
              (acc, l) =>
                l.index === here
                  ? acc
                  : acc.replace(
                      new RegExp(`data-part="${l.part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g"),
                      `data-part="${esc(l.part)}" data-lands="${l.index}" data-lands-why="${esc(l.because)}"`
                    ),
              html
            );
          const body = v.sketch_html
            ? states.length
              ? `<div class="states" data-states="${esc(v.id)}">
                   <!-- ⛔ Where a walk has been. Empty until somebody walks; see the live script. -->
                   <nav class="walk-trail" hidden aria-label="where this walk has been"></nav>
                   <div class="state-tabs">
                     <button type="button" class="state-tab on" data-state="0">As it is</button>
                     ${states
                       .map(
                         (st, i) =>
                           /**
                            * ⛔ A DERIVED TAB SAYS SO, AND SAYS WHERE IT CAME FROM. Nobody has
                            * agreed to it — it was worked out from a sentence — and a tab that
                            * looks identical to a drawn one is a tab somebody accepts as though a
                            * person had written it.
                            *
                            * ⛔ AND `when` IS OPTIONAL NOW. "in the code: undefined" was what this
                            * produced for a state of a screen nobody has built, which is most of
                            * the point of making `when` optional in the first place.
                            */
                           /**
                            * ⛔ A STATE WHOSE CONTROL IS IN NO PICTURE RENDERS AS THE ORDINARY
                            * SCREEN, AND UNTIL NOW SAID NOTHING ABOUT IT.
                            *
                            * `check` reports it — `no-picture-of-this-screen-contains-this-control`
                            * — but `check` is not where a reviewer is standing. They are on this
                            * tab, looking at a picture identical to the one behind it, with no way
                            * to tell whether the state claims nothing or whether the thing it
                            * claims is simply not drawn. Those are opposite conclusions and the
                            * page offered the same pixels for both.
                            *
                            * Confirmed on the deployed instance: the finding is 0 on every page on
                            * 4100 because `page.ts` never rendered it, while `check` on the same
                            * commit returns 3.
                            */
                           (() => {
                             const missing = isDerived(i) ? unpicturedParts(v, st) : [];
                             const why = missing.length
                               ? `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} in no picture of this screen, so this renders as the ordinary screen — draw it in a state where ${missing.length === 1 ? "it is" : "they are"} on it`
                               : isDerived(i)
                                 ? `worked out from ${(st as { from?: string }).from ?? "the sentences"} — nobody has agreed to this yet`
                                 : st.when
                                   ? `in the code: ${st.when}`
                                   : "this screen states this, and no code was read for it";
                             return `<button type="button" class="state-tab${isDerived(i) ? " derived" : ""}${
                               missing.length ? " unpictured" : ""
                             }" data-state="${i + 1}" title="${esc(why)}">${line(st.label)}${isDerived(i) ? " ·" : ""}${
                               missing.length ? ` <span class="nopic" aria-label="not drawn">⌀</span>` : ""
                             }</button>`;
                           })()
                       )
                       .join("")}
                     ${
                       hasDone
                         ? `<button type="button" class="state-tab is-done-tab" data-state="${doneAt}" title="${esc(
                             "what the feature says it ends with"
                           )}">✓ Done</button>`
                         : ""
                     }
                   </div>
                   <div class="state-frame" data-state="0">${asMock(withFinish(withLands(withGoes(wireHtml(v, matched, undefined, scopeId, routes)), 0)))}</div>
                   ${states
                     .map(
                       (st, i) =>
                         `<div class="state-frame" data-state="${i + 1}" hidden>${asMock(withFinish(withLands(withGoes(pictureOf(v, st)), i + 1)))}</div>`
                     )
                     .join("")}
                   ${hasDone ? `<div class="state-frame" data-state="${doneAt}" hidden>${doneFrame()}</div>` : ""}
                 </div>`
              : asMock(wireHtml(v, matched, undefined, scopeId, routes))
            : v.sketch
              ? `<pre class="proto sketch">${liveSketch(v, matched)}</pre>`
              : `<p class="owes">Nobody has drawn this screen, so there is nothing here to point at.</p>`;
          const undrawn = v.parts.filter((pt) => !matched.get(pt.id) && !pt.decorative);
          const loose = statedAt(scope, v.id, undefined);
          /**
           * ⛔ WHETHER A SWEEP MAY STILL REWRITE THIS SCREEN, WHICH IS A FACT ABOUT IT A READER
           * CANNOT OTHERWISE GET AT.
           *
           * Peter: *"once they have been operated on, they should stay locked."* A reader looking
           * at two screens has no way to tell which one is a first guess the generator will replace
           * on its next run and which one carries somebody's judgement — and that is the difference
           * between a picture worth arguing with and a picture worth ignoring.
           *
           * ⛔ A CHIP, NOT A LINE OF ITS OWN. *"WE DON'T HAVE THAT MUCH SCREEN REAL ESTATE to begin
           * with"* — it rides the heading where there is one, and only costs a row where a
           * single-screen feature has no heading to ride.
           */
          const held = holdsOn(corpus, scopeId, v);
          const heldChip = held.length
            ? `<span class="chip ok" title="${esc(`${whyHeld(held)} — a sweep leaves this alone; only naming it redraws it`)}">worked on</span>`
            : "";
          return `<article class="screen" id="${anchorOf(`${scopeId}#view#${v.id}`)}" data-screen="${esc(v.id)}"
            data-ref="${esc(scopeId)}"${held.length ? ' data-held="1"' : ""}${
              /* ⛔ Omitted where the screen is everybody's — absent means everywhere, as in the model. */
              v.holds_for && Object.keys(v.holds_for).length
                ? ` data-holds="${esc(JSON.stringify(v.holds_for))}"`
                : ""
            } data-label="${esc(`screen: ${plain(v.title)}`)}">
            ${
              /**
               * ⛔ NO HEADING WHERE THERE IS ONLY ONE SCREEN. Peter: *"there's white space above the
               * 'Create a deal' form part in the prototype - just wasted space."*
               *
               * 97px stood between the top of the frame and the picture, and 25 of it was this
               * heading — naming the screen directly under a title that names the feature, which on
               * a single-screen feature is the same thing said twice. ⛔ It stays where a feature has
               * several: there the name is the only thing telling you which one you are looking at,
               * and that is not waste, it is the label doing its job.
               */
              scope.views.filter((x) => x.exists !== "withdrawn").length > 1
                ? `<h4>${line(v.title)}${v.view_kind ? ` <span class="n">${esc(v.view_kind)}</span>` : ""}${heldChip}</h4>`
                : heldChip && `<p class="chips">${heldChip}</p>`
            }
            ${
              v.exists === "intended"
                ? `<p class="owes">This screen does not exist yet — everything here is intent, not observation.</p>`
                : ""
            }
            ${
              /**
               * ⛔ WHO THIS SCREEN IS FOR, ON THE SCREEN. Peter: *"we need dimensions to carry through
               * to all features, so we can have different variations PER feature"*.
               *
               * A feature with two drawings of the same job and nothing saying which audience each
               * belongs to is worse than one drawing: a reviewer reads the first, agrees to it, and
               * has agreed to something that was never promised to the person they had in mind. The
               * model carrying `holds_for` while no reader sees it is the same defect one layer down.
               *
               * ⛔ The chip says the dimension's LABEL and the value, not the id — `role: admin` is
               * the storage talking, and nothing a reader sees should mention it.
               */
              v.holds_for && Object.keys(v.holds_for).length
                ? `<p class="chips"><span class="chip holds" title="${esc(
                    `this drawing is what ${sayCombination(v.holds_for, dimensionsOf(corpus))} sees`
                  )}">${esc(sayCombination(v.holds_for, dimensionsOf(corpus)))}</span></p>`
                : ""
            }
            ${
              /**
               * ⛔ WHICH SCREEN THIS ONE APPEARS INSIDE — SAID HERE, NOT IN A TERMINAL.
               *
               * `v2 inside` shipped an hour after Peter said *"I should be able to drive this from
               * the listener/input, right??? why could you possibly need this?"* — and it is a CLI
               * command, for a fact a person states while looking at the screen it is about. The
               * same defect he had just corrected, written again.
               *
               * ⛔ A SELECT, NOT A REF FIELD. The screens are known, so typing `<scope>#<view>` by
               * hand is a chance to get it wrong at the one surface that can simply list them. The
               * empty option takes the containment back, which is the other half nobody could do.
               */
              insideControl(corpus, scopeId, v)
            }
            ${
              /**
               * ⛔ A SCREEN SHOWING FIVE APPEARANCES UNDER ONE SENTENCE, SAYING SO WHERE IT SHOWS.
               *
               * Peter, the moment create-a-deal finally drew its wizard: *"and there's a single
               * behavior..."*. `check` reports this as `the-states-of-this-screen-are-unspoken`,
               * and a finding only the CLI prints is a finding the person reviewing never meets —
               * the page is where somebody looks at a screen and decides whether it is right.
               *
               * ⛔ COUNTED, NEVER ANSWERED. What each step promises is a product decision; this
               * says only how many pictures there are and how many sentences, which is a fact.
               */
              /**
               * ⛔ COUNTED AT THE SCREEN AND AT ITS CONTROLS. Anchoring each exchange at the control
               * that asks it — which the model wants, and which `arrives-nowhere` refuses a corpus
               * for not doing — emptied the screen-level count, so a feature with thirty-seven
               * statements on it reported "nothing said about any of them". The banner was reading
               * one shelf and calling the room empty.
               */
              (v.states?.length ?? 0) >= 2 &&
              scope.exchanges
                .filter((e) => e.at?.view === v.id)
                .reduce(
                  (n, e) =>
                    n +
                    Object.values(e.slots ?? {}).reduce((m, b) => {
                      const says = (b as { says?: unknown } | undefined)?.says;
                      return m + (typeof says === "string" ? 1 : Array.isArray(says) ? says.length : 0);
                    }, 0),
                  0
                ) <= 1
                ? `<p class="owes">This screen has ${(v.states?.length ?? 0) + 1} appearances and ${
                    scope.exchanges.some((e) => e.at?.view === v.id && Object.keys(e.slots ?? {}).length)
                      ? "one sentence covering all of them"
                      : "nothing said about any of them"
                  } — you can see more here than you can read. Steps somebody moves through are screens of their own.</p>`
                : ""
            }
            ${body}
            <div class="pt-detail" data-for="${esc(v.id)}" hidden></div>
            ${
              /**
               * ⛔ A PART THE DRAWING DOES NOT SHOW IS STILL A PART, and saying so is the point.
               * Silently dropping it would make the prototype look complete while a control the
               * corpus claims exists is nowhere on it — which is how a reviewer agrees to a screen
               * that cannot be built as drawn.
               */
              undrawn.length
                ? `<details class="undrawn"><summary>${undrawn.length} part${
                    undrawn.length === 1 ? "" : "s"
                  } the drawing does not show</summary><ul class="parts">${undrawn
                    .map(
                      (pt) =>
                        `<li><button type="button" class="pt pt-${esc(pt.role)}" data-part="${esc(pt.id)}"${
                          pt.leads_to ? ` data-goes="${esc(pt.leads_to)}"` : ""
                        }>${line(pt.label || pt.id)}</button> <span class="role">${esc(pt.role)}</span></li>`
                    )
                    .join("")}</ul></details>`
                : ""
            }
            ${
              // Anchored to the screen but not to any control on it: true of the screen as a whole.
              loose.length
                ? `<p class="n">${loose.length} thing${loose.length === 1 ? "" : "s"} stated about this screen as a whole — ${loose
                    .map((l) => refLink(l.ref, ctx, l.title))
                    .join(", ")}</p>`
                : ""
            }
          </article>`;
        })
        .join("")}
    </section>`;
}

/**
 * The application's stylesheet, once, for every shadow root on the page to adopt.
 *
 * ⛔ `:root`, `html` AND `body` DO NOT MATCH INSIDE A SHADOW TREE, and a design system defines its
 * tokens and its entire theme layer on exactly those three. Inlined verbatim they hand every mock
 * variables that resolve to nothing and a theme that applies to nothing — which renders as a
 * plausible-looking unthemed page rather than as an error. `scopeToShadow` rewrites that one
 * construct and leaves every other selector byte-identical; it lives in appcss.ts, beside the
 * reading of the files, because it is a fact about the stylesheet rather than about this page.
 */
/**
 * One copy of each drawing on the page, which everything that shows a screen clones.
 *
 * ⛔ A DRAWING WAS EMBEDDED VERBATIM ONCE PER PLACE IT APPEARED, AND ONE OF THOSE PLACES RECURS
 * WITH NESTING DEPTH.
 *
 * Peter: *"we should not be dumping everything in a single packet … this is ridiculous"*. Bilrost
 * rendered 12 MB of stored truth into a 49.8 MB document, 157s with 150s to first byte. Measured on
 * a corpus built to that shape — 144 scopes, 9.4 MB stored → 57 MB of HTML, the same ~6x — one
 * view's drawing appeared **five times verbatim**, emitted by:
 *
 *   · the prototype tile                  one copy
 *   · the flow map, PER ANCESTOR CONTAINER  one copy each — `renderGroupUx` runs for every
 *                                           container and embeds every drawing beneath it, so a
 *                                           feature two levels down is emitted twice, three levels
 *                                           three times. This is the superlinear term: 14.4x the
 *                                           scopes cost 21.4x the render.
 *   · the screen's own state frames         NOT waste — those differ, and a reviewer needs each
 *
 * ⛔ THE STATE FRAMES ARE DELIBERATELY NOT IN HERE, and the distinction cost a measurement to find.
 * In a fixture whose drawing carries no `data-part`, wiring and every derived state collapse to
 * bytes identical to the raw drawing — so they counted as duplicates and are not. `pictureOf`
 * composes a different picture per state against a real corpus. Deduplicating those would delete
 * product content while the number improved.
 *
 * ⛔ AND NOTHING ABOUT WHAT A REVIEWER SEES CHANGES. The DOM after hydration is what it was: each
 * host still gets its own shadow root holding its own clone. This removes repeated BYTES ON THE
 * WIRE, not a picture off the page — which is the line PT-0007 draws and the reason this half is
 * separable from loading scopes on demand. A drawing nobody can see until they click is a worse
 * review surface; this is the same review surface.
 */
function mockBank(corpus: Corpus, ids: string[], protoScreens: ProtoScreen[], body: string, root: string): string {
  /**
   * ⛔ ONLY WHAT THIS PAGE ACTUALLY POINTS AT, READ OFF THE ASSEMBLED BODY.
   *
   * Banking the subtree was wrong in both directions at once: it missed the prototype board's
   * screens, which are corpus-wide while `ids` is one subtree — a tile pointing at nothing, which
   * renders blank and is the inert-template failure the hydration sweep says has cost three
   * afternoons — and once sections are deferred it banks drawings for 143 sections nobody is
   * looking at, which is the whole defect this is here to fix. At 64 features the bank alone was
   * 4.42 MB of an 18.63 MB page.
   *
   * So the set is computed from the markup rather than predicted: whatever carries `data-mock` gets
   * a template and nothing else does. A deferred section asks for its own when it arrives.
   */
  const referenced = new Set([...body.matchAll(/data-mock="([^"]+)"/g)].map((m) => m[1]!));
  const seen = new Set<string>();
  const out: string[] = [];
  const bank = (ref: string, html: string | undefined) => {
    if (!html || seen.has(ref) || !referenced.has(ref)) return;
    seen.add(ref);
    out.push(`<template data-mock="${esc(ref)}">${html}</template>`);
  };

  for (const id of ids) {
    const sc = corpus.scopes.find((s) => s.scope.id === id)?.scope;
    if (!sc) continue;
    for (const v of sc.views) {
      if (v.exists === "withdrawn") continue;
      bank(`${sc.id}#${v.id}`, v.sketch_html);
    }
  }
  /**
   * ⛔ AND THE PROTOTYPE BOARD'S SCREENS, WHICH ARE CORPUS-WIDE WHILE `ids` IS ONE SUBTREE.
   * `renderPrototype` is handed `screensOf(corpus)`, so a page rooted at a leaf tiles screens that
   * are not under it. Banking only the subtree left those tiles pointing at nothing — a blank tile,
   * which is precisely the inert-template failure the hydration sweep's own comment says has cost
   * an afternoon three times. The bytes were already corpus-wide here; this does not add any.
   */
  for (const s of protoScreens) bank(`${s.scope}#${s.view}`, s.html);

  /**
   * ⛔ ALWAYS EMITTED, EVEN EMPTY, AND THIS WAS A REAL BUG FOUND BY DRIVING IT. On arrival nothing
   * carries `data-mock` — the thumbnails are lazy and the sections are stubs — so the bank was
   * empty, returned "", and the element did not exist. Every drawing the client then fetched was
   * appended to `null` and silently dropped: 16 thumbnails that fetched correctly and stayed blank.
   *
   * ⛔ AND IT CARRIES THE ROOT. The client needs to name the scope the page is rooted at when it
   * asks for a section, and these page scripts cannot interpolate — a `${...}` inside one is
   * evaluated as TypeScript rather than shipped. So the value travels on an attribute.
   */
  /**
   * ⛔ `hidden` AND NOT DISPLAY-NONE-BY-CLASS. A `<template>`'s content is inert and unrendered by
   * the parser, so this element holds no layout either way — but it is queried by the hydration
   * sweep, and a class could be restyled by the application's own stylesheet, which this page
   * adopts wholesale.
   */
  return `<div id="mock-bank" hidden data-root="${esc(root)}">${out.join("")}</div>`;
}

function appCssOnce(opts: PageOptions): string {
  if (!opts.appCss) return "";
  /**
   * ⛔ THE FACES GO IN THE DOCUMENT, EVERYTHING ELSE GOES IN THE SHADOW ROOTS. `@font-face` is
   * document-scoped: inside an adopted stylesheet it is ignored silently, so every drawing rendered
   * in a fallback while carrying the real woff2 bytes. See `liftFaces`.
   */
  const { faces, rest } = liftFaces(opts.appCss);
  const css = scopeToShadow(rest, opts.mockClass || "productos-mock") + PANE_FIT;
  const safe = (s: string): string => s.replace(/<\/(script|template)/gi, "<\\/$1");
  /**
   * The scheme rides on the template rather than being baked into each host, because hosts are made
   * in four places — two of them in script, after a tile is opened — and a theme that three of them
   * remembered to set is a page where some drawings are the product and some are not.
   */
  return (
    (faces ? `<style id="app-faces">${safe(faces)}</style>` : "") +
    `<template id="app-css"${themeAttr(opts)}>${safe(css)}</template>`
  );
}

/** `data-theme="…"`, or nothing at all where the product ships no scheme. */
function themeAttr(opts: PageOptions): string {
  return opts.theme ? ` data-theme="${esc(opts.theme)}"` : "";
}

/**
 * ⛔ WHAT IS STATED AT EVERY PART, AS DATA, so selecting one needs no round trip and the published
 * page works with nothing behind it. Emitted once per render rather than inlined into every control.
 */
function partFacts(corpus: Corpus, ids: string[]): string {
  const facts: Record<string, unknown> = {};
  for (const { scope } of corpus.scopes) {
    if (!ids.includes(scope.id)) continue;
    for (const v of scope.views) {
      for (const pt of v.parts) {
        /**
         * ⛔ A COMMIT CONTROL IS HOW THE SCREEN'S OWN PROMISE IS ASKED FOR, and telling somebody
         * nothing is stated at it while the screen states exactly what happens is a lie the page
         * tells about its own corpus.
         *
         * Peter, pressing the only submit button on create-a-deal: *"i can't tell if clicking on
         * next is actually navigating"*. It answered "Nothing states what happens here. An
         * engineer building this screen would decide it" — two inches below an `answer` saying the
         * deal is created and an `after` saying the analyst is then asked where its folder is.
         *
         * ⛔ NARROW, AND MARKED AS THE SCREEN'S RATHER THAN THE CONTROL'S. Only a `commits` part,
         * only when nothing is said at the part itself, and only from exchanges anchored at the
         * screen with no part of their own — those are the ones a commit control asks. It is not
         * promoted to being about the control: the panel says whose promise it is, because a
         * reviewer agreeing to a sentence needs to know what it was written about.
         */
        const own = statedAt(scope, v.id, pt.id);
        facts[`${v.id}/${pt.id}`] = {
          label: pt.label || pt.id,
          role: pt.role,
          goes: pt.leads_to ?? null,
          at: own,
          ofScreen: pt.role === "commits" && !own.length ? statedAt(scope, v.id, undefined) : [],
          slots: SLOT_ASKS_SHORT,
        };
      }
    }
  }
  return `<script type="application/json" id="part-facts">${JSON.stringify(facts).replace(/</g, "\\u003c")}</script>`;
}

/**
 * Where to start, when nothing is decided because almost nothing is written.
 *
 * ⛔ ORDERED BY HOW CLOSE EACH FEATURE IS TO FINISHED. A list in corpus order answers "what exists";
 * a reviewer facing 539 blanks is asking "where do I start", and the answer is the feature with the
 * fewest holes — it is the cheapest to finish and the first that becomes agreeable.
 */
/**
 * What nobody has been ASKED yet — ⛔ THE HALF OF "WHAT IS UNDECIDED HERE" THE QUEUE CANNOT CARRY.
 *
 * Peter: *"what is 'interview', this should be a first class representation in the UX - and claude
 * should ideally be able to access this via mcp"*.
 *
 * The queue above holds questions somebody has drafted answers for, which a reviewer can press. It
 * is therefore a measure of how much drafting has happened, and was reading as a measure of how much
 * is undecided — the two are the same number only on a corpus where every hole has been worked. A
 * short queue over ninety blank slots told a reviewer the corpus was nearly done.
 *
 * ⛔ AND IT IS NOT `renderWorklist`, WHICH SITS DIRECTLY BELOW THIS. That one counts blank slots per
 * feature and names the slots — it answers *"where do I start authoring"*, in the grid's vocabulary,
 * and it is the right thing to show somebody who has nothing to press. This answers *"what is the
 * question"*, folded so one answer covers every behaviour blank on the same policy. Same source,
 * different question, and the fold is the part no other surface does.
 *
 * ⛔ NOTHING HERE IS PRESSABLE, DELIBERATELY. A hole with no drafted options cannot be answered by
 * choosing, and a text box on a page of product truth is how a decision gets made by whoever is
 * tired — which is the sentence `decide` already uses about composing truth at a prompt. What a
 * reviewer gets is the question and an honest account of why they cannot answer it yet.
 */
function renderUnasked(corpus: Corpus, scopeId: string, ctx: Ctx): string {
  const it = interviewFor(corpus, scopeId);
  if (!it) return "";
  /**
   * ⛔ IT USED TO RETURN NOTHING ON ANY FEATURE WITH NO AGREED PURPOSE — the same defect as the
   * derivation's, in the surface, and on a corpus with 102 such features that is the whole page.
   *
   * The comment here said "the purpose gate is the queue's own business; this is about the detail
   * behind it", which sounds right and had it exactly backwards: a feature nobody has agreed a
   * purpose for is the one where knowing what is still unsaid matters MOST, because that is what
   * somebody weighs before agreeing to anything. Withholding it meant the page's honest answer to
   * "what is undecided here" was blank precisely where it was largest.
   */
  const unasked = it.owed.filter((o) => o.owes === "blank" || o.owes === "screen");
  if (!unasked.length) return "";

  const folded = unasked.filter((o) => o.fills.length > 1);
  return `
    <div class="unasked">
      <h3>Nobody has been asked these yet</h3>
      ${
        /**
         * ⛔ THE TWO NUMBERS, BECAUSE THE GAP BETWEEN THEM IS THE ONLY EVIDENCE THE FOLD HAPPENED.
         * How many questions, against how many places they would fill. Equal only when nothing
         * folded, and a reader who cannot see the difference has no reason to believe it.
         */
        `<p class="lede">${unasked.length} question${unasked.length === 1 ? "" : "s"}, covering
         <strong>${unasked.reduce((n, o) => n + o.fills.length, 0)}</strong> places where this
         product does not yet say what it does${
           folded.length
             ? ` — ${folded.length} of them ${folded.length === 1 ? "is one answer that settles several" : "are each one answer that settles several"}`
             : ""
         }.</p>`
      }
      <p class="note">Each needs options drafted against it before anybody can choose. Until then it
      is not a decision anybody has declined to make — it is one nobody has been offered.</p>
      <ul class="unasked-list">
        ${unasked
          .map(
            (o) => `
          <li>
            <p class="u-asks">${line(o.asks)}</p>
            <p class="u-why">${line(o.why)}</p>
            ${
              o.fills.length > 1
                ? `<p class="u-fills">one answer settles ${o.fills.length}: ${o.fills
                    .map((f) => refLink(f, ctx))
                    .join("; ")}</p>`
                : ""
            }
          </li>`
          )
          .join("")}
      </ul>
    </div>`;
}

function renderWorklist(
  corpus: Corpus,
  grids: Grid[],
  acts: ReturnType<typeof actsFor>,
  written: number,
  blanks: number,
  gatedCount: number,
  ctx: Ctx
): string {
  const rows = grids
    .map((g) => {
      const missing = new Map<SlotName, number>();
      for (const r of g.rows)
        for (const slot of SLOTS) if (r.cells[slot].mark === "·") missing.set(slot, (missing.get(slot) ?? 0) + 1);
      const total = g.rows.length * SLOTS.length;
      const blank = [...missing.values()].reduce((a, b) => a + b, 0);
      // ⛔ What is written and what has been AGREED are different questions, and a worklist that
      // answers only the first sends somebody to author a feature whose sentences nobody has read.
      const toRead = acts.behaviours.filter((b) => b.startsWith(`${g.scope}#`)).length;
      return { g, blank, total, said: total - blank, toRead, missing: [...missing.keys()] };
    })
    .filter((r) => r.blank)
    // Fewest holes first: the least work, and the first to become agreeable.
    .sort((a, b) => a.blank - b.blank);
  if (!rows.length) return "";
  return `
    <div class="gate-note">
      ${
        /**
         * ⛔ THIS SAID "nothing can be agreed to", AND IT STOPPED BEING TRUE ONE COMMIT AGO.
         *
         * It was written when a stamp could only cover a whole exchange, so a single blank slot made
         * the whole thing un-agreeable. A behaviour can now be agreed to on its own — and telling a
         * reviewer there is nothing they can do, on the page whose job is to give them something to
         * do, is the same failure as the manufactured queue in a politer voice.
         *
         * There are two different numbers here and they are not the same work: sentences waiting to
         * be READ, and slots waiting to be WRITTEN.
         */
        acts.behaviours.length
          ? `<p><strong>${acts.behaviours.length} behaviour${acts.behaviours.length === 1 ? "" : "s"} nobody has
             agreed to yet.</strong> Each is one sentence; open a feature below and read them.</p>`
          : `<p><strong>Every written behaviour has been agreed to.</strong></p>`
      }
      <p>And ${written} of ${written + blanks} slots carry a sentence — the other ${blanks} say nothing at
      all, so ${gatedCount} ${gatedCount === 1 ? "ask is" : "asks are"} not yet complete enough to agree to
      whole.</p>
      <p class="what-next">Writing ${blanks} sentences by hand is not review. Pick a feature below, have
      its blanks drafted from the code and from what the previous model recorded, and review the
      drafts here — that is the loop. ${
        /**
         * ⛔ SAY WHAT THE ORDER ACTUALLY IS. This claimed the top rows were "closest to finished",
         * and on a freshly migrated corpus every feature has exactly one slot in eight — so the
         * ordering is by SIZE, and calling it completeness tells a reviewer they are nearly done
         * with something nobody has started.
         */
        rows.every((r) => r.said === r.g.rows.length)
          ? "They are ordered smallest first, so the top of the list is the least work — none of them is further along than any other."
          : "They are ordered by how much is missing, so the top of the list is the least work."
      }</p>
    </div>
    <table class="worklist">
      <thead><tr><th>Feature</th><th>To read</th><th>Written</th><th>Missing</th></tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr>
            <td>${refLink(r.g.scope, ctx, line(r.g.title))}</td>
            <td class="num">${r.toRead ? `<strong>${r.toRead}</strong>` : "—"}</td>
            <td class="num">${r.said} / ${r.total}</td>
            <td>${r.missing.map((m) => `<code>${esc(SLOT_LABEL[m])}</code>`).join(" ")}</td>
          </tr>`
        )
        .join("")}</tbody>
    </table>`;
}

/**
 * The behaviours a scope states, one at a time, as the thing a person is asked about.
 *
 * ⛔ THIS IS THE GRAIN THE WHOLE SURFACE GOT WRONG.
 *
 * The page handed a reviewer an eight-compartment cluster and asked them to fill it, which produced
 * "Deal row on CRE Deals → refuses" — not a hard question, not a question. `GLOSSARY.md` calls one
 * falsifiable claim "the atom", and it is what somebody reads and has an opinion about in five
 * seconds. The eight slots are an AUTHORING device: they make thinness countable. Turning them into
 * the reviewer's unit of work was the error, and everything else followed from it.
 *
 * So: one sentence, what demonstrates it, where it came from, and the only question a person can
 * answer about it.
 */
/**
 * ⛔ THE DECISION FIRST, THEN THE PICTURE.
 *
 * A reviewer opening a feature at 1440px met the screen panel, a whole viewport of it, then four
 * yellow boxes each saying *"Nothing here says…"*, and reached the first thing they could judge on
 * the second screen. The one fact they came for — can this be built, and what stops it — was not
 * on the page at all, in any position: the packet had known the answer since it was written and no
 * rendered surface asked it.
 *
 * ⛔ AND IT IS THE PACKET'S ANSWER. `readinessOf` returns the hole list the packet's own banner is
 * built from, so the page and the artifact a builder receives cannot disagree about whether this is
 * ready. Counting unsettled slots here instead would have been a second derivation of a verdict
 * that already exists, which is the defect this project most often finds in itself.
 *
 * ⛔ AND NO REF REACHES THE READER. A hole comes back as `record-spending#after` — an address. It
 * is rendered as the behaviour's title and the slot's question, which is the same fact in the words
 * somebody can argue with.
 */
function featureHead(corpus: Corpus, scopeId: string, title: string, ctx: Ctx): string {
  const verdict = readinessOf(corpus, scopeId);
  const open = questionsFor(corpus, scopeId).filter((q) => !q.parked);
  /**
   * `<exchange>#<slot>` → the behaviour's own title and what the slot asks.
   *
   * ⛔ AN UNRESOLVED HOLE IS DESCRIBED, NEVER PRINTED. The packet addresses a hole by exchange id
   * because a builder needs the address; a reader must never meet one. So an id this subtree cannot
   * name comes out as the slot's question alone, which is still true and still actionable — and the
   * one thing it may not do is fall back to the raw ref.
   */
  const under = descendants(corpus, scopeId);
  const named = (hole: string): string => {
    const part = / \(part\)$/.test(hole);
    const [exId, slot] = hole.replace(/ \(part\)$/, "").split("#");
    const ex = under
      .flatMap((id) => corpus.scopes.find((s) => s.scope.id === id)?.scope.exchanges ?? [])
      .find((x) => x.id === exId);
    const asks = SLOT_ASKS_SHORT[slot as SlotName] ?? "";
    const tail = `${asks}${part ? ", in part" : ""}`;
    return ex ? `${plain(ex.title)}${tail ? ` — ${tail}` : ""}` : tail || "something nobody has written down";
  };
  const says = verdict
    ? verdict.ready
      ? `<p class="verdict ready"><b>Ready to build: yes.</b> Nothing in it is waiting on a decision.</p>`
      : `<p class="verdict blocked"><b>Ready to build: no.</b> ${verdict.holes.length} thing${
          verdict.holes.length === 1 ? "" : "s"
        } here ${verdict.holes.length === 1 ? "is" : "are"} undecided, and anybody who fills ${
          verdict.holes.length === 1 ? "it" : "one"
        } in has invented product truth:</p>
         <ul class="verdict-holes">${verdict.holes.map((h) => `<li>${esc(named(h))}</li>`).join("")}</ul>`
    : "";
  /**
   * ⛔ THE QUESTIONS, NOT A COUNT OF THEM. A number sends a reader looking for the queue; the
   * questions themselves are the work, and each links to the card that answers it — which is the
   * part of this product the review called the best thing in it, and is not reproduced here.
   */
  const asks = open.length
    ? `<p class="verdict-asks">${open.length} question${open.length === 1 ? "" : "s"} nobody has answered:</p>
       <ul class="verdict-qs">${open
         .map((q) => `<li>${refLink(q.ref, ctx, plain(q.asks).split(/(?<=\?)\s/)[0] ?? plain(q.asks))}</li>`)
         .join("")}</ul>`
    : "";
  return `<header class="feature-head">
    <h3 class="feature-title">${title}</h3>
    ${says}
    ${asks}
  </header>`;
}

function renderBehaviours(
  corpus: Corpus,
  scopeId: string,
  cellOf: Map<string, Cell>,
  ctx: Ctx,
  /** ⛔ Whether a press can record anything. An inert control is worse than none — see `page`. */
  interactive: boolean
): string {
  const entry = corpus.scopes.find((s) => s.scope.id === scopeId);
  if (!entry) return "";
  const rows: Array<{
    view?: string;
    state?: string;
    sref: string;
    slot: SlotName;
    says: string;
    label: string;
    settled: boolean;
    standing: string;
    detail: string;
    /**
     * ⛔ WHO THIS SENTENCE IS PROMISED TO, carried to the row so the page can be filtered without a
     * reload. Peter: *"the dimensions should affect the truths as well"*, and then, of the filter:
     * *"is the dimension filter on every feature page"* — it was not, and a filter that needs a
     * round trip per choice is not a filter.
     *
     * ⛔ THE SLOT'S AND THE STATEMENT'S, MERGED, with the statement's winning. They say different
     * things — the slot's is "this part only exists there", the statement's is "this sentence is
     * only promised there" — and a sentence inside an admin-only slot is admin-only whatever it
     * says about itself.
     */
    holds?: Record<string, string>;
  }> = [];
  for (const ex of entry.scope.exchanges) {
    const ref = `${scopeId}#${ex.id}`;
    for (const slot of SLOTS) {
      const fill = (ex.slots as Record<string, Record<string, unknown> | undefined>)[slot];
      const cell = cellOf.get(`${ref}#${slot}`);
      // ⛔ Only what somebody has actually said. A blank is an authoring gap, reported in the
      // worklist — it is not a behaviour, and putting it here is what asked a person to fill cells.
      const parts = statements(fill?.says as Says);
      const says = fill?.says
        ? line(saysText(fill.says as Says))
        : fill?.none
          ? /** ⛔ What `none` means HERE — `after` and `again` are not refusals (fg-0015). */
            `<em>${nothingHere(slot)}</em>`
          : fill?.cannot_fail
            ? `<em>cannot fail</em>`
            : (fill?.outcomes as Array<{ name: string; when: string; told: string }> | undefined)?.length
              ? (fill!.outcomes as Array<{ name: string; when: string; told: string }>)
                  .map((o) => `<strong>${esc(o.name)}</strong> — when ${line(o.when)}, ${line(o.told)}`)
                  .join("<br>")
              : "";
      if (!says) continue;
      const standing = (fill?.standing as { kind?: string } | undefined)?.kind ?? "stated";
      const settled = standing === "stated";
      const slotShows = ex.criteria.filter((c) => c.slot === slot);
      /**
       * ⛔ ONE CARD PER STATEMENT, because one card per SLOT was not reviewable.
       *
       * Listing a slot's statements and taking one decision over the set looked reasonable at nine.
       * At thirteen — one lender's Fannie Mae program settings, with thirty-one criteria under a
       * single "That is right" — it plainly is not. Peter: "this is one card?????"
       *
       * Every statement carries an id, so each can be agreed to, reworded or ruled on its own. The
       * set still takes one press when a reviewer wants that: see `renderTakeAll`.
       */
      /**
       * ⛔ `none` AND `cannot_fail` ARE STATED BEHAVIOURS, AND THEY VANISHED.
       *
       * They carry no `says`, so iterating the statements produced no card at all — "nothing to
       * refuse" and "cannot fail" are things somebody decided and a reviewer should agree to, and
       * they silently left the surface when cards moved from per-slot to per-statement.
       *
       * One synthetic statement whose id is the slot itself, so its ref stays `<scope>#<ex>#<slot>`
       * and any stamp already made against it still covers it.
       */
      const shown = parts.length ? parts : [{ id: "it", says: "" }];
      for (const said of shown) {
        const shows =
          shown.length > 1
            ? slotShows.filter((c) => c.of === said.id || (!c.of && said.id === shown[0]!.id))
            : slotShows;
        const sref = shown.length > 1 && said.id !== "it" ? `${ref}#${slot}#${said.id}` : `${ref}#${slot}`;
        const past = decisionsOn(corpus, sref);
        rows.push({
          view: ex.at?.view,
          /**
           * ⛔ THE APPEARANCE, NOT JUST THE SCREEN. Peter, after the first grouping landed: *"should
           * have subsections for which screen we're talking about."*
           *
           * Grouping by view alone gave create-deal ONE subsection, because all six of its exchanges
           * are on `create-deal-form` — so the grouping existed and did nothing. The division a
           * reviewer actually means there is the details form against the folder step, and that is
           * `at.state`, which the model gained earlier today. Two screens as far as anybody using
           * the product is concerned.
           */
          state: ex.at?.state,
          sref,
          slot,
          /**
           * ⛔ THE LABEL COMES FROM THE RAW SENTENCE, NOT THE RENDERED ONE.
           *
           * The row's `says` is already HTML — `<em>nothing to refuse</em>` for a slot with nothing
           * to refuse — so putting it through `esc` for the label produced
           * `&lt;em&gt;nothing to refuse&lt;/em&gt;`, which the browser then writes out as visible
           * markup in a tooltip. A test for exactly this double-escape has existed since an earlier
           * round and caught it on the first full run.
           */
          label: `${SLOT_ASKS_SHORT[slot] ?? slot} · ${(shown.length > 1 && said.says
            ? said.says
            : fill?.says
              ? saysText(fill.says as Says)
              : fill?.none
                ? nothingHere(slot)
                : fill?.cannot_fail
                  ? "cannot fail"
                  : plain(ex.title)
          )
            .replace(/\s+/g, " ")
            .slice(0, 40)}`,
          /** ⛔ The whole sentence. See the table below for why nothing is cut. */
          says: shown.length > 1 ? line(said.says) : says,
          holds: {
            ...((fill as { holds_for?: Record<string, string> } | undefined)?.holds_for ?? {}),
            ...((said as { holds_for?: Record<string, string> } | undefined)?.holds_for ?? {}),
          },
          settled,
          standing,
          detail: `
            <p class="beh-where">
            ${esc(SLOT_ASKS_SHORT[slot] ?? slot)} · on ${refLink(ref, ctx, ex.title)}${
              ex.at?.view
                ? ` · <button type="button" class="show-part" data-show-part="${esc(`${ex.at.view}/${ex.at.part ?? ""}`)}">${
                    ex.at.part ? `show me ${esc(partLabel(corpus, scopeId, ex.at.view, ex.at.part))}` : "show me the screen"
                  }</button>`
                : ` · <span class="n owes-inline">nothing says where this happens</span>`
            }${cell && cell.rule ? ` · from <code>${esc(cell.rule)}</code>` : ""}${
              (() => {
                if (!ex.at?.part) return "";
                const sc2 = corpus.scopes.find((x) => x.scope.id === scopeId)?.scope;
                const vw = sc2?.views.find((x) => x.id === ex.at!.view);
                if (!sc2 || !vw) return "";
                if (finishesFor(sc2, vw).includes(ex.at.part))
                  return ` · <span class="goes done">pressing it finishes this feature</span>`;
                const land = landingsFor(sc2, vw).find((l) => l.part === ex.at!.part);
                if (!land) return "";
                return ` · <span class="goes">pressing it goes to <b>${esc(land.label)}</b>${
                  ex.lands_on ? "" : " <i>(read from what it says, not stated)</i>"
                }</span>`;
              })()
            }</p>
            ${
              (ex.slots?.may?.held_by ?? []).length && slot === "may"
                ? `<p class="held-by">${(ex.slots!.may!.held_by ?? [])
                    .map((id: string) => {
                      const a = corpus.access.find((x) => x.id === id);
                      return `<span class="who ${a ? a.kind : "unknown"}" title="${esc(a ? a.means : "nothing in this product is called that")}">${esc(id)}</span>`;
                    })
                    .join("")}</p>`
                : ""
            }
            ${
              shows.length
                ? `<details class="beh-shows"><summary>${shows.length} thing${shows.length === 1 ? "" : "s"} that would show this</summary><ul>${shows
                    .map(
                      (c) =>
                        /**
                         * ⛔ `steps` IS RENDERED, and leaving it out made a requirement an EMPTY
                         * BULLET. A claim whose demonstration is a sequence — press it three times
                         * and the order cycles — cannot be said in one `when` without reading as a
                         * single press, so `Criterion` has always carried `steps` and the
                         * demonstrator brief's own example uses it. This built the text from
                         * `given`/`when`/`then` only, so such a requirement rendered as
                         * `<ul><li></li></ul>` under a summary counting it. The count was honest
                         * and the list was not: "3 things that would show this" over two sentences
                         * and a blank line, which tells a reader either something is missing or
                         * they cannot count.
                         *
                         * ⛔ Reported by a demonstrator that wrote one and SAW it on the live page,
                         * and which kept `steps` rather than reshaping the artefact to suit the
                         * renderer — the right direction, and why this is a renderer fix.
                         */
                        `<li>${[
                          c.given && `<span class="g">given</span> ${line(c.given)}`,
                          c.when && `<span class="g">when</span> ${line(c.when)}`,
                          c.then && `<span class="g">then</span> ${line(c.then)}`,
                          c.steps && `<span class="g">steps</span> ${line(c.steps)}`,
                        ]
                          .filter(Boolean)
                          .join(" ")}</li>`
                    )
                    .join("")}</ul></details>`
                : `<p class="beh-nothing">Nothing here says what would show this working.</p>`
            }
            ${
              ex.at?.view
                ? `<figure class="card-screen" data-of="${esc(ex.at.view)}"${ex.at.part ? ` data-focus="${esc(ex.at.part)}"` : ""}><figcaption>${
                    ex.at.part
                      ? `${esc(partLabel(corpus, scopeId, ex.at.view, ex.at.part))} on ${esc(viewTitle(corpus, scopeId, ex.at.view))}`
                      : esc(viewTitle(corpus, scopeId, ex.at.view))
                  }</figcaption></figure>`
                : ""
            }
            ${
              /**
               * ⛔ WHO AGREED AND WHEN, IN THE DETAIL. The chip has to fit a column, so it says one
               * word and carries the rest in its title — and a tooltip is not a record. An earlier
               * round established that a badge reading "confirmed" has to say by whom, or it is a
               * claim nobody can check; this is where that sentence went when the badge became a
               * chip.
               */
              renderState(corpus, sref)
            }
            ${renderRecord(past)}`,
        });
      }
    }
  }
  if (!rows.length) return "";

  /**
   * ⛔ ONE TABLE, GROUPED BY SCREEN, NOTHING CUT.
   *
   * Peter: *"even MORE tabular. single table. do not truncate text, make the text all visible,
   * group into subsections based on which screen it applies to. add a chip for confirmed or not,
   * chip for 'type'. we don't need 'this is right', 'not quite- reword it', 'not ours to say' -
   * those are the check/edit/delete buttons."*
   *
   * The previous pass made each behaviour a collapsed row and left three things wrong. The rows
   * were 201 separate elements rather than a table, so nothing lined up in columns and the eye had
   * no edge to run down. The sentence was clipped with an ellipsis, so the one thing a reviewer is
   * judging was the one thing they could not read without opening it. And the three worded buttons
   * stayed below each row, duplicating the icons above them — two ways to perform one act, which is
   * how a reader learns to distrust both.
   *
   * ⛔ GROUPED BY SCREEN, BECAUSE THAT IS THE UNIT A REVIEWER HOLDS IN THEIR HEAD. Thirty sentences
   * in exchange order is thirty unrelated judgements; the same thirty under "Create a deal" and
   * "Folder step" is two screens, each of which can be read as a whole and found wrong as a whole.
   *
   * ⛔ ONE `<tbody>` PER SCREEN rather than one table each: a reader comparing two screens needs the
   * columns to be the same width, and separate tables size their columns independently.
   */
  const groups = new Map<string, typeof rows>();
  const key = (r: (typeof rows)[number]) => `${r.view ?? ""}\u0000${r.state ?? ""}`;
  for (const r of rows) {
    const at = groups.get(key(r)) ?? [];
    at.push(r);
    groups.set(key(r), at);
  }
  /**
   * Screens in the order the feature's own path meets them, then anything not on a screen. Within
   * one screen, the default appearance first and its states in the order they are drawn — which is
   * the order somebody moves through them.
   */
  const order = [...(entry.scope.happy_path?.through ?? []), ...entry.scope.views.map((v) => v.id)];
  const rank = (k: string): [number, number] => {
    const [v, st] = k.split("\u0000");
    if (!v) return [999, 999];
    const i = order.indexOf(v);
    const states = entry.scope.views.find((x) => x.id === v)?.states ?? [];
    return [i < 0 ? 998 : i, st ? states.findIndex((x) => x.when === st) + 1 : 0];
  };
  const keys = [...groups.keys()].sort((a, b) => {
    const [av, as] = rank(a), [bv, bs] = rank(b);
    return av - bv || as - bs;
  });

  const confirmed = rows.filter((r) => stampFor(corpus, r.sref).state === "accepted").length;
  const bodies = keys
    .map((k) => {
      const mine = groups.get(k)!;
      const [view, state] = k.split("\u0000");
      const screen = view ? viewTitle(corpus, scopeId, view) : "Not on any screen";
      /** ⛔ The state's own label, which is what a reviewer would call that step. */
      const st = state
        ? entry.scope.views.find((x) => x.id === view)?.states?.find((x) => x.when === state)
        : undefined;
      const title = st ? `${screen} — ${st.label || st.when}` : screen;
      const done = mine.filter((r) => stampFor(corpus, r.sref).state === "accepted").length;
      return `<tbody data-screen="${esc(view)}" data-state="${esc(state)}">
        <tr class="group"><th colspan="2">${line(title)} <span class="n">${done} of ${mine.length} confirmed</span></th></tr>
        ${mine.map((r) => behRow(corpus, r, interactive)).join("")}
      </tbody>`;
    })
    .join("");

  /**
   * ⛔ `data-sync` IS WHAT LETS THIS UPDATE WITHOUT A RELOAD. Peter: *"table should refresh
   * dynamically and not do the screen reload thing."* The id has to be stable across renders, or a
   * refresh would have nothing to swap into.
   */
  /**
   * ⛔ THREE COUNTS DISAGREED AND ALL THREE WERE RIGHT. The tab said Money 21, this heading said 22
   * behaviours, the sub-tab said Behaviors 4 — and they were counting three different things under
   * two names:
   *
   *   · 4  — behaviours. Four things a person can ask this feature to do.
   *   · 22 — SENTENCES. Every slot anybody has filled in across those four, which is what this table
   *          has a row for and what `rows` has always been. Calling them "behaviours" was the bug.
   *   · 21 — the 22 minus the one nobody has settled: sentences somebody still has to READ. The nav
   *          chip's own tooltip said "to read" and the pill beside it said nothing.
   *
   * ⛔ SO THE FIX IS THE NAMES, NOT THE ARITHMETIC. Forcing them to one number would have deleted
   * two true facts to make a third one tidy. The behaviour count here is `scope.exchanges.length` —
   * the same expression the sub-tab reads, so the two cannot drift.
   */
  const behaviours = entry.scope.exchanges.length;
  return `<section class="behaviours" data-sync="behaviours-${esc(scopeId)}">
    <h3 class="sub">${rows.length} sentence${rows.length === 1 ? "" : "s"} across ${behaviours} behaviour${
      behaviours === 1 ? "" : "s"
    } · ${confirmed} confirmed</h3>
    <p class="what-next">One sentence at a time. <b>Agree</b> if it is right, <b>Reword</b> to change it, <b>Remove</b> to take it out. Tap a row for what shows it, the screen, and what has been decided.</p>
    <table class="beh-table">
      <thead><tr><th>What the product promises</th><th></th></tr></thead>
      ${bodies}
    </table>
  </section>`;
}

/**
 * ⛔ ONE CARD OF A FEATURE'S FRAMING, AGREED TO ON ITS OWN.
 *
 * Peter: *"'why', 'success measures', 'risks' can all be cards that are added in the 'overview'
 * tab. instrumentation should be added as well."*
 *
 * The same badge and the same two acts as everything else on the page. ⛔ A fourth shape of consent
 * for the framing would be a fourth thing to trust, and the whole point of these cards being
 * addressable is that a risk is agreed to or dropped without touching its neighbours.
 */
/**
 * The chips and the reason for one ref. ⛔ ONE IMPLEMENTATION, BECAUSE THERE ARE TWO SITES.
 *
 * The card and the behaviour row each computed `stampFor` and wrote their own chip, and the two had
 * already drifted once — the row's stale chip carried a `title` saying who agreed and the card's did
 * not. A confidence chip duplicated the same way would be two answers to the question the model
 * exists to settle, which is the defect `gateFor` diverging from `check` already cost this project.
 *
 * ⛔ AND THE REASON IS MARKUP, NOT A TOOLTIP. Peter: *"the reason why it has confidence needs to be
 * visible as well"*. A `title` is not visible — it cannot be scanned down a column, it does not
 * survive the screenshot this corpus is reviewed in, and on a touch screen it does not exist.
 */
function confidenceParts(corpus: Corpus, ref: string): { chips: string; why: string } {
  const c = confidenceOf(corpus, ref);

  /**
   * ⛔ THE CONFIRMED CHIP IS LEFT ALONE. It is the only pill with a colour, and every chip below is
   * square — so the zones are told apart by shape before a word is read.
   */
  /**
   * ⛔ A CONFIRMATION WITH NEWER EVIDENCE IS NOT A CLEAN CONFIRMATION, and the chip has to say so.
   * It is the one row a reader would otherwise skip: the surface at its most confident over the
   * truth at its least settled.
   */
  const late = c.confirmed ? discrepancyFor(corpus, ref) : null;
  const stampChip = late
    ? `<span class="chip warn" title="by ${esc(late.confirmed.by)} on ${esc(late.confirmed.at)}">confirmed · newer evidence</span>`
    : c.confirmed?.through
    ? `<span class="chip ok" title="${esc(c.confirmed.by)} confirmed the rule ${esc(c.confirmed.through)} on ${esc(c.confirmed.at)}">confirmed · by rule</span>`
    : c.confirmed
    ? `<span class="chip ok" title="by ${esc(c.confirmed.by)} on ${esc(c.confirmed.at)}">confirmed</span>`
    : c.stale
      ? `<span class="chip warn">changed since</span>`
      : `<span class="chip">not confirmed</span>`;

  /**
   * ⛔ NO STRENGTH CHIP ON A CONFIRMED STATEMENT. A person agreed to it; how many code paths also
   * happen to agree is not what a reviewer needs from that row, and a second chip beside
   * `confirmed` is the exact adjacency that makes the two zones look like one scale.
   */
  const strengthChip =
    c.confirmed || c.strength === "none"
      ? ""
      : `<span class="chip support${c.strength === "strongly-supported" ? " strong" : ""}${
          /** ⛔ Dotted when nothing was read about this sentence itself — borrowed or about the exchange. */
          c.support.length === 0 ? " inherited" : ""
        }" title="${esc(
          c.support.length ? `${c.support.length} read about this` : "nothing read about this statement itself",
        )}">${esc(c.strength.replace(/-/g, " "))}${c.sources ? ` · ${c.sources}` : ""}</span>`;

  /**
   * Shown when there is something to say beyond "nobody confirmed it and nothing was read" — which
   * is most of a young corpus, and a reason repeated on three hundred rows is noise.
   */
  /**
   * ⛔ WHAT MOVED, NOT JUST THAT SOMETHING DID. A chip reading "changed since" tells a reviewer their
   * acceptance is dead and nothing about what to do next. Six of Peter's nine acceptances went stale
   * in a day because a regeneration reworded the view they were on, and re-confirming meant
   * reconstructing from memory what he had agreed to. The diff is the whole difference between that
   * and one glance.
   */
  const moved = c.stale ? whatChangedSince(corpus, ref) : null;
  const worthSaying =
    c.support.length > 0 || c.contained.length > 0 || c.inherited.length > 0 || !!c.stale || !!late;
  const diff = moved
    ? `<div class="moved"><p class="k">what changed since ${esc(moved.by)} agreed on ${esc(moved.at)}</p>${
        moved.gone.map((l) => `<p class="gone">− ${esc(l)}</p>`).join("")
      }${moved.arrived.map((l) => `<p class="came">+ ${esc(l)}</p>`).join("")}</div>`
    : c.stale
      ? `<p class="moved k">⛔ This was agreed before the words were recorded, so what changed cannot be shown.</p>`
      : "";

  const why = worthSaying
    ? `<ul class="why">${whyConfident(corpus, ref)
        .map(
          (line) =>
            `<li${/Nobody has read this statement itself/.test(line) ? ' class="borrowed"' : ""}>${esc(line)}</li>`,
        )
        .join("")}</ul>`
    : "";

  /**
   * ⛔ THE LEVEL RIDES ON THE STAMP CHIP AS AN ATTRIBUTE, `levelOf`'S AND NO OTHER. The chip's words
   * say whether a person confirmed it, which cannot tell a derived sentence from a draft; a session
   * reading this page over MCP needs that without a second call, and a reader does not need a
   * third pill saying it. Omitted where `levelOf` has no answer, never guessed.
   */
  const lv = levelOf(corpus, ref);
  const levelled = "error" in lv ? stampChip : stampChip.replace("<span ", `<span data-level="${lv.level}" `);
  return { chips: `${levelled}${strengthChip}`, why: `${diff}${why}` };
}

function renderCard(
  corpus: Corpus,
  scopeId: string,
  list: "why" | "risk" | "measure" | "instrument",
  card: { id: string; says: string; target?: string; mitigated_by?: string; feeds?: string[] },
  interactive: boolean,
  /**
   * How to address a ref, so the measures a card feeds are reachable.
   *
   * ⛔ PASSED RATHER THAN DEFAULTED, because a default would silently keep a fragment. The renders
   * that genuinely have no address — a file, a published artifact — get a function that returns one,
   * from the single place that knows which render this is.
   */
  address: (ref: string) => string
): string {
  const ref = `${scopeId}#${list}#${card.id}`;
  const st = stampFor(corpus, ref);
  const ok = st.state === "accepted";
  return `<article class="frame-card" id="${anchorOf(ref)}" data-ref="${esc(ref)}" data-label="${esc(plain(card.says).slice(0, 48))}">
    <p class="frame-says">${line(card.says)}</p>
    ${card.target ? `<p class="frame-extra"><span class="k">target</span> ${line(card.target)}</p>` : ""}
    ${card.mitigated_by ? `<p class="frame-extra"><span class="k">what would be done</span> ${line(card.mitigated_by)}</p>` : ""}
    ${
      /**
       * ⛔ WHICH MEASURES IT FEEDS, NAMED. An instrument whose purpose is only in a field nobody
       * renders is telemetry whose reason is invisible — which is the state this pairing exists to
       * end.
       */
      card.feeds?.length
        ? `<p class="frame-extra"><span class="k">tells us</span> ${card.feeds
            .map((f) => `<a href="${esc(address(`${scopeId}#measure#${f}`))}">${esc(f)}</a>`)
            .join(", ")}</p>`
        : ""
    }
    <p class="chips">${confidenceParts(corpus, ref).chips}</p>
    ${confidenceParts(corpus, ref).why}
    ${
      interactive
        ? /** ⛔ Labelled, like the rows — one gesture, one meaning, and the same words for it. */
          `<footer class="beh-acts icons">${
            ok
              ? ""
              : `<button class="act icon" data-act="accept" data-ref="${esc(ref)}" title="That is right"><span class="glyph" aria-hidden="true">✓</span> Agree</button>`
          }<button class="act icon" data-act="say" data-ref="${esc(ref)}" title="Reword it"><span class="glyph" aria-hidden="true">✎</span> Reword</button>${
            ok
              ? ""
              : `<button class="act icon danger" data-act="withdraw" data-ref="${esc(ref)}" title="Take it out"><span class="glyph" aria-hidden="true">🗑</span> Remove</button>`
          }</footer>`
        : ""
    }
  </article>`;
}

/** One behaviour, as a row plus the row that opens under it. */
function behRow(
  corpus: Corpus,
  r: {
    sref: string;
    slot: SlotName;
    says: string;
    label: string;
    settled: boolean;
    standing: string;
    detail: string;
    /** ⛔ Who it is promised to — see the row type in `renderBehaviours`. */
    holds?: Record<string, string>;
  },
  interactive: boolean
): string {
  const st = stampFor(corpus, r.sref);
  const ok = st.state === "accepted";
  /**
   * ⛔ A CHIP FOR EACH, because a word in a sentence is not something you can scan a column of.
   * The stale states read as NOT confirmed and say why — a chip saying confirmed over a sentence
   * nobody read is the failure those states exist to catch.
   */
    /** ⛔ ONE IMPLEMENTATION FOR BOTH SITES — see `confidenceParts`. These two had already drifted:
     *  the row's stale chip carried a title naming who agreed and the card's did not. */
    const parts = confidenceParts(corpus, r.sref);
    const chip = parts.chips;
  /*
   * ⛔ `data-holds` IS OMITTED WHERE A SENTENCE IS EVERYBODY'S, not written as an empty object.
   *
   * The filter treats an absent attribute as "holds everywhere", which is the model's own default —
   * so an empty `{}` would be a third state meaning the same thing, and the first reader to treat it
   * as "holds for nothing" would empty the page. ⛔ And this repo's own rule applies: for a feature
   * whose correct answer today is zero, a count of these attributes is not a check. The test reads
   * three outcomes out of one corpus instead.
   */
  const holds = r.holds && Object.keys(r.holds).length ? ` data-holds="${esc(JSON.stringify(r.holds))}"` : "";
  return `<tr class="beh" id="beh-${slug(r.sref)}" data-beh="${esc(r.sref)}" data-ref="${esc(r.sref)}" data-label="${esc(r.label)}"${holds}>
      <td class="row-says"><span class="says-text">${r.says}</span>${
        /**
         * ⛔ THE CHIPS RUN ON FROM THE SENTENCE. Peter: *"chips inline with the text at the end of
         * the sentence."*
         *
         * They were two fixed columns, which cost twelve rems of width on every row to say one word
         * each — and on a long sentence the chip sat level with the FIRST line, several lines away
         * from where the sentence ended. ⛔ A chip is an annotation on the sentence, so it reads at
         * the end of it, the way a footnote does.
         */
        ""
      } <span class="chips">${chip}<span class="chip type">${esc(SLOT_ASKS_SHORT[r.slot] ?? r.slot)}</span></span>${
        r.settled ? "" : `<p class="owes">Not settled yet — ${esc(r.standing.replace(/_/g, " "))}. It is in the queue.</p>`
      }</td>
      <td class="row-acts">${
        /**
         * ⛔ THE BUTTONS SAY WHAT THEY DO. Three glyphs — ✓, ✎, a bin — on every row of the one
         * table that IS the review job, and nothing on the page naming any of them. A tooltip is
         * not a label: it cannot be scanned down a column, it does not survive the screenshot this
         * corpus gets reviewed in, and on a touch screen it does not exist — the same argument this
         * file already settled for the confidence chip.
         *
         * ⛔ AND THE GLYPH STAYS BESIDE THE WORD. It is what the eye finds on the two-hundredth row;
         * the word is what tells the first-time reader what it will do.
         */
        r.settled && interactive
          ? `${ok ? "" : `<button class="act icon" data-act="accept" data-ref="${esc(r.sref)}" title="That is right — confirm it"><span class="glyph" aria-hidden="true">✓</span> Agree</button>`}<button class="act icon" data-act="say" data-ref="${esc(r.sref)}" title="Reword it"><span class="glyph" aria-hidden="true">✎</span> Reword</button>${
              ok ? "" : `<button class="act icon danger" data-act="withdraw" data-ref="${esc(r.sref)}" title="Take it out — nobody has agreed to this yet"><span class="glyph" aria-hidden="true">🗑</span> Remove</button>`
            }`
          : ""
      }</td>
    </tr>
    <tr class="beh-detail" data-for="${esc(r.sref)}" hidden><td colspan="2">${r.detail}${
      /**
       * ⛔ THE REASON FOR THE CONFIDENCE, IN THE ROW THAT CARRIES THE CHIP. Peter: *"the reason why
       * it has confidence needs to be visible as well"*.
       *
       * In the expanded detail rather than on the collapsed row, because he asked for the table to
       * be tabular — *"collapse all the info, only on row tap does it expand"* — and three hundred
       * rows each carrying three lines of provenance is the dense wall that request was about. The
       * chip is the signal; this is the argument behind it, one tap away.
       */
      parts.why
    }</td></tr>`;
}


/**
 * "Change something here" — a request, captured with what the person was looking at.
 *
 * ⛔ THE FIVE ACTS CANNOT SAY THIS. They record a judgement about a sentence: right, not ours,
 * undecided. A reviewer looking at a screen thinking "the tab strip should show the pinned version"
 * or "this sketch is two releases out of date" has nowhere to put it, and the options in front of
 * them are all wrong answers — so they either mis-file it as a rewording or say nothing.
 *
 * ⛔ IT CAPTURES THE REF, NOT JUST THE WORDS. "This is wrong" tells you almost nothing an hour
 * later. What they were looking at is the part nobody can reconstruct afterwards, so it is recorded
 * with the note and shown in the panel before they send it — a person should see what their words
 * are being attached to.
 *
 * ⛔ AND IT IS NOT PRODUCT TRUTH. Nothing here changes what the product does; it is a message to
 * whoever authors. See `Note` in the schema for why it is neither a verdict nor a slot.
 */
function renderNotePanel(_corpus: Corpus, _ids: string[], opts: PageOptions): string {
  if (!opts.interactive) return "";
  /**
   * ⛔ ALWAYS THERE, AND IT DOES NOT ASK WHAT YOU ARE LOOKING AT.
   *
   * This was a floating button that opened a panel with an "attach it to" dropdown. Two defects in
   * one: the button hid itself while the panel was open, so the affordance was not in fact always
   * available; and the dropdown asked the reader to re-state the thing the page already knows.
   *
   * A reader will write the note if it costs one click and nothing to think about. Every field
   * between them and the text box is a chance to not bother — and a request nobody bothered to make
   * is indistinguishable from a page with nothing wrong with it.
   *
   * So: one box, docked, with the captured section shown beside it rather than chosen.
   */
  /**
   * ⛔ THE CAPTURED PLACE GOES ABOVE THE BOX, ON ITS OWN LINE.
   *
   * Beside the box it competed with the text for width and got truncated to an ellipsis — so the
   * one thing the reader needs to check before sending was the first thing squeezed out. It is also
   * the thing they are most likely to want to correct by scrolling, so it has to be legible while
   * they type.
   */
  /**
   * ⛔ THE COMPOSER ONLY. THE HISTORY ABOVE IT IS GONE, AND IT WAS MINE TO REMOVE.
   *
   * I built a thread here an hour earlier, reading *"let's add a 2-way window so you can send
   * messages back as well"* as "put the conversation on the screen". Peter, looking at it: *"pos:
   * the history of messages on a screen is unnecessary, the one right above the send button."*
   *
   * He is right, and the mistake is worth naming: a reply reaching him is the requirement; a log of
   * everything ever said about this screen, permanently occupying the space above the box he types
   * in, is a different thing that happens to contain it. The channel still exists — `notes say`
   * still records a reply and the inbox still carries it — what is gone is the surface that pushed
   * the screen he came to review further up the page every time somebody spoke.
   */
  return `
    <form id="note-bar" class="note-bar" autocomplete="off">
      ${
        /**
         * ⛔ THE "ABOUT" LINE IS GONE. Peter: *"hide the 'about: {which page}' piece. not needed."*
         *
         * It named the ref the composer would attach — which a reviewer already knows, because they
         * are looking at it. ⛔ The ref is still captured and still sent: it is the one thing a
         * person cannot reconstruct an hour later, which is why it was shown in the first place. It
         * simply does not need a line of the frame to say what the screen already says.
         */
        ""
      }
      <div class="note-row">
        <textarea id="note-text" rows="1" placeholder="Change something here…"
          aria-label="Ask for a change to what you are looking at. Enter sends, Shift+Enter starts a new line. Start with pos: for a framework issue"></textarea>
        <button type="submit" id="note-send">Send</button>
        ${
          /**
           * ⛔ THE ACKNOWLEDGEMENTS BECOME A CHIP ON THIS ROW. Peter: *"'8 framework asks' - make
           * this just a chip inline with the send button, showing '8', and clicking it will expand
           * it."*
           *
           * It was a bar of its own below the composer, carrying a sentence. Two bars stacked under
           * a page is two lines of frame for one line of content, and the sentence said what the
           * number says. Filled by the live script; absent until there is something to count.
           */
          ""
        }
        <button type="button" id="ack-chip" class="ack-chip" hidden></button>
        <span class="status" id="note-status"></span>
      </div>
    </form>`;
}




/**
 * ⛔ WHAT THE FEATURE IS FOR, AT THE TOP, AGREED FIRST.
 *
 * Peter: "this describes the 'meat' of the feature — what should be accomplished in the happy path,
 * input, desired output, and with screens that describes this flow. the behaviors get into the
 * 'details'. but we need to make sure the context is correct before the behaviors get validated —
 * because that could change."
 *
 * The first thing a reviewer used to be handed was a detail: *"the stage filter offers the stages of
 * the CRE funnel this organization uses"*. Judging that requires knowing what the screen is for, and
 * nothing on the page said — so the context was supplied from the reviewer's memory, differently
 * each time, and never recorded.
 */
function renderHappyPath(corpus: Corpus, scopeId: string, ctx: Ctx, past: Decision[]): string {
  const sc = corpus.scopes.find((s) => s.scope.id === scopeId)?.scope;
  if (!sc) return "";
  const ref = `${scopeId}#happy-path`;
  if (!sc.happy_path)
    return sc.exchanges.length
      ? `<section class="happy none">
          <h3>What this feature is for</h3>
          <p class="owes">Nothing says what this feature is for — what gets accomplished, what the
          person arrives with, what they leave with. Until somebody does, the sentences below cannot
          be agreed to: a detail of a purpose nobody has confirmed is a stamp spent on something
          about to change.</p>
        </section>`
      : "";
  const hp = sc.happy_path;
  const stamp = stampFor(corpus, ref);
  const agreed = stamp.state === "accepted";
  /**
   * ⛔ WHAT SOFTWARE DECIDED, SAID ON THE THING ITSELF.
   *
   * Peter: "decide and override, but should be obvious to be asked to change." A default that is
   * not findable is not a default — it quietly becomes the answer. So it is stated where the
   * sentence is, in the words of what actually happened: nobody has looked at this.
   */
  const landed = agreed ? undefined : decidedFor(corpus, ref);
  return `
    <section class="happy${agreed ? " agreed" : ""}" id="${anchorOf(ref)}" data-ref="${esc(ref)}" data-label="what it is for">
      <h3>What this feature is for</h3>
      <p class="happy-does">${line(hp.accomplishes)}</p>
      <dl class="happy-io">
        <dt>arrives with</dt><dd>${line(hp.brings)}</dd>
        <dt>leaves with</dt><dd>${line(hp.ends_with)}</dd>
        ${hp.not ? `<dt>deliberately not</dt><dd>${line(hp.not)}</dd>` : ""}
      </dl>
      ${
        /**
         * ⛔ THE SCREENS, IN ORDER, ON THE SAME CARD. A flow described in prose is a flow a reader
         * has to assemble; named in order and clickable, it is one they can walk before arguing
         * about any of it.
         */
        hp.through.length
          ? `<ol class="happy-through">${hp.through
              .map((v) => {
                const view = sc.views.find((x) => x.id === v);
                return `<li><button type="button" class="show-part" data-show-part="${esc(`${v}/`)}">${line(
                  view?.title || v
                )}</button>${view ? "" : `<span class="ux-flag">no such screen</span>`}</li>`;
              })
              .join("")}</ol>`
          : `<p class="owes">No screens are named, so the flow cannot be walked.</p>`
      }
      ${
        /**
         * ⛔ NO LIST HERE EITHER, AND THIS ONE WAS ALSO A SECOND COPY. Four lines below, this card
         * already says "Agreed by X on Y" or that nobody has looked — so the log of acts was both
         * the clutter Peter objected to and a restatement of the sentence underneath it.
         */
        ""
      }
      ${
        landed
          ? `<p class="decided-for-you">Nobody has looked at this. It was written for you by
             <code>${esc(landed.by)}</code> on ${esc(landed.at)} so there would be something to
             disagree with — it is <strong>not</strong> agreed, and the sentences below are still
             waiting on you.</p>`
          : ""
      }
      ${
        agreed
          ? `<p class="happy-ok">Agreed by ${esc(stamp.by ?? "somebody")} on ${esc(stamp.at ?? "")} — the sentences below can be read against it.</p>`
          : /** ⛔ The same icons as a row, so one gesture means one thing everywhere on the page. */
            `<footer class="beh-acts icons">
               <button class="act icon" data-act="accept" data-ref="${esc(ref)}" title="That is what it is for">✓</button>
               <button class="act icon" data-act="say" data-ref="${esc(ref)}" title="Reword it">✎</button>
             </footer>
             <p class="happy-why">${
               stamp.state === "never"
                 ? "Nothing below can be agreed to until this is."
                 : "This was agreed and has changed since, so everything below is waiting on it again."
             }</p>`
      }
    </section>`;
}

/**
 * ⛔ A GROUP'S HIGH-LEVEL VIEW, DERIVED — because a group's UX is not a screen, it is how the
 * screens beneath it fit together.
 *
 * Peter: "our 'feature groups' should also have UX describing a high level view."
 *
 * A group page was prose, a list of what is filed under it, and the rules it states. Everything
 * visual lived on the leaves, so the question a group exists to answer — what does this part of the
 * product look like, and how does a person move through it — had no surface at all. Somebody
 * reviewing "Versioned Inputs" could read eight features one at a time and never see the shape.
 *
 * ⛔ AND IT IS GENERATED, NOT AUTHORED. Every fact it needs is already in the corpus: the screens
 * beneath the group, and the parts that say where they lead. Asking an author to draw it would make
 * a second copy of the navigation that goes stale the first time a screen moves — which is the
 * hand-authoring trap the drawing generator exists to close.
 */
function renderGroupUx(corpus: Corpus, scopeId: string, ctx: Ctx): string {
  const ids = descendants(corpus, scopeId);

  interface Node {
    scope: string;
    scopeTitle: string;
    view: string;
    title: string;
    intended: boolean;
    drawn: boolean;
    controls: number;
    silent: number;
    said: number;
    goes: string[];
    /** The screen itself, so the map shows the product rather than a box with its name on. */
    html?: string;
  }
  const nodes: Node[] = [];
  for (const id of ids) {
    const sc = corpus.scopes.find((s) => s.scope.id === id)?.scope;
    if (!sc) continue;
    for (const v of sc.views) {
      if (v.exists === "withdrawn") continue;
      const live = v.parts.filter((p) => !p.decorative && p.role !== "display" && p.role !== "region");
      nodes.push({
        scope: sc.id,
        scopeTitle: plain(sc.title || sc.id),
        view: v.id,
        title: plain(v.title || v.id),
        intended: v.exists === "intended",
        drawn: Boolean(v.sketch || v.sketch_html),
        controls: live.length,
        silent: live.filter((p) => !sc.exchanges.some((e) => e.at?.view === v.id && e.at?.part === p.id)).length,
        said: sc.exchanges.filter((e) => e.at?.view === v.id).length,
        goes: v.parts.filter((p) => p.leads_to).map((p) => p.leads_to!),
        html: v.sketch_html || undefined,
      });
    }
  }
  if (nodes.length < 2) return "";

  const byView = new Map(nodes.map((n) => [n.view, n]));
  /** A destination names a view, or a scope, or a scope and a view. Resolve to a node on this map. */
  const landsOn = (dest: string): Node | undefined => {
    const bare = dest.split("#");
    for (const part of [...bare].reverse()) if (byView.has(part)) return byView.get(part);
    return nodes.find((n) => n.scope === bare[0]);
  };

  /**
   * ⛔ LAYERED FROM WHAT NOTHING LEADS TO. A group's entry screens are the ones no recorded
   * navigation arrives at; everything else sits behind however many steps it takes to reach. That
   * ordering is the only thing on this map that is an inference rather than a fact, and it is one
   * a reader can check by eye against the arrows.
   */
  const arrivedAt = new Set<string>();
  for (const n of nodes) for (const d of n.goes) { const t = landsOn(d); if (t && t.view !== n.view) arrivedAt.add(t.view); }
  const layers: Node[][] = [];
  const placed = new Set<string>();
  let front = nodes.filter((n) => !arrivedAt.has(n.view));
  if (!front.length) front = nodes.slice(0, 1);
  while (front.length) {
    for (const n of front) placed.add(n.view);
    layers.push(front);
    const next: Node[] = [];
    for (const n of front)
      for (const d of n.goes) {
        const t = landsOn(d);
        if (t && !placed.has(t.view) && !next.includes(t)) next.push(t);
      }
    front = next;
  }
  // Anything no arrow reaches, in corpus order, so nothing is silently dropped off the map.
  const loose = nodes.filter((n) => !placed.has(n.view));
  if (loose.length) layers.push(loose);

  const edges = nodes.reduce((k, n) => k + n.goes.length, 0);
  /**
   * ⛔ THE MAP SHOWS THE SCREENS, NOT THEIR NAMES.
   *
   * Every node here was a box holding a title and two counts — a list of screens with boxes drawn
   * round it, which is what made this page read as an inventory. Peter: *"make sure this PAGE has
   * fully populated screenshots"*. The drawing already exists on the view; the map simply was not
   * showing it.
   *
   * `proto-mock` is the same class the prototype tiles use, so the one hydration sweep dresses
   * these too — one styling path, whoever built the root.
   */
  /**
   * ⛔ `data-mock` AND NO TEMPLATE — THIS IS THE COPY THAT RECURRED WITH DEPTH. `renderGroupUx` runs
   * for every container scope and lays out every drawing beneath it, so a feature two levels down
   * had its whole drawing on the wire twice, three levels three times. The clone comes from the
   * bank at hydration and the node looks exactly as it did.
   */
  /**
   * ⛔ `data-mock-lazy`, SO THE BANK DOES NOT CARRY THESE AND THEY ARRIVE AS THEY ARE SCROLLED TO.
   *
   * The map on Overview is the whole product's shape — every screen in the corpus as a thumbnail.
   * Deferring every section and the board still left the arrival page at 4.9 MB holding 128
   * templates, because these 128 shots referenced them and the bank is built from what the markup
   * references. A different attribute name is what keeps them out of it: the banking sweep looks
   * for `data-mock`, so a lazy shot is invisible to it until the client has filled one in.
   *
   * ⛔ AND IT IS THE ORDINARY WEB ANSWER RATHER THAN A PRESS. Peter asked for this to work "like
   * any other web app", and in any other web app a grid of thumbnails loads as you scroll — it does
   * not ask you to click each one. So nothing here is hidden behind an interaction that was not
   * already there: a reader scrolls the map and the pictures appear, in one request per batch.
   */
  const shot = (n: Node): string =>
    n.html
      ? `<div class="ux-shot"><div class="ux-shot-scale"><div class="proto-mock" ${
          ctx.served ? "data-mock-lazy" : "data-mock"
        }="${esc(`${n.scope}#${n.view}`)}"></div></div></div>`
      : `<div class="ux-shot none">${n.intended ? "not built yet" : "no picture of this screen"}</div>`;

  const box = (n: Node): string => `
    <li class="ux-node${n.intended ? " intended" : ""}">
      ${shot(n)}
      <button type="button" class="show-part" data-show-part="${esc(`${n.view}/`)}">${line(n.title)}</button>
      <span class="ux-in">${refLink(n.scope, ctx, line(n.scopeTitle))}</span>
      <span class="ux-n">${n.controls} control${n.controls === 1 ? "" : "s"}${
        n.silent ? ` · <span class="warn">${n.silent} say nothing</span>` : ""
      } · ${n.said} behaviour${n.said === 1 ? "" : "s"}</span>
      ${!n.drawn ? `<span class="ux-flag">not drawn</span>` : ""}
      ${n.intended ? `<span class="ux-flag">not built</span>` : ""}
      ${
        n.goes.length
          ? `<span class="ux-goes">${n.goes
              .map((d) => {
                const t = landsOn(d);
                return t
                  ? `→ <button type="button" class="show-part" data-show-part="${esc(`${t.view}/`)}">${line(t.title)}</button>`
                  : `→ <span class="unlinked" title="nothing on this map">${esc(d)}</span>`;
              })
              .join(" ")}</span>`
          : `<span class="ux-goes none">nothing records where this leads</span>`
      }
    </li>`;

  return `
    <section class="group-ux">
      <h3>How this part of the product fits together</h3>
      <p class="lede">${nodes.length} screen${nodes.length === 1 ? "" : "s"} beneath this group, laid out by
      what leads where. ${
        edges
          ? `${edges} step${edges === 1 ? "" : "s"} recorded.`
          : `<strong>No step between them is recorded</strong>, so this is a list of screens rather than a flow — a control that navigates and does not say where is one an engineer will invent.`
      }</p>
      <div class="ux-map">
        ${layers
          .map(
            (layer, i) => `<ol class="ux-layer" style="--layer:${i}">
              <li class="ux-layer-name">${i === 0 ? "arrived at first" : i === layers.length - 1 && loose.length ? "no arrow reaches these" : `${i} step${i === 1 ? "" : "s"} in`}</li>
              ${layer.map(box).join("")}
            </ol>`
          )
          .join("")}
      </div>
    </section>`;
}

/**
 * ⛔ WHAT A GROUP STATES IN ITS OWN RIGHT.
 *
 * Peter: "each section, like 'versioned inputs' should have their own behaviors and own unanswered
 * count. belongs to the whole group. so each group has rules that cascade down."
 *
 * A group had no voice. Its page was its prose and then a list of its children, so anything true of
 * the whole group had nowhere to go — and the only place the model offered was the org-wide rules
 * layer, which says "everywhere in the company" when the author meant "everywhere in here". The
 * ability was in the selector all along (`under:`); what was missing was anywhere to see it.
 *
 * ⛔ AND A GROUP THAT STATES NOTHING SAYS SO. It is not a finding and not a question — plenty of
 * groupings are just filing. But a silent blank reads as "checked, fine", and the number that used
 * to sit here was the sum of its children, which made every group look like it had something.
 */
function renderGroupRules(corpus: Corpus, scopeId: string, ctx: Ctx, homes: Map<string, string | undefined>): string {
  const mine = corpus.rules.filter((r) => homes.get(r.rule.id) === scopeId);
  const rawTitle = plain(corpus.scopes.find((s) => s.scope.id === scopeId)?.scope.title || scopeId);
  const title = esc(rawTitle);
  if (!mine.length)
    return `<section class="group-rules empty">
      <h3>What holds everywhere in ${title}</h3>
      <p class="none">Nothing yet. Anything stated here would hold for every behaviour filed under
      ${title}, and be agreed to once instead of once per feature.</p>
    </section>`;
  const { reach } = resolveRules(corpus);
  return `<section class="group-rules">
    <h3>What holds everywhere in ${title}</h3>
    <p class="lede">These hold for every behaviour filed under ${title}. Agreeing to one is agreeing
    to it everywhere it reaches, including anything written under ${title} after today.</p>
    ${mine
      .map((r) => {
        const open = r.rule.standing && r.rule.standing.kind !== "stated";
        const hits = (reach.get(r.rule.id) ?? []).length;
        return `<article class="beh group-rule${open ? " asking" : ""}" data-group-rule="${esc(scopeId)}" id="${anchorOf(r.rule.id)}" data-ref="${esc(r.rule.id)}" data-label="${esc(`holds everywhere in ${plain(rawTitle)}`)}">
          <div class="beh-says">${open ? line(r.rule.standing!.question ?? "Undecided — nobody has written what this says yet.") : line(r.rule.statement ?? "")}</div>
          <p class="beh-where">
            reaches ${hits} behaviour${hits === 1 ? "" : "s"} under ${title}${
              open ? ` · <strong>nobody has answered this</strong>` : ""
            } · ${
              /**
               * ⛔ THE SLUG IS GONE FROM UNDER THE SENTENCE. `a-kid-sees-only-their-own` is the
               * address a rule is filed under, printed directly beneath the words it is filed
               * under — the reader learns nothing from it and the project's own rule says it may
               * not be there. Behind the copy button with every other ref.
               */
              copyRef(r.rule.id)
            }
          </p>
          ${
            open
              ? `<p class="owes">Nobody has answered this. Answering it once settles it everywhere it reaches.</p>`
              : /**
                 * ⛔ THE SAME THREE ICONS AS A BEHAVIOUR ROW. Peter: *"we don't need 'this is right',
                 * 'not quite- reword it', 'not ours to say' - those are the check/edit/delete
                 * buttons."* Those exact three words were here, on every rule card.
                 *
                 * ⛔ AND `waive` IS GONE RATHER THAN RENAMED. "Not ours to say" hands a decided
                 * sentence to whoever builds it, which is an answer to an OPEN question — it belongs
                 * in the queue, where a slot is actually undecided, and the question interface
                 * already offers it there. Offering it beside a stated sentence asked somebody to
                 * un-decide something.
                 */
                `<footer class="beh-acts icons">${
                   stampFor(corpus, r.rule.id).state === "accepted"
                     ? ""
                     : `<button class="act icon" data-act="accept" data-ref="${esc(r.rule.id)}" title="That is right, everywhere"><span class="glyph" aria-hidden="true">✓</span> Agree</button>`
                 }<button class="act icon" data-act="say" data-ref="${esc(r.rule.id)}" data-owes="then" title="Reword it"><span class="glyph" aria-hidden="true">✎</span> Reword</button></footer>`
          }
        </article>`;
      })
      .join("")}
  </section>`;
}

// ---------------------------------------------------------------------------
// The grid — the behaviours this scope states, and where each came from.

function renderGrid(g: Grid, ctx: Ctx): string {
  const cell = (mark: string, meaning: string, extra: string[]): string =>
    `<td title="${esc(meaning)}"><span class="mark">${esc(mark)}</span>${
      extra.length ? `<span class="also">${extra.map((e) => esc(e)).join(" ")}</span>` : ""
    }</td>`;
  const rn = (id: string) => `R${g.number.get(id) ?? "?"}`;
  const rows = g.rows
    .map((r) => {
      const cells = SLOTS.map((s) => {
        const c = r.cells[s];
        const extra = [
          ...(c.constrainedBy ?? []).map((x) => `+${rn(x)}`),
          ...(c.exceptsRules ?? []).map((x) => `⊗${rn(x)}`),
          ...(c.defersToRules ?? []).map((x) => `≥${rn(x)}`),
        ];
        return cell(c.rule ? `${c.mark}${rn(c.rule)}` : c.mark, c.meaning, extra);
      }).join("");
      return `<tr><th scope="row"><span class="ex">${refLink(`${g.scope}#${r.exchange}`, ctx, r.title)}</span><code>${esc(r.exchange)}</code>${
        r.askedBy ? `<span class="asked">asked by ${esc(r.askedBy)}</span>` : ""
      }</th>${cells}</tr>`;
    })
    .join("");
  const { stated, inherited, unsettled, blank, outOfScope, constrained, deferred } = g.counts;
  return `
    <section class="grid-wrap">
      <h2>Behaviours in ${line(g.title)}</h2>
      <p class="counts">
        <span>${g.rows.length} exchange${g.rows.length === 1 ? "" : "s"}</span>
        <span>${stated} said here</span>
        <span>${inherited} inherited</span>
        <span>${outOfScope} deliberately not answered</span>
        <span class="${unsettled ? "warn" : ""}">${unsettled} unsettled${deferred ? ` (${deferred} parked)` : ""}</span>
        <span class="${blank ? "bad" : ""}">${blank} blank</span>
        ${constrained ? `<span>${constrained} also carry a rule</span>` : ""}
      </p>
      <div class="scroll">
        <table class="grid">
          <thead><tr><th></th>${SLOTS.map((s) => `<th>${esc(SLOT_LABEL[s])}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <details class="legend">
        <summary>What the marks mean</summary>
        <dl>
          <dt>✓</dt><dd>said here</dd>
          <dt>↑Rn</dt><dd>an org-wide rule supplies it</dd>
          <dt>+Rn</dt><dd>a rule also constrains it, whatever the slot says</dd>
          <dt>≥Rn</dt><dd>a rule still holds here, and this sentence only narrows it</dd>
          <dt>⊗Rn</dt><dd>a rule deliberately does not apply here, with a reason</dd>
          <dt>∅</dt><dd>deliberately not answered — the builder's latitude</dd>
          <dt>–</dt><dd>nothing to refuse — on <code>after</code>, nothing is different afterwards; on <code>again</code>, nothing further happens on a second press</dd>
          <dt>⊘</dt><dd>cannot fail</dd>
          <dt>○</dt><dd>open — nobody has ruled</dd>
          <dt>✗</dt><dd>disputed</dd>
          <dt>◒</dt><dd>said, and one named case inside it is unruled — the rest is buildable</dd>
          <dt>⋯</dt><dd>follows from an answer nobody has ruled on yet</dd>
          <dt>]</dt><dd>read and parked — still unsettled, no longer asked</dd>
          <dt>·</dt><dd><strong>blank</strong> — nobody has said what this is</dd>
        </dl>
      </details>
      ${
        g.rulesUsed.size
          ? `<div class="rules"><h3>The rules reaching this scope</h3>${[...g.rulesUsed]
              .sort((a, b) => (g.number.get(a[0]) ?? 0) - (g.number.get(b[0]) ?? 0))
              .map(
                ([id, r]) =>
                  /* ⛔ Scoped per view: one rule is listed inside every feature that inherits it,
                     so a bare rule id here is the same id in as many places as it reaches. */
                  `<p id="rl-${slug(g.scope)}-${slug(id)}"><span class="rn">R${g.number.get(id)}</span> <code>${esc(id)}</code>
                    <span class="fills">${esc(r.fills.join(" + "))}</span><br>${line(r.statement)}</p>`
              )
              .join("")}</div>`
          : ""
      }
    </section>`;
}

// ---------------------------------------------------------------------------
// The exchanges — one card each, with the accept act on it or the reasons it is gated.

/**
 * ⛔ ONE SCOPE'S PROMISES AT A TIME, because the whole corpus at once is not reviewable.
 *
 * This rendered every descendant's cards in one flat run. On a real product that is 51 behaviours and
 * ten grids on a single scroll, and the surface exists to review ONE feature — so the page is cut
 * into views and the menu switches between them. `heading: false` keeps the served and standalone
 * renders as they were.
 */
function renderExchanges(corpus: Corpus, scopeIds: string[], cellOf: Map<string, Cell>, ctx: Ctx, heading = true): string {
  /**
   * ⛔ THE RESOLVED SLOT, NOT THE RAW ONE.
   *
   * Reading `e.slots[s]` printed *"nobody has said what this is"* on `fails` and `again` for
   * an exchange whose grid row in the same page read `↑R5` and `↑R2` — two answers to "is
   * this said?" on one screen, and the alarming one was the wrong one. A reviewer would have
   * gone looking for a hole that an org-wide rule had already filled, or worse, written a
   * local sentence that displaced the rule.
   *
   * `resolveRules` is where inheritance lives. Nothing else may decide it.
   */
  const { inherited, constrained, contested, displaced } = resolveRules(corpus);
  const cards: string[] = [];
  for (const sid of scopeIds) {
    const entry = corpus.scopes.find((s) => s.scope.id === sid);
    if (!entry) continue;
    for (const e of entry.scope.exchanges) {
      const ref = `${sid}#${e.id}`;
      const gate = gateFor(corpus, ref);
      const slots = SLOTS.map((s) => {
        const key = `${ref}#${s}`;
        const f = (e.slots as Record<string, Record<string, unknown> | undefined>)[s];
        const outcomesOf = (x: Record<string, unknown> | undefined) =>
          (x?.outcomes as Array<{ name: string; when: string; told: string }> | undefined) ?? [];
        const sentence = (x: Record<string, unknown> | undefined): string =>
          x?.says
            ? line(x.says)
            : x?.none
              ? /** ⛔ `s` is this slot's name, so `none` can say which of the three it means. */
                `<em>${nothingHere(s)}</em>`
              : x?.cannot_fail
                ? "<em>cannot fail</em>"
                : outcomesOf(x).length
                  ? outcomesOf(x)
                      .map((o) => `<strong>${esc(o.name)}</strong> — when ${line(o.when)}, ${line(o.told)}`)
                      .join("<br>")
                  : "";
        const inh = inherited.get(key);
        const local = sentence(f);
        /**
         * ⛔ THE STATE COMES FROM THE GRID CELL, because the page carried two answers to
         * "is this said?" and the alarming one was the wrong one.
         *
         * Re-deriving it here printed *"nobody has said what this is"* on four slots the grid
         * on the same page counted as `0 blank` — a slot with nothing to refuse, one that
         * cannot fail, one following from an unruled answer, and one with an open question
         * all read as holes nobody had looked at. A reviewer would have gone hunting for a
         * gap that was already closed, or written a local sentence displacing an org-wide
         * rule that was already answering.
         *
         * `gridFor` decides what a slot's state is. This renders it.
         */
        const cellState = cellOf.get(key);
        // An org-wide rule IS the answer here, because nothing local said one.
        const says =
          local ||
          (inh ? line(inh.statement) : "") ||
          (cellState && cellState.mark !== "·" ? `<span class="derived">${line(cellState.meaning)}</span>` : "");
        const from = !local && inh ? `<span class="from">inherited from <code>${esc(inh.id)}</code></span>` : "";
        const also = (constrained.get(key) ?? []).map(
          (r) => `<span class="from also-rule">and <code>${esc(r.id)}</code> also holds here — ${line(r.statement)}</span>`
        );
        const away = (displaced.get(key) ?? []).map(
          (r) => `<span class="from">this sentence pushed <code>${esc(r.id)}</code> aside</span>`
        );
        const fight = (contested.get(key) ?? []).map(
          (r) => `<span class="from bad-rule"><code>${esc(r.id)}</code> answers this, and this slot says nobody has — only a person can say which is stale</span>`
        );
        const standing = (f?.standing as { kind?: string } | undefined)?.kind;
        return `
          <div class="slot${says ? "" : " empty"}">
            <span class="sk">${esc(SLOT_LABEL[s])}</span>
            <div class="sv">${says || `<span class="nobody">nobody has said what this is</span>`}
              ${standing && standing !== "stated" ? `<span class="badge ${standing === "out_of_scope" ? "" : "warn"}">${esc(standing.replace(/_/g, " "))}</span>` : ""}
              ${from}${away.join("")}${fight.join("")}${also.join("")}
            </div>
          </div>`;
      }).join("");
      /**
       * ⛔ THE ADDRESS A BUILDER WAS HANDED, ON THE PAGE A PERSON READS IT FROM.
       *
       * The packet gives every requirement a ref and the hash of the words it was written from,
       * and an agent carries both into whatever demonstrates it. If the only place that ref exists
       * is the packet, then a person looking at a failing test called
       * `money#record-earning#shows#4` has nowhere to go and look it up — and the half of this
       * whose entire purpose is a human reviewing what was agreed would be the half that cannot
       * see what a builder was told.
       *
       * ⛔ The ref only. The hash belongs to the packet, which is a machine artifact; printing
       * sixteen hex characters beside a sentence a person is trying to read buys them nothing.
       */
      /**
       * ⛔ WHETHER EACH REQUIREMENT IS STILL A REQUIREMENT OF WHAT THIS NOW SAYS.
       *
       * Nobody writes these; a role works them out from the claim and records which wording it
       * worked from. So the question a reader has about one is no longer "do I agree with it" — it
       * is "was this worked out from the sentence above it, or from an older one". A page that
       * shows a derived test set without that is a page claiming currency it cannot know.
       */
      const reqState = new Map(
        (demonstrationOf(corpus, sid, e.id)?.requirements ?? []).map((r) => [r.criterion.id, r.state])
      );
      const criteria = e.criteria
        .map(
          (c) => `
          <li class="req-${esc(reqState.get(c.id) ?? "authored")}">
            <span class="cslot">${esc(SLOT_LABEL[c.slot as SlotName] ?? c.slot)}</span>
            <code class="creq">${esc(`${ref}#shows#${c.id}`)}</code>
            ${
              reqState.get(c.id) === "stale"
                ? `<span class="badge warn">worked out from an earlier wording</span>`
                : reqState.get(c.id) === "authored"
                  ? `<span class="badge">typed by hand</span>`
                  : ""
            }
            ${c.given ? `<span class="g">given</span> ${line(c.given)}` : ""}
            ${c.when ? `<span class="g">when</span> ${line(c.when)}` : ""}
            ${c.then ? `<span class="g">then</span> ${line(c.then)}` : ""}
            ${/* ⛔ Both renderings of a requirement, or the one a reader lands on is still blank. */ ""}
            ${c.steps ? `<span class="g">steps</span> ${line(c.steps)}` : ""}
          </li>`
        )
        .join("");
      cards.push(`
        <article class="ex-card" id="${anchorOf(ref)}" data-ref="${esc(ref)}" data-label="${esc(plain(e.title))}">
          <header>
            <h3>${line(e.title)}</h3>
            <code>${esc(ref)}</code>
            ${e.asked_by ? `<span class="asked">asked by ${esc(e.asked_by)}</span>` : ""}
          </header>
          <div class="slots">${slots}</div>
          ${
            /**
             * ⛔ THE SAME BADGE AN EXCHANGE'S BEHAVIOURS GET. Peter asked for confirmed-or-not next
             * to a behaviour; this card is the whole exchange, and leaving the log here would have
             * put two shapes in circulation on one page — which is how the next session picks the
             * wrong one.
             */
            renderState(corpus, ref)
          }
          ${criteria ? `<details class="crit"><summary>${e.criteria.length} thing${e.criteria.length === 1 ? "" : "s"} that would show this working</summary><ul>${criteria}</ul></details>` : ""}
          <footer>
            ${
              gate && !gate.ok
                ? `<div class="gated">
                     <p class="k">not yet something to agree to</p>
                     <ul>${gate.blocking
                       .map(
                         (b) =>
                           `<li><code>${esc(SLOT_LABEL[b.slot] ?? b.slot)}</code> ${esc(b.kind)} — ${line(b.says)} ${refLink(`${ref}#${b.slot}`, ctx, "decide it")}</li>`
                       )
                       .join("")}</ul>
                   </div>`
                : `<button class="act icon" data-act="accept" data-ref="${esc(ref)}" title="I have read this and agree to it">✓</button>`
            }
          </footer>
        </article>`);
    }
  }
  return cards.length
    ? `<section class="exchanges">${heading ? "<h2>Every behaviour, in full</h2>" : ""}${cards.join("")}</section>`
    : "";
}

/**
 * ⛔ WHERE THE MENU LIVES IS READ BEFORE THE FRAME PAINTS.
 *
 * A placement applied by a script that runs after the body has rendered draws the menu across the
 * top, then throws it down the side a frame later — every load, on the placement the reader chose.
 * So this is the first thing in the body, ahead of the frame it governs.
 *
 * ⛔ And it is an attribute on the root, not a second rendering. The frame's markup is identical in
 * both placements; only the stylesheet differs. Two markups for one menu is two things to keep in
 * step, and one of them is always the one nobody opened.
 */
/**
 * ⛔ AND THE SCREEN PANEL'S STATE IS READ HERE TOO, FOR THE SAME REASON.
 *
 * It starts shut — see `PROTO_FRAME` for why — and deciding that at the bottom of the body paints
 * a whole viewport of prototype and then takes it away, which is worse than leaving it open. The
 * two facts share this script because they share the reason: both are the reader's remembered
 * posture, and both have to be known before the first paint.
 */
const NAV_PLACEMENT_BOOT = `<script>
(function () {
  var p = "top";
  var proto = null;
  try { p = localStorage.getItem("productos:nav") === "left" ? "left" : "top"; } catch (e) {}
  try { proto = localStorage.getItem("productos:proto"); } catch (e) {}
  document.documentElement.dataset.nav = p;
  if (proto === "off" || proto === null) document.documentElement.dataset.proto = "off";
})();
</script>`;

/**
 * ⛔ BOTH LABELS ARE RENDERED AND THE STYLESHEET PICKS ONE, so the button says the right thing on
 * the first paint rather than after a script has caught up with it. It names where the menu is
 * going, not where it is — a control labelled with the state you are already in is read backwards.
 */
const NAV_PLACE_BUTTON =
  `<button type="button" class="navplace" title="Move the menu between the top and the side">` +
  `<span class="to-left">&#8676; Side menu</span>` +
  `<span class="to-top">&#8677; Top menu</span>` +
  `</button>`;

/**
 * ⛔ CONNECT CLAUDE CODE, FROM THE PAGE — because there was no other way a project's owner could.
 *
 * Peter, on what blocks the MVP: *"`productos connect` and token issuing from the page"*. A session
 * reaches a project through `/p/<project>/mcp` with a bearer token, and the only way to get one was a
 * command that needs the database's connection string. So the owner, on the page they own the
 * project from, could not connect anything to it.
 *
 * ⛔ ONLY WHERE A PROJECT IS IN THE PATH. A local `serve` has no tokens and no MCP endpoint to point
 * at; a control there would mint something that reaches nothing.
 *
 * ⛔ THE SECRET IS ON SCREEN ONCE. The server stores a hash, so the panel says so where the token
 * appears — a reader who closes it without copying has to make another, and should know that before
 * they close it rather than after.
 */
const servedUnderProject = (base: string | undefined): boolean => /^\/p\/[^/]+\/v2$/.test(base ?? "");

const CONNECT_BUTTON =
  `<details class="connect" data-ref="connect" data-label="Connect Claude Code">` +
  `<summary>Connect Claude Code</summary>` +
  `<div class="connect-panel">` +
  `<p>Lets a Claude Code session in your repo read this project and draft into it. It cannot agree to anything on your behalf — only you can, here.</p>` +
  `<button type="button" class="connect-make">Make a token</button>` +
  `<div class="connect-out" hidden>` +
  `<p>Run these two lines in your repo. <strong>The token is shown only this once</strong> — copy it before you close this.</p>` +
  `<pre class="connect-lines"></pre>` +
  `<div class="connect-acts"><button type="button" class="connect-copy">Copy both lines</button>` +
  `<button type="button" class="connect-stop">Stop this token</button></div>` +
  `</div>` +
  `<p class="connect-said" role="status"></p>` +
  `</div></details>`;

const CONNECT = `<script>
(function () {
  const box = document.querySelector("details.connect");
  if (!box) return;
  /* ⛔ Relative to the project, never the root — the page is served under /p/<project>/. */
  const at = location.pathname.indexOf("/v2");
  const under = at > 0 ? location.pathname.slice(0, at) : "";
  const make = box.querySelector(".connect-make");
  const out = box.querySelector(".connect-out");
  const lines = box.querySelector(".connect-lines");
  const said = box.querySelector(".connect-said");
  const copy = box.querySelector(".connect-copy");
  const stop = box.querySelector(".connect-stop");
  let minted = null;
  make.addEventListener("click", async function () {
    make.disabled = true;
    said.textContent = "Making a token…";
    try {
      const r = await fetch(under + "/api/v2/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = await r.json().catch(function () { return {}; });
      if (!r.ok || !body.token) throw new Error(body.why || r.statusText || "it was refused");
      minted = body.id;
      lines.textContent =
        "productos init claude --at " + location.origin + under + "\\n" +
        "export PRODUCTOS_TOKEN=" + body.token;
      out.hidden = false;
      make.hidden = true;
      said.textContent = "Keep the export line wherever your shell keeps its settings, so Claude Code has it when it starts.";
    } catch (e) {
      said.textContent = "No token was made: " + e.message;
      make.disabled = false;
    }
  });
  copy.addEventListener("click", async function () {
    try {
      await navigator.clipboard.writeText(lines.textContent);
      said.textContent = "Copied.";
    } catch (e) {
      said.textContent = "Could not copy — select the two lines and copy them yourself.";
    }
  });
  stop.addEventListener("click", async function () {
    if (!minted) return;
    const r = await fetch(under + "/api/v2/tokens/" + encodeURIComponent(minted), { method: "DELETE" });
    if (r.ok) {
      lines.textContent = "";
      out.hidden = true;
      make.hidden = false;
      make.disabled = false;
      minted = null;
      said.textContent = "That token no longer works. Anything using it has been disconnected.";
    } else {
      said.textContent = "It was not stopped — try again.";
    }
  });
})();
<\/script>`;

/**
 * Every scope, as a tree, with how much work each one is holding.
 *
 * ⛔ THE COUNTS ARE ON THE NAV, because "which feature do I look at next" is the first question
 * a reviewer has and no surface answered it. A list of names makes them open each one to find
 * out whether there is anything to do.
 */
function renderNav(
  corpus: Corpus,
  here: string,
  base: string | undefined,
  /** ⛔ The same answer `refLink` gives, so the tree and the body cannot address a scope differently. */
  address: (ref: string) => string,
  contains: Set<string>,
  open: number,
  aboutLabel: string,
  charterTabs: string,
  /** How many screens the subtree draws, so the tab says whether it is worth opening. */
  screens: number,
  /** ⛔ The Connect Claude Code control — only on a live page served under a project. */
  connect: string = "",
  /** Where each subsystem is addressed — the capability tree's own address space. */
  subAddress: (id: string) => string = (id) => `#${anchorOf(`subsystems#${id}`)}`,
  /** The subsystem whose page this is, where the address named one. */
  hereSub?: string
): string {
  /**
   * ⛔ A WITHDRAWN FEATURE IS NOT IN THE MENU, and it used to be.
   *
   * `exists: withdrawn` was honoured for a VIEW and for an EXCHANGE and nowhere for a scope, so a
   * feature somebody had taken out still had a row, a tab and an address — a menu entry leading to
   * a page about something that is gone, which is the dead row this file's opening comment is
   * about. `existsOf` has always cascaded `withdrawn` down the lineage; the tree simply never asked.
   *
   * ⛔ THE WHOLE BRANCH GOES, because the cascade means everything beneath a withdrawn container is
   * withdrawn too. Dropping only the container would leave its children as roots — which is exactly
   * the orphaning that produced this work in the first place.
   */
  const kids = (parent?: string) =>
    corpus.scopes.filter((s) => s.scope.in === parent && s.scope.exists !== "withdrawn");
  // ⛔ Once for the whole nav. It was called per row, which walks the entire corpus per row.
  const acts = actsFor(corpus);
  const homes = ruleHomes(corpus);
  const openRule = new Set(corpus.rules.filter((r) => r.rule.standing && r.rule.standing.kind !== "stated").map((r) => r.rule.id));
  /** Rules this scope owns, split by whether they are still a question. */
  const rulesOwnedBy = (id: string, asking: boolean) =>
    [...homes].filter(([rid, home]) => home === id && openRule.has(rid) === asking).length;
  /**
   * ⛔ A CONTAINER IS COLLAPSIBLE, WHICH MEANS ITS ITEMS ARE INSIDE IT.
   *
   * Peter: *"what happened to collapsable menu items? CRE/dealmanagement are not collapsible???"*
   * and *"'Product' itself doesn't need to be a menu item under the 'Product' main tab"*.
   *
   * Both are the same defect. This built ONE flat list of every scope in the corpus, indented by a
   * `--d` custom property, and hung it under the crumbs as a sibling of the tab row. So an area
   * appeared twice — once as its tab, once as a row of that list — and nothing could collapse,
   * because an indent is not a container: there was no element holding a group's items to hide.
   *
   * The earlier round of this moved Overview's own strip inside its area and stopped there, which is
   * why the areas still looked like the thing he had already had fixed.
   *
   * So the rows nest: each container holds a real `<ul>` of its children, and the subtree for an
   * area is emitted INSIDE that area's group, starting at the area's children. An area naming
   * itself at the top of its own menu is the duplicate he is pointing at.
   */
  /**
   * ⛔ THE BRANCH YOU ARE STANDING IN IS OPEN, because collapsed-by-default plus one-open-at-a-time
   * is a menu that cannot show you where you are. Everything folds shut on load, so the row for the
   * page on screen is inside two closed containers and the menu answers "which feature is this"
   * with nothing — the question it exists for.
   */
  const standingIn = new Set<string>();
  for (let at: string | undefined = here; at; at = corpus.scopes.find((x) => x.scope.id === at)?.scope.in) {
    standingIn.add(at);
  }
  /** How many rows the whole corpus yields, so a corpus with nothing to navigate grows no tree. */
  let counted = 0;
  const subtree = (parent: string | undefined, depth: number): string => {
    const rows: string[] = [];
    for (const { scope } of kids(parent)) {
      /**
       * ⛔ THE ROOT IS NOT A ROW, AND NEITHER IS AN AREA INSIDE ITS OWN GROUP. The root is the
       * Overview tab; listing it again at the head of the tree gave every half a first entry that
       * jumped to another tab. The same argument reaches one level further down now that each area
       * holds its own items: *"'Product' itself doesn't need to be a menu item under the 'Product'
       * main tab"*. A group is named by its head, so the first row inside it is the first thing in
       * it — callers pass the container whose contents they want, and it is never a row of them.
       */
      if (!scope.in) return subtree(scope.id, depth);
      const qs = questionsFor(corpus, scope.id);
      /**
       * ⛔ AN ORG-WIDE QUESTION IS COUNTED ONCE, NOT ONCE PER SCOPE IT REACHES.
       *
       * A rule's question reaches every scope its selector touches, so counting them per row put
       * "7 to decide" on all sixteen rows of a real corpus — reading as 112 decisions when it is 7.
       * The nav's whole job is to answer "which feature should I look at next", and a number that
       * is identical everywhere answers nothing.
       *
       * Reported separately instead: what is undecided HERE, and what is waiting on the product.
       */
      /**
       * ⛔ A RULE'S QUESTION BELONGS TO THE GROUP THAT OWNS THE RULE, not to every row it reaches.
       *
       * Counting them per row put "7 to decide" on all sixteen rows of a real corpus — 112
       * decisions where there were 7 — so they were pulled out and reported as "shared" instead.
       * That was half a fix: a rule scoped to one area is not shared, it is that area's, and saying
       * "shared" on every row is the same non-answer in quieter language.
       *
       * So a rule counts as unanswered on the row of the scope that owns it, and only a rule whose
       * reach spans the product stays in the shared queue, where it is reported once.
       */
      const own = qs.filter((q) => !q.parked && q.ref.includes("#"));
      const openHere = qs.filter((q) => !q.parked && !q.ref.includes("#") && homes.get(q.ref.split("#")[0]!) === scope.id).length;
      const orgWide = qs.filter((q) => !q.parked && !q.ref.includes("#") && homes.get(q.ref.split("#")[0]!) === undefined).length;
      const here_open = own.length + openHere;
      /**
       * ⛔ WHAT THIS SECTION IS HOLDING, so "which one next" is answerable from the tree.
       *
       * The row used to report exchange-grained acceptances, which are zero on any corpus that is
       * not finished — so every row read "waiting on the shared questions" and the tree said nothing
       * about where the work was. Two numbers, because they are two different jobs: questions
       * nobody has answered, and sentences nobody has read.
       */
      /**
       * ⛔ OWN FIRST, AND WHAT IS BELOW SAID SEPARATELY.
       *
       * Peter: "i don't think subsections should sum up questions below it — each section should
       * have their own behaviors and own unanswered count."
       *
       * A rolled-up number is one every ancestor repeats and no ancestor is responsible for: the
       * root read "126 to read", so did the product, so did the area, and none of them was where
       * the work was. The group's own figure is what it states in its own right — the rules that
       * cascade down to everything inside it — and the subtree total is one dim number beside it,
       * so "which one next" stays answerable without pretending the total is the group's.
       */
      const ids = descendants(corpus, scope.id);
      const below = ids.filter((i) => i !== scope.id);
      const toRead = acts.written.filter((b) => b.startsWith(`${scope.id}#`)).length + rulesOwnedBy(scope.id, false);
      const ready = acts.acceptable.filter((r) => r.startsWith(`${scope.id}#`)).length;
      const under = acts.written.filter((b) => below.some((i) => b.startsWith(`${i}#`))).length;
      const label = line(scope.title || scope.id);
      /**
       * ⛔ A SINGLE PAGE IS NAVIGABLE BY ANCHOR, AND THIS RENDERED SIXTEEN DEAD LABELS INSTEAD.
       *
       * The rule "never emit a link that cannot resolve" is right, and the conclusion drawn from it
       * was wrong. A SERVED corpus navigates across pages, so with no `linkBase` this fell back to
       * plain text — and a published artifact is one page with no server, so every scope in it
       * became unclickable. The page already contains the whole subtree; the scopes simply had no
       * anchor to jump to, which made "review one feature" impossible on the surface built for it.
       *
       * So: anchor within this page where it holds the scope, cross-page where a base is given, and
       * only fall back to text where neither is true.
       */
      // ⛔ Containers too — but only the ones this render actually emits a view for. Inferring it
      // from "has no exchanges" claimed every container in the corpus was on this page, and a leaf
      // scope's page links at a dozen sections it does not contain.
      const holdsIt = contains.has(scope.id);
      /**
       * ⛔ EVERY ROW SAYS ITS OWN NAME ON HOVER. Peter: *"also make a hover for each item even with
       * scrolling on"*.
       *
       * The labels no longer truncate, so a long one is reached by scrolling — and scrolling to read
       * a name is work a hover does for free. It is the plain title rather than the rendered one: a
       * tooltip is text, and inline formatting in it would arrive as the markup it is written in.
       *
       * ⛔ The unlinked variant keeps its own: "not on this page" is why that row cannot be pressed,
       * which is worth more than repeating the name it is already showing.
       */
      const hover = esc(plain(scope.title || scope.id));
      /**
       * ⛔ THE ROW YOU ARE ON IS STILL A LINK, AND MARKED — "a link to where you already are is not
       * a link" is the decision that broke the menu, in both the ways Peter reported.
       *
       * It rendered as its own name in bold with no href and no `data-goto`, so:
       *
       *   - nothing on the page said where the reader was. There is no `aria-current` anywhere in
       *     this renderer, and the one row that should carry it was the one row that could not.
       *   - `openWhereWeLanded` finds the landing by looking for `a[data-goto]`, so on a cold
       *     arrival it found nothing, opened nothing, and left the row sitting inside two shut
       *     containers. Peter, three times: *"the menu doesn't expand"*.
       *
       * ⛔ AND IT IS THE END STATE, NOT A PATCH. Under one-address-one-page the menu is just links;
       * the current one is distinguished by being MARKED rather than by being inert. Measured in a
       * real browser on a three-level corpus, not reasoned about — the previous three attempts at
       * this bug were each right about the one case I measured and wrong about the rest.
       */
      const name =
        scope.id === here
          ? `<a href="${esc(address(scope.id))}" data-goto="${esc(scope.id)}" aria-current="page" title="${hover}"><strong>${label}</strong></a>`
          : holdsIt
            ? `<a href="${esc(address(scope.id))}" data-goto="${esc(scope.id)}" title="${hover}">${label}</a>`
            : base
              ? `<a href="${esc(address(scope.id))}" data-goto="${esc(scope.id)}" title="${hover}">${label}</a>`
              : `<span class="unlinked" title="not on this page">${label}</span>`;
      /**
       * ⛔ A COUNT IS A CHIP, AND A CHIP IS A NUMBER AND A MARK.
       *
       * Peter: *"get rid of 'XXX below', not sure what that means... shorten '5 unanswered' '5 {?
       * icon}', and '59 to read' to '59 {eyes icon}'. make them chips next to the menu item name"*.
       *
       * `below` went rather than got shorter. It counted the work in a row's descendants, which is
       * the sum he had already had removed once from these rows — *"i don't think subsections should
       * sum up questions below it"* — and it came back in as a dim pill whose label named a direction
       * rather than a thing. Nobody can act on "4 below"; the rows beneath it already say it.
       *
       * ⛔ THE MARK CARRIES A TITLE, because an icon alone states nothing. `?` and the eye are short
       * enough to sit in a menu, and a reader who has not guessed what they mean can hover one — the
       * screen-reader name is the full phrase, not the glyph.
       */
      const chip = (n: number, tone: string, mark: string, says: string) =>
        ` <span class="n ${tone}" title="${esc(`${n} ${says}`)}" aria-label="${esc(`${n} ${says}`)}">${n}<span class="mark" aria-hidden="true">${mark}</span></span>`;
      /**
       * ⛔ AND NOTHING WHERE THERE IS NOTHING. Peter: *"'states nothing of its own' should be
       * removed"*. It was the fallback on a row with no chips at all — a sentence longer than every
       * label beside it, in a menu, saying only that the four counts were zero. A row with no chips
       * already says that, and says it in the space a menu has.
       */
      const children = subtree(scope.id, depth + 1);
      const standing = standingIn.has(scope.id);
      counted++;
      rows.push(
        `<li style="--d:${depth}" data-scope="${esc(scope.id)}"${
          children ? ` class="holds${standing ? " open" : ""}"` : ""
        }>` +
          `<span class="scoperow">` +
          /**
           * ⛔ NO CONTROL ON A ROW AT ALL. CHOOSING AN ITEM IS WHAT OPENS IT.
           *
           * Peter: *"there's an extra chevron now... we don't need the chevron next to 'attachment
           * routing', for example. once you click an item, its sub menu should automatically show if
           * it has one"*.
           *
           * The first cut gave every container its own twisty, on the reasoning that the area groups
           * have one. That was the wrong thing to copy: an area group's head is a TAB — pressing it
           * selects a section — so expanding has to be a separate control or selecting would collapse
           * what you just chose. A row is already a link to the thing it names, and going to a
           * feature is the whole reason to want its contents. Two controls for one intention is a
           * chevron nobody needs.
           *
           * ⛔ SO WHETHER A ROW HAS A SUBTREE IS NO LONGER ADVERTISED, and that is the trade he is
           * making: one less glyph per row, and you find out by going there. The ancestry of the page
           * you are on is open already, so the menu still answers where you are.
           */
          name +
          (here_open ? chip(here_open, "warn", "?", "unanswered") : "") +
          (orgWide ? chip(orgWide, "warn", "◇", "shared across the product") : "") +
          (toRead ? chip(toRead, "ok", "👁", "to read") : "") +
          (ready ? chip(ready, "ok", "✓", "whole") : "") +
          `</span>` +
          children +
          `</li>`
      );
    }
    /**
     * A document that would not load keeps its place here, named, and goes nowhere.
     *
     * ⛔ Peter: *"'file would not load' should definitely still show up in the menu."* The nav walks
     * `corpus.scopes`, which is exactly the set that parsed — so an unloadable screen left no trace
     * in the one surface whose job is saying what this product consists of, and its area quietly
     * showed five children where there were six. The alarm at the top said a file had not loaded;
     * nothing connected that to the gap in the tree.
     *
     * ⛔ NOT A LINK, because there is no page to go to — the scope does not exist to render. A row
     * that navigates nowhere would be the dead menu item this file's own opening comment is about;
     * this one states a condition instead, which is what the reader needs to act.
     */
    for (const b of corpus.broken) {
      const who = b.title ?? b.id;
      if (!who || b.in !== parent) continue;
      counted++;
      rows.push(
        `<li style="--d:${depth}" class="unloadable"${b.id ? ` data-scope="${esc(b.id)}"` : ""}>` +
          `<span class="scoperow"><span class="name">${esc(who)}</span>` +
          `<span class="n warn" title="this document would not load, so it is not on this page" ` +
          `aria-label="would not load">would not load</span></span></li>`
      );
    }
    return rows.length ? `<ul>${rows.join("")}</ul>` : "";
  };
  /**
   * ⛔ THE TREE IS WHAT A ONE-SCOPE CORPUS DOES NOT NEED. THE FIXED TABS ARE NOT.
   *
   * This returned "" for the WHOLE frame, which took the tab row with it — so in a corpus with one
   * scope, Overview, Prototype and the settings surface were all rendered, all `display:none`, and
   * nothing on the page could switch between them. The prototype board has been unreachable in
   * every single-scope corpus since it was built, including the seed this repo ships and serves;
   * the comment at the top of this file says a nav row that does nothing is worse than prose, and
   * the fix for that was applied one level too high.
   *
   * ⛔ Found by loading the page, not by reading it. The rendered HTML contained every section and
   * read as correct — `data-label="What steers this"` is present either way, which is exactly how
   * an assertion on the markup passes while the surface is unreachable.
   *
   * So the suppression moves to the tree it was about: no tree where there is nothing to navigate,
   * and the destinations stay.
   */
  /**
   * ⛔ THE WHOLE TREE IS THE TOP MENU'S, WHERE THE GROUPS COLLAPSE TO A ROW AND HOLD NOTHING.
   *
   * Down the side, each area holds its own items, so a second flat copy of every scope is the
   * duplicate he is pointing at. Across the top there is no column for a group to own, so the
   * chevron beside the trail still needs something to open.
   *
   * ⛔ Both are `subtree`, not two renderings maintained apart — the thing this project's own rule
   * about one home per fact is for.
   */
  /** From no parent at all: the root is stepped through rather than listed, as above. */
  const whole = subtree(undefined, 0);
  /**
   * ⛔ THE CAPABILITY TREE IS NAVIGABLE, AND IT SHIPPED WITHOUT BEING SO.
   *
   * Peter, looking at the converted corpus: *"wtf happened to capabilities tab? I see a bunch of
   * capabilities flattend in the menu. is the tree completely gone?"* — and then *"capabilities is a
   * separate tree, when did that change???"*. It had not changed. The tree was correct in the data
   * (27 subsystems, 12 at the top, 15 nested, nothing dangling) and correct in its own render, and
   * had NO WAY IN: `renderNav` walks `corpus.scopes`, a subsystem is not a scope, and the whole
   * tree rendered on one view with its nesting shown only as indentation inside a 145 KB page. No
   * rows, no addresses, nothing to click into.
   *
   * ⛔ IN THE SAME TREE, NOT A SECOND ONE. The comment forty lines down says a second tree per area
   * "would be two derivations of one fact, which is what this project keeps being bitten by", and
   * it was right the last time somebody ignored it. These rows are built by the same `subtree`
   * recursion shape and filtered by the same `scopeTree` pass; what distinguishes them is the
   * attribute they carry.
   *
   * ⛔ `data-subsystem`, NOT `data-scope`, AND THAT IS LOAD-BEARING. Four ids in the real corpus
   * name both a product scope and a subsystem, so one attribute for both would make the filter and
   * the current-row marking answer about whichever tree happened to be asked first.
   */
  const subs = corpus.subsystems.map((x) => x.subsystem);
  /**
   * ⛔ THE BRANCH YOU ARE STANDING IN IS OPEN, and the scope tree already paid for learning this:
   * *"collapsed-by-default plus one-open-at-a-time is a menu that cannot show you where you are"*.
   * Marking only the exact subsystem left its ancestors shut, so the row for the page on screen sat
   * inside a closed `<ul>` and the menu answered "which part is this" with nothing. Measured in a
   * browser — the row had height 0 while its own parent reported 33.
   */
  const standingInSub = new Set<string>(
    hereSub ? (subsystemTrailsOf(corpus)[hereSub] ?? []).map((c) => c.id) : []
  );
  const subRow = (parent: string | undefined, depth: number): string => {
    const rows: string[] = [];
    for (const sub of subs.filter((x) => (x.in ?? undefined) === parent)) {
      const kids = subRow(sub.id, depth + 1);
      const standing = standingInSub.has(sub.id);
      const current = hereSub === sub.id;
      const label = line(sub.title || sub.id);
      const hover = esc(plain(sub.title || sub.id));
      /** How many contracts it offers — the same question a feature row's chip answers. */
      const offers = sub.offers.length;
      counted++;
      rows.push(
        `<li style="--d:${depth}" data-subsystem="${esc(sub.id)}"${kids ? ` class="holds${standing ? " open" : ""}"` : ""}>` +
          `<span class="scoperow">` +
          `<a href="${esc(subAddress(sub.id))}" data-goto-subsystem="${esc(sub.id)}"${
            standing ? ' aria-current="page"' : ""
          } title="${hover}">${current ? `<strong>${label}</strong>` : label}</a>` +
          /**
           * ⛔ AND NOTHING WHERE IT OFFERS NOTHING. A container subsystem groups what is filed inside
           * it and offers nothing itself — the rows beneath it already say so, and a `0` chip reads
           * as a thing to go and look at.
           */
          (offers
            ? ` <span class="n" title="${esc(`${offers} ${offers === 1 ? "contract" : "contracts"}`)}" aria-label="${esc(
                `${offers} ${offers === 1 ? "contract" : "contracts"}`
              )}">${offers}<span class="mark" aria-hidden="true">⊂</span></span>`
            : "") +
          `</span>${kids}</li>`
      );
    }
    return rows.length ? `<ul>${rows.join("")}</ul>` : "";
  };
  const machinery = subRow(undefined, 0);
  const tree = counted < 2 ? "" : `<nav class="scopes">${whole}${machinery}</nav>`;
  const trails = trailsOf(corpus);
  /**
   * ⛔ THE TOP LEVEL IS A ROW OF TABS, NOT A ROW INSIDE A DROPDOWN.
   *
   * The two halves of a product — what it states a person, and the machinery underneath — are the
   * one split a reader navigates by constantly, and burying them at depth 1 of a collapsed tree put
   * the most-used move behind two presses and a scan. They sit side by side; the tree is for going
   * deeper, which is the thing a tree is good at.
   */
  const rootId = corpus.scopes.find((x) => !x.scope.in)?.scope.id;
  const protoScreens = screensOf(corpus);
  const theWalk = walkOf(corpus, corpus.prototypes?.[0]?.starts_at);
  const protoPromises = promisesOf(corpus);
  /**
   * ⛔ WHERE A CONTROL GOES, WORKED OUT FROM THE TRUTH AT RENDER TIME.
   *
   * A control that COMMITS may not carry a `leads_to` — the model refuses it, because where it
   * lands belongs to its answer slot. That rule is about where the fact is written down, not about
   * whether the prototype can walk it. So the same inference the `connect` command reports is read
   * here and stamped onto the drawing, and the corpus keeps exactly the shape the model allows.
   */
  const derivedGoes = new Map<string, string>();
  for (const c of inferConnections(corpus).made) derivedGoes.set(c.from, c.to);
  /** Which tabs are areas of the product, and so hold scopes of their own. */
  const areaIds = new Set(
    corpus.scopes.filter((x) => x.scope.in === rootId && x.scope.exists !== "withdrawn").map((x) => x.scope.id)
  );
  /**
   * ⛔ EVERY COUNT CARRIES THE NOUN IT IS COUNTING. These five tabs each showed a bare digit and
   * each was counting something different — screens, habits, capabilities, sentences — so "Money
   * 21" beside a heading saying 22 and a sub-tab saying 4 read as three answers to one question
   * when it was one answer each to three. The number cannot say which; `says` does.
   */
  const sections: Array<{ id: string; label: string; toRead?: number; says?: string }> = [
    { id: "overview", label: "Overview" },
    /**
     * ⛔ ITS OWN PLACE, BESIDE OVERVIEW. Peter: *"let's add a separate 'top level' menu item for the
     * prototype"*. Everywhere else a screen is evidence inside a behaviour card; here the screen is
     * the subject and the sentences are what a press gives you. A surface trying to be both puts the
     * screen in a column too narrow to judge.
     */
    { id: "prototype", label: "Prototype", toRead: protoScreens.length, says: "screens drawn" },
    /**
     * ⛔ ITS OWN PLACE, AND DELIBERATELY NOT THE CHARTER. Peter, asked where a learned habit gets
     * reviewed: *"A settings surface on the page"*.
     *
     * The charter is product truth — things somebody agreed to. A generation steer is the one kind
     * of context nobody agrees to, so a section of it among the constraints would make taste look
     * like something that had been decided, and a reviewer would start validating habits. But
     * ⛔ *"a learned steer nobody can see is a constraint nobody chose"* — so it is on the page,
     * one tab away, under a heading that says what it is.
     *
     * ⛔ ABSENT WHERE THERE IS NOTHING, because an empty tab reads as "already checked that" — which
     * is the complaint this file's own nav comment opens on.
     */
    ...(corpus.steers.some((x) => x.steers === "generation")
      ? [{ id: "settings", label: "What steers this", toRead: inEffect(corpus.steers).length, says: "habits in force" }]
      : []),
    /**
     * ⛔ ABSENT WHERE THERE ARE NO SUBSYSTEMS, for the reason the nav comment at the top of this
     * list opens on: a row that does nothing reads as *already checked that*. A corpus with no
     * capability layer must not grow a tab implying somebody has described the machinery.
     *
     * The count is how many capabilities exist, not how many subsystems — "which part do I look at
     * next" is answered by how much is said inside, and a container holding four parts that each
     * offer nothing should not read as four things to go and look at.
     */
    /**
     * ⛔ AND PRESENT WHEN AN OLDER TREE WAS CARRIED INTO PRODUCT TRUTH, even with nothing in this
     * one. That is the corpus where a reader most needs to be told which "capabilities" is which —
     * Peter: *"every claude session connecting to staging is confused by the # of capabilities"*.
     */
    ...(corpus.subsystems.length || capabilityTree(corpus).carried.length
      ? [
          {
            id: "subsystems",
            label: "How it works",
            toRead: corpus.subsystems.reduce((n, c) => n + c.subsystem.offers.length, 0),
            says: "things the machinery offers",
          },
        ]
      : []),
    /**
     * ⛔ WHAT A PERSON SEES, THEN THE MACHINERY UNDERNEATH. File order put the subsystems first,
     * which is backwards for every reader: the behaviours are the product, and the machinery is what
     * they rest on. Ordered by whether anything beneath the section has a screen, so it holds
     * whatever the corpus is called rather than a list of names to keep updated.
     */
    ...corpus.scopes
      /** ⛔ And no tab for a withdrawn feature — see `kids` above. */
      .filter((x) => x.scope.in === rootId && x.scope.exists !== "withdrawn")
      .map((x) => {
        const under = descendants(corpus, x.scope.id);
        const screens = under.reduce(
          (n, d) => n + (corpus.scopes.find((y) => y.scope.id === d)?.scope.views.length ?? 0),
          0
        );
        /**
         * ⛔ `written`, NOT `behaviours`. The chip says how much is here; whether it is currently
         * askable is the purpose gate's business and has its own line. Reading `behaviours` made a
         * hundred written sentences render as no chip at all.
         */
        const toRead = acts.written.filter((b: string) => under.some((u) => b.startsWith(`${u}#`))).length;
        return { id: x.scope.id, label: line(x.scope.title || x.scope.id), screens, toRead };
      })
      .sort((a, b) => b.screens - a.screens)
      /**
       * ⛔ "SENTENCES NOBODY HAS READ", WHICH IS WHAT `written` HAS ALWAYS BEEN. The chip said 21
       * where the feature's own heading said 22 and its sub-tab said 4, and only one of the three
       * named what it counted. These are statements somebody still owes a reading to — not
       * behaviours, which is the sub-tab's number, and not every statement, which is the heading's.
       */
      .map(({ id, label, toRead }) => ({ id, label, toRead, says: "sentences nobody has read" })),
  ];
  /** view → the tab it lives under, so the row can show where you are without being told. */
  /**
   * ⛔ THE PROTOTYPE IS ITS OWN SECTION, and leaving it out of this map is why the tab row went on
   * highlighting Overview while the board was on screen — an unknown view falls back to "overview",
   * so the frame said one thing and the page showed another, with Overview's sub-menu still under
   * it. A fixed tab needs an entry exactly like a scope does.
   */
  const sectionOf: Record<string, string> = { overview: "overview", prototype: "prototype", settings: "settings" };
  for (const { scope } of corpus.scopes) {
    const t = trails[scope.id]!;
    // ⛔ Index 0 now, because the root is no longer a crumb — see the trail comment above. Reading
    // index 1 after that change put every section under whatever happened to be two levels down.
    sectionOf[scope.id] = scope.id === rootId ? "overview" : t[0]!.id;
  }
  /**
   * ⛔ THE QUESTIONS ARE THEIR OWN DESTINATION. They are org-wide — one answer reaches every feature
   * — so they belong to no single one of them, and burying them above the first feature's grid meant
   * the only thing a reviewer is actually asked to do had no way to be navigated to.
   */
  void open;
  /**
   * ⛔ A TOP FRAME THAT COLLAPSES TO WHERE YOU ARE. Sixteen rows permanently on screen is a table of
   * contents competing with the thing being reviewed; the trail alone is the one line worth keeping,
   * and the tree is one press away.
   */
  /**
   * Overview's own items. ⛔ Emitted INSIDE the Overview group now rather than as a sibling block —
   * `data-tabs="product"` is the owner key `showSub` reads and is deliberately unchanged, because
   * renaming it would be a second edit riding along with a layout change.
   */
  /**
   * ⛔ A BARE NUMBER ON A TAB IS A COUNT OF NOTHING NAMED.
   *
   * Money 21, a heading saying 22, a sub-tab saying 4 — three counts, three different things, and
   * the only one of the three that said what it was counting was the heading, which said it wrong.
   * The tree rows beside these have carried a mark and a spoken name since they were built; the
   * tabs carried the digit alone. Same shape here, so hovering or reading with a screen reader
   * answers "twenty-one WHAT".
   */
  const pill = (n: number, says: string, quiet = true) =>
    ` <span class="pill${quiet ? " quiet" : ""}" title="${esc(`${n} ${says}`)}" aria-label="${esc(`${n} ${says}`)}">${n}</span>`;
  const OVERVIEW_STRIP =
    `<div class="subtabs" data-tabs="product" hidden><button type="button" class="subtab" data-sub="queue">Queue${
      open ? pill(open, open === 1 ? "question nobody has answered" : "questions nobody has answered", false) : ""
    }</button><button type="button" class="subtab" data-sub="screens">Screens${
      screens ? pill(screens, screens === 1 ? "screen drawn here" : "screens drawn here") : ""
    }</button><button type="button" class="subtab" data-sub="about">${aboutLabel}</button>${charterTabs}</div>`;

  return (
    /**
     * ⛔ DOUBLE-QUOTED, because `esc` escapes `"` and not `'` — and a single-quoted attribute holding
     * JSON is one apostrophe away from being cut in half.
     *
     * It was cut in half: "Resolve an organization's stages" ended the attribute early, `JSON.parse`
     * threw, and every breadcrumb silently fell back to a bare scope id. Nothing errored — the trail
     * just quietly stopped knowing where anything was.
     */
    NAV_PLACEMENT_BOOT +
    `<div class="topframe" data-trails="${esc(JSON.stringify(trails))}" data-sections="${esc(JSON.stringify(sectionOf))}">` +
    /**
     * ⛔ AN AREA'S ITEMS BELONG UNDER THE AREA, NOT IN A SECTION OF THEIR OWN.
     *
     * Peter: *"the expanded menu should be grouped under each main area, just like a standard
     * menu... e.g. product, when selected, should have items under it, not under a new section. And
     * each container should be collapsible"*.
     *
     * Every area was a button in one row and its items were a SIBLING block below the whole row, so
     * on the side menu the four areas sat together and whatever was open appeared underneath all of
     * them — attached to nothing. Reading down the menu told you what the areas were and then
     * showed you a list with no owner.
     *
     * So each area is a group holding its own head and its own items.
     *
     * ⛔ `display: contents` IN TOP MODE, so the row is laid out exactly as it was — the wrapper
     * leaves the layout entirely. Nesting is a fact about the DOM; whether it READS as nesting is
     * the side menu's business, and the top menu must not change at all.
     */
    `<div class="tabs">${sections
      .map((t) => {
        /**
         * ⛔ WHAT THIS GROUP ACTUALLY HOLDS, COMPUTED ONCE AND GATING BOTH THINGS THAT DEPEND ON IT.
         *
         * The twisty was drawn on every group but the prototype, which put a collapse control on
         * areas holding nothing — the seed has two of them — and that is the defect this same
         * comment refuses two lines down. An empty list rendered as an empty `<nav>` as well, so the
         * group looked like a container to every stylesheet rule and to anything counting them.
         */
        /** ⛔ And the machinery group holds the capability tree, so it collapses like an area. */
        const holds = t.id === "overview" || areaIds.has(t.id) || (t.id === "subsystems" && corpus.subsystems.length > 0);
        return (
          `<div class="tabgroup" data-group="${esc(t.id)}">` +
          `<div class="tabhead">` +
          `<button type="button" class="tab" data-tab="${esc(t.id)}">${t.label}${
            /**
             * ⛔ THE COUNT ON THE TAB TOO. Overview carried one and the halves carried none, so the
             * top row could not answer "which side has the work" without opening both.
             */
            t.id === "overview"
              ? open
                ? pill(open, open === 1 ? "question nobody has answered" : "questions nobody has answered", false)
                : ""
              : t.toRead
                ? pill(t.toRead, t.says ?? "here")
                : ""
          }</button>` +
          /**
           * ⛔ THE TWISTY IS A SEPARATE CONTROL FROM THE AREA, for the reason the chevron beside the
           * trail is: one control that both navigates and expands means every attempt to collapse a
           * group moves you into it. ⛔ And only where the group has something to collapse — a
           * twisty that expands nothing is the thing this project refuses by name elsewhere.
           */
          (holds
            ? `<button type="button" class="twisty" data-twist="${esc(t.id)}" aria-expanded="true" aria-label="Collapse ${esc(
                t.label
              )}">▾</button>`
            : "") +
          `</div>` +
          /** Overview's own items move inside their area — see the strip below. */
          (t.id === "overview" ? OVERVIEW_STRIP : "") +
          /**
           * ⛔ AND NO SECOND TREE PER AREA. THERE IS ALREADY ONE, AND THE SCRIPT MOVES IT HERE.
           *
           * I rendered a subtree inside every area group to put an area's features under it. That
           * mechanism already existed: `scopeTree()` filters the one tree's rows to the selected
           * section and the frame script APPENDS that tree into the selected group, so it physically
           * sits under the area whose features it lists. Its own comment says why — *"a second tree
           * per area would be two derivations of one fact, which is what this project keeps being
           * bitten by"*.
           *
           * ⛔ AND IT BIT EXACTLY THERE. Two trees meant two sets of rows for one corpus, and the one
           * I added inherited the collapsed-by-default rule that made the top menu's tree unusable —
           * the thing he reported. Reading the script before adding to it would have cost a minute.
           */
          `</div>`
        );
      })
      .join("")}${NAV_PLACE_BUTTON}${connect}</div>` +
    /**
     * ⛔ OVERVIEW'S OWN MENU BELONGS IN THE FRAME, NOT IN THE PAGE.
     *
     * It was rendered at the top of the Overview view, so it scrolled away — and the one row that
     * moves between the queue and the principles was gone by the time you had read either. The frame
     * is the part that does not move; a menu that scrolls is a heading.
     *
     * It shares the second row with the trail, one at a time: both at once is two navigations
     * competing for the line that says where you are.
     */
    /**
     * ⛔ `data-tabs` NAMES WHOSE STRIP THIS IS, and adding a feature's own tabs is what forced it.
     *
     * `.sub-view` and `.subtab` were one global set: `showSub` hid EVERY sub-view in the document
     * whose name did not match. So three tabs added inside a feature were hidden by the product's
     * tab selection — and with them the behaviour table, which simply vanished from every feature
     * page. ⛔ The markup was all present, which is why a test asserting the markup passed it.
     */

    /**
     * ⛔ ONE WAY OUT, BECAUSE THERE IS ONE WAY IN.
     *
     * Peter: *"we need better error handling - we should just pass the response to a notification
     * bar or something... a generic 'out' way to message back to the user if it's not from the chat
     * interface"*.
     *
     * He had been handed raw fields, because every handler formatted its own outcome into whichever
     * status span happened to be nearby. Twenty-one of those — each a place the next intent has to
     * remember to add a twenty-second, and each able to forget. The ones that forgot are why a
     * refusal reached him as a blob, and why one reached him as "Not saved: Not Found".
     *
     * The door in is one endpoint and every intent answers the same four fields, so the way out is
     * one bar rendering exactly those, and the sender announces through it. A caller cannot opt out,
     * which is the point: the next intent gets this without anybody wiring it up.
     */
    `<div class="out" id="out" role="status" aria-live="polite"></div>` +
    /**
     * ⛔ THE TRAIL NAVIGATES; THE CHEVRON EXPANDS. One control doing both meant every attempt to go
     * up a level dropped the whole tree on you instead, which is the opposite of what a breadcrumb
     * is for.
     */
    tree +
    `</div>` +
    /**
     * ⛔ THE TRAIL IS ON THE PAGE, NOT IN THE MENU — IN BOTH PLACEMENTS.
     *
     * Peter: *"the breadcrumb for the page does not belong in the menu - always at the top of the
     * page"*, then *"breadcrumb on page in both top/side menu modes..... very simpel..."*.
     *
     * It was a child of the frame, which is a sticky header across the top and a fixed 19rem column
     * down the side — so the same markup read as "the top of the page" in one placement and "a row
     * inside the menu" in the other. Where it SITS was never the question: a breadcrumb says where
     * the page you are reading is filed, so it belongs to the page.
     *
     * Outside the frame it is in the document flow, under the tab row in top mode and beside the
     * column in side mode, which is the top of the page in both — without the placement being asked
     * about anywhere.
     *
     * ⛔ THE CHEVRON STAYS WITH IT. It opens the tree, which is still the frame's, and it is already
     * hidden down the side where the menu needs no opening. Two things on one line because they are
     * both about getting somewhere else, not because they share an ancestor.
     */
    `<div class="crumbs"><span class="trail"></span>` +

    /**
     * ⛔ AND NO CHEVRON WHERE THERE IS NO TREE TO SHOW. A control that expands nothing is the thing
     * `check` refuses by name elsewhere in this project — it reads as "there is more here" and then
     * answers nothing, which is worse than the absence it is covering for.
     */
    (tree ? `<button type="button" class="chev" aria-expanded="false" aria-label="Show every feature">▾</button>` : "") +
    `</div>`
  );
}

// ---------------------------------------------------------------------------

/**
 * One scope and everything filed beneath it, as a page.
 *
 * ⛔ DESCENDS, because a container has no exchanges of its own and a page that answered for
 * the named scope alone would show a finished-looking product with nothing in it.
 */
export function renderScopePage(corpus: Corpus, scopeId: string, opts: PageOptions = {}): string | null {
  const protoScreens = screensOf(corpus);
  const theWalk = walkOf(corpus, corpus.prototypes?.[0]?.starts_at);
  const protoPromises = promisesOf(corpus);
  const entry = corpus.scopes.find((s) => s.scope.id === scopeId);
  if (!entry) return null;
  const ids = descendants(corpus, scopeId);
  /**
   * Whether this view's content travels with the page, or arrives when somebody asks for it.
   *
   * ⛔ `only` UNDEFINED MEANS EVERYTHING, and that is not a default chosen for safety — a
   * standalone file has no server to ask, so a deferred section there would be a section that never
   * arrives. The served page passes `only`; `v2 page --out` does not.
   */
  const full = (view: string): boolean => !opts.only || opts.only.includes(view);
  /**
   * ⛔ SENTINELS, BECAUSE SECTIONS NEST. Extracting one by matching to the next `</section>` returns
   * the first INNER close for the two kinds that nest, which is a truncated section that renders as
   * a broken page rather than as an error.
   */
  const marked = (view: string, html: string): string =>
    opts.fragment ? `<!--s:${view}-->${html}<!--/s:${view}-->` : html;
  /**
   * What a view looks like before its content has arrived.
   *
   * ⛔ IT KEEPS `data-view` AND `data-label`, because the nav and `VIEW_SWITCH` are built from those
   * — a stub missing them is a menu entry that leads nowhere, and `show()` falls back to revealing
   * EVERY section when it cannot find the one it was asked for.
   */
  const stub = (view: string, id: string, label: string, framed: boolean): string =>
    `<section class="view${framed ? " framed" : ""}" id="${id}" data-view="${esc(view)}" data-ref="${esc(view)}" data-label="${esc(label)}" data-defer="${esc(view)}" hidden>
       <p class="deferred-note">Loading this…</p>
     </section>`;
  /**
   * ⛔ ONE GRID PER SCOPE THAT HAS PROMISES. `gridFor` reads one scope's own exchanges, and
   * a container has none — so a single call for the named scope rendered an empty grid
   * reading `0 exchanges · 0 blank` directly above cards for every behaviour underneath it.
   * Containers nest without limit, so this has to be the whole subtree or it is a lie about
   * the commonest shape in the model.
   */
  /**
   * ⛔ ONE ADDRESS RENDERS ONE PAGE, SO THE SECTIONS ARE THIS SCOPE'S AND NOBODY ELSE'S.
   *
   * Peter: *"we need to stop the 'server re-rendering' of anything. we should just be loading data,
   * rendering the page we're on, no tree walking, nothing."*
   *
   * This descended, so an ancestor's document carried a section for every scope beneath it and the
   * client switched between them in place. That gave **every scope two renderings** — one as a
   * section on an ancestor's page, one as the landing of its own page — and all four of the things
   * he reported are that, measured in a real browser on a three-level corpus:
   *
   *   via the menu    data-view="rent-roll"     ← a section of the ANCESTOR's document
   *   the same URL    data-view="overview"      ← its own page's landing
   *
   * So "I load a page different than if I went to the menu", and the router that had to reconcile
   * the two lost the address while doing it. I patched its resolution three times; each patch was
   * right about the one case I measured and wrong about the others, because the defect is not in
   * the resolving — it is that there are two things to resolve between.
   *
   * ⛔ WITH THE DESCENDANTS GONE THE ROUTER DISABLES ITSELF, which is the point. A menu click is
   * kept in-page only where the document already holds that view; now it never does, so the link
   * is a link and the browser navigates. One rendering per address, by construction rather than
   * by assertion.
   *
   * ⛔ AND THE SUBTREE IS STILL COUNTED, just not rendered. `ids` below still feeds the numbers that
   * say what is underneath this scope — those are facts about this page and a reader needs them.
   * Narrowing what gets LOADED to match what gets rendered is the next commit and a different
   * layer; doing both at once would make a correctness fix indistinguishable from a perf change.
   */
  /**
   * ⛔ ONE SCOPE ONLY WHERE THERE IS SOMEWHERE TO NAVIGATE TO. A page with no address cannot be one
   * page of many: `v2 page --out` writes a FILE and a published artifact is a single document, with
   * no server to ask for the next scope. Cutting the subtree out of those leaves a reader with one
   * feature and a menu full of rows that can never resolve — the standalone render's whole job is to
   * be complete.
   *
   * The same distinction `only` already draws, and for the same reason: the served page defers
   * because it can fetch, and the standalone page must not because it cannot.
   */
  const servedPage = !!opts.linkBase;
  const renderIds = servedPage ? [scopeId] : ids;
  const grids = renderIds
    .map((id) => gridFor(corpus, id))
    .filter((x): x is Grid => !!x && x.rows.length > 0);
  const cellOf = new Map<string, Cell>();
  for (const g of grids)
    for (const r of g.rows) for (const s of SLOTS) cellOf.set(`${g.scope}#${r.exchange}#${s}`, r.cells[s]);
  // Where each rule belongs in the tree, so a group's own sentences render on the group.
  const homesOf = ruleHomes(corpus);
  const qs = questionsFor(corpus, scopeId);
  const live = qs.filter((q) => !q.parked);
  const parked = qs.filter((q) => q.parked);
  const a = actsFor(corpus);
  /** ⛔ Scoped to this page's subtree, so the figure describes what the reader is looking at. */
  const under = (r: string) => ids.some((i) => r.startsWith(`${i}#`));
  const gated = a.gated.filter(under);
  /** ⛔ From the grids, so the page and the grid cannot disagree about what is empty. */
  const blanks = grids.reduce((n, g) => n + g.counts.blank, 0);
  const written = grids.reduce((n, g) => n + g.counts.stated + g.counts.inherited + g.counts.outOfScope, 0);
  /**
   * ⛔ SENTENCES, FROM THE LIST THAT ALREADY DECIDES WHAT IS OWED — never a count of verdict rows.
   *
   * This read `corpus.verdicts.filter(v => v.kind === "accept" && under(v.target))`, which counts
   * accept rows at ANY grain: an exchange, a slot, one statement, a rule. It was rendered against
   * `gated.length`, which counts EXCHANGES. So the two halves of one fraction never counted the
   * same kind of thing, and the word "behaviours" described only the denominator.
   *
   * ⛔ IT STOPS BEING A DRIFT AND BECOMES A MULTIPLICATION under per-ref acceptance, which is the
   * model Peter has confirmed: one press on an exchange writes one ordinary acceptance per sentence
   * beneath it, so one press turns one row into nine and the seed reads "17 of 20" where it read
   * "2 of 5".
   *
   * `actsFor` computes both halves in the one loop that decides what a settled sentence is, so the
   * page cannot drift from the queue about it.
   */
  const agreed = a.agreed.filter(under).length;
  const owed = a.written.filter(under).length;
  const stale = a.stale.filter((s) => ids.some((i) => s.where.startsWith(`${i}#`)));

  /**
   * ⛔ THE BROKEN FILES ARE ON THE PAGE, because `corpus.broken` was read by `check` and by
   * nothing else — and every other surface then computed over a corpus missing part of
   * itself while looking complete.
   */
  const broken = corpus.broken.length
    ? `<div class="alarm">
         <p><strong>${corpus.broken.length} file${corpus.broken.length === 1 ? "" : "s"} here would not load</strong>, so everything below is computed without ${
           corpus.broken.length === 1 ? "it" : "them"
         } — nothing on this page should be agreed to until that is fixed.</p>
         <ul>${corpus.broken
           .map((b) => {
             /* The screen's own words where it got far enough to say them, and never its file. */
             const who = b.title ?? b.id;
             return `<li>${who ? `<strong>${esc(who)}</strong> &mdash; ` : ""}${esc(b.why.split("\n")[0])}</li>`;
           })
           .join("")}</ul>
       </div>`
    : "";

  const staleBlock = stale.length
    ? `<div class="alarm">
         <p><strong>${stale.length} agreement${stale.length === 1 ? "" : "s"} no longer cover${stale.length === 1 ? "s" : ""} what ${
           stale.length === 1 ? "it was" : "they were"
         } given to</strong> — read as reviewed, and were not.</p>
         <ul>${stale.map((s) => `<li><code>${esc(s.where)}</code> agreed by ${esc(s.by)} on ${esc(s.at)} — ${line(s.was)}</li>`).join("")}</ul>
       </div>`
    : "";

  /**
   * ⛔ COMPUTED BEFORE ANYTHING IS RENDERED, so a link and its target cannot disagree — which is
   * how 357 dead anchors reached a real corpus.
   */
  /** Every scope this render emits a view for — leaves with behaviours, and the containers above them. */
  /**
   * ⛔ THIS SCOPE'S OWN LISTING, AND NO DESCENDANT'S — the same cut as `grids` above.
   *
   * It used to emit a listing for every container BENEATH this one, which is half of why an
   * ancestor's document held a second rendering of each descendant.
   *
   * ⛔ AND THE `id !== scopeId` EXCLUSION GOES, which is the half that made a container's own page
   * empty. A container has no exchanges, so with its descendants' sections gone a page for it would
   * have had nothing on it at all — the exact objection `renderScopePage` opens with ("a page that
   * answered for the named scope alone would show a finished-looking product with nothing in it").
   * The answer is not to re-render the subtree; it is that a grouping's own content is the LISTING
   * of what is in it, which this already renders as links to their own pages.
   *
   * The duplicate-description worry the old comment records was about the corpus root, where the
   * landing already describes the product. Guarded below rather than by excluding every scope.
   */
  const containerViews = (servedPage ? [scopeId] : ids).filter(
    (id) =>
      (corpus.scopes.find((s) => s.scope.id === id)?.scope.exchanges.length ?? 0) === 0 &&
      /**
       * ⛔ On a served page this scope's OWN listing is the thing; on a standalone one it is still
       * excluded, because there the landing already describes it and rendering both put its
       * description under two headings.
       */
      (servedPage ? !!entry.scope.in : id !== scopeId)
  );
  const viewed = new Set<string>([...grids.map((g) => g.scope), ...containerViews]);
  const anchors = new Set<string>([
    ...qs.map((q) => q.ref),
    ...viewed,
    ...ids.flatMap((sid) => {
      const sc = corpus.scopes.find((s) => s.scope.id === sid);
      return (sc?.scope.exchanges ?? []).map((e) => `${sid}#${e.id}`);
    }),
    ...grids.flatMap((g) => [...g.rulesUsed.keys()]),
  ]);
  /**
   * ⛔ `only` IS WHAT SAYS THERE IS A SERVER, because only the served route passes it. A standalone
   * file and a published artifact both render everything and have nowhere to fetch from, so nothing
   * in them may be left to arrive later.
   */
  const served = Boolean(opts.only);
  /**
   * ⛔ BUILT ONCE, FROM `trails`, AND HANDED TO EVERYTHING THAT WRITES A LINK. The menu path is the
   * address, so a second derivation of it would be a link that disagrees with the breadcrumb above
   * it about where the thing sits.
   */
  const address = addressIn(opts.linkBase, trailsOf(corpus));
  /** ⛔ The capability tree's own address space — see `subsystemAddressIn` for why it is separate. */
  const subAddress = subsystemAddressIn(opts.linkBase, subsystemTrailsOf(corpus));
  /** ⛔ `corpus` too: showing a title where a ref used to be needs the thing the ref names. */
  const ctx: Ctx = { corpus, base: opts.linkBase, url: address, here: ids, anchors, served };
  const body = `
    ${renderNav(
      corpus,
      scopeId,
      opts.linkBase,
      address,
      viewed,
      live.length,
      line(entry.scope.title || scopeId),
      corpus.charter
        .map((c) => `<button type="button" class="subtab" data-sub="${esc(c.charter.id)}">${line(c.charter.title)}</button>`)
        .join(""),
      ids.reduce(
        (n, id) => n + (corpus.scopes.find((s) => s.scope.id === id)?.scope.views.filter((v) => v.exists !== "withdrawn").length ?? 0),
        0
      ),
      opts.interactive && servedUnderProject(opts.linkBase) ? CONNECT_BUTTON : "",
      subAddress,
      opts.subsystem
    )}
    <main>
      ${
        /**
         * ⛔ NO PAGE HEADER. It sat above the views, so one title, one count and one line of
         * boilerplate repeated on all thirty-three of them — and every one of the three was already
         * somewhere better. The title is the crumb and the view's own heading; the counts are on the
         * tabs and the tree rows; and who a press is recorded as belongs in the form that records
         * it, at the moment it matters, which is where it already was.
         *
         * A read-only render keeps one line, because disabled buttons with no explanation are worse
         * than the repetition was.
         */
        opts.interactive
          ? ""
          : `<p class="mode">Read-only preview — the acts below show what you will be asked to do, and record nothing.</p>`
      }
      ${broken}
      ${staleBlock}
      ${
        /**
         * ⛔ OVERVIEW IS WHAT THE PRODUCT IS, AND THEN WHAT IT OWES. The queue used to be a row in
         * the tree beside the features, which put the only thing a reviewer is actually asked to do
         * at the same level as the things it is asked about — and left the product's own framing
         * with nowhere to be read at all.
         */
        /**
         * ⛔ OVERVIEW IS A SET OF PAGES, NOT ONE. The queue, the goals, the principles and the rest
         * are all product-wide and all separately long; stacked on one scroll the principles sit
         * under seven open questions and nobody reads them. A second row of items, at the level
         * they belong to.
         */
        /**
         * ⛔ THE BOARD IS NOT DEFERRED, AND THE REASON IS A REGRESSION A BROWSER TEST CAUGHT.
         *
         * It is the biggest section on the page — every screen in the product, tiled — so deferring
         * it looked like the obvious win. But `DRIVE` reads `const board = document.querySelector(
         * ".pboard"); if (!board) return;` and everything that HYDRATES A MOCK lives below that
         * line. Take the board off the page and the hydration sweep is never installed, so every
         * drawing anywhere on the page stays an inert template: a correct-looking document showing
         * nothing. The sweep's own comment says it is for "EVERY MOCK ON THE PAGE, not only the ones
         * on the board", which is true of its intent and was not true of where it sat.
         *
         * So the board stays and its TILES go lazy instead — the same mechanism as the map's
         * thumbnails, already tested, and a better fit: a board is a grid of thumbnails, and
         * thumbnails load as they are scrolled to. The markup for 128 tiles is small; it was the
         * 128 drawings inside them that was 4.42 MB.
         */
        marked("prototype", renderPrototype(protoScreens, protoPromises, theWalk, (corpus.prototypes ?? []), selectionOf(corpus), served)) +
        (full("settings") ? marked("settings", renderSettings(corpus)) : stub("settings", "view-settings", "What steers this", false)) +
        (full("subsystems") ? marked("subsystems", renderSubsystems(corpus, address, opts.subsystem, subAddress)) : stub("subsystems", "view-subsystems", "How it works", false)) +
        `<section class="view" id="view-overview" data-view="overview" data-ref="${esc(scopeId)}" data-label="Overview">
           <div class="sub-view" data-tabs="product" data-sub-view="queue" data-ref="queue" data-label="Queue">
             ${
               live.length
                 ? /**
                    * ⛔ IT SAID WHAT THE MODEL DOES, NOT WHAT IS HAPPENING. *"Each reaches every
                    * behaviour its selector touches, and every one written after it"* is true, and
                    * a selector is a thing in the schema — the reader is a person deciding where to
                    * spend an hour, and the sentence they need is the consequence: this many
                    * questions are the reason this many behaviours cannot be agreed to.
                    *
                    * ⛔ THE SAME TWO NUMBERS THAT WERE ALREADY HERE, from the same places. The gate
                    * line below counted them and the lede above it described a mechanism; one
                    * sentence now carries both, and neither figure is computed twice.
                    */
                   `<p class="lede"><strong>${live.length}</strong> question${live.length === 1 ? "" : "s"} nobody has answered${
                     gated.length
                       ? `, blocking <strong>${gated.length}</strong> behaviour${gated.length === 1 ? "" : "s"} from being agreed`
                       : ""
                   }.</p>
                    ${
                      /**
                       * ⛔ A SHORT QUEUE IS NOT A REVIEWED CORPUS, AND THE PAGE READ AS THOUGH IT WERE.
                       *
                       * Seven items offered, seventy-seven behaviours nobody has ever agreed to, and
                       * nothing on screen connecting the two: every one of those behaviours is GATED
                       * behind these same questions, because a stamp on a slot that says nothing
                       * reads exactly like a considered one. So the queue is short for the worst
                       * reason available, and looked like the best.
                       */
                      gated.length || agreed
                        ? `<p class="gate-note">${
                            /**
                             * ⛔ EACH NUMBER SAYS WHAT IT COUNTS. Sentences are agreed; BEHAVIOURS
                             * are gated. Naming both "behaviours" is what let a numerator of
                             * verdict rows sit over a denominator of exchanges without anybody
                             * noticing the fraction was meaningless.
                             */
                            agreed
                              ? `<strong>${agreed}</strong> of ${agreed + owed} sentences have been agreed to. `
                              : `<strong>Nothing here has been agreed to yet.</strong> `
                          }${
                            /**
                             * ⛔ IT NO LONGER REPEATS THE LINE ABOVE IT. The lede now says how many
                             * behaviours these questions are blocking; this said the same number
                             * again in longer words, two lines apart. What it keeps is the part the
                             * lede cannot carry — every one of them has a slot waiting, which is
                             * why the queue being short does not mean the corpus is reviewed.
                             */
                            gated.length
                              /** ⛔ `behaviours` said out loud, because the half before it counts sentences. */
                              ? `${gated.length} behaviour${gated.length === 1 ? "" : "s"} cannot be agreed to at all until these ${live.length === 1 ? "is" : "are"} answered — every one of them has a slot waiting on ${live.length === 1 ? "it" : "them"}.`
                              : ""
                          }</p>`
                        : ""
                    }
                    ${live.map((q, i) => renderQuestion(q, i, decisionsOn(corpus, q.ref), ctx)).join("")}
                    ${
                      /**
                       * ⛔ AFTER THE PRESSABLE ONES AND ON THE SAME TAB, because "what is undecided
                       * here" has one honest answer and it is both halves. Below the queue, so the
                       * things a reviewer can act on come first.
                       */
                      renderUnasked(corpus, scopeId, ctx)
                    }`
                 : /**
                    * ⛔ "NOTHING IS UNDECIDED" IS TRUE AND MISLEADING WHEN NOTHING IS WRITTEN.
                    *
                    * An empty queue reads as a finished corpus. On a migrated one it means the
                    * opposite: there are no questions because nobody has written enough down to
                    * have a question about it. A reviewer told "nothing to decide" over 539 blank
                    * slots has been told the corpus is ready.
                    *
                    * What this needs is an author, and saying so is the whole finding.
                    */
                   `<p class="lede">Nothing here is undecided.</p>
                    ${
                      /**
                       * ⛔ A DIAGNOSIS IS NOT A NEXT ACTION, and this said "somebody should write it
                       * down" to a person who then had nowhere to go. Replacing a queue that lied
                       * with a dead end is not an improvement.
                       *
                       * So: the worklist. Which feature, how much of it is missing, and which slots
                       * — ordered by how close each is to finished, because the useful question is
                       * "where do I start" and the answer is the one with the fewest holes.
                       */
                      blanks ? renderWorklist(corpus, grids, a, written, blanks, gated.length, ctx) : ""
                    }
                    ${
                      /**
                       * ⛔ AND HERE ESPECIALLY. This is the branch whose own ⛔ says an empty queue
                       * over 539 blank slots tells a reviewer the corpus is ready. `renderWorklist`
                       * answers it in slots and features; this answers it in the questions somebody
                       * would actually be asked, which is the form a reviewer can judge.
                       */
                      renderUnasked(corpus, scopeId, ctx)
                    }`
             }
           </div>
           <div class="sub-view" data-tabs="product" data-sub-view="screens" data-ref="screens" data-label="Screens">
             ${
               /**
                * ⛔ THE PRODUCT ROOT IS A GROUP TOO, AND IT WAS THE ONE WITHOUT A MAP.
                *
                * Every other container renders "how this part of the product fits together"; the
                * root does not get a container view at all, because Overview stands in for it. So
                * the largest group in the corpus — the whole product — was the only one whose shape
                * was never drawn, and the seed could not even test the feature because its root is
                * its only container.
                */
               renderGroupUx(corpus, scopeId, ctx)
             }
             ${renderScreenIndex(corpus, ids, ctx)}
           </div>
           <div class="sub-view" data-tabs="product" data-sub-view="about" data-ref="${esc(scopeId)}" data-label="Product Truth">
             <h2>${line(entry.scope.title || scopeId)}</h2>
             ${
               /**
                * ⛔ THE SAME RULE AS THE FEATURE VIEW, AND IT WAS THE SECOND DOOR.
                *
                * Removing the preface from a feature's own view left it rendering here whenever a
                * feature is the root of the page — and the real corpus hid that, because its root
                * is the product, so the paragraph genuinely disappeared from the page Peter was
                * looking at while still rendering for anybody who opened one feature on its own.
                * A test on a single feature is what found it.
                *
                * A grouping keeps its prose: it has no happy path and no behaviours of its own, so
                * this is the only thing it can say about itself.
                */
               corpus.scopes.some((x) => x.scope.in === scopeId) ? renderProse(entry.body) : ""
             }
           </div>
           ${
             /**
              * ⛔ THE HALF OF A PROJECT'S CONTEXT THAT IS MEANT TO BE SEEN.
              *
              * Peter: *"some stuff should be opaque and auto-training, while others are made
              * obvious in product OS"*. This is the obvious half — the steers that constrain the
              * PRODUCT rather than how it gets made. A constraint nobody can see is one the next
              * person breaks, and then it reads as their mistake rather than a rule nobody told
              * them.
              *
              * ⛔ AND ONLY THAT HALF. A steer that shapes what gets proposed is deliberately not
              * here: nobody agrees to it, so putting it on a page of product truth would make taste
              * look like something that had been decided.
              */
             (() => {
               const shown = corpus.steers.filter((x) => x.steers === "truth");
               if (!shown.length) return "";
               return `<div class="sub-view" data-tabs="product" data-sub-view="steers" data-ref="steers" data-label="what holds across this product">
                 <h2>What holds across this product</h2>
                 <p class="lede">Constraints somebody decided, which every feature is held to. ⛔ Not
                 claims about one screen — those live on the feature they belong to.</p>
                 <ul class="steer-list">${shown
                   .map(
                     (x) =>
                       `<li id="${anchorOf(`steer#${x.id}`)}" data-ref="${esc(`steer#${x.id}`)}" data-label="${esc(plain(x.says).slice(0, 60))}">${line(x.says)}</li>`
                   )
                   .join("")}</ul>
               </div>`;
             })()
           }
           ${
             /**
              * ⛔ WHAT EACH ROLE OR PERMISSION REACHES — the question prose could not answer.
              *
              * Peter: *"enumerate which permissions can access it."* From an exchange's side that is
              * `held_by`; this is the same fact from the end somebody actually asks from — *what can
              * an underwriter do in this product.* With the answer in prose that was only reachable
              * by reading every feature and trusting four spellings of one idea.
              *
              * ⛔ Derived, never stored. A second list of who-reaches-what would disagree with the
              * exchanges within a week, and the stored one would win because it is the one printed.
              */
             (() => {
               if (!corpus.access.length) return "";
               const reach = reachOf(corpus);
               const title = (ref: string) => {
                 const [sid, eid] = ref.split("#");
                 const sc = corpus.scopes.find((x) => x.scope.id === sid)?.scope;
                 const ex = sc?.exchanges.find((x) => x.id === eid);
                 return `${plain(ex?.title ?? eid ?? ref)} — ${plain(sc?.title ?? sid ?? "")}`;
               };
               return `<div class="sub-view" data-tabs="product" data-sub-view="access" data-ref="access" data-label="Who may">
                 <h2>Who may</h2>
                 <p class="lede">The roles and permissions this product has, and what each one reaches.
                 ⛔ Read from what the features say, not kept as a second list.</p>
                 <ul class="access-list">${reach
                   .map(
                     (r) => `<li id="${anchorOf(`access#${r.id}`)}" data-ref="${esc(`access#${r.id}`)}" data-label="${esc(r.id)}">
                       <p class="access-head"><span class="who ${esc(r.kind)}">${esc(r.id)}</span> ${line(r.means)}</p>
                       ${
                         /** ⛔ Who grants it, where that is not this product — or somebody looks for the screen and does not find it. */
                         (() => {
                           const a = corpus.access.find((x) => x.id === r.id);
                           return a?.granted_by ? `<p class="access-by">granted by ${line(a.granted_by)}</p>` : "";
                         })()
                       }
                       ${
                         r.reaches.length
                           ? `<ul class="reaches">${r.reaches.map((x) => `<li>${esc(title(x))}</li>`).join("")}</ul>`
                           : `<p class="owes">Nothing in this product says this may do anything.</p>`
                       }
                       ${r.idle.length ? `<p class="owes">Holds ${r.idle.map((x) => `<code>${esc(x)}</code>`).join(", ")}, which nothing uses.</p>` : ""}
                     </li>`
                   )
                   .join("")}</ul>
               </div>`;
             })()
           }
           ${corpus.charter
             .map(
               (c) => `<div class="sub-view" data-tabs="product" data-sub-view="${esc(c.charter.id)}" data-ref="${esc(c.charter.id)}" data-label="${esc(plain(c.charter.title))}">
                 <h2>${line(c.charter.title)}</h2>
                 ${renderProse(c.body)}
                 ${c.charter.sections
                   .map(
                     (sec) => `<article class="charter-section" id="${anchorOf(`${c.charter.id}#${sec.id}`)}" data-ref="${esc(`${c.charter.id}#${sec.id}`)}" data-label="${esc(plain(sec.title))}">
                       <h3>${line(sec.title)}</h3>
                       ${renderProse(sec.says)}
                       ${
                         /**
                          * ⛔ THE TOP OF A CORPUS IS SIGNED OFF ON LIKE EVERYTHING ELSE.
                          *
                          * Peter: *"all the top level stuff should be able to be signed off on."*
                          * Nothing here was addressable, so no verdict could name a goal, a
                          * principle, a non-goal or a decision — and none ever had. ⛔ Which made it
                          * the worst place for the gap to be: every slot in every feature is judged
                          * against this material, and the gate that withholds a feature's
                          * behaviours until its purpose is accepted rested on goals nobody had put
                          * their name to.
                          *
                          * Same badge and the same acts as a behaviour, deliberately: a second
                          * shape of consent at the top level would be a second thing to trust.
                          */
                         renderState(corpus, `${c.charter.id}#${sec.id}`)
                       }
                       ${
                         opts.interactive
                           ? stampFor(corpus, `${c.charter.id}#${sec.id}`).state === "accepted"
                             ? `<footer class="beh-acts icons quiet"><button class="act icon" data-act="say" data-ref="${esc(`${c.charter.id}#${sec.id}`)}" title="This needs to change"><span class="glyph" aria-hidden="true">✎</span> Reword</button></footer>`
                             : `<footer class="beh-acts icons">
                                  <button class="act icon" data-act="accept" data-ref="${esc(`${c.charter.id}#${sec.id}`)}" title="That is right"><span class="glyph" aria-hidden="true">✓</span> Agree</button>
                                  <button class="act icon" data-act="say" data-ref="${esc(`${c.charter.id}#${sec.id}`)}" title="Reword it"><span class="glyph" aria-hidden="true">✎</span> Reword</button>
                                </footer>`
                           : ""
                       }
                     </article>`
                   )
                   .join("")}
               </div>`
             )
             .join("")}
         </section>`
      }
      ${grids
        .map(
          (g) =>
            !full(g.scope)
              ? stub(g.scope, anchorOf(g.scope), plain(g.title), true)
              : marked(g.scope, `<section class="view framed" id="${anchorOf(g.scope)}" data-view="${esc(g.scope)}" data-ref="${esc(g.scope)}" data-label="${esc(plain(g.title))}">
            ${featureHead(corpus, g.scope, line(g.title), ctx)}
            ${
              /**
               * ⛔ THE STAGE LINE IS GONE FROM HERE. Peter: *"get rid of 'Sepcification 4 unsettled'
               * - pointless."*
               *
               * Right about this position, and worth saying why rather than just deleting. The stage
               * is DERIVED, so above the title it restated what the page already shows: "4 unsettled"
               * is the queue, and "specification" is what every chip in the table says one row at a
               * time. It summarised the thing immediately below it, in the one place a reader has
               * earned no context for it yet.
               *
               * ⛔ `stageOf` STAYS, with its derivation and its tests. It answers a real question —
               * which features are ready for builders — and that question is asked from a LIST of
               * features, not from inside one. Deleting the answer because its placement was wrong
               * would be the layout taking the model with it.
               */
              ""
            }
            ${
              /**
               * ⛔ THE SCREEN COMES FIRST. Peter: *"when we are at a feature like 'create deal', we
               * need prototypes as well. why is there no screen rendering at the top of this
               * feature?"* — it was fifth of six blocks, below the prose, the purpose and every
               * behaviour, about fourteen hundred pixels down.
               *
               * A reviewer opening a feature is trying to see the product. Reading four paragraphs
               * before reaching a picture of it is reading a description of something you are not
               * being shown, and it is the whole reason this surface felt like a document.
               */
              /**
               * ⛔ THE PROTOTYPE IN ITS OWN FRAME AT THE TOP, DRAGGABLE AND HIDEABLE.
               *
               * Peter: *"let's fix the prototype to the top half of the screen in its own frame,
               * with the tab bars bottom half of the page"* — then, correcting himself: *"let's
               * actually make the prototype frame draggable up or hideable."*
               *
               * The second version is the right one and the reason is the content. A fixed half is
               * fine for a screen with eight controls and wrong for one with a long table under it:
               * judging a sentence needs the control in view, and judging thirty needs the list in
               * view, and those want different splits. ⛔ A fixed split would be the framework
               * deciding a ratio that depends on what is being read.
               *
               * So: a height, a divider that sets it, and a hide. Remembered in `localStorage`
               * because it is a reading posture and not a per-feature choice — being asked again on
               * every feature is the same as not being asked, which is the reasoning the nav
               * placement already runs on.
               */
              `<div class="proto-frame">
                 <div class="proto-scroll">${renderScreens(
                   corpus.scopes.find((x) => x.scope.id === g.scope)!.scope,
                   ctx,
                   g.scope,
                   opts,
                   corpus
                 )}</div>
                 <div class="proto-grip" role="separator" aria-orientation="horizontal" tabindex="0"
                      aria-label="Drag to resize the screen, or press the button to hide it">
                   <button type="button" class="proto-hide">
                     <span class="when-open">▴ hide the screen</span><span class="when-off">▾ show the screen</span>
                   </button>
                 </div>
               </div>`
            }
            ${
              /**
               * ⛔ NO STANDALONE PREFACE ON A FEATURE. Peter, reading create-deal: *"the 'what this
               * feature is for' is the overview, the preface seems to be unnecessary — should be
               * constructed from the confirmed truths, not a standalone section that may need to be
               * regenerated. Let's just remove the preface for now."*
               *
               * Four paragraphs of prose sat above "What this feature is for", saying the same
               * things: what it is, where it is reached from, what the form holds, what it does
               * not do. Each of those is a sentence somebody can AGREE to further down the page —
               * the purpose, the screens, the behaviours — and up here it was agreed to by nobody,
               * so the first thing a reviewer met was the one part of the page they could not act
               * on and could not trust.
               *
               * ⛔ AND IT IS THE "ONE HOME" RULE, which is the part worth keeping in mind if
               * somebody is tempted to put it back. A paragraph restating the behaviours is a
               * second copy with no forcing function: when a behaviour is reworded the paragraph
               * is not, nothing detects it, and a reader cannot tell which of the two is current.
               *
               * ⛔ CONTAINERS KEEP THEIRS, and that is not an inconsistency. A group has no
               * happy path and no behaviours of its own — prose is the only thing it can say about
               * itself, so there it is the single home rather than a duplicate of one.
               */
              ""
            }
            ${
              /**
               * ⛔ THREE TABS ON A FEATURE. Peter: *"let's add tabs here - 'why', 'success
               * measures', 'risks' can all be cards that are added in the 'overview' tab...
               * success measures and instrumentation should be in a 'Metrics' tab. the existing
               * table should be in the 'Behaviors' tab."*
               *
               * ⛔ THE SAME `sub-view` MECHANISM THE ROOT SCOPE ALREADY USES, not a second one. The
               * product's own tabs — goals, personas, voice — are built from it, and a feature
               * growing its own tab machinery would be two implementations of "which part of this
               * am I looking at", disagreeing the first time one gained a keyboard shortcut.
               */
              (() => {
                const sc = corpus.scopes.find((x) => x.scope.id === g.scope)!.scope;
                const cards = (list: "why" | "risk" | "measure" | "instrument", held: typeof sc.why) =>
                  held.map((c) => renderCard(corpus, g.scope, list, c, !!opts.interactive, address)).join("");
                /**
                 * ⛔ AN EMPTY SECTION IS A SUMMARY LINE, NOT FOUR INCHES OF YELLOW.
                 *
                 * A new feature has nothing in any of these four, so a reviewer met four warning
                 * blocks each saying "Nothing here says…" — more of the page than its content, in
                 * the colour reserved for things that are wrong, about a feature that is merely
                 * young. ⛔ The absence still has to be sayable: it is a real gap and somebody has
                 * to fill it. So it is a closed fold, one line, in the position its section would
                 * have had — the fact kept, the volume cut.
                 *
                 * ⛔ AND THE HEADING GOES INSIDE IT. A heading above a collapsed fold is two rows
                 * for one empty section, which is most of what was wrong with the four boxes.
                 */
                const filled = (heading: string, held: string) =>
                  `<h3 class="sub">${heading}</h3>${held}`;
                const none = (heading: string, what: string, how: string) =>
                  `<details class="owes-fold"><summary><span class="owes-head">${heading}</span> <span class="owes-tag">nothing written down</span></summary>
                     <p class="owes">Nothing here says ${what}. ${how}</p>
                   </details>`;
                /** ⛔ Inside the feature's view, so it appears and disappears with the feature. */
                /**
                 * ⛔ ITS OWN SCROLLER. Peter: *"let's just make it a full on frame - so scrolling
                 * the bottom frame is independent of the top."*
                 *
                 * Dragging the divider already set the prototype's height, but the PAGE still
                 * scrolled as one document — so scrolling down to row forty scrolled the screen you
                 * were judging against off the top, which is the thing a fixed frame was for. Two
                 * panes, each with its own scroll, and the view sized to the viewport so there is a
                 * bottom to scroll within.
                 */
                return `<div class="below">
                  <div class="subtabs own" data-tabs="${esc(g.scope)}">
                    <button type="button" class="subtab" data-sub="overview">Overview</button>
                    <button type="button" class="subtab" data-sub="metrics">Metrics${
                      /** ⛔ Named, like every other count — see the heading inside `renderBehaviours`. */
                      sc.measures.length || sc.instruments.length
                        ? ` <span class="pill quiet" title="${esc(
                            `${sc.measures.length + sc.instruments.length} measures and recordings`
                          )}">${sc.measures.length + sc.instruments.length}</span>`
                        : ""
                    }</button>
                    <button type="button" class="subtab" data-sub="behaviours">Behaviors${
                      /**
                       * ⛔ THE ONE OF THE THREE COUNTS THAT WAS ALREADY HONEST — this really is
                       * behaviours, and the heading inside now says so too rather than calling its
                       * sentences by this word.
                       */
                      sc.exchanges.length
                        ? ` <span class="pill quiet" title="${esc(
                            `${sc.exchanges.length} behaviour${sc.exchanges.length === 1 ? "" : "s"}`
                          )}">${sc.exchanges.length}</span>`
                        : ""
                    }</button>
                  </div>
                  <div class="sub-view" data-tabs="${esc(g.scope)}" data-sub-view="overview" data-ref="${esc(g.scope)}" data-label="Overview">
                  ${renderHappyPath(corpus, g.scope, ctx, decisionsOn(corpus, `${g.scope}#happy-path`))}
                  ${
                    sc.why.length
                      ? filled("Why this is worth building", cards("why", sc.why))
                      : none(
                          "Why this is worth building",
                          "what is wrong today",
                          "Every behaviour below is justified against a reason nobody has written down."
                        )
                  }
                  ${
                    sc.risks.length
                      ? filled("What could go wrong", cards("risk", sc.risks))
                      : none(
                          "What could go wrong",
                          "what could go wrong",
                          "A risk nobody wrote down is one nobody is watching for."
                        )
                  }
                </div>
                <div class="sub-view" data-tabs="${esc(g.scope)}" data-sub-view="metrics" data-ref="${esc(g.scope)}" data-label="Metrics">
                  ${
                    sc.measures.length
                      ? filled("How we would know it worked", cards("measure", sc.measures))
                      : none(
                          "How we would know it worked",
                          "how anybody would know this worked",
                          "Without one, nothing afterwards can be held against it."
                        )
                  }
                  ${
                    sc.instruments.length
                      ? filled("What gets recorded", cards("instrument", sc.instruments))
                      : none(
                          "What gets recorded",
                          "what gets recorded",
                          "A measure nothing records cannot be known."
                        )
                  }
                </div>
                <div class="sub-view" data-tabs="${esc(g.scope)}" data-sub-view="behaviours" data-ref="${esc(g.scope)}" data-label="Behaviors">
            ${
              /* ⛔ A leaf shows this only when it owns something. "Nothing holds everywhere in here"
                 on a feature with no children is noise, and noise is what stops the real blanks
                 being read. */
              [...homesOf.values()].includes(g.scope) ? renderGroupRules(corpus, g.scope, ctx, homesOf) : ""
            }
                  ${renderBehaviours(corpus, g.scope, cellOf, ctx, !!opts.interactive)}
                  <details class="fold"><summary>Every slot, and where each came from — the authoring view</summary>
                    ${renderGrid(g, ctx)}
                    ${renderExchanges(corpus, [g.scope], cellOf, ctx, false)}
                  </details>
                  </div>
                </div>`;
              })()
            }
          </section>`)
        )
        .join("")}
      ${
        /**
         * ⛔ A CONTAINER IS A PLACE YOU CAN STAND, AND IT LISTS WHAT IS BENEATH IT — it does not
         * repeat the subtree.
         *
         * Repeating would put the same behaviour in two views, which means two accept buttons with one
         * ref: pressing either leaves the other reading as un-agreed, and a reviewer cannot tell
         * which one counted. The listing is what a container actually has to say — a grouping's own
         * content is its children.
         */
        containerViews
          .map((id) => {
            const sc = corpus.scopes.find((s) => s.scope.id === id)!.scope;
            const kids = corpus.scopes.filter((x) => x.scope.in === id);
            /**
             * ⛔ A GROUP GETS THE SAME FRAME, AND NOT GIVING IT ONE IS WHY HE STILL COULD NOT SEE IT.
             *
             * Peter, after a 29-step drive of a FEATURE page reported everything working: *"still
             * don't see anything on the bottom half, still not moveable pane for the preview."*
             *
             * He was not on a feature. `/v2` with no hash lands on the product overview, and a
             * group — an area, the product itself — renders its own screens too. Neither had a
             * frame, so on either one there is a prototype you cannot move and no second pane at
             * all: exactly what he described, twice, while my drive passed on the one view that
             * worked.
             *
             * ⛔ The lesson is about the drive, not the layout: I navigated by clicking a leaf in
             * the nav, which is one of several ways in and the only one I tried. A surface verified
             * on the path the author happens to take is verified nowhere.
             */
            const framed = sc.views.some((v) => v.exists !== "withdrawn");
            if (!full(id)) return stub(id, anchorOf(id), plain(sc.title || id), framed);
            return marked(id, `<section class="view${framed ? " framed" : ""}" id="${anchorOf(id)}" data-view="${esc(id)}" data-ref="${esc(id)}" data-label="${esc(plain(sc.title || id))}">
              <h3 class="feature-title">${line(sc.title || id)}</h3>
              ${
                framed
                  ? `<div class="proto-frame">
                       <div class="proto-scroll">${renderScreens(sc, ctx, id, opts, corpus)}</div>
                       <div class="proto-grip" role="separator" aria-orientation="horizontal" tabindex="0"
                            aria-label="Drag to resize the screen, or press the button to hide it">
                         <button type="button" class="proto-hide">
                           <span class="when-open">▴ hide the screen</span><span class="when-off">▾ show the screen</span>
                         </button>
                       </div>
                     </div>`
                  : ""
              }
              <div class="below">
              ${renderProse(corpus.scopes.find((x) => x.scope.id === id)?.body ?? "")}
              ${renderGroupUx(corpus, id, ctx)}
              ${renderGroupRules(corpus, id, ctx, homesOf)}
              <h3 class="sub">What is filed under it</h3>
              <ul class="contents">${kids
                .map((k) => {
                  const under = descendants(corpus, k.scope.id);
                  const behaviours = under.reduce(
                    (n, d) => n + (corpus.scopes.find((x) => x.scope.id === d)?.scope.exchanges.length ?? 0),
                    0
                  );
                  const ready = a.acceptable.filter((r: string) => under.some((u) => r.startsWith(`${u}#`))).length;
                  return `<li><a href="${esc(ctx.url(k.scope.id))}" data-goto="${esc(k.scope.id)}">${line(
                    k.scope.title || k.scope.id
                  )}</a> <span class="n">${behaviours} behaviour${behaviours === 1 ? "" : "s"}${
                    ready ? ` · ${ready} ready to agree to` : ""
                  }</span></li>`;
                })
                .join("")}</ul>
              ${kids.length ? "" : `<p class="lede">Nothing is filed under this yet.</p>`}
              </div>
            </section>`);
          })
          .join("")
      }
      ${
        parked.length
          ? `<section class="questions parked-set">
               <h2>Parked</h2>
               <p class="lede">Read, deliberately not answered now, and still holes — no behaviour containing one can be built from.</p>
               ${parked.map((q, i) => renderQuestion(q, live.length + i, decisionsOn(corpus, q.ref), ctx)).join("")}
             </section>`
          : ""
      }
    </main>`;

  /**
   * One section and the drawings it needs, for the endpoint that serves what the page deferred.
   *
   * ⛔ THE WHOLE PAGE IS STILL COMPUTED AND MOST OF IT THROWN AWAY, deliberately. A section's
   * content depends on aggregates over the subtree — `cellOf`, `homesOf`, the resolved rules — and
   * recomputing a subset of those here would be a second derivation of the same facts, which is
   * the one thing this repo is most consistent about refusing. With `only` holding a single view
   * the expensive part, every OTHER section's body, is not built at all.
   *
   * ⛔ AND IT CARRIES ITS OWN MOCKS. The bank is built from what the markup references, so a page
   * that deferred a section never banked that section's drawings — they arrive with it, and the
   * client adds them to the bank before hydrating.
   */
  if (opts.fragment) {
    const open = `<!--s:${opts.fragment}-->`;
    const shut = `<!--/s:${opts.fragment}-->`;
    const from = body.indexOf(open);
    const to = body.indexOf(shut, from);
    if (from === -1 || to === -1) return null;
    const section = body.slice(from + open.length, to);
    return `${section}${mockBank(corpus, ids, protoScreens, section, scopeId)}`;
  }

  return `${STYLE}${body}${appCssOnce(opts)}${mockBank(corpus, ids, protoScreens, body, scopeId)}${partFacts(corpus, ids)}${renderNotePanel(corpus, ids, opts)}${VIEW_SWITCH}${opts.interactive ? DEFER : ""}${opts.interactive && servedUnderProject(opts.linkBase) ? CONNECT : ""}${DIM_FILTER}${NAV_PLACE}${COPY_REF}${PROTO_FRAME}${PROTOTYPE}${DRIVE}${opts.interactive ? liveScript(opts) : INERT}`;
}



/**
 * ⛔ EVERYTHING BELOW THIS LINE IS INSIDE A TEMPLATE LITERAL, SO NO BACKTICKS — not in code and
 * not in a comment. A backtick here ends the string mid-script and the build fails somewhere else
 * entirely. That has cost five builds in this file; the same warning sits above the CSS block.
 */
/**
 * ⛔ EMITTED ONLY WHERE THERE IS A SERVER TO ASK, decided here rather than guarded at runtime.
 *
 * A runtime guard still ships the code. In a published page — no server, nothing to connect to —
 * a live indicator that can never light reads as "nothing has changed", which is the precise false
 * reassurance this mechanism exists to remove. So absence is the honest state there, and the page
 * says where it records instead.
 */
const FOLLOWS_THE_TRUTH = `/**
 * ⛔ THE PAGE FOLLOWS THE TRUTH, so this is one interface rather than three.
 *
 * A press already writes to the corpus and a watcher already tells whoever is working — but when
 * the truth changed underneath, the page went on showing the old one until somebody reloaded by
 * hand. That reload is the seam a person feels as "I have to go and check".
 *
 * ⛔ IT JUST UPDATES. Peter: *"6 changes to the truth under this page {show it} - unnecessary, just
 * live update as we go..."*
 *
 * It used to count the changes and offer a button. That was one seam replaced by a smaller one: the
 * page knew it was out of date, said so, and still showed the old truth until somebody pressed
 * something. A bar whose only possible answer is "yes, show me the correct page" is a question not
 * worth asking.
 *
 * ⛔ EXCEPT OVER WORDS SOMEBODY HAS TYPED, which is the one thing this surface must never lose.
 * Reloading under a half-written reason would destroy it, so a change waits while anything holds
 * unsent text and applies the moment it does not. ⛔ And "typed" is not "focused": a person can
 * write a reason and then click away to re-read the sentence, which leaves their words in a form
 * with nothing focused — the first version of this guard checked activeElement alone and would
 * have thrown those away.
 */
if (typeof EventSource !== "undefined") {
  /**
   * ⛔ THE BOTTOM BARS STACK; THEY DO NOT SIT ON EACH OTHER OR ON THE COMPOSER.
   *
   * Both of these are fixed to the bottom, and so is the box a person types a request into. Left to
   * z-index they covered its Send button — so the surface announced "nobody is working on this"
   * while making it impossible to say anything about it, which is the worst possible pairing. Same
   * defect as the change bar over the top nav, found the same way: by driving the page.
   */
  const bottom = document.createElement("div");
  bottom.className = "bottom-bars";
  document.body.appendChild(bottom);
  const stale = document.createElement("div");
  stale.className = "stale-bar";
  stale.hidden = true;
  bottom.appendChild(stale);
  /**
   * ⛔ A PRESS INTO NOTHING LOOKS EXACTLY LIKE A PRESS SOMEBODY PICKED UP.
   *
   * If no session is open, a request sits — possibly for days — and this page said the same thing it
   * says when somebody authors it within the second. They press three more times and then stop
   * trusting the surface. So: whether anybody is working, and how much is waiting.
   *
   * ⛔ It is not a promise about response time. It is the difference between a queue and a void.
   */
  const who = document.createElement("div");
  who.className = "who-bar";
  who.hidden = true;
  bottom.appendChild(who);
  /**
   * ⛔ A WAY TO SAY A FRAMEWORK ASK IS DEALT WITH, WHERE HE ASKED IT.
   *
   * Peter: *"there should be a way for you to acknowledge POS things are taken care of, make an
   * expandable bar, and send a message indicating a particular piece is taken care of"*.
   *
   * He had the opposite of this an hour earlier — a full thread above the composer — and had it
   * removed: *"the history of messages on a screen is unnecessary"*. The difference is the shape,
   * not the content. A log occupies the page whether or not anything happened; a bar that says
   * "3 dealt with" and opens when pressed costs one line until somebody wants the detail.
   *
   * ⛔ ONLY FRAMEWORK ASKS, AND ONLY CLOSED ONES. This is an acknowledgement surface, not a second
   * inbox: a corpus request is answered by the truth changing, which the page already shows by
   * being different. What has no other evidence is a framework ask — the code changed somewhere he
   * cannot see, and "it is done" is the whole of what he needs back.
   */
  /**
   * ⛔ THIS SCRIPT'S OWN ESCAPE, AND IT IS HERE BECAUSE I MADE THE MISTAKE TWICE.
   *
   * The shared escape belongs to the DRIVE script's scope. The thread panel used it from here an
   * hour earlier,
   * threw a ReferenceError mid-render, and showed nothing at all — which looks exactly like having
   * no data. Then the acknowledgement bar did the same thing: a count that rendered and a list that
   * silently did not. A helper with a name of its own is harder to reach for by habit.
   */
  const safely = (x) =>
    String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /**
   * ⛔ A CHIP ON THE COMPOSER'S OWN ROW, NOT A BAR OF ITS OWN. Peter: *"make this just a chip inline
   * with the send button, showing '8', and clicking it will expand it."*
   *
   * It was a second fixed bar carrying "8 framework asks dealt with" — two lines of frame under
   * every page to say what one number says. The list still opens, above the composer, where there
   * is room for it; what it no longer does is occupy the page when nobody has asked.
   */
  const acks = document.createElement("div");
  acks.className = "ack-panel";
  acks.hidden = true;
  const chip = document.getElementById("ack-chip");
  const bar = document.getElementById("note-bar");
  if (bar) bar.insertBefore(acks, bar.firstChild);
  let acksOpen = false;

  const paintAcks = (done) => {
    if (!chip) return;
    if (!done.length) { chip.hidden = true; acks.hidden = true; acks.innerHTML = ""; fit(); return; }
    const n = done.length;
    chip.hidden = false;
    chip.textContent = String(n);
    /* ⛔ "framework" was wrong the moment corpus requests started being answered the same way. */
    chip.title = n + (n === 1 ? " request" : " requests") + " dealt with — press to read what was done";
    chip.classList.toggle("on", acksOpen);
    acks.innerHTML = acksOpen
      ? '<ul class="ack-list">' +
        done
          .map(
            (d) =>
              "<li><strong>" + safely(d.says.replace(/^\s*pos\s*:\s*/i, "")) + "</strong>" +
              (d.outcome ? '<span class="ack-what">' + safely(d.outcome) + "</span>" : "") +
              /**
               * ⛔ WHEN, AND WHO ASKED — because without them this is a ticker and the question it
               * gets asked is "was this ever dealt with", which needs a date beside it.
               */
              '<span class="ack-when">' + safely(d.by || "") + (d.at ? " · " + safely(d.at) : "") + "</span>" +
              "</li>"
          )
          .join("") +
        "</ul>"
      : "";
    acks.hidden = !acksOpen;
    fit();
  };
  if (chip)
    chip.addEventListener("click", () => {
      acksOpen = !acksOpen;
      paintAcks(lastAcks);
    });

  let lastAcks = [];
  const askAcks = () =>
    fetch(UNDER + "/api/v2/thread")
      .then((r) => r.json())
      .then((b) => {
        /*
         * ⛔ EVERY ANSWERED REQUEST, NOT THE FRAMEWORK ONES. This filtered on
         * kind === "framework", and every request Peter has ever filed is kind: corpus — so he had
         * four answered requests and this showed him none of them.
         *
         * Peter: "and we should have a history available of requests that were answered...". The
         * data was never the problem: a closed note keeps state: done and the outcome saying what
         * was actually done, precisely so the queue is not "a list nobody trusts". It was the
         * surface, built as a ticker for pos: replies and never widened when corpus requests
         * started being answered the same way.
         *
         * ⛔ AND THE CAP IS GONE. The old comment read "this is an acknowledgement, not an
         * archive" — a fair description of a ticker and the wrong thing to want. A history that
         * silently forgets the ninth answer cannot tell you whether something was ever dealt with,
         * which is the only question it gets asked.
         *
         * ⛔ NO BACKTICKS IN HERE. This whole block is inside a template literal, so one ends the
         * string and the build fails three lines later with a missing comma.
         */
        lastAcks = (b.notes || [])
          .filter((x) => x.state === "done")
          .reverse();
        paintAcks(lastAcks);
      })
      .catch(() => {});
  askAcks();
  setInterval(askAcks, 30000);

  /**
   * ⛔ The document-level handler for the old ack-head button went with the bar it opened. A listener for
   * an element nothing renders is the kind of code that looks like a feature when somebody reads it.
   */

  const askWho = () =>
    fetch(UNDER + "/api/v2/presence")
      .then((r) => r.json())
      .then((p) => {
        const n = p.waiting || 0;
        if ((p.working || []).length || !n) { who.hidden = true; fit(); return; }
        who.textContent =
          "Nobody is working on this right now — " + n + (n === 1 ? " request is" : " requests are") +
          " waiting. They are recorded and will be picked up; nothing has been lost.";
        who.hidden = false;
        fit();
      })
      .catch(() => { who.hidden = true; fit(); });
  askWho();
  setInterval(askWho, 20000);
  let heard = Date.now();
  let pending = 0;
  /**
   * ⛔ ANYTHING UNSENT, NOT JUST WHAT IS FOCUSED. A reason typed and then clicked away from is still
   * a reason somebody wrote, and it is sitting in a form with nothing focused.
   */
  const unsent = () => {
    for (const el of document.querySelectorAll("form.act-form input, form.act-form textarea, #note-bar textarea"))
      if ((el.value || "").trim().length) return true;
    const el = document.activeElement;
    return !!el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT") && (el.value || "").trim().length > 0;
  };
  /**
   * ⛔ IT MOVES THE PAGE DOWN; IT DOES NOT SIT ON TOP OF IT.
   *
   * Fixed to the top of the viewport, this bar covered the frame — the tabs, the breadcrumb, and
   * the control that moves the menu. So the moment the truth changed, every way of navigating the
   * page stopped responding to clicks, and nothing said why. It was found by driving the page and
   * watching a click time out against "live-bar intercepts pointer events"; nobody reading the CSS
   * would have seen it, because both rules are correct on their own.
   *
   * ⛔ Measured rather than assumed. A guessed height is right until the text wraps on a narrow
   * window, and then the bar covers the tabs again on exactly the screens with least room.
   */
  const fit = () => {
    // ⛔ Measured, not assumed: these wrap to two lines on a narrow window, which is exactly where
    // there is least room and most to cover.
    document.documentElement.style.setProperty("--bottom-h", bottom.offsetHeight + "px");
  };
  // ⛔ Registered here, after fit() exists. Above the declaration it is a temporal-dead-zone throw
  // that kills this whole block — and with it the stream, the change bar and the presence bar, on a
  // page that otherwise looks perfectly fine. That is exactly how it failed once.
  window.addEventListener("resize", fit);
  /**
   * ⛔ COME BACK TO THE SAME VIEW AND THE SAME PLACE IN IT. This mattered when a reload was asked
   * for; it matters far more now that one happens on its own — a page that silently jumps to the
   * top mid-review is worse than the bar it replaced.
   */
  /**
   * ⛔ SWAP WHAT CHANGED, DO NOT RELOAD THE PAGE. Peter: *"table should refresh dynamically and not
   * do the screen reload thing."*
   *
   * A reload was already careful — it saved the view and the scroll position and put you back. It
   * still threw away everything else: which rows you had opened, where the horizontal scroll of a
   * wide table was, a prototype you had walked three states into. And it flashed, which on a page
   * you press twenty times is twenty flashes.
   *
   * So: fetch the same URL, parse it, and replace the inside of each data-sync region. The
   * regions are the parts that can change as a result of a press — the behaviour tables.
   *
   * ⛔ RELOAD IS STILL THE FALLBACK, and that matters more than the refresh. If the fetch fails or
   * the new document has no matching region, the page must not go on showing truth that moved: a
   * stale page with nothing saying so is the one failure a reader cannot detect for themselves.
   */
  const reload = () => {
    pending = 0;
    const view = [...document.querySelectorAll("section.view")].find((v) => !v.hidden);
    try {
      sessionStorage.setItem("productos-at", JSON.stringify({ view: view && view.dataset.view, y: window.scrollY }));
    } catch (e) {}
    location.reload();
  };

  const apply = async () => {
    pending = 0;
    try {
      const res = await fetch(location.pathname + location.search, { headers: { "cache-control": "no-cache" } });
      if (!res.ok) return reload();
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const mine = [...document.querySelectorAll("[data-sync]")];
      /*
       * ⛔ A PAGE WITH NOTHING TO SYNC MUST NOT RELOAD. Peter: *"something constantly causes my
       * screen to reload and i go back to 'overview'"*.
       *
       * This reloaded, on the reasoning below that a stale page is worse than a flash. True of a page
       * that WOULD show the change — and the product's own page has no behaviour table at all, so it
       * has none of these regions and reloaded on every change anybody made anywhere. Including the
       * board he was standing on while I wrote three prototype assignments into his corpus from a
       * terminal: three reloads, each one putting him back on Overview.
       *
       * ⛔ AND SAYING SO IS NOT OPTIONAL — the rule it is bending is real. A page cannot quietly go on
       * showing truth that moved, so it says it moved and offers the refresh. The reader keeps their
       * place and decides; what they lose is the flash, not the warning.
       */
      /*
       * ⛔ A PAGE WITH NO SYNCABLE REGION UPDATES ITSELF — IT DOES NOT RELOAD, AND IT DOES NOT ASK.
       *
       * Peter: *"something constantly causes my screen to reload and i go back to 'overview'"*. His
       * page has ZERO of these regions: 130 views, and sections that large are deferred to stubs,
       * which is what removes them from the delivered document. So the fallback fired on every change
       * anybody made anywhere — three prototype writes of mine, three reloads of the page he was
       * standing on.
       *
       * ⛔ AND THE FIRST FIX I WROTE FOR THIS WAS A BAR SAYING "SOMETHING CHANGED · SHOW IT", WHICH HE
       * HAS ALREADY REFUSED: *"6 changes to the truth under this page {show it} - unnecessary, just
       * live update as we go..."*. A bar whose only possible answer is "yes, show me the correct page"
       * is a question not worth asking, and I nearly shipped it back a week later. Merging main is
       * what caught it — the comment recording his words was four hundred lines from mine.
       *
       * So it live-updates: the view a person is looking at is replaced from the fetched document.
       * ⛔ Only the visible one, because swapping sixty would undo every deferred stub the page has
       * loaded, and ⛔ the mock figures are re-filled exactly as the region swap below re-fills them.
       */
      if (!mine.length) {
        const here = [...document.querySelectorAll("section.view")].find((v) => !v.hidden);
        const fresh = here && doc.querySelector('section.view[data-view="' + CSS.escape(here.dataset.view) + '"]');
        /** ⛔ Reload rather than lie, still — if the view cannot be found, the page must not go stale. */
        if (!here || !fresh) return reload();
        here.innerHTML = fresh.innerHTML;
        if (window.fillCardScreen)
          for (const f of here.querySelectorAll("figure.card-screen")) window.fillCardScreen(f);
        return;
      }
      let swapped = 0;
      for (const region of mine) {
        const fresh = doc.querySelector('[data-sync="' + CSS.escape(region.dataset.sync) + '"]');
        if (!fresh) continue;
        /** ⛔ Which rows were open is the reader's place in the table, so it survives the swap. */
        const open = new Set([...region.querySelectorAll("tr.beh.open")].map((r) => r.dataset.ref));
        region.innerHTML = fresh.innerHTML;
        for (const ref of open) {
          const row = region.querySelector('tr.beh[data-ref="' + CSS.escape(ref) + '"]');
          const detail = region.querySelector('tr.beh-detail[data-for="' + CSS.escape(ref) + '"]');
          if (row && detail) {
            detail.hidden = false;
            row.classList.add("open");
            if (window.fillCardScreen)
              for (const f of detail.querySelectorAll("figure.card-screen")) window.fillCardScreen(f);
          }
        }
        swapped++;
      }
      /** ⛔ Nothing swapped means this page does not show what changed — reload rather than lie. */
      if (!swapped) reload();
    } catch (e) {
      reload();
    }
  };
  /** ⛔ Same boundary as the card filler: the acts script records a press and needs to refresh. */
  window.refreshNow = apply;

  /**
   * ⛔ THE CONNECTION IS REOPENABLE, BECAUSE IT DIED ONCE AND COULD NOT COME BACK.
   *
   * On 2026-10-13, 11:22 → 13:29, every read 500'd. This page detected it and said so truthfully —
   * and then had no way to un-break itself: no 'error' handler, no 'readyState' check, nothing on
   * tab focus. The banner's elapsed time climbed for hours with a working stream one reload away.
   *
   * ⛔ AND "EventSource RETRIES BY ITSELF" IS NOT TRUE OF WHAT HAPPENED. Its automatic retry covers
   * a DROPPED connection. A non-2xx response is a different thing: the spec fails the connection,
   * sets readyState to CLOSED and fires 'error' with no retry. So the FIRST 500 killed it, and
   * the remaining two hours of outage changed nothing.
   */
  let es = null;
  let reopenIn = 2000;
  let reopenTimer = null;
  /** ⛔ So the staleness timer cannot turn a long outage into a reconnect every 15 seconds. */
  let reopening = false;

  const onChanged = () => {
    heard = Date.now();
    stale.hidden = true;
    // ⛔ Straight away, not on the next tick: filing a request is exactly when they want to know.
    askWho();
    pending++;
    if (!unsent()) apply();
  };

  const connect = () => {
    if (reopenTimer) clearTimeout(reopenTimer);
    reopenTimer = null;
    reopening = false;
    try {
      if (es) es.close();
    } catch (e) {}
    es = new EventSource(UNDER + "/api/v2/live");
    es.addEventListener("changed", onChanged);
    es.addEventListener("beat", onBeat);
    /** A stream that opened is a stream that works — start the next backoff from the floor. */
    es.addEventListener("open", () => {
      reopenIn = 2000;
    });
    es.addEventListener("error", () => {
      /**
       * ⛔ ONLY WHEN IT IS CLOSED. readyState 0 is CONNECTING, which means the browser IS
       * retrying — opening a second stream alongside it would double every beat and leak a
       * connection per blip.
       */
      if (!es || es.readyState !== 2) return;
      reopenAfter(reopenIn);
      reopenIn = Math.min(reopenIn * 2, 60000);
    });
  };

  const reopenAfter = (ms) => {
    if (reopening) return;
    reopening = true;
    if (reopenTimer) clearTimeout(reopenTimer);
    reopenTimer = setTimeout(connect, ms);
  };

  /** ⛔ Dead OR never opened. A first connection that 500'd leaves es CLOSED, not absent. */
  const healIfDead = () => {
    if (!es || es.readyState === 2) connect();
  };
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) healIfDead();
  });
  window.addEventListener("online", healIfDead);

  /**
   * ⛔ A PAGE THAT HAS SILENTLY STOPPED FOLLOWING IS THE ONE FAILURE A READER CANNOT DETECT.
   *
   * It is indistinguishable from a page where nothing has happened — and they will go on pressing
   * against truth that moved half an hour ago. So the stream says "still here" on a timer, and this
   * says so out loud when it stops hearing it. How long since it last heard, because "disconnected"
   * with no duration does not tell a reader whether to trust what is on the screen.
   */
  const onBeat = () => {
    heard = Date.now();
    stale.hidden = true;
    fit();
  };
  /** ⛔ After the handlers exist, or connect attaches undefined. */
  connect();
  /**
   * ⛔ THE HELD CHANGE IS NOT DROPPED. Without this, a change that arrives while somebody is typing
   * waits forever — and that is the old failure exactly: a page showing truth that moved, with
   * nothing saying so, which is the one state a reader cannot detect.
   */
  setInterval(() => {
    if (pending && !unsent()) apply();
  }, 1500);
  setInterval(() => {
    const since = Math.round((Date.now() - heard) / 1000);
    // Two missed beats, not one — a single late beat is a slow network, not a dead stream.
    if (since < 60) return;
    fit();
    /**
     * ⛔ THE ONLY THING THAT CAN SEE A HALF-OPEN CONNECTION. A TCP connection dropped without a
     * FIN leaves readyState reporting OPEN forever while nothing arrives — so 'error' never
     * fires and healIfDead sees a healthy stream. The missing beat is the sole evidence, which
     * is what this timer already noticed and did nothing about.
     */
    reopenAfter(0);
    stale.textContent =
      "Not following any more — nothing heard for " +
      (since < 120 ? since + "s" : Math.round(since / 60) + " min") +
      ". Trying to reconnect. What is on this page may already be out of date.";
    stale.hidden = false;
    fit();
  }, 15000);
  // Restore where they were, after a reload they asked for.
  try {
    const back = JSON.parse(sessionStorage.getItem("productos-at") || "null");
    if (back) {
      sessionStorage.removeItem("productos-at");
      /*
       * ⛔ THE SWITCHER, NOT A MENU LINK. See the showView comment for what clicking a link could not
       * restore: every tab, and the feature you were already on.
       */
      if (back.view) {
        if (window.showView) window.showView(back.view);
        else {
          const go = document.querySelector('nav.scopes a[data-goto="' + CSS.escape(back.view) + '"]');
          if (go) go.click();
        }
      }
      if (typeof back.y === "number") window.scrollTo(0, back.y);
    }
  } catch (e) {}
}`;

/**
 * What the page deferred, fetched as it is actually wanted.
 *
 * ⛔ A SMALLER PAGE THAT DOES NOT WORK IS WORSE THAN THE BIG ONE. This is the half that makes the
 * 39x reduction a reduction rather than a page of empty panels: 72 stub sections and 128 blank
 * thumbnails, each of which knows what it is missing and asks for it.
 *
 * ⛔ IT DOES NOT ADD A PRESS ANYWHERE. Sections were already one press apart — `VIEW_SWITCH` sets
 * `hidden` on every section but one — and thumbnails load on scroll the way any other web app
 * loads images. What a reviewer has to do to see a thing is exactly what it was.
 *
 * ⛔ AND IT IS ONLY EMITTED ON A LIVE PAGE, which the suite caught me getting wrong. A read-only
 * render must have NO CHANNEL OUT — `v2-page` asserts it contains no `fetch(` at all — and that is a
 * stronger guarantee than "it would find nothing to do". A standalone file is rendered with
 * everything anyway, so there is nothing for it to fetch; shipping a script that could is the
 * defect, not shipping one that does.
 */
const DEFER = `<script>
(function () {
  /**
   * ⛔ FROM THE ADDRESS BAR, NOT FROM A LINK. The first version read the prefix off the first nav
   * anchor, and every one of those is an in-page hash — so the match failed and the prefix was
   * empty, which happens to be right locally and wrong on the hosted instance, where the whole
   * thing is served under a path. Found by printing it rather than by it breaking.
   */
  const under = (function () {
    const m = location.pathname.match(/^(.*?)\\/v2(?:\\/|$)/);
    return m ? m[1] : "";
  })();
  const bankEl = document.getElementById("mock-bank");
  const ROOT = (bankEl && bankEl.getAttribute("data-root")) || "";

  /**
   * ⛔ CSS.escape IS FOR AN IDENTIFIER, NOT FOR THE INSIDE OF A QUOTED ATTRIBUTE VALUE — and every
   * ref in this model contains a #.
   *
   * CSS.escape("thing-2#thing-2-screen-1") returns thing-2\\#thing-2-screen-1, which is right for
   * a selector like #id and wrong inside [data-mock="..."]: the quotes already make it a string, so
   * the backslash is matched literally and the selector finds nothing. The bank held the drawing,
   * the host named it, and the lookup returned null every time — 22 thumbnails fetched correctly
   * and left blank, with no error anywhere.
   *
   * ⛔ FOUND BY READING ONE INSTANCE. The aggregates all agreed and all looked plausible: templates
   * in the bank went up, lazy hosts went down, hydrated stayed at zero. Three probes counted
   * different things before one of them asked what the selector actually was.
   *
   * In a quoted value only a backslash and the quote itself need escaping.
   */
  /**
   * Find a node by what an attribute equals, without building a selector.
   *
   * ⛔ NO SELECTOR, BECAUSE ESCAPING ONE CORRECTLY HERE IS TWO MISTAKES DEEP AND I MADE BOTH.
   *
   * First CSS.escape, which is for an IDENTIFIER: every ref in this model contains a #, and
   * CSS.escape turns it into a backslash-# that is matched literally inside [data-mock="..."] —
   * where the quotes already make the value a string. The bank held the drawing, the host named it,
   * and the lookup returned null every time. 22 thumbnails fetched correctly and stayed blank, with
   * no error anywhere.
   *
   * Then a hand-written escaper, which was correct JavaScript and wrong HERE: this script is a
   * TypeScript template literal, so every backslash in it is halved on the way out and the emitted
   * regex was invalid. The script threw before defining anything.
   *
   * Comparing the attribute removes both. A linear scan of a few hundred templates costs nothing
   * next to the request that fetched them.
   */
  const byAttr = (within, tag, attr, value) => {
    if (!within || value == null) return null;
    for (const el of within.querySelectorAll(tag)) if (el.getAttribute(attr) === value) return el;
    return null;
  };


  /**
   * Turn fetched markup into nodes, WITH its shadow roots.
   *
   * ⛔ A DECLARATIVE SHADOW ROOT IS A PARSER FEATURE, AND innerHTML IS NOT THE PARSER. Every screen
   * on this page is wrapped by asMock as <template shadowrootmode="open">, which the HTML parser
   * turns into a real shadow root as the document loads. Assigning the same markup through
   * innerHTML leaves an inert <template> and no root at all — so a fetched section arrived with
   * four templates and nothing visible, while the markup was byte-for-byte correct.
   *
   * ⛔ THIS IS WHY THE TEST DRIVES A BROWSER. An assertion over the returned HTML passes here, and
   * jsdom neither implements declarative shadow DOM nor resolves the cascade that would show the
   * result — both would have reported this working.
   *
   * setHTMLUnsafe is the API that runs the parser path. The fallback walks the templates and
   * attaches each root by hand, which is what the browsers without it need.
   */
  function adopt(html) {
    const box = document.createElement("div");
    if (typeof box.setHTMLUnsafe === "function") {
      box.setHTMLUnsafe(html);
      return box;
    }
    box.innerHTML = html;
    for (const t of [...box.querySelectorAll("template[shadowrootmode]")]) {
      const host = t.parentElement;
      if (!host || host.shadowRoot) continue;
      try {
        host.attachShadow({ mode: t.getAttribute("shadowrootmode") === "closed" ? "closed" : "open" }).appendChild(
          t.content.cloneNode(true)
        );
        t.remove();
      } catch {
        /* a host that cannot take a shadow root keeps the template, which is what it had before */
      }
    }
    return box;
  }

  /* ------------------------------------------------------------------ sections */

  const pending = new Map();

  async function fill(section) {
    const view = section.getAttribute("data-defer");
    if (!view) return section;
    if (pending.has(view)) return pending.get(view);

    const job = (async () => {
      const note = section.querySelector(".deferred-note");
      try {
        const r = await fetch(under + "/api/v2/section?scope=" + encodeURIComponent(ROOT) + "&view=" + encodeURIComponent(view), {
          headers: { accept: "text/html" },
        });
        if (!r.ok) throw new Error("the server answered " + r.status);
        const html = await r.text();
        const box = adopt(html);
        /**
         * ⛔ THE DRAWINGS THAT CAME WITH IT GO TO THE BANK, NOT INTO THE SECTION. Everything that
         * shows a screen clones from one copy; a second copy living inside a section is the
         * duplication this whole change removed.
         */
        const bank = document.getElementById("mock-bank");
        if (bank) for (const t of [...box.querySelectorAll('template[data-mock]')]) {
          if (!byAttr(bank, "template", "data-mock", t.getAttribute("data-mock"))) bank.appendChild(t);
          else t.remove();
        }
        const fresh = box.querySelector("section.view");
        if (!fresh) throw new Error("the server sent no section");
        /** Keep whether it is showing — the reader may already be looking at this panel. */
        fresh.hidden = section.hidden;
        section.replaceWith(fresh);
        return fresh;
      } catch (e) {
        /**
         * ⛔ A FAILURE SAYS SO AND OFFERS THE RETRY. An empty panel is indistinguishable from a
         * feature with nothing in it, which is the one reading a reviewer must never be handed.
         */
        if (note) {
          note.className = "deferred-note failed";
          note.textContent = "This part of the page could not be loaded — " + (e && e.message ? e.message : "no answer") + ". ";
          const again = document.createElement("button");
          again.type = "button";
          again.textContent = "Try again";
          again.addEventListener("click", () => { pending.delete(view); fill(section); });
          note.appendChild(again);
        }
        pending.delete(view);
        return section;
      }
    })();
    pending.set(view, job);
    return job;
  }

  /**
   * ⛔ BEFORE THE SWITCH, NOT AFTER IT. show() looks for a section whose data-view matches and
   * reveals EVERY section when it finds none — so switching to a stub that is mid-replacement could
   * flash the whole corpus onto one scroll. Filling it first means show only ever sees the real one.
   */
  const stubFor = (name) => byAttr(document, "section.view", "data-defer", name);

  document.addEventListener("click", (ev) => {
    for (const el of ev.composedPath ? ev.composedPath() : [ev.target]) {
      if (!(el instanceof Element) || !el.getAttribute) continue;
      /**
       * ⛔ A TAB IS A WAY IN TOO, AND IT WAS NOT ON THIS LIST. One attribute is a menu row; the other
       * is the row of areas across the top of the frame, which is how most people reach a section at
       * all. Choosing Product filled nothing and said "Loading this…" indefinitely.
       */
      const name = el.getAttribute("data-goto") || el.getAttribute("data-tab");
      if (!name) continue;
      const stub = stubFor(name);
      if (stub) fill(stub);
      return;
    }
  }, true);

  /** The hash is the other way in, including arriving with one and pressing back. */
  const fromHash = () => {
    const h = location.hash.replace(/^#/, "");
    if (!h) return;
    const stub = stubFor(h) || [...document.querySelectorAll("section.view[data-defer]")].find((s) => s.id === h);
    if (stub) fill(stub);
  };
  addEventListener("hashchange", fromHash);
  fromHash();

  /** And whatever is showing on arrival, if the server deferred it anyway. */
  for (const s of document.querySelectorAll("section.view[data-defer]")) if (!s.hidden) fill(s);

  /**
   * ⛔ AND ANYTHING THAT BECOMES VISIBLE, HOWEVER IT GOT THERE.
   *
   * Peter: *"Loading this…"* — on the Product tab, forever. Not slow: nothing was ever fetched. The
   * three triggers above are a list of ENTRY POINTS — a menu press, a hash, and whatever was
   * showing at boot — and the tab row is a fourth one nobody added. A tab carries its own attribute, so
   * choosing Product revealed the stub and no code anywhere asked for its content. No request, no
   * failure, no retry button: the one state the error handling below cannot reach, because it only
   * runs when a fetch was attempted.
   *
   * ⛔ SO THE TRIGGER BECOMES THE INVARIANT RATHER THAN A LONGER LIST. "A deferred section that is
   * visible gets filled" is the thing that was always meant; enumerating the ways a section can
   * become visible is how this was wrong, and would be wrong again at the next new way in.
   *
   * ⛔ The entry points above stay, and that is deliberate — they fill BEFORE the switch, which is
   * what stops a half-replaced section flashing. This is the backstop, not the mechanism.
   */
  if (typeof MutationObserver !== "undefined") {
    const watcher = new MutationObserver((changes) => {
      for (const c of changes) {
        const el = c.target;
        if (el instanceof Element && el.matches("section.view[data-defer]") && !el.hidden) fill(el);
      }
    });
    for (const s of document.querySelectorAll("section.view[data-defer]"))
      watcher.observe(s, { attributes: true, attributeFilter: ["hidden"] });
  }

  /* -------------------------------------------------------------- thumbnails */

  /**
   * ⛔ ONE REQUEST FOR A BATCH. The map on Overview is every screen in the product — a request each
   * would be 128 of them on one scroll.
   */
  const waiting = new Set();
  let flushing = null;

  async function flush() {
    flushing = null;
    const refs = [...waiting].slice(0, 60);
    if (!refs.length) return;
    for (const r of refs) waiting.delete(r);
    try {
      const r = await fetch(under + "/api/v2/mocks?refs=" + encodeURIComponent(refs.join(",")), { headers: { accept: "text/html" } });
      if (!r.ok) throw new Error(String(r.status));
      const box = adopt(await r.text());
      const bank = document.getElementById("mock-bank");
      if (bank) for (const t of [...box.querySelectorAll("template[data-mock]")]) bank.appendChild(t);
      /**
       * ⛔ THE TEMPLATE GOES INTO THE HOST, WHICH IS THE MARKUP THE PAGE ALWAYS HAD.
       *
       * The first version set data-mock and left the host empty, trusting the sweep to find the
       * drawing in the bank. Driven in a browser, the fetch succeeded, the bank filled, the host
       * was pointed at it — and no shadow root ever appeared. Rather than keep bisecting another
       * script to find out why, this hands the ordinary path exactly what it has always consumed: a
       * host with a template inside it. The clone is made here, on the client, so the wire still
       * carries one copy — which was the whole point — and there is still only ONE piece of code
       * that turns a template into a shadow root. The file already warns what two of those cost.
       */
      for (const ref of refs) {
        const src = byAttr(document.getElementById("mock-bank"), "template", "data-mock", ref);
        if (!src) continue;
        for (const host of document.querySelectorAll("[data-mock-lazy]")) {
          if (host.getAttribute("data-mock-lazy") !== ref) continue;
          if (!host.querySelector("template")) {
            const tpl = document.createElement("template");
            tpl.innerHTML = src.innerHTML;
            host.appendChild(tpl);
          }
          host.setAttribute("data-mock", ref);
          host.removeAttribute("data-mock-lazy");
        }
      }
    } catch {
      /** ⛔ Put them back rather than lose them — a thumbnail that never retries is a blank tile. */
      for (const r of refs) waiting.add(r);
    }
    if (waiting.size) flushing = setTimeout(flush, 400);
  }

  /**
   * Make sure one drawing is in the bank, fetching it if nobody has scrolled past it yet.
   *
   * ⛔ THE BOARD AND THE WALK OPEN A SCREEN THE READER NEVER SCROLLED TO. A tile loads its own
   * thumbnail on scroll, but pressing a tile opens that screen big, and the walk jumps to screens
   * anywhere in the product — neither of which is preceded by the thumbnail coming into view. Those
   * two paths read the bank directly, so without this they would open an empty stage, which is the
   * review surface getting worse in exactly the way PT-0007 warned about.
   */
  window.__posEnsureMock = async function (ref) {
    const bank = document.getElementById("mock-bank");
    if (!bank || !ref) return null;
    const have = byAttr(bank, "template", "data-mock", ref);
    if (have) return have;
    const r = await fetch(under + "/api/v2/mocks?refs=" + encodeURIComponent(ref), { headers: { accept: "text/html" } });
    if (!r.ok) return null;
    const box = adopt(await r.text());
    for (const t of [...box.querySelectorAll("template[data-mock]")]) bank.appendChild(t);
    return byAttr(bank, "template", "data-mock", ref);
  };

  const want = (host) => {
    const ref = host.getAttribute("data-mock-lazy");
    if (!ref) return;
    waiting.add(ref);
    if (!flushing) flushing = setTimeout(flush, 50);
  };

  /**
   * ⛔ A GENEROUS MARGIN, SO THEY ARE THERE BEFORE THEY ARE REACHED. A thumbnail that begins loading
   * at the moment it crosses the fold is a thumbnail the reader watches appear, which reads as the
   * page being slow — the thing this change exists to stop.
   */
  /**
   * ⛔ WATCH THE BOX THAT HAS A SIZE, NOT THE HOST, WHICH HAS NONE UNTIL IT IS FILLED.
   *
   * An unfilled host measures 0x0 — the drawing that gives it height has not arrived — and a
   * zero-area target is exactly the case IntersectionObserver is least dependable on. Driven in a
   * real browser it never fired: the tab was pressed, the shot was on screen, the host was
   * {w:0,h:0} and all 32 thumbnails stayed blank. The frame around it (.ux-shot, .ptile-glass) is
   * sized by the stylesheet whether or not anything is in it, so that is what is watched, and the
   * host is found back from it.
   */
  const sizedBox = (h) => h.closest(".ux-shot, .ptile-glass, .ux-shot-scale, .ptile-scale") || h;

  if (typeof IntersectionObserver === "function") {
    const eye = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          for (const h of e.target.matches("[data-mock-lazy]") ? [e.target] : e.target.querySelectorAll("[data-mock-lazy]")) want(h);
          eye.unobserve(e.target);
        }
      },
      { rootMargin: "600px 0px" }
    );
    const watched = new WeakSet();
    const watch = () => {
      for (const h of document.querySelectorAll("[data-mock-lazy]")) {
        const box = sizedBox(h);
        if (watched.has(box)) continue;
        watched.add(box);
        eye.observe(box);
      }
    };
    watch();
    new MutationObserver(watch).observe(document.body, { childList: true, subtree: true });
    /**
     * ⛔ AND WHEN A PANEL IS REVEALED, which is not a mutation to anything's children. Switching a
     * view or a tab flips hidden, so a thumbnail that was 0x0 inside a display:none panel becomes
     * visible without the tree changing — and an observer already told "not intersecting" is not
     * asked again. A press re-sweeps.
     */
    document.addEventListener("click", () => setTimeout(watch, 60), true);
  } else {
    /** No observer: ask for them all rather than show nothing. */
    for (const h of document.querySelectorAll("[data-mock-lazy]")) want(h);
  }
})();
<\/script>`;

function liveScript(opts: PageOptions): string {
  const mode = opts.records ?? "http";
  return `<script>
const OWED = ${JSON.stringify(OWED)};
/** Fields a particular target owes on top of its act's own. */
const EXTRA = ${JSON.stringify({
  then: {
    name: "then",
    label: "What would show this holding — an org-wide sentence owes its own demonstration",
    floor: 15,
    long: true,
  },
})};
const BY = ${JSON.stringify(opts.by ?? "")};
const MODE = ${JSON.stringify(mode)};
/*
 * ⛔ THE ONE DOOR IS NOT AT THE ROOT WHEN A PROJECT IS IN THE PATH, AND EVERY WRITE FROM A HOSTED
 * PAGE WAS 404ING.
 *
 * Peter, trying to add a dimension: "Not saved: Not Found". Measured rather than guessed:
 *
 *     POST /p/prj-.../api/v2/in   422   <- the route, answering about the payload
 *     POST /api/v2/in             404   <- what every handler on this page was posting to
 *
 * An instance serves a corpus under /p/<project>/, so a root-relative URL leaves the project behind.
 * There is no <base> tag, so this was true of FILING A NOTE and RECORDING AN ACT as well — not just
 * the feature that exposed it. Four call sites, one of them the composer, all silently wrong
 * wherever the page is not served from the root.
 *
 * ⛔ DERIVED FROM THE PAGE'S OWN LOCATION rather than passed in. The page knows where it is; a
 * constant threaded through the renderer would be a second statement of the same fact, and the
 * instance that strips the prefix is not the code that renders the page. Everything up to /v2 is the
 * prefix, and a page served at the root has none.
 */
const UNDER = (function () {
  const path = location.pathname;
  const at = path.indexOf("/v2");
  return at > 0 ? path.slice(0, at) : "";
})();
/*
 * ⛔ EVERY URL THE PAGE BUILDS, NOT THE ONE THAT FAILED IN FRONT OF SOMEBODY.
 *
 * My first fix reached four call sites and there are SEVEN. The deploying session built a probe that
 * takes the urls the page's own script NAMES, resolves each the way a browser will — root-relative
 * against the origin — and reports any that 404 while the project-scoped form answers:
 *
 *     /api/v2/thread     404 at the origin, 200 under the project
 *     /api/v2/presence   404                200
 *     /api/v2/live       404                200
 *
 * So on the hosted page the acknowledgement thread never loaded, presence never loaded, and the live
 * connection never opened. The two-way window Peter asked for was dead, and had been.
 *
 * ⛔ AND A POST PROBE WOULD HAVE MISSED ALL THREE — which is what I had suggested. Two are GETs and
 * one is an EventSource. The urls are the thing to enumerate, not the verb.
 *
 * ⛔ IT ALSO CHANGES THE STATUS OF AN EARLIER VERIFICATION: /api/v2/live was reported working on the
 * real instance, by curl against the project-scoped path. The server was fine; the PAGE could not
 * reach it. A route verified by a client that constructs its own url says nothing about a page that
 * constructs a different one.
 */
const API = UNDER + "/api/v2/in";
/** ⛔ The local server a press calls, and the corpus on that machine it writes into. */
const MCP_SERVER = ${JSON.stringify(opts.mcpServer ?? "host:productos")};
const CORPUS = ${JSON.stringify(opts.recordsTo ?? "v2")};

/**
 * ⛔ The buttons start disabled and light up only once a channel exists. A press that records
 * nothing is worse than no button, and \`claude.use\` resolves later than first paint by
 * contract — never during this script's first run.
 */
let channel = null;
const acts = () => document.querySelectorAll("button.act");
for (const b of acts()) { b.disabled = true; b.title = "connecting…"; }

function arm(why) {
  for (const b of acts()) { b.disabled = false; b.title = why; }
}
function refuse(why) {
  for (const b of acts()) { b.disabled = true; b.title = why; }
  const m = document.querySelector(".mode");
  if (m) { m.textContent = why; m.classList.remove("live"); }
}

async function connect() {
  if (MODE === "http") { arm("recorded on this machine, with your name and today's date"); return; }
  const db = window.claude && (await window.claude.use("db"));
  if (!db) {
    refuse("This page cannot record anything from here — open it from the ProductOS server to press these.");
    return;
  }
  channel = db;
  arm("recorded as your press, then written into the product truth");
}
connect();

function floorsOk(form, fields) {
  let ok = true;
  for (const f of fields) {
    const el = form.querySelector('[name="' + f.name + '"]');
    const v = (el.value || "").trim();
    const short = f.floor ? v.length < f.floor : v.length === 0;
    el.classList.toggle("short", short);
    const c = form.querySelector('[data-count="' + f.name + '"]');
    if (c && f.floor) c.textContent = v.length + " / " + f.floor;
    if (short) ok = false;
  }
  return ok;
}

async function record(payload, form, button) {
  const status = form.querySelector(".status");
  status.textContent = "recording…";
  try {
    if (MODE === "http") {
      /**
       * ⛔ ONE DOOR, AND THE ACT IS THE INTENT. /api/v2/act and four others became /api/v2/in,
       * routed by a named intent — and the act a press carries IS that name, so the mapping is one
       * line here rather than a second envelope on the wire.
       *
       * ⛔ NO BACKTICKS IN THIS COMMENT. Everything in this function is inside a template literal,
       * so a backtick closes the string — which is exactly how the first version of this edit broke
       * the build in two places at once.
       */
      const res = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: payload.act, ...payload }),
      });
      const body = await res.json();
      /*
       * ⛔ THROUGH THE ONE WAY OUT. This built its own sentence out of the same four fields the bar
       * renders, into a status span beside the control — so what an act said depended on which
       * control you pressed, and the three senders that did this are where he was handed an outcome
       * he could not read.
       *
       * The row's own status line stays: it says whether THIS act landed, which is a different
       * question from what the corpus answered, and it is the only thing a reader looking at the row
       * can see without turning their head.
       */
      const out = !res.ok && body.ok === undefined
        ? { ok: false, why: res.status + " " + (res.statusText || "refused"), detail: ["nothing was recorded"] }
        : body;
      announce(out);
      if (!out.ok) {
        status.textContent = "Not recorded.";
        status.classList.add("bad");
        return;
      }
      status.textContent = out.said || "recorded";
    } else if (MODE === "mcp") {
      /**
       * ⛔ STRAIGHT INTO THE CORPUS ON THE READER'S OWN MACHINE. No database, no row to carry in,
       * nobody in the loop. The press calls the same act every other surface calls, and the truth
       * it changes is the truth the page is rendering.
       */
      const mcp = await claude.use("mcp");
      if (!mcp) throw new Error("this view cannot reach your machine — open it in the Claude app, where a local server can be called");
      /**
       * ⛔ THE DOOR, BY THE ACT'S OWN NAME — AND THIS WAS BROKEN, NOT MERELY STALE.
       *
       * It held a map from each act to a dedicated tool: accept to productos_exchange_agree_to,
       * rule to productos_exchange_settle, and three more. Every one of those came off the MCP
       * surface when productos_in grew to take their intents, so callTool threw
       * 'unknown tool',  and a press on a page opened in the Claude app **recorded nothing and
       * reported a bare error**.
       *
       * It was also the last place a caller could see a second vocabulary for the five acts, which
       * is what Peter settled: one name per act — accept, rule, waive, defer, read — across MCP,
       * the CLI and the page. The act's own name is now the intent, so there is no map to go stale
       * and nothing to keep in step.
       *
       * ⛔ No backticks in this comment: it lives inside the template literal that carries the
       * page's browser script, so one would end the string. There is a test for that, and it is
       * the test that caught this very edit.
       */
      let res;
      try {
        res = await mcp.callTool(MCP_SERVER, "productos_in", {
          intent: payload.act,
          fields: { ...payload, via: "page" },
          at: CORPUS,
        });
      } catch (err) {
        /**
         * ⛔ BRANCH ON THE CODE, NEVER ON THE MESSAGE — and never collapse them into one banner,
         * because each has a different thing a person can do about it.
         */
        const code = err && err.code;
        if (code === "server_not_connected")
          throw new Error("ProductOS is not connected here. Run: productos init claude --update, then reopen the Claude app.");
        if (code === "not_granted") throw new Error("you declined this page access to ProductOS — reload to be asked again");
        if (code === "tool_error") throw new Error((err.message || "ProductOS refused it") + " — it says what to do instead");
        throw err;
      }
      const said = res && res.payload;
      status.textContent = (said && (said.said || said.message)) || "recorded in your corpus";
    } else {
      /**
       * ⛔ One row per press, and never the live DOM. What a viewer typed is kept only because
       * this writes it; the row is then read back and turned into product truth by the same code
       * path every other surface uses.
       */
      await channel.collection("presses").add({ ...payload, handled: false, at: new Date().toISOString() });
      status.textContent = "recorded — it will be written into the product truth shortly";
    }
    status.classList.add("ok");
    form.querySelectorAll("input,textarea,button").forEach((e) => (e.disabled = true));
    if (button) button.disabled = true;
    /**
     * ⛔ THE ROW YOU JUST PRESSED HAS TO CHANGE. Without this, confirming a behaviour left its chip
     * reading "not confirmed" until the stream happened to come back — so the press looked like it
     * had not worked, which is the complaint that started the whole live-update thread.
     */
    if (typeof window.refreshNow === "function") window.refreshNow();
  } catch (e) {
    status.textContent = "Not recorded: " + (e && e.message ? e.message : String(e));
    status.classList.add("bad");
  }
}

/**
 * ⛔ THE PANEL SENDS TO THE SAME CHANNEL THE ACTS USE, and records what was on screen.
 *
 * Not a verdict — nothing here changes what the product does. What it carries that a person cannot
 * reconstruct an hour later is the ref they were looking at, so that is captured automatically and
 * shown before they send.
 */
${mode === "http" ? FOLLOWS_THE_TRUTH : ""}

const noteBar = document.getElementById("note-bar");
if (noteBar) {
  document.body.classList.add("has-note-bar");
  const text = document.getElementById("note-text");
  /**
   * ⛔ THE LABEL ELEMENT IS GONE AND THE REF IS NOT. Peter: *"hide the 'about: {which page}' piece.
   * not needed."* What that line showed was the ref this note will carry — which a reader already
   * knows, because they are looking at it. The capture below is untouched: the ref is the one thing
   * a person cannot reconstruct an hour later, which is why it is taken from the page rather than
   * asked for. The handle stays, and the painting below is guarded so it is a no-op rather than a
   * throw, and a throw here would take the composer with it.
   */
  const label = document.getElementById("note-about-label");
  const status = document.getElementById("note-status");

  /**
   * What the reader is looking at, taken from the page rather than asked for. The visible view
   * carries its ref on data-view; the heading is only for showing them what got captured.
   */
  /**
   * ⛔ WHAT THE READER IS LOOKING AT, TO THE SUBSECTION.
   *
   * The visible view alone was too coarse: on Overview it said "Product Truth" whether somebody was
   * reading the queue, the product goals or the design principles, so three different requests all
   * arrived attached to the same ref — which is the one thing a note carries that nobody can
   * reconstruct later.
   *
   * So: the innermost thing on screen that the model has a ref for. Every section the renderer
   * emits for a model object carries data-ref and data-label, so this reads the page's own answer
   * rather than a second one computed here.
   */
  /**
   * ⛔ THE THREAD IS GONE — see the composer markup for why. The reply channel is not: a reply is
   * still recorded and still reaches the inbox. What was removed is the log of it sitting above
   * the box, pushing the screen somebody came to review off the page.
   */
  const READING_LINE = 0.35; // a third down the viewport is where somebody is actually reading

  const visible = (el) => {
    if (el.hidden || el.closest("[hidden]")) return false;
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  };

  const current = () => {
    /**
     * ⛔ ONE CHAIN, DERIVED ONE WAY.
     *
     * This used to name the view separately, as "the first section.view that is not hidden" — but a
     * tab renders SEVERAL views at once, so on any feature page the trail read "Overview /" above a
     * card belonging to a different scope entirely. Two answers to "where am I" and the wrong one
     * was in front.
     *
     * Views carry a ref like everything else now, so the trail is just the ancestor chain of the
     * thing being read.
     */
    const trail = [];

    // Everything on screen with a ref, innermost last: the deepest one whose top has passed the
    // reading line, else the first one still below it.
    const marks = [...document.querySelectorAll("[data-ref]")].filter(visible);
    const line = window.innerHeight * READING_LINE;
    const passed = marks.filter((m) => m.getBoundingClientRect().top <= line);
    const at = passed.length ? passed[passed.length - 1] : marks[0];

    /**
     * ⛔ THE WHOLE CHAIN, NOT JUST THE INNERMOST.
     *
     * Taking only the deepest mark made the capture flip between a group and its first child
     * depending on how much intro prose happened to sit above the reading line: clicking "Product
     * goals" showed a single goal, clicking "Design principles" showed the group. Same gesture, two
     * different answers, neither wrong and no way for the reader to tell which they were getting.
     *
     * Walking up from the innermost mark gives one stable answer that contains both.
     */
    const chain = [];
    for (let el = at; el; el = el.parentElement ? el.parentElement.closest("[data-ref]") : null) {
      if (el.dataset.ref) chain.unshift({ ref: el.dataset.ref, label: el.dataset.label || el.dataset.ref });
    }
    /**
     * Deduped on the LABEL, not the ref. The Overview tab and the "Product Truth" panel inside it
     * are the same scope wearing two names, and dropping the second one collapsed the trail to a
     * bare "Overview" — which is the tab, not the place.
     */
    for (const link of chain) if (link.label !== trail[trail.length - 1]?.label) trail.push(link);
    return trail.filter((t) => t.label);
  };

  const describe = () => {
    const trail = current();
    if (!trail.length) {
      if (label) label.textContent = "this page";
      return "";
    }
    // ⛔ The trail is shown, not just the leaf: "Overview" and "Overview / Product goals" are
    // different places, and a bare "Product goals" does not say which product truth it is in.
    if (label) label.textContent = trail.map((t) => t.label).join(" / ");
    const leaf = trail[trail.length - 1];
    /**
     * ⛔ GUARDED LIKE THE TWO ABOVE IT, AND I MISSED THIS ONE. Removing the about-line left three
     * writes to an element that no longer exists; I guarded the two textContent assignments and
     * walked past the title one. It threw on every ref computation — which is how this function ENDS,
     * so the ref was computed, the throw escaped, and handlers downstream of it never
     * ran. Found in the browser as "Cannot set properties of null", not by reading.
     */
    if (label) label.title = leaf.ref;
    return leaf.ref;
  };
  describe();
  // The tabs, the tree and scrolling all change what is being read; the capture has to follow.
  document.addEventListener("click", () => setTimeout(describe, 0));
  window.addEventListener("hashchange", describe);
  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        describe();
      });
    },
    { passive: true }
  );

  const grow = () => {
    text.style.height = "auto";
    text.style.height = Math.min(text.scrollHeight, 144) + "px";
  };
  text.addEventListener("input", () => { grow(); status.textContent = ""; });
  /**
   * ⛔ ENTER SENDS. SHIFT+ENTER IS A NEW LINE.
   *
   * Peter: "'enter' on the keyboard in the product os page should send, not newline. shift+enter is
   * newline."
   *
   * ⛔ THE BEHAVIOUR THIS REPLACES WAS NEVER ASKED FOR, AND THE COMMENT DEFENDING IT SAID IT WAS.
   *
   * It read: "Enter makes a new line — people write more than one, and Peter's first note had a
   * blank line in it." He had said no such thing. A note of his happened to contain a blank line,
   * and I turned that observation into his rationale and wrote it here in his name, where the next
   * reader would take it as a requirement and leave it alone. He had to come back with "never in
   * the history of the world did i say enter should put a blank line in there" to dislodge it.
   *
   * The rule is quote him or say it is yours. An inference dressed as somebody's instruction is
   * worse than no comment: it is unfalsifiable by anybody who was not in the room, and it defends
   * a decision nobody made.
   *
   * The decision itself, plainly mine: this box is one line high and sits at the bottom of a page
   * somebody is reading. It is a message box, and a message box sends on Enter.
   *
   * ⛔ isComposing is checked, or Enter to accept a candidate in a Japanese, Chinese or Korean
   * input method sends the half-finished word instead. The event fires with the same key.
   */
  text.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
    if (e.shiftKey) return;
    e.preventDefault();
    noteBar.requestSubmit();
  });

  noteBar.addEventListener("submit", async (e) => {
    e.preventDefault();
    const says = (text.value || "").trim();
    if (!says) { status.textContent = "Say what should change."; status.className = "status bad"; text.focus(); return; }
    const about = describe() || "this page";
    const payload = { about, says, by: BY, via: "page" };
    status.textContent = "sending…"; status.className = "status";

    /*
     * ⛔ A "dim:" TAG IN THE COMPOSER NAMES A DIMENSION, FROM THE ONE INPUT.
     *
     * Peter: "Adding dimensions are also available via the text input, right?"
     *
     * Yes — through an explicit TAG, which is the only honest way. This project already works this
     * way for the "pos:" tag: "The tag sets Note.kind; nothing infers it. A classifier reading the sentence
     * would be a guess wearing a decision's clothes." Parsing "add a dimension for role with admin
     * and loan processor" out of prose is exactly that classifier, and it would be writing product
     * truth on a guess.
     *
     *     dim: Role = admin, loan processor
     *
     * ⛔ ANYTHING ELSE STILL FILES A REQUEST, unchanged. The tag is the difference between asking
     * for something and doing it, and it is typed rather than detected.
     *
     * ⛔ AND IT MERGES RATHER THAN REPLACING. The splits-on intent takes the whole list, so sending only the
     * new dimension would delete every one already named — the same tidying-away this surface has
     * been bitten by twice.
     */
    const asDim = /^\s*dim\s*:\s*([^=]+?)\s*=\s*(.+)$/i.exec(says);
    if (asDim && MODE === "http") {
      const label = asDim[1].trim();
      const values = asDim[2].split(",").map((v) => v.trim()).filter(Boolean);
      const already = Array.prototype.slice.call(document.querySelectorAll("[data-walk-dim]")).map((sel) => {
        const labelEl = sel.parentNode.querySelector(".wdim-n");
        return {
          id: sel.getAttribute("data-walk-dim"),
          label: labelEl ? labelEl.textContent.trim() : sel.getAttribute("data-walk-dim"),
          values: Array.prototype.slice.call(sel.options)
            .map((o) => o.value)
            .filter((v) => v && v !== "__add__"),
        };
      });
      const mine = already.filter((a) => a.label.toLowerCase() === label.toLowerCase())[0];
      if (mine) mine.values = values;
      else already.push({ id: "", label, values });
      /*
       * ⛔ THE SENDER, NOT A SECOND COPY OF IT. This is the exact path that answered him with
       * "Not saved: Not Found" — a status line pasted after a prefix, with no account of what had
       * happened or whether anything had landed. The dimensions he was adding did not arrive, and
       * the page said four words about it.
       */
      try {
        await sendIntent("splits-on", { axes: already });
        text.value = ""; grow();
        status.textContent = "saved"; status.className = "status ok";
        setTimeout(() => location.reload(), 700);
      } catch (err) {
        /* ⛔ Already announced, in full, by the sender. The row says only that it did not land. */
        status.textContent = "Not saved"; status.className = "status bad";
      }
      return;
    }

    try {
      if (MODE === "http") {
        /** ⛔ The same one door. Filing a request is the "note" intent. */
        const res = await fetch(API, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ intent: "note", ...payload }),
        });
        const body = await res.json();
        if (!res.ok || body.ok === false) throw new Error(body.why || res.statusText);
      } else {
        // ⛔ Same collection discipline as a press: one row, read back and acted on separately.
        if (!channel) throw new Error("this page cannot record anything from here");
        await channel.collection("notes").add({ ...payload, at: new Date().toISOString(), state: "open" });
      }
      text.value = ""; grow();
      // ⛔ Says what it did and did NOT do. A green tick alone would read as "changed".
      /** ⛔ Says what it did and did NOT do, and shows the request landing in the thread. */
      status.textContent = /^\s*pos\s*:/i.test(says)
        ? "noted as a framework issue — you will get an answer here"
        : "noted — nothing changes until somebody authors it";
      status.className = "status ok";
      setTimeout(() => { if (status.className === "status ok") status.textContent = ""; }, 6000);
    } catch (err) {
      status.textContent = "Not sent: " + (err && err.message ? err.message : String(err));
      status.className = "status bad";
    }
  });
}

/*
 * ⛔ THE SPLIT AND EACH PROTOTYPE'S PLACEMENT, SET FROM THE PAGE.
 *
 * Peter: *"I should be able to drive this from the listener/input, right??? why could you possibly
 * need this?"* — about my asking him what his prototypes split on. The capability was there and
 * reachable only from a terminal in a checkout, so I turned a missing door into a question for him.
 *
 * ⛔ TWO INTENTS THROUGH THE ONE DOOR, no new routes: "splits-on" and "prototype", both on the
 * author gate. Writing product truth is not agreeing to it, and nothing here stamps.
 *
 * ⛔ THIS IS PLAIN JS INSIDE A TEMPLATE STRING, NOT TYPESCRIPT. I wrote the first version with type
 * annotations, which the compiler never sees — it is a string — so it would have shipped a syntax
 * error that killed every script on the page, including the walk and the composer. Caught by
 * reading where the function sits rather than by trusting that it compiled.
 */
/*
 * ⛔ ONE WAY OUT. Every intent answers the same four fields, so one function renders that shape and
 * every send goes through it. A handler that formats its own outcome is a handler that can forget
 * to, and the ones that forgot are why a refusal reached him as raw fields.
 */
function announce(out) {
  var bar = document.getElementById("out");
  if (!bar) return out;
  var ok = !!(out && out.ok);
  var note = document.createElement("div");
  note.className = "outnote " + (ok ? "ok" : "bad");

  var head = document.createElement("strong");
  head.textContent = ok ? out.said || "done" : (out && out.why) || "it did not go through";
  note.appendChild(head);

  var detail = (out && out.detail) || [];
  for (var d = 0; d < detail.length; d++) {
    var line = document.createElement("span");
    line.textContent = detail[d];
    note.appendChild(line);
  }

  var x = document.createElement("button");
  x.type = "button";
  x.className = "outnote-x";
  x.setAttribute("aria-label", "Dismiss");
  x.textContent = "×";
  x.addEventListener("click", function () { note.remove(); });
  note.appendChild(x);

  bar.appendChild(note);
  /*
   * ⛔ ONLY WHAT SUCCEEDED FADES. The complaint behind this bar is a failure he could not read; one
   * that disappears on a timer is the same failure with a deadline on it. A refusal waits to be
   * dismissed.
   */
  if (ok) setTimeout(function () { note.remove(); }, 7000);
  return out;
}

var sendIntent = function (intent, payload) {
  return fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(Object.assign({ intent: intent }, payload)),
  })
    .then(function (res) { return res.json().then(function (b) { return { res: res, body: b }; }); })
    .then(function (r) {
      /*
       * ⛔ AN HTTP FAILURE IS AN OUTCOME TOO. A 404 or a 503 carries none of the four fields, so the
       * status line has to become the reason — that is how "Not saved: Not Found" reached him with
       * no account at all of what had happened.
       */
      var answered = r.body && r.body.ok !== undefined;
      var out = answered
        ? r.body
        : { ok: false, why: r.res.status + " " + (r.res.statusText || "refused"), detail: ["nothing was written"] };
      announce(out);
      if (!out.ok) {
        var refusal = new Error(out.why || "refused");
        refusal.announced = true;
        throw refusal;
      }
      return [out.said].concat(out.detail || []).filter(Boolean).join(" — ");
    })
    .catch(function (err) {
      /*
       * ⛔ ANNOUNCED ONCE, NOT TWICE. The handler above announced the refusal before throwing, so
       * this speaks only for a failure that produced no answer at all — an instance that is down, a
       * connection that dropped. A flag says which; matching my own message text would not, and
       * the checker classifying its findings by regex over its own prose is a bug this repo had.
       */
      if (!err || !err.announced) {
        announce({
          ok: false,
          why: "could not reach the corpus",
          detail: [err && err.message ? err.message : "the instance gave no answer"],
        });
      }
      throw err;
    });
};

function wireSelectionEditor() {


  /*
   * ⛔ SHOW THE DETAIL ONLY WHEN ASKED. The gaps and the placement table used to sit open under the
   * selector, which is what made one decision look like five blocks of text.
   */
  var detail = document.querySelector("[data-sel-detail]");
  Array.prototype.slice.call(document.querySelectorAll("[data-sel-more]")).forEach(function (b) {
    b.addEventListener("click", function () {
      if (!detail) return;
      detail.hidden = false;
      detail.scrollIntoView({ block: "nearest" });
    });
  });

  /*
   * ⛔ THE DROPDOWNS ARE FILTERS. Peter: "so the prototypes just has chips of which dimension, e.g.
   * role:admin. and the drop down selectors will be filters."
   *
   * Each row carries its own placement in data-is, so filtering is every row answering for itself
   * rather than a second table of combinations that has to agree with it. A combination nothing
   * covers needs no special case: the list is empty, which says the same thing without a mechanism.
   */
  var rows = Array.prototype.slice.call(document.querySelectorAll("[data-proto-row]"));
  var countEl = document.querySelector("[data-proto-count]");
  var emptyEl = document.querySelector("[data-proto-empty]");
  var dimSelects = Array.prototype.slice.call(document.querySelectorAll("[data-walk-dim]"));

  function applyFilters() {
    var want = {};
    dimSelects.forEach(function (sel) {
      var v = sel.value;
      if (v && v !== "__add__") want[sel.getAttribute("data-walk-dim")] = v;
    });
    var shown = 0;
    rows.forEach(function (row) {
      var is = {};
      try { is = JSON.parse(row.getAttribute("data-is") || "{}"); } catch (e) { is = {}; }
      var keep = true;
      for (var k in want) if (is[k] !== want[k]) { keep = false; break; }
      row.hidden = !keep;
      if (keep) shown++;
    });
    if (countEl) countEl.textContent = String(shown);
    if (emptyEl) emptyEl.hidden = shown > 0;
  }

  /*
   * ⛔ "+ add a value" IS NOT A FILTER VALUE. Picking it opens the form with that dimension's name
   * already in it, and puts the dropdown back where it was — otherwise the sentinel stays selected
   * and the list filters on a value that does not exist.
   */
  var formEl = document.querySelector("[data-dim-form]");
  function openForm(name, values) {
    if (!formEl) return;
    formEl.hidden = false;
    formEl.querySelector('input[name="label"]').value = name || "";
    formEl.querySelector('input[name="values"]').value = values || "";
    formEl.querySelector(values ? 'input[name="values"]' : 'input[name="label"]').focus();
  }

  dimSelects.forEach(function (sel) {
    var last = sel.value;
    sel.addEventListener("change", function () {
      if (sel.value === "__add__") {
        var labelEl = sel.parentNode.querySelector(".wdim-n");
        var existing = Array.prototype.slice.call(sel.options)
          .map(function (o) { return o.value; })
          .filter(function (v) { return v && v !== "__add__"; });
        sel.value = last;
        openForm(labelEl ? labelEl.textContent.trim() : "", existing.join(", ") + ", ");
        return;
      }
      last = sel.value;
      applyFilters();
    });
  });
  if (dimSelects.length) applyFilters();

  var addBtn = document.querySelector("[data-dim-add]");
  if (addBtn) addBtn.addEventListener("click", function () { openForm("", ""); });
  var cancelBtn = document.querySelector("[data-dim-cancel]");
  if (cancelBtn) cancelBtn.addEventListener("click", function () { if (formEl) formEl.hidden = true; });

  /*
   * ⛔ ONE DIMENSION AT A TIME, AND THE OTHERS TRAVEL UNCHANGED. The intent replaces the whole list,
   * so sending only the new one would delete every dimension already named — and a save that drops
   * what it was not asked about is how an uncovered combination would vanish by tidying.
   */
  var dimSave = document.querySelector("[data-dim-save]");
  if (dimSave) {
    var dimStatus = document.querySelector("[data-dims-status]");
    dimSave.addEventListener("click", function () {
      var label = formEl.querySelector('input[name="label"]').value.trim();
      var values = formEl
        .querySelector('input[name="values"]')
        .value.split(",")
        .map(function (v) { return v.trim(); })
        .filter(Boolean);
      if (!label) { dimStatus.textContent = "Name the dimension."; dimStatus.className = "status bad"; return; }
      if (!values.length) { dimStatus.textContent = "Give it at least one value."; dimStatus.className = "status bad"; return; }

      /*
       * ⛔ labelEl, NOT label — the rename shadowed the name the person had just typed with the DOM
       * node holding a dimension's heading, so the comparison below ran against an element and the
       * save sent nothing at all. Caught by the browser test; no compiler can see inside this string.
       */
      var axes = dimSelects.map(function (sel) {
        var labelEl = sel.parentNode.querySelector(".wdim-n");
        return {
          id: sel.getAttribute("data-walk-dim"),
          label: labelEl ? labelEl.textContent.trim() : sel.getAttribute("data-walk-dim"),
          values: Array.prototype.slice.call(sel.options)
            .map(function (o) { return o.value; })
            .filter(function (v) { return v && v !== "__add__"; }),
        };
      });
      /* Naming one that already exists replaces its values rather than adding a second row. */
      var mine = axes.filter(function (a) { return a.label.toLowerCase() === label.toLowerCase(); })[0];
      if (mine) mine.values = values;
      else axes.push({ id: "", label: label, values: values });

      dimStatus.textContent = "saving…"; dimStatus.className = "status";
      sendIntent("splits-on", { axes: axes })
        .then(function (said) {
          dimStatus.textContent = said; dimStatus.className = "status ok";
          /* ⛔ "After that it'll go and do indexing" — the combinations and the chips are derived, so
             the honest way to show them is to read the page again. */
          setTimeout(function () { location.reload(); }, 700);
        })
        .catch(function (err) {
          dimStatus.textContent = "Not saved: " + (err && err.message ? err.message : String(err));
          dimStatus.className = "status bad";
        });
    });
  }

  /*
   * ⛔ WHICH SCREEN HOLDS WHICH, SAID ON THE SCREEN ITSELF. Same intent door; one request per change
   * rather than a save button, because a containment is one decision and there is nothing to batch.
   */
  Array.prototype.slice.call(document.querySelectorAll("[data-inside]")).forEach(function (row) {
    var sel = row.querySelector("select");
    var istatus = row.querySelector(".status");
    sel.addEventListener("change", function () {
      istatus.textContent = "saving…"; istatus.className = "status";
      sendIntent("inside", { view: row.getAttribute("data-inside"), of: sel.value })
        .then(function (said) {
          istatus.textContent = said; istatus.className = "status ok";
          setTimeout(function () { location.reload(); }, 900);
        })
        .catch(function (err) {
          istatus.textContent = "Not saved: " + (err && err.message ? err.message : String(err));
          istatus.className = "status bad";
        });
    });
  });

  /*
   * ⛔ ONE PRESS, NO CONFIRM DIALOG. A prototype is a way through the product rather than a claim
   * anybody agreed to, and it can be declared again in one call — so a modal here would be ceremony
   * over something cheap. What it does get is the count it left behind, said out loud.
   */
  Array.prototype.slice.call(document.querySelectorAll("[data-sel-drop]")).forEach(function (btn) {
    btn.addEventListener("click", function () {
      var where = document.querySelector("[data-sel-status]");
      if (where) { where.textContent = "taking it back…"; where.className = "status"; }
      sendIntent("prototype", { id: btn.getAttribute("data-sel-drop"), remove: true })
        .then(function (said) {
          if (where) { where.textContent = said; where.className = "status ok"; }
          setTimeout(function () { location.reload(); }, 900);
        })
        .catch(function (err) {
          if (where) {
            where.textContent = "Not taken back: " + (err && err.message ? err.message : String(err));
            where.className = "status bad";
          }
        });
    });
  });

  var save = document.querySelector("[data-sel-save]");
  if (!save) return;
  var pstatus = document.querySelector("[data-sel-status]");
  save.addEventListener("click", function () {
    var rows = Array.prototype.slice.call(document.querySelectorAll("[data-sel-proto]"));
    pstatus.textContent = "saving…"; pstatus.className = "status";
    /*
     * ⛔ ONE REQUEST PER PROTOTYPE, IN SEQUENCE. Each writes the whole prototypes file, so two in
     * flight would have the second overwrite the first's placement with what it read beforehand.
     */
    var last = "";
    var chain = rows.reduce(function (p, row) {
      return p.then(function () {
        var id = row.getAttribute("data-sel-proto") || "";
        var is = {};
        var startsAt = "";
        /*
         * ⛔ SELECTS AND INPUTS BOTH. A placement is a select now — a dimension that says what it
         * can be leaves nothing to type, and typing is how a prototype came to claim a value
         * nobody could select. Reading only inputs sent every placement as empty, which looked
         * exactly like somebody clearing them on purpose.
         */
        Array.prototype.slice.call(row.querySelectorAll("input, select")).forEach(function (field) {
          var name = field.getAttribute("name") || "";
          if (name === "startsAt") startsAt = field.value.trim();
          else if (name) is[name] = field.value.trim();
        });
        return sendIntent("prototype", { id: id, is: is, startsAt: startsAt }).then(function (said) { last = said; });
      });
    }, Promise.resolve());
    chain
      .then(function () {
        pstatus.textContent = last || "saved"; pstatus.className = "status ok";
        setTimeout(function () { location.reload(); }, 900);
      })
      .catch(function (err) {
        pstatus.textContent = "Not saved: " + (err && err.message ? err.message : String(err));
        pstatus.className = "status bad";
      });
  });
}
wireSelectionEditor();

/**
 * ⛔ EDIT THE SENTENCE WHERE IT IS. Peter: *"they should also be able to just edit the text
 * directly."*
 *
 * Rewording went through a form with two fields, and the sentence being reworded was somewhere
 * above it — so you retyped a sentence you could no longer see. Double-click the text and it
 * becomes the text, with the reason asked for underneath, because ⛔ the reason is not optional:
 * it is the floor that stops a sentence being quietly replaced by whoever was last in the file.
 */
/**
 * ⛔ A ROW OPENS THE ROW UNDER IT. A table cannot nest a details element, so the detail is
 * its own table row — hidden until the row above is tapped. Without JavaScript the sentence is still fully
 * visible, which is the part a reviewer judges; what stays hidden is only what supports it.
 */
document.addEventListener("click", (ev) => {
  if (ev.target.closest("button, a, textarea, summary")) return;
  const row = ev.target.closest("tr.beh");
  if (!row || !row.dataset.ref) return;
  const detail = row.parentElement.querySelector('tr.beh-detail[data-for="' + CSS.escape(row.dataset.ref) + '"]');
  if (!detail) return;
  detail.hidden = !detail.hidden;
  row.classList.toggle("open", !detail.hidden);
  /** The screens inside a detail row are filled on demand, the same as before. */
  /** ⛔ Guarded: it belongs to another block, and a missing picture is better than a dead page. */
  if (!detail.hidden && window.fillCardScreen)
    for (const f of detail.querySelectorAll("figure.card-screen")) window.fillCardScreen(f);
});

document.addEventListener("dblclick", (ev) => {
  /**
   * ⛔ THE SENTENCE'S OWN ELEMENT, NOT THE CELL. The cell also holds the chips, so replacing its
   * contents with a textarea took "confirmed" and the type with it.
   *
   * ⛔ AND IT LOOKS FOR A TABLE ROW. This handler was written when a behaviour was an article and
   * survived two restructurings into a table unchanged — so double-click found the text, failed to
   * find its row, and returned silently. It was the only thing in a 28-step drive of the page that
   * did not work, and nothing had noticed because every test asserted the handler was PRESENT.
   */
  const says = ev.target.closest(".says-text");
  if (!says || says.querySelector("textarea")) return;
  const row = says.closest("tr.beh, article.beh");
  if (!row || !row.dataset.ref) return;
  const was = says.textContent.trim();
  const box = document.createElement("textarea");
  box.className = "says-edit";
  box.rows = 3;
  box.value = was;
  says.textContent = "";
  says.appendChild(box);
  /**
   * ⛔ FOCUSED ON THE NEXT FRAME. Focusing immediately after appending left the focus on the body
   * — measured, not guessed — so the box's own keydown never fired and Escape did nothing.
   * The element has to be laid out before it can take focus.
   */
  box.focus();
  requestAnimationFrame(() => box.focus());
  /**
   * ⛔ ESCAPE PUTS THE SENTENCE BACK, AND IT IS HANDLED ON THE DOCUMENT AS WELL AS THE BOX.
   *
   * An edit box with no way out traps a reader in a field. Relying on the box's own keydown relied
   * on the box having focus, and it did not — so the only escape was reloading the page, which
   * loses everything else. ⛔ Listening in both places costs one line and removes the dependency on
   * where the browser decided to put the caret.
   */
  const cancel = () => {
    says.textContent = was;
    document.removeEventListener("keydown", onEsc, true);
  };
  const onEsc = (e) => { if (e.key === "Escape" && says.contains(box)) { e.preventDefault(); cancel(); } };
  document.addEventListener("keydown", onEsc, true);
  box.onkeydown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); cancel(); return; }
    e.stopPropagation();
  };
  /** The act itself is the existing one — same floor, same record, same via. */
  box.onblur = () => {
    document.removeEventListener("keydown", onEsc, true);
    const now = box.value.trim();
    if (!now || now === was) { says.textContent = was; return; }
    says.textContent = was;
    const btn = row.querySelector('button.act[data-act="say"]');
    if (!btn) return;
    btn.dataset.says = now;
    btn.click();
  };
});

document.addEventListener("click", (ev) => {
  const b = ev.target.closest("button.act");
  if (!b || b.disabled) return;
  /**
   * ⛔ A ROW'S ACT MUST NOT ALSO OPEN THE ROW. The buttons live in the summary element, so a press
   * toggled the details as well — every confirmation opened the thing it had just confirmed, which
   * reads as the press having done something else. Found by pressing one.
   */
  if (b.closest("summary")) { ev.preventDefault(); ev.stopPropagation(); }
  const act = b.dataset.act;
  const ref = b.dataset.ref;
  let fields = OWED[act] || [];
  /**
   * ⛔ A RULING ON AN ORG-WIDE RULE OWES A DEMONSTRATION, AND THE PAGE HAD NO FIELD FOR IT.
   *
   * Every "decide this" press on a rule was refused — "needs what would show this holding" — with
   * nothing on the page that could satisfy it, so the only exit was hand-editing YAML. That is the
   * shape this codebase has hit three times: a refusal printing a remedy the tool then rejects,
   * this time on the surface a person actually reviews in.
   *
   * The button says what its target owes, because the button is the only thing that knows whether
   * the ref is a rule.
   */
  const owes = (b.dataset.owes || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (owes.length) fields = [...fields, ...owes.map((name) => (EXTRA[name] ? EXTRA[name] : { name, label: name, long: true }))];
  const host = b.closest(".opt-body") || b.closest("footer") || b.parentElement;
  if (host.querySelector("form.act-form")) { host.querySelector("form.act-form").remove(); return; }

  /**
   * ⛔ ONE PRESS WHEN THE ACT OWES NOTHING.
   *
   * Peter: *"clicking twice to confirm a behavior is annoying - just a single click."*
   *
   * He is right and it was never a confirmation step. Every other act owes words — a ruling owes
   * why, a waiver owes whose it is instead — and the form is where those get typed. An accept owes
   * nothing, so the form it opened had no inputs at all: a sentence restating what the button
   * already said, and a second button. Two presses to record one thing, with nothing gathered in
   * between.
   *
   * ⛔ WHAT A CONFIRMATION WOULD HAVE BEEN FOR, SAID PLAINLY: a misclick records a verdict in
   * somebody's name, and there is no act that withdraws one. Rewording is the only correction, and
   * it leaves the first agreement in the log. The ceremony did not actually protect against that —
   * a reflexive second press is not a decision — so this trades a step that felt like a safeguard
   * for one that was never one, and the real answer is an act that retracts. Recorded as such.
   */
  if (!fields.length) {
    const payload = { act, ref, by: BY, via: "page" };
    if (b.dataset.pick) payload.pick = Number(b.dataset.pick);
    if (b.dataset.buildable) payload.buildable = b.dataset.buildable === "yes";
    /** A status line beside the control, since there is no form to carry one. */
    let where = host.querySelector("p.status.inline");
    if (!where) {
      where = document.createElement("p");
      where.className = "status inline";
      host.appendChild(where);
    }
    /** ⛔ record() disables the form controls on success; there is no form, so nothing to disable. */
    record(payload, { querySelector: (q) => (q === ".status" ? where : null), querySelectorAll: () => [] }, b);
    return;
  }

  const form = document.createElement("form");
  form.className = "act-form";
  form.innerHTML =
    '<p class="k">' + (act === "accept" ? "You are agreeing to what is written above" : "Recorded as " + (BY || "you")) + "</p>" +
    fields
      .map(
        (f) =>
          '<label>' + f.label + (f.floor ? ' <span class="count" data-count="' + f.name + '">0 / ' + f.floor + "</span>" : "") + "</label>" +
          (f.long
            ? '<textarea name="' + f.name + '" rows="3"></textarea>'
            : '<input name="' + f.name + '" type="text">')
      )
      .join("") +
    '<div class="act-go"><button type="submit">Record it</button>' +
    '<button type="button" class="cancel">Cancel</button></div>' +
    '<p class="status"></p>';
  host.appendChild(form);
  form.querySelector(".cancel").onclick = () => form.remove();
  for (const el of form.querySelectorAll("input,textarea")) el.oninput = () => floorsOk(form, fields);
  form.onsubmit = (e) => {
    e.preventDefault();
    if (!floorsOk(form, fields)) return;
    const payload = { act: act === "say" ? "rule" : act, ref, by: BY, via: MODE === "http" ? "page" : "page" };
    if (b.dataset.pick) payload.pick = Number(b.dataset.pick);
    if (b.dataset.buildable) payload.buildable = b.dataset.buildable === "yes";
    for (const f of fields) payload[f.name] = form.querySelector('[name="' + f.name + '"]').value.trim();
    record(payload, form, b);
  };
  const first = form.querySelector("input,textarea");
  if (first) first.focus();
});
</script>`;
}


/**
 * ⛔ ONE VIEW AT A TIME, AND EVERYTHING VISIBLE WITHOUT THIS SCRIPT.
 *
 * The whole corpus on one scroll is not reviewable — a real product is ten grids and 51 behaviours —
 * and the surface exists to review one feature. So the menu hides the views it is not on.
 *
 * Progressive enhancement on purpose: with no JS every view is visible and the anchors still work,
 * which is how the served page and a saved file behave. Nothing about what a press records depends
 * on this.
 */
/**
 * ⛔ THE PROTOTYPE IS NOT AN ACT, SO IT WORKS EVERYWHERE.
 *
 * Emitted on read-only renders too. Clicking a control to see what the product promises there
 * records nothing and needs nothing behind it — gating it behind the recording surface would mean
 * the only way to look at a screen was to be in a position to stamp it.
 *
 * ⛔ No backticks below this line: template literal.
 */
const PROTOTYPE = `<script>
(function () {
  const blob = document.getElementById("part-facts");
  if (!blob) return;
  let FACTS = {};
  try { FACTS = JSON.parse(blob.textContent || "{}"); } catch (e) { return; }

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /**
   * ⛔ A CONTROL MAY BE INSIDE A SHADOW ROOT, so neither closest() nor a document query reaches it.
   *
   * A mock generated from the codebase renders in a shadow tree — that is what keeps the app's
   * Tailwind from restyling this page. Two consequences, and both bit: a click inside it arrives
   * retargeted at the host div, so ev.target.closest finds nothing; and closest() stops at the
   * shadow boundary, so a control cannot find the screen it is on.
   */
  const hosts = () => [...document.querySelectorAll("div.proto.html")];

  /**
   * ⛔ ONE STYLESHEET, ADOPTED. Repeating the app's CSS inside every shadow root cost 370 KB per
   * mock; parsed once here and shared by reference instead. The clone path is for anything without
   * constructable stylesheets — still one copy of the bytes in the document either way.
   */
  (function adoptAppCss() {
    const tpl = document.getElementById("app-css");
    if (!tpl) return;
    /**
     * ⛔ THE TEMPLATE'S TEXT, NOT ITS HTML SERIALISATION.
     *
     * innerHTML escapes ampersand, less-than and greater-than on the way out, so every CSS rule
     * with a child combinator came back with "&gt;" where the combinator was: an unparseable
     * selector, dropped in silence by the CSS parser. 828 rules reached the mock and NOT ONE of
     * them held a child combinator — all of space-y, divide, and every nested layout rule the
     * application has. Vertical rhythm was missing on every screen of every corpus, which reads as
     * the drawing being wrong rather than the stylesheet having lost a third of itself on the way
     * in. The template holds raw CSS text; textContent is how you get raw CSS text back.
     */
    const css = tpl.content ? tpl.content.textContent : tpl.textContent;
    if (!css.trim()) return;
    let sheet = null;
    try {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
    } catch (e) {
      sheet = null;
    }
    for (const h of hosts()) {
      const root = h.shadowRoot;
      if (!root) continue;
      /**
       * ⛔ THE OTHER SCRIPT'S VARIABLE, NAMED HERE, KILLED THIS ONE.
       *
       * A single edit meant for the board's hydration landed here too, where that variable does not
       * exist — so this threw ReferenceError on every page load, and the script that hydrates every
       * mock OUTSIDE the board stopped at line one. Fifty-nine screens on the map and every screen
       * embedded in a feature view stayed inert template tags. It looked exactly like "the drawing
       * is missing", it was thrown for over an hour, and I took screenshots of the board — the one
       * surface with its own hydration — and called it verified.
       *
       * The marker styles are added below, from this script's own sheet.
       */
      if ("adoptedStyleSheets" in root) root.adoptedStyleSheets = [sheet, ...root.adoptedStyleSheets].filter(Boolean);
      else {
        const el = document.createElement("style");
        el.textContent = css;
        root.insertBefore(el, root.firstChild);
      }
    }
  })();
  /** What a feature is CALLED, for a callout somebody has to act on. */
  const featureName = (screen, ref) => {
    const id = ref ? (ref.indexOf("#") > 0 ? ref.slice(0, ref.indexOf("#")) : ref)
                   : (screen && screen.closest("section.view") ? screen.closest("section.view").dataset.view : "");
    const nav = document.querySelector('nav.scopes a[data-goto="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    return nav ? nav.textContent.trim() : id;
  };
  const deepPath = (ev) => (ev.composedPath ? ev.composedPath() : [ev.target]);
  const inPath = (ev, sel) => deepPath(ev).find((n) => n && n.matches && n.matches(sel));

  const screenOf = (el) => {
    const direct = el.closest && el.closest("article.screen");
    if (direct) return direct;
    // Out through the shadow boundary, then up.
    const root = el.getRootNode && el.getRootNode();
    const host = root && root.host;
    return host ? host.closest("article.screen") : null;
  };

  /** Every control on a screen, inside its shadow root as well as out. */
  const controlsIn = (screen) => {
    const out = [...screen.querySelectorAll("button.pt")];
    for (const h of screen.querySelectorAll("div.proto.html"))
      if (h.shadowRoot) out.push(...h.shadowRoot.querySelectorAll("button.pt, [data-part], [data-goes]"));
    return out;
  };

  const clear = (screen) => {
    for (const b of controlsIn(screen)) b.classList.remove("on");
    const panel = screen.querySelector(".pt-detail");
    if (panel) { panel.hidden = true; panel.innerHTML = ""; }
  };

  const describePart = (viewId, partId) => {
    const f = FACTS[viewId + "/" + partId];
    if (!f) return '<p class="none">Nothing in the corpus describes this control.</p>';
    /**
     * ⛔ THE WAY ON IS A BUTTON, NOT A HIDDEN GESTURE. Double-click walked the flow and nothing on
     * screen said so, which makes a prototype that navigates indistinguishable from one that does
     * not. The double-click still works as a shortcut.
     */
    const head = '<p class="pt-head"><strong>' + esc(f.label) + '</strong> <span class="role">' + esc(f.role) + '</span>' +
      (f.goes ? ' <button type="button" class="pt-go" data-walk="' + esc(f.goes) + '">follow it →</button>' : "") + '</p>';
    /**
     * ⛔ THE SCREEN'S PROMISE, SAID TO BE THE SCREEN'S. See partFacts for why this exists: a
     * commit control with nothing of its own is how the screen's own exchange gets asked, and
     * answering "nothing is stated" there contradicts the page above it.
     */
    if ((!f.at || !f.at.length) && f.ofScreen && f.ofScreen.length) {
      const rows = f.ofScreen
        .map(
          (x) =>
            '<p class="pt-of"><em>Stated about this screen, not about this control</em> — ' +
            esc(x.title) +
            "</p>" +
            x.said
              .map((sd) => '<p class="pt-said"><span class="slot">' + esc(f.slots[sd.slot] || sd.slot) + "</span> " + esc(sd.text) + "</p>")
              .join("")
        )
        .join("");
      return head + rows;
    }
    if (!f.at || !f.at.length) {
      /**
       * ⛔ THE BLANK IS THE FINDING. A control the corpus draws and states nothing about is the
       * commonest real hole, and it is invisible in a list of what IS written. 77 parts, 7 of them
       * named by any behaviour: a reviewer should be able to see that by clicking.
       */
      return head + '<p class="none">Nothing states what happens here. An engineer building this screen would decide it.</p>';
    }
    return head + f.at.map((a) => {
      const said = (a.said || []).map((s) =>
        '<li><span class="g">' + esc((f.slots && f.slots[s.slot]) || s.slot) + '</span> ' + esc(s.text) + '</li>').join("");
      const blank = (a.blank || []).map((b) => esc((f.slots && f.slots[b]) || b)).join(" · ");
      return '<div class="pt-ex"><p class="pt-ex-t">' + esc(a.title) + ' <code>' + esc(a.ref) + '</code></p>' +
        (said ? '<ul class="pt-said">' + said + "</ul>" : "") +
        (blank ? '<p class="none">says nothing about: ' + blank + "</p>" : "") + "</div>";
    }).join("");
  };

  const select = (btn, leavingTo) => {
    const screen = screenOf(btn);
    if (!screen) return;
    const viewId = screen.dataset.screen;
    const partId = btn.dataset.part;
    const wasOn = btn.classList.contains("on");
    clear(screen);
    if (wasOn) return;
    btn.classList.add("on");
    const panel = screen.querySelector(".pt-detail");
    if (panel) {
      /**
       * ⛔ THE CALLOUT NAMES THE FEATURE, not the screen id. A reviewer is deciding whether to leave
       * what they are reading, and "create-deal#create-deal-form" is not something anybody weighs.
       */
      const out = leavingTo
        ? '<p class="leaving">This leaves <strong>' + esc(featureName(screenOf(btn))) + '</strong> for <strong>' +
          esc(featureName(null, leavingTo)) + '</strong>. Press again to go there.</p>'
        : "";
      panel.innerHTML = out + describePart(viewId, partId);
      panel.hidden = false;
    }
  };

  document.addEventListener("click", (ev) => {
    /**
     * ⛔ A ROW THE APPLICATION NAVIGATES FROM IS A CONTROL, and it is not a button and nobody
     * declared it a part. Selecting on those two alone is why a drawn deals list had a hundred
     * rows and nothing to press.
     */
    const btn = inPath(ev, "button.pt, [data-part], [data-goes]");
    if (!btn) return;
    ev.preventDefault();

    /**
     * ⛔ CROSSING INTO ANOTHER FEATURE IS A DECISION; MOVING INSIDE ONE IS NOT.
     *
     * Peter: *"linking to a new 'feature' should require clicking twice - once will bring up a
     * callout pointing to the new feature, otherwise the prototype just navigates within this
     * single feature"*.
     *
     * The difference is real rather than cosmetic. A reviewer walking one feature is still reading
     * that feature; leaving it drops everything they have in their head and puts them somewhere
     * they did not ask to be. So a control that goes somewhere in THIS feature simply goes, and one
     * that leaves says where it would take them and waits to be asked twice.
     */
    /**
     * ⛔ FINISHING IS ITS OWN PRESS NOW, and removing the link removed the message with it.
     *
     * A control that ends the happy path no longer carries a destination — Peter: *"'create folder'
     * still links to a different feature"* — and the completion callout was reached only through
     * that destination, so taking the link away made the walk end in silence. Worse than before:
     * the press did the right thing and said nothing at all.
     *
     * ⛔ ONE PRESS, NOT TWO. The second press existed to confirm LEAVING. There is nowhere to go.
     */
    const dest = btn.dataset && btn.dataset.goes;
    if (dest) {
      const screen = screenOf(btn);
      const here = screen && screen.closest("section.view") ? screen.closest("section.view").dataset.view : null;
      const leaving = dest.indexOf("#") > 0 ? dest.slice(0, dest.indexOf("#")) : dest;
      const sameFeature = here && (leaving === here || dest.indexOf(here + "#") === 0);
      if (sameFeature) { walk(dest, btn); return; }
      /** Armed by the first press; the second one goes. */
      if (btn.dataset.armed === "1") { disarm(); walk(dest, btn); return; }
      disarm();
      btn.dataset.armed = "1";
      armedBtn = btn;
      select(btn, dest);
      /**
       * ⛔ AND THE CALLOUT GOES WHERE THE EYE IS, NOT WHERE THE PANEL IS.
       *
       * Peter, twice: *"i hit continue, and nothing changes"*, then *"still is incomplete"*. Both
       * times the prototype had done exactly what it should — armed, and said so in the detail
       * panel. The panel sits under the drawing, and the drawing is a whole screen tall, so the
       * sentence explaining that a second press is needed rendered four hundred pixels below the
       * button that needed pressing.
       *
       * A message a person has to scroll to find is a message that did not happen. Feedback for a
       * press belongs at the press.
       */
      arm(btn, dest);
      return;
    }
    select(btn);
  });

  /**
   * ⛔ PRESSING A COMMIT MOVES THE PICTURE. Peter: *"i hit continue, and nothing changes. some text
   * below changes, but the prototype doesn't drive."*
   *
   * The state it moves to is derived from the control's own sentence — see landingsFor — and
   * stamped on the control as data-lands. One click, because this stays inside one screen; the
   * two-click rule is about LEAVING a feature, and nothing here leaves anything.
   *
   * ⛔ AND IT SAYS WHY IT MOVED, in the panel it was already going to fill. A prototype that jumps
   * without saying what it read is one a reviewer has to trust; this one can be argued with.
   */
  document.addEventListener("click", (ev) => {
    const btn = inPath(ev, "[data-lands]");
    if (!btn) return;
    const box = btn.getRootNode().host ? btn.getRootNode().host.closest(".states") : btn.closest(".states");
    if (!box) return;
    const want = btn.dataset.lands;
    const tab = box.querySelector('.state-tab[data-state="' + want + '"]');
    const frame = box.querySelector('.state-frame[data-state="' + want + '"]');
    if (!tab || !frame) return;
    /** ⛔ Where the walk was, before it moves — see the trail, above. */
    startTrail();
    for (const t of box.querySelectorAll(".state-tab")) t.classList.toggle("on", t === tab);
    for (const f of box.querySelectorAll(".state-frame")) f.hidden = f.dataset.state !== want;
    remember();
    /**
     * ⛔ PUT THE NEW SCREEN WHERE THE EYE IS. Peter: *"it's very jarring to click something like
     * 'use this folder', and scroll position puts us down past the new screen"*.
     *
     * Pressing a control near the bottom of a tall drawing swaps in a different drawing underneath
     * the same scroll position — so the reviewer is left looking at the middle of a screen they
     * have not seen the top of, which reads as nothing having happened.
     */
    const top = box.getBoundingClientRect().top + window.scrollY - 90;
    if (Math.abs(window.scrollY - top) > 40) window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    /** ⛔ Say what moved and why, or a picture that changed on its own is a picture nobody trusts. */
    const screen = box.closest("article.screen");
    const panel = screen && screen.querySelector(".pt-detail");
    if (panel) {
      panel.innerHTML =
        '<p class="pt-head"><strong>' + esc(btn.textContent.trim() || "This control") +
        '</strong> <span class="role">lands on</span> ' + esc(tab.textContent.trim()) + "</p>" +
        '<p class="pt-said"><span class="slot">because the truth says</span> ' + esc(btn.dataset.landsWhy || "") + "</p>";
      panel.hidden = false;
    }
    frame.classList.add("arrived");
    setTimeout(() => frame.classList.remove("arrived"), 900);
  });

  /**
   * ⛔ A CONTROL THAT GOES SOMEWHERE TAKES YOU THERE — that is what makes it a prototype rather
   * than a diagram. Walking the flow is how a reviewer finds the screen nobody wrote: the
   * destination either exists on this page or it does not, and either way they learn something.
   */
  document.addEventListener("dblclick", (ev) => {
    const btn = inPath(ev, "[data-goes]");
    if (!btn) return;
    ev.preventDefault();
    walk(btn.dataset.goes, btn);
  });

  document.addEventListener("click", (ev) => {
    const go = ev.target.closest("button.pt-go");
    if (!go) return;
    ev.preventDefault();
    walk(go.dataset.walk, go);
  });

  /**
   * The "press again" callout, anchored to the control that needs pressing again.
   *
   * ⛔ FIXED AND MEASURED FROM THE BUTTON, because the control is inside a shadow root and often
   * inside a scaled mock. getBoundingClientRect reads through both — it is the one coordinate
   * everything agrees on — so the callout is positioned against the viewport rather than being
   * appended somewhere that would inherit the mock's transform and land in the wrong place.
   */
  function arm(btn, dest) {
    /**
     * ⛔ CLEARS THE OLD TIP, NEVER THE ARMING — disarming here deleted the attribute the
     * CALLER had just set, two lines earlier, so a control armed itself and immediately forgot.
     * The tip appeared, which is why it looked right; the second press then read as a first one and
     * nothing ever walked.
     */
    dropTip();
    /** ⛔ A finish has no destination — it is the end, and nothing comes after it to name. */
    const to = dest == null ? "" : String(dest).split("#")[0];
    const target = to ? document.getElementById("at-" + to.replace(/[^a-z0-9]+/gi, "-")) : null;
    const name =
      (target && target.querySelector("h2") && target.querySelector("h2").textContent.trim()) || to;
    const tip = document.createElement("div");
    tip.className = "arm-tip";
    /**
     * ⛔ FINISHING FIRST, LEAVING SECOND. A control that ends the happy path is not primarily a
     * door to somewhere else — it is the end of the thing being reviewed, and saying "press again
     * to go there" as the whole message is what made completion read as being dropped.
     */
    /** ⛔ One message. Finishing is a STATE now and never reaches this — see the done frame. */
    tip.innerHTML = "<strong>" + esc(name) + "</strong><span>Press again to go there</span>";
    document.body.appendChild(tip);
    const place = () => {
      const r = btn.getBoundingClientRect();
      if (!r.width && !r.height) return disarm();
      const t = tip.getBoundingClientRect();
      /** Above the control where there is room, below it where there is not. */
      const above = r.top > t.height + 12;
      tip.style.left = Math.max(8, Math.min(window.innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2)) + "px";
      tip.style.top = (above ? r.top - t.height - 8 : r.bottom + 8) + "px";
      tip.dataset.side = above ? "above" : "below";
    };
    place();
    requestAnimationFrame(place);
    armState = { tip, place };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
  }

  let armState = null;
  /**
   * ⛔ THE ARMED CONTROL IS HELD BY REFERENCE, BECAUSE THE DOM CANNOT BE ASKED FOR IT.
   *
   * Peter: *"if i tap something that links to another product, then tap another button, then tap
   * that original button, it auto links me out"*.
   *
   * Disarming used to ask the document for every element carrying the armed attribute — and that
   * query DOES NOT CROSS A SHADOW BOUNDARY. Every control on a prototype lives inside one, so it
   * matched nothing,
   * every time. The attribute stayed set on a button nobody could see it on: tap A, tap anything
   * else, tap A again, and the second press read as the confirmation of the first and walked
   * straight out of the feature. The two-press rule was one press with extra steps.
   */
  let armedBtn = null;
  /** The floating tip alone — arming is a separate fact, and arming must not clear it. */
  function dropTip() {
    if (!armState) return;
    window.removeEventListener("scroll", armState.place, true);
    window.removeEventListener("resize", armState.place);
    armState.tip.remove();
    armState = null;
  }

  function disarm() {
    if (armedBtn) {
      /** ⛔ By reference. Asking the document for it is what failed. */
      delete armedBtn.dataset.armed;
      armedBtn = null;
    }
    dropTip();
  }

  /**
   * ⛔ ANY PRESS THAT IS NOT THE SAME CONTROL CANCELS IT — and the guard that used to sit here,
   * returning early when no tip was showing, was the second half of the bug: a tip removed any
   * other way left the attribute armed forever with nothing watching to clear it.
   *
   * ⛔ CAPTURE PHASE, AND COMPOSED. A click inside a shadow root reports the HOST as its target
   * unless the path is read, so inPath is what sees the real control.
   */
  document.addEventListener("click", (ev) => {
    if (!armedBtn) return;
    const btn = inPath(ev, "[data-goes]");
    if (btn !== armedBtn) disarm();
  }, true);

  /**
   * ⛔ A WALK THAT CANNOT GO BACK IS A WALK NOBODY EXPLORES.
   *
   * Peter: *"need to be able to go 'back' from the deal creation screen. perhaps we need
   * breadcrumbs for the prototypes"*.
   *
   * The prototype walks forward well — a press moves a state, a second press leaves a feature — and
   * had no memory at all. Somebody who followed New Deal into creating a deal was simply there,
   * with the browser's back button the only way out, which leaves the page rather than the walk.
   *
   * ⛔ THE WALK, NOT THE SITE. The page already has a breadcrumb — Product › CRE › Deal management
   * — and that is where a thing SITS, which never changes. This is where somebody has BEEN, which
   * is a different question and the one that was unanswerable.
   *
   * ⛔ AND IT IS NOT HISTORY. Stepping back truncates: having gone A → B → C, going back to A means
   * the walk is now just A. A trail that kept C after you left it would offer a forward step
   * nobody took.
   */
  let trail = [];

  const trailBars = () => document.querySelectorAll("nav.walk-trail");

  const paintTrail = () => {
    for (const bar of trailBars()) {
      if (trail.length < 2) { bar.hidden = true; bar.innerHTML = ""; continue; }
      bar.hidden = false;
      bar.innerHTML = trail
        .map((step, i) =>
          i === trail.length - 1
            ? '<span class="wt-here">' + esc(step.label) + "</span>"
            : '<button type="button" class="wt-back" data-step="' + i + '">' + esc(step.label) + "</button>"
        )
        .join('<span class="wt-sep">›</span>');
    }
  };

  /** Where the walk is right now, so stepping back can put it there again. */
  const here = () => {
    const screen = document.querySelector("article.screen:not([hidden])");
    const view = document.querySelector("section.view:not([hidden])");
    const box = screen && screen.querySelector(".states");
    const on = box && box.querySelector(".state-tab.on");
    return {
      view: view ? view.dataset.view : null,
      state: on ? on.dataset.state : null,
      label: on && on.dataset.state !== "0"
        ? on.textContent.trim()
        : (view && view.querySelector("h2") ? view.querySelector("h2").textContent.trim() : "here"),
    };
  };

  const remember = () => {
    const at = here();
    const last = trail[trail.length - 1];
    /** ⛔ Never twice in a row. Pressing a control that lands where you already are is not a step. */
    if (last && last.view === at.view && last.state === at.state) return;
    trail.push(at);
    paintTrail();
  };

  /** ⛔ Start the trail where somebody begins, or the first step has nothing to go back to. */
  const startTrail = () => { if (!trail.length) trail.push(here()); };

  document.addEventListener("click", (ev) => {
    const back = ev.target.closest && ev.target.closest("button.wt-back");
    if (!back) return;
    ev.preventDefault();
    const i = Number(back.dataset.step);
    const step = trail[i];
    if (!step) return;
    /** ⛔ Truncate. Going back to A after A → B → C makes the walk A, not A with C still ahead. */
    trail = trail.slice(0, i + 1);
    if (step.view) {
      const go = document.querySelector('nav.scopes a[data-goto="' + CSS.escape(step.view) + '"]');
      if (go) go.click();
    }
    if (step.state != null) {
      const box = document.querySelector("article.screen:not([hidden]) .states");
      const tab = box && box.querySelector('.state-tab[data-state="' + step.state + '"]');
      if (tab) tab.click();
    }
    /** ⛔ After the tab click, which would otherwise push the place we just came back to. */
    trail = trail.slice(0, i + 1);
    paintTrail();
  });

  function walk(dest, from) {
    startTrail();
    const bare = String(dest).split("#")[0];
    const target =
      document.querySelector('article.screen[data-screen="' + CSS.escape(bare) + '"]') ||
      document.querySelector('article.screen[data-screen="' + CSS.escape(String(dest).split("#").pop()) + '"]') ||
      document.getElementById("at-" + bare.replace(/[^a-z0-9]+/gi, "-"));
    if (!target) {
      const panel = screenOf(from) && screenOf(from).querySelector(".pt-detail");
      if (panel) {
        panel.innerHTML = '<p class="none">This goes to <code>' + esc(dest) + '</code>, which is not on this page. Nobody has written it here.</p>';
        panel.hidden = false;
      }
      return;
    }
    // Make sure the view holding it is the one on screen before scrolling to it.
    const view = target.closest("section.view");
    if (view && view.hidden) {
      const go = document.querySelector('nav.scopes a[data-goto="' + CSS.escape(view.dataset.view) + '"]');
      if (go) go.click();
    }
    target.scrollIntoView({ block: "center" });
    /** ⛔ Leaving a feature is the step somebody most needs to come back from. */
    remember();
    target.classList.add("arrived");
    setTimeout(() => target.classList.remove("arrived"), 1400);
  }

  /**
   * ⛔ THE SCREEN, IN THE CARD, FOCUSED ON WHAT THE SENTENCE IS ABOUT.
   *
   * Cloned from the screen's one home rather than rendered again: a hundred cards each carrying
   * their own copy of the markup would put the same data-part in the DOM a hundred times, and
   * selecting a control would resolve to whichever came first — possibly inside a hidden view.
   *
   * ⛔ LAZILY. Cloning eleven screens into a hundred and twenty-six cards on load is a great deal
   * of DOM for cards nobody has scrolled to yet, so each one is filled the first time it comes near
   * the viewport.
   */
  /**
   * ⛔ PUT ON THE WINDOW BECAUSE TWO OTHER SCRIPT BLOCKS NEED IT, AND THEY ARE DIFFERENT SCOPES.
   *
   * This lives inside its own IIFE. The row-toggle handler and the live refresh are both in the
   * acts script, so calling it there by name is a ReferenceError, which does not fail loudly: it
   * kills the rest of that block, so the stream, the presence bar and the refresh all stop, on a
   * page that looks perfectly fine. That has happened twice in this file already, with the escape helper.
   */
  const fillCardScreen = (fig) => {
    if (fig.dataset.filled) return;
    const viewId = fig.dataset.of;
    const src = document.querySelector('article.screen[data-screen="' + CSS.escape(viewId) + '"]');
    if (!src) {
      fig.dataset.filled = "1";
      // ⛔ Say so. An empty frame reads as a screen with nothing on it.
      fig.insertAdjacentHTML("beforeend", '<p class="none">This screen is not on this page.</p>');
      return;
    }
    fig.dataset.filled = "1";

    /**
     * ⛔ THE FRAME THIS CARD ASKED FOR, not whatever picture comes first.
     *
     * A view renders its default frame plus one per state, and every citation of a screen used to
     * clone the default — so the states were visible to somebody clicking tabs and invisible to
     * everything that pointed at a screen.
     */
    const want = fig.dataset.frame;
    const box = want && src.querySelector('.state-frame[data-state="' + want + '"]');
    const proto = (box || src).querySelector(".proto") || src.querySelector(".proto");
    if (!proto) {
      fig.insertAdjacentHTML("beforeend", '<p class="none">Nobody has drawn this screen.</p>');
      return;
    }

    const holder = document.createElement("div");
    holder.className = "card-proto";

    if (proto.classList.contains("html")) {
      /**
       * A generated screen lives in a shadow root, so the clone needs its own — and the same
       * adopted stylesheet, which is why that is a shared object rather than a string.
       */
      const host = document.createElement("div");
      host.className = "proto html";
      /** The clone wears what the original wore, or it is a different product in the same card. */
      if (proto.getAttribute("data-theme")) host.setAttribute("data-theme", proto.getAttribute("data-theme"));
      const root = host.attachShadow({ mode: "open" });
      const from = proto.shadowRoot;
      if (from) {
        if (from.adoptedStyleSheets && from.adoptedStyleSheets.length) root.adoptedStyleSheets = from.adoptedStyleSheets;
        for (const st of from.querySelectorAll("style")) root.appendChild(st.cloneNode(true));
        for (const node of from.children) {
          if (node.tagName === "STYLE") continue;
          root.appendChild(node.cloneNode(true));
        }
      }
      neutralise(root, fig.dataset.focus);
      holder.appendChild(host);
    } else {
      const pre = proto.cloneNode(true);
      neutralise(pre, fig.dataset.focus);
      holder.appendChild(pre);
    }
    fig.appendChild(holder);
  };

  /**
   * ⛔ A COPY IS NOT A CONTROL. Strip every id and data-part from the clone: leaving them would give
   * the page duplicate ids and make a click inside a card select a control on a screen somewhere
   * else. What stays is the focus mark, which is the entire point of the copy.
   */
  function neutralise(root, focus) {
    for (const el of root.querySelectorAll("[id]")) el.removeAttribute("id");
    for (const el of root.querySelectorAll("[data-part]")) {
      const part = el.dataset.part;
      el.removeAttribute("data-part");
      el.removeAttribute("data-goes");
      el.classList.remove("on");
      if (focus && part === focus) el.classList.add("focus");
      if (el.tagName === "BUTTON" || el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") el.disabled = true;
      el.setAttribute("tabindex", "-1");
    }
    for (const el of root.querySelectorAll("button, input, select, textarea, a")) {
      el.setAttribute("tabindex", "-1");
      if ("disabled" in el) el.disabled = true;
    }
  }

  window.fillCardScreen = fillCardScreen;

  const figures = [...document.querySelectorAll("figure.card-screen")];
  if (figures.length) {
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries)
            if (e.isIntersecting) {
              fillCardScreen(e.target);
              io.unobserve(e.target);
            }
        },
        { rootMargin: "400px" }
      );
      for (const f of figures) io.observe(f);
    } else {
      for (const f of figures) fillCardScreen(f);
    }
  }

  /**
   * ⛔ PER CARD: SHOW ME WHERE. A behaviour card names the control it is about; this walks to that
   * control on the screen and selects it, so the sentence and the thing it is about are on screen
   * together. Reading "Deal row on CRE Deals — refuses" without the row in front of you is the
   * exact complaint that started this.
   */
  document.addEventListener("click", (ev) => {
    const link = ev.target.closest("[data-show-part]");
    if (!link) return;
    ev.preventDefault();
    const [viewId, partId] = link.dataset.showPart.split("/");
    const screen = document.querySelector('article.screen[data-screen="' + CSS.escape(viewId) + '"]');
    if (!screen) return;
    const view = screen.closest("section.view");
    if (view && view.hidden) {
      const go = document.querySelector('nav.scopes a[data-goto="' + CSS.escape(view.dataset.view) + '"]');
      if (go) go.click();
    }
    const btn = partId && controlsIn(screen).find((c) => c.dataset.part === partId);
    screen.scrollIntoView({ block: "center" });
    // ⛔ Say where you landed. Switching the view and scrolling with no marker leaves the reader
    // looking at a different page with no idea which of its screens they asked for.
    screen.classList.add("arrived");
    setTimeout(() => screen.classList.remove("arrived"), 1400);
    // ⛔ Clear first. "Show me the screen" with a control still selected from a previous card left
    // the wrong thing highlighted beside the right sentence.
    clear(screen);
    if (btn) select(btn);
  });
})();
</script>`;

/**
 * ⛔ DRIVING THE PROTOTYPE. Picking a screen, isolating its mock, and turning a press into the
 * sentences that govern that control.
 *
 * The truth is read out of the DOM this page already carries — `data-proto-says` — rather than
 * fetched or duplicated into a second structure. A second copy is a copy that goes stale the first
 * time a sentence is reworded, which is the whole hand-authoring trap one layer over.
 */
const DRIVE = `<script>
/**
 * ⛔ CLOSING IS WIRED FIRST, AT THE DOCUMENT, AND NEVER LOCKS THE PAGE.
 *
 * Peter: *"now all i see is the prototype, i can't close it, do anything… you should NEVER STOP and
 * leave this in a state like this."*
 *
 * The opened screen is a full-viewport overlay whose Close button was wired at the END of a long
 * script — so anything throwing before that point left a page that could be covered and not
 * uncovered. It also set body overflow to hidden, which turns a stuck overlay into a stuck page.
 *
 * So: the escape is registered before any of the work that could fail, it is delegated rather than
 * bound to an element that may not exist yet, Escape and a press on the backdrop both close it, and
 * the page is never locked. A surface that can trap a reviewer is worse than one that does nothing.
 */
(function () {
  const shut = () => {
    const box = document.querySelector(".pbig");
    if (box) box.hidden = true;
    document.body.style.overflow = "";
  };
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") shut(); });
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    /** The button, or the backdrop itself — never a press inside the screen. */
    if (t.closest(".pbig-x") || t.classList.contains("pbig")) shut();
  });
})();
(function () {
  /**
   * ⛔ WALKING A SCREEN THROUGH ITS STATES. Every drawing is already in the page, one per state, so
   * this only swaps which is shown — no fetching, no second source, and the states cannot drift
   * from the screen because the same pass wrote them.
   */
  document.addEventListener("click", (ev) => {
    const tab = ev.target instanceof Element ? ev.target.closest(".state-tab") : null;
    if (!tab) return;
    const box = tab.closest(".states");
    if (!box) return;
    const want = tab.dataset.state;
    for (const t of box.querySelectorAll(".state-tab")) t.classList.toggle("on", t === tab);
    for (const f of box.querySelectorAll(".state-frame")) f.hidden = f.dataset.state !== want;
  });

  const board = document.querySelector(".pboard");
  if (!board) return;
  const says = JSON.parse(document.getElementById("proto-says").textContent || "{}");
  const titles = JSON.parse(document.getElementById("proto-titles").textContent || "{}");
  const big = document.querySelector(".pbig");
  const bigStage = big.querySelector(".pbig-stage");
  const bigTruth = big.querySelector(".pbig-truth");
  const bigTitle = big.querySelector(".pbig-t");
  /**
   * ⛔ THE APP'S CSS IS ADOPTED, NOT APPENDED — and getting that wrong was visible from across the
   * room. Cloning the app-css template into a shadow root puts 370KB of stylesheet SOURCE in as a
   * text node, so every tile rendered as a wall of colour-token declarations. The template
   * holds raw CSS, not a <style> element, because it is parsed once here and shared by reference.
   */
  let sheet = null;
  (function () {
    const tpl = document.getElementById("app-css");
    if (!tpl) return;
    /** ⛔ textContent, not innerHTML — see adoptAppCss above; escaping drops every "&gt;" rule. */
    const css = tpl.content ? tpl.content.textContent : tpl.textContent;
    if (!css.trim()) return;
    try { sheet = new CSSStyleSheet(); sheet.replaceSync(css); } catch (e) { sheet = null; }
  })();

  /**
   * ⛔ THE MARKER STYLES HAVE TO CROSS THE SHADOW BOUNDARY TOO, and this is why three rows of a
   * deals list were in the document, correctly nested, and still invisible.
   *
   * A shadow root does not inherit this page's stylesheet. The mocks adopt the APPLICATION's CSS —
   * which knows nothing about productos-value, productos-icon or productos-unknown, because those
   * are ours. So every value bar computed as a bare inline span with no width and no height, and a
   * table with three rows of eight cells collapsed to nothing. The markup was right the whole time.
   */
  let marks = null;
  try {
    marks = new CSSStyleSheet();
    marks.replaceSync(
      /**
       * ⛔ A NEUTRAL GREY, NOT THE TEXT COLOUR — and this is the black overlay nobody could explain.
       *
       * A bar painted in the text colour at 30% is near-black on a screen whose text is near-black.
       * The deals list has about thirty of them and looks like a list; the deal workspace has ONE
       * HUNDRED AND SIXTY-SIX, packed tight, and at tile scale they merge into a solid black field.
       * It read as an overlay covering the screen, and I spent three rounds looking for an overlay:
       * checking backgrounds, filters, blend modes, scrims, dark-theme media queries. There was no
       * overlay. It was the placeholders.
       *
       * A fixed light grey is the same on every screen no matter what colour its text is, and stays
       * legible as structure when there are hundreds of them.
       */
      ".productos-value{display:inline-block;min-width:3.2em;height:.6em;border-radius:3px;background:rgba(130,128,124,.20);vertical-align:-.05em}" +
      "td .productos-value,th .productos-value{min-width:4.5em}" +
      "tr:nth-child(2n) .productos-value{min-width:5.5em}" +
      "tr:nth-child(3n) .productos-value{min-width:3.6em}" +
      /**
       * ⛔ A DRAWN TABLE NEEDS CELL SPACING OR ITS ROWS OVERLAP. Inlining a Td component loses the
       * padding it would have applied, so three rows of real text stacked into twelve pixels and
       * read as a grey smear. This is scoped to mock shadow roots, so it cannot touch the review
       * page around them, and it only fills in what the reconstruction dropped.
       */
      /**
       * ⛔ A MODAL IN A DRAWING MUST NOT TAKE OVER THE PAGE. A screen that composes a Modal inlines
       * its fixed-position overlay, and a fixed element positions against the VIEWPORT even from
       * inside a shadow root — so opening the deal workspace covered the whole review surface with a
       * folder picker. Containment makes the mock its own containing block, so anything fixed inside
       * it is fixed to the mock. No rewriting of their CSS, which is the thing that fails quietly.
       */
      ".productos-mock{contain:layout paint;position:relative;min-height:0}" +
      /** ⛔ A screen built for a viewport must not claim one inside a card. */
      ".productos-mock .min-h-screen,.productos-mock [class*=min-h-]{min-height:0!important}" +
      /**
       * ⛔ A BACKDROP IS NOT PART OF THE SCREEN. Every drawing composes something that renders a
       * full-bleed dimming layer — a modal's scrim, a drawer's overlay — and inlined unconditionally
       * it painted all twelve screens on the board black. A reviewer cannot judge a screen through a
       * scrim, and the scrim belongs to a state nobody opened.
       */
      "[class*=inset-0][class*=bg-black],[class*=bg-black\\/],[class*=backdrop]{display:none!important}" +
      "td,th{padding:.3rem .5rem;line-height:1.35;vertical-align:middle}" +
      "table{border-collapse:collapse;width:100%}" +
      /* A value we supplied, not one the product produced — legible, and never mistakable. */
      ".productos-sample{text-decoration:underline dotted rgba(120,113,108,.55);text-underline-offset:2px}" +
      ".productos-icon{display:inline-block;width:1em;height:1em;vertical-align:-.12em;border-radius:2px;background:rgba(130,128,124,.28)}" +
      /* ⛔ Only an EMPTY placeholder is painted. A wrapper that could not be read still contains the
         real screen, and hatching it drew orange stripes across the whole deals table. */
      /* ⛔ No colour on a wrapper either: the value bars draw in currentColor, so an unresolved
         wrapper turned every row of the deals table amber. */
      ".productos-unknown{border-radius:2px}" +
      ".productos-unknown:empty,.productos-unknown:not(:has(*)){display:inline-block;min-width:1.2em;" +
        "color:#92400e;background:repeating-linear-gradient(45deg,rgba(245,158,11,.18) 0 4px,transparent 4px 8px);outline:1px dashed rgba(245,158,11,.6)}" +
      /* ⛔ Only a component with no layout of its own gets the placeholder box. One carrying the
         app's classes keeps them — forcing display:block on a flex child is how a toolbar became a
         column. */
      /* ⛔ A named slot is part of the sentence; only a nameless one wears warning stripes. */
      ".productos-slot{font-style:italic;opacity:.75;text-decoration:underline dotted currentColor;text-underline-offset:2px}" +
      "[data-component]:not([class*=' ']){display:inline-block;padding:.1rem .3rem;font-size:.75rem}"
    );
  } catch (e) { marks = null; }

  /**
   * ⛔ EACH DRAWING IN ITS OWN SHADOW ROOT. They are written in the application's class names, and
   * loose in this document its stylesheet restyles the review surface around them. That happened
   * once and the page came apart.
   */
  /**
   * The one copy of a drawing, by scope#view.
   *
   * ⛔ AN ATTRIBUTE SELECTOR BUILT BY CONCATENATION IS WHAT THE TWO OLDER LOOKUPS DO, and a scope id
   * is author-supplied. CSS.escape where it exists, and a scan otherwise — a ref containing a
   * quote would otherwise build a selector that throws and take the whole sweep with it.
   */
  /**
   * ⛔ THE BANK, OR A FETCH, BEFORE GIVING UP. bankedMock answers only for drawings already here;
   * a screen reached by pressing a tile or by walking may not be yet.
   */
  async function ensureMock(ref) {
    const here = bankedMock(ref);
    if (here) return here;
    if (typeof window.__posEnsureMock === "function") {
      try { await window.__posEnsureMock(ref); } catch (e) { /* offline: the stage says so below */ }
    }
    return bankedMock(ref);
  }

  /**
   * ⛔ CSS.escape IS FOR AN IDENTIFIER, NOT FOR THE INSIDE OF A QUOTED ATTRIBUTE VALUE — and every
   * ref in this model contains a #.
   *
   * CSS.escape("thing-2#thing-2-screen-1") returns thing-2\\#thing-2-screen-1, which is right for
   * a selector like #id and wrong inside [data-mock="..."]: the quotes already make it a string, so
   * the backslash is matched literally and the selector finds nothing. The bank held the drawing,
   * the host named it, and the lookup returned null every time — 22 thumbnails fetched correctly
   * and left blank, with no error anywhere.
   *
   * ⛔ FOUND BY READING ONE INSTANCE. The aggregates all agreed and all looked plausible: templates
   * in the bank went up, lazy hosts went down, hydrated stayed at zero. Three probes counted
   * different things before one of them asked what the selector actually was.
   *
   * In a quoted value only a backslash and the quote itself need escaping.
   */
  /**
   * Find a node by what an attribute equals, without building a selector.
   *
   * ⛔ NO SELECTOR, BECAUSE ESCAPING ONE CORRECTLY HERE IS TWO MISTAKES DEEP AND I MADE BOTH.
   *
   * First CSS.escape, which is for an IDENTIFIER: every ref in this model contains a #, and
   * CSS.escape turns it into a backslash-# that is matched literally inside [data-mock="..."] —
   * where the quotes already make the value a string. The bank held the drawing, the host named it,
   * and the lookup returned null every time. 22 thumbnails fetched correctly and stayed blank, with
   * no error anywhere.
   *
   * Then a hand-written escaper, which was correct JavaScript and wrong HERE: this script is a
   * TypeScript template literal, so every backslash in it is halved on the way out and the emitted
   * regex was invalid. The script threw before defining anything.
   *
   * Comparing the attribute removes both. A linear scan of a few hundred templates costs nothing
   * next to the request that fetched them.
   */
  const byAttr = (within, tag, attr, value) => {
    if (!within || value == null) return null;
    for (const el of within.querySelectorAll(tag)) if (el.getAttribute(attr) === value) return el;
    return null;
  };

  function bankedMock(ref) {
    return byAttr(document.getElementById("mock-bank"), "template", "data-mock", ref);
  }

  function hydrate(host) {
    /**
     * ⛔ THE DRAWING MAY NOT BE INSIDE THIS HOST. Every place a screen appears used to carry its own
     * verbatim copy of the drawing, and one of those places recurs with nesting depth — so a
     * Bilrost view was on the wire five times. They now carry only data-mock and clone the one
     * copy in the bank. A host with its own template still wins, because the state frames have
     * their own pictures and must not be served the base drawing.
     */
    let tpl = host.querySelector("template");
    if (!tpl) {
      const ref = host.getAttribute("data-mock");
      if (ref) tpl = bankedMock(ref);
    }
    if (!tpl || host.shadowRoot) return host.shadowRoot;
    /**
     * ⛔ THE HOST OPTS INTO THE PRODUCT'S THEME BEFORE ITS SHADOW ROOT EXISTS. The design system is
     * scoped to this attribute and is inert without it, so a tile hydrated without it renders in
     * the stylesheet's fallbacks — which looks like a styled screen of some other product.
     */
    const themed = document.getElementById("app-css");
    const scheme = themed && themed.getAttribute("data-theme");
    if (scheme) host.setAttribute("data-theme", scheme);
    const root = host.attachShadow({ mode: "open" });
    if ("adoptedStyleSheets" in root) root.adoptedStyleSheets = [sheet, marks, ...root.adoptedStyleSheets].filter(Boolean);
    else {
      const src = document.getElementById("app-css");
      /** ⛔ textContent on the way out too — innerHTML here drops every child combinator, same bug. */
      if (src) {
        const st = document.createElement("style");
        st.textContent = src.content ? src.content.textContent : src.textContent;
        root.appendChild(st);
      }
    }
    root.appendChild(tpl.content.cloneNode(true));
    return root;
  }
  /**
   * ⛔ EVERY MOCK ON THE PAGE, not only the ones on the board. The screen map puts the same drawings
   * in its nodes, and hydrating only the board left fifty-nine of them as inert <template> tags —
   * present in the markup, invisible on the page, which is the third time this exact shape of bug
   * has cost an afternoon.
   */
  /**
   * ⛔ A SCRIM IS FOUND BY WHAT IT COMPUTES TO, NOT BY ITS CLASS NAME.
   *
   * Every one of the twelve screens on the board rendered black, because each composes something
   * with a full-bleed dimming layer. Matching Tailwind's black-with-opacity class caught none: this
   * design system forbids raw palette classes and uses semantic roles, so the class says nothing
   * and only the computed colour does. A reviewer cannot judge a screen through a scrim, and the
   * scrim belongs to a state nobody opened.
   */
  const unscrim = (root) => {
    if (!root) return;
    const host = root.host;
    const wide = host ? host.getBoundingClientRect().width * 0.8 : 0;
    for (const el of root.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "absolute") continue;
      const m = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(cs.backgroundColor);
      if (!m) continue;
      const dark = Number(m[1]) < 60 && Number(m[2]) < 60 && Number(m[3]) < 60;
      const translucent = m[4] !== undefined && Number(m[4]) > 0 && Number(m[4]) < 1;
      if (!dark || !translucent) continue;
      if (el.getBoundingClientRect().width < wide) continue;
      el.style.display = "none";
    }
  };

  const hydrateAll = () => {
    for (const host of document.querySelectorAll(".proto-mock")) hydrate(host);
    /** After layout, or every rect is zero and nothing qualifies as full-bleed. */
    requestAnimationFrame(() => { for (const h of document.querySelectorAll(".proto-mock")) unscrim(h.shadowRoot); });
  };
  hydrateAll();

  /**
   * ⛔ ONE SOURCE OF STYLE FOR EVERY MOCK ON THE PAGE, because there were two and they diverged.
   *
   * The prototype tiles adopt the application's stylesheet here. The screens embedded in a feature
   * view are hydrated by older code that appends a 3KB marker <style> and no app CSS — so half the
   * mocks on this page were styled by the product and half by nothing. The deals list in the
   * Product view had no flex utility at all: its toolbar stacked, its spacing vanished, buttons were
   * grey boxes. Peter: *"does this look right?"*. Thirteen hosts adopted, thirteen not.
   *
   * Rather than keep two paths in step, every host is swept: anything with a shadow root and no
   * adopted sheet gets the same two sheets the tiles get. Whoever built the root, the styling is the
   * same styling.
   */
  const dressAll = () => {
    hydrateAll();
    for (const h of document.querySelectorAll(".proto-mock, .proto.html, [data-mock]")) {
      const root = h.shadowRoot;
      if (!root || !("adoptedStyleSheets" in root)) continue;
      /**
       * ⛔ ENSURE BOTH SHEETS, DO NOT SKIP A ROOT THAT HAS ONE.
       *
       * The older path adopts the application's stylesheet only. Skipping any root that already had
       * a sheet therefore left every mock outside the board with the app CSS and NO marker styles —
       * so the value bars in a table row computed as bare inline spans with no size, and the deals
       * list rendered its rows as nothing at all. Correct markup, correct app styling, invisible
       * content: the same failure as before, arrived at from the opposite direction.
       */
      const have = [...root.adoptedStyleSheets];
      let changed = false;
      for (const want of [sheet, marks]) {
        if (want && !have.includes(want)) { have.push(want); changed = true; }
      }
      if (changed) root.adoptedStyleSheets = have;
    }
  };
  dressAll();
  /** Those roots are built on demand when a card is opened, so sweep again as they appear. */
  new MutationObserver(dressAll).observe(document.body, { childList: true, subtree: true });

  function esc(t) { const d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }

  function truthFor(screen, part) {
    const rows = (says[screen] || []).filter((r) => !part || !r.part || r.part === part);
    bigTruth.innerHTML =
      (part ? "<h4>" + esc(part) + "</h4>" : "<h4>Everything about this screen</h4>") +
      (rows.length
        ? "<ul>" + rows.map((r) => "<li><span class='slot'>" + esc(r.slot) + "</span><br>" + esc(r.text) + "</li>").join("") + "</ul>"
        : '<p class="none">Nothing in the corpus says anything about this control. That is a gap, not a bug.</p>');
  }

  async function open(screen) {
    bigTitle.textContent = titles[screen] || screen;
    bigStage.innerHTML = "";
    const host = document.createElement("div");
    host.className = "proto-mock";
    /**
     * ⛔ FROM THE BANK, BECAUSE A TILE NO LONGER CARRIES ITS OWN COPY. It used to be cloned from
     * the tile's template so the big view and the tile could not disagree; they still cannot —
     * there is now exactly one copy of each drawing on the page and both read it.
     */
    const src = await ensureMock(screen);
    if (src) {
      const tpl = document.createElement("template");
      tpl.innerHTML = src.innerHTML;
      host.appendChild(tpl);
    }
    bigStage.appendChild(host);
    const root = hydrate(host);
    if (root)
      root.addEventListener("click", (ev) => {
        for (const el of ev.composedPath()) {
          const id = el instanceof Element && el.getAttribute ? el.getAttribute("data-part") : null;
          if (id) { truthFor(screen, id); ev.preventDefault(); return; }
        }
      });
    truthFor(screen, null);
    big.hidden = false;
  }

  board.addEventListener("click", (ev) => {
    const t = ev.target instanceof Element ? ev.target.closest(".ptile") : null;
    if (t) open(t.dataset.proto);
  });

  /**
   * ⛔ THE WALK LIVES IN HERE ON PURPOSE: it reuses hydrate() and the board's own templates rather
   * than carrying a second copy of every screen. One corpus is 7 MB with one copy; two would be
   * fourteen, to show one screen at a time.
   */
  (function walkSurface() {
    const data = document.getElementById("walk-data");
    const stage = document.getElementById("walk-stage");
    if (!data || !stage) return;
    const walk = JSON.parse(data.textContent || "{}");
    const where = document.getElementById("walk-where");
    const backBtn = document.getElementById("walk-back");
    const groups = {
      holds: document.getElementById("walk-holds"),
      exits: document.getElementById("walk-exits"),
      dangling: document.getElementById("walk-dangling"),
    };
    const trail = [];
    /** Which way through the product is being walked. The first is the one it opens on. */
    let current = (walk.prototypes || [])[0] || null;

    function choose(id) {
      const next = (walk.prototypes || []).find((p) => p.id === id);
      if (!next) return;
      current = next;
      trail.length = 0;
      for (const b of document.querySelectorAll("[data-walk-proto]"))
        b.classList.toggle("on", b.dataset.walkProto === id);
      go(next.startsAt, false);
    }

    document.addEventListener("click", (ev) => {
      const b = ev.target instanceof Element ? ev.target.closest("[data-walk-proto]") : null;
      if (b) { ev.preventDefault(); choose(b.dataset.walkProto); }
    });

    function moveButton(ref, label, sub) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wmove";
      b.dataset.walkTo = ref || "";
      if (!ref) b.disabled = true;
      b.textContent = label;
      if (sub) { const m = document.createElement("span"); m.className = "wmove-m"; m.textContent = sub; b.appendChild(m); }
      return b;
    }

    function fill(group, items) {
      const box = group.querySelector(".wmoves");
      box.innerHTML = "";
      for (const it of items) box.appendChild(moveButton(it.ref, it.label, it.sub));
      group.hidden = items.length === 0;
    }

    /**
     * ⛔ async, BECAUSE IT AWAITS A DRAWING NOW — AND FORGETTING THIS KILLED THE WHOLE SCRIPT.
     *
     * await inside a non-async function is a SyntaxError, and this script is a string: the
     * TypeScript build compiles happily and the browser discards the entire DRIVE script at parse
     * time. Every mock on the page stayed an inert template, the big view would not open, and
     * nothing anywhere reported an error. Found by pressing a tile and watching nothing happen.
     */
    async function go(ref, remember) {
      const step = walk.steps[ref];
      if (!step) return;
      if (remember !== false) { const cur = stage.dataset.at; if (cur && cur !== ref) trail.push(cur); }
      stage.dataset.at = ref;
      backBtn.hidden = trail.length === 0;

      /** Where you are, in the product's own words — area, then feature, then screen. */
      where.textContent = [step.area, step.scope, step.title].filter(Boolean).join("  \u25b8  ");

      stage.innerHTML = "";
      const src = await ensureMock(ref);
      if (src) {
        const host = document.createElement("div");
        host.className = "proto-mock";
        const tpl = document.createElement("template");
        /**
         * ⛔ THE SCREEN INSIDE THE PRODUCT'S OWN CHROME.
         *
         * Drawings carry no shell on purpose — a screen under review wants the room, and the same
         * menu on all seventeen says nothing. A WALK is the opposite case: the menu is how you get
         * around, so with no shell there was nothing to press and "Back to CRE Deals" did nothing.
         * The chrome is the prototype's, not the product's: an unauthenticated flow has none.
         */
        const shell = (current && current.shell) || "";
        tpl.innerHTML = shell.includes("<!--screen-->")
          ? shell.replace("<!--screen-->", src.innerHTML)
          : src.innerHTML;
        host.appendChild(tpl);
        stage.appendChild(host);
        const root = hydrate(host);
        /**
         * ⛔ THE MENU MOVES THE WALK. Each item was aimed at the screen it names when the chrome was
         * drawn; here the press is caught inside the shadow root and turned into a step. A nav item
         * nothing resolved is left alone — it is real chrome, and pretending it navigates would be
         * a prototype lying about the product.
         */
        if (root && current && current.nav)
          root.addEventListener("click", (ev) => {
            for (const el of ev.composedPath()) {
              if (!(el instanceof Element) || !el.textContent) continue;
              const label = el.textContent.replace(/\s+/g, " ").trim();
              const hit = current.nav.find((n) => n.to && n.label === label);
              if (hit) { ev.preventDefault(); go(hit.to, true); return; }
            }
          });
      } else {
        /** ⛔ Said plainly. A blank stage reads as broken; "no picture" is a fact about the corpus. */
        const p = document.createElement("p");
        p.className = "wnone";
        p.textContent = "No picture of this screen yet — nothing renders it and nothing has drawn it.";
        stage.appendChild(p);
      }

      fill(groups.holds, (step.holds || []).map((r) => ({ ref: r, label: (walk.steps[r] || {}).title || r })));
      fill(groups.exits, (step.exits || []).map((e) => ({ ref: e.to, label: e.label, sub: (walk.steps[e.to] || {}).title || e.to })));
      /**
       * ⛔ SHOWN, NOT HIDDEN, AND NOT PRESSABLE. These are controls that commit and that nothing
       * says a destination for — the actionable gap in the truth. Drawn as dead buttons so a
       * reviewer sees exactly how far the product is from being walkable end to end.
       */
      fill(groups.dangling, (step.dangling || []).map((d) => ({ ref: "", label: d.label, sub: "nothing says where this lands" })));
    }

    document.addEventListener("click", (ev) => {
      const el = ev.target instanceof Element ? ev.target.closest("[data-walk-to]") : null;
      if (!el || !el.dataset.walkTo) return;
      ev.preventDefault();
      go(el.dataset.walkTo, true);
      const sec = document.getElementById("view-walk");
      if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: "start" });
    });

    backBtn.addEventListener("click", () => {
      const prev = trail.pop();
      if (prev) go(prev, false);
      backBtn.hidden = trail.length === 0;
    });

    const opensOn = (current && current.startsAt && walk.steps[current.startsAt] && current.startsAt)
      || (walk.entries && walk.entries[0]);
    if (opensOn) go(opensOn, false);
  })();

})();
</script>`;

const VIEW_SWITCH = `<script>
(function () {
  /**
   * ⛔ ASKED FOR AT THE MOMENT OF THE SWITCH, NOT CAPTURED ONCE AT LOAD.
   *
   * Peter: *"I'm tapping on 'Versioned Inputs', which 'states nothing of its own'. it incorrectly
   * does not route anywhere... should not just keep what is rendered on the screen"*.
   *
   * A snapshot was correct until the page started deferring sections. fill() REPLACES a deferred
   * section with a fresh element off the wire, so a list taken at load keeps the detached stub and
   * has never heard of what replaced it. Two consequences, and the second is the one he saw:
   *
   *   · navigating AWAY from a filled section never hides it — it has no entry to set hidden on,
   *     so it stays on screen underneath the next one
   *   · navigating BACK to it matches nothing, and the no-match branch below un-hides EVERY view
   *     on the page. On this corpus that is 130 sections at once, which reads exactly like a press
   *     that did nothing
   *
   * ⛔ AND A SINGLE PRESS WORKS, WHICH IS WHY NOTHING CAUGHT IT. Driven on the live page, pressing
   * this row routes, fetches and renders correctly — the markup is right, the anchor resolves, the
   * endpoint answers 200 with the container's own page. The defect needs a SEQUENCE: go there, go
   * elsewhere, come back. scripts/probe-goto.mjs is that sequence.
   */
  const views = () => [...document.querySelectorAll("section.view")];
  if (views().length < 2) return;
  const menu = [...document.querySelectorAll("nav.scopes a[data-goto]")];
  const frame = document.querySelector(".topframe");
  /* ⛔ On the document, not inside the frame — the trail is the page's now, in both placements. */
  const crumbs = document.querySelector(".crumbs");
  const trail = document.querySelector(".trail");
  const tree = frame && frame.querySelector("nav.scopes");
  let trails = {};
  try { trails = JSON.parse(frame.dataset.trails); } catch {}

  /**
   * ⛔ THE TREE STARTS OPEN AND CLOSES ONCE YOU HAVE CHOSEN. Before anything is selected the whole
   * point is to see what there is; after, the trail is the only line worth the space, and the tree
   * is one press away.
   */
  const setOpen = (open) => {
    if (!tree) return;
    const c = document.querySelector(".chev");
    /**
     * ⛔ A TREE WITH NO CONTROL TO REOPEN IT IS NEVER CLOSED.
     *
     * The side placement hides the chevron, so collapsing there leaves a 19rem column holding one
     * breadcrumb and no way back to the tree — the menu is gone and the button that took it away
     * was a navigation press. The breakpoint that decides this lives in the stylesheet and is read
     * from there; a second copy of "62rem" in script is two answers to one question, and they drift.
     *
     * ⛔ AND IT ASKS THE LAYOUT, NOT THE CHEVRON. This read the chevron's computed display and
     * excluded the case where its hidden ATTRIBUTE is set, on the grounds that "Overview has no
     * tree". Overview has a tree now — the filter above keeps every row on a tab no scope belongs
     * to — so that exclusion closed the column on Overview and on How it works, leaving 19rem of
     * breadcrumb and no way back. Peter: *"the menu is broken"*.
     *
     * Down the side the tree is the menu and there is no control to reopen it, so it is never
     * closed, whatever the chevron happens to be doing. The breakpoint still lives in the
     * stylesheet and is still read from there rather than copied: position:fixed is what the side
     * placement DOES to the frame, so asking for it is asking the cascade.
     */
    const sideways = frame && getComputedStyle(frame).position === "fixed";
    if (sideways || (c && !c.hidden && getComputedStyle(c).display === "none")) open = true;
    tree.hidden = !open;
    if (c) c.setAttribute("aria-expanded", String(open));
    frame.classList.toggle("open", open);
  };

  const show = (name, collapse, fromHistory) => {
    let found = false;
    const all = views();
    for (const v of all) {
      const mine = v.dataset.view === name;
      v.hidden = !mine;
      found = found || mine;
    }
    if (!found) {
      /**
       * ⛔ WHERE THERE IS AN ADDRESS, A SECTION THIS PAGE LACKS IS SOMEWHERE ELSE — GO THERE.
       *
       * Revealing every section was the right fallback when one document held the whole corpus: a
       * saved file reads as one long page rather than as a blank panel. On a SERVED page it is now
       * the worst available outcome — four sections stacked at once, under an address naming none of
       * them, which is what a reader saw when a tab could not find its target.
       *
       * ⛔ Guarded on trails[name], so this only ever follows a name that IS a scope. Navigating
       * on an unknown name would be a page asking for itself forever.
       */
      if (BASE && trails[name]) {
        location.href = addressOf(name);
        return;
      }
      for (const v of all) v.hidden = false;
      /** ⛔ Showing everything means the page scrolls again, so the frame has to let go. */
      delete document.documentElement.dataset.framed;
      return;
    }
    /**
     * ⛔ THE PAGE ITSELF MUST NOT SCROLL ON A FRAMED VIEW. Peter: *"the BOTTOM scrolls
     * INDEPENDENTLY. yet, every time i scroll the screen the prototype goes off the screen. the
     * idea is to have the PROTOTYPE NOT MOVE. that's the POINT."*
     *
     * Giving the bottom pane its own scroll was half the job and read as none of it: the DOCUMENT
     * still scrolled, so a wheel event anywhere outside that pane moved the whole view — prototype
     * included — straight off the top. A frame whose contents scroll and which itself scrolls is
     * not a frame.
     *
     * So the body stops scrolling while a framed view is the one on screen, and every scroll that
     * remains belongs to a pane inside it. ⛔ Set here rather than in CSS because only the switcher
     * knows which view is showing, and the product's own views are documents that must still scroll.
     */
    const shown = all.find((v) => v.dataset.view === name);
    if (shown && shown.classList.contains("framed")) document.documentElement.dataset.framed = "1";
    else delete document.documentElement.dataset.framed;
    /**
     * ⛔ ANNOUNCED, BECAUSE THE MEASUREMENT HAPPENS IN ANOTHER SCRIPT AND HAPPENS FIRST.
     *
     * The frame's height is the viewport minus everything in the way, and the padding on main is one
     * of those things — but the padding DEPENDS on whether a framed view is showing, which is
     * decided here. Measured before this ran, it counted the unframed 136px, so the chrome came out
     * at 281px and the bottom pane was left 152px tall. The same ordering trap as the resize
     * listener registered above its own function in this file.
     */
    window.dispatchEvent(new Event("productos:view"));
    for (const a of menu) a.classList.toggle("on", a.dataset.goto === name);
    if (trail) {
      /**
       * ⛔ A ONE-CRUMB TRAIL IS THE HEADING, SAID TWICE. On the Money page the row read "Money" and
       * the section heading 37px below it read "Money" — a breadcrumb exists to say where a page is
       * FILED, and when there is nothing above you it has nothing to say that the page is not
       * already saying louder. This file's own trail builder already drops the root for the same
       * reason; it stopped one level short.
       *
       * ⛔ THE ROW STAYS. It carries the chevron and the dimension filter, both of which have to be
       * on every feature page — hiding the row to remove one word would take two controls with it.
       */
      const parts = (trails[name] || [{ id: name, label: name }]).length < 2 ? [] : trails[name] || [];
      trail.textContent = "";
      parts.forEach((part, i) => {
        if (i) {
          const sep = document.createElement("span");
          sep.className = "sep";
          sep.textContent = "›";
          trail.appendChild(sep);
        }
        const last = i === parts.length - 1;
        // ⛔ Where you are is text; every level above it is a link, because going up is the whole
        // reason a trail is worth the space.
        const bit = document.createElement(last ? "span" : "a");
        bit.className = last ? "at" : "up";
        bit.textContent = part.label;
        if (!last) {
          bit.setAttribute("href", "#" + (part.id === "overview" ? "view-overview" : "at-" + part.id));
          bit.dataset.goto = part.id;
          // ⛔ No listener here: the data-goto attribute is enough, and the delegated handler owns it.
        }
        trail.appendChild(bit);
      });
    }
    const section = sectionOf[name] || "overview";
    for (const t of tabs) t.classList.toggle("on", t.dataset.tab === section);
    scopeTree(section);
    // ⛔ Overview has no tree to open, so the chevron goes away rather than opening an empty one.
    if (chev) chev.hidden = section === "overview";
    const sm = document.querySelector(".topframe .subtabs");
    const cr = document.querySelector(".crumbs");
    if (sm) sm.hidden = section !== "overview";
    if (cr) cr.hidden = section === "overview";
    /*
     * ⛔ THE TREE MOVES UNDER THE AREA IT IS SHOWING, rather than being copied per area.
     *
     * Peter: "e.g. product, when selected, should have items under it, not under a new section."
     *
     * One tree exists and scopeTree() already filters its rows to the selected section — so a
     * second tree per area would be two derivations of one fact, which is what this project keeps
     * being bitten by. Instead the one element is appended into the selected group, so it physically
     * sits under the area whose features it is listing.
     *
     * ⛔ AND IT GOES BACK WHERE IT WAS FOR OVERVIEW, which has no features of its own: left inside
     * the last area it was moved to, it would read as that area's list while showing nothing.
     */
    if (tree) {
      const group = section === "overview" ? null : document.querySelector('.tabgroup[data-group="' + CSS.escape(section) + '"]');
      const home = document.querySelector(".topframe");
      if (group && tree.parentNode !== group) group.appendChild(tree);
      else if (!group && home && tree.parentNode !== home) home.appendChild(tree);
    }
    if (collapse || section === "overview") setOpen(false);
    /**
     * ⛔ EACH VIEW IS A PLACE THE BACK BUTTON CAN RETURN TO.
     *
     * This called replaceState, so every move OVERWROTE the current entry instead of adding one —
     * walk from the deals list into Creating a deal, press Back, and the browser returns to whatever
     * preceded the page, which reads as being dumped at the root. Peter: *"navigation is fucked… i'm
     * back at the root page"*.
     *
     * ⛔ And replaceState when arriving BY history, or going back would push a new entry for the
     * place it just returned to and trap somebody between two views.
     */
    /**
     * ⛔ THE WHOLE ADDRESS, NOT JUST THE FRAGMENT. Peter: *"we should have durable links for
     * everything in product os"*. The address bar is where a reader copies a link from, so moving
     * within the page has to leave a URL somebody else can open — and /<base>/<scope> is served.
     *
     * ⛔ THE FRAGMENT IS KEPT TOO, and it is not redundant. The server resolves the path and the
     * browser resolves the fragment; arriving at the path alone shows the scope as that page's
     * Overview, which is right, and arriving with the fragment also puts the reader at the section
     * on a page that holds several.
     */
    /**
     * ⛔ THE MENU PATH, AND NOTHING ELSE. The previous cut pushed /v2/part-0#at-part-0 — an address
     * and an anchor saying the same thing twice. Peter: *"get rid of the fucking anchors."*
     *
     * ⛔ A PAGE WITH NO ADDRESS PUSHES NOTHING, rather than inventing one. A file has no history to
     * speak of and writing a URL into its address bar would be a link nobody can follow.
     */
    const at = addressOf(name);
    /** ⛔ Compared against whichever part of the address it IS, or every move pushes a duplicate. */
    const now = at.charAt(0) === "#" ? location.hash : location.pathname;
    /**
     * ⛔ A REF TAIL BELONGS TO THIS ADDRESS AND MUST NOT BE THROWN AWAY.
     *
     * An address may name a view and then a ref inside it —
     * /v2/capabilities/document-catalogue/define-a-field-the-product-reads/see-a-fields-definition,
     * where the last segment is an EXCHANGE and not a scope. The server correctly serves the
     * owning scope's page. This then wrote addressOf(view) over the top of it, so arriving at a
     * link to one statement silently became its feature: *"clicked …/see-a-fields-definition,
     * landed …/define-a-field-the-product-reads"*.
     *
     * Reported by the deploy session as the deepest level having no page of its own. It has no page
     * BY DESIGN — a statement is not a scope — and the defect is that the address stopped saying
     * which statement. Same class as the bug this whole branch is about: paste the link, lose the
     * link.
     *
     * So an address that is this view PLUS a deeper tail is already correct and is left alone.
     */
    const keeps = now.indexOf(at + "/") === 0;
    try {
      if (keeps) {
        /* already the right place, said more precisely than addressOf can say it */
      } else if (fromHistory) history.replaceState(null, "", at);
      else if (now !== at) history.pushState(null, "", at);
    } catch {}
  };

  const chev = document.querySelector(".chev");
  if (chev) chev.addEventListener("click", () => setOpen(tree.hidden));
  /**
   * ⛔ Re-asked, not re-decided. Moving the menu — or dragging the window across the breakpoint —
   * changes whether the chevron exists, and setOpen is the one place that knows what that means.
   */
  const reask = () => setOpen(!tree || !tree.hidden);
  /*
   * ⛔ THE SWITCHER, EXPOSED, BECAUSE THE ALTERNATIVE WAS SIMULATING A PRESS.
   *
   * Peter: *"something constantly causes my screen to reload and i go back to 'overview'"*.
   *
   * Restoring a reader's place worked by finding the menu link for the view and CLICKING it — so it
   * could only restore a view that happens to have a row in the menu. Overview, the prototype board
   * and the settings surfaces are tabs, not rows: there is no link to click, nothing restored, and
   * the page fell back to its default, which is Overview. That is the whole of what he is seeing.
   *
   * ⛔ And my own menu change made it worse: the row for the scope you are ON renders as its name in
   * bold rather than a link, because a link to where you already are is not a link. So even a
   * feature view could fail to restore — the one case a reader is most likely to be in.
   */
  window.showView = (name) => show(name);
  window.addEventListener("productos:nav", reask);
  window.addEventListener("resize", reask);

  let sectionOf = {};
  try { sectionOf = JSON.parse(frame.dataset.sections); } catch {}
  const tabs = [...document.querySelectorAll(".topframe .tab")];
  /**
   * ⛔ CHOOSING A HALF OPENS THE TREE; CHOOSING A FEATURE CLOSES IT.
   *
   * Both collapsed, which is backwards: pressing "Product" is the moment you want to see what is in
   * it, and it dropped you on a landing page with the tree shut. The collapse belongs to the act
   * that means "I have chosen" — a feature — not to the act that means "show me the options".
   *
   * Overview has no tree, so it stays closed there.
   */
  for (const t of tabs)
    t.addEventListener("click", () => {
      const name = t.dataset.tab;
      /**
       * ⛔ A TAB THAT NAMES A SCOPE IS AN ADDRESS, NOT A SWITCH — AND IN TOP MODE THE TABS ARE THE
       * WHOLE OF THE NAVIGATION.
       *
       * The tree is hidden in top mode, which is what the page SHIPS, so all 130 of its links are
       * 0x0 and a reader has only these four buttons. Product and Capabilities name scopes whose
       * sections a page no longer carries, so show() could not find them, fell into its no-match
       * branch and revealed all four sections at once — the address unchanged, no error logged.
       * Peter: *"hahahahahahaha so broken, can't even get to a single page"*.
       *
       * ⛔ A DEAD CONTROL THAT LOGS NOTHING IS THE WORST SHAPE AVAILABLE: it is indistinguishable
       * from a slow page, so it reads as the whole product being broken rather than as one button.
       *
       * ⛔ AND IT IS THE SAME OMISSION AS THE MENU ROW, MISSED IN THE SAME PLACE. I drove the rows
       * and left the tabs, having told two other sessions to measure in SIDE mode — right for the
       * claim #226 was making, and it made the default mode the one nobody looked at.
       *
       * ⛔ THE DECISION LIVES IN show(), NOT HERE. A guard on this handler was the first fix and it
       * was a second copy of one rule: "a section this page lacks is somewhere else, so go there".
       * Disabling it changed nothing, because show() already answers that for every caller — which
       * is how I found out it was redundant rather than load-bearing.
       */
      show(name, false);
      if (name !== "overview") setOpen(true);
      window.scrollTo(0, 0);
    });
  /**
   * ⛔ The tree shows only the half you are in. Every scope in both halves at once is the wall the
   * tabs exist to remove, and a reader who has chosen a side has said which one they mean.
   */
  const scopeTree = (section) => {
    const rows = tree ? [...tree.querySelectorAll("li")] : [];
    /**
     * ⛔ FILTER ONLY WHERE THERE IS SOMETHING TO FILTER TO, AND ASK THE ROWS RATHER THAN A LIST.
     *
     * The tabs are not all halves of the product. Overview, the prototype board and What steers
     * this are SECTIONS, and no scope belongs to any of them — so comparing every row against the
     * current section hid the entire tree on all four. Peter, standing on one of them:
     * *"the menu is broken"*, and *"i'm on another machine, looking at .../v2/prototype"*.
     *
     * The previous round of this special-cased "overview" by name and left its three siblings
     * broken, which is the shape of the bug rather than a fix for it — a list of exceptions is a
     * list somebody has to remember to extend, and the next tab added breaks it again.
     *
     * So it is derived: if no row in the tree belongs to the current section, there is no half being
     * chosen and nothing to narrow to, and the tree stays whole. A real half still narrows, because
     * its rows do belong to it.
     */
    const narrowing =
      rows.some((r) => r.dataset.scope && sectionOf[r.dataset.scope] === section) ||
      (section === "subsystems" && rows.some((r) => r.dataset.subsystem));
    for (const li of rows) {
      /**
       * ⛔ THE ROW SAYS WHICH SCOPE IT IS, rather than the filter inferring it from a link.
       *
       * It read the id off a[data-goto], and the row for the scope you are currently ON has no
       * link — it is its own name in bold, because a link to where you already are is not a link. So
       * that row was unidentifiable, fell to the branch below, and the area whose page you were
       * reading was the one row the filter could not reason about.
       *
       * ⛔ A ROW THE FILTER CANNOT IDENTIFY IS STILL HIDDEN. Defaulting to visible meant every row
       * without a usable link survived every filter — so choosing the product half still showed the
       * machinery, while the machinery half looked correct and hid the bug.
       */
      const id = li.dataset.scope;
      /**
       * ⛔ THE LANDING IS NOT A REASON TO HIDE THE MENU. This read
       * section === "overview" || !id || sectionOf[id] !== section, so whenever the visible
       * section was the landing, EVERY row in the tree was hidden.
       *
       * On the root page that was invisible: /v2 lands on the product overview, where the tabs
       * are the navigation and the tree is a drill-down nobody has opened yet. But a page served at
       * ANY deeper address also shows its landing — so on every cold arrival at a real URL this hid
       * the entire menu. Peter, three times, and the third time with the row already marked current
       * and its ancestors already open: *"menus not operable, in a shit state again"*, *"the menu
       * doesn't expand"*.
       *
       * ⛔ Measured, not reasoned: with aria-current landing correctly and every ancestor open,
       * the row was STILL rowVisible: false — which is what sent me here rather than to another
       * patch of the address resolution.
       *
       * So the filter answers only the question it exists for — which half of the product this row
       * belongs to — and the landing keeps the tree it is standing in.
       */
      /**
       * ⛔ A SUBSYSTEM ROW'S SECTION IS WHAT IT IS, NOT WHAT sectionOf SAYS. That map is keyed by
       * id and four ids name both a scope and a subsystem, so a lookup would put a machinery row
       * under whichever product area happened to share its name.
       * ⛔ No backticks in here: template literal.
       */
      const sub = li.dataset.subsystem;
      li.hidden = sub
        ? narrowing && section !== "subsystems"
        : !id || (narrowing && sectionOf[id] !== section);
      /**
       * ⛔ AND THE AREA ITSELF IS NOT A ROW OF ITS OWN MENU. Peter: *"'Product' itself doesn't need
       * to be a menu item under the 'Product' main tab"*.
       *
       * The tree hangs under the group it is listing and the group's head already names it, so the
       * row whose id IS the section is the group repeating itself one line below its own tab. It
       * belongs in this filter rather than in the render: one tree is emitted for the whole corpus,
       * and which scope is redundant depends on where that tree currently hangs.
       *
       * ⛔ ITS ROW, NOT ITS ITEMS. The rows nest now, so an area's row CONTAINS its features —
       * hiding the whole row would take every one of them with it, which is the area looking right and
       * holding nothing. Only the row's own line is hidden.
       *
       * ⛔ AND IT IS FORCED OPEN, because the control that would open it is the line just hidden.
       */
      const own = li.querySelector(":scope > .scoperow");
      const redundant = !!id && id === section;
      if (own) own.hidden = redundant;
      if (redundant) li.classList.add("open");
    }
  };
  // ⛔ No per-row binding: the delegated handler above covers the menu, the crumbs and a
  // container's contents alike. Two handlers on one click is how a toggle fires twice.
  // ⛔ Escape closes it, because a tree covering the page with no visible way out is a trap.
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  // ⛔ An anchor from elsewhere on the page — "decide it", a grid row, a blocks ref — must bring its
  // view with it, or following a link inside a hidden section does nothing at all.
  /**
   * Where this page is served from, read off the address bar.
   *
   * ⛔ THE SAME ANSWER THE FETCHES ALREADY USE, and deliberately not a second derivation — DEFER
   * computes exactly this and the comment there records what happened when it was read off a link
   * instead. Empty for a page with no server, which is the case that must keep fragments.
   */
  const BASE = (function () {
    const m = location.pathname.match(/^(.*?\\/v2)(?:\\/|$)/);
    return m ? m[1] : "";
  })();

  /**
   * The address of a view: the path through the menu to it.
   *
   * ⛔ FROM trails, WHICH THE SERVER PUT ON THE PAGE — not recomputed here. The crumbs above and
   * the URL below have to be the same chain, and the way to guarantee that is for there to be only
   * one chain. Peter: *"URLs should follow the menu structure"* and *"v2/overview,
   * v2/product/{feature}/{subfeature}, etc"*.
   *
   * ⛔ AND NOTHING RETURNS A FRAGMENT. With no BASE this page has no address at all — a file, or a
   * published artifact — so it keeps whatever it arrived with and nothing is pushed.
   */
  /**
   * What this page is rooted at, which is the scope its Overview actually shows.
   *
   * ⛔ WITHOUT THIS, EVERY DURABLE LINK DESTROYED ITSELF ON ARRIVAL. A cold load of
   * /v2/capabilities/deal-pipeline is served a page ROOTED at deal-pipeline — correct content,
   * correct title, five sections — and that scope renders as the page's Overview rather than as a
   * section named after itself. So the switcher found no view called deal-pipeline, fell back to
   * overview, and pushed the address of overview: the address bar became /v2/overview before the
   * reader had done anything. Paste the link, lose the link.
   *
   * ⛔ FOUND BY THE DEPLOY SESSION AGAINST THE HOSTED MOUNT, after my own probe passed. That probe
   * PRESSES, and pressing exercises the in-page switch where the answer is already in memory. Cold
   * arrival is the only path where the address is the sole input, and it is every link anybody
   * bookmarks or is sent. scripts/probe-cold.mjs opens one and looks.
   *
   * ⛔ THE SAME ATTRIBUTE THE FETCHES READ, not a second copy — mock-bank carries it because the
   * section endpoint needs to say which corpus root it is asking about.
   */
  const ROOT = (function () {
    const b = document.getElementById("mock-bank");
    return (b && b.getAttribute("data-root")) || "";
  })();
  /** ⛔ The CORPUS root is the only scope whose section is Overview; see sectionOf in the renderer. */
  const wholeCorpus = () => !ROOT || sectionOf[ROOT] === "overview";

  const addressOf = (name) => {
    /**
     * ⛔ A FRAGMENT WHERE THERE IS NO PATH, which mirrors what the renderer writes. A file and a
     * published artifact have no address, and their links are fragments — so pushing nothing left
     * a saved page with no way to say where it was and broke its back button. Caught by
     * v2-a-container-in-the-menu-collapses, which drives a FILE render and asserts the row still
     * navigates. Getting rid of anchors means getting rid of them where there is an alternative.
     */
    if (!BASE) return name === "overview" ? "#view-overview" : "#at-" + name;
    /**
     * ⛔ OVERVIEW IS WHATEVER THIS PAGE IS ROOTED AT, so its address is that scope's menu path. Only
     * on the whole corpus is Overview the word "overview" — everywhere else it is a feature, and
     * calling it /v2/overview is what threw the reader's address away.
     */
    const who = name === "overview" && !wholeCorpus() ? ROOT : name;
    if (who === "overview") return BASE + "/overview";
    const crumbs = trails[who] || [{ id: who }];
    return BASE + "/" + crumbs.map(function (c) { return encodeURIComponent(c.id); }).join("/");
  };

  /**
   * Which view an address names: the deepest segment this page actually holds.
   *
   * ⛔ THE DEEPEST, NOT THE FIRST, because the path is an ancestry — /v2/product/cre/rent-roll
   * names rent-roll, and every segment before it is a view too. Reading left to right would land
   * a reader on the area every time they asked for a feature inside it.
   */
  /**
   * ⛔ ONE PLACE THAT ASKS "DOES THIS DOCUMENT HOLD THAT SECTION", because the answer now decides
   * whether a press stays here or becomes a navigation — and two copies of the selector is two
   * answers waiting to drift. CSS.escape is feature-detected because every ref in this model
   * carries a #.
   */
  /**
   * Scroll to the ref an address names past its view, if it names one.
   *
   * ⛔ ONE COPY, BECAUSE A COLD ARRIVAL NEEDS IT AS MUCH AS A PRESS DOES. This lived only in the
   * click handler, so following a link to a statement WITHIN the page worked and opening that same
   * link in a new tab landed at the top of the feature with nothing saying which statement was
   * meant. A durable link that only works when you were already here is not durable.
   */
  const scrollToTail = (pathname, named) => {
    if (!BASE || pathname.indexOf(BASE) !== 0) return false;
    const segs = pathname.slice(BASE.length).split("/").filter(Boolean).map(decodeURIComponent);
    const cut = segs.lastIndexOf(named);
    if (cut < 0) return false;
    const tail = segs.slice(cut + 1);
    if (!tail.length) return false;
    const want = named + "#" + tail.join("#");
    const el = [...document.querySelectorAll("[data-ref]")].find(function (x) { return x.dataset.ref === want; });
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ block: "start" });
      return true;
    }
    return false;
  };

  const sectionNamed = (name) =>
    document.querySelector('section.view[data-view="' + (window.CSS && CSS.escape ? CSS.escape(name) : name) + '"]');

  const viewAt = (pathname) => {
    if (!BASE || pathname.indexOf(BASE) !== 0) return null;
    const segs = pathname.slice(BASE.length).split("/").filter(Boolean).map(decodeURIComponent);
    /*
     * ⛔ A FOCUSED MACHINERY PAGE IS ANOTHER PAGE'S ADDRESS, exactly as a scope this page does not
     * hold is — see the comment on sectionOf below, which is the same bug in the other tree.
     *
     * /v2/subsystems/<id> renders ONE subsystem, and which one is decided by the server. Walking up
     * from the id would match the subsystems section this document already carries, switch to the
     * page it is already on, and leave the URL and the focus untouched: the reader presses a row
     * for the clock and stays on the ledger. Peter has reported this shape twice in the other tree,
     * the second time as "why does the URL NO LONGER CHANGE AFTER I GO THROUGH THE MENU".
     *
     * ⛔ The bare /v2/subsystems is still a switch, because that one IS this document's section.
     * ⛔ No backticks in here: template literal.
     */
    if (segs.length > 1 && segs[0] === "subsystems") {
      const sec = sectionNamed("subsystems");
      const on = sec && sec.getAttribute("data-focused");
      return on && segs[segs.length - 1] === on ? "subsystems" : null;
    }
    for (let i = segs.length - 1; i >= 0; i--) {
      /**
       * ⛔ A REAL SECTION FIRST, AND THE ROOT RULE ONLY WHERE THERE IS NONE — THE ORDER IS THE BUG.
       *
       * The root rule is right about the case it was written for: a page's root usually does not
       * render as a section of its own — it IS the Overview — so looking only at data-view found
       * nothing for the very address just served, which was the cold-arrival defect.
       *
       * ⛔ BUT ITS PREMISE IS FALSE WHENEVER THE ROOT DOES HAVE A SECTION, and asking it first made
       * it win anyway. Served at /v2/product/cre/deal-overview the document carries BOTH
       * data-root="deal-overview" AND data-view="deal-overview" — measured on the live instance —
       * so this returned "overview" and the reader got the question queue from an address naming
       * the feature. Peter: *"the menu doesn't expand, and I load a page different than if I went
       * to the menu and cliked through"*. Both halves are this: the menu expands to whatever this
       * answers, and clicking through switches sections without touching the URL, so one address
       * showed two different pages depending on how you got there.
       *
       * Asking for the section first keeps the original fix — a root with no section of its own
       * still falls through to "overview" — and stops it overriding a root that has one.
       */
      if (segs[i] === "overview" || views().some(function (v) { return v.dataset.view === segs[i]; })) return segs[i];
      if (ROOT && segs[i] === ROOT) return "overview";
      /**
       * ⛔ A SCOPE THIS PAGE DOES NOT HOLD IS ANOTHER PAGE'S ADDRESS — STOP, DO NOT KEEP WALKING UP.
       *
       * Walking from the deepest segment upward is right for a REF below a view
       * (…/rent-roll/review-the-rows scrolls to the ref inside the view), and wrong the moment a
       * segment names a scope. Served at /v2/capabilities, a click on a child's row —
       * /v2/capabilities/access-control — walked past access-control, matched capabilities
       * because this page holds its own section, and switched to the page it was already on. The
       * URL never changed and the reader never moved: *"why does the URL NO LONGER CHANGE AFTER I
       * GO THROUGH THE MENU"*, with the menu working exactly as built.
       *
       * sectionOf names every scope in the corpus, so "is this segment a scope" is answerable
       * here without asking the server. A scope that is not in this document belongs to another
       * page; returning null hands the link to the browser, which is the whole design.
       */
      if (sectionOf[segs[i]] !== undefined) return null;
    }
    return null;
  };

  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    /**
     * ⛔ A DURABLE LINK TO SOMEWHERE ON THIS PAGE IS STILL A JUMP, NOT A RELOAD.
     *
     * Making every ref link a real URL would otherwise trade an instant switch for a full fetch of
     * a 3 MB page to land on a section already in the document. So: if the link's own path is the
     * one we are on, or it names a view this page holds, handle it here — and let the browser have
     * it otherwise, which is what makes the link durable in the first place.
     */
    const raw = a.getAttribute("href") || "";
    if (raw.indexOf("#") !== 0) {
      let u;
      try { u = new URL(a.href, location.href); } catch (err) { return; }
      if (u.origin !== location.origin) return;
      /**
       * ⛔ AN ADDRESS THIS PAGE HOLDS IS A SWITCH; ANYTHING ELSE IS THE BROWSER'S. That is what
       * makes the link durable and the move instant at the same time — a reader following a link to
       * a section already in the document must not refetch three megabytes to reach it.
       */
      const named = viewAt(u.pathname);
      if (!named) return;
      e.preventDefault();
      show(named, true);
      /**
       * ⛔ AND A REF BELOW THE VIEW IS SCROLLED TO BY LOOKUP, NOT BY FRAGMENT. The tail of the path
       * past the view is the ref — …/rent-roll/review-the-rows — so the element is found by what
       * it IS rather than by an anchor hung off the URL.
       */
      if (scrollToTail(u.pathname, named)) return;
      window.scrollTo(0, 0);
      return;
    }
    /**
     * ⛔ A data-goto ANYWHERE IS HONOURED, not only inside the menu.
     *
     * The menu bound its own rows and this handler skipped anything carrying it, so a
     * container's contents list — the only thing a container view has to offer — did nothing: the
     * entry highlighted and the page stayed exactly where it was.
     */
    /**
     * ⛔ AND IT IS ONLY HONOURED WHERE THIS DOCUMENT ACTUALLY HOLDS THE SECTION. Otherwise the link
     * is a link and the browser navigates — which is what makes one address one page.
     *
     * This called preventDefault() unconditionally and then asked show() to reveal a section that,
     * now that a page carries only its own scope, is not here. show() cannot find it, so the URL
     * was pushed and the screen went blank: *"menus not operable, in a shit state again"*, and
     * *"why does the URL NO LONGER CHANGE AFTER I GO THROUGH THE MENU"* — the address had moved and
     * the document had not.
     *
     * ⛔ THE ROUTER IS NOT DELETED BY DELETING IT, IT IS DELETED BY GIVING IT NOTHING TO DO. In-page
     * switching is still exactly right for the sections a page really has (its sub-views, the
     * prototype pane). What was wrong was it claiming every destination in the corpus, including
     * the ones it could only fake.
     */
    if (a.dataset.goto) {
      const name = a.dataset.goto;
      const held = sectionNamed(name);
      /* Not here: let the browser have it. One rendering per address, by construction. */
      if (!held) return;
      e.preventDefault();
      show(name, true);
      window.scrollTo(0, 0);
      return;
    }
    const target = document.querySelector(a.getAttribute("href"));
    const view = target && target.closest("section.view");
    if (view && view.hidden) show(view.dataset.view, true);
  });
  /**
   * ⛔ The same one-at-a-time rule, one level down. Everything is visible without this, so a saved
   * file still reads as one long document rather than as a blank panel.
   */
  /**
   * ⛔ AND THE BACK BUTTON HAS TO BE HEARD. Pushing entries is half of it; without this the address
   * changes when you go back and the page goes on showing what it showed. Both directions, so
   * forward works too — a reviewer who overshoots can return.
   */
  const fromAddress = () => {
    const h = location.hash.replace(/^#/, "");
    /** ⛔ The address is the path now; the hash is only read when there is no path to read. */
    const byPath = viewAt(location.pathname);
    const name = byPath || (h === "view-overview" || !h ? "overview" : h.replace(/^at-/, ""));
    if (sectionNamed(name)) {
      show(name, true, true);
      /** ⛔ The ref the address names, on arrival — not only when the press happened on this page. */
      scrollToTail(location.pathname, name);
    }
  };
  window.addEventListener("popstate", fromAddress);
  window.addEventListener("hashchange", fromAddress);

  /**
   * ⛔ ONE SWITCHER, SCOPED BY WHOSE TABS THEY ARE. This hid EVERY sub-view in the document whose
   * name did not match the selected tab — fine while there was one strip, and the moment a feature
   * gained three tabs of its own they were hidden by the product's selection. The behaviour table
   * went with them: every feature page rendered its content and showed none of it.
   *
   * ⛔ Found by Peter saying "i don't see the tabs at all", not by the test I had just written —
   * which asserted the markup was in the HTML and never that any of it was visible. The markup was
   * all there.
   */
  const strips = [...document.querySelectorAll(".subtabs")];
  const showSub = (owner, name) => {
    for (const v of document.querySelectorAll('.sub-view[data-tabs="' + CSS.escape(owner) + '"]'))
      v.hidden = v.dataset.subView !== name;
    for (const t of document.querySelectorAll('.subtabs[data-tabs="' + CSS.escape(owner) + '"] .subtab'))
      t.classList.toggle("on", t.dataset.sub === name);
  };
  for (const strip of strips) {
    const owner = strip.dataset.tabs;
    for (const t of strip.querySelectorAll(".subtab"))
      t.addEventListener("click", () => { showSub(owner, t.dataset.sub); window.scrollTo(0, 0); });
    /** ⛔ Each strip opens on its own first tab. Globally, one strip decided for all of them. */
    const first = strip.querySelector(".subtab");
    if (first) showSub(owner, first.dataset.sub);
  }

  /*
   * ⛔ EACH CONTAINER COLLAPSIBLE, AND IT REMEMBERS. Peter: "And each container should be
   * collapsible." A side menu that reopened every group on reload would make collapsing it pointless
   * — the reason to shut a group is that you are not working in it today.
   *
   * ⛔ THE TWISTY DOES NOT NAVIGATE. One control that both selects and collapses means every attempt
   * to shut a group moves you into it, which is the mistake the chevron beside the trail was built
   * to avoid.
   */
  const SHUT = "productos:nav-shut";
  const shut = (() => {
    try { return new Set(JSON.parse(localStorage.getItem(SHUT) || "[]")); } catch (e) { return new Set(); }
  })();
  const remember = () => {
    try { localStorage.setItem(SHUT, JSON.stringify([...shut])); } catch (e) { /* private window: collapse still works, it just forgets */ }
  };
  /*
   * ⛔ THE GROUP TWISTIES ONLY. The rows inside a group carry their own, and a selector of
   * a bare twisty selector caught both — so every row's control read its group name as undefined,
   * and all of them shared one entry in the remembered set under that one name. Collapsing any
   * feature collapsed every feature.
   */
  const groupTwisties = [...document.querySelectorAll(".twisty[data-twist]")];
  const paintGroups = () => {
    for (const t of groupTwisties) {
      const name = t.dataset.twist;
      const group = t.closest(".tabgroup");
      if (!group) continue;
      const closed = shut.has(name);
      group.classList.toggle("shut", closed);
      t.setAttribute("aria-expanded", closed ? "false" : "true");
      t.setAttribute("aria-label", (closed ? "Expand " : "Collapse ") + (group.querySelector(".tab")?.textContent || name).trim());
    }
  };
  /*
   * ⛔ ONE OPEN AT A TIME. Peter: "Let's auto collapse the non-active menu item, so you can only
   * have one expanded leaf at a time, like a 'normal' menu".
   *
   * Every group remembering its own state independently meant a menu that only ever grew: four
   * areas open at once down a column too narrow for one of them, and the area you were working in
   * pushed off the bottom of the screen by the three you were not. Opening one is therefore also
   * the act of closing the others.
   */
  const openOnly = (name) => {
    for (const t of groupTwisties) {
      const id = t.dataset.twist;
      if (id !== name) shut.add(id);
    }
    shut.delete(name);
    remember();
    paintGroups();
  };
  paintGroups();
  /*
   * ⛔ THE BRANCH THE ADDRESS LANDS IN IS OPENED ON ARRIVAL. Peter: "uhm, this is much beter, but we
   * should make sure the menu auto-expands."
   *
   * Nothing did this. openOnly is reached from a twisty click and a tab click, neither of which
   * runs on boot, so a cold arrival showed whatever localStorage remembered. It LOOKED correct on
   * a profile with nothing collapsed — which is what I measured, and why I first reported it fixed.
   *
   * ⛔ AND THE FAILING CASE IS ORDINARY RATHER THAN EXOTIC: openOnly adds every other group to the
   * shut set, so opening any area collapses the rest. From then on every address inside one of them
   * arrives with its branch shut and the item invisible — a menu that does not contain the page the
   * reader is on.
   *
   * ⛔ ONLY THE BRANCH THE ADDRESS NAMES, NEVER "OPEN EVERYTHING". Collapsing a group is how somebody
   * says they are not working in it today; a boot that reopened all of them would make the control
   * pointless, which is the whole reason shut is remembered at all.
   *
   * ⛔ No backticks in this comment: it lives inside the template literal carrying the page's
   * browser script, and one would end the string. I made this exact mistake earlier today and the
   * same test caught it both times.
   */
  (function openWhereWeLanded() {
    /*
     * ⛔ THE PATH'S OWN SEGMENTS, NOT AN ANCHOR. The first version walked .topframe a[href] looking
     * for the row whose href is this address — and the seed has none: a top-level group carries a
     * button with data-tab, and only deeper trees render anchors. It compiled, it ran, and it opened
     * nothing, which is the shape of a fix that is only tested where it happens to apply.
     *
     * Every segment of the address is an ancestor, and a group is named after the thing it holds, so
     * un-shutting each segment opens the whole branch down to the item — one level or four.
     */
    var segs = location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    var moved = false;
    for (var t of groupTwisties) {
      var name = t.dataset.twist;
      if (segs.indexOf(name) >= 0 && shut.delete(name)) moved = true;
    }
    if (moved) {
      remember();
      paintGroups();
    }
  })();
  for (const t of groupTwisties) {
    t.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const name = t.dataset.twist;
      /* ⛔ Shutting one shuts only it: "one at a time" is a cap on what is open, not a rule that
         something must be. */
      if (shut.has(name)) openOnly(name);
      else {
        shut.add(name);
        remember();
        paintGroups();
      }
    });
  }
  /*
   * ⛔ CHOOSING AN AREA OPENS IT. Selecting a collapsed group and being shown nothing is the state
   * where a reader concludes the menu is broken — standard behaviour, and the twisty is still there
   * to shut it again.
   */
  for (const t of document.querySelectorAll(".topframe .tab")) {
    t.addEventListener("click", () => {
      openOnly(t.dataset.tab);
    });
  }
  /*
   * ⛔ CHOOSING AN ITEM OPENS WHAT IS IN IT. Peter: "once you click an item, its sub menu should
   * automatically show if it has one".
   *
   * This was a chevron per row, which he then had to press after pressing the row — two controls for
   * one intention, and the second one on every container whether he wanted it or not. Going to a
   * feature is the reason to want its contents, so the link is the control.
   *
   * ⛔ AND THE NAVIGATION IS NOT INTERCEPTED. The handler adds a class and returns; it does not
   * preventDefault, because the row's job is still to take you there. The previous version called
   * preventDefault on a control that was not a link — correct there, and it would silently break
   * every row's link here.
   *
   * ⛔ Siblings only. Closing everything on open would fold up the branch you are standing in, which
   * is the chain the render deliberately leaves open — and on a cross-page link the next render opens
   * that chain itself, so this only has to be right for a jump within the page.
   */
  for (const row of document.querySelectorAll("nav.scopes li.holds")) {
    const link = row.querySelector(":scope > .scoperow > a");
    if (!link) continue;
    link.addEventListener("click", () => {
      const list = row.parentElement;
      for (const sib of list ? list.children : []) {
        if (sib !== row) sib.classList.remove("open");
      }
      row.classList.add("open");
    });
  }

  /**
   * ⛔ THE PATH, NOT THE HASH. /v2/product/cre/rent-roll has to land on rent-roll, and reading
   * the fragment meant every address that named something landed on Overview instead — which is
   * most of what "the feature seems largely broken" was.
   *
   * ⛔ The hash is still honoured as a fallback, because a link somebody saved from the previous
   * build is still a link somebody saved.
   */
  const opening = location.hash.replace(/^#/, "");
  const fromHash =
    viewAt(location.pathname) ||
    (opening === "view-overview" ? "overview" : views().find((v) => v.id === opening)?.dataset.view);
  // Opening on a named view means somebody linked to it: collapse. Opening cold: leave it open.
  // ⛔ Opens on Overview: what the product is, and what it owes. Landing in a feature's grid with
  // no idea what the product is was the shape this replaced.
  show(fromHash || "overview", true);
})();
</script>`;

/**
 * ⛔ ITS OWN SCRIPT, because the view switcher gives up on a page with fewer than two views and the
 * menu still has to be movable there. It owns one fact — the placement — and announces it; what a
 * placement means for the tree belongs to the switcher, which is the only thing that knows.
 */
/**
 * ⛔ THE PROTOTYPE FRAME'S HEIGHT, SET BY DRAGGING, AND HIDEABLE.
 *
 * Peter: *"let's fix the prototype to the top half of the screen in its own frame, with the tab bars
 * bottom half of the page"* — then: *"let's actually make the prototype frame draggable up or
 * hideable."*
 *
 * The correction is the right design and the reason is the content. Half the screen is right for an
 * eight-control form and wrong for a long table: judging one sentence needs the control in view,
 * judging thirty needs the list in view, and a fixed ratio picks one and is wrong for the other.
 *
 * ⛔ REMEMBERED, like the nav placement and for the same reason: it is a reading posture, not a
 * per-feature choice, and being asked again on every feature is the same as not being asked.
 *
 * ⛔ ITS OWN SCRIPT. The view switcher gives up on a page with fewer than two views, and the frame
 * still has to be resizable there — the same reasoning the nav placement already runs on.
 */
const PROTO_FRAME = `<script>
(function () {
  const root = document.documentElement;
  try {
    const was = localStorage.getItem("productos:proto");
    /**
     * ⛔ SHUT UNTIL SOMEBODY OPENS IT, because the open state cost the whole first viewport.
     *
     * At 1440px the panel took every pixel above the fold — three small sketches and about 900px of
     * nothing under them — and the first sentence a reviewer could have an opinion about was on the
     * second screen. The screen is not the job on a feature page: it is evidence, one press away,
     * and there is a whole Prototype section for looking at drawings.
     *
     * ⛔ A REMEMBERED CHOICE STILL WINS, in both directions. This is the default for somebody who
     * has never touched the grip, not a decision taken away from anybody who has.
     *
     * ⛔ ALREADY APPLIED BY THE PLACEMENT BOOT SCRIPT, which runs before the first paint. Repeated here
     * so this file is readable on its own and so the state is right if the boot script is ever
     * dropped — it is idempotent either way.
     */
    if (was === "off" || was === null) root.dataset.proto = "off";
    /**
     * ⛔ A REMEMBERED SLIVER FROM AN OLDER BUILD IS FORGIVEN. The floor used to be 80px, so somebody
     * who dragged it down then is stuck with an unusable frame for good — a persisted value is a
     * decision that outlives the code that allowed it.
     */
    else if (was && /^[0-9.]+$/.test(was)) root.style.setProperty("--proto-h", Math.max(140, parseFloat(was)) + "px");
  } catch (e) {}

  const remember = (v) => { try { localStorage.setItem("productos:proto", v); } catch (e) {} };

  /**
   * ⛔ MEASURED, NOT GUESSED. A framed view is sized against the viewport minus whatever the frame
   * occupies — the top bar, the composer, and anything stacked at the bottom. Every one of those
   * changes height when its text wraps on a narrow window, and this file has already paid for a
   * guessed offset once: the change bar covered the tabs on exactly the screens with least room.
   */
  const chrome = () => {
    const top = document.querySelector(".topframe");
    const note = document.getElementById("note-bar");
    const bars = document.querySelector(".bottom-bars");
    /**
     * ⛔ THE PADDING ON MAIN COUNTS. Leaving it out made the frame taller than the space it had, so
     * the bottom of the table sat below the viewport with nothing to scroll it into view — the
     * exact failure a measured offset exists to avoid, reintroduced by measuring all but one of the
     * things in the way.
     */
    const main = document.querySelector("main");
    const mp = main ? getComputedStyle(main) : null;
    /**
     * ⛔ ONLY WHAT IS ABOVE THE CONTENT, AND A LEFT-DOCKED NAV IS BESIDE IT.
     *
     * Peter, three rounds in and after everything else I had checked passed: *"uhm, still blank for
     * me.... the bottom half."* He has the nav docked left — his choice, remembered in
     * localStorage, which is why nothing I changed reached him.
     *
     * Docked left, the top frame becomes a full-height sidebar: 900px on a 900px window. This measured its
     * HEIGHT and subtracted it, so the chrome came out at 954px, the framed view collapsed to its
     * 320px minimum, and the bottom pane was exactly 0px tall. Blank, on every feature, no matter
     * how short the prototype.
     *
     * ⛔ Measuring "everything in the way" by measuring every element's height assumed they are all
     * stacked. One of them is not, and the one that is not is the one a reader can move — so the
     * page was correct only in the placement I happened to be using, which is the same mistake as
     * driving only the path I happened to take.
     */
    const stacked = top && document.documentElement.dataset.nav !== "left";
    const h =
      (stacked ? top.offsetHeight : 0) +
      (note ? note.offsetHeight : 0) +
      (bars && !bars.hidden ? bars.offsetHeight : 0) +
      (mp ? parseFloat(mp.paddingTop) + parseFloat(mp.paddingBottom) : 0) +
      8;
    root.style.setProperty("--chrome-h", h + "px");
  };
  chrome();
  window.addEventListener("resize", chrome);
  /** ⛔ And after every view switch: the padding on main depends on which view is showing. */
  window.addEventListener("productos:view", chrome);
  /** ⛔ The placement is a button, and moving the nav changes whether it is above the content at all. */
  window.addEventListener("productos:nav", chrome);
  /** ⛔ The bars appear and disappear on their own; re-measure when the DOM under them changes. */
  new MutationObserver(chrome).observe(document.body, { childList: true, subtree: false });
  /** And after the composer has had a chance to grow, which it does on its first keystroke. */
  document.addEventListener("input", (ev) => { if (ev.target.id === "note-text") chrome(); });

  /** ⛔ Delegated, because a feature's frame is rendered per view and views come and go on refresh. */
  document.addEventListener("click", (ev) => {
    const hide = ev.target.closest(".proto-hide");
    if (!hide) return;
    ev.preventDefault();
    ev.stopPropagation();
    const off = root.dataset.proto === "off";
    if (off) { delete root.dataset.proto; remember(String(Math.round(px()))); }
    else { root.dataset.proto = "off"; remember("off"); }
    /**
     * ⛔ THE LABEL IS CSS, NOT JAVASCRIPT. It was set here on click only, so a page that LOADED
     * collapsed showed a 20x18 caret whose tooltip said "Hide the screen" — about a screen that was
     * already hidden. The state is remembered, so that is the state a reader comes back to, and the
     * one control that could undo it was both unlabelled and lying.
     */
  });

  const px = () => {
    const v = getComputedStyle(root).getPropertyValue("--proto-h").trim();
    if (v.endsWith("px")) return parseFloat(v);
    /** vh at first load, before anybody has dragged. */
    return (parseFloat(v) / 100) * window.innerHeight;
  };

  let from = null;
  document.addEventListener("pointerdown", (ev) => {
    const grip = ev.target.closest(".proto-grip");
    if (!grip || ev.target.closest(".proto-hide")) return;
    from = { y: ev.clientY, h: px() };
    grip.setPointerCapture?.(ev.pointerId);
    /** ⛔ Dragging a divider must not select the text either side of it. */
    document.body.style.userSelect = "none";
  });
  document.addEventListener("pointermove", (ev) => {
    if (!from) return;
    /**
     * ⛔ FLOORED AND CAPPED. Dragged to nothing it becomes an invisible frame with a grip in it,
     * which reads as broken rather than hidden — hiding is what the button is for. Dragged past the
     * viewport the tabs leave the screen entirely.
     */
    /**
     * ⛔ A FLOOR YOU CAN STILL USE. 80px left a sliver with a drawing cropped to nothing, which is
     * indistinguishable from broken — and it is REMEMBERED, so it is what you come back to. Hiding
     * is what the button is for, and hiding says so.
     */
    const h = Math.max(140, Math.min(window.innerHeight - 160, from.h + (ev.clientY - from.y)));
    delete root.dataset.proto;
    root.style.setProperty("--proto-h", h + "px");
  });
  const stop = () => {
    if (!from) return;
    from = null;
    document.body.style.userSelect = "";
    remember(String(Math.round(px())));
  };
  document.addEventListener("pointerup", stop);
  document.addEventListener("pointercancel", stop);

  /** ⛔ Keyboard too: a divider only a mouse can move is a divider half the readers cannot. */
  document.addEventListener("keydown", (ev) => {
    const grip = ev.target.closest?.(".proto-grip");
    if (!grip) return;
    const step = ev.key === "ArrowUp" ? -40 : ev.key === "ArrowDown" ? 40 : 0;
    if (!step) return;
    ev.preventDefault();
    delete root.dataset.proto;
    root.style.setProperty("--proto-h", Math.max(140, Math.min(window.innerHeight - 160, px() + step)) + "px");
    remember(String(Math.round(px())));
  });
})();
</script>`;

/**
 * ⛔ THE DIMENSION FILTER, APPLIED TO EVERY PAGE AND REMEMBERED.
 *
 * Peter: *"Has anything is the dimension filter on every feature page"*, then *"Build it"*.
 *
 * ⛔ IN THE BROWSER, BECAUSE THE SERVER NEVER SEES THE CHOICE. A round trip per dropdown would make
 * the filter slower than scrolling past what it hides, and the page already carries what it needs:
 * every screen and every behaviour row states its own combination in `data-holds`.
 *
 * ⛔ REMEMBERED, for the reason the menu placement is: a reading posture, not a per-page decision.
 * Being asked again on every feature is the same as not being asked.
 *
 * ⛔ AND IT SAYS WHAT IT HID. A page that silently omits truth is how somebody agrees to less than
 * they believe they are agreeing to, so the count is beside the control rather than discoverable.
 */
const DIM_FILTER = `<script>
(function () {
  /*
   * ⛔ EVERY BAR, NOT THE FIRST ONE. The filter now lives inside each feature's prototype view —
   * Peter: *"let's move the dimensions down into the prototype view on the features"* — so a page
   * holding several features holds several bars, one per view, with only the visible view's on
   * screen.
   *
   * This bound a single-element lookup, so it took whichever bar comes first. On any page with
   * more than one feature that is a HIDDEN bar, and the control the reader can actually see does
   * nothing at all. The product's own page renders two, which is how this was caught.
   */
  const bars = Array.prototype.slice.call(document.querySelectorAll("[data-dimfilter]"));
  if (!bars.length) return;
  /*
   * ⛔ ITS OWN ATTRIBUTE, NOT THE BOARD'S.
   *
   * This first reused the board's own walk-dim attribute, which its selector already uses — so each
   * script saw the other's controls and four of the board's tests went red. The two do different
   * jobs: the board's picks WHICH PROTOTYPE to walk and can add a dimension or a value; this one
   * narrows what a page shows. They share the answer, not the markup.
   */
  const picks = Array.prototype.slice.call(document.querySelectorAll("[data-dim-filter]"));
  const KEY = "productos:asked";

  const remembered = (function () {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; }
  })();

  const asked = function () {
    const want = {};
    for (const sel of picks) if (sel.value) want[sel.getAttribute("data-dim-filter")] = sel.value;
    return want;
  };

  /*
   * ⛔ THE SAME PREDICATE THE REST OF THE SYSTEM USES, in the one language this file can carry it in.
   * A truth that says nothing is never hidden; a dimension the reader has not chosen hides nothing;
   * only a stated disagreement hides. Getting any of those backwards empties the page.
   */
  const holdsUnder = function (holds, want) {
    if (!holds) return true;
    for (const dim in holds) {
      if (!Object.prototype.hasOwnProperty.call(holds, dim)) continue;
      if (want[dim] && want[dim] !== holds[dim]) return false;
    }
    return true;
  };

  const apply = function () {
    const want = asked();
    let hidden = 0;
    const subjects = document.querySelectorAll("[data-holds]");
    for (const el of subjects) {
      let holds = null;
      try { holds = JSON.parse(el.getAttribute("data-holds")); } catch (e) { holds = null; }
      const keep = holdsUnder(holds, want);
      /*
       * ⛔ A CLASS, NOT THE hidden ATTRIBUTE. Several of these elements are table rows whose own
       * open/closed state already uses hidden — writing it here would fight that and leave a row
       * stuck whichever lost.
       */
      el.classList.toggle("dimhide", !keep);
      if (!keep) hidden++;
    }
    /*
     * ⛔ EVERY BAR SAYS THE SAME THING, because the choice is the page's and not one view's. A bar
     * keeping its own count would disagree with the one beside it the moment a reader switched
     * features, and two surfaces disagreeing about how much is hidden is worse than neither saying.
     */
    const chosen = Object.keys(want).length;
    for (const b of bars) {
      const said = b.querySelector("[data-dimhidden]");
      if (!said) continue;
      said.hidden = !hidden;
      said.textContent = hidden
        ? hidden + " hidden by " + (chosen === 1 ? "this choice" : "these choices")
        : "";
    }
    try { localStorage.setItem(KEY, JSON.stringify(want)); } catch (e) { /* private window: it just forgets */ }
  };

  for (const sel of picks) {
    const was = remembered[sel.getAttribute("data-dim-filter")];
    /* ⛔ Only a value this dimension still offers — a remembered one that has since been removed
       would narrow the page to nothing and offer no way to see why. */
    if (was) for (const opt of sel.options) if (opt.value === was) sel.value = was;
    sel.addEventListener("change", function () {
      /*
       * ⛔ THE OTHER BARS FOLLOW. Several views, several copies of one control: choosing on one and
       * finding another still reading "any" is the page telling a reader two things about one choice.
       */
      const dim = sel.getAttribute("data-dim-filter");
      for (const other of picks) {
        if (other === sel || other.getAttribute("data-dim-filter") !== dim) continue;
        for (const opt of other.options) if (opt.value === sel.value) other.value = sel.value;
      }
      apply();
    });
  }
  apply();
})();
</script>`;

const NAV_PLACE = `<script>
(function () {
  const root = document.documentElement;
  const btn = document.querySelector(".navplace");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const now = root.dataset.nav === "left" ? "top" : "left";
    root.dataset.nav = now;
    // ⛔ Remembered, because it is a reading posture and not a per-page choice. Being asked again
    // on every feature is the same as not being asked.
    try { localStorage.setItem("productos:nav", now); } catch (e) {}
    window.dispatchEvent(new Event("productos:nav"));
  });
})();
</script>`;

/**
 * The address, on request.
 *
 * ⛔ DELEGATED, AND ON EVERY RENDER — not only the interactive one. Carrying a ref into a ticket is
 * reading, not recording: a read-only preview and a published artifact both need it, and both
 * render `INERT`, which disables every `button.act`. This button is deliberately not one.
 *
 * ⛔ AND IT FALLS BACK, because `navigator.clipboard` is undefined outside a secure context — which
 * is exactly where a page saved to a file is opened. A copy button that silently does nothing is
 * worse than no copy button, so when the API is missing the ref is selected instead and the label
 * says what happened.
 */
const COPY_REF = `<script>
document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("button.copy-ref");
  if (!b) return;
  ev.preventDefault();
  const ref = b.dataset.copy || "";
  const said = (what) => {
    const was = b.textContent;
    b.textContent = what;
    setTimeout(function () { b.textContent = was; }, 1400);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ref).then(function () { said("copied"); }, function () { said(ref); });
  } else {
    said(ref);
  }
});
</script>`;

/** ⛔ Visibly inert, not omitted — see `PageOptions.interactive`. */
const INERT = `<script>
  for (const b of document.querySelectorAll("button.act")) {
    b.disabled = true;
    b.title = "read-only preview — this records nothing";
  }
</script>`;

/** Wraps a page as a standalone file, for opening locally rather than publishing. */
export function standalone(title: string, page: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title></head><body>${page}</body></html>`;
}

/**
 * ⛔ EXPORTED SO THERE IS ONE DESIGN SYSTEM, NOT TWO. The project selector at an instance's root is
 * a page a person looks at, and giving it its own CSS would start a second set of tokens that drift
 * — the thing this file is most careful about everywhere else.
 */
export const STYLE = `<style>
  :root {
    --bg: #fbfaf8; --card: #fff; --ink: #1a1a18; --dim: #6b6b64; --line: #e4e1da;
    --accent: #7c4a2d; --warn: #8a5a00; --warn-bg: #fdf5e3; --bad: #a8301c; --bad-bg: #fcefec;
    --ok: #2f6b45; --code: #f3f1ec;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #17171a; --card: #1f1f23; --ink: #e9e7e2; --dim: #9a9890; --line: #33333a;
      --accent: #d6a184; --warn: #e0b256; --warn-bg: #2b2413; --bad: #e8877a; --bad-bg: #2e1a17;
      --ok: #7fc39a; --code: #26262b;
    }
  }
  :root[data-theme="dark"] {
    --bg: #17171a; --card: #1f1f23; --ink: #e9e7e2; --dim: #9a9890; --line: #33333a;
    --accent: #d6a184; --warn: #e0b256; --warn-bg: #2b2413; --bad: #e8877a; --bad-bg: #2e1a17;
    --ok: #7fc39a; --code: #26262b;
  }
  * { box-sizing: border-box; }
  /* ⛔ The [hidden] attribute is a UA rule of display:none, and ANY class setting display beats it.
     nav.scopes li, the crumb row and the sub-menu are all display:flex, so every element the
     switcher marked hidden stayed on screen: choosing one half still showed the whole tree, and
     Overview's menu sat on top of the breadcrumbs. Worse, it was invisible to testing — reading the
     hidden PROPERTY reported the filtering as correct while the page showed everything, which is
     how it survived a browser check. Assert on visibility, never on the property. */
  [hidden] { display: none !important; }
  body { background: var(--bg); color: var(--ink); margin: 0;
    font: 16px/1.55 ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif; }
  /**
   * ⛔ THE WIDTH GOES TO THE PRODUCT. Peter: *"can we have the content take up the whole width of
   * the screen?"*
   *
   * 52rem is a reading measure, and it is the right one for prose — which is what this page used to
   * be. It is now mostly SCREENS: a drawing rendered at 52rem on a wide display is a mock of a
   * narrow window, reflowed, which is not what the product looks like. The measure survives where
   * it still earns its keep, on the prose blocks.
   */
  main { max-width: 100%; margin: 0 auto; padding: 2.5rem 2rem 6rem; }
  h1 { font-size: 1.9rem; line-height: 1.15; margin: 0 0 .5rem; letter-spacing: -.02em; }
  h2 { font-size: 1.05rem; text-transform: uppercase; letter-spacing: .08em; color: var(--dim);
    margin: 3rem 0 1rem; font-weight: 600; }
  h3 { font-size: 1.15rem; line-height: 1.3; margin: .35rem 0 .6rem; }
  p { margin: .4rem 0; }
  code { font: .85em ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--code);
    padding: .1em .35em; border-radius: 3px; }
  .top { border-bottom: 1px solid var(--line); padding-bottom: 1.25rem; }
  .lede { color: var(--dim); font-size: 1.05rem; }
  .lede strong { color: var(--ink); }
  .mode { font-size: .85rem; color: var(--dim); background: var(--code); border-radius: 6px;
    padding: .5rem .7rem; margin-top: 1rem; }
  .mode.live { color: var(--ok); background: transparent; border: 1px solid var(--line); }
  .alarm { background: var(--bad-bg); border-left: 3px solid var(--bad); border-radius: 0 6px 6px 0;
    padding: .9rem 1.1rem; margin: 1.5rem 0; }
  .alarm p { margin: 0 0 .4rem; } .alarm ul { margin: 0; padding-left: 1.2rem; font-size: .9rem; }
  .k { font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; color: var(--dim);
    margin: 0 0 .15rem; font-weight: 600; }

  .q { background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 1.25rem; margin: 0 0 1.25rem; }
  .q > header { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap;
    font-size: .75rem; color: var(--dim); margin-bottom: .4rem; }
  /** ⛔ Not monospace any more — it is a sentence now, and code type is what says "this is an id". */
  .q .ref { font-weight: 600; color: var(--ink); }
  .q .kind { border: 1px solid var(--line); border-radius: 99px; padding: .05rem .5rem; }
  /*
   * The address, behind a press. ⛔ Quiet by construction: a reviewer never needs it, and the one
   * reason it is on the page at all is somebody carrying a ref into a ticket or a command.
   */
  button.copy-ref { font: inherit; font-size: .72rem; color: var(--dim); background: transparent;
    border: 1px solid var(--line); border-radius: 99px; padding: .05rem .5rem; cursor: pointer; }
  button.copy-ref:hover, button.copy-ref:focus-visible { color: var(--ink); border-color: var(--accent); }
  .q .where { color: var(--dim); font-size: .9rem; margin: 0 0 .8rem; }
  .q.parked { opacity: .82; }
  .badge { border-radius: 99px; padding: .05rem .5rem; font-size: .72rem; border: 1px solid var(--line); }
  .badge.warn { color: var(--warn); border-color: var(--warn); }
  .badge.bad { color: var(--bad); border-color: var(--bad); }
  .badge.parked { color: var(--dim); }
  .cost, .observed, .revises { background: var(--code); border-radius: 8px; padding: .75rem .9rem;
    margin: .9rem 0; font-size: .92rem; }
  .cost { border-left: 3px solid var(--warn); }
  .revises .v { margin: 0 0 .6rem; }
  /* ⛔ One statement per line, and the unruled one marked — glued into a paragraph, a
     seven-statement slot gave a reviewer no way to see which of the seven an option touches. */
  .says-each { margin: 0 0 .6rem; padding-left: 1.1rem; }
  .says-each li { margin: 0 0 .35rem; }
  .says-each li.in-question { font-weight: 600; }
  .says-each li.in-question .tag { font-weight: 400; font-size: .8em; opacity: .75;
    border: 1px solid currentColor; border-radius: 999px; padding: 0 .4em; margin-left: .3em; }
  .revises .note { color: var(--dim); font-size: .85rem; margin: .5rem 0 0; }
  .observed ul { margin: .3rem 0 0; padding-left: 1.1rem; }
  .observed .basis { color: var(--dim); font-size: .85em; }
  .blocks { font-size: .9rem; color: var(--dim); }
  .owes { font-size: .88rem; color: var(--warn); background: var(--warn-bg);
    border-radius: 6px; padding: .5rem .7rem; }
  /*
   * An empty section, closed. ⛔ The summary is NOT warn-coloured: four of these on a new feature
   * are the normal state of a corpus somebody is still writing, and spending the alarm colour on
   * them is how the alarm colour stops meaning anything. The warning is inside, where somebody who
   * opened it has asked for it.
   */
  .owes-fold { margin: 1.1rem 0 0; }
  .owes-fold > summary { cursor: pointer; list-style: none; font-size: .78rem; font-weight: 600;
    letter-spacing: .05em; text-transform: uppercase; color: var(--dim); }
  .owes-fold > summary::-webkit-details-marker { display: none; }
  .owes-fold > summary::before { content: "▸ "; }
  .owes-fold[open] > summary::before { content: "▾ "; }
  .owes-fold .owes-tag { text-transform: none; letter-spacing: 0; font-weight: 400; opacity: .8; }
  .owes-fold .owes { margin-top: .4rem; }
  .parked-why { font-size: .9rem; color: var(--dim); }

  .opts { display: grid; gap: .75rem; margin: 1rem 0; }
  .opt { display: grid; grid-template-columns: 1.6rem 1fr; gap: .75rem;
    border: 1px solid var(--line); border-radius: 8px; padding: .9rem; }
  .opt-n { font-variant-numeric: tabular-nums; color: var(--dim); font-weight: 600; }
  .opt-says { margin: 0 0 .4rem; }
  .opt-why { color: var(--dim); font-size: .92rem; margin: 0 0 .7rem; }
  .opt-flag { color: var(--warn); font-size: .85rem; margin: 0 0 .7rem; }

  button.act { font: inherit; font-size: .9rem; cursor: pointer; border-radius: 6px;
    padding: .4rem .8rem; background: var(--accent); color: var(--bg); border: 1px solid var(--accent); }
  button.act.ghost { background: transparent; color: var(--ink); border-color: var(--line); }
  button.act.primary { padding: .5rem 1rem; }
  button.act[disabled] { cursor: not-allowed; opacity: .45; }
  .q-acts { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: 1rem;
    padding-top: .9rem; border-top: 1px solid var(--line); }

  .counts { display: flex; gap: .9rem; flex-wrap: wrap; font-size: .85rem; color: var(--dim); }
  .counts .warn { color: var(--warn); } .counts .bad { color: var(--bad); font-weight: 600; }
  /** ⛔ Confirmed-or-not beside a sentence. Palette tokens only — an invented colour paints nothing. */
  /** ⛔ Where a press goes, said on the card. A derived destination says so — it is a reading, not a claim. */
  /** ⛔ A named role or permission, so it reads as a thing the product has rather than a word in a sentence. */
  .access-list { list-style: none; padding: 0; display: grid; gap: .9rem; }
  .access-list > li { border: 1px solid var(--line); border-radius: .4rem; padding: .6rem .8rem; background: var(--card); }
  .access-head { margin: 0 0 .3rem; }
  .access-by { margin: .2rem 0; font-size: .85rem; color: var(--dim); }
  .reaches { margin: .3rem 0 0 1rem; font-size: .9rem; color: var(--dim); }
  .held-by { display: flex; flex-wrap: wrap; gap: .3rem; margin: .4rem 0 0; }
  .held-by .who { font-size: .74rem; letter-spacing: .02em; padding: .1rem .4rem; border-radius: 3px;
    border: 1px solid var(--line); color: var(--dim); background: var(--card); }
  .held-by .who.role { border-color: var(--accent); color: var(--accent); }
  .held-by .who.unknown { border-color: var(--bad); color: var(--bad); }
  .beh-where .goes { color: var(--accent); }
  .beh-where .goes.done { color: var(--ok); }
  .beh-where .goes i { color: var(--dim); font-style: italic; }
  /**
   * ⛔ A SINGLE TABLE, NOTHING CLIPPED. Peter: *"even MORE tabular. single table. do not truncate
   * text, make the text all visible."*
   *
   * The previous pass clipped the sentence with an ellipsis, which put the one thing a reviewer is
   * judging behind a tap. ⛔ So the sentence column wraps and has no max-height: a long behaviour
   * makes a tall row, which is correct — the row is as big as what it says.
   */
  /**
   * ⛔ THE PROTOTYPE IN ITS OWN FRAME, AT A HEIGHT THE READER SETS. See the markup for why the
   * height is a variable rather than a fixed half.
   */
  /**
   * ⛔ A FEATURE IS A FRAME, NOT A DOCUMENT. Peter: *"let's just make it a full on frame - so
   * scrolling the bottom frame is independent of the top."*
   *
   * The chrome height is measured rather than guessed: the top frame and whatever is stacked at the
   * bottom both change height when text wraps on a narrow window, and a guessed offset is right
   * until it is not — which is the lesson the bottom bars already taught in this file.
   */
  :root { --proto-h: 46vh; --chrome-h: 9rem; }
  section.view.framed { display: flex; flex-direction: column; height: calc(100dvh - var(--chrome-h));
    min-height: 20rem; overflow: hidden; }
  /**
   * ⛔ WHILE A FRAMED VIEW IS SHOWING, THE DOCUMENT DOES NOT SCROLL. Every scroll belongs to a pane
   * inside the frame — otherwise the prototype rides off the top, which is the one thing pinning it
   * was for. ⛔ And the composer's clearance goes with it: the frame's own height already subtracts
   * the composer, so keeping the padding would push the bottom of the frame under it.
   */
  /**
   * ⛔ THE PAGE PADDING ON MAIN IS THE SPACE ABOVE THE TITLE. Peter: *"there's still space above the
   * title"* — after I had reported it as zero, because I measured from the top of the VIEW and the
   * 40px was on the element above it. A 2.5rem top padding is right for a document
   * and wrong for a frame, where the top of the pane is the top of the content.
   *
   * ⛔ The 6rem at the bottom was worse than cosmetic: it is clearance for the fixed composer, which
   * the frame's own height already subtracts — so the frame ran 96px past the viewport and the last
   * row of the table was unreachable.
   */
  :root[data-framed] main { padding-top: .4rem; padding-bottom: 0; }
  :root[data-framed] body { overflow: hidden; }
  :root[data-framed] body.has-note-bar { padding-bottom: 0; }
  section.view.framed > .below { flex: 1 1 auto; min-height: 0; overflow: auto; }
  /** ⛔ A zero min-height, or a flex child refuses to shrink and scrolls the page instead of itself. */
  section.view.framed > .proto-frame { flex: 0 0 auto; }
  .proto-frame { position: relative; margin: 0 0 .6rem; }
  .proto-scroll { height: var(--proto-h); overflow: auto; border: 1px solid var(--line);
    border-radius: .4rem; background: var(--card); padding: .35rem .5rem; }
  /**
   * ⛔ THE SPACE ABOVE THE DRAWING. Peter: *"there's white space above the 'Create a deal' form part
   * in the prototype - just wasted space."* It was 97px before the picture: a 1.5rem margin on the
   * screens section, then a 1.2rem margin on the screen, then a heading on a line of its own
   * repeating the name of the feature directly above it.
   */
  .proto-scroll .screens { margin: 0; }
  .proto-scroll .screen { margin: 0; }
  .proto-scroll .screen h4 { font-size: .78rem; font-weight: 600; color: var(--dim); margin: 0;
    display: inline-flex; align-items: baseline; gap: .3rem; }
  /** ⛔ Hidden means zero height and no border, never display none — the grip has to stay reachable. */
  :root[data-proto="off"] .proto-scroll { height: 0; padding: 0; border-width: 0; overflow: hidden; }
  .proto-grip { height: .9rem; display: flex; align-items: center; justify-content: center;
    cursor: ns-resize; touch-action: none; }
  .proto-grip::before { content: ""; width: 3rem; height: 3px; border-radius: 2px; background: var(--line); }
  .proto-grip:hover::before, .proto-grip:focus-visible::before { background: var(--accent); }
  .proto-hide { position: absolute; right: .2rem; bottom: -.15rem; font: inherit; font-size: .7rem;
    line-height: 1; padding: .2rem .5rem; border: 1px solid var(--line); border-radius: 4px;
    background: var(--card); color: var(--dim); cursor: pointer; }
  .proto-hide:hover { color: var(--ink); border-color: var(--accent); }
  /**
   * ⛔ IT SAYS WHICH WAY IT GOES, AND IT IS LEGIBLE WHEN COLLAPSED — the state is remembered, so a
   * collapsed frame is what a reader comes back to days later. A 20px caret with a tooltip reading
   * "hide the screen" about an already-hidden screen is a dead end somebody never gets out of.
   */
  .proto-hide .when-off { display: none; }
  :root[data-proto="off"] .proto-hide .when-open { display: none; }
  :root[data-proto="off"] .proto-hide .when-off { display: inline; }
  :root[data-proto="off"] .proto-hide { position: static; border-color: var(--accent); color: var(--accent); }
  :root[data-proto="off"] .proto-grip { height: auto; padding: .25rem 0; cursor: default; }
  :root[data-proto="off"] .proto-grip::before { display: none; }
  /** ⛔ Small. Peter: *"get rid of that, make the title pretty small."* */
  .feature-title { font-size: 1rem; font-weight: 600; margin: 0 0 .5rem; letter-spacing: -.01em; }
  /*
   * ⛔ THE VERDICT IS THE FIRST THING ON A FEATURE, and it is a line rather than a banner.
   *
   * A reviewer's question is "can this be built" and the page answered it nowhere — not low down,
   * not anywhere. ⛔ It is NOT an .alarm: a feature with open questions is the normal state of a
   * corpus being written, and painting every one of them as an emergency is how a reader learns to
   * skip the colour that matters.
   */
  .feature-head { margin: 0 0 .75rem; }
  .verdict { margin: 0; font-size: .92rem; }
  .verdict b { font-weight: 600; }
  .verdict.ready b { color: var(--ok); }
  .verdict.blocked b { color: var(--warn); }
  .verdict-holes, .verdict-qs { margin: .25rem 0 0; padding-left: 1.1rem; font-size: .88rem; }
  .verdict-holes li { color: var(--warn); margin: .1rem 0; }
  .verdict-qs li { margin: .1rem 0; }
  .verdict-asks { margin: .5rem 0 0; font-size: .88rem; color: var(--dim); }
  table.beh-table { width: 100%; border-collapse: collapse; font-size: .92rem; }
  table.beh-table th { text-align: left; font-size: .7rem; letter-spacing: .05em; text-transform: uppercase;
    color: var(--dim); font-weight: 600; padding: .3rem .5rem; border-bottom: 1px solid var(--line); }
  table.beh-table td { padding: .5rem; border-bottom: 1px solid var(--line); vertical-align: top; }
  /**
   * ⛔ WIDER, BECAUSE THE BUTTONS SAY WHAT THEY DO NOW. 5.5rem held three glyphs. Three words need
   * room, and a nowrap on a column that no longer fits is how a table starts pushing a page
   * sideways on a phone — which is the other defect in this same pass.
   */
  table.beh-table td:last-child { width: 1%; text-align: right; }
  /** ⛔ Inline, at the end of the sentence — an annotation on it rather than a column beside it. */
  /** ⛔ A framing card, the same shape as everything else somebody agrees to on this page. */
  .frame-card { border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: .3rem;
    padding: .6rem .8rem; margin: 0 0 .6rem; background: var(--card); }
  .frame-says { margin: 0; line-height: 1.5; }
  .frame-extra { margin: .35rem 0 0; font-size: .88rem; color: var(--dim); }
  .frame-extra .k { font-size: .7rem; letter-spacing: .04em; text-transform: uppercase; margin-right: .3rem; }
  .frame-card .chips { display: block; margin: .45rem 0 0; }
  .frame-card footer.beh-acts.icons { margin: .4rem 0 0; }
  .chips { display: inline; white-space: nowrap; }
  .chips .chip { margin-left: .3rem; vertical-align: .05em; }
  tr.beh { cursor: pointer; }
  tr.beh:hover > td { background: var(--code); }
  tr.beh.open > td { background: var(--code); }
  /** ⛔ One tbody per screen, with its own heading row — the unit a reviewer holds in their head. */
  tr.group th { padding: .9rem .5rem .35rem; font-size: .8rem; text-transform: none; letter-spacing: 0;
    color: var(--ink); border-bottom: 2px solid var(--accent); }
  tr.group th .n { font-weight: 400; color: var(--dim); font-size: .75rem; }
  tr.beh-detail > td { background: var(--bg); padding: .2rem 1rem 1rem; }
  .row-says { line-height: 1.45; }
  .chip { display: inline-block; font-size: .7rem; letter-spacing: .03em; padding: .12rem .45rem;
    border: 1px solid var(--line); border-radius: 999px; color: var(--dim); white-space: nowrap; }
  .chip.ok { border-color: var(--ok); color: var(--ok); }
  .chip.warn { border-color: var(--warn); color: var(--warn); }
  .chip.type { border-style: dashed; }
  /*
   * WHO A VARIANT IS FOR. Filled rather than outlined, because it is not a status — it is the
   * audience this drawing or this sentence belongs to, and a reader scanning a feature with several
   * variants is looking for the one that is theirs.
   */
  /*
   * ⛔ NO INVENTED TOKEN. The first version painted an accent-soft variable this page has never
   * defined — so it resolved to nothing and the chip drew with no background at all. A guard here
   * catches that, and it caught this; a fallback would have hidden it, which is why none is used.
   */
  .chip.holds { border-color: var(--accent); color: var(--accent); }
  /*
   * THE DIMENSION FILTER, ON THE BREADCRUMB LINE OF EVERY PAGE.
   *
   * ⛔ One row, and it wraps rather than scrolling: a product with four dimensions would otherwise
   * put the fourth off the edge of the line, and a control you cannot see is a filter nobody knows
   * is applied.
   */
  .dimfilter { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; }
  .dimpick { display: inline-flex; align-items: center; gap: .25rem; font-size: .78rem; color: var(--dim); }
  .dimpick .dimlabel { white-space: nowrap; }
  .dimpick select { font: inherit; font-size: .78rem; padding: .1rem .25rem; border: 1px solid var(--line);
    border-radius: 4px; background: var(--card); color: var(--ink); }
  /*
   * ⛔ WHAT IS BEING HIDDEN, SAID BESIDE THE CONTROL THAT HID IT. A page that quietly omits truth is
   * how somebody agrees to less than they think they are agreeing to — the count is the thing that
   * makes the omission visible, so it is not tucked anywhere.
   */
  .dimhid { font-size: .72rem; color: var(--warn); white-space: nowrap; }
  .dimhid[hidden] { display: none; }
  /* ⛔ A class rather than the hidden attribute: table rows already use that for open and closed. */
  .dimhide { display: none !important; }
  /*
   * SUPPORT IS NOT CONFIRMATION, AND THE EYE MUST NOT HAVE TO READ THE WORD TO KNOW.
   *
   * Peter chose that a confirmation may raise another statement's strength, on the condition that
   * the two zones stay visibly distinct. A chip reading "corroborated" in the same shape and colour
   * as "confirmed" would make that condition false while satisfying it in the markup.
   *
   * So: a square chip, never the pill. "confirmed" is the only pill carrying a colour, and nothing
   * in the lower zone is ever the ok colour. Squared corners carry at a glance and in a screenshot,
   * which is how this corpus is actually reviewed.
   *
   * No backticks in this comment, deliberately: this whole block is inside a template literal, and
   * a backtick here ends the CSS and the build fails somewhere unrelated.
   */
  .chip.support { border-radius: 3px; border-color: var(--line); color: var(--dim);
    background: color-mix(in oklab, var(--line) 18%, transparent); }
  /*
   * The strong tier is darker, not coloured. It must stay inside the lower zone's vocabulary - a
   * colour here is how "strongly supported" starts reading like "confirmed".
   *
   * --fg was the first attempt and this page does not define it, so it resolved to nothing and the
   * text painted as whatever it inherited. Caught by the test that walks every token painted with
   * against every token defined, which is the only reason it was not a silently invisible chip.
   */
  .chip.support.strong { border-color: var(--ink); color: var(--ink); }
  /* Borrowed, not earned - and it says so rather than looking stronger silently. */
  .chip.support.inherited { border-style: dotted; }
  /*
   * Why it has the confidence it has. Peter: "the reason why it has confidence needs to be visible
   * as well" - so it is text on the page, not a title attribute. A tooltip is not visible: it
   * cannot be scanned down a column, it does not survive a screenshot, and on a touch screen it
   * does not exist.
   */
  .why { margin: .3rem 0 0; padding-left: .7rem; border-left: 2px solid var(--line);
    font-size: .78rem; color: var(--dim); }
  .why li { list-style: none; margin: .12rem 0; }
  .why li.borrowed { color: var(--warn); }
  /*
   * What moved since somebody agreed. Shown rather than summarised, because "changed since" tells a
   * reviewer their acceptance is dead and nothing about what to do next.
   */
  .moved { margin: .3rem 0 0; padding-left: .7rem; border-left: 2px solid var(--warn);
    font-size: .78rem; }
  .moved .k { color: var(--warn); margin: 0 0 .15rem; }
  .moved .gone { color: var(--dim); text-decoration: line-through; margin: .1rem 0; }
  .moved .came { color: var(--ink); margin: .1rem 0; }
  .row-acts { display: flex; gap: .25rem; justify-content: flex-end; flex-wrap: wrap; }
  /** ⛔ One gesture, one meaning: the footers use the same icons AND the same words as a row. */
  footer.beh-acts.icons { display: flex; gap: .25rem; margin: .5rem 0 0; flex-wrap: wrap; }
  footer.beh-acts.icons .act.icon, .row-acts .act.icon { font: inherit; font-size: .78rem; line-height: 1.3;
    padding: .25rem .45rem; white-space: nowrap;
    border: 1px solid var(--line); border-radius: 4px; background: var(--card); color: var(--dim); cursor: pointer; }
  /** The glyph is what the eye finds on row two hundred; the word is what tells a newcomer. */
  .act.icon .glyph { font-size: .9rem; }
  footer.beh-acts.icons .act.icon:hover, .row-acts .act.icon:hover { color: var(--ink); border-color: var(--accent); }
  .row-acts .act.icon.danger:hover { color: var(--bad); border-color: var(--bad); }
  .says-edit { width: 100%; font: inherit; font-size: .92rem; padding: .3rem; border: 1px solid var(--accent);
    border-radius: 4px; background: var(--card); color: var(--ink); }
  .beh-state { display: flex; align-items: baseline; gap: .5rem; margin: .6rem 0 .2rem; font-size: .85rem; }
  .beh-state b { text-transform: uppercase; letter-spacing: .04em; color: var(--dim); }
  .beh-state span { color: var(--dim); }
  .beh-state.ok b { color: var(--ok); }
  .beh-state.warn b { color: var(--warn); }
  .beh-acts.quiet { opacity: .75; }
  .status.inline { margin: .4rem 0 0; font-size: .85rem; }
  /**
   * ⛔ THE STAGE, AND ITS REASON, AS ONE THING. Tokens only from the palette above — a colour
   * invented here paints nothing and fails silently, which has happened twice.
   */
  .stage { display: flex; flex-wrap: wrap; align-items: baseline; gap: .5rem .75rem; margin: 0 0 1rem;
    padding: .5rem .7rem; border: 1px solid var(--line); border-radius: .4rem; background: var(--card); }
  .stage b { font-size: .8rem; letter-spacing: .04em; text-transform: uppercase; }
  .stage span { color: var(--dim); font-size: .9rem; }
  .stage.spec b { color: var(--dim); }
  .stage.ready { border-color: var(--warn); background: var(--warn-bg); }
  .stage.ready b { color: var(--warn); }
  .stage.good { border-color: var(--ok); }
  .stage.good b { color: var(--ok); }
  .stage .blockers { color: var(--bad); }
  .scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--card); }
  table.grid { border-collapse: collapse; width: 100%; font-size: .85rem; }
  table.grid th, table.grid td { border-bottom: 1px solid var(--line); padding: .55rem .6rem; text-align: left; }
  table.grid thead th { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em;
    color: var(--dim); font-weight: 600; white-space: nowrap; }
  table.grid tbody th { font-weight: 400; min-width: 12rem; }
  table.grid .ex { display: block; }
  table.grid tbody th code { font-size: .72em; background: none; padding: 0; color: var(--dim); }
  table.grid .asked { display: block; font-size: .72rem; color: var(--dim); }
  table.grid td { white-space: nowrap; font-family: ui-monospace, Menlo, monospace; }
  .mark { font-size: 1rem; } .also { color: var(--dim); font-size: .8em; margin-left: .2em; }
  .legend { margin: 1rem 0; font-size: .88rem; }
  .legend summary { cursor: pointer; color: var(--dim); }
  .legend dl { display: grid; grid-template-columns: 3.5rem 1fr; gap: .3rem .8rem; margin: .8rem 0 0; }
  .legend dt { font-family: ui-monospace, Menlo, monospace; color: var(--accent); }
  .legend dd { margin: 0; color: var(--dim); }
  .rules { margin-top: 1.25rem; font-size: .9rem; }
  .rules h3 { font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; color: var(--dim); }
  .rules p { border-left: 2px solid var(--line); padding-left: .8rem; margin: .8rem 0; }
  .rn { font-family: ui-monospace, Menlo, monospace; color: var(--accent); font-weight: 600; }
  .fills { color: var(--dim); font-size: .85em; }

  .ex-card { background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 1.25rem; margin: 0 0 1.25rem; }
  .ex-card > header { margin-bottom: 1rem; }
  .ex-card > header h3 { margin: 0 0 .25rem; }
  .ex-card > header code { font-size: .75rem; }
  .ex-card .asked { font-size: .75rem; color: var(--dim); margin-left: .5rem; }
  .slots { display: grid; gap: .1rem; }
  .slot { display: grid; grid-template-columns: 5.5rem 1fr; gap: .8rem; padding: .5rem 0;
    border-top: 1px solid var(--line); font-size: .93rem; }
  .sk { font-family: ui-monospace, Menlo, monospace; font-size: .8rem; color: var(--dim); padding-top: .12rem; }
  .slot.empty .sv { color: var(--bad); }
  .nobody { font-style: italic; }
  .from { display: block; font-size: .78rem; color: var(--dim); margin-top: .25rem; }
  .from code { font-size: .95em; }
  .from.bad-rule { color: var(--bad); }
  .derived { color: var(--dim); font-style: italic; }
  .record { margin-top: 1rem; font-size: .88rem; }
  .record summary { cursor: pointer; color: var(--dim); }
  .record ol { margin: .7rem 0 0; padding-left: 1.2rem; }
  .record li { margin: .7rem 0; }
  .dact { font-family: ui-monospace, Menlo, monospace; font-size: .78rem; color: var(--accent);
    text-transform: uppercase; letter-spacing: .04em; }
  .dhow { color: var(--dim); font-size: .85rem; margin-left: .4rem; }
  .dsays { margin: .3rem 0; }
  .dwhy { margin: .2rem 0; color: var(--dim); font-size: .92rem; }
  .dwhy .k { display: inline; margin-right: .3rem; }
  a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
  .unlinked { color: var(--ink); border-bottom: 1px dotted var(--line); }
  nav.scopes { margin: 1.25rem 0 0; }
  nav.scopes ul { list-style: none; margin: 0; padding: 0; font-size: .92rem; }
  /*
   * ⛔ A ROW IS A ROW, AND ITS SUBTREE IS A LIST INSIDE IT.
   *
   * The indent used to be the only thing expressing depth, on one flat list — which is exactly why
   * nothing could collapse: there was no element holding a container's items to hide. Now the rows
   * nest, so the structure carries the depth and the row box stops being a flex row itself; the
   * head of each row is.
   */
  nav.scopes li { border-bottom: 1px solid var(--line); }
  nav.scopes li > ul > li:last-child { border-bottom: 0; }
  /*
   * ⛔ THE ROW IS AS WIDE AS WHAT IS IN IT, AND AT LEAST AS WIDE AS THE MENU.
   *
   * max-content is what lets the column scroll to a long name instead of cutting it. min-width:
   * 100% is what keeps the hover band full width anyway — without it a short row's highlight stops
   * at the end of its text, so the thing under the pointer and the thing lit up are different
   * shapes, which reads as a rendering fault rather than a hover.
   */
  nav.scopes .scoperow { display: flex; align-items: center; gap: .3rem;
    width: max-content; min-width: 100%; border-radius: 4px;
    padding: .3rem .4rem .3rem calc(var(--d) * .55rem + .4rem); }
  /*
   * ⛔ AND EVERY ITEM ANSWERS THE POINTER. Peter: *"also make a hover for each item even with
   * scrolling on"*.
   *
   * Only the link reacted before, so the half of the row holding the chips was dead to the pointer —
   * in a menu you are scrolling sideways, losing track of which line you are on is the whole
   * difficulty. The band is the row, not the text in it.
   */
  nav.scopes .scoperow:hover { background: var(--card); }
  nav.scopes .scoperow:hover > a { text-decoration: underline; }
  /*
   * ⛔ NOTHING IN THE MENU IS CUT OFF. Peter: *"we shouldn't have anything truncated in the menu...
   * don't truncate, scroll"*.
   *
   * An ellipsis destroys the one thing a menu row carries. Two features whose names differ at the
   * end — and in a real corpus they do, because they are filed under a shared container and named
   * for what separates them — render as the same row, so the menu stops distinguishing exactly the
   * items it exists to distinguish.
   *
   * ⛔ SO THE ROW KEEPS ITS WIDTH AND THE MENU SCROLLS. flex: 1; min-width: 0 was what made the
   * label the part that gives: it told the label to absorb the shortfall and permitted it to shrink
   * below its content. Without them the row is as wide as its contents and the column scrolls
   * sideways to reach the rest — see the overflow rule in the side-menu block.
   *
   * ⛔ nowrap STAYS. Wrapping is the other way to avoid truncating, and it makes a row two or three
   * lines tall — so a menu of a dozen features becomes a page of prose, which is worse than either.
   */
  nav.scopes .scoperow > a, nav.scopes .scoperow > strong, nav.scopes .scoperow > .unlinked {
    flex: 0 0 auto; white-space: nowrap; }
  /*
   * ⛔ A MENU ITEM IS NOT A LINK IN A PARAGRAPH. Driven and looked at: the area rows rendered with
   * the document's default anchor styling — underlined, in link colour — so a menu read as body text
   * somebody had pasted into a column. Underline on hover only, which is where it says "this is
   * pressable" without saying it twelve times at rest.
   */
  nav.scopes .scoperow > a { text-decoration: none; color: inherit; }
  nav.scopes .scoperow > a:hover { text-decoration: underline; }
  /*
   * ⛔ COLLAPSING IS THE SIDE MENU'S BEHAVIOUR AND ONLY ITS.
   *
   * Peter: *"you completely broke support for the top menu..... 🤦... are you compeltely unaware of
   * how the product works?"*, then *"top menu shoudl more or less behave as before"* and *"tabs
   * instead of collapsible rows"*.
   *
   * Across the top, the tree behind the chevron is the ONLY way to reach a feature — the groups
   * collapse to a row and hold nothing. Making rows collapsible by default turned that into four
   * area names with their contents folded away, and with the row chevrons gone there was nothing to
   * open them: a chevron that reveals a list of four things you cannot expand.
   *
   * ⛔ AND MY FIRST DIAGNOSIS OF HIS REPORT WAS WRONG. I assumed the area subtrees were being laid
   * out in the tab row by contents-display, wrote a rule to hide them, and the probe said they were
   * already hidden — top mode hides the whole tree until the chevron. The rule was redundant and the
   * break was somewhere else entirely. Measured rather than reasoned about, which is the only reason
   * the redundant rule did not ship as the fix.
   *
   * So: open everywhere, and foldable only down the side.
   */
  nav.scopes li.holds > ul { display: block; }
  /*
   * ⛔ NO CONTROL ON A ROW, SO THE NESTING CARRIES THE DEPTH ON ITS OWN. With a chevron on every
   * container and a spacer on every leaf, the labels lined up because each row paid the same 1.05rem
   * whether it had a control or not. Both are gone — *"we don't need the chevron next to 'attachment
   * routing'"* — so a nested list is indented as a list, which is what one is for.
   */
  nav.scopes li > ul { padding-left: .85rem; border-left: 1px solid var(--line); margin-left: .35rem; }
  /*
   * ⛔ A COUNT IS A CHIP: a number and a mark, in a pill beside the label.
   *
   * Peter: *"shorten '5 unanswered' '5 {? icon}', and '59 to read' to '59 {eyes icon}'. make them
   * chips next to the menu item name"*. Spelled out, two of these were wider than the feature name
   * they sat beside, so every row wrapped onto a second line and the menu read as prose.
   */
  nav.scopes .n { font-size: .72rem; color: var(--dim); flex: 0 0 auto;
    display: inline-flex; align-items: baseline; gap: .1rem; padding: .05rem .34rem;
    border: 1px solid var(--line); border-radius: 999px; background: var(--card);
    font-variant-numeric: tabular-nums; }
  /*
   * ⛔ THE NUMBER IS THE FIGURE AND THE MARK IS ITS UNIT. At an equal size and an equal weight the
   * chip read as two separate things — "35" and "?" — rather than as one count of one kind, which is
   * what a chip is for. The figure carries the weight; the mark is quieter and smaller, the way a
   * unit is set beside a number anywhere else.
   */
  nav.scopes .n { font-weight: 600; }
  nav.scopes .n .mark { font-size: .62rem; line-height: 1; opacity: .75; font-weight: 400; }
  nav.scopes .n.warn { color: var(--warn); }
  nav.scopes .n.ok { color: var(--ok); }
  nav.scopes .grouping { color: var(--dim); }
  nav.scopes li.jump { border-bottom: 1px solid var(--line); padding-bottom: .45rem; margin-bottom: .2rem; }
  nav.scopes li.jump a { font-weight: 600; }
  nav.scopes a.on { font-weight: 700; text-decoration: none; }
  nav.scopes a.on::before { content: "▸ "; color: var(--accent); }
  .topframe { position: sticky; top: 0; z-index: 8; background: var(--bg);
    border-bottom: 1px solid var(--line); }
  /**
   * ⛔ IT WRAPS, BECAUSE AT 390px IT DID NOT AND THE PAGE WENT SIDEWAYS.
   *
   * Four tabs and Overview's own strip are one flex row — a display of "contents" on the groups puts
   * them all in it — and with no wrap the row measured 446px inside a 390px viewport, so the
   * document itself scrolled horizontally and the last tab was off the right edge. A navigation
   * you have to scroll to reach is one a phone reader does not know exists.
   */
  .topframe .tabs { display: flex; flex-wrap: wrap; gap: .15rem; max-width: 100%; margin: 0 auto;
    padding: .55rem 1.25rem 0; }
  /*
   * ⛔ THE GROUP LEAVES THE LAYOUT IN TOP MODE. A display of "contents" puts the head and the strip back
   * in the tabs flex row exactly where they were, so grouping is a fact about the DOM and the top
   * menu does not change at all. Nesting is the side menu's business.
   */
  .topframe .tabgroup { display: contents; }
  .topframe .tabhead { display: contents; }
  /* ⛔ Nothing to collapse in a row — the twisty is the side menu's control. */
  .topframe .twisty { display: none; }
  .topframe .tab { font: inherit; font-size: .92rem; background: none; border: 0;
    border-bottom: 2px solid transparent; color: var(--dim); cursor: pointer;
    padding: .4rem .7rem; border-radius: 4px 4px 0 0; }
  .topframe .tab:hover { color: var(--ink); }
  .topframe .tab.on { color: var(--ink); font-weight: 600; border-bottom-color: var(--accent); }
  .topframe .subtabs { display: flex; gap: .15rem; flex-wrap: wrap; max-width: 100%;
    margin: 0 auto; padding: .35rem 1.25rem .5rem; border-top: 1px solid var(--line); }
  .subtab { font: inherit; font-size: .88rem; background: none; border: 0; cursor: pointer;
    color: var(--dim); padding: .35rem .6rem; border-bottom: 2px solid transparent; }
  .subtab:hover { color: var(--ink); }
  .subtab.on { color: var(--ink); font-weight: 600; border-bottom-color: var(--accent); }
  .subtab .pill, .topframe .tab .pill { font-size: .72rem; background: var(--warn); color: var(--bg);
    border-radius: 99px; padding: .05rem .4rem; margin-left: .25rem; vertical-align: .05em; }
  .crumbs { display: flex; gap: .5rem; align-items: center; width: 100%;
    max-width: 100%; margin: 0 auto; padding: .45rem 2rem .6rem;
    border-top: 1px solid var(--line); background: none; border: 0;
    font: inherit; font-size: .9rem; color: var(--ink); cursor: pointer; text-align: left; }
  .trail { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .trail .up { color: var(--dim); }
  .trail .at { font-weight: 600; }
  .trail .sep { color: var(--dim); margin: 0 .4rem; }
  .trail a.up { color: var(--dim); text-decoration: none; }
  .trail a.up:hover { color: var(--accent); text-decoration: underline; }
  .chev { background: none; border: 1px solid var(--line); border-radius: 6px;
    color: var(--dim); cursor: pointer; font: inherit; line-height: 1; padding: .25rem .5rem;
    transition: transform .12s ease; }
  .chev:hover { color: var(--ink); border-color: var(--accent); }
  .crumbs.open .chev { transform: rotate(180deg); }
  /* ── Where the menu lives: one attribute on the root, one set of markup. ──
     ⛔ NOT A SECOND FRAME. Everything below re-lays out the frame that is already there; nothing
     here adds a row, a count or a link that the top placement does not also have, so a reader who
     moves the menu cannot lose a way in that only one placement knew about. */
  .navplace { margin-left: auto; align-self: center; font: inherit; font-size: .8rem;
    background: none; border: 1px solid var(--line); border-radius: 6px; color: var(--dim);
    cursor: pointer; padding: .25rem .55rem; white-space: nowrap; }
  .navplace:hover { color: var(--ink); border-color: var(--accent); }
  .navplace .to-top { display: none; }
  /* ⛔ NO BUTTON WHERE THERE IS NO CHOICE. Below the breakpoint the menu is at the top whatever
     was remembered, and a control still offering to move it there is offering a move that has
     already happened — it reads as broken rather than as unavailable. */
  @media (max-width: 61.999rem) { .navplace { display: none; } }
  :root[data-nav="left"] .navplace .to-left { display: none; }
  :root[data-nav="left"] .navplace .to-top { display: inline; }
  /* Connect Claude Code: a small control at the end of the menu row, its panel floating below it. */
  .connect { position: relative; align-self: center; margin-left: .5rem; font-size: .8rem; }
  .connect > summary { list-style: none; cursor: pointer; white-space: nowrap; color: var(--dim);
    border: 1px solid var(--line); border-radius: 6px; padding: .25rem .55rem; }
  .connect > summary::-webkit-details-marker { display: none; }
  .connect > summary:hover, .connect[open] > summary { color: var(--ink); border-color: var(--accent); }
  .connect-panel { position: absolute; right: 0; top: calc(100% + .35rem); z-index: 30;
    width: min(30rem, calc(100vw - 2rem)); box-sizing: border-box; padding: .8rem .9rem;
    background: var(--card); border: 1px solid var(--line); border-radius: 8px;
    box-shadow: 0 6px 24px rgba(0,0,0,.12); color: var(--ink); font-size: .85rem; }
  .connect-panel p { margin: 0 0 .6rem; }
  .connect-panel button { font: inherit; cursor: pointer; border: 1px solid var(--line);
    border-radius: 6px; background: none; color: var(--ink); padding: .3rem .6rem; }
  .connect-panel .connect-make { border-color: var(--accent); }
  .connect-lines { margin: 0 0 .6rem; padding: .6rem; overflow-x: auto; white-space: pre;
    border: 1px solid var(--line); border-radius: 6px; font-size: .78rem; user-select: all; }
  .connect-acts { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: .6rem; }
  .connect-said:empty { display: none; }
  @media (max-width: 61.999rem) { .connect { margin-left: auto; } }
  /* ⛔ THE COLUMN NEEDS THE WIDTH TO EXIST. Below this, a 19rem sidebar and a 52rem page cannot
     both fit, and the choice is not the reader's to get wrong — the menu goes back to the top and
     the button simply has no effect until there is room for the other answer. */
  @media (min-width: 62rem) {
    :root[data-nav="left"] body { padding-left: 19rem; }
    /* The column starts below the bar too: a top offset alone does not move a fixed element's inset. */
    :root[data-nav="left"] .topframe { position: fixed; inset: 0 auto 0 0; width: 19rem;
      overflow-y: auto; border-bottom: 0; border-right: 1px solid var(--line); padding-bottom: 2rem; }
    /*
     * ⛔ AND IT DOES NOT WRAP HERE. The row wraps across the top, where running past the right edge
     * at 390px put a tab off screen. Down the side the same container is a COLUMN inside a
     * full-height fixed panel, so wrapping means breaking into a second column of tabs — a menu
     * laid out sideways, and the one measurement that caught it was a long feature name no longer
     * overflowing the tree it should have.
     */
    :root[data-nav="left"] .topframe .tabs { flex-direction: column; flex-wrap: nowrap;
      align-items: stretch; gap: .1rem; padding: .7rem .9rem .4rem; }
    :root[data-nav="left"] .topframe .tab { text-align: left; border-bottom: 0;
      border-left: 2px solid transparent; border-radius: 0 4px 4px 0; padding: .35rem .6rem; }
    :root[data-nav="left"] .topframe .tab.on { border-left-color: var(--accent); }
    /* First in the column, because the control that moves the menu belongs at the top of it —
       last in a flex row is the right edge, and last in a flex column is the bottom of the page. */
    :root[data-nav="left"] .navplace { order: -1; margin: 0 0 .5rem; align-self: flex-start; }
    /* Down the side the column scrolls, which would clip a floating panel — so it opens in place. */
    :root[data-nav="left"] .connect { order: -1; margin: 0 0 .5rem; align-self: stretch; }
    :root[data-nav="left"] .connect > summary { display: inline-block; }
    :root[data-nav="left"] .connect-panel { position: static; width: auto; margin-top: .35rem; box-shadow: none; }
    /*
     * ⛔ DOWN THE SIDE, A GROUP IS A GROUP. Peter: *"the expanded menu should be grouped under each
     * main area, just like a standard menu... e.g. product, when selected, should have items under
     * it, not under a new section. And each container should be collapsible"*.
     */
    :root[data-nav="left"] .topframe .tabgroup { display: block; }
    :root[data-nav="left"] .topframe .tabhead { display: flex; align-items: center; gap: .15rem; }
    :root[data-nav="left"] .topframe .tabhead .tab { flex: 1; }
    /*
     * ⛔ A CONTROL NOBODY CAN SEE IS A CONTROL NOBODY PRESSES. Driven and looked at: the collapse
     * chevron rendered as a faint dot at the right edge of the column — present, correct, and
     * invisible at a glance, which is how a menu comes to look like it cannot fold. Bigger, darker,
     * and with a hit area rather than a glyph's worth of pixels.
     */
    :root[data-nav="left"] .topframe .twisty { display: block; font: inherit; font-size: .85rem;
      background: none; border: 0; color: var(--ink); opacity: .55; cursor: pointer;
      padding: .25rem .4rem; line-height: 1; border-radius: 4px; }
    :root[data-nav="left"] .topframe .twisty:hover { opacity: 1; background: var(--card); }
    /* ⛔ The arrow turns rather than changing character: one glyph, two states, no second string. */
    :root[data-nav="left"] .topframe .twisty[aria-expanded="false"] { transform: rotate(-90deg); }
    /*
     * ⛔ COLLAPSED HIDES THE GROUP'S CONTENTS AND KEEPS ITS HEAD. A collapsed area that hid its own
     * name would be an area you cannot get back to.
     */
    :root[data-nav="left"] .topframe .tabgroup.shut > :not(.tabhead) { display: none; }
    /* The items sit under their area, indented, so reading down the menu says whose they are. */
    :root[data-nav="left"] .topframe .tabgroup > .subtabs,
    :root[data-nav="left"] .topframe .tabgroup > .scopes { padding-left: 1.5rem; }
    :root[data-nav="left"] .topframe .subtabs { flex-direction: column; align-items: stretch;
      padding: .35rem .9rem .5rem; border-top: 0; }
    :root[data-nav="left"] .subtab { text-align: left; border-bottom: 0;
      border-left: 2px solid transparent; padding: .3rem .6rem; }
    :root[data-nav="left"] .subtab.on { border-left-color: var(--accent); }
    /*
     * ⛔ AND THE TWO OVERRIDES THAT MADE IT FIT A COLUMN ARE GONE WITH IT.
     *
     * A tighter padding and a wrapping trail were both compensations for living in a 19rem column:
     * *"A column is narrow and tall, so the trail wraps rather than losing its head to an ellipsis"*.
     * On the page it has the width of the page in either placement, so the one rule serves both — and
     * leaving these behind would have been the trail laid out for a column it is no longer in, which
     * is the kind of leftover that reads as a deliberate difference.
     */
    /* ⛔ THE CHEVRON IS A TOP-MENU ECONOMY. It exists because sixteen rows cannot sit permanently
       across a page above the thing being read. Down the side there is nothing to compete with, so
       the tree stays open and the control that would close it goes away — and the script reads
       exactly this rule to know it must not collapse. */
    :root[data-nav="left"] .chev { display: none; }
    :root[data-nav="left"] .topframe nav.scopes { max-height: none; margin: .4rem 0 0;
      padding: 0 .9rem 1rem; }
    /* ⛔ Foldable HERE, where a column has one feature's worth of width and a dozen to show. */
    :root[data-nav="left"] nav.scopes li.holds > ul { display: none; }
    :root[data-nav="left"] nav.scopes li.holds.open > ul { display: block; }
    /*
     * ⛔ CLEARANCE FOR THE COMPOSER AT THE BOTTOM OF THE COLUMN. Peter: *"menu is hidden below the
     * bottom chat bar, make sure the offset is correct"*.
     *
     * The frame is a fixed full-height column and the composer is fixed over the bottom of the
     * window, so the last area in the menu sat underneath it — and it is the LAST one that needed
     * reaching, because opening a group pushes everything below it further down. Scrolling did not
     * help: the column ended where the viewport did, so the rows under the bar had nowhere to
     * scroll to.
     *
     * ⛔ AND IT REUSES THE COMPOSER'S OWN MEASUREMENT — the bottom-height variable the thread keeps
     * current — rather than a second constant of my own. The dock grows as replies arrive, and
     * a hardcoded offset would be right only while the window happened to be the size I guessed.
     */
    :root[data-nav="left"] .topframe { overflow-y: auto;
      padding-bottom: calc(4.5rem + var(--bottom-h) + 1rem); }
    /*
     * ⛔ AND IT SCROLLS SIDEWAYS TO A LONG NAME RATHER THAN CUTTING IT. Peter: *"don't truncate,
     * scroll"*.
     *
     * The overflow is on the tree, not on the column: putting it on the column would scroll the tabs
     * and the breadcrumb sideways with it, so choosing an area would move the control you just
     * pressed. ⛔ And overflow-y: visible with it, or the nested lists get a second vertical
     * scrollbar inside the one the column already has — a box that scrolls in one axis cannot be
     * asked to clip in the other.
     */
    :root[data-nav="left"] nav.scopes { overflow-x: auto; overflow-y: visible; }
  }
  .prose { margin: .6rem 0 1.4rem; max-width: 42rem; }
  .prose p { margin: .6rem 0; }
  h3.sub { font-size: .8rem; text-transform: uppercase; letter-spacing: .07em; color: var(--dim);
    margin: 1.6rem 0 0; font-weight: 600; }
  .behaviours { margin: .5rem 0 2rem; }
  .beh { background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 1.1rem 1.25rem; margin: 0 0 .9rem; }
  .beh-says { font-size: 1.05rem; line-height: 1.5; margin: 0 0 .5rem; }
  ol.claims { margin: 0; padding-left: 1.4rem; }
  ol.claims li { margin: .45rem 0; }
  .beh-where { font-size: .78rem; color: var(--dim); margin: 0; }
  .beh-where code { font-size: .95em; }
  .beh-shows { margin-top: .7rem; font-size: .9rem; }
  .beh-shows summary { cursor: pointer; color: var(--dim); }
  .beh-shows ul { margin: .5rem 0 0; padding-left: 1.1rem; }
  .beh-shows li { margin: .3rem 0; }
  .beh-nothing { font-size: .85rem; color: var(--warn); margin: .6rem 0 0; }
  .beh-acts { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: .9rem;
    padding-top: .8rem; border-top: 1px solid var(--line); }
  details.fold { margin: 2rem 0 0; border-top: 1px solid var(--line); padding-top: 1rem; }
  details.fold > summary { cursor: pointer; color: var(--dim); font-size: .88rem; }
  .screens { margin: 1.5rem 0; }
  .screen { margin: 1.2rem 0 0; }
  .screen h4 { font-size: 1rem; margin: 0 0 .4rem; }
  .screen .n { font-size: .78rem; color: var(--dim); font-weight: 400; }
  /* ---- the prototype ---------------------------------------------------- */
  .proto { background: var(--card); border: 1px solid var(--line); border-radius: 8px; }
  .proto.html { padding: .8rem; overflow-x: auto; }
  /* Every control the corpus declares, as something that can be pointed at. */
  button.pt { font: inherit; font-size: inherit; line-height: inherit; background: transparent;
    border: 0; border-bottom: 1px dashed var(--accent); color: inherit; padding: 0; margin: 0;
    cursor: pointer; border-radius: 2px; }
  button.pt:hover, button.pt:focus-visible { background: var(--accent); color: var(--bg); outline: 0; }
  button.pt.on { background: var(--accent); color: var(--bg); }
  /* A control that commits work reads differently from one that only navigates or displays. */
  button.pt-commits { border-bottom-style: solid; border-bottom-width: 2px; }
  button.pt-display { border-bottom-color: var(--line); }
  .pt-detail { border: 1px solid var(--line); border-top: 0; border-radius: 0 0 8px 8px;
    background: var(--bg); padding: .7rem .9rem; font-size: .9rem; }
  .pt-head { margin: 0 0 .5rem; }
  .pt-head .role { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: var(--dim); }
  .pt-ex { border-top: 1px solid var(--line); padding-top: .5rem; margin-top: .5rem; }
  .pt-ex:first-of-type { border-top: 0; padding-top: 0; margin-top: 0; }
  .pt-ex-t { margin: 0 0 .3rem; font-weight: 600; font-size: .9rem; }
  ul.pt-said { margin: 0; padding-left: 1rem; }
  ul.pt-said .g { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: var(--dim); }
  .pt-detail .none { color: var(--dim); font-style: italic; margin: .3rem 0 0; }
  .screen.arrived { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 8px; }
  details.undrawn { margin-top: .5rem; font-size: .88rem; }
  details.undrawn summary { color: var(--dim); cursor: pointer; }
  /* ---- the screen inside a card ---------------------------------------- */
  figure.card-screen { margin: .7rem 0 0; border: 1px solid var(--line); border-radius: 8px;
    overflow: hidden; background: var(--card); }
  figure.card-screen figcaption { font-size: .74rem; color: var(--dim); padding: .35rem .6rem;
    border-bottom: 1px solid var(--line); background: var(--bg); }
  figure.card-screen .none { font-size: .82rem; color: var(--dim); font-style: italic; margin: 0; padding: .6rem; }
  /** ⛔ Which picture of the screen this is — without it a state reads as the screen itself. */
  figure.card-screen .of-state { color: var(--accent); }
  /**
   * ⛔ SCALED, NOT SHRUNK. zoom reflows the copy at a smaller size, so a wide table stays legible
   * instead of being squeezed into unreadable columns; transform: scale would leave the layout at
   * full width and paint it small, clipping everything past the card.
   */
  .card-proto { zoom: .62; max-height: 22rem; overflow: auto; }
  .card-proto .proto { border: 0; border-radius: 0; }
  /* The one thing the copy exists to show: which control this sentence is about. Amber, not the
     accent — the accent is the application's own primary colour on half these screens. */
  .card-proto .focus, figure.card-screen .focus { outline: 3px solid #f59e0b; outline-offset: 3px;
    border-radius: 3px; box-shadow: 0 0 0 7px rgba(245,158,11,.22); }
  /* "show me the deal row" — the control this sentence is about, on the screen it lives on. */
  /**
   * ⛔ A CONTROL THAT DRIVES SAYS SO BEFORE IT IS PRESSED. Peter pressed Continue expecting
   * movement and got none; a control that WILL move the picture and looks identical to one that
   * will not is the same complaint one step later.
   */
  [data-lands] { cursor: pointer; }
  .state-frame.arrived { animation: arrived 900ms ease-out; }
  @keyframes arrived { from { box-shadow: 0 0 0 3px var(--accent); } to { box-shadow: 0 0 0 0 transparent; } }
  button.pt-go { font: inherit; font-size: .82rem; background: var(--accent); color: var(--bg);
    border: 0; border-radius: 4px; padding: .12rem .45rem; cursor: pointer; margin-left: .3rem; }
  button.show-part { font: inherit; font-size: inherit; background: none; border: 0; padding: 0;
    color: var(--accent); cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
  .owes-inline { font-style: italic; }
  pre.sketch { background: var(--card); border: 1px solid var(--line); border-radius: 8px;
    padding: .9rem 1rem; overflow-x: auto; font: .78rem/1.35 ui-monospace, Menlo, monospace;
    margin: .5rem 0; }
  ul.parts { list-style: none; margin: .5rem 0 0; padding: 0; font-size: .88rem;
    display: grid; gap: .2rem; }
  ul.parts li { display: flex; gap: .5rem; align-items: baseline; }
  ul.parts .role { font-family: ui-monospace, Menlo, monospace; font-size: .74rem;
    color: var(--accent); min-width: 5rem; }
  .what-next { color: var(--dim); font-size: .9rem; margin-top: .5rem; }
  table.worklist { border-collapse: collapse; width: 100%; font-size: .9rem; margin: 1rem 0 2rem; }
  table.worklist th, table.worklist td { border-bottom: 1px solid var(--line); padding: .5rem .5rem .5rem 0;
    text-align: left; vertical-align: top; }
  table.worklist thead th { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em;
    color: var(--dim); font-weight: 600; }
  table.worklist .num { font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--dim); }
  table.worklist code { font-size: .78em; }
  /**
   * ⛔ DOCKED AND ALWAYS THERE. It was a floating button that hid itself the moment the panel
   * opened, so the one affordance for "this is wrong" was missing exactly when it was in use.
   *
   * Fixed to the bottom with a left/right span, plus padding on the body so it never sits on top
   * of the last card — a composer that covers the thing being described is a composer people close.
   *
   * (No backticks in this comment: it lives inside a template literal, and a backtick here ends
   * the string. That has now cost four builds.)
   */
  /**
   * ⛔ A DRAWN MODAL IS CONTAINED TO ITS MOCK. A screen that composes a modal inlines its overlay,
   * and a fixed element positions against the VIEWPORT even from inside a shadow root — so opening
   * the deal workspace covered the whole review surface with a folder picker, twice. A transform on
   * the host makes it the containing block for everything fixed inside it; containment alone did
   * not, because the host is in the light DOM and the rule was being adopted into the shadow root.
   */
  /**
   * ⛔ A DRAWING IS NOT A PAGE, AND IT WAS BEING GIVEN A PAGE'S WORTH OF ROOM.
   *
   * Peter: *"lots of empty space. make the prototype more compact."* Real screens are built for a
   * viewport — full-height utilities, vertical centring, generous padding — and rendered inline at full
   * height that becomes a column of air with a form floating in it, so a reviewer scrolls past
   * nothing to reach the next thing.
   *
   * Capped and scrolled inside itself: the drawing keeps its own layout exactly, and the REVIEW
   * surface stops spending a screenful on one screen's margins.
   */
  /**
   * ⛔ FIXED, NOT CAPPED. Peter: *"let's keep the frame the same fixed height instead of going
   * smaller for smaller screens."*
   *
   * A capped height let a short drawing shrink its frame, so walking a feature made the page jump —
   * every state a different size, the tabs moving under the cursor between presses. A drawing is a
   * window onto a product, and a window does not change shape because of what is behind it.
   *
   * ⛔ AND THE HEIGHT IS ON THE FRAME, NOT ON THE DRAWING. Peter again: *"the prototype viewer is
   * still collapsing in size on the final page. is the final page being treated differently? should
   * follow same code path"* — and it was. The completion state is a card rather than a mock, so it
   * never passed through the thing carrying the size, and the one state that is not a drawing was
   * the one state that shrank. Sizing the FRAME makes "same height" a property of the viewer
   * instead of something every kind of content has to remember to opt into.
   */
  /**
   * ⛔ THE OUTLINE IS THE VIEWER, SO IT IS EXPLICIT AND IT NEVER MOVES. Peter: *"let's make the
   * outline for the prototype very explicit… the outline goes away, so it looks like it's no longer
   * the prototype."*
   *
   * The frame had no border of its own — what read as an outline was the drawing's own white page
   * against the review surface. So any state that was not a white page looked like the prototype had
   * ended, which is exactly what he described. A viewer that is only visible when its contents
   * happen to be pale is not a viewer.
   */
  .states .state-frame { height: 30rem; border: 1px solid var(--line); border-radius: 8px;
    background: var(--card); overflow: hidden; }
  .states .state-frame > * { height: 100%; }
  /** The card inside already has the frame's edge around it; a second one reads as a box in a box. */
  .states .state-frame > .done-card { border: 0; border-radius: 0; }
  .proto.html { transform: translateZ(0); contain: layout paint; position: relative;
    overflow: auto; }
  /** ⛔ The app's own full-height rules are about ITS viewport, not about this card. */
  .proto.html .productos-mock { min-height: 0; }

  /**
   * ⛔ THE CALLOUT IS FIXED, so it is not clipped by the mock it points into and not scaled by it.
   * It ignores pointer events, because it explains the next press rather than accepting one — a tip
   * that swallows the click it is asking for is worse than no tip.
   */
  .arm-tip {
    position: fixed; z-index: 60; pointer-events: none;
    background: var(--ink); color: var(--bg); border-radius: 6px;
    padding: .4rem .6rem; font-size: .82rem; line-height: 1.3;
    box-shadow: 0 6px 18px rgba(0,0,0,.22); max-width: 18rem;
    display: flex; flex-direction: column; gap: .1rem;
  }
  .arm-tip strong { font-weight: 600; }
  /**
   * ⛔ THE FINAL STATE, AND IT LOOKS LIKE AN ENDING. A frame styled like every other state would
   * read as one more screen to get past; this one is where the walk stops.
   */
  /**
   * ⛔ TOKENS THIS PAGE ACTUALLY HAS. Peter: *"make sure 'Done' has a tab item when it's selected.
   * right now when you get to done, the tab disappears."*
   *
   * It did not disappear — it was white on nothing. I wrote green and surface tokens that belong
   * to a different palette; this page has ok, card, line and ink. An undefined custom
   * property resolves to nothing, so the background silently vanished while the text colour, which
   * IS a real token, kept painting near-white. The same four tokens took the card's border away,
   * which is the other half of what he saw: *"the outline goes away, so it looks like it's no longer
   * the prototype."*
   *
   * ⛔ A MISSING VARIABLE FAILS SILENTLY AND LOOKS LIKE A MISSING ELEMENT, which is why he reported
   * it as the tab being gone.
   */
  .state-tab.is-done-tab { color: var(--ok); border-color: var(--ok); }
  .state-tab.is-done-tab.on { background: var(--ok); border-color: var(--ok); color: var(--bg); }
  /** ⛔ Fills the frame and centres in it, because the frame is now what decides the size. */
  .done-card {
    padding: 2.5rem 2rem; display: grid; gap: .75rem; justify-items: center; align-content: center;
    text-align: center; overflow: auto;
    border: 1px solid var(--line); border-radius: 8px; background: var(--card);
  }
  .done-mark { margin: 0; font-weight: 600; color: var(--ok); font-size: 1.05rem; }
  .done-ends { margin: 0; font-size: 1.05rem; line-height: 1.5; max-width: 34rem; }
  .done-next { margin: 0; color: var(--dim); font-size: .9rem; }
  .done-note { margin: .5rem 0 0; color: var(--dim); font-size: .8rem; max-width: 34rem; }
  /** ⛔ Wider and calmer when it is reporting completion — it is a sentence, not a label. */
  .arm-tip.is-done { max-width: 26rem; gap: .3rem; }
  .arm-tip .arm-done { color: #7fd48a; }
  .arm-tip .arm-ends { opacity: 1; font-style: italic; }
  .arm-tip span { opacity: .75; }
  .arm-tip::after {
    content: ""; position: absolute; left: 50%; margin-left: -5px;
    border: 5px solid transparent;
  }
  .arm-tip[data-side="above"]::after { top: 100%; border-top-color: var(--ink); }
  .arm-tip[data-side="below"]::after { bottom: 100%; border-bottom-color: var(--ink); }

  /**
   * ⛔ TWO TOKENS WERE NAMED HERE FOR MONTHS AND NEVER DEFINED, so eleven borders and two
   * panel backgrounds painted as nothing — the state tabs had no outline, the prototype tiles had no
   * edge, and the leaving-a-feature callout had no fill. Nobody saw it because an undefined custom
   * property is silent: it does not warn, it does not inherit, it simply does not paint.
   *
   * Found the day a test was written for exactly one instance of it. This page's hairline token is
   * the line one, and its tinted panel is the code one.
   */
  /* Walking a screen through its states. */
  /**
   * ⛔ WHERE THE WALK HAS BEEN — not where the thing sits. The page's own breadcrumb answers the
   * second question and reads almost the same, so this one is quieter and sits with the states it
   * is made of.
   */
  .walk-trail { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem;
    margin: 0 0 .4rem; font-size: .76rem; }
  .walk-trail[hidden] { display: none; }
  .wt-back { font: inherit; font-size: .76rem; cursor: pointer; background: none; border: 0;
    padding: 0 .1rem; color: var(--accent); text-decoration: underline; }
  .wt-here { color: var(--dim); }
  .wt-sep { color: var(--dim); opacity: .6; }
  .state-tabs { display: flex; flex-wrap: wrap; gap: .3rem; margin: 0 0 .45rem; }
  .state-tab { font: inherit; font-size: .78rem; cursor: pointer; border: 1px solid var(--line);
    background: var(--bg); color: var(--dim); border-radius: 999px; padding: .12rem .6rem; }
  .state-tab:hover { color: var(--ink); }
  .state-tab.on { background: var(--accent); border-color: var(--accent); color: var(--bg); }
  /*
   * ⛔ A STATE THAT CANNOT DRAW ITSELF SAYS SO ON ITS OWN TAB. Without this it renders the ordinary
   * screen, which is indistinguishable from a state claiming nothing — opposite conclusions, same
   * pixels. Dashed, because the tab is real and its picture is not.
   */
  .state-tab.unpictured { border-style: dashed; }
  .state-tab .nopic { opacity: .65; font-size: .72rem; }
  .state-tab.on .nopic { opacity: .85; }
  /* Leaving one feature for another — said before it happens, not after. */
  .pt-detail .leaving { margin: 0 0 .4rem; padding: .35rem .55rem; border-radius: 6px;
    background: var(--code); border: 1px solid var(--accent); font-size: .85rem; }
  [data-armed="1"] { outline: 2px solid var(--accent); outline-offset: 1px; }

  /* A node on the screen map carries the screen itself. */
  .ux-shot { height: 11rem; overflow: hidden; border: 1px solid var(--line); border-radius: 6px;
    background: #fff; margin-bottom: .45rem; }
  .ux-shot-scale { width: 250%; transform: scale(.4); transform-origin: top left; pointer-events: none; }
  .ux-shot.none { display: flex; align-items: center; justify-content: center; font-size: .78rem;
    color: var(--dim); background: var(--code); }

  /* ── The prototype: the product as a board of real screens. ──────────────────────────── */
  /* ⛔ The width goes to the SCREENS. A surface whose job is being visual cannot spend it on nav. */
  .pboard { display: grid; grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr)); gap: 1.1rem; margin-top: .8rem; }
  /* The walk: one screen, where you are, and every way out of it. */
  /* The board, one fold down — see the comment in the prototype section. */
  .pall { margin-top: 1.4rem; border-top: 1px solid var(--line); padding-top: .8rem; }
  .pall > summary { cursor: pointer; font-size: .8rem; color: var(--dim); list-style: none; }
  .pall > summary::-webkit-details-marker { display: none; }
  .pall > summary::before { content: "▸ "; }
  .pall[open] > summary::before { content: "▾ "; }
  .pall > summary:hover { color: var(--ink); }
  .wbar { display: flex; align-items: baseline; gap: .8rem; margin: .9rem 0 .5rem; }
  .wwhere { font-size: .82rem; color: var(--dim); letter-spacing: .01em; }
  .wback { font: inherit; font-size: .78rem; background: none; border: 1px solid var(--line); border-radius: 999px;
    padding: .12rem .6rem; color: var(--dim); cursor: pointer; }
  .wback:hover { color: var(--ink); border-color: var(--dim); }
  /* ⛔ The stage takes the width. A surface for judging a screen cannot spend its room on navigation —
     the same mistake the board was rebuilt to undo. */
  .wrap-walk { display: grid; grid-template-columns: minmax(0, 1fr) 15rem; gap: 1.2rem; align-items: start; }
  @media (max-width: 60rem) { .wrap-walk { grid-template-columns: minmax(0, 1fr); } }
  .wstage { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--card); min-height: 18rem; }
  .wnone { padding: 2rem; color: var(--dim); font-size: .85rem; text-align: center; }
  .wside { display: flex; flex-direction: column; gap: 1rem; }
  .wgroup h4 { margin: 0 0 .35rem; font-size: .7rem; text-transform: uppercase; letter-spacing: .07em; color: var(--dim); font-weight: 600; }
  .wmoves { display: flex; flex-direction: column; gap: .3rem; }
  .wmove { display: flex; flex-direction: column; align-items: flex-start; gap: .1rem; width: 100%; text-align: left;
    font: inherit; font-size: .82rem; background: var(--card); border: 1px solid var(--line); border-radius: 8px;
    padding: .4rem .55rem; cursor: pointer; color: var(--ink); }
  .wmove:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  /* ⛔ A control the truth says nothing about is shown and is dead — see the handler's comment. */
  .wmove:disabled { cursor: default; opacity: .6; border-style: dashed; }
  .wmove-m { font-size: .7rem; color: var(--dim); }
  .wdoors { margin-top: 1.1rem; padding-top: .8rem; border-top: 1px solid var(--line); }
  .wdoors h4 { margin: 0 0 .4rem; font-size: .7rem; text-transform: uppercase; letter-spacing: .07em; color: var(--dim); font-weight: 600; }
  .wdoor { font: inherit; font-size: .8rem; background: var(--card); border: 1px solid var(--line); border-radius: 999px;
    padding: .25rem .7rem; margin: 0 .35rem .35rem 0; cursor: pointer; color: var(--ink); }
  .wdoor:hover { border-color: var(--accent); color: var(--accent); }
  .wdoor-m { color: var(--dim); font-size: .7rem; margin-left: .4rem; }
  .wnote { margin-top: .9rem; font-size: .8rem; color: var(--warn); background: var(--warn-bg); border-radius: 8px; padding: .5rem .7rem; }
  /**
   * The prototype selection — the choice before the walk.
   *
   * ⛔ CARDS RATHER THAN A ROW OF PILLS, because each option carries three facts a pill cannot hold:
   * which side of the split it is, what it is called, and how much of the product it reaches. The
   * row of pills is what was here, and it was the reason nobody could tell what the split was about.
   *
   * ⛔ AND TIGHT. Peter: *"WE DON'T HAVE THAT MUCH SCREEN REAL ESTATE to begin with"* — the question
   * is one line, the cards wrap, and nothing here grows with the number of prototypes except the
   * wrap.
   */
  .wsel { margin: 0 0 .9rem; }
  .wsel-q { margin: 0 0 .45rem; font-size: .8rem; font-weight: 600; color: var(--ink); }
  .wsel-q.none { font-weight: 400; color: var(--warn); }
  .wpicks { display: flex; flex-wrap: wrap; gap: .4rem; }
  .wpick { font: inherit; text-align: left; display: flex; flex-direction: column; gap: .1rem; cursor: pointer;
    background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: .4rem .65rem; color: var(--ink); }
  .wpick:hover { border-color: var(--accent); }
  .wpick.on { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
  .wpick-is { font-size: .65rem; text-transform: uppercase; letter-spacing: .07em; color: var(--accent); font-weight: 600; }
  .wpick-t { font-size: .85rem; font-weight: 600; }
  .wpick-m { font-size: .7rem; color: var(--dim); }
  .wsel-gaps { margin: .5rem 0 0; padding: 0 0 0 1rem; font-size: .75rem; color: var(--warn); }
  .wsel-and { color: var(--dim); font-weight: 400; }
  /*
   * The selector: one row, one control per dimension, the current prototype named beside them.
   *
   * ⛔ ONE ROW, BECAUSE FIVE BLOCKS OF TEXT FOR ONE DECISION IS WHAT HE WAS LOOKING AT. A lede, a
   * warning, two unlabelled boxes, a bulleted list and a disclosure — "a barf of information", and
   * the complaint list named a schema field on a reader's page.
   */
  .wsel-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: .6rem; margin: 0 0 .8rem; }
  .wdim { display: flex; flex-direction: column; gap: .1rem; }
  .wdim-n { font-size: .65rem; text-transform: uppercase; letter-spacing: .07em; color: var(--dim); font-weight: 600; }
  .wsel-h { margin: 0 0 .3rem; font-size: .65rem; text-transform: uppercase; letter-spacing: .08em;
    color: var(--dim); font-weight: 700; }
  .wsel-c { color: var(--dim); font-weight: 400; }
  .wdim select { font: inherit; font-size: .85rem; padding: .25rem .4rem; border: 1px solid var(--line);
    border-radius: 8px; background: var(--card); color: var(--ink); }
  .wadd { font: inherit; font-size: .8rem; padding: .3rem .6rem; cursor: pointer; align-self: flex-end;
    background: none; border: 1px dashed var(--line); border-radius: 8px; color: var(--accent); }
  .wadd:hover { border-color: var(--accent); }
  .wdimform { display: flex; flex-wrap: wrap; align-items: flex-end; gap: .5rem; margin: 0 0 .9rem;
    padding: .6rem .7rem; border: 1px solid var(--accent); border-radius: 10px; background: var(--card); }
  .wdimform label { display: flex; flex-direction: column; gap: .1rem; }
  .wdimform label span { font-size: .65rem; text-transform: uppercase; letter-spacing: .07em; color: var(--dim); font-weight: 600; }
  .wdimform input { font: inherit; font-size: .8rem; padding: .25rem .4rem; border: 1px solid var(--line);
    border-radius: 8px; background: var(--bg); color: var(--ink); min-width: 11rem; }
  .wdimform-x { background: none; border: none; color: var(--dim); cursor: pointer; font: inherit; font-size: .75rem; }
  /*
   * One row per prototype: its name, chips for what it specifies, how much it reaches.
   *
   * ⛔ A PROTOTYPE THAT SPECIFIES NOTHING SAYS SO IN THE LIST. Peter: *"Prototypes are shown by
   * which dimensions they specify, with 'no dimensions' specified - they can then assign it"* —
   * hiding it until somebody placed it would hide the thing that needs doing.
   */
  .prows { list-style: none; margin: 0 0 .9rem; padding: 0; }
  .prow { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; padding: .3rem 0;
    border-bottom: 1px solid var(--line); }
  .prow[hidden] { display: none; }
  .prow-go { font: inherit; font-size: .85rem; font-weight: 600; background: none; border: none; padding: 0;
    color: var(--ink); cursor: pointer; text-align: left; }
  .prow-go:hover { color: var(--accent); }
  .pchips { display: flex; flex-wrap: wrap; gap: .2rem; }
  .pchip { font-size: .68rem; padding: .08rem .4rem; border-radius: 999px; background: var(--code); color: var(--dim); }
  .pchip.none { border: 1px dashed var(--warn); background: none; color: var(--warn); }
  .prow-m { font-size: .7rem; color: var(--dim); margin-left: auto; }
  .prow-assign { font: inherit; font-size: .7rem; background: none; border: 1px solid var(--line);
    border-radius: 6px; padding: .08rem .4rem; color: var(--accent); cursor: pointer; }
  .wsel-empty { margin: 0 0 .9rem; font-size: .78rem; color: var(--warn); }
  .wvals { display: flex; flex-wrap: wrap; gap: .25rem; }
  .wval { font: inherit; font-size: .8rem; padding: .18rem .55rem; cursor: pointer; color: var(--ink);
    background: var(--card); border: 1px solid var(--line); border-radius: 999px; }
  .wval:hover { border-color: var(--accent); }
  .wval.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  /*
   * ⛔ DIMMED RATHER THAN HIDDEN. A value nothing covers is a real part of the product's shape — the
   * hole is the finding — so it stays pressable and says why. Removing it would make the space look
   * complete.
   */
  .wval.empty { color: var(--dim); border-style: dashed; }
  .wval.empty.on { background: var(--warn-bg); border-color: var(--warn); color: var(--warn); }
  .wsel-now { font-size: .85rem; font-weight: 600; padding-bottom: .3rem; }
  .wsel-now.none { font-weight: 400; color: var(--warn); }
  .wsel-note { font-size: .72rem; color: var(--dim); padding-bottom: .35rem; margin-left: auto; }
  .wsel-more { font: inherit; font-size: .72rem; background: none; border: none; padding: 0;
    color: var(--accent); cursor: pointer; text-decoration: underline; }
  .wsel-detail { margin: 0 0 .9rem; padding: .6rem .7rem; border: 1px solid var(--line); border-radius: 10px; background: var(--card); }
  /*
   * The empty state, which is the one that has to explain itself.
   *
   * ⛔ OPEN, NOT BEHIND A DISCLOSURE — "why is it just two buttons again???" was asked of a page
   * whose instructions were inside the thing a link called "show" was hiding.
   */
  .wstart { margin: 0 0 .9rem; padding: .6rem .7rem; border: 1px dashed var(--line); border-radius: 10px; }
  .wstart-q { margin: 0 0 .45rem; font-size: .8rem; font-weight: 600; }
  .wstart-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: .5rem; }
  .wstart-row label { display: flex; flex-direction: column; gap: .1rem; }
  .wstart-row label span { font-size: .65rem; text-transform: uppercase; letter-spacing: .07em; color: var(--dim); font-weight: 600; }
  .wstart-row input { font: inherit; font-size: .8rem; padding: .25rem .4rem; border: 1px solid var(--line);
    border-radius: 8px; background: var(--card); color: var(--ink); min-width: 11rem; }
  .wstart-eg { margin: .45rem 0 0; font-size: .72rem; color: var(--dim); }
  .wdims { width: 100%; border-collapse: collapse; font-size: .78rem; }
  .wdims th, .wdims td { text-align: left; padding: .2rem .35rem; border-bottom: 1px solid var(--line); }
  .wdims thead th { font-size: .65rem; text-transform: uppercase; letter-spacing: .06em; color: var(--dim); font-weight: 600; }
  .wdims input { width: 100%; font: inherit; font-size: .78rem; padding: .2rem .35rem; border: 1px solid var(--line);
    border-radius: 6px; background: var(--bg); color: var(--ink); }
  .wsel-grid select { font: inherit; font-size: .78rem; padding: .15rem .3rem; border: 1px solid var(--line);
    border-radius: 6px; background: var(--bg); color: var(--ink); width: 100%; }
  .wsel-edit { margin-top: .6rem; font-size: .8rem; }
  .wsel-edit > summary { cursor: pointer; color: var(--dim); }
  .wsel-hint { margin: .5rem 0 .35rem; font-size: .75rem; color: var(--dim); }
  .wsel-form textarea { width: 100%; font: inherit; font-size: .8rem; padding: .4rem .5rem; border: 1px solid var(--line);
    border-radius: 8px; background: var(--card); color: var(--ink); resize: vertical; }
  .wsel-actions { display: flex; align-items: center; gap: .5rem; margin-top: .4rem; }
  .wsel-grid { width: 100%; border-collapse: collapse; margin-top: .7rem; font-size: .78rem; }
  .wsel-grid th, .wsel-grid td { text-align: left; padding: .25rem .4rem; border-bottom: 1px solid var(--line); }
  .wsel-grid thead th { font-size: .7rem; text-transform: uppercase; letter-spacing: .06em; color: var(--dim); font-weight: 600; }
  .wsel-grid input { width: 100%; font: inherit; font-size: .78rem; padding: .2rem .35rem; border: 1px solid var(--line);
    border-radius: 6px; background: var(--card); color: var(--ink); }
  .wsel-grid input.bad { border-color: var(--warn); }
  .wsel-drop { font: inherit; font-size: .7rem; background: none; border: 1px solid var(--line); border-radius: 6px;
    padding: .1rem .4rem; color: var(--dim); cursor: pointer; white-space: nowrap; }
  .wsel-drop:hover { border-color: var(--bad); color: var(--bad); }
  /*
   * ⛔ ON THE SCREEN, AT THE SIZE OF A CAPTION. Peter: *"WE DON'T HAVE THAT MUCH SCREEN REAL ESTATE
   * to begin with"* — this is one line under a heading on every screen, so it is the smallest thing
   * that can still be used, and it says nothing extra when a screen is its own way in.
   */
  .inside { margin: .15rem 0 .5rem; font-size: .72rem; color: var(--dim); display: flex; align-items: center; gap: .4rem; }
  .inside select { font: inherit; font-size: .72rem; padding: .1rem .25rem; border: 1px solid var(--line);
    border-radius: 6px; background: var(--card); color: var(--ink); max-width: 22rem; }
  .ptile { margin: 0; cursor: pointer; }
  /**
   * A drawing is a whole page of markup. Shown at its own size it is one screen per scroll, so each
   * tile renders it at full width and scales the result down — the layout stays the real layout
   * rather than a narrow-viewport reflow of it.
   */
  /** ⛔ Tall enough to reach the CONTENT. At 15rem the deals list clipped one row below its column
   *  headers, so a table that renders correctly still read as an empty list. */
  .ptile-glass { height: 15rem; overflow: hidden; border: 1px solid var(--line); border-radius: 8px;
    background: #fff; position: relative; }
  .ptile-scale { width: 200%; transform: scale(.5); transform-origin: top left; pointer-events: none; }
  .ptile:hover .ptile-glass { border-color: var(--accent); }
  .ptile figcaption { padding: .4rem .1rem 0; }
  .pp-t { display: block; font-weight: 600; font-size: .9rem; }
  .pp-m { display: block; font-size: .76rem; color: var(--dim); }

  .pnone { margin-top: 1.6rem; border-top: 1px solid var(--line); padding-top: .7rem; }
  .pnone h3 { margin: 0 0 .2rem; font-size: .95rem; }
  .pnone ul { list-style: none; margin: .4rem 0 0; padding: 0; }
  .pnone li { padding: .3rem 0; border-bottom: 1px solid var(--line); }

  /* Opened big: the screen at full width, the truth beside it. */
  .pbig { position: fixed; inset: 0; z-index: 60; background: var(--bg); display: flex; flex-direction: column; }
  .pbig-bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: .6rem .9rem; border-bottom: 1px solid var(--line); }
  .pbig-esc { font-size: .76rem; color: var(--dim); margin-left: auto; margin-right: .6rem; }
  .pbig-x { font: inherit; font-size: .85rem; cursor: pointer; background: none; border: 1px solid var(--line);
    border-radius: 6px; padding: .2rem .7rem; color: inherit; }
  .pbig-body { flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) 22rem; overflow: hidden; }
  .pbig-stage { overflow: auto; padding: 1rem; background: #fff; }
  .pbig-truth { overflow: auto; padding: 1rem; border-left: 1px solid var(--line); font-size: .88rem; }
  .pbig-truth h4 { margin: 0 0 .3rem; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; color: var(--dim); }
  .pbig-truth li { margin-bottom: .7rem; }
  .pbig-truth .slot { font-size: .72rem; color: var(--dim); text-transform: uppercase; letter-spacing: .04em; }
  @media (max-width: 900px) { .pbig-body { grid-template-columns: 1fr; } .pbig-truth { border-left: 0; border-top: 1px solid var(--line); } }

  /* The truth moved under you — said, not done to you. */
  /* ⛔ The frame and the page both move down by exactly the bar's height while it is up, because a
     bar that covers the navigation takes every way off the page with it. See fit(), above. */
  /**
   * ⛔ THE BAR AT THE TOP IS GONE, AND SO IS EVERYTHING THAT MADE ROOM FOR IT. Peter: *"just live
   * update as we go"*. Leaving the rules behind would leave a reader of this file believing there
   * is still something up there, and leaving the --live-h variable behind would leave one whose
   * only honest value is zero — which is how a token ends up being reasoned about for an hour.
   */
  /* ⛔ The colour of a problem, not of an update. A page that has stopped following looked exactly
     like one that was up to date, which is the failure nobody can see for themselves. */
  :root { --bottom-h: 0px; }
  .bottom-bars { position: fixed; left: 0; right: 0; bottom: 0; z-index: 41; }
  .stale-bar { padding: .5rem .8rem; font-size: .88rem; text-align: center;
    background: var(--bad); color: var(--bg); }
  /* ⛔ Quiet, not alarming. Nobody being at the keyboard is ordinary; what is not ordinary is a
     page that hides it. The red is reserved for the page having stopped following. */
  /**
   * ⛔ ONE LINE UNTIL ASKED. The thread this replaces took the top third of the dock whether or not
   * anything had happened; this is a count that opens.
   */
  /**
   * ⛔ A CHIP ON THE COMPOSER'S ROW. Peter: *"make this just a chip inline with the send button,
   * showing '8', and clicking it will expand it."* It was a second fixed bar carrying a sentence
   * that said what the number says.
   */
  .ack-chip { font: inherit; font-size: .72rem; line-height: 1; min-width: 1.5rem; padding: .25rem .4rem;
    border: 1px solid var(--line); border-radius: 999px; background: var(--card); color: var(--dim); cursor: pointer; }
  .ack-chip:hover, .ack-chip.on { color: var(--accent); border-color: var(--accent); }
  .ack-panel { max-height: 40vh; overflow: auto; border-bottom: 1px solid var(--line); }
  .ack-head { font: inherit; font-size: .82rem; width: 100%; text-align: left; cursor: pointer;
    background: none; border: 0; padding: .4rem .8rem; color: var(--ok);
    display: flex; align-items: center; gap: .4rem; }
  .ack-n { font-weight: 600; }
  .ack-caret { margin-left: auto; color: var(--dim); }
  .ack-list { list-style: none; margin: 0; padding: 0 .8rem .5rem; display: grid; gap: .45rem;
    max-height: 11rem; overflow: auto; }
  .ack-list li { font-size: .82rem; line-height: 1.4; display: grid; gap: .1rem; }
  .ack-list strong { font-weight: 600; }
  .ack-what { color: var(--dim); }
  /* ⛔ Who asked and when, so the list answers "was this ever dealt with" rather than just "something was". */
  .ack-when { display: block; color: var(--dim); font-size: .85em; opacity: .8; margin-top: .15rem; }
  .who-bar { padding: .45rem .8rem;
    font-size: .84rem; text-align: center; background: var(--warn-bg); color: var(--warn);
    border-top: 1px solid var(--line); }
  /**
   * ⛔ CONDENSED. Peter: *"let's condense the bottom bar... reduce the height of the text input and
   * the send button, reduce the font size."* It was two rows — a line naming the ref, then the box —
   * at .92rem with a 2.1rem minimum, so roughly 90px of frame under every page for one line of
   * typing. One row now, and about half the height.
   */
  .note-bar { position: fixed; left: 0; right: 0; bottom: var(--bottom-h); z-index: 30; display: grid;
    gap: 0; padding: .3rem .7rem .35rem;
    background: var(--card); border-top: 1px solid var(--line);
    box-shadow: 0 -2px 14px rgba(0,0,0,.14); }
  .note-row { display: flex; gap: .4rem; align-items: center; }
  .note-bar textarea { flex: 1; font: inherit; font-size: .82rem; resize: none; min-height: 1.6rem;
    max-height: 7rem; padding: .25rem .45rem; border: 1px solid var(--line); border-radius: 5px;
    background: var(--bg); color: var(--ink); line-height: 1.3; }
  .note-bar button#note-send { font: inherit; font-size: .78rem; background: var(--accent); color: var(--bg);
    border: 0; border-radius: 5px; padding: .3rem .65rem; cursor: pointer; }
  .note-bar .status { font-size: .74rem; white-space: nowrap; }
  .note-bar .status.ok { color: var(--ok); } .note-bar .status.bad { color: var(--bad); }
  /* Clearance for the composer, so it never covers the last thing on the page. */
  /**
   * ⛔ THE CONVERSATION ABOVE THE BOX, AND CAPPED. A thread that grows without limit eventually
   * owns the screen somebody is trying to review, which is the opposite of what a dock is for.
   */
  /**
   * ⛔ A WINDOW, NOT A DOCUMENT. The first version showed every reply in full and a single long
   * outcome — the account of a whole afternoon's work — took over the screen somebody was trying to
   * review. Each line is clamped to two; the whole thing to a few. Hovering a line opens it.
   */
  body.has-note-bar { padding-bottom: calc(4.5rem + var(--bottom-h)); }

  /*
   * ⛔ THE ONE WAY OUT. Peter: *"we need better error handling - we should just pass the response to
   * a notification bar or something... a generic 'out' way to message back to the user if it's not
   * from the chat interface"*.
   *
   * Above the composer, because that is where an answer to something he just did belongs — and the
   * composer's own height is a variable, so the bar sits on top of the dock rather than under it,
   * which is the mistake the side menu had.
   *
   * ⛔ Stacked newest last and never taller than a third of the window: a refusal waits to be
   * dismissed, so without a cap a run of them would own the screen being reviewed.
   */
  .out { position: fixed; right: 1rem; bottom: calc(5.5rem + var(--bottom-h)); z-index: 60;
    display: flex; flex-direction: column; gap: .4rem; width: min(26rem, calc(100vw - 2rem));
    max-height: 34vh; overflow-y: auto; pointer-events: none; }
  .out:empty { display: none; }
  .outnote { pointer-events: auto; position: relative; display: flex; flex-direction: column;
    gap: .2rem; padding: .55rem 1.9rem .55rem .7rem; border-radius: 8px; font-size: .82rem;
    background: var(--card); border: 1px solid var(--line); box-shadow: 0 6px 18px rgba(0,0,0,.18); }
  .outnote strong { font-weight: 600; font-size: .84rem; }
  .outnote span { color: var(--dim); font-size: .78rem; }
  /* ⛔ The two outcomes do not look alike. A refusal that reads like a confirmation is the thing
     being fixed here — he was handed one and could not tell what had happened. */
  .outnote.ok { border-left: 3px solid var(--ok); }
  .outnote.bad { border-left: 3px solid var(--bad); }
  .outnote-x { position: absolute; top: .3rem; right: .35rem; background: none; border: 0;
    color: var(--dim); cursor: pointer; font-size: 1rem; line-height: 1; padding: .1rem .25rem;
    border-radius: 4px; }
  .outnote-x:hover { color: var(--ink); }

  .gate-note { background: var(--warn-bg); border-left: 3px solid var(--warn); border-radius: 0 6px 6px 0;
    padding: .7rem .9rem; margin: .9rem 0 1.4rem; font-size: .92rem; }
  /**
   * ⛔ THE UNASKED HALF READS AS UNASKED, AND NOT AS A QUEUE.
   *
   * A question card is a card with a border and a background because it is a thing to act on.
   * These are not —
   * nothing here is pressable, by design, because a hole with no drafted options cannot be answered
   * by choosing. Styling them like questions would offer a reviewer eight cards and no buttons,
   * which is the state the queue's own ⛔ describes as "reads as finished".
   *
   * So: a list, offset by a rule down the left, in the dimmer register the page already uses for
   * things that are context rather than acts.
   */
  /**
   * ⛔ CONTEXT READS AS CONTEXT. It sits above the options and below the question, dimmer than
   * both, with each line labelled by what it answers — so a reader can skip it once they know the
   * feature and cannot mistake it for something being decided.
   */
  .q-ctx { margin: .6rem 0 1rem; font-size: .9rem; color: var(--dim); }
  .q-ctx p { margin: .2rem 0; }
  .q-ctx .k { color: var(--ink); opacity: .75; }
  .unasked { margin-top: 2rem; padding-left: .9rem; border-left: 2px solid var(--line); }
  .unasked h3 { margin: 0 0 .4rem; font-size: 1rem; }
  .unasked .note { color: var(--dim); font-size: .9rem; margin: .5rem 0 0; }
  .unasked-list { list-style: none; margin: 1rem 0 0; padding: 0; }
  .unasked-list li { padding: .7rem 0; border-top: 1px solid var(--line); }
  /** ⛔ The question is the thing to read, so it carries the page's own ink weight. */
  .u-asks { margin: 0; font-size: 1rem; line-height: 1.5; color: var(--ink); }
  .u-why { margin: .25rem 0 0; font-size: .88rem; color: var(--dim); }
  .u-fills { margin: .25rem 0 0; font-size: .85rem; color: var(--dim); }
  .steer-list { list-style: none; margin: 1rem 0 0; padding: 0; }
  .steer-block { margin-top: 1.6rem; }
  .steer-list li { padding: .6rem 0; border-bottom: 1px solid var(--line); font-size: 1rem; line-height: 1.5; }
  /**
   * ⛔ A HABIT READS AS A HABIT. On the settings surface each row carries where it was learned and,
   * where it was turned off, why — stacked under the sentence rather than beside it, so a long
   * provenance does not squeeze the thing it is provenance for.
   */
  .steer-list .steer-says { display: block; }
  .steer-list .steer-from { display: block; margin-top: .2rem; font-size: .82rem; color: var(--dim); }
  .steer-list .steer-nowhere { color: var(--warn); }
  /** ⛔ A mark, not a warning — it says nobody has read this, not that anything is wrong. */
  .steer-list .steer-new { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em;
    color: var(--accent); border: 1px solid var(--line); border-radius: 999px; padding: .05rem .4rem;
    vertical-align: middle; margin-left: .3rem; }
  .steer-list .steer-for { display: block; margin-top: .2rem; font-size: .82rem; color: var(--dim); }
  .steer-list .steer-why { display: block; margin-top: .2rem; font-size: .82rem; color: var(--dim); font-style: italic; }
  /** ⛔ Legible, not hidden. A declined habit is evidence about this project, not clutter. */
  .steer-list li.steer-off .steer-says { text-decoration: line-through; color: var(--dim); }
  .charter-section { border-top: 1px solid var(--line); padding-top: 1rem; margin-top: 1.4rem; }
  .charter-section h3 { font-size: 1.1rem; margin: 0 0 .3rem; }
  ul.contents { list-style: none; margin: 1rem 0 0; padding: 0; }
  ul.contents li { padding: .7rem 0; border-bottom: 1px solid var(--line);
    display: flex; gap: .7rem; align-items: baseline; flex-wrap: wrap; }
  ul.contents a { font-size: 1.05rem; }
  ul.contents .n { font-size: .82rem; color: var(--dim); }
  /* ---- a group's high-level view ---------------------------------------- */
  /* ---- what the feature is for --------------------------------------- */
  .happy { border: 1px solid var(--accent); border-radius: 10px; padding: .9rem 1rem;
    margin: 0 0 1.4rem; background: var(--card); }
  .happy.agreed { border-color: var(--ok); }
  .happy.none { border-color: var(--warn); }
  .happy h3 { font-size: .74rem; text-transform: uppercase; letter-spacing: .06em; color: var(--dim);
    margin: 0 0 .4rem; }
  .happy-does { font-size: 1.05rem; line-height: 1.45; margin: 0 0 .7rem; }
  dl.happy-io { display: grid; grid-template-columns: max-content 1fr; gap: .2rem .7rem;
    margin: 0 0 .7rem; font-size: .92rem; }
  dl.happy-io dt { font-size: .72rem; text-transform: uppercase; letter-spacing: .05em;
    color: var(--dim); padding-top: .15rem; }
  dl.happy-io dd { margin: 0; }
  /* The flow, walkable: each screen in order, each one a way in. */
  ol.happy-through { list-style: none; display: flex; flex-wrap: wrap; gap: .3rem .1rem;
    margin: 0 0 .7rem; padding: 0; font-size: .92rem; }
  ol.happy-through li + li::before { content: "→"; color: var(--dim); margin: 0 .45rem 0 .35rem; }
  .happy-ok { font-size: .82rem; color: var(--ok); margin: .5rem 0 0; }
  .happy-why { font-size: .82rem; color: var(--dim); margin: .5rem 0 0; }
  /**
   * ⛔ LOUD, BECAUSE THE WHOLE POINT IS BEING ASKED TO CHANGE IT. A default rendered in the same
   * grey as everything else is a default nobody overrides — it becomes the answer by attrition.
   */
  .decided-for-you { font-size: .88rem; background: var(--warn-bg); border-left: 3px solid var(--warn);
    border-radius: 0 6px 6px 0; padding: .6rem .8rem; margin: .6rem 0 0; }
  .group-ux { margin: 1.4rem 0 1.8rem; }
  .group-ux h3 { font-size: 1rem; margin: 0 0 .3rem; }
  .group-ux .lede { font-size: .9rem; color: var(--dim); margin: 0 0 .9rem; }
  /* Layers left to right, so the flow reads the way a person walks it; wraps on a narrow pane. */
  .ux-map { display: flex; gap: .9rem; align-items: flex-start; overflow-x: auto; padding-bottom: .4rem; }
  ol.ux-layer { list-style: none; margin: 0; padding: 0; display: grid; gap: .5rem; min-width: 15rem; }
  .ux-layer-name { font-size: .68rem; text-transform: uppercase; letter-spacing: .06em; color: var(--dim); }
  .ux-node { border: 1px solid var(--line); border-radius: 8px; background: var(--card);
    padding: .55rem .7rem; display: grid; gap: .15rem; }
  .ux-node.intended { border-style: dashed; }
  .ux-node > button.show-part { font-size: .95rem; font-weight: 600; text-align: left; }
  .ux-in { font-size: .76rem; color: var(--dim); }
  .ux-n { font-size: .74rem; color: var(--dim); }
  .ux-n .warn { color: var(--warn); }
  .ux-flag { font-size: .68rem; text-transform: uppercase; letter-spacing: .05em; color: var(--dim);
    border: 1px solid var(--line); border-radius: 99px; padding: 0 .35rem; justify-self: start; }
  .ux-goes { font-size: .78rem; margin-top: .2rem; }
  .ux-goes.none { color: var(--dim); font-style: italic; }
  .group-rules { margin: 1.2rem 0 1.6rem; }
  .group-rules h3 { font-size: 1rem; margin: 0 0 .3rem; }
  .group-rules .lede { font-size: .9rem; color: var(--dim); margin: 0 0 .8rem; }
  /* A group that states nothing says so, quietly — a silent blank reads as "checked, fine". */
  .group-rules .none { font-size: .88rem; color: var(--dim); font-style: italic; margin: 0;
    border-left: 2px solid var(--line); padding-left: .7rem; }
  .group-rules .beh.asking { border-left: 3px solid var(--warn); }
  .topframe nav.scopes { max-width: 100%; margin: 0 auto; padding: 0 1.25rem 1rem;
    max-height: 60vh; overflow-y: auto; }
  form.act-form { margin: .9rem 0 0; padding: .9rem; border: 1px solid var(--accent); border-radius: 8px;
    display: grid; gap: .35rem; }
  form.act-form label { font-size: .82rem; color: var(--dim); }
  form.act-form .count { float: right; font-variant-numeric: tabular-nums; }
  form.act-form input, form.act-form textarea { font: inherit; font-size: .92rem; width: 100%;
    padding: .45rem .55rem; border: 1px solid var(--line); border-radius: 5px;
    background: var(--bg); color: var(--ink); }
  form.act-form .short { border-color: var(--warn); }
  form.act-form .act-go { display: flex; gap: .5rem; margin-top: .4rem; }
  form.act-form button { font: inherit; font-size: .9rem; cursor: pointer; border-radius: 6px;
    padding: .4rem .8rem; background: var(--accent); color: var(--bg); border: 1px solid var(--accent); }
  form.act-form button.cancel { background: transparent; color: var(--ink); border-color: var(--line); }
  form.act-form .status { font-size: .88rem; margin: .3rem 0 0; }
  form.act-form .status.ok { color: var(--ok); }
  form.act-form .status.bad { color: var(--bad); }
  .crit { margin-top: 1rem; font-size: .9rem; }
  .crit summary { cursor: pointer; color: var(--dim); }
  .crit ul { margin: .6rem 0 0; padding-left: 1.1rem; }
  .crit li { margin: .35rem 0; }
  .cslot { font-family: ui-monospace, Menlo, monospace; font-size: .78rem; color: var(--accent); margin-right: .4rem; }
  /* The address a builder was handed. Quiet — it is a lookup key, not part of the sentence. */
  .creq { font-family: ui-monospace, Menlo, monospace; font-size: .72rem; color: var(--dim); margin-right: .4rem; }
  /* The subsystems. ⛔ The containment IS the indent — a child renders inside its parent's box, so
     no depth variable and no computed margin. Deliberately plainer than a behaviour card: this is
     an engineering sketch and it must not wear product truth's furniture. */
  .subsys { margin: .9rem 0; padding: .75rem .9rem; border: 1px solid var(--line); border-radius: 8px; background: var(--card); }
  .subsys > header { display: flex; align-items: baseline; gap: .5rem; flex-wrap: wrap; }
  .subsys > header h3 { margin: 0; font-size: 1rem; }
  .subsys > header code { font-family: ui-monospace, Menlo, monospace; font-size: .72rem; color: var(--dim); }
  .subsys-does { margin: .35rem 0; }
  .subsys-uses, .subsys-groups { margin: .35rem 0; font-size: .85rem; color: var(--dim); }
  .cap-list { margin: .5rem 0 0; padding-left: 1.1rem; }
  .cap-list li { margin: .4rem 0; }
  .cap-does { display: block; }
  .cap-serves { display: block; font-size: .85rem; color: var(--dim); }
  .subsys-relied { margin: .35rem 0; font-size: .85rem; color: var(--dim); }
  .cap-terms { margin: .3rem 0 0; padding-left: 1rem; font-size: .82rem; color: var(--dim); }
  .cap-up { font-style: italic; }
  .cap-dead { color: var(--warn, #b4541f); }
  .g { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: var(--dim); margin: 0 .25rem; }
  .ex-card footer { margin-top: 1.1rem; padding-top: .9rem; border-top: 1px solid var(--line); }
  .gated { font-size: .9rem; }
  .gated ul { margin: .3rem 0 0; padding-left: 1.1rem; color: var(--warn); }
  .parked-set { opacity: .9; }
  /**
   * ⛔ A PHONE IS A WIDTH SOMEBODY REVIEWS AT, AND THE PAGE DID NOT FIT ONE.
   *
   * At 390px the document scrolled sideways, the behaviour table — the thing the page exists for —
   * ran 88px past its own box with the sentence column cut off at the right edge, and 64px of a
   * 390px screen went to page padding.
   *
   * ⛔ THE BREAKPOINT IS 34rem AND THE MEASUREMENT HAS TO BE TAKEN AT ONE. A headless Chrome window
   * cannot be made narrower than about 500px, so a window-size flag of 390 measures 500 and reports
   * a layout no phone ever sees — the probes behind this block set device metrics instead. See
   * the resize helper in the browser harness.
   */
  @media (max-width: 34rem) {
    .slot { grid-template-columns: 1fr; gap: .1rem; }
    .opt { grid-template-columns: 1fr; }
    .legend dl { grid-template-columns: 2.5rem 1fr; }
    /* 4rem of a 390px screen was page margin. */
    main { padding: 1.25rem .8rem 6rem; }
    .topframe .tabs { padding: .5rem .6rem 0; }
    .topframe .subtabs { padding: .35rem .6rem .5rem; }
    .crumbs { padding: .45rem .8rem .6rem; }
    /*
     * ⛔ THE TABLE STOPS BEING A TABLE. Two columns with three labelled buttons in the second one
     * have a min-content width of about 414px, which is wider than the screen — so the choice is a
     * sentence cut off at the edge or rows that read top to bottom. ⛔ And the columns were only
     * ever there to be scanned down; at this width there is one row on screen at a time and there
     * is nothing to scan.
     */
    table.beh-table, table.beh-table tbody, table.beh-table tr, table.beh-table td,
    table.beh-table th { display: block; width: auto; }
    table.beh-table thead { display: none; }
    table.beh-table td:last-child { width: auto; text-align: left; }
    table.beh-table td { border-bottom: 0; padding: .35rem 0; }
    table.beh-table tr.beh { border-bottom: 1px solid var(--line); padding: .35rem 0; }
    .row-acts { justify-content: flex-start; }
    /* A label above its value, rather than a max-content column squeezing the value to nothing. */
    dl.happy-io { grid-template-columns: minmax(0, 1fr); }
  }
</style>`;

/**
 * The prototype view: every screen, driveable, with the truth a press away.
 *
 * ⛔ THE SCREEN IS THE SUBJECT HERE. Full width, one at a time, and the sentences arrive in the side
 * pane when you press part of it — the inversion of every other view on this page, where a screen is
 * evidence inside a behaviour card.
 */
/**
 * ⛔ WHAT THIS PROJECT HAS LEARNED — SHOWN, AND NOT AS TRUTH.
 *
 * Peter: *"we need a 'framework way' to track more context about a project, like design system
 * concepts, feedback given, etc. some stuff should be opaque and auto-training, while others are
 * made obvious in product OS"* — and, asked where the opaque half gets reviewed: *"A settings
 * surface on the page"*.
 *
 * The tension is real and the resolution is the heading. A generation steer must not be agreed to:
 * nobody validates taste, and the moment one carries weight in a gate it has become product truth
 * and belongs in a scope. But a habit that silently shapes every screen this product proposes, with
 * no way to see or refuse it, is a constraint nobody chose — which is the defect `learned_from`
 * exists to prevent, one level up. So: visible, provenance attached, declinable, and labelled as
 * habits rather than promises.
 */
function renderSettings(corpus: Corpus): string {
  const live = inEffect(corpus.steers);
  const off = declinedSteers(corpus.steers);
  if (!live.length && !off.length) return "";
  const row = (x: Steer, dead: boolean): string =>
    `<li id="${anchorOf(`steer#${x.id}`)}" data-ref="${esc(`steer#${x.id}`)}" data-label="${esc(plain(x.says).slice(0, 60))}"${
      dead ? ' class="steer-off"' : ""
    }>
       <span class="steer-says">${line(x.says)}${
         /**
          * ⛔ LEARNED AND UNREAD — the one state worth a mark, and the cost of "in force
          * immediately". It is already steering every author it names; nobody has looked at it yet.
          * The badge is not a gate and must never become one, or the choice to apply on arrival has
          * been quietly reversed by a rendering change.
          */
         Boolean(x.learned_from) && !x.acknowledged && !dead ? ` <span class="steer-new">new</span>` : ""
       }</span>
       ${
         /**
          * ⛔ THE PROVENANCE IS THE WHOLE REASON THIS IS LOOKABLE-AT. A habit with its source shown
          * is one somebody can check and refuse; without it, it is a preference that acquired
          * authority by being written down. The loader reports a generation steer that has none.
          */
         x.learned_from
           ? `<span class="steer-from">learned from ${line(x.learned_from)}</span>`
           : `<span class="steer-from steer-nowhere">nothing says what this was inferred from — so there is nothing here anybody can argue with</span>`
       }
       ${
         /**
          * ⛔ RESOLVED, NEVER THE RAW `for`. Naming a seat is the point of seats — `engineering`
          * is two authors today and three tomorrow — so echoing the word back tells a reviewer
          * nothing about who is currently being steered, which is the question they are here for.
          */
         (() => {
           if (dead) return "";
           const hits = AUTHORS.filter((a) => reaches(x, a.name)).map((a) => a.name);
           return x.for?.length
             ? `<span class="steer-for">reaches ${hits.map((h) => esc(h)).join(", ") || "nobody"} — aimed at ${x.for.map((f) => esc(f)).join(", ")}</span>`
             : `<span class="steer-for">reaches every author</span>`;
         })()
       }
       ${dead ? `<span class="steer-why">declined — ${line(x.declined ?? "")}</span>` : ""}
     </li>`;
  return `<section class="view" id="view-settings" data-view="settings" data-ref="settings" data-label="What steers this">
    <p class="lede">Habits this project works under. ⛔ <strong>Not promises</strong> — nothing here is
    a claim about the product, and nobody agrees to any of it. They shape what gets proposed; what
    the product commits to is on the features, and what holds across all of them is in the charter.</p>
    ${
      /**
       * ⛔ NOT `sub-view` WRAPPERS, AND THAT IS NOT A STYLE CHOICE. A `.sub-view` is hidden by the
       * frame's script and revealed one at a time by a `subtabs` row — which Overview has and this
       * surface does not. Wrapped that way, both lists rendered into the DOM and neither was ever
       * shown: the tab worked, the section opened, and the page was blank below the lede.
       *
       * ⛔ Found in a browser. Every assertion on the markup passed — the lists ARE in the HTML.
       */
      live.length
        ? `<div class="steer-block" data-ref="steers-live">
             <h2>In force</h2>
             <p class="lede">Carried into the authors each one names. ⛔ And into no reviewer — one
             told what this project likes can no longer notice the project is wrong.</p>
             <ul class="steer-list">${live.map((x) => row(x, false)).join("")}</ul>
           </div>`
        : ""
    }
    ${
      off.length
        ? `<div class="steer-block" data-ref="steers-declined">
             <h2>Declined</h2>
             <p class="lede">Somebody looked at these and said they are not rules here. ⛔ Kept rather
             than deleted: the pattern each was learned from is still in the record, so a steer that
             was merely removed comes back the next time anything reads it.</p>
             <ul class="steer-list">${off.map((x) => row(x, true)).join("")}</ul>
           </div>`
        : ""
    }
  </section>`;
}

/**
 * The subsystems beneath the product, and roughly what each does.
 *
 * ⛔ THE HALF OF THE SITE A JUDGE HAS BEEN SENT TO READ SINCE BEFORE IT EXISTED.
 * `productos-architect`'s instructions say *"The site has two halves: the product's user-facing
 * features, and the subsystems beneath them. Read the features to learn what the system is
 * required to do; read the subsystems to see whether anybody has said how."* There was no second
 * half. Every architect run has been reviewing the features and reporting the machinery missing,
 * which is correct and was never actionable, because no author and no surface existed for it.
 *
 * ⛔ AND A CAPABILITY IS NEVER SHOWN AS AGREED, because none of this is truth. Peter:
 * *"capabilities are something engineers can/should agree on in the future"* — future, so the
 * lede says plainly that nobody has agreed to any of it. ⛔ Rendering an engineering sketch with
 * the furniture of product truth is the exact mistake `packet.ts` made when it printed "accepted
 * separately" on rules nobody had stamped.
 */
function renderSubsystems(
  corpus: Corpus,
  address: (ref: string) => string,
  /** The one this page is standing on, where the address named it. ⛔ Absent means the whole tree. */
  at?: string,
  /** Where each subsystem is addressed, so the trail above a focused one can be walked back up. */
  subAddress: (id: string) => string = () => "#"
): string {
  const tree = capabilityTree(corpus);
  if (!corpus.subsystems.length && !tree.carried.length) return "";
  const subs = corpus.subsystems.map((x) => x.subsystem);
  const titleOf = (id: string) => subs.find((s) => s.id === id)?.title ?? id;

  /** What a `serves` ref actually says, so a reader is not left holding an address. */
  const servedText = (ref: string): string => {
    const r = resolveRef(corpus, ref);
    if ("error" in r) return `<span class="cap-dead">${esc(ref)} — nothing here</span>`;
    if (r.ref.kind === "capability") {
      const other = subs.find((s) => s.id === (r.ref as { subsystem: string }).subsystem);
      const o = other?.offers.find((x) => x.id === (r.ref as { capability: string }).capability);
      return `<span class="cap-up">${esc(other?.title ?? "")} · ${line(o?.does ?? ref)}</span>`;
    }
    const [scopeId, exId] = ref.split("#");
    const sc = corpus.scopes.find((s) => s.scope.id === scopeId)?.scope;
    const ex = sc?.exchanges.find((e) => e.id === exId);
    return `<a href="${esc(address(`${scopeId}#${exId}`))}">${line(ex?.title ?? ref)}</a>`;
  };

  /**
   * ⛔ THE INDENT IS THE NESTING, NOT A DEPTH VARIABLE. The first cut carried `style="--d:N"` and a
   * `margin-left: calc(var(--d) * 1.4rem)` — which double-counts, because a child subsystem is
   * already rendered INSIDE its parent's box and already offset by its padding. Depth 2 got two
   * levels of containment plus 2.8rem of margin on top.
   *
   * ⛔ Found because the test could not fail. Deleting the margin rule left every assertion green:
   * the geometry check was `child.left > parent.left + 10` and the parent's padding alone is ~15px,
   * so it was passing on containment while claiming to measure the indent. The mechanism was
   * redundant and the test was measuring the wrong thing — one defect, visible from two sides.
   */
  /**
   * ⛔ A CAPABILITY IS SHOWN AS A CONTRACT — WHAT IT GIVES, TO WHOM, AND HOW YOU WOULD KNOW — NOT AS A
   * FEATURE. Peter: *"seems like our renderer is rendering our capabilities as a feature, which is
   * wrong - should have its own view, specific to the contracts it provides"*. What converting the
   * older tree carried word for word (when it is called, the tests it had) lives in the part's body
   * under one heading per capability, and is read back here beside the capability it belongs to.
   */
  const carriedFor = (sid: string): Map<string, string[]> => {
    const body = corpus.subsystems.find((x) => x.subsystem.id === sid)?.body ?? "";
    const out = new Map<string, string[]>();
    const at = body.indexOf("## Carried from the earlier capability tree");
    if (at < 0) return out;
    for (const block of body.slice(at).split(/\n### /).slice(1)) {
      const [head, ...rest] = block.split("\n");
      out.set(head!.trim(), rest.map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean));
    }
    return out;
  };
  /** Who leans on a part: the features that say they rest on it, and the parts that use it. */
  const reliedOnBy = (sid: string): string[] => [
    ...corpus.scopes
      .filter(({ scope }) => scope.depends_on.some((d) => d === `${sid}#offers` || d.startsWith(`${sid}#offers#`)))
      .map(({ scope }) => `<a href="${esc(address(scope.id))}">${line(scope.title)}</a>`),
    ...subs.filter((x) => x.uses.includes(sid)).map((x) => `<strong>${line(x.title)}</strong>`),
  ];

  const one = (s: (typeof subs)[number]): string => {
    const carried = carriedFor(s.id);
    const relied = reliedOnBy(s.id);
    return `
    <article class="subsys" data-ref="${esc(s.id)}">
      <header>
        <h3>${line(s.title)}</h3>
        <code>${esc(`${s.id}#offers`)}</code>
      </header>
      <p class="subsys-does">${line(s.does)}</p>
      ${
        s.uses.length
          ? `<p class="subsys-uses">leans on ${s.uses.map((u) => `<strong>${line(titleOf(u))}</strong>`).join(", ")}</p>`
          : ""
      }
      ${relied.length ? `<p class="subsys-relied">relied on by ${relied.join(", ")}</p>` : ""}
      ${
        s.offers.length
          ? `<ul class="cap-list">${s.offers
              .map(
                (o) => `
            <li class="contract" data-ref="${esc(`${s.id}#offers#${o.id}`)}">
              <code class="creq">${esc(`${s.id}#offers#${o.id}`)}</code>
              <span class="cap-does">${line(o.does)}</span>
              ${
                o.serves.length
                  ? `<span class="cap-serves">for ${o.serves.map(servedText).join(", ")}</span>`
                  : `<span class="cap-serves cap-dead">serves nothing yet — nobody has said what this is for</span>`
              }
              ${
                (carried.get(o.id) ?? []).length
                  ? `<ul class="cap-terms">${(carried.get(o.id) ?? []).map((t) => `<li>${line(t)}</li>`).join("")}</ul>`
                  : ""
              }
            </li>`
              )
              .join("")}</ul>`
          : `<p class="subsys-groups">Groups what is filed inside it; offers nothing itself.</p>`
      }
      ${subs
        .filter((x) => x.in === s.id)
        .map((x) => one(x))
        .join("")}
    </article>`;
  };

  /** ⛔ Orphans render too. A subsystem filed inside nothing is a `check` refusal, not a reason to
   *  hide it — a page that silently drops it is a page that disagrees with the check. */
  const parented = new Set(subs.filter((s) => s.in && subs.some((x) => x.id === s.in)).map((s) => s.id));
  /**
   * ⛔ ONE ADDRESS RENDERS ONE PAGE, AND THAT HAS TO HOLD FOR THIS TREE TOO.
   *
   * Without this the whole 27-subsystem tree rendered whatever the address said, so every row in
   * the new menu led to the same 145 KB page and the reader had to find their way back to the part
   * they had just chosen. That is the defect the scope side of this file already fixed — Peter:
   * *"we need to stop the 'server re-rendering' of anything"* — and the machinery had no reason to
   * be the exception.
   */
  const focus = at ? subs.find((x) => x.id === at) : undefined;
  const roots = focus ? [focus] : subs.filter((s) => !parented.has(s.id));
  /**
   * ⛔ THE WAY BACK UP IS ON THE PAGE, because a focused page is reached from a menu that may be
   * collapsed behind a chevron. Every ancestor is somewhere you can stand, so each is a link — the
   * same argument the scope breadcrumb's own comment makes.
   */
  const up = focus
    ? (() => {
        const trail = subsystemTrailsOf(corpus)[focus.id] ?? [];
        const above = trail.slice(0, -1);
        return `<p class="subsys-up"><a href="${esc(subAddress(""))}">The machinery</a>${above
          .map((c) => ` › <a href="${esc(subAddress(c.id))}">${line(c.label)}</a>`)
          .join("")}</p>`;
      })()
    : "";

  /**
   * ⛔ THE SECTION SAYS WHICH SUBSYSTEM IT IS SHOWING, because the client has to tell this page's own
   * address apart from another page's. Without it, handing every focused machinery link to the
   * browser also handed it THIS page's address on a cold arrival, so the landing fell through to
   * Overview and rewrote the URL — measured: served /v2/subsystems/records/ledger, ended up at
   * /v2/overview with the tree intact and the focus gone.
   */
  return `<section class="view" id="view-subsystems" data-view="subsystems" data-ref="subsystems"${
    focus ? ` data-focused="${esc(focus.id)}"` : ""
  } data-label="How it works">
    ${
      focus
        ? `${up}`
        : `<p class="lede">The parts of the system beneath the product, and roughly what each does.
    ⛔ <strong>Not product truth, and nobody has agreed to any of it.</strong> This is engineering's
    answer to what the product promised — each part says what it exists to serve, and you can follow
    that back to the behaviour that required it. What the product commits to is on the features.</p>
    <p class="subsys-count" data-subsystems="${tree.counts.subsystems}" data-capabilities="${tree.counts.capabilities}" data-carried="${tree.carried.length}">${line(tree.says)}</p>`
    }
    ${roots.map((s) => one(s)).join("")}
  </section>`;
}

/**
 * The whole product as one screen somebody can walk.
 *
 * ⛔ A BOARD SHOWS WHAT EXISTS; IT DOES NOT SHOW HOW ANY OF IT FITS TOGETHER.
 *
 * Peter: *"we should be able to know the true navigation, leverage screens within screens, like
 * really a walkable single prototype that can link out to the different areas. so the goal here is
 * to just have a SINGLE screen that can go through the whole product, based on the established
 * truth"*.
 *
 * So: one stage, one screen on it, and every way out of that screen listed beside it — the screens
 * it HOLDS and the screens its controls LEAD TO, which are different relations and are labelled
 * differently. Where you are is a line of text, because a reader who cannot say which part of the
 * product they are standing in is not walking it, they are clicking pictures.
 *
 * ⛔ IT CLONES FROM THE BOARD RATHER THAN CARRYING ITS OWN COPY. Every screen's markup is already
 * on the page once; a second copy would have put this corpus over fourteen megabytes to show one
 * screen at a time.
 *
 * ⛔ AND IT NAMES THE SCREENS WITH NO DOOR. A walk that silently skipped them would read as a
 * complete product with part of itself missing, which is the opposite of what this is for.
 */
/**
 * The choice a reader makes before they walk anything.
 *
 * ⛔ FIRST CLASS, AT THE ROOT, AND IT SAYS WHAT IT IS ASKING.
 *
 * Peter: *"we should have a first class "prototype selection' at the root of prototypes. the
 * multiple prototypes should be supported by the framework - what it splits on should be up to the
 * project/user driving it"*.
 *
 * What was here was a row of bare buttons that appeared only when a corpus happened to have more
 * than one prototype — so the question a reader has first, *these are versions of WHAT?*, had no
 * answer anywhere on the page. And with one prototype the row vanished entirely, which is the state
 * where a reader most needs to be told that choosing is a thing this product's truth can express.
 *
 * ⛔ IT SHOWS HOW MUCH EACH ONE REACHES, because that is what separates a second way through the
 * product from a single screen somebody filed hopefully. An option that opens on a screen with no
 * drawing says so rather than leading somewhere blank.
 *
 * ⛔ AND THE GAPS ARE ON THE PAGE, not only in `check`. This is the surface where somebody decides
 * what the prototypes are; a split whose question is unstated, or two options answering it
 * identically, is exactly the thing they are here to fix.
 */
/**
 * One control per dimension, on the breadcrumb line of every page.
 *
 * ⛔ "ANY" IS A VALUE, AND IT IS THE DEFAULT. A dimension with nothing chosen must not narrow — the
 * model's rule is that unsaid means everywhere, and a filter whose default was the first value would
 * silently show a reader one audience's product and call it the product.
 *
 * ⛔ AND THE COUNT OF WHAT IS HIDDEN IS PART OF THE CONTROL, not a detail below it. A page that
 * quietly omits truth is how somebody agrees to less than they think they are agreeing to; the
 * number is what makes the omission visible. It is filled by the script, because what is on screen
 * depends on a choice the server never sees.
 */
function dimensionFilter(corpus: Corpus): string {
  const dims = dimensionsOf(corpus);
  if (!dims.length) return "";
  return (
    `<div class="dimfilter" data-dimfilter>` +
    dims
      .map(
        (d) =>
          `<label class="dimpick"><span class="dimlabel">${esc(d.label)}</span>` +
          `<select data-dim-filter="${esc(d.id)}" aria-label="${esc(`Show this product as ${d.label}`)}">` +
          /** ⛔ The empty value is "any", named so a reader knows nothing is being hidden. */
          `<option value="">any</option>` +
          d.values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("") +
          `</select></label>`
      )
      .join("") +
    `<span class="dimhid" data-dimhidden hidden></span>` +
    `</div>`
  );
}

function selectionAtTheRoot(sel: Selection): string {
  if (!sel.options.length) return "";
  const gaps = gapsIn(sel);

  /**
   * ⛔ HIS DESIGN, AFTER I BUILT THREE WRONG ONES.
   *
   *     Dimensions
   *     {Dimension 1 drop down} ... {Dimension n drop down}   {Add a dimension}
   *
   *     Prototypes
   *     CRE admin        role:admin  line:CRE
   *     Admin            no dimensions                        [assign]
   *
   * Peter, in order: *"wtf is this? this doesn't seem like a selector of any kind, seems like a barf
   * of information"* → *"why is it a drop down? do we get multiple drop downs per dimension?"* →
   * *"why is it just two buttons again???"* → *"here's what we should have"* with the sketch above →
   * *"Prototypes are shown by which dimensions they specify, with 'no dimensions' specified - they
   * can then assign it"* → *"so the prototypes just has chips of which dimension, e.g. role:admin.
   * and the drop down selectors will be filters"*.
   *
   * ⛔ THE DROPDOWNS ARE FILTERS, which is the part I had inside out. I built them as a coordinate
   * that resolves to one prototype, so a combination nothing covered had to be a special case and a
   * reader could only ever see one thing at a time. As filters they narrow a LIST, every prototype
   * carries what it is on its face, and "nothing covers this" needs no special case at all — the
   * list is simply empty, which is the same information without a mechanism.
   *
   * ⛔ AND A PROTOTYPE THAT SPECIFIES NOTHING IS IN THE LIST, saying so. That is where it gets
   * assigned from; hiding it until somebody placed it would hide the thing that needs doing.
   */
  const dimensions = sel.axes.filter((ax) => ax.values.length);
  const ADD_VALUE = "__add__";
  const ANY = "";

  const filters = dimensions
    .map(
      (ax) => `<label class="wdim">
        <span class="wdim-n">${line(ax.label)}</span>
        <select data-walk-dim="${esc(ax.id)}">
          <option value="${ANY}" selected>Any</option>
          ${ax.values.map((v) => `<option value="${esc(v)}">${line(v)}</option>`).join("")}
          <!-- ⛔ "otherwise an option to add another" — where somebody notices theirs is missing. -->
          <option value="${ADD_VALUE}">+ add a value…</option>
        </select>
      </label>`
    )
    .join("");

  /** ⛔ *"When none: {Add a dimension}"* — and no row of prototypes standing in for a selector. */
  const addDim = `<button type="button" class="wadd" data-dim-add>Add a dimension</button>`;

  /**
   * ⛔ BROUGHT UP, NOT LEFT OPEN. *"Add a dimension brings up the form, saying dimension type, and
   * values."* Two fields, so there is exactly one thing to do in it.
   */
  const form = `<div class="wdimform" hidden data-dim-form>
    <label><span>Dimension</span><input name="label" placeholder="Role" spellcheck="false"></label>
    <label><span>Its values</span><input name="values" placeholder="admin, loan processor" spellcheck="false"></label>
    <button type="button" data-dim-save>Add</button>
    <button type="button" class="wdimform-x" data-dim-cancel>Cancel</button>
    <span class="status" data-dims-status></span>
  </div>`;

  /**
   * One row per prototype: its name, what it specifies, and a way in.
   *
   * ⛔ `data-is` CARRIES ITS OWN PLACEMENT, so filtering is the row answering for itself rather than
   * a second table of combinations that has to agree with it. The combinations map it replaces was a
   * copy of this, derived separately, and two derivations of one fact is the thing this project
   * spends most of its rules on.
   */
  const row = (o: Option): string => {
    const chips = sel.axes
      .filter((ax) => o.is[ax.id])
      .map((ax) => `<span class="pchip">${line(ax.label.toLowerCase())}:${line(o.is[ax.id]!)}</span>`)
      .join("");
    const reach =
      o.reaches > 1 ? `${o.reaches} screens` : o.reaches === 1 ? "1 screen" : "nothing beyond its front door";
    return `<li class="prow" data-proto-row="${esc(o.id)}" data-is="${esc(JSON.stringify(o.is))}">
      <button type="button" class="prow-go" data-walk-proto="${esc(o.id)}">${line(o.title)}</button>
      <span class="pchips">${
        chips || `<span class="pchip none" data-no-dims>no dimensions</span>`
      }</span>
      <span class="prow-m">${esc(reach)}${o.opensOn ? "" : " · opens on nothing"}</span>
      ${
        sel.axes.length
          ? `<button type="button" class="prow-assign" data-sel-more>${chips ? "change" : "assign"}</button>`
          : ""
      }
    </li>`;
  };

  /** One line, not a list. The count, and where the detail is. */
  const quiet = gaps.length
    ? `<span class="wsel-note">${gaps.length} thing${gaps.length === 1 ? "" : "s"} unsettled · <button type="button" class="wsel-more" data-sel-more>show</button></span>`
    : "";

  return `<div class="wsel">
    <p class="wsel-h">Dimensions</p>
    <div class="wsel-bar">${filters}${addDim}${quiet}</div>
    ${form}
    <p class="wsel-h">Prototypes <span class="wsel-c" data-proto-count>${sel.options.length}</span></p>
    <ul class="prows">${sel.options.map(row).join("")}</ul>
    <p class="wsel-empty" hidden data-proto-empty>No prototype covers that combination.</p>
    <div class="wsel-detail" hidden data-sel-detail>
      ${gaps.length ? `<ul class="wsel-gaps">${gaps.map((g) => `<li data-gap="${esc(g.kind)}">${line(g.says)}</li>`).join("")}</ul>` : ""}
      ${selectionEditor(sel)}
    </div>
  </div>`;
}

/**
 * Assigning the prototypes — the detail behind the list.
 *
 * ⛔ THE DIMENSION TABLE IS GONE FROM HERE, because the bar now has the form and two places to name
 * a dimension is two places that have to agree. It was left behind when the bar gained
 * "Add a dimension", and a test pointed at it — which is the test doing its job: a surface nobody
 * removed is a surface somebody will use, and then the two will disagree about what the dimensions
 * are.
 *
 * ⛔ WHAT STAYS IS ASSIGNMENT, which is the thing the list sends a reader here for: *"with 'no
 * dimensions' specified - they can then assign it"*. One select per dimension per prototype, with
 * the empty option meaning it specifies nothing on that one.
 */
function selectionEditor(sel: Selection): string {
  if (!sel.axes.length) return "";
  return `<table class="wsel-grid">
      <thead><tr><th>Prototype</th>${sel.axes.map((ax) => `<th>${line(ax.label)}</th>`).join("")}<th>Opens on</th><th></th></tr></thead>
      <tbody>${sel.options
        .map(
          (o) => `<tr data-sel-proto="${esc(o.id)}">
            <th scope="row">${line(o.title)}</th>
            ${sel.axes
              .map(
                (ax) =>
                  `<td><select name="${esc(ax.id)}">
                    <option value=""${o.is[ax.id] ? "" : " selected"}>—</option>
                    ${ax.values
                      .map((v) => `<option value="${esc(v)}"${o.is[ax.id] === v ? " selected" : ""}>${line(v)}</option>`)
                      .join("")}
                  </select></td>`
              )
              .join("")}
            <td><input name="startsAt" value="${esc(o.startsAt)}" spellcheck="false" class="${o.opensOn ? "" : "bad"}"></td>
            <td><button type="button" class="wsel-drop" data-sel-drop="${esc(o.id)}">take back</button></td>
          </tr>`
        )
        .join("")}</tbody>
    </table>
    <div class="wsel-actions"><button type="button" data-sel-save>Save placements</button><span class="status" data-sel-status></span></div>`;
}

/** Between two axis questions on one line. */
const pc_sep = ' <span class="wsel-and">then</span> ';

/**
 * Where this screen appears, settable here.
 *
 * ⛔ THE RELATION A WALK IS BUILT FROM, AND IT HAD NO SURFACE AT ALL. `within` has existed since the
 * walk did; the only ways to state it were hand-editing a truth file and, an hour ago, a CLI
 * command. On the corpus this was built for that left 0 of 17 screens placed and fifteen front
 * doors — a product rendering as a heap, with the fix reachable only from a terminal.
 *
 * ⛔ EVERY OTHER SCREEN IS OFFERED, including ones in other features. A screen can be filed under
 * one feature and appear inside a screen owned by another; that is a normal product, and a list
 * limited to siblings would quietly make it unsayable.
 */
function insideControl(corpus: Corpus, scopeId: string, v: View): string {
  const me = `${scopeId}#${v.id}`;
  const others = corpus.scopes.flatMap((e) =>
    (e.scope.views ?? [])
      .filter((x) => x.exists !== "withdrawn" && `${e.scope.id}#${x.id}` !== me)
      .map((x) => ({ ref: `${e.scope.id}#${x.id}`, title: x.title ?? x.id, scope: e.scope.title || e.scope.id }))
  );
  if (!others.length) return "";
  /** ⛔ Matched on both spellings, because `within` may be a bare view id. */
  const chosen = others.find((o) => o.ref === v.within || o.ref.endsWith(`#${v.within ?? " "}`));
  return `<p class="inside" data-inside="${esc(me)}">
    <label>Appears inside
      <select>
        <option value=""${chosen ? "" : " selected"}>— nothing; this is its own way in</option>
        ${others
          .map(
            (o) =>
              `<option value="${esc(o.ref)}"${chosen && chosen.ref === o.ref ? " selected" : ""}>${line(o.title)} · ${line(o.scope)}</option>`
          )
          .join("")}
      </select>
    </label>
    <span class="status"></span>
  </p>`;
}

function walkInside(walk: Walk, protos: Prototype[], sel: Selection): string {
  if (!walk.steps.size) return "";

  const data = {
    /**
     * ⛔ EVERY PROTOTYPE TRAVELS WITH THE PAGE. The chrome is drawn from layouts in a repository the
     * hosted instance does not have, so it rides in the corpus or it does not exist — the same
     * argument `style.yaml` travels on.
     */
    prototypes: protos.map((p) => ({
      id: p.id,
      title: p.title,
      startsAt: p.starts_at,
      shell: p.shell_html ?? "",
      nav: p.nav ?? [],
    })),
    steps: Object.fromEntries(
      [...walk.steps.entries()].map(([ref, st]) => [
        ref,
        {
          title: st.title,
          scope: st.scopeTitle,
          area: st.areaTitle ?? "",
          holds: st.holds,
          exits: st.exits,
          dangling: st.danglingControls,
          drawn: st.drawn,
        },
      ])
    ),
    entries: walk.entries,
    unreachable: walk.unreachable,
  };

  const doors = walk.entries
    .map(
      (ref) =>
        `<button type="button" class="wdoor" data-walk-to="${esc(ref)}">${line(
          walk.steps.get(ref)!.title
        )}<span class="wdoor-m">${line(walk.steps.get(ref)!.areaTitle ?? walk.steps.get(ref)!.scopeTitle)}</span></button>`
    )
    .join("");

  const stranded = walk.unreachable.length
    ? `<p class="wnote">⚠ ${walk.unreachable.length} screen${walk.unreachable.length === 1 ? " has" : "s have"} no way in — nothing holds ${
        walk.unreachable.length === 1 ? "it" : "them"
      } and no control leads there: ${walk.unreachable
        .slice(0, 6)
        .map((r) => line(walk.steps.get(r)?.title ?? r))
        .join(", ")}${walk.unreachable.length > 6 ? `, and ${walk.unreachable.length - 6} more` : ""}</p>`
    : "";

  return `<script type="application/json" id="walk-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
    <p class="lede">The product as one thing, walked from what the truth says. <strong>Inside</strong> is a screen shown within this one; <strong>goes to</strong> is a control the truth says leads somewhere.</p>
    ${selectionAtTheRoot(sel)}
    <div class="wbar"><span class="wwhere" id="walk-where"></span><button type="button" class="wback" id="walk-back" hidden>◀ back</button></div>
    <div class="wrap-walk">
      <div class="wstage" id="walk-stage"></div>
      <aside class="wside">
        <div class="wgroup" id="walk-holds" hidden><h4>Inside this screen</h4><div class="wmoves"></div></div>
        <div class="wgroup" id="walk-exits" hidden><h4>Goes to</h4><div class="wmoves"></div></div>
        <div class="wgroup" id="walk-dangling" hidden><h4>Leads nowhere yet</h4><div class="wmoves"></div></div>
      </aside>
    </div>
    <div class="wdoors"><h4>Start somewhere else</h4>${doors}</div>
    ${stranded}`;
}

function renderPrototype(screens: ProtoScreen[], promises: ProtoPromise[], walk?: Walk, protos?: Prototype[], sel?: Selection, served?: boolean): string {
  if (!screens.length && !promises.length) return "";

  /**
   * ⛔ A BOARD OF RENDERED SCREENS, NOT A LIST WITH A PREVIEW.
   *
   * The first version was a list down the left, one screen at a time in the middle, truths on the
   * right. Peter opened it: *"I don't see a single rendering when I click the screens. just a list
   * of screens? wtf? It's ONLY supposed to be screens. like the whole project as a prototype
   * here"*, and then: *"the entire complaint I had is that this is not VISUAL enough — this feature
   * serves to RESOLVE that."*
   *
   * Two things were wrong and both came from the same mistake. The three-column grid left the
   * screen 198 pixels wide at an ordinary window size, and corpus order put a screen with NO
   * picture first, so the one pane that mattered opened empty. A surface whose whole job is being
   * visual cannot spend its width on navigation.
   *
   * So: every screen rendered, at once, tiled. The product as a board. Pressing one opens it big.
   */
  const withPictures = screens.filter((s) => s.html);
  const without = screens.filter((s) => !s.html);

  const tile = (s: ProtoScreen): string => `<figure class="ptile" data-proto="${esc(s.scope + "#" + s.view)}">
      <div class="ptile-glass"><div class="ptile-scale"><div class="proto-mock" ${served ? "data-mock-lazy" : "data-mock"}="${esc(s.scope + "#" + s.view)}"></div></div></div>
      <figcaption>
        <span class="pp-t">${line(s.title)}</span>
        <span class="pp-m">${line(s.scopeTitle)} · ${s.says.length} behaviour${s.says.length === 1 ? "" : "s"}${
          s.from === "the truth" ? ' · <span class="quiet">not built</span>' : ""
        }</span>
      </figcaption>
    </figure>`;

  /** ⛔ Named, not hidden: a screen with no picture is the gap this surface exists to make obvious. */
  const blanks = without.length
    ? `<section class="pnone">
        <h3>${without.length} screen${without.length === 1 ? " has" : "s have"} no picture yet</h3>
        <ul>${without
          .map(
            (s) => `<li><span class="pp-t">${line(s.title)}</span> <span class="pp-m">${line(s.scopeTitle)} — ${
              s.parts.length ? "nothing renders it and nothing has generated it" : "declares no controls, so there is nothing to place"
            }</span></li>`
          )
          .join("")}</ul>
      </section>`
    : "";

  const unseen = promises.length
    ? `<section class="pnone">
        <h3>Nothing renders these</h3>
        <p class="lede">Promises the screens rest on — not screens, and the highest altitude here.</p>
        <ul>${promises
          .map(
            (p) => `<li><span class="pp-t">${line(p.title)}</span> <span class="pp-m">${p.said} statement${
              p.said === 1 ? "" : "s"
            }${p.restsUnder.length ? ` · rests under ${p.restsUnder.map((r) => line(r)).join(", ")}` : ""}</span></li>`
          )
          .join("")}</ul>
      </section>`
    : "";

  const index: Record<string, Array<{ part?: string; slot: string; text: string }>> = {};
  for (const sc of screens)
    index[`${sc.scope}#${sc.view}`] = sc.says.map((y) => ({ part: y.part, slot: y.slot, text: y.text }));
  const titles: Record<string, string> = {};
  for (const sc of screens) titles[`${sc.scope}#${sc.view}`] = sc.title;

  return `<script type="application/json" id="proto-says">${JSON.stringify(index).replace(/</g, "\\u003c")}</script>
  <script type="application/json" id="proto-titles">${JSON.stringify(titles).replace(/</g, "\\u003c")}</script>
  <section class="view" id="view-prototype" data-view="prototype" data-ref="prototype" data-label="Prototype">
    ${walk ? walkInside(walk, protos ?? [], sel ?? { axes: [], at: [], options: [], lands: undefined }) : ""}
    <!--
      ⛔ ONE PROTOTYPE, NOT TWO TABS.

      The walk shipped beside the board as its own tab, with a comment here arguing they answered
      different questions. Peter: *"why does 'prototype' exist if it was replaced with 'walk'? how
      does that make sense?"* — and he had asked for *"a central 'prototype only' section where they
      can drive through the product as a whole"*, singular, in the message that started this. Two
      top-level tabs covering the same ground is the reviewer doing the reconciling.

      The board's one real strength — a whole product's screens in a glance — is kept, one fold
      down, where it costs nobody a decision about which tab to open.
    -->
    <details class="pall">
      <summary>All ${withPictures.length} screen${withPictures.length === 1 ? "" : "s"} at once</summary>
      <p class="lede">Every screen of this product, as it looks. Open one to press its controls and read what the truth says about each.</p>
      <div class="pboard">${withPictures.map(tile).join("")}</div>
      ${blanks}
      ${unseen}
    </details>
    <div class="pbig" hidden>
      <div class="pbig-bar"><strong class="pbig-t"></strong><span class="pbig-esc">Esc, or click outside</span><button type="button" class="pbig-x">Close</button></div>
      <div class="pbig-body"><div class="pbig-stage"></div><aside class="pbig-truth"><p class="none">Press a control on the screen.</p></aside></div>
    </div>
  </section>`;
}
