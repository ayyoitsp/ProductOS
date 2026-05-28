# ProductOS

A product-driven operational substrate for AI-native organizations.

ProductOS coordinates AI agents around **product correctness** — declarative claims about what your product does, verified end-to-end by your AI runtime driving your actual dev stack, and kept fresh as the code evolves.

> **Status:** v0.0.2 — walking skeleton. Claude Code adapter only; Jest test generation only. The AI runtime (Claude) drives the live env via `productos env up/check/reset/down`. Codex / Cursor / Devin adapters and browser-mode Playwright support are fast-follow.

## How it works

ProductOS doesn't ship its own LLM and doesn't try to replicate your app stack itself. Your AI runtime (Claude Code in v0.0.x) reads the code, drives your real dev environment, and validates claims by actually running tests in the live stack. ProductOS is the structural backend: storage, MCP server, env config, vet UI.

```
   ┌─────────────┐                ┌──────────────┐               ┌──────────────┐
   │ Claude Code │ ─── MCP ──►   │  ProductOS   │ ─── HTTP ──►  │   Vet UI     │
   │  + skill    │                │  MCP server  │                │ (localhost)  │
   └──────┬──────┘                └──────────────┘                └──────────────┘
          │
          │ reads code, brings up dev env, runs tests, records outcomes
          ▼
   ┌────────────────────────────────────────┐
   │ Your live dev stack                    │
   │  (frontend + backend + db + …)         │
   │  Brought up via `productos env up`     │
   │  (driven by productos/env.yaml)        │
   └────────────────────────────────────────┘
```

1. `productos init claude` — installs the ProductOS skill into Claude Code and scaffolds `productos/` in your repo (including `env.yaml`).
2. You edit `productos/env.yaml` to describe how Claude should bring up your dev stack: services to start, healthcheck URL, optional reset commands.
3. You ask Claude to "do a ProductOS pass on this codebase."
4. Claude reads your code, proposes a Truth claim + an executable test, brings up the env, runs the test in your live stack, and records the outcome via MCP.
5. You open the vet UI, see each Truth claim with its live-run result (✓ pass / ✗ fail + captured output), and approve the ones that match your intent.
6. `productos test generate` materializes validated Truth into idiomatic tests in your stack.

No API key. No model selection. No cloud. Truth lives in your repo, version-controlled and PR-reviewable.

## Quickstart

Prerequisites: Node 20+, Claude Code installed, a project you can run locally.

```bash
# 1. Install
npm install -g productos    # (post-publish; until then: clone + npm run build + npm link)

# 2. In your project, install the ProductOS skill + scaffold productos/
cd ~/my-app
productos init claude

# 3. Edit productos/env.yaml to match your stack
#    (set up commands, healthcheck URL, etc.)
$EDITOR productos/env.yaml

# 4. Sanity-check the env config
productos env up
productos env check        # ✓ if your stack is reachable

# 5. Start the vet UI in another terminal
productos serve            # vet UI on http://localhost:7878

# 6. Open Claude Code in this repo and say:
#    "do a ProductOS pass on this codebase"
#
# 7. Watch claims and live-run results appear in the vet UI.
#    Approve the ones that match your intent.

# 8. Materialize validated Truth into your test tree
productos test generate
npm test
```

## What's in v0.0.x

**CLI commands**

```
productos init <runtime>             # 'claude' supported
productos init <runtime> --update    # refresh skill files
productos init <runtime> --uninstall # remove ProductOS from the runtime
productos env up                     # run env.yaml setup commands + healthcheck
productos env check                  # run only the healthcheck
productos env reset                  # run reset_per_run commands
productos env down                   # run teardown commands
productos serve [--mcp] [--ui]       # default: vet UI on http://localhost:7878
productos truth list|show|reject|validate <id>
productos test generate              # materialize validated Truth → productos/tests/
productos test run                   # run the user's test command
productos gaps [--coverage|--product]
productos doctor                     # check install, runtime, config, env, healthcheck
```

**MCP tools** (exposed when Claude Code spawns `productos serve --mcp`)

| Tool | Purpose |
| --- | --- |
| `productos_propose_truth` | Propose a Truth claim about existing code + the executable test |
| `productos_propose_planned_truth` | Propose Truth for an upcoming feature (no code yet) |
| `productos_propose_contested_truth` | Flag validated Truth as contested by external feedback |
| `productos_list_truth` | List, optionally filtered by status / feature |
| `productos_get_truth` | Fetch a single Truth claim |
| `productos_get_env` | Get the dev-env config so Claude knows how to drive the live stack |
| `productos_record_outcome` | Record the result of a live validation run (with captured output) |
| `productos_record_sync` | Record that a Truth was synced to an external ticket system |
| `productos_get_coverage_gaps` | Internal gaps (Truth without tests, failing tests, stale Truth) |
| `productos_get_product_gaps` | Contested Truth — feedback contradicts validated claims |

**Skills installed into the runtime**

- `productos-analyze` — read existing code, propose `{ claim + test }` pairs, drive the live env to validate them
- `productos-feature` — decompose a planned feature description into `status: planned` Truth (validated later, when code lands)

**The `productos/` directory** ProductOS creates in your repo

```
productos/
├── config.yaml             # checked in — project config (stack, ui port)
├── env.yaml                # checked in — how to bring up your dev stack
├── truth/                  # checked in — Truth claims (T-XXXX.md)
├── traces/                 # checked in — trace metadata
├── fixtures/               # checked in — test fixtures referenced by Truth
├── tests/                  # checked in — approved tests
│   └── proposed/           # gitignored — tests under validation
└── .local/                 # gitignored — cache, runtime.db, blobs
```

## What's *not* in v0.0.x

- Browser-mode Playwright support for `ui-flow` claims — fast-follow
- The `productos-sync` skill (gaps → tickets via the user's Linear/Jira/GitHub MCPs) — fast-follow
- The `productos-feedback` skill (Zendesk/Sentry MCPs → contested Truth) — fast-follow
- `productos truth refresh` (re-vet on code change) — fast-follow
- Codex / Cursor / Devin adapters — fast-follow
- A `--byok` mode for headless/CI use without a runtime session — post-MVP

The point of v0.0.x is the spine: prove that the analyzer-via-skill, env-driven live validation, and test materialization work end-to-end against real stacks.

## Build from source

```bash
git clone https://github.com/ayyoitsp/ProductOS.git
cd ProductOS
npm install
npm run build
npm link     # symlinks `productos` to your PATH for local testing
```

## License

[Apache 2.0](./LICENSE)
