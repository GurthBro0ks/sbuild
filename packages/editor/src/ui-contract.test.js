import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const layoutHelpersSource = readFileSync(new URL("../../shared/src/layoutHelpers.ts", import.meta.url), "utf8");
const smokeSource = readFileSync(new URL("../../../scripts/smoke-sbuild.sh", import.meta.url), "utf8");

test("gallery slots expose direct selection and selected-slot highlight affordances", () => {
  assert.match(appSource, /selectGallerySlot\(block\.id, index\)/);
  assert.match(appSource, /setSelectedGalleryIndex\(index\)/);
  assert.match(appSource, /Selected Gallery image/);
  assert.match(appSource, /selected-gallery-slot/);
  assert.match(cssSource, /\.selected-gallery-slot/);
  assert.match(cssSource, /\.gallery-slot-badge/);
});

test("image manager labels gallery add and replace actions explicitly", () => {
  assert.match(appSource, /Replace Gallery image/);
  assert.match(appSource, /Add to Gallery/);
  assert.match(appSource, /Set as this Image block's photo/);
  assert.match(appSource, /Select an Image block or Gallery image slot to use this as image content\./);
});

test("crop-fit and modal layout expose safe visible targets", () => {
  assert.match(appSource, /Crop\/Fit target:/);
  assert.match(appSource, /Crop\/Fit and replace/);
  assert.match(appSource, /Close Image Manager/);
  assert.match(cssSource, /\.image-action-stack/);
  assert.match(cssSource, /\.compact-tabs[\s\S]*flex-wrap: wrap/);
  assert.match(cssSource, /\.right-drawer-content[\s\S]*overflow-y: auto/);
});

test("builder UI theme helper explains editor chrome versus website preview", () => {
  assert.match(appSource, /Builder UI Theme/);
  assert.match(appSource, /Website Theme/);
  assert.match(appSource, /changes only the editor/);
  assert.match(appSource, /changes only the page preview/);
  assert.match(appSource, /topbar.*left.*right.*panels.*buttons.*Builder/i);
});

test("style persistence updates selected block part and triggers dirty", () => {
  assert.match(appSource, /updateSelectedPartStyle/);
  assert.match(appSource, /patchSelectedBlock/);
  assert.match(appSource, /setDirty\(true\)/);
  assert.match(appSource, /saveProject/);
  assert.match(appSource, /\/api\/project.{0,40}PUT/);
  assert.match(cssSource, /\.right-drawer-content[\s\S]*overflow-y: auto/);
  assert.match(cssSource, /\.right-drawer[\s\S]*overflow: hidden/);
  assert.match(cssSource, /\.compact-tabs[\s\S]*flex-wrap: wrap/);
  assert.match(cssSource, /\.image-action-stack button[\s\S]*width: 100%/);
});

test("right panel layout prevents content clipping", () => {
  assert.match(appSource, /className="right-drawer-header"/);
  assert.match(appSource, /className="right-drawer-content"/);
  assert.match(cssSource, /\.right-drawer[\s\S]*max-height: 100%/);
  assert.match(cssSource, /\.right-drawer[\s\S]*height: 100%/);
  assert.match(cssSource, /\.right-drawer[\s\S]*\bmin-width\b.*\d+px/);
  assert.match(cssSource, /\.right-drawer[\s\S]*overflow: hidden/);
  assert.match(cssSource, /\.right-drawer-content[\s\S]*overflow-y: auto/);
  assert.match(cssSource, /overflow-x: hidden/);
  assert.match(cssSource, /overscroll-behavior: contain/);
  assert.match(cssSource, /scrollbar-gutter: stable/);
  assert.match(cssSource, /\.panel[\s\S]*overflow-x: hidden/);
  assert.match(cssSource, /\.right-drawer-header[\s\S]*border-bottom/);
  assert.match(cssSource, /\.image-action-stack button[\s\S]*word-break: break-word/);
  assert.match(cssSource, /\.app[\s\S]*height: 100vh/);
  assert.match(cssSource, /\.app[\s\S]*overflow: hidden/);
  assert.match(cssSource, /\.workspace[\s\S]*overflow: hidden/);
  assert.match(cssSource, /\.canvas-area[\s\S]*overflow-y: auto/);
});

test("background mode controls expose type selector and mode-specific panels", () => {
  assert.match(appSource, /bgMode/);
  assert.match(appSource, /backgroundColor: undefined, backgroundImage: undefined, gradientType: undefined, gradientColors: undefined, gradientDirection: undefined/);
  assert.match(appSource, /className=\{bgMode === "theme" \? "selected" : ""\}/);
  assert.match(appSource, /className=\{bgMode === "solid" \? "selected" : ""\}/);
  assert.match(appSource, /className=\{bgMode === "gradient" \? "selected" : ""\}/);
  assert.match(appSource, /className=\{bgMode === "image" \? "selected" : ""\}/);
  assert.match(appSource, /className=\{bgMode === "transparent" \? "selected" : ""\}/);
  assert.match(appSource, /bgMode === "solid"/);
  assert.match(appSource, /bgMode === "transparent"/);
  assert.match(appSource, /bgMode === "gradient"/);
  assert.match(appSource, /bgMode === "image"/);
  assert.match(appSource, /Transparent — content behind this block shows through/);
});

test("right drawer tabs have reduced padding and button min-width to prevent clipping", () => {
  assert.match(cssSource, /\.right-drawer \.compact-tabs[\s\S]*padding-left:\s*8px/);
  assert.match(cssSource, /\.right-drawer \.compact-tabs[\s\S]*padding-right:\s*8px/);
  assert.match(cssSource, /\.right-drawer \.compact-tabs[\s\S]*padding-top:\s*12px/);
  assert.match(cssSource, /\.right-drawer \.compact-tabs[\s\S]*padding-bottom:\s*10px/);
  assert.match(cssSource, /\.compact-tabs button[\s\S]*min-width:\s*36px/);
  assert.match(cssSource, /\.compact-tabs button[\s\S]*min-height:\s*34px/);
  assert.match(cssSource, /\.compact-tabs button[\s\S]*line-height:\s*1\.2/);
});

test("right drawer chip/button rows allow wrap and visible focus space", () => {
  assert.match(cssSource, /\.right-drawer \.tabs,\n\.right-drawer \.button-row,\n\.right-drawer \.preset-row[\s\S]*overflow:\s*visible/);
  assert.match(cssSource, /\.right-drawer button[\s\S]*min-height:\s*34px/);
  assert.match(cssSource, /\.right-drawer button[\s\S]*line-height:\s*1\.25/);
  assert.match(cssSource, /\.right-drawer \.button-row,\n\.right-drawer \.preset-row,\n\.right-drawer \.quick-actions[\s\S]*row-gap:\s*8px/);
  assert.match(cssSource, /\.tabs[\s\S]*flex-wrap:\s*wrap/);
  assert.match(cssSource, /\.tabs[\s\S]*padding-block:\s*3px/);
});

test("mobile right drawer header and tabs are not clipped by overflow-hidden", () => {
  assert.match(cssSource, /\.mobile-editor-sheet[\s\S]*overflow:\s*hidden/);
  assert.match(cssSource, /\.mobile-editor-sheet-header[\s\S]*flex-shrink:\s*0/);
  assert.match(cssSource, /\.mobile-editor-sheet-tabs[\s\S]*flex-shrink:\s*0/);
  assert.match(cssSource, /\.mobile-editor-sheet-target[\s\S]*flex-shrink:\s*0/);
});

test("gallery slot has mobile-safe pointer handler that stops parent block overwrite", () => {
  assert.match(appSource, /onPointerUp=\{\(e\)[\s\S]*if\s*\(onImageSelect\)[\s\S]*onImageSelect\(i\)/);
  assert.match(appSource, /target\.closest\('\.gallery-slot'\)/);
  assert.match(appSource, /if\s*\(isMobileViewport\s*&&\s*target\.closest\('\.gallery-slot'\)\)\s*\{\s*return;\s*\}/);
});

test("gallery slot selection sets index and images tab without auto-opening drawer", () => {
  assert.match(appSource, /function selectGallerySlot/);
  assert.match(appSource, /setSelectedGalleryIndex\(index\)/);
  assert.match(appSource, /setRightTab\("images"\)/);
  assert.doesNotMatch(appSource, /function selectGallerySlot[\s\S]{0,120}if\s*\(isMobileViewport\)\s*setRightDrawerMobileOpen\(true\)/);
});

test("canvas frame background uses site variables not editor variables", () => {
  assert.match(cssSource, /\.canvas-frame[\s\S]*background:\s*var\(--sbuild-canvas-bg/);
  assert.doesNotMatch(cssSource, /\.canvas-frame\s*\{[^{}]*background:\s*var\(--editor-panel-bg\)[^{}]*\}/);
});

test("mobile editor shell uses <=768px stacked layout and mobile overlay", () => {
  assert.match(appSource, /isMobileViewport/);
  assert.match(appSource, /mobile-shell/);
  assert.match(appSource, /rightDrawerMobileOpen/);
  assert.match(appSource, /mobile-editor-overlay/);
  assert.match(appSource, /mobile-editor-sheet/);
  assert.match(appSource, /mobile-drawer-toolbar/);
  assert.match(appSource, /drawer-close-btn/);
  assert.match(cssSource, /@media \(max-width: 768px\)/);
  assert.match(cssSource, /\.workspace,\n\s*\.workspace\.left-collapsed[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(cssSource, /\.left-drawer[\s\S]*position:\s*fixed/);
  assert.match(cssSource, /\.left-drawer\.collapsed[\s\S]*display:\s*none/);
  assert.match(cssSource, /\.mobile-editor-overlay[\s\S]*position:\s*fixed/);
  assert.match(cssSource, /\.mobile-editor-sheet[\s\S]*position:\s*fixed/);
  assert.match(cssSource, /\.canvas-controls[\s\S]*position:\s*sticky/);
  assert.match(cssSource, /\.topbar-status[\s\S]*width:\s*100%/);
  assert.match(cssSource, /overflow-x:\s*hidden/);
  assert.match(appSource, /function openBlockDrawer/);
  assert.match(appSource, /setRightDrawerMobileOpen\(true\)/);
  assert.match(appSource, /function openGallerySlotDrawer/);
});

test("mobile single tap on block selects only and does not auto-open drawer", () => {
  assert.match(appSource, /function selectBlock\(blockId: string\)/);
  assert.doesNotMatch(appSource, /function selectBlock[\s\S]{0,80}setRightDrawerMobileOpen\(true\)/);
  assert.match(appSource, /if \(isMobileViewport\) \{\s*\/\/ Mobile single tap: select only, do not open drawer/);
  assert.match(appSource, /setSelectedBlockId\(blockId\)/);
});

test("mobile long press on block opens right drawer", () => {
  assert.match(appSource, /function startLongPress/);
  assert.match(appSource, /longPressRef\.current\.timer = setTimeout/);
  assert.match(appSource, /openBlockDrawer\(blockId\)/);
  assert.match(appSource, /500\)/);
  assert.match(appSource, /function cancelLongPress/);
  assert.match(appSource, /cancelLongPress/);
});

test("mobile ellipsis menu button opens same context menu as desktop", () => {
  assert.doesNotMatch(appSource, /if \(isMobileViewport\) \{ openBlockDrawer\(block\.id\); \} else \{ openContextMenu/);
  assert.match(appSource, /openContextMenu\(e, block\.id\)/);
  assert.match(cssSource, /\.context-btn \{/);
  assert.match(cssSource, /min-width:\s*36px/);
  assert.match(cssSource, /min-height:\s*36px/);
});

test("gallery slot single tap selects slot without opening drawer", () => {
  assert.match(appSource, /function selectGallerySlot/);
  assert.doesNotMatch(appSource, /function selectGallerySlot[\s\S]{0,120}setRightDrawerMobileOpen\(true\)/);
  assert.match(appSource, /onSlotLongPress\?: \(index: number\)/);
});

test("gallery slot long press opens drawer with correct target", () => {
  assert.match(appSource, /function openGallerySlotDrawer/);
  assert.match(appSource, /setRightDrawerMobileOpen\(true\)/);
  assert.match(appSource, /setRightTab\("images"\)/);
  assert.match(appSource, /slotTimerRef\.current = setTimeout/);
  assert.match(appSource, /onSlotLongPress\?\./);
});

test("desktop single click behavior remains unchanged", () => {
  assert.match(appSource, /if \(!isMobileViewport\) selectBlock\(block\.id\)/);
  assert.match(appSource, /if \(!drag\) selectBlock\(blockId\)/);
});

test("mobile edit hint is visible only on mobile", () => {
  assert.match(appSource, /mobile-edit-hint/);
  assert.match(appSource, /Tap text to edit directly · Long-press or tap/);
  assert.match(cssSource, /\.mobile-edit-hint \{/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.mobile-edit-hint[\s\S]*display:\s*block/);
});

test("publish endpoint remains dry-run", () => {
  assert.match(appSource, /runPublish/);
  assert.match(appSource, /\/api\/publish/);
  assert.match(appSource, /dryRun/);
});

test("smoke script treats unauth publish 401 as expected gate behavior", () => {
  assert.match(smokeSource, /PUBLISH_UNAUTH_STATUS/);
  assert.match(smokeSource, /unauth \/api\/publish expected 401/);
  assert.match(smokeSource, /SKIPPED_AUTH_HELPER_MISSING/);
  assert.match(smokeSource, /SBUILD_SMOKE_COOKIE_FILE/);
});

test("debug diagnostics include mobile toolbar status offset marker", () => {
  assert.match(appSource, /mobileToolbarStatusOffset=active/);
});

test("mobile overlay backdrop dimming stays light and sheet remains separate", () => {
  assert.match(cssSource, /\.mobile-editor-overlay[\s\S]*background:\s*transparent/);
  assert.match(cssSource, /\.mobile-editor-overlay\.open[\s\S]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.22\)/);
  assert.match(appSource, /className={`mobile-editor-overlay \$\{rightDrawerMobileOpen \? "open" : ""\}`}/);
  assert.match(appSource, /<section className="mobile-editor-sheet" role="dialog" aria-label="Edit block">/);
});

test("mobile editor header keeps title and close in single compact row", () => {
  assert.match(appSource, /<div className="mobile-editor-sheet-header">[\s\S]*<h2>Edit block<\/h2>[\s\S]*className="mobile-editor-x-close"/);
  assert.match(cssSource, /\.mobile-editor-sheet-header[\s\S]*display:\s*flex/);
  assert.match(cssSource, /\.mobile-editor-sheet-header[\s\S]*justify-content:\s*space-between/);
  assert.match(cssSource, /\.mobile-editor-sheet-header[\s\S]*padding:\s*6px\s*12px/);
  assert.doesNotMatch(appSource, /mobile-editor-close-row|close-only-row/);
});

test("mobile close button preserves aria label and tap target", () => {
  assert.match(appSource, /className="mobile-editor-x-close"[\s\S]*aria-label="Close editor drawer"/);
  assert.match(cssSource, /\.mobile-editor-x-close[\s\S]*width:\s*44px/);
  assert.match(cssSource, /\.mobile-editor-x-close[\s\S]*height:\s*44px/);
});

test("mobile drawer forms enforce full width controls and no horizontal overflow", () => {
  assert.match(cssSource, /\.mobile-editor-sheet input,[\s\S]*\.mobile-editor-sheet textarea,[\s\S]*\.mobile-editor-sheet select[\s\S]*width:\s*100%/);
  assert.match(cssSource, /\.mobile-editor-sheet input,[\s\S]*max-width:\s*100%/);
  assert.match(cssSource, /\.mobile-editor-sheet input,[\s\S]*box-sizing:\s*border-box/);
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*overflow-x:\s*hidden/);
});

test("mobile AI panel uses stacked fields and non-colliding button rows", () => {
  assert.match(appSource, /<div className="panel mobile-ai-panel">/);
  assert.match(appSource, /Optional Provider Size Override/);
  assert.match(appSource, /className="button-row mobile-button-row"/);
  assert.match(appSource, />Send<\/button>/);
  assert.match(appSource, />Generate image for this block/);
  assert.match(appSource, /Apply photo edit/);
});

test("mobile props style controls stack safely in sheet", () => {
  assert.match(cssSource, /\.mobile-editor-sheet \.button-row,[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(cssSource, /\.mobile-editor-sheet \.part-selector,[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(cssSource, /\.mobile-editor-sheet \.preset-row[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(cssSource, /\.mobile-editor-sheet \.color-input-inline[\s\S]*width:\s*100%/);
});

test("context menu includes required mobile row and layout actions", () => {
  assert.match(appSource, /Edit Properties[\s\S]*AI Assistant/);
  assert.match(appSource, /AI Assistant[\s\S]*Resize\/Layout/);
  assert.match(appSource, /Place with block above/);
  assert.match(appSource, /Place with block below/);
  assert.match(appSource, /Start new row/);
  assert.match(appSource, /Remove from row \/ Leave row/);
  assert.match(appSource, /Move Up/);
  assert.match(appSource, /Move Down/);
});

test("row stacking is controlled by device mode instead of physical viewport", () => {
  assert.match(appSource, /type RowRenderItem/);
  assert.match(appSource, /function toRowRenderItems\(blocks: Block\[\]\)/);
  assert.match(appSource, /kind: "row"/);
  assert.match(appSource, /kind: "single"/);
  assert.match(appSource, /data-row-id=\{row\.rowId\}/);
  assert.match(appSource, /rowRenderItems\.map/);
  assert.match(appSource, /const shouldStackRows = deviceMode === "phone";/);
  assert.match(appSource, /className=\{`row-shell \$\{row\.blocks\.length > 1 \? "multi" : "single"\} \$\{shouldStackRows \? "stack" : ""\}`\}/);
  assert.match(appSource, /data-device-mode=\{deviceMode\}/);
  assert.match(appSource, /data-stack-rows=\{shouldStackRows \? "true" : "false"\}/);
  assert.match(appSource, /data-row-columns=\{row\.blocks\.length\}/);
  assert.match(appSource, /Row debug: mode=\{deviceMode\} stack=\{shouldStackRows \? "true" : "false"\} cols=\{row\.blocks\.length\} template=\{rowTemplate\}/);
  assert.match(appSource, /className=\{`block-shell[\s\S]*\$\{shouldStackRows \? "mobile-row-block" : ""\}`\}/);
  assert.match(appSource, /shortRowId\(row\.rowId\.startsWith\("single:"\) \? undefined : row\.rowId\)/);
  assert.match(appSource, /· \{row\.blocks\.length\} columns/);
});

test("phone mode keeps readable stacked row width while desktop/tablet can stay row-like", () => {
  assert.match(appSource, /const rowTemplate = shouldStackRows[\s\S]*row\.blocks\.map\(\(\) => "minmax\(0, 1fr\)"\)\.join\(" "\)/);
  assert.match(appSource, /className="row-grid" style=\{\{ gridTemplateColumns: rowTemplate \}\}/);
  assert.match(cssSource, /\.canvas-frame\.desktop \.row-shell\.multi \.row-grid[\s\S]*grid-auto-flow:\s*column/);
  assert.match(cssSource, /\.canvas-frame\.tablet \.row-shell\.multi \.row-grid[\s\S]*align-items:\s*stretch/);
  assert.match(cssSource, /\.canvas-frame\.desktop \.row-shell\.multi \.row-grid > \.block-shell,[\s\S]*min-width:\s*0 !important/);
  assert.match(cssSource, /\.canvas-frame\.phone \.row-shell\.stack \.block-shell\.mobile-row-block[\s\S]*width:\s*100% !important/);
  assert.match(cssSource, /\.canvas-frame\.phone \.row-shell\.stack \.block-shell\.mobile-row-block[\s\S]*flex:\s*0 0 100% !important/);
  assert.match(cssSource, /\.canvas-frame\.phone \.row-shell\.stack \.block-shell\.mobile-row-block[\s\S]*flex-basis:\s*100% !important/);
  assert.match(cssSource, /\.canvas-frame\.phone \.row-shell\.stack \.row-grid[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) !important/);
  assert.doesNotMatch(cssSource, /\.canvas-frame\.mobile-viewport \.row-shell\.stack \.row-grid/);
});

test("context row action flow still closes overlays and publish stays dry-run", () => {
  assert.match(appSource, /setContextMenu\(null\)/);
  assert.match(appSource, /runPublish/);
  assert.match(appSource, /dryRun/);
});

test("desktop row layout remains side-by-side capable", () => {
  assert.match(cssSource, /\.row-grid[\s\S]*display:\s*grid/);
  assert.match(cssSource, /\.row-grid[\s\S]*min-width:\s*0/);
  assert.match(cssSource, /\.row-grid[\s\S]*width:\s*100%/);
  assert.match(cssSource, /\.row-grid[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(cssSource, /\.row-shell\.stack \.row-grid[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) !important/);
  assert.match(cssSource, /\.canvas-frame\.desktop \.row-shell\.multi \.row-grid,[\s\S]*display:\s*grid !important/);
  assert.match(cssSource, /\.canvas-frame\.desktop \.row-shell\.multi \.row-grid > \.block-shell/);
  assert.match(cssSource, /\.canvas-frame\.tablet \.row-shell\.multi \.row-grid > \.block-shell/);
  assert.doesNotMatch(cssSource, /@media \(max-width: 1100px\)[\s\S]*\.row-grid\s*\{[\s\S]*flex-wrap:\s*wrap/);
});

test("mobile block header layout uses wrap-safe structure and keeps menu button tappable", () => {
  assert.match(appSource, /className="block-meta-main"/);
  assert.match(appSource, /className="block-meta-badges"/);
  assert.match(appSource, /className="context-btn"[\s\S]*title="Menu"/);
  assert.match(cssSource, /\.block-meta[\s\S]*flex-wrap:\s*wrap/);
  assert.match(cssSource, /\.canvas-frame\.phone \.row-shell\.stack \.block-meta-main[\s\S]*flex-wrap:\s*wrap/);
  assert.match(cssSource, /\.context-btn[\s\S]*min-width:\s*36px/);
  assert.match(cssSource, /\.context-btn[\s\S]*min-height:\s*36px/);
});

test("width and row badges are wrap-safe and do not rely on overlap-prone absolute placement", () => {
  assert.match(cssSource, /\.resize-badge[\s\S]*max-width:\s*100%/);
  assert.match(cssSource, /\.canvas-frame\.phone \.row-shell\.stack \.resize-badge[\s\S]*white-space:\s*normal/);
  assert.match(cssSource, /\.canvas-frame\.phone \.row-shell\.stack \.block-meta-badges[\s\S]*order:\s*3/);
  assert.doesNotMatch(cssSource, /\.resize-badge\s*\{[^{}]*position:\s*absolute/);
});

test("row and layout context menu actions select context block id before applying", () => {
  assert.match(appSource, /selectBlock\(contextMenu\.blockId\); openResizeLayoutForBlock\(contextMenu\.blockId\);/);
  assert.match(appSource, /selectBlock\(contextMenu\.blockId\); startNewRow\(contextMenu\.blockId\);/);
  assert.match(appSource, /selectBlock\(contextMenu\.blockId\); placeWithPrevious\(contextMenu\.blockId\);/);
  assert.match(appSource, /selectBlock\(contextMenu\.blockId\); placeWithNext\(contextMenu\.blockId\);/);
  assert.match(appSource, /selectBlock\(contextMenu\.blockId\); removeFromRow\(contextMenu\.blockId\);/);
  assert.match(appSource, /selectBlock\(contextMenu\.blockId\); moveBlock\("up", contextMenu\.blockId\);/);
  assert.match(appSource, /selectBlock\(contextMenu\.blockId\); moveBlock\("down", contextMenu\.blockId\);/);
});

test("place-with-row actions close context menu and set explicit status text", () => {
  assert.match(appSource, /Place with block above/);
  assert.match(appSource, /Place with block below/);
  assert.match(appSource, /function closeTransientOverlays\(\)/);
  assert.match(appSource, /setContextMenu\(null\);\s*setRightDrawerMobileOpen\(false\);/);
  assert.match(appSource, /selectBlock\(contextMenu\.blockId\); placeWithPrevious\(contextMenu\.blockId\); closeTransientOverlays\(\);/);
  assert.match(appSource, /selectBlock\(contextMenu\.blockId\); placeWithNext\(contextMenu\.blockId\); closeTransientOverlays\(\);/);
  assert.match(appSource, /setStatus\("Placed block with block above"\)/);
  assert.match(appSource, /setStatus\("Placed block with block below"\)/);
});

test("remove from row action remains available and clears row membership", () => {
  assert.match(appSource, /Remove from row \/ Leave row/);
  assert.match(appSource, /selectBlock\(contextMenu\.blockId\); removeFromRow\(contextMenu\.blockId\); closeTransientOverlays\(\);/);
  assert.match(appSource, /leaveRowForBlock\(selectedPage\.blocks, idx\)/);
  assert.match(appSource, /setStatus\("Removed block from row"\)/);
});

test("leave-row helper normalizes single leftover row member to full width", () => {
  assert.match(layoutHelpersSource, /if \(remainingIndexes\.length <= 1\)/);
  assert.match(layoutHelpersSource, /widthMode:\s*"full"/);
  assert.match(layoutHelpersSource, /widthPercent:\s*100/);
  assert.match(layoutHelpersSource, /rowId:\s*undefined/);
});

test("row width normalization defaults to balanced widths and rejects stale invalid sums", () => {
  assert.match(layoutHelpersSource, /function defaultRowWidths/);
  assert.match(layoutHelpersSource, /const keepExisting = validWidths && sum >= 99 && sum <= 101/);
  assert.match(layoutHelpersSource, /const normalizedWidths = keepExisting \? widths : defaultRowWidths\(indexes\.length\)/);
});

test("canvas frame tags mobile viewport class for mobile-only row visual overrides", () => {
  assert.match(appSource, /className=\{`canvas-frame sbuild-site-preview sbuild-rendered-page \$\{deviceMode\} \$\{isMobileViewport \? "mobile-viewport" : ""\}`\}/);
});

test("move up and move down actions remain present after row operations", () => {
  assert.match(appSource, /Move Up/);
  assert.match(appSource, /Move Down/);
  assert.match(appSource, /selectBlock\(contextMenu\.blockId\); moveBlock\("up", contextMenu\.blockId\); closeTransientOverlays\(\);/);
  assert.match(appSource, /selectBlock\(contextMenu\.blockId\); moveBlock\("down", contextMenu\.blockId\); closeTransientOverlays\(\);/);
});

test("row action status text and context menu closing behavior remain explicit", () => {
  assert.match(appSource, /setStatus\("Placed block with block above"\)/);
  assert.match(appSource, /setStatus\("Placed block with block below"\)/);
  assert.match(appSource, /setStatus\(direction === "up" \? "Moved block up" : "Moved block down"\)/);
  assert.match(appSource, /setStatus\("Removed block from row"\)/);
  assert.match(appSource, /setContextMenu\(null\)/);
});

test("context menu uses light backdrop dim layer", () => {
  assert.match(appSource, /className="context-menu-backdrop"/);
  assert.match(cssSource, /\.context-menu-backdrop[\s\S]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.2\)/);
});

test("mobile site title single tap edits directly without opening drawer", () => {
  assert.match(appSource, /contentEditable=\{!previewMode\}[\s\S]*project\.site\.siteName/);
  assert.match(appSource, /if \(previewMode\) return;[\s\S]*setSelectedSitePart\("site-title"\)/);
  assert.doesNotMatch(appSource, /if \(isMobileViewport\)[\s\S]{0,120}setSelectedSitePart\("site-title"\)[\s\S]{0,60}Site title selected/);
});

test("mobile site title long press opens right drawer", () => {
  assert.match(appSource, /function startSiteHeaderLongPress/);
  assert.match(appSource, /siteHeaderLongPressRef\.current\.timer = setTimeout/);
  assert.match(appSource, /startSiteHeaderLongPress\("site-title"/);
  assert.match(appSource, /function cancelSiteHeaderLongPress/);
  assert.match(appSource, /cancelSiteHeaderLongPress/);
});

test("mobile nav link single tap edits directly without opening drawer", () => {
  assert.match(appSource, /contentEditable=\{!previewMode\}[\s\S]*item\.label/);
  assert.match(appSource, /if \(previewMode\) return;[\s\S]*setSelectedSitePart\("nav"\)/);
  assert.doesNotMatch(appSource, /if \(isMobileViewport\)[\s\S]{0,120}setSelectedSitePart\("nav"\)[\s\S]{0,60}Nav link/);
});

test("mobile nav link long press opens right drawer", () => {
  assert.match(appSource, /startSiteHeaderLongPress\("nav"/);
  assert.match(appSource, /openSiteHeaderDrawer\(sitePart, navIndex\)/);
});

test("mobile site header edit button opens context menu", () => {
  assert.match(appSource, /site-header-edit-btn/);
  assert.match(appSource, /openSiteHeaderContextMenu\(e\)/);
  assert.match(cssSource, /\.site-header-edit-btn \{/);
  assert.match(cssSource, /min-width:\s*36px/);
  assert.match(cssSource, /min-height:\s*36px/);
});

test("site header target label includes Site header and Nav link", () => {
  assert.match(appSource, /Editing Site header → Site title/);
  assert.match(appSource, /Editing Site header → Nav link/);
});

test("properties tab renders when site part is selected without block", () => {
  assert.match(appSource, /rightTab === "properties" && \(selectedBlock \|\| selectedSitePart\)/);
});

test("preview mode disables contentEditable on hero and text blocks", () => {
  assert.match(appSource, /contentEditable=\{!isPreview\}/);
  assert.match(appSource, /HeroBlock[\s\S]*contentEditable=\{!isPreview\}/);
  assert.match(appSource, /TextBlock[\s\S]*contentEditable=\{!isPreview\}/);
});

test("preview mode clears selection and closes drawers via useEffect", () => {
  assert.match(appSource, /useEffect\(\(\) => \{\s*if \(previewMode\)/);
  assert.match(appSource, /setSelectedBlockId\(""\)/);
  assert.match(appSource, /setSelectedGalleryIndex\(null\)/);
  assert.match(appSource, /setSelectedSitePart\(null\)/);
  assert.match(appSource, /setSelectedNavIndex\(null\)/);
  assert.match(appSource, /setRightDrawerMobileOpen\(false\)/);
});

test("preview mode guards block pointer handlers", () => {
  assert.match(appSource, /function handleBlockPointerDown[\s\S]{0,120}if \(previewMode\) return;/);
  assert.match(appSource, /function handleBlockPointerUp[\s\S]{0,200}if \(previewMode\) return;/);
});

test("preview mode guards context menu", () => {
  assert.match(appSource, /function openContextMenu[\s\S]{0,120}if \(previewMode\) return;/);
});

test("context menu Edit Properties opens right drawer via openBlockDrawer", () => {
  // The Edit Properties button must call openBlockDrawer (not just selectBlock)
  // so that mobile rightDrawerMobileOpen is set to true
  assert.match(appSource, /openBlockDrawer\(contextMenu\.blockId\)/);
  assert.doesNotMatch(appSource, /Edit Properties[\s\S]{0,60}selectBlock\(contextMenu\.blockId\)/);
});

test("context menu Edit Properties closes menu after action", () => {
  // setContextMenu(null) appears inside the same onClick handler before the closing >Edit Properties
  assert.match(appSource, /setContextMenu\(null\)[\s\S]{0,60}Edit Properties/);
});

test("mobile drawer open state and overlay exist for context menu path", () => {
  assert.match(appSource, /rightDrawerMobileOpen/);
  assert.match(appSource, /mobile-editor-overlay/);
  assert.match(appSource, /mobile-editor-sheet/);
  assert.match(cssSource, /\.mobile-editor-overlay\.open/);
  assert.match(cssSource, /\.mobile-editor-overlay:not\(\.open\) \.mobile-editor-sheet[\s\S]*display:\s*none/);
});

test("preview mode hides selection outlines via CSS", () => {
  assert.match(cssSource, /\.app\.preview \.selected-block/);
  assert.match(cssSource, /\.app\.preview \.selected-site-part/);
});

test("edit mode supports direct text editing with stopPropagation on contentEditable", () => {
  assert.match(appSource, /onPointerDown=\{\(e\) => \{ onActivateTarget\?\.\(\"[a-zA-Z]+\"\);\s*e\.stopPropagation\(\); \}\}/);
  assert.match(appSource, /onPointerUp=\{\(e\) => e\.stopPropagation\(\)\}/);
});

test("site title is contentEditable in edit mode and guarded in preview", () => {
  assert.match(appSource, /contentEditable=\{!previewMode\}[\s\S]*project\.site\.siteName/);
  assert.match(appSource, /setProject\(\{ \.\.\.project, site: \{ \.\.\.project\.site, siteName:/);
});

test("nav labels are contentEditable in edit mode and guarded in preview", () => {
  assert.match(appSource, /contentEditable=\{!previewMode\}[\s\S]*item\.label/);
  assert.match(appSource, /nav\[ni\] = \{ \.\.\.nav\[ni\], label: e\.currentTarget\.textContent/);
});

test("cards block title and card text are contentEditable in edit mode", () => {
  assert.match(appSource, /CardsBlock[\s\S]*contentEditable=\{!isPreview\}/);
  assert.match(appSource, /onCardText\?\./);
});

test("gallery slots are guarded in preview mode", () => {
  assert.match(appSource, /if \(isPreview\) return;[\s\S]*onImageSelect/);
});

test("hours block title is contentEditable in edit mode", () => {
  assert.match(appSource, /HoursBlock[\s\S]*contentEditable=\{!isPreview\}/);
  assert.match(appSource, /onText\("title", e\.currentTarget\.textContent/);
});

test("contact block title and fields are contentEditable in edit mode", () => {
  assert.match(appSource, /ContactBlock[\s\S]*contentEditable=\{!isPreview\}/);
  assert.match(appSource, /onText\("phone", e\.currentTarget\.textContent/);
  assert.match(appSource, /onText\("email", e\.currentTarget\.textContent/);
  assert.match(appSource, /onText\("address", e\.currentTarget\.textContent/);
});

test("testimonial quote and author are contentEditable in edit mode", () => {
  assert.match(appSource, /TestimonialBlock[\s\S]*contentEditable=\{!isPreview\}/);
  assert.match(appSource, /onText\("quote", e\.currentTarget\.textContent/);
  assert.match(appSource, /onText\("author", e\.currentTarget\.textContent/);
});

test("map block address is contentEditable in edit mode", () => {
  assert.match(appSource, /MapBlock[\s\S]*contentEditable=\{!isPreview\}/);
  assert.match(appSource, /onText\("address", e\.currentTarget\.textContent/);
});

test("gallery block title is contentEditable in edit mode", () => {
  assert.match(appSource, /GalleryBlock[\s\S]*contentEditable=\{!isPreview\}[\s\S]*data\.title/);
  assert.match(appSource, /onText\?\.\("title", e\.currentTarget\.textContent/);
});

test("marquee block text is contentEditable in edit mode", () => {
  assert.match(appSource, /MarqueeBlock[\s\S]*contentEditable=\{!isPreview\}/);
  assert.match(appSource, /onText\("text", e\.currentTarget\.textContent/);
});

test("image block caption is contentEditable in edit mode", () => {
  assert.match(appSource, /ImageBlock[\s\S]*contentEditable=\{!isPreview\}/);
  assert.match(appSource, /onText\("caption", e\.currentTarget\.textContent/);
});

test("all contentEditable blocks stop propagation on pointer events", () => {
  const contentEditableMatches = appSource.match(/contentEditable=\{!isPreview\}/g);
  assert.ok(contentEditableMatches && contentEditableMatches.length >= 8, `Expected at least 8 contentEditable elements, found ${contentEditableMatches?.length || 0}`);
  assert.match(appSource, /onPointerDown=\{\(e\) => \{ onActivateTarget\?\.\(\"[a-zA-Z]+\"\);\s*e\.stopPropagation\(\); \}\}/);
  assert.match(appSource, /onPointerUp=\{\(e\) => e\.stopPropagation\(\)\}/);
});

test("top toolbar AI button calls openAiDrawer handler", () => {
  assert.match(appSource, /openAiDrawer\(\)/);
  assert.match(appSource, /openAiDrawer\(\)[\s\S]{0,40}>AI<\/button>/);
});

test("openAiDrawer opens right drawer on mobile via setRightDrawerMobileOpen", () => {
  assert.match(appSource, /function openAiDrawer/);
  assert.match(appSource, /setRightDrawerMobileOpen\(true\)/);
});

test("openAiDrawer sets right tab to AI", () => {
  assert.match(appSource, /function openAiDrawer[\s\S]*setRightTab\("ai"\)/);
});

test("computeAiTarget falls back to first editable block when none selected", () => {
  assert.match(appSource, /function computeAiTarget[\s\S]*editableBlocks\[\s*0\s*\]/);
  assert.match(appSource, /!\["spacer", "divider", "html"\]/);
  assert.match(appSource, /Select a block to use AI/);
});

test("openAiDrawer guards preview mode with status message", () => {
  assert.match(appSource, /function openAiDrawer[\s\S]{0,300}if \(previewMode\)/);
  assert.match(appSource, /AI is not available in Preview mode/);
});

test("activateBlockTextTarget helper exists and sets selectedBlockId", () => {
  assert.match(appSource, /function activateBlockTextTarget/);
  assert.match(appSource, /setSelectedBlockId\(blockId\)/);
  assert.match(appSource, /setSelectedGalleryIndex\(null\)/);
  assert.match(appSource, /setSelectedSitePart\(null\)/);
  assert.match(appSource, /setSelectedNavIndex\(null\)/);
  assert.match(appSource, /lastFocusedTextBlockId\.current = blockId/);
});

test("lastFocusedTextBlockId useRef exists", () => {
  assert.match(appSource, /lastFocusedTextBlockId = useRef<string>\(""\)/);
});

test("computeAiTarget prefers lastFocusedTextBlockId over selectedBlockId", () => {
  assert.match(appSource, /function computeAiTarget[\s\S]*const targetId = lastFocusedTextBlockId\.current \|\| selectedBlockId/);
  assert.match(appSource, /lastFocusedTextBlockId\.current \|\| selectedBlockId/);
});

test("openAiDrawer syncs target.blockId into state when stale", () => {
  assert.match(appSource, /if \(target\.blockId !== selectedBlockId\)/);
  assert.match(appSource, /setSelectedBlockId\(target\.blockId\)/);
});

test("block components accept onActivateTarget prop", () => {
  assert.match(appSource, /HeroBlock[\s\S]*onActivateTarget\?: \(part\?:\s*string\) => void/);
  assert.match(appSource, /TextBlock[\s\S]*onActivateTarget\?: \(part\?:\s*string\) => void/);
  assert.match(appSource, /CardsBlock[\s\S]*onActivateTarget\?: \(part\?:\s*string\) => void/);
  assert.match(appSource, /HoursBlock[\s\S]*onActivateTarget\?: \(part\?:\s*string\) => void/);
  assert.match(appSource, /ContactBlock[\s\S]*onActivateTarget\?: \(part\?:\s*string\) => void/);
  assert.match(appSource, /TestimonialBlock[\s\S]*onActivateTarget\?: \(part\?:\s*string\) => void/);
  assert.match(appSource, /MapBlock[\s\S]*onActivateTarget\?: \(part\?:\s*string\) => void/);
  assert.match(appSource, /MarqueeBlock[\s\S]*onActivateTarget\?: \(part\?:\s*string\) => void/);
  assert.match(appSource, /ImageBlock[\s\S]*onActivateTarget\?: \(part\?:\s*string\) => void/);
});

test("contentEditable onPointerDown calls onActivateTarget before stopPropagation", () => {
  const actCalls = appSource.match(/onActivateTarget\?\.\(\"[a-zA-Z]+\"\);\s*e\.stopPropagation\(\)/g);
  assert.ok(actCalls && actCalls.length >= 8, `Expected onActivateTarget calls before stopPropagation, found ${actCalls?.length || 0}`);
});

test("activateBlockTextTarget is passed to renderTypedBlock call site", () => {
  assert.match(appSource, /activateBlockTextTarget\(block\.id, part\)/);
  assert.match(appSource, /onActivateTarget=\{onActivateTarget\}/);
});

test("selectBlock also updates lastFocusedTextBlockId", () => {
  assert.match(appSource, /function selectBlock[\s\S]*lastFocusedTextBlockId\.current = blockId/);
});

test("preview useEffect resets lastFocusedTextBlockId", () => {
  assert.match(appSource, /if \(previewMode\)[\s\S]*lastFocusedTextBlockId\.current = \"\"/);
});

test("site header container has selectable target path with site-header part", () => {
  assert.match(appSource, /function selectSiteHeaderContainer/);
  assert.match(appSource, /setSelectedSitePart\("site-header"\)/);
  assert.match(appSource, /"Target: Site header → Whole header"/);
});

test("site header container select clears block and gallery selection", () => {
  assert.match(appSource, /function selectSiteHeaderContainer[\s\S]*setSelectedBlockId\(""\)/);
  assert.match(appSource, /function selectSiteHeaderContainer[\s\S]*setSelectedGalleryIndex\(null\)/);
});

test("site header empty-area click selects container via nav onClick", () => {
  assert.match(appSource, /className={`canvas-nav \${!previewMode && selectedSitePart === "site-header" \? "selected-site-part" : ""}`}/);
  assert.match(appSource, /onClick=\{\(e\)[\s\S]*if \(e\.target === e\.currentTarget\)[\s\S]*selectSiteHeaderContainer\(\)/);
});

test("site title direct edit still works via contentEditable and onClick", () => {
  assert.match(appSource, /contentEditable=\{!previewMode\}[\s\S]*project\.site\.siteName/);
  assert.match(appSource, /onClick=\{\(e\)[\s\S]*setSelectedSitePart\("site-title"\)/);
  assert.match(appSource, /e\.stopPropagation\(\)[\s\S]*setSelectedSitePart\("site-title"\)/);
});

test("nav label direct edit still works via contentEditable and onClick", () => {
  assert.match(appSource, /contentEditable=\{!previewMode\}[\s\S]*item\.label/);
  assert.match(appSource, /onClick=\{\(e\)[\s\S]*setSelectedSitePart\("nav"\)/);
  assert.match(appSource, /onClick=\{\(e\)[\s\S]*setSelectedNavIndex\(ni\)/);
});

test("preview mode guards site header container selection in nav onClick", () => {
  assert.match(appSource, /onClick=\{\(e\)[\s\S]*if \(previewMode\) return;[\s\S]*if \(e\.target === e\.currentTarget\)[\s\S]*selectSiteHeaderContainer/);
});

test("preview mode hides site header container outline via CSS", () => {
  assert.match(cssSource, /\.app\.preview \.canvas-nav\.selected-site-part\s*\{[\s\S]*outline: none !important/);
  assert.match(cssSource, /\.app\.preview \.canvas-nav\.selected-site-part\s*\{[\s\S]*cursor: default/);
});

test("mobile site header ellipsis button opens context menu for site header container", () => {
  assert.match(appSource, /openSiteHeaderContextMenu\(e\)/);
  assert.match(appSource, /onClick=\{\(e\)[\s\S]*openSiteHeaderContextMenu\(e\)/);
});

test("context menu for site header shows header-specific actions", () => {
  assert.match(appSource, /contextMenu\.isSiteHeader/);
  assert.match(appSource, /openSiteHeaderDrawer\("site-header"\)/);
});

test("context menu for site header includes Edit Properties and Reset colors actions", () => {
  assert.match(appSource, /contextMenu\.isSiteHeader \? \(/);
  assert.match(appSource, /openSiteHeaderDrawer\("site-header"\)[\s\S]*Edit Properties/);
  assert.match(appSource, /Reset site header colors to theme/);
  assert.match(appSource, /Reset all blocks to theme/);
});

test("openSiteHeaderDrawer accepts site-header part", () => {
  assert.match(appSource, /function openSiteHeaderDrawer\(sitePart: "site-title" \| "nav" \| "site-header"/);
  assert.match(appSource, /if \(sitePart === "site-header"\) setStatus\("Editing site header container"\)/);
});

test("properties tab renders for site header container", () => {
  assert.match(appSource, /selectedSitePart === "site-header"\) return \(/);
  assert.match(appSource, /Editing Site Header Container/);
  assert.match(appSource, /Navigation Links[\s\S]*removeNav\(i\)/);
});

test("openAiDrawer does not fall back to stale target when site header is selected", () => {
  assert.match(appSource, /function computeAiTarget[\s\S]*selectedSitePart/);
  assert.match(appSource, /selectedSitePart && siteHeaderParts\.has\(selectedSitePart\)/);
});

test("canvas-nav has hover border color in edit mode", () => {
  assert.match(cssSource, /\.app:not\(\.preview\) \.canvas-nav[\s\S]*:hover[\s\S]*border-color: var\(--editor-accent/);
});

test("selected-site-part CSS also applies to canvas-nav container", () => {
  assert.match(cssSource, /\.canvas-nav\.selected-site-part\s*\{/);
  assert.match(cssSource, /\.canvas-nav\.selected-site-part[\s\S]*outline: 3px solid var\(--editor-accent/);
});

test("openSiteHeaderContextMenu function exists and guards preview mode", () => {
  assert.match(appSource, /function openSiteHeaderContextMenu[\s\S]*if \(previewMode\) return;/);
  assert.match(appSource, /setContextMenu\(\{ visible: true, x: clampedX, y: clampedY, blockId: "", isSiteHeader: true \}\)/);
});

test("site header container long press opens drawer via startSiteHeaderLongPress", () => {
  assert.match(appSource, /startSiteHeaderLongPress\("site-header"/);
  assert.match(appSource, /startSiteHeaderLongPress\(sitePart: "site-title" \| "nav" \| "site-header"/);
});

test("canvas-nav has onContextMenu handler for site header", () => {
  assert.match(appSource, /onContextMenu=\{\(e\) => openSiteHeaderContextMenu\(e\)\}/);
});

// AI target resolution tests
test("computeAiTarget function exists and checks selectedSitePart first", () => {
  assert.match(appSource, /function computeAiTarget/);
  assert.match(appSource, /siteHeaderParts\.has\(selectedSitePart\)/);
  assert.match(appSource, /kind: "site-header"/);
});

test("AI panel label renders site header when site part selected", () => {
  assert.match(appSource, /computeAiTarget\(\)/);
  assert.match(appSource, /AI panel: site header/);
});

test("openAiDrawer accepts targetBlockId parameter for context menu invocation", () => {
  assert.match(appSource, /function openAiDrawer\(targetBlockId\?: string\)/);
  assert.match(appSource, /openAiDrawer\(contextMenu\.blockId\)/);
});

test("computeAiTarget checks lastFocusedTextBlockId before selectedBlockId", () => {
  assert.match(appSource, /const targetId = lastFocusedTextBlockId\.current \|\| selectedBlockId/);
});

test("computeAiTarget fallback excludes spacer, divider, html blocks", () => {
  assert.match(appSource, /function computeAiTarget[\s\S]*!\["spacer", "divider", "html"\]/);
});

test("computeAiTarget excludes spacer/divider/html in block-specific check too", () => {
  assert.match(appSource, /block && !\["spacer", "divider", "html"\]\.includes\(block\.type\)/);
});

test("AI target and style selectedPart are independent concepts", () => {
  // selectedPart is for style, not used in computeAiTarget. Limit scope to first 800 chars of function.
  assert.doesNotMatch(appSource, /function computeAiTarget[\s\S]{0,800}selectedPart/);
  // computeAiTarget uses selectedSitePart, not selectedPart
  assert.match(appSource, /function computeAiTarget[\s\S]{0,800}selectedSitePart/);
});

test("top toolbar AI button uses openAiDrawer, not raw setRightTab", () => {
  // Already tested above, but double-check the button calls openAiDrawer, not setRightTab("ai") directly
  assert.match(appSource, /openAiDrawer\(\)[\s\S]{0,40}>AI<\/button>/);
  assert.doesNotMatch(appSource, /onClick=\{\(\) => setRightTab\("ai"\)\}>AI/);
});

test("top toolbar has sticky positioning with safe-area support", () => {
  assert.match(cssSource, /\.topbar[\s\S]*position:\s*sticky/);
  assert.match(cssSource, /\.topbar[\s\S]*top:\s*0/);
  assert.match(cssSource, /\.topbar[\s\S]*env\(safe-area-inset-top/);
  assert.match(cssSource, /\.topbar[\s\S]*z-index:\s*50/);
});

test("mobile topbar is fixed with higher z-index and safe-area", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar[\s\S]*position:\s*fixed/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar[\s\S]*z-index:\s*90/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar[\s\S]*env\(safe-area-inset-top/);
});

test("context menu includes AI Assistant action for site header", () => {
  assert.match(appSource, /contextMenu\.isSiteHeader \? \([\s\S]*AI Assistant/);
  assert.match(appSource, /openAiDrawer\(\)[\s\S]{0,80}AI Assistant/);
});

test("context menu AI action calls openAiDrawer not raw setRightTab", () => {
  assert.match(appSource, /openAiDrawer\(contextMenu\.blockId\)[\s\S]{0,60}AI Edit/);
  assert.doesNotMatch(appSource, /setRightTab\("ai"\)[\s\S]{0,60}AI Edit/);
});

test("context menu AI action closes context menu after invocation", () => {
  assert.match(appSource, /openAiDrawer\(contextMenu\.blockId\);\s*setContextMenu\(null\)/);
  assert.match(appSource, /openAiDrawer\(\);\s*setContextMenu\(null\)/);
});

test("context menu AI uses normalized computeAiTarget resolution", () => {
  assert.match(appSource, /function openAiDrawer[\s\S]*computeAiTarget\(\)/);
  assert.match(appSource, /function computeAiTarget[\s\S]*selectedSitePart/);
  assert.match(appSource, /function computeAiTarget[\s\S]*lastFocusedTextBlockId\.current \|\| selectedBlockId/);
});

test("preview mode guards AI opening from context menu", () => {
  assert.match(appSource, /function openAiDrawer[\s\S]{0,300}if \(previewMode\)/);
  assert.match(appSource, /function openContextMenu[\s\S]{0,120}if \(previewMode\) return;/);
  assert.match(appSource, /AI is not available in Preview mode/);
});

test("block context menu includes AI Assistant after Edit Properties", () => {
  assert.match(appSource, /openBlockDrawer\(contextMenu\.blockId\);\s*setContextMenu\(null\)[\s\S]{0,200}Edit Properties[\s\S]{0,300}openAiDrawer\(contextMenu\.blockId\);\s*setContextMenu\(null\)[\s\S]{0,80}AI Assistant/);
});

test("block context menu AI Assistant appears before Resize/Layout", () => {
  const elseMarker = ") : (";
  const headerIdx = appSource.indexOf("contextMenu.isSiteHeader ?");
  const elseIdx = appSource.indexOf(elseMarker, headerIdx);
  const closeIdx = appSource.indexOf("Close</button>", elseIdx);
  const blockMenu = appSource.substring(elseIdx, closeIdx);
  const editPropsIdx = blockMenu.indexOf("Edit Properties");
  const aiAssistantIdx = blockMenu.indexOf("AI Assistant");
  const resizeIdx = blockMenu.indexOf("Resize/Layout");
  assert.ok(aiAssistantIdx > 0, "AI Assistant exists in block context menu");
  assert.ok(editPropsIdx < aiAssistantIdx, "AI Assistant appears after Edit Properties");
  assert.ok(aiAssistantIdx < resizeIdx, "AI Assistant appears before Resize/Layout");
});

test("block context menu AI Assistant calls openAiDrawer with exact block id", () => {
  const elseMarker = ") : (";
  const headerIdx = appSource.indexOf("contextMenu.isSiteHeader ?");
  const elseIdx = appSource.indexOf(elseMarker, headerIdx);
  const closeIdx = appSource.indexOf("Close</button>", elseIdx);
  const blockMenu = appSource.substring(elseIdx, closeIdx);
  const aiAssistantLine = blockMenu.substring(
    blockMenu.lastIndexOf("openAiDrawer", blockMenu.indexOf("AI Assistant")),
    blockMenu.indexOf("AI Assistant")
  );
  assert.ok(aiAssistantLine.includes("contextMenu.blockId"), "AI Assistant uses contextMenu.blockId");
});

test("block context menu AI Assistant closes context menu", () => {
  assert.match(appSource, /openAiDrawer\(contextMenu\.blockId\);\s*setContextMenu\(null\)[\s\S]{0,40}AI Assistant/);
});

test("mobile topbar spacer div exists for fixed toolbar offset", () => {
  assert.match(appSource, /topbar-mobile-spacer/);
  assert.match(cssSource, /\.topbar-mobile-spacer/);
  assert.match(cssSource, /--mobile-topbar-h/);
});

test("status row renders with stable topbar status selector", () => {
  assert.match(appSource, /className="topbar-status"/);
  assert.match(appSource, /data-status-row="topbar-status-pill"/);
  assert.match(appSource, /status-pill-text/);
  assert.match(appSource, /Status:\s/);
});

test("mobile status row has non-clipping sizing and spacing rules", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar-status[\s\S]*min-height:\s*34px/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar-status[\s\S]*line-height:\s*1\.4/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar-status[\s\S]*padding:\s*7px\s*10px/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar-status[\s\S]*box-sizing:\s*border-box/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar-status[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar-status[\s\S]*overflow:\s*visible/);
  assert.match(cssSource, /\.status-pill-text/);
});

test("mobile spacer uses measured toolbar variable height", () => {
  assert.match(cssSource, /\.topbar-mobile-spacer[\s\S]*height:\s*var\(--mobile-topbar-h,\s*110px\)/);
  assert.match(cssSource, /\.topbar-mobile-spacer[\s\S]*min-height:\s*var\(--mobile-topbar-h,\s*110px\)/);
  assert.match(appSource, /ResizeObserver/);
  assert.match(appSource, /setProperty\("--mobile-topbar-h"/);
});

test("mobile topbar hides when left drawer is open", () => {
  assert.match(cssSource, /\.app\.mobile-shell\.mobile-left-open .topbar[\s\S]*display:\s*none/);
  assert.match(cssSource, /\.app\.mobile-shell\.mobile-left-open .topbar-mobile-spacer[\s\S]*display:\s*none/);
  assert.match(cssSource, /\.app\.mobile-shell\.mobile-left-open .left-drawer[\s\S]*top:/);
});

test("mobile canvas-controls sticky top accounts for fixed toolbar height", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.canvas-controls[\s\S]*--mobile-topbar-h/);
});

test("left drawer top on mobile accounts for fixed toolbar height", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.left-drawer[\s\S]*--mobile-topbar-h/);
});

test("topbar height is measured dynamically via ResizeObserver", () => {
  assert.match(appSource, /topbarRef/);
  assert.match(appSource, /ResizeObserver/);
  assert.match(appSource, /--mobile-topbar-h/);
  assert.match(appSource, /statusPillRef/);
});

test("debug panel shows toolbar and status pill measured heights", () => {
  assert.match(appSource, /mobileToolbarHeight/);
  assert.match(appSource, /statusPillHeight/);
  assert.match(appSource, /toolbarStatusNoClip/);
  assert.match(appSource, /debugToolbarH/);
  assert.match(appSource, /debugStatusPillH/);
});

test("status label includes space after Status colon", () => {
  assert.match(appSource, /Status:\s/);
  assert.match(appSource, /status-pill-text/);
});

test("mobile topbar has explicit overflow visible to prevent clipping", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar[\s\S]*overflow:\s*visible/);
});

test("site header context menu AI Assistant still exists", () => {
  assert.match(appSource, /contextMenu\.isSiteHeader \? \([\s\S]*?openAiDrawer\(\)[\s\S]{0,200}AI Assistant/);
});

test("mobile editor overlay top references --mobile-toolbar-h", () => {
  assert.match(cssSource, /\.mobile-editor-sheet[\s\S]*top:[\s]*calc\(var\(--mobile-toolbar-h/);
});

test("mobile editor sheet top includes safe-area-inset-top", () => {
  assert.match(cssSource, /\.mobile-editor-sheet[\s\S]*env\(safe-area-inset-top/);
});

test("mobile editor sheet body uses overflow-y auto and min-height 0", () => {
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*overflow-y:\s*auto/);
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*min-height:\s*0/);
});

test("mobile editor sheet uses grid-template-rows with header/tabs/target/body", () => {
  assert.match(cssSource, /\.mobile-editor-sheet[\s\S]*grid-template-rows:\s*auto auto auto minmax\(0, 1fr\)/);
});

test("mobile editor overlay uses position fixed and covers viewport", () => {
  assert.match(cssSource, /\.mobile-editor-overlay[\s\S]*position:\s*fixed/);
  assert.match(cssSource, /\.mobile-editor-overlay[\s\S]*left:\s*0/);
  assert.match(cssSource, /\.mobile-editor-overlay[\s\S]*right:\s*0/);
  assert.match(cssSource, /\.mobile-editor-overlay[\s\S]*top:\s*0/);
  assert.match(cssSource, /\.mobile-editor-overlay[\s\S]*bottom:\s*0/);
});

test("top toolbar remains position fixed on mobile", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar[\s\S]*position:\s*fixed/);
});

test("mobile editor sheet is fixed positioned in 768px breakpoint", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.mobile-editor-sheet[\s\S]*position:\s*fixed/);
});

test("mobile editor sheet has header with X close button and aria-label", () => {
  assert.match(appSource, /mobile-editor-sheet-header/);
  assert.match(appSource, /mobile-editor-x-close/);
  assert.match(appSource, /aria-label="Close editor drawer"/);
  assert.match(cssSource, /\.mobile-editor-x-close[\s\S]*display:\s*none/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.mobile-editor-x-close[\s\S]*display:\s*inline-flex/);
});

test("mobile X close button calls setRightDrawerMobileOpen false", () => {
  const closeBtnIdx = appSource.indexOf("mobile-editor-x-close");
  assert.ok(closeBtnIdx > 0, "mobile-editor-x-close class exists");
  const closeSection = appSource.substring(closeBtnIdx, closeBtnIdx + 300);
  assert.match(closeSection, /setRightDrawerMobileOpen\(false\)/);
});

test("mobile X close button is inside mobile-editor-sheet-header gated by isMobileViewport", () => {
  const closeBtnIdx = appSource.indexOf("mobile-editor-x-close");
  assert.ok(closeBtnIdx > 0, "mobile-editor-x-close class exists");
  const surrounding = appSource.substring(Math.max(0, closeBtnIdx - 500), closeBtnIdx + 50);
  assert.match(surrounding, /isMobileViewport/, "mobile X close button is inside isMobileViewport-gated overlay");
  assert.match(cssSource, /\.mobile-editor-x-close\s*\{[^}]*display:\s*none/, "base CSS hides mobile X close button");
});

test("mobile X close button has at least 44px tap target", () => {
  const m768 = cssSource.indexOf("@media (max-width: 768px)");
  const section = cssSource.substring(m768, cssSource.indexOf("@media (max-width: 1100px)"));
  assert.match(section, /\.mobile-editor-x-close[\s\S]*width:\s*44px/);
  assert.match(section, /\.mobile-editor-x-close[\s\S]*height:\s*44px/);
  assert.match(section, /\.mobile-editor-x-close[\s\S]*min-width:\s*44px/);
  assert.match(section, /\.mobile-editor-x-close[\s\S]*min-height:\s*44px/);
});

test("mobile right drawer tab row contains Props Style Resize Images AI Debug tabs", () => {
  const tabRowIdx = appSource.indexOf("mobile-editor-sheet-tabs");
  assert.ok(tabRowIdx > 0, "mobile-editor-sheet-tabs exists");
  const tabSection = appSource.substring(tabRowIdx, tabRowIdx + 1200);
  assert.match(tabSection, /Props/);
  assert.match(tabSection, /Style/);
  assert.match(tabSection, /Resize/);
  assert.match(tabSection, /Images/);
  assert.match(tabSection, /\bAI\b/);
  assert.match(tabSection, /Debug/);
});

test("right drawer internal scroll remains intact on mobile via sheet body", () => {
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*overflow-y:\s*auto/);
  assert.match(cssSource, /\.right-drawer-content[\s\S]*overflow-y:\s*auto/);
});

test("desktop right drawer does not render when mobile viewport", () => {
  assert.match(appSource, /\{!isMobileViewport && \(/);
  assert.match(appSource, /<aside className="right-drawer">/);
  const overlayIdx = appSource.indexOf("mobile-editor-overlay");
  assert.ok(overlayIdx > 0, "mobile-editor-overlay exists for mobile-only rendering");
});

test("mobile editor overlay exists as top-level mobile-only structure", () => {
  assert.match(appSource, /mobile-editor-overlay/);
  assert.match(cssSource, /\.mobile-editor-overlay[\s\S]*display:\s*none/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.mobile-editor-overlay[\s\S]*display:\s*block/);
});

test("mobile overlay sheet is not nested inside workspace/canvas/right-drawer", () => {
  const overlayIdx = appSource.indexOf("mobile-editor-overlay");
  assert.ok(overlayIdx > 0, "mobile-editor-overlay exists");
  const workspaceClose = appSource.lastIndexOf("</div>", overlayIdx);
  const workspaceDiv = appSource.substring(Math.max(0, workspaceClose - 100), overlayIdx);
  assert.ok(!workspaceDiv.includes("workspace"), "mobile-editor-overlay is not inside workspace div");
});

test("sheet header exists and contains mobile-editor-x-close", () => {
  assert.match(appSource, /mobile-editor-sheet-header[\s\S]{0,500}mobile-editor-x-close/);
});

test("X has aria-label Close editor drawer", () => {
  assert.match(appSource, /aria-label="Close editor drawer"/);
});

test("tabs row exists with Props Style Resize Images AI Debug", () => {
  const sheetTabsIdx = appSource.indexOf("mobile-editor-sheet-tabs");
  assert.ok(sheetTabsIdx > 0, "mobile-editor-sheet-tabs exists");
  const tabSection = appSource.substring(sheetTabsIdx, sheetTabsIdx + 1500);
  assert.match(tabSection, /Props/);
  assert.match(tabSection, /Style/);
  assert.match(tabSection, /Resize/);
  assert.match(tabSection, /Images/);
  assert.match(tabSection, />AI<\/button>/);
  assert.match(tabSection, /Debug/);
});

test("target row exists outside the scrollable body", () => {
  assert.match(appSource, /mobile-editor-sheet-target/);
  const targetIdx = appSource.indexOf("mobile-editor-sheet-target");
  const bodyIdx = appSource.indexOf("mobile-editor-sheet-body", targetIdx);
  assert.ok(bodyIdx > targetIdx, "target row comes before body in DOM");
});

test("body/content row uses a dedicated scroll container", () => {
  assert.match(appSource, /mobile-editor-sheet-body/);
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*overflow-y:\s*auto/);
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*min-height:\s*0/);
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*-webkit-overflow-scrolling:\s*touch/);
});

test("CSS for mobile overlay uses position fixed and top references --mobile-toolbar-h", () => {
  assert.match(cssSource, /\.mobile-editor-overlay[\s\S]*position:\s*fixed/);
  assert.match(cssSource, /\.mobile-editor-sheet[\s\S]*top:[\s]*calc\(var\(--mobile-toolbar-h/);
});

test("CSS sheet uses grid-template-rows with header/tabs/target/body", () => {
  assert.match(cssSource, /\.mobile-editor-sheet[\s\S]*grid-template-rows:\s*auto auto auto minmax\(0, 1fr\)/);
});

test("body uses overflow-y auto and min-height 0", () => {
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*overflow-y:\s*auto/);
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*min-height:\s*0/);
});

test("header/tabs/target are not inside the scrolling body", () => {
  const headerIdx = appSource.indexOf("mobile-editor-sheet-header");
  const tabsIdx = appSource.indexOf("mobile-editor-sheet-tabs");
  const targetIdx = appSource.indexOf("mobile-editor-sheet-target");
  const bodyIdx = appSource.indexOf("mobile-editor-sheet-body");
  assert.ok(headerIdx < bodyIdx, "header comes before body in DOM");
  assert.ok(tabsIdx < bodyIdx, "tabs come before body in DOM");
  assert.ok(targetIdx < bodyIdx, "target comes before body in DOM");
});

test("context menu Edit Properties calls the same open drawer path", () => {
  assert.match(appSource, /openBlockDrawer\(contextMenu\.blockId\)[\s\S]{0,60}Edit Properties/);
});

test("context menu AI Assistant calls openAiDrawer with contextMenu.blockId", () => {
  assert.match(appSource, /openAiDrawer\(contextMenu\.blockId\)[\s\S]{0,80}AI Assistant/);
});

test("preview mode remains read-only", () => {
  assert.match(appSource, /if \(previewMode\) return;/);
  assert.match(appSource, /AI is not available in Preview mode/);
});

test("publish remains dry-run", () => {
  assert.match(appSource, /runPublish/);
  assert.match(appSource, /\/api\/publish/);
  assert.match(appSource, /dryRun/);
});
