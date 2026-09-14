#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

APP_PORT="${APP_PORT:-5173}"

if [[ ! "$APP_PORT" =~ ^[0-9]+$ ]] || (( APP_PORT < 1 || APP_PORT > 65535 )); then
  echo "APP_PORT must be a number between 1 and 65535 (received: $APP_PORT)." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required to start this application." >&2
  echo "Install Node.js from https://nodejs.org/ and try again." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  npm ci
fi

# Stop Vite processes previously launched from this checkout. Without this,
# Vite sees the occupied default port and silently starts another instance on
# the next available port.
old_pids=()
while IFS= read -r pid; do
  [[ -n "$pid" && "$pid" != "$$" ]] && old_pids+=("$pid")
done < <(ps -axo pid=,command= | awk -v project="$PROJECT_DIR" '
  index($0, project "/node_modules/.bin/vite") { print $1 }
')

if (( ${#old_pids[@]} > 0 )); then
  echo "Stopping previous development server (${old_pids[*]})..."
  kill "${old_pids[@]}" 2>/dev/null || true

  for _ in {1..20}; do
    remaining=0
    for pid in "${old_pids[@]}"; do
      kill -0 "$pid" 2>/dev/null && remaining=1
    done
    (( remaining == 0 )) && break
    sleep 0.1
  done
fi

echo "Starting AJAZZ AK820 Pro Web Configurator on http://localhost:${APP_PORT}/ajazz-ak820-config/ ..."
exec npm run dev -- "$@" --port "$APP_PORT" --strictPort
