#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-3137}"

if [[ ! -f "packages/editor/dist/index.html" ]]; then
  echo "[sbuild] editor dist missing; running pnpm -r build"
  pnpm -r build
fi

echo "[sbuild] starting local server on http://127.0.0.1:${PORT}"
PORT="$PORT" node packages/server/dist/index.js
