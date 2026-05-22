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
STARTED_SERVER=0
if curl -fsS "http://localhost:${PORT}/health" >"$PROOF_DIR/existing-health.json" 2>/dev/null; then
  log "Using existing server on :$PORT"
else
  log "Starting server on :$PORT"
  PORT="$PORT" node packages/server/dist/index.js >"$PROOF_DIR/server.log" 2>&1 &
  SERVER_PID=$!
  STARTED_SERVER=1
  trap 'if [[ "${STARTED_SERVER:-0}" = "1" ]]; then kill "$SERVER_PID" >/dev/null 2>&1 || true; fi' EXIT
  sleep 2
fi

curl -fsS "http://localhost:${PORT}/health" | tee "$PROOF_DIR/curl-health.json"
curl -iS "http://localhost:${PORT}/health" > "$PROOF_DIR/curl-health-i.txt"
curl -fsS "http://localhost:${PORT}/api/project" | tee "$PROOF_DIR/curl-project.json"
curl -iS "http://localhost:${PORT}/api/project" > "$PROOF_DIR/curl-api-project-i.txt"
curl -fsS "http://localhost:${PORT}/api/fonts" | tee "$PROOF_DIR/curl-fonts.json"
curl -iS "http://localhost:${PORT}/" > "$PROOF_DIR/curl-root-i.txt"
node -e "const fs=require('fs');const text=fs.readFileSync(process.argv[1],'utf8');if(!text.includes('<div id=\"root\"></div>')){throw new Error('root route does not look like editor index.html')}console.log('root html marker check ok')" "$PROOF_DIR/curl-root-i.txt" | tee -a "$PROOF_DIR/smoke.log"

ASSET_PATH="$(node -e "const fs=require('fs');const text=fs.readFileSync(process.argv[1],'utf8');const m=text.match(/\\/assets\\/[^\\\"']+/);if(!m){process.exit(2)}process.stdout.write(m[0]);" "$PROOF_DIR/curl-root-i.txt" || true)"
if [[ -n "${ASSET_PATH:-}" ]]; then
  curl -iS "http://localhost:${PORT}${ASSET_PATH}" > "$PROOF_DIR/curl-editor-asset-i.txt"
  log "PASS editor asset route reachable at ${ASSET_PATH}"
else
  log "WARN editor asset path not found in root HTML"
fi

node -e "const fs=require('fs');const inPath=process.argv[1];const outOrig=process.argv[2];const outMod=process.argv[3];const payload=JSON.parse(fs.readFileSync(inPath,'utf8'));const project=payload.project;fs.writeFileSync(outOrig,JSON.stringify({project},null,2));const marker='[smoke-roundtrip-'+Date.now()+']';project.site.description=(project.site.description||'')+' '+marker;fs.writeFileSync(outMod,JSON.stringify({project},null,2));console.log(marker);" "$PROOF_DIR/curl-project.json" "$PROOF_DIR/project-original.json" "$PROOF_DIR/project-modified.json" | tee "$PROOF_DIR/roundtrip-marker.txt"
curl -fsS -X PUT "http://localhost:${PORT}/api/project" -H 'content-type: application/json' --data-binary @"$PROOF_DIR/project-modified.json" | tee "$PROOF_DIR/curl-project-put.json"
curl -fsS "http://localhost:${PORT}/api/project" | tee "$PROOF_DIR/curl-project-after-put.json"
node -e "const fs=require('fs');const marker=fs.readFileSync(process.argv[1],'utf8').trim();const payload=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const desc=payload.project?.site?.description||'';if(!desc.includes(marker)){throw new Error('project save/load roundtrip marker missing after PUT')}console.log('project roundtrip marker check ok')" "$PROOF_DIR/roundtrip-marker.txt" "$PROOF_DIR/curl-project-after-put.json" | tee -a "$PROOF_DIR/smoke.log"
curl -fsS -X PUT "http://localhost:${PORT}/api/project" -H 'content-type: application/json' --data-binary @"$PROOF_DIR/project-original.json" | tee "$PROOF_DIR/curl-project-restore.json"
curl -fsS "http://localhost:${PORT}/api/project" | tee "$PROOF_DIR/curl-project-restored.json"

curl -fsS -X POST "http://localhost:${PORT}/api/ai/image" -H 'content-type: application/json' \
  -d '{"prompt":"catfish farm hero","targetContext":{"blockType":"hero","usage":"heroBackground"}}' \
  | tee "$PROOF_DIR/curl-ai-image.json"
curl -fsS "http://localhost:${PORT}/api/ai/providers/status" | tee "$PROOF_DIR/curl-ai-providers-status.json"
curl -fsS "http://localhost:${PORT}/api/ai/opencode/auth-status" | tee "$PROOF_DIR/curl-opencode-auth-status.json"
curl -fsS "http://localhost:${PORT}/api/secrets/status" | tee "$PROOF_DIR/curl-secrets-status.json"
curl -fsS -X POST "http://localhost:${PORT}/api/build" -H 'content-type: application/json' -d '{}' | tee "$PROOF_DIR/curl-build.json"
curl -fsS -X POST "http://localhost:${PORT}/api/publish" -H 'content-type: application/json' -d '{}' | tee "$PROOF_DIR/curl-publish.json"
curl -iS "http://localhost:${PORT}/api/unknown-route" > "$PROOF_DIR/curl-api-unknown-i.txt"

node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!p.sizeDecision||!p.sizeDecision.providerSize){throw new Error('sizeDecision missing from /api/ai/image response')}console.log('sizeDecision check ok')" "$PROOF_DIR/curl-ai-image.json" | tee -a "$PROOF_DIR/smoke.log"
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!Array.isArray(p.providers)){throw new Error('providers missing from /api/ai/providers/status response')}console.log('providers status check ok')" "$PROOF_DIR/curl-ai-providers-status.json" | tee -a "$PROOF_DIR/smoke.log"
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!p.ok||typeof p.status!=='string'){throw new Error('opencode auth status payload invalid')}console.log('opencode auth status check ok')" "$PROOF_DIR/curl-opencode-auth-status.json" | tee -a "$PROOF_DIR/smoke.log"
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!p.dryRun){throw new Error('publish was not dry-run')}if(String(p.target||'').startsWith('/var/www/')){throw new Error('publish target points to live web root')}console.log('publish dry-run check ok')" "$PROOF_DIR/curl-publish.json" | tee -a "$PROOF_DIR/smoke.log"
node -e "const fs=require('fs');const text=fs.readFileSync(process.argv[1],'utf8');if(!text.includes('404')||text.toLowerCase().includes('<!doctype html>')){throw new Error('/api/unknown returned non-api fallback')}console.log('api unknown route check ok')" "$PROOF_DIR/curl-api-unknown-i.txt" | tee -a "$PROOF_DIR/smoke.log"

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
- Root route serves editor index: ok
- Fonts API: ok
- AI image API: ok (safe no-key + size decision)
- AI providers status: ok
- OpenCode auth status: ok
- Secrets status: ok
- Build API: ok
- Publish API: dry-run expected
- Dist check: ok
RESULT

log "Smoke complete"
echo "$PROOF_DIR" > "$ROOT_DIR/.last-proof-dir"
