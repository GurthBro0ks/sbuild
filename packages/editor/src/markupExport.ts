import type { Block, MarkupAnnotation, MarkupFreehandStroke, SBuildBuildInfo, SBuildPage } from "@sbuild/shared";
import {
  buildMarkupAiContext,
  MAX_MARKUP_AI_NOTE_CHARS,
  MAX_MARKUP_AI_NOTES,
  type MarkupAiContext
} from "./markupAiContext.js";

export type MarkupExportFormat = "md" | "json";

export type MarkupExportSummary = Omit<MarkupAiContext, "kind" | "notes"> & {
  kind: "sbuild-markup-export";
  mode: "summary";
  exportedAt: string;
  build: {
    displayVersion?: string;
    gitCommit?: string;
    buildDate?: string;
  };
  notes: Array<MarkupAiContext["notes"][number] & {
    pin: {
      x: number;
      y: number;
    };
  }>;
};

export type BuildMarkupExportSummaryInput = {
  page?: Pick<SBuildPage, "id" | "title" | "slug"> | null;
  selectedBlock?: Block | null;
  viewportMode: string;
  notes?: MarkupAnnotation[];
  freehandStrokes?: MarkupFreehandStroke[];
  exportedAt: string;
  buildInfo?: Partial<Pick<SBuildBuildInfo, "displayVersion" | "gitCommit" | "buildDate">> | null;
};

function roundPinCoordinate(value: unknown): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.round(numeric * 100) / 100;
}

function safeFilenamePart(value: unknown): string {
  const compact = String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return compact || "home";
}

export function utcTimestampForFilename(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown-utc";
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function markupExportFilename(pageSlugOrId: string | undefined, exportedAt: string | Date, format: MarkupExportFormat): string {
  return `markup-export-${safeFilenamePart(pageSlugOrId)}-${utcTimestampForFilename(exportedAt)}.${format}`;
}

export function buildMarkupExportSummary(input: BuildMarkupExportSummaryInput): MarkupExportSummary | null {
  const context = buildMarkupAiContext({
    page: input.page || null,
    selectedBlock: input.selectedBlock || null,
    viewportMode: input.viewportMode,
    notes: input.notes,
    freehandStrokes: input.freehandStrokes
  });
  if (!context) return null;

  const notePins = (input.notes || [])
    .filter((note) => note.type === "note")
    .slice(0, MAX_MARKUP_AI_NOTES)
    .map((note) => ({
      x: roundPinCoordinate(note.x),
      y: roundPinCoordinate(note.y)
    }));

  return {
    ...context,
    kind: "sbuild-markup-export",
    mode: "summary",
    exportedAt: input.exportedAt,
    build: {
      displayVersion: input.buildInfo?.displayVersion || undefined,
      gitCommit: input.buildInfo?.gitCommit || undefined,
      buildDate: input.buildInfo?.buildDate || undefined
    },
    notes: context.notes.map((note, index) => ({
      ...note,
      pin: notePins[index] || { x: 0, y: 0 }
    }))
  };
}

export function formatMarkupExportJson(summary: MarkupExportSummary): string {
  return JSON.stringify(summary, null, 2);
}

export function formatMarkupExportMarkdown(summary: MarkupExportSummary): string {
  const lines = [
    "# Markup Export",
    "",
    "Private editor export. Not published.",
    "",
    "## Export",
    `- Exported at: ${summary.exportedAt}`,
    `- Mode: ${summary.mode}`,
    `- Version: ${summary.build.displayVersion || "unknown"}`,
    `- Commit: ${summary.build.gitCommit || "unknown"}`,
    "",
    "## Page",
    `- Title: ${summary.page?.title || "No page"}`,
    `- ID: ${summary.page?.id || "none"}`,
    `- Slug: ${summary.page?.slug || "none"}`,
    `- Viewport: ${summary.viewportMode}`,
    "",
    "## Selection",
    summary.selectedBlock
      ? `- Block: ${summary.selectedBlock.type}${summary.selectedBlock.title ? ` - ${summary.selectedBlock.title}` : ""} (${summary.selectedBlock.id})`
      : "- Block: none",
    "",
    "## Notes",
    `- Included: ${summary.noteCountIncluded}/${summary.noteCountTotal}`,
    `- Limit: ${MAX_MARKUP_AI_NOTES} notes, ${MAX_MARKUP_AI_NOTE_CHARS} chars each`
  ];

  if (summary.notes.length === 0) {
    lines.push("- None");
  } else {
    for (const note of summary.notes) {
      lines.push(`- ${note.label} (${note.pin.x}, ${note.pin.y}): ${note.snippet || "(empty)"}`);
    }
  }

  lines.push(
    "",
    "## Freehand",
    `- Stroke count: ${summary.freehand.strokeCount}`,
    `- Summary: ${summary.freehand.summary}`,
    "",
    "## Excluded",
    "- no raw stroke geometry",
    "- no complete project JSON",
    "- no screenshots/images or binary blobs"
  );

  return `${lines.join("\n")}\n`;
}

export function downloadMarkupExportFile(summary: MarkupExportSummary, format: MarkupExportFormat): void {
  const body = format === "json" ? formatMarkupExportJson(summary) : formatMarkupExportMarkdown(summary);
  const type = format === "json" ? "application/json" : "text/markdown";
  const filename = markupExportFilename(summary.page?.slug || summary.page?.id, summary.exportedAt, format);
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
