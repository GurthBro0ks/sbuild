import { useRef, useState, type PointerEvent } from "react";
import type { MarkupAnnotation } from "@sbuild/shared";
import { clampMarkupCoordinate } from "./markupAnnotations.js";

type MarkupWorkspaceProps = {
  pageTitle: string;
  blockLabel: string;
  blockId: string;
  deviceMode: string;
  annotations: MarkupAnnotation[];
  saveStatusText: string;
  draftStrokeCount: number;
  appliedStrokeCount: number;
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
  onKeepMarkup: () => void;
  onSaveProject: () => void | Promise<void>;
  onCreateNote: () => void;
  onUpdateNoteText: (id: string, text: string) => void;
  onMoveNote: (id: string, x: number, y: number) => void;
  onDeleteNote: (id: string) => void;
};

export function MarkupWorkspace({
  pageTitle,
  blockLabel,
  blockId,
  deviceMode,
  annotations,
  saveStatusText,
  draftStrokeCount,
  appliedStrokeCount,
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
  onKeepMarkup,
  onSaveProject,
  onCreateNote,
  onUpdateNoteText,
  onMoveNote,
  onDeleteNote
}: MarkupWorkspaceProps) {
  const hasDraftMarkup = draftStrokeCount > 0 || activePointCount > 0;
  const workspaceStageRef = useRef<HTMLDivElement | null>(null);
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [armedMoveNoteId, setArmedMoveNoteId] = useState<string | null>(null);

  function moveNoteFromPointer(id: string, event: PointerEvent<HTMLElement>) {
    const rect = workspaceStageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    onMoveNote(
      id,
      clampMarkupCoordinate((event.clientX - rect.left) / rect.width),
      clampMarkupCoordinate((event.clientY - rect.top) / rect.height)
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
    setArmedMoveNoteId((currentId) => (currentId === id ? null : id));
  }

  function placeArmedNote(event: PointerEvent<HTMLDivElement>) {
    if (!armedMoveNoteId) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest(".markup-note-pin")) return;
    event.preventDefault();
    event.stopPropagation();
    moveNoteFromPointer(armedMoveNoteId, event);
    setArmedMoveNoteId(null);
  }

  return (
    <section
      className="markup-workspace-shell"
      role="dialog"
      aria-labelledby="markup-workspace-title"
      data-testid="markup-workspace"
    >
      <header className="markup-workspace-header">
        <div className="markup-workspace-title-group">
          <h2 id="markup-workspace-title">Markup workspace</h2>
          <p>
            {pageTitle} / {blockLabel}
            {blockId ? ` / ${blockId.slice(0, 12)}` : ""}
          </p>
        </div>
        <div className="markup-workspace-header-actions">
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

      <div className="markup-workspace-body">
        <aside className="markup-workspace-panel" aria-label="Markup tools and status">
          <div className="markup-workspace-context" data-testid="markup-workspace-context">
            <span>View: {deviceMode}</span>
            <span>Draft strokes: {draftStrokeCount}</span>
            <span>Kept strokes: {appliedStrokeCount}</span>
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
            <button
              type="button"
              onClick={onKeepMarkup}
              disabled={draftStrokeCount === 0}
              aria-label="Keep draft markup in this Markup session"
            >
              Keep in Session
            </button>
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
                      onPointerDown={(event) => startNoteDrag(annotation.id, event)}
                      onPointerMove={(event) => dragNote(annotation.id, event)}
                      onPointerUp={endNoteDrag}
                      onPointerCancel={endNoteDrag}
                    >
                    <div
                      className={`markup-workspace-note-handle ${armedMoveNoteId === annotation.id ? "move-armed" : ""}`}
                      data-testid="markup-note-drag-handle"
                      data-markup-note-id={annotation.id}
                    >
                      <span>Note {index + 1}</span>
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
                    </div>
                    <label>
                      Text
                      <textarea
                        value={annotation.text}
                        onChange={(event) => onUpdateNoteText(annotation.id, event.target.value)}
                        data-testid="markup-note-text"
                        aria-label={`Markup note ${index + 1} text`}
                      />
                    </label>
                    <button type="button" onClick={() => onDeleteNote(annotation.id)} data-testid="markup-delete-note">
                      Delete
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>

        <div
          className={`markup-workspace-canvas-area ${armedMoveNoteId ? "move-armed" : ""}`}
          aria-label="Markup note stage"
          data-testid="markup-note-stage"
          ref={workspaceStageRef}
          onPointerDown={placeArmedNote}
        >
          <div className="markup-note-pin-layer" aria-label="Saved Markup note pins">
            {annotations.map((annotation, index) => (
              <button
                type="button"
                key={annotation.id}
                className={`markup-note-pin ${draggingNoteId === annotation.id ? "dragging" : ""}`}
                data-testid="markup-note-pin"
                data-markup-note-id={annotation.id}
                aria-label={`Move Markup note ${index + 1}`}
                title={`Move note ${index + 1}`}
                style={{ left: `${annotation.x * 100}%`, top: `${annotation.y * 100}%`, backgroundColor: annotation.color || "#ffcf33" }}
                onPointerDown={(event) => startNoteDrag(annotation.id, event)}
                onPointerMove={(event) => dragNote(annotation.id, event)}
                onPointerUp={endNoteDrag}
                onPointerCancel={endNoteDrag}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div
            className={`markup-workspace-canvas-frame ${armedMoveNoteId ? "move-armed" : ""}`}
            aria-label="Canvas preview area"
            data-testid="markup-workspace-canvas-area"
          >
            <strong>Canvas preview area</strong>
            <p>Click and drag to draw freehand draft markup. Drag numbered note pins or note cards, or choose Move on a note and click the workspace. Freehand strokes are session-only and discarded when you close this workspace unless you keep them during this Markup session. Sticky notes are saved with the project, shown only in Markup, and not published. Advanced drawing tools and AI attach are not implemented in this slice.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
