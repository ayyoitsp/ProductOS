# ProductOS dev Makefile — semantic targets so you don't have to remember npm scripts.
#
# Most-used:
#   make            — start dev:serve (auto-restarts on src/ change, no dist/ needed)
#   make watch      — run tsc --watch in this terminal (keeps dist/ fresh for the linked `productos` binary)
#   make all        — build dist/ + start watch + start dev:serve in parallel
#
# Setup-y:
#   make install    — npm install
#   make link       — npm link (so `productos` is on your PATH and points at this checkout)
#   make build      — one-shot build → dist/
#   make typecheck  — tsc --noEmit (no emit, just check)
#
# Hygiene:
#   make clean      — rm -rf dist/ node_modules/.cache
#   make doctor     — sanity check: node version, productos on PATH, dist/ exists

.PHONY: default help install link build watch dev dev-serve typecheck all clean doctor

default: dev-serve

help:
	@echo "ProductOS dev targets:"
	@echo "  make            → dev-serve (run from source, auto-restart on save)"
	@echo "  make watch      → keep dist/ fresh as you edit src/"
	@echo "  make all        → build + watch + dev-serve (3 procs in parallel)"
	@echo "  make build      → one-shot build dist/"
	@echo "  make typecheck  → tsc --noEmit"
	@echo "  make install    → npm install"
	@echo "  make link       → npm link (puts productos on PATH)"
	@echo "  make clean      → remove dist/ + cache"
	@echo "  make doctor     → sanity check the dev env"

install:
	npm install

link: build
	npm link
	@echo ""
	@echo "✓ productos is now on your PATH, pointing at $(PWD)/bin/productos.js"
	@echo "  Run 'make watch' in a separate tab to keep dist/ fresh as you edit src/."

build:
	npm run build

# Keep dist/ fresh while you work. Leave this running in a tab; tsc --watch
# rebuilds dist/ on every save with the --preserveWatchOutput flag so the
# scroll doesn't get cleared on each tick.
watch:
	npm run watch

# dev-serve runs the CLI directly from source via tsx watch. No dist/ required;
# the process restarts whenever any imported src/ file changes. Use this when
# you're iterating on renderer/server code and want fast turnaround.
dev: dev-serve
dev-serve:
	npm run dev:serve

typecheck:
	npm run typecheck

# Run everything in parallel: a one-shot build (so dist/ exists), then keep
# dist/ fresh AND keep the live server running. Two long-running procs.
# Ctrl-C kills both because make forwards SIGINT to the process group.
all: build
	@echo "Starting tsc --watch + dev-serve in parallel."
	@echo "Ctrl-C to stop both."
	@trap 'kill 0' INT; \
		(npm run watch &) ; \
		npm run dev:serve

clean:
	rm -rf dist node_modules/.cache

doctor:
	@echo "node:        $$(node --version)"
	@echo "npm:         $$(npm --version)"
	@echo "tsx:         $$(npx tsx --version 2>/dev/null || echo 'not found (run make install)')"
	@command -v productos >/dev/null 2>&1 \
		&& echo "productos:   $$(command -v productos) (linked: $$(readlink $$(command -v productos) 2>/dev/null || echo 'no'))" \
		|| echo "productos:   not on PATH (run make link)"
	@test -d dist \
		&& echo "dist/:       built ($$(find dist -name '*.js' | wc -l | tr -d ' ') files)" \
		|| echo "dist/:       missing (run make build)"
	@test -x bin/productos.js \
		&& echo "bin script:  executable" \
		|| echo "bin script:  NOT executable (run chmod +x bin/productos.js)"
