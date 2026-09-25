# ProductOS service

The hosted truth authority. Postgres-backed API; the database is the authority and markdown is an export.

Conceptual model: [`../OVERVIEW.md`](../OVERVIEW.md) · architecture: [`../planning/ARCHITECTURE.md`](../planning/ARCHITECTURE.md)

## Local

```bash
cp .env.example .env      # fill DATABASE_URL + both secrets
npm install
npm run db:migrate        # NOT db:push — see below
npm run dev               # :4100
./scripts/smoke.sh        # 23 checks, idempotent
```

**Use `db:migrate`, not `db:push`.** `drizzle-kit push` fails on this schema (`column "id" is in a primary key` — it tries to drop a constraint it can't). Migrations are generated with `npm run db:generate` and applied with `npm run db:migrate`.

## Two credentials, on purpose

| | Holder | Can |
| --- | --- | --- |
| `PRODUCTOS_SECRET` | MCP bridge, CI, agents | Read, propose, edit |
| `PRODUCTOS_HUMAN_SECRET` | The authoring app only | Additionally **validate** |

"Agents propose, humans validate" is the trust anchor, and it needs a mechanism rather than a convention. An agent holding the agent token has no path to validation whatever it tries. The service **refuses to start** if either is unset — failing closed beats serving a customer's roadmap unprotected.

## Enforcement lives at the tool boundary

An agent can ignore an instruction; it cannot ignore a rejected call. So the invariants are code, not prompt text:

| Invariant | Mechanism |
| --- | --- |
| No implementation in claims | Claim linter — rejects paths, HTTP verbs, status codes, SQL, code identifiers |
| No duplicate claims | Trigram similarity check, rejects with the matching id |
| Nothing is deleted | No delete route exists; only `deprecate` |
| Ids are immutable | Natural keys are primary keys — renaming is structurally impossible |
| A capability can't become a feature | `kind` is immutable after creation |
| `depends_on` points at capabilities | Rejected if the target is a feature |
| Agents can't validate | Separate credential (above) |
| Editing a claim drops its validation | Validations store a hash of the claim they covered |
| Baseline claims never reach agents | Packet builder filters to `origin = authored` |

## Deploy

```bash
./scripts/deploy.sh
```

Azure Container Apps. Credentials are stored as ACA secrets and referenced via `secretref`, never as plain env vars. `min-replicas 1` — scale-to-zero cold starts break long-lived MCP/SSE connections.

## Built

The schema and API, the packet builder (`/api/packet/<area>/<slug>`, `md` / `json`), the review app at
`/app` (browse, validate, adopt a baseline claim, view the packet), and the MCP bridge — stdio for local
agents plus Streamable HTTP at `/mcp`.

`/app` is a **review** surface, not an authoring one: a human validates there, an agent proposes over
MCP. That's the intended shape, but it means there is no blank-form authoring path today.

## Not yet built

AGENTS.md emission, reconciliation, markdown export, and per-behavior state in the rendered markdown
packet (the state is in the JSON packet; `renderPacketMarkdown` doesn't print it, so a reader can't tell
a validated claim from one still in review).
