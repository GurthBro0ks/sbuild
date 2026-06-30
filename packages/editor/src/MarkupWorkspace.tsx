import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { MarkupAnnotation } from "@sbuild/shared";
import {
  MARKUP_FULL_ALLOWED_REGION,
  clampMarkupCoordinate,
  clampMarkupPointToAllowedRegion,
  getMarkupAllowedRegionForStage,
  normalizeMarkupAllowedRegion,
  type MarkupAllowedRegion
} from "./markupAnnotations.js";

type MarkupWorkspaceProps = {
  pageTitle: string;
  blockLabel: string;
  blockId: string;
  deviceMode: string;
  annotations: MarkupAnnotation[];
  saveStatusText: string;
  draftStrokeCount: number;
  appliedStrokeCount: number;
  redoStrokeCount: number;
  activePointCount: number;
  paintTool: "brush" | "eraser";
  paintDrawMode: "free" | "line";
  paintColor: string;
  paintSize: number;
  onClose: () => void;
  onSelectTool: (tool: "brush" | "eraser") => void;
  onSelectDrawMode: (mode: "free" | "line") => void;
  onColorChange: (value: string) => void;
  onSizeChange: (value: number) => void;
  onClearDraft: () => void;
  onClearFreeDraw: () => void;
  onUndoDraft: () => void;
  onRedoDraft: () => void;
  onKeepMarkup: () => void;
  onSaveProject: () => void | Promise<void>;
  onCreateNote: () => void;
  onUpdateNoteText: (id: string, text: string) => void;
  onMoveNote: (id: string, x: number, y: number) => void;
  onDeleteNote: (id: string) => void;
  freehandLayer?: ReactNode;
  paintCaptureActive: boolean;
  controlsCollapsed: boolean;
  onToggleControls: () => void;
  stageRightInsetPx: number;
};

const MARKUP_NOTE_PIN_EDGE_INSET_PX = 17;
const MARKUP_NOTE_POPUP_MARGIN_PX = 8;
const MARKUP_NOTE_POPUP_GAP_PX = 20;
const MARKUP_NOTE_POPUP_WIDTH_PX = 280;
const MARKUP_NOTE_POPUP_HEIGHT_PX = 220;

function sameAllowedRegion(a: MarkupAllowedRegion, b: MarkupAllowedRegion) {
  return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
}

export function MarkupWorkspace({
  pageTitle,
  blockLabel,
  blockId,
  deviceMode,
  annotations,
  saveStatusText,
  draftStrokeCount,
  appliedStrokeCount,
  redoStrokeCount,
  activePointCount,
  paintTool,
  paintDrawMode,
  paintColor,
  paintSize,
  onClose,
  onSelectTool,
  onSelectDrawMode,
  onColorChange,
  onSizeChange,
  onClearDraft,
  onClearFreeDraw,
  onUndoDraft,
  onRedoDraft,
  onKeepMarkup,
  onSaveProject,
  onCreateNote,
  onUpdateNoteText,
  onMoveNote,
  onDeleteNote,
  freehandLayer,
  paintCaptureActive,
  controlsCollapsed,
  onToggleControls,
  stageRightInsetPx
}: MarkupWorkspaceProps) {
  const hasDraftMarkup = draftStrokeCount > 0 || activePointCount > 0;
  const paintPlaneRef = useRef<HTMLDivElement | null>(null);
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [armedMoveNoteId, setArmedMoveNoteId] = useState<string | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const previousAnnotationIdsRef = useRef<string[]>(annotations.map((annotation) => annotation.id));
  const [allowedRegion, setAllowedRegion] = useState<MarkupAllowedRegion>(MARKUP_FULL_ALLOWED_REGION);

  function getPinAllowedRegion(region = allowedRegion) {
    const rect = paintPlaneRef.current?.getBoundingClientRect();
    const next = normalizeMarkupAllowedRegion(region);
    if (!rect || rect.width <= 0 || rect.height <= 0) return next;
    const insetX = Math.min(MARKUP_NOTE_PIN_EDGE_INSET_PX / rect.width, Math.max(0, (next.right - next.left) / 2));
    const insetY = Math.min(MARKUP_NOTE_PIN_EDGE_INSET_PX / rect.height, Math.max(0, (next.bottom - next.top) / 2));
    return normalizeMarkupAllowedRegion({
      left: next.left + insetX,
      top: next.top + insetY,
      right: next.right - insetX,
      bottom: next.bottom - insetY
    });
  }

  useEffect(() => {
    function measureAllowedRegion() {
      const next = getMarkupAllowedRegionForStage(paintPlaneRef.current);
      setAllowedRegion((current) => sameAllowedRegion(current, next) ? current : next);
    }

    measureAllowedRegion();
    const stage = paintPlaneRef.current;
    const canvas = typeof document !== "undefined" ? document.querySelector(".canvas-frame.sbuild-site-preview") : null;
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureAllowedRegion) : null;
    if (resizeObserver) {
      if (stage) resizeObserver.observe(stage);
      if (canvas) resizeObserver.observe(canvas);
    }
    window.addEventListener("resize", measureAllowedRegion);
    window.addEventListener("scroll", measureAllowedRegion, true);
    const raf = window.requestAnimationFrame(measureAllowedRegion);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", measureAllowedRegion);
      window.removeEventListener("scroll", measureAllowedRegion, true);
      resizeObserver?.disconnect();
    };
  }, [stageRightInsetPx]);

  useEffect(() => {
    const previousIds = previousAnnotationIdsRef.current;
    const currentIds = annotations.map((annotation) => annotation.id);
    const addedAnnotation = annotations.find((annotation) => !previousIds.includes(annotation.id));
    previousAnnotationIdsRef.current = currentIds;
    if (addedAnnotation) {
      setOpenNoteId(addedAnnotation.id);
      return;
    }
    setOpenNoteId((currentId) => currentId && currentIds.includes(currentId) ? currentId : null);
  }, [annotations]);

  function moveNoteFromPointer(id: string, event: PointerEvent<HTMLElement>) {
    const rect = paintPlaneRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const nextAllowedRegion = getMarkupAllowedRegionForStage(paintPlaneRef.current);
    const point = clampMarkupPointToAllowedRegion(
      {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height
      },
      getPinAllowedRegion(nextAllowedRegion)
    );
    onMoveNote(
      id,
      clampMarkupCoordinate(point.x),
      clampMarkupCoordinate(point.y)
    );
  }

  function shouldStartNoteDrag(event: PointerEvent<HTMLElement>) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const blockedControl = target?.closest("textarea, button, input, select, a, label");
    return !blockedControl || blockedControl === event.currentTarget;
  }

  function startNoteDrag(id: string, event: PointerEvent<HTMLElement>) {
    if (!shouldStartNoteDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setArmedMoveNoteId(null);
    setOpenNoteId(id);
    setDraggingNoteId(id);
    moveNoteFromPointer(id, event);
  }

  function dragNote(id: string, event: PointerEvent<HTMLElement>) {
    if (draggingNoteId !== id) return;
    event.preventDefault();
    moveNoteFromPointer(id, event);
  }

  function endNoteDrag(event: PointerEvent<HTMLElement>) {
    if (draggingNoteId) {
      moveNoteFromPointer(draggingNoteId, event);
    }
    setDraggingNoteId(null);
  }

  function armNoteMove(id: string) {
    setDraggingNoteId(null);
    setOpenNoteId(id);
    setArmedMoveNoteId((currentId) => (currentId === id ? null : id));
  }

  function placeArmedNote(event: PointerEvent<HTMLDivElement>) {
    if (!armedMoveNoteId) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest(".markup-note-pin")) return;
    if (target?.closest(".markup-note-popup")) return;
    event.preventDefault();
    event.stopPropagation();
    moveNoteFromPointer(armedMoveNoteId, event);
    setArmedMoveNoteId(null);
  }

  function notePinStyle(annotation: MarkupAnnotation): CSSProperties {
    const pinPosition = clampMarkupPointToAllowedRegion(
      { x: annotation.x, y: annotation.y },
      getPinAllowedRegion()
    );
    return {
      left: `${pinPosition.x * 100}%`,
      top: `${pinPosition.y * 100}%`,
      backgroundColor: annotation.color || "#ffcf33"
    };
  }

  function openNotePopup(id: string) {
    setOpenNoteId(id);
    setArmedMoveNoteId(null);
  }

  function stopPopupPointer(event: PointerEvent<HTMLElement>) {
    event.stopPropagation();
  }

  function notePopupStyle(annotation: MarkupAnnotation): CSSProperties {
    const pinPosition = clampMarkupPointToAllowedRegion(
      { x: annotation.x, y: annotation.y },
      getPinAllowedRegion()
    );
    const rect = paintPlaneRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return {
        left: `${pinPosition.x * 100}%`,
        top: `${pinPosition.y * 100}%`
      };
    }

    const maxPopupWidth = Math.max(160, rect.width - MARKUP_NOTE_POPUP_MARGIN_PX * 2);
    const maxPopupHeight = Math.max(112, rect.height - MARKUP_NOTE_POPUP_MARGIN_PX * 2);
    const popupWidth = Math.min(MARKUP_NOTE_POPUP_WIDTH_PX, maxPopupWidth);
    const popupHeight = Math.min(MARKUP_NOTE_POPUP_HEIGHT_PX, maxPopupHeight);
    const anchorX = pinPosition.x * rect.width;
    const anchorY = pinPosition.y * rect.height;
    const preferredLeft = anchorX + MARKUP_NOTE_POPUP_GAP_PX + popupWidth + MARKUP_NOTE_POPUP_MARGIN_PX <= rect.width
      ? anchorX + MARKUP_NOTE_POPUP_GAP_PX
      : anchorX - popupWidth - MARKUP_NOTE_POPUP_GAP_PX;
    const left = Math.min(
      rect.width - popupWidth - MARKUP_NOTE_POPUP_MARGIN_PX,
      Math.max(MARKUP_NOTE_POPUP_MARGIN_PX, preferredLeft)
    );
    const top = Math.min(
      rect.height - popupHeight - MARKUP_NOTE_POPUP_MARGIN_PX,
      Math.max(MARKUP_NOTE_POPUP_MARGIN_PX, anchorY - popupHeight / 2)
    );

    return {
      left: `${Math.max(MARKUP_NOTE_POPUP_MARGIN_PX, left)}px`,
      top: `${Math.max(MARKUP_NOTE_POPUP_MARGIN_PX, top)}px`,
      ["--markup-note-popup-width" as string]: `${popupWidth}px`,
      ["--markup-note-popup-max-height" as string]: `${popupHeight}px`
    } as CSSProperties;
  }

  const allowedRegionStyle = {
    ["--markup-stage-right-inset" as string]: `${Math.max(0, stageRightInsetPx)}px`,
    ["--markup-allowed-inset-left" as string]: `${allowedRegion.left * 100}%`,
    ["--markup-allowed-inset-top" as string]: `${allowedRegion.top * 100}%`,
    ["--markup-allowed-inset-right" as string]: `${(1 - allowedRegion.right) * 100}%`,
    ["--markup-allowed-inset-bottom" as string]: `${(1 - allowedRegion.bottom) * 100}%`
  } as CSSProperties;

  return (
    <section
      className={`markup-workspace-shell ${controlsCollapsed ? "controls-collapsed" : ""}`}
      role="dialog"
      aria-labelledby="markup-workspace-title"
      data-testid="markup-workspace"
      style={allowedRegionStyle}
    >
      <header className="markup-workspace-header" data-no-draw="true" data-no-drag="true" onPointerDown={(event) => event.stopPropagation()}>
        <div className="markup-workspace-title-group">
          <h2 id="markup-workspace-title">Markup workspace</h2>
          <p>
            {pageTitle} / {blockLabel}
            {blockId ? ` / ${blockId.slice(0, 12)}` : ""}
          </p>
          <details className="markup-workspace-help">
            <summary>Help</summary>
            <p>Click and drag to draw freehand draft markup. Drag numbered note pins, or choose Move on a note and click the workspace. Draft freehand strokes are discarded when you close this workspace unless you keep them with the project draft. Sticky notes and kept freehand strokes are saved with the project, shown only in Markup, and not published.</p>
          </details>
        </div>
        <div className="markup-workspace-header-actions">
          <button
            type="button"
            className="markup-controls-toggle"
            data-testid="markup-controls-toggle"
            onClick={onToggleControls}
            aria-pressed={controlsCollapsed}
            aria-label={controlsCollapsed ? "Show Markup controls" : "Hide Markup controls"}
            title={controlsCollapsed ? "Show Markup controls" : "Hide Markup controls"}
          >
            {controlsCollapsed ? "Show Controls" : "Hide Controls"}
          </button>
          <button
            type="button"
            className="markup-workspace-save"
            data-testid="markup-save-project"
            onClick={() => void onSaveProject()}
          >
            Save Project
          </button>
          <button
            type="button"
            className="markup-workspace-close"
            data-testid="markup-workspace-close"
            onClick={onClose}
            aria-label="Close Markup workspace"
          >
            Close Markup
          </button>
        </div>
      </header>

      <div className={`markup-workspace-body ${controlsCollapsed ? "controls-collapsed" : ""}`}>
        <aside
          className={`markup-workspace-panel ${controlsCollapsed ? "controls-collapsed" : ""}`}
          aria-label="Markup tools and status"
          data-no-draw="true"
          data-no-drag="true"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="markup-workspace-context" data-testid="markup-workspace-context">
            <span>View: {deviceMode}</span>
            <span>Draft strokes: {draftStrokeCount}</span>
            <span>Saved free draw: {appliedStrokeCount}</span>
            <span>Notes: {annotations.length}</span>
            <span>Save: {saveStatusText}</span>
          </div>

          <div className="markup-workspace-toolbar" role="toolbar" aria-label="Markup tools">
            <button type="button" onClick={() => onSelectTool("brush")} className={paintTool === "brush" ? "active" : ""}>Brush</button>
            <button type="button" onClick={() => onSelectTool("eraser")} className={paintTool === "eraser" ? "active" : ""}>Eraser</button>
            <button type="button" onClick={() => onSelectDrawMode("free")} className={paintDrawMode === "free" ? "active" : ""}>Free Draw</button>
            <button type="button" onClick={() => onSelectDrawMode("line")} className={paintDrawMode === "line" ? "active" : ""}>Line</button>
            <label className="markup-workspace-color">
              Color
              <input aria-label="Markup color" type="color" value={paintColor} onChange={(e) => onColorChange(e.target.value)} />
            </label>
            <label className="markup-workspace-size">
              Size
              <input aria-label="Brush size" type="range" min={1} max={24} value={paintSize} onChange={(e) => onSizeChange(Number(e.target.value))} />
              <span>{paintSize}px</span>
            </label>
          </div>

          <div className="markup-workspace-actions">
            <button type="button" onClick={onClearDraft} disabled={!hasDraftMarkup}>Clear Draft</button>
            <button type="button" onClick={onUndoDraft} disabled={draftStrokeCount === 0}>Undo</button>
            <button type="button" onClick={onRedoDraft} disabled={redoStrokeCount === 0}>Redo</button>
            <button
              type="button"
              onClick={onKeepMarkup}
              disabled={draftStrokeCount === 0}
              aria-label="Keep draft markup in this Markup session"
            >
              Keep in Session
            </button>
            <button type="button" onClick={onClearFreeDraw} disabled={appliedStrokeCount === 0}>Clear Free Draw</button>
            <button type="button" disabled className="markup-workspace-ai-attach">Attach to AI (coming later)</button>
          </div>

          <section className="markup-workspace-notes" aria-label="Sticky note annotations">
            <div className="markup-workspace-notes-header">
              <h3>Sticky notes</h3>
              <button type="button" onClick={onCreateNote} data-testid="markup-add-note">Add Note</button>
            </div>
            {annotations.length === 0 ? (
              <p className="markup-workspace-note-empty">No saved notes on this page.</p>
            ) : (
              <div className="markup-workspace-note-list">
                {annotations.map((annotation, index) => (
                    <article
                      className={`markup-workspace-note-editor ${draggingNoteId === annotation.id ? "dragging" : ""}`}
                      data-testid="markup-note-editor"
                      data-markup-note-id={annotation.id}
                      key={annotation.id}
                    >
                    <div
                      className={`markup-workspace-note-handle ${armedMoveNoteId === annotation.id ? "move-armed" : ""}`}
                      data-testid="markup-note-drag-handle"
                      data-markup-note-id={annotation.id}
                    >
                      <span>Note {index + 1}</span>
                      <span className="markup-workspace-note-preview">{annotation.text || "Empty note"}</span>
                    </div>
                    <div className="markup-workspace-note-row-actions">
                      <button
                        type="button"
                        className="markup-workspace-note-open"
                        data-testid="markup-note-open"
                        data-markup-note-id={annotation.id}
                        aria-expanded={openNoteId === annotation.id}
                        onClick={() => openNotePopup(annotation.id)}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="markup-workspace-note-move"
                        data-testid="markup-note-move"
                        data-markup-note-id={annotation.id}
                        aria-pressed={armedMoveNoteId === annotation.id}
                        onClick={() => armNoteMove(annotation.id)}
                      >
                        Move
                      </button>
                      <button type="button" onClick={() => onDeleteNote(annotation.id)} data-testid="markup-delete-note">
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>

        <div
          className={`markup-workspace-canvas-area ${armedMoveNoteId ? "move-armed" : ""} ${paintCaptureActive ? "paint-armed" : ""}`}
          aria-label="Markup note stage"
          data-coordinate-plane="markup"
          data-testid="markup-note-stage"
          ref={paintPlaneRef}
          onPointerDown={placeArmedNote}
        >
          {freehandLayer}
          <div className="markup-note-pin-layer" aria-label="Saved Markup note pins">
            {annotations.map((annotation, index) => (
              <button
                type="button"
                key={annotation.id}
                className={`markup-note-pin ${draggingNoteId === annotation.id ? "dragging" : ""}`}
                data-testid="markup-note-pin"
                data-markup-note-id={annotation.id}
                aria-label={`Open Markup note ${index + 1}`}
                title={`Open note ${index + 1}`}
                style={notePinStyle(annotation)}
                onPointerDown={(event) => startNoteDrag(annotation.id, event)}
                onPointerMove={(event) => dragNote(annotation.id, event)}
                onPointerUp={endNoteDrag}
                onPointerCancel={endNoteDrag}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="markup-note-popup-layer" aria-label="Open Markup note popup">
            {annotations.map((annotation, index) => openNoteId === annotation.id ? (
              <article
                className="markup-note-popup"
                data-testid="markup-note-popup"
                data-markup-note-id={annotation.id}
                data-no-draw="true"
                data-no-drag="true"
                key={annotation.id}
                style={notePopupStyle(annotation)}
                onPointerDown={stopPopupPointer}
                onPointerMove={stopPopupPointer}
                onPointerUp={stopPopupPointer}
                onClick={(event) => event.stopPropagation()}
              >
                <header className="markup-note-popup-header">
                  <strong>Note {index + 1}</strong>
                  <button
                    type="button"
                    className="markup-note-popup-close"
                    data-testid="markup-note-popup-close"
                    aria-label={`Close Markup note ${index + 1}`}
                    onClick={() => setOpenNoteId(null)}
                  >
                    Close
                  </button>
                </header>
                <label className="markup-note-popup-field">
                  Text
                  <textarea
                    value={annotation.text}
                    onChange={(event) => onUpdateNoteText(annotation.id, event.target.value)}
                    data-testid="markup-note-text"
                    aria-label={`Markup note ${index + 1} text`}
                  />
                </label>
                <div className="markup-note-popup-actions">
                  <button type="button" onClick={() => onDeleteNote(annotation.id)} data-testid="markup-delete-note">
                    Delete
                  </button>
                </div>
              </article>
            ) : null)}
          </div>
          <div
            className={`markup-workspace-canvas-frame ${armedMoveNoteId ? "move-armed" : ""}`}
            aria-label="Canvas preview area"
            data-testid="markup-workspace-canvas-area"
          />
        </div>
      </div>
    </section>
  );
}
