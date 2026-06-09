#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION_FILE="packages/shared/src/version.ts"

current_version() {
  grep -oP 'SBUILD_VERSION = "\K[^"]+' "$VERSION_FILE" || echo "0.0.0"
}

show() {
  local v
  v=$(current_version)
  local commit="unknown"
  local branch="unknown"
  local count=0
  if command -v git &>/dev/null && git rev-parse --short HEAD &>/dev/null; then
    commit=$(git rev-parse --short HEAD)
    branch=$(git rev-parse --abbrev-ref HEAD)
    count=$(git rev-list --count HEAD 2>/dev/null || echo 0)
  fi
  local display="${v}.${count}+${commit}"
  echo "sBuild $v"
  echo "  display:  $display"
  echo "  commit:   $commit"
  echo "  count:    $count"
  echo "  branch:   $branch"
  echo "  file:     $VERSION_FILE"
}

bump() {
  local kind="${1:-patch}"
  local v
  v=$(current_version)
  # Strip -dev suffix for parsing
  local base="${v%-dev}"
  local major="${base%%.*}"
  local rest="${base#*.}"
  local minor="${rest%%.*}"
  local patch="${rest#*.}"

  case "$kind" in
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    patch)
      patch=$((patch + 1))
      ;;
    *)
      echo "Usage: $0 show | bump [major|minor|patch]"
      exit 1
      ;;
  esac

  local new="${major}.${minor}.${patch}-dev"
  if [[ "${DRY_RUN:-}" == "1" ]]; then
    echo "[dry-run] Would bump $v → $new"
  else
    sed -i "s/SBUILD_VERSION = \"[^\"]\+\"/SBUILD_VERSION = \"$new\"/" "$VERSION_FILE"
    echo "Bumped $v → $new"
    echo "Rebuild with: npm run build"
    echo "Then restart: systemctl --user restart sbuild.service"
  fi
}

case "${1:-show}" in
  show)
    show
    ;;
  bump)
    bump "${2:-patch}"
    ;;
  *)
    echo "Usage: $0 show | bump [major|minor|patch]"
    echo ""
    echo "  show           Show current base version and display version"
    echo "  bump [kind]    Bump base version (major|minor|patch), keeps -dev suffix"
    echo ""
    echo "Build identity (commit, count) updates automatically on every build."
    echo "Only bump base version for accepted milestones."
    exit 1
    ;;
esac
