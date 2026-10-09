#!/bin/sh
# Which Docker stack and which ports belong to a checkout. Defaults to this one.
#
#   ./scripts/stack.sh                      → eval-able: PRODUCTOS_STACK=… PORT=… PG_PORT=…
#   ./scripts/stack.sh /path/to/a/worktree  → the same, for that checkout
#   ./scripts/stack.sh . stack|port|pg      → one field, unquoted
#
# ⛔ ONE FIELD AT A TIME EXISTS FOR MAKE. `$(eval $(shell ...))` collapses newlines to spaces, so a
# script emitting three assignments gets read as ONE — `PRODUCTOS_STACK` came out holding the whole
# line and `PG_PORT` came out empty, which then put an instance on a port nobody asked for. Shell
# callers still want the one-line form, because `eval` handles it correctly.
#
# ⛔ `productos` ON 4100 IS DEV, AND DEV SERVES WHAT IS MERGED.
#
# Peter: *"i'd like 'dev' to be up to date, and we already redeploy 4100 with what's merged.
# individual trees can maintain their own docker instance/own port, but 4100 should be kept clean"*.
#
# So the main checkout gets the plain names and nothing else can: a worktree is on a branch, and a
# worktree that could bring up the `productos` project would put unmerged code on the port the
# corpus is reviewed on, with no sign on the page that it had happened.
#
# ⛔ THE PORT IS DERIVED, NOT ALLOCATED. A number handed out on first use has to be remembered
# somewhere, and a file that records which port a worktree took is a file that goes stale the moment
# the worktree is deleted and the name reused. A hash of the worktree name is stable across
# `make down`, reboots and re-clones, and is the same answer from inside the worktree or from here —
# which is what lets `make stacks` list every checkout without visiting any of them.
#
# ⛔ IT TAKES A PATH BECAUSE A WORKTREE ON AN OLDER BRANCH DOES NOT HAVE THIS FILE. A listing that
# printed "?" for the checkouts you actually want to compare would be worth nothing.
set -eu

# ⛔ STAGING'S NAMES LIVE HERE TOO, SO "IS THIS STAGING?" HAS ONE ANSWER.
#
# `dev-guard` and `staging-guard` both need to know what staging is called and which port it holds,
# and a second copy of `4100` in the Makefile is a second thing to change. Printed on request
# rather than computed into the dev answer — nothing below can return these.
STAGING_STACK=productos-staging
STAGING_PORT=4100

dir=${1:-.}
top=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || top=""
main=$(git -C "$dir" worktree list 2>/dev/null | head -1 | awk '{ print $1 }')

# ⛔ EVERY CHECKOUT GETS A DEV STACK, AND THE MAIN ONE IS CALLED `main` RATHER THAN NOTHING.
#
# The main checkout used to take the plain `productos` / 4100 / 5432. Now that 4100 is staging it
# takes `productos-dev-main` on a derived port like everybody else, and the arithmetic below is the
# only thing that ever answers — so there is no branch of this script that can return 4100.
if [ -z "$top" ] || [ -z "$main" ]; then
  # Not a git checkout at all: give it the main checkout's answer rather than staging's.
  name=main
  slug=main
else
  if [ "$top" = "$main" ]; then
    name=main
  else
    name=$(basename "$top")
    # ⛔ `main` IS RESERVED, AND A WORKTREE DIRECTORY MAY BE CALLED THAT.
    #
    # The main checkout is named `main` above regardless of its path. Anything else is named after
    # its directory — so a worktree at `…/scratchpad/main` claimed `productos-dev-main` and port
    # 4286, the SAME compose project and the SAME two ports as the main checkout. Two trees sharing
    # one project share one volume and one database, which is the single thing a stack per worktree
    # exists to prevent; it arrived back through the name rather than through the port arithmetic.
    #
    # Found by `no checkout resolves to staging's stack or either of its ports`, which asserts the
    # derived ports are distinct across every checkout git knows about. Another session had made a
    # worktree called `main` in its scratchpad, and the whole suite went red on `origin/main`.
    #
    # Disambiguated by a stable hash of the ABSOLUTE PATH, so the answer survives `make down`, a
    # reboot and a re-clone, and is the same asked from inside the worktree or from anywhere else.
    # ⛔ Only when it would collide: appending a hash unconditionally would rename every existing
    # stack, and five sessions have containers running under the current names.
    if [ "$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')" = "main" ]; then
      name="$name-$(printf '%s' "$top" | cksum | awk '{ printf "%04x", $1 % 65536 }')"
    fi
  fi
  slug=$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | cut -c1-40)
fi

{
  : "$slug"
  # ⛔ A STABLE HASH, AND cksum IS IN POSIX. Ports land in 4200-4288 and 5500-5588, so dev's 4100
  #    and 5432 are unreachable from here by construction rather than by a check somebody runs.
  #
  # ⛔ 42xx AND NOT 41xx, AND THE REASON OUTLIVED THE THING THAT CAUSED IT. The first cut started at
  #    4101, and a `productos-style-preview` container was sitting on 4101 at the time — so the very
  #    first worktree to hash to zero would have failed to bind, against a container with a ProductOS
  #    name that nothing here knew about. That container has since been removed by the session that
  #    ran it, so the floor is no longer about it: 41xx is dev's family, people put one-off ProductOS
  #    containers next to dev because 4100 is the number they remember, and two stacks wanting one
  #    port is reported by Docker as "port is already allocated" — which names the port and not the
  #    reason. A gap costs nothing; the same hour of confusion twice costs more.
  n=$(printf '%s' "$slug" | cksum | awk '{ print $1 % 89 }')
  stack="productos-dev-$slug"
  port=$((4200 + n))
  pg=$((5500 + n))
}

case ${2:-} in
  staging-stack) echo "$STAGING_STACK" ;;
  staging-port)  echo "$STAGING_PORT" ;;
  stack) echo "$stack" ;;
  port)  echo "$port" ;;
  pg)    echo "$pg" ;;
  "")    echo "PRODUCTOS_STACK=$stack PORT=$port PG_PORT=$pg WORKTREE=$name" ;;
  *)     echo "unknown field: $2 (stack | port | pg | staging-stack | staging-port)" >&2; exit 2 ;;
esac
