#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-3000}"
NODE_MAJOR="${NODE_MAJOR:-22}"

node_version() {
  "$1" -v 2>/dev/null || true
}

node_major() {
  local version="${1#v}"
  echo "${version%%.*}"
}

resolve_node() {
  if [ -n "${BUDGET_NODE_BIN:-}" ]; then
    echo "$BUDGET_NODE_BIN"
    return 0
  fi

  local candidate
  for candidate in \
    "/opt/homebrew/opt/node@${NODE_MAJOR}/bin/node" \
    "/usr/local/opt/node@${NODE_MAJOR}/bin/node"; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  if command -v node >/dev/null 2>&1; then
    candidate="$(command -v node)"
    local version
    version="$(node_version "$candidate")"
    if [ -n "$version" ] && [ "$(node_major "$version")" = "$NODE_MAJOR" ]; then
      echo "$candidate"
      return 0
    fi
  fi

  if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    if nvm use --silent >/dev/null 2>&1; then
      command -v node
      return 0
    fi
  fi

  return 1
}

NODE_BIN="$(resolve_node || true)"
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  echo "Could not find a working Node ${NODE_MAJOR}.x runtime."
  echo "Install it with Homebrew or nvm, then run this script again."
  echo "Homebrew: brew install node@${NODE_MAJOR}"
  exit 1
fi

NODE_VERSION="$(node_version "$NODE_BIN")"
if [ -z "$NODE_VERSION" ]; then
  echo "Node was found at $NODE_BIN, but it does not run cleanly."
  "$NODE_BIN" -v
  exit 1
fi

if [ "$(node_major "$NODE_VERSION")" != "$NODE_MAJOR" ] && [ "${BUDGET_ALLOW_NODE_MISMATCH:-}" != "1" ]; then
  echo "This project is pinned to Node ${NODE_MAJOR}.x, but $NODE_BIN is $NODE_VERSION."
  echo "Set BUDGET_ALLOW_NODE_MISMATCH=1 only when intentionally testing another Node version."
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  LISTENER="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$LISTENER" ]; then
    echo "Port $PORT is already in use."
    echo "$LISTENER"
    echo
    echo "If this is the Budget frontend, open http://$HOST:$PORT."
    echo "Otherwise stop that process or run with another port, for example: PORT=3001 scripts/dev-local.sh"
    exit 0
  fi
fi

if [ -e .next/dev/lock ]; then
  NEXT_DEV_PROCS="$(ps aux 2>/dev/null | grep "[n]ext/dist/bin/next dev" || true)"
  if [ -n "$NEXT_DEV_PROCS" ]; then
    echo "A Next dev server already has this checkout locked."
    echo "$NEXT_DEV_PROCS"
    echo
    echo "Use the running server, or stop it before starting another port."
    exit 0
  fi

  echo "Found .next/dev/lock but could not identify a running Next dev process."
  echo "If no dev server is running, remove .next/dev/lock and try again."
  exit 1
fi

export PATH="$(dirname "$NODE_BIN"):$PATH"

echo "Using Node $NODE_VERSION at $NODE_BIN"
echo "Starting Budget frontend at http://$HOST:$PORT"
exec npm run dev -- --hostname "$HOST" --port "$PORT"
