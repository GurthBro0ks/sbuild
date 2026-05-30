# Theme Bleed Fix Round 2 — Result

## Summary
Fixed remaining editor theme bleed into website preview/canvas. The prior fix (commit fdc105f) added `--editor-*` CSS var defaults inside `.canvas-frame` but did not address `.canvas-area` which is the outer wrapper that visually surrounds the canvas frame. When editor theme is Dark, `.canvas-area` inherited `var(--editor-bg)` = `#1e1e1e`, causing dark background to appear between canvas-controls, panel-status, canvas-frame, and around the canvas on wide viewports.

## Commit
`1a5611b` — `fix: isolate website canvas theme from editor chrome`

## Root Cause
`.canvas-area` (`packages/editor/src/styles.css:747`) had **no background property**. It inherited `var(--editor-bg)` from `.sbuild-editor-shell`. This caused dark editor chrome background to show:
- Between `.canvas-controls` / `.panel-status` / `.canvas-frame` (flex `gap: 10px`)
- Behind `.canvas-frame` when content was shorter than container
- On sides of `.canvas-frame` (which uses `margin: 0 auto` + `max-width: 1000px`)
- In areas between page elements (perceived as "row gutters" and "empty areas between blocks")

The prior fix only reset CSS variables inside `.canvas-frame`, but the `.canvas-area` wrapper is outside `.canvas-frame` in the DOM tree, so the reset did not help.

## Fix Applied
### `packages/editor/src/styles.css` (+1 line)
- Added `background: var(--sbuild-editor-bg, var(--sbuild-page-bg, var(--sbuild-bg, #f6f3e9)))` to `.canvas-area`
- This uses the site theme's page background color (e.g., `#f3ecdc` for Harvest Light) for the canvas area

### `packages/editor/src/App.tsx` (+1 change)
- Extended `applySiteTheme` `querySelectorAll` to include `.canvas-area` so site-theme CSS variables (`--sbuild-editor-bg`, etc.) are set on it

## Validation Results
| Gate | Result |
|------|--------|
| `pnpm -r typecheck` | PASS |
| `pnpm -r build` | PASS |
| `pnpm -r lint` | PASS |
| `pnpm -r test` | 311/311 PASS (editor 311, server 39) |
| `bash scripts/smoke-sbuild.sh` | PASS |
| `systemctl --user is-active sbuild.service` | active |
| `curl -fsS http://127.0.0.1:3137/health` | ok=true, publishAllowed=false |
| `curl -fsS https://sbuilder.blackfishfarms.com/health` | ok=true, publishAllowed=false |
| `curl -s -o /dev/null -w "%{http_code}" -X POST /api/publish` | 401 |

## Files Changed
- `packages/editor/src/styles.css` — Added background to `.canvas-area`
- `packages/editor/src/App.tsx` — Added `.canvas-area` to theme variable targets
- `packages/editor/src/ui-contract.test.js` — Added 4 new contract tests for theme isolation

## Contract Tests Added
1. `canvas-area uses site-theme background var not editor var`
2. `canvas-area site theme var is applied via applySiteTheme`
3. `row-shell does not have its own background (transparent, shows canvas-frame theme bg)`
4. `canvas-frame border uses --editor-border (reset to light inside canvas)`

## Pushed
NO — awaiting manual QA acceptance.

## Manual QA Checklist

### Desktop
1. Login as admin
2. Open Settings/About and confirm commit `1a5611b`
3. Select Harvest Light theme
4. Scroll page in Edit mode
5. **Verify**: page/canvas background and row gaps are light/cream, not editor-dark
6. **Verify**: editor chrome outside page remains dark (left/right panels, topbar)
7. Toggle Preview and confirm links work
8. Toggle Markup and draw across header/hero/cards/lower sections
9. **Verify**: Markup does not cause theme bleed
10. **Verify**: text/block selection is disabled in Markup
11. **Verify**: Clear / Keep Markup / Discard Markup behavior
12. **Verify**: Website Manager still works
13. **Verify**: admin sees User Management and Image/API Keys
14. **Verify**: non-admin does not see User Management or Image/API Keys
15. **Verify**: Publish remains dry-run

### Mobile (iPhone Safari)
1. Open on iPhone Safari
2. **Verify**: Harvest Light page/canvas does not show dark row gaps
3. **Verify**: Markup toolbar is usable
4. **Verify**: Settings tabs still fit
5. **Verify**: non-admin/admin tab visibility still matches role
6. **Verify**: no zoom regression on modal inputs

## Dirty Files (not committed)
- `project/project.json`
- `project/image-folder.json`
