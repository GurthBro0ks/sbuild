#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROOF_DIR="${SBUILD_PROOF_DIR:-/tmp/proof_sbuild_goal_$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$PROOF_DIR"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$PROOF_DIR/smoke.log"
}

run_and_log() {
  local name="$1"
  shift
  log "RUN $name: $*"
  if "$@" >"$PROOF_DIR/${name}.log" 2>&1; then
    log "PASS $name"
  else
    log "WARN $name failed (see $PROOF_DIR/${name}.log)"
    return 1
  fi
}

log "Proof dir: $PROOF_DIR"
node -v | tee "$PROOF_DIR/node-version.txt"
pnpm -v | tee "$PROOF_DIR/pnpm-version.txt" || true
npm -v | tee "$PROOF_DIR/npm-version.txt"

run_and_log "pnpm-install" pnpm install
run_and_log "typecheck" pnpm -r typecheck
run_and_log "build" pnpm -r build
run_and_log "lint" pnpm -r lint
run_and_log "test" pnpm -r test

PORT="${PORT:-3137}"
log "Starting server on :$PORT"
PORT="$PORT" node packages/server/dist/index.js >"$PROOF_DIR/server.log" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID >/dev/null 2>&1 || true' EXIT
sleep 2

curl -fsS "http://localhost:${PORT}/health" | tee "$PROOF_DIR/curl-health.json"
curl -fsS "http://localhost:${PORT}/api/project" | tee "$PROOF_DIR/curl-project.json"
curl -fsS "http://localhost:${PORT}/api/fonts" | tee "$PROOF_DIR/curl-fonts.json"
curl -fsS -X POST "http://localhost:${PORT}/api/build" -H 'content-type: application/json' -d '{}' | tee "$PROOF_DIR/curl-build.json"
curl -fsS -X POST "http://localhost:${PORT}/api/publish" -H 'content-type: application/json' -d '{}' | tee "$PROOF_DIR/curl-publish.json"

if [[ -f dist/index.html && -f dist/assets/styles.css ]]; then
  log "PASS static output exists"
else
  log "FAIL static output missing"
  exit 1
fi

git status --short | tee "$PROOF_DIR/git-status.txt"
git diff --stat | tee "$PROOF_DIR/git-diff-stat.txt"

cat > "$PROOF_DIR/RESULT.md" <<RESULT
# Smoke Result

- Proof dir: $PROOF_DIR
- Health: ok
- Project API: ok
- Fonts API: ok
- Build API: ok
- Publish API: dry-run expected
- Dist check: ok
RESULT

log "Smoke complete"
echo "$PROOF_DIR" > "$ROOT_DIR/.last-proof-dir"
