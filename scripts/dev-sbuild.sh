#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3137}"
EDITOR_PORT="${EDITOR_PORT:-5177}"

echo "Starting sBuild dev environment"
echo "Server: http://localhost:${PORT}"
echo "Editor: http://localhost:${EDITOR_PORT}"

pnpm --parallel --filter @sbuild/server --filter @sbuild/editor dev
