#!/usr/bin/env bash
# Regenerate the screenshots in EXAMPLE.md from this corpus.
#
# The example is a real ProductOS corpus, not hand-drawn mockups — so the
# pictures in the docs cannot drift from what the tool actually renders. Re-run
# this after any renderer change.
set -euo pipefail
cd "$(dirname "$0")"

# Playwright isn't a dependency of this repo. Point at any local install.
if [ -z "${PLAYWRIGHT_CORE:-}" ]; then
  PLAYWRIGHT_CORE=$(find "$HOME" -maxdepth 8 -path "*/playwright-core/index.js" 2>/dev/null | head -1)
fi
if [ -z "$PLAYWRIGHT_CORE" ]; then
  echo "Set PLAYWRIGHT_CORE to a playwright-core/index.js path" >&2; exit 1
fi
export PLAYWRIGHT_CORE
npm --prefix ../.. run build
productos serve --port 7881 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 4
node ./shots.cjs
echo "✓ screenshots in ./img"
