import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, "../../../../");
const configuredDataRoot = process.env.SBUILD_DATA_ROOT?.trim();

export const dataRoot = configuredDataRoot ? path.resolve(configuredDataRoot) : path.join(repoRoot, "project");
export const projectDir = dataRoot;
export const projectFile = path.join(projectDir, "project.json");
export const projectImagesDir = path.join(projectDir, "images");
export const generatedImagesDir = path.join(projectImagesDir, "generated");
export const editedImagesDir = path.join(projectImagesDir, "edited");
export const templateProjectFile = path.join(repoRoot, "templates", "farm", "project.json");
export const distDir = path.join(repoRoot, "dist");
export const publishedPreviewDir = path.join(repoRoot, "published-preview");
export const backupsDir = path.join(projectDir, "backups");
export const editorDistDir = path.join(repoRoot, "packages", "editor", "dist");
export const secretsFile = path.join(repoRoot, ".sbuild-secrets.json");
export const dataDir = path.join(repoRoot, "data");
export const previewCacheDir = path.join(dataDir, "preview-cache");
export const previewCacheManifest = path.join(dataDir, "preview-cache.json");
