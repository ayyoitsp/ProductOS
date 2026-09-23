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
import { SLOTS, SLOT_ASKS_SHORT, type SlotName, type Scope } from "./schema.js";
import { gridFor, gateFor, actsFor, type Grid, type Cell } from "./grid.js";
import { questionsFor, descendants, type Question } from "./settle.js";
import { decisionsOn, decisionsUnder, howItWasDecided, type Decision } from "./record.js";

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** One line of prose, with the corpus's soft line wrapping flattened out. */
const line = (s: unknown): string => esc(String(s ?? "").replace(/\s+/g, " ").trim());

/**
 * A ref as an anchor. ⛔ One function, because a link and its target computing the slug
 * separately is how a nav that looks complete 404s on a third of its rows.
 */
const slug = (ref: string): string => ref.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
const anchorOf = (ref: string): string => `at-${slug(ref)}`;

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
  records?: "http" | "db";
}

/**
 * A ref as a link, or as plain text when it cannot resolve from here.
 *
 * ⛔ A NAV ROW THAT DOES NOTHING IS WORSE THAN PROSE — it reads as *already checked that*. v1
 * shipped nav links to pages that 404ed and `CLAUDE.md` calls it out by name, so the rule here
 * is mechanical: a cross-scope target needs a `base`, and without one the ref renders as text.
 */
function refLink(ref: string, ctx: Ctx, label?: string): string {
  const text = label ?? ref;
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
  if (within) {
    return ctx.anchors.has(ref)
      ? `<a href="#${anchorOf(ref)}">${esc(text)}</a>`
      : `<span class="unlinked" title="nothing on this page answers that directly">${esc(text)}</span>`;
  }
  if (!ctx.base) return `<span class="unlinked" title="filed under ${esc(scope)}, which this page does not contain">${esc(text)}</span>`;
  return `<a href="${esc(ctx.base)}/${esc(scope)}#${anchorOf(ref)}">${esc(text)}</a>`;
}

// ---------------------------------------------------------------------------
// The questions — the reviewer's actual work, so they come first.

interface Ctx {
  base?: string;
  here: string[];
  /** Every ref this render will emit an anchor for. */
  anchors: Set<string>;
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
            <button class="act" data-act="rule" data-ref="${esc(q.ref)}" data-pick="${n + 1}" data-q="${id}">
              This one
            </button>
          </div>
        </div>`;
    })
    .join("");

  if (q.revises)
    acts.push(`
      <div class="revises">
        <p class="k">it already says</p>
        <p class="v">${line(q.revises)}</p>
        <p class="k">and this much of it is unruled</p>
        <p class="v">${line(q.about)}</p>
        <p class="note">A ruling here replaces the whole sentence, so it has to be written rather than picked.</p>
      </div>`);

  return `
    <article class="q${q.parked ? " parked" : ""}" id="${anchorOf(q.ref)}">
      <header>
        <span class="ref">${esc(q.ref)}</span>
        <span class="kind">${esc(q.kind)}</span>
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
              q.ref.includes("#")
                ? refLink(`${q.scope}#${q.exchange}`, ctx, q.exchangeTitle)
                : line(q.exchangeTitle)
            } · ${esc(SLOT_LABEL[q.slot] ?? q.slot)}</p>`
          : ""
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
            }: ${q.blocks.map((b) => `<code>${refLink(b, ctx)}</code>`).join(" ")}</p>`
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
      ${renderRecord(past)}
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
function renderScreens(scope: Scope, ctx: Ctx, scopeId: string): string {
  const shown = scope.views.filter((v) => v.exists !== "withdrawn");
  if (!shown.length) return "";
  return `
    <section class="screens">
      <h3 class="sub">Where these arrive</h3>
      ${shown
        .map(
          (v) => `<article class="screen">
            <h4>${line(v.title)}${v.view_kind ? ` <span class="n">${esc(v.view_kind)}</span>` : ""}</h4>
            ${
              v.exists === "intended"
                ? `<p class="owes">This screen does not exist yet — everything here is intent, not observation.</p>`
                : ""
            }
            ${!v.walked ? `<p class="owes">Nobody has walked this screen, so what it holds is unconfirmed.</p>` : ""}
            ${v.sketch ? `<pre class="sketch">${esc(v.sketch.trimEnd())}</pre>` : ""}
            ${
              v.parts.length
                ? `<ul class="parts">${v.parts
                    .map((pt) => {
                      const at = `${scopeId}#`;
                      void at;
                      return `<li><span class="role">${esc(pt.role)}</span> ${line(pt.label || pt.id)}${
                        pt.leads_to ? ` <span class="n">→ ${esc(pt.leads_to)}</span>` : ""
                      }</li>`;
                    })
                    .join("")}</ul>`
                : ""
            }
          </article>`
        )
        .join("")}
    </section>`;
}


/**
 * Where to start, when nothing is decided because almost nothing is written.
 *
 * ⛔ ORDERED BY HOW CLOSE EACH FEATURE IS TO FINISHED. A list in corpus order answers "what exists";
 * a reviewer facing 539 blanks is asking "where do I start", and the answer is the feature with the
 * fewest holes — it is the cheapest to finish and the first that becomes agreeable.
 */
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
      <p><strong>And almost none of it is written.</strong> ${written} of ${written + blanks} slots carry a
      sentence; the other ${blanks} say nothing at all. Nothing can be agreed to while a behaviour has a
      slot that says nothing — which is why ${gatedCount} of them are waiting.</p>
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
function renderBehaviours(
  corpus: Corpus,
  scopeId: string,
  cellOf: Map<string, Cell>,
  ctx: Ctx
): string {
  const entry = corpus.scopes.find((s) => s.scope.id === scopeId);
  if (!entry) return "";
  const cards: string[] = [];
  for (const ex of entry.scope.exchanges) {
    const ref = `${scopeId}#${ex.id}`;
    for (const slot of SLOTS) {
      const fill = (ex.slots as Record<string, Record<string, unknown> | undefined>)[slot];
      const cell = cellOf.get(`${ref}#${slot}`);
      // ⛔ Only what somebody has actually said. A blank is an authoring gap, reported in the
      // worklist — it is not a behaviour, and putting it here is what asked a person to fill cells.
      const says = fill?.says
        ? line(fill.says)
        : fill?.none
          ? `<em>nothing to refuse</em>`
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
      const past = decisionsOn(corpus, `${ref}#${slot}`);
      const shows = ex.criteria.filter((c) => c.slot === slot);
      cards.push(`
        <article class="beh" id="${anchorOf(`${ref}#${slot}`)}">
          <p class="beh-says">${says}</p>
          <p class="beh-where">
            ${esc(SLOT_ASKS_SHORT[slot] ?? slot)} · on ${refLink(ref, ctx, ex.title)}${
              ex.at?.part ? ` · <code>${esc(ex.at.part)}</code>` : ""
            }${cell && cell.rule ? ` · from <code>${esc(cell.rule)}</code>` : ""}
          </p>
          ${
            shows.length
              ? `<details class="beh-shows"><summary>${shows.length} thing${
                  shows.length === 1 ? "" : "s"
                } that would show this</summary><ul>${shows
                  .map(
                    (c) =>
                      `<li>${[c.given && `<span class="g">given</span> ${line(c.given)}`, c.when && `<span class="g">when</span> ${line(c.when)}`, c.then && `<span class="g">then</span> ${line(c.then)}`]
                        .filter(Boolean)
                        .join(" ")}</li>`
                  )
                  .join("")}</ul></details>`
              : `<p class="beh-nothing">Nothing here says what would show this working.</p>`
          }
          ${renderRecord(past)}
          ${
            settled
              ? `<footer class="beh-acts">
                   <button class="act" data-act="accept" data-ref="${esc(`${ref}#${slot}`)}">That is right</button>
                   <button class="act ghost" data-act="say" data-ref="${esc(`${ref}#${slot}`)}">Not quite — reword it</button>
                   <button class="act ghost" data-act="waive" data-ref="${esc(`${ref}#${slot}`)}">Not ours to say</button>
                 </footer>`
              : `<p class="owes">Not settled yet — ${esc(standing.replace(/_/g, " "))}. It is in the queue.</p>`
          }
        </article>`);
    }
  }
  if (!cards.length) return "";
  return `<section class="behaviours">
    <h3 class="sub">${cards.length} behaviour${cards.length === 1 ? "" : "s"} to read</h3>
    <p class="what-next">One sentence at a time. Is it right? Reword it if not — your words are what gets recorded.</p>
    ${cards.join("")}
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
          <dt>–</dt><dd>nothing to refuse — or, on <code>after</code>, nothing is different afterwards</dd>
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
                  `<p id="${anchorOf(id)}"><span class="rn">R${g.number.get(id)}</span> <code>${esc(id)}</code>
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
              ? "<em>nothing to refuse</em>"
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
      const criteria = e.criteria
        .map(
          (c) => `
          <li>
            <span class="cslot">${esc(SLOT_LABEL[c.slot as SlotName] ?? c.slot)}</span>
            ${c.given ? `<span class="g">given</span> ${line(c.given)}` : ""}
            ${c.when ? `<span class="g">when</span> ${line(c.when)}` : ""}
            ${c.then ? `<span class="g">then</span> ${line(c.then)}` : ""}
          </li>`
        )
        .join("");
      cards.push(`
        <article class="ex-card" id="${anchorOf(ref)}">
          <header>
            <h3>${line(e.title)}</h3>
            <code>${esc(ref)}</code>
            ${e.asked_by ? `<span class="asked">asked by ${esc(e.asked_by)}</span>` : ""}
          </header>
          <div class="slots">${slots}</div>
          ${renderRecord(decisionsUnder(corpus, ref))}
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
                : `<button class="act primary" data-act="accept" data-ref="${esc(ref)}">I have read this and agree to it</button>`
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
  contains: Set<string>,
  open: number,
  aboutLabel: string,
  charterTabs: string
): string {
  const kids = (parent?: string) => corpus.scopes.filter((s) => s.scope.in === parent);
  const rows: string[] = [];
  const walk = (parent: string | undefined, depth: number): void => {
    for (const { scope } of kids(parent)) {
      /**
       * ⛔ THE ROOT IS NOT A ROW. It is the Overview tab, and listing it again at the head of both
       * trees gave every half a first entry that jumped to the other tab — the one place the tree is
       * not for.
       */
      if (!scope.in) {
        walk(scope.id, depth);
        continue;
      }
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
      const own = qs.filter((q) => !q.parked && q.ref.includes("#"));
      const orgWide = qs.filter((q) => !q.parked && !q.ref.includes("#")).length;
      const here_open = own.length;
      const a = actsFor(corpus);
      const ids = descendants(corpus, scope.id);
      const ready = a.acceptable.filter((r) => ids.some((i) => r.startsWith(`${i}#`))).length;
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
      const name =
        scope.id === here
          ? `<strong>${label}</strong>`
          : holdsIt
            ? `<a href="#${anchorOf(scope.id)}" data-goto="${esc(scope.id)}">${label}</a>`
            : base
              ? `<a href="${esc(base)}/${esc(scope.id)}">${label}</a>`
              : `<span class="unlinked" title="not on this page">${label}</span>`;
      rows.push(
        `<li style="--d:${depth}">${name}` +
          (here_open ? ` <span class="n warn">${here_open} to decide</span>` : "") +
          (ready ? ` <span class="n ok">${ready} to agree to</span>` : "") +
          (!here_open && !ready && !orgWide ? ` <span class="n">—</span>` : "") +
          (!here_open && orgWide ? ` <span class="n">waiting on the shared questions</span>` : "") +
          `</li>`
      );
      walk(scope.id, depth + 1);
    }
  };
  walk(undefined, 0);
  if (rows.length < 2) return "";
  /**
   * ⛔ THE TRAIL IS BUILT WHERE THE TREE IS, from the same `in:` chain the rows are indented by.
   * Computing it again in the browser would be a second answer to "where am I", and the two would
   * drift the first time a scope moved.
   */
  const labelOf = (id: string) => line(corpus.scopes.find((x) => x.scope.id === id)?.scope.title || id);
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
  /**
   * ⛔ EVERY LEVEL IS SOMEWHERE YOU CAN STAND, so every crumb carries the id it navigates to. With
   * labels alone the ancestors were decoration: "Deals" sat above "The deals list" in the trail and
   * in the tree and did nothing in either, which is a link that failed as far as a reader can tell.
   */
  const trails: Record<string, Array<{ id: string; label: string }>> = {
    overview: [{ id: "overview", label: "Overview" }],
  };
  /**
   * ⛔ THE ROOT IS NOT A CRUMB. It is the Overview tab, so repeating it at the head of every trail
   * spent the widest part of the line on the one place the tab row already names — and read as a
   * level you could go up to that was in fact a different tab.
   */
  for (const { scope } of corpus.scopes) {
    const t = trail(scope.id);
    trails[scope.id] = t.length > 1 ? t.slice(1) : t;
  }
  /**
   * ⛔ THE TOP LEVEL IS A ROW OF TABS, NOT A ROW INSIDE A DROPDOWN.
   *
   * The two halves of a product — what it states a person, and the machinery underneath — are the
   * one split a reader navigates by constantly, and burying them at depth 1 of a collapsed tree put
   * the most-used move behind two presses and a scan. They sit side by side; the tree is for going
   * deeper, which is the thing a tree is good at.
   */
  const rootId = corpus.scopes.find((x) => !x.scope.in)?.scope.id;
  const sections: Array<{ id: string; label: string }> = [
    { id: "overview", label: "Overview" },
    /**
     * ⛔ WHAT A PERSON SEES, THEN THE MACHINERY UNDERNEATH. File order put the subsystems first,
     * which is backwards for every reader: the behaviours are the product, and the machinery is what
     * they rest on. Ordered by whether anything beneath the section has a screen, so it holds
     * whatever the corpus is called rather than a list of names to keep updated.
     */
    ...corpus.scopes
      .filter((x) => x.scope.in === rootId)
      .map((x) => {
        const under = descendants(corpus, x.scope.id);
        const screens = under.reduce(
          (n, d) => n + (corpus.scopes.find((y) => y.scope.id === d)?.scope.views.length ?? 0),
          0
        );
        return { id: x.scope.id, label: line(x.scope.title || x.scope.id), screens };
      })
      .sort((a, b) => b.screens - a.screens)
      .map(({ id, label }) => ({ id, label })),
  ];
  /** view → the tab it lives under, so the row can show where you are without being told. */
  const sectionOf: Record<string, string> = { overview: "overview" };
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
  return (
    /**
     * ⛔ DOUBLE-QUOTED, because `esc` escapes `"` and not `'` — and a single-quoted attribute holding
     * JSON is one apostrophe away from being cut in half.
     *
     * It was cut in half: "Resolve an organization's stages" ended the attribute early, `JSON.parse`
     * threw, and every breadcrumb silently fell back to a bare scope id. Nothing errored — the trail
     * just quietly stopped knowing where anything was.
     */
    `<div class="topframe" data-trails="${esc(JSON.stringify(trails))}" data-sections="${esc(JSON.stringify(sectionOf))}">` +
    `<div class="tabs">${sections
      .map(
        (t) =>
          `<button type="button" class="tab" data-tab="${esc(t.id)}">${t.label}${
            t.id === "overview" && open ? ` <span class="pill">${open}</span>` : ""
          }</button>`
      )
      .join("")}</div>` +
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
    `<div class="subtabs" hidden><button type="button" class="subtab" data-sub="queue">Queue${
      open ? ` <span class="pill">${open}</span>` : ""
    }</button><button type="button" class="subtab" data-sub="about">${aboutLabel}</button>${charterTabs}</div>` +
    /**
     * ⛔ THE TRAIL NAVIGATES; THE CHEVRON EXPANDS. One control doing both meant every attempt to go
     * up a level dropped the whole tree on you instead, which is the opposite of what a breadcrumb
     * is for.
     */
    `<div class="crumbs"><span class="trail"></span>` +
    `<button type="button" class="chev" aria-expanded="false" aria-label="Show every feature">▾</button></div>` +
    `<nav class="scopes"><ul>${rows.join("")}</ul></nav>` +
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
  const entry = corpus.scopes.find((s) => s.scope.id === scopeId);
  if (!entry) return null;
  const ids = descendants(corpus, scopeId);
  /**
   * ⛔ ONE GRID PER SCOPE THAT HAS PROMISES. `gridFor` reads one scope's own exchanges, and
   * a container has none — so a single call for the named scope rendered an empty grid
   * reading `0 exchanges · 0 blank` directly above cards for every behaviour underneath it.
   * Containers nest without limit, so this has to be the whole subtree or it is a lie about
   * the commonest shape in the model.
   */
  const grids = ids
    .map((id) => gridFor(corpus, id))
    .filter((x): x is Grid => !!x && x.rows.length > 0);
  const cellOf = new Map<string, Cell>();
  for (const g of grids)
    for (const r of g.rows) for (const s of SLOTS) cellOf.set(`${g.scope}#${r.exchange}#${s}`, r.cells[s]);
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
  const agreed = corpus.verdicts.filter((v) => v.kind === "accept" && under(v.target ?? "")).length;
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
         <ul>${corpus.broken.map((b) => `<li>${esc(b.why.split("\n")[0])}</li>`).join("")}</ul>
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
  const containerViews = ids.filter(
    (id) =>
      (corpus.scopes.find((s) => s.scope.id === id)?.scope.exchanges.length ?? 0) === 0 &&
      // ⛔ Not the scope this page is rooted at — that is Overview, and giving it a container view
      // too rendered its description twice under two headings.
      id !== scopeId
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
  const ctx: Ctx = { base: opts.linkBase, here: ids, anchors };
  const body = `
    ${renderNav(
      corpus,
      scopeId,
      opts.linkBase,
      viewed,
      live.length,
      line(entry.scope.title || scopeId),
      corpus.charter
        .map((c) => `<button type="button" class="subtab" data-sub="${esc(c.charter.id)}">${line(c.charter.title)}</button>`)
        .join("")
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
        `<section class="view" id="view-overview" data-view="overview">
           <div class="sub-view" data-sub-view="queue">
             ${
               live.length
                 ? `<p class="lede"><strong>${live.length}</strong> question${live.length === 1 ? "" : "s"} nobody has answered. Each reaches every behaviour its selector touches, and every one written after it.</p>
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
                            agreed
                              ? `<strong>${agreed}</strong> of ${agreed + gated.length} behaviours have been agreed to. `
                              : `<strong>Nothing here has been agreed to yet.</strong> `
                          }${
                            gated.length
                              ? `The other ${gated.length} cannot be, until these ${live.length === 1 ? "is" : "are"} answered — every one of them has a slot waiting on ${live.length === 1 ? "it" : "them"}.`
                              : ""
                          }</p>`
                        : ""
                    }
                    ${live.map((q, i) => renderQuestion(q, i, decisionsOn(corpus, q.ref), ctx)).join("")}`
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
                    }`
             }
           </div>
           <div class="sub-view" data-sub-view="about">
             <h2>${line(entry.scope.title || scopeId)}</h2>
             ${renderProse(entry.body)}
           </div>
           ${corpus.charter
             .map(
               (c) => `<div class="sub-view" data-sub-view="${esc(c.charter.id)}">
                 <h2>${line(c.charter.title)}</h2>
                 ${renderProse(c.body)}
                 ${c.charter.sections
                   .map(
                     (sec) => `<article class="charter-section" id="${anchorOf(`${c.charter.id}#${sec.id}`)}">
                       <h3>${line(sec.title)}</h3>
                       ${renderProse(sec.says)}
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
          (g) => `<section class="view" id="${anchorOf(g.scope)}" data-view="${esc(g.scope)}">
            <h2>${line(g.title)}</h2>
            ${renderProse(corpus.scopes.find((x) => x.scope.id === g.scope)?.body ?? "")}
            ${renderBehaviours(corpus, g.scope, cellOf, ctx)}
            ${renderScreens(corpus.scopes.find((x) => x.scope.id === g.scope)!.scope, ctx, g.scope)}
            <details class="fold"><summary>Every slot, and where each came from — the authoring view</summary>
              ${renderGrid(g, ctx)}
              ${renderExchanges(corpus, [g.scope], cellOf, ctx, false)}
            </details>
          </section>`
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
            return `<section class="view" id="${anchorOf(id)}" data-view="${esc(id)}">
              <h2>${line(sc.title || id)}</h2>
              ${renderProse(corpus.scopes.find((x) => x.scope.id === id)?.body ?? "")}
              <h3 class="sub">What is filed under it</h3>
              <ul class="contents">${kids
                .map((k) => {
                  const under = descendants(corpus, k.scope.id);
                  const behaviours = under.reduce(
                    (n, d) => n + (corpus.scopes.find((x) => x.scope.id === d)?.scope.exchanges.length ?? 0),
                    0
                  );
                  const ready = a.acceptable.filter((r: string) => under.some((u) => r.startsWith(`${u}#`))).length;
                  return `<li><a href="#${anchorOf(k.scope.id)}" data-goto="${esc(k.scope.id)}">${line(
                    k.scope.title || k.scope.id
                  )}</a> <span class="n">${behaviours} behaviour${behaviours === 1 ? "" : "s"}${
                    ready ? ` · ${ready} ready to agree to` : ""
                  }</span></li>`;
                })
                .join("")}</ul>
              ${kids.length ? "" : `<p class="lede">Nothing is filed under this yet.</p>`}
            </section>`;
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

  return `${STYLE}${body}${VIEW_SWITCH}${opts.interactive ? liveScript(opts) : INERT}`;
}


/**
 * ⛔ WHAT EACH ACT OWES, IN ONE TABLE, SHARED BY EVERY SURFACE THAT ASKS FOR IT.
 *
 * The floors live on the `Verdict` schema and are charged there; this is only what to ask for,
 * so a person is never refused for a field no surface offered them. That exact dead end happened
 * twice on the CLI — a refusal printing a remedy the tool then rejected.
 */
const OWED: Record<string, Array<{ name: string; label: string; floor?: number; long?: boolean }>> = {
  accept: [],
  rule: [{ name: "because", label: "Why — this is what stops it being argued again", floor: 40, long: true }],
  say: [
    { name: "says", label: "What it is, now decided", floor: 10, long: true },
    { name: "because", label: "Why — this is what stops it being argued again", floor: 40, long: true },
  ],
  waive: [{ name: "because", label: "Why this is not yours to answer — a builder is about to be told it is theirs", floor: 40, long: true }],
  defer: [
    { name: "because", label: "Why not now", long: true },
    { name: "until", label: "What brings it back — an event, not a date" },
  ],
};

function liveScript(opts: PageOptions): string {
  const mode = opts.records ?? "http";
  return `<script>
const OWED = ${JSON.stringify(OWED)};
const BY = ${JSON.stringify(opts.by ?? "")};
const MODE = ${JSON.stringify(mode)};

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
      const res = await fetch("/api/v2/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || body.ok === false) {
        status.innerHTML = "<strong>Not recorded.</strong> " + (body.why || res.statusText) +
          (body.detail && body.detail.length ? "<br>" + body.detail.join("<br>") : "");
        status.classList.add("bad");
        return;
      }
      status.textContent = body.said || "recorded";
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
  } catch (e) {
    status.textContent = "Not recorded: " + (e && e.message ? e.message : String(e));
    status.classList.add("bad");
  }
}

document.addEventListener("click", (ev) => {
  const b = ev.target.closest("button.act");
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  const ref = b.dataset.ref;
  const fields = OWED[act] || [];
  const host = b.closest(".opt-body") || b.closest("footer") || b.parentElement;
  if (host.querySelector("form.act-form")) { host.querySelector("form.act-form").remove(); return; }

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
const VIEW_SWITCH = `<script>
(function () {
  const views = [...document.querySelectorAll("section.view")];
  if (views.length < 2) return;
  const menu = [...document.querySelectorAll("nav.scopes a[data-goto]")];
  const frame = document.querySelector(".topframe");
  const crumbs = frame && frame.querySelector(".crumbs");
  const trail = frame && frame.querySelector(".trail");
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
    tree.hidden = !open;
    const c = frame.querySelector(".chev");
    if (c) c.setAttribute("aria-expanded", String(open));
    frame.classList.toggle("open", open);
  };

  const show = (name, collapse) => {
    let found = false;
    for (const v of views) {
      const mine = v.dataset.view === name;
      v.hidden = !mine;
      found = found || mine;
    }
    if (!found) { for (const v of views) v.hidden = false; return; }
    for (const a of menu) a.classList.toggle("on", a.dataset.goto === name);
    if (trail) {
      const parts = trails[name] || [{ id: name, label: name }];
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
    const cr = document.querySelector(".topframe .crumbs");
    if (sm) sm.hidden = section !== "overview";
    if (cr) cr.hidden = section === "overview";
    if (collapse || section === "overview") setOpen(false);
    try { history.replaceState(null, "", "#" + (name === "overview" ? "view-overview" : "at-" + name)); } catch {}
  };

  const chev = frame && frame.querySelector(".chev");
  if (chev) chev.addEventListener("click", () => setOpen(tree.hidden));

  let sectionOf = {};
  try { sectionOf = JSON.parse(frame.dataset.sections); } catch {}
  const tabs = [...document.querySelectorAll(".topframe .tab")];
  for (const t of tabs) t.addEventListener("click", () => { show(t.dataset.tab, true); window.scrollTo(0, 0); });
  /**
   * ⛔ The tree shows only the half you are in. Every scope in both halves at once is the wall the
   * tabs exist to remove, and a reader who has chosen a side has said which one they mean.
   */
  const scopeTree = (section) => {
    for (const li of tree ? tree.querySelectorAll("li") : []) {
      const a = li.querySelector("a[data-goto]") || li.querySelector("[data-goto]");
      const id = a && a.dataset.goto;
      /**
       * ⛔ A ROW THE FILTER CANNOT IDENTIFY IS HIDDEN, NOT KEPT.
       *
       * Defaulting to visible meant every row without a usable link survived every filter — so
       * choosing the product half still showed the machinery, while the machinery half looked
       * correct and hid the bug. An unidentifiable row is exactly the one there is no reason to
       * trust.
       */
      li.hidden = section === "overview" || !id || sectionOf[id] !== section;
    }
  };
  // ⛔ No per-row binding: the delegated handler above covers the menu, the crumbs and a
  // container's contents alike. Two handlers on one click is how a toggle fires twice.
  // ⛔ Escape closes it, because a tree covering the page with no visible way out is a trap.
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  // ⛔ An anchor from elsewhere on the page — "decide it", a grid row, a blocks ref — must bring its
  // view with it, or following a link inside a hidden section does nothing at all.
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    /**
     * ⛔ A data-goto ANYWHERE IS HONOURED, not only inside the menu.
     *
     * The menu bound its own rows and this handler skipped anything carrying it, so a
     * container's contents list — the only thing a container view has to offer — did nothing: the
     * entry highlighted and the page stayed exactly where it was.
     */
    if (a.dataset.goto) {
      e.preventDefault();
      show(a.dataset.goto, true);
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
  const subs = [...document.querySelectorAll(".subtab")];
  const subViews = [...document.querySelectorAll(".sub-view")];
  const showSub = (name) => {
    for (const v of subViews) v.hidden = v.dataset.subView !== name;
    for (const t of subs) t.classList.toggle("on", t.dataset.sub === name);
  };
  for (const t of subs) t.addEventListener("click", () => { showSub(t.dataset.sub); window.scrollTo(0, 0); });
  if (subs.length) showSub(subs[0].dataset.sub);

  const opening = location.hash.replace(/^#/, "");
  const fromHash = opening === "view-overview" ? "overview" : views.find((v) => v.id === opening)?.dataset.view;
  // Opening on a named view means somebody linked to it: collapse. Opening cold: leave it open.
  // ⛔ Opens on Overview: what the product is, and what it owes. Landing in a feature's grid with
  // no idea what the product is was the shape this replaced.
  show(fromHash || "overview", true);
})();
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

const STYLE = `<style>
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
  main { max-width: 52rem; margin: 0 auto; padding: 2.5rem 1.25rem 6rem; }
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
  .q .ref { font-family: ui-monospace, Menlo, monospace; }
  .q .kind { border: 1px solid var(--line); border-radius: 99px; padding: .05rem .5rem; }
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
  .revises .note { color: var(--dim); font-size: .85rem; margin: .5rem 0 0; }
  .observed ul { margin: .3rem 0 0; padding-left: 1.1rem; }
  .observed .basis { color: var(--dim); font-size: .85em; }
  .blocks { font-size: .9rem; color: var(--dim); }
  .owes { font-size: .88rem; color: var(--warn); background: var(--warn-bg);
    border-radius: 6px; padding: .5rem .7rem; }
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
  nav.scopes li { padding: .3rem 0 .3rem calc(var(--d) * 1.1rem); border-bottom: 1px solid var(--line);
    display: flex; gap: .6rem; align-items: baseline; flex-wrap: wrap; }
  nav.scopes .n { font-size: .78rem; color: var(--dim); }
  nav.scopes .n.warn { color: var(--warn); }
  nav.scopes .n.ok { color: var(--ok); }
  nav.scopes .grouping { color: var(--dim); }
  nav.scopes li.jump { border-bottom: 1px solid var(--line); padding-bottom: .45rem; margin-bottom: .2rem; }
  nav.scopes li.jump a { font-weight: 600; }
  nav.scopes a.on { font-weight: 700; text-decoration: none; }
  nav.scopes a.on::before { content: "▸ "; color: var(--accent); }
  .topframe { position: sticky; top: 0; z-index: 8; background: var(--bg);
    border-bottom: 1px solid var(--line); }
  .topframe .tabs { display: flex; gap: .15rem; max-width: 52rem; margin: 0 auto;
    padding: .55rem 1.25rem 0; }
  .topframe .tab { font: inherit; font-size: .92rem; background: none; border: 0;
    border-bottom: 2px solid transparent; color: var(--dim); cursor: pointer;
    padding: .4rem .7rem; border-radius: 4px 4px 0 0; }
  .topframe .tab:hover { color: var(--ink); }
  .topframe .tab.on { color: var(--ink); font-weight: 600; border-bottom-color: var(--accent); }
  .topframe .subtabs { display: flex; gap: .15rem; flex-wrap: wrap; max-width: 52rem;
    margin: 0 auto; padding: .35rem 1.25rem .5rem; border-top: 1px solid var(--line); }
  .subtab { font: inherit; font-size: .88rem; background: none; border: 0; cursor: pointer;
    color: var(--dim); padding: .35rem .6rem; border-bottom: 2px solid transparent; }
  .subtab:hover { color: var(--ink); }
  .subtab.on { color: var(--ink); font-weight: 600; border-bottom-color: var(--accent); }
  .subtab .pill, .topframe .tab .pill { font-size: .72rem; background: var(--warn); color: var(--bg);
    border-radius: 99px; padding: .05rem .4rem; margin-left: .25rem; vertical-align: .05em; }
  .topframe .crumbs { display: flex; gap: .5rem; align-items: center; width: 100%;
    max-width: 52rem; margin: 0 auto; padding: .45rem 1.25rem .6rem;
    border-top: 1px solid var(--line); background: none; border: 0;
    font: inherit; font-size: .9rem; color: var(--ink); cursor: pointer; text-align: left; }
  .topframe .trail { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .topframe .trail .up { color: var(--dim); }
  .topframe .trail .at { font-weight: 600; }
  .topframe .trail .sep { color: var(--dim); margin: 0 .4rem; }
  .topframe .trail a.up { color: var(--dim); text-decoration: none; }
  .topframe .trail a.up:hover { color: var(--accent); text-decoration: underline; }
  .topframe .chev { background: none; border: 1px solid var(--line); border-radius: 6px;
    color: var(--dim); cursor: pointer; font: inherit; line-height: 1; padding: .25rem .5rem;
    transition: transform .12s ease; }
  .topframe .chev:hover { color: var(--ink); border-color: var(--accent); }
  .topframe.open .chev { transform: rotate(180deg); }
  .prose { margin: .6rem 0 1.4rem; max-width: 42rem; }
  .prose p { margin: .6rem 0; }
  h3.sub { font-size: .8rem; text-transform: uppercase; letter-spacing: .07em; color: var(--dim);
    margin: 1.6rem 0 0; font-weight: 600; }
  .behaviours { margin: .5rem 0 2rem; }
  .beh { background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 1.1rem 1.25rem; margin: 0 0 .9rem; }
  .beh-says { font-size: 1.05rem; line-height: 1.5; margin: 0 0 .5rem; }
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
  .gate-note { background: var(--warn-bg); border-left: 3px solid var(--warn); border-radius: 0 6px 6px 0;
    padding: .7rem .9rem; margin: .9rem 0 1.4rem; font-size: .92rem; }
  .charter-section { border-top: 1px solid var(--line); padding-top: 1rem; margin-top: 1.4rem; }
  .charter-section h3 { font-size: 1.1rem; margin: 0 0 .3rem; }
  ul.contents { list-style: none; margin: 1rem 0 0; padding: 0; }
  ul.contents li { padding: .7rem 0; border-bottom: 1px solid var(--line);
    display: flex; gap: .7rem; align-items: baseline; flex-wrap: wrap; }
  ul.contents a { font-size: 1.05rem; }
  ul.contents .n { font-size: .82rem; color: var(--dim); }
  .topframe nav.scopes { max-width: 52rem; margin: 0 auto; padding: 0 1.25rem 1rem;
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
  .g { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: var(--dim); margin: 0 .25rem; }
  .ex-card footer { margin-top: 1.1rem; padding-top: .9rem; border-top: 1px solid var(--line); }
  .gated { font-size: .9rem; }
  .gated ul { margin: .3rem 0 0; padding-left: 1.1rem; color: var(--warn); }
  .parked-set { opacity: .9; }
  @media (max-width: 34rem) {
    .slot { grid-template-columns: 1fr; gap: .1rem; }
    .opt { grid-template-columns: 1fr; }
    .legend dl { grid-template-columns: 2.5rem 1fr; }
  }
</style>`;
