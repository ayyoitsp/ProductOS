#!/bin/sh
# Read one variable out of a .env file, the way compose does.
#
# ⛔ NOT BY SOURCING IT. `. ./.env` runs the file as shell, so a value containing
# `&` is read as a control operator: a Neon string ends up backgrounding its own
# assignment, and the variable comes back EMPTY in the calling shell. That is not
# hypothetical — it is how `make remote-doctor` reported "DATABASE_URL is empty"
# against a .env that plainly had it, and the only hint was a `?sslmode=require&
# channel_binding=require` tail.
#
# ⛔ AND COMPOSE DOES NOT CARE. Its own .env parser takes the value literally, so
# `up-remote` would have worked while `remote-doctor` insisted the file was empty
# — two tools disagreeing about the same file, which is worse than either failing.
# This parses, so both agree whether or not anybody remembered to quote it.
#
# Usage: scripts/envvar.sh <file> <NAME>
set -eu

file=${1:?usage: envvar.sh <file> <NAME>}
name=${2:?usage: envvar.sh <file> <NAME>}

[ -f "$file" ] || exit 0

# First match wins, matching compose. Everything after the first `=` is the value;
# one layer of surrounding single or double quotes is stripped, and nothing in the
# value is ever interpreted.
awk -v key="$name" '
  # Skip comments and blanks without touching anything that merely contains a #.
  /^[[:space:]]*#/ { next }
  /^[[:space:]]*$/ { next }
  {
    eq = index($0, "=")
    if (eq == 0) next
    k = substr($0, 1, eq - 1)
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", k)
    if (k != key) next
    v = substr($0, eq + 1)
    sub(/\r$/, "", v)                      # a file edited on Windows
    if (v ~ /^".*"$/) v = substr(v, 2, length(v) - 2)
    else if (v ~ /^'"'"'.*'"'"'$/) v = substr(v, 2, length(v) - 2)
    print v
    exit
  }
' "$file"
