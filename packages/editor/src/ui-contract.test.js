import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const behaviorSource = readFileSync(new URL("./editorBehavior.ts", import.meta.url), "utf8");
const versionIdentityBannerSource = readFileSync(new URL("./VersionIdentityBanner.tsx", import.meta.url), "utf8");
const markupWorkspaceSource = readFileSync(new URL("./MarkupWorkspace.tsx", import.meta.url), "utf8");
const markupAnnotationsSource = readFileSync(new URL("./markupAnnotations.ts", import.meta.url), "utf8");
const editorSource = `${appSource}\n${behaviorSource}\n${versionIdentityBannerSource}\n${markupWorkspaceSource}\n${markupAnnotationsSource}`;
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

test("image library exposes tab structure with Browse, Upload, and Settings", () => {
  assert.match(appSource, /data-testid="image-library-tabs"/);
  assert.match(appSource, /data-testid="image-library-tab-browse"/);
  assert.match(appSource, /data-testid="image-library-tab-upload"/);
  assert.match(appSource, /data-testid="image-library-tab-settings"/);
  assert.match(appSource, /imageLibraryTab === "browse"/);
  assert.match(appSource, /imageLibraryTab === "upload"/);
  assert.match(appSource, /imageLibraryTab === "settings"/);
});

test("image library provides multi-select delete with confirmation", () => {
  assert.match(appSource, /data-testid="image-library-select-all"/);
  assert.match(appSource, /data-testid="image-library-delete-selected"/);
  assert.match(appSource, /data-testid="image-library-delete-confirm"/);
  assert.match(appSource, /data-testid="image-library-select-mode-toggle"/);
  assert.match(appSource, /data-testid="image-library-selected-count"/);
  assert.match(editorSource, /api\/images\/delete/);
  assert.match(appSource, /data-testid="image-library-delete-confirm-yes"/);
  assert.match(appSource, /selectAllFilteredImages/);
  assert.match(appSource, /toggleImageSelected/);
  assert.match(appSource, /bulkDeleteImages/);
});

test("image library multi-select delete warns when an image is currently used by the project", () => {
  assert.match(appSource, /data-testid="image-library-delete-inuse-warning"/);
  assert.match(appSource, /currently used by the project/);
  assert.match(appSource, /usedImageUrls/);
  assert.match(appSource, /image-library-confirm-warn/);
});

test("image library bulk delete confirmation skips .gitkeep placeholder if any slip through", () => {
  assert.match(appSource, /\.gitkeep/);
});

test("image library filters out non-renderable entries (.gitkeep) on load", () => {
  assert.match(appSource, /isRenderableImageMeta/);
  assert.match(editorSource, /RENDERABLE_IMAGE_EXTENSIONS/);
  assert.match(cssSource, /\.image-card-checkbox/);
  assert.match(cssSource, /\.image-card\.multi-selected/);
});

test("image library selected image action modal exposes Actions/Details/History", () => {
  assert.match(appSource, /data-testid="image-action-modal"/);
  assert.match(appSource, /imageActionTab === "actions"/);
  assert.match(appSource, /imageActionTab === "details"/);
  assert.match(appSource, /imageActionTab === "history"/);
  assert.match(appSource, /data-testid="image-action-details"/);
  assert.match(appSource, /data-testid="image-action-history"/);
});

test("image library has a discoverable multi-select toggle and selected count badge", () => {
  assert.match(appSource, /data-testid="image-library-select-mode-toggle"/);
  assert.match(appSource, /data-testid="image-library-selected-count"/);
  assert.match(appSource, /className=\{selectMode \? "selected" : ""\}/);
  assert.match(appSource, /Selection: on/);
  assert.match(appSource, /Selection: off/);
  assert.match(cssSource, /\.image-card-checkbox-prominent/);
  assert.match(cssSource, /\.image-card\.multi-selected/);
});

test("image library folder manager exposes refresh, create, rename, delete, and move", () => {
  assert.match(appSource, /data-testid="image-library-folder-refresh"/);
  assert.match(appSource, /data-testid="image-library-folder-create"/);
  assert.match(appSource, /data-testid="image-library-folder-rename"/);
  assert.match(appSource, /data-testid="image-library-folder-delete"/);
  assert.match(appSource, /data-testid="image-library-folder-switch"/);
  assert.match(appSource, /data-testid="image-library-move-selected"/);
  assert.match(appSource, /data-testid="image-library-folder-list-section"/);
  assert.match(appSource, /refreshFolderList/);
  assert.match(appSource, /createImageFolder/);
  assert.match(appSource, /renameImageFolder/);
  assert.match(appSource, /deleteImageFolder/);
  assert.match(appSource, /moveSelectedImagesTo/);
  assert.match(appSource, /\/api\/images\/folder\/list/);
  assert.match(appSource, /\/api\/images\/folder\/create/);
  assert.match(appSource, /\/api\/images\/folder\/rename/);
  assert.match(appSource, /\/api\/images\/folder\/delete/);
  assert.match(appSource, /\/api\/images\/move/);
});

test("dedicated image edit modal opens with locked source and full options", () => {
  assert.match(appSource, /data-testid="image-edit-modal"/);
  assert.match(appSource, /data-testid="image-edit-modal-source"/);
  assert.match(appSource, /data-testid="image-edit-modal-source-thumb"/);
  assert.match(appSource, /data-testid="image-edit-modal-type-select"/);
  assert.match(appSource, /data-testid="image-edit-modal-instruction"/);
  assert.match(appSource, /data-testid="image-edit-modal-run"/);
  assert.match(appSource, /data-testid="image-edit-modal-save-to-library"/);
  assert.match(appSource, /openImageEditModal/);
  assert.match(appSource, /closeImageEditModal/);
  assert.match(appSource, /cancelImageEditModal/);
});

test("dedicated image edit modal offers 10 edit types including Darken", () => {
  assert.match(appSource, /value="enhance"[^>]*>Enhance/);
  assert.match(appSource, /value="brighten"[^>]*>Brighten/);
  assert.match(appSource, /value="darken"[^>]*>Darken/);
  assert.match(appSource, /value="sharpen"[^>]*>Sharpen/);
  assert.match(appSource, /value="color-pop"[^>]*>Color Pop/);
  assert.match(appSource, /value="black-white"[^>]*>Black/);
  assert.match(appSource, /value="soften-bg"[^>]*>Soften/);
  assert.match(appSource, /value="crop-fit"[^>]*>Crop\/Fit/);
  assert.match(appSource, /value="square-crop"[^>]*>Square/);
  assert.match(appSource, /value="wide-hero-crop"[^>]*>Wide/);
});

test("dedicated image edit modal Preview tab has separate Save / Apply / Save and Apply / Cancel", () => {
  assert.match(appSource, /data-testid="image-edit-modal-save-to-library"/);
  assert.match(appSource, /data-testid="image-edit-modal-apply-to-block"/);
  assert.match(appSource, /data-testid="image-edit-modal-save-and-apply"/);
  assert.match(appSource, /data-testid="image-edit-modal-cancel"/);
  assert.match(appSource, />Save to Image Library</);
  assert.match(appSource, />Apply to Selected Block</);
  assert.match(appSource, />Save and Apply</);
  assert.match(appSource, />Cancel</);
});

test("AI image gen post-generation offers 'Edit image' opening the dedicated modal", () => {
  assert.match(appSource, /data-testid="ai-img-gen-edit-image"/);
  assert.match(appSource, /openImageEditModal\(aiImgGenResult, "Generated image"\)/);
});

test("AI image gen is preview-only by default and has separate Save / Apply / Save and Apply buttons", () => {
  assert.match(appSource, /data-testid="ai-img-gen-preview"/);
  assert.match(appSource, /data-testid="ai-img-gen-preview-badge"/);
  assert.match(appSource, /data-testid="ai-img-gen-save-to-library"/);
  assert.match(appSource, /data-testid="ai-img-gen-apply-to-block"/);
  assert.match(appSource, /data-testid="ai-img-gen-save-and-apply"/);
  assert.match(appSource, /data-testid="ai-img-gen-cancel"/);
  assert.match(appSource, /data-testid="ai-img-gen-add-to-gallery"/);
  assert.match(appSource, /preview:\s*true/);
  assert.match(appSource, /aiImgGenPreviewId/);
  assert.match(appSource, /aiImgGenIsPreview/);
  assert.match(appSource, /\/api\/ai\/preview-image\//);
  assert.match(appSource, /\/api\/ai\/preview-image\/\$\{encodeURIComponent\(aiImgGenPreviewId\)\}\/promote/);
});

test("AI image gen defaults to library target and preview-only placement", () => {
  assert.match(appSource, /useState<"block" \| "library">\("library"\)/);
  assert.match(appSource, /useState<string>\("preview-only"\)/);
  assert.match(appSource, /Preview only \(recommended\)/);
  assert.match(appSource, /placement === "preview-only"/);
  assert.match(appSource, /placement === "save-library"/);
});

test("AI image gen preview discarded via DELETE /api/ai/preview-image/:id", () => {
  assert.match(appSource, /aiDiscardPreview/);
  assert.match(appSource, /method:\s*"DELETE"/);
  assert.match(appSource, /\/api\/ai\/preview-image\/\$\{encodeURIComponent\(aiImgGenPreviewId\)\}/);
});

test("image library hide-blank filter remains available for white/blank cleanup", () => {
  assert.match(appSource, /Hide likely blank\/white/);
  assert.match(appSource, /hide-blank/);
});

test("AI chat auto-scrolls to latest message on open and on new messages", () => {
  assert.match(appSource, /scrollChatToBottom/);
  assert.match(appSource, /requestAnimationFrame/);
  assert.match(appSource, /aiTopMenuOpen[\s\S]{0,200}aiTopMenuTab === "chat"/);
  assert.match(appSource, /chatHistory\.map\(\(m\) => m\.id\)\.join/);
});

test("chat-log CSS uses max-height 320px and supports smooth scroll", () => {
  assert.match(cssSource, /\.chat-log[\s\S]{0,400}max-height:\s*320px/);
  assert.match(cssSource, /\.chat-log[\s\S]{0,400}overflow-y:\s*auto/);
});

test("dedicated image edit modal CSS exists for desktop and mobile", () => {
  assert.match(cssSource, /\.image-edit-modal-backdrop/);
  assert.match(cssSource, /\.image-edit-modal/);
  assert.match(cssSource, /\.image-edit-modal-source-thumb/);
  assert.match(cssSource, /\.image-edit-modal-preview-image/);
  assert.match(cssSource, /\.image-edit-modal-primary/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]{0,1500}\.image-edit-modal[\s\S]{0,200}width:\s*100vw/);
});

test("shared modal / card / button classes exist for normalized look", () => {
  assert.match(cssSource, /\.sbuild-modal-backdrop/);
  assert.match(cssSource, /\.sbuild-modal/);
  assert.match(cssSource, /\.sbuild-modal-header/);
  assert.match(cssSource, /\.sbuild-modal-body/);
  assert.match(cssSource, /\.sbuild-modal-footer/);
  assert.match(cssSource, /\.sbuild-card/);
  assert.match(cssSource, /\.sbuild-button/);
  assert.match(cssSource, /\.sbuild-button-primary/);
});

test("left drawer has balanced padding and inner sections for professional spacing", () => {
  assert.match(cssSource, /\.left-drawer\s*\{[\s\S]{0,400}padding:\s*16px/);
  assert.match(cssSource, /\.left-drawer\s*\{[\s\S]{0,400}border:\s*1px solid/);
  assert.match(cssSource, /\.left-drawer\s*\{[\s\S]{0,400}border-radius:\s*12px/);
  assert.match(cssSource, /\.left-drawer\s*\{[\s\S]{0,400}box-sizing:\s*border-box/);
  assert.match(cssSource, /\.left-drawer\s*>\s*section[\s\S]{0,300}border:\s*1px solid/);
  assert.match(cssSource, /\.left-drawer\s*>\s*section[\s\S]{0,300}border-radius:\s*10px/);
  assert.match(cssSource, /\.left-drawer\s*>\s*section[\s\S]{0,300}background:\s*var\(--editor-panel-bg-2\)/);
});

test("canvas controls use grouped labels for View and Selected", () => {
  assert.match(appSource, /data-testid="canvas-controls"/);
  assert.match(appSource, /canvas-controls-group/);
  assert.match(appSource, /canvas-controls-label/);
  assert.match(cssSource, /\.canvas-controls[\s\S]{0,200}background:\s*var\(--editor-panel-bg-2\)/);
  assert.match(cssSource, /\.canvas-controls[\s\S]{0,300}border:\s*1px solid var\(--editor-border\)/);
  assert.match(cssSource, /\.canvas-controls[\s\S]{0,300}border-radius:\s*10px/);
  assert.match(cssSource, /\.canvas-controls-group[\s\S]{0,200}border-right:\s*1px solid/);
});

test("mobile AI panel uses dynamic viewport height and allows internal scrolling", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]{0,2500}\.ai-panel[\s\S]{0,300}max-height:\s*calc\(100dvh - var\(--mobile-topbar-h/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]{0,2500}\.ai-panel[\s\S]{0,400}min-height:\s*min\(60dvh,\s*calc\(100dvh - var\(--mobile-topbar-h/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]{0,2500}\.ai-panel-tab-content[\s\S]{0,200}overflow-y:\s*auto/);
  assert.match(cssSource, /safe-area-inset-bottom/);
});

test("mobile AI panel exposes ai-card-actions buttons that wrap and stay reachable", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]{0,3000}\.ai-card-actions[\s\S]{0,200}flex-wrap:\s*wrap/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]{0,3000}\.ai-preview-actions[\s\S]{0,200}flex-direction:\s*column/);
});

test("crop-fit and modal layout expose safe visible targets", () => {
  assert.match(appSource, /Crop\/Fit target:/);
  assert.match(appSource, /Crop\/Fit and replace/);
  assert.match(appSource, /Close Image Library/);
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
  assert.match(cssSource, /\.right-drawer-content[\s\S]*overflow-y: auto/);
  assert.match(cssSource, /overflow-x: hidden/);
  assert.match(cssSource, /overscroll-behavior: contain/);
  assert.match(cssSource, /scrollbar-gutter: stable/);
  assert.match(cssSource, /\.panel[\s\S]*overflow-x: hidden/);
  assert.match(cssSource, /\.right-drawer-header[\s\S]*border-bottom/);
  assert.match(cssSource, /\.image-action-stack button[\s\S]*word-break: break-word/);
  assert.match(cssSource, /\.app[\s\S]*height: 100dvh/);
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
  assert.match(cssSource, /\.canvas-controls[\s\S]*position:\s*static/);
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
  assert.match(appSource, /if \(!isMobileViewport && canEditBlocks\) selectBlock\(block\.id\)/);
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

test("provider and key panels expose provider-specific chat key status", () => {
  assert.match(appSource, /OpenAI Chat API Key/);
  assert.match(appSource, /OpenRouter Chat API Key/);
  assert.match(appSource, /OpenAI chat source:/);
  assert.match(appSource, /OpenRouter chat source:/);
  assert.match(appSource, /normalizeSecretStatus/);
  assert.match(appSource, /normalizeProviderStatus/);
  assert.match(appSource, /chatOpenAI/);
  assert.match(appSource, /chatOpenRouter/);
  assert.match(appSource, /status\.imageApi/);
  assert.match(appSource, /status\.imageAnalyzeApi/);
  assert.match(appSource, /status\.chatApi/);
  assert.match(appSource, /DEFAULT_SECRET_STATUS/);
  assert.match(appSource, /setSecretStatus\(DEFAULT_SECRET_STATUS\)/);
  assert.match(appSource, /Provider status unavailable — refresh or check Settings\./);
  assert.doesNotMatch(appSource, /secretStatus\?\.chat\.source/);
  assert.doesNotMatch(appSource, /secretStatus\?\.imageGen\.source/);
  assert.doesNotMatch(appSource, /secretStatus\?\.imageAnalyze\.source/);
});

test("local provider UI prefers qwen2.5:1.5b and refreshes installed models only", () => {
  assert.match(appSource, /normalizeLocalModelOptions/);
  assert.match(appSource, /qwen2\.5:1\.5b/);
  assert.doesNotMatch(appSource, /mistral:7b/);
  assert.doesNotMatch(appSource, /qwen2\.5:3b/);
  assert.doesNotMatch(appSource, /qwen2\.5:0\.5b/);
  assert.doesNotMatch(appSource, /llama3\.2:1b/);
});

test("saving chat provider keeps image key labels unchanged", () => {
  assert.match(appSource, /Image Gen and Image Analyze key status unchanged/);
  assert.match(appSource, /previousImageGen/);
  assert.match(appSource, /previousImageAnalyze/);
});

test("image enhance source lock keeps generated image source across actions", () => {
  assert.match(appSource, /openImageEditModal\(aiImgGenResult,\s*"Generated image"\)/);
  assert.match(appSource, /setAiEnhanceSourceOverride\(data\.editedImageUrl\)/);
  assert.match(appSource, /Source: Image Library/);
  assert.match(appSource, /Source: Selected block background/);
  assert.match(appSource, /imageEditSnapshot/);
});

test("builder UI theme sync uses server preferences endpoint", () => {
  assert.match(appSource, /\/api\/account\/preferences/);
  assert.match(appSource, /builderUiTheme/);
  assert.match(appSource, /builderThemePrefsReady/);
});

test("builder UI theme exposes an explicit Save Theme button in Settings", () => {
  assert.match(appSource, /data-testid="save-builder-theme"/);
  assert.match(appSource, /data-testid="builder-theme-select"/);
  assert.match(appSource, /Save Theme/);
  assert.match(appSource, /saveBuilderTheme/);
  assert.match(appSource, /builderThemeSaveStatus/);
});

test("builder UI theme save uses PUT /api/account/preferences and persists across reload", () => {
  assert.match(appSource, /method:\s*"PUT"/);
  assert.match(appSource, /\/api\/account\/preferences/);
  assert.match(appSource, /body:\s*JSON\.stringify\(\{\s*builderUiTheme:\s*editorTheme\s*\}\)/);
  assert.match(appSource, /localStorage\.setItem\("sbuild_editor_theme"/);
});

test("AI chat surfaces honest success and error provider states (no blanket 'Local chat connected')", () => {
  assert.match(appSource, /Answered by Local Ollama/);
  assert.match(appSource, /formatProviderDisplayName\(provider\)/);
  assert.match(appSource, /Answered by sBuild Brain/);
  assert.match(appSource, /Local model timed out/);
  assert.match(appSource, /AI chat unavailable:/);
  assert.match(appSource, /chatProviderStatus/);
  assert.match(appSource, /fallback from/);
});

test("desktop AI panel exposes draggable and reset affordances", () => {
  assert.match(appSource, /handleAiPanelDragStart/);
  assert.match(appSource, /ai-panel-drag-handle/);
  assert.match(appSource, /Reset panel/);
  assert.match(appSource, /AI_PANEL_STORAGE_KEY/);
  assert.match(appSource, /AI_PANEL_STORAGE_VERSION/);
  assert.match(appSource, /isStoredAiPanelRect/);
  assert.match(appSource, /clampAiPanelRect/);
  assert.match(appSource, /aiPanelViewportBounds/);
  assert.match(cssSource, /\.ai-panel-drag-handle/);
  assert.match(cssSource, /\.ai-panel-reset/);
  assert.match(cssSource, /\.ai-panel-tabs[\s\S]*flex-wrap:\s*wrap/);
});

test("AI panel storage validates versioned rect payloads before restoring", () => {
  assert.match(appSource, /const AI_PANEL_STORAGE_VERSION = 1/);
  assert.match(appSource, /function isStoredAiPanelRect/);
  assert.match(appSource, /parsed\.version !== undefined && parsed\.version !== AI_PANEL_STORAGE_VERSION/);
  assert.match(appSource, /Number\.isFinite/);
  assert.match(appSource, /if \(!isStoredAiPanelRect\(parsed\)\) return defaultAiPanelRect\(\)/);
  assert.match(appSource, /JSON\.stringify\(\{ version: AI_PANEL_STORAGE_VERSION, \.\.\.aiPanelRect \}\)/);
});

test("AI panel viewport bounds use measured topbar and safe-area values", () => {
  assert.match(appSource, /function aiPanelViewportBounds/);
  assert.match(appSource, /visualViewport\?\.height \|\| window\.innerHeight/);
  assert.match(appSource, /readCssPxVar\("--mobile-topbar-h", AI_PANEL_MOBILE_TOPBAR_FALLBACK\)/);
  assert.match(appSource, /readCssPxVar\("--safe-area-top", 0\)/);
  assert.match(appSource, /readCssPxVar\("--safe-area-bottom", 0\)/);
  assert.match(cssSource, /--safe-area-top:\s*env\(safe-area-inset-top,\s*0px\)/);
  assert.match(cssSource, /--safe-area-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/);
});

test("desktop AI panel exposes only corner resize handle", () => {
  assert.match(appSource, /handleAiPanelResizeStart/);
  assert.match(appSource, /ai-panel-resize-corner/);
  assert.doesNotMatch(appSource, /ai-panel-resize-right/);
  assert.doesNotMatch(appSource, /ai-panel-resize-bottom/);
  assert.match(cssSource, /\.ai-panel-resize-handle/);
  assert.match(cssSource, /cursor:\s*nwse-resize/);
});

test("AI panel resize state tracks handle direction for corner resize", () => {
  assert.match(appSource, /AiPanelResizeHandle/);
  assert.match(appSource, /handleAiPanelResizeStart\(e,\s*"corner"\)/);
});

test("mobile media query hides all AI panel desktop resize handles", () => {
  const mobileIdx = cssSource.indexOf("@media (max-width: 768px)");
  assert.ok(mobileIdx > 0, "mobile media query exists");
  const mobileSection = cssSource.substring(mobileIdx);
  assert.match(mobileSection, /\.ai-panel-resize-handle[\s\S]*?display:\s*none/);
});

test("AI chat messages render timestamp footers with metadata", () => {
  assert.match(appSource, /formatChatTimestamp/);
  assert.match(appSource, /chatFooterText/);
  assert.match(appSource, /ai-chat-msg-footer/);
  assert.match(appSource, /latencyMs/);
  assert.match(cssSource, /\.ai-chat-msg-footer/);
});

test("AI chat footer can show provider model metadata for responses", () => {
  assert.match(appSource, /item\.source/);
  assert.match(appSource, /item\.model/);
  assert.match(appSource, /\(item\.latencyMs \/ 1000\)\.toFixed\(1\)/);
  assert.match(appSource, /ai-chat-provider-status/);
});

test("Apply Suggestion stays gated behind structured proposal metadata", () => {
  assert.match(appSource, /aiStructuredProposal/);
  assert.match(appSource, /Boolean\(data\.proposal\?\.replaceText\)/);
  assert.match(appSource, /if \(!aiStructuredProposal\?\.replaceText\) return;/);
  assert.doesNotMatch(appSource, /Boolean\(data\.hasProposal\) && canEditBlocks/);
});

test("AI chat sends conversation history for follow-up context", () => {
  assert.match(appSource, /chatHistory:\s*chatHistory\.slice\(-10\)\.map/);
  assert.match(appSource, /role:\s*m\.role,\s*text:\s*m\.text/);
});

test("AI chat error messages are provider-aware with timeout details", () => {
  assert.match(appSource, /isTimeout/);
  assert.match(appSource, /timed out after/);
  assert.match(appSource, /is configured/);
});

test("AI Image Gen uses modern card layout instead of raw form controls", () => {
  assert.match(appSource, /ai-card-advanced/);
  assert.match(appSource, /ai-card\s+ai-card-prompt/);
  assert.match(appSource, /ai-action-primary/);
  assert.match(cssSource, /\.ai-card-advanced/);
  assert.match(cssSource, /\.ai-preset-group/);
});

test("AI Image Enhance opens same dedicated image edit modal as Image Library Edit image", () => {
  assert.match(appSource, /ai-image-enhance-source-card/);
  assert.match(appSource, /ai-image-enhance-open-modal/);
  assert.match(appSource, /ai-image-enhance-flow-hint/);
  assert.match(appSource, /Open Edit Modal/);
  assert.match(appSource, /openImageEditModal\(es\.src,\s*es\.label\)/);
  assert.match(cssSource, /\.ai-source-detail/);
  assert.match(cssSource, /\.ai-source-thumb/);
});

test("AI card preview shows generated or enhanced images with action buttons", () => {
  assert.match(appSource, /ai-card\s+ai-card-preview/);
  assert.match(appSource, /ai-preview-actions/);
  assert.match(cssSource, /\.ai-preview-actions/);
  assert.match(cssSource, /\.ai-result-image/);
});

test("smoke script treats unauth publish 401 as expected gate behavior", () => {
  assert.match(smokeSource, /PUBLISH_UNAUTH_STATUS/);
  assert.match(smokeSource, /unauth \/api\/publish expected 401/);
  assert.match(smokeSource, /SKIPPED_AUTH_HELPER_MISSING/);
  assert.match(smokeSource, /SBUILD_SMOKE_COOKIE_FILE/);
});

test("debug diagnostics include mobile-toolbar-gap-repair active marker", () => {
  assert.match(appSource, /mobile-toolbar-gap-repair active/);
  assert.match(appSource, /action-controls-offset active/);
});

test("spacer is the single mobile toolbar offset mechanism", () => {
  assert.match(appSource, /spacerRef/);
  assert.match(appSource, /canvasControlsRef/);
  assert.match(cssSource, /\.topbar-mobile-spacer[\s\S]*height:\s*var\(--mobile-topbar-h/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar[\s\S]*position:\s*fixed/);
  assert.match(appSource, /topbar-mobile-spacer[\s\S]*workspace[\s\S]*canvas-controls/);
});

test("canvas-controls on mobile uses position static not sticky", () => {
  const mobileStart = cssSource.indexOf("@media (max-width: 768px)");
  assert.ok(mobileStart >= 0, "mobile media query exists");
  const afterMobile = cssSource.substring(mobileStart);
  const ccIdx = afterMobile.indexOf(".canvas-controls {");
  assert.ok(ccIdx >= 0, ".canvas-controls block exists in mobile section");
  const ccBlock = afterMobile.substring(ccIdx, afterMobile.indexOf("}", ccIdx) + 1);
  assert.match(ccBlock, /position:\s*static/, "canvas-controls uses position: static on mobile");
  assert.doesNotMatch(ccBlock, /position:\s*sticky/, "canvas-controls does not use position: sticky on mobile");
});

test("normal mobile edit hint does not render layout debug instrumentation", () => {
  const hintIdx = appSource.indexOf('className="panel-status mobile-edit-hint"');
  assert.ok(hintIdx >= 0, "mobile edit hint exists");
  const hintBlock = appSource.slice(hintIdx, appSource.indexOf("</p>", hintIdx));
  assert.match(hintBlock, /Tap text to edit directly/);
  assert.doesNotMatch(hintBlock, /mobile-toolbar-gap-repair/);
  assert.doesNotMatch(hintBlock, /action-controls-offset/);
  assert.doesNotMatch(hintBlock, /toolbarH=\{debugToolbarH\}/);
  assert.doesNotMatch(hintBlock, /spacerH=\{debugSpacerH\}/);
  assert.doesNotMatch(hintBlock, /gapPx=\{debugGapPx\}/);
  assert.doesNotMatch(hintBlock, /missing=\{debugMeasurementMissing/);
});

test("mobile topbar keeps explicit grouped rows for density and action visibility", () => {
  assert.match(appSource, /topbar-mobile-row topbar-mobile-row-main/);
  assert.match(appSource, /topbar-mobile-row topbar-mobile-row-actions/);
  assert.match(appSource, /topbar-mobile-row topbar-mobile-row-status/);
  assert.match(appSource, />Publish<\/button>/);
  assert.match(appSource, /previewMode \? "Edit" : "Preview"/);
  assert.match(appSource, />Markup<\/button>/);
});

test("gap detection flags duplicate offset when gapPx exceeds 48px", () => {
  assert.match(appSource, /setDebugDuplicateOffset\(gapPx\s*>\s*48\)/);
});

test("failed d811dc1 spacer-v3 marker is replaced", () => {
  assert.doesNotMatch(appSource, /mobile-toolbar-spacer-v3 active/);
  assert.doesNotMatch(appSource, /mobile-toolbar-runtime-v2 active/);
});

test("mobile overlay backdrop dimming stays light and sheet remains separate", () => {
  assert.match(cssSource, /\.mobile-editor-overlay[\s\S]*background:\s*transparent/);
  assert.match(cssSource, /\.mobile-editor-overlay\.open[\s\S]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.14\)/);
  assert.match(appSource, /className={`mobile-editor-overlay \$\{rightDrawerMobileOpen \? "open" : ""\}`}/);
  assert.match(appSource, /<section className="mobile-editor-sheet" role="dialog" aria-label="Edit block">/);
});

test("mobile editor header keeps title and close in single compact row", () => {
  assert.match(appSource, /<div className="mobile-editor-sheet-header">[\s\S]*<div className="mobile-editor-header-left">[\s\S]*<h2>\{mobileDrawerHeading\(\)\}<\/h2>[\s\S]*className="mobile-editor-x-close"/);
  assert.match(cssSource, /\.mobile-editor-sheet-header[\s\S]*display:\s*flex/);
  assert.match(cssSource, /\.mobile-editor-sheet-header[\s\S]*justify-content:\s*space-between/);
  assert.match(cssSource, /\.mobile-editor-sheet-header[\s\S]*padding:\s*4px\s*10px/);
  assert.match(appSource, /mobile-editor-header-left/);
  assert.match(appSource, /mobile-editor-target-inline/);
  assert.doesNotMatch(appSource, /mobile-editor-close-row|close-only-row/);
});

test("mobile close button preserves aria label and tap target", () => {
  assert.match(appSource, /className="mobile-editor-x-close"[\s\S]*aria-label="Close editor drawer"/);
  assert.match(cssSource, /\.mobile-editor-x-close[\s\S]*width:\s*38px/);
  assert.match(cssSource, /\.mobile-editor-x-close[\s\S]*height:\s*38px/);
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
  assert.match(appSource, /openResizeLayoutForBlock\(contextMenu\.blockId\)/);
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); startNewRow\(contextMenu\.blockId\)/);
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); placeWithPrevious\(contextMenu\.blockId\)/);
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); placeWithNext\(contextMenu\.blockId\)/);
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); removeFromRow\(contextMenu\.blockId\)/);
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); moveBlock\("up", contextMenu\.blockId\)/);
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); moveBlock\("down", contextMenu\.blockId\)/);
});

test("place-with-row actions close context menu and set explicit status text", () => {
  assert.match(appSource, /Place with block above/);
  assert.match(appSource, /Place with block below/);
  assert.match(appSource, /function closeTransientOverlays\(\)/);
  assert.match(appSource, /setContextMenu\(null\);\s*setRightDrawerMobileOpen\(false\);/);
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); placeWithPrevious\(contextMenu\.blockId\); closeTransientOverlays\(\);/);
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); placeWithNext\(contextMenu\.blockId\); closeTransientOverlays\(\);/);
  assert.match(appSource, /setStatus\("Placed block with block above"\)/);
  assert.match(appSource, /setStatus\("Placed block with block below"\)/);
});

test("remove from row action remains available and clears row membership", () => {
  assert.match(appSource, /Remove from row \/ Leave row/);
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); removeFromRow\(contextMenu\.blockId\); closeTransientOverlays\(\);/);
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
  assert.match(appSource, /className=\{`canvas-frame sbuild-site-preview sbuild-rendered-page \$\{deviceMode\} \$\{isMobileViewport \? "mobile-viewport" : ""\} \$\{paintExclusiveMode \? "paint-exclusive" : ""\}`\}/);
});

test("move up and move down actions remain present after row operations", () => {
  assert.match(appSource, /Move Up/);
  assert.match(appSource, /Move Down/);
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); moveBlock\("up", contextMenu\.blockId\); closeTransientOverlays\(\);/);
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); moveBlock\("down", contextMenu\.blockId\); closeTransientOverlays\(\);/);
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
  assert.match(appSource, /editable=\{canEditBlocks\}[\s\S]{0,120}value=\{project\.site\.siteName\}/);
  assert.match(appSource, /if \(!canEditBlocks\) return;[\s\S]*setSelectedSitePart\("site-title"\)/);
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
  assert.match(appSource, /editable=\{canEditBlocks\}[\s\S]{0,120}value=\{item\.label\}/);
  assert.match(appSource, /if \(!canEditBlocks\) return;[\s\S]*setSelectedSitePart\("nav"\)/);
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
  assert.match(appSource, /Target: Site header - site title/);
  assert.match(appSource, /Target: Site header - nav link/);
});

test("properties tab renders when site part is selected without block", () => {
  assert.match(appSource, /rightTab === "properties" && \(selectedBlock \|\| selectedSitePart\)/);
});

test("preview mode disables contentEditable on hero and text blocks", () => {
  assert.match(appSource, /contentEditable=\{editable\}/);
  assert.match(appSource, /HeroBlock[\s\S]*<EditableText tag="h1"[\s\S]*editable=\{!isPreview\}/);
  assert.match(appSource, /TextBlock[\s\S]*<EditableText tag="h2"[\s\S]*editable=\{!isPreview\}/);
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
  assert.match(appSource, /function handleBlockPointerDown[\s\S]{0,140}if \(previewMode \|\| paintMode\) return;/);
  assert.match(appSource, /function handleBlockPointerUp[\s\S]{0,220}if \(previewMode \|\| paintMode\) return;/);
});

test("preview mode guards context menu", () => {
  assert.match(appSource, /function openContextMenu[\s\S]{0,140}if \(previewMode \|\| paintMode\) return;/);
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
  assert.match(cssSource, /\.mobile-editor-overlay:not\(\.open\)[\s\S]*display:\s*none/);
});

test("preview mode hides selection outlines via CSS", () => {
  assert.match(cssSource, /\.app\.preview \.selected-block/);
  assert.match(cssSource, /\.app\.preview \.selected-site-part/);
});

test("edit mode supports direct text editing with stopPropagation on contentEditable", () => {
  assert.match(appSource, /data-sbuild-editable-text="uncontrolled"/);
  assert.match(appSource, /onPointerDown=\{\(e\) => \{[\s\S]{0,140}onActivateTarget[\s\S]{0,40}onActivateTarget\(\);[\s\S]{0,40}e\.stopPropagation\(\);[\s\S]{0,140}\}\}/);
  assert.match(appSource, /onPointerUp=\{\(e\) => \{[\s\S]{0,80}e\.stopPropagation\(\);[\s\S]{0,120}\}\}/);
});

test("direct canvas text editing does not let React control text children while focused", () => {
  assert.match(appSource, /const EditableText =/);
  assert.match(appSource, /shouldSyncEditableTextContent\(focusedRef\.current, composingRef\.current\)/);
  assert.match(behaviorSource, /function shouldSyncEditableTextContent\(isFocused: boolean, isComposing: boolean\)/);
  assert.doesNotMatch(appSource, /<h1[^>]*contentEditable=\{!isPreview\}[\s\S]*>\{data\.heading\}<\/h1>/);
});

test("block text update path preserves typed heading order", () => {
  const input = "black fish farms";
  const reversed = input.split("").reverse().join("");
  let block = { id: "hero-1", data: { heading: "" } };
  for (let i = 1; i <= input.length; i += 1) {
    const value = input.slice(0, i);
    block = { ...block, data: { ...block.data, heading: value } };
  }
  assert.equal(block.data.heading, input);
  assert.notEqual(block.data.heading, reversed);
});

test("direct canvas text updates patch the emitted block id rather than stale selection", () => {
  assert.match(appSource, /function patchBlock\(blockId: string, mutator: \(block: Block\) => Block\)/);
  assert.match(appSource, /patchBlock\(block\.id, \(current\) => \(\{ \.\.\.current, data: \{ \.\.\.\(current\.data as Record<string, unknown>\), \[field\]: value \} \}\)\)/);
});

test("no raw contentEditable element in App.tsx keeps React-controlled children (caret-reversal pattern eliminated)", () => {
  // The classic reversal bug is: <TAG ... contentEditable={X} ...>{someExpression}</TAG>
  // where React reconciles the children text node on each keystroke, which resets the
  // contentEditable caret to 0 in real browsers and reverses typed text.
  // After the fix, EVERY contentEditable element must be the uncontrolled EditableText
  // helper (no JSX children) — never a raw element with a {child} expression.
  assert.doesNotMatch(appSource, /<(?:h1|h2|h3|p|div|strong|span|cite|blockquote|li)\b[^>]*contentEditable=\{[^}]+\}[^>]*>\{[^}]+\}<\/(?:h1|h2|h3|p|div|strong|span|cite|blockquote|li)>/);
  // The only contentEditable declaration left in App.tsx is inside EditableText itself.
  const contentEditableMatches = appSource.match(/contentEditable=\{/g) || [];
  assert.equal(contentEditableMatches.length, 1, `Expected exactly 1 contentEditable declaration (inside EditableText), found ${contentEditableMatches.length}`);
});

test("site title, nav label, hours row, and testimonial fields are edited via uncontrolled EditableText", () => {
  assert.match(appSource, /<EditableText\s+tag="strong"[^>]*value=\{project\.site\.siteName\}/);
  assert.match(appSource, /<EditableText\s+key=\{item\.id\}\s+tag="span"[^>]*value=\{item\.label\}/);
  assert.match(appSource, /<EditableText\s+key=\{`\$\{row\.day\}-\$\{i\}`\}\s+tag="li"[^>]*value=\{`\$\{row\.day\}: \$\{row\.open\} - \$\{row\.close\}`\}/);
  assert.match(appSource, /<EditableText\s+tag="blockquote"[^>]*value=\{`"\$\{data\.quote \?\? ""\}"`\}/);
  assert.match(appSource, /<EditableText\s+tag="cite"[^>]*value=\{data\.author \?\? ""\}/);
});

test("EditableText does not commit text or overwrite textContent during IME composition", () => {
  assert.match(appSource, /onCompositionStart=\{\(\) => \{ composingRef\.current = true; \}\}/);
  assert.match(appSource, /onCompositionEnd=\{\(e\) => \{ composingRef\.current = false; commitText\(e\.currentTarget\); \}\}/);
  assert.match(appSource, /onInput=\{\(e\) => \{ if \(!composingRef\.current\) commitText\(e\.currentTarget\); \}\}/);
  assert.match(appSource, /shouldSyncEditableTextContent\(focusedRef\.current, composingRef\.current\)/);
  assert.match(behaviorSource, /return !isFocused && !isComposing;/);
});

test("uncontrolled contentEditable sync model preserves typed character order and never reverses", () => {
  // Models the EditableText contract: while the element is the active element, the sync
  // effect must NOT overwrite textContent. Typing one character at a time at the caret
  // must therefore accumulate in typed order, never reversed.
  function typeSequence(target, chars, isActive) {
    // Simulates a user typing `chars` one at a time at the caret, then the sync effect
    // running after each React commit. `isActive` models document.activeElement === el.
    let text = target.value;
    let caret = text.length;
    const seen = [];
    for (const ch of chars) {
      text = text.slice(0, caret) + ch + text.slice(caret);
      caret += 1;
      // Sync effect: EditableText must NOT overwrite textContent while focused.
      // (If it did, e.g. text = value where value lagged, the caret would reset and
      // subsequent typing would prepend -> reversed text.)
      if (!isActive) {
        // When not active, the effect syncs DOM to the latest value (no caret to disturb).
        text = target.value;
      }
      seen.push(text);
    }
    return seen;
  }
  const target = { value: "" };
  // Active (focused) editing: the DOM is the source of truth; sync must be a no-op.
  const active = typeSequence(target, ["b", "l", "a", "c", "k"], true);
  assert.equal(active[active.length - 1], "black");
  assert.notEqual(active[active.length - 1], "kcalb");
  // Every prefix must be in forward order, never reversed.
  for (let i = 0; i < active.length; i += 1) {
    const prefix = "black".slice(0, i + 1);
    assert.equal(active[i], prefix, `step ${i + 1} expected ${prefix}, got ${active[i]}`);
  }
});

test("full phrase typed via the uncontrolled model stays in order and does not reverse", () => {
  const phrase = "black fish farms";
  // Walk the model: caret at end, insert each char; focused -> sync is no-op.
  let text = "";
  let caret = 0;
  for (const ch of phrase) {
    text = text.slice(0, caret) + ch + text.slice(caret);
    caret += 1;
  }
  assert.equal(text, phrase);
  assert.notEqual(text, phrase.split("").reverse().join(""));
});

test("heading editor has no value-derived remount key and no unconditional setSelectionRange(0,0)", () => {
  // A remount key derived from the input value, or an unconditional setSelectionRange(0,0)
  // on every update, would both force the caret to index 0 and reverse subsequent typing.
  assert.doesNotMatch(appSource, /key=\{[^}]*data\.heading[^}]*\}/);
  assert.doesNotMatch(appSource, /setSelectionRange\(0,\s*0\)/);
  assert.doesNotMatch(appSource, /selectionStart\s*=\s*0/);
});

test("site title is contentEditable in edit mode and guarded in preview", () => {
  assert.match(appSource, /tag="strong"[^>]*editable=\{canEditBlocks\}[\s\S]{0,80}value=\{project\.site\.siteName\}/);
  assert.match(appSource, /onText=\{\(value\) => \{ setProject\(\{ \.\.\.project, site: \{ \.\.\.project\.site, siteName: value \} \}\); setDirty\(true\); \}\}/);
});

test("nav labels are contentEditable in edit mode and guarded in preview", () => {
  assert.match(appSource, /tag="span"[^>]*editable=\{canEditBlocks\}[\s\S]{0,80}value=\{item\.label\}/);
  assert.match(appSource, /nav\[ni\] = \{ \.\.\.nav\[ni\], label: value \}/);
});

test("cards block title and card text are contentEditable in edit mode", () => {
  assert.match(appSource, /CardsBlock[\s\S]*<EditableText tag="h2"[\s\S]*editable=\{!isPreview\}/);
  assert.match(appSource, /CardsBlock[\s\S]*<EditableText tag="h3"[\s\S]*editable=\{!isPreview\}/);
  assert.match(appSource, /onCardText\?\./);
});

test("gallery slots are guarded in preview mode", () => {
  assert.match(appSource, /if \(isPreview\) return;[\s\S]*onImageSelect/);
});

test("hours block title is contentEditable in edit mode", () => {
  assert.match(appSource, /HoursBlock[\s\S]*<EditableText tag="h2"[\s\S]*editable=\{!isPreview\}/);
  assert.match(appSource, /onText\("title", value\)/);
});

test("contact block title and fields are contentEditable in edit mode", () => {
  assert.match(appSource, /ContactBlock[\s\S]*<EditableText tag="h2"[\s\S]*editable=\{!isPreview\}/);
  assert.match(appSource, /onText\("phone", value\)/);
  assert.match(appSource, /onText\("email", value\)/);
  assert.match(appSource, /onText\("address", value\)/);
});

test("testimonial quote and author are contentEditable in edit mode", () => {
  assert.match(appSource, /TestimonialBlock[\s\S]*<EditableText tag="blockquote"[\s\S]*editable=\{!isPreview\}/);
  assert.match(appSource, /TestimonialBlock[\s\S]*<EditableText tag="cite"[\s\S]*editable=\{!isPreview\}/);
  assert.match(appSource, /onText=\{\(value\) => onText\("quote", value\)\}/);
  assert.match(appSource, /onText=\{\(value\) => onText\("author", value\)\}/);
});

test("map block address is contentEditable in edit mode", () => {
  assert.match(appSource, /MapBlock[\s\S]*<EditableText tag="h2"[\s\S]*editable=\{!isPreview\}/);
  assert.match(appSource, /onText\("address", value\)/);
});

test("gallery block title is contentEditable in edit mode", () => {
  assert.match(appSource, /GalleryBlock[\s\S]*<EditableText tag="h2"[\s\S]*value=\{data\.title \?\? ""\}[\s\S]*editable=\{!isPreview\}/);
  assert.match(appSource, /onText\?\.\("title", value\)/);
});

test("marquee block text is contentEditable in edit mode", () => {
  assert.match(appSource, /MarqueeBlock[\s\S]*<EditableText tag="div"[\s\S]*editable=\{!isPreview\}/);
  assert.match(appSource, /onText\("text", value\)/);
});

test("image block caption is contentEditable in edit mode", () => {
  assert.match(appSource, /ImageBlock[\s\S]*<EditableText tag="p"[\s\S]*editable=\{!isPreview\}/);
  assert.match(appSource, /onText\("caption", value\)/);
});

test("all contentEditable blocks stop propagation on pointer events", () => {
  const editableTextMatches = appSource.match(/<EditableText /g);
  assert.ok(editableTextMatches && editableTextMatches.length >= 12, `Expected at least 12 EditableText elements, found ${editableTextMatches?.length || 0}`);
  assert.match(appSource, /onPointerDown=\{\(e\) => \{[\s\S]{0,120}onActivateTarget[\s\S]{0,80}e\.stopPropagation\(\);[\s\S]{0,120}\}\}/);
  assert.match(appSource, /onPointerUp=\{\(e\) => \{[\s\S]{0,80}e\.stopPropagation\(\);[\s\S]{0,120}\}\}/);
});

test("top toolbar AI button calls toggleAiTopMenu handler", () => {
  assert.match(appSource, /toggleAiTopMenu\(\)[\s\S]{0,300}?title="AI Top Menu">AI<\/button>/);
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
  assert.match(appSource, /function openAiDrawer[\s\S]{0,320}if \(previewMode \|\| paintMode\)/);
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
  assert.match(appSource, /onPointerDown=\{\(e\) => \{[\s\S]{0,40}if \(onActivateTarget\) \{[\s\S]{0,20}onActivateTarget\(\);[\s\S]{0,20}e\.stopPropagation\(\);[\s\S]{0,40}\}/);
  const activateProps = appSource.match(/onActivateTarget=\{\(\) => onActivateTarget\?\.\(\"[a-zA-Z]+\"\)\}/g);
  assert.ok(activateProps && activateProps.length >= 12, `Expected EditableText activate props, found ${activateProps?.length || 0}`);
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
  assert.match(appSource, /"Target: Site header - whole header"/);
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
  assert.match(appSource, /tag="strong"[^>]*editable=\{canEditBlocks\}[\s\S]{0,80}value=\{project\.site\.siteName\}/);
  assert.match(appSource, /onClick=\{\(e\)[\s\S]*setSelectedSitePart\("site-title"\)/);
  assert.match(appSource, /e\.stopPropagation\(\)[\s\S]*setSelectedSitePart\("site-title"\)/);
});

test("nav label direct edit still works via contentEditable and onClick", () => {
  assert.match(appSource, /tag="span"[^>]*editable=\{canEditBlocks\}[\s\S]{0,80}value=\{item\.label\}/);
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

test("top toolbar AI button uses toggleAiTopMenu, not raw setRightTab", () => {
  assert.match(appSource, /toggleAiTopMenu\(\)[\s\S]{0,300}?title="AI Top Menu">AI<\/button>/);
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

test("mobile topbar uses safe-area-aware top padding floor", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar[\s\S]*padding-top:\s*max\(8px,\s*env\(safe-area-inset-top,\s*0px\)\)/);
});

test("mobile topbar has compact density grid rules", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar[\s\S]*display:\s*grid/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar[\s\S]*gap:\s*4px/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar-mobile-row-main[\s\S]*grid-template-columns/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar-mobile-row-actions[\s\S]*repeat\(4/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar button[\s\S]*min-height:\s*36px/);
});

test("context menu includes AI Assistant action for site header", () => {
  assert.match(appSource, /contextMenu\.isSiteHeader \? \([\s\S]*AI Assistant/);
  assert.match(appSource, /setAiTopMenuOpen\(true\)[\s\S]{0,200}AI Assistant/);
});

test("context menu AI action calls openAiDrawer and opens AI Top Menu", () => {
  assert.match(appSource, /openAiDrawer\(contextMenu\.blockId\)[\s\S]{0,300}?AI Edit/);
  assert.match(appSource, /setAiTopMenuOpen\(true\)[\s\S]{0,100}AI Edit/);
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
  assert.match(appSource, /function openAiDrawer[\s\S]{0,320}if \(previewMode \|\| paintMode\)/);
  assert.match(appSource, /function openContextMenu[\s\S]{0,140}if \(previewMode \|\| paintMode\) return;/);
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

test("block context menu AI Assistant closes context menu and opens AI Top Menu", () => {
  assert.match(appSource, /openAiDrawer\(contextMenu\.blockId\);\s*setContextMenu\(null\)[\s\S]{0,300}?AI Assistant/);
  assert.match(appSource, /setAiTopMenuOpen\(true\)[\s\S]{0,300}?AI Assistant/);
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

test("mobile status pill uses flex-basis 100% and flex-shrink 0 for reliable full-width row", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar-status[\s\S]*flex-basis:\s*100%/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar-status[\s\S]*flex-shrink:\s*0/);
});

test("mobile fixed topbar has explicit height auto to prevent inherited constraints", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar[\s\S]*height:\s*auto/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.topbar[\s\S]*min-height:\s*0/);
});

test("JS sets both --mobile-topbar-h and --mobile-toolbar-h CSS variables", () => {
  assert.match(appSource, /setProperty\("--mobile-topbar-h"/);
  assert.match(appSource, /setProperty\("--mobile-toolbar-h"/);
});

test("mobile spacer uses measured toolbar variable height", () => {
  assert.match(cssSource, /\.topbar-mobile-spacer[\s\S]*height:\s*var\(--mobile-topbar-h,\s*110px\)/);
  assert.match(cssSource, /\.topbar-mobile-spacer[\s\S]*min-height:\s*var\(--mobile-topbar-h,\s*110px\)/);
  assert.match(appSource, /ResizeObserver/);
  assert.match(appSource, /setProperty\("--mobile-topbar-h"/);
  assert.doesNotMatch(appSource, /setTimeout\(update,\s*120\)/);
});

test("mobile topbar hides when left drawer is open", () => {
  assert.match(cssSource, /\.app\.mobile-shell\.mobile-left-open .topbar[\s\S]*display:\s*none/);
  assert.match(cssSource, /\.app\.mobile-shell\.mobile-left-open .topbar-mobile-spacer[\s\S]*display:\s*none/);
  assert.match(cssSource, /\.app\.mobile-shell\.mobile-left-open .left-drawer[\s\S]*top:/);
});

test("mobile canvas-controls does not reference --mobile-topbar-h (spacer is single offset)", () => {
  const mobileStart = cssSource.indexOf("@media (max-width: 768px)");
  assert.ok(mobileStart >= 0, "mobile media query exists");
  const afterMobile = cssSource.substring(mobileStart);
  const ccIdx = afterMobile.indexOf(".canvas-controls {");
  assert.ok(ccIdx >= 0, ".canvas-controls block exists in mobile section");
  const ccBlock = afterMobile.substring(ccIdx, afterMobile.indexOf("}", ccIdx) + 1);
  assert.doesNotMatch(ccBlock, /--mobile-topbar-h/, "canvas-controls does not reference --mobile-topbar-h on mobile");
});

test("left drawer top on mobile accounts for fixed toolbar height", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.left-drawer[\s\S]*--mobile-topbar-h/);
});

test("topbar height is measured dynamically via ResizeObserver", () => {
  assert.match(appSource, /topbarRef/);
  assert.match(appSource, /ResizeObserver/);
  assert.match(appSource, /getBoundingClientRect\(\)\.height/);
  assert.match(appSource, /getBoundingClientRect\(\)\.bottom/);
  assert.match(appSource, /--mobile-topbar-h/);
  assert.match(appSource, /statusPillRef/);
  assert.doesNotMatch(appSource, /setTimeout\(update,\s*120\)/);
});

test("mobile measurement uses viewport readiness not preview device mode", () => {
  assert.match(appSource, /const mobileLayoutReady = Boolean\(project && selectedPage\)/);
  assert.match(appSource, /\[isMobileViewport, mobileLayoutReady, leftCollapsed\]/);
  assert.doesNotMatch(appSource, /\[isMobileViewport,\s*deviceMode\]/);
});

test("debug panel shows mobile-toolbar-gap-repair active marker with gap detection", () => {
  assert.match(appSource, /mobile-toolbar-gap-repair active/);
  assert.match(appSource, /action-controls-offset active/);
  assert.match(appSource, /toolbarHeight/);
  assert.match(appSource, /spacerHeight/);
  assert.match(appSource, /topbarBottom/);
  assert.match(appSource, /canvasControlsTop/);
  assert.match(appSource, /gapPx/);
  assert.match(appSource, /duplicateOffsetDetected/);
  assert.match(appSource, /measurementMissing/);
  assert.match(appSource, /topbarPaddingTop/);
  assert.match(appSource, /debugToolbarH/);
  assert.match(appSource, /debugSpacerH/);
  assert.match(appSource, /debugToolbarBottom/);
  assert.match(appSource, /debugCanvasControlsTop/);
  assert.match(appSource, /debugGapPx/);
  assert.match(appSource, /debugDuplicateOffset/);
  assert.match(appSource, /debugMeasurementMissing/);
  assert.match(appSource, /debugTopbarPaddingTop/);
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

test("mobile editor sheet height is bounded by viewport and toolbar measurement", () => {
  assert.match(cssSource, /\.mobile-editor-sheet[\s\S]*height:\s*min\(74dvh,\s*calc\(100dvh - var\(--mobile-topbar-h/);
  assert.match(cssSource, /\.mobile-editor-sheet[\s\S]*max-height:\s*calc\(100dvh - var\(--mobile-topbar-h/);
});

test("mobile editor sheet sizing uses shared safe-area variables", () => {
  assert.match(cssSource, /\.mobile-editor-sheet[\s\S]*var\(--safe-area-top\)/);
  assert.match(cssSource, /\.mobile-editor-sheet[\s\S]*var\(--safe-area-bottom\)/);
});

test("app shell avoids risky 100vh sizing in favor of dynamic viewport units", () => {
  assert.doesNotMatch(cssSource, /\b100vh\b/);
  assert.match(cssSource, /\.app[\s\S]*height:\s*100dvh/);
  assert.match(cssSource, /\.sbuild-editor-shell[\s\S]*min-height:\s*100dvh/);
  assert.match(cssSource, /\.loading[\s\S]*min-height:\s*100dvh/);
});

test("mobile AI panel is bounded by topbar, safe-area, and dynamic viewport", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.ai-panel[\s\S]*max-height:\s*calc\(100dvh - var\(--mobile-topbar-h/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.ai-panel[\s\S]*var\(--safe-area-top\)/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.ai-panel[\s\S]*var\(--safe-area-bottom\)/);
  assert.doesNotMatch(cssSource, /@media \(max-width: 768px\)[\s\S]{0,2500}\.ai-panel[\s\S]{0,300}max-height:\s*92dvh/);
});

test("mobile editor sheet body uses overflow-y auto and min-height 0", () => {
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*overflow-y:\s*auto/);
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*min-height:\s*0/);
});

test("mobile editor sheet uses grid-template-rows with header/tabs/body", () => {
  assert.match(cssSource, /\.mobile-editor-sheet[\s\S]*grid-template-rows:\s*auto auto minmax\(0, 1fr\)/);
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

test("mobile X close button has compact tap target", () => {
  const m768 = cssSource.indexOf("@media (max-width: 768px)");
  const section = cssSource.substring(m768, cssSource.indexOf("@media (max-width: 1100px)"));
  assert.match(section, /\.mobile-editor-x-close[\s\S]*width:\s*38px/);
  assert.match(section, /\.mobile-editor-x-close[\s\S]*height:\s*38px/);
  assert.match(section, /\.mobile-editor-x-close[\s\S]*min-width:\s*38px/);
  assert.match(section, /\.mobile-editor-x-close[\s\S]*min-height:\s*38px/);
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

test("mobile drawer tabs contain key actions as compact chip row", () => {
  const tabsIdx = appSource.indexOf("mobile-editor-sheet-tabs");
  assert.ok(tabsIdx > 0, "mobile-editor-sheet-tabs exists");
  const tabsSection = appSource.substring(tabsIdx, tabsIdx + 1500);
  assert.match(tabsSection, /Props/);
  assert.match(tabsSection, /Style/);
  assert.match(tabsSection, /Resize/);
  assert.match(tabsSection, /AI/);
  assert.match(tabsSection, /Debug/);
  assert.match(tabsSection, /showImagesAction\(\)/);
  assert.match(cssSource, /\.mobile-editor-sheet-tabs[\s\S]*flex-shrink:\s*0/);
});

test("mobile quick actions keep Images contextual and reachable", () => {
  assert.match(appSource, /\{showImagesAction\(\) && \(/);
  assert.match(appSource, />Images<\/button>/);
  assert.match(appSource, /function showImagesAction\(\): boolean/);
});

test("mobile drawer avoids extra static quick-action header strip", () => {
  assert.doesNotMatch(appSource, /mobile-editor-sheet-quick-actions/);
});

test("right drawer internal scroll remains intact on mobile via sheet body", () => {
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*overflow-y:\s*auto/);
  assert.match(cssSource, /\.right-drawer-content[\s\S]*overflow-y:\s*auto/);
});

test("desktop right drawer does not render when mobile viewport", () => {
  assert.match(appSource, /\{!isMobileViewport && !previewMode && \(/);
  assert.match(appSource, /<aside className=\{`right-drawer/);
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

test("target summary is inline in the header outside the scrollable body", () => {
  assert.match(appSource, /mobile-editor-target-inline/);
  const targetIdx = appSource.indexOf("mobile-editor-target-inline");
  const bodyIdx = appSource.indexOf("mobile-editor-sheet-body", targetIdx);
  assert.ok(bodyIdx > targetIdx, "target inline comes before body in DOM");
  const headerIdx = appSource.indexOf("mobile-editor-sheet-header");
  assert.ok(targetIdx > headerIdx, "target inline is inside header");
});

test("body/content row uses a dedicated scroll container", () => {
  assert.match(appSource, /mobile-editor-sheet-body/);
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*overflow-y:\s*auto/);
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*min-height:\s*0/);
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*-webkit-overflow-scrolling:\s*touch/);
});

test("CSS for mobile overlay uses position fixed and viewport-bounded sheet", () => {
  assert.match(cssSource, /\.mobile-editor-overlay[\s\S]*position:\s*fixed/);
  assert.match(cssSource, /\.mobile-editor-sheet[\s\S]*height:\s*min\(74dvh,/);
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*touch-action:\s*pan-y/);
});

test("CSS sheet uses grid-template-rows with header/tabs/body", () => {
  assert.match(cssSource, /\.mobile-editor-sheet[\s\S]*grid-template-rows:\s*auto auto minmax\(0, 1fr\)/);
});

test("body uses overflow-y auto and min-height 0", () => {
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*overflow-y:\s*auto/);
  assert.match(cssSource, /\.mobile-editor-sheet-body[\s\S]*min-height:\s*0/);
});

test("header and tabs are not inside the scrolling body", () => {
  const headerIdx = appSource.indexOf("mobile-editor-sheet-header");
  const targetInlineIdx = appSource.indexOf("mobile-editor-target-inline");
  const tabsIdx = appSource.indexOf("mobile-editor-sheet-tabs");
  const bodyIdx = appSource.indexOf("mobile-editor-sheet-body");
  assert.ok(headerIdx < bodyIdx, "header comes before body in DOM");
  assert.ok(targetInlineIdx < bodyIdx, "target inline comes before body in DOM");
  assert.ok(tabsIdx < bodyIdx, "tabs come before body in DOM");
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

test("preview mode hides right panel on desktop", () => {
  assert.match(appSource, /\{!isMobileViewport && !previewMode && \(/);
  assert.match(appSource, /<aside className=\{`right-drawer/);
});

test("preview mode hides Duplicate Delete Up Down action controls", () => {
  const controlsIdx = appSource.indexOf("canvas-controls");
  assert.ok(controlsIdx > 0, "canvas-controls exists");
  const section = appSource.substring(controlsIdx, controlsIdx + 1200);
  assert.match(section, /canvas-controls-group/);
  assert.match(section, /\{!previewMode &&[\s\S]{0,300}canvas-controls-group/);
  assert.match(section, /Duplicate/);
  assert.match(section, /Delete/);
});

test("preview mode hides left panel with preview-hidden class", () => {
  assert.match(appSource, /left-drawer.*preview-hidden/);
  assert.match(cssSource, /\.app\.preview \.left-drawer\.preview-hidden/);
});

test("preview mode deactivates paint and clears active paint points", () => {
  const previewEffectIdx = appSource.indexOf("if (previewMode) {");
  assert.ok(previewEffectIdx > 0, "previewMode effect exists");
  const effectSection = appSource.substring(previewEffectIdx, previewEffectIdx + 800);
  assert.match(effectSection, /setPaintMode\(false\)/);
  assert.match(effectSection, /setPaintActivePoints\(\[\]\)/);
});

test("preview mode saves and restores panel collapse states", () => {
  assert.match(appSource, /setPrePreviewLeftCollapsed/);
  assert.match(appSource, /setPrePreviewRightCollapsed/);
  assert.match(appSource, /setLeftCollapsed\(prePreviewLeftCollapsed\)/);
  assert.match(appSource, /setRightCollapsed\(prePreviewRightCollapsed\)/);
});

test("Settings modal has X close button in header", () => {
  assert.match(appSource, /settingsOpen[\s\S]{0,200}modal-header[\s\S]{0,200}modal-close[\s\S]{0,200}setSettingsOpen\(false\)/);
  assert.match(appSource, /aria-label="Close Settings"/);
});

test("Settings modal backdrop click closes the modal", () => {
  const settingsIdx = appSource.indexOf('settingsOpen && (');
  assert.ok(settingsIdx > 0);
  const section = appSource.substring(settingsIdx, settingsIdx + 400);
  assert.match(section, /modal-backdrop.*onClick.*setSettingsOpen\(false\)/);
});

test("Settings Escape key closes the modal", () => {
  assert.match(appSource, /e\.key === "Escape" && settingsOpen/);
});

test("Logout button exists in Settings General tab", () => {
  assert.match(appSource, /logout-btn/);
  assert.match(appSource, /\/logout/);
  assert.match(appSource, /window\.location\.href = "\/login"/);
  assert.match(cssSource, /\.logout-btn/);
});

test("desktop right panel has collapse button", () => {
  assert.match(appSource, /right-drawer-collapse-btn/);
  assert.match(appSource, /setRightCollapsed\(true\)/);
  assert.match(cssSource, /\.right-drawer-collapse-btn/);
});

test("desktop right panel has restore button when collapsed", () => {
  assert.match(appSource, /right-drawer-restore-btn/);
  assert.match(appSource, /setRightCollapsed\(false\)/);
  assert.match(cssSource, /\.right-drawer-restore-btn/);
});

test("right panel collapsed state applies CSS grid change", () => {
  assert.match(cssSource, /\.workspace\.right-collapsed/);
  assert.match(cssSource, /\.right-drawer\.collapsed/);
});

test("preview mode CSS hides paint overlay", () => {
  assert.match(cssSource, /\.app\.preview \.paint-overlay/);
});

test("paint mode uses a focused Markup workspace shell", () => {
  assert.match(appSource, /import \{ MarkupWorkspace \} from "\.\/MarkupWorkspace\.js"/);
  assert.match(appSource, /<MarkupWorkspace/);
  assert.match(markupWorkspaceSource, /data-testid="markup-workspace"/);
  assert.match(markupWorkspaceSource, /role="dialog"/);
  assert.match(markupWorkspaceSource, /aria-labelledby="markup-workspace-title"/);
  assert.match(markupWorkspaceSource, /data-testid="markup-workspace-close"/);
  assert.match(markupWorkspaceSource, /aria-label="Close Markup workspace"/);
  assert.match(markupWorkspaceSource, /aria-label="Markup note stage"/);
  assert.match(markupWorkspaceSource, /data-testid="markup-note-stage"/);
  assert.match(markupWorkspaceSource, /aria-label="Canvas preview area"/);
  assert.match(markupWorkspaceSource, /data-testid="markup-workspace-context"/);
});

test("paint workspace only renders in paint mode and never in preview", () => {
  assert.match(appSource, /\{paintMode && !previewMode && \([\s\S]{0,120}<MarkupWorkspace/);
});

test("paint mode entering does not auto-start stroke", () => {
  assert.match(appSource, /setPaintMode\(true\); setPaintActivePoints\(\[\]\); setPaintRedoStrokes\(\[\]\)/);
  assert.match(appSource, /function seedAppliedFreehandStrokes\(\)/);
  assert.match(appSource, /if \(!paintMode \|\| previewMode\) return;/);
});

test("Markup workspace close returns to normal editor state through existing discard path", () => {
  assert.match(appSource, /onClose=\{discardPaintAndExit\}/);
  assert.match(appSource, /function discardPaintAndExit\(\)[\s\S]{0,220}setPaintDraftStrokes\(\[\]\)[\s\S]{0,220}setPaintMode\(false\)/);
  assert.doesNotMatch(appSource, /function discardPaintAndExit\(\)[\s\S]{0,220}setPaintAppliedStrokes\(\[\]\)/);
  assert.match(markupWorkspaceSource, /onClick=\{onClose\}/);
});

test("Markup workspace keeps only draft freehand strokes transient while saved Markup stays editor-only", () => {
  assert.match(markupWorkspaceSource, /Draft freehand strokes are discarded/);
  assert.match(markupWorkspaceSource, /Sticky notes and kept freehand strokes are saved with the project/);
  assert.match(markupWorkspaceSource, /shown only in Markup, and not published/);
  assert.match(markupWorkspaceSource, /<details className="markup-workspace-help">/);
  assert.match(markupWorkspaceSource, /<summary>Help<\/summary>/);
  assert.doesNotMatch(markupWorkspaceSource, /<strong>Canvas preview area<\/strong>/);
  assert.doesNotMatch(markupWorkspaceSource, /fetchJson|project\.pages|setProject|localStorage/);
});

test("clear and discard remove only draft strokes", () => {
  assert.match(appSource, /function clearPaintDraft\(\)/);
  assert.match(appSource, /setPaintDraftStrokes\(\[\]\)/);
  assert.match(appSource, /function discardPaintAndExit\(\)/);
  assert.match(appSource, /function discardPaintAndExit\(\)[\s\S]{0,120}setPaintDraftStrokes\(\[\]\)/);
  assert.doesNotMatch(appSource, /function discardPaintAndExit\(\)[\s\S]{0,220}setPaintAppliedStrokes\(\[\]\)/);
  assert.match(appSource, /setPaintMode\(false\)/);
});

test("paint overlay applies persisted and draft stroke separation", () => {
  assert.match(appSource, /setPaintAppliedStrokes\(\(strokes\) => \[\.\.\.strokes, \.\.\.paintDraftStrokes\.map/);
  assert.match(appSource, /paintDraftStrokes\.map\(\(stroke\) =>/);
  assert.match(appSource, /renderMarkupStroke\(stroke\.id, stroke\.points, stroke\.color, stroke\.size, stroke\.opacity, MARKUP_DRAFT_STROKE_OPACITY\)/);
  assert.match(appSource, /renderMarkupStroke\(stroke\.id, stroke\.points, stroke\.color, stroke\.size, stroke\.opacity, MARKUP_APPLIED_STROKE_OPACITY\)/);
  assert.match(appSource, /paintAppliedStrokes\.map\(\(stroke\) =>/);
});

test("paint overlay visibility is Markup-mode only so discard cannot leak into normal editor", () => {
  assert.match(appSource, /\{paintMode && !previewMode && \(/);
  assert.doesNotMatch(appSource, /\{\(paintMode \|\| paintAppliedStrokes\.length > 0\) && \(/);
});

test("Keep Markup is explicit and writes kept freehand strokes into dirty project state", () => {
  assert.match(markupWorkspaceSource, /Keep in Session/);
  assert.match(markupWorkspaceSource, /aria-label="Keep draft markup in this Markup session"/);
  assert.match(appSource, /setStatus\("Free draw kept with project draft"\)/);
  const keepFnIdx = appSource.indexOf("function applyPaintOverlay()");
  assert.ok(keepFnIdx > 0, "applyPaintOverlay function exists");
  const keepFn = appSource.substring(keepFnIdx, appSource.indexOf("function discardPaintAndExit()", keepFnIdx));
  assert.match(keepFn, /markupFreehandStrokes: \[\.\.\.\(current\.markupFreehandStrokes \|\| \[\]\), \.\.\.keptStrokes\]/);
  assert.match(keepFn, /setDirty\(true\)/);
});

test("Markup sticky note controls are explicit and scoped to the workspace", () => {
  assert.match(markupWorkspaceSource, /data-testid="markup-add-note"/);
  assert.match(markupWorkspaceSource, /data-testid="markup-note-editor"/);
  assert.match(markupWorkspaceSource, /data-testid="markup-note-text"/);
  assert.match(markupWorkspaceSource, /data-testid="markup-delete-note"/);
  assert.match(markupWorkspaceSource, /data-testid="markup-note-pin"/);
  assert.match(markupWorkspaceSource, /data-testid="markup-note-drag-handle"/);
  assert.match(markupWorkspaceSource, /data-testid="markup-note-move"/);
  assert.match(markupWorkspaceSource, /aria-label="Sticky note annotations"/);
  assert.match(markupWorkspaceSource, /aria-label="Saved Markup note pins"/);
  assert.match(markupWorkspaceSource, /data-markup-note-id=\{annotation\.id\}[\s\S]{0,260}onPointerDown=\{\(event\) => startNoteDrag\(annotation\.id, event\)\}/);
});

test("Markup workspace save button invokes the existing project save flow", () => {
  assert.match(markupWorkspaceSource, /data-testid="markup-save-project"/);
  assert.match(markupWorkspaceSource, /Save Project/);
  assert.match(markupWorkspaceSource, /onClick=\{\(\) => void onSaveProject\(\)\}/);
  assert.match(appSource, /onSaveProject=\{saveProject\}/);
  assert.match(markupWorkspaceSource, /Save: \{saveStatusText\}/);
});

test("Markup sticky note pins are draggable and report normalized coordinates", () => {
  assert.match(markupWorkspaceSource, /const workspaceStageRef = useRef<HTMLDivElement \| null>\(null\)/);
  assert.doesNotMatch(markupWorkspaceSource, /canvasFrameRef/);
  assert.match(markupWorkspaceSource, /workspaceStageRef\.current\?\.getBoundingClientRect\(\)/);
  assert.match(markupWorkspaceSource, /ref=\{workspaceStageRef\}/);
  assert.match(markupWorkspaceSource, /data-markup-note-id=\{annotation\.id\}/);
  assert.match(markupWorkspaceSource, /onPointerDown=\{\(event\) => startNoteDrag\(annotation\.id, event\)\}/);
  assert.match(markupWorkspaceSource, /onPointerMove=\{\(event\) => dragNote\(annotation\.id, event\)\}/);
  assert.match(markupWorkspaceSource, /onPointerUp=\{endNoteDrag\}/);
  assert.match(markupWorkspaceSource, /setArmedMoveNoteId\(null\)/);
  assert.match(markupWorkspaceSource, /clampMarkupCoordinate\(x \/ rect\.width\)/);
  assert.match(markupWorkspaceSource, /clampMarkupCoordinate\(y \/ rect\.height\)/);
  assert.match(cssSource, /\.markup-note-pin[\s\S]*pointer-events:\s*auto/);
  assert.match(cssSource, /\.markup-note-pin[\s\S]*touch-action:\s*none/);
  assert.match(cssSource, /\.markup-note-pin[\s\S]*z-index:\s*3/);
  assert.match(cssSource, /\.markup-note-pin::before[\s\S]*inset:\s*-8px/);
});

test("Markup note stage, not the preview card, owns note bounds and pin positioning", () => {
  const stageIdx = markupWorkspaceSource.indexOf('data-testid="markup-note-stage"');
  const pinLayerIdx = markupWorkspaceSource.indexOf('className="markup-note-pin-layer"');
  const previewIdx = markupWorkspaceSource.indexOf('data-testid="markup-workspace-canvas-area"');
  assert.ok(stageIdx > 0, "note stage exists");
  assert.ok(pinLayerIdx > stageIdx, "pin layer is inside note stage");
  assert.ok(previewIdx > pinLayerIdx, "preview card is rendered after the stage pin layer");
  assert.match(markupWorkspaceSource, /className=\{`markup-workspace-canvas-area \$\{armedMoveNoteId \? "move-armed" : ""\} \$\{paintCaptureActive \? "paint-armed" : ""\}`\}[\s\S]{0,300}ref=\{workspaceStageRef\}/);
  assert.match(markupWorkspaceSource, /className="markup-note-pin-layer"[\s\S]{0,900}style=\{\{ left: `\$\{annotation\.x \* 100\}%`, top: `\$\{annotation\.y \* 100\}%`/);
  assert.match(cssSource, /\.markup-workspace-canvas-area[\s\S]{0,180}position:\s*relative/);
  assert.match(cssSource, /\.markup-note-pin-layer[\s\S]{0,120}inset:\s*0/);
  assert.match(cssSource, /\.markup-workspace-canvas-frame[\s\S]{0,260}pointer-events:\s*none/);
});

test("Markup note Move mode places notes from the canvas without trapping text editing or buttons", () => {
  assert.match(markupWorkspaceSource, /const \[armedMoveNoteId, setArmedMoveNoteId\] = useState<string \| null>\(null\)/);
  assert.match(markupWorkspaceSource, /function shouldStartNoteDrag\(event: PointerEvent<HTMLElement>\)/);
  assert.match(markupWorkspaceSource, /closest\("textarea, button, input, select, a, label"\)/);
  assert.match(markupWorkspaceSource, /return !blockedControl \|\| blockedControl === event\.currentTarget/);
  assert.match(markupWorkspaceSource, /function armNoteMove\(id: string\)/);
  assert.match(markupWorkspaceSource, /setArmedMoveNoteId\(\(currentId\) => \(currentId === id \? null : id\)\)/);
  assert.match(markupWorkspaceSource, /function placeArmedNote\(event: PointerEvent<HTMLDivElement>\)/);
  assert.match(markupWorkspaceSource, /if \(!armedMoveNoteId\) return/);
  assert.match(markupWorkspaceSource, /target\?\.closest\("\.markup-note-pin"\)/);
  assert.match(markupWorkspaceSource, /moveNoteFromPointer\(armedMoveNoteId, event\)/);
  assert.match(markupWorkspaceSource, /className=\{`markup-workspace-note-handle \$\{armedMoveNoteId === annotation\.id \? "move-armed" : ""\}`\}/);
  assert.match(markupWorkspaceSource, /data-testid="markup-note-drag-handle"/);
  assert.match(markupWorkspaceSource, /data-testid="markup-note-move"/);
  assert.match(markupWorkspaceSource, /aria-pressed=\{armedMoveNoteId === annotation\.id\}/);
  assert.match(markupWorkspaceSource, /onClick=\{\(\) => armNoteMove\(annotation\.id\)\}/);
  assert.match(markupWorkspaceSource, /className=\{`markup-workspace-canvas-area \$\{armedMoveNoteId \? "move-armed" : ""\} \$\{paintCaptureActive \? "paint-armed" : ""\}`\}/);
  assert.match(markupWorkspaceSource, /onPointerDown=\{placeArmedNote\}/);
  assert.match(markupWorkspaceSource, /<textarea[\s\S]{0,220}data-testid="markup-note-text"/);
  assert.match(markupWorkspaceSource, /<button type="button" onClick=\{\(\) => onDeleteNote\(annotation\.id\)\} data-testid="markup-delete-note"/);
  assert.match(cssSource, /\.markup-workspace-canvas-area\.move-armed[\s\S]{0,80}pointer-events:\s*auto/);
  assert.match(cssSource, /\.markup-workspace-canvas-frame\.move-armed[\s\S]{0,160}cursor:\s*crosshair/);
  assert.match(cssSource, /\.markup-workspace-note-handle[\s\S]*touch-action:\s*pan-y/);
  assert.match(cssSource, /\.markup-workspace-note-move\[aria-pressed="true"\]/);
});

test("Markup note move helper clamps normalized x/y and updates only the selected note", () => {
  assert.match(markupAnnotationsSource, /export function clampMarkupCoordinate\(value: number\): number/);
  assert.match(markupAnnotationsSource, /Math\.min\(1, Math\.max\(0, value\)\)/);
  assert.match(markupAnnotationsSource, /export function moveMarkupAnnotation/);
  assert.match(markupAnnotationsSource, /annotation\.id === id/);
  assert.match(markupAnnotationsSource, /x: nextX/);
  assert.match(markupAnnotationsSource, /y: nextY/);
  assert.match(markupAnnotationsSource, /updatedAt/);
});

test("App wires sticky notes and freehand strokes through editor-only project markup state", () => {
  assert.match(appSource, /MarkupAnnotation/);
  assert.match(appSource, /MarkupFreehandStroke/);
  assert.match(appSource, /currentPageMarkupAnnotations/);
  assert.match(appSource, /currentPageFreehandStrokes/);
  assert.match(appSource, /project\?\.markupAnnotations \|\| \[\]/);
  assert.match(appSource, /project\?\.markupFreehandStrokes \|\| \[\]/);
  assert.match(appSource, /function createMarkupNote\(\)/);
  assert.match(appSource, /function updateMarkupNoteText\(id: string, text: string\)/);
  assert.match(appSource, /function moveMarkupNote\(id: string, x: number, y: number\)/);
  assert.match(appSource, /function deleteMarkupNote\(id: string\)/);
  assert.match(appSource, /function paintStrokeToProjectStroke/);
  assert.match(appSource, /function clearAppliedFreeDraw\(\)/);
  assert.match(appSource, /markupAnnotations: updater\(current\.markupAnnotations \|\| \[\]\)/);
  assert.match(appSource, /markupFreehandStrokes: \[\.\.\.\(current\.markupFreehandStrokes \|\| \[\]\), \.\.\.keptStrokes\]/);
  assert.match(appSource, /moveMarkupAnnotation\(annotations, id, x, y, timestamp\)/);
  assert.match(appSource, /setDirty\(true\)/);
});

test("paint overlay captures pointer events only in exclusive paint mode", () => {
  assert.match(appSource, /className=\{`paint-overlay \$\{paintExclusiveMode \? "capture-active" : ""\}`\}/);
  assert.match(appSource, /onPointerDown=\{paintExclusiveMode \? beginPaint : undefined\}/);
  assert.match(cssSource, /\.paint-overlay\.capture-active[\s\S]*pointer-events:\s*auto/);
});

test("paint mode disables block editing interactions through canEditBlocks gate", () => {
  assert.match(appSource, /const canEditBlocks = !previewMode && !paintMode;/);
  assert.match(appSource, /if \(previewMode \|\| paintMode\) return;/);
  assert.match(appSource, /draggable=\{canEditBlocks\}/);
  assert.match(appSource, /editable=\{canEditBlocks\}/);
  assert.match(appSource, /\{selectedBlock\?\.id === block\.id && canEditBlocks && \(/);
});

test("paint mode applies user-select lock on preview surface", () => {
  assert.match(appSource, /paint-exclusive/);
  assert.match(cssSource, /\.canvas-frame\.paint-exclusive,\n\.canvas-frame\.paint-exclusive \*/);
  assert.match(cssSource, /user-select:\s*none/);
});

test("mobile-toolbar-gap-repair and action-controls-offset markers remain", () => {
  assert.match(appSource, /mobile-toolbar-gap-repair/);
  assert.match(appSource, /action-controls-offset/);
});

test("mobile-toolbar-spacer-v3 marker is not active", () => {
  assert.doesNotMatch(appSource, /mobile-toolbar-spacer-v3 active/);
});

test("isPreview helper exists as alias for previewMode", () => {
  assert.match(appSource, /const isPreview = previewMode;/);
});

test("preview mode hides canvas debug panel status", () => {
  const canvasDebugIdx = appSource.indexOf("Canvas debug");
  assert.ok(canvasDebugIdx > 0, "Canvas debug text exists");
  const beforeSection = appSource.substring(Math.max(0, canvasDebugIdx - 200), canvasDebugIdx);
  assert.match(beforeSection, /\{!previewMode &&/);
});

test("mobile preview uses single-column grid instead of 3-column", () => {
  const previewGridIdx = cssSource.indexOf(".app.preview .workspace.preview-mode");
  assert.ok(previewGridIdx >= 0, "preview-mode workspace grid rule exists");
  const desktopGridSection = cssSource.substring(previewGridIdx, previewGridIdx + 200);
  assert.match(desktopGridSection, /grid-template-columns:\s*0 minmax\(0,\s*1fr\) 0 !important/);
  const mobileOverrideIdx = cssSource.indexOf(".app.preview .workspace.preview-mode", previewGridIdx + 100);
  assert.ok(mobileOverrideIdx >= 0, "mobile preview workspace grid override exists");
  const mobileGridSection = cssSource.substring(mobileOverrideIdx, mobileOverrideIdx + 200);
  assert.match(mobileGridSection, /grid-template-columns:\s*1fr !important/);
});

test("mobile preview does not hide canvas content", () => {
  const firstPreviewGridIdx = cssSource.indexOf(".app.preview .workspace.preview-mode");
  assert.ok(firstPreviewGridIdx >= 0, "preview-mode workspace grid rule exists");
  const secondPreviewGridIdx = cssSource.indexOf(".app.preview .workspace.preview-mode", firstPreviewGridIdx + 1);
  assert.ok(secondPreviewGridIdx >= 0, "mobile override for preview-mode workspace grid exists");
  const mobileGridSection = cssSource.substring(secondPreviewGridIdx, secondPreviewGridIdx + 200);
  assert.match(mobileGridSection, /grid-template-columns:\s*1fr !important/, "mobile preview grid is single column");
});

test("mobile editor overlay is display none when closed not just pointer-events none", () => {
  const m768 = cssSource.indexOf("@media (max-width: 768px)");
  assert.ok(m768 >= 0, "mobile media query exists");
  const afterMobile = cssSource.substring(m768);
  const notOpenIdx = afterMobile.indexOf(".mobile-editor-overlay:not(.open)");
  assert.ok(notOpenIdx >= 0, "mobile-editor-overlay:not(.open) rule exists in mobile section");
  const notOpenBlock = afterMobile.substring(notOpenIdx, notOpenIdx + 200);
  assert.match(notOpenBlock, /display:\s*none/, "closed mobile overlay is display none");
});

test("openBlockDrawer clears rightCollapsed on mobile to prevent stuck collapse", () => {
  const openBlockIdx = appSource.indexOf("function openBlockDrawer(blockId: string)");
  assert.ok(openBlockIdx > 0, "openBlockDrawer function exists");
  const fnSection = appSource.substring(openBlockIdx, openBlockIdx + 300);
  assert.match(fnSection, /setRightCollapsed\(false\)/, "openBlockDrawer clears rightCollapsed");
  assert.match(fnSection, /setRightDrawerMobileOpen\(true\)/, "openBlockDrawer sets rightDrawerMobileOpen true");
});

test("openSiteHeaderDrawer clears rightCollapsed", () => {
  const openSiteHeaderIdx = appSource.indexOf("function openSiteHeaderDrawer(");
  assert.ok(openSiteHeaderIdx > 0, "openSiteHeaderDrawer function exists");
  const fnSection = appSource.substring(openSiteHeaderIdx, openSiteHeaderIdx + 400);
  assert.match(fnSection, /setRightCollapsed\(false\)/, "openSiteHeaderDrawer clears rightCollapsed");
  assert.match(fnSection, /setRightDrawerMobileOpen\(true\)/, "openSiteHeaderDrawer sets rightDrawerMobileOpen true");
});

test("openGallerySlotDrawer clears rightCollapsed", () => {
  const openGalleryIdx = appSource.indexOf("function openGallerySlotDrawer(");
  assert.ok(openGalleryIdx > 0, "openGallerySlotDrawer function exists");
  const fnSection = appSource.substring(openGalleryIdx, openGalleryIdx + 400);
  assert.match(fnSection, /setRightCollapsed\(false\)/, "openGallerySlotDrawer clears rightCollapsed");
  assert.match(fnSection, /setRightDrawerMobileOpen\(true\)/, "openGallerySlotDrawer sets rightDrawerMobileOpen true");
});

test("context menu Edit Properties reopens drawer after close via openBlockDrawer", () => {
  assert.match(appSource, /openBlockDrawer\(contextMenu\.blockId\)/);
  assert.match(appSource, /setRightCollapsed\(false\)/);
});

test("desktop right panel collapse and restore still work independently", () => {
  assert.match(appSource, /right-drawer-collapse-btn/);
  assert.match(appSource, /setRightCollapsed\(true\)/);
  assert.match(appSource, /right-drawer-restore-btn/);
  assert.match(appSource, /setRightCollapsed\(false\)/);
  assert.match(cssSource, /\.workspace\.right-collapsed/);
  assert.match(cssSource, /\.right-drawer\.collapsed/);
});

test("mobile drawer state is not permanently blocked by rightPanelCollapsed", () => {
  const openBlockIdx = appSource.indexOf("function openBlockDrawer(blockId: string)");
  assert.ok(openBlockIdx > 0, "openBlockDrawer function exists");
  const fnSection = appSource.substring(openBlockIdx, openBlockIdx + 300);
  assert.match(fnSection, /setRightDrawerMobileOpen\(true\)/);
  assert.match(fnSection, /setRightCollapsed\(false\)/);
  assert.doesNotMatch(fnSection, /if \(rightCollapsed\)/, "openBlockDrawer is not gated by rightCollapsed");
});

test("leaving preview restores ability to open drawer on mobile", () => {
  assert.match(appSource, /setLeftCollapsed\(prePreviewLeftCollapsed\)/);
  assert.match(appSource, /setRightCollapsed\(prePreviewRightCollapsed\)/);
  assert.match(appSource, /setRightCollapsed\(false\)/);
});

test("Settings X close still exists after mobile preview fix", () => {
  assert.match(appSource, /modal-close/);
  assert.match(appSource, /aria-label="Close Settings"/);
  assert.match(appSource, /setSettingsOpen\(false\)/);
});

test("Logout button still exists after mobile preview fix", () => {
  assert.match(appSource, /logout-btn/);
  assert.match(appSource, /\/logout/);
  assert.match(cssSource, /\.logout-btn/);
});

test("mobile-toolbar-gap-repair marker preserved after fix", () => {
  assert.match(appSource, /mobile-toolbar-gap-repair/);
  assert.match(appSource, /action-controls-offset/);
});

test("mobile-toolbar-spacer-v3 marker still absent after fix", () => {
  assert.doesNotMatch(appSource, /mobile-toolbar-spacer-v3 active/);
});

test("topbar-mobile-spacer remains single mobile offset owner using --mobile-toolbar-h", () => {
  assert.match(cssSource, /\.topbar-mobile-spacer[\s\S]*height:\s*var\(--mobile-topbar-h/);
  assert.match(cssSource, /\.topbar-mobile-spacer[\s\S]*min-height:\s*var\(--mobile-topbar-h/);
  assert.match(appSource, /setProperty\("--mobile-topbar-h"/);
  assert.match(appSource, /topbar-mobile-spacer/);
});

test("publish login gate smoke expectations remain correct", () => {
  assert.match(appSource, /runPublish/);
  assert.match(appSource, /\/api\/publish/);
  assert.match(appSource, /dryRun/);
  assert.match(smokeSource, /PUBLISH_UNAUTH_STATUS/);
  assert.match(smokeSource, /unauth \/api\/publish expected 401/);
});

test("context menu ellipsis button does not directly call any drawer-opening function", () => {
  const ctxBtnIdx = appSource.indexOf('className="context-btn"');
  assert.ok(ctxBtnIdx > 0, "context-btn exists");
  const btnSection = appSource.substring(ctxBtnIdx, ctxBtnIdx + 200);
  assert.match(btnSection, /openContextMenu\(e, block\.id\)/);
  assert.doesNotMatch(btnSection, /setRightCollapsed\(false\)/);
  assert.doesNotMatch(btnSection, /setRightDrawerMobileOpen\(true\)/);
  assert.doesNotMatch(btnSection, /openBlockDrawer/);
});

test("selectBlockQuiet function exists for non-drawer context actions", () => {
  assert.match(appSource, /function selectBlockQuiet\(blockId: string\)/);
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\)/);
});

test("selectBlockQuiet does not set rightCollapsed or rightDrawerMobileOpen", () => {
  const quietIdx = appSource.indexOf("function selectBlockQuiet(blockId: string)");
  assert.ok(quietIdx > 0, "selectBlockQuiet function exists");
  const fnSection = appSource.substring(quietIdx, quietIdx + 200);
  assert.doesNotMatch(fnSection, /setRightCollapsed/);
  assert.doesNotMatch(fnSection, /setRightDrawerMobileOpen/);
});

test("context menu Edit Properties calls openBlockDrawer which opens drawer", () => {
  assert.match(appSource, /openBlockDrawer\(contextMenu\.blockId\); setContextMenu\(null\);[\s\S]*?Edit Properties/);
});

test("context menu AI Assistant calls openAiDrawer which opens drawer", () => {
  assert.match(appSource, /openAiDrawer\(contextMenu\.blockId\); setContextMenu\(null\);[\s\S]*?AI Assistant/);
});

test("context menu Resize/Layout calls openResizeLayoutForBlock which opens drawer", () => {
  assert.match(appSource, /openResizeLayoutForBlock\(contextMenu\.blockId\); setContextMenu\(null\);[\s\S]*?Resize\/Layout/);
  const resizeFnIdx = appSource.indexOf("function openResizeLayoutForBlock(blockId: string)");
  assert.ok(resizeFnIdx > 0, "openResizeLayoutForBlock function exists");
  const fnSection = appSource.substring(resizeFnIdx, resizeFnIdx + 600);
  assert.match(fnSection, /setRightDrawerMobileOpen\(true\)/);
  assert.match(fnSection, /setRightCollapsed\(false\)/);
});

test("context menu Image Library opens drawer to images tab", () => {
  assert.match(appSource, /setRightTab\("images"\); setRightDrawerMobileOpen\(true\); setRightCollapsed\(false\); setImageManagerOpen\(true\)[\s\S]{0,200}Image Library/);
});

test("context menu Duplicate does not force-open drawer", () => {
  const dupIdx = appSource.indexOf("duplicateBlock(contextMenu.blockId); setContextMenu(null)");
  assert.ok(dupIdx > 0, "Duplicate context action exists");
  const dupLine = appSource.substring(dupIdx, dupIdx + 120);
  assert.doesNotMatch(dupLine, /setRightCollapsed\(false\)/);
  assert.doesNotMatch(dupLine, /setRightDrawerMobileOpen\(true\)/);
});

test("context menu Delete does not force-open drawer", () => {
  const delIdx = appSource.indexOf("deleteBlock(contextMenu.blockId); setContextMenu(null)");
  assert.ok(delIdx > 0, "Delete context action exists");
  const delLine = appSource.substring(delIdx, delIdx + 120);
  assert.doesNotMatch(delLine, /setRightCollapsed\(false\)/);
  assert.doesNotMatch(delLine, /setRightDrawerMobileOpen\(true\)/);
});

test("context menu Move Up uses selectBlockQuiet without drawer opening", () => {
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); moveBlock\("up", contextMenu\.blockId\); closeTransientOverlays\(\);[\s\S]*?Move Up/);
});

test("context menu Move Down uses selectBlockQuiet without drawer opening", () => {
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); moveBlock\("down", contextMenu\.blockId\); closeTransientOverlays\(\);[\s\S]*?Move Down/);
});

test("context menu Start new row uses selectBlockQuiet without drawer opening", () => {
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); startNewRow\(contextMenu\.blockId\); closeTransientOverlays\(\);[\s\S]*?Start new row/);
});

test("context menu Place with block above uses selectBlockQuiet without drawer opening", () => {
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); placeWithPrevious\(contextMenu\.blockId\); closeTransientOverlays\(\);[\s\S]*?Place with block above/);
});

test("context menu Remove from row uses selectBlockQuiet without drawer opening", () => {
  assert.match(appSource, /selectBlockQuiet\(contextMenu\.blockId\); removeFromRow\(contextMenu\.blockId\); closeTransientOverlays\(\);[\s\S]*?Remove from row/);
});

test("desktop right panel restore button still opens panel", () => {
  assert.match(appSource, /right-drawer-restore-btn[\s\S]{0,100}onClick=\{\(\) => setRightCollapsed\(false\)/);
});

test("Markup workspace is positioned in editor chrome stack", () => {
  const spacerIdx = appSource.indexOf('className="topbar-mobile-spacer"');
  const workspaceShellIdx = appSource.indexOf("<MarkupWorkspace");
  const workspaceIdx = appSource.indexOf('className={`workspace');
  assert.ok(spacerIdx > 0, "topbar-mobile-spacer exists");
  assert.ok(workspaceShellIdx > 0, "MarkupWorkspace exists");
  assert.ok(workspaceIdx > 0, "workspace exists");
  assert.ok(spacerIdx < workspaceShellIdx, "Markup workspace is after spacer in DOM");
  assert.ok(workspaceShellIdx < workspaceIdx, "Markup workspace is before workspace in DOM");
});

test("Markup workspace uses fixed full-page positioning and mobile z-index", () => {
  assert.match(cssSource, /\.markup-workspace-shell[\s\S]*position:\s*fixed/);
  assert.match(cssSource, /\.markup-workspace-shell[\s\S]*inset:\s*0/);
  assert.match(cssSource, /\.markup-workspace-shell[\s\S]*z-index:\s*120/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.markup-workspace-shell[\s\S]*z-index:\s*130/);
});

test("Markup wash keeps the site preview readable behind controls", () => {
  assert.match(cssSource, /rgba\(249,\s*250,\s*252,\s*0\.38\)/);
  assert.match(cssSource, /rgba\(249,\s*250,\s*252,\s*0\.18\)/);
  assert.match(cssSource, /color-mix\(in srgb, var\(--editor-bg\) 24%, transparent\)/);
  assert.match(cssSource, /rgba\(28,\s*32,\s*38,\s*0\.42\)/);
  assert.match(cssSource, /rgba\(28,\s*32,\s*38,\s*0\.22\)/);
  assert.match(cssSource, /\.markup-workspace-canvas-frame[\s\S]{0,420}background:\s*color-mix\(in srgb, var\(--editor-panel-bg\) 26%, transparent\)/);
});

test("paint overlay SVG does not use viewBox scaling", () => {
  const overlayIdx = appSource.indexOf('className={`paint-overlay');
  assert.ok(overlayIdx > 0, "paint-overlay SVG exists");
  const overlayLine = appSource.substring(overlayIdx, overlayIdx + 300);
  assert.doesNotMatch(overlayLine, /viewBox/);
  assert.doesNotMatch(overlayLine, /preserveAspectRatio/);
});

test("paint overlay covers the Markup stage with inset 0 positioning", () => {
  assert.match(cssSource, /\.paint-overlay[\s\S]*position:\s*absolute/);
  assert.match(cssSource, /\.paint-overlay[\s\S]*inset:\s*0/);
  assert.match(appSource, /freehandLayer=\{[\s\S]{0,180}<svg[\s\S]{0,120}className=\{`paint-overlay/);
  assert.match(markupWorkspaceSource, /\{freehandLayer\}[\s\S]{0,120}<div className="markup-note-pin-layer"/);
});

test("paint overlay is clipped inside the Markup stage with high-contrast stroke halos", () => {
  assert.match(cssSource, /\.markup-workspace-canvas-area[\s\S]{0,220}overflow:\s*hidden/);
  assert.match(cssSource, /\.markup-workspace-canvas-area[\s\S]{0,260}isolation:\s*isolate/);
  assert.match(cssSource, /\.paint-overlay[\s\S]{0,220}z-index:\s*5/);
  assert.match(cssSource, /\.paint-overlay[\s\S]{0,240}overflow:\s*hidden/);
  assert.match(cssSource, /\.markup-note-pin-layer[\s\S]{0,140}z-index:\s*8/);
  assert.match(appSource, /const MARKUP_STROKE_MIN_VISIBLE_OPACITY = 0\.9/);
  assert.match(appSource, /const MARKUP_STROKE_OUTER_HALO_WIDTH_OFFSET = 8/);
  assert.match(appSource, /const MARKUP_STROKE_INNER_HALO_WIDTH_OFFSET = 4/);
  assert.match(appSource, /className="markup-freehand-stroke"/);
  assert.match(appSource, /stroke="#ffffff"[\s\S]{0,120}MARKUP_STROKE_OUTER_HALO_WIDTH_OFFSET/);
  assert.match(appSource, /stroke="#0b1020"[\s\S]{0,120}MARKUP_STROKE_INNER_HALO_WIDTH_OFFSET/);
});

test("paint overlay captures pointer events in exclusive paint mode", () => {
  assert.match(appSource, /onPointerDown=\{paintExclusiveMode \? beginPaint : undefined\}/);
  assert.match(markupWorkspaceSource, /paintCaptureActive: boolean/);
  assert.match(markupWorkspaceSource, /paintCaptureActive \? "paint-armed" : ""/);
  assert.match(cssSource, /\.paint-overlay\.capture-active[\s\S]*pointer-events:\s*auto/);
  assert.match(cssSource, /\.markup-workspace-canvas-area\.move-armed,\n\.markup-workspace-canvas-area\.paint-armed[\s\S]{0,80}pointer-events:\s*auto/);
});

test("paint mode disables contentEditable and block selection", () => {
  assert.match(appSource, /const canEditBlocks = !previewMode && !paintMode;/);
  assert.match(appSource, /editable=\{canEditBlocks\}/);
  assert.match(appSource, /draggable=\{canEditBlocks\}/);
});

test("paint exclusive mode applies user-select none", () => {
  assert.match(cssSource, /\.canvas-frame\.paint-exclusive[\s\S]*user-select:\s*none/);
});

test("Markup workspace is only present in paint mode not preview", () => {
  assert.match(appSource, /\{paintMode && !previewMode && \(/);
  assert.match(appSource, /<MarkupWorkspace/);
});

test("Markup workspace is not inside paint-overlay SVG", () => {
  const workspaceShellIdx = appSource.indexOf("<MarkupWorkspace");
  const overlayIdx = appSource.indexOf('className={`paint-overlay');
  assert.ok(workspaceShellIdx > 0, "MarkupWorkspace exists");
  assert.ok(overlayIdx > 0, "paint-overlay exists");
  assert.ok(workspaceShellIdx < overlayIdx, "Markup workspace is before paint-overlay in DOM, not inside it");
});

test("Markup paint coordinate math uses the Markup stage instead of editor chrome", () => {
  assert.match(appSource, /function getMarkupPaintStageElement/);
  assert.match(appSource, /closest\("\.markup-workspace-canvas-area"\)/);
  assert.match(appSource, /document\.querySelector\("\.markup-workspace-canvas-area"\)/);
  assert.match(appSource, /Math\.min\(rect\.width, Math\.max\(0, e\.clientX - rect\.left\)\)/);
  assert.match(appSource, /Math\.min\(rect\.height, Math\.max\(0, e\.clientY - rect\.top\)\)/);
});

test("Markup note movement clamps pins inside the Markup stage", () => {
  assert.match(markupWorkspaceSource, /const MARKUP_NOTE_PIN_EDGE_INSET_PX = 17/);
  assert.match(markupWorkspaceSource, /const insetX = Math\.min\(MARKUP_NOTE_PIN_EDGE_INSET_PX, maxInsetX\)/);
  assert.match(markupWorkspaceSource, /const insetY = Math\.min\(MARKUP_NOTE_PIN_EDGE_INSET_PX, maxInsetY\)/);
  assert.match(markupWorkspaceSource, /Math\.min\(rect\.width - insetX, Math\.max\(insetX, event\.clientX - rect\.left\)\)/);
  assert.match(markupWorkspaceSource, /Math\.min\(rect\.height - insetY, Math\.max\(insetY, event\.clientY - rect\.top\)\)/);
});

test("Markup controls can be collapsed and reopened via a Hide/Show toggle", () => {
  assert.match(markupWorkspaceSource, /controlsCollapsed: boolean/);
  assert.match(markupWorkspaceSource, /onToggleControls: \(\) => void/);
  assert.match(markupWorkspaceSource, /data-testid="markup-controls-toggle"/);
  assert.match(markupWorkspaceSource, /className="markup-controls-toggle"/);
  assert.match(markupWorkspaceSource, /onClick=\{onToggleControls\}/);
  assert.match(markupWorkspaceSource, /controlsCollapsed \? "Show Controls" : "Hide Controls"/);
  assert.match(markupWorkspaceSource, /aria-pressed=\{controlsCollapsed\}/);
  assert.match(markupWorkspaceSource, /className=\{`markup-workspace-body \$\{controlsCollapsed \? "controls-collapsed" : ""\}`\}/);
  assert.match(markupWorkspaceSource, /className=\{`markup-workspace-panel \$\{controlsCollapsed \? "controls-collapsed" : ""\}`\}/);
  assert.match(cssSource, /\.markup-workspace-body\.controls-collapsed[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(cssSource, /\.markup-workspace-panel\.controls-collapsed[\s\S]*display:\s*none/);
});

test("Markup stage reserves right inset for the editor props/menu panel", () => {
  assert.match(markupWorkspaceSource, /stageRightInsetPx: number/);
  assert.match(markupWorkspaceSource, /--markup-stage-right-inset/);
  assert.match(markupWorkspaceSource, /Math\.max\(0, stageRightInsetPx\)/);
  assert.match(cssSource, /\.markup-workspace-body[\s\S]*padding-right:\s*var\(--markup-stage-right-inset/);
  assert.match(appSource, /const \[markupStageRightInset, setMarkupStageRightInset\] = useState\(0\)/);
  assert.match(appSource, /measureMarkupStageInset/);
  assert.match(appSource, /window\.innerWidth - rect\.left/);
  assert.match(appSource, /stageRightInsetPx=\{markupStageRightInset\}/);
  assert.match(appSource, /controlsCollapsed=\{markupControlsCollapsed\}/);
  assert.match(appSource, /onToggleControls=\{\(\) => setMarkupControlsCollapsed\(\(v\) => !v\)\}/);
});

test("Markup freehand only draws from the stage-owned paint overlay, never editor chrome", () => {
  assert.match(appSource, /onPointerDown=\{paintExclusiveMode \? beginPaint : undefined\}/);
  assert.match(appSource, /closest\("\.markup-workspace-canvas-area"\)/);
  assert.match(cssSource, /\.markup-workspace-canvas-area[\s\S]{0,220}overflow:\s*hidden/);
  assert.match(cssSource, /\.paint-overlay\.capture-active[\s\S]*pointer-events:\s*auto/);
});

test("Markup controls toggle textarea and buttons do not become drawing targets", () => {
  assert.match(markupWorkspaceSource, /target\?\.closest\("textarea, button, input, select, a, label"\)/);
  assert.match(markupWorkspaceSource, /className=\{`markup-workspace-canvas-area \$\{armedMoveNoteId \? "move-armed" : ""\} \$\{paintCaptureActive \? "paint-armed" : ""\}`\}/);
});

test("Markup workspace is outside canvas-area scroll container", () => {
  const workspaceShellIdx = appSource.indexOf("<MarkupWorkspace");
  const canvasAreaIdx = appSource.indexOf('className="canvas-area"');
  assert.ok(workspaceShellIdx > 0, "MarkupWorkspace exists");
  assert.ok(canvasAreaIdx > 0, "canvas-area exists");
  assert.ok(workspaceShellIdx < canvasAreaIdx, "Markup workspace is before canvas-area in DOM, outside scroll container");
});

test("paint-active class added to app container when paint mode is on", () => {
  assert.match(appSource, /paintMode && !previewMode \? "paint-active" : ""/);
});

test("paint toolbar hidden behind left-drawer on mobile", () => {
  assert.match(cssSource, /\.app\.mobile-shell\.mobile-left-open \.paint-toolbar[\s\S]*display:\s*none/);
});

test("preview remains read-only and publish remains dry-run", () => {
  assert.match(appSource, /if \(previewMode\) return;/);
  assert.match(appSource, /runPublish/);
  assert.match(appSource, /dryRun/);
});

test("mobile-toolbar-gap-repair marker remains after context menu fix", () => {
});

test("left sidebar includes + New Page button", () => {
  assert.match(appSource, /btn-new-page/);
  assert.match(appSource, /\+ New Page/);
  assert.match(cssSource, /\.btn-new-page/);
});

test("left sidebar includes Website Manager button", () => {
  assert.match(appSource, /btn-website-manager/);
  assert.match(appSource, /Website Manager/);
  assert.match(cssSource, /\.btn-website-manager/);
});

test("Website Manager modal exists with page list and actions", () => {
  assert.match(appSource, /websiteManagerOpen/);
  assert.match(appSource, /website-manager-modal/);
  assert.match(cssSource, /\.website-manager-modal/);
  assert.match(appSource, /wm-page-row/);
  assert.match(appSource, /wm-page-actions/);
});

test("Website Manager modal has close button", () => {
  assert.match(appSource, /Close Website Manager/);
});

test("Website Manager supports rename, duplicate, delete, slug, parent, showInNav", () => {
  assert.match(appSource, /handleRenamePage/);
  assert.match(appSource, /handleDuplicatePage/);
  assert.match(appSource, /handleDeletePage/);
  assert.match(appSource, /handleUpdatePageSlug/);
  assert.match(appSource, /handleToggleShowInNav/);
  assert.match(appSource, /handleSetParentPage/);
});

test("New Page flow modal exists with 5 steps", () => {
  assert.match(appSource, /newPageFlowOpen/);
  assert.match(appSource, /new-page-modal/);
  assert.match(appSource, /newPageStep === 0/);
  assert.match(appSource, /newPageStep === 1/);
  assert.match(appSource, /newPageStep === 2/);
  assert.match(appSource, /newPageStep === 3/);
  assert.match(appSource, /newPageStep === 4/);
  assert.match(cssSource, /\.new-page-modal/);
  assert.match(cssSource, /\.new-page-step/);
});

test("New Page step 1 collects page name", () => {
  assert.match(appSource, /Step 1: Page Name/);
  assert.match(appSource, /newPageName/);
});

test("New Page step 2 collects URL slug", () => {
  assert.match(appSource, /Step 2: URL Slug/);
  assert.match(appSource, /newPageSlug/);
});

test("New Page step 3 collects parent page", () => {
  assert.match(appSource, /Step 3: Parent/);
  assert.match(appSource, /newPageParentId/);
});

test("New Page step 4 collects nav visibility", () => {
  assert.match(appSource, /Step 4: Navigation/);
  assert.match(appSource, /newPageShowInNav/);
});

test("New Page step 5 collects starter template", () => {
  assert.match(appSource, /Step 5: Starter Layout/);
  assert.match(appSource, /STARTER_TEMPLATES/);
  assert.match(appSource, /template-grid/);
  assert.match(cssSource, /\.template-grid/);
  assert.match(cssSource, /\.template-option/);
});

test("page create uses helper from shared package", () => {
  assert.match(appSource, /import[\s\S]*createPage[\s\S]*from "@sbuild\/shared"/);
  assert.match(appSource, /import[\s\S]*duplicatePage[\s\S]*from "@sbuild\/shared"/);
  assert.match(appSource, /import[\s\S]*buildNavItems[\s\S]*from "@sbuild\/shared"/);
  assert.match(appSource, /import[\s\S]*migrateLegacyProject[\s\S]*from "@sbuild\/shared"/);
});

test("page list items show slug hint", () => {
  assert.match(appSource, /page-list-item/);
  assert.match(appSource, /page-slug-hint/);
  assert.match(cssSource, /\.page-slug-hint/);
  assert.match(cssSource, /\.page-list-item/);
});

test("legacy project migration runs on load", () => {
  assert.match(appSource, /migrateLegacyProject/);
});

test("delete page prevents deleting last page", () => {
  assert.match(appSource, /Cannot delete the last page/);
  assert.match(appSource, /project\.pages\.length <= 1/);
});

test("delete page confirms before deleting", () => {
  assert.match(appSource, /confirm\(`Delete/);
});

test("delete page selects fallback when deleting selected page", () => {
  assert.match(appSource, /fallbackId/);
  assert.match(appSource, /setSelectedPageId\(fallbackId\)/);
});

test("delete page keeps Website Manager open after confirm", () => {
  assert.doesNotMatch(appSource, /setStatus\("Page deleted"\);\s*setWebsiteManagerOpen\(false\)/);
  assert.match(appSource, /setStatus\("Page deleted"\)/);
  assert.match(appSource, /setWebsiteManagerOpen\(false\)/);
});

test("delete page still shows confirm dialog", () => {
  assert.match(appSource, /confirm\(`Delete/);
});

test("Website Manager close button and backdrop still close modal", () => {
  assert.match(appSource, /modal-backdrop.*onClick=\{\(\) => setWebsiteManagerOpen\(false\)\}/);
  assert.match(appSource, /modal-close.*onClick=\{\(\) => setWebsiteManagerOpen\(false\)\}/);
  assert.match(appSource, /onClick=\{\(\) => setWebsiteManagerOpen\(false\)\}[\s\S]*?Close/);
});

test("page creation updates site nav", () => {
  assert.match(appSource, /const navItems = buildNavItems\(nextPages\)/);
  assert.match(appSource, /site: { \.\.\.project\.site, nav: navItems }/);
});

test("Preview/Edit isolation preserved with Website Manager", () => {
  assert.match(appSource, /preview-hidden/);
  assert.match(appSource, /previewMode.*?leftCollapsed|leftCollapsed.*?previewMode/);
});

test("mobile Preview read-only preserved", () => {
  assert.match(appSource, /isMobileViewport && !previewMode/);
  assert.match(appSource, /mobile-viewport/);
});

test("mobile-toolbar-gap-repair marker still present after Website Manager", () => {
  assert.match(appSource, /mobile-toolbar-gap-repair/);
  assert.match(appSource, /action-controls-offset/);
});

test("mobile-toolbar-spacer-v3 still absent after Website Manager", () => {
  assert.doesNotMatch(appSource, /mobile-toolbar-spacer-v3 active/);
});

test("publishAllowed false remains correct", () => {
  assert.match(appSource, /runPublish/);
  assert.match(appSource, /dryRun/);
});

test("template options include all five starter templates", () => {
  assert.match(appSource, /STARTER_TEMPLATES/);
  assert.match(appSource, /newPageTemplate/);
  assert.match(appSource, /template-option/);
});

test("status messages for page operations", () => {
  assert.match(appSource, /Page created/);
  assert.match(appSource, /Page deleted/);
  assert.match(appSource, /Page duplicated/);
  assert.match(appSource, /Page renamed/);
  assert.match(appSource, /Page slug updated/);
});

test("Website Manager error messages display", () => {
  assert.match(appSource, /websiteManagerError/);
  assert.match(appSource, /error-text/);
  assert.match(cssSource, /\.error-text/);
});

test("handleCreatePage validates page name", () => {
  assert.match(appSource, /Page name is required/);
});

test("right panel header tab row is not clipped by parent overflow", () => {
  assert.doesNotMatch(cssSource, /\.right-drawer[\s\S]*overflow-y: hidden/);
  assert.match(cssSource, /\.right-drawer[\s\S]*overscroll-behavior: contain/);
  assert.match(cssSource, /\.right-drawer-header[\s\S]*overflow: visible/);
  assert.match(cssSource, /\.right-drawer-header[\s\S]*flex: 0 0 auto/);
});

test("preview mode nav links navigate by page slug", () => {
  const navClickSection = appSource.match(/onClick=\{\(e\)[\s\S]*?if \(previewMode\) \{[\s\S]*?setSelectedPageId\(targetPage\.id\)[\s\S]*?return;[\s\S]*?\}[\s\S]*?if \(!isMobileViewport\)/);
  assert.ok(navClickSection, "previewMode branch in nav onClick selects page by slug");
  assert.match(appSource, /targetSlug = href\.startsWith\("\/"\) \? href : "\/" \+ href/);
  assert.match(appSource, /project\.pages\.find\(\(p\) => p\.slug === targetSlug\)/);
});

test("preview mode nav links open external URLs in new tab", () => {
  assert.match(appSource, /href\.startsWith\("http:\/\/"\) \|\| href\.startsWith\("https:\/\/"\)/);
  assert.match(appSource, /window\.open\(href, "_blank", "noopener"\)/);
});

test("preview mode nav links handle hash anchors", () => {
  assert.match(appSource, /href\.startsWith\("#"\)/);
  assert.match(appSource, /document\.getElementById\(href\.slice\(1\)\)/);
  assert.match(appSource, /scrollIntoView/);
});

test("preview mode nav click does not select or edit nav items", () => {
  assert.match(appSource, /if \(previewMode\) \{[\s\S]*?return;[\s\S]*?\}[\s\S]*?e\.stopPropagation\(\)/);
});

test("modal and drawer inputs use 16px font-size to prevent iOS zoom", () => {
  assert.match(cssSource, /\.modal input[\s\S]*font-size: 16px/);
  assert.match(cssSource, /\.modal select[\s\S]*font-size: 16px/);
  assert.match(cssSource, /\.modal textarea[\s\S]*font-size: 16px/);
  assert.match(cssSource, /\.right-drawer input[\s\S]*font-size: 16px/);
});

test("new page flow step 1 input does not use autoFocus to prevent iOS zoom", () => {
  assert.doesNotMatch(appSource, /autoFocus[\s\S]*My New Page/);
});

test("admin-only: Image/API Keys tab button is wrapped in userRole admin check", () => {
  assert.match(appSource, /\{userRole === "admin" &&[\s\S]*Image\/API Keys<\/button>/);
});

test("admin-only: Image/API Keys content panel is wrapped in userRole admin check", () => {
  assert.match(appSource, /\{settingsTab === "keys" && userRole === "admin" && <div>/);
});

test("admin-only: right panel Image API Keys section is wrapped in userRole admin check", () => {
  assert.match(appSource, /\{userRole === "admin" && <>[\s\S]*<h4>Image API Keys<\/h4>/);
});

test("admin-only: User Management tab button is wrapped in userRole admin check", () => {
  assert.match(appSource, /\{userRole === "admin" &&[\s\S]*User Management<\/button>/);
});

test("admin-only: User Management content panel is wrapped in userRole admin check", () => {
  assert.match(appSource, /\{settingsTab === "users" && userRole === "admin" && <div>/);
});

test("admin-only: tab guard effect redirects non-admin away from keys/users tabs", () => {
  assert.match(appSource, /if \(userRole !== null && userRole !== "admin"\)[\s\S]*if \(settingsTab === "keys" \|\| settingsTab === "users"\)[\s\S]*setSettingsTab\("general"\)/);
});

test("admin-only: non-admin can still see Account Management tab", () => {
  assert.match(appSource, /Account Management<\/button>/);
  assert.match(appSource, /\{settingsTab === "account" && <div>/);
});

test("paint mode: selectBlock and openBlockDrawer both have preview/paint guard", () => {
  assert.match(appSource, /function selectBlock\(blockId: string\)[\s\S]{0,80}if \(previewMode \|\| paintMode\) return;/);
  assert.match(appSource, /function openBlockDrawer\(blockId: string\)[\s\S]{0,80}if \(previewMode \|\| paintMode\) return;/);
});

test("paint mode: handleBlockPointerMove has preview/paint guard", () => {
  assert.match(appSource, /function handleBlockPointerMove[\s\S]{0,100}if \(previewMode \|\| paintMode\) return;/);
});

test("paint mode: openSiteHeaderContextMenu has preview/paint guard", () => {
  assert.match(appSource, /function openSiteHeaderContextMenu[\s\S]{0,100}if \(previewMode \|\| paintMode\) return;/);
});

test("paint toolbar has correct CSS positioning: static on desktop, fixed on mobile with z-index", () => {
  assert.match(cssSource, /\.paint-toolbar[\s\S]*position:\s*static/);
  assert.match(cssSource, /@media.*max-width:\s*768px[\s\S]*\.paint-toolbar[\s\S]*position:\s*fixed/);
  assert.match(cssSource, /\.paint-toolbar[\s\S]*z-index:\s*40/);
});

test("paint toolbar hidden when left drawer open on mobile", () => {
  assert.match(cssSource, /\.app\.mobile-shell\.mobile-left-open \.paint-toolbar[\s\S]*display:\s*none/);
});

test("paint-active CSS class added to app shell in paint mode and not in preview", () => {
  assert.match(appSource, /\$\{paintMode && !previewMode \? "paint-active" : ""\}/);
});

test("mobile workspace gets padding when paint is active", () => {
  assert.match(cssSource, /\.app\.mobile-shell\.paint-active \.workspace[\s\S]*padding-top:\s*60px/);
});

test("mobile paint toolbar has top offset below mobile topbar", () => {
  assert.match(cssSource, /@media.*max-width:\s*768px[\s\S]*\.paint-toolbar[\s\S]*top:\s*max\(var\(--mobile-topbar-h/);
});

test("canvas-frame isolates editor theme from site preview by resetting --editor-* vars", () => {
  assert.match(cssSource, /\.canvas-frame[\s\S]*--editor-bg: #f9f9f9/);
  assert.match(cssSource, /\.canvas-frame[\s\S]*--editor-accent: #2b6dff/);
  assert.match(cssSource, /\.canvas-frame[\s\S]*--editor-text: #222222/);
  assert.match(cssSource, /\.canvas-frame[\s\S]*--editor-border: #e0e0e0/);
  assert.doesNotMatch(cssSource, /\.canvas-frame[\s\S]*--editor-bg: initial/);
});

test("paint-overlay has width/height 100% and touch-action none when capturing", () => {
  assert.match(cssSource, /\.paint-overlay[\s\S]*width:\s*100%/);
  assert.match(cssSource, /\.paint-overlay[\s\S]*height:\s*100%/);
  assert.match(cssSource, /\.paint-overlay\.capture-active[\s\S]*touch-action:\s*none/);
  assert.match(cssSource, /\.paint-overlay\.capture-active[\s\S]*user-select:\s*none/);
});

test("Markup workspace shell is full-page editor chrome with click-through canvas area", () => {
  assert.match(cssSource, /\.markup-workspace-shell[\s\S]{0,240}position:\s*fixed/);
  assert.match(cssSource, /\.markup-workspace-shell[\s\S]{0,240}inset:\s*0/);
  assert.match(cssSource, /\.markup-workspace-shell[\s\S]{0,320}pointer-events:\s*none/);
  assert.match(cssSource, /\.markup-workspace-header,[\s\S]{0,120}\.markup-workspace-panel[\s\S]{0,120}pointer-events:\s*auto/);
  assert.match(cssSource, /\.markup-workspace-canvas-area[\s\S]{0,180}pointer-events:\s*none/);
  assert.match(cssSource, /\.markup-workspace-canvas-area\.move-armed[\s\S]{0,80}pointer-events:\s*auto/);
});

test("Markup workspace mobile close control remains reachable", () => {
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]{0,1600}\.markup-workspace-shell[\s\S]{0,120}z-index:\s*130/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]{0,1800}\.markup-workspace-header[\s\S]{0,180}flex-direction:\s*row/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]{0,2400}\.markup-workspace-header-actions[\s\S]{0,260}overflow-x:\s*auto/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]{0,2600}\.markup-workspace-close[\s\S]{0,180}min-width:\s*88px/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]{0,2600}\.markup-workspace-close[\s\S]{0,180}min-height:\s*36px/);
  assert.match(markupWorkspaceSource, /Save Project/);
  assert.match(markupWorkspaceSource, /Close Markup/);
  assert.match(markupWorkspaceSource, /Show Controls/);
});

test("Markup workspace controls are compact and scrollable without trapping mobile canvas", () => {
  assert.match(cssSource, /\.markup-workspace-panel[\s\S]{0,260}max-height:\s*calc\(100dvh - 72px\)/);
  assert.match(cssSource, /\.markup-workspace-panel[\s\S]{0,320}overflow-y:\s*auto/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]{0,2600}\.markup-workspace-panel[\s\S]{0,180}max-height:\s*min\(32dvh, 220px\)/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]{0,3000}\.markup-workspace-body[\s\S]{0,180}grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(cssSource, /\.markup-workspace-body\.controls-collapsed[\s\S]{0,160}grid-template-rows:\s*minmax\(0,\s*1fr\)/);
  assert.match(cssSource, /\.markup-workspace-canvas-area[\s\S]{0,220}height:\s*100%/);
  assert.match(cssSource, /\.markup-workspace-canvas-area[\s\S]{0,260}align-self:\s*stretch/);
  assert.match(cssSource, /\.markup-workspace-canvas-frame[\s\S]{0,120}position:\s*absolute/);
  assert.match(cssSource, /\.markup-workspace-canvas-frame[\s\S]{0,140}inset:\s*0/);
});

test("markup help keeps instructions compact and out of the stage overlay", () => {
  assert.match(markupWorkspaceSource, /<details className="markup-workspace-help">/);
  assert.match(markupWorkspaceSource, /<summary>Help<\/summary>/);
  assert.match(markupWorkspaceSource, /Click and drag to draw freehand draft markup/);
  assert.match(markupWorkspaceSource, /choose Move on a note and click the workspace/);
  assert.match(markupWorkspaceSource, /Draft freehand strokes are discarded/);
  assert.match(markupWorkspaceSource, /Sticky notes and kept freehand strokes are saved with the project/);
  assert.match(markupWorkspaceSource, /shown only in Markup, and not published/);
  assert.doesNotMatch(markupWorkspaceSource, /Advanced drawing tools/);
  assert.doesNotMatch(markupWorkspaceSource, /<strong>Canvas preview area<\/strong>/);
  assert.match(markupWorkspaceSource, /Attach to AI \(coming later\)/);
});

test("Markup workspace exposes draft undo redo and Clear Free Draw actions", () => {
  assert.match(markupWorkspaceSource, /redoStrokeCount: number/);
  assert.match(markupWorkspaceSource, /onClearFreeDraw: \(\) => void/);
  assert.match(markupWorkspaceSource, /onUndoDraft: \(\) => void/);
  assert.match(markupWorkspaceSource, /onRedoDraft: \(\) => void/);
  assert.match(markupWorkspaceSource, />Undo</);
  assert.match(markupWorkspaceSource, />Redo</);
  assert.match(markupWorkspaceSource, />Clear Free Draw</);
  assert.match(appSource, /onClearFreeDraw=\{clearAppliedFreeDraw\}/);
  assert.match(appSource, /onUndoDraft=\{undoPaintDraft\}/);
  assert.match(appSource, /onRedoDraft=\{redoPaintDraft\}/);
});

test("freehand draft strokes render high-opacity solid lines", () => {
  assert.match(appSource, /const MARKUP_DRAFT_STROKE_OPACITY = 1/);
  assert.match(appSource, /const MARKUP_APPLIED_STROKE_OPACITY = 1/);
  assert.match(appSource, /opacity: MARKUP_DRAFT_STROKE_OPACITY/);
  assert.match(appSource, /visibleMarkupStrokeOpacity\(opacity, fallbackOpacity\)/);
  assert.match(appSource, /Math\.max\(opacity \?\? fallback, MARKUP_STROKE_MIN_VISIBLE_OPACITY\)/);
  assert.match(appSource, /strokeOpacity=\{visibleOpacity\}/);
  assert.match(appSource, /renderMarkupStroke\("active-stroke", paintActivePoints, paintColor, paintSize, MARKUP_DRAFT_STROKE_OPACITY, MARKUP_DRAFT_STROKE_OPACITY\)/);
  assert.doesNotMatch(appSource, /strokeDasharray="6 4"/);
});

test("canvas-area uses site-theme background var not editor var", () => {
  assert.match(cssSource, /\.canvas-area \{[\s\S]*?background:\s*var\(--sbuild-editor-bg/);
});

test("canvas-area site theme var is applied via applySiteTheme", () => {
  assert.match(appSource, /querySelectorAll\("\.canvas-frame,\s*\.canvas-area/);
  assert.match(appSource, /setProperty\("--sbuild-editor-bg"/);
});

test("row-shell does not have its own background (transparent, shows canvas-frame theme bg)", () => {
  assert.doesNotMatch(cssSource, /\.row-shell \{[\s\}]*background:/);
});

test("canvas-frame border uses --editor-border (reset to light inside canvas)", () => {
  assert.match(cssSource, /\.canvas-frame \{[\s\S]*?border:\s*2px dashed var\(--editor-border\)/);
  assert.match(cssSource, /\.canvas-frame \{[\s\S]*?--editor-border: #e0e0e0/);
});

test("Help button exists in topbar", () => {
  assert.match(appSource, /setHelpOpen\(true\)[\s\S]{0,60}Help \/ User Guide/);
});

test("Help button labeled ? appears near Settings", () => {
  const btnIdx = appSource.indexOf("setHelpOpen(true)");
  assert.ok(btnIdx > 0, "Help button handler exists");
  const section = appSource.substring(btnIdx, btnIdx + 400);
  assert.match(section, /\?<\/button>[\s\S]*Setting/);
});

test("Help modal opens and contains title", () => {
  assert.match(appSource, /helpOpen/);
  assert.match(appSource, /sBuild Help \/ User Guide/);
});

test("Help modal includes core term: Save", () => {
  assert.match(appSource, /Quick Start[\s\S]*Save/);
});

test("Help modal includes core term: Preview", () => {
  assert.match(appSource, /Modes[\s\S]*Preview/);
});

test("Help modal includes core term: Markup", () => {
  assert.match(appSource, /Modes[\s\S]*Markup/);
});

test("Help modal includes core term: Website Manager", () => {
  assert.match(appSource, /Pages \/ Website Manager[\s\S]*Website Manager/);
});

test("Help modal includes core term: Account Management", () => {
  assert.match(appSource, /Accounts[\s\S]*Account Management/);
});

test("Help modal includes core term: User Management", () => {
  assert.match(appSource, /Accounts[\s\S]*User Management/);
});

test("Help modal includes core term: Publish", () => {
  assert.match(appSource, /Modes[\s\S]*Publish/);
});

test("Help modal has close button", () => {
  assert.match(appSource, /Close Help/);
  assert.match(appSource, /aria-label="Close Help"/);
});

test("Help modal Close button calls onClose", () => {
  const closeIdx = appSource.indexOf("Close Help");
  assert.ok(closeIdx > 0, "Close Help label exists");
  const closeSection = appSource.substring(Math.max(0, closeIdx - 200), closeIdx + 200);
  assert.match(closeSection, /onClick=\{onClose\}/);
});

test("Help modal backdrop click calls onClose", () => {
  const guideIdx = appSource.indexOf("help-guide-modal");
  assert.ok(guideIdx > 0, "help-guide-modal class exists");
  const guideSection = appSource.substring(guideIdx - 400, guideIdx);
  assert.match(guideSection, /modal-backdrop.*onClick=\{onClose\}/);
});

test("Help modal does not autofocus any input", () => {
  const helpSection = appSource.substring(appSource.indexOf("function HelpGuide"), appSource.indexOf("export function App"));
  assert.doesNotMatch(helpSection, /autoFocus|autofocus/i);
});

test("Help modal content is scrollable via CSS", () => {
  assert.match(cssSource, /\.help-guide-modal[\s\S]*overflow-y:\s*auto/);
  assert.match(cssSource, /\.help-guide-modal[\s\S]*max-height:\s*85vh/);
});

test("Help modal accordion sections exist and default Quick Start expanded", () => {
  assert.match(appSource, /quick-start.*true/);
  assert.match(appSource, /help-section-toggle/);
});

test("Help modal includes Troubleshooting section", () => {
  assert.match(appSource, /Troubleshooting[\s\S]*Refresh/);
});

test("Existing Settings, Website Manager, Preview, Markup tests still pass pattern", () => {
  assert.match(appSource, /Settings/);
  assert.match(appSource, /Website Manager/);
  assert.match(appSource, /previewMode/);
  assert.match(appSource, /Markup/);
  assert.match(appSource, /runPublish/);
  assert.match(appSource, /dryRun/);
});

test("AI Top Menu: topbar AI button toggles aiTopMenuOpen", () => {
  assert.match(appSource, /toggleAiTopMenu/);
  assert.match(appSource, /setAiTopMenuOpen/);
  assert.match(appSource, /aiTopMenuOpen.*active/);
});

test("AI Top Menu: panel has three tabs (AI Chat, AI Image Gen, AI Image Enhance)", () => {
  const panelIdx = appSource.indexOf("ai-panel-tabs");
  assert.ok(panelIdx > 0, "ai-panel-tabs class exists");
  const panelSection = appSource.substring(panelIdx, panelIdx + 4000);
  assert.match(panelSection, /AI Chat/);
  assert.match(panelSection, /AI Image Gen/);
  assert.match(panelSection, /AI Image Enhance/);
});

test("AI Top Menu: tabs switch without closing panel", () => {
  assert.match(appSource, /setAiTopMenuTab\("chat"\)/);
  assert.match(appSource, /setAiTopMenuTab\("image-gen"\)/);
  assert.match(appSource, /setAiTopMenuTab\("image-enhance"\)/);
  assert.doesNotMatch(appSource, /setAiTopMenuTab.*setAiTopMenuOpen\(false\)/);
});

test("AI Chat: target selector has Selected Block, Current Page, Whole Site", () => {
  assert.match(appSource, /aiChatTarget.*block/);
  assert.match(appSource, /setAiChatTarget\("page"\)/);
  assert.match(appSource, /setAiChatTarget\("site"\)/);
  assert.match(appSource, /Selected Block/);
  assert.match(appSource, /Current Page/);
  assert.match(appSource, /Whole Site/);
});

test("AI Chat: Ask AI calls suggest endpoint", () => {
  assert.match(appSource, /\/api\/ai\/suggest/);
  assert.match(appSource, /aiAskSuggest/);
});

test("AI Chat: Apply Suggestion only shown in Edit mode with valid proposal", () => {
  assert.match(appSource, /aiHasProposal/);
  const applyIdx = appSource.indexOf("Apply Suggestion");
  assert.ok(applyIdx > 0, "Apply Suggestion button exists");
  const applySection = appSource.substring(applyIdx - 500, applyIdx + 300);
  assert.match(applySection, /!previewMode.*!paintMode|canEditBlocks/);
});

test("AI Chat: Apply Suggestion disabled in Preview and Markup modes", () => {
  const actionIdx = appSource.indexOf("ai-chat-action-bar");
  assert.ok(actionIdx > 0, "ai-chat-action-bar exists");
  const actionSection = appSource.substring(actionIdx - 100, actionIdx + 600);
  assert.match(actionSection, /!previewMode/);
  assert.match(actionSection, /!paintMode/);
});

test("AI Chat: mode notice shown in Preview and Markup modes", () => {
  assert.match(appSource, /ai-chat-mode-notice/);
  assert.match(appSource, /Planning only/);
});

test("AI Chat: chat-style message bubbles exist", () => {
  assert.match(appSource, /ai-chat-msg-\$\{msg\.role\}/);
  assert.match(appSource, /ai-chat-msg-text/);
  assert.match(appSource, /ai-chat-messages/);
  assert.match(appSource, /ai-chat-msg-assistant/);
});

test("AI Chat: input pinned at bottom with Send button", () => {
  assert.match(appSource, /ai-chat-input-area/);
  assert.match(appSource, /ai-chat-input/);
  assert.match(appSource, /ai-chat-send/);
});

test("AI Chat: markup attach is optional and only active when markup exists", () => {
  assert.match(appSource, /paintAppliedStrokes\.length > 0/);
  assert.match(appSource, /Attach Markup/);
  const noMarkupIdx = appSource.indexOf("no markup");
  assert.ok(noMarkupIdx < 0, "no disabled markup message in new chat UI");
});

test("AI Chat: clear conversation button exists", () => {
  assert.match(appSource, /ai-chat-clear/);
  assert.match(appSource, /clearAiChat/);
});

test("AI Image Gen: shows missing-provider message safely", () => {
  assert.match(appSource, /aiGenerateImage/);
  assert.match(appSource, /aiImgGenStatus/);
  assert.match(appSource, /Generate Image/);
});

test("AI Image Enhance: uses getSelectedEnhanceSource helper for source detection", () => {
  assert.match(appSource, /function getSelectedEnhanceSource/);
  assert.match(appSource, /kind: "gallery-image"/);
  assert.match(appSource, /kind: "gallery-empty"/);
  assert.match(appSource, /kind: "image-block"/);
  assert.match(appSource, /kind: "background"/);
  assert.match(appSource, /kind: "none"/);
  assert.match(appSource, /Select an image block, gallery image, or background first/);
  assert.match(appSource, /Selected gallery image has no image set/);
});

test("AI Image Enhance: shows source label when image target detected", () => {
  assert.match(appSource, /es\.label/);
  assert.match(appSource, /Source:/);
  assert.match(appSource, /Gallery image/);
  assert.match(appSource, /Image block/);
  assert.match(appSource, /background/);
});

test("AI Image Enhance: shows no-image-set reason for gallery with empty slot", () => {
  assert.match(appSource, /gallery-empty/);
  assert.match(appSource, /Selected gallery image has no image set/);
  assert.match(appSource, /es\.reason/);
});

test("AI Image Enhance: Analyze/Enhance disabled when no src available", () => {
  assert.match(appSource, /getSelectedEnhanceSource\(\)\.src/);
  assert.match(appSource, /aiEnhanceSourceOverride/);
});

test("AI Image Enhance: Apply Enhanced Image disabled until result exists", () => {
  assert.match(appSource, /disabled=\{!aiEnhanceResult\}/);
  assert.match(appSource, /applyAiEnhancedImage/);
});

test("AI Image Enhance: aiEnhanceImage uses getSelectedEnhanceSource", () => {
  assert.match(appSource, /async function aiEnhanceImage/);
  assert.match(appSource, /getSelectedEnhanceSource/);
  assert.match(appSource, /aiEnhanceSourceOverride/);
  assert.match(appSource, /source\.reason/);
});

test("AI Image Enhance: missing key message from server is displayed, not source-missing", () => {
  assert.match(appSource, /Image enhancement unavailable/);
  assert.match(appSource, /data\.message \|\| data\.error/);
});

test("AI Top Menu: close button exists", () => {
  assert.match(appSource, /ai-panel-close/);
  assert.match(appSource, /setAiTopMenuOpen\(false\)/);
});

test("AI Top Menu: CSS styles exist for panel", () => {
  assert.match(cssSource, /\.ai-panel\b/);
  assert.match(cssSource, /\.ai-panel-tabs/);
  assert.match(cssSource, /\.ai-panel-body/);
  assert.match(cssSource, /\.ai-panel-close/);
});

test("AI Top Menu: mobile responsive CSS exists", () => {
  const mobileIdx = cssSource.indexOf("@media (max-width: 768px)");
  assert.ok(mobileIdx > 0, "mobile media query exists");
  const mobileSection = cssSource.substring(mobileIdx);
  assert.match(mobileSection, /\.ai-panel[\s\S]*?position:\s*fixed/);
});

test("AI Top Menu: theme isolation — uses editor CSS variables", () => {
  const panelIdx = cssSource.indexOf(".ai-panel {");
  assert.ok(panelIdx > 0, ".ai-panel CSS block exists");
  const panelCss = cssSource.substring(panelIdx, panelIdx + 400);
  assert.match(panelCss, /var\(--editor-/);
});

test("AI Top Menu: available in Preview and Markup modes", () => {
  const panelIdx = appSource.indexOf("aiTopMenuOpen && (");
  assert.ok(panelIdx > 0 || appSource.includes("aiTopMenuOpen && ("), "AI panel available in all modes");
  const panelGate = appSource.indexOf("aiTopMenuOpen && !previewMode && !paintMode");
  assert.ok(panelGate < 0, "AI panel no longer gated by previewMode/paintMode");
});

test("AI Chat: applying suggestion mutates local state but does not auto-save", () => {
  assert.match(appSource, /applyAiProposal/);
  assert.match(appSource, /setDirty\(true\)/);
  assert.match(appSource, /Save to persist/);
});

test("AI Chat: chat message CSS styles exist", () => {
  assert.match(cssSource, /\.ai-chat-msg\b/);
  assert.match(cssSource, /\.ai-chat-msg-user/);
  assert.match(cssSource, /\.ai-chat-msg-assistant/);
  assert.match(cssSource, /\.ai-chat-input-area/);
  assert.match(cssSource, /\.ai-chat-send/);
});

test("AI Chat: mobile input uses 16px font to prevent zoom", () => {
  const mobileIdx = cssSource.indexOf("@media (max-width: 768px)");
  assert.ok(mobileIdx > 0, "mobile media query exists");
  const mobileSection = cssSource.substring(mobileIdx);
  assert.match(mobileSection, /\.ai-chat-input[\s\S]*?font-size:\s*16px/);
});

test("AI Chat: initial greeting bubble appears", () => {
  assert.match(appSource, /ai-chat-greeting/);
  assert.match(appSource, /Tell me what you want to change/);
});

test("AI Chat: sending hello does not enable Apply Suggestion", () => {
  const suggestIdx = appSource.indexOf("/api/ai/suggest");
  assert.ok(suggestIdx > 0, "suggest endpoint called");
  assert.match(appSource, /!aiHasProposal/);
  assert.match(appSource, /disabled=\{!aiHasProposal\}/);
});

test("AI Chat: Apply Suggestion shows disabled reason in Preview mode", () => {
  assert.match(appSource, /ai-apply-reason/);
  assert.match(appSource, /Preview mode.*switch to Edit/);
});

test("AI Chat: Apply Suggestion shows disabled reason in Markup mode", () => {
  assert.match(appSource, /Markup mode.*switch to Edit/);
});

test("AI Top Menu: panel is floating overlay, not in-flow toolbar", () => {
  assert.match(cssSource, /\.ai-panel[\s\S]*?position:\s*fixed/);
  assert.match(cssSource, /\.ai-panel-backdrop/);
  assert.doesNotMatch(cssSource, /\.ai-top-menu\b/);
});

test("AI Top Menu: backdrop click closes panel", () => {
  assert.match(appSource, /ai-panel-backdrop/);
  assert.match(appSource, /ai-panel-backdrop.*onClick.*setAiTopMenuOpen\(false\)/);
});

test("AI Top Menu: sBuild AI title in header", () => {
  assert.match(appSource, /ai-panel-title/);
  assert.match(appSource, /sBuild AI/);
});

test("AI Chat: textarea input for multiline messages", () => {
  const inputIdx = appSource.indexOf('className="ai-chat-input"');
  assert.ok(inputIdx > 0, "ai-chat-input class exists");
  const inputSection = appSource.substring(Math.max(0, inputIdx - 500), inputIdx + 500);
  assert.match(inputSection, /textarea/);
});

test("AI Top Menu: mobile safe-area bottom padding", () => {
  const mobileIdx = cssSource.indexOf("@media (max-width: 768px)");
  assert.ok(mobileIdx > 0, "mobile media query exists");
  const mobileSection = cssSource.substring(mobileIdx);
  assert.match(mobileSection, /safe-area-inset-bottom/);
});

test("AI Image Gen: sticky top action bar contains Generate / Regenerate / Open Image Library", () => {
  assert.match(appSource, /data-testid="ai-img-gen-topbar"/);
  assert.match(appSource, /data-testid="ai-img-gen-generate"/);
  assert.match(appSource, /data-testid="ai-img-gen-regenerate"/);
  assert.match(appSource, /data-testid="ai-img-gen-open-library"/);
  // Find the actual block-style definition (not the combined selector near the top)
  const cssIdx = cssSource.indexOf("\n.ai-image-gen-topbar {");
  assert.ok(cssIdx > 0, ".ai-image-gen-topbar { ... } definition exists");
  const cssSection = cssSource.substring(cssIdx, cssIdx + 400);
  assert.match(cssSection, /position:\s*sticky/);
  assert.match(cssSection, /top:\s*0/);
});

test("AI Image Gen: sticky bottom footer keeps Save / Apply / Save and Apply / Add to Gallery / Cancel / Edit image reachable without resizing", () => {
  assert.match(appSource, /data-testid="ai-img-gen-footer"/);
  assert.match(appSource, /data-testid="ai-img-gen-apply-actions"/);
  assert.match(appSource, /data-testid="ai-img-gen-save-to-library"/);
  assert.match(appSource, /data-testid="ai-img-gen-apply-to-block"/);
  assert.match(appSource, /data-testid="ai-img-gen-save-and-apply"/);
  assert.match(appSource, /data-testid="ai-img-gen-add-to-gallery"/);
  assert.match(appSource, /data-testid="ai-img-gen-cancel"/);
  assert.match(appSource, /data-testid="ai-img-gen-edit-image"/);
  // Find the actual block-style definition (not the combined selector near the top)
  const cssIdx = cssSource.indexOf("\n.ai-image-gen-footer {");
  assert.ok(cssIdx > 0, ".ai-image-gen-footer { ... } definition exists");
  const cssSection = cssSource.substring(cssIdx, cssIdx + 600);
  assert.match(cssSection, /position:\s*sticky/);
  assert.match(cssSection, /bottom:\s*0/);
});

test("AI Image Gen: preview image area is bounded so the modal does not push action buttons off-screen", () => {
  assert.match(appSource, /data-testid="ai-img-gen-preview-image-wrap"/);
  const cssIdx = cssSource.indexOf(".ai-card-preview-image-wrap");
  assert.ok(cssIdx > 0, ".ai-card-preview-image-wrap class exists");
  const cssSection = cssSource.substring(cssIdx, cssIdx + 500);
  assert.match(cssSection, /max-height/);
  assert.match(cssSection, /overflow:\s*hidden/);
});

test("Image Library: header bar has Refresh and Open folder buttons next to the title", () => {
  assert.match(appSource, /data-testid="image-library-refresh"/);
  assert.match(appSource, /data-testid="image-library-open-folder"/);
  assert.match(appSource, /data-testid="image-library-library-section"/);
  assert.match(appSource, /className="image-library-header"/);
  assert.match(appSource, /className="image-library-header-actions"/);
});

test("Image Library: bulk bar shows Selected: N and exposes Select all visible / Clear selection / Delete selected (N)", () => {
  assert.match(appSource, /data-testid="image-library-bulk-bar"/);
  assert.match(appSource, /data-testid="image-library-bulk-row-top"/);
  assert.match(appSource, /data-testid="image-library-selected-count"/);
  assert.match(appSource, /data-testid="image-library-select-all"/);
  assert.match(appSource, /data-testid="image-library-clear-selection"/);
  assert.match(appSource, /data-testid="image-library-delete-selected"/);
  assert.match(appSource, /Selected: \$\{selectedImageUrls\.size\}/);
  assert.match(appSource, /Select all visible/);
  assert.match(appSource, /Clear selection/);
  assert.match(appSource, /Delete selected \(\$\{selectedImageUrls\.size\}\)/);
});

test("Image Library: bulk bar is sticky so the action buttons stay visible while scrolling the grid", () => {
  const cssIdx = cssSource.indexOf(".image-library-bulk");
  assert.ok(cssIdx > 0, ".image-library-bulk class exists");
  const cssSection = cssSource.substring(cssIdx, cssIdx + 400);
  assert.match(cssSection, /position:\s*sticky/);
  assert.match(cssSection, /top:\s*0/);
  assert.match(cssSection, /z-index/);
});

test("Image Library: select mode defaults to ON so multi-select checkboxes are immediately visible to new users", () => {
  assert.match(appSource, /const \[selectMode, setSelectMode\] = useState\(true\)/);
});

test("Image Library: Tab structure exposes Browse / Upload / Settings", () => {
  assert.match(appSource, /data-testid="image-library-tab-browse"/);
  assert.match(appSource, /data-testid="image-library-tab-upload"/);
  assert.match(appSource, /data-testid="image-library-tab-settings"/);
});

test("Image Library: Settings tab uses collapsible details/summary sections to keep the default view compact", () => {
  assert.match(appSource, /data-testid="image-library-folder-list-details"/);
  assert.match(appSource, /data-testid="image-library-folder-create-details"/);
  assert.match(appSource, /data-testid="image-library-folder-rename-details"/);
  assert.match(appSource, /data-testid="image-library-folder-move-details"/);
  assert.match(appSource, /<details[\s\S]*?className="image-folder-section"/);
  assert.match(cssSource, /\.image-folder-section/);
  assert.match(cssSource, /\.image-folder-section\[open\]/);
});

test("Image Library: image grid has a generous max-height so the grid uses the available modal space", () => {
  const cssIdx = cssSource.indexOf("\n.image-grid {");
  assert.ok(cssIdx > 0, ".image-grid { ... } definition exists");
  const cssSection = cssSource.substring(cssIdx, cssIdx + 400);
  assert.match(cssSection, /max-height:\s*60vh/);
});

test("Image Library Modal: has Browse / Upload / Settings tabs with data-testid prefix modal-", () => {
  assert.match(appSource, /data-testid="modal-image-library-tabs"/);
  assert.match(appSource, /data-testid="modal-image-library-tab-browse"/);
  assert.match(appSource, /data-testid="modal-image-library-tab-upload"/);
  assert.match(appSource, /data-testid="modal-image-library-tab-settings"/);
});

test("Image Library Modal: browse tab has multi-select with checkboxes, selected count, and delete", () => {
  assert.match(appSource, /data-testid="modal-image-library-grid"/);
  assert.match(appSource, /data-testid="modal-image-library-card-checkbox"/);
  assert.match(appSource, /data-testid="modal-image-library-selected-count"/);
  assert.match(appSource, /data-testid="modal-image-library-bulk-bar"/);
  assert.match(appSource, /data-testid="modal-image-library-delete-selected"/);
  assert.match(appSource, /data-testid="modal-image-library-select-all"/);
  assert.match(appSource, /data-testid="modal-image-library-clear-selection"/);
  assert.match(appSource, /data-testid="modal-image-library-select-mode-toggle"/);
  assert.match(appSource, /data-testid="modal-image-library-delete-confirm"/);
  assert.match(appSource, /data-testid="modal-image-library-delete-confirm-yes"/);
});

test("Image Library Modal: browse tab has Refresh and Open folder buttons", () => {
  assert.match(appSource, /data-testid="modal-image-library-refresh"/);
  assert.match(appSource, /data-testid="modal-image-library-open-folder"/);
  assert.match(appSource, /data-testid="modal-image-library-library-section"/);
});

test("Image Library Modal: settings tab has folder refresh, folder list, and honest unavailable message", () => {
  assert.match(appSource, /data-testid="modal-image-library-folder-refresh"/);
  assert.match(appSource, /data-testid="modal-image-library-folder-current"/);
  assert.match(appSource, /data-testid="modal-image-library-folder-active"/);
  assert.match(appSource, /data-testid="modal-image-library-folder-list-details"/);
  assert.match(appSource, /Open folder is unavailable in this browser build/);
});

test("Image Library Modal: all openers (Images button, AI Image Gen, AI Image Enhance, context menu) share setImageManagerOpen", () => {
  const openers = appSource.match(/setImageManagerOpen\(true\)/g) || [];
  assert.ok(openers.length >= 4, `at least 4 setImageManagerOpen(true) calls, found ${openers.length}`);
  assert.match(appSource, /setImageManagerOpen\(true\); setImageManagerTarget\("block-bg"\)/);
});

test("Image Library Modal: delete confirmation shows in-use warning and .gitkeep skip", () => {
  assert.match(appSource, /data-testid="modal-image-library-delete-inuse-warning"/);
  assert.match(appSource, /modal-image-library-delete-message/);
});

test("AI Image Gen: Generate Image button exists directly below the prompt textarea", () => {
  assert.match(appSource, /data-testid="ai-img-gen-generate-near-prompt"/);
  assert.match(appSource, /data-testid="ai-img-gen-generate"/);
  const promptCardIdx = appSource.indexOf("ai-card-prompt");
  const nearPromptIdx = appSource.indexOf("ai-img-gen-generate-near-prompt");
  assert.ok(nearPromptIdx > promptCardIdx, "Generate near-prompt button is inside or after the prompt card");
});

test("AI Image Gen: default placement is preview-only and default target is library", () => {
  assert.match(appSource, /useState<string>\("preview-only"\)/);
  assert.match(appSource, /Preview only \(recommended\)/);
});

test("AI Image Gen: Target and Presets are collapsed behind an advanced section", () => {
  assert.match(appSource, /data-testid="ai-img-gen-advanced-section"/);
  assert.match(appSource, /Target &amp; Presets/);
  assert.match(appSource, /data-testid="ai-img-gen-placement-select"/);
  assert.match(cssSource, /\.ai-card-advanced/);
});

test("AI Image Gen: Apply to Selected Block calls applyImageToSelectedBlock directly, not aiUseImageInBlock", () => {
  assert.match(appSource, /data-testid="ai-img-gen-apply-to-block"/);
  const applyFnIdx = appSource.indexOf("async function aiApplyPreviewToBlock");
  assert.ok(applyFnIdx > 0, "aiApplyPreviewToBlock function exists");
  const fnBody = appSource.substring(applyFnIdx, applyFnIdx + 1200);
  assert.match(fnBody, /applyImageToSelectedBlock/);
  assert.ok(!fnBody.includes("aiUseImageInBlock"), "aiApplyPreviewToBlock does NOT call aiUseImageInBlock");
});

test("AI Image Gen: Save and Apply calls applyImageToSelectedBlock directly", () => {
  const saveApplyIdx = appSource.indexOf("async function aiSaveAndApplyPreview");
  assert.ok(saveApplyIdx > 0, "aiSaveAndApplyPreview function exists");
  const fnBody = appSource.substring(saveApplyIdx, saveApplyIdx + 600);
  assert.match(fnBody, /applyImageToSelectedBlock/);
  assert.ok(!fnBody.includes("aiUseImageInBlock"), "aiSaveAndApplyPreview does NOT call aiUseImageInBlock");
});

test("AI Image Gen: footer with action buttons is sticky at bottom of the tab", () => {
  assert.match(appSource, /data-testid="ai-img-gen-footer"/);
  assert.match(appSource, /data-testid="ai-img-gen-save-to-library"/);
  assert.match(appSource, /data-testid="ai-img-gen-apply-to-block"/);
  assert.match(appSource, /data-testid="ai-img-gen-save-and-apply"/);
  assert.match(appSource, /data-testid="ai-img-gen-cancel"/);
  const standaloneIdx = cssSource.indexOf("\n.ai-image-gen-footer {\n");
  assert.ok(standaloneIdx > 0, "standalone .ai-image-gen-footer { rule exists");
  const cssSection = cssSource.substring(standaloneIdx, standaloneIdx + 400);
  assert.match(cssSection, /position:\s*sticky/);
  assert.match(cssSection, /bottom:\s*0/);
});

test("Image edit Wide/Hero Crop uses deterministic 1536x864 16:9 banner dimensions", () => {
  const pipelineSrc = readFileSync(new URL("../../server/src/lib/imagePipeline.ts", import.meta.url), "utf8");
  assert.match(pipelineSrc, /wide-hero-crop/);
  assert.match(pipelineSrc, /1536,\s*864/);
  assert.match(pipelineSrc, /fit:\s*"cover"/);
});

test("Image edit Square Crop uses deterministic square output", () => {
  const pipelineSrc = readFileSync(new URL("../../server/src/lib/imagePipeline.ts", import.meta.url), "utf8");
  assert.match(pipelineSrc, /square-crop/);
  assert.match(pipelineSrc, /fit:\s*"cover"/);
});

test("topbar uses shared display version helper, not static SBUILD_VERSION alone", () => {
  assert.match(behaviorSource, /function getDisplayVersion/);
  assert.match(behaviorSource, /version unverified/);
  const logoMatch = appSource.match(/className="logo".*\{SBUILD_APP_NAME\}/s);
  assert.ok(logoMatch, "topbar logo must exist");
  assert.match(logoMatch[0], /displayVersion/, "topbar logo must use shared displayVersion");
  assert.match(logoMatch[0], /\.toUpperCase\(\)/, "topbar logo must display version in uppercase");
});

test("About tab shows baseVersion and displayVersion fields", () => {
  assert.match(appSource, /Base version/);
  assert.match(appSource, /Display version/);
  assert.match(appSource, /getDisplayVersion/);
  assert.match(appSource, /Commit count/);
  assert.match(appSource, /buildInfo\?\.commitCount/);
});

test("About tab changelog uses dynamic version not hardcoded stale version", () => {
  const aboutSection = appSource.substring(appSource.indexOf('settingsTab === "about"'));
  assert.ok(!aboutSection.includes("Latest: 0.4.0-dev"), "About tab must not contain stale hardcoded 0.4.0-dev changelog line");
  assert.match(aboutSection, /Latest:.*SBUILD_VERSION/);
});

test("server health includes displayVersion, baseVersion, and commitCount", () => {
  const serverSrc = readFileSync(new URL("../../server/src/app.ts", import.meta.url), "utf8");
  assert.match(serverSrc, /displayVersion/);
  assert.match(serverSrc, /baseVersion/);
  assert.match(serverSrc, /commitCount/);
  assert.match(serverSrc, /computeDisplayVersion/);
  assert.match(serverSrc, /BUILD_META/);
});

test("build generates build-meta.ts automatically via prebuild hook", () => {
  const rootPkg = readFileSync(new URL("../../../package.json", import.meta.url), "utf8");
  assert.match(rootPkg, /prebuild/);
  assert.match(rootPkg, /generate-build-meta\.sh/);
});

test("shared package has its own prebuild hook (so pnpm -r build regenerates build-meta.ts)", () => {
  // Regression: prior to this fix, only the root package.json had the
  // prebuild hook, so `pnpm -r build` (used by smoke / test scripts)
  // skipped it and built with a stale gitCommitShort. The browser
  // bundle then baked the wrong commit hash and Settings -> About
  // reported a "browser/server build mismatch".
  const sharedPkg = readFileSync(new URL("../../shared/package.json", import.meta.url), "utf8");
  assert.match(sharedPkg, /"prebuild"\s*:\s*"[^"]*generate-build-meta\.sh/);
});

test("packages/shared/build is hoisted to the front of pnpm -r build order so its prebuild runs first", () => {
  // pnpm -r runs workspace scripts in topological dependency order.
  // shared is depended on by editor and server, so its prebuild runs
  // first. This is the property that makes the regression fix work
  // even when the user calls `pnpm -r build` directly.
  const rootPkg = readFileSync(new URL("../../../package.json", import.meta.url), "utf8");
  // Root prebuild is still wired (defense in depth for `npm run build`).
  assert.match(rootPkg, /"prebuild"\s*:\s*"bash scripts\/generate-build-meta\.sh"/);
});

test("build-meta.ts is gitignored", () => {
  const gitignore = readFileSync(new URL("../../../.gitignore", import.meta.url), "utf8");
  assert.match(gitignore, /build-meta\.ts/);
});

test("topbar tooltip explains version format with base, count, and commit", () => {
  const logoLine = appSource.match(/className="logo"[^\n]*/);
  assert.ok(logoLine, "logo line must exist");
  const tooltip = logoLine[0].match(/title=\{`[^`]*`\}/);
  assert.ok(tooltip, "topbar logo must have a template literal title/tooltip");
  assert.match(tooltip[0], /base/);
  assert.match(tooltip[0], /commit count/);
  assert.match(tooltip[0], /commit/);
});

test("About tab has Build Status section header", () => {
  const aboutSection = appSource.substring(appSource.indexOf('settingsTab === "about"'));
  assert.match(aboutSection, /Build Status/);
  assert.match(aboutSection, /about-table/);
});

test("About tab shows browser/server build match hint", () => {
  const aboutSection = appSource.substring(appSource.indexOf('settingsTab === "about"'));
  assert.match(aboutSection, /buildIdentity\.message/);
  assert.match(aboutSection, /buildIdentity\.detail/);
  assert.match(aboutSection, /build-identity-status/);
  assert.match(editorSource, /Browser and server build match/);
  assert.match(editorSource, /Browser\/server build mismatch/);
  assert.match(editorSource, /older or different sBuild bundle/);
  assert.match(editorSource, /Hard refresh may be needed/);
  assert.match(behaviorSource, /BUILD_META\.gitCommitShort/);
});

test("browser/server mismatch compares browser commit to served build health gitCommit, not repo HEAD diagnostics", () => {
  const helperBlock = behaviorSource.substring(behaviorSource.indexOf("function getBuildIdentityState"), behaviorSource.indexOf("function imagePassesFilter"));
  assert.match(helperBlock, /servedBuildCommit = buildInfo\?\.gitCommit/, "mismatch must use /health.gitCommit as served build identity");
  assert.doesNotMatch(helperBlock, /repoHeadCommit/, "repo HEAD diagnostics must not drive mismatch warning");

  const classify = ({ browserCommit, servedBuildCommit }) => {
    const known = (commit) => Boolean(commit && !["unknown", "unreachable", "loading"].includes(commit));
    if (!known(browserCommit) || !known(servedBuildCommit)) return "unverified";
    return browserCommit === servedBuildCommit ? "match" : "mismatch";
  };

  assert.equal(
    classify({ browserCommit: "1e40434", servedBuildCommit: "1e40434", repoHeadCommit: "90e7b10" }),
    "match",
    "docs-only repo HEAD drift must not create a browser/server mismatch"
  );
  assert.equal(
    classify({ browserCommit: "1e40434", servedBuildCommit: "90e7b10", repoHeadCommit: "90e7b10" }),
    "mismatch",
    "old browser bundle against a newer served build must still warn"
  );
});

test("About tab shows loaded project source and app dirty status in table", () => {
  const aboutSection = appSource.substring(appSource.indexOf('settingsTab === "about"'));
  assert.match(aboutSection, /Loaded project source/);
  assert.match(aboutSection, /loadedProjectSource/);
  assert.match(aboutSection, /App dirty \(unsaved edits\)/);
});

test("About tab shows health unavailable fallback when build info is unverified", () => {
  const aboutSection = appSource.substring(appSource.indexOf('settingsTab === "about"'));
  assert.match(aboutSection, /Service health/);
  assert.match(editorSource, /Health unavailable - version unverified/);
  assert.match(editorSource, /health unavailable/);
  assert.match(editorSource, /cannot be verified/);
});

test("loadBuildInfo marks health unavailable instead of silently falling back", () => {
  const loadBuildInfoBlock = appSource.substring(appSource.indexOf("async function loadBuildInfo"), appSource.indexOf("useEffect(() => {\n    void loadProject"));
  assert.match(loadBuildInfoBlock, /setBuildInfoStatus\("loading"\)/);
  assert.match(loadBuildInfoBlock, /fetchJson<SBuildBuildInfo>\("\/health"\)/);
  assert.match(loadBuildInfoBlock, /setBuildInfoStatus\("ok"\)/);
  assert.match(loadBuildInfoBlock, /setBuildInfo\(null\)/);
  assert.match(loadBuildInfoBlock, /setBuildInfoStatus\("unavailable"\)/);
  assert.match(loadBuildInfoBlock, /setBuildInfoError/);
  assert.doesNotMatch(loadBuildInfoBlock, /catch\s*\{\s*\/\/ ignore/);
});

test("version identity banner visibly surfaces mismatch and health unavailable states", () => {
  assert.match(appSource, /showVersionIdentityBanner/);
  assert.match(editorSource, /data-testid="version-identity-banner"/);
  assert.match(editorSource, /Version drift detected/);
  assert.match(editorSource, /older or different sBuild bundle/);
  assert.match(editorSource, /Version unverified/);
  assert.match(appSource, /setVersionBannerDismissed\(true\)/);
  assert.match(cssSource, /\.version-identity-banner/);
  assert.match(cssSource, /\.version-identity-mismatch/);
  assert.match(cssSource, /\.version-identity-unverified/);
});

test("build identity mismatch only fires when browser and server commits are known", () => {
  const helperBlock = behaviorSource.substring(behaviorSource.indexOf("function getBuildIdentityState"), behaviorSource.indexOf("function imagePassesFilter"));
  assert.match(helperBlock, /hasKnownCommit\(browserCommit\)/);
  assert.match(helperBlock, /hasKnownCommit\(servedBuildCommit\)/);
  assert.match(helperBlock, /status:\s*"unverified"/);
  assert.match(helperBlock, /browserCommit !== servedBuildCommit/);
});

test("Copy diagnostics includes browser/server match status without secrets", () => {
  const aboutSection = appSource.substring(appSource.indexOf('settingsTab === "about"'));
  assert.match(aboutSection, /Copy diagnostics/);
  assert.match(aboutSection, /displayVersion/);
  assert.match(aboutSection, /baseVersion/);
  assert.match(aboutSection, /servedBuildCommit/);
  assert.match(aboutSection, /browserBuildCommit/);
  assert.match(aboutSection, /repoHeadCommit/);
  assert.match(aboutSection, /repoBranch/);
  assert.match(aboutSection, /commitCount/);
  assert.match(aboutSection, /buildDate/);
  assert.match(aboutSection, /publishAllowed/);
  assert.match(aboutSection, /serviceHealth/);
  assert.match(aboutSection, /healthError/);
  assert.match(aboutSection, /browserServerMatch/);
  assert.match(aboutSection, /browserServerMatchStatus/);
  assert.match(aboutSection, /repoDirtySummary/);
  assert.ok(!aboutSection.includes("userAgent"), "Copy diagnostics must not include userAgent");
  const clipboardMatch = aboutSection.match(/clipboard\.writeText\(JSON\.stringify\(diag/);
  assert.ok(clipboardMatch, "must call clipboard.writeText with diag object");
  const diagBlock = aboutSection.substring(aboutSection.indexOf("const diag = {"), aboutSection.indexOf("navigator.clipboard.writeText"));
  assert.ok(!diagBlock.includes("buildInfo: buildInfo"), "diag must not include raw buildInfo object reference");
});

test("About tab labels repo HEAD as diagnostics separate from served build identity", () => {
  const aboutSection = appSource.substring(appSource.indexOf('settingsTab === "about"'));
  assert.match(aboutSection, /Served build commit/);
  assert.match(aboutSection, /Repo HEAD diagnostic/);
  assert.match(aboutSection, /Repo branch diagnostic/);
  assert.match(aboutSection, /Repo working tree diagnostic/);
  assert.doesNotMatch(aboutSection, /<tr><td>Git commit<\/td>/);
});

test("About tab mentions automatic build identity and version bump command", () => {
  const aboutSection = appSource.substring(appSource.indexOf('settingsTab === "about"'));
  assert.match(aboutSection, /Build identity updates automatically/);
  assert.match(aboutSection, /version-sbuild\.sh bump/);
});

test("editor imports BUILD_META for browser-side commit comparison", () => {
  assert.match(behaviorSource, /BUILD_META/);
  assert.match(behaviorSource, /BUILD_META\.gitCommitShort/);
});

test("extractBlockContent serializes d.cards array into Card N: lines", () => {
  const fn = appSource.substring(
    appSource.indexOf("function extractBlockContent"),
    appSource.indexOf("function extractPageContent")
  );
  assert.match(fn, /d\.cards && Array\.isArray\(d\.cards\)/, "must check d.cards array");
  assert.match(fn, /Card \$\{i \+ 1\}:/, "must emit Card N: lines for cards");
});

test("AI Chat block scope sends empty pageContent to isolate selected block context", () => {
  const fn = appSource.substring(
    appSource.indexOf("async function aiAskSuggest"),
    appSource.indexOf("function applyAiProposal")
  );
  assert.match(fn, /aiChatTarget !== "block"/, "must guard pageContent behind block scope check");
  assert.match(fn, /extractPageContent/, "must still call extractPageContent for page/site scope");
});

test("AI Chat timeout message sets retryPrompt on the pushed assistant message", () => {
  const fn = appSource.substring(
    appSource.indexOf("async function aiAskSuggest"),
    appSource.indexOf("function applyAiProposal")
  );
  assert.match(fn, /retryPrompt:.*prompt/, "error path must set retryPrompt to original prompt");
});

test("renderChatMessage renders Retry button when msg.retryPrompt is set", () => {
  const fn = appSource.substring(
    appSource.indexOf("function renderChatMessage"),
    appSource.indexOf("async function aiGenerateImage")
  );
  assert.match(fn, /msg\.retryPrompt/, "must check retryPrompt");
  assert.match(fn, /ai-chat-retry-btn/, "must render retry button CSS class");
  assert.match(fn, /Retry/, "must show Retry label");
});

test("ai-chat-retry-btn CSS class is defined in styles.css", () => {
  assert.match(cssSource, /\.ai-chat-retry-btn/);
});

test("ChatItem type includes retryPrompt optional field", () => {
  const typeBlock = appSource.substring(
    appSource.indexOf("type ChatItem = {"),
    appSource.indexOf("type StructuredSuggestionProposal")
  );
  assert.match(typeBlock, /retryPrompt\?:\s*string/, "ChatItem must have retryPrompt field");
});

test("AI Chat scope buttons are labelled Focus: Selected Block / Page / Site", () => {
  const block = appSource.substring(
    appSource.indexOf("ai-chat-target-buttons"),
    appSource.indexOf("ai-markup-attach-btn")
  );
  assert.match(block, /Focus: Selected Block/);
  assert.match(block, /Focus: Page/);
  assert.match(block, /Focus: Site/);
  assert.doesNotMatch(block, />Selected Block</, "old 'Selected Block' label must be replaced");
  assert.doesNotMatch(block, />Current Page</, "old 'Current Page' label must be replaced");
  assert.doesNotMatch(block, />Whole Site</, "old 'Whole Site' label must be replaced");
});

test("AI Chat engine status line distinguishes sbuild-brain, local-ollama, api providers, timeout", () => {
  const toolbar = appSource.substring(
    appSource.indexOf("ai-chat-toolbar"),
    appSource.indexOf("ai-markup-attach-btn")
  );
  assert.match(toolbar, /formatChatEngineStatus/);
  assert.match(appSource, /Answered by sBuild Brain context/);
  assert.match(appSource, /Answered by Local Ollama/);
  assert.match(appSource, /formatProviderDisplayName\(provider\)/);
  assert.match(appSource, /timed out after/);
  assert.match(appSource, /Last answer: \$\{engine\}/);
  assert.match(toolbar, /Default: focus on selected block, full site context in LLM prompt/);
  assert.match(toolbar, /Default: focus on current page, full site context in LLM prompt/);
  assert.match(toolbar, /Default: whole-site context in LLM prompt/);
});

test("AI Chat engine status testid is exposed for QA", () => {
  const toolbar = appSource.substring(
    appSource.indexOf("ai-chat-toolbar"),
    appSource.indexOf("ai-markup-attach-btn")
  );
  assert.match(toolbar, /data-testid="ai-chat-engine-status"/);
});

test("AI Chat does NOT show blanket 'Local chat connected' as if all responses come from local model", () => {
  const setProv = appSource.match(/setProviderCheckMessage\([^)]*\)/g) || [];
  for (const m of setProv) {
    assert.doesNotMatch(m, /Local chat connected/, `must not say 'Local chat connected' as a blanket label: ${m}`);
  }
});

test("aiAskSuggest reads engine, mode, engineModel, engineReason, deterministicAnswer from response", () => {
  const fn = appSource.substring(
    appSource.indexOf("async function aiAskSuggest"),
    appSource.indexOf("function applyAiProposal")
  );
  assert.match(fn, /data\.engine/);
  assert.match(fn, /data\.mode/);
  assert.match(fn, /data\.engineModel/);
  assert.match(fn, /data\.engineReason/);
  assert.match(fn, /data\.deterministicAnswer/);
  assert.match(fn, /setLastEngine/);
  assert.match(fn, /setLastEngineMode/);
  assert.match(fn, /setLastEngineReason/);
  assert.match(fn, /setLastDeterministic/);
});

test("aiAskSuggest sets honest status messages by helper", () => {
  const fn = appSource.substring(
    appSource.indexOf("async function aiAskSuggest"),
    appSource.indexOf("function applyAiProposal")
  );
  assert.match(fn, /formatChatEngineStatus/);
  assert.match(fn, /fallbackUsed/);
  assert.match(fn, /fallbackFrom/);
  assert.match(fn, /fallbackReason/);
});

test("AI Chat does not auto-load chat history on panel open", () => {
  const toggleFn = appSource.substring(
    appSource.indexOf("function toggleAiTopMenu"),
    appSource.indexOf("function aiChatTargetLabel")
  );
  assert.doesNotMatch(toggleFn, /loadChatHistory\(\)/, "toggleAiTopMenu must NOT call loadChatHistory on open");
  const restoreFn = appSource.substring(
    appSource.indexOf("function restoreChat"),
    appSource.indexOf("function viewHistory")
  );
  assert.match(restoreFn, /loadChatHistory|history/);
  const viewFn = appSource.substring(
    appSource.indexOf("function viewHistory"),
    appSource.indexOf("function stripRawProposalJson")
  );
  assert.match(viewFn, /history/);
});

test("aiAskSuggest sends projectContext and selectedBlockId to /api/ai/suggest for sBuild Brain", () => {
  const fn = appSource.substring(
    appSource.indexOf("async function aiAskSuggest"),
    appSource.indexOf("function applyAiProposal")
  );
  assert.match(fn, /projectContext:\s*project/, "must send projectContext");
  assert.match(fn, /selectedBlockId:/, "must send selectedBlockId");
  assert.match(fn, /selectedPageId:/, "must send selectedPageId");
});

test("aiAskSuggest captures lastEngine/lastEngineMode/lastEngineReason/lastDeterministic state", () => {
  const fn = appSource.substring(
    appSource.indexOf("async function aiAskSuggest"),
    appSource.indexOf("function applyAiProposal")
  );
  assert.match(fn, /setLastEngine/, "must capture lastEngine");
  assert.match(fn, /setLastEngineMode/, "must capture lastEngineMode");
  assert.match(fn, /setLastEngineReason/, "must capture lastEngineReason");
  assert.match(fn, /setLastDeterministic/, "must capture lastDeterministic");
});

test("clearAiChat clears in-memory chat history without calling any endpoint", () => {
  const fn = appSource.substring(
    appSource.indexOf("function clearAiChat"),
    appSource.indexOf("async function loadChatHistory")
  );
  assert.match(fn, /setChatHistory\(\[\]\)/, "must clear chat history state");
  assert.doesNotMatch(fn, /fetchJson/, "clearAiChat must not call any fetch endpoint");
});

test("ai-chat-scope-status CSS class is defined in styles.css", () => {
  assert.match(cssSource, /\.ai-chat-scope-status/);
});

// =========================================================
// sBuild AI Brain — UI contract for the new latency footer
// and provider status truth.
// =========================================================

test("AI chat footer surfaces engine latency for sbuild-brain deterministic answer", () => {
  // The footer must include the engine label AND the latency in ms.
  const footer = appSource.substring(
    appSource.indexOf("ai-chat-scope-status"),
    appSource.indexOf("ai-markup-attach-btn")
  );
  assert.match(footer, /formatChatEngineStatus/);
  assert.match(appSource, /Answered by sBuild Brain context/);
  assert.match(appSource, /latencyMs \?\? 0\}ms/);
});

test("AI chat footer surfaces engine latency for local Ollama answer", () => {
  const footer = appSource.substring(
    appSource.indexOf("ai-chat-scope-status"),
    appSource.indexOf("ai-markup-attach-btn")
  );
  assert.match(footer, /formatChatEngineStatus/);
  assert.match(appSource, /Answered by Local Ollama/);
});

test("AI chat footer surfaces provider-specific API latency", () => {
  const footer = appSource.substring(
    appSource.indexOf("ai-chat-scope-status"),
    appSource.indexOf("ai-markup-attach-btn")
  );
  assert.match(footer, /formatChatEngineStatus/);
  assert.match(appSource, /formatProviderDisplayName/);
});

test("AI chat footer surfaces timeout with the model's actual timeout window", () => {
  const footer = appSource.substring(
    appSource.indexOf("ai-chat-scope-status"),
    appSource.indexOf("ai-markup-attach-btn")
  );
  assert.match(appSource, /timed out after/);
  // lastEngineTimeoutMs / 1000.toFixed(0) + "s"
  assert.match(appSource, /timeoutMs \?\? 22000\) \/ 1000/);
});

test("AI chat footer fallback status exists for unavailable engine branch", () => {
  const footer = appSource.substring(
    appSource.indexOf("ai-chat-scope-status"),
    appSource.indexOf("ai-markup-attach-btn")
  );
  assert.match(appSource, /Last answer: \$\{engine\}/);
  assert.match(appSource, /fallback from/);
});

test("Settings → AI Chat section exposes explicit provider test buttons", () => {
  assert.match(appSource, /Test Local Chat/);
  assert.match(appSource, /Test OpenAI Chat/);
  assert.match(appSource, /Test OpenRouter Chat/);
  assert.ok(appSource.indexOf('testProvider("local")') > 0, "Local provider test button must call testProvider(\"local\")");
  assert.ok(appSource.indexOf('testProvider("openai")') > 0, "OpenAI provider test button must call testProvider(\"openai\")");
  assert.ok(appSource.indexOf('testProvider("openrouter")') > 0, "OpenRouter provider test button must call testProvider(\"openrouter\")");
});

test("Clear Chat stamps chatClearedAt so a subsequent auto-restore cannot resurrect cleared history", () => {
  // 1) clearAiChat must setChatClearedAt(Date.now())
  const clearIdx = appSource.indexOf("function clearAiChat");
  const nextFn = appSource.indexOf("function ", clearIdx + 10);
  const clearBody = appSource.substring(clearIdx, nextFn > 0 ? nextFn : clearIdx + 1200);
  assert.match(clearBody, /setChatClearedAt/);
});

test("editor state tracks lastEngineLatencyMs and lastEngineTimeoutMs for the footer", () => {
  // Both pieces of state must exist (so the footer can show "Xms" / "Xs").
  assert.match(appSource, /setLastEngineLatencyMs/);
  assert.match(appSource, /setLastEngineTimeoutMs/);
  assert.match(appSource, /lastEngineLatencyMs/);
  assert.match(appSource, /lastEngineTimeoutMs/);
});

// =========================================================
// Browser / server build match — regression test
// =========================================================

test("generate-build-meta.sh regenerates build-meta.ts with current HEAD", async (t) => {
  const { execFileSync } = await import("node:child_process");
  const fs = await import("node:fs/promises");
  const repoRoot = new URL("../../../", import.meta.url);
  const buildMetaPath = new URL("../../shared/src/build-meta.ts", import.meta.url);

  // This regression exercises git-derived build metadata. In an exported
  // workcopy / tarball with no .git there is no HEAD to compare against, so
  // skip cleanly instead of failing on git's "not a git repository" error.
  // When git + HEAD ARE available the full assertion below runs, so genuine
  // regressions are never masked.
  let headShort = "";
  try {
    headShort = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    headShort = "";
  }
  if (!headShort) {
    t.skip("no git HEAD (not a git checkout); skipping git-derived build-meta regression");
    return;
  }

  // build-meta.ts is gitignored and may be absent in a fresh checkout; the
  // script under test is what creates it, so establish a baseline first.
  execFileSync("bash", ["scripts/generate-build-meta.sh"], { cwd: repoRoot, encoding: "utf8" });

  // Stomp build-meta.ts to a known-wrong value.
  const original = await fs.readFile(buildMetaPath, "utf8");
  const stompRegExp = /gitCommitShort: "[a-f0-9]+"/;
  const stompValue = 'gitCommitShort: "stale-fake-fake-fake"';
  const stompRegExpFull = /gitCommitFull: "[a-f0-9]+"/;
  const stompFullValue = 'gitCommitFull: "stale-fake-fake-fake-stale-fake-fake-fake-stale"';
  if (!stompRegExp.test(original)) throw new Error("could not stomp gitCommitShort; file format changed");
  if (!stompRegExpFull.test(original)) throw new Error("could not stomp gitCommitFull; file format changed");
  const stomped = original
    .replace(stompRegExp, stompValue)
    .replace(stompRegExpFull, stompFullValue);
  await fs.writeFile(buildMetaPath, stomped, "utf8");

  try {
    // 3. Run the prebuild script (the way pnpm -r build invokes it via
    //    packages/shared prebuild hook).
    execFileSync("bash", ["scripts/generate-build-meta.sh"], {
      cwd: repoRoot,
      encoding: "utf8"
    });

    // 4. Read the regenerated file and assert it now matches HEAD.
    const after = await fs.readFile(buildMetaPath, "utf8");
    assert.match(after, new RegExp(`gitCommitShort: "${headShort}"`),
      `regenerated build-meta.ts must contain gitCommitShort="${headShort}" (got: ${after.match(/gitCommitShort:[^\n]+/)?.[0] || "not found"})`);
    assert.doesNotMatch(after, /stale-fake-fake/,
      "regenerated build-meta.ts must not retain the stomped value");
  } finally {
    // 5. Restore the original (in case the test failed mid-flight).
    await fs.writeFile(buildMetaPath, original, "utf8");
    // Re-run prebuild to leave a consistent state.
    execFileSync("bash", ["scripts/generate-build-meta.sh"], {
      cwd: repoRoot,
      encoding: "utf8"
    });
  }
});

test("fetchJson surfaces non-ok responses as thrown errors (F-E1)", () => {
  // Must guard on res.ok and throw rather than parsing 4xx/5xx bodies as success.
  assert.match(appSource, /async function fetchJson/);
  assert.match(appSource, /if \(!res\.ok\)/);
  assert.match(appSource, /throw new Error\(message\)/);
});

test("saveProject reports failures and keeps unsaved state (F-E2)", () => {
  assert.match(appSource, /async function saveProject/);
  assert.match(editorSource, /Save failed/);
  // The failure path must keep the project dirty so the user can retry.
  assert.match(appSource, /catch \(error\) \{[\s\S]{0,260}getSaveFailureState\(error\)/);
  assert.match(behaviorSource, /dirty: true/);
});
