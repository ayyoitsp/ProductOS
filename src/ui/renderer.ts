import { marked } from "marked";
import {
  AreaDocument,
  Behavior,
  FeatureDocument,
} from "../core/product.js";
import { BehaviorStatus, BehaviorTracking, FeatureTracking } from "../core/tracking.js";
import { FeedbackEntry } from "../core/feedback.js";

const SHELL_CSS = `
:root {
  --bg: #0f1115;
  --surface: #161922;
  --surface-2: #1d2230;
  --surface-3: #232838;
  --text: #e6e8ee;
  --dim: #8a93a6;
  --accent: #4f8cff;
  --green: #2ecc71;
  --yellow: #f5c518;
  --red: #ff4d4f;
  --blue: #4f8cff;
  --mono: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg); color: var(--text);
  font: 15px/1.55 -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
  display: grid; grid-template-columns: 280px 1fr; min-height: 100vh;
}
aside {
  background: var(--surface); border-right: 1px solid var(--surface-3);
  padding: 24px 16px; overflow-y: auto; max-height: 100vh; position: sticky; top: 0;
}
aside h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--dim); margin: 24px 0 8px; }
aside a { color: var(--text); text-decoration: none; display: block; padding: 4px 8px; border-radius: 6px; font-size: 13px; }
aside a:hover { background: var(--surface-2); color: var(--accent); }
aside a.active { background: var(--surface-2); color: var(--accent); }
aside .area { margin: 6px 0 14px; }
aside .area > .area-title { font-weight: 600; padding: 4px 8px; color: var(--text); }
aside .area .feat { padding-left: 14px; }

main { padding: 36px 48px; max-width: 920px; min-width: 0; }
header.feature { margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid var(--surface-3); }
.crumb { color: var(--dim); font-size: 12px; margin-bottom: 8px; }
.crumb a { color: var(--dim); text-decoration: none; }
.crumb a:hover { color: var(--text); }
h1 { font-size: 28px; margin: 0 0 12px; }
h2 { font-size: 19px; margin: 32px 0 12px; }
h3 { font-size: 16px; margin: 22px 0 10px; color: var(--dim); }

.meta { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; color: var(--dim); font-size: 12px; }
.meta .pill { padding: 2px 10px; border-radius: 999px; font-family: var(--mono); font-size: 11px; border: 1px solid var(--surface-3); }
.meta .pill.planned { color: var(--blue); border-color: rgba(79,140,255,0.4); }
.meta .pill.shipped { color: var(--green); border-color: rgba(46,204,113,0.4); }
.meta .pill.deprecated { color: var(--dim); }

.behavior {
  background: var(--surface); border: 1px solid var(--surface-3); border-radius: 12px;
  padding: 18px 22px; margin: 14px 0;
}
.behavior .head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.behavior .bid { font-family: var(--mono); font-size: 12px; color: var(--accent); }
.behavior .status {
  font-size: 11px; padding: 2px 10px; border-radius: 999px; border: 1px solid transparent; font-family: var(--mono);
}
.status-verified { color: var(--green); border-color: rgba(46,204,113,0.4); }
.status-proposed { color: var(--yellow); border-color: rgba(245,197,24,0.4); }
.status-planned { color: var(--blue); border-color: rgba(79,140,255,0.4); }
.status-stale { color: var(--yellow); border-color: rgba(245,197,24,0.4); }
.status-contested { color: var(--red); border-color: rgba(255,77,79,0.4); }
.status-deprecated { color: var(--dim); }
.status-unverified { color: var(--dim); border-color: var(--surface-3); }

.behavior .claim { font-size: 15px; line-height: 1.55; margin: 6px 0 12px; }
.behavior .verified-line { color: var(--dim); font-size: 12px; margin: 6px 0; }
.behavior .notes { color: var(--dim); font-size: 13px; margin-top: 12px; padding: 10px 12px; background: var(--surface-2); border-radius: 6px; }
.behavior .impl {
  color: var(--dim); font-size: 11px; font-family: var(--mono); margin-top: 10px;
  padding-top: 10px; border-top: 1px dashed var(--surface-3);
}
.behavior .impl-label { text-transform: uppercase; letter-spacing: 0.06em; color: var(--dim); margin-right: 8px; }

.actions { display: flex; gap: 8px; margin-top: 14px; align-items: center; flex-wrap: wrap; }
.actions button, .actions .toggle {
  background: var(--surface-2); border: 1px solid var(--surface-3); color: var(--text);
  padding: 6px 12px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 12px;
}
.actions button.primary { background: var(--accent); border-color: var(--accent); color: white; }
.actions button.primary:hover { filter: brightness(1.1); }
.actions button:hover { border-color: var(--accent); }
.actions button.danger { color: var(--red); }
.actions button.danger:hover { border-color: var(--red); }
.actions button:disabled { opacity: 0.5; cursor: wait; }

.feedback-form { margin-top: 12px; display: none; }
.feedback-form.open { display: block; }
.feedback-form textarea {
  width: 100%; min-height: 80px; background: var(--surface-2); color: var(--text);
  border: 1px solid var(--surface-3); border-radius: 6px; padding: 10px 12px;
  font: inherit; font-size: 13px; resize: vertical;
}
.feedback-form .row { display: flex; gap: 8px; margin-top: 8px; }
.feedback-form button { padding: 6px 14px; }

.toast {
  position: fixed; bottom: 24px; right: 24px; background: var(--surface);
  border: 1px solid var(--surface-3); padding: 10px 16px; border-radius: 8px;
  font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); opacity: 0; pointer-events: none;
  transition: opacity 0.15s ease;
}
.toast.show { opacity: 1; }

article.prose { color: var(--text); }
article.prose p { margin: 12px 0; }
article.prose ul, article.prose ol { margin: 12px 0; padding-left: 24px; }
article.prose code { background: var(--surface-2); padding: 1px 6px; border-radius: 4px; font-family: var(--mono); font-size: 13px; }
article.prose pre { background: var(--surface-2); padding: 14px 18px; border-radius: 8px; overflow-x: auto; }
article.prose pre code { background: transparent; padding: 0; font-size: 12px; }
article.prose a { color: var(--accent); }
article.prose hr { border: none; border-top: 1px solid var(--surface-3); margin: 24px 0; }
article.prose blockquote { border-left: 3px solid var(--surface-3); margin: 12px 0; padding: 4px 16px; color: var(--dim); }
article.prose img { max-width: 100%; border-radius: 8px; }

.empty-state { color: var(--dim); padding: 24px; }
.feedback-section { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--surface-3); }
.feedback-section h2 { margin-top: 0; }
`;

const APP_JS = `
async function action(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 200); }, 1800);
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const a = btn.dataset.action;
  const featureId = btn.dataset.feature;
  const behaviorId = btn.dataset.behavior;

  if (a === 'verify') {
    btn.disabled = true;
    await action('/api/verify', { feature: featureId, behavior: behaviorId });
    toast(behaviorId + ' verified');
    setTimeout(() => location.reload(), 400);
  } else if (a === 'contest') {
    const form = btn.closest('.behavior').querySelector('.feedback-form');
    form.classList.add('open');
    form.querySelector('input[name=action]').value = 'contest';
    form.querySelector('textarea').focus();
  } else if (a === 'feedback-toggle') {
    const form = btn.closest('article, section').querySelector('.feedback-form');
    form.classList.toggle('open');
    if (form.classList.contains('open')) form.querySelector('textarea').focus();
  } else if (a === 'feedback-cancel') {
    btn.closest('.feedback-form').classList.remove('open');
  } else if (a === 'feedback-submit') {
    const form = btn.closest('.feedback-form');
    const body = form.querySelector('textarea').value.trim();
    if (!body) { toast('write something first'); return; }
    const actType = form.querySelector('input[name=action]')?.value || 'feedback';
    btn.disabled = true;
    const res = await action('/api/feedback', {
      feature: featureId, behavior: behaviorId, body, action: actType,
    });
    if (res.ok) {
      toast(actType === 'contest' ? behaviorId + ' contested' : 'feedback queued');
      form.querySelector('textarea').value = '';
      form.classList.remove('open');
      if (actType === 'contest') setTimeout(() => location.reload(), 400);
    } else {
      toast('error: ' + (res.error || 'failed'));
    }
    btn.disabled = false;
  }
});
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
    <script>${APP_JS}</script>
  </body>
</html>`;
}

export function renderSidebar(areas: AreaDocument[], activeId?: string, openCount = 0): string {
  const parts: string[] = [
    `<a href="/" class="${activeId === "_root" ? "active" : ""}">📖 Overview</a>`,
    `<a href="/_feedback">💬 Feedback queue${openCount ? ` <span style="color:var(--yellow);font-family:var(--mono);font-size:11px;">(${openCount})</span>` : ""}</a>`,
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
    : `<article class="prose"><p>Browse the product truth by area below. Each area documents a slice of the product as a tree of feature pages.</p></article>`;
  const grid: string[] = [];
  for (const area of areas) {
    grid.push(`
      <a href="/${area.slug}/" style="display:block;background:var(--surface);border:1px solid var(--surface-3);border-radius:12px;padding:18px 20px;text-decoration:none;color:var(--text);margin:10px 0;">
        <div style="font-weight:600;font-size:15px;color:var(--accent);">${escape(area.title)}</div>
        <div style="color:var(--dim);font-size:11px;margin-top:8px;font-family:var(--mono);">${area.features.length} feature${area.features.length === 1 ? "" : "s"}</div>
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
    ${renderFeedbackSection(undefined, undefined, "Feedback")}
  `;
}

export function renderArea(area: AreaDocument): string {
  const bodyHtml = area.body ? (marked.parse(area.body) as string) : "";
  const cards = area.features
    .map(
      (f) => `
        <a href="${escape(f.url_path)}" style="display:block;background:var(--surface);border:1px solid var(--surface-3);border-radius:12px;padding:18px 20px;text-decoration:none;color:var(--text);margin:10px 0;">
          <div style="font-weight:600;font-size:15px;color:var(--accent);">${escape(f.frontmatter.title)}</div>
          <div style="color:var(--dim);font-size:12px;margin-top:6px;font-family:var(--mono);">${escape(f.frontmatter.id)}</div>
          <div style="color:var(--dim);font-size:12px;margin-top:6px;">
            <span class="pill ${f.frontmatter.status}">${f.frontmatter.status}</span>
            <span style="margin-left:10px;">${f.frontmatter.behaviors.length} behavior${f.frontmatter.behaviors.length === 1 ? "" : "s"}</span>
          </div>
        </a>`
    )
    .join("\n");
  return `
    <div class="crumb"><a href="/">Overview</a></div>
    <header class="feature">
      <h1>${escape(area.title)}</h1>
      <div class="meta"><span class="pill">${area.features.length} feature${area.features.length === 1 ? "" : "s"}</span></div>
    </header>
    <article class="prose">${bodyHtml}</article>
    ${area.features.length ? `<h2>Features</h2>${cards}` : `<div class="empty-state">No features in this area yet.</div>`}
    ${renderFeedbackSection(undefined, undefined, "Feedback on " + area.title)}
  `;
}

export function renderFeature(
  feature: FeatureDocument,
  area: AreaDocument | undefined,
  tracking: FeatureTracking | null
): string {
  const f = feature.frontmatter;
  const crumb = area
    ? `<div class="crumb"><a href="/">Overview</a> · <a href="/${area.slug}/">${escape(area.title)}</a></div>`
    : `<div class="crumb"><a href="/">Overview</a></div>`;
  const description = f.description
    ? `<article class="prose"><p>${escape(f.description)}</p></article>`
    : "";

  const implBlock = tracking?.implements?.length
    ? `<div class="meta" style="margin-top:8px;"><span style="color:var(--dim)">Implemented in:</span> ${tracking.implements.map((p) => `<code style="font-size:12px">${escape(p)}</code>`).join(" ")}</div>`
    : "";

  const behaviorBlocks = f.behaviors.length
    ? `<h2>Behaviors</h2>${f.behaviors.map((b) => renderBehavior(f.id, b, tracking?.behaviors[b.id])).join("\n")}`
    : `<div class="empty-state">No behaviors documented yet for this feature.</div>`;

  const bodyHtml = feature.body
    ? `<h2>Notes</h2><article class="prose">${marked.parse(feature.body) as string}</article>`
    : "";

  return `
    ${crumb}
    <header class="feature">
      <h1>${escape(f.title)}</h1>
      <div class="meta">
        <span class="pill ${f.status}">${f.status}</span>
        <span style="color:var(--dim)">id:</span>
        <code style="font-size:12px">${escape(f.id)}</code>
      </div>
      ${implBlock}
    </header>
    ${description}
    ${behaviorBlocks}
    ${bodyHtml}
    ${renderFeedbackSection(f.id, undefined, "Feedback on this feature")}
  `;
}

function renderBehavior(featureId: string, b: Behavior, t: BehaviorTracking | undefined): string {
  const status: BehaviorStatus | "unverified" = t?.status ?? "unverified";
  const claim = escape(b.claim);
  const verifiedLine = t?.last_verified
    ? `<div class="verified-line">Last verified ${escape(t.last_verified)}${t.verified_by ? " by " + escape(t.verified_by) : ""}</div>`
    : "";
  const impl =
    t?.code_refs?.length
      ? `<div class="impl"><span class="impl-label">Code:</span>${t.code_refs.map((r) => ` <code>${escape(r)}</code>`).join("")}</div>`
      : "";
  const notes = b.notes ? `<div class="notes">${escape(b.notes)}</div>` : "";
  return `
    <article class="behavior" id="${escape(b.id)}" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}">
      <div class="head">
        <span class="bid">${escape(b.id)}</span>
        <span class="status status-${status}">● ${status}</span>
      </div>
      <div class="claim">${claim}</div>
      ${verifiedLine}
      ${notes}
      ${impl}
      <div class="actions">
        <button class="primary" data-action="verify" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}">✓ Verify</button>
        <button class="danger" data-action="contest" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}">! Contest</button>
        <button data-action="feedback-toggle">💬 Feedback</button>
      </div>
      ${renderFeedbackForm(featureId, b.id)}
    </article>
  `;
}

function renderFeedbackForm(featureId: string, behaviorId?: string): string {
  return `
    <div class="feedback-form" data-feature="${escape(featureId)}"${behaviorId ? ` data-behavior="${escape(behaviorId)}"` : ""}>
      <textarea placeholder="What's wrong, missing, or unclear? Claude reads this queue and proposes edits."></textarea>
      <input type="hidden" name="action" value="feedback" />
      <div class="row">
        <button class="primary" data-action="feedback-submit" data-feature="${escape(featureId)}"${behaviorId ? ` data-behavior="${escape(behaviorId)}"` : ""}>Submit</button>
        <button data-action="feedback-cancel">Cancel</button>
      </div>
    </div>
  `;
}

function renderFeedbackSection(featureId?: string, behaviorId?: string, title = "Feedback"): string {
  return `
    <section class="feedback-section">
      <h2>${escape(title)}</h2>
      <p style="color:var(--dim);font-size:13px;">Drop a note for Claude. It lands in <code>productos/feedback/</code> and gets processed in a later session.</p>
      <button data-action="feedback-toggle">💬 Leave feedback</button>
      ${renderFeedbackForm(featureId ?? "", behaviorId)}
    </section>
  `;
}

export function renderFeedbackQueue(entries: FeedbackEntry[]): string {
  if (entries.length === 0) {
    return `
      <header class="feature"><h1>Feedback queue</h1></header>
      <div class="empty-state">No feedback yet.</div>
    `;
  }
  const groups = new Map<string, FeedbackEntry[]>();
  for (const e of entries) {
    const arr = groups.get(e.frontmatter.state) ?? [];
    arr.push(e);
    groups.set(e.frontmatter.state, arr);
  }
  const sections: string[] = [];
  for (const state of ["open", "claimed", "processed"]) {
    const arr = groups.get(state);
    if (!arr || arr.length === 0) continue;
    sections.push(`<h2 style="text-transform:capitalize">${state} (${arr.length})</h2>`);
    for (const e of arr) {
      const target = e.frontmatter.target.feature
        ? `<code>${escape(e.frontmatter.target.feature)}${e.frontmatter.target.behavior ? "#" + escape(e.frontmatter.target.behavior) : ""}</code>`
        : `<span style="color:var(--dim)">(no target)</span>`;
      sections.push(`
        <article class="behavior">
          <div class="head">
            <span class="bid">${escape(e.frontmatter.id)}</span>
            <span class="status status-${e.frontmatter.state}">● ${e.frontmatter.state}</span>
            <span style="color:var(--dim);font-size:12px;margin-left:auto;">${escape(e.frontmatter.created_at)}</span>
          </div>
          <div class="claim">${escape(e.body)}</div>
          <div class="meta" style="margin-top:8px;">
            <span style="color:var(--dim);">target:</span> ${target}
            <span style="color:var(--dim);margin-left:12px;">by:</span> ${escape(e.frontmatter.created_by)}
            <span style="color:var(--dim);margin-left:12px;">source:</span> ${escape(e.frontmatter.source)}
          </div>
        </article>
      `);
    }
  }
  return `
    <header class="feature">
      <h1>Feedback queue</h1>
      <div class="meta"><span class="pill">${entries.length} total</span></div>
    </header>
    <article class="prose">
      <p>Open entries are waiting for Claude (or someone) to interpret them and propose edits to product truth or tracking. Once handled, they transition to <code>processed</code>.</p>
    </article>
    ${sections.join("\n")}
  `;
}

function escape(s: string | undefined): string {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
