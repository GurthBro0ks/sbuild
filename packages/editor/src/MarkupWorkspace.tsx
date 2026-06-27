import type { MarkupAnnotation } from "@sbuild/shared";

type MarkupWorkspaceProps = {
  pageTitle: string;
  blockLabel: string;
  blockId: string;
  deviceMode: string;
  annotations: MarkupAnnotation[];
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
  onCreateNote: () => void;
  onUpdateNoteText: (id: string, text: string) => void;
  onDeleteNote: (id: string) => void;
};

export function MarkupWorkspace({
  pageTitle,
  blockLabel,
  blockId,
  deviceMode,
  annotations,
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
  onCreateNote,
  onUpdateNoteText,
  onDeleteNote
}: MarkupWorkspaceProps) {
  const hasDraftMarkup = draftStrokeCount > 0 || activePointCount > 0;

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
        <button
          type="button"
          className="markup-workspace-close"
          data-testid="markup-workspace-close"
          onClick={onClose}
          aria-label="Close Markup workspace"
        >
          Close Markup
        </button>
      </header>

      <div className="markup-workspace-body">
        <aside className="markup-workspace-panel" aria-label="Markup tools and status">
          <div className="markup-workspace-context" data-testid="markup-workspace-context">
            <span>View: {deviceMode}</span>
            <span>Draft strokes: {draftStrokeCount}</span>
            <span>Kept strokes: {appliedStrokeCount}</span>
            <span>Notes: {annotations.length}</span>
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
                  <article className="markup-workspace-note-editor" data-testid="markup-note-editor" key={annotation.id}>
                    <label>
                      Note {index + 1}
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

        <div className="markup-workspace-canvas-area" aria-label="Canvas preview area" data-testid="markup-workspace-canvas-area">
          <div className="markup-workspace-canvas-frame">
            <div className="markup-note-pin-layer" aria-label="Saved Markup note pins">
              {annotations.map((annotation, index) => (
                <span
                  key={annotation.id}
                  className="markup-note-pin"
                  data-testid="markup-note-pin"
                  style={{ left: `${annotation.x * 100}%`, top: `${annotation.y * 100}%`, backgroundColor: annotation.color || "#ffcf33" }}
                >
                  {index + 1}
                </span>
              ))}
            </div>
            <strong>Canvas preview area</strong>
            <p>Click and drag to draw freehand draft markup. Freehand strokes are session-only and discarded when you close this workspace unless you keep them during this Markup session. Sticky notes are saved with the project, shown only in Markup, and not published. Advanced drawing tools and AI attach are not implemented in this slice.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
