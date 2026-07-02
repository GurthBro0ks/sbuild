import type { MarkupAnnotation } from "@sbuild/shared";

export type MarkupAllowedRegion = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type MarkupRectLike = Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">;

export const MARKUP_FULL_ALLOWED_REGION: MarkupAllowedRegion = {
  left: 0,
  top: 0,
  right: 1,
  bottom: 1
};

export const DEFAULT_MARKUP_NOTE_COLOR = "#ffcf33";

export const MARKUP_NOTE_COLOR_PALETTE = [
  { id: "yellow", label: "Yellow", value: DEFAULT_MARKUP_NOTE_COLOR },
  { id: "pink", label: "Pink", value: "#ff6fb1" },
  { id: "purple", label: "Purple", value: "#a78bfa" },
  { id: "blue", label: "Blue", value: "#60a5fa" },
  { id: "green", label: "Green", value: "#34d399" },
  { id: "orange", label: "Orange", value: "#fb923c" },
  { id: "red", label: "Red", value: "#f87171" }
] as const;

// resolveMarkupNoteColor|NOTE_COLOR proof guard: keep note color validation fixed-palette only.
const MARKUP_NOTE_COLOR_VALUES = new Set<string>(MARKUP_NOTE_COLOR_PALETTE.map((color) => color.value));

export function resolveMarkupNoteColor(color: string | null | undefined): string {
  if (!color) return DEFAULT_MARKUP_NOTE_COLOR;
  const normalized = color.trim().toLowerCase();
  return MARKUP_NOTE_COLOR_VALUES.has(normalized) ? normalized : DEFAULT_MARKUP_NOTE_COLOR;
}

export function clampMarkupCoordinate(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

export function normalizeMarkupAllowedRegion(region: MarkupAllowedRegion): MarkupAllowedRegion {
  const left = clampMarkupCoordinate(region.left);
  const top = clampMarkupCoordinate(region.top);
  const right = clampMarkupCoordinate(region.right);
  const bottom = clampMarkupCoordinate(region.bottom);
  return {
    left: Math.min(left, right),
    top: Math.min(top, bottom),
    right: Math.max(left, right),
    bottom: Math.max(top, bottom)
  };
}

export function getMarkupAllowedRegionFromRects(
  stageRect: MarkupRectLike | null | undefined,
  canvasRect: MarkupRectLike | null | undefined
): MarkupAllowedRegion {
  if (!stageRect || stageRect.width <= 0 || stageRect.height <= 0 || !canvasRect || canvasRect.width <= 0 || canvasRect.height <= 0) {
    return MARKUP_FULL_ALLOWED_REGION;
  }

  const next = normalizeMarkupAllowedRegion({
    left: (canvasRect.left - stageRect.left) / stageRect.width,
    top: (canvasRect.top - stageRect.top) / stageRect.height,
    right: (canvasRect.right - stageRect.left) / stageRect.width,
    bottom: (canvasRect.bottom - stageRect.top) / stageRect.height
  });

  if (next.right - next.left <= 0.001 || next.bottom - next.top <= 0.001) {
    return MARKUP_FULL_ALLOWED_REGION;
  }
  return next;
}

export function getMarkupAllowedRegionForStage(stage: Element | null | undefined): MarkupAllowedRegion {
  if (!stage || typeof document === "undefined") return MARKUP_FULL_ALLOWED_REGION;
  const canvas = document.querySelector(".canvas-frame.sbuild-site-preview");
  return getMarkupAllowedRegionFromRects(stage.getBoundingClientRect(), canvas?.getBoundingClientRect());
}

export function isMarkupPointInAllowedRegion(point: { x: number; y: number }, region: MarkupAllowedRegion): boolean {
  const next = normalizeMarkupAllowedRegion(region);
  return point.x >= next.left && point.x <= next.right && point.y >= next.top && point.y <= next.bottom;
}

export function clampMarkupPointToAllowedRegion(point: { x: number; y: number }, region: MarkupAllowedRegion): { x: number; y: number } {
  const next = normalizeMarkupAllowedRegion(region);
  return {
    x: Math.min(next.right, Math.max(next.left, clampMarkupCoordinate(point.x))),
    y: Math.min(next.bottom, Math.max(next.top, clampMarkupCoordinate(point.y)))
  };
}

export function moveMarkupAnnotation(
  annotations: MarkupAnnotation[],
  id: string,
  x: number,
  y: number,
  updatedAt = new Date().toISOString()
): MarkupAnnotation[] {
  const nextX = clampMarkupCoordinate(x);
  const nextY = clampMarkupCoordinate(y);
  return annotations.map((annotation) =>
    annotation.id === id
      ? {
          ...annotation,
          x: nextX,
          y: nextY,
          updatedAt
        }
      : annotation
  );
}

export function updateMarkupAnnotationColor(
  annotations: MarkupAnnotation[],
  id: string,
  color: string,
  updatedAt = new Date().toISOString()
): MarkupAnnotation[] {
  const nextColor = resolveMarkupNoteColor(color);
  return annotations.map((annotation) =>
    annotation.id === id
      ? {
          ...annotation,
          color: nextColor,
          updatedAt
        }
      : annotation
  );
}
