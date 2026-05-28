const cards = document.getElementById("cards");
const filters = document.querySelectorAll(".filter");
const refreshBtn = document.getElementById("refresh");

let currentStatus = "";

filters.forEach((b) =>
  b.addEventListener("click", () => {
    filters.forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    currentStatus = b.dataset.status;
    load();
  })
);
refreshBtn.addEventListener("click", load);

async function load() {
  cards.innerHTML = `<div class="empty">Loading…</div>`;
  const url = currentStatus
    ? `/api/truth?status=${encodeURIComponent(currentStatus)}`
    : "/api/truth";
  const docs = await fetch(url).then((r) => r.json());
  if (!docs.length) {
    cards.innerHTML = `<div class="empty">No truth claims${currentStatus ? ` with status "${currentStatus}"` : ""}.</div>`;
    return;
  }
  cards.innerHTML = "";
  for (const doc of docs) cards.appendChild(renderCard(doc));
}

function renderCard(doc) {
  const f = doc.frontmatter;
  const el = document.createElement("article");
  el.className = "card";
  el.dataset.id = f.id;
  el.innerHTML = `
    <div class="card-header">
      <span class="id">${f.id}</span>
      <span class="type">${f.type}</span>
      <span class="status ${f.status}">● ${f.status}</span>
      <span style="margin-left:auto;color:var(--dim);font-size:11px;">${f.scope?.feature ? "feature: " + escapeHtml(f.scope.feature) : ""}</span>
    </div>
    <div class="claim">${escapeHtml(f.claim)}</div>
    ${
      f.code_ref?.length
        ? `<div class="refs">Derived from:<ul>${f.code_ref.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul></div>`
        : ""
    }
    ${
      f.proposed_test
        ? `<details><summary>Proposed test (${f.proposed_test.framework})</summary><pre>${escapeHtml(f.proposed_test.source)}</pre></details>`
        : ""
    }
    <div class="actions">
      <button class="primary run">▶ Run live</button>
      <button class="validate">✓ Validate</button>
      <button class="danger reject">✗ Reject</button>
    </div>
    <div class="live-result-slot"></div>
  `;

  el.querySelector(".run").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = "Running…";
    const slot = el.querySelector(".live-result-slot");
    slot.innerHTML = "";
    try {
      const r = await fetch(`/api/truth/${f.id}/run-live`, { method: "POST" });
      const trace = await r.json();
      slot.appendChild(renderTrace(trace));
    } catch (err) {
      slot.innerHTML = `<div class="live-result fail"><div class="result-line">Error</div><div class="detail">${escapeHtml(err.message)}</div></div>`;
    } finally {
      btn.disabled = false; btn.textContent = "▶ Run live";
    }
  });

  el.querySelector(".validate").addEventListener("click", async () => {
    await fetch(`/api/truth/${f.id}/validate`, { method: "POST" });
    load();
  });
  el.querySelector(".reject").addEventListener("click", async () => {
    if (!confirm(`Reject ${f.id}?`)) return;
    await fetch(`/api/truth/${f.id}/reject`, { method: "POST" });
    load();
  });
  return el;
}

function renderTrace(trace) {
  const div = document.createElement("div");
  div.className = `live-result ${trace.result}`;
  const pass = trace.result === "pass";
  const reqLine = trace.request ? `${trace.request.method} ${trace.request.url}` : "";
  const resLine = trace.response
    ? `→ ${trace.response.status}  (${trace.response.latency_ms ?? "?"}ms)`
    : "";
  div.innerHTML = `
    <div class="result-line">${pass ? "✓ Pass" : "✗ Fail"}</div>
    <div class="detail">${escapeHtml(reqLine)}  ${escapeHtml(resLine)}</div>
    ${!pass && trace.failure_detail ? `<div class="detail" style="margin-top:6px;color:var(--red)">${escapeHtml(trace.failure_detail)}</div>` : ""}
    <details style="margin-top:8px">
      <summary>response body</summary>
      <pre>${escapeHtml(JSON.stringify(trace.response?.body, null, 2) ?? "")}</pre>
    </details>
  `;
  return div;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

load();
