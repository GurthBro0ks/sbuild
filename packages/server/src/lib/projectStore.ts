import fs from "node:fs/promises";
import path from "node:path";
import { SBuildProject } from "@sbuild/shared";
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
  return parsed;
}

export async function saveProject(project: SBuildProject): Promise<void> {
  if (!validateProjectShape(project)) {
    throw new Error("Refusing to save invalid project shape");
  }
  const next = {
    ...project,
    updatedAt: new Date().toISOString()
  };
  await ensureDir(path.dirname(projectFile));
  await writeAtomic(projectFile, JSON.stringify(next, null, 2));
}
