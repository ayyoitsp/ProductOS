/**
 * ⛔ v1 → EXCHANGE, CARRYING ONLY WHAT v1 ACTUALLY RECORDED.
 *
 * `Scope.was` has existed since the model did, documented as "read by the migrator", and there was
 * no migrator — the dead-field test allowlisted it on a justification that was false. This is it.
 *
 * ⛔ THE WHOLE DESIGN CONSTRAINT: A MIGRATION MAY NOT DECIDE ANYTHING.
 *
 * v1 recorded a `claim` per behaviour and nothing else about the ask. It has no vocabulary for who
 * may ask, what they bring, what it refuses, what a failure leaves the asker with, what a repeat
 * does, what two at once does, or what the ask leaves behind. So a mechanical conversion that
 * filled eight slots from one claim would be inventing seven-eighths of the product truth, in
 * bulk, with nobody's name on it — the exact failure the model exists to prevent, at scale.
 *
 * What this does instead:
 *
 *   - the claim goes in `answer`, because that is the one slot v1 was ever about
 *   - its `test_cases` become criteria on `answer`, verbatim
 *   - **every other slot is written as an open question**, `asked_of: product`, dated to the
 *     migration. Not blank: blank says "somebody forgot", and `open` says "nobody has ever been
 *     asked", which is the truth and is answerable. A reviewer meets them in `decide` one feature
 *     at a time rather than as a wall of refusals.
 *   - anything that cannot be carried honestly is REFUSED and listed, never approximated
 *
 * The resulting blank-to-filled ratio is not a defect of the migration. It is the measurement the
 * eight-slot skeleton was built to take, on a real corpus.
 */
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { parseFrontmatter } from "../core/frontmatter.js";
import { FeatureFrontmatter, type FeatureDocument } from "../core/product.js";
import { SLOTS, SLOT_ASKS, type SlotName } from "./schema.js";

export interface Carried {
  scopes: number;
  exchanges: number;
  views: number;
  criteria: number;
  /** Slots carrying a v1 claim. */
  answered: number;
  /** Slots written as an open question because v1 never had a word for them. */
  opened: number;
}

export interface NotCarried {
  what: string;
  from: string;
  why: string;
}

export interface Migration {
  carried: Carried;
  refused: NotCarried[];
  files: string[];
}

/** v1 element kinds → the five roles. ⛔ Unmapped kinds are refused, never defaulted to `display`. */
const ROLE: Record<string, string> = {
  button: "commits",
  input: "entry",
  select: "entry",
  checkbox: "entry",
  textarea: "entry",
  radio: "entry",
  link: "navigates",
  a: "navigates",
  row: "navigates",
  tab: "navigates",
  card: "navigates",
  text: "display",
  badge: "display",
  panel: "region",
  region: "region",
  list: "region",
  table: "region",
};

const flat = (s: unknown): string => String(s ?? "").replace(/\s+/g, " ").trim();
const seg = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * The v1 path `cre/deals/deal-workspace` is already a scope tree — area, group, feature. v2 ids are
 * one segment, so the tree becomes `in:` and the leaf keeps its own name.
 *
 * ⛔ Collisions are refused, not suffixed. Two features with the same leaf name in different areas
 * would silently become one scope, and everything filed under the loser would vanish.
 */
function scopeIdOf(v1id: string, taken: Map<string, string>): { id: string; parents: string[] } | { clash: string } {
  const parts = v1id.split("/").filter(Boolean).map(seg);
  const id = parts[parts.length - 1]!;
  const prior = taken.get(id);
  if (prior && prior !== v1id) return { clash: prior };
  taken.set(id, v1id);
  return { id, parents: parts.slice(0, -1) };
}

/** Every v1 container under a root, features and capabilities alike. */
function readAll(root: string): FeatureDocument[] {
  const out: FeatureDocument[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md") && e.name !== "README.md") {
        const p = parseFrontmatter(fs.readFileSync(full, "utf-8"));
        const parsed = FeatureFrontmatter.safeParse(p.data);
        if (parsed.success) out.push({ frontmatter: parsed.data, body: p.content, filepath: full, url_path: "" });
      }
    }
  };
  walk(path.join(root, "products"));
  walk(path.join(root, "capabilities"));
  return out;
}

/**
 * ⛔ ONE ORG-WIDE QUESTION PER SLOT v1 HAD NO WORD FOR — NOT ONE PER EXCHANGE.
 *
 * The first version of this wrote an open standing onto every unrecorded slot of every exchange.
 * On a shipped product that produced **643 open questions**, which are SEVEN questions asked once
 * per control because nothing could ask them once: what may anyone ask, what do they bring, what
 * does it refuse, what does a failure leave them with, what does a repeat do, what does two at
 * once do, what is left behind. A reviewer handed 643 items does not review; they stop.
 *
 * The rule layer is exactly the home for a question about a class. One ruling here reaches every
 * exchange the selector touches **and every one written after it**, which is the leverage the layer
 * exists for — and `check` now reports how many slots each one unblocks, so the reviewer can take
 * the widest one first.
 *
 * ⛔ `mode: supplies`, because these will BE the answer where an exchange says nothing. And
 * `criteria: []` with no statement: an unsettled rule owes its demonstration in the same act as its
 * ruling, which is the person's to give and not the migration's to guess.
 */
function orgWideQuestion(slot: SlotName, at: string, scopeIds: string[]): Record<string, unknown> {
  void scopeIds;
  return {
    id: `what-happens-${slot.replace(/_/g, "-")}`,
    fills: [slot],
    mode: "supplies",
    // ⛔ `everywhere`, because the previous model was silent about this slot for the WHOLE product,
    // not for some corner of it. Narrowing it would be a claim about where the silence stops.
    scope: { everywhere: true },
    standing: {
      kind: "open",
      question: `${SLOT_ASKS[slot][0]!.toUpperCase()}${SLOT_ASKS[slot].slice(1)}? The previous model had no field for this anywhere in the product, so nobody has ever been asked — and until somebody is, every slot it would fill says nothing.`,
      asked_of: "product",
      asked_at: at,
      blocks: [],
    },
    criteria: [],
  };
}

export function migrate(v1Root: string, outDir: string, at: string): Migration {
  const docs = readAll(v1Root);
  const refused: NotCarried[] = [];
  const carried: Carried = { scopes: 0, exchanges: 0, views: 0, criteria: 0, answered: 0, opened: 0 };
  const taken = new Map<string, string>();

  // Pass one: every container's scope id, so `depends_on` and `leads_to` can resolve.
  const idOf = new Map<string, string>();
  const parentsOf = new Map<string, string[]>();
  for (const d of docs) {
    const r = scopeIdOf(d.frontmatter.id, taken);
    if ("clash" in r) {
      refused.push({
        what: d.frontmatter.id,
        from: d.filepath,
        why: `its name collides with "${r.clash}" — two scopes cannot share an id, and suffixing one would bury the collision`,
      });
      continue;
    }
    idOf.set(d.frontmatter.id, r.id);
    parentsOf.set(d.frontmatter.id, r.parents);
  }

  /** Container scopes for every intermediate path segment, so the tree is real. */
  const containers = new Map<string, string | undefined>();
  for (const [v1id, parents] of parentsOf) {
    void v1id;
    parents.forEach((p, i) => containers.set(p, i === 0 ? undefined : parents[i - 1]));
  }

  const files: string[] = [];
  const write = (name: string, data: unknown, body: string) => {
    const full = path.join(outDir, "truth", `${name}.md`);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, `---\n${YAML.stringify(data, { lineWidth: 96, blockQuote: "literal" })}---\n\n${body.trim()}\n`);
    files.push(full);
  };

  interface Pending {
    id: string;
    parents: string[];
    payload: Record<string, unknown> & { dependsOn: string[]; was?: string };
    body: string;
    from: string;
  }
  const pending: Pending[] = [];

  for (const d of docs) {
    const v1 = d.frontmatter;
    const id = idOf.get(v1.id);
    if (!id) continue;
    const parents = parentsOf.get(v1.id)!;

    /**
     * ⛔ THE ROLE FOLLOWS WHAT v1 RECORDED ABOUT THE CONTROL, NOT ITS HTML-ISH `kind`.
     *
     * Deriving it from `kind` alone produced two wrongs at once. A `kind: row` with claims against it
     * became `navigates`, which v2 refuses without a destination v1 never recorded — so the part was
     * dropped and every exchange anchored to it then arrived nowhere, taking real product truth with
     * it. Meanwhile `commits` — *the only role that owes an exchange* — was reserved for things v1
     * happened to call buttons.
     *
     * If v1 recorded what happens when you press something, that IS an exchange arriving at a control
     * the person waits on. `kind` only decides the ones nothing was ever recorded about.
     */
    const anchored = new Set(v1.behaviors.filter((b) => b.element).map((b) => `${b.surface}::${b.element}`));

    // ---- views ----
    const views = v1.ux.map((v) => {
      const parts = v.elements.flatMap((el) => {
        const role = anchored.has(`${v.id}::${el.id}`) ? "commits" : ROLE[el.kind];
        if (!role) {
          refused.push({
            what: `${v1.id} · ${v.id} · ${el.id}`,
            from: d.filepath,
            why: `element kind "${el.kind}" has no role in this model — say whether it commits, takes entry, navigates, displays or groups`,
          });
          return [];
        }
        /**
         * ⛔ `leads_to` IS CARRIED ONLY WHERE IT CAN RESOLVE. v1 points at a FEATURE
         * (`cre/deals/deal-list`); v2 points at a VIEW. A feature with several screens has no
         * single right answer, and a wrong one renders as a considered navigation promise that
         * goes nowhere — which `check` reports as `leads-nowhere` on somebody else's behalf.
         */
        let leads: string | undefined;
        if (el.leads_to) {
          const local = v1.ux.find((x) => x.id === el.leads_to);
          if (local) leads = local.id;
          else {
            const want = el.leads_to.replace(/^\//, "");
            const target = idOf.get(want);
            const targetDoc = docs.find((x) => x.frontmatter.id === want);
            if (target && targetDoc?.frontmatter.ux.length === 1) leads = `${target}#${targetDoc.frontmatter.ux[0]!.id}`;
            else
              refused.push({
                what: `${v1.id} · ${v.id} · ${el.id} → ${el.leads_to}`,
                from: d.filepath,
                why: targetDoc
                  ? `it names a feature with ${targetDoc.frontmatter.ux.length} screens, and v2 navigation names one screen — say which`
                  : "it names something this corpus does not contain",
              });
          }
        }
        /**
         * ⛔ A CONTROL THAT NAVIGATES OWES WHERE TO, AND v1 OFTEN DID NOT RECORD IT.
         *
         * v1's `kind: row` / `link` / `tab` says the thing is clickable; `leads_to` was optional, so a
         * shipped corpus has clickable rows whose destination was never written down. v2 refuses that,
         * and rightly: an engineer will guess. Dropping it to `display` would be worse — that asserts
         * it shows something and goes nowhere, which is a claim v1 never made.
         *
         * So the part is refused by name. The screen's sketch still shows the control; the part list
         * simply does not assert something nobody recorded.
         */
        if (role === "navigates" && !leads) {
          refused.push({
            what: `${v1.id} · ${v.id} · ${el.id}`,
            from: d.filepath,
            why: `v1 says this navigates (kind: ${el.kind}) and never recorded where to — a clickable control with no destination is one an engineer will invent`,
          });
          return [];
        }
        /**
         * ⛔ WHERE A COMMIT LANDS IS THE `answer` SLOT, NOT A LINK. v1 put `leads_to` on submit
         * buttons; carrying it would make the outcome of the work a navigation promise, and the
         * outcome is the thing the exchange is about.
         */
        if (role === "commits" && leads) {
          refused.push({
            what: `${v1.id} · ${v.id} · ${el.id} → ${el.leads_to}`,
            from: d.filepath,
            why: "v1 recorded where this button lands as a link; in this model that belongs in what the ask answers, so it needs saying there in a sentence",
          });
          leads = undefined;
        }
        return [{ id: seg(el.id), role, ...(el.label ? { label: el.label } : {}), ...(leads ? { leads_to: leads } : {}) }];
      });
      carried.views++;
      return {
        id: seg(v.id),
        title: v.title,
        exists: v1.status === "planned" ? "intended" : "kept",
        // ⛔ `walked` is a human's observation. Nothing in v1 recorded one, so it is false here —
        // claiming otherwise would manufacture the only evidence that a screen exists.
        walked: false,
        ...(v.sketch ? { sketch: v.sketch } : {}),
        parts,
      };
    });

    // ---- exchanges: one per control a behaviour was anchored to ----
    const byAnchor = new Map<string, typeof v1.behaviors>();
    for (const b of v1.behaviors) {
      if (b.question && !b.claim) {
        // An undefined behaviour is already a question. It survives as one, on `answer`.
        byAnchor.set(`?${b.id}`, [b]);
        continue;
      }
      if (!b.surface) {
        refused.push({
          what: `${v1.id} · ${b.id}`,
          from: d.filepath,
          why:
            v1.kind === "capability"
              ? "a capability's ask needs what hands it over and whether it repeats, and v1 recorded neither — inventing a trigger would put words in the product's mouth"
              : "it is anchored to no screen, so there is no ask to attach it to",
        });
        continue;
      }
      const key = `${b.surface}::${b.element ?? ""}`;
      byAnchor.set(key, [...(byAnchor.get(key) ?? []), b]);
    }

    interface Built {
      id: string;
      title: string;
      asked_by: string;
      at: { view: string; part?: string };
      exists?: string;
      slots: Record<string, unknown>;
      criteria: Array<Record<string, unknown>>;
    }
    const exchanges: Built[] = [...byAnchor.entries()].flatMap(([key, group]): Built[] => {
      if (key.startsWith("?")) {
        const b = group[0]!;
        const title = flat(b.question).slice(0, 70);
        /**
         * ⛔ AN ASK NEEDS SOMEWHERE TO ARRIVE, AND A CONTROL TO ARRIVE AT.
         *
         * This wrote `view: ""` for anything with no screen — a whole file that would not parse, taking
         * every promise in it down — and then, fixed halfway, wrote the FIRST screen with no control,
         * which `arrives-nowhere` refuses for the same reason a claim needs one: the control is what
         * makes two asks on one screen distinguishable. An open question is carried where v1 said it
         * belongs, and handed to a person where v1 did not say.
         */
        const uv = b.surface ? v1.ux.find((x) => x.id === b.surface) : undefined;
        if (!uv || !b.element || !uv.elements.some((e) => e.id === b.element)) {
          refused.push({
            what: `${v1.id} · ${b.id}`,
            from: d.filepath,
            why: `v1 left this undecided and did not say which control it is about, so there is no ask to hang it on: "${flat(b.question)}"`,
          });
          return [];
        }
        carried.exchanges++;
        /**
         * ⛔ ITS OWN QUESTION, CARRIED. v1's undefined behaviour is a question with no claim — real
         * product truth about something nobody has decided, and the first version of this dropped it,
         * leaving `answer` blank and refused with the question nowhere. The other slots stay absent so
         * the org-wide questions reach them.
         */
        const slots: Record<string, unknown> = {
          answer: {
            standing: {
              kind: "open",
              question: flat(b.question),
              asked_of: b.asked_of ?? "product",
              asked_at: b.asked_at ?? at,
              blocks: [],
            },
          },
        };
        return [
          {
            id: seg(b.id),
            title: `Undecided in the previous model: ${title}`,
            asked_by: "person",
            at: { view: seg(uv.id), part: seg(b.element) },
            slots,
            criteria: [],
          },
        ];
      }
      const [surface, element] = key.split("::");
      const view = v1.ux.find((v) => v.id === surface);
      if (!view) {
        refused.push({
          what: `${v1.id} · ${group.map((b) => b.id).join(", ")}`,
          from: d.filepath,
          why: `anchored to screen "${surface}", which this feature does not declare`,
        });
        return [];
      }
      /**
       * ⛔ A CLAIM ANCHORED TO A SCREEN AND NOT A CONTROL GOES TO A PERSON, VERBATIM.
       *
       * Reading them is instructive: *"when the list cannot be loaded, the reason is shown above the
       * table and the previously loaded page stays on screen"* is a `fails` slot. *"a tab whose work
       * has not landed says plainly it is not built yet"* is a display promise. v1 DID record
       * non-answer truth — it had nowhere to put it, so each became a separate screen-level behaviour.
       *
       * Which slot each one answers is a judgement, and joining them into `answer` would reproduce
       * exactly the defect being migrated away from: a `fails` fact reading as what the asker gets. So
       * the text is preserved in `not-carried.yaml` for somebody to file, rather than mis-filed here.
       */
      if (!element) {
        for (const b of group)
          refused.push({
            what: `${v1.id} · ${b.id}`,
            from: d.filepath,
            why: `v1 recorded this against the screen "${surface}" rather than a control, and which slot it answers is a judgement: "${flat(b.claim)}"`,
          });
        return [];
      }
      const el = element ? view.elements.find((e) => e.id === element) : undefined;
      const title = el?.label ? `${el.label} on ${view.title}` : view.title;

      /**
       * ⛔ ONE EXCHANGE PER CONTROL, which is what v2 means by an ask — `one-press-two-answers`
       * refuses two. v1 filed several claims against one control, so they are joined here as the
       * several things that one answer does, in v1's own words. Joining is not interpretation;
       * choosing which was primary would have been.
       */
      const answer = group.map((b) => flat(b.claim)).filter(Boolean).join(" ");
      const criteria = group.flatMap((b) =>
        b.test_cases.map((t, i) => {
          carried.criteria++;
          return {
            id: `${seg(b.id)}-${t.id ?? i + 1}`,
            slot: "answer",
            ...(t.given ? { given: flat(t.given) } : {}),
            ...(t.when ? { when: flat(t.when) } : {}),
            ...(t.then ? { then: flat(t.then) } : {}),
          };
        })
      );

      /**
       * ⛔ ONLY `answer`. Every other slot is left ABSENT — silence, which is what a rule is for —
       * so the seven org-wide questions reach it. Writing a per-slot standing here instead was the
       * 643-question wall.
       */
      const slots: Record<string, unknown> = { answer: { says: answer } };
      carried.answered++;
      carried.exchanges++;
      return [
        {
          id: seg(element || surface || "arrives"),
          title,
          asked_by: "person",
          at: { view: seg(surface!), ...(element ? { part: seg(element) } : {}) },
          exists: v1.status === "planned" ? "intended" : "kept",
          slots,
          criteria,
        },
      ];
    });

    const dependsOn = v1.depends_on.flatMap((x) => {
      const t = idOf.get(x);
      if (t) return [t];
      refused.push({ what: `${v1.id} depends_on ${x}`, from: d.filepath, why: "it names something this corpus does not contain" });
      return [];
    });
    void dependsOn;

    /**
     * ⛔ A SCOPE THAT PROMISES NOTHING IS NOT WRITTEN AT ALL — `owns-no-promise` refuses it, and
     * rightly. Every capability whose behaviours were all refused (v1 never recorded what hands them
     * over) came out as an empty scope, so the migration manufactured 21 refusals out of its own
     * omissions. The container is reported once instead, with the count.
     */
    if (!exchanges.length) {
      refused.push({
        what: v1.id,
        from: d.filepath,
        why:
          `none of its ${v1.behaviors.length} claim${v1.behaviors.length === 1 ? "" : "s"} could be carried, so it would be a scope that promises nothing` +
          (views.length
            ? ` — its ${views.length} screen${views.length === 1 ? "" : "s"} are waiting on those claims, because a screen with no promise on it is a picture`
            : " — what it needs is what hands its asks over"),
      });
      continue;
    }
    /**
     * ⛔ HELD BACK UNTIL EVERY SCOPE IS KNOWN, because a dependency on a scope this migration DROPPED
     * is a hole with a confident name. Writing as it went produced 35 `depends-on-nothing` refusals
     * pointing at capabilities whose asks could not be carried — the migration manufacturing findings
     * out of its own omissions, which is the worst kind of noise: it looks like corpus trouble.
     */
    pending.push({
      id,
      parents,
      payload: {
        id,
        title: v1.title,
        ...(parents.length ? { in: parents[parents.length - 1] } : {}),
        was: v1.id,
        exists: v1.status === "planned" ? "intended" : "kept",
        dependsOn,
        ...(views.length ? { views } : {}),
        ...(exchanges.length ? { exchanges } : {}),
      },
      body: `${flat(v1.description) || "No description was carried over — the previous model did not require one."}\n\n${d.body.trim()}`,
      from: d.filepath,
    });
  }

  const written = new Set(pending.map((x) => x.id));
  /** Only the groupings that end up holding something. */
  const keptContainers = new Set<string>();
  for (const x of pending) x.parents.forEach((p) => keptContainers.add(p));
  for (const [id, parent] of containers) {
    if (!keptContainers.has(id)) continue;
    carried.scopes++;
    write(
      id,
      {
        id,
        title: id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()),
        ...(parent && keptContainers.has(parent) ? { in: parent } : {}),
        exists: "kept",
      },
      `A grouping carried over from the previous model, where it was a directory rather than a thing\nanybody wrote about. It holds no promises of its own — whatever is filed beneath it does.\n\nIf it deserves a description, that is a real gap and worth writing.`
    );
  }
  for (const x of pending) {
    const deps = x.payload.dependsOn.filter((t) => {
      if (written.has(t)) return true;
      refused.push({ what: `${x.payload.was} depends_on ${t}`, from: x.from, why: "it names a scope this migration could not carry, so the dependency would point at nothing" });
      return false;
    });
    const { dependsOn: _drop, ...rest } = x.payload;
    void _drop;
    carried.scopes++;
    write(
      x.id,
      {
        ...rest,
        ...(x.parents.length && keptContainers.has(x.parents[x.parents.length - 1]!) ? { in: x.parents[x.parents.length - 1] } : {}),
        ...(deps.length ? { depends_on: deps } : {}),
      },
      x.body
    );
  }

  /**
   * ⛔ The questions v1 never had a field for, asked once each. `answer` is excluded: it is the one
   * slot v1 was ever about, so asking the product what an answer is would be asking about something
   * already recorded 61 times over.
   */
  const asked = SLOTS.filter((s) => s !== "answer");
  fs.mkdirSync(path.join(outDir, "rules"), { recursive: true });
  for (const slot of asked) {
    const r = orgWideQuestion(slot, at, [...idOf.values()]);
    fs.writeFileSync(
      path.join(outDir, "rules", `${r.id}.md`),
      `---\n${YAML.stringify(r, { lineWidth: 96, blockQuote: "literal" })}---\n\n` +
        `# ${SLOT_ASKS[slot]}\n\n` +
        `The previous model had no field for this, anywhere. So this is not a gap in one feature —\n` +
        `it is one decision the product has never made, and every slot it would fill says nothing\n` +
        `until somebody makes it.\n\n` +
        `Answering it reaches every ask in this product and every one written afterwards. If the\n` +
        `answer is genuinely different in one place, that place says so for itself and declares\n` +
        `which way — this rule is what the rest of the product does.\n`
    );
    files.push(path.join(outDir, "rules", `${r.id}.md`));
  }
  carried.opened = asked.length;
  fs.mkdirSync(path.join(outDir, "readings"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "verdicts"), { recursive: true });
  if (refused.length) {
    const p = path.join(outDir, "not-carried.yaml");
    fs.writeFileSync(
      p,
      `# ⛔ What the migration REFUSED to carry, and why.\n` +
        `#\n` +
        `# Each of these needs a person, not a better script: carrying them would have meant\n` +
        `# deciding something the previous model never recorded. They are listed rather than\n` +
        `# approximated, because an approximation here is indistinguishable from product truth.\n` +
        YAML.stringify({ generated: at, count: refused.length, refused }, { lineWidth: 96 })
    );
    files.push(p);
  }
  return { carried, refused, files };
}
