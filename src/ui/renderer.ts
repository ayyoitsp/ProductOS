import { marked } from "marked";
import {
  AreaDocument,
  Behavior,
  BehaviorStatus,
  Evidence,
  FeatureDocument,
} from "../core/product.js";

const SHELL_CSS = `
:root {
  --bg: #0f1115;
  --surface: #161922;
  --surface-2: #1d2230;
  --text: #e6e8ee;
  --dim: #8a93a6;
  --accent: #4f8cff;
  --green: #2ecc71;
  --yellow: #f5c518;
  --red: #ff4d4f;
  --blue: #4f8cff;
  --purple: #b07cff;
  --mono: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font: 15px/1.55 -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: 100vh;
}
aside {
  background: var(--surface);
  border-right: 1px solid #232838;
  padding: 24px 16px;
  overflow-y: auto;
  max-height: 100vh;
  position: sticky; top: 0;
}
aside h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--dim); margin: 24px 0 8px; }
aside a { color: var(--text); text-decoration: none; display: block; padding: 4px 8px; border-radius: 6px; font-size: 13px; }
aside a:hover { background: var(--surface-2); color: var(--accent); }
aside a.active { background: var(--surface-2); color: var(--accent); }
aside .area { margin: 6px 0 14px; }
aside .area > .area-title { font-weight: 600; padding: 4px 8px; color: var(--text); }
aside .area .feat { padding-left: 14px; }

main { padding: 36px 48px; max-width: 920px; min-width: 0; }
header.feature {
  margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #232838;
}
.crumb { color: var(--dim); font-size: 12px; margin-bottom: 8px; }
.crumb a { color: var(--dim); }
.crumb a:hover { color: var(--text); }
h1 { font-size: 28px; margin: 0 0 12px; }
h2 { font-size: 19px; margin: 32px 0 12px; }
h3 { font-size: 16px; margin: 22px 0 10px; color: var(--dim); }

.meta { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; color: var(--dim); font-size: 12px; }
.meta .pill { padding: 2px 10px; border-radius: 999px; font-family: var(--mono); font-size: 11px; border: 1px solid #2a3042; }
.meta .pill.planned { color: var(--blue); border-color: rgba(79,140,255,0.4); }
.meta .pill.shipped { color: var(--green); border-color: rgba(46,204,113,0.4); }
.meta .pill.deprecated { color: var(--dim); }

.behavior {
  background: var(--surface);
  border: 1px solid #232838;
  border-radius: 12px;
  padding: 18px 22px;
  margin: 14px 0;
}
.behavior .head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.behavior .bid { font-family: var(--mono); font-size: 12px; color: var(--accent); }
.behavior .status {
  font-size: 11px; padding: 2px 10px; border-radius: 999px; border: 1px solid transparent; font-family: var(--mono);
}
.behavior .status.verified { color: var(--green); border-color: rgba(46,204,113,0.4); }
.behavior .status.proposed { color: var(--yellow); border-color: rgba(245,197,24,0.4); }
.behavior .status.planned { color: var(--blue); border-color: rgba(79,140,255,0.4); }
.behavior .status.stale { color: var(--yellow); border-color: rgba(245,197,24,0.4); }
.behavior .status.contested { color: var(--red); border-color: rgba(255,77,79,0.4); }
.behavior .status.deprecated { color: var(--dim); }
.behavior .claim { font-size: 15px; line-height: 1.55; margin: 6px 0 14px; }
.behavior .verified-line { color: var(--dim); font-size: 12px; margin: 6px 0; }
.evidence { margin: 8px 0 0; padding: 0; list-style: none; }
.evidence li {
  font-family: var(--mono); font-size: 12px; color: var(--dim); padding: 4px 0;
  display: flex; gap: 8px; align-items: flex-start;
}
.evidence .ekind {
  background: var(--surface-2); padding: 1px 8px; border-radius: 4px;
  color: var(--text); font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
}
.behavior .notes { color: var(--dim); font-size: 13px; margin-top: 12px; padding: 10px 12px; background: var(--surface-2); border-radius: 6px; }

article.prose { color: var(--text); }
article.prose p { margin: 12px 0; }
article.prose ul, article.prose ol { margin: 12px 0; padding-left: 24px; }
article.prose code { background: var(--surface-2); padding: 1px 6px; border-radius: 4px; font-family: var(--mono); font-size: 13px; }
article.prose pre { background: var(--surface-2); padding: 14px 18px; border-radius: 8px; overflow-x: auto; }
article.prose pre code { background: transparent; padding: 0; font-size: 12px; }
article.prose a { color: var(--accent); }
article.prose hr { border: none; border-top: 1px solid #232838; margin: 24px 0; }
article.prose blockquote { border-left: 3px solid #2a3042; margin: 12px 0; padding: 4px 16px; color: var(--dim); }
article.prose img { max-width: 100%; border-radius: 8px; }

.empty-state { color: var(--dim); padding: 24px; }
`;

export function renderShell(title: string, body: string, sidebar: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escape(title)} — ProductOS</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${SHELL_CSS}</style>
  </head>
  <body>
    <aside>${sidebar}</aside>
    <main>${body}</main>
  </body>
</html>`;
}

export function renderSidebar(areas: AreaDocument[], activeId?: string): string {
  const parts: string[] = [
    `<a href="/" class="${activeId === "_root" ? "active" : ""}">📖 Overview</a>`,
    `<h2>Areas</h2>`,
  ];
  for (const area of areas) {
    parts.push(`<div class="area">`);
    parts.push(`<div class="area-title"><a href="/${area.slug}/">${escape(area.title)}</a></div>`);
    for (const f of area.features) {
      const active = activeId === f.frontmatter.id ? " active" : "";
      parts.push(`<a class="feat${active}" href="${escape(f.url_path)}">${escape(f.frontmatter.title)}</a>`);
    }
    parts.push(`</div>`);
  }
  return parts.join("\n");
}

export function renderHome(areas: AreaDocument[], topReadme?: string): string {
  const intro = topReadme
    ? `<article class="prose">${marked.parse(topReadme) as string}</article>`
    : `<article class="prose"><p>This is your product's truth. Each area below documents a slice of the product — its behaviors, code references, and verification status.</p></article>`;
  const grid: string[] = [];
  for (const area of areas) {
    const fcount = area.features.length;
    const summary = area.body
      ? (area.body.split("\n").find((l) => l.trim() && !l.startsWith("#")) ?? "")
      : "";
    grid.push(`
      <a href="/${area.slug}/" style="display:block;background:var(--surface);border:1px solid #232838;border-radius:12px;padding:18px 20px;text-decoration:none;color:var(--text);margin:10px 0;">
        <div style="font-weight:600;font-size:15px;color:var(--accent);">${escape(area.title)}</div>
        <div style="color:var(--dim);font-size:13px;margin-top:6px;">${escape(summary)}</div>
        <div style="color:var(--dim);font-size:11px;margin-top:8px;font-family:var(--mono);">${fcount} feature${fcount === 1 ? "" : "s"}</div>
      </a>`);
  }
  return `
    <header class="feature">
      <h1>Product Truth</h1>
      <div class="meta"><span class="pill">${areas.length} area${areas.length === 1 ? "" : "s"}</span></div>
    </header>
    ${intro}
    <h2>Areas</h2>
    ${grid.join("\n")}
  `;
}

export function renderArea(area: AreaDocument): string {
  const bodyHtml = area.body ? (marked.parse(area.body) as string) : "";
  const cards = area.features
    .map((f) => {
      const subtitle = f.frontmatter.behaviors.length
        ? `${f.frontmatter.behaviors.length} behavior${f.frontmatter.behaviors.length === 1 ? "" : "s"}`
        : "no behaviors yet";
      return `
        <a href="${escape(f.url_path)}" style="display:block;background:var(--surface);border:1px solid #232838;border-radius:12px;padding:18px 20px;text-decoration:none;color:var(--text);margin:10px 0;">
          <div style="font-weight:600;font-size:15px;color:var(--accent);">${escape(f.frontmatter.title)}</div>
          <div style="color:var(--dim);font-size:12px;margin-top:6px;font-family:var(--mono);">${escape(f.frontmatter.id)}</div>
          <div style="color:var(--dim);font-size:12px;margin-top:6px;">
            <span class="pill ${f.frontmatter.status}">${f.frontmatter.status}</span>
            <span style="margin-left:10px;">${subtitle}</span>
          </div>
        </a>`;
    })
    .join("\n");
  return `
    <div class="crumb"><a href="/">Overview</a></div>
    <header class="feature">
      <h1>${escape(area.title)}</h1>
      <div class="meta"><span class="pill">${area.features.length} feature${area.features.length === 1 ? "" : "s"}</span></div>
    </header>
    <article class="prose">${bodyHtml}</article>
    ${area.features.length ? `<h2>Features</h2>${cards}` : `<div class="empty-state">No features in this area yet.</div>`}
  `;
}

export function renderFeature(feature: FeatureDocument, area?: AreaDocument): string {
  const f = feature.frontmatter;
  const crumb = area
    ? `<div class="crumb"><a href="/">Overview</a> · <a href="/${area.slug}/">${escape(area.title)}</a></div>`
    : `<div class="crumb"><a href="/">Overview</a></div>`;
  const ownersStr = f.owners.length ? f.owners.join(", ") : "—";
  const implementsBlock = f.implements.length
    ? `<div class="meta" style="margin-top:8px;"><span style="color:var(--dim)">Implements:</span> ${f.implements
        .map((p) => `<code style="font-size:12px">${escape(p)}</code>`)
        .join(" ")}</div>`
    : "";
  const related = f.related.length
    ? `<div class="meta" style="margin-top:8px;"><span style="color:var(--dim)">Related:</span> ${f.related
        .map((id) => `<a href="/${escape(id)}">${escape(id)}</a>`)
        .join(" · ")}</div>`
    : "";

  const behaviorBlocks = f.behaviors.length
    ? `<h2>Behaviors</h2>${f.behaviors.map(renderBehavior).join("\n")}`
    : `<div class="empty-state">No behaviors documented yet for this feature.</div>`;

  const bodyHtml = feature.body ? `<h2>Notes</h2><article class="prose">${marked.parse(feature.body) as string}</article>` : "";

  return `
    ${crumb}
    <header class="feature">
      <h1>${escape(f.title)}</h1>
      <div class="meta">
        <span class="pill ${f.status}">${f.status}</span>
        <span style="color:var(--dim)">id:</span>
        <code style="font-size:12px">${escape(f.id)}</code>
        <span style="color:var(--dim);margin-left:14px;">owners:</span> ${escape(ownersStr)}
      </div>
      ${implementsBlock}
      ${related}
    </header>
    ${behaviorBlocks}
    ${bodyHtml}
  `;
}

function renderBehavior(b: Behavior): string {
  const claim = escape(b.claim);
  const verifiedLine = b.last_verified
    ? `<div class="verified-line">Last verified ${escape(b.last_verified)}${b.verified_by ? " by " + escape(b.verified_by) : ""}</div>`
    : "";
  const evidence = b.evidence.length
    ? `<ul class="evidence">${b.evidence.map(renderEvidence).join("")}</ul>`
    : "";
  const notes = b.notes ? `<div class="notes">${escape(b.notes)}</div>` : "";
  return `
    <article class="behavior" id="${escape(b.id)}">
      <div class="head">
        <span class="bid">${escape(b.id)}</span>
        <span class="status ${b.status}">${statusLabel(b.status)}</span>
      </div>
      <div class="claim">${claim}</div>
      ${verifiedLine}
      ${evidence}
      ${notes}
    </article>
  `;
}

function renderEvidence(e: Evidence): string {
  const kind = `<span class="ekind">${e.kind}</span>`;
  let detail = "";
  if (e.kind === "code" && e.ref) detail = `<code>${escape(e.ref)}</code>`;
  else if (e.kind === "narrative" && e.body) detail = `<span style="color:var(--text);font-family:inherit">${escape(e.body)}</span>`;
  else if (e.ref) detail = `<code>${escape(e.ref)}</code>`;
  else if (e.path) detail = `<code>${escape(e.path)}</code>`;
  if (e.description) detail += ` <span style="color:var(--dim)">— ${escape(e.description)}</span>`;
  return `<li>${kind}<span>${detail}</span></li>`;
}

function statusLabel(s: BehaviorStatus): string {
  const map: Record<BehaviorStatus, string> = {
    verified: "● verified",
    proposed: "● proposed",
    planned: "● planned",
    stale: "● stale",
    contested: "● contested",
    deprecated: "● deprecated",
  };
  return map[s];
}

function escape(s: string | undefined): string {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
