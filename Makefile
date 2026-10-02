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

.PHONY: default help install link build watch dev dev-serve typecheck all clean doctor \
        up down logs rebuild restart nuke psql hosted-doctor seed shell hosted-help

# The hosted instance, in Docker:
#   make up         — build and start (ProductOS + Postgres), wait until healthy
#   make seed       — create a project and import the seed corpus, print the URL
#   make logs       — follow the instance's log
#   make rebuild    — rebuild the image from current source and restart it
#   make down       — stop, keeping the database
#   make nuke       — stop and DELETE the database volume
DB_URL ?= postgres://productos:productos@localhost:5432/productos
PORT   ?= 4100

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
	@echo ""
	@echo "Hosted, in Docker:"
	@echo "  make up         → build + start ProductOS and Postgres, wait until healthy"
	@echo "  make seed       → create a project, import the seed corpus, print the URL"
	@echo "  make logs       → follow the instance log"
	@echo "  make rebuild    → rebuild the image from current source and restart"
	@echo "  make restart    → restart the instance only (tests the migration ledger)"
	@echo "  make psql       → a shell on the instance's database"
	@echo "  make down       → stop, keeping the database"
	@echo "  make nuke       → stop and DELETE the database volume"

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

# ---------------------------------------------------------------------------
# The hosted instance, in Docker.
#
# ⛔ `up` WAITS FOR HEALTHY RATHER THAN RETURNING WHEN THE CONTAINER STARTS.
# `docker compose up -d` returns as soon as the process exists, so the next
# command in a script races the migrations and fails against a port that is
# listening but not ready. A target that lies about being finished is worse than
# a slow one.
# ---------------------------------------------------------------------------

up:
	docker compose up --build -d
	@printf "waiting for the instance"
	@for i in $$(seq 1 60); do \
		if curl -fsS -m 2 http://localhost:$(PORT)/health >/dev/null 2>&1; then \
			echo ""; echo "✓ healthy at http://localhost:$(PORT)"; \
			curl -fsS http://localhost:$(PORT)/health; echo ""; \
			exit 0; \
		fi; \
		printf "."; sleep 1; \
	done; \
	echo ""; echo "✗ never became healthy. Its log:"; \
	docker compose logs --tail 40 productos; exit 1

down:
	docker compose down

# ⛔ Named so nobody reaches for it by accident. `down` keeps the data; this does not.
nuke:
	docker compose down -v
	@echo "✓ containers and the database volume are gone"

logs:
	docker compose logs -f productos

# Rebuild the image from current source. ⛔ Use this after editing src/ — the image
# carries a BUILT dist/, so a source change is invisible until the image is rebuilt.
rebuild: build
	docker compose up --build -d productos
	@sleep 2
	@docker compose logs --tail 15 productos

# ⛔ Exercises the migration ledger: a second boot must skip what it already applied.
restart:
	docker compose restart productos
	@sleep 3
	@docker compose logs --tail 10 productos

psql:
	docker compose exec postgres psql -U productos -d productos

shell:
	docker compose exec productos sh

hosted-doctor: build
	DATABASE_URL=$(DB_URL) node dist/cli/index.js hosted doctor

# Put something in it, so the instance is worth opening.
#
# ⛔ GENERATES THE CORPUS WITH `v2 reset` RATHER THAN POINTING AT ./v2. The working
# corpus is somebody's actual scoping work; a seed target that imported it would
# publish whatever was in progress into a container.
seed: build
	@set -e; \
	tmp=$$(mktemp -d)/v2; \
	node dist/cli/index.js v2 reset --at $$tmp >/dev/null; \
	id=$$(DATABASE_URL=$(DB_URL) node dist/cli/index.js hosted project new seed --as me@localhost --name "Seed" \
	      | sed -n 's/.*project \([a-zA-Z0-9_-]*\) .*/\1/p'); \
	DATABASE_URL=$(DB_URL) node dist/cli/index.js hosted import $$tmp --into $$id; \
	echo ""; \
	echo "✓ open http://localhost:$(PORT)/p/$$id/v2"
