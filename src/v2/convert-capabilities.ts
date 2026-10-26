/**
 * The older capability tree, converted into the one tree.
 *
 * Peter: *"to be clear, i expect there to ONLY be a v2 subsystem/capability tree after this and no
 * confusion, with the existing capabilities migrated to v2"*.
 *
 * ⛔ WHAT IS BEING CONVERTED. The v1 migrator filed every v1 capability as a product SCOPE under a
 * container with the id `capabilities`, each v1 operation as a system-asked exchange, and recorded
 * who calls it the v1 way: as `depends_on` on the caller. Nothing converted that into the subsystem
 * layer, because the migrator was deleted with the rest of v1 — so two things answered to the word.
 *
 * ⛔ HOW, ONE RELATION AT A TIME, AND NOTHING INVENTED:
 *
 *   carried scope                     → a `Subsystem` with the same id, title and nesting
 *   its system / integrator asks      → that subsystem's `Capability`s — an ask somebody else's
 *                                        software or this product makes of it is exactly a contract
 *   a feature's `depends_on: S`       → `serves: [feature]` on every capability S offers, and the
 *                                        feature's own entry re-spelled `S#offers`, so the edge is
 *                                        kept on both sides rather than dropped from one
 *   carried scope's `depends_on: T`   → `uses: [T]`, and T's capabilities serve whatever S serves —
 *                                        the clock serves the ledger serves the money
 *   `triggered_by: "A, B ask for this"` → the same callers, by title, where `depends_on` is missing
 *
 * ⛔ WHAT IT DOES NOT TURN INTO MACHINERY. A PERSON-asked exchange inside the area is product truth
 * — somebody uses it — so it stays a product scope, re-filed out of the area, and is reported.
 * ⛔ And a capability no caller can be found for is converted with `serves: []`, which `check`
 * refuses by name. Writing a plausible `serves` would be the converter deciding what something is
 * for, which is the one thing that field exists to have a person say.
 *
 * ⛔ NOTHING IS LOST. What a capability cannot hold — the other slots, the criteria — is carried into
 * the subsystem's own body, word for word, so the next person working the part has it in front of
 * them. Nothing is deleted either: the store deprecates, and the server logs which documents moved.
 */
import YAML from "yaml";
import { parseFrontmatter } from "../core/frontmatter.js";
import { Scope, saysText, type Exchange } from "./schema.js";
import { CARRIED_AREA_ID } from "./subsystems.js";

export interface Conversion {
  /** Documents to write, by corpus key. */
  put: Record<string, string>;
  /** Documents that no longer exist in this shape. Deprecated, never deleted. */
  deprecate: string[];
  report: {
    area: string;
    subsystems: string[];
    capabilities: string[];
    /** Person-asked exchanges left as product truth, with the scope they now sit in. */
    keptAsProduct: string[];
    /** Capabilities with no caller anywhere — converted with `serves: []`, refused by `check`. */
    servesNothing: string[];
    /** `depends_on` entries re-spelled to the subsystem, as `<file>: <was> → <now>`. */
    respelled: string[];
    /** Other documents that still name a converted ask by its old address, for a person to look at. */
    stillNamed: string[];
    /**
     * Documents whose `depends_on` could not be re-spelled in place, so the frontmatter WAS
     * reserialised and their requirements will read as stale.
     *
     * ⛔ REPORTED, BECAUSE A SILENT RESERIALISE IS THE DEFECT THIS FIELD EXISTS TO SURFACE. Empty on
     * the real corpus; a non-empty list is a document shape the in-place edit does not handle yet,
     * and somebody has to see it rather than discover it as 260 invalidated validations.
     */
    reserialised: string[];
  };
}

interface Doc {
  key: string;
  data: Record<string, unknown>;
  body: string;
  scope: Scope;
}

const write = (data: Record<string, unknown>, body: string): string =>
  `---\n${YAML.stringify(data, { lineWidth: 96, blockQuote: "literal" })}---\n\n${body.trim()}\n`;

const flat = (s: string): string => s.replace(/\s+/g, " ").trim();

/**
 * One `depends_on` entry re-spelled, IN PLACE, leaving every other byte of the document alone.
 *
 * ⛔ WHY THIS EXISTS RATHER THAN A RESERIALISE, AND IT COST 260 OF PETER'S VALIDATIONS TO FIND.
 *
 * Re-spelling a dependency used to go through `write()`, which runs the whole frontmatter back
 * through `YAML.stringify`. That reformats everything it touches: prose re-wraps at `lineWidth`,
 * and every flow sequence `[a, b]` becomes a block sequence. `truth/map-the-statement.md` — a
 * feature filed under `operating-statements`, with nothing to do with the capability tree — came
 * out with 497 changed lines to re-spell ONE entry.
 *
 * A requirement is pinned to the wording of the claim it was worked out against, so a reworded
 * claim refuses with `a-requirement-older-than-its-claim`. Re-wrapping a line IS a rewording as
 * far as that check can tell. Measured on the real corpus: refusals 222 → 561, of which +260 were
 * requirements invalidated by nothing but line wrapping, on features nobody converted.
 *
 * ⛔ AND `0001-drop-walked` ALREADY KNEW. Its comment says a YAML-reserialise "would reformat every
 * document it touched and lose comment placement and key order", which is why it deletes whole
 * lines instead. This rule ignored its own neighbour's warning.
 *
 * So: find the `depends_on` block in the frontmatter and rewrite only the scalar that matched.
 * Both styles are in use — 23 documents flow, 31 block — so both are handled, and anything this
 * cannot place with certainty is left for the caller to fall back on.
 */
export function respellDependsOn(source: string, from: string, to: string): string | null {
  const fm = /^---\n([\s\S]*?)\n---/.exec(source);
  if (!fm) return null;
  /** Where the frontmatter body starts in `source` — after the opening `---\n`. */
  const base = 4;
  const head = fm[1]!;
  const lines = head.split("\n");

  /** The offset of each line within `source`, so an edit can be placed exactly. */
  const offsets: number[] = [];
  for (let i = 0, at = base; i < lines.length; i++) {
    offsets.push(at);
    at += lines[i]!.length + 1;
  }

  const key = lines.findIndex((l) => /^depends_on:[ \t]*/.test(l));
  if (key === -1) return null;

  /** The exact scalar and nothing containing it — `pin-a-version` must not match `pin-a-version-2`. */
  const quoted = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exact = new RegExp(`(^|[\\[,]\\s*|-\\s+)(${quoted})(?=\\s*(?:[\\],]|$))`);

  const place = (lineNo: number): string | null => {
    const m = exact.exec(lines[lineNo]!);
    if (!m) return null;
    const at = offsets[lineNo]! + m.index + m[1]!.length;
    return source.slice(0, at) + to + source.slice(at + from.length);
  };

  const inline = lines[key]!.slice("depends_on:".length).trim();
  /** Flow style on the key's own line: `depends_on: [a, b]`. */
  if (inline.startsWith("[")) return place(key);
  /** Anything else on that line is a shape this does not claim to understand. */
  if (inline) return null;

  /**
   * Block style. Only the lines indented under the key — the next line at column zero ends the
   * block, or an edit could reach into an unrelated field holding the same word.
   */
  for (let i = key + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() && !/^[ \t]/.test(line)) break;
    if (!/^[ \t]*-/.test(line)) continue;
    const out = place(i);
    if (out) return out;
  }
  return null;
}


/** The first paragraph of a body, as a sentence about what the part is. */
const firstParagraph = (body: string): string =>
  flat(
    body
      .trim()
      .split(/\n\s*\n/)
      .find((p) => p.trim() && !p.trim().startsWith("#")) ?? "",
  );

const slotText = (e: Exchange, slot: string): string => {
  const fill = (e.slots as Record<string, { says?: unknown } | undefined>)[
    slot
  ];
  return fill?.says ? flat(saysText(fill.says as never)) : "";
};

export function convertCarriedCapabilities(
  files: Record<string, string>,
  at = new Date().toISOString().slice(0, 10),
): Conversion | null {
  const docs: Doc[] = [];
  for (const [key, source] of Object.entries(files)) {
    if (!key.startsWith("truth/") || !key.endsWith(".md")) continue;
    try {
      const p = parseFrontmatter(source);
      const data = (p.data ?? {}) as Record<string, unknown>;
      docs.push({ key, data, body: p.content, scope: Scope.parse(data) });
    } catch {
      /** ⛔ A document that will not load is `check`'s to report, not this conversion's to guess at. */
    }
  }
  const byId = new Map(docs.map((d) => [d.scope.id, d]));
  const root =
    byId.get(CARRIED_AREA_ID) ??
    docs.find(
      (d) => !d.scope.in && /^capabilities$/i.test(d.scope.title.trim()),
    );
  if (!root) return null;

  /** Everything filed under the area, the area included. */
  const area = new Set([root.scope.id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const d of docs)
      if (d.scope.in && area.has(d.scope.in) && !area.has(d.scope.id)) {
        area.add(d.scope.id);
        grew = true;
      }
  }
  const carried = docs.filter((d) => area.has(d.scope.id));
  const product = docs.filter((d) => !area.has(d.scope.id));
  const head = (ref: string) => ref.split("#")[0]!;

  /** ⛔ An id already taken by a subsystem is not overwritten — that part was authored by somebody. */
  const taken = new Set(
    Object.keys(files)
      .filter((k) => k.startsWith("capabilities/") && k.endsWith(".md"))
      .map((k) => {
        try {
          return String(
            (parseFrontmatter(files[k]!).data as { id?: unknown }).id ?? "",
          );
        } catch {
          return "";
        }
      }),
  );

  // ---- who calls each carried scope ----
  const direct = new Map<string, Set<string>>();
  const uses = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, k: string, v: string) =>
    m.set(k, (m.get(k) ?? new Set()).add(v));
  for (const d of product)
    for (const dep of d.scope.depends_on)
      if (area.has(head(dep)) && head(dep) !== root.scope.id)
        add(direct, head(dep), d.scope.id);
  for (const d of carried)
    for (const dep of d.scope.depends_on)
      if (
        area.has(head(dep)) &&
        head(dep) !== d.scope.id &&
        head(dep) !== root.scope.id
      )
        add(uses, d.scope.id, head(dep));

  /** The callers v1 named in prose, by title — the fallback when no `depends_on` says it. */
  const titled = new Map(
    product.map((d) => [flat(d.scope.title).toLowerCase(), d.scope.id]),
  );
  for (const d of carried)
    for (const e of d.scope.exchanges) {
      const said = e.when?.triggered_by?.match(
        /^(.*?)\s+asks?\s+for\s+this\s*$/i,
      )?.[1];
      if (!said) continue;
      for (const name of said.split(/,\s*/)) {
        const id = titled.get(flat(name).toLowerCase());
        if (id) add(direct, d.scope.id, id);
      }
    }

  /** Callers of S: whoever names it, and whoever calls a carried part that leans on it. */
  const memo = new Map<string, Set<string>>();
  const callers = (s: string, seen = new Set<string>()): Set<string> => {
    if (memo.has(s)) return memo.get(s)!;
    if (seen.has(s)) return new Set();
    seen.add(s);
    const out = new Set(direct.get(s) ?? []);
    for (const [t, ts] of uses)
      if (ts.has(s)) for (const c of callers(t, seen)) out.add(c);
    memo.set(s, out);
    return out;
  };

  const out: Conversion = {
    put: {},
    deprecate: [],
    report: {
      area: root.scope.id,
      subsystems: [],
      capabilities: [],
      keptAsProduct: [],
      servesNothing: [],
      respelled: [],
      reserialised: [],
      stillNamed: [],
    },
  };
  /** Where a carried scope's ask now lives, so references can be re-spelled. */
  const converted = new Set<string>();
  const keptScopes = new Set<string>();
  const parentOutside = root.scope.in;

  const machineOf = (s: Scope) =>
    s.exchanges.filter(
      (e) => e.asked_by !== "person" && e.exists !== "withdrawn",
    );
  /** ⛔ A part exists where machinery does: its own asks, or a container of parts that have some. */
  const isPart = (id: string): boolean => {
    const d = byId.get(id)!;
    if (machineOf(d.scope).length) return true;
    if (d.scope.exchanges.length) return false;
    return carried.some((x) => x.scope.in === id && isPart(x.scope.id));
  };

  for (const d of carried) {
    if (d === root && !d.scope.exchanges.length) {
      out.deprecate.push(d.key);
      continue;
    }
    const s = d.scope;
    const machine = machineOf(s);
    const people = s.exchanges.filter((e) => e.asked_by === "person");
    if (!isPart(s.id)) {
      if (!s.exchanges.length) {
        out.deprecate.push(d.key);
        continue;
      }
    } else if (taken.has(s.id)) {
      out.report.keptAsProduct.push(
        `${s.id} — a subsystem called this already exists, so nothing was converted`,
      );
      continue;
    }

    if (isPart(s.id)) {
      const serves = [...callers(s.id)].sort();
      const notes: string[] = [];
      const offers = machine.map((e) => {
        const answer = slotText(e, "answer");
        const does = answer.length >= 10 ? answer : flat(e.title);
        const ref = `${s.id}#offers#${e.id}`;
        converted.add(`${s.id}#${e.id}`);
        out.report.capabilities.push(ref);
        if (!serves.length) out.report.servesNothing.push(ref);
        /** ⛔ Word for word what the capability cannot hold, so converting loses nothing. */
        const lines: string[] = [];
        for (const slot of Object.keys(e.slots)) {
          if (slot === "answer" && answer === does) continue;
          const t = slotText(e, slot);
          if (t) lines.push(`- ${slot}: ${t}`);
        }
        if (e.when?.triggered_by)
          lines.push(`- when: ${flat(e.when.triggered_by)}`);
        for (const c of e.criteria) {
          const parts = [
            c.given && `given ${flat(c.given)}`,
            c.when && `when ${flat(c.when)}`,
            c.then && `then ${flat(c.then)}`,
            c.steps && flat(c.steps),
          ].filter(Boolean);
          if (parts.length) lines.push(`- test ${c.id}: ${parts.join(", ")}`);
        }
        if (lines.length) notes.push(`### ${e.id}\n\n${lines.join("\n")}`);
        return { id: e.id, does, serves };
      });

      const inside =
        s.in && s.in !== root.scope.id && area.has(s.in) && isPart(s.in)
          ? s.in
          : undefined;
      const desc =
        firstParagraph(d.body) || flat(s.happy_path?.accomplishes ?? "");
      const does =
        desc.length >= 10
          ? desc
          : offers.length
            ? `Offers ${offers.map((o) => o.id.replace(/-/g, " ")).join(", ")}.`
            : `Groups ${
                carried
                  .filter((x) => x.scope.in === s.id)
                  .map((x) => x.scope.title)
                  .join(", ") || s.title
              }.`;
      const sub: Record<string, unknown> = { id: s.id, title: s.title, does };
      if (inside) sub.in = inside;
      const u = [...(uses.get(s.id) ?? [])].sort();
      if (u.length) sub.uses = u;
      if (offers.length) sub.offers = offers;
      const body = [
        d.body.trim(),
        notes.length
          ? `## Carried from the earlier capability tree, ${at}\n\n${notes.join("\n\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      out.put[`capabilities/${s.id}.md`] = write(sub, body);
      out.report.subsystems.push(s.id);
    }

    if (people.length) {
      /** ⛔ Somebody uses these, so they stay product truth — out of the area, which is going away. */
      const data = { ...d.data } as Record<string, unknown>;
      data.exchanges =
        (data.exchanges as Array<{ asked_by?: string }> | undefined)?.filter(
          (x) => x.asked_by === "person",
        ) ?? [];
      /** ⛔ Filed where the area was filed: the area is going away, and so is every container in it. */
      if (parentOutside) data.in = parentOutside;
      else delete data.in;
      out.put[d.key] = write(data, d.body);
      keptScopes.add(s.id);
      for (const e of people) out.report.keptAsProduct.push(`${s.id}#${e.id}`);
    } else out.deprecate.push(d.key);
  }
  if (!out.deprecate.includes(root.key) && !keptScopes.has(root.scope.id))
    out.deprecate.push(root.key);

  // ---- a feature's `depends_on` names the part now, in the part's own spelling ----
  const sub = new Set(out.report.subsystems);
  for (const d of product) {
    let moved = false;
    const deps = (d.data.depends_on as string[] | undefined) ?? [];
    const next = deps.map((dep) => {
      const [h, ex] = dep.split("#");
      if (!sub.has(h!)) return dep;
      let now: string;
      if (ex && converted.has(dep)) now = `${h}#offers#${ex}`;
      /** ⛔ A scope still standing as product truth still resolves, so its spelling is left alone. */ else if (
        keptScopes.has(h!)
      )
        return dep;
      else now = `${h}#offers`;
      out.report.respelled.push(`${d.key}: ${dep} → ${now}`);
      moved = true;
      return now;
    });
    if (moved) {
      /**
       * ⛔ IN PLACE, AND THE RESERIALISE IS THE FALLBACK — see `respellDependsOn`. A feature whose
       * only change is one dependency's spelling must come out byte-identical everywhere else, or
       * every requirement on it reads as older than a claim nobody reworded.
       */
      let edited: string | null = out.put[d.key] ?? files[d.key] ?? null;
      for (const one of out.report.respelled) {
        if (!one.startsWith(`${d.key}: `)) continue;
        const [was, now] = one.slice(d.key.length + 2).split(" → ");
        if (!edited || !was || !now) { edited = null; break; }
        const next = respellDependsOn(edited, was, now);
        if (next === null) { edited = null; break; }
        edited = next;
      }
      out.put[d.key] = edited ?? write({ ...d.data, depends_on: [...new Set(next)] }, d.body);
      if (!edited) out.report.reserialised.push(d.key);
    }
  }

  // ---- anything else still naming a converted ask by its old address ----
  for (const [key, source] of Object.entries(files)) {
    if (out.deprecate.includes(key)) continue;
    const text = out.put[key] ?? source;
    for (const ref of converted)
      if (
        new RegExp(
          `(^|[^\\w#-])${ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`,
        ).test(text)
      )
        out.report.stillNamed.push(`${key}: ${ref}`);
  }
  return out;
}
