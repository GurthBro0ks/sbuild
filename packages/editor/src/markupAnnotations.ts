import type { MarkupAnnotation } from "@sbuild/shared";

export function clampMarkupCoordinate(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
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
