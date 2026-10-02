/**
 * The root of an instance: which product are you looking at.
 *
 * Peter: *"we should probably layer in a project selector at the root of localhost:4100 for now"*.
 *
 * ⛔ BECAUSE A PROJECT ID IS NOT SOMETHING ANYBODY HOLDS IN THEIR HEAD. `/` answered 404, so the
 * only way in was a `prj-` id from a terminal — which makes the id the index, and an instance with
 * four corpora on it unusable without going back to the shell to remember which is which.
 *
 * ⛔ IT LISTS WHAT THE PRINCIPAL CAN REACH, THROUGH THE SAME SEAM AS EVERYTHING ELSE. A selector
 * that queried `projects` directly would be the one place a project can be seen without
 * `storeFor(...).project(id)` deciding — and a list is exactly where a leak is least visible,
 * because a name and a slug are already enough to tell somebody who your customers are.
 */
import http from "node:http";
import { eq, inArray, isNull, and, sql } from "drizzle-orm";
import { STYLE } from "../page.js";
import { type Db, storeFor } from "./access.js";
import { authIsOff, principalFrom } from "./identity.js";
import { documents, projects } from "./schema.js";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface ProjectCard {
  id: string;
  slug: string;
  name: string;
  documents: number;
  updatedAt: Date | null;
}

/**
 * The projects this principal may address, with enough to tell them apart.
 *
 * ⛔ COUNTS, NOT CORPORA. The obvious version calls `documents()` per project to count what is in
 * it, which fetches every byte of every corpus to render a number — 4MB for one of these. One
 * aggregate over the ids the seam already returned says the same thing in a single round trip.
 */
export async function cardsFor(db: Db, ids: string[]): Promise<ProjectCard[]> {
  if (!ids.length) return [];

  const [rows, counts] = await Promise.all([
    db
      .select({ id: projects.id, slug: projects.slug, name: projects.name })
      .from(projects)
      .where(inArray(projects.id, ids)),
    db
      .select({
        id: documents.projectId,
        n: sql<number>`count(*)`,
        updated: sql<Date>`max(${documents.updatedAt})`,
      })
      .from(documents)
      .where(and(inArray(documents.projectId, ids), isNull(documents.deprecatedAt)))
      .groupBy(documents.projectId),
  ]);

  const byId = new Map(counts.map((c) => [c.id, c]));
  return rows
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      documents: Number(byId.get(r.id)?.n ?? 0),
      updatedAt: byId.get(r.id)?.updated ? new Date(byId.get(r.id)!.updated) : null,
    }))
    /** Most recently touched first — on an instance with several, that is the one you want. */
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
}

const when = (d: Date | null): string => {
  if (!d) return "nothing in it yet";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export function chooseHtml(cards: ProjectCard[], opts: { authOff: boolean }): string {
  const list = cards.length
    ? cards
        .map(
          (c) => `<li class="pick">
  <a href="/p/${encodeURIComponent(c.id)}/v2">
    <span class="pick-name">${esc(c.name)}</span>
    <span class="pick-meta">${esc(c.slug)} · ${c.documents} document${c.documents === 1 ? "" : "s"} · ${esc(when(c.updatedAt))}</span>
  </a>
</li>`,
        )
        .join("\n")
    : /** ⛔ An empty instance says how to put something in it, rather than looking broken. */
      `<li class="pick pick-empty">
  <span class="pick-name">No projects yet</span>
  <span class="pick-meta">import a corpus: <code>make checkpoint FROM=&lt;corpus dir&gt;</code></span>
</li>`;

  /**
   * ⛔ AUTH OFF IS SAID ON THE PAGE, not only in a log nobody has open. Somebody looking at this
   * list is the person who most needs to know that anything reaching this port is treated as them.
   */
  const banner = opts.authOff
    ? `<p class="auth-off"><strong>Auth is off.</strong> Every request to this instance is treated as a
       signed-in person and every project is reachable. Verdicts recorded now are not provably human.</p>`
    : "";

  return `${STYLE}
<style>
  .chooser { max-width: 46rem; margin: 3rem auto; padding: 0 1.25rem; }
  .chooser h1 { margin: 0 0 .25rem; font-size: 1.5rem; }
  .chooser .sub { color: var(--dim); margin: 0 0 1.5rem; }
  .picks { list-style: none; padding: 0; margin: 0; display: grid; gap: .6rem; }
  .pick a { display: flex; flex-direction: column; gap: .2rem; padding: .85rem 1rem;
            border: 1px solid var(--line); border-radius: .5rem; background: var(--card);
            text-decoration: none; color: inherit; }
  .pick a:hover { border-color: var(--accent); }
  .pick-name { font-weight: 600; }
  .pick-meta { color: var(--dim); font-size: .85rem; }
  .pick-empty { padding: .85rem 1rem; border: 1px dashed var(--line); border-radius: .5rem; }
  .auth-off { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn);
              border-radius: .5rem; padding: .7rem .9rem; font-size: .85rem; margin: 0 0 1.25rem; }
</style>
<main class="chooser">
  <h1>ProductOS</h1>
  <p class="sub">${cards.length} ${cards.length === 1 ? "product" : "products"} on this instance.</p>
  ${banner}
  <ul class="picks">
${list}
  </ul>
</main>`;
}

/** `/` on an instance. Returns `false` for anything else, so it claims no route it does not own. */
export async function chooseRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  opts: { db: Db; localSession?: string },
): Promise<boolean> {
  if (pathname !== "/" && pathname !== "/projects") return false;

  const cookie = String(req.headers.cookie ?? "")
    .split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === "productos_session")?.[1];

  const who = await principalFrom(
    opts.db,
    req.headers as Record<string, string | undefined>,
    cookie ? decodeURIComponent(cookie) : opts.localSession,
  );

  if (!who) {
    /** ⛔ The same refusal the rest of the instance gives — a list is not a public page. */
    res.writeHead(401, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: false,
        why: "not signed in",
        detail: ["set PRODUCTOS_AUTH=off for local work, or bring a session"],
      }),
    );
    return true;
  }

  const ids = await storeFor(opts.db, who).reachable();
  const cards = await cardsFor(opts.db, ids);

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(chooseHtml(cards, { authOff: authIsOff() }));
  return true;
}

export { eq };
