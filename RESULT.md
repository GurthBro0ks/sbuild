# Website Manager QA Repair — Result

## Fixes

### Fix 1: Desktop right panel top row buttons clipping
- **Root cause**: `.right-drawer` had `overflow: hidden` which clipped the right-drawer-header contents (tab row buttons) when the panel height was constrained.
- **Fix**: Removed `overflow: hidden` from `.right-drawer`. The `.right-drawer-content` already has its own `overflow-y: auto` for scrollable content. The header with `overflow: visible; flex: 0 0 auto` now expands freely without being clipped.
- **File**: `packages/editor/src/styles.css`
- **Test**: Updated "right panel layout prevents content clipping" to not require `overflow: hidden`. Added "right panel header tab row is not clipped by parent overflow" test verifying `overflow-y: hidden` is absent and header has `overflow: visible`.

### Fix 2: Preview mode links/nav navigation
- **Root cause**: Nav item `<span>` `onClick` handler checked `if (previewMode) return;` and did nothing — all nav click interaction was disabled in preview.
- **Fix**: Added preview-mode branch to nav item onClick that:
  - Opens external URLs (`http://`, `https://`, `//`) in new tab with `noopener`
  - Scrolls to hash anchors (`#element-id`) via `scrollIntoView`
  - Looks up internal paths (`/page-slug`) against `project.pages` and navigates via `setSelectedPageId`
- **File**: `packages/editor/src/App.tsx`
- **Tests**: "preview mode nav links navigate by page slug", "preview mode nav links open external URLs in new tab", "preview mode nav links handle hash anchors", "preview mode nav click does not select or edit nav items"

### Fix 3: iPhone Safari zoom prevention
- **Root cause**: Modal/drawer inputs had no explicit `font-size` (browser default < 16px on iOS triggers auto-zoom). New Page step 1 input used `autoFocus` causing zoom on modal open.
- **Fix**: Added `font-size: 16px` to all `.modal input/select/textarea` and `.right-drawer input/select/textarea`. Removed `autoFocus` from new page name input.
- **File**: `packages/editor/src/styles.css`, `packages/editor/src/App.tsx`
- **Tests**: "modal and drawer inputs use 16px font-size to prevent iOS zoom", "new page flow step 1 input does not use autoFocus to prevent iOS zoom"

## Validation
- **typecheck**: PASS
- **build**: PASS
- **lint**: PASS
- **test**: PASS (editor 248/248, server 22/22)
- **smoke**: PASS
- **publishAllowed**: `false` (dry-run)
- **/api/publish unauth**: `401 Authentication required`

## Proof Directory
`/tmp/proof_sbuild_website_manager_qa_repair_20260529T221813Z`
