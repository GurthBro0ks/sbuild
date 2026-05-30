# AI Markup Theme Isolation + QA Repair — Result

## Summary
Fixed AI Markup mode theme bleed where editor dark theme styling leaked into website preview. Also fixed paint overlay sizing and touch drawing reliability. Updated toolbar text for clarity.

## Changes (commit fdc105f)

### Fix 1: Theme Isolation (editor dark → site preview bleed)
- **Root cause**: `.canvas-frame` relied on inherited `--editor-*` CSS vars from `.sbuild-editor-shell`. When Builder UI Theme was set to Dark, the dark `--editor-*` values cascaded into site preview blocks via CSS variable fallback chains in `.block-shell` and other site content selectors.
- **Fix**: Added explicit light-theme `--editor-*` defaults inside `.canvas-frame` selector. This guarantees changing Builder UI Theme to Dark does NOT affect website preview colors.
- **File**: `packages/editor/src/styles.css` (`.canvas-frame` block)
- **Tests**: 4 new UI contract tests verifying `--editor-bg`, `--editor-accent`, `--editor-text`, `--editor-border` are reset to light values, and not set to `initial`.

### Fix 2: Paint overlay sizing
- **Root cause**: `.paint-overlay` had `position: absolute; inset: 0` but no explicit `width`/`height`, which could cause incomplete canvas coverage in some layout contexts.
- **Fix**: Added `width: 100%; height: 100%` to `.paint-overlay`.
- **File**: `packages/editor/src/styles.css`
- **Tests**: Assertions verifying explicit width/height on `.paint-overlay`.

### Fix 3: Touch drawing reliability
- **Root cause**: Paint capture overlay lacked `touch-action: none` and `user-select: none`, allowing browser touch gestures and text selection to interfere with drawing on mobile.
- **Fix**: Added `touch-action: none`, `user-select: none`, and `-webkit-user-select: none` to `.paint-overlay.capture-active`.
- **File**: `packages/editor/src/styles.css`

### Fix 4: Toolbar text clarity
- **Change**: "Discard" → "Discard Markup"; helper text now reads "Click and drag to draw. Markup is only for AI notes and is not published."
- **Files**: `packages/editor/src/App.tsx`, `packages/editor/src/ui-contract.test.js`

## Verification Evidence
```
pnpm --filter @sbuild/editor typecheck → PASS
pnpm --filter @sbuild/editor build → PASS
pnpm -r lint → PASS
pnpm --filter @sbuild/editor test → 307/307 PASS
pnpm -r test → editor 307/307, server 39/39, cli ok
bash scripts/smoke-sbuild.sh → PASS
systemctl --user restart sbuild.service → active
curl http://127.0.0.1:3137/health → publishAllowed=false, editorDistExists=true
curl -X POST /api/publish (unauth) → 401
```

## Safety
- publishAllowed remains false
- unauth POST /api/publish returns 401
- Runtime files (project/project.json, project/image-folder.json) NOT committed
- No force push used

## Pushed to origin/main
- Commit fdc105f pushed to origin/main
