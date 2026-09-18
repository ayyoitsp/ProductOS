import { Hono } from "hono";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  behaviors,
  containers,
  contextItems,
  decisions,
  edges,
  elements,
  signals,
  surfaces,
  testCases,
  validations,
} from "../db/schema.js";
import { Layout, StatePill } from "./layout.js";
import { checkHumanSecret, endSession, requireSession, startSession } from "../lib/auth.js";
import { deriveState, hashClaim } from "../lib/state.js";

export const appRoutes = new Hono();

// --- sign in -----------------------------------------------------------------

appRoutes.get("/signin", (c) =>
  c.html(
    <Layout title="Sign in">
      <form class="signin" method="post" action="/app/signin">
        <h1>Sign in</h1>
        <p class="sub">Paste the human credential to author and validate.</p>
        <label for="secret">Human credential</label>
        <input id="secret" name="secret" type="password" autofocus autocomplete="off" />
        {c.req.query("err") ? <p class="err">That credential wasn't right.</p> : null}
        <p>
          <button class="primary" type="submit" style="margin-top:16px">
            Continue
          </button>
        </p>
        <p class="note">
          Agents hold a separate credential that can read and propose, but never validate.
        </p>
      </form>
    </Layout>,
  ),
);

appRoutes.post("/signin", async (c) => {
  const form = await c.req.parseBody();
  const secret = String(form.secret ?? "");
  if (!checkHumanSecret(secret)) return c.redirect("/app/signin?err=1");
  startSession(c, secret);
  return c.redirect("/app");
});

appRoutes.get("/signout", (c) => {
  endSession(c);
  return c.redirect("/app/signin");
});

// --- everything below requires a session ------------------------------------

appRoutes.use("/*", requireSession());

async function stateFor(containerId: string, behaviorId: string, claim: string) {
  const [vals, sigs] = await Promise.all([
    db
      .select()
      .from(validations)
      .where(
        and(eq(validations.containerId, containerId), eq(validations.behaviorId, behaviorId)),
      ),
    db
      .select()
      .from(signals)
      .where(and(eq(signals.containerId, containerId), eq(signals.behaviorId, behaviorId))),
  ]);
  return deriveState(await hashClaim(claim), vals, sigs);
}

async function resolve(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.select().from(containers).where(inArray(containers.id, ids));
  return rows.map((r) => ({ id: r.id, title: r.title }));
}

async function relationshipsFor(id: string) {
  const [out, incoming] = await Promise.all([
    db.select().from(edges).where(and(eq(edges.fromType, "container"), eq(edges.fromId, id))),
    db.select().from(edges).where(and(eq(edges.toType, "container"), eq(edges.toId, id))),
  ]);
  return {
    dependsOn: await resolve(out.filter((e) => e.kind === "depends_on").map((e) => e.toId)),
    dependedOnBy: await resolve(
      incoming.filter((e) => e.kind === "depends_on").map((e) => e.fromId),
    ),
    affects: await resolve(out.filter((e) => e.kind === "affected_by").map((e) => e.toId)),
  };
}

appRoutes.get("/", async (c) => {
  const rows = await db.select().from(containers).where(isNull(containers.deprecatedAt));
  const features = rows.filter((r) => r.kind === "feature");
  const caps = rows.filter((r) => r.kind === "capability");

  const Card = ({ r }: { r: (typeof rows)[number] }) => (
    <div class="card">
      <div class="row">
        <div class="grow">
          <h3>
            <a href={`/app/c/${r.id}`}>{r.title}</a>
          </h3>
          <div class="mono">{r.id}</div>
        </div>
        <span class="pill">{r.lifecycle}</span>
      </div>
    </div>
  );

  return c.html(
    <Layout title="Product truth">
      <h1>Product truth</h1>
      <p class="sub">What this product does, and how much of it we've confirmed.</p>

      <h2>Features</h2>
      {features.length ? features.map((r) => <Card r={r} />) : <p class="empty">None yet.</p>}

      <h2>Capabilities</h2>
      <p class="sub" style="margin-top:-6px">
        Promises other features depend on.
      </p>
      {caps.length ? caps.map((r) => <Card r={r} />) : <p class="empty">None yet.</p>}
    </Layout>,
  );
});

appRoutes.get("/c/:area/:slug", async (c) => {
  const id = `${c.req.param("area")}/${c.req.param("slug")}`;
  const [container] = await db.select().from(containers).where(eq(containers.id, id));
  if (!container) return c.notFound();

  const claims = await db
    .select()
    .from(behaviors)
    .where(and(eq(behaviors.containerId, id), isNull(behaviors.deprecatedAt)));

  const withState = await Promise.all(
    claims.map(async (b) => ({ b, state: await stateFor(id, b.id, b.claim) })),
  );
  const authored = withState.filter((x) => x.b.origin === "authored");
  const baseline = withState.filter((x) => x.b.origin === "baseline");

  // The graph is the point; make it walkable. Reverse traversal ("what relies
  // on this?") is the query a hierarchy can't answer, so it gets equal billing.
  const rel = await relationshipsFor(id);

  // Test cases are the acceptance criteria — a behavior without them states an
  // intent nobody can check.
  const cases = await db
    .select()
    .from(testCases)
    .where(and(eq(testCases.containerId, id), isNull(testCases.deprecatedAt)));

  // Surfaces this container's behaviors are anchored to. Surfaces are
  // top-level (one screen serves many features), so we resolve by anchor
  // rather than ownership.
  const anchoredIds = [...new Set(claims.map((b) => b.surfaceId).filter(Boolean))] as string[];

  // Walk `leads_to` outward from the anchored surfaces so the whole flow a
  // user can reach from this feature is shown, not just the screens a behavior
  // happens to be pinned to. One hop is enough to make a flow legible without
  // dragging in the entire app.
  const seed = anchoredIds.length
    ? await db.select().from(elements).where(inArray(elements.surfaceId, anchoredIds))
    : [];
  const reachable = [
    ...new Set([...anchoredIds, ...seed.map((e) => e.leadsTo).filter(Boolean) as string[]]),
  ];
  const surfaceRows = reachable.length
    ? await db.select().from(surfaces).where(inArray(surfaces.id, reachable))
    : [];
  const elementRows = reachable.length
    ? await db.select().from(elements).where(inArray(elements.surfaceId, reachable))
    : [];

  // Flow edges: surface --(element)--> surface
  const flow = elementRows
    .filter((e) => e.leadsTo && reachable.includes(e.leadsTo))
    .map((e) => ({ from: e.surfaceId, via: e.label ?? e.id, to: e.leadsTo! }));
  const titleOf = (sid: string) => surfaceRows.find((x) => x.id === sid)?.title ?? sid;

  const Behavior = ({ b, state }: { b: (typeof claims)[number]; state: string }) => (
    <div class="card" id={b.id}>
      <div class="row">
        <div class="grow">
          <div class="mono">
            {b.id}
            {b.surfaceId ? <span> · on <a href={`#surface-${b.surfaceId}`}>{b.surfaceId}</a>{b.elementId ? ` (${b.elementId})` : ""}</span> : null}
          </div>
          <p class="claim">{b.claim}</p>
          {(() => {
            const mine = cases.filter((t) => t.behaviorId === b.id).sort((x, y) => x.number - y.number);
            if (!mine.length) {
              return <p class="empty" style="font-size:13px;margin:8px 0 0">No acceptance criteria yet — an agent has nothing to check itself against.</p>;
            }
            return (
              <div style="margin-top:10px">
                <div class="mono" style="margin-bottom:4px">Acceptance</div>
                {mine.map((t) => (
                  <div style="font-size:13.5px;margin:3px 0">
                    <span class="mono">{t.number}.</span> {t.description}
                    {t.given || t.when || t.then ? (
                      <div class="mono" style="margin-left:18px">
                        {[t.given && `Given ${t.given}`, t.when && `When ${t.when}`, t.then && `Then ${t.then}`].filter(Boolean).join(" · ")}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
          <StatePill state={state} />
          {state !== "validated" && b.origin === "authored" ? (
            <form method="post" action={`/app/c/${id}/validate`}>
              <input type="hidden" name="behaviorId" value={b.id} />
              <button type="submit">Looks right</button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );

  return c.html(
    <Layout title={container.title}>
      <h1>{container.title}</h1>
      <p class="sub">
        <span class={`pill ${container.kind === "capability" ? "cap" : ""}`}>{container.kind}</span>{" "}
        <span class="mono">{container.id}</span>
      </p>

      {container.goal ? (
        <div class="card">
          <h3>Goal</h3>
          <p class="claim">{container.goal}</p>
        </div>
      ) : null}

      <h2>Behaviors</h2>
      {authored.length ? (
        authored.map((x) => <Behavior b={x.b} state={x.state} />)
      ) : (
        <p class="empty">Nothing authored yet.</p>
      )}

      {baseline.length ? (
        <>
          <h2>Seen in the codebase</h2>
          <p class="sub" style="margin-top:-6px">
            Imported for context. Not part of truth until you confirm it, and never handed to an
            agent.
          </p>
          {baseline.map((x) => (
            <div class="card">
              <div class="row">
                <div class="grow">
                  <div class="mono">
                    {x.b.id} · <span class="pill baseline">{x.b.originDetail ?? "baseline"}</span>
                  </div>
                  <p class="claim">{x.b.claim}</p>
                </div>
                <form method="post" action={`/app/c/${id}/adopt`}>
                  <input type="hidden" name="behaviorId" value={x.b.id} />
                  <button type="submit">Adopt</button>
                </form>
              </div>
            </div>
          ))}
        </>
      ) : null}

      {surfaceRows.length ? (
        <>
          <h2>Interface</h2>
          <p class="sub" style="margin-top:-6px">
            Where these behaviors happen. Structure only — what is on screen and where it sits,
            not how it looks.
          </p>

          {flow.length ? (
            <div class="card">
              <h3>Flow</h3>
              <p class="sub" style="margin:4px 0 12px">How a user moves between these screens.</p>
              <div class="flow">
                {flow.map((f) => (
                  <div class="flowrow">
                    <a class="flownode" href={`#surface-${f.from}`}>{titleOf(f.from)}</a>
                    <span class="flowarrow">
                      <span class="flowlabel">{f.via}</span>
                      <span>──▶</span>
                    </span>
                    <a class="flownode" href={`#surface-${f.to}`}>{titleOf(f.to)}</a>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {surfaceRows.map((sf) => {
            const els = elementRows.filter((e) => e.surfaceId === sf.id && !e.deprecatedAt);
            return (
              <div class="card" id={`surface-${sf.id}`}>
                <div class="row">
                  <div class="grow">
                    <h3>{sf.title}</h3>
                    <div class="mono">
                      {sf.id}
                      {sf.path ? ` · ${sf.path}` : ""}
                    </div>
                  </div>
                </div>
                {sf.sketchHtml ? (
                  <div style="margin:12px 0 0">
                    <div class="mono" style="margin-bottom:6px">Mock</div>
                    <iframe
                      class="mock"
                      sandbox=""
                      loading="lazy"
                      title={`${sf.title} mock`}
                      srcdoc={sf.sketchHtml}
                    />
                  </div>
                ) : null}
                {sf.sketch ? (
                  <details open={!sf.sketchHtml} style="margin:12px 0 0">
                    <summary class="mono" style="cursor:pointer">Structure</summary>
                    <pre style="white-space:pre;overflow-x:auto;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;line-height:1.45;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:12px;margin:8px 0 0">
                      {sf.sketch}
                    </pre>
                  </details>
                ) : null}
                {els.length ? (
                  <div style="margin-top:12px">
                    <div class="mono" style="margin-bottom:4px">Elements</div>
                    {els.map((e) => (
                      <div style="font-size:13.5px;margin:3px 0">
                        <span class="pill">{e.kind}</span> <strong>{e.label ?? e.id}</strong>{" "}
                        <span class="mono">{e.id}</span>
                        {e.leadsTo ? <span> → <a href={`#surface-${e.leadsTo}`}>{e.leadsTo}</a></span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </>
      ) : null}

      {rel.dependsOn.length || rel.dependedOnBy.length || rel.affects.length ? (
        <>
          <h2>Relationships</h2>
          {rel.dependsOn.length ? (
            <div class="card">
              <h3>Relies on</h3>
              <p class="sub" style="margin:4px 0 8px">
                Promises this is built against — changing them changes this.
              </p>
              {rel.dependsOn.map((r) => (
                <div>
                  <a href={`/app/c/${r.id}`}>{r.title}</a> <span class="mono">{r.id}</span>
                </div>
              ))}
            </div>
          ) : null}
          {rel.dependedOnBy.length ? (
            <div class="card">
              <h3>Relied on by</h3>
              <p class="sub" style="margin:4px 0 8px">
                Blast radius — these break if this promise changes.
              </p>
              {rel.dependedOnBy.map((r) => (
                <div>
                  <a href={`/app/c/${r.id}`}>{r.title}</a> <span class="mono">{r.id}</span>
                </div>
              ))}
            </div>
          ) : null}
          {rel.affects.length ? (
            <div class="card">
              <h3>Affected by</h3>
              {rel.affects.map((r) => (
                <div>
                  <a href={`/app/c/${r.id}`}>{r.title}</a> <span class="mono">{r.id}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      <h2>Handoff</h2>
      <div class="card">
        <div class="row">
          <div class="grow">
            <h3>Implementation packet</h3>
            <p class="sub" style="margin:4px 0 0">
              Validated behaviors, context, decisions, and what must not regress.
            </p>
          </div>
          <a class="btn" href={`/app/c/${id}/packet`}>
            View
          </a>
        </div>
      </div>
    </Layout>,
  );
});

appRoutes.post("/c/:area/:slug/validate", async (c) => {
  const id = `${c.req.param("area")}/${c.req.param("slug")}`;
  const form = await c.req.parseBody();
  const behaviorId = String(form.behaviorId);

  const [b] = await db
    .select()
    .from(behaviors)
    .where(and(eq(behaviors.containerId, id), eq(behaviors.id, behaviorId)));
  if (b) {
    await db.insert(validations).values({
      id: `v_${crypto.randomUUID()}`,
      containerId: id,
      behaviorId,
      provenance: "human",
      actor: "app",
      claimHash: await hashClaim(b.claim),
    });
  }
  return c.redirect(`/app/c/${id}`);
});

/** Promote a baseline claim into authored truth — the byproduct path. */
appRoutes.post("/c/:area/:slug/adopt", async (c) => {
  const id = `${c.req.param("area")}/${c.req.param("slug")}`;
  const form = await c.req.parseBody();
  await db
    .update(behaviors)
    .set({ origin: "authored", updatedAt: new Date() })
    .where(and(eq(behaviors.containerId, id), eq(behaviors.id, String(form.behaviorId))));
  return c.redirect(`/app/c/${id}`);
});

appRoutes.get("/c/:area/:slug/packet", async (c) => {
  const id = `${c.req.param("area")}/${c.req.param("slug")}`;
  const { buildPacket, renderPacketMarkdown } = await import("../lib/packet.js");
  const p = await buildPacket(id);
  if (!p) return c.notFound();
  return c.html(
    <Layout title={`Packet · ${p.title}`}>
      <h1>Implementation packet</h1>
      <p class="sub">
        <span class="mono">{id}</span> — hand this to an agent or an engineer.
      </p>
      <pre
        class="card"
        style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.6"
      >
        {renderPacketMarkdown(p)}
      </pre>
      <p>
        <a class="btn" href={`/api/packet/${id}?format=md`}>
          Raw markdown
        </a>
      </p>
    </Layout>,
  );
});

appRoutes.get("/context", async (c) => {
  const rows = await db.select().from(contextItems).where(isNull(contextItems.deprecatedAt));
  return c.html(
    <Layout title="Context">
      <h1>Product context</h1>
      <p class="sub">Read before anything else. Constrains every claim below it.</p>
      {rows.length ? (
        rows.map((r) => (
          <div class="card">
            <div class="row">
              <div class="grow">
                <h3>{r.title}</h3>
                <p class="claim">{r.body}</p>
              </div>
              <span class="pill">{r.kind.replace("_", "-")}</span>
            </div>
          </div>
        ))
      ) : (
        <p class="empty">Nothing captured yet.</p>
      )}
    </Layout>,
  );
});

appRoutes.get("/decisions", async (c) => {
  const rows = await db.select().from(decisions);
  return c.html(
    <Layout title="Decisions">
      <h1>Decisions</h1>
      <p class="sub">
        Why the product is the way it is. The record is immutable; the ruling can be revisited.
      </p>
      {rows.length ? (
        rows.map((d) => (
          <div class="card">
            <div class="row">
              <div class="grow">
                <h3>{d.title}</h3>
                <div class="mono">
                  {d.id} · {new Date(d.decidedOn).toISOString().slice(0, 10)}
                  {d.reaffirmed.length ? ` · reaffirmed ${d.reaffirmed.length}×` : ""}
                </div>
                <p class="claim">
                  <strong>Chosen:</strong> {d.chosen}
                </p>
                <p class="claim" style="color:var(--muted)">
                  <strong>Why:</strong> {d.context}
                </p>
                {d.alternatives.length ? (
                  <p class="claim" style="color:var(--muted)">
                    <strong>Considered:</strong> {d.alternatives.join(" · ")}
                  </p>
                ) : null}
              </div>
              <span class={`pill ${d.status === "active" ? "validated" : ""}`}>
                {d.status.replace("_", " ")}
              </span>
            </div>
          </div>
        ))
      ) : (
        <p class="empty">No decisions recorded yet.</p>
      )}
    </Layout>,
  );
});
