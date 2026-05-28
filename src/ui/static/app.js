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

  const lastRun = f.last_test_run;
  const runChip = lastRun
    ? `<span class="run-chip run-${lastRun.result}">${lastRun.result === "pass" ? "✓" : lastRun.result === "fail" ? "✗" : "—"} live ${lastRun.result}</span>`
    : `<span class="run-chip run-none">not yet validated by Claude</span>`;

  el.innerHTML = `
    <div class="card-header">
      <span class="id">${f.id}</span>
      <span class="type">${f.type}</span>
      <span class="status ${f.status}">● ${f.status}</span>
      ${runChip}
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
    ${
      lastRun && lastRun.detail
        ? `<details ${lastRun.result === "fail" ? "open" : ""}><summary>Last live run output (${lastRun.at})</summary><pre>${escapeHtml(lastRun.detail)}</pre></details>`
        : ""
    }
    <div class="actions">
      <button class="primary validate">✓ Validate</button>
      <button class="danger reject">✗ Reject</button>
      <span class="ask-claude">Need a re-run? Tell Claude: "<code>validate ${f.id}</code>" — it'll drive your live env and report back.</span>
    </div>
  `;

  el.querySelector(".validate").addEventListener("click", async () => {
    if (!lastRun || lastRun.result !== "pass") {
      if (!confirm(
        lastRun
          ? `${f.id} last live run was ${lastRun.result.toUpperCase()}. Validate anyway?`
          : `${f.id} has not been live-validated by Claude yet. Validate without evidence?`
      )) {
        return;
      }
    }
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

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

load();
