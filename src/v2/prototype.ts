/**
 * The prototype — every screen in the product, driveable, with the truth beside it.
 *
 * ⛔ WHY IT IS ITS OWN TOP-LEVEL PLACE. Peter: *"let's add a separate 'top level' menu item for the
 * prototype"*, after *"I think product OS should go prototype/wireframe first. it's a much better
 * surface to make sure everything works properly."*
 *
 * The rest of the page is truth-primary: screens appear inside behaviour cards, as evidence for
 * sentences. This is the inversion — the screen is the subject, full width, and the sentences are
 * what you get when you press part of it. Same corpus, opposite emphasis, which is why it is a
 * separate index rather than a mode on the existing one: a surface that tries to be both puts the
 * screen in a column narrow enough to be useless.
 *
 * ⛔ AND IT CARRIES WHAT NOTHING RENDERS. A prototype-first surface that showed only screens would
 * have nowhere to put the promises — a fifth of this corpus's statements are about things with no
 * screen at all ("every resolved limit carries which layer answered it"), and those are its highest
 * altitude. They appear here as what they are: nothing renders this, and these screens rest on it.
 * That is the difference between this and a design tool.
 */
import type { Corpus } from "./load.js";
import type { Scope, View } from "./schema.js";

export interface ProtoScreen {
  scope: string;
  scopeTitle: string;
  view: string;
  title: string;
  /** The drawing, or nothing if this screen still has no picture. */
  html?: string;
  /** How the picture came to exist, which is a fact about the BUILD, never about the truth. */
  from: "the code" | "the truth" | "nobody";
  parts: Array<{ id: string; role: string; label?: string; goes?: string }>;
  /** Statements that arrive at this screen, with the exchange they belong to. */
  says: Array<{ ref: string; slot: string; text: string; exchange: string; part?: string }>;
  /** Product areas this screen belongs to, outermost first. */
  areas: string[];
}

export interface ProtoPromise {
  scope: string;
  title: string;
  /** How many sentences it holds. */
  said: number;
  /** Screens whose features depend on it. */
  restsUnder: string[];
}

const lineage = (corpus: Corpus, id: string): string[] => {
  const out: string[] = [];
  let at: string | undefined = id;
  const seen = new Set<string>();
  while (at && !seen.has(at)) {
    seen.add(at);
    const sc: Scope | undefined = corpus.scopes.find((s) => s.scope.id === at)?.scope;
    if (!sc) break;
    if (sc.in) out.unshift(sc.in);
    at = sc.in;
  }
  return out;
};

function titleOf(corpus: Corpus, id: string): string {
  return corpus.scopes.find((s) => s.scope.id === id)?.scope.title || id;
}

/**
 * Every statement that arrives at a view, in slot order.
 *
 * ⛔ BY VIEW, NOT BY PART. A behaviour anchored to the screen rather than to one control on it is
 * still about that screen, and dropping it because it named no part would hide exactly the
 * feature-wide rules — authorization, precision, what happens when two people arrive at once.
 */
function saysFor(corpus: Corpus, scopeId: string, viewId: string): ProtoScreen["says"] {
  const out: ProtoScreen["says"] = [];
  const sc = corpus.scopes.find((s) => s.scope.id === scopeId)?.scope;
  if (!sc) return out;
  for (const ex of sc.exchanges) {
    if (ex.at?.view !== viewId) continue;
    for (const [slot, body] of Object.entries(ex.slots ?? {})) {
      if (!body) continue;
      const says = (body as { says?: unknown }).says;
      const part = ex.at?.part;
      if (typeof says === "string")
        out.push({ ref: `${scopeId}#${ex.id}#${slot}`, slot, text: says, exchange: ex.title || ex.id, part });
      else if (Array.isArray(says))
        for (const st of says as Array<{ id: string; says: string }>)
          out.push({ ref: `${scopeId}#${ex.id}#${slot}#${st.id}`, slot, text: st.says, exchange: ex.title || ex.id, part });
    }
  }
  return out;
}

export function screensOf(corpus: Corpus): ProtoScreen[] {
  const out: ProtoScreen[] = [];
  for (const s of corpus.scopes)
    for (const v of s.scope.views as View[]) {
      out.push({
        scope: s.scope.id,
        scopeTitle: s.scope.title || s.scope.id,
        view: v.id,
        title: v.title || v.id,
        html: v.sketch_html || undefined,
        /**
         * ⛔ `drawn_from` DOES NOT MAKE A SCREEN MORE REAL — the corpus is the target either way.
         * It only says whether there is code to compare this against yet, which is why the label is
         * about where the picture came from rather than about the screen's standing.
         */
        from: v.sketch_html ? (v.drawn_from ? "the code" : "the truth") : "nobody",
        parts: (v.parts ?? []).map((p) => ({ id: p.id, role: p.role, label: p.label, goes: p.leads_to })),
        says: saysFor(corpus, s.scope.id, v.id),
        areas: lineage(corpus, s.scope.id).map((a) => titleOf(corpus, a)),
      });
    }
  return out;
}

/** What nothing renders — and what rests on it. */
export function promisesOf(corpus: Corpus): ProtoPromise[] {
  const groups = new Set(corpus.scopes.filter((s) => s.scope.in).map((s) => s.scope.in!));
  const out: ProtoPromise[] = [];
  for (const s of corpus.scopes) {
    const sc = s.scope;
    if (groups.has(sc.id)) continue; // a group files things; it is not itself a promise
    if (sc.views.length) continue;
    let said = 0;
    for (const ex of sc.exchanges)
      for (const body of Object.values(ex.slots ?? {})) {
        const says = (body as { says?: unknown } | undefined)?.says;
        if (typeof says === "string") said++;
        else if (Array.isArray(says)) said += says.length;
      }
    /**
     * ⛔ NAMED BY WHAT DEPENDS ON IT, because "access control, 4 statements" tells a reviewer
     * nothing about why they should care. A promise matters through the screens that rest on it.
     */
    const restsUnder = corpus.scopes
      .filter((o) => (o.scope.depends_on ?? []).some((d) => d.split("#")[0] === sc.id))
      .map((o) => o.scope.title || o.scope.id);
    out.push({ scope: sc.id, title: sc.title || sc.id, said, restsUnder });
  }
  return out.sort((a, b) => b.said - a.said);
}
