import type { PropsWithChildren } from "hono/jsx";

const css = `
:root {
  --bg:#0f1115; --panel:#161a21; --line:#252b36; --text:#e6e9ef;
  --muted:#8b94a7; --accent:#6ea8fe; --ok:#4ec9a5; --warn:#e0a458; --bad:#e06c75;
}
@media (prefers-color-scheme: light) {
  :root { --bg:#fbfbfd; --panel:#fff; --line:#e3e6ec; --text:#1a1d23;
          --muted:#666e7e; --accent:#2563eb; --ok:#0f8a63; --warn:#a86a12; --bad:#c0392b; }
}
* { box-sizing:border-box }
body { margin:0; background:var(--bg); color:var(--text);
  font:15px/1.55 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif; }
a { color:var(--accent); text-decoration:none } a:hover { text-decoration:underline }
header { border-bottom:1px solid var(--line); padding:14px 22px; display:flex;
  align-items:center; gap:18px; background:var(--panel); position:sticky; top:0; }
header .brand { font-weight:650; letter-spacing:-.01em }
header nav { display:flex; gap:16px; margin-left:auto; font-size:14px }
main { max-width:940px; margin:0 auto; padding:28px 22px 80px }
h1 { font-size:24px; margin:0 0 4px; letter-spacing:-.02em }
h2 { font-size:15px; text-transform:uppercase; letter-spacing:.07em;
  color:var(--muted); margin:34px 0 12px; font-weight:600 }
.sub { color:var(--muted); margin:0 0 22px }
.card { background:var(--panel); border:1px solid var(--line); border-radius:10px;
  padding:16px 18px; margin-bottom:12px }
.card h3 { margin:0 0 6px; font-size:16px; font-weight:600 }
.row { display:flex; align-items:flex-start; gap:12px }
.row .grow { flex:1; min-width:0 }
.mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; color:var(--muted) }
.pill { display:inline-block; font-size:11px; padding:2px 8px; border-radius:999px;
  border:1px solid var(--line); color:var(--muted); text-transform:uppercase;
  letter-spacing:.05em; font-weight:600 }
.pill.cap { color:var(--accent); border-color:currentColor }
.pill.validated { color:var(--ok); border-color:currentColor }
.pill.needs_review { color:var(--warn); border-color:currentColor }
.pill.problem { color:var(--bad); border-color:currentColor }
.pill.baseline { opacity:.75 }
.claim { margin:8px 0 0 }
.empty { color:var(--muted); font-style:italic }
button, .btn { font:inherit; font-size:13px; padding:6px 13px; border-radius:7px;
  border:1px solid var(--line); background:transparent; color:var(--text); cursor:pointer }
button:hover, .btn:hover { border-color:var(--accent); color:var(--accent) }
button.primary { background:var(--accent); border-color:var(--accent); color:#fff }
input, textarea, select { font:inherit; width:100%; padding:9px 11px; border-radius:7px;
  border:1px solid var(--line); background:var(--bg); color:var(--text) }
label { display:block; font-size:13px; color:var(--muted); margin:14px 0 5px }
form.signin { max-width:400px; margin:14vh auto }
.note { color:var(--muted); font-size:13px; margin-top:14px }
.flow { display:flex; flex-direction:column; gap:8px }
.flowrow { display:flex; align-items:center; gap:10px; flex-wrap:wrap }
.flownode { border:1px solid var(--line); border-radius:8px; padding:6px 12px;
  font-size:13.5px; background:var(--bg); white-space:nowrap }
.flowarrow { display:flex; flex-direction:column; align-items:center;
  color:var(--muted); font-size:11px; line-height:1.1; font-family:ui-monospace,Menlo,monospace }
.flowlabel { font-size:11px }
.mock { width:100%; height:440px; border:1px solid var(--line); border-radius:8px;
  background:#fff; display:block }
details summary { color:var(--muted) }
.err { color:var(--bad); font-size:13px; margin-top:10px }
`;

export function Layout({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>{title} · ProductOS</title>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <header>
          <span class="brand">ProductOS</span>
          <nav>
            <a href="/app">Truth</a>
            <a href="/app/context">Context</a>
            <a href="/app/decisions">Decisions</a>
            <a href="/app/signout">Sign out</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

export function StatePill({ state }: { state: string }) {
  const label = state === "needs_review" ? "needs review" : state;
  return <span class={`pill ${state}`}>{label}</span>;
}
