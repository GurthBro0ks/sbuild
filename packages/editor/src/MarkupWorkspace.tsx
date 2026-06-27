type MarkupWorkspaceProps = {
  pageTitle: string;
  blockLabel: string;
  blockId: string;
  deviceMode: string;
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
};

export function MarkupWorkspace({
  pageTitle,
  blockLabel,
  blockId,
  deviceMode,
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
  onKeepMarkup
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
        </aside>

        <div className="markup-workspace-canvas-area" aria-label="Canvas preview area" data-testid="markup-workspace-canvas-area">
          <div className="markup-workspace-canvas-frame">
            <strong>Canvas preview area</strong>
            <p>Click and drag to draw. Markup is session-only, not published, and discarded when you close this workspace unless you keep it during this Markup session. Persistence, annotation schema, advanced drawing tools, and AI attach are not implemented in this slice.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
