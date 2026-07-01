import type { Block, MarkupAnnotation, MarkupFreehandStroke, SBuildPage } from "@sbuild/shared";

export const MAX_MARKUP_AI_NOTES = 20;
export const MAX_MARKUP_AI_NOTE_CHARS = 200;

export type MarkupAiContext = {
  kind: "sbuild-markup-context";
  page: {
    id: string;
    title: string;
    slug?: string;
  } | null;
  selectedBlock: {
    id: string;
    type: string;
    title?: string;
  } | null;
  viewportMode: string;
  notes: Array<{
    id: string;
    label: string;
    blockId?: string;
    snippet: string;
  }>;
  noteCountIncluded: number;
  noteCountTotal: number;
  freehand: {
    strokeCount: number;
    summary: string;
  };
  limits: {
    maxNotes: number;
    maxNoteChars: number;
    rawFreehandExcluded: true;
  };
};

export type BuildMarkupAiContextInput = {
  page?: Pick<SBuildPage, "id" | "title" | "slug"> | null;
  selectedBlock?: Block | null;
  viewportMode: string;
  notes?: MarkupAnnotation[];
  freehandStrokes?: MarkupFreehandStroke[];
};

function compactText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value: unknown, maxChars: number): string {
  return compactText(value).slice(0, maxChars);
}

function blockTitle(block: Block): string | undefined {
  const data = block.data as Record<string, unknown>;
  const value = data.heading || data.title || data.subheading || data.name || data.label || data.text;
  const title = truncateText(value, 80);
  return title || undefined;
}

export function buildMarkupAiContext(input: BuildMarkupAiContextInput): MarkupAiContext | null {
  const notes = (input.notes || [])
    .filter((note) => note.type === "note")
    .slice(0, MAX_MARKUP_AI_NOTES)
    .map((note, index) => ({
      id: note.id,
      label: `Note ${index + 1}`,
      blockId: note.blockId || undefined,
      snippet: truncateText(note.text, MAX_MARKUP_AI_NOTE_CHARS)
    }));
  const noteCountTotal = (input.notes || []).filter((note) => note.type === "note").length;
  const freehandStrokeCount = (input.freehandStrokes || []).length;
  const page = input.page
    ? {
        id: input.page.id,
        title: truncateText(input.page.title || input.page.slug || "Untitled page", 120),
        slug: input.page.slug || undefined
      }
    : null;
  const selectedBlock = input.selectedBlock
    ? {
        id: input.selectedBlock.id,
        type: input.selectedBlock.type,
        title: blockTitle(input.selectedBlock)
      }
    : null;

  if (!page && !selectedBlock && notes.length === 0 && freehandStrokeCount === 0) {
    return null;
  }

  return {
    kind: "sbuild-markup-context",
    page,
    selectedBlock,
    viewportMode: truncateText(input.viewportMode || "unknown", 40),
    notes,
    noteCountIncluded: notes.length,
    noteCountTotal,
    freehand: {
      strokeCount: freehandStrokeCount,
      summary: `${freehandStrokeCount} saved freehand stroke${freehandStrokeCount === 1 ? "" : "s"} on the current page. Raw stroke point arrays are excluded.`
    },
    limits: {
      maxNotes: MAX_MARKUP_AI_NOTES,
      maxNoteChars: MAX_MARKUP_AI_NOTE_CHARS,
      rawFreehandExcluded: true
    }
  };
}

export function formatMarkupAiContextPreview(context: MarkupAiContext): string {
  const page = context.page?.title || "No page";
  const block = context.selectedBlock
    ? `${context.selectedBlock.type}${context.selectedBlock.title ? `: ${context.selectedBlock.title}` : ""}`
    : "No selected block";
  const notes = context.noteCountTotal === context.noteCountIncluded
    ? `${context.noteCountIncluded} note${context.noteCountIncluded === 1 ? "" : "s"}`
    : `${context.noteCountIncluded}/${context.noteCountTotal} notes`;
  return `${page} | ${block} | ${context.viewportMode} | ${notes} | ${context.freehand.strokeCount} freehand stroke${context.freehand.strokeCount === 1 ? "" : "s"}`;
}
