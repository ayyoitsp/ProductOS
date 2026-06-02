import { marked } from "marked";
import {
  AreaDocument,
  Behavior,
  Element,
  FeatureDocument,
  Surface,
} from "../core/product.js";
import { BehaviorTracking, FeatureTracking } from "../core/tracking.js";
import { FeedbackEntry } from "../core/feedback.js";
import { ContextDocument } from "../core/context.js";
import { derivedVerification, DerivedVerification } from "../core/derived-state.js";

const SHELL_CSS = `
:root {
  /* Light mode (default) */
  --bg: #fbfbfc;
  --surface: #ffffff;
  --surface-2: #f3f4f7;
  --surface-3: #e4e6eb;
  --text: #1f2329;
  --dim: #6b7280;
  --accent: #2563eb;
  --green: #16a34a;
  --yellow: #ca8a04;
  --red: #dc2626;
  --blue: #2563eb;
  --mono: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root.system-theme {
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
  }
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
aside .sidebar-top { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
aside .sidebar-top .brand { flex: 1; }
aside .sidebar-top .refresh {
  background: transparent; border: 1px solid var(--surface-3); color: var(--dim);
  width: 30px; height: 30px; border-radius: 6px; cursor: pointer; font-size: 14px;
  padding: 0; display: flex; align-items: center; justify-content: center;
  font-family: var(--mono);
}
aside .sidebar-top .refresh:hover { color: var(--accent); border-color: var(--accent); }
aside .sidebar-top .refresh.spinning { animation: spin 0.6s linear; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
aside h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--dim); margin: 24px 0 8px; padding: 0 8px; }
aside a { color: var(--text); text-decoration: none; display: block; padding: 5px 10px; border-radius: 6px; font-size: 13px; }
aside a:hover { background: var(--surface-2); color: var(--accent); }
aside a.active { background: var(--surface-2); color: var(--accent); }
aside .area { margin: 4px 0 12px; }
aside .area > .area-title { font-weight: 600; padding: 5px 10px; color: var(--text); font-size: 13px; display: flex; align-items: center; gap: 6px; }
aside .area > .area-title::before { content: "▸"; color: var(--dim); font-size: 10px; }
aside .area > .area-title a { padding: 0; color: var(--text); }
aside .area > .area-title a:hover { background: transparent; }
aside .area .feat-list { border-left: 2px solid var(--surface-3); margin-left: 17px; padding-left: 4px; margin-top: 2px; }
aside .area .feat { padding-left: 12px; color: var(--dim); font-size: 12.5px; }
aside .area .feat.active { color: var(--accent); }

main { padding: 36px 48px; max-width: 920px; min-width: 0; }
header.feature { margin-bottom: 24px; }
header.feature .feature-title-row { display: flex; align-items: baseline; gap: 16px; margin-bottom: 4px; }
header.feature .feature-title-row h1 { margin: 0; flex: 0 0 auto; }
header.feature .feature-title-row .feature-id { color: var(--dim); font-family: var(--mono); font-size: 13px; flex: 1 1 auto; }
header.feature .feature-title-row .feature-status { flex: 0 0 auto; }

.section-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 32px 0 12px; }
.section-head h2 { margin: 0; }
.section-head .rollup { margin: 0; }
.crumb { color: var(--dim); font-size: 12px; margin-bottom: 8px; }
.crumb a { color: var(--dim); text-decoration: none; }
.crumb a:hover { color: var(--text); }
h1 { font-size: 28px; margin: 0 0 12px; }
h2 { font-size: 19px; margin: 32px 0 12px; }
h3 { font-size: 16px; margin: 22px 0 10px; color: var(--dim); }

.meta { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; color: var(--dim); font-size: 12px; }

/* Unified pill/chip — used by feature status, behavior derived state, etc.
   Unscoped so it works in headers, behavior cards, anywhere. */
.pill { padding: 2px 10px; border-radius: 999px; font-family: var(--mono); font-size: 11px; border: 1px solid var(--surface-3); color: var(--text); background: transparent; display: inline-block; line-height: 1.5; }
.pill.planned { color: var(--blue); border-color: rgba(79,140,255,0.4); }
.pill.shipped { color: var(--green); border-color: rgba(46,204,113,0.4); }
.pill.deprecated { color: var(--dim); }

.behavior {
  background: var(--surface); border: 1px solid var(--surface-3); border-radius: 12px;
  padding: 18px 22px; margin: 14px 0;
}
.behavior .head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; justify-content: space-between; }
.behavior .head .bid { font-family: var(--mono); font-size: 12px; color: var(--accent); flex: 1 1 auto; }
.behavior .head .status { flex: 0 0 auto; }
/* Derived-state pill for behavior cards. Same chip shape as .pill above. */
.behavior .status {
  font-size: 11px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--surface-3);
  font-family: var(--mono); display: inline-block; line-height: 1.5;
}
.status-verified { color: var(--green); border-color: rgba(46,204,113,0.4); }
.status-proposed { color: var(--yellow); border-color: rgba(245,197,24,0.4); }
.status-planned { color: var(--blue); border-color: rgba(79,140,255,0.4); }
.status-stale { color: var(--yellow); border-color: rgba(245,197,24,0.4); }
.status-contested { color: var(--red); border-color: rgba(255,77,79,0.4); }
.status-deprecated { color: var(--dim); }
.status-unverified { color: var(--dim); border-color: var(--surface-3); }
.status-orphan { color: #d39a3e; border-color: rgba(211,154,62,0.45); }
.status-uncertain { color: #c39bff; border-color: rgba(195,155,255,0.45); }

.evidence { margin-top: 14px; padding: 12px 14px; background: var(--surface-2); border-radius: 8px; font-size: 13px; color: var(--dim); }
.evidence .ev-row { display: flex; gap: 12px; align-items: flex-start; margin: 6px 0; }
.evidence .ev-label { color: var(--dim); width: 84px; flex-shrink: 0; text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.06em; padding-top: 3px; }
.evidence .ev-empty { color: var(--dim); font-style: italic; font-size: 12.5px; }
.evidence .ev-pass { color: var(--green); }
.evidence .ev-fail { color: var(--red); }
.evidence .ev-skip { color: var(--dim); }
.evidence .ev-pending { color: var(--yellow); }
.evidence code { font-size: 11.5px; background: var(--surface); padding: 1px 5px; border-radius: 3px; }

.tc-list { display: flex; flex-direction: column; gap: 10px; flex: 1; }
.tc { background: var(--surface); border: 1px solid var(--surface-3); border-radius: 6px; padding: 10px 12px; }
.tc-head { display: flex; gap: 10px; align-items: center; font-size: 11.5px; }
.tc-id { font-family: var(--mono); color: var(--dim); }
.tc-level { font-family: var(--mono); font-size: 10.5px; padding: 1px 6px; border-radius: 3px; background: var(--surface-2); border: 1px solid var(--surface-3); color: var(--accent); }
.tc-status { font-family: var(--mono); font-size: 11px; }
.tc-when { font-family: var(--mono); font-size: 10.5px; color: var(--dim); margin-left: 4px; }
.tc-desc { color: var(--text); margin: 6px 0 2px; font-size: 13px; }
.tc-detail { margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--surface-3); font-size: 12px; color: var(--text); }
.tc-line { display: flex; gap: 10px; margin: 2px 0; }
.tc-key { font-family: var(--mono); font-size: 10.5px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.06em; width: 50px; flex-shrink: 0; padding-top: 1px; }
.tc-steps { margin: 4px 0 0; font-family: var(--mono); font-size: 11.5px; white-space: pre-wrap; background: var(--surface-2); padding: 6px 10px; border-radius: 4px; }
.tc-coverage { margin-top: 6px; font-size: 11.5px; color: var(--dim); }
.tc-coverage code { font-size: 10.5px; }

.surfaces { display: flex; flex-direction: column; gap: 18px; margin: 14px 0 28px; }
.surface { background: var(--surface); border: 1px solid var(--surface-3); border-radius: 10px; padding: 16px 18px; }
.surface-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.surface-head h3 { font-size: 16px; margin: 0; color: var(--text); }
/* surface-path-wrap / .surface-path styles removed — path is not rendered. */
.surface-count { font-size: 11.5px; color: var(--dim); margin-left: auto; }
.surface-count-empty { color: var(--yellow); font-style: italic; }
.surface-sketch {
  font-family: var(--mono); font-size: 12px; line-height: 1.4;
  background: var(--surface-2); border: 1px solid var(--surface-3); border-radius: 6px;
  padding: 12px 14px; margin: 8px 0; overflow-x: auto; white-space: pre;
}
/* Sketch element decorations — purely visual, no layout impact (use inline). */
.surface-sketch .sketch-button { color: var(--accent); font-weight: 600; }
.surface-sketch .sketch-input { color: var(--dim); }
.surface-sketch .sketch-checkbox { color: var(--accent); }
.surface-sketch .sketch-dropdown { color: var(--accent); }
.surface-sketch .sketch-textlink { color: var(--blue); }
/* Whole-pattern anchor wrap: the brackets themselves are part of the clickable
   region, so the button reads as a real button. The at-rest treatment uses a
   subtle dotted underline so it's visibly clickable even before hover. */
.surface-sketch a.sketch-anchor {
  text-decoration: underline; text-decoration-style: dotted;
  text-decoration-thickness: 1px; text-underline-offset: 3px;
  text-decoration-color: rgba(37, 99, 235, 0.45);
  cursor: pointer;
}
.surface-sketch a.sketch-anchor:hover { background: rgba(37, 99, 235, 0.12); border-radius: 3px; text-decoration-style: solid; }
.surface-sketch a.sketch-anchor:hover .sketch-button { filter: brightness(1.15); }
.surface-sketch a.sketch-anchor:hover .sketch-textlink { filter: brightness(1.15); }

/* Card / list-item rows. The ▢ or ▦ symbol is colored distinctively so the
   card pattern is identifiable even without a leads_to. When leads_to is set,
   the row is wrapped in sketch-anchor (above) and the whole row becomes
   click-targetable; sketch-card-text gets a subtle treatment too. */
.surface-sketch .sketch-card-glyph { color: var(--accent); font-weight: 600; }
.surface-sketch a.sketch-card-row .sketch-card-text { color: var(--text); }
.surface-sketch a.sketch-card-row:hover .sketch-card-glyph { filter: brightness(1.2); }
/* element-pill row removed — sketch is the canonical element view now */
.surface-notes { margin-top: 10px; color: var(--dim); font-size: 12.5px; padding: 8px 10px; background: var(--surface-2); border-radius: 4px; }
.surface-behaviors { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--surface-3); display: flex; flex-direction: column; gap: 12px; }
.surface-behaviors .behavior { margin: 0; }

.behavior .anchor-strip { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--dim); margin: 4px 0 8px; flex-wrap: wrap; }
.behavior .anchor-strip a { color: var(--accent); text-decoration: none; font-family: var(--mono); }
.behavior .anchor-strip a:hover { text-decoration: underline; }
.behavior .anchor-strip .arr { color: var(--surface-3); }
.behavior .anchor-strip .interaction { font-family: var(--mono); padding: 1px 6px; border-radius: 3px; background: var(--surface-2); color: var(--text); font-size: 10.5px; }
.behavior .anchor-strip .element-ref code { font-family: var(--mono); font-size: 11px; color: var(--accent); background: var(--surface-2); padding: 1px 5px; border-radius: 3px; }

.affected-by { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 12px; }
.affected-by-label { font-size: 11.5px; color: var(--dim); text-transform: uppercase; letter-spacing: 0.06em; }
.affected-by-pill { background: var(--surface-2); border: 1px solid var(--surface-3); border-radius: 999px; padding: 3px 10px; text-decoration: none; font-size: 11.5px; color: var(--accent); }
.affected-by-pill:hover { border-color: var(--accent); background: var(--surface); }
.affected-by-pill code { font-family: var(--mono); font-size: 11px; color: inherit; background: transparent; padding: 0; }

.rollup { display: flex; gap: 12px; margin: 12px 0 20px; flex-wrap: wrap; }
.rollup .chip { background: var(--surface); border: 1px solid var(--surface-3); border-radius: 999px; padding: 4px 12px; font-size: 12px; font-family: var(--mono); color: var(--dim); }
.rollup .chip strong { color: var(--text); margin-right: 4px; }
.rollup .chip.verified strong { color: var(--green); }
.rollup .chip.contested strong { color: var(--red); }
.rollup .chip.orphan strong { color: #d39a3e; }
.rollup .chip.uncertain strong { color: #c39bff; }
.rollup .chip.unverified strong { color: var(--yellow); }

.behavior .reason { font-size: 11px; color: var(--dim); font-style: italic; margin-top: 2px; }
.edit-form { display: none; margin-top: 10px; }
.edit-form.open { display: block; }
.edit-form textarea { width: 100%; min-height: 70px; background: var(--surface-2); color: var(--text); border: 1px solid var(--surface-3); border-radius: 6px; padding: 8px 10px; font: inherit; font-size: 13px; resize: vertical; }
.edit-form .row { display: flex; gap: 8px; margin-top: 6px; }

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
article.prose.context h2 { scroll-margin-top: 80px; }
article.prose.context .anchor { color: var(--dim); text-decoration: none; font-weight: 400; margin-right: 6px; }
article.prose.context .anchor:hover { color: var(--accent); }
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

  if (a === 'refresh') {
    btn.classList.add('spinning');
    location.reload();
    return;
  } else if (a === 'verify') {
    btn.disabled = true;
    await action('/api/verify', { feature: featureId, behavior: behaviorId });
    toast(behaviorId + ' accepted');
    setTimeout(() => location.reload(), 400);
  } else if (a === 'reject') {
    const reason = prompt('Reason for rejecting "' + behaviorId + '"? (will be saved as deprecated_reason)') || '';
    if (reason === '') return;
    btn.disabled = true;
    await action('/api/reject', { feature: featureId, behavior: behaviorId, reason });
    toast(behaviorId + ' rejected');
    setTimeout(() => location.reload(), 400);
  } else if (a === 'edit-toggle') {
    const form = btn.closest('.behavior').querySelector('.edit-form');
    form.classList.toggle('open');
    if (form.classList.contains('open')) form.querySelector('textarea[name=claim]').focus();
  } else if (a === 'edit-cancel') {
    btn.closest('.edit-form').classList.remove('open');
  } else if (a === 'edit-save') {
    const form = btn.closest('.edit-form');
    const claim = form.querySelector('textarea[name=claim]').value.trim();
    const notes = form.querySelector('textarea[name=notes]').value.trim();
    if (claim.length < 10) { toast('claim too short'); return; }
    btn.disabled = true;
    const res = await action('/api/edit-behavior', { feature: featureId, behavior: behaviorId, claim, notes });
    if (res.ok) {
      toast(behaviorId + ' updated');
      setTimeout(() => location.reload(), 400);
    } else {
      toast('error: ' + (res.error || 'failed'));
      btn.disabled = false;
    }
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

/**
 * Filter out the scaffolded "example" area once there are real (non-example)
 * areas. Until the user has real content, the example helps; after, it's noise.
 */
export function visibleAreas(areas: AreaDocument[]): AreaDocument[] {
  const real = areas.filter((a) => a.slug !== "example");
  return real.length > 0 ? real : areas;
}

export function renderSidebar(
  areas: AreaDocument[],
  contextDocs: ContextDocument[],
  activeId?: string,
  openCount = 0
): string {
  const visible = visibleAreas(areas);
  const parts: string[] = [
    `<div class="sidebar-top">
      <a href="/" class="brand ${activeId === "_root" ? "active" : ""}">📖 Overview</a>
      <button class="refresh" data-action="refresh" title="Reload — picks up markdown/tracking edits from disk">↻</button>
    </div>`,
    `<a href="/_feedback" class="${activeId === "_feedback" ? "active" : ""}">💬 Feedback queue${openCount ? ` <span style="color:var(--yellow);font-family:var(--mono);font-size:11px;">(${openCount})</span>` : ""}</a>`,
  ];
  if (contextDocs.length) {
    const active = activeId === "_context" ? " active" : "";
    parts.push(`<a class="${active}" href="/_context">🧭 Strategy</a>`);
  }
  if (visible.length) {
    parts.push(`<h2>Areas</h2>`);
    for (const area of visible) {
      parts.push(`<div class="area">`);
      parts.push(`<div class="area-title"><a href="/${area.slug}/">${escape(area.title)}</a></div>`);
      if (area.features.length > 0) {
        parts.push(`<div class="feat-list">`);
        for (const f of area.features) {
          const active = activeId === f.frontmatter.id ? " active" : "";
          parts.push(`<a class="feat${active}" href="${escape(f.url_path)}">${escape(f.frontmatter.title)}</a>`);
        }
        parts.push(`</div>`);
      }
      parts.push(`</div>`);
    }
  }
  return parts.join("\n");
}

export function renderContextDoc(doc: ContextDocument, all: ContextDocument[]): string {
  // Anchor every h2 heading by slug so other docs can cite e.g. `principles#numbers-feel-rewarding`.
  // marked emits <h2>X</h2>; we post-process to inject ids.
  const html = String(marked.parse(doc.body)).replace(
    /<h2>([\s\S]*?)<\/h2>/g,
    (_match, inner: string) => {
      const slug = slugify(stripTags(inner));
      return `<h2 id="${slug}"><a href="#${slug}" class="anchor">#</a> ${inner}</h2>`;
    }
  );
  return `
    <div class="crumb"><a href="/">Overview</a> · Strategy</div>
    <header class="feature">
      <h1>${escape(doc.title)}</h1>
      <div class="meta"><span class="pill">${doc.name}</span></div>
    </header>
    <article class="prose context">${html}</article>
  `;
}

export function renderContextIndex(docs: ContextDocument[]): string {
  if (docs.length === 0) {
    return `
      <header class="feature"><h1>Strategy</h1></header>
      <div class="empty-state">No strategy documents yet. Run <code>productos init claude</code> — it scaffolds empty <code>productos/context/*.md</code> files for goals, principles, personas, etc.</div>
    `;
  }

  // Combine all context docs into ONE page with section anchors per doc.
  // Each doc becomes an h2 (doc.name as anchor); each doc's own h2 headings
  // become h3 inside it so the hierarchy is consistent and items remain
  // citeable as e.g. `principles#numbers-feel-rewarding`.
  const tocLines = docs.map(
    (d) => `<a href="#${escape(d.name)}" style="display:inline-block;margin-right:14px;font-size:13px;color:var(--accent);text-decoration:none;">${escape(d.title)}</a>`
  );
  const sections = docs.map((d) => {
    // Render the doc's body, but bump every h2 → h3 (since the doc title is now an h2)
    // and add anchor ids derived from the heading text, prefixed with the doc name
    // so cross-doc refs like `principles#numbers-feel-rewarding` work.
    const bodyHtml = String(marked.parse(d.body))
      .replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner: string) => {
        const slug = slugify(stripTags(inner));
        return `<h3 id="${escape(d.name)}-${slug}"><a href="#${escape(d.name)}-${slug}" class="anchor">#</a> ${inner}</h3>`;
      });
    return `
      <section>
        <h2 id="${escape(d.name)}"><a href="#${escape(d.name)}" class="anchor">#</a> ${escape(d.title)}</h2>
        ${bodyHtml}
      </section>`;
  });

  return `
    <header class="feature">
      <h1>Strategy</h1>
      <div class="meta"><span class="pill">${docs.length} document${docs.length === 1 ? "" : "s"}</span></div>
    </header>
    <article class="prose"><p>The overarching layer above features — goals, design principles, personas, non-goals, voice. Read these before proposing or vetting any feature; they constrain every decision below.</p></article>
    <nav class="strategy-toc" style="margin:18px 0 28px;padding:10px 14px;background:var(--surface-2);border-radius:8px;">${tocLines.join("")}</nav>
    <article class="prose context">${sections.join("\n")}</article>
  `;
}

/**
 * Render an ASCII surface sketch with:
 *   - Visual highlighting for [ Button ], <Link>, [_input_], etc.
 *   - Clickable navigation for any element with `leads_to` set, where the
 *     ENTIRE bracket pattern (not just the inner text) is the click target.
 */
function decorateSketch(sketch: string, elements: Element[]): string {
  const cleaned = sketch.replace(/^\n+|\n+$/g, "");
  const escaped = escape(cleaned);

  // Build a label → leads_to map for O(1) lookups when matching patterns.
  // Keyed by lowercased label so "Edit" matches "<Edit>" or "[ Edit ]".
  type LinkInfo = { target: string; leadsTo: string };
  const linkByLabel = new Map<string, LinkInfo>();
  for (const el of elements) {
    if (!el.leads_to || !el.label) continue;
    const target = resolveLeadsTo(el.leads_to);
    if (target) linkByLabel.set(el.label.toLowerCase(), { target, leadsTo: el.leads_to });
  }

  const lookupLink = (innerText: string): LinkInfo | null => {
    const t = innerText.toLowerCase().trim();
    if (linkByLabel.has(t)) return linkByLabel.get(t)!;
    // Fallback: contains/contained-by match for buttons like "+ Add a kid"
    // where the sketch text "+ Add a kid" contains the label "Add a kid".
    for (const [label, info] of linkByLabel) {
      if (t.includes(label) || label.includes(t)) return info;
    }
    return null;
  };

  // Pattern decoration. The ENTIRE bracket pattern becomes the click target
  // when it matches an element with leads_to — so the brackets themselves
  // light up on hover, not just the inner text. This makes the sketch read
  // like a real interface: you click the button, not the label.
  let html = escaped;

  html = html.replace(
    /\[(\s*[^\[\]\n][^\[\]\n]*?\s*)\]/g,
    (match, inner: string) => {
      const trimmed = inner.trim();
      let cls = "sketch-button";
      if (/^_+$/.test(trimmed)) cls = "sketch-input";
      else if (/^[\s✓✗xX]$/.test(trimmed)) cls = "sketch-checkbox";
      else if (/▼$/.test(trimmed)) cls = "sketch-dropdown";

      const link = lookupLink(trimmed);
      const styled = `<span class="${cls}">${match}</span>`;
      return link
        ? `<a class="sketch-anchor" href="${escape(link.target)}" title="goes to ${escape(link.leadsTo)}">${styled}</a>`
        : styled;
    }
  );

  html = html.replace(
    /&lt;([^&\n]{1,40}?)&gt;/g,
    (_match, inner: string) => {
      const link = lookupLink(inner);
      const styled = `<span class="sketch-textlink">&lt;${inner}&gt;</span>`;
      return link
        ? `<a class="sketch-anchor" href="${escape(link.target)}" title="goes to ${escape(link.leadsTo)}">${styled}</a>`
        : styled;
    }
  );

  // Card / list-item rows. The convention is a leading ▢ or ▦ symbol followed
  // by space + content. When a card-kind element on this surface has `leads_to`,
  // wrap the card row (from the symbol up to whitespace gap, end of line, or
  // start of another inline element like a link) in a clickable anchor —
  // clicking the kid card row navigates to the kid-detail surface or whatever
  // `leads_to` points at.
  const cardEl = elements.find(
    (e) => (e.kind === "card" || e.kind === "list-item" || e.kind === "row") && e.leads_to
  );
  if (cardEl && cardEl.leads_to) {
    const target = resolveLeadsTo(cardEl.leads_to);
    if (target) {
      // Match: card glyph + whitespace + content, stopping at either an existing
      // anchor (so we don't nest), two-or-more spaces (column gap), or EOL.
      // Use [\s\S] cautiously — we restrict via the negative-lookahead set.
      html = html.replace(
        /(▢|▦)(\s+)([^\n│]*?)(?=<a\s|\s{2,}|│|$)/g,
        (_m, icon: string, ws: string, content: string) =>
          `<a class="sketch-anchor sketch-card-row" href="${escape(target)}" title="goes to ${escape(cardEl.leads_to!)}"><span class="sketch-card-glyph">${icon}</span>${ws}<span class="sketch-card-text">${content}</span></a>`
      );
    }
  }

  // Always give the card glyph a visible color, even when the row isn't a link
  // (e.g. there's no card-kind element with leads_to). Skip if already wrapped
  // above by checking that the preceding char isn't part of an HTML tag.
  html = html.replace(
    /(?<!<[^>]*)(▢|▦)/g,
    '<span class="sketch-card-glyph">$1</span>'
  );

  return html;
}

function resolveLeadsTo(leadsTo: string): string | null {
  // "feature_id#surface-id" — cross-feature + surface anchor
  const hashIdx = leadsTo.indexOf("#");
  if (hashIdx > 0 && leadsTo.includes("/", 0)) {
    const feat = leadsTo.slice(0, hashIdx);
    const sid = leadsTo.slice(hashIdx + 1);
    return `/${feat}#surface-${sid}`;
  }
  // "area/feature" — cross-feature page
  if (leadsTo.includes("/")) return `/${leadsTo}`;
  // "surface-id" — same-page anchor
  return `#surface-${leadsTo}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
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

  // Implementation paths intentionally NOT rendered. The product-truth site
  // is product-language-only; code references live in `productos/tracking/`
  // (still committed, still queryable, still used by the analyzer / drift
  // skills) but shouldn't compete with the claim for the reader's attention.
  const implBlock = "";

  const surfaces = f.surfaces ?? [];
  const rollup = renderFeatureRollup(f.behaviors, tracking);

  // Partition behaviors by surface anchor: anchored ones live inside their
  // surface card; un-anchored ones (rules/invariants) get a "Rules & Invariants"
  // section after surfaces.
  const surfaceIds = new Set(surfaces.map((s) => s.id));
  const anchored = new Map<string, Behavior[]>();
  const unanchored: Behavior[] = [];
  for (const b of f.behaviors) {
    if (b.surface && surfaceIds.has(b.surface)) {
      const arr = anchored.get(b.surface) ?? [];
      arr.push(b);
      anchored.set(b.surface, arr);
    } else {
      unanchored.push(b);
    }
  }

  const surfacesBlock = surfaces.length
    ? `<div class="section-head"><h2>Surfaces</h2>${rollup}</div><div class="surfaces">${surfaces.map((s) => renderSurfaceWithBehaviors(f.id, s, anchored.get(s.id) ?? [], tracking)).join("\n")}</div>`
    : "";
  const unanchoredHeading = surfaces.length ? "Rules & invariants" : "Behaviors";
  // When there are no surfaces, the rollup hasn't been shown yet — surface it on the Behaviors head.
  const unanchoredRollup = !surfaces.length ? rollup : "";
  const behaviorBlocks = f.behaviors.length
    ? (unanchored.length > 0
        ? `<div class="section-head"><h2>${escape(unanchoredHeading)}</h2>${unanchoredRollup}</div>${unanchored.map((b) => renderBehavior(f.id, b, tracking?.behaviors[b.id])).join("\n")}`
        : "")
    : `<div class="empty-state">No behaviors documented yet for this feature.</div>`;

  // Feature body renders inline with the description as a combined overview
  // block at the top — not as a separate "Notes" h2 down below.
  const overviewBody = feature.body
    ? `<article class="prose feature-overview">${marked.parse(feature.body) as string}</article>`
    : "";

  const affectedByBlock = renderAffectedBy(f.affected_by ?? []);

  return `
    ${crumb}
    <header class="feature">
      <div class="feature-title-row">
        <h1>${escape(f.title)}</h1>
        <code class="feature-id">${escape(f.id)}</code>
        <span class="feature-status pill ${f.status}">${f.status}</span>
      </div>
      ${implBlock}
    </header>
    ${description}
    ${overviewBody}
    ${affectedByBlock}
    ${surfacesBlock}
    ${behaviorBlocks}
    ${renderFeedbackSection(f.id, undefined, "Feedback on this feature")}
  `;
}

function renderAffectedBy(featureIds: string[]): string {
  if (featureIds.length === 0) return "";
  const pills = featureIds
    .map(
      (id) =>
        `<a class="affected-by-pill" href="/${escape(id)}"><code>${escape(id)}</code></a>`
    )
    .join("");
  return `<div class="affected-by"><span class="affected-by-label">Affected by:</span>${pills}</div>`;
}

function renderSurfaceWithBehaviors(
  featureId: string,
  s: Surface,
  anchoredBehaviors: Behavior[],
  tracking: FeatureTracking | null
): string {
  // Element pills below the sketch are intentionally NOT rendered — the sketch
  // itself, decorated by decorateSketch() with kind-aware styling and
  // leads_to-aware clickability, is the canonical element view. The element
  // declarations still live in the markdown so behaviors can anchor via
  // `element: <id>` — they just don't render as a separate redundant list.
  const elementsLine = "";
  const sketchBlock = s.sketch
    ? `<pre class="surface-sketch">${decorateSketch(s.sketch, s.elements)}</pre>`
    : "";
  // Surface.path (route / URL) is intentionally NOT rendered in the header
  // — it's a routing-implementation detail the PM doesn't read. Data persists
  // in markdown for engineers who need to locate the code.
  const pathLine = "";
  const count = anchoredBehaviors.length;
  const countLine =
    count > 0
      ? `<span class="surface-count">${count} behavior${count === 1 ? "" : "s"}</span>`
      : `<span class="surface-count surface-count-empty">no behaviors anchored</span>`;

  const nestedBehaviors =
    count > 0
      ? `<div class="surface-behaviors">${anchoredBehaviors
          .map((b) => renderBehavior(featureId, b, tracking?.behaviors[b.id], { nestedInSurface: true }))
          .join("\n")}</div>`
      : "";

  return `
    <section class="surface" id="surface-${escape(s.id)}">
      <div class="surface-head">
        <h3>${escape(s.title)}</h3>
        ${pathLine}
        ${countLine}
      </div>
      ${sketchBlock}
      ${elementsLine}
      ${s.notes ? `<div class="surface-notes">${escape(s.notes)}</div>` : ""}
      ${nestedBehaviors}
    </section>`;
}


function renderFeatureRollup(behaviors: Behavior[], tracking: FeatureTracking | null): string {
  const counts: Record<DerivedVerification, number> = {
    verified: 0,
    contested: 0,
    orphan: 0,
    uncertain: 0,
    unverified: 0,
  };
  let deprecated = 0;
  for (const b of behaviors) {
    if (b.deprecated) { deprecated += 1; continue; }
    const d = derivedVerification(b, tracking?.behaviors[b.id] ?? null);
    counts[d.state] += 1;
  }
  const chips: string[] = [];
  const order: DerivedVerification[] = ["verified", "contested", "orphan", "uncertain", "unverified"];
  for (const k of order) {
    if (counts[k] === 0) continue;
    chips.push(`<span class="chip ${k}"><strong>${counts[k]}</strong>${k}</span>`);
  }
  if (deprecated > 0) chips.push(`<span class="chip"><strong>${deprecated}</strong>deprecated</span>`);
  if (chips.length === 0) return "";
  return `<div class="rollup">${chips.join("")}</div>`;
}

function renderBehavior(
  featureId: string,
  b: Behavior,
  t: BehaviorTracking | undefined,
  opts: { nestedInSurface?: boolean } = {}
): string {
  const d = derivedVerification(b, t ?? null);
  const claim = escape(b.claim);
  const verifiedLine = t?.last_verified
    ? `<div class="verified-line">Last accepted ${escape(t.last_verified)}${t.verified_by ? " by " + escape(t.verified_by) : ""}</div>`
    : "";
  // Per-behavior code refs intentionally NOT rendered (same reason as the
  // feature-level implBlock — product language only). Data persists in
  // productos/tracking/<area>/<feature>.yaml for the analyzer / drift skills.
  const impl = "";
  const notes = b.notes ? `<div class="notes">${escape(b.notes)}</div>` : "";
  const evidence = renderBehaviorEvidence(b, t);
  const isDeprecated = b.deprecated === true;
  const headPills = isDeprecated
    ? `<span class="status status-deprecated">deprecated</span>`
    : `<span class="status status-${d.state}">${d.state}</span>`;
  // Hide the reason when it just restates the badge ("no human has accepted
  // this Contract yet" is redundant with the Unverified badge). For Contested
  // / Orphan / Uncertain the reason carries actual signal so keep it.
  const reasonIsRedundant = d.state === "unverified";
  const reasonLine = !isDeprecated && d.reason && !reasonIsRedundant ? `<div class="reason">${escape(d.reason)}</div>` : "";
  const deprecatedReason = isDeprecated && b.deprecated_reason ? `<div class="reason">${escape(b.deprecated_reason)}</div>` : "";

  const actions = isDeprecated
    ? `<div class="actions"><span style="color:var(--dim);font-size:12px;">deprecated — kept for history</span></div>`
    : `<div class="actions">
        <button class="primary" data-action="verify" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}">✓ Accept</button>
        <button data-action="edit-toggle">✎ Edit</button>
        <button class="danger" data-action="reject" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}">✗ Reject</button>
        <button data-action="contest" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}">! Contest</button>
        <button data-action="feedback-toggle">💬 Feedback</button>
      </div>
      <div class="edit-form" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}">
        <textarea name="claim" placeholder="Claim (what the product does, in product language)">${escape(b.claim)}</textarea>
        <textarea name="notes" placeholder="Optional notes / why this exists / non-obvious context">${escape(b.notes ?? "")}</textarea>
        <div class="row">
          <button class="primary" data-action="edit-save" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}">Save</button>
          <button data-action="edit-cancel">Cancel</button>
        </div>
      </div>`;

  const anchorStrip = renderBehaviorAnchor(b, { hideSurfaceName: opts.nestedInSurface === true });
  return `
    <article class="behavior" id="${escape(b.id)}" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}">
      <div class="head">
        <span class="bid">${escape(b.id)}</span>
        ${headPills}
      </div>
      ${anchorStrip}
      <div class="claim">${claim}</div>
      ${reasonLine}
      ${deprecatedReason}
      ${verifiedLine}
      ${notes}
      ${evidence}
      ${impl}
      ${actions}
      ${renderFeedbackForm(featureId, b.id)}
    </article>
  `;
}

function renderBehaviorAnchor(
  b: Behavior,
  opts: { hideSurfaceName?: boolean } = {}
): string {
  if (!b.surface) return "";
  const parts: string[] = [];
  if (!opts.hideSurfaceName) {
    parts.push(`<a href="#surface-${escape(b.surface)}">${escape(b.surface)}</a>`);
  }
  if (b.element) {
    if (parts.length > 0) parts.push(`<span class="arr">›</span>`);
    parts.push(`<span class="element-ref"><code>${escape(b.element)}</code></span>`);
  }
  if (b.interaction) {
    if (parts.length > 0) parts.push(`<span class="arr">·</span>`);
    parts.push(`<span class="interaction">${escape(b.interaction)}</span>`);
  }
  if (parts.length === 0) return "";
  return `<div class="anchor-strip">${parts.join(" ")}</div>`;
}

function renderBehaviorEvidence(b: Behavior, t: BehaviorTracking | undefined): string {
  const runs = t?.test_case_runs ?? {};
  const drifts = (t?.drift_events ?? []).filter((d) => !d.resolved_at);
  const cases = b.test_cases ?? [];

  // ALWAYS render the test cases section — even when empty. Silent absence
  // ("hey, where are my test cases?") was a real reported problem. Make the
  // gap visible so the PM knows there's no scaffolding yet.
  const rows: string[] = [];
  rows.push(renderTestCasesBlock(cases, runs));

  if (drifts.length > 0) {
    const driftLines = drifts.map((d) => {
      const when = String(d.opened_at).slice(0, 19).replace("T", " ");
      const ctx = d.context?.message ? ` — ${escape(String(d.context.message))}` : "";
      return `      <li><span class="ev-fail">${d.kind}</span> opened <code>${when}</code>${ctx}</li>`;
    });
    rows.push(`<div class="ev-row"><span class="ev-label">Open drift</span><ul style="margin:0;padding-left:18px;">${driftLines.join("\n")}</ul></div>`);
  }
  return `<div class="evidence">${rows.join("\n")}</div>`;
}

function renderTestCasesBlock(
  cases: Behavior["test_cases"],
  runs: NonNullable<BehaviorTracking["test_case_runs"]>
): string {
  if (cases.length === 0) {
    return `<div class="ev-row"><span class="ev-label">Test cases</span><span class="ev-empty">No test cases yet — this behavior is a wish, not testable. Re-run productos-scope or productos-fullscan to propose 1-3 cases per behavior.</span></div>`;
  }
  const caseBlocks = cases.map((tc) => {
    const run = runs[String(tc.id)];
    const statusBadge = (() => {
      if (tc.deprecated) return `<span class="tc-status ev-skip">deprecated</span>`;
      if (!run) return `<span class="tc-status ev-pending">no result yet</span>`;
      const cls = run.status === "pass" ? "ev-pass" : run.status === "fail" || run.status === "error" ? "ev-fail" : "ev-skip";
      const when = String(run.last_run_at).slice(0, 19).replace("T", " ");
      return `<span class="tc-status ${cls}">${run.status}</span> <code class="tc-when">${when}</code>`;
    })();
    const levelBadge = tc.level ? `<span class="tc-level">${tc.level}</span>` : "";
    const coverageLine = tc.coverage_ref ? `<div class="tc-coverage">↳ covered by <code>${escape(tc.coverage_ref)}</code></div>` : "";
    const detail = renderTestCaseDetail(tc);
    return `
      <div class="tc">
        <div class="tc-head">
          <span class="tc-id">case ${tc.id}</span>
          ${levelBadge}
          ${statusBadge}
        </div>
        <div class="tc-desc">${escape(tc.description)}</div>
        ${detail}
        ${coverageLine}
      </div>`;
  });
  return `<div class="ev-row"><span class="ev-label">Test cases</span><div class="tc-list">${caseBlocks.join("\n")}</div></div>`;
}

function renderTestCaseDetail(tc: Behavior["test_cases"][number]): string {
  const lines: string[] = [];
  if (tc.given) lines.push(`<div class="tc-line"><span class="tc-key">given</span>${escape(tc.given)}</div>`);
  if (tc.when) lines.push(`<div class="tc-line"><span class="tc-key">when</span>${escape(tc.when)}</div>`);
  if (tc.then) lines.push(`<div class="tc-line"><span class="tc-key">then</span>${escape(tc.then)}</div>`);
  if (lines.length === 0 && tc.steps) {
    lines.push(`<pre class="tc-steps">${escape(tc.steps.trim())}</pre>`);
  }
  return lines.length ? `<div class="tc-detail">${lines.join("")}</div>` : "";
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
