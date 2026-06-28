import fs from "node:fs/promises";
import path from "node:path";
import { MarkupAnnotation, MarkupFreehandStroke, SBuildProject } from "@sbuild/shared";
import { projectDir, projectFile, projectImagesDir, templateProjectFile } from "./paths.js";

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function writeAtomic(target: string, content: string): Promise<void> {
  const tmp = `${target}.tmp-${Date.now()}`;
  await fs.writeFile(tmp, content, "utf8");
  await fs.rename(tmp, target);
}

export function validateProjectShape(project: unknown): project is SBuildProject {
  if (!project || typeof project !== "object") return false;
  const p = project as Partial<SBuildProject>;
  return (
    typeof p.version === "string" &&
    !!p.site &&
    !!p.globalStyles &&
    Array.isArray(p.pages) &&
    p.pages.length > 0
  );
}

function clampUnit(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function clampStrokeSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 4;
  return Math.min(48, Math.max(1, value));
}

export function normalizeMarkupAnnotations(value: unknown, timestamp = new Date().toISOString()): MarkupAnnotation[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((raw): MarkupAnnotation[] => {
    if (!raw || typeof raw !== "object") return [];
    const annotation = raw as Record<string, unknown>;
    if (annotation.type !== "note") return [];

    const id = optionalString(annotation.id);
    const pageId = optionalString(annotation.pageId);
    if (!id || !pageId) return [];

    return [
      {
        id,
        type: "note",
        pageId,
        blockId: optionalString(annotation.blockId),
        x: clampUnit(annotation.x, 0.5),
        y: clampUnit(annotation.y, 0.5),
        text: typeof annotation.text === "string" ? annotation.text.slice(0, 2000) : "",
        color: optionalString(annotation.color),
        createdAt: optionalString(annotation.createdAt) || timestamp,
        updatedAt: optionalString(annotation.updatedAt) || timestamp
      }
    ];
  });
}

export function normalizeFreehandStrokes(value: unknown, timestamp = new Date().toISOString()): MarkupFreehandStroke[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((raw): MarkupFreehandStroke[] => {
    if (!raw || typeof raw !== "object") return [];
    const stroke = raw as Record<string, unknown>;
    const id = optionalString(stroke.id);
    const pageId = optionalString(stroke.pageId);
    if (!id || !pageId || !Array.isArray(stroke.points)) return [];

    const points = stroke.points
      .slice(0, 2000)
      .flatMap((point): Array<{ x: number; y: number }> => {
        if (!point || typeof point !== "object") return [];
        const p = point as Record<string, unknown>;
        return [{ x: clampUnit(p.x, 0.5), y: clampUnit(p.y, 0.5) }];
      });
    if (points.length < 2) return [];

    const opacity = typeof stroke.opacity === "number" && Number.isFinite(stroke.opacity)
      ? clampUnit(stroke.opacity, 1)
      : undefined;

    return [
      {
        id,
        pageId,
        blockId: optionalString(stroke.blockId),
        points,
        color: optionalString(stroke.color) || "#2b6dff",
        size: clampStrokeSize(stroke.size),
        opacity,
        createdAt: optionalString(stroke.createdAt) || timestamp
      }
    ];
  });
}

export function normalizeProjectForStorage(project: SBuildProject): SBuildProject {
  return {
    ...project,
    markupAnnotations: normalizeMarkupAnnotations(project.markupAnnotations),
    markupFreehandStrokes: normalizeFreehandStrokes(project.markupFreehandStrokes)
  };
}

export async function ensureProjectInitialized(): Promise<void> {
  await ensureDir(projectDir);
  await ensureDir(projectImagesDir);

  if (!(await exists(projectFile))) {
    const template = await fs.readFile(templateProjectFile, "utf8");
    await writeAtomic(projectFile, template);
  }
}

export async function loadProject(): Promise<SBuildProject> {
  await ensureProjectInitialized();
  const raw = await fs.readFile(projectFile, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!validateProjectShape(parsed)) {
    throw new Error("project.json has invalid shape");
  }
  return normalizeProjectForStorage(parsed);
}

export async function saveProject(project: SBuildProject): Promise<void> {
  if (!validateProjectShape(project)) {
    throw new Error("Refusing to save invalid project shape");
  }
  const next = {
    ...normalizeProjectForStorage(project),
    updatedAt: new Date().toISOString()
  };
  await ensureDir(path.dirname(projectFile));
  await writeAtomic(projectFile, JSON.stringify(next, null, 2));
}
