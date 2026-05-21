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

node -e "const fs=require('fs');const inPath=process.argv[1];const outOrig=process.argv[2];const outMod=process.argv[3];const payload=JSON.parse(fs.readFileSync(inPath,'utf8'));const project=payload.project;fs.writeFileSync(outOrig,JSON.stringify({project},null,2));const marker='[smoke-roundtrip-'+Date.now()+']';project.site.description=(project.site.description||'')+' '+marker;fs.writeFileSync(outMod,JSON.stringify({project},null,2));console.log(marker);" "$PROOF_DIR/curl-project.json" "$PROOF_DIR/project-original.json" "$PROOF_DIR/project-modified.json" | tee "$PROOF_DIR/roundtrip-marker.txt"
curl -fsS -X PUT "http://localhost:${PORT}/api/project" -H 'content-type: application/json' --data-binary @"$PROOF_DIR/project-modified.json" | tee "$PROOF_DIR/curl-project-put.json"
curl -fsS "http://localhost:${PORT}/api/project" | tee "$PROOF_DIR/curl-project-after-put.json"
node -e "const fs=require('fs');const marker=fs.readFileSync(process.argv[1],'utf8').trim();const payload=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const desc=payload.project?.site?.description||'';if(!desc.includes(marker)){throw new Error('project save/load roundtrip marker missing after PUT')}console.log('project roundtrip marker check ok')" "$PROOF_DIR/roundtrip-marker.txt" "$PROOF_DIR/curl-project-after-put.json" | tee -a "$PROOF_DIR/smoke.log"
curl -fsS -X PUT "http://localhost:${PORT}/api/project" -H 'content-type: application/json' --data-binary @"$PROOF_DIR/project-original.json" | tee "$PROOF_DIR/curl-project-restore.json"
curl -fsS "http://localhost:${PORT}/api/project" | tee "$PROOF_DIR/curl-project-restored.json"

curl -fsS -X POST "http://localhost:${PORT}/api/ai/image" -H 'content-type: application/json' \
  -d '{"prompt":"catfish farm hero","targetContext":{"blockType":"hero","usage":"heroBackground"}}' \
  | tee "$PROOF_DIR/curl-ai-image.json"
curl -fsS -X POST "http://localhost:${PORT}/api/build" -H 'content-type: application/json' -d '{}' | tee "$PROOF_DIR/curl-build.json"
curl -fsS -X POST "http://localhost:${PORT}/api/publish" -H 'content-type: application/json' -d '{}' | tee "$PROOF_DIR/curl-publish.json"

node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!p.sizeDecision||!p.sizeDecision.providerSize){throw new Error('sizeDecision missing from /api/ai/image response')}console.log('sizeDecision check ok')" "$PROOF_DIR/curl-ai-image.json" | tee -a "$PROOF_DIR/smoke.log"
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!p.dryRun){throw new Error('publish was not dry-run')}if(String(p.target||'').startsWith('/var/www/')){throw new Error('publish target points to live web root')}console.log('publish dry-run check ok')" "$PROOF_DIR/curl-publish.json" | tee -a "$PROOF_DIR/smoke.log"

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
- Project save/load roundtrip: ok
- Fonts API: ok
- AI image API: ok (safe no-key + size decision)
- Build API: ok
- Publish API: dry-run expected
- Dist check: ok
RESULT

log "Smoke complete"
echo "$PROOF_DIR" > "$ROOT_DIR/.last-proof-dir"
