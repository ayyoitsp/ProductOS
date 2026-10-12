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
        stacks migrations-check dev-guard staging-guard deploy deploy-check suite-now backup restore up-remote down-remote logs-remote remote-doctor checkpoint projects session

# The hosted instance, in Docker:
#   make up         — build and start (ProductOS + Postgres), wait until healthy
#   make seed       — create a project and import the seed corpus, print the URL
#   make logs       — follow the instance's log
#   make rebuild    — rebuild the image from current source and restart it
#   make down       — stop, keeping the database
#   make nuke       — stop and DELETE the database volume
# ⛔ `.env` WINS, OR `seed` WRITES TO A DIFFERENT DATABASE THAN THE APP IS READING.
#
# This was hardcoded to localhost, so after `make up-remote` the app was serving
# Neon while `make seed` and `make hosted-doctor` quietly worked on the local
# Postgres — the same corpus apparently both present and missing, depending on
# which command you asked. Reading DATABASE_URL from `.env` when there is one
# makes every target here address the store the instance is actually using.
ENV_DB := $(shell ./scripts/envvar.sh .env DATABASE_URL 2>/dev/null)

# ⛔ A STACK PER WORKTREE, AND 4100 IS NOT ONE OF THEM.
#
# Peter: *"i'd like 'dev' to be up to date, and we already redeploy 4100 with what's merged.
# individual trees can maintain their own docker instance/own port, but 4100 should be kept clean"*.
#
# The compose project name was pinned so the VOLUME would follow the stack rather than the directory
# — which fixed data appearing to vanish from a worktree, and left every checkout sharing one
# database, one volume and one port. `scripts/stack.sh` hands each worktree its own project and its
# own two ports, derived from its name so the answer is the same from anywhere and survives a
# `make down`. The main checkout keeps `productos`, 4100 and 5432; nothing else can have them.
# ⛔ FROM GIT, NOT FROM THE SCRIPT, BECAUSE `dev-guard` BELOW MAY NOT HAVE THE SCRIPT. A worktree
# sits on its own branch, so `scripts/stack.sh` is simply absent until that branch has it — and an
# absent script makes `$(shell ...)` return the empty string, which compose reads as its default.
# That is dev. Found by running: a throwaway worktree cut from a commit without the script went
# straight for project `productos` on 4100 and only failed because the port was taken.
MAIN_WT := $(shell git worktree list 2>/dev/null | head -1 | awk '{ print $$1 }')
THIS_WT := $(shell git rev-parse --show-toplevel 2>/dev/null)

PRODUCTOS_STACK := $(shell test -x ./scripts/stack.sh && ./scripts/stack.sh . stack)
# ⛔ STAGING'S IDENTITY COMES FROM THE SCRIPT TOO, NOT FROM A SECOND `4100` TYPED HERE. Both guards
#    below compare against it, and two copies of a port number is two things to change.
STAGING_STACK := $(shell test -x ./scripts/stack.sh && ./scripts/stack.sh . staging-stack)
STAGING_PORT  := $(shell test -x ./scripts/stack.sh && ./scripts/stack.sh . staging-port)
PG_PORT         := $(shell test -x ./scripts/stack.sh && ./scripts/stack.sh . pg)
export PRODUCTOS_STACK PG_PORT

# ⛔ THE DEV STACK'S COMPOSE INVOCATION, WHICH SIX TARGETS USED AND NOTHING DEFINED.
#
# `up`, `down`, `logs`, `rebuild`, `restart` and the no-cache build all call `$(DEV)`. Make expands
# an undefined variable to the empty string rather than complaining, so `$(DEV) up -d` ran as
# `up -d` and every one of them died on `make: up: No such file or directory` — on the dev stack,
# which is now the only sanctioned way to work from a checkout that is not staging.
#
# The invocation is the one `docker-compose.dev.yml` documents in its own header: the base file
# carries both services, the healthcheck, the per-stack project name and the derived ports, and the
# overlay changes only the build target. ⛔ Both `-f` flags, always — the overlay alone has no
# postgres and no ports, so compose would bring up something that looks like the stack and is not.
DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml

# ⛔ LOCAL BY DEFAULT, STAGING ONLY WHEN ASKED — AND THAT IS A CORRECTION TO THE ⛔ ABOVE.
#
# This was `$(if $(ENV_DB),$(ENV_DB),…)`, so any `.env` naming a managed store silently pointed
# every host-side command at it. The comment at the top of this file defends that, and the
# invariant it defends is the right one: `seed` must write where the app reads, or the same corpus
# is both present and missing depending which command you ask.
#
# What changed is the other half. `docker-compose.yml` no longer lets `.env` win either — the local
# stack is now pinned to its own Postgres, because `make up` was starting a local database that
# nothing used and pointing the app at the SHARED store, from any worktree. So the way to keep
# `seed` writing where the app reads is for both to mean LOCAL, not for both to mean whatever
# `.env` happens to say.
#
# Staging is addressed on purpose: `make hosted-doctor STAGING=1`. Through a variable rather than
# `DB_URL=<url>` on the command line, because a connection string in argv lands in `ps` and in
# make's own echo of the line.
DB_URL ?= $(if $(STAGING),$(ENV_DB),postgres://productos:productos@localhost:$(PG_PORT)/productos)

# ⛔ `?=`, SO `make up PORT=4200` STILL WINS. The line above assigns it; a command-line variable
# overrides a makefile assignment, which is the one escape hatch worth having here.
PORT ?= $(shell test -x ./scripts/stack.sh && ./scripts/stack.sh . port)
export PORT

# The store a target is about to touch, with the credential removed — so a command
# that writes somewhere says where before it does.
# ⛔ `|` AS THE DELIMITER, NOT `#`. A `#` starts a comment in a Makefile even inside
# a function call, so `s#...#...#` truncated this line and make died on an
# unterminated $(shell.
WHICH_DB = $(shell printf '%s' '$(DB_URL)' | sed -E 's|//[^@]*@|//***@|')

# ⛔ `STAGING=1` WITH NOTHING IN `.env` MUST NOT RESOLVE TO THE EMPTY STRING. A host-side command
#    handed an empty DATABASE_URL fails somewhere deep in a driver, and the message names a socket
#    rather than the missing file.
ifdef STAGING
ifeq ($(strip $(ENV_DB)),)
$(error STAGING=1 but .env names no DATABASE_URL — cp .env.example .env and set it)
endif
endif

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
	@echo "  make checkpoint → FROM=<corpus dir>; import a REAL corpus into the store"
	@echo "  make logs       → follow the instance log"
	@echo "  make rebuild    → rebuild the image from current source and restart"
	@echo "  make restart    → restart the instance only (tests the migration ledger)"
	@echo "  make psql       → a shell on the instance's database"
	@echo "  make down       → stop, keeping the database"
	@echo "  make nuke       → stop and DELETE the database volume"
	@echo "  make backup     → dump the database to ./backups/"
	@echo "  make restore    → FILE=<dump>; ⛔ replaces the current database"
	@echo ""
	@echo "Against a managed Postgres (Neon etc), no local database:"
	@echo "  make remote-doctor  → is the string in .env a usable store? (run this first)"
	@echo "  make up-remote      → needs DATABASE_URL in .env; the store is not ours, the data is"
	@echo "  make rebuild-remote → rebuild from current source and restart ⛔ NOT 'make rebuild'"
	@echo "  make restart-remote → restart the instance only ⛔ NOT 'make restart'"
	@echo "  make backup-remote  → dump the managed store to ./backups/"
	@echo "  make restore-remote → FILE=<dump>; ⛔ replaces the managed store"
	@echo "  make down-remote / logs-remote"
	@echo ""
	@echo "⛔ The plain 'rebuild' and 'restart' above act on the LOCAL-Postgres stack. Against a"
	@echo "   managed store they stand up a SECOND stack instead of updating the one you have."

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

# Every checkout on this machine, the stack it owns, and whether it is up.
#
# ⛔ DERIVED, NOT WRITTEN DOWN. Nothing records which port a worktree took, so this is the only
# place the answer exists — and "which one am I looking at" is a question you ask at exactly the
# moment two instances are serving two branches and both look right.
stacks:
	@printf "%-44s %-6s %-6s %-4s %s\n" STACK PORT PG UP WORKTREE
	@for w in $$(git worktree list | awk '{ print $$1 }'); do \
		eval "$$(./scripts/stack.sh "$$w")"; \
		up=$$(docker compose -p "$$PRODUCTOS_STACK" ps -q 2>/dev/null | head -1); \
		printf "%-44s %-6s %-6s %-4s %s\n" "$$PRODUCTOS_STACK" "$$PORT" "$$PG_PORT" \
			"$$(test -n "$$up" && echo yes || echo no)" "$$w"; \
	done
	@echo ""
	@echo "this one: $(PRODUCTOS_STACK) on $(PORT) (postgres $(PG_PORT))"

# ⛔ DEV SERVES WHAT IS MERGED, AND THIS IS WHERE THAT IS ENFORCED.
#
# Peter: *"4100 should be kept clean"*. Two ways it stops being, and the second is the one that
# actually happened:
#
#  1. The main checkout is on a branch, as it is most of the time. `make up` from here would put
#     unmerged code on the port the corpus is reviewed on, with nothing on the page saying so.
#  2. A worktree resolves to dev's stack ANYWAY — because `scripts/stack.sh` is not on its branch,
#     so `$(shell ...)` is empty and compose uses its default, which is dev. A throwaway worktree
#     did exactly this and was stopped only by `Bind for 0.0.0.0:4100 failed`, which names a port
#     and not the mistake.
#
# So the first check asks GIT whether this is the main worktree, and never the script.
# ⛔ ONE COPY, TWO GUARDS. The local stack and the managed-store stack both land on 4100 and both
# need this question asked; a second copy is a second place to forget to change.
#
# ⛔ AND IT ASKS TWO QUESTIONS, BECAUSE A MERGED HEAD IS NOT A MERGED IMAGE.
#
# This checked only that HEAD was an ancestor of origin/main, which is not what gets built:
# `Dockerfile` does `COPY src ./src`, so the image is the WORKING TREE. A checkout sitting on a
# merged HEAD with uncommitted work in `src/` therefore passed the guard and shipped that work to
# the one store everyone reviews on — and anything new in `drizzle/` ran against it on boot.
#
# That is not hypothetical: it is how a session's half-finished edits reached staging and created a
# table on the managed store, with the guard reporting a clean merged HEAD the whole time. The
# failure is silent on both sides — the deploy succeeds and the instance looks healthy.
define MERGED_CHECK
	git fetch -q origin main 2>/dev/null || true; \
	if ! git merge-base --is-ancestor HEAD origin/main 2>/dev/null; then \
		echo "✗ $(1) is staging, and staging serves what is merged."; \
		echo "  HEAD ($$(git rev-parse --abbrev-ref HEAD)) is not in origin/main."; \
		echo ""; \
		echo "  To try this branch, bring up its own dev stack — every checkout has one:"; \
		echo "    make up        # this checkout, on its own port, against its own Postgres"; \
		echo "  Or, deliberately: make $(2) DEV_ANYWAY=1"; \
		exit 1; \
	fi; \
	if [ -n "$$(git status --porcelain -uall -- src skills drizzle bin Dockerfile package.json package-lock.json tsconfig.json 2>/dev/null)" ]; then \
		echo "✗ $(1) is staging, and staging serves what is MERGED — not what is in this tree."; \
		echo "  HEAD is in origin/main, and that is not the question the image asks."; \
		echo ""; \
		echo "  Dockerfile does \`COPY src ./src\`, so the build takes the WORKING TREE. Uncommitted"; \
		echo "  work ships to the one store everyone reviews on, and a migration in drizzle/ runs"; \
		echo "  against it — while this guard reports a clean merged HEAD. That has happened:"; \
		echo "  half-finished edits reached staging and created a table on the managed store."; \
		echo ""; \
		git status --short -uall -- src skills drizzle bin Dockerfile package.json package-lock.json tsconfig.json | sed "s/^/    /"; \
		echo ""; \
		echo "  Commit them, or try them on this checkout's own stack:  make up"; \
		echo "  Or, deliberately: make $(2) DEV_ANYWAY=1"; \
		exit 1; \
	fi
endef

dev-guard:
	@if [ -z "$(PRODUCTOS_STACK)" ] || [ "$(PRODUCTOS_STACK)" = "$(STAGING_STACK)" ] || [ "$(PORT)" = "$(STAGING_PORT)" ]; then \
		echo "✗ this checkout resolved to staging's identity:"; \
		echo "    stack '$(PRODUCTOS_STACK)' · port '$(PORT)'   (staging is $(STAGING_STACK) on $(STAGING_PORT))"; \
		echo "  scripts/stack.sh is missing or silent here, so compose would have used a default —"; \
		echo "  and the default was staging, which is how this went wrong twice."; \
		echo "  Rebase this worktree onto a branch that has scripts/stack.sh."; \
		exit 1; \
	fi

# ⛔ AND NO MERGED CHECK HERE ANY MORE, WHICH IS THE POINT OF A DEV STACK.
#
# `dev-guard` used to refuse an unmerged HEAD, because the stack it guarded WAS the instance on
# 4100. Now that 4100 is staging and every checkout has its own stack on its own port, a dev stack
# running an unmerged branch is the entire reason it exists. Refusing that would have made the
# thing being built useless. The merged question moved to `staging-guard`, where it is about a
# deployed instance rather than about a checkout.


# ⛔ AND THE MANAGED-STORE STACK IS THE ONE ACTUALLY ON 4100.
#
# Peter: *"Treat 4100 as staging for now"*. Two things this refuses, and the second is the half
# that was missing the first time — `dev-guard` was put only on the local stack, which was not even
# running, leaving all three `-remote` targets open on the one instance anybody uses.
#
# ⛔ A WORKTREE MAY NOT RUN THIS STACK AT ALL, which is the difference from `dev-guard`. A dev stack
# gets its own Postgres and its own volume, so its own instance costs nothing and writes to
# nothing; staging is one shared database, so a worktree pointed at it would write a branch's
# schema and a branch's corpus into the instance everyone reviews on. There is no port that makes
# that safe.
#
# ⛔ AND THIS TARGET WENT MISSING ONCE, SILENTLY. A careless edit removed the recipe while three
# targets still named it as a prerequisite, and make answers "Nothing to be done for
# `staging-guard'" — which looks like a guard that passed. If you are reading this because you are
# about to restructure the guards: `make staging-guard` from an unmerged branch must REFUSE, and
# that is the check, not the presence of the word in the file.
staging-guard:
	@test -n "$(STAGING_STACK)" || { echo "✗ staging's identity is unknown — scripts/stack.sh is missing here"; exit 1; }
	@# ⛔ THE QUESTION IS NOT "AM I A WORKTREE", IT IS "IS THIS EXACTLY WHAT IS MERGED".
	@#
	@# This refused every worktree outright, using "is a worktree" as a proxy for "carries unmerged
	@# work". The proxy is usually right and was wrong about the one case that matters: a checkout
	@# kept permanently on main, clean, for nothing but deploying. Meanwhile the main checkout is
	@# where feature branches get worked on — so the proxy pointed the deploy at the dirtiest tree
	@# on the machine and refused the cleanest.
	@#
	@# ⛔ AND `COPY src ./src` IS WHY THE TREE MATTERS AT ALL, which another session caught: the image
	@# takes the WORKING TREE, not the commit. So "HEAD is in origin/main" was never the whole
	@# question — a clean HEAD with sixteen uncommitted files ships those files to the shared store
	@# while reporting a clean commit.
	@#
	@# So: any checkout may deploy if its tree is clean AND identical to origin/main. Nothing else may,
	@# worktree or not. That is strictly stronger than what it replaced.
	@# ⛔ THE TREE CHECK LIVES IN `MERGED_CHECK`, NOT HERE — ONE FACT, ONE HOME.
	@#
	@# Both halves of this were written twice, independently, on the same afternoon: the listener
	@# session added a working-tree question to MERGED_CHECK, and I added one here. Theirs wins and
	@# mine is deleted, for two reasons worth recording rather than arguing again later.
	@#
	@# It is PATH-SCOPED — `-uall -- src skills drizzle bin Dockerfile package*.json tsconfig.json` —
	@# which is exactly the set `.dockerignore` lets into the build context. A scratch file in the
	@# repo root cannot reach the image, so refusing on it would be a guard that cries about things
	@# that cannot hurt you, and those are the guards people learn to bypass.
	@#
	@# And it is DRIVEN rather than text-matched: `test/v2-staging-serves-what-is-merged.test.mjs`
	@# lifts the shell block out of the Makefile and runs it against scratch repositories in both
	@# states. My version asserted that the Makefile CONTAINS `git status --porcelain`, which would
	@# pass on a snippet that named the wrong paths, inverted the test, or could never fire.
	@#
	@# What stays here is the question theirs does not ask: identity.
	@git fetch -q origin main 2>/dev/null || true
	@if [ -z "$(DEV_ANYWAY)" ] && [ "$$(git rev-parse HEAD)" != "$$(git rev-parse origin/main 2>/dev/null)" ]; then \
		echo "✗ this checkout is not at origin/main, and staging serves what is merged."; \
		echo "    here:        $$(git rev-parse --short HEAD) on $$(git rev-parse --abbrev-ref HEAD)"; \
		echo "    origin/main: $$(git rev-parse --short origin/main 2>/dev/null || echo unknown)"; \
		echo ""; \
		echo "  Deploy from a checkout that is exactly origin/main. Use a dev stack for a branch: make up"; \
		exit 1; \
	fi
	@if [ -z "$(DEV_ANYWAY)" ]; then \
		$(call MERGED_CHECK,$(STAGING_STACK) on $(STAGING_PORT),up-remote) \
	fi

up: dev-guard migrations-check
	@if [ -n "$(REBUILD)" ]; then $(DEV) build --no-cache productos; fi
	$(DEV) up -d
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

# Against a store this stack does not own — Neon, or any managed Postgres.
#
# ⛔ NO LOCAL POSTGRES AND NO VOLUME, which is the point: with an external store
# nothing about this stack is durable, so nothing about it needs backing up.
# `make backup` and `make restore` are for the compose Postgres only and will not
# find a container here — the managed service's own snapshots are the answer.
up-remote: staging-guard migrations-check
	@test -f .env || { echo "no .env — cp .env.example .env and set DATABASE_URL"; exit 1; }
	docker compose -f docker-compose.remote.yml up --build -d
	@printf "waiting for the instance"
	@for i in $$(seq 1 60); do \
		if curl -fsS -m 2 http://localhost:$(PORT)/health >/dev/null 2>&1; then \
			echo ""; echo "✓ healthy at http://localhost:$(PORT) (external store)"; exit 0; \
		fi; \
		printf "."; sleep 1; \
	done; \
	echo ""; echo "✗ never became healthy. Its log:"; \
	docker compose -f docker-compose.remote.yml logs --tail 40 productos; exit 1

# Is the string in .env actually a store we can use?
#
# ⛔ BEFORE STANDING ANYTHING UP, because a bad connection string fails as a
# container that will not become healthy, and that looks like a bug in ProductOS
# rather than a typo in a URL. This says which it is, and applies the migrations
# while it is there — so the first real run has nothing left to go wrong.
#
# ⛔ It never prints the string. A connection string is a credential, and a
# Makefile that echoed it would put it in a scrollback and a CI log.
remote-doctor: build
	@test -f .env || { echo "no .env — cp .env.example .env and paste the Neon string"; exit 1; }
	@url=$$(./scripts/envvar.sh .env DATABASE_URL); \
	test -n "$$url" || { echo "DATABASE_URL is empty in .env"; exit 1; }; \
	echo "checking $$(printf '%s' "$$url" | sed -E 's#//[^@]*@#//***@#')"; \
	DATABASE_URL="$$url" node dist/cli/index.js hosted doctor

# ⛔ THE TWO TARGETS SOMEBODY REACHES FOR DID NOT EXIST HERE, AND THE ONES THAT DO ARE A TRAP.
#
# Peter, running the managed-store stack: *"is it clear how to update things and restart the docker
# image?"* Half of it was. `up-remote` already rebuilds — it is `up --build -d` — and nothing said
# so, while the two targets a person actually reaches for are `rebuild` and `restart`, which use the
# DEFAULT compose file. Run either against a managed store and you have not updated your instance:
# you have stood a second one up beside it with a local Postgres, which looks like it worked.
#
# So they exist by name, and the help says which stack each belongs to.
# ---------------------------------------------------------------------------
# ⛔ `make deploy` — THE ONLY SANCTIONED WAY 4100 CHANGES.
#
# Peter: *"going to have this session focused only on redeploying 4100 as changes come in, making
# sure the main branch is clean before deploy"*.
#
# `staging-guard` above answers "is this exactly what is merged, and is the tree clean" — which is
# what the IMAGE depends on, because `COPY src ./src` builds from the tree. This adds the two
# questions it cannot answer: does it compile, and does the suite pass. Every one of those has been
# wrong here within a day:
#
#   - a commit sat unpushed while the guard correctly refused, and finding out why took three commands
#   - local main and origin/main diverged after somebody merged a PR, and `pull` aborted
#   - `$(DEV)` was used by six targets and defined nowhere, with the suite green because the file
#     that would have caught it was a stale duplicate
#
# So the gate is a target rather than a habit. `deploy-check` deploys nothing and is safe to run at
# any time; `deploy` runs it, backs the store up, deploys, waits for health, then reads the store.
# ---------------------------------------------------------------------------
deploy-check: staging-guard
	@echo "  ✓ clean, and identical to origin/main at $$(git rev-parse --short HEAD)"
	@# ⛔ CHECKED FIRST, BECAUSE THE SUITE TAKES TEN MINUTES. `backup-remote` tests for `.env` too —
	@#    but after the slow part, so a deploy checkout missing it burned the whole run before saying
	@#    so. A gate that fails late on the cheapest possible question is a gate people stop running.
	@#
	@# ⛔ AND A WORKTREE NEVER HAS IT. `.env` is gitignored, correctly: it is a credential. So a fresh
	@#    deploy checkout starts without the one file every staging target needs, and nothing says so
	@#    until it is already ten minutes in. Found exactly that way.
	@test -f .env || { \
		echo "✗ no .env here, and every staging target needs DATABASE_URL from it."; \
		echo "  It is gitignored, so a worktree does not inherit one:"; \
		echo "    cp $(MAIN_WT)/.env .env"; \
		exit 1; \
	}
	@echo "  ✓ .env names a store"
	@echo "→ build"
	@npm run build >/dev/null || { echo "✗ it does not compile"; exit 1; }
	@echo "  ✓ compiles"
	@echo "→ migration numbering"
	@node scripts/migrations-check.mjs | sed 's/^/  /'
	@# ⛔ THE SUITE CAN BE ASSERTED RATHER THAN RE-RUN — AND THE ASSERTION NAMES A COMMIT.
	@#
	@# Running 600 tests inside the deploy is the strongest gate and it does not survive this
	@# machine. Three times now: ten minutes when idle, unbounded at load 102 with workers starved to
	@# 0.2% CPU, and twice killed outright for running longer than a single command may. A gate that
	@# cannot finish is a gate that stops 4100 from ever being deployed, which is a worse failure
	@# than the one it prevents.
	@#
	@# So the suite may be verified SEPARATELY and asserted here — but the assertion carries the sha
	@# it was run against, and is refused if that is not what is about to deploy. A bare
	@# `SKIP_TESTS=1` would be a flag somebody sets once and forgets; a sha cannot be stale without
	@# being wrong, and the refusal says which commit was actually verified.
	@#
	@#   make deploy SUITE_VERIFIED=$$(git rev-parse HEAD)     after running npm test yourself
	@#
	@# ⛔ It is not a way to deploy something unverified. It is a way to move the ten minutes outside
	@# a command that gets killed at ten minutes.
	@if [ -n "$(SUITE_VERIFIED)" ]; then \
		if [ "$(SUITE_VERIFIED)" != "$$(git rev-parse HEAD)" ]; then \
			echo "✗ SUITE_VERIFIED names $$(git rev-parse --short $(SUITE_VERIFIED) 2>/dev/null || echo "$(SUITE_VERIFIED)")"; \
			echo "  but this would deploy $$(git rev-parse --short HEAD). A suite result for another commit is not evidence about this one."; \
			exit 1; \
		fi; \
		echo "→ the suite: asserted green at $$(git rev-parse --short HEAD) by whoever ran it"; \
		echo "  ⛔ If that was not you, or not this commit, stop and run it."; \
	else \
		$(MAKE) --no-print-directory suite-now; \
	fi
	@echo "✓ deployable"

# The slow half, on its own, so a ten-minute step is not inside a command that dies at ten minutes.
suite-now:
	@echo "→ the suite (this is the slow one)"
	@out=$$(npm test 2>&1); \
	echo "$$out" | grep -E '^# (tests|pass|fail)' | sed 's/^/  /'; \
	echo "$$out" | grep -qE '^# fail 0$$' || { \
		echo "✗ tests fail — not deploying. The failures:"; \
		echo "$$out" | grep '^not ok' | head -10 | sed 's/^/    /'; exit 1; }
	@echo "  ✓ green at $$(git rev-parse --short HEAD) — pass this to deploy:"
	@echo "      make deploy SUITE_VERIFIED=$$(git rev-parse HEAD)"

deploy: deploy-check
	@echo "→ backing up the store first"
	@$(MAKE) --no-print-directory backup-remote
	@echo "→ deploying $$(git rev-parse --short HEAD) to $(STAGING_STACK) on $(STAGING_PORT)"
	@$(MAKE) --no-print-directory rebuild-remote >/dev/null
	@printf "→ waiting for health"
	@for i in $$(seq 1 90); do \
		if curl -fsS -m 2 http://localhost:$(STAGING_PORT)/health >/dev/null 2>&1; then echo " ✓"; break; fi; \
		printf "."; sleep 1; \
		test $$i -lt 90 || { echo ""; echo "✗ never became healthy. Its log:"; \
			docker compose -f docker-compose.remote.yml logs --tail 40 productos; exit 1; }; \
	done
	@# ⛔ The store is read AFTER, not before. A deploy that comes up healthy against a half-migrated
	@#    store is the failure worth catching, and `/health` deliberately says nothing about the
	@#    corpus so an exposed instance leaks no project names.
	@$(MAKE) --no-print-directory remote-doctor | tail -3 | sed 's/^/  /'
	@echo "✓ $$(git rev-parse --short HEAD) is live on $(STAGING_PORT)"

rebuild-remote: staging-guard build
	@test -f .env || { echo "no .env here — DATABASE_URL lives beside the compose file you started from"; exit 1; }
	docker compose -f docker-compose.remote.yml up --build -d
	@sleep 2
	@docker compose -f docker-compose.remote.yml logs --tail 15 productos

# ⛔ Exercises the migration ledger against the real store: a second boot must skip what it applied.
restart-remote: staging-guard
	@test -f .env || { echo "no .env here — DATABASE_URL lives beside the compose file you started from"; exit 1; }
	docker compose -f docker-compose.remote.yml restart productos
	@sleep 3
	@docker compose -f docker-compose.remote.yml logs --tail 10 productos

down-remote:
	docker compose -f docker-compose.remote.yml down

logs-remote:
	docker compose -f docker-compose.remote.yml logs -f productos

down:
	$(DEV) down

# ⛔ Named so nobody reaches for it by accident. `down` keeps the data; this does not.
# ⛔ THIS STACK ONLY, WHICH IS WHAT A PROJECT PER WORKTREE BOUGHT. The volume is named after the
# project, so from a worktree this takes that worktree's database and nothing else — and from the
# main checkout it takes dev's. `make stacks` says which one you are standing in.
nuke:
	@echo "⛔ This removes $(PRODUCTOS_STACK) and its database volume."
	@printf "   type the word nuke to continue: "; read ans; test "$$ans" = "nuke" || { echo "cancelled"; exit 1; }
	docker compose down -v
	@echo "✓ $(PRODUCTOS_STACK) and its volume are gone"

logs:
	$(DEV) logs -f productos

# Rebuild the image from current source. ⛔ Use this after editing src/ — the image
# carries a BUILT dist/, so a source change is invisible until the image is rebuilt.
# ⛔ KEPT, AND NARROWED TO WHAT IT IS NOW FOR: a dependency change. A source change needs nothing
# — the watcher has already picked it up. `make up REBUILD=1` is the same thing on the way up.
rebuild: dev-guard
	$(DEV) build --no-cache productos
	$(DEV) up -d productos
	@sleep 2
	@docker compose logs --tail 15 productos

# ⛔ Exercises the migration ledger: a second boot must skip what it already applied.
restart: dev-guard
	$(DEV) restart productos
	@sleep 3
	@docker compose logs --tail 10 productos

psql:
	docker compose exec postgres psql -U productos -d productos

shell:
	docker compose exec productos sh

# A browser session for one account. ⛔ The only way into the page today that is not
# single-account mode — there is no sign-in route, so this is it.
session: build
	@test -n "$(AS)" || { echo "usage: make session AS=you@example.com"; exit 1; }
	@echo "store: $(WHICH_DB)"
	@DATABASE_URL="$(DB_URL)" node dist/cli/index.js hosted session --as "$(AS)"

# Every project in the store the instance is using.
projects: build
	@echo "store: $(WHICH_DB)"
	@DATABASE_URL="$(DB_URL)" node dist/cli/index.js hosted projects

hosted-doctor: build
	@echo "store: $(WHICH_DB)"
	@DATABASE_URL="$(DB_URL)" node dist/cli/index.js hosted doctor

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
	@echo "store: $(WHICH_DB)"
	@set -e; \
	tmp=$$(mktemp -d)/v2; \
	node dist/cli/index.js v2 reset --at $$tmp >/dev/null; \
	slug=seed-$$(date +%H%M%S); \
	made=$$(DATABASE_URL="$(DB_URL)" node dist/cli/index.js hosted project new $$slug --as me@localhost --name "Seed"); \
	id=$$(printf '%s' "$$made" | sed -n 's/.*project \([a-zA-Z0-9_-]*\) .*/\1/p'); \
	test -n "$$id" || { echo "could not create a project:"; printf '%s\n' "$$made"; exit 1; }; \
	DATABASE_URL="$(DB_URL)" node dist/cli/index.js hosted import $$tmp --into $$id; \
	echo ""; \
	echo "✓ open http://localhost:$(PORT)/p/$$id/v2"

# Put a real corpus into the store, as a named checkpoint.
#
# ⛔ DISTINCT FROM `seed`, WHICH GENERATES ITS OWN. This one imports a directory
# somebody is actually working in, so it is the command that can publish real
# product truth to wherever DB_URL points — it prints the store first for that
# reason, and takes the directory explicitly rather than guessing `./v2`.
#
#   make checkpoint FROM=/path/to/v2 [SLUG=checkpoint]
checkpoint: build
	@test -n "$(FROM)" || { echo "usage: make checkpoint FROM=<corpus dir> [SLUG=name]"; exit 1; }
	@test -d "$(FROM)" || { echo "no directory at $(FROM)"; exit 1; }
	@echo "store: $(WHICH_DB)"
	@echo "from:  $(FROM)"
	@set -e; \
	slug=$${SLUG:-checkpoint-$$(date +%Y%m%d-%H%M%S)}; \
	made=$$(DATABASE_URL="$(DB_URL)" node dist/cli/index.js hosted project new $$slug \
	        --as me@localhost --name "$${NAME:-Checkpoint}"); \
	id=$$(printf '%s' "$$made" | sed -n 's/.*project \([a-zA-Z0-9_-]*\) .*/\1/p'); \
	test -n "$$id" || { echo "could not create a project:"; printf '%s\n' "$$made"; exit 1; }; \
	DATABASE_URL="$(DB_URL)" node dist/cli/index.js hosted import "$(FROM)" --into $$id; \
	echo ""; \
	echo "✓ $$id — open /p/$$id/v2 on the instance"

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
	out=$(BACKUP_DIR)/$(PRODUCTOS_STACK)-$$stamp.sql.gz; \
	docker compose exec -T postgres pg_dump -U productos -d productos --clean --if-exists | gzip > $$out; \
	test -s $$out || { echo "the dump is empty — is the stack up?"; rm -f $$out; exit 1; }; \
	gunzip -c $$out | grep -q "DROP TABLE IF EXISTS" || { echo "the dump cannot replace an existing schema"; rm -f $$out; exit 1; }; \
	echo "✓ $$out ($$(du -h $$out | cut -f1))"

# ---------------------------------------------------------------------------
# The same two, against a managed store — Neon, RDS, Cloud SQL.
#
# Peter: *"let's add a simple way to backup the database now so we can keep making
# changes to the corpus and ensuring we don't break anything. can be manually,
# outside of the server - just a way to copy the db down and restore it via the
# .env variable"*
#
# ⛔ THE TARGETS ABOVE CANNOT DO THIS, AND THEY LOOK LIKE THEY CAN. Both run
# `docker compose exec postgres`, and on a managed store there IS no postgres
# container — the whole point of that stack. Same trap as `rebuild`/`restart`:
# the names imply they work everywhere and they are about the local stack.
#
# ⛔ THE CLIENT RUNS IN A CONTAINER, PINNED TO A MAJOR. Nothing is required on the
# host — no brew install, no version to keep in step — and the major matters more
# than it looks: this store is PostgreSQL 18, the local stack pins 16, and
# `pg_dump` REFUSES a server newer than itself. Reaching for the version already
# in the compose file would have produced a confusing mismatch error rather than
# a backup, which is how a backup command ends up never being run twice.
#
# ⛔ THE URL GOES IN BY ENVIRONMENT, NEVER ARGV. It is a credential: in argv it
# lands in `ps` on a shared machine and in make's own echo of the command.
#
#   make backup-remote              ./backups/productos-remote-<stamp>.sql.gz
#   make restore-remote FILE=path   ⛔ replaces everything in the managed store
# ---------------------------------------------------------------------------

# ⛔ RUN BY `up`, NOT ONLY BY HAND. A numbering collision is invisible until a merge, and the one
# moment somebody is certain to be at a terminal is the moment they bring an instance up.
migrations-check: build
	@node scripts/migrations-check.mjs

# ⛔ THE SERVER AND THE CLIENT THAT DUMPS INTO IT ARE ONE NUMBER. They were two — `postgres:16-alpine`
#    in docker-compose.yml and 18 here — so a dump taken from the managed store could not be
#    restored into a dev stack at all: pg_dump 18 writes `SET transaction_timeout`, which 16 rejects.
#    `PG_IMAGE` is exported so compose reads the same value; override it and both move together.
PG_IMAGE  ?= postgres:18-alpine
PG_CLIENT ?= $(PG_IMAGE)
export PG_IMAGE

# ⛔ THE DUMP GOES THROUGH THE DIRECT ENDPOINT, NEVER THE POOLER — see scripts/unpooled.sh.
# pg_dump sets search_path to '' at SESSION scope, which a transaction pooler then hands to the next
# client. In this Makefile the next client is the container `deploy` recreates forty seconds later,
# and it died on its first statement with 3F000. Staging went down that way.
backup-remote:
	@test -f .env || { echo "no .env here — DATABASE_URL lives beside the compose file you started from"; exit 1; }
	@mkdir -p $(BACKUP_DIR)
	@url=$$(./scripts/envvar.sh .env DATABASE_URL); 	test -n "$$url" || { echo "DATABASE_URL is empty in .env"; exit 1; }; 	url=$$(./scripts/unpooled.sh "$$url"); 	stamp=$$(date +%Y%m%d-%H%M%S); 	out=$(BACKUP_DIR)/productos-remote-$$stamp.sql.gz; 	docker run --rm -e PGURL="$$url" $(PG_CLIENT) sh -c \
	  'pg_dump "$$PGURL" --clean --if-exists --no-owner --no-privileges --schema=public' \
	  | gzip > $$out || { echo "the dump failed — run 'make remote-doctor' first"; rm -f $$out; exit 1; }; 	test -s $$out || { echo "the dump is empty"; rm -f $$out; exit 1; }; 	gunzip -c $$out | grep -q "DROP TABLE IF EXISTS" || { echo "the dump cannot replace an existing schema"; rm -f $$out; exit 1; }; 	echo "✓ $$out ($$(du -h $$out | cut -f1))"; 	echo "  $$(gunzip -c $$out | grep -c '^COPY public') tables with data · restore with: make restore-remote FILE=$$out"

# ⛔ DESTRUCTIVE, AND AGAINST A STORE NOTHING LOCAL CAN UNDO. `make nuke` only ever
# cost a Docker volume; this replaces a managed database that may be the only copy.
# So: an explicit FILE, a typed word, and the store named before anything runs.
restore-remote:
	@test -f .env || { echo "no .env here — DATABASE_URL lives beside the compose file you started from"; exit 1; }
	@test -n "$(FILE)" || { echo "usage: make restore-remote FILE=$(BACKUP_DIR)/productos-remote-<stamp>.sql.gz"; exit 1; }
	@test -f "$(FILE)" || { echo "no such file: $(FILE)"; exit 1; }
	@url=$$(./scripts/envvar.sh .env DATABASE_URL); 	echo "⛔ This REPLACES everything in $$(printf '%s' "$$url" | sed -E 's#//[^@]*@#//***@#')"; 	echo "   with $(FILE). There is no local copy to fall back on."; 	printf "   type the word replace to continue: "; read ans; 	test "$$ans" = "replace" || { echo "cancelled"; exit 1; }; 	gunzip -c "$(FILE)" | docker run --rm -i -e PGURL="$$url" $(PG_CLIENT) \
	  sh -c 'psql "$$PGURL" -v ON_ERROR_STOP=1 -q' >/dev/null; \
	echo "✓ restored from $(FILE)"
	@#
	@# ⛔ THE INSTANCE HAS TO BE RESTARTED, AND FORGETTING IT LOOKS LIKE A FAILED RESTORE.
	@# Same reason as the local `restore` above: the process resolved its session id at boot
	@# and a restore replaces the table under it, so every page answers 401 on a perfectly
	@# good database.
	@docker compose -f docker-compose.remote.yml restart productos >/dev/null 2>&1 || true
	@printf "waiting for the instance"
	@for i in $$(seq 1 60); do \
		if curl -fsS -m 2 http://localhost:$(PORT)/health >/dev/null 2>&1; then echo " ✓"; break; fi; \
		printf "."; sleep 1; \
	done

# ⛔ DESTRUCTIVE, AND IT SAYS SO BEFORE IT RUNS. Restoring is the one operation here
# that can lose work somebody did since the dump, so it will not run without a file
# named explicitly — there is deliberately no "restore the latest".
restore:
	@test -n "$(FILE)" || { echo "usage: make restore FILE=$(BACKUP_DIR)/productos-<stamp>.sql.gz"; exit 1; }
	@test -f "$(FILE)" || { echo "no such file: $(FILE)"; exit 1; }
	@echo "⛔ This REPLACES $(PRODUCTOS_STACK) with $(FILE)."
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
