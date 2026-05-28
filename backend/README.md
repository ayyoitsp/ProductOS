# Family Wallet API

TypeScript + Hono + Drizzle + Postgres. Mirrors the Family Wallet demo's
local SQLite ledger as a REST/OpenAPI surface so the mobile app can run
either fully local or backend-driven.

## Local dev

```bash
# Start postgres only, run the API on host
docker compose up -d postgres
cd backend
cp .env.example .env
npm install
npm run db:push     # apply drizzle schema
npm run dev         # http://localhost:4000
```

Or, run the whole stack via docker compose:

```bash
docker compose up --build
```

## OpenAPI

The spec is served at `GET /openapi.json` and can be emitted to disk:

```bash
npm run openapi:emit   # writes openapi.json at the repo root
```

The demo app consumes the emitted spec to generate its typed client.
