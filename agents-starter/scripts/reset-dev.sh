#!/usr/bin/env bash
# Helper macro to clean Wrangler/Vite caches, rebuild, and restart dev mode.
# Usage: ./scripts/reset-dev.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

log() {
  printf "[reset-dev] %s\n" "$1"
}

log "Clearing Wrangler temporary bundle cache..."
rm -rf .wrangler/tmp

log "Removing Vite cache directories..."
rm -rf node_modules/.cache .vite .parcel-cache

log "Ensuring dependencies are installed..."
npm install

if ACCOUNT_INFO=$(npx --yes wrangler whoami 2>/dev/null); then
  ACCOUNT_LINE="$(printf '%s' "$ACCOUNT_INFO" | head -n 1)"
  log "Wrangler authenticated (${ACCOUNT_LINE}). Remote dev + Workers AI are available."
else
  log "Wrangler not logged in. Running in local-only mode. Run 'npx wrangler login' to enable Workers AI."
fi

log "Starting full dev environment (worker + frontend)..."
exec npm run start
