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

log "Running npm run build..."
npm run build

log "Starting npm run dev..."
npm run dev
