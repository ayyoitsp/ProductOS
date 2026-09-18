import fs from "node:fs";
import matter from "gray-matter";
import {
  walkGroups,
  topReadmePath,
  listProducts,
  listAllContainers,
  listCapabilitySystems,
} from "./product.js";
import { readTracking } from "./tracking.js";
import { readFrameworkGaps, gapsFilePath } from "./framework-gaps.js";
import { allContextSections } from "./context.js";
import { auditFeature, type AuditFinding } from "./audit.js";
import { ProductosPaths } from "./paths.js";

/**
 * Does this corpus satisfy the model the documentation asserts?
 *
 * ⛔ THIS EXISTS BECAUSE A CORPUS WAS HANDED OVER FOR REVIEW THAT DID NOT.
 * Ten capabilities rendered as a flat list of operations with no subsystem named
 * anywhere; a whole product filed as a single area; a boundary statement filed as an
 * operation. Every one of those contradicts something GLOSSARY.md states plainly, and
 * every one was visible from the corpus alone.
 *
 * So the structural assertions in the docs get a check, and the check runs before
 * anybody is asked to look. An author — human or agent — should not be the last line of
 * defence for claims the documentation already makes.
 */
export interface ConformanceProblem {
  what: string;
  where: string;
  /** The rule from the model that this breaks. */
  rule: string;
}

/**
 * Every URL the site can serve, derived from the corpus.
 *
 * ⛔ Links are checked because two separate 404 classes shipped: nested capability
 * pages the sidebar linked to, and area links built without their product. Both were
 * invisible to a corpus-only check and both read to a reader as a broken corpus rather
 * than a missing route.
 */
export function servableUrls(paths: ProductosPaths): Set<string> {
  const urls = new Set<string>(["/", "/_context", "/_feedback", "/_queue"]);
  for (const product of listProducts(paths)) {
    urls.add(`/${product.slug}/`);
    walkGroups(product.groups, (g) => urls.add(`/${g.id}/`));
  }
  for (const sys of listCapabilitySystems(paths)) urls.add(`/capabilities/${sys.slug}/`);
  for (const c of listAllContainers(paths)) urls.add(`/${c.frontmatter.id}`);
  return urls;
}

/**
 * Words that mean a product-truth page is describing its own filing system.
 *
 * Deliberately a short list of unambiguous giveaways rather than a clever heuristic: a
 * false positive here is a page somebody has to reword for no reason, and the real
 * leaks have all been this literal.
 */
const SUBSTRATE_WORDS = [
  "productos/",
  "frontmatter",
  ".md file",
  "`.md`",
  "subdirectory",
  "productos serve",
  "localhost:",
];

export function checkConformance(paths: ProductosPaths): {
  problems: ConformanceProblem[];
  suggestions: ConformanceProblem[];
  highFindings: AuditFinding[];
} {
  const problems: ConformanceProblem[] = [];
  /** Worth reading, never a refusal. See the glossary-term check for why. */
  const suggestions: ConformanceProblem[] = [];
  const unwrittenContext = new Set<string>();
  const all = listAllContainers(paths);

  // Corpus-level references must resolve.
  const urls = servableUrls(paths);
  const ids = new Set(listAllContainers(paths).map((c) => c.frontmatter.id));
  for (const c of listAllContainers(paths)) {
    const fm = c.frontmatter;
    for (const dep of fm.depends_on) {
      if (!ids.has(dep)) {
        problems.push({
          what: `${fm.id} depends on "${dep}", which does not exist`,
          where: fm.id,
          rule: "every reference resolves",
        });
      }
    }
    for (const aff of fm.affected_by) {
      if (!ids.has(aff)) {
        problems.push({
          what: `${fm.id} is affected_by "${aff}", which does not exist`,
          where: fm.id,
          rule: "every reference resolves",
        });
      }
    }
    for (const u of fm.ux ?? []) {
      for (const el of u.elements) {
        const to = el.leads_to;
        if (!to) continue;
        // A same-feature surface anchor, or a container id (optionally + anchor).
        if ((u.id && to === u.id) || (fm.ux ?? []).some((x) => x.id === to)) continue;
        const target = to.split("#")[0]!;
        if (!ids.has(target) && !urls.has(`/${target}`)) {
          problems.push({
            what: `${fm.id} element "${el.id}" leads to "${to}", which does not exist`,
            where: fm.id,
            rule: "a navigation element points at something real, or is declared as a stub",
          });
        }
      }
    }
  }

  // ⛔ The overview page is the one page a newcomer reads as prose, and an unreplaced
  // scaffold there costs more than a missing page: three fresh readers concluded the
  // product WAS the documentation tool, because that is what the placeholder described.
  // Substrate on any grouping page is refused for the same reason.
  // ⛔ WHETHER THERE IS ANYTHING HERE TO REVIEW YET. `check` answers "is this ready to
  // hand to somebody", and on a corpus that is still nothing but the scaffold the answer
  // is "there is nothing to hand over" — not eight failures. Failing from minute zero is
  // how a check earns the reputation it then cannot lose, and it contradicts the whole
  // adoption stance: grow from active work, never a day-one sweep.
  const realContainers = all.filter(
    (c) => !c.frontmatter.id.startsWith("example-product/") && c.frontmatter.id !== "example/hello"
  );
  const hasRealTruth = realContainers.length > 0;

  const topReadme = topReadmePath(paths);
  if (hasRealTruth && fs.existsSync(topReadme)) {
    const body = matter(fs.readFileSync(topReadme, "utf-8")).content;
    if (body.includes("Replace this page")) {
      problems.push({
        what: "The overview page is still the scaffold",
        where: topReadme,
        rule: "the first page a reader sees must say what the product is",
      });
    }
    const leak = SUBSTRATE_WORDS.find((w) => body.includes(w));
    if (leak) {
      problems.push({
        what: `The overview page describes the storage ("${leak}") rather than the product`,
        where: topReadme,
        rule: "a reader of product truth is asking what the product is, never how it is filed",
      });
    }
  }

  // Every grouping level has an identity.
  for (const product of listProducts(paths)) {
    if (!fs.existsSync(product.filepath)) {
      problems.push({
        what: `Product "${product.slug}" has no description`,
        where: product.filepath,
        rule: "a product is a named thing, not a directory",
      });
    }
    if (product.areas.length === 0) {
      problems.push({
        what: `Product "${product.slug}" holds no areas`,
        where: product.slug,
        rule: "features live in areas, areas live in products",
      });
    }
    walkGroups(product.groups, (g) => {
      if (!fs.existsSync(g.filepath)) {
        problems.push({
          what: `Area "${g.id}" has no description`,
          where: g.filepath,
          rule: "a feature area is a named product concern",
        });
      }
      if (g.groups.length === 0 && g.features.length === 0) {
        problems.push({
          what: `Area "${g.id}" is empty`,
          where: g.id,
          rule: "an area holds features or sub-areas",
        });
      }
    });
  }

  // The same rule on every grouping body.
  for (const product of listProducts(paths)) {
    const check = (id: string, filepath: string, body: string) => {
      const leak = SUBSTRATE_WORDS.find((w) => body.includes(w));
      if (!leak) return;
      problems.push({
        what: `"${id}" describes the storage ("${leak}") rather than the product`,
        where: filepath,
        rule: "a reader of product truth is asking what the product is, never how it is filed",
      });
    };
    check(product.slug, product.filepath, product.body);
    walkGroups(product.groups, (g) => check(g.id, g.filepath, g.body));
  }

  for (const system of listCapabilitySystems(paths)) {
    if (!fs.existsSync(system.filepath)) {
      problems.push({
        what: `Capability system "${system.slug}" has no description`,
        where: system.filepath,
        rule: "a capability system is a subsystem with an identity, congruent to a feature area",
      });
    }
    if (system.capabilities.length === 0) {
      problems.push({
        what: `Capability system "${system.slug}" holds no capabilities`,
        where: system.slug,
        rule: "a system groups the capabilities it offers",
      });
    }
  }

  // Every container must sit at the right depth.
  for (const c of all) {
    const id = c.frontmatter.id;
    const depth = id.split("/").length;
    if (c.frontmatter.kind === "capability") {
      if (depth !== 3) {
        problems.push({
          what: `Capability "${id}" is not inside a capability system`,
          where: id,
          rule: "a capability lives at capabilities/<system>/<slug>",
        });
      }
    } else if (depth < 3) {
      // ⛔ A minimum, never an exact depth. Areas nest as deep as the product needs;
      // what is refused is a feature sitting loose in a product with no area at all.
      problems.push({
        what: `Feature "${id}" is not inside an area`,
        where: id,
        rule: "a feature lives at <product>/<area>/.../<slug>",
      });
    }
  }

  // ⛔ EVERY behavior-to-behavior reference resolves, not just `contradicts`. A reviewer
  // found a `blocks` pointing at a behavior that does not exist anywhere on the site:
  //
  //   "The one field that tells me whether an open question is a hard blocker can point
  //    at nothing and look fine — even though the tool flags malformed citations and
  //    dangling dependencies with its own audit findings."
  //
  // Worse than a dangling `depends_on`, because `blocks: []` and `blocks: [nothing]`
  // render as opposites — "the rest can ship" versus "this is a hard blocker" — and the
  // second one silently means the first.
  const behaviorRefs = new Map<string, true>();
  for (const c of all)
    for (const b of c.frontmatter.behaviors)
      behaviorRefs.set(`${c.frontmatter.id}#${b.id}`, true);
  for (const c of all) {
    for (const b of c.frontmatter.behaviors) {
      const check = (field: string, refs: string[]) => {
        for (const ref of refs) {
          const full = ref.includes("#") ? ref : `${c.frontmatter.id}#${ref}`;
          if (behaviorRefs.has(full)) continue;
          problems.push({
            what: `"${c.frontmatter.id}#${b.id}" ${field} "${full}", which does not exist`,
            where: `${c.frontmatter.id}#${b.id}`,
            rule:
              field === "blocks"
                ? "a blocker pointing at nothing reads as a hard blocker and means nothing"
                : "a reference that resolves to nothing is worse than no reference",
          });
        }
      };
      check("blocks", b.blocks ?? []);
      check("is the same question as", b.same_as ?? []);
    }
  }

  // ⛔ A declared contradiction is a refusal, not a warning. It says two claims on this
  // site cannot both hold, so somebody would build the wrong one — a worse state than
  // any missing description, and the only one where handing the corpus over does active
  // harm. It clears by deciding which claim is right, not by deleting the declaration.
  const byRef = new Map<string, true>();
  for (const c of all) for (const b of c.frontmatter.behaviors) byRef.set(`${c.frontmatter.id}#${b.id}`, true);
  for (const c of all) {
    for (const b of c.frontmatter.behaviors) {
      for (const ref of b.contradicts ?? []) {
        const full = ref.includes("#") ? ref : `${c.frontmatter.id}#${ref}`;
        problems.push({
          what: `"${c.frontmatter.id}#${b.id}" and "${full}" cannot both hold`,
          where: `${c.frontmatter.id}#${b.id}`,
          rule: byRef.has(full)
            ? "decide which claim is right — until then neither can be built from"
            : "a contradiction pointing at a behavior that does not exist",
        });
      }
    }
  }

  // ⛔ `forced_into` is the load-bearing field on a framework gap: it names where the
  // compromise landed so the corpus can be corrected in one pass once the gap closes.
  // A dangling one destroys that — the gap closes, and nobody can find the approximation
  // it licensed, so the compromise quietly becomes the convention. It also means the
  // reader who hits the compromise is never told it is one, because the page it would
  // have been shown on does not exist.
  for (const gap of readFrameworkGaps(paths)) {
    if (gap.status !== "open" || !gap.forced_into) continue;
    const target = gap.forced_into;
    // Prose like "nothing — basis carries the source" is a legitimate value: it says
    // no compromise was made. Only an id-shaped value has to resolve.
    if (/\s/.test(target)) continue;
    if (!all.some((c) => c.frontmatter.id === target)) {
      problems.push({
        what: `Framework gap ${gap.id} was forced into "${target}", which no longer exists`,
        where: gapsFilePath(paths),
        rule: "a compromise nobody can find is a compromise that becomes the convention",
      });
    }
  }

  // ⛔ A defined word nothing rests on. Fresh readers met a nineteen-term glossary and
  // could not find four of those terms used anywhere else on the site: "a glossary of 19
  // undefined words is worse than no glossary." The computable half of that is the
  // reverse traversal ProductOS already has — `cites` — and a term no behavior cites is
  // either decoration or evidence that a promise about it is missing. Low-cost to fix
  // either way: cite it, or delete it.
  const productSlugs = listProducts(paths).map((p) => p.slug);
  const sections = allContextSections(paths, productSlugs);

  // ⛔ A CITATION THAT RESOLVES TO NOTHING IS A REFUSAL, and `check` never asked. It
  // surfaced only as a readiness blocker, and only when the caller happened to supply
  // context states — so the pre-handover gate, whose whole job is catching what an author
  // cannot see in their own work, was blind to a behavior deferring to a rule that does
  // not exist. Worse than a dangling `depends_on`: the reader is told the claim rests on
  // an authority, and goes looking for it.
  for (const c of all) {
    for (const b of c.frontmatter.behaviors) {
      for (const ref of b.cites ?? []) {
        if (sections.has(ref)) continue;
        // A wrong namespace is the common case and the confusing one — the section often
        // exists one scope up, and the two are deliberately different rules.
        const anchor = ref.split("#")[1];
        const elsewhere = [...sections.keys()].filter((k) => k.endsWith(`#${anchor}`));
        problems.push({
          what: `"${c.frontmatter.id}#${b.id}" rests on "${ref}", which does not exist`,
          where: `${c.frontmatter.id}#${b.id}`,
          rule: elsewhere.length
            ? `that section exists as ${elsewhere.join(", ")} — a global and a scoped entry sharing a name are two different rules`
            : "a behavior deferring to a rule nobody can find is deferring to nothing",
        });
      }
    }
  }

  const cited = new Set<string>();
  for (const c of all) {
    for (const b of c.frontmatter.behaviors) for (const ref of b.cites ?? []) cited.add(ref);
  }
  const orphanTerms = [...sections.keys()].filter(
    (k) => k.includes("glossary#") && !cited.has(k)
  );
  // ⛔ A suggestion, not a refusal. This fired on 17 of 19 terms in a real corpus, and a
  // check that refuses every handover is a check people route around. It is a smell
  // worth reading, not proof of a defect.
  if (orphanTerms.length > 0) {
    suggestions.push({
      what: `${orphanTerms.length} glossary term${
        orphanTerms.length === 1 ? "" : "s"
      } nothing rests on`,
      where: orphanTerms.slice(0, 8).join(", ") + (orphanTerms.length > 8 ? " …" : ""),
      rule: "a word the product defines and nothing claims anything about is either decoration or a missing promise — cite it from the behavior it governs, or drop it",
    });
  }

  // ⛔ A scaffolded strategy file that reached a reader. Placeholder strategy is read as
  // policy — a reviewer built a brief citing four design principles and two non-goals as
  // binding constraints, and separately noted that an unreplaced voice file "told me, on
  // my first pass through the strategy layer, that nobody has been through this section,
  // which coloured how much I trusted the rest of it."
  for (const [ref, { doc }] of sections) {
    void ref;
    if (!hasRealTruth) break;
    if (!doc.body.includes("Nothing here is written yet.")) continue;
    if (unwrittenContext.has(doc.name)) continue;
    unwrittenContext.add(doc.name);
    problems.push({
      what: `Strategy file "${doc.name}" is still the scaffold`,
      where: doc.name,
      rule: "placeholder strategy is read as policy — a reader cites it as a constraint nobody agreed to",
    });
  }

  // ⛔ OUR vocabulary in THEIR dictionary. A reader met `stub` in a commercial-lending
  // glossary and flagged it: "never defined — and it suggests engineering vocabulary has
  // leaked into the product's own dictionary." A product's glossary is what its words
  // mean to its users; a word that means something to ProductOS and nothing to them is
  // substrate in the one place a reader goes to resolve confusion.
  const OUR_WORDS = new Set([
    "stub",
    "behavior",
    "behaviour",
    "claim",
    "capability",
    "feature",
    "surface",
    "container",
    "test case",
    "packet",
    "readiness",
    "framework gap",
  ]);
  const leaked = [...sections.keys()]
    .filter((k) => k.includes("glossary#"))
    .map((k) => k.split("glossary#")[1]!)
    .filter((term) => OUR_WORDS.has(term.replace(/-/g, " ")));
  if (leaked.length > 0) {
    suggestions.push({
      what: `${leaked.length} glossary term${
        leaked.length === 1 ? " is" : "s are"
      } ProductOS's vocabulary, not this product's: ${leaked.join(", ")}`,
      where: "glossary",
      rule: "a product's glossary says what its words mean to its users — our words in it are substrate in the one place a reader goes to resolve confusion",
    });
  }

  // ⛔ A suspected edge is a question addressed to this page's owner, so it belongs in
  // the handover output rather than only on the page. It resolves two ways: promote it
  // to `depends_on`, or delete it. Left sitting, it keeps the impact count uncertain
  // forever — and an uncertain count is only better than a wrong one while somebody is
  // still going to settle it.
  for (const c of all) {
    for (const s of c.frontmatter.suspected_depends_on ?? []) {
      const exists = all.some((x) => x.frontmatter.id === s.id);
      suggestions.push({
        what: `"${c.frontmatter.id}" is suspected of depending on "${s.id}"`,
        where: s.because + (s.raised_by ? ` — ${s.raised_by}` : ""),
        rule: exists
          ? "the owner of this page owes an answer: promote it to depends_on, or remove it"
          : "the suspected target does not exist — either the id is wrong or the thing it names is unowned",
      });
    }
  }

  // Everything the per-container audit already refuses.
  const highFindings: AuditFinding[] = [];
  for (const c of all) {
    highFindings.push(
      ...auditFeature(c, all, readTracking(paths, c.frontmatter.id)).filter(
        (f) => f.severity === "high"
      )
    );
  }

  return { problems, suggestions, highFindings };
}
