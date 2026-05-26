import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

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
  assert.doesNotMatch(cssSource, /\.right-drawer-header\s*\{[^{}]*min-height:\s*0[^{}]*\}/);
  assert.match(cssSource, /\.right-drawer-header[\s\S]*overflow:\s*visible/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.right-drawer[\s\S]*overflow:\s*visible/);
  assert.match(cssSource, /\.right-drawer-header[\s\S]*padding-top:\s*6px/);
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

test("mobile editor shell uses <=768px stacked layout and non-overlapping drawers", () => {
  assert.match(appSource, /isMobileViewport/);
  assert.match(appSource, /mobile-shell/);
  assert.match(appSource, /rightDrawerMobileOpen/);
  assert.match(appSource, /mobile-open/);
  assert.match(appSource, /mobile-closed/);
  assert.match(appSource, /mobile-drawer-toolbar/);
  assert.match(appSource, /drawer-close-btn/);
  assert.match(cssSource, /@media \(max-width: 768px\)/);
  assert.match(cssSource, /\.workspace,\n\s*\.workspace\.left-collapsed[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(cssSource, /\.left-drawer[\s\S]*position:\s*fixed/);
  assert.match(cssSource, /\.left-drawer\.collapsed[\s\S]*display:\s*none/);
  assert.match(cssSource, /\.right-drawer[\s\S]*min-width:\s*0/);
  assert.match(cssSource, /\.right-drawer[\s\S]*position:\s*fixed/);
  assert.match(cssSource, /\.right-drawer\.mobile-closed[\s\S]*display:\s*none/);
  assert.match(cssSource, /\.right-drawer\.mobile-open[\s\S]*display:\s*flex/);
  assert.match(cssSource, /\.canvas-controls[\s\S]*position:\s*sticky/);
  assert.match(cssSource, /\.topbar-status[\s\S]*width:\s*100%/);
  assert.match(cssSource, /overflow-x:\s*hidden/);
  assert.match(appSource, /function openBlockDrawer/);
  assert.match(appSource, /setRightDrawerMobileOpen\(true\)/);
  assert.match(appSource, /function openGallerySlotDrawer/);
  assert.match(cssSource, /\.app\.mobile-shell \.right-drawer[\s\S]*position:\s*fixed/);
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

test("mobile site title single tap edits directly without opening drawer", () => {
  assert.match(appSource, /contentEditable=\{!previewMode\}[\s\S]*project\.site\.siteName/);
  assert.match(appSource, /if \(previewMode\) return;[\s\S]*setSelectedSitePart\("site-title"\)/);
  assert.doesNotMatch(appSource, /if \(isMobileViewport\)[\s\S]{0,120}setSelectedSitePart\("site-title"\)[\s\S]{0,60}Site title selected/);
});

test("mobile site title long press opens right drawer", () => {
  assert.match(appSource, /function startSiteHeaderLongPress/);
  assert.match(appSource, /siteHeaderLongPressRef\.current\.timer = setTimeout/);
  assert.match(appSource, /openSiteHeaderDrawer\("site-title"\)/);
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

test("mobile site header edit button opens drawer", () => {
  assert.match(appSource, /site-header-edit-btn/);
  assert.match(appSource, /openSiteHeaderDrawer\("site-title"\)/);
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

test("mobile drawer open state and classes exist for context menu path", () => {
  assert.match(appSource, /rightDrawerMobileOpen/);
  assert.match(appSource, /mobile-open/);
  assert.match(appSource, /mobile-closed/);
  assert.match(cssSource, /\.right-drawer\.mobile-open[\s\S]*display:\s*flex/);
  assert.match(cssSource, /\.right-drawer\.mobile-closed[\s\S]*display:\s*none/);
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

test("openAiDrawer falls back to first editable block when none selected", () => {
  assert.match(appSource, /editableBlocks\[\s*0\s*\]/);
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

test("openAiDrawer prefers lastFocusedTextBlockId over selectedBlockId", () => {
  assert.match(appSource, /function openAiDrawer[\s\S]*lastFocusedTextBlockId\.current \|\| selectedBlockId/);
  assert.match(appSource, /const freshId = lastFocusedTextBlockId\.current \|\| selectedBlockId/);
});

test("openAiDrawer syncs freshId into state when stale", () => {
  assert.match(appSource, /if \(freshId !== selectedBlockId\)/);
  assert.match(appSource, /setSelectedBlockId\(freshId\)/);
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
