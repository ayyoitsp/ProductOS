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
import { SLOTS, type SlotName } from "./schema.js";
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

// ---------------------------------------------------------------------------
// The grid — what this scope promises, and where each promise came from.

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
      <h2>What ${line(g.title)} promises</h2>
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

function renderExchanges(corpus: Corpus, scopeIds: string[], cellOf: Map<string, Cell>, ctx: Ctx): string {
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
  return cards.length ? `<section class="exchanges"><h2>Every promise, in full</h2>${cards.join("")}</section>` : "";
}

/**
 * Every scope, as a tree, with how much work each one is holding.
 *
 * ⛔ THE COUNTS ARE ON THE NAV, because "which feature do I look at next" is the first question
 * a reviewer has and no surface answered it. A list of names makes them open each one to find
 * out whether there is anything to do.
 */
function renderNav(corpus: Corpus, here: string, base: string | undefined): string {
  const kids = (parent?: string) => corpus.scopes.filter((s) => s.scope.in === parent);
  const rows: string[] = [];
  const walk = (parent: string | undefined, depth: number): void => {
    for (const { scope } of kids(parent)) {
      const qs = questionsFor(corpus, scope.id);
      const open = qs.filter((q) => !q.parked).length;
      const a = actsFor(corpus);
      const ids = descendants(corpus, scope.id);
      const ready = a.acceptable.filter((r) => ids.some((i) => r.startsWith(`${i}#`))).length;
      const label = line(scope.title || scope.id);
      // ⛔ The current scope is never a link to itself — a nav row that reloads the page you are
      // on is indistinguishable from one that is broken.
      const name =
        scope.id === here
          ? `<strong>${label}</strong>`
          : base
            ? `<a href="${esc(base)}/${esc(scope.id)}">${label}</a>`
            : `<span class="unlinked">${label}</span>`;
      rows.push(
        `<li style="--d:${depth}">${name}` +
          (open ? ` <span class="n warn">${open} to decide</span>` : "") +
          (ready ? ` <span class="n ok">${ready} to agree to</span>` : "") +
          (!open && !ready ? ` <span class="n">—</span>` : "") +
          `</li>`
      );
      walk(scope.id, depth + 1);
    }
  };
  walk(undefined, 0);
  return rows.length > 1 ? `<nav class="scopes"><ul>${rows.join("")}</ul></nav>` : "";
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
   * reading `0 exchanges · 0 blank` directly above cards for every promise underneath it.
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
  const mine = (refs: string[]) => refs.filter((r) => ids.some((i) => r.startsWith(`${i}#`)));
  const acceptable = mine(a.acceptable);
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
  const anchors = new Set<string>([
    ...qs.map((q) => q.ref),
    ...ids.flatMap((sid) => {
      const sc = corpus.scopes.find((s) => s.scope.id === sid);
      return (sc?.scope.exchanges ?? []).map((e) => `${sid}#${e.id}`);
    }),
    ...grids.flatMap((g) => [...g.rulesUsed.keys()]),
  ]);
  const ctx: Ctx = { base: opts.linkBase, here: ids, anchors };
  const title = line(entry.scope.title || scopeId);
  const body = `
    <main>
      <header class="top">
        <h1>${title}</h1>
        <p class="lede">${
          live.length
            ? `<strong>${live.length}</strong> thing${live.length === 1 ? "" : "s"} here ${
                live.length === 1 ? "needs" : "need"
              } deciding, and <strong>${acceptable.length}</strong> ${
                acceptable.length === 1 ? "promise is" : "promises are"
              } ready to agree to.`
            : `Nothing here is undecided. <strong>${acceptable.length}</strong> ${
                acceptable.length === 1 ? "promise is" : "promises are"
              } ready to agree to.`
        }</p>
        ${
          opts.interactive
            ? `<p class="mode live">Your presses are recorded${opts.recordsTo ? ` — ${esc(opts.recordsTo)}` : ""}, with your name and today's date, and written into the product truth.</p>`
            : `<p class="mode">Read-only preview — the buttons below show what you will be asked to do, and record nothing.</p>`
        }
      </header>
      ${renderNav(corpus, scopeId, opts.linkBase)}
      ${broken}
      ${staleBlock}
      ${
        live.length
          ? `<section class="questions"><h2>What needs deciding</h2>${live
              .map((q, i) => renderQuestion(q, i, decisionsOn(corpus, q.ref), ctx))
              .join("")}</section>`
          : ""
      }
      ${grids.map((g) => renderGrid(g, ctx)).join("")}
      ${renderExchanges(corpus, ids, cellOf, ctx)}
      ${
        parked.length
          ? `<section class="questions parked-set">
               <h2>Parked</h2>
               <p class="lede">Read, deliberately not answered now, and still holes — no promise containing one can be built from.</p>
               ${parked.map((q, i) => renderQuestion(q, live.length + i, decisionsOn(corpus, q.ref), ctx)).join("")}
             </section>`
          : ""
      }
    </main>`;

  return `${STYLE}${body}${opts.interactive ? liveScript(opts) : INERT}`;
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
