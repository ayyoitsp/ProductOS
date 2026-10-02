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
        up down logs rebuild restart nuke psql hosted-doctor seed shell hosted-help \
        backup restore

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
	@echo "  make backup     → dump the database to ./backups/"
	@echo "  make restore    → FILE=<dump>; ⛔ replaces the current database"

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
#
# ⛔ A STAMPED SLUG, SO SEEDING TWICE WORKS. A slug is unique per owner, so a fixed
# one made the second `make seed` fail — and it failed as `option '--into
# <projectId>' argument missing`, because the id extraction came back empty and
# the real reason never reached the terminal. A dev target whose second run lies
# about what went wrong costs more than the one it saves.
seed: build
	@set -e; \
	tmp=$$(mktemp -d)/v2; \
	node dist/cli/index.js v2 reset --at $$tmp >/dev/null; \
	slug=seed-$$(date +%H%M%S); \
	made=$$(DATABASE_URL=$(DB_URL) node dist/cli/index.js hosted project new $$slug --as me@localhost --name "Seed"); \
	id=$$(printf '%s' "$$made" | sed -n 's/.*project \([a-zA-Z0-9_-]*\) .*/\1/p'); \
	test -n "$$id" || { echo "could not create a project:"; printf '%s\n' "$$made"; exit 1; }; \
	DATABASE_URL=$(DB_URL) node dist/cli/index.js hosted import $$tmp --into $$id; \
	echo ""; \
	echo "✓ open http://localhost:$(PORT)/p/$$id/v2"

# ---------------------------------------------------------------------------
# The data, and where it lives.
#
# ⛔ IN THE COMPOSE STACK, POSTGRES IS IN DOCKER AND ITS DATA IS A DOCKER VOLUME
# (`productos_data`). That is a dev choice with one sharp edge: `make nuke` and
# `docker compose down -v` delete it, with nothing to put back. So `backup`
# exists, and is named as the counterpart it is.
#
# ⛔ THE APP CONTAINER HOLDS NO STATE AT ALL. Every file it writes is a scratch
# copy of a corpus under the OS temp directory, removed when the request ends and
# swept at boot if a hard kill skipped that. So DATABASE_URL is the whole of what
# a deployment has to persist: point it at a managed Postgres (Neon, Azure
# Database for PostgreSQL, RDS, Cloud SQL) and the storage is off Docker
# entirely, with backups and point-in-time recovery theirs to run.
#
#   make backup              ./backups/productos-<stamp>.sql.gz
#   make restore FILE=path   replaces the current database
# ---------------------------------------------------------------------------

BACKUP_DIR ?= backups

#
# ⛔ `--clean --if-exists`, OR THE DUMP IS NOT RESTORABLE AND NOBODY FINDS OUT UNTIL
# THEY NEED IT. The instance applies migrations on boot, so by the time anybody
# restores, the schema already exists — and a plain `pg_dump` dies on `type
# "project_role" already exists`. A backup that only works against an empty
# database is not a backup; it is a file that makes somebody feel safe. Found by
# destroying the volume and trying to come back, which is the only test that counts.
backup:
	@mkdir -p $(BACKUP_DIR)
	@stamp=$$(date +%Y%m%d-%H%M%S); \
	out=$(BACKUP_DIR)/productos-$$stamp.sql.gz; \
	docker compose exec -T postgres pg_dump -U productos -d productos --clean --if-exists | gzip > $$out; \
	test -s $$out || { echo "the dump is empty — is the stack up?"; rm -f $$out; exit 1; }; \
	gunzip -c $$out | grep -q "DROP TABLE IF EXISTS" || { echo "the dump cannot replace an existing schema"; rm -f $$out; exit 1; }; \
	echo "✓ $$out ($$(du -h $$out | cut -f1))"

# ⛔ DESTRUCTIVE, AND IT SAYS SO BEFORE IT RUNS. Restoring is the one operation here
# that can lose work somebody did since the dump, so it will not run without a file
# named explicitly — there is deliberately no "restore the latest".
restore:
	@test -n "$(FILE)" || { echo "usage: make restore FILE=$(BACKUP_DIR)/productos-<stamp>.sql.gz"; exit 1; }
	@test -f "$(FILE)" || { echo "no such file: $(FILE)"; exit 1; }
	@echo "⛔ This REPLACES the current database with $(FILE)."
	@printf "   type the word replace to continue: "; read ans; test "$$ans" = "replace" || { echo "cancelled"; exit 1; }
	gunzip -c "$(FILE)" | docker compose exec -T postgres psql -U productos -d productos -v ON_ERROR_STOP=1 >/dev/null
	@echo "✓ restored from $(FILE)"
	@#
	@# ⛔ THE INSTANCE HAS TO BE RESTARTED, AND FORGETTING IT LOOKS LIKE A FAILED RESTORE.
	@# `startHosted` resolves the single-account session once at boot and holds the id; a
	@# restore replaces the `sessions` table under it, so that id now belongs to nobody and
	@# every page answers 401. The data was fine — the process was holding a stale handle.
	@# Found by restoring and then opening a page, which returned 401 on a perfectly good
	@# database.
	@docker compose restart productos >/dev/null
	@printf "waiting for the instance"
	@for i in $$(seq 1 60); do \
		if curl -fsS -m 2 http://localhost:$(PORT)/health >/dev/null 2>&1; then echo " ✓"; break; fi; \
		printf "."; sleep 1; \
	done
	@$(MAKE) --no-print-directory hosted-doctor
