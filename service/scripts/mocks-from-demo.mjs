#!/usr/bin/env node
/**
 * Generate surface mocks from the demo app's real components and push them
 * through the MCP endpoint.
 *
 * This is the access model working as designed (ARCHITECTURE.md §2a): an agent
 * on a machine that already has the codebase reads it and pushes results up.
 * The hosted service never sees the source.
 *
 * Palette and structure are taken from demo/constants/Colors.ts and the
 * screens under demo/app/ — not invented.
 *
 *   PRODUCTOS_URL=... PRODUCTOS_SECRET=... node scripts/mocks-from-demo.mjs
 */
const BASE = (process.env.PRODUCTOS_URL ?? "http://localhost:4100").replace(/\/$/, "");
const SECRET = process.env.PRODUCTOS_SECRET;
if (!SECRET) {
  console.error("PRODUCTOS_SECRET is required");
  process.exit(1);
}

// demo/constants/Colors.ts — light theme
const C = {
  text: "#1c1917",
  bg: "#fffbf5",
  surface: "#fff",
  surfaceMuted: "#fef3c7",
  tint: "#f97316",
  border: "#fed7aa",
  muted: "#78716c",
  credit: "#16a34a",
  debit: "#dc2626",
  tabOff: "#a8a29e",
};
// demo/constants/Colors.ts — KID_COLORS
const KID = { ava: "#f97316", noah: "#8b5cf6" };

const CSS = `*{box-sizing:border-box}
body{margin:0;font:15px/1.4 -apple-system,"Segoe UI",Roboto,sans-serif;background:#e9e5df;display:flex;justify-content:center;padding:14px}
.p{width:328px;background:${C.bg};color:${C.text};border-radius:28px;overflow:hidden;box-shadow:0 6px 26px rgba(0,0,0,.15);display:flex;flex-direction:column;min-height:560px}
.hd{padding:15px 16px 11px;font-size:19px;font-weight:700}
.hd small{display:block;font-size:12px;font-weight:500;color:${C.muted};margin-top:1px}
.body{padding:16px;display:flex;flex-direction:column;gap:12px;flex:1}
.card{background:${C.surface};border:1px solid ${C.border};border-radius:14px;padding:14px;display:flex;align-items:center;gap:14px}
.av{width:52px;height:52px;border-radius:26px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:19px;flex:0 0 auto}
.nm{font-size:18px;font-weight:600}
.lbl{font-size:12px;color:${C.muted};margin-top:2px}
.bal{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;margin-left:auto}
.addb{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;margin-top:8px;color:${C.tint};font-size:16px;font-weight:600}
.dot{width:20px;height:20px;border-radius:10px;border:2px solid ${C.tint};display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1}
.tabs{display:flex;border-top:1px solid ${C.border};background:${C.surface}}
.tabs div{flex:1;text-align:center;padding:10px 0 13px;font-size:11px;color:${C.tabOff}}
.tabs div.on{color:${C.tint};font-weight:600}
.fl{font-size:13px;font-weight:600;margin-bottom:6px}
.in{background:${C.surface};border:1px solid ${C.border};border-radius:11px;padding:12px;color:#a8a29e}
.big{font-size:30px;font-weight:700;font-variant-numeric:tabular-nums}
.btn{flex:1;padding:13px;border-radius:12px;color:#fff;font-weight:700;text-align:center}
.sec{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${C.muted};margin-bottom:2px}
.help{font-size:12px;color:${C.muted};margin-top:2px;max-width:190px}
.sw{width:46px;height:28px;border-radius:14px;background:${C.tint};position:relative;flex:0 0 auto;margin-left:auto}
.sw:after{content:"";position:absolute;right:3px;top:3px;width:22px;height:22px;background:#fff;border-radius:11px}
.days{display:flex;gap:6px;margin-top:9px}
.day{width:32px;height:32px;border-radius:9px;border:1px solid ${C.border};background:${C.surface};display:flex;align-items:center;justify-content:center;font-size:12.5px;color:${C.muted}}
.day.on{background:${C.tint};border-color:${C.tint};color:#fff;font-weight:700}
.tx{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid ${C.border}}
.txr{font-size:15px}
.txm{font-size:11.5px;color:${C.muted};margin-top:1px}
.txa{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums}
.row{display:flex;align-items:center;gap:12px}
.stack{display:flex;flex-direction:column}`;

const page = (body, tabs = "") =>
  `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div class="p">${body}${tabs}</div>`;
const tabbar = (on) =>
  `<div class="tabs"><div class="${on === "f" ? "on" : ""}">Family</div><div class="${on === "t" ? "on" : ""}">Tasks</div><div class="${on === "s" ? "on" : ""}">Settings</div></div>`;
const kidCard = (name, color, bal) =>
  `<div class="card" style="border-left:6px solid ${color}">
     <div class="av" style="background:${color}">${name[0]}</div>
     <div class="stack"><div class="nm">${name}</div><div class="lbl">Balance</div></div>
     <div class="bal">${bal}</div></div>`;

const SURFACES = [
  {
    id: "family-list",
    title: "Family list",
    path: "/(tabs)/(family)",
    sketch_html: page(
      `<div class="body">${kidCard("Ava", KID.ava, "$12.50")}${kidCard("Noah", KID.noah, "-$2.00")}
       <div class="addb"><span class="dot">+</span>Add a kid</div></div>`,
      tabbar("f"),
    ),
  },
  {
    id: "kid-detail",
    title: "Kid detail",
    path: "/(tabs)/(family)/kid/[id]",
    sketch_html: page(
      `<div class="hd">← Ava <small>Edit</small></div>
       <div class="body">
         <div class="card" style="display:block;text-align:center">
           <div class="lbl">Current balance</div><div class="big">$12.50</div></div>
         <div class="row">
           <div class="btn" style="background:${C.credit}">+ Earn</div>
           <div class="btn" style="background:${C.debit}">− Spend</div></div>
         <div>
           <div class="tx"><div class="stack"><div class="txr">Made bed</div>
             <div class="txm">Task · today</div></div><div class="txa" style="color:${C.credit}">+$1.00</div></div>
           <div class="tx"><div class="stack"><div class="txr">Ice cream</div>
             <div class="txm">Spend · yesterday</div></div><div class="txa" style="color:${C.debit}">-$2.50</div></div>
           <div class="tx"><div class="stack"><div class="txr">Interest</div>
             <div class="txm">Weekly · Wed</div></div><div class="txa" style="color:${C.credit}">+$0.60</div></div>
         </div></div>`,
    ),
  },
  {
    id: "adjust-balance",
    title: "Adjust a balance",
    path: "/adjust/[id]",
    sketch_html: page(
      `<div class="hd">← Earn <small>Ava</small></div>
       <div class="body">
         <div><div class="fl">Amount</div><div class="in" style="font-size:26px;font-weight:700;color:${C.credit}">$5.00</div></div>
         <div><div class="fl">Reason</div><div class="in">Birthday money</div></div>
         <div class="btn" style="background:${C.credit};margin-top:6px">Save</div></div>`,
    ),
  },
  {
    id: "task-list",
    title: "Tasks",
    path: "/(tabs)/tasks",
    sketch_html: page(
      `<div class="body">
         <div class="card"><div class="stack"><div class="nm" style="font-size:16px">Make bed</div>
           <div class="lbl">Ava</div></div><div class="bal" style="font-size:18px">$1.00</div></div>
         <div class="card"><div class="stack"><div class="nm" style="font-size:16px">Dishes</div>
           <div class="lbl">Noah</div></div><div class="bal" style="font-size:18px">$2.00</div></div>
         <div class="card"><div class="stack"><div class="nm" style="font-size:16px">Homework</div>
           <div class="lbl">Ava</div></div><div class="bal" style="font-size:18px">$3.00</div></div>
         <div class="addb"><span class="dot">+</span>Add a task</div></div>`,
      tabbar("t"),
    ),
  },
  {
    id: "add-kid",
    title: "Add a kid",
    path: "/add-kid",
    sketch_html: page(
      `<div class="hd">← Add a kid</div>
       <div class="body">
         <div><div class="fl">Name</div><div class="in">Ava</div></div>
         <div><div class="fl">Colour</div>
           <div class="row" style="gap:9px;margin-top:2px">
             ${["#f97316", "#ec4899", "#8b5cf6", "#06b6d4", "#10b981", "#facc15"]
               .map((c, i) => `<div class="av" style="width:32px;height:32px;border-radius:16px;background:${c};${i === 0 ? `box-shadow:0 0 0 3px ${C.bg},0 0 0 5px ${c}` : ""}"></div>`)
               .join("")}</div></div>
         <div class="btn" style="background:${C.tint};margin-top:8px">Save</div></div>`,
    ),
  },
  {
    id: "add-task",
    title: "Add a task",
    path: "/add-task",
    sketch_html: page(
      `<div class="hd">← Add a task</div>
       <div class="body">
         <div><div class="fl">Task</div><div class="in">Make bed</div></div>
         <div><div class="fl">Reward</div><div class="in">$1.00</div></div>
         <div><div class="fl">Assign to</div><div class="in">Ava</div></div>
         <div class="btn" style="background:${C.tint};margin-top:8px">Save</div></div>`,
    ),
  },
  {
    id: "settings",
    title: "Settings",
    path: "/(tabs)/settings",
    sketch_html: page(
      `<div class="body">
         <div class="sec">Interest</div>
         <div class="card"><div class="stack"><div class="nm" style="font-size:16px">Apply interest</div>
           <div class="help">Kid balances earn interest on selected days of the week.</div></div>
           <div class="sw"></div></div>
         <div class="card" style="display:block">
           <div class="nm" style="font-size:16px">Days of week</div>
           <div class="days">${["M", "T", "W", "T", "F", "S", "S"]
             .map((d, i) => `<div class="day${i === 0 ? " on" : ""}">${d}</div>`)
             .join("")}</div></div>
         <div class="card"><div class="stack"><div class="nm" style="font-size:16px">Rate</div>
           <div class="help">Percent added on each selected day.</div></div>
           <div class="bal" style="font-size:18px">5%</div></div></div>`,
      tabbar("s"),
    ),
  },
];

// --- push through MCP -------------------------------------------------------

let id = 0;
async function mcp(method, params) {
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${SECRET}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const raw = await res.text();
  const line = raw.split("\n").filter((l) => l.startsWith("data: ")).pop();
  return JSON.parse((line ?? raw).replace(/^data: /, ""));
}

await mcp("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "mocks-from-demo", version: "1.0" },
});

for (const s of SURFACES) {
  const r = await mcp("tools/call", {
    name: "productos_add_surface",
    arguments: s,
  });
  const failed = r.result?.isError;
  console.log(`${failed ? "✗" : "✓"} ${s.id}${failed ? ` — ${r.result.content[0].text.slice(0, 120)}` : ""}`);
}

// Elements + flow, also via MCP.
const ELEMENTS = [
  { surface_id: "family-list", id: "kid-card", kind: "card", label: "Kid row", leads_to: "kid-detail" },
  { surface_id: "family-list", id: "add-kid-button", kind: "button", label: "Add a kid", leads_to: "add-kid" },
  { surface_id: "kid-detail", id: "earn-button", kind: "button", label: "+ Earn", leads_to: "adjust-balance" },
  { surface_id: "kid-detail", id: "spend-button", kind: "button", label: "− Spend", leads_to: "adjust-balance" },
  { surface_id: "adjust-balance", id: "amount-input", kind: "input", label: "Amount" },
  { surface_id: "adjust-balance", id: "reason-input", kind: "input", label: "Reason" },
  { surface_id: "adjust-balance", id: "save-button", kind: "button", label: "Save", leads_to: "kid-detail" },
  { surface_id: "task-list", id: "task-row", kind: "row", label: "Task row" },
  { surface_id: "task-list", id: "add-task-button", kind: "button", label: "Add a task", leads_to: "add-task" },
  { surface_id: "add-task", id: "save-button", kind: "button", label: "Save", leads_to: "task-list" },
  { surface_id: "add-kid", id: "name-input", kind: "input", label: "Name" },
  { surface_id: "add-kid", id: "colour-picker", kind: "picker", label: "Colour" },
  { surface_id: "add-kid", id: "save-button", kind: "button", label: "Save", leads_to: "family-list" },
  { surface_id: "settings", id: "interest-toggle", kind: "toggle", label: "Apply interest" },
  { surface_id: "settings", id: "day-picker", kind: "day-picker", label: "Days of week" },
  { surface_id: "settings", id: "rate-input", kind: "input", label: "Rate" },
];

for (const e of ELEMENTS) {
  const r = await mcp("tools/call", { name: "productos_add_element", arguments: e });
  if (r.result?.isError) console.log(`✗ ${e.surface_id}/${e.id} — ${r.result.content[0].text.slice(0, 100)}`);
}
console.log(`✓ ${ELEMENTS.length} elements`);
