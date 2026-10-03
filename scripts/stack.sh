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

dir=${1:-.}
top=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || top=""
main=$(git -C "$dir" worktree list 2>/dev/null | head -1 | awk '{ print $1 }')

if [ -z "$top" ] || [ -z "$main" ] || [ "$top" = "$main" ]; then
  stack=productos
  port=4100
  pg=5432
  name=""
else
  name=$(basename "$top")
  slug=$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | cut -c1-40)
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
  stack="productos-$slug"
  port=$((4200 + n))
  pg=$((5500 + n))
fi

case ${2:-} in
  stack) echo "$stack" ;;
  port)  echo "$port" ;;
  pg)    echo "$pg" ;;
  "")    echo "PRODUCTOS_STACK=$stack PORT=$port PG_PORT=$pg WORKTREE=$name" ;;
  *)     echo "unknown field: $2 (stack | port | pg)" >&2; exit 2 ;;
esac
