#!/usr/bin/env bash
set -u

cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"

echo "Budget frontend local diagnostics"
echo

echo "Project:"
echo "  path: $(pwd)"
echo "  .nvmrc: $(tr -d '[:space:]' < .nvmrc 2>/dev/null || echo missing)"
PROJECT_NODE=""
for candidate in /opt/homebrew/opt/node@22/bin/node /usr/local/opt/node@22/bin/node node; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -v >/dev/null 2>&1; then
    PROJECT_NODE="$candidate"
    break
  fi
done
if [ -n "$PROJECT_NODE" ]; then
  echo "  package engine: $("$PROJECT_NODE" -e "console.log(require('./package.json').engines?.node || 'missing')")"
else
  echo "  package engine: unavailable because no working node was found"
fi
echo

echo "Default node on PATH:"
if command -v node >/dev/null 2>&1; then
  echo "  path: $(command -v node)"
  NODE_OUTPUT="$(node -v 2>&1)"
  NODE_STATUS=$?
  echo "  version/status: $NODE_OUTPUT"
  if [ "$NODE_STATUS" -ne 0 ]; then
    echo "  problem: default node does not run cleanly"
  fi
else
  echo "  problem: node is not on PATH"
fi
echo

echo "Known Homebrew runtimes:"
for candidate in /opt/homebrew/opt/node@22/bin/node /opt/homebrew/opt/node@24/bin/node /opt/homebrew/bin/node /usr/local/opt/node@22/bin/node /usr/local/opt/node@24/bin/node /usr/local/bin/node; do
  if [ -x "$candidate" ]; then
    VERSION="$("$candidate" -v 2>&1)"
    STATUS=$?
    if [ "$STATUS" -eq 0 ]; then
      echo "  ok: $candidate -> $VERSION"
    else
      echo "  broken: $candidate -> $VERSION"
    fi
  fi
done
echo

echo "Port $PORT:"
if command -v lsof >/dev/null 2>&1; then
  LISTENER="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$LISTENER" ]; then
    echo "$LISTENER" | sed 's/^/  /'
  else
    echo "  free"
  fi
else
  echo "  lsof unavailable"
fi
echo

echo "Next dev lock:"
if [ -e .next/dev/lock ]; then
  echo "  present: .next/dev/lock"
  NEXT_DEV_PROCS="$(ps aux 2>/dev/null | grep "[n]ext/dist/bin/next dev" || true)"
  if [ -n "$NEXT_DEV_PROCS" ]; then
    echo "$NEXT_DEV_PROCS" | sed 's/^/  /'
  else
    echo "  no running Next dev process identified"
  fi
else
  echo "  none"
fi
echo

echo "Recommended local command:"
echo "  scripts/dev-local.sh"
