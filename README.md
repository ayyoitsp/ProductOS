# ProductOS

**Product truth as a viewable, version-controlled artifact.**

ProductOS holds structured documentation of what your product does — version-controlled in your repo, diffable in PRs, rendered on demand as a navigable website. It's where you go *before* designing a feature to understand the system, and where you update *during* feature work so the diff captures both the code change and the behavior change in the same PR.

> **Status:** v0.1.0 — early. Claude Code adapter; Codex / Cursor / Devin to follow.

## How it works

```
   ┌─────────────┐                ┌──────────────┐               ┌───────────────────┐
   │ Claude Code │ ─── MCP ──►   │  ProductOS   │ ─── HTTP ──►  │ Product Truth site│
   │  + skill    │                │  MCP server  │                │ (localhost)       │
   └──────┬──────┘                └──────────────┘                └───────────────────┘
          │
          │ consults, proposes, updates, attaches evidence
          ▼
   ┌────────────────────────────────────────────────────────────┐
   │  productos/products/                                       │
   │    <area>/<feature>.md  — frontmatter: behaviors, evidence │
   │                          body: prose, UX, caveats         │
   └────────────────────────────────────────────────────────────┘
```

1. `productos init claude` — installs the ProductOS skill into Claude Code and scaffolds `productos/`.
2. You edit `productos/env.yaml` to describe how Claude can bring up your dev stack.
3. You ask Claude to "do a ProductOS pass on this codebase."
4. Claude reads your code and writes markdown files under `productos/products/<area>/<feature>.md`. Each file declares **behaviors** (atomic claims about what the feature does) in its frontmatter, with **evidence** (code refs, captured API responses, screenshots, narratives) backing each claim.
5. You open `http://localhost:7878` — the product-truth site, rendered dynamically from the markdown. You review the proposed behaviors, look at the evidence, and verify with `productos product verify <feature> <behavior>` or via the skill's prompts.
6. The markdown gets committed alongside the code. PR diffs show both.

**The artifact is the markdown.** The website is dynamically rendered from it — no static HTML is checked in. Tests are *one possible kind of evidence* you can attach to a behavior, not the core of the system.

## Quickstart

Prerequisites: Node 20+, Claude Code installed.

```bash
# 1. Install
npm install -g productos    # (post-publish; until then: clone + npm run build + npm link)

# 2. In your project, install the ProductOS skill + scaffold productos/
cd ~/my-app
productos init claude

# 3. Edit productos/env.yaml to match your stack
$EDITOR productos/env.yaml

# 4. Sanity-check the env
productos env up
productos env check

# 5. Start the product-truth site in another terminal
productos serve            # → http://localhost:7878

# 6. Open Claude Code in this repo and say:
#    "do a ProductOS pass on this codebase"
#
# 7. Watch proposed features and behaviors appear in the site as Claude works.
#    Review the evidence. Verify the good ones.

# 8. Commit productos/products/ — it's part of your codebase now.
```

## The shape of a feature file

```yaml
---
id: auth/signup
title: User signup
status: shipped              # planned | shipped | deprecated
owners: [peter]
implements:
  - src/api/auth/signup.ts
  - src/pages/signup.tsx
related: [auth/login]
behaviors:
  - id: duplicate-email
    claim: "POST /api/auth/signup with an existing email returns 409 with body.error.code = 'duplicate_email'"
    status: verified         # planned | proposed | verified | stale | contested | deprecated
    last_verified: 2026-05-28
    verified_by: peter
    evidence:
      - kind: code
        ref: "src/api/auth/signup.ts:23-67"
      - kind: response
        path: "productos/evidence/auth-signup-dup-email.json"
        description: "Captured 2026-05-28 against local"
    notes: |
      Intentional separation from 400 so the client can show a
      specific "this email is already registered" message.
  - id: welcome-email
    claim: "Successful signup enqueues a welcome email"
    status: verified
    evidence:
      - kind: code
        ref: "src/api/auth/signup.ts:80"
---

# User signup

Users create accounts by providing email + password.

## UX

The signup page lives at `/signup`...
```

Behaviors live in the frontmatter (structured, machine-readable, diff-friendly). The body is for prose that doesn't fit neatly into the structured fields.

## CLI

```
productos init <runtime>             # 'claude' supported
productos serve                      # render the product-truth site on localhost:7878
productos env list|<name> up|check|reset|down
productos product list               # list features
productos product show <id>          # show a single feature with its behaviors
productos product verify <feature_id> <behavior_id>
productos product contest <feature_id> <behavior_id> --reason "..."
productos gaps                       # behaviors awaiting verification, stale, contested, etc.
productos doctor                     # check install, runtime, env, product-truth state
```

## MCP tools (consumed by Claude Code)

| Tool | Purpose |
| --- | --- |
| `productos_list_areas` / `productos_list_features` | Discover what already exists |
| `productos_get_feature` | Read a feature's behaviors + body before updating |
| `productos_propose_feature` | Propose a NEW feature — writes a draft to productos/drafts/, human runs `productos review` to promote |
| `productos_list_drafts` | List drafts awaiting review |
| `productos_update_feature` | Update metadata/body of an existing (already promoted) feature |
| `productos_add_behavior` / `_update_behavior` / `_remove_behavior` | Modify individual behaviors on an existing feature |
| `productos_attach_evidence` | Add evidence (code ref, response capture, screenshot, narrative, trace) to a behavior |
| `productos_get_env` | Read dev-env config (services, healthcheck, etc.) |
| `productos_get_gaps` | Find behaviors awaiting verification, stale, contested, etc. |

## Evidence kinds

| Kind | When |
| --- | --- |
| `code` | File:lines reference into the codebase — minimum bar for any proposal |
| `response` | Captured API request/response (JSON file in `productos/evidence/`) |
| `screenshot` | PNG of UI state (`productos/evidence/<name>.png`) |
| `trace` | Multi-step recording (Playwright trace, browser session, etc.) |
| `narrative` | Free-form prose written by Claude or a human |
| `test-result` | Pass/fail of a codified assertion (one option, not the core) |
| `query` | DB query + result |

You attach the cheapest sufficient evidence — usually `code` + `narrative` on first pass, with richer kinds (response captures, screenshots) when the claim needs them.

## The `productos/` directory

```
productos/
├── config.yaml              # checked in — project config
├── env.yaml                 # checked in — how to bring up your dev stack
├── products/                # checked in — the product truth tree
│   ├── README.md            # top-level overview
│   ├── auth/
│   │   ├── README.md        # area overview
│   │   ├── signup.md        # feature
│   │   └── login.md
│   ├── wishlist/
│   └── ...
├── evidence/                # checked in — captured API responses, screenshots, etc.
└── .local/                  # gitignored — cache + runtime state
```

## What's *not* in v0.1.0

- Browser-mode evidence (Playwright traces, screenshot capture wired into the skill) — fast-follow
- The `productos-sync` skill (gaps → tickets via the user's Linear/Jira/GitHub MCPs) — fast-follow
- The `productos-feedback` skill (Zendesk/Sentry MCPs → contested behaviors) — fast-follow
- Codex / Cursor / Devin adapters — fast-follow
- A `--byok` mode for headless/CI use without a runtime session — post-MVP
- Drift detection (auto-flagging stale behaviors when code changes) — fast-follow

## Build from source

```bash
git clone https://github.com/ayyoitsp/ProductOS.git
cd ProductOS
npm install
npm run build
npm link     # symlinks `productos` to your PATH
```

## The `demo/` directory

`demo/` contains **Family Wallet** — a tiny Expo + React Native mobile app we use as a testbed for dogfooding ProductOS. Parents manage allowances, track tasks → balances per kid, optionally apply interest on selected days of the week. Local SQLite storage. See [`demo/README.md`](./demo/README.md) for how to run it.

The app is intentionally simple but has enough real product surface — multi-tenant ledger, editable task list, unbounded interest rules, modal flows — that proposing product truth + tracking for it is non-trivial.

## License

[Apache 2.0](./LICENSE)
