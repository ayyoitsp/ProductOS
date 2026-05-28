# ProductOS

A product-driven operational substrate for AI-native organizations.

ProductOS coordinates AI agents around **product correctness** — declarative claims about what your product does, verified end-to-end against your running application, kept fresh as the code evolves.

> **Status:** v0.0.1 — walking skeleton. Claude Code adapter only; API-mode live validation only; Jest test generation only. Codex / Cursor / Devin adapters and browser-mode validation are fast-follow. See [What's in v0.0.1](#whats-in-v001) below for the exact surface.

## How it works

ProductOS doesn't ship its own LLM. Your AI runtime (Claude Code in v0.0.1) is the brain. ProductOS is the structured backend.

```
   ┌─────────────┐                ┌──────────────┐               ┌──────────────┐
   │ Claude Code │ ─── MCP ──►   │  ProductOS   │ ─── HTTP ──►  │   Vet UI     │
   │  + skill    │                │  MCP server  │                │ (localhost)  │
   └─────────────┘                └──────┬───────┘                └──────────────┘
         ▲                               │
         │ reads codebase                │ writes proposals
         │                               ▼
         │                       productos/truth/T-XXXX.md
         │                               │
         │                               ▼
         │                     ┌──────────────────────┐
         └─── invokes test ──  │ Live API validation  │
                               │ (hits your dev app)  │
                               └──────────────────────┘
```

1. You install the ProductOS skill into Claude Code: `productos init claude`
2. You ask Claude to scan your repo. Claude reads the code and proposes `{ claim + executable test }` pairs by calling the ProductOS MCP server.
3. You open the local vet UI in your browser. For each proposal, you click **▶ Run live** and ProductOS executes the proposed test against your running dev app — you watch the request/response and the assertion result.
4. You approve. The claim becomes **Product Truth** — committed into your repo as `productos/truth/T-XXXX.md`.
5. `productos test generate` materializes validated Truth into idiomatic tests in your stack.

No API key. No model selection. No cloud. Truth lives in your repo, version-controlled and PR-reviewable.

## Quickstart

Prerequisites: Node 20+, Claude Code installed, a project with an HTTP API running locally.

```bash
# 1. Install
npm install -g productos    # (post-publish; until then: clone + npm run build + npm link)

# 2. In your project, install the ProductOS skill + scaffold productos/
cd ~/my-app
productos init claude

# 3. Start the vet UI
productos serve

# 4. Open Claude Code in this repo and tell it:
#    "scan this codebase and propose ProductOS truth"
#
# 5. Open http://localhost:7878 — review each proposal, click "Run live",
#    approve the ones that match your intent.

# 6. Materialize validated Truth into tests in your stack
productos test generate
npm test
```

## What's in v0.0.1

**CLI commands**

```
productos init <runtime>             # 'claude' supported in v0.0.1
productos init <runtime> --update    # refresh skill files
productos init <runtime> --uninstall # remove ProductOS from the runtime
productos serve [--mcp] [--ui]       # default: vet UI on http://localhost:7878
productos truth list|show|reject|validate <id>
productos test generate              # materialize validated Truth → productos/tests/
productos test run                   # run the user's test command
productos gaps [--coverage|--product]
productos doctor                     # check install, runtime, config, target
```

**MCP tools** (exposed when Claude Code spawns `productos serve --mcp`)

| Tool | Purpose |
| --- | --- |
| `productos_propose_truth` | Propose a Truth claim about existing code + the executable test |
| `productos_propose_planned_truth` | Propose Truth for an upcoming feature (no code yet) |
| `productos_propose_contested_truth` | Flag validated Truth as contested by external feedback |
| `productos_list_truth` | List, optionally filtered by status / feature |
| `productos_get_truth` | Fetch a single Truth claim |
| `productos_record_outcome` | Record a test run result against a Truth |
| `productos_record_sync` | Record that a Truth was synced to an external ticket system |
| `productos_get_coverage_gaps` | Internal gaps (Truth without tests, failing tests, stale Truth) |
| `productos_get_product_gaps` | Contested Truth — feedback contradicts validated claims |

**Skills installed into the runtime**

- `productos-analyze` — read existing code, propose `{ claim + test }` pairs
- `productos-feature` — decompose a planned feature description into `status: planned` Truth

**The `productos/` directory** ProductOS creates in your repo

```
productos/
├── config.yaml         # checked in — project config (targets, stack, ui port)
├── truth/              # checked in — Truth claims (T-XXXX.md, MD + frontmatter)
├── traces/             # checked in — small YAML trace metadata from live runs
├── fixtures/           # checked in — test fixtures referenced by Truth
├── tests/              # checked in — generated tests
└── .local/             # gitignored — cache, runtime.db, screenshot/video blobs
```

## What's *not* in v0.0.1

- Browser-mode validation (Playwright + `ui-flow` claims) — fast-follow
- The `productos-sync` skill (gaps → tickets via the user's Linear/Jira/GitHub MCPs) — fast-follow
- The `productos-feedback` skill (Zendesk/Sentry MCPs → contested Truth) — fast-follow
- `productos truth refresh` (re-vet on code change) — fast-follow
- Codex / Cursor / Devin adapters — fast-follow
- A `--byok` mode for headless/CI use without a runtime session — post-MVP
- Anything you'd call a "feature" beyond the walking-skeleton loop

The point of v0.0.1 is the spine: prove that the analyzer-via-skill, live-API validation, and test materialization work end-to-end. Everything else builds on that.

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
