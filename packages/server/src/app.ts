import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import multer from "multer";
import {
  CropMode,
  ImageSizeDecision,
  ImageTargetContext,
  OpenAIImageSize,
  SBuildProject,
  decideImageSize,
  SBUILD_VERSION,
  SBUILD_APP_NAME,
  SBuildBuildInfo,
  computeDisplayVersion,
} from "@sbuild/shared";
import { BUILD_META } from "@sbuild/shared";
import { execSync } from "node:child_process";
import crypto from "node:crypto";

const DEFAULT_OLLAMA_ENDPOINT = "http://127.0.0.1:11434";
const DEFAULT_LOCAL_CHAT_MODEL = "qwen2.5:1.5b";
const OLD_DEFAULT_LOCAL_CHAT_MODEL = "qwen3:4b";
const DEFAULT_OPENAI_CHAT_MODEL = "gpt-4o-mini";
const DEFAULT_OPENROUTER_CHAT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_LOCAL_FALLBACK_TIMEOUT_SEC = 12;
const APP_SHELL_CACHE_CONTROL = "no-store";
const IMMUTABLE_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";

function setAppShellCacheHeaders(res: { setHeader(name: string, value: string): void }): void {
  res.setHeader("Cache-Control", APP_SHELL_CACHE_CONTROL);
}

function setImmutableAssetCacheHeaders(res: { setHeader(name: string, value: string): void }): void {
  res.setHeader("Cache-Control", IMMUTABLE_ASSET_CACHE_CONTROL);
}

function isLikelyMaskedOrTestKey(value: string): boolean {
  const v = String(value || "").trim();
  if (!v) return true;
  if (v === "****") return true;
  if (/\.{3,}/.test(v)) return true;
  if (/[\u2022\u2027\u00B7]{3,}/.test(v)) return true;
  if (/\*\*\*\*/.test(v)) return true;
  if (/^sk-(test|admin-test|demo|local|fake|mock|placeholder|example)/i.test(v)) return true;
  if (/^local-(chat|image|gen)-/i.test(v)) return true;
  if (/-status$/.test(v) || /-demo$/.test(v)) return true;
  if (/^sk-[A-Za-z0-9_-]{0,12}$/i.test(v) && !/^sk-(proj-|or-|sv-|[A-Za-z0-9_-]{20,})/i.test(v)) return true;
  return false;
}

function sanitizeApiKeyInput(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (isLikelyMaskedOrTestKey(raw)) return "";
  return raw;
}

type LocalModelInfo = {
  name: string;
  size?: number;
  modified?: string;
  parameterSize?: string;
};

function safeGitCommand(cmd: string, cwd?: string): string | null {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], cwd }).trim();
  } catch {
    return null;
  }
}

type GitDirtySummary = { modifiedTracked: number; untracked: number };

function computeDirtySummary(cwd: string): GitDirtySummary {
  const status = safeGitCommand("git status --porcelain", cwd) || "";
  const lines = status.split("\n").map((line) => line.trim()).filter(Boolean);
  let modifiedTracked = 0;
  let untracked = 0;
  for (const line of lines) {
    if (line.startsWith("??")) {
      untracked += 1;
      continue;
    }
    modifiedTracked += 1;
  }
  return { modifiedTracked, untracked };
}

function resolveBranch(cwd: string, commit: string): string {
  const direct = safeGitCommand("git branch --show-current", cwd);
  if (direct && direct !== "HEAD") return direct;
  const fallback = safeGitCommand("git rev-parse --abbrev-ref HEAD", cwd);
  if (fallback && fallback !== "HEAD") return fallback;
  if (commit !== "unknown") return `detached (${commit})`;
  return "unknown";
}

function getBuildInfo(): SBuildBuildInfo & { dirtySummary?: GitDirtySummary; repoDirtySummary?: GitDirtySummary } {
  const servedCommit = BUILD_META.gitCommitShort || "unknown";
  const servedCommitFull = BUILD_META.gitCommitFull || "unknown";
  const repoHeadCommit = safeGitCommand("git rev-parse --short HEAD", repoRoot) || "unknown";
  const repoHeadCommitFull = safeGitCommand("git rev-parse HEAD", repoRoot) || "unknown";
  const repoBranch = resolveBranch(repoRoot, repoHeadCommit);
  const repoDirtySummary = computeDirtySummary(repoRoot);
  const buildDate = BUILD_META.buildTimeUtc;
  const commitCount = BUILD_META.commitCount;
  const displayVersion = computeDisplayVersion(SBUILD_VERSION, servedCommit, commitCount);
  const repoDirty = repoDirtySummary.modifiedTracked > 0 || repoDirtySummary.untracked > 0;
  return {
    version: SBUILD_VERSION,
    appName: SBUILD_APP_NAME,
    baseVersion: SBUILD_VERSION,
    displayVersion,
    gitCommit: servedCommit,
    gitCommitFull: servedCommitFull,
    branch: BUILD_META.branch || "unknown",
    buildDate,
    commitCount,
    dirty: Boolean(BUILD_META.dirty),
    dirtySummary: repoDirtySummary,
    repoHeadCommit,
    repoHeadCommitFull,
    repoBranch,
    repoDirty,
    repoDirtySummary,
    publishAllowed: process.env.SBUILD_ALLOW_PUBLISH === "1",
  };
}
import { applyDeterministicPaintFix, wizardFallback } from "./lib/ai.js";
import { getMemoryForUser, appendMemoryForUser, clearMemoryForUser } from "./lib/aiMemory.js";
import { getChatHistory, appendChatHistory, clearChatHistory, replaceChatHistory, sanitizeChatText as sanitizeChatTextImported } from "./lib/chatHistoryStore.js";
import { buildBrainContext, formatBrainContextForPrompt, tryDeterministicFact, trySiteFact } from "./lib/sbuildBrain.js";
import type { PersistedChatItem } from "./lib/chatHistoryStore.js";
import {
  backupsDir,
  distDir,
  editedImagesDir,
  editorDistDir,
  generatedImagesDir,
  projectFile,
  projectImagesDir,
  publishedPreviewDir,
  previewCacheDir,
  previewCacheManifest,
  repoRoot,
  secretsFile
} from "./lib/paths.js";
import { getUserPreferences, normalizeBuilderTheme, setUserBuilderTheme } from "./lib/userPreferencesStore.js";

const imageFolderConfigFile = path.join(path.dirname(projectFile), "image-folder.json");

type PreviewManifestEntry = { filename: string; createdAt: string; prompt?: string };
type PreviewManifest = Record<string, PreviewManifestEntry>;

async function readPreviewManifest(): Promise<PreviewManifest> {
  try {
    const raw = await fs.readFile(previewCacheManifest, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as PreviewManifest;
  } catch {
    return {};
  }
}

async function writePreviewManifest(manifest: PreviewManifest): Promise<void> {
  await fs.mkdir(path.dirname(previewCacheManifest), { recursive: true });
  await fs.writeFile(previewCacheManifest, JSON.stringify(manifest, null, 2), "utf8");
}

async function registerPreviewEntry(id: string, entry: PreviewManifestEntry): Promise<void> {
  const manifest = await readPreviewManifest();
  manifest[id] = entry;
  const keys = Object.keys(manifest);
  if (keys.length > 200) {
    const oldest = keys.sort((a, b) => (manifest[a]?.createdAt || "").localeCompare(manifest[b]?.createdAt || ""))[0];
    if (oldest && oldest !== id) {
      try { await fs.unlink(path.join(previewCacheDir, manifest[oldest].filename)); } catch { /* ignore */ }
      delete manifest[oldest];
    }
  }
  await writePreviewManifest(manifest);
}

async function unregisterPreviewEntry(id: string): Promise<void> {
  const manifest = await readPreviewManifest();
  if (manifest[id]) {
    delete manifest[id];
    await writePreviewManifest(manifest);
  }
}

async function readImageFolderSetting(): Promise<string> {
  try {
    const raw = await fs.readFile(imageFolderConfigFile, "utf8");
    const parsed = JSON.parse(raw) as { folder?: string };
    const folder = String(parsed.folder || "").trim();
    return folder || "project/images";
  } catch {
    return "project/images";
  }
}

async function writeImageFolderSetting(folder: string): Promise<void> {
  await fs.mkdir(path.dirname(imageFolderConfigFile), { recursive: true });
  await fs.writeFile(imageFolderConfigFile, JSON.stringify({ folder }, null, 2), "utf8");
}

function validateImageFolderPath(input: string): { ok: true; normalized: string } | { ok: false; error: string } {
  const raw = String(input || "").trim();
  if (!raw) return { ok: false, error: "Folder path is required." };
  if (/[^\x20-\x7E]/.test(raw)) return { ok: false, error: "Folder path contains invalid control characters." };
  if (path.isAbsolute(raw) || raw.startsWith("/")) return { ok: false, error: "Folder path must be project-relative, not absolute." };
  if (raw.includes("\\")) return { ok: false, error: "Folder path must use forward slashes (/)." };

  const normalized = path.posix.normalize(raw);
  if (normalized === "." || normalized.startsWith("../") || normalized.includes("/../") || normalized === "..") {
    return { ok: false, error: "Folder path cannot traverse outside project/images." };
  }
  if (!normalized.startsWith("project/images")) {
    return { ok: false, error: "Folder path must start with project/images." };
  }
  if (normalized !== "project/images" && !normalized.startsWith("project/images/")) {
    return { ok: false, error: "Folder path must stay under project/images." };
  }

  return { ok: true, normalized };
}
import {
  applyLocalEditWithSharp,
  ensureImageSubdir,
  fetchUrlToBuffer,
  fitWithSharp,
  imagePipelineSourceMarker,
  loadSharp,
  projectImageUrlFromAbsolute,
  randomSuffix,
  resolveProjectImageAbsolutePath,
  safeFilenameStem,
  saveBufferAsPng
} from "./lib/imagePipeline.js";
import { loadProject, saveProject, validateProjectShape } from "./lib/projectStore.js";
import { generateSite } from "./generator/generateSite.js";

// Image uploads are capped at 8 MB each and restricted to image/* MIME types.
const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, projectImagesDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".bin";
      const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      cb(null, `${base}${ext}`);
    }
  }),
  limits: { fileSize: UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (/^image\//i.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image uploads are allowed"));
  }
});
const validProviderSizes: OpenAIImageSize[] = ["1024x1024", "1024x1536", "1536x1024"];
const localSharpEditTypes = new Set([
  "enhance",
  "black-white",
  "brighten",
  "darken",
  "sharpen",
  "color-pop",
  "soften-bg",
  "crop-fit",
  "square-crop",
  "wide-hero-crop"
]);

const curatedFonts = [
  { family: "Playfair Display" },
  { family: "Nunito Sans" },
  { family: "Poppins" },
  { family: "Lato" },
  { family: "Merriweather" },
  { family: "Bebas Neue" },
  { family: "Space Grotesk" },
  { family: "Libre Baskerville" }
];

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else {
      await fs.copyFile(s, d);
    }
  }
}

function parseTargetContext(input: unknown): ImageTargetContext {
  const source = (input || {}) as Record<string, unknown>;
  return {
    blockType: String(source.blockType || "unknown") as ImageTargetContext["blockType"],
    usage: String(source.usage || "custom") as ImageTargetContext["usage"],
    viewportHint: source.viewportHint ? String(source.viewportHint) as ImageTargetContext["viewportHint"] : undefined,
    aspectRatioHint: source.aspectRatioHint ? String(source.aspectRatioHint) : undefined,
    currentBlockId: source.currentBlockId ? String(source.currentBlockId) : undefined,
    currentImagePath: source.currentImagePath ? String(source.currentImagePath) : undefined,
    cropMode: source.cropMode ? String(source.cropMode) as CropMode : undefined
  };
}

function withExplicitSize(decision: ImageSizeDecision, explicitSize: unknown): ImageSizeDecision {
  const requested = String(explicitSize || "").trim();
  if (!requested || !validProviderSizes.includes(requested as OpenAIImageSize)) {
    return decision;
  }
  if (requested === decision.providerSize) {
    return decision;
  }
  return {
    ...decision,
    providerSize: requested as OpenAIImageSize,
    warnings: [...decision.warnings, `Explicit size override applied: ${requested}`],
    reason: `${decision.reason} Explicit size override requested.`
  };
}

function imageGenerationPrompt(input: {
  prompt: string;
  style?: string;
  tone?: string;
}): string {
  const extras: string[] = [];
  if (input.style?.trim()) extras.push(`Style: ${input.style.trim()}`);
  if (input.tone?.trim()) extras.push(`Tone: ${input.tone.trim()}`);
  return extras.length ? `${input.prompt}\n\n${extras.join("\n")}` : input.prompt;
}

export type ImageMeta = {
  name: string;
  url: string;
  folder: string;
  extension: string;
  contentType: string;
  isRenderableImage: boolean;
  size: number;
  modified: string;
  isEdited: boolean;
};

const renderableExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"]);

function inferContentType(ext: string): string {
  const lower = ext.toLowerCase();
  if (lower === ".png") return "image/png";
  if (lower === ".jpg" || lower === ".jpeg") return "image/jpeg";
  if (lower === ".webp") return "image/webp";
  if (lower === ".gif") return "image/gif";
  if (lower === ".svg") return "image/svg+xml";
  if (lower === ".avif") return "image/avif";
  return "application/octet-stream";
}

async function listImagesRecursive(baseDir: string, current = ""): Promise<ImageMeta[]> {
  const absolute = path.join(baseDir, current);
  const entries = await fs.readdir(absolute, { withFileTypes: true });
  const out: ImageMeta[] = [];
  for (const entry of entries) {
    const next = path.join(current, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listImagesRecursive(baseDir, next)));
      continue;
    }
    const filePath = path.join(absolute, entry.name);
    const stat = await fs.stat(filePath);
    const urlPath = `/project/images/${next.replace(/\\/g, "/")}`;
    const extension = path.extname(entry.name).toLowerCase();
    const isRenderable = renderableExtensions.has(extension);
    if (!isRenderable) continue;
    if (entry.name.startsWith(".")) continue;
    if (stat.size === 0 && entry.name.toLowerCase() === ".gitkeep") continue;
    out.push({
      name: entry.name,
      url: urlPath,
      folder: current.replace(/\\/g, "/") || "root",
      extension,
      contentType: inferContentType(extension),
      isRenderableImage: isRenderable,
      size: stat.size,
      modified: stat.mtime.toISOString(),
      isEdited: current.replace(/\\/g, "/").startsWith("edited")
    });
  }
  return out;
}

function inferPromptForEdit(editType: string, instruction: string, decision: ImageSizeDecision): string {
  const base = instruction.trim() || "Edit this photo with natural results.";
  switch (editType) {
    case "enhance":
      return `${base}\nEnhance detail, contrast, and clarity without over-processing.`;
    case "black-white":
      return `${base}\nConvert to black and white with strong tonal range.`;
    case "color-pop":
      return `${base}\nPreserve subject and increase selective color vibrancy.`;
    case "crop-fit":
      return `${base}\nRecompose to ${decision.outputWidth}x${decision.outputHeight} using ${decision.cropMode} fit.`;
    case "cleanup":
      return `${base}\nClean up distractions and improve image quality.`;
    case "background-adjust":
      return `${base}\nAdjust the background subtly while preserving subject integrity.`;
    case "style":
      return `${base}\nApply the requested artistic style.`;
    default:
      return base;
  }
}

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

import {
  SBuildUser,
  createUser,
  disableUser,
  findUserByUsername,
  findUserById,
  hashPassword as hashUserPassword,
  listUsers,
  migrateFromEnv,
  setUsersFilePath,
  updateUserPassword,
  verifyPassword as verifyUserPassword,
} from "./lib/userStore.js";

type AuthConfig = {
  enabled: boolean;
  username: string;
  passwordHash: string;
  sessionSecret: string;
};

type SessionPayload = {
  u: string;
  r: string;
  exp: number;
};

const sessionCookieName = "sbuild_session";
const sessionTtlMs = 1000 * 60 * 60 * 12;

function readAuthConfig(): AuthConfig {
  const username = String(process.env.SBUILD_AUTH_USERNAME || "").trim();
  const passwordHash = String(process.env.SBUILD_AUTH_PASSWORD_HASH || "").trim();
  const sessionSecret = String(process.env.SBUILD_SESSION_SECRET || "").trim();
  const enabled = Boolean(username && passwordHash && sessionSecret);
  return { enabled, username, passwordHash, sessionSecret };
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const source = String(header || "");
  for (const pair of source.split(";")) {
    const [rawKey, ...rest] = pair.split("=");
    const key = rawKey?.trim();
    if (!key) continue;
    out[key] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

function signSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifySession(token: string, secret: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (sig.length !== expected.length) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (!crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!parsed.u || typeof parsed.exp !== "number") return null;
    if (Date.now() >= parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function verifyPassword(plain: string, encodedHash: string): boolean {
  const parts = encodedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expectedHex = parts[5];
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const derived = crypto.scryptSync(plain, salt, expected.length, { N: n, r, p });
  return crypto.timingSafeEqual(derived, expected);
}

function renderLoginPage(reason?: string): string {
  const escapedReason = reason ? `<p class="error">${reason}</p>` : "";
  return [
    "<!doctype html>",
    "<html lang='en'>",
    "<head>",
    "<meta charset='utf-8' />",
    "<meta name='viewport' content='width=device-width,initial-scale=1' />",
    "<title>sBuild Login</title>",
    "<style>",
    ":root{--bg:#f3efe5;--card:#fffdf9;--ink:#1e2f2b;--accent:#285943;--muted:#61756f;--error:#9f2f2f}",
    "*{box-sizing:border-box}body{margin:0;font-family:'Space Grotesk','Segoe UI',sans-serif;background:radial-gradient(circle at 20% 20%,#fff6dc,transparent 45%),linear-gradient(150deg,#f8f4ec,#e8f1ed);min-height:100vh;display:grid;place-items:center;color:var(--ink)}",
    ".card{width:min(92vw,420px);background:var(--card);border:1px solid #d8d4c8;border-radius:16px;padding:28px;box-shadow:0 20px 45px rgba(26,40,34,.12)}",
    "h1{margin:0 0 6px;font-size:1.6rem;letter-spacing:.02em}p{margin:0 0 14px;color:var(--muted)}label{display:block;font-size:.9rem;margin:14px 0 6px}",
    "input{width:100%;border:1px solid #cfd7d3;border-radius:10px;padding:11px 12px;font:inherit;background:white}",
    "button{margin-top:16px;width:100%;border:0;border-radius:10px;padding:12px;background:var(--accent);color:white;font:600 1rem 'Space Grotesk','Segoe UI',sans-serif;cursor:pointer}",
    ".error{color:var(--error);font-weight:600;margin-bottom:8px}",
    "</style>",
    "</head>",
    "<body>",
    "<main class='card'>",
    "<h1>sBuild Access</h1>",
    "<p>Black Fish Farms staging editor</p>",
    escapedReason,
    "<form method='post' action='/login'>",
    "<label for='username'>Username</label>",
    "<input id='username' name='username' autocomplete='username' required />",
    "<label for='password'>Password</label>",
    "<input id='password' name='password' type='password' autocomplete='current-password' required />",
    "<button type='submit'>Sign in</button>",
    "</form>",
    "</main>",
    "</body>",
    "</html>"
  ].join("");
}

async function sendEditorFallback(
  res: express.Response,
  editorIndexPath: string,
  editorRootPath: string
): Promise<void> {
  setAppShellCacheHeaders(res);
  try {
    await fs.access(editorIndexPath);
    res.type("html");
    createReadStream(editorIndexPath).pipe(res);
  } catch {
    res.status(503).type("html").send(
      [
        "<!doctype html>",
        "<html><body>",
        "<h1>sBuild editor build is missing</h1>",
        `<p>Expected: <code>${editorRootPath}</code></p>`,
        "<p>Run <code>cd /opt/slimy/sbuild && pnpm -r build</code> then restart the server.</p>",
        "</body></html>"
      ].join("")
    );
  }
}

export function createApp(options?: { editorDistPath?: string; usersFilePath?: string; enableAuth?: boolean }): express.Express {
  const app = express();
  if (options?.usersFilePath) setUsersFilePath(options.usersFilePath);
  if (options?.enableAuth) {
    process.env.SBUILD_AUTH_USERNAME = process.env.SBUILD_AUTH_USERNAME || "admin";
    process.env.SBUILD_AUTH_PASSWORD_HASH = process.env.SBUILD_AUTH_PASSWORD_HASH || hashUserPassword("admin123");
    process.env.SBUILD_SESSION_SECRET = process.env.SBUILD_SESSION_SECRET || "test-secret";
  }
  const auth = readAuthConfig();
  const resolvedEditorDistPath = options?.editorDistPath || editorDistDir;
  if (auth.enabled) migrateFromEnv();
  const editorIndexPath = path.join(resolvedEditorDistPath, "index.html");
  const editorAssetsPath = path.join(resolvedEditorDistPath, "assets");
  // This is a same-origin app (editor + API served from this server, relative apiBase).
  // Cross-origin access is opt-in via SBUILD_ALLOWED_ORIGINS (comma-separated) instead of a
  // wildcard. Same-origin requests, curl, and health checks send no Origin header and are allowed.
  const corsAllowList = (process.env.SBUILD_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      cb(null, corsAllowList.includes(origin));
    }
  }));
  app.use(express.json({ limit: "4mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use("/project/images", express.static(projectImagesDir));

  app.get("/health", async (_req, res) => {
    const info = getBuildInfo();
    let editorDistExists = false;
    try {
      await fs.access(editorIndexPath);
      editorDistExists = true;
    } catch {
      editorDistExists = false;
    }
    res.json({
      ok: true,
      appName: info.appName,
      version: info.version,
      baseVersion: info.baseVersion,
      displayVersion: info.displayVersion,
      gitCommit: info.gitCommit,
      gitCommitFull: info.gitCommitFull,
      buildDate: info.buildDate,
      commitCount: info.commitCount,
      dirty: info.dirty,
      dirtySummary: info.dirtySummary,
      branch: info.branch,
      repoHeadCommit: info.repoHeadCommit,
      repoHeadCommitFull: info.repoHeadCommitFull,
      repoBranch: info.repoBranch,
      repoDirty: info.repoDirty,
      repoDirtySummary: info.repoDirtySummary,
      publishAllowed: info.publishAllowed,
      editorDistExists,
      paths: {
        editorDistPath: resolvedEditorDistPath,
        editorIndexPath,
        projectPath: projectFile
      }
    });
  });

  app.get("/api/project", async (req, res) => {
    if (auth.enabled && !getSession(req)) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    try {
      const project = await loadProject();
      const stat = await fs.stat(projectFile);
      res.json({
        ok: true,
        project,
        loadedProjectSource: "file",
        loadedProjectUpdatedAt: stat.mtime.toISOString(),
        projectPath: projectFile,
        lastLoadedAt: new Date().toISOString()
      });
    } catch (error) {
      try {
        const templateRaw = await fs.readFile(path.join(repoRoot, "templates", "farm", "project.json"), "utf8");
        const fallback = JSON.parse(templateRaw) as SBuildProject;
        res.status(200).json({
          ok: true,
          project: fallback,
          loadedProjectSource: "fallback",
          projectPath: projectFile,
          lastLoadedAt: new Date().toISOString(),
          error: String(error)
        });
      } catch (fallbackError) {
        res.status(500).json({ ok: false, loadedProjectSource: "error", error: `${String(error)} | ${String(fallbackError)}` });
      }
    }
  });

  // Simple per-IP login throttle/backoff. State is per-app-instance and in-memory, which is
  // appropriate for this single-owner staging deployment. A successful login clears the record.
  const LOGIN_MAX_FAILS = 5;
  const LOGIN_BLOCK_BASE_MS = 30_000;
  const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60_000;
  const loginAttempts = new Map<string, { fails: number; firstFailAt: number; blockedUntil: number }>();

  function loginRateKey(req: express.Request): string {
    return req.ip || req.socket?.remoteAddress || "unknown";
  }

  app.get("/login", (req, res) => {
    if (!auth.enabled) {
      res.redirect(302, "/");
      return;
    }
    const reason = req.query?.reason === "invalid" ? "Invalid username or password." : undefined;
    res.status(200).type("html").send(renderLoginPage(reason));
  });

  app.post("/login", (req, res) => {
    if (!auth.enabled) {
      res.redirect(302, "/");
      return;
    }

    const now = Date.now();
    const rateKey = loginRateKey(req);
    const existing = loginAttempts.get(rateKey);
    // Drop stale records once outside the attempt window and not actively blocked.
    if (existing && existing.blockedUntil <= now && now - existing.firstFailAt > LOGIN_ATTEMPT_WINDOW_MS) {
      loginAttempts.delete(rateKey);
    }
    const active = loginAttempts.get(rateKey);
    if (active && active.blockedUntil > now) {
      const retrySec = Math.ceil((active.blockedUntil - now) / 1000);
      res.setHeader("Retry-After", String(retrySec));
      res.status(429).type("html").send(renderLoginPage(`Too many login attempts. Try again in ${retrySec} second(s).`));
      return;
    }

    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    migrateFromEnv();

    const user = findUserByUsername(username);
    if (!user || !verifyUserPassword(password, user.passwordHash)) {
      const entry = loginAttempts.get(rateKey) || { fails: 0, firstFailAt: now, blockedUntil: 0 };
      if (!entry.firstFailAt) entry.firstFailAt = now;
      entry.fails += 1;
      if (entry.fails >= LOGIN_MAX_FAILS) {
        const over = entry.fails - LOGIN_MAX_FAILS;
        entry.blockedUntil = now + LOGIN_BLOCK_BASE_MS * Math.min(2 ** over, 32);
      }
      loginAttempts.set(rateKey, entry);
      res.status(401).type("html").send(renderLoginPage("Invalid username or password."));
      return;
    }
    loginAttempts.delete(rateKey);
    const token = signSession({ u: user.username, r: user.role, exp: Date.now() + sessionTtlMs }, auth.sessionSecret);
    res.setHeader("Set-Cookie", `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=43200`);
    res.redirect(302, "/");
  });

  app.post("/logout", (_req, res) => {
    res.setHeader("Set-Cookie", `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
    res.redirect(302, "/login");
  });

  function getSession(req: express.Request): SessionPayload | null {
    const token = parseCookies(req.headers.cookie)[sessionCookieName];
    return token ? verifySession(token, auth.sessionSecret) : null;
  }

  function requireAdminMw(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (!auth.enabled) { next(); return; }
    const session = getSession(req);
    if (!session) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    if (session.r !== "admin") {
      res.status(403).json({ ok: false, error: "Admin access required" });
      return;
    }
    next();
  }

  function resolveRequestUsername(req: express.Request): string | null {
    if (!auth.enabled) return "dev";
    const session = getSession(req);
    return session ? session.u : null;
  }

  app.get("/api/account/me", (req, res) => {
    if (!auth.enabled) {
      res.json({ ok: true, user: { username: "dev", role: "admin" } });
      return;
    }
    const session = getSession(req);
    if (!session) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    res.json({ ok: true, user: { username: session.u, role: session.r } });
  });

  app.get("/api/account/preferences", async (req, res) => {
    const username = resolveRequestUsername(req);
    if (!username) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const prefs = await getUserPreferences(username);
    res.json({
      ok: true,
      preferences: {
        builderUiTheme: normalizeBuilderTheme(prefs.builderUiTheme),
        updatedAt: prefs.updatedAt || null
      }
    });
  });

  app.put("/api/account/preferences", async (req, res) => {
    const username = resolveRequestUsername(req);
    if (!username) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const theme = normalizeBuilderTheme(req.body?.builderUiTheme);
    const saved = await setUserBuilderTheme(username, theme);
    res.json({
      ok: true,
      preferences: {
        builderUiTheme: normalizeBuilderTheme(saved.builderUiTheme),
        updatedAt: saved.updatedAt || null
      }
    });
  });

  app.post("/api/account/change-password", (req, res) => {
    if (!auth.enabled) {
      res.json({ ok: true, message: "Auth disabled (dev mode)" });
      return;
    }
    const session = getSession(req);
    if (!session) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    const confirmPassword = String(req.body?.confirmPassword || "");
    if (!currentPassword || !newPassword || !confirmPassword) {
      res.status(400).json({ ok: false, error: "currentPassword, newPassword, and confirmPassword are required" });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ ok: false, error: "New password and confirmation do not match" });
      return;
    }
    if (newPassword.length < 4) {
      res.status(400).json({ ok: false, error: "New password must be at least 4 characters" });
      return;
    }
    const user = findUserByUsername(session.u);
    if (!user) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }
    if (!verifyUserPassword(currentPassword, user.passwordHash)) {
      res.status(403).json({ ok: false, error: "Current password is incorrect" });
      return;
    }
    if (!updateUserPassword(user.id, newPassword)) {
      res.status(500).json({ ok: false, error: "Failed to update password" });
      return;
    }
    res.json({ ok: true, message: "Password changed successfully" });
  });

  app.get("/api/admin/users", requireAdminMw, (_req, res) => {
    const users = listUsers();
    res.json({ ok: true, users });
  });

  app.post("/api/admin/users", requireAdminMw, (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      res.status(400).json({ ok: false, error: "username and password are required" });
      return;
    }
    if (password.length < 4) {
      res.status(400).json({ ok: false, error: "Password must be at least 4 characters" });
      return;
    }
    try {
      const user = createUser(username, password, "user");
      res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt } });
    } catch (err) {
      res.status(409).json({ ok: false, error: String(err) });
    }
  });

  app.post("/api/admin/users/:id/reset-password", requireAdminMw, (req, res) => {
    const newPassword = String(req.body?.newPassword || "");
    if (!newPassword || newPassword.length < 4) {
      res.status(400).json({ ok: false, error: "newPassword must be at least 4 characters" });
      return;
    }
    const success = updateUserPassword(req.params.id, newPassword);
    if (!success) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }
    res.json({ ok: true, message: "Password reset successfully" });
  });

  app.delete("/api/admin/users/:id", requireAdminMw, (req, res) => {
    try {
      const success = disableUser(req.params.id);
      if (!success) {
        res.status(404).json({ ok: false, error: "User not found" });
        return;
      }
      res.json({ ok: true, message: "User disabled" });
    } catch (err) {
      res.status(400).json({ ok: false, error: String(err) });
    }
  });

  app.use((req, res, next) => {
    if (!auth.enabled) {
      next();
      return;
    }
    if (req.path === "/health" || req.path === "/login" || req.path === "/logout") {
      next();
      return;
    }
    if (req.path.startsWith("/api/account") || req.path.startsWith("/api/admin")) {
      const session = getSession(req);
      if (!session) {
        res.status(401).json({ ok: false, error: "Authentication required" });
        return;
      }
      next();
      return;
    }
    const token = parseCookies(req.headers.cookie)[sessionCookieName];
    const session = token ? verifySession(token, auth.sessionSecret) : null;
    if (session) {
      next();
      return;
    }
    if (isApiPath(req.path)) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    res.redirect(302, "/login");
  });

  app.put("/api/project", async (req, res) => {
    try {
      const project = req.body?.project as unknown;
      if (!validateProjectShape(project)) {
        res.status(400).json({ ok: false, error: "Invalid project payload" });
        return;
      }
      await saveProject(project);
      const stat = await fs.stat(projectFile);
      res.json({ ok: true, lastSavedAt: stat.mtime.toISOString(), projectPath: projectFile });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error) });
    }
  });

  const uploadImagesMw = upload.array("images", 12);
  app.post("/api/images", (req, res) => {
    uploadImagesMw(req, res, (err: unknown) => {
      if (err) {
        const isSize = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
        const message = err instanceof Error ? err.message : "upload failed";
        res.status(isSize ? 413 : 400).json({ ok: false, error: message });
        return;
      }
      const files = (req.files as Express.Multer.File[]) || [];
      const uploads = files.map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        url: `/project/images/${file.filename}`
      }));
      res.json({ ok: true, uploads });
    });
  });

  type DeleteImageResult = { path: string; deleted: boolean; error?: string; skipped?: string };
  type DeleteImagesResponse = { ok: boolean; deletedCount: number; skippedCount: number; results: DeleteImageResult[] };

  function collectProjectImageReferences(project: SBuildProject | null): { url: string; usedBy: string[] }[] {
    const out: { url: string; usedBy: string[] }[] = [];
    if (!project) return out;
    const record = (url: string, usedBy: string): void => {
      if (!url) return;
      const existing = out.find((entry) => entry.url === url);
      if (existing) {
        if (!existing.usedBy.includes(usedBy)) existing.usedBy.push(usedBy);
        return;
      }
      out.push({ url, usedBy: [usedBy] });
    };
    for (const page of project.pages) {
      for (const block of page.blocks) {
        if (block.styles?.backgroundImage) record(block.styles.backgroundImage, `${block.type} background on page ${page.title}`);
        if (block.type === "image") {
          const src = (block.data as { src?: string }).src;
          if (src) record(src, `image block on page ${page.title}`);
        }
        if (block.type === "gallery") {
          const galleryData = block.data as { images?: Array<{ src?: string }> };
          for (const image of galleryData.images || []) {
            if (image.src) record(image.src, `gallery image on page ${page.title}`);
          }
        }
        if (block.type === "cards") {
          const cardsData = block.data as { cards?: Array<{ image?: string }> };
          for (const item of cardsData.cards || []) {
            if (item.image) record(item.image, `card image on page ${page.title}`);
          }
        }
      }
    }
    return out;
  }

  function resolveSafeImagePath(input: string): { ok: true; absolute: string; relative: string } | { ok: false; error: string } {
    const raw = String(input || "").trim();
    if (!raw) return { ok: false, error: "path is required" };
    let relative: string;
    if (raw.startsWith("/project/images/")) relative = raw.slice("/project/images/".length);
    else if (raw.startsWith("project/images/")) relative = raw.slice("project/images/".length);
    else if (raw.startsWith("/")) return { ok: false, error: "absolute paths are not allowed" };
    else return { ok: false, error: "path must start with /project/images/" };

    const cleaned = relative.replace(/\\/g, "/").replace(/^\/+/, "");
    const normalized = path.posix.normalize(cleaned);
    if (normalized === "." || normalized.startsWith("../") || normalized.includes("/../") || normalized === "..") {
      return { ok: false, error: "path traversal not allowed" };
    }
    if (!normalized || normalized.endsWith("/")) return { ok: false, error: "path must reference a file" };
    const absolute = path.resolve(projectImagesDir, normalized);
    const root = path.resolve(projectImagesDir);
    if (!absolute.startsWith(root + path.sep) && absolute !== root) {
      return { ok: false, error: "path must resolve under project/images" };
    }
    return { ok: true, absolute, relative: normalized };
  }

  async function deleteProjectImages(items: unknown[], options: { force?: boolean } = {}): Promise<DeleteImagesResponse> {
    const force = options.force === true;
    let project: SBuildProject | null = null;
    try {
      project = await loadProject();
    } catch { project = null; }
    const usedRefs = collectProjectImageReferences(project);
    const usedMap = new Map<string, string[]>();
    for (const ref of usedRefs) {
      const refPath = ref.url.startsWith("/project/images/") ? ref.url.slice("/project/images/".length) : ref.url;
      usedMap.set(refPath, ref.usedBy);
    }
    const results: DeleteImageResult[] = [];
    let deletedCount = 0;
    let skippedCount = 0;
    for (const item of items) {
      const resolved = resolveSafeImagePath(String(item));
      if (!resolved.ok) {
        results.push({ path: String(item), deleted: false, error: resolved.error });
        continue;
      }
      const baseName = path.basename(resolved.relative);
      if (baseName === ".gitkeep" || baseName.startsWith(".")) {
        results.push({ path: resolved.relative, deleted: false, skipped: "hidden or system file" });
        skippedCount += 1;
        continue;
      }
      const usage = usedMap.get(resolved.relative);
      if (usage && !force) {
        results.push({ path: resolved.relative, deleted: false, skipped: `in use: ${usage.join(", ")}` });
        skippedCount += 1;
        continue;
      }
      try {
        await fs.unlink(resolved.absolute);
        results.push({ path: resolved.relative, deleted: true });
        deletedCount += 1;
      } catch (error) {
        results.push({ path: resolved.relative, deleted: false, error: String(error) });
      }
    }
    const ok = results.every((r) => r.deleted || r.skipped);
    return { ok, deletedCount, skippedCount, results };
  }

  app.delete("/api/images", async (req, res) => {
    const filenames = req.body?.filenames;
    if (!filenames || !Array.isArray(filenames)) {
      res.status(400).json({ ok: false, error: "filenames array is required" });
      return;
    }
    const result = await deleteProjectImages(filenames.map((filename) => `/project/images/${String(filename)}`));
    res.json({
      ok: result.ok,
      deletedCount: result.deletedCount,
      results: result.results.map((entry) => ({
        filename: entry.path,
        deleted: entry.deleted,
        error: entry.error || entry.skipped
      }))
    });
  });

  app.post("/api/images/delete", async (req, res) => {
    const items = Array.isArray(req.body?.paths) ? req.body.paths : [];
    if (items.length === 0) {
      res.status(400).json({ ok: false, error: "paths array is required" });
      return;
    }
    const result = await deleteProjectImages(items, { force: req.body?.force === true });
    res.json(result);
  });

  app.post("/api/images/folder/create", async (req, res) => {
    const parent = String(req.body?.parent || "").trim();
    const name = String(req.body?.name || "").trim();
    if (!name) {
      res.status(400).json({ ok: false, error: "name is required" });
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(name) || name.startsWith(".") || name.includes("..")) {
      res.status(400).json({ ok: false, error: "folder name may only contain letters, digits, dot, underscore, and dash" });
      return;
    }
    const validated = validateImageFolderPath(parent || "project/images");
    if (!validated.ok) {
      res.status(400).json({ ok: false, error: validated.error });
      return;
    }
    const target = path.posix.join(validated.normalized, name);
    const abs = path.resolve(projectImagesDir, target.replace(/^project\/images\/?/, ""));
    const root = path.resolve(projectImagesDir);
    if (!abs.startsWith(root + path.sep) && abs !== root) {
      res.status(400).json({ ok: false, error: "folder path escapes project/images" });
      return;
    }
    try {
      await fs.mkdir(abs, { recursive: false });
      res.json({ ok: true, folder: target, message: `Created folder ${target}.` });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EEXIST") {
        res.status(409).json({ ok: false, error: "A folder with that name already exists." });
        return;
      }
      res.status(500).json({ ok: false, error: String(error) });
    }
  });

  app.post("/api/images/folder/rename", async (req, res) => {
    const from = String(req.body?.from || "").trim();
    const to = String(req.body?.to || "").trim();
    if (!from || !to) {
      res.status(400).json({ ok: false, error: "from and to are required" });
      return;
    }
    const fromValidated = validateImageFolderPath(from);
    if (!fromValidated.ok) {
      res.status(400).json({ ok: false, error: fromValidated.error });
      return;
    }
    const toParent = path.posix.dirname(to);
    const toName = path.posix.basename(to);
    if (!/^[a-zA-Z0-9._-]+$/.test(toName) || toName.startsWith(".") || toName.includes("..")) {
      res.status(400).json({ ok: false, error: "new folder name may only contain letters, digits, dot, underscore, and dash" });
      return;
    }
    const parentValidated = toParent === "." || toParent === "" ? { ok: true as const, normalized: "project/images" } : validateImageFolderPath(toParent);
    if (!parentValidated.ok) {
      res.status(400).json({ ok: false, error: parentValidated.error });
      return;
    }
    const fromAbs = path.resolve(projectImagesDir, fromValidated.normalized.replace(/^project\/images\/?/, ""));
    const toAbs = path.resolve(projectImagesDir, toName);
    const root = path.resolve(projectImagesDir);
    if (!fromAbs.startsWith(root + path.sep) || !toAbs.startsWith(root + path.sep)) {
      res.status(400).json({ ok: false, error: "folder path escapes project/images" });
      return;
    }
    try {
      await fs.rename(fromAbs, toAbs);
      res.json({ ok: true, folder: `project/images/${toName}`, message: "Folder renamed." });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        res.status(404).json({ ok: false, error: "Source folder not found." });
        return;
      }
      if (code === "ENOTEMPTY" || code === "EEXIST") {
        res.status(409).json({ ok: false, error: "Destination already exists or source is not empty." });
        return;
      }
      res.status(500).json({ ok: false, error: String(error) });
    }
  });

  app.post("/api/images/folder/delete", async (req, res) => {
    const folder = String(req.body?.folder || "").trim();
    const validated = validateImageFolderPath(folder);
    if (!validated.ok) {
      res.status(400).json({ ok: false, error: validated.error });
      return;
    }
    if (validated.normalized === "project/images") {
      res.status(400).json({ ok: false, error: "Cannot delete the root project/images folder." });
      return;
    }
    const abs = path.resolve(projectImagesDir, validated.normalized.replace(/^project\/images\/?/, ""));
    try {
      const entries = await fs.readdir(abs, { withFileTypes: true });
      if (entries.length > 0) {
        res.status(409).json({ ok: false, error: "Folder is not empty. Remove its images first." });
        return;
      }
      await fs.rmdir(abs);
      res.json({ ok: true, folder: validated.normalized, message: "Folder removed." });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        res.status(404).json({ ok: false, error: "Folder not found." });
        return;
      }
      res.status(500).json({ ok: false, error: String(error) });
    }
  });

  app.get("/api/images/folder/list", async (_req, res) => {
    try {
      await fs.mkdir(projectImagesDir, { recursive: true });
      const out: string[] = ["project/images"];
      async function walk(current: string): Promise<void> {
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (entry.name.startsWith(".")) continue;
          const abs = path.join(current, entry.name);
          const rel = path.relative(projectImagesDir, abs).replace(/\\/g, "/");
          out.push(`project/images/${rel}`);
          await walk(abs);
        }
      }
      await walk(projectImagesDir);
      res.json({ ok: true, folders: out });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error) });
    }
  });

  app.post("/api/images/move", async (req, res) => {
    const items = Array.isArray(req.body?.paths) ? req.body.paths : [];
    const targetFolder = String(req.body?.targetFolder || "").trim();
    const folderValidated = validateImageFolderPath(targetFolder || "project/images");
    if (!folderValidated.ok) {
      res.status(400).json({ ok: false, error: folderValidated.error });
      return;
    }
    const targetAbs = path.resolve(projectImagesDir, folderValidated.normalized.replace(/^project\/images\/?/, ""));
    const root = path.resolve(projectImagesDir);
    if (!targetAbs.startsWith(root + path.sep) && targetAbs !== root) {
      res.status(400).json({ ok: false, error: "target folder escapes project/images" });
      return;
    }
    try { await fs.mkdir(targetAbs, { recursive: true }); } catch { /* ignore */ }
    const results: { path: string; moved: boolean; newPath?: string; error?: string }[] = [];
    let movedCount = 0;
    for (const item of items) {
      const resolved = resolveSafeImagePath(String(item));
      if (!resolved.ok) {
        results.push({ path: String(item), moved: false, error: resolved.error });
        continue;
      }
      const baseName = path.basename(resolved.relative);
      if (baseName === ".gitkeep" || baseName.startsWith(".")) {
        results.push({ path: resolved.relative, moved: false, error: "hidden or system file" });
        continue;
      }
      const destPath = path.join(targetAbs, baseName);
      try {
        await fs.rename(resolved.absolute, destPath);
        const newRel = path.posix.join(folderValidated.normalized, baseName);
        results.push({ path: resolved.relative, moved: true, newPath: newRel });
        movedCount += 1;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          results.push({ path: resolved.relative, moved: false, error: "source not found" });
        } else {
          results.push({ path: resolved.relative, moved: false, error: String(error) });
        }
      }
    }
    const ok = results.every((r) => r.moved);
    res.json({ ok, movedCount, results });
  });

  app.get("/api/images", async (_req, res) => {
    try {
      await fs.mkdir(projectImagesDir, { recursive: true });
      const configuredFolder = await readImageFolderSetting();
      const images = await listImagesRecursive(projectImagesDir);
      images.sort((a, b) => a.name.localeCompare(b.name));
      res.json({ ok: true, images, count: images.length, folder: configuredFolder });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error) });
    }
  });

  app.get("/api/images/folder", async (_req, res) => {
    const folder = await readImageFolderSetting();
    res.json({ ok: true, folder, defaultFolder: "project/images" });
  });

  app.post("/api/images/folder", async (req, res) => {
    const requested = String(req.body?.folder || "").trim();
    const validated = validateImageFolderPath(requested);
    if (!validated.ok) {
      res.status(400).json({ ok: false, error: validated.error });
      return;
    }
    await writeImageFolderSetting(validated.normalized);
    res.json({ ok: true, folder: validated.normalized, message: "Folder setting saved." });
  });

  app.get("/api/fonts", async (_req, res) => {
    const key = process.env.GOOGLE_FONTS_API_KEY;
    if (!key) {
      res.json({ ok: true, source: "curated", fonts: curatedFonts });
      return;
    }

    try {
      const r = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${encodeURIComponent(key)}`);
      if (!r.ok) throw new Error(`Google Fonts API failed: ${r.status}`);
      const data = (await r.json()) as { items?: Array<{ family: string }> };
      res.json({ ok: true, source: "google", fonts: data.items?.slice(0, 300) || curatedFonts });
    } catch {
      res.json({ ok: true, source: "curated-fallback", fonts: curatedFonts });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    const prompt = String(req.body?.prompt || "").trim();
    const chatHistory = Array.isArray(req.body?.chatHistory) ? req.body.chatHistory as Array<{ role: string; text: string }> : [];
    const projectContext = (req.body?.projectContext && typeof req.body.projectContext === "object")
      ? req.body.projectContext as Partial<SBuildProject>
      : null;
    const selectedBlockId = req.body?.selectedBlockId ? String(req.body.selectedBlockId) : "";
    const selectedPageId = req.body?.selectedPageId ? String(req.body.selectedPageId) : "";
    if (!prompt) {
      res.status(400).json({ ok: false, error: "prompt is required" });
      return;
    }
    // Build the Brain from project context, if any, so deterministic
    // site-fact and build-identity questions are answered without an
    // LLM call.
    const brainProject = projectContext
      ? ({
          version: (projectContext as SBuildProject).version || "1",
          updatedAt: (projectContext as SBuildProject).updatedAt || new Date().toISOString(),
          site: (projectContext as SBuildProject).site || { siteName: "Untitled site", title: "Untitled", description: "", nav: [] },
          globalStyles: (projectContext as SBuildProject).globalStyles || { headingFont: "", bodyFont: "", colors: { bg: "#fff", surface: "#fff", text: "#000", accent: "#000", muted: "#666" } },
          ai: (projectContext as SBuildProject).ai || { provider: "ollama", model: "" },
          deploy: (projectContext as SBuildProject).deploy || { method: "dry-run", webRoot: "" },
          pages: Array.isArray((projectContext as SBuildProject).pages) ? (projectContext as SBuildProject).pages : []
        } as SBuildProject)
      : null;
    const brain = brainProject
      ? buildBrainContext({
          project: brainProject,
          selectedBlockId: selectedBlockId || null,
          selectedPageId: selectedPageId || null,
          build: getBuildInfo()
        })
      : null;
    if (brain) {
      const det = tryDeterministicFact(prompt, brain) || trySiteFact(prompt, brain);
      if (det) {
        const username = auth.enabled ? (() => {
          const session = getSession(req);
          return session ? session.u : null;
        })() : "dev";
        if (username) {
          const persistedItems: PersistedChatItem[] = [
            { role: "user", text: prompt, timestamp: Date.now() },
            { role: "assistant", text: det.text, timestamp: Date.now(), provider: "local", model: "sbuild-brain", source: "brain", latencyMs: 0 }
          ];
          appendChatHistory(username, req.body?.projectPath || undefined, persistedItems);
        }
        res.json({
          ok: true,
          response: det.text,
          provider: "local",
          model: "sbuild-brain",
          source: "brain",
          message: `sBuild Brain: deterministic ${det.reason}`,
          latencyMs: 0,
          isLocal: true,
          available: true,
          // Engine decision proof
          engine: "sbuild-brain",
          mode: "deterministic",
          engineModel: "sbuild-brain",
          engineLatencyMs: 0,
          engineTimeoutMs: null,
          engineContextUsed: det.contextUsed,
          engineReason: det.reason,
          deterministicAnswer: true
        });
        return;
      }
    }
    const result = await chatWithProviders(prompt, chatHistory);
    const username = auth.enabled ? (() => {
      const session = getSession(req);
      return session ? session.u : null;
    })() : "dev";
    if (username) {
      const persistedItems: PersistedChatItem[] = [
        { role: "user", text: prompt, timestamp: Date.now() },
        { role: "assistant", text: result.response, timestamp: Date.now(), provider: result.provider, model: result.model, source: result.source, latencyMs: result.latencyMs }
      ];
      appendChatHistory(username, req.body?.projectPath || undefined, persistedItems);
    }
    // Surface engine decision proof for the chat lane.
    const chatEngine = result.provider === "local"
      ? "local-ollama"
      : result.provider === "openai" || result.provider === "openrouter"
        ? "openai-api"
        : "unavailable";
    const chatMode = !result.available
      ? (typeof result.response === "string" && /timed out/i.test(result.response) ? "error" : "error")
      : "llm";
    const chatEngineReason = !result.available
      ? (typeof result.response === "string" && /timed out/i.test(result.response) ? "llm-timeout" : "llm-error")
      : "llm-ok";
    const chatEngineTimeoutMs = result.provider === "local"
      ? ((await getChatProviderConfig()).fallbackTimeoutSec * 1000)
      : null;
    res.json({
      ok: true,
      ...result,
      engine: chatEngine,
      mode: chatMode,
      engineModel: result.model || null,
      engineLatencyMs: result.latencyMs ?? 0,
      engineTimeoutMs: chatEngineTimeoutMs,
      engineReason: chatEngineReason,
      deterministicAnswer: false,
      fallbackUsed: result.fallbackUsed || false,
      fallbackFrom: result.fallbackFrom || null,
      fallbackReason: result.fallbackReason || null
    });
  });

  app.post("/api/ai/suggest", async (req, res) => {
    const prompt = String(req.body?.prompt || "").trim();
    const targetKind = String(req.body?.targetKind || "block");
    const blockId = String(req.body?.blockId || "");
    const blockType = String(req.body?.blockType || "");
    const chatHistory = Array.isArray(req.body?.chatHistory) ? req.body.chatHistory as Array<{ role: string; text: string }> : [];
    const pageContent = String(req.body?.pageContent || "");
    const blockContent = String(req.body?.blockContent || "");
    const projectContext = (req.body?.projectContext && typeof req.body.projectContext === "object")
      ? req.body.projectContext as Partial<SBuildProject>
      : null;
    const selectedBlockId = req.body?.selectedBlockId ? String(req.body.selectedBlockId) : blockId;
    const selectedPageId = req.body?.selectedPageId ? String(req.body.selectedPageId) : "";
    if (!prompt) {
      res.status(400).json({ ok: false, error: "prompt is required" });
      return;
    }

    const brainProject = projectContext
      ? ({
          version: (projectContext as SBuildProject).version || "1",
          updatedAt: (projectContext as SBuildProject).updatedAt || new Date().toISOString(),
          site: (projectContext as SBuildProject).site || { siteName: "Untitled site", title: "Untitled", description: "", nav: [] },
          globalStyles: (projectContext as SBuildProject).globalStyles || { headingFont: "", bodyFont: "", colors: { bg: "#fff", surface: "#fff", text: "#000", accent: "#000", muted: "#666" } },
          ai: (projectContext as SBuildProject).ai || { provider: "ollama", model: "" },
          deploy: (projectContext as SBuildProject).deploy || { method: "dry-run", webRoot: "" },
          pages: Array.isArray((projectContext as SBuildProject).pages) ? (projectContext as SBuildProject).pages : []
        } as SBuildProject)
      : null;
    const brain = buildBrainContext({
      project: brainProject,
      selectedBlockId: selectedBlockId || null,
      selectedPageId: selectedPageId || null,
      build: getBuildInfo()
    });

    // The Brain handles two families of deterministic questions:
    //   1. App version/build identity (tryDeterministicFact).
    //   2. Exact site facts present in project JSON — pickup hours,
    //      card titles, card details, contact info, page list, and
    //      selected-block image alt (trySiteFact). These are positive-
    //      field-lookup tests keyed on the field name, not the user
    //      phrase. General knowledge (corn, potato, sky, jokes) is NOT
    //      matched and falls through to the LLM.
    // Everything else (UI state, chitchat, general knowledge, copy
    // generation, image prompting) goes to the LLM with the full Brain
    // context in its system prompt.
    const deterministicDecision =
      tryDeterministicFact(prompt, brain) ||
      (brainProject ? trySiteFact(prompt, brain) : null);
    if (deterministicDecision) {
      const detUsername = auth.enabled ? (() => {
        const session = getSession(req);
        return session ? session.u : null;
      })() : "dev";
      if (detUsername) {
        const detPersisted: PersistedChatItem[] = [
          { role: "user", text: prompt, timestamp: Date.now() },
          { role: "assistant", text: deterministicDecision.text, timestamp: Date.now(), provider: "local", model: "sbuild-brain", source: "brain", latencyMs: 0 }
        ];
        appendChatHistory(detUsername, req.body?.projectPath || undefined, detPersisted);
      }
      res.json({
        ok: true,
        suggestion: deterministicDecision.text,
        provider: "local",
        model: "sbuild-brain",
        source: "brain",
        message: `sBuild Brain: deterministic ${deterministicDecision.reason}`,
        latencyMs: 0,
        isLocal: true,
        proposal: null,
        hasProposal: false,
        targetKind,
        blockId,
        blockType,
        // Engine decision proof
        engine: "sbuild-brain",
        mode: "deterministic",
        engineModel: "sbuild-brain",
        engineLatencyMs: 0,
        engineTimeoutMs: null,
        engineContextUsed: deterministicDecision.contextUsed,
        engineReason: deterministicDecision.reason,
        deterministicAnswer: true
      });
      return;
    }

    const scopeInstruction = targetKind === "site"
      ? "Focus: the whole website. Prefer site-wide context. "
      : targetKind === "page"
        ? `Focus: the current page${selectedPageId ? " (selected by the operator)" : ""}. Prefer content on this page. `
        : blockType && selectedBlockId
          ? `Focus: a ${blockType} block (id ${selectedBlockId}) on "${brain.selectedBlock?.pageTitle || "the current page"}". Prefer the selected block when the user asks about it, but you may also use site facts (other pages, hours, contact, cards, page list) from the sBuild Brain context. `
          : "Focus: a block in the editor. Prefer the selected block when the user asks about it, but you may also use site facts from the sBuild Brain context. ";
    const brainContextBlock = brainProject
      ? `\n\n${formatBrainContextForPrompt(brain)}\n\n`
      : "";
    const contentContext = targetKind === "block" && blockContent
      ? `\n\nSelected block content:\n${blockContent.slice(0, 2000)}\n\n`
      : pageContent
        ? `\n\nCurrent ${targetKind === "site" ? "site" : "page"} content:\n${pageContent.slice(0, 4000)}\n\n`
        : "";
    const isQuestion = isQuestionPrompt(prompt);
    const fieldInstruction = !isQuestion && targetKind === "block" && blockType
      ? fieldInstructionFromPrompt(prompt, blockType)
      : "";
    const proposalInstruction = !isQuestion && targetKind === "block"
      ? `If you are proposing a direct replacement for editable block copy, return a JSON object in a fenced \`\`\`json block with {"kind":"replace-copy","replaceText":"...","targetField":"heading or subheading or body"}. Otherwise answer normally with plain text and no proposal object. `
      : "";
    const fullPrompt = `${scopeInstruction}${brainContextBlock}${contentContext}${fieldInstruction}${proposalInstruction}${prompt}`;
    const llmStartedAt = Date.now();
    const result = await chatWithProviders(fullPrompt, chatHistory);
    const llmLatencyMs = Date.now() - llmStartedAt;

    // Engine decision: was the LLM actually called, or did it fail
    // before responding? Be honest. No fake deterministic answers.
    let engine: "local-ollama" | "openai-api" | "unavailable" = "unavailable";
    let mode: "llm" | "fallback" | "error" = "error";
    let engineReason: "llm-ok" | "llm-timeout" | "llm-error" | "no-llm-available" | "general-knowledge" = "general-knowledge";
    let engineTimeoutMs: number | null = null;
    const contextUsed: string[] = ["app-build", "app-capabilities"];
    if (brainProject) {
      contextUsed.push("whole-site");
      if (brain.selectedBlock) contextUsed.push("selected-block");
    }
    if (result.provider === "local") {
      engine = "local-ollama";
      engineTimeoutMs = (await getChatProviderConfig()).fallbackTimeoutSec * 1000;
    } else if (result.provider === "openai" || result.provider === "openrouter") {
      engine = "openai-api";
    } else if (result.provider === "none" || result.provider === "disabled") {
      engine = "unavailable";
      mode = "error";
      engineReason = "no-llm-available";
    }
    if (result.available && result.response) {
      mode = "llm";
      engineReason = "llm-ok";
    } else if (typeof result.response === "string" && /timed out/i.test(result.response)) {
      mode = "error";
      engineReason = "llm-timeout";
    } else {
      mode = "error";
      engineReason = "llm-error";
    }

    const rawProposal = !isQuestion && result.available && targetKind === "block" && Boolean(blockId) && Boolean(blockType)
      ? parseStructuredSuggestionProposal(result.response)
      : null;
    const proposal = rawProposal && rawProposal.replaceText.length > 0 && rawProposal.replaceText.length <= 2000
      ? { ...rawProposal, targetField: rawProposal.targetField || inferTargetField(prompt, blockType) }
      : null;
    const hasProposal = Boolean(proposal);
    let displayResponse = stripProposalJsonFromText(result.response);
    if (hasProposal && proposal && (!displayResponse || displayResponse === result.response)) {
      displayResponse = `Suggestion: replace the block text with "${proposal.replaceText}"`;
    }
    const username = auth.enabled ? (() => {
      const session = getSession(req);
      return session ? session.u : null;
    })() : "dev";
    if (username) {
      appendMemoryForUser(username, `Q: ${prompt.slice(0, 200)} A: ${displayResponse.slice(0, 200)}`);
      const persistedItems: PersistedChatItem[] = [
        { role: "user", text: prompt, timestamp: Date.now() },
        { role: "assistant", text: displayResponse, timestamp: Date.now(), provider: result.provider, model: result.model, source: result.source, latencyMs: result.latencyMs }
      ];
      appendChatHistory(username, req.body?.projectPath || undefined, persistedItems);
    }
    res.json({
      ok: true,
      suggestion: displayResponse,
      provider: result.provider,
      model: result.model,
      message: result.message,
      source: result.source,
      latencyMs: result.latencyMs,
      isLocal: result.isLocal,
      proposal,
      hasProposal,
      targetKind,
      blockId,
      blockType,
      brainScope: brain.selectedBlock ? "selected-block" : targetKind === "page" ? "page" : "site",
      // Engine decision proof
      engine,
      mode,
      engineModel: result.model || null,
      engineLatencyMs: llmLatencyMs,
      engineTimeoutMs,
      engineContextUsed: contextUsed,
      engineReason,
      deterministicAnswer: false,
      fallbackUsed: result.fallbackUsed || false,
      fallbackFrom: result.fallbackFrom || null,
      fallbackReason: result.fallbackReason || null
    });
  });

  app.post("/api/ai/brain", async (req, res) => {
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) {
      res.status(400).json({ ok: false, error: "prompt is required" });
      return;
    }
    const projectContext = (req.body?.projectContext && typeof req.body.projectContext === "object")
      ? req.body.projectContext as Partial<SBuildProject>
      : null;
    const selectedBlockId = req.body?.selectedBlockId ? String(req.body.selectedBlockId) : "";
    const selectedPageId = req.body?.selectedPageId ? String(req.body.selectedPageId) : "";
    const brainProject = projectContext
      ? ({
          version: (projectContext as SBuildProject).version || "1",
          updatedAt: (projectContext as SBuildProject).updatedAt || new Date().toISOString(),
          site: (projectContext as SBuildProject).site || { siteName: "Untitled site", title: "Untitled", description: "", nav: [] },
          globalStyles: (projectContext as SBuildProject).globalStyles || { headingFont: "", bodyFont: "", colors: { bg: "#fff", surface: "#fff", text: "#000", accent: "#000", muted: "#666" } },
          ai: (projectContext as SBuildProject).ai || { provider: "ollama", model: "" },
          deploy: (projectContext as SBuildProject).deploy || { method: "dry-run", webRoot: "" },
          pages: Array.isArray((projectContext as SBuildProject).pages) ? (projectContext as SBuildProject).pages : []
        } as SBuildProject)
      : null;
    const brain = buildBrainContext({
      project: brainProject,
      selectedBlockId: selectedBlockId || null,
      selectedPageId: selectedPageId || null,
      build: getBuildInfo()
    });
    const brainContext = formatBrainContextForPrompt(brain);
    if (!brainProject) {
      res.json({
        ok: true,
        kind: "no-project",
        engine: "sbuild-brain",
        mode: "deterministic",
        engineReason: "no-project-context",
        deterministicAnswer: true,
        suggestion: "Open or load a project in the editor so the sBuild Brain can read its pages and blocks.",
        provider: "local",
        model: "sbuild-brain",
        source: "brain",
        brainLoaded: true,
        brainContext
      });
      return;
    }
    const deterministic = tryDeterministicFact(prompt, brain) || trySiteFact(prompt, brain);
    if (deterministic) {
      res.json({
        ok: true,
        kind: "answered",
        engine: "sbuild-brain",
        mode: "deterministic",
        engineReason: deterministic.reason,
        engineContextUsed: deterministic.contextUsed,
        deterministicAnswer: true,
        suggestion: deterministic.text,
        provider: "local",
        model: "sbuild-brain",
        source: "brain",
        brainLoaded: true,
        brainContext
      });
      return;
    }
    // For every other prompt, the Brain provides context for the LLM.
    // The Brain itself does not pretend to answer.
    res.json({
      ok: true,
      kind: "needs-llm",
      engine: "sbuild-brain",
      mode: "deterministic",
      engineReason: "general-knowledge",
      deterministicAnswer: false,
      suggestion: "The sBuild Brain does not hardcode answers. This prompt will be sent to the language model with the full Brain context. The model decides the answer.",
      provider: "none",
      model: "sbuild-brain",
      source: "brain",
      brainLoaded: true,
      brainContext
    });
  });

  app.get("/api/ai/brain/health", (_req, res) => {
    const info = getBuildInfo();
    res.json({
      ok: true,
      brain: "sbuild-brain",
      version: info.displayVersion,
      architecture: "honest",
      deterministicPath: "version-and-build-identity only",
      llmPath: "everything else, with full sBuild Brain context in system prompt",
      capabilities: [
        "builds-structured-site-and-app-context",
        "renders-context-as-system-prompt-for-llm",
        "answers-version-and-build-questions-deterministically",
        "no-hardcoded-user-prompt-matchers",
        "no-faked-general-knowledge-answers"
      ],
      caveats: [
        "qwen3:4b is installed but times out on every prompt at 25s; not recommended for interactive chat",
        "qwen2.5:1.5b is the current default local model; works for general knowledge in 1-4s",
        "No API fallback configured in this environment (no SBUILD_OPENAI_CHAT_API_KEY)",
        "Gemma-family/QAT model install requires separate operator approval (mission safety)"
      ]
    });
  });

  app.get("/api/ai/memory", (req, res) => {
    const username = auth.enabled ? (() => {
      const session = getSession(req);
      return session ? session.u : null;
    })() : "dev";
    if (!username) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const memory = getMemoryForUser(username);
    res.json({ ok: true, memory });
  });

  app.post("/api/ai/memory", (req, res) => {
    const username = auth.enabled ? (() => {
      const session = getSession(req);
      return session ? session.u : null;
    })() : "dev";
    if (!username) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const summary = String(req.body?.summary || "").trim();
    if (!summary) {
      res.status(400).json({ ok: false, error: "summary is required" });
      return;
    }
    appendMemoryForUser(username, summary);
    res.json({ ok: true });
  });

  app.delete("/api/ai/memory", (req, res) => {
    const username = auth.enabled ? (() => {
      const session = getSession(req);
      return session ? session.u : null;
    })() : "dev";
    if (!username) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    clearMemoryForUser(username);
    res.json({ ok: true });
  });

  app.get("/api/ai/chat/history", (req, res) => {
    const username = auth.enabled ? (() => {
      const session = getSession(req);
      return session ? session.u : null;
    })() : "dev";
    if (!username) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const projectPath = String(req.query?.projectPath || "");
    const messages = getChatHistory(username, projectPath || undefined);
    res.json({ ok: true, messages });
  });

  app.delete("/api/ai/chat/history", (req, res) => {
    const username = auth.enabled ? (() => {
      const session = getSession(req);
      return session ? session.u : null;
    })() : "dev";
    if (!username) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const projectPath = String(req.body?.projectPath || req.query?.projectPath || "");
    clearChatHistory(username, projectPath || undefined);
    res.json({ ok: true });
  });

  app.post("/api/ai/chat/save", (req, res) => {
    const username = auth.enabled ? (() => {
      const session = getSession(req);
      return session ? session.u : null;
    })() : "dev";
    if (!username) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const projectPath = String(req.body?.projectPath || "");
    const messages = Array.isArray(req.body?.messages) ? req.body.messages as PersistedChatItem[] : [];
    if (messages.length === 0) {
      const existing = getChatHistory(username, projectPath || undefined);
      if (existing.length === 0) {
        res.json({ ok: true, savedAt: new Date().toISOString(), message: "Nothing to save." });
        return;
      }
      res.json({ ok: true, savedAt: new Date().toISOString(), message: "Chat already saved.", messageCount: existing.length });
      return;
    }
    const sanitized: PersistedChatItem[] = messages.map((m) => ({
      role: m.role === "user" || m.role === "assistant" ? m.role : "assistant",
      text: sanitizeChatTextImported(String(m.text || "")),
      timestamp: typeof m.timestamp === "number" ? m.timestamp : Date.now(),
      provider: m.provider || undefined,
      model: m.model || undefined,
      source: m.source || undefined,
      latencyMs: m.latencyMs != null ? m.latencyMs : undefined
    }));
    replaceChatHistory(username, projectPath || undefined, sanitized);
    res.json({ ok: true, savedAt: new Date().toISOString(), message: "Chat saved.", messageCount: sanitized.length });
  });

  app.post("/api/ai/paint-fix", async (req, res) => {
    try {
      const instruction = String(req.body?.instruction || "");
      const project = await loadProject();
      const pageId = String(req.body?.pageId || project.pages[0]?.id || "");
      const idx = project.pages.findIndex((p) => p.id === pageId);
      if (idx < 0) {
        res.status(404).json({ ok: false, error: "Page not found" });
        return;
      }
      const result = applyDeterministicPaintFix(instruction, project.pages[idx].blocks);
      const next = { ...project };
      next.pages = [...project.pages];
      next.pages[idx] = { ...project.pages[idx], blocks: result.blocks };
      await saveProject(next as SBuildProject);
      res.json({ ok: true, notes: result.notes, project: next });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error) });
    }
  });

  app.post("/api/ai/image", async (req, res) => {
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) {
      res.status(400).json({ ok: false, error: "prompt is required" });
      return;
    }

    const targetContext = parseTargetContext(req.body?.targetContext);
    let sizeDecision = decideImageSize(targetContext);
    sizeDecision = withExplicitSize(sizeDecision, req.body?.explicitSize ?? req.body?.size);
    const warnings: string[] = [...sizeDecision.warnings];
    const previewOnly = req.body?.preview === true || req.body?.preview === "true";

    const keyStatus = await getImageApiKeyStatus();
    const key = keyStatus.genKey;
    if (!key) {
      warnings.push("OpenAI key missing. Generation unavailable.");
      res.status(200).json({
        ok: false,
        unavailable: true,
        message: "Image generation unavailable: API key not configured.",
        sizeDecision,
        warnings
      });
      return;
    }

    const model = process.env.SBUILD_IMAGE_MODEL || "gpt-image-1";
    try {
      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          prompt: imageGenerationPrompt({
            prompt,
            style: req.body?.style ? String(req.body.style) : undefined,
            tone: req.body?.tone ? String(req.body.tone) : undefined
          }),
          size: sizeDecision.providerSize,
          quality: "medium"
        })
      });

      const payload = (await r.json().catch(() => ({}))) as {
        error?: { message?: string };
        data?: Array<{ b64_json?: string; url?: string }>;
      };

      if (!r.ok) {
        res.status(502).json({
          ok: false,
          unavailable: true,
          message: payload.error?.message || `Image provider returned ${r.status}`,
          sizeDecision,
          warnings
        });
        return;
      }

      const item = payload.data?.[0];
      if (!item?.b64_json && !item?.url) {
        res.status(502).json({
          ok: false,
          unavailable: true,
          message: "Image provider returned no image data.",
          sizeDecision,
          warnings
        });
        return;
      }

      const originalBuffer = item.b64_json
        ? Buffer.from(item.b64_json, "base64")
        : await fetchUrlToBuffer(item.url!);

      let imagePath: string;
      let fittedBuffer: Buffer | null = null;
      const sharpMod = await loadSharp();
      if (sharpMod) {
        try {
          fittedBuffer = await fitWithSharp({
            input: originalBuffer,
            cropMode: sizeDecision.cropMode,
            outputWidth: sizeDecision.outputWidth,
            outputHeight: sizeDecision.outputHeight
          });
        } catch (error) {
          warnings.push(`Image fitting failed; original kept. ${String(error)}`);
        }
      } else {
        warnings.push("sharp not available; returning original generated image.");
      }
      const finalBuffer = fittedBuffer || originalBuffer;

      if (previewOnly) {
        const previewId = randomSuffix();
        await fs.mkdir(previewCacheDir, { recursive: true });
        const previewFilename = `${previewId}.png`;
        const previewPath = path.join(previewCacheDir, previewFilename);
        await saveBufferAsPng(previewPath, finalBuffer);
        await registerPreviewEntry(previewId, {
          filename: previewFilename,
          createdAt: new Date().toISOString(),
          prompt: prompt.slice(0, 200)
        });
        res.json({
          ok: true,
          model,
          previewOnly: true,
          previewId,
          imageUrl: `/api/ai/preview-image/${previewId}`,
          sizeDecision,
          warnings
        });
        return;
      }

      const generatedDir = await ensureImageSubdir("generated");
      const stem = safeFilenameStem(prompt).slice(0, 48);
      const suffix = randomSuffix();
      const originalPath = path.join(generatedDir, `${stem}-original-${suffix}.png`);
      await saveBufferAsPng(originalPath, originalBuffer);
      let finalPath = originalPath;
      if (fittedBuffer) {
        const fittedPath = path.join(generatedDir, `${stem}-fitted-${suffix}.png`);
        await saveBufferAsPng(fittedPath, fittedBuffer);
        finalPath = fittedPath;
      }
      res.json({
        ok: true,
        model,
        previewOnly: false,
        imageUrl: projectImageUrlFromAbsolute(finalPath),
        originalImageUrl: finalPath === originalPath ? undefined : projectImageUrlFromAbsolute(originalPath),
        sizeDecision,
        warnings
      });
    } catch (error) {
      res.status(502).json({
        ok: false,
        unavailable: true,
        message: `Image generation failed: ${String(error)}`,
        sizeDecision,
        warnings
      });
    }
  });

  app.get("/api/ai/preview-image/:id", async (req, res) => {
    const id = String(req.params.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    if (!id) {
      res.status(400).type("text/plain").send("Invalid preview id");
      return;
    }
    const filePath = path.join(previewCacheDir, `${id}.png`);
    try {
      await fs.access(filePath);
      res.set("Cache-Control", "private, max-age=300");
      res.sendFile(filePath);
    } catch {
      res.status(404).type("text/plain").send("Preview not found or expired");
    }
  });

  app.post("/api/ai/preview-image/:id/promote", async (req, res) => {
    const id = String(req.params.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    if (!id) {
      res.status(400).json({ ok: false, error: "Invalid preview id" });
      return;
    }
    const srcPath = path.join(previewCacheDir, `${id}.png`);
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(srcPath);
    } catch {
      res.status(404).json({ ok: false, error: "Preview not found" });
      return;
    }
    const generatedDir = await ensureImageSubdir("generated");
    const stem = safeFilenameStem(String(req.body?.promptHint || "preview")).slice(0, 48);
    const suffix = randomSuffix();
    const finalPath = path.join(generatedDir, `${stem}-promoted-${suffix}.png`);
    await saveBufferAsPng(finalPath, buffer);
    try { await fs.unlink(srcPath); } catch { /* ignore */ }
    await unregisterPreviewEntry(id);
    res.json({
      ok: true,
      imageUrl: projectImageUrlFromAbsolute(finalPath),
      promotedFrom: id
    });
  });

  app.delete("/api/ai/preview-image/:id", async (req, res) => {
    const id = String(req.params.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    if (!id) {
      res.status(400).json({ ok: false, error: "Invalid preview id" });
      return;
    }
    const srcPath = path.join(previewCacheDir, `${id}.png`);
    try { await fs.unlink(srcPath); } catch { /* ignore */ }
    await unregisterPreviewEntry(id);
    res.json({ ok: true, discarded: id });
  });

  async function handleImageEdit(req: express.Request, res: express.Response): Promise<void> {
    const editType = String(req.body?.editType || "custom");
    const instruction = String(req.body?.instruction || "");
    const targetContext = parseTargetContext(req.body?.targetContext);
    const sizeDecision = decideImageSize(targetContext);
    const warnings: string[] = [...sizeDecision.warnings];

    const sourceInput = String(req.body?.imagePath || req.body?.imageUrl || targetContext.currentImagePath || "").trim();
    if (!sourceInput) {
      res.status(400).json({ ok: false, error: "imagePath is required", sizeDecision, warnings });
      return;
    }

    let sourcePath: string;
    try {
      sourcePath = resolveProjectImageAbsolutePath(sourceInput);
      await fs.access(sourcePath);
    } catch (error) {
      res.status(400).json({ ok: false, error: `Invalid imagePath: ${String(error)}`, sizeDecision, warnings });
      return;
    }

    const originalImageUrl = projectImageUrlFromAbsolute(sourcePath);
    const keyStatus = await getImageApiKeyStatus();
    const key = keyStatus.analyzeKey;
    const model = process.env.SBUILD_IMAGE_EDIT_MODEL || process.env.SBUILD_IMAGE_MODEL || "gpt-image-1";
    const editedDir = await ensureImageSubdir("edited");
    const suffix = randomSuffix();
    const stem = safeFilenameStem(path.basename(sourcePath, path.extname(sourcePath)));

    if (key) {
      try {
        const sourceBuffer = await fs.readFile(sourcePath);
        const prompt = inferPromptForEdit(editType, instruction, sizeDecision);
        const form = new FormData();
        form.append("model", model);
        form.append("prompt", prompt);
        form.append("size", sizeDecision.providerSize);
        form.append("image", new Blob([sourceBuffer]), `${stem}.png`);

        const maskPath = String(req.body?.maskPath || "").trim();
        if (maskPath) {
          try {
            const absoluteMask = resolveProjectImageAbsolutePath(maskPath);
            const maskBuffer = await fs.readFile(absoluteMask);
            form.append("mask", new Blob([maskBuffer]), "mask.png");
          } catch {
            warnings.push("maskPath ignored because mask file could not be loaded.");
          }
        }

        const response = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: form
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
          data?: Array<{ b64_json?: string; url?: string }>;
        };

        if (!response.ok) {
          warnings.push(payload.error?.message || `OpenAI edit failed: ${response.status}`);
        } else {
          const editedItem = payload.data?.[0];
          if (editedItem?.b64_json || editedItem?.url) {
            const editedBuffer = editedItem.b64_json
              ? Buffer.from(editedItem.b64_json, "base64")
              : await fetchUrlToBuffer(editedItem.url!);
            const editedPath = path.join(editedDir, `${stem}-openai-${suffix}.png`);
            await saveBufferAsPng(editedPath, editedBuffer);
            res.json({
              ok: true,
              editedImageUrl: projectImageUrlFromAbsolute(editedPath),
              originalImageUrl,
              editType,
              sizeDecision,
              warnings
            });
            return;
          }
          warnings.push("OpenAI edit returned no image content.");
        }
      } catch (error) {
        warnings.push(`OpenAI edit failed, trying local fallback. ${String(error)}`);
      }
    } else {
      warnings.push("OpenAI key missing; using local fallback when supported.");
    }

    if (!localSharpEditTypes.has(editType)) {
      res.status(200).json({
        ok: false,
        unavailable: true,
        message: `Edit type '${editType}' requires OpenAI edit support.`,
        originalImageUrl,
        editType,
        sizeDecision,
        warnings
      });
      return;
    }

    const sharpMod = await loadSharp();
    if (!sharpMod) {
      warnings.push("sharp not available for local fallback edits.");
      res.status(200).json({
        ok: false,
        unavailable: true,
        message: "Local photo edit fallback unavailable because sharp is not installed.",
        originalImageUrl,
        editType,
        sizeDecision,
        warnings
      });
      return;
    }

    try {
      const sourceBuffer = await fs.readFile(sourcePath);
      const editedBuffer = await applyLocalEditWithSharp({
        input: sourceBuffer,
        editType,
        cropMode: sizeDecision.cropMode,
        outputWidth: sizeDecision.outputWidth,
        outputHeight: sizeDecision.outputHeight
      });
      const editedPath = path.join(editedDir, `${stem}-${editType}-${suffix}.png`);
      await saveBufferAsPng(editedPath, editedBuffer);
      res.json({
        ok: true,
        editedImageUrl: projectImageUrlFromAbsolute(editedPath),
        originalImageUrl,
        editType,
        sizeDecision,
        warnings
      });
    } catch (error) {
      warnings.push(`Local fallback failed: ${String(error)}`);
      res.status(200).json({
        ok: false,
        unavailable: true,
        message: "Local photo edit fallback unavailable in this environment.",
        originalImageUrl,
        editType,
        sizeDecision,
        warnings
      });
    }
  }

  app.post("/api/images/edit", async (req, res) => {
    await handleImageEdit(req, res);
  });

  app.post("/api/ai/image-edit", async (req, res) => {
    await handleImageEdit(req, res);
  });

  app.post("/api/ai/wizard", async (req, res) => {
    try {
      const patch = wizardFallback(req.body || {});
      const project = await loadProject();
      const merged = {
        ...project,
        ...patch,
        site: { ...project.site, ...(patch.site || {}) },
        globalStyles: { ...project.globalStyles, ...(patch.globalStyles || {}) }
      };
      await saveProject(merged as SBuildProject);
      res.json({ ok: true, project: merged, provider: "fallback" });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error) });
    }
  });

  async function loadSecrets(): Promise<Record<string, unknown>> {
    try {
      const text = await fs.readFile(secretsFile, "utf-8");
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  async function saveSecrets(secrets: Record<string, unknown>): Promise<void> {
    await fs.writeFile(secretsFile, JSON.stringify(secrets, null, 2), "utf-8");
  }

  function normalizeLocalModels(models: LocalModelInfo[]): LocalModelInfo[] {
    const seen = new Set<string>();
    return models
      .map((model) => ({
        name: String(model.name || "").trim(),
        size: model.size,
        modified: model.modified,
        parameterSize: model.parameterSize
      }))
      .filter((model) => model.name)
      .filter((model) => {
        if (seen.has(model.name)) return false;
        seen.add(model.name);
        return true;
      })
      .sort((a, b) => {
        if (a.name === DEFAULT_LOCAL_CHAT_MODEL) return -1;
        if (b.name === DEFAULT_LOCAL_CHAT_MODEL) return 1;
        return a.name.localeCompare(b.name);
      });
  }

  function preferredLocalModelName(models: LocalModelInfo[], configuredModel?: string): string | null {
    const normalized = normalizeLocalModels(models);
    const preferred = String(configuredModel || process.env.SBUILD_OLLAMA_MODEL || "").trim();
    if (preferred && normalized.some((model) => model.name === preferred)) return preferred;
    if (normalized.some((model) => model.name === DEFAULT_LOCAL_CHAT_MODEL)) return DEFAULT_LOCAL_CHAT_MODEL;
    return normalized[0]?.name || null;
  }

  function isSmallLocalModel(modelName: string | null | undefined): boolean {
    const name = String(modelName || "");
    if (!name) return false;
    if (/^qwen2\.5:1\.5/i.test(name)) return true;
    if (/^qwen2\.5:(\d+(\.\d+)?)b/i.test(name)) {
      const match = name.match(/^qwen2\.5:(\d+(\.\d+)?)b/i);
      if (match && Number(match[1]) <= 3) return true;
    }
    if (/^qwen2\.5:0\.5/i.test(name)) return true;
    return false;
  }

  function maskKey(key: string): string {
    if (key.length <= 8) return "****";
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }

  function detectOpenCode(): { detected: boolean; path?: string; message: string } {
    const configuredPath = process.env.OPENCODE_CLI_PATH || (process.env.PATH || "").split(":").find((p) => p.includes("opencode"));
    if (configuredPath) {
      return { detected: true, path: configuredPath, message: "OpenCode path configured" };
    }
    return { detected: false, message: "OpenCode CLI not detected. Set OPENCODE_CLI_PATH or ensure 'opencode' is in PATH." };
  }

  function checkOpenCodeAuth(): { status: "connected" | "not_configured" | "unknown"; message: string; commands: string[]; output?: string } {
    const baseCommands = ["opencode auth status", "opencode auth login"];
    const detected = detectOpenCode();
    if (!detected.detected) {
      return { status: "not_configured", message: "OpenCode CLI not detected. Run OpenCode login/auth in terminal, then click Check again.", commands: baseCommands };
    }
    const help = spawnSync("opencode", ["auth", "--help"], { encoding: "utf-8", timeout: 4000 });
    const status = spawnSync("opencode", ["auth", "status"], { encoding: "utf-8", timeout: 4000 });
    const helpText = `${help.stdout || ""}\n${help.stderr || ""}`;
    const providerCommands = ["openai", "kimi", "zai"]
      .filter((name) => helpText.toLowerCase().includes(name))
      .map((name) => `opencode auth login ${name}`);
    const output = `${status.stdout || ""} ${status.stderr || ""}`.trim();
    if (status.status === 0) {
      return { status: "connected", message: "OpenCode auth status command succeeded.", commands: [...baseCommands, ...providerCommands], output };
    }
    return {
      status: "unknown",
      message: "OpenCode auth status unavailable. Run OpenCode login/auth in terminal, then click Check again.",
      commands: [...baseCommands, ...providerCommands],
      output
    };
  }

  async function getImageApiKeyStatus(): Promise<{ genKey: string; genSource: string; analyzeKey: string; analyzeSource: string }> {
    const envGen = process.env.OPENAI_API_KEY || process.env.SBUILD_OPENAI_IMAGE_API_KEY || "";
    const envAnalyze = process.env.OPENAI_API_KEY || process.env.SBUILD_OPENAI_ANALYZE_API_KEY || "";
    const secrets = await loadSecrets();
    const localGen = String((secrets as Record<string, unknown>).imageGenApiKey || "");
    const localAnalyze = String((secrets as Record<string, unknown>).imageAnalyzeApiKey || "");

    const genKey = envGen || localGen;
    const genSource = envGen ? "env" : localGen ? "local" : "missing";
    const analyzeKey = envAnalyze || localAnalyze;
    const analyzeSource = envAnalyze ? "env" : localAnalyze ? "local" : "missing";

    return { genKey, genSource, analyzeKey, analyzeSource };
  }

  type KeySource = "env" | "local" | "missing";
  type ChatProviderMode = "auto" | "local" | "openai" | "openrouter";
  type ChatProviderId = "local" | "openai" | "openrouter";
  type ProviderReachability = "reachable" | "unreachable" | "untested";
  type ProviderErrorCategory = "timeout" | "missing-key" | "request-failed" | "no-content" | "ollama-unreachable" | "not-tested" | "unknown";

  type ProviderCredentialStatus = {
    key: string;
    source: KeySource;
  };

  type ChatProviderConfig = {
    mode: ChatProviderMode;
    localModel: string;
    openaiModel: string;
    openrouterModel: string;
    fallbackEnabled: boolean;
    fallbackTimeoutSec: number;
  };

  function normalizeProviderMode(value: unknown): ChatProviderMode {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "local" || raw === "ollama") return "local";
    if (raw === "openai" || raw === "openai-compatible") return "openai";
    if (raw === "openrouter") return "openrouter";
    return "auto";
  }

  function sanitizeFallbackTimeoutSec(value: unknown): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_LOCAL_FALLBACK_TIMEOUT_SEC;
    return Math.max(3, Math.min(60, Math.round(num)));
  }

  async function getOpenAIChatKeyStatus(): Promise<ProviderCredentialStatus> {
    const envKey = process.env.SBUILD_OPENAI_CHAT_API_KEY || process.env.OPENAI_API_KEY || "";
    const secrets = await loadSecrets();
    const localKey = String((secrets as Record<string, unknown>).openaiChatApiKey || (secrets as Record<string, unknown>).chatApiKey || "").trim();
    return {
      key: envKey || localKey,
      source: envKey ? "env" : localKey ? "local" : "missing"
    };
  }

  async function getOpenRouterKeyStatus(): Promise<ProviderCredentialStatus> {
    const envKey = process.env.SBUILD_OPENROUTER_API_KEY || "";
    const secrets = await loadSecrets();
    const localKey = String((secrets as Record<string, unknown>).openrouterChatApiKey || "").trim();
    return {
      key: envKey || localKey,
      source: envKey ? "env" : localKey ? "local" : "missing"
    };
  }

  async function getChatApiKeyStatus(): Promise<{ chatKey: string; chatSource: KeySource }> {
    const openai = await getOpenAIChatKeyStatus();
    return { chatKey: openai.key, chatSource: openai.source };
  }

  async function getChatProviderConfig(): Promise<ChatProviderConfig> {
    const secrets = await loadSecrets();
    const s = secrets as Record<string, unknown>;
    const mode = normalizeProviderMode(s.chatProviderMode || s.chatProvider || "auto");
    const ollama = await getOllamaStatus();
    let localModel = String(s.chatLocalModel || "").trim();
    const legacyModel = String(s.chatModel || "").trim();
    if (!localModel && (mode === "local" || mode === "auto")) {
      localModel = legacyModel;
    }
    if (localModel === OLD_DEFAULT_LOCAL_CHAT_MODEL && !s._chatModelMigrated) {
      if (ollama.models.some((m) => m.name === DEFAULT_LOCAL_CHAT_MODEL)) {
        localModel = DEFAULT_LOCAL_CHAT_MODEL;
        secrets.chatLocalModel = DEFAULT_LOCAL_CHAT_MODEL;
        secrets._chatModelMigrated = true;
        await saveSecrets(secrets);
      }
    }
    if (!localModel) {
      localModel = preferredLocalModelName(ollama.models, DEFAULT_LOCAL_CHAT_MODEL) || DEFAULT_LOCAL_CHAT_MODEL;
    }
    return {
      mode,
      localModel,
      openaiModel: String(s.chatOpenAIModel || (mode === "openai" ? legacyModel : "") || process.env.SBUILD_CHAT_MODEL || DEFAULT_OPENAI_CHAT_MODEL).trim() || DEFAULT_OPENAI_CHAT_MODEL,
      openrouterModel: String(s.chatOpenRouterModel || (mode === "openrouter" ? legacyModel : "") || process.env.SBUILD_OPENROUTER_CHAT_MODEL || DEFAULT_OPENROUTER_CHAT_MODEL).trim() || DEFAULT_OPENROUTER_CHAT_MODEL,
      fallbackEnabled: s.chatFallbackEnabled === undefined ? true : Boolean(s.chatFallbackEnabled),
      fallbackTimeoutSec: sanitizeFallbackTimeoutSec(s.chatFallbackTimeoutSec)
    };
  }

  async function saveChatProviderConfig(cfg: {
    providerMode?: string;
    localModel?: string;
    openaiModel?: string;
    openrouterModel?: string;
    fallbackEnabled?: boolean;
    fallbackTimeoutSec?: number;
    openaiApiKey?: string;
    openrouterApiKey?: string;
  }): Promise<void> {
    const secrets = await loadSecrets();
    if (cfg.providerMode !== undefined) secrets.chatProviderMode = normalizeProviderMode(cfg.providerMode);
    if (cfg.localModel !== undefined) secrets.chatLocalModel = String(cfg.localModel || "").trim();
    if (cfg.openaiModel !== undefined) secrets.chatOpenAIModel = String(cfg.openaiModel || "").trim();
    if (cfg.openrouterModel !== undefined) secrets.chatOpenRouterModel = String(cfg.openrouterModel || "").trim();
    if (cfg.fallbackEnabled !== undefined) secrets.chatFallbackEnabled = Boolean(cfg.fallbackEnabled);
    if (cfg.fallbackTimeoutSec !== undefined) secrets.chatFallbackTimeoutSec = sanitizeFallbackTimeoutSec(cfg.fallbackTimeoutSec);
    if (cfg.openaiApiKey !== undefined) {
      const cleaned = sanitizeApiKeyInput(cfg.openaiApiKey);
      if (cleaned) {
        secrets.openaiChatApiKey = cleaned;
        secrets.chatApiKey = cleaned;
      }
    }
    if (cfg.openrouterApiKey !== undefined) {
      const cleaned = sanitizeApiKeyInput(cfg.openrouterApiKey);
      if (cleaned) secrets.openrouterChatApiKey = cleaned;
    }
    delete secrets.chatProvider;
    delete secrets.chatModel;
    delete secrets.chatBaseUrl;
    await saveSecrets(secrets);
  }

  type ChatProviderResult = {
    provider: ChatProviderId | "none";
    source: "local" | KeySource;
    available: boolean;
    response: string;
    model?: string;
    message?: string;
    latencyMs?: number;
    isLocal?: boolean;
    errorCategory?: ProviderErrorCategory | null;
    fallbackUsed?: boolean;
    fallbackFrom?: ChatProviderId | null;
    fallbackReason?: string | null;
  };

  type StructuredSuggestionProposal = {
    kind: "replace-copy";
    replaceText: string;
    targetField?: string;
  };

  function preferredApiProvider(openai: ProviderCredentialStatus, openrouter: ProviderCredentialStatus): "openai" | "openrouter" | null {
    if (openai.source !== "missing") return "openai";
    if (openrouter.source !== "missing") return "openrouter";
    return null;
  }

  function runtimeIdentityPrompt(input: { provider: string; model?: string; source: "local" | "env" | "missing" }): string {
    const model = input.model || "unknown";
    const locality = input.source === "local" ? "local" : input.source === "env" ? "remote" : "unconfigured";
    return [
      "You are a concise website editing assistant for sBuild.",
      `Runtime chat provider: ${input.provider}.`,
      `Runtime chat model: ${model}.`,
      `Runtime source: ${input.source}.`,
      `This chat is ${locality}.`,
      "If the user asks what model or provider is in use, answer using the runtime metadata above.",
      "Do not claim to be a cloud-hosted provider when runtime metadata says local.",
      "Keep replies brief and do not include chain-of-thought or hidden reasoning."
    ].join(" ");
  }

  function isRuntimeIdentityQuestion(prompt: string): boolean {
    return /(what|which).*(model|provider)|are you local|running locally|what are you using/i.test(prompt);
  }

  function parseStructuredSuggestionProposal(text: string): StructuredSuggestionProposal | null {
    const candidates = [text.trim()];
    const fencedMatches = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((match) => String(match[1] || "").trim());
    candidates.push(...fencedMatches);
    for (const candidate of candidates) {
      if (!candidate.startsWith("{")) continue;
      try {
        const parsed = JSON.parse(candidate) as Record<string, unknown>;
        if (parsed.kind === "replace-copy" && typeof parsed.replaceText === "string" && parsed.replaceText.trim()) {
          const targetField = typeof parsed.targetField === "string" && parsed.targetField.trim()
            ? parsed.targetField.trim()
            : undefined;
          return { kind: "replace-copy", replaceText: parsed.replaceText.trim(), targetField };
        }
      } catch {
        // ignore malformed candidate
      }
    }
    return null;
  }

  function isQuestionPrompt(prompt: string): boolean {
    const trimmed = prompt.trim().toLowerCase();
    if (/^(what|who|when|where|why|how|is |are |can |do |does |did |will |would |could |should |tell me|explain|are you sure|really|confirm)\b/i.test(trimmed)) {
      if (/(replace|rewrite|change|update|make it|set it|write|suggest a better|rephrase|reword|improve|fix|make the|change the|set the|put |use |switch)/i.test(trimmed)) {
        return false;
      }
      return true;
    }
    return false;
  }

  function inferTargetField(prompt: string, blockType: string): string | undefined {
    const lower = prompt.toLowerCase();
    const headingWords = /\b(title|heading|headline|head line)\b/;
    const subheadingWords = /\b(description|subheading|subtitle|tagline)\b/;
    const bodyWords = /\b(body|intro|text|copy|paragraph|about|blurb|detail|summary)\b/;
    if (headingWords.test(lower)) return "heading";
    if (subheadingWords.test(lower)) return "subheading";
    if (bodyWords.test(lower)) return "body";
    if (blockType === "hero") return "subheading";
    if (blockType === "text") return "body";
    return undefined;
  }

  function fieldInstructionFromPrompt(prompt: string, blockType: string): string {
    const field = inferTargetField(prompt, blockType);
    if (!field) return "";
    const labels: Record<string, string> = {
      heading: "heading/title",
      subheading: "subheading/description",
      body: "body text"
    };
    return `The user is targeting the ${labels[field] || field} field. `;
  }

  function stripProposalJsonFromText(text: string): string {
    let cleaned = text;
    cleaned = cleaned.replace(/```json\s*\{[\s\S]*?"kind"\s*:\s*"replace-copy"[\s\S]*?```/gi, "").trim();
    cleaned = cleaned.replace(/\{\s*"kind"\s*:\s*"replace-copy"\s*,\s*"replaceText"\s*:\s*"[^"]*"\s*\}/g, "").trim();
    if (cleaned) return cleaned;
    const inlineMatch = text.match(/"replaceText"\s*:\s*"([^"]+)"/);
    if (inlineMatch) return `The suggested replacement is: "${inlineMatch[1]}"`;
    return "The model returned a structured suggestion. Please try rephrasing your question.";
  }

  async function getOllamaStatus(): Promise<{ reachable: boolean; endpoint: string; model: string | null; models: LocalModelInfo[]; message: string }> {
    const endpoint = process.env.SBUILD_OLLAMA_ENDPOINT || DEFAULT_OLLAMA_ENDPOINT;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(`${endpoint}/api/tags`, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) {
        return { reachable: false, endpoint, model: null, models: [], message: `Ollama unreachable (${response.status}).` };
      }
      const payload = (await response.json().catch(() => ({}))) as {
        models?: Array<{ name?: string; size?: number; modified_at?: string; details?: { parameter_size?: string } }>;
      };
      const models = normalizeLocalModels((payload.models || []).map((m) => ({
        name: String(m.name || ""),
        size: m.size,
        modified: m.modified_at,
        parameterSize: m.details?.parameter_size
      })));
      if (models.length === 0) {
        return { reachable: true, endpoint, model: null, models, message: "Ollama reachable but no local models installed." };
      }
      const model = preferredLocalModelName(models) || null;
      return { reachable: true, endpoint, model, models, message: model ? `Ollama reachable. Preferred local model: ${model}.` : "Ollama reachable but no local models installed." };
    } catch {
      return { reachable: false, endpoint, model: null, models: [], message: "Ollama not reachable on localhost." };
    }
  }

  async function runLocalChat(prompt: string, chatHistory: Array<{ role: string; text: string }> | undefined, config: ChatProviderConfig): Promise<ChatProviderResult> {
    const cleanPrompt = prompt.trim();
    const startedAt = Date.now();
    const ollama = await getOllamaStatus();
    if (!ollama.reachable || !ollama.model) {
      return {
        provider: "local",
        source: "local",
        available: false,
        response: "AI chat unavailable: local Ollama is not reachable.",
        model: config.localModel,
        message: "Local Ollama is not reachable.",
        latencyMs: Date.now() - startedAt,
        isLocal: true,
        errorCategory: "ollama-unreachable"
      };
    }
    const modelToUse = preferredLocalModelName(ollama.models, config.localModel) || ollama.model;
    if (isRuntimeIdentityQuestion(cleanPrompt)) {
      return {
        provider: "local",
        source: "local",
        available: true,
        response: `Local Ollama model: ${modelToUse}.`,
        model: modelToUse,
        message: `Local Ollama model: ${modelToUse}.`,
        latencyMs: Date.now() - startedAt,
        isLocal: true,
        errorCategory: null
      };
    }
    try {
      const systemPrompt = [
        "You are a helpful assistant for sBuild, a website editor.",
        "Give short, direct, plain-text answers.",
        "Do NOT wrap your answer in JSON unless the user explicitly asks for JSON.",
        "Do NOT include your reasoning process or thinking steps.",
        "CRITICAL: When asked to write website copy (headline, description, subheading, body, tagline, intro, blurb, about text, or any on-page text), output ONLY the actual words a website visitor would read. No labels, no explanations, no meta-commentary.",
        "BAD examples (never do this): 'The hero block showcases our latest product launch...', 'This section features a call to action...', 'Here is a suggested description: ...', 'A great headline would be: ...'",
        "GOOD examples: 'Fresh eggs, seasonal produce, and small-batch farm goods grown close to home.', 'Hand-picked daily from our fields to your table.'",
        "When suggesting replacement copy, use a fenced ```json block with {\"kind\":\"replace-copy\",\"replaceText\":\"...\",\"targetField\":\"heading or subheading or body\"}.",
        "Otherwise answer normally with plain text."
      ].join(" ");
      const messages: Array<{ role: string; content: string }> = [{ role: "system", content: systemPrompt }];
      for (const msg of (chatHistory || []).slice(-5)) {
        if (msg.role === "user" || msg.role === "assistant") messages.push({ role: msg.role, content: msg.text });
      }
      messages.push({ role: "user", content: `${cleanPrompt}\n\nPlease respond concisely and directly. Do not include your reasoning process.` });
      const timeoutMs = config.fallbackTimeoutSec * 1000;
      const requestBody: Record<string, unknown> = {
        model: modelToUse,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: isSmallLocalModel(modelToUse) ? 200 : 512
        },
        messages
      };
      if (modelToUse.startsWith("qwen3")) requestBody.think = false;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(`${ollama.endpoint}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(requestBody)
      });
      clearTimeout(timer);
      const payload = (await response.json().catch(() => ({}))) as { message?: { content?: string; thinking?: string } };
      let text = String(payload.message?.content || "").trim();
      if (!text && payload.message?.thinking) text = String(payload.message.thinking).trim();
      if (response.ok && text) {
        return {
          provider: "local",
          source: "local",
          available: true,
          response: text,
          model: modelToUse,
          message: `Local Ollama answered with ${modelToUse}.`,
          latencyMs: Date.now() - startedAt,
          isLocal: true,
          errorCategory: null
        };
      }
      return {
        provider: "local",
        source: "local",
        available: false,
        response: "AI chat unavailable: local Ollama returned no content.",
        model: modelToUse,
        message: `Local Ollama returned no content for ${modelToUse}.`,
        latencyMs: Date.now() - startedAt,
        isLocal: true,
        errorCategory: "no-content"
      };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      return {
        provider: "local",
        source: "local",
        available: false,
        response: timedOut
          ? `Local Ollama timed out after ${config.fallbackTimeoutSec}s.`
          : "AI chat unavailable: local Ollama request failed.",
        model: modelToUse,
        message: timedOut
          ? `Local Ollama timed out after ${config.fallbackTimeoutSec}s.`
          : "Local Ollama request failed.",
        latencyMs: Date.now() - startedAt,
        isLocal: true,
        errorCategory: timedOut ? "timeout" : "request-failed"
      };
    }
  }

  async function runApiChat(provider: "openai" | "openrouter", prompt: string, chatHistory: Array<{ role: string; text: string }> | undefined, config: ChatProviderConfig): Promise<ChatProviderResult> {
    const startedAt = Date.now();
    const keyStatus = provider === "openai" ? await getOpenAIChatKeyStatus() : await getOpenRouterKeyStatus();
    const model = provider === "openai" ? config.openaiModel : config.openrouterModel;
    if (!keyStatus.key) {
      return {
        provider,
        source: "missing",
        available: false,
        response: `AI chat unavailable: ${provider === "openai" ? "OpenAI" : "OpenRouter"} key is not configured.`,
        model,
        message: `${provider === "openai" ? "OpenAI" : "OpenRouter"} key is not configured.`,
        latencyMs: Date.now() - startedAt,
        isLocal: false,
        errorCategory: "missing-key"
      };
    }
    try {
      const baseUrl = provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1";
      const messages: Array<{ role: string; content: string }> = [
        { role: "system", content: runtimeIdentityPrompt({ provider, model, source: keyStatus.source }) }
      ];
      for (const msg of (chatHistory || []).slice(-5)) {
        if (msg.role === "user" || msg.role === "assistant") messages.push({ role: msg.role, content: msg.text });
      }
      messages.push({ role: "user", content: prompt.trim() });
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keyStatus.key}`
      };
      if (provider === "openrouter") {
        headers["HTTP-Referer"] = "https://sbuilder.blackfishfarms.com";
        headers["X-Title"] = "sBuild";
      }
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model, messages, temperature: 0.2 })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = String(payload.choices?.[0]?.message?.content || "").trim();
      if (response.ok && text) {
        return {
          provider,
          source: keyStatus.source,
          available: true,
          response: text,
          model,
          message: `${provider === "openai" ? "OpenAI" : "OpenRouter"} answered with ${model}.`,
          latencyMs: Date.now() - startedAt,
          isLocal: false,
          errorCategory: null
        };
      }
      return {
        provider,
        source: keyStatus.source,
        available: false,
        response: "AI chat unavailable: provider returned no content.",
        model,
        message: payload.error?.message || `${provider === "openai" ? "OpenAI" : "OpenRouter"} returned no content.`,
        latencyMs: Date.now() - startedAt,
        isLocal: false,
        errorCategory: "no-content"
      };
    } catch {
      return {
        provider,
        source: keyStatus.source,
        available: false,
        response: "AI chat unavailable: provider request failed.",
        model,
        message: `${provider === "openai" ? "OpenAI" : "OpenRouter"} request failed.`,
        latencyMs: Date.now() - startedAt,
        isLocal: false,
        errorCategory: "request-failed"
      };
    }
  }

  async function chatWithProviders(prompt: string, chatHistory?: Array<{ role: string; text: string }>): Promise<ChatProviderResult> {
    const cleanPrompt = prompt.trim();
    const startedAt = Date.now();
    if (!cleanPrompt) {
      return {
        provider: "none",
        source: "missing",
        available: false,
        response: "AI chat unavailable: prompt is empty.",
        message: "prompt is required",
        latencyMs: Date.now() - startedAt,
        isLocal: false,
        errorCategory: "unknown"
      };
    }
    const config = await getChatProviderConfig();
    const openaiKey = await getOpenAIChatKeyStatus();
    const openrouterKey = await getOpenRouterKeyStatus();
    const apiFallbackProvider = preferredApiProvider(openaiKey, openrouterKey);
    const primaryProvider: ChatProviderId = config.mode === "auto"
      ? (apiFallbackProvider || "local")
      : config.mode;
    const runPrimary = async (): Promise<ChatProviderResult> => {
      if (primaryProvider === "local") return runLocalChat(cleanPrompt, chatHistory, config);
      return runApiChat(primaryProvider, cleanPrompt, chatHistory, config);
    };
    const primary = await runPrimary();
    if (primary.available) return primary;
    if (primaryProvider === "local" && config.fallbackEnabled && apiFallbackProvider) {
      const fallback = await runApiChat(apiFallbackProvider, cleanPrompt, chatHistory, config);
      if (fallback.available) {
        return {
          ...fallback,
          fallbackUsed: true,
          fallbackFrom: "local",
          fallbackReason: primary.message || "Local Ollama failed."
        };
      }
    }
    if ((primaryProvider === "openai" || primaryProvider === "openrouter") && config.mode === "auto") {
      const fallback = await runLocalChat(cleanPrompt, chatHistory, config);
      if (fallback.available) {
        return {
          ...fallback,
          fallbackUsed: true,
          fallbackFrom: primaryProvider,
          fallbackReason: primary.message || `${primaryProvider} failed.`
        };
      }
    }
    if (primaryProvider === "local" && primary.errorCategory === "timeout" && !config.fallbackEnabled) {
      return {
        ...primary,
        response: `Local Ollama timed out after ${config.fallbackTimeoutSec}s and API fallback is disabled.`,
        message: `Local Ollama timed out after ${config.fallbackTimeoutSec}s and API fallback is disabled.`,
        fallbackUsed: false,
        fallbackFrom: null,
        fallbackReason: "API fallback disabled."
      };
    }
    if (primaryProvider === "local" && primary.errorCategory === "timeout" && !apiFallbackProvider) {
      return {
        ...primary,
        response: `Local Ollama timed out after ${config.fallbackTimeoutSec}s and no API fallback is configured.`,
        message: `Local Ollama timed out after ${config.fallbackTimeoutSec}s and no API fallback is configured.`,
        fallbackUsed: false,
        fallbackFrom: null,
        fallbackReason: "No API fallback configured."
      };
    }
    return primary;
  }

  type ProviderTestSummary = {
    provider: ChatProviderId;
    configured: boolean;
    reachability: ProviderReachability;
    ok: boolean;
    result: "passed" | "failed" | "unconfigured" | "untested";
    model: string | null;
    latencyMs: number | null;
    testedAt: string;
    errorCategory: ProviderErrorCategory | null;
    message: string;
  };

  let lastProviderTests: Record<ChatProviderId, ProviderTestSummary> = {
    local: { provider: "local", configured: false, reachability: "untested", ok: false, result: "untested", model: null, latencyMs: null, testedAt: new Date(0).toISOString(), errorCategory: "not-tested", message: "Not tested yet." },
    openai: { provider: "openai", configured: false, reachability: "untested", ok: false, result: "untested", model: null, latencyMs: null, testedAt: new Date(0).toISOString(), errorCategory: "not-tested", message: "Not tested yet." },
    openrouter: { provider: "openrouter", configured: false, reachability: "untested", ok: false, result: "untested", model: null, latencyMs: null, testedAt: new Date(0).toISOString(), errorCategory: "not-tested", message: "Not tested yet." }
  };

  async function runProviderTest(provider: ChatProviderId): Promise<ProviderTestSummary> {
    const config = await getChatProviderConfig();
    const startedAt = Date.now();
    const result = provider === "local"
      ? await runLocalChat("Reply with the single word: hi", [], config)
      : await runApiChat(provider, "Reply with the single word: hi", [], config);
    const credentials = provider === "openai" ? await getOpenAIChatKeyStatus() : provider === "openrouter" ? await getOpenRouterKeyStatus() : { key: "", source: "local" as const };
    const summary: ProviderTestSummary = {
      provider,
      configured: provider === "local" ? true : credentials.source !== "missing",
      reachability: result.available ? "reachable" : result.errorCategory === "missing-key" ? "untested" : "unreachable",
      ok: result.available,
      result: result.available ? "passed" : (result.errorCategory === "missing-key" ? "unconfigured" : "failed"),
      model: result.model || null,
      latencyMs: Date.now() - startedAt,
      testedAt: new Date().toISOString(),
      errorCategory: result.errorCategory || null,
      message: result.message || result.response
    };
    lastProviderTests[provider] = summary;
    return summary;
  }

  async function getChatProviderStatus(): Promise<{
    mode: ChatProviderMode;
    provider: ChatProviderId;
    model: string;
    message: string;
    source: "local" | KeySource;
    fallbackEnabled: boolean;
    fallbackTimeoutSec: number;
    localModels: Array<{ name: string }>;
    cards: Array<{
      name: string;
      provider: ChatProviderId;
      model: string;
      status: "configured" | "unconfigured" | "reachable" | "unreachable" | "untested";
      configured: boolean;
      reachability: ProviderReachability;
      keySource: KeySource;
      maskedKey: string | null;
      message: string;
      lastTest: ProviderTestSummary;
    }>;
  }> {
    const config = await getChatProviderConfig();
    const ollama = await getOllamaStatus();
    const openaiKey = await getOpenAIChatKeyStatus();
    const openrouterKey = await getOpenRouterKeyStatus();
    const localModel = preferredLocalModelName(ollama.models, config.localModel) || config.localModel || DEFAULT_LOCAL_CHAT_MODEL;
    const selectedProvider: ChatProviderId = config.mode === "auto"
      ? (preferredApiProvider(openaiKey, openrouterKey) || "local")
      : config.mode;
    const localModels = ollama.models.map((model) => ({ name: model.name }));
    const cards: Array<{
      name: string;
      provider: ChatProviderId;
      model: string;
      status: "reachable" | "unreachable" | "untested" | "unconfigured" | "configured";
      configured: boolean;
      reachability: ProviderReachability;
      keySource: KeySource;
      maskedKey: string | null;
      message: string;
      lastTest: ProviderTestSummary;
    }> = [
      {
        name: "Local Ollama",
        provider: "local" as const,
        model: localModel,
        configured: Boolean(localModel),
        reachability: ollama.reachable && ollama.model ? "reachable" as ProviderReachability : "unreachable" as ProviderReachability,
        keySource: "missing" as KeySource,
        maskedKey: null,
        message: ollama.reachable && ollama.model
          ? `Configured model: ${localModel}. ${lastProviderTests.local.message}`
          : `Configured model: ${localModel}. Ollama is not reachable on this machine.`,
        lastTest: lastProviderTests.local
      },
      {
        name: "OpenAI",
        provider: "openai" as const,
        model: config.openaiModel,
        configured: openaiKey.source !== "missing",
        reachability: lastProviderTests.openai.result === "untested" ? "untested" as ProviderReachability : lastProviderTests.openai.ok ? "reachable" as ProviderReachability : "unreachable" as ProviderReachability,
        keySource: openaiKey.source,
        maskedKey: openaiKey.key ? maskKey(openaiKey.key) : null,
        message: openaiKey.source === "missing" ? "OpenAI key not configured." : `Masked key present (${openaiKey.source}). ${lastProviderTests.openai.message}`,
        lastTest: lastProviderTests.openai
      },
      {
        name: "OpenRouter",
        provider: "openrouter" as const,
        model: config.openrouterModel,
        configured: openrouterKey.source !== "missing",
        reachability: lastProviderTests.openrouter.result === "untested" ? "untested" as ProviderReachability : lastProviderTests.openrouter.ok ? "reachable" as ProviderReachability : "unreachable" as ProviderReachability,
        keySource: openrouterKey.source,
        maskedKey: openrouterKey.key ? maskKey(openrouterKey.key) : null,
        message: openrouterKey.source === "missing" ? "OpenRouter key not configured." : `Masked key present (${openrouterKey.source}). ${lastProviderTests.openrouter.message}`,
        lastTest: lastProviderTests.openrouter
      }
    ].map((card) => ({
      ...card,
      status: card.reachability === "reachable"
        ? "reachable"
        : card.configured
          ? (card.reachability === "untested" ? "configured" : "unreachable")
          : "unconfigured"
    }));

    return {
      mode: config.mode,
      provider: selectedProvider,
      model: selectedProvider === "local" ? localModel : selectedProvider === "openai" ? config.openaiModel : config.openrouterModel,
      message: `${config.mode === "auto"
        ? `Auto mode prefers ${selectedProvider === "local" ? "Local Ollama" : selectedProvider === "openai" ? "OpenAI" : "OpenRouter"}`
        : `Selected provider: ${selectedProvider === "local" ? "Local Ollama" : selectedProvider === "openai" ? "OpenAI" : "OpenRouter"}`}. Fallback ${config.fallbackEnabled ? `enabled after ${config.fallbackTimeoutSec}s` : "disabled"}.`,
      source: selectedProvider === "local" ? "local" : selectedProvider === "openai" ? openaiKey.source : openrouterKey.source,
      fallbackEnabled: config.fallbackEnabled,
      fallbackTimeoutSec: config.fallbackTimeoutSec,
      localModels,
      cards
    };
  }

  function channelSummaryFromSource(source: "env" | "local" | "missing"): { source: "env" | "local" | "missing"; configured: boolean; status: "connected" | "not_configured" } {
    return {
      source,
      configured: source !== "missing",
      status: source === "missing" ? "not_configured" : "connected"
    };
  }

  app.get("/api/ai/providers/status", async (_req, res) => {
    const openCode = detectOpenCode();
    const keyStatus = await getImageApiKeyStatus();
    const chatStatus = await getChatProviderStatus();
    const imageGenModel = process.env.SBUILD_IMAGE_MODEL || "gpt-image-1";
    const imageAnalyzeModel = process.env.SBUILD_IMAGE_ANALYZE_MODEL || "gpt-4o-mini";

    const keyStorageLabel = (source: "env" | "local" | "missing" | string): string => {
      if (source === "env") return "Key storage: environment variable (SBUILD_OPENAI_*_API_KEY or OPENAI_API_KEY)";
      if (source === "local") return "Key storage: local ignored secret config (.sbuild-secrets.json)";
      return "Key storage: not configured";
    };

    const channels = {
      chat: {
        ...channelSummaryFromSource(chatStatus.source),
        provider: chatStatus.provider,
        model: chatStatus.model,
        message: chatStatus.message
      },
      imageGen: {
        ...channelSummaryFromSource(keyStatus.genSource as "env" | "local" | "missing"),
        message: keyStatus.genSource !== "missing"
          ? `Provider: OpenAI API. ${keyStorageLabel(keyStatus.genSource)}. Model: ${imageGenModel}.`
          : "Provider: OpenAI API. Missing image generation API key. Set OPENAI_API_KEY or enter in Settings → Image/API Keys."
      },
      imageAnalyze: {
        ...channelSummaryFromSource(keyStatus.analyzeSource as "env" | "local" | "missing"),
        message: keyStatus.analyzeSource !== "missing"
          ? `Provider: OpenAI API. ${keyStorageLabel(keyStatus.analyzeSource)}. Model: ${imageAnalyzeModel}.`
          : "Provider: OpenAI API. Missing image analysis API key."
      }
    };
    const providers = [
      {
        name: "OpenCode CLI",
        status: openCode.detected ? "connected" : "not_configured",
        message: openCode.message,
        path: openCode.path
      },
      {
        name: "OpenAI ChatGPT (via OpenCode)",
        status: openCode.detected ? "unknown" : "not_configured",
        message: openCode.detected ? "OpenCode detected. Run 'opencode auth status' to verify." : "Requires OpenCode CLI."
      },
      {
        name: "Kimi (via OpenCode)",
        status: openCode.detected ? "unknown" : "not_configured",
        message: openCode.detected ? "OpenCode detected. Run 'opencode auth status' to verify." : "Requires OpenCode CLI."
      },
      {
        name: "Z.ai (via OpenCode)",
        status: openCode.detected ? "unknown" : "not_configured",
        message: openCode.detected ? "OpenCode detected. Run 'opencode auth status' to verify." : "Requires OpenCode CLI."
      },
      {
        name: "Image Generation API (OpenAI)",
        status: keyStatus.genSource !== "missing" ? "connected" : "not_configured",
        provider: "openai",
        model: imageGenModel,
        keyStorage: keyStatus.genSource,
        modelSelectionSupported: process.env.SBUILD_IMAGE_MODEL ? true : false,
        message: keyStatus.genSource !== "missing"
          ? `Provider: OpenAI API. Key storage: ${keyStatus.genSource === "env" ? "environment variable" : "local ignored secret config"}. Model: ${imageGenModel}.`
          : "Missing. Set OPENAI_API_KEY env var or enter below in Settings → Image/API Keys."
      },
      {
        name: "Image Analysis API (OpenAI)",
        status: keyStatus.analyzeSource !== "missing" ? "connected" : "not_configured",
        provider: "openai",
        model: imageAnalyzeModel,
        keyStorage: keyStatus.analyzeSource,
        modelSelectionSupported: process.env.SBUILD_IMAGE_ANALYZE_MODEL ? true : false,
        message: keyStatus.analyzeSource !== "missing"
          ? `Provider: OpenAI API. Key storage: ${keyStatus.analyzeSource === "env" ? "environment variable" : "local ignored secret config"}. Model: ${imageAnalyzeModel}.`
          : "Missing. Set OPENAI_API_KEY env var or enter below in Settings → Image/API Keys."
      },
      ...chatStatus.cards
    ];
    res.json({
      ok: true,
      providers,
      channels,
      chatSettings: {
        mode: chatStatus.mode,
        selectedProvider: chatStatus.provider,
        selectedModel: chatStatus.model,
        fallbackEnabled: chatStatus.fallbackEnabled,
        fallbackTimeoutSec: chatStatus.fallbackTimeoutSec,
        summary: chatStatus.message
      }
    });
  });

  app.post("/api/ai/providers/test", async (req, res) => {
    const provider = String(req.body?.provider || "");
    if (provider === "image-gen") {
      const keyStatus = await getImageApiKeyStatus();
      if (keyStatus.genSource === "missing") {
        res.json({ ok: false, status: "not_configured", message: "No image generation API key found." });
        return;
      }
      res.json({ ok: true, status: "connected", message: "Key present. Live test not implemented in prototype." });
      return;
    }
    if (provider === "image-analyze") {
      const keyStatus = await getImageApiKeyStatus();
      if (keyStatus.analyzeSource === "missing") {
        res.json({ ok: false, status: "not_configured", message: "No image analysis API key found." });
        return;
      }
      res.json({ ok: true, status: "connected", message: "Key present. Live test not implemented in prototype." });
      return;
    }
    if (provider === "opencode") {
      const openCode = detectOpenCode();
      res.json({ ok: openCode.detected, status: openCode.detected ? "connected" : "not_configured", message: openCode.message });
      return;
    }
    if (provider === "chat" || provider === "local" || provider === "openai" || provider === "openrouter") {
      const chatConfig = await getChatProviderConfig();
      const targetProvider = provider === "chat"
        ? (chatConfig.mode === "auto"
          ? ((preferredApiProvider(await getOpenAIChatKeyStatus(), await getOpenRouterKeyStatus()) || "local") as ChatProviderId)
          : chatConfig.mode)
        : provider as ChatProviderId;
      const result = await runProviderTest(targetProvider);
      res.json(result);
      return;
    }
    res.json({ ok: false, status: "unknown", message: `Unknown provider: ${provider}` });
  });

  app.get("/api/ai/opencode/auth-status", async (_req, res) => {
    const auth = checkOpenCodeAuth();
    res.json({ ok: true, ...auth });
  });

  app.get("/api/ai/providers/discover", async (_req, res) => {
    const ollama = await getOllamaStatus();

    res.json({
      ok: true,
      ollama: {
        reachable: ollama.reachable,
        endpoint: ollama.endpoint,
        models: ollama.models,
        message: ollama.reachable
          ? ollama.models.length > 0
            ? `Ollama reachable with ${ollama.models.length} model(s)`
            : "Ollama reachable but no models installed"
          : ollama.message
      }
    });
  });

  app.get("/api/ai/providers/config", async (_req, res) => {
    const config = await getChatProviderConfig();
    const openaiKey = await getOpenAIChatKeyStatus();
    const openrouterKey = await getOpenRouterKeyStatus();
    res.json({
      ok: true,
      providerMode: config.mode,
      localModel: config.localModel,
      openaiModel: config.openaiModel,
      openrouterModel: config.openrouterModel,
      fallbackEnabled: config.fallbackEnabled,
      fallbackTimeoutSec: config.fallbackTimeoutSec,
      openaiApiKeySource: openaiKey.source,
      openrouterApiKeySource: openrouterKey.source,
      openaiMaskedApiKey: openaiKey.key ? maskKey(openaiKey.key) : null,
      openrouterMaskedApiKey: openrouterKey.key ? maskKey(openrouterKey.key) : null
    });
  });

  app.post("/api/ai/providers/config", requireAdminMw, async (req, res) => {
    const providerMode = String(req.body?.providerMode || "auto").trim();
    const validProviders = ["auto", "local", "openai", "openrouter"];
    if (!validProviders.includes(providerMode)) {
      res.status(400).json({ ok: false, error: `Invalid provider mode: ${providerMode}` });
      return;
    }

    await saveChatProviderConfig({
      providerMode,
      localModel: String(req.body?.localModel || "").trim(),
      openaiModel: String(req.body?.openaiModel || "").trim(),
      openrouterModel: String(req.body?.openrouterModel || "").trim(),
      fallbackEnabled: Boolean(req.body?.fallbackEnabled),
      fallbackTimeoutSec: Number(req.body?.fallbackTimeoutSec),
      openaiApiKey: String(req.body?.openaiApiKey || "").trim(),
      openrouterApiKey: String(req.body?.openrouterApiKey || "").trim()
    });
    const config = await getChatProviderConfig();
    res.json({
      ok: true,
      message: "Chat provider settings saved.",
      providerMode: config.mode,
      localModel: config.localModel,
      openaiModel: config.openaiModel,
      openrouterModel: config.openrouterModel,
      fallbackEnabled: config.fallbackEnabled,
      fallbackTimeoutSec: config.fallbackTimeoutSec
    });
  });

  app.get("/api/secrets/status", requireAdminMw, async (_req, res) => {
    const keyStatus = await getImageApiKeyStatus();
    const openaiChat = await getOpenAIChatKeyStatus();
    const openrouterChat = await getOpenRouterKeyStatus();
    const chatProviderConfig = await getChatProviderConfig();
    const channels = {
      chat: {
        ...channelSummaryFromSource(openaiChat.source),
        maskedKey: openaiChat.key ? maskKey(openaiChat.key) : null
      },
      imageGen: {
        ...channelSummaryFromSource(keyStatus.genSource as "env" | "local" | "missing"),
        maskedKey: keyStatus.genKey ? maskKey(keyStatus.genKey) : null
      },
      imageAnalyze: {
        ...channelSummaryFromSource(keyStatus.analyzeSource as "env" | "local" | "missing"),
        maskedKey: keyStatus.analyzeKey ? maskKey(keyStatus.analyzeKey) : null
      }
    };
    res.json({
      ok: true,
      channels,
      chat: {
        configured: openaiChat.source !== "missing",
        source: openaiChat.source,
        maskedKey: openaiChat.key ? maskKey(openaiChat.key) : null
      },
      chatProvider: {
        providerMode: chatProviderConfig.mode,
        localModel: chatProviderConfig.localModel,
        openaiModel: chatProviderConfig.openaiModel,
        openrouterModel: chatProviderConfig.openrouterModel,
        fallbackEnabled: chatProviderConfig.fallbackEnabled,
        fallbackTimeoutSec: chatProviderConfig.fallbackTimeoutSec
      },
      chatOpenAI: {
        configured: openaiChat.source !== "missing",
        source: openaiChat.source,
        maskedKey: openaiChat.key ? maskKey(openaiChat.key) : null
      },
      chatOpenRouter: {
        configured: openrouterChat.source !== "missing",
        source: openrouterChat.source,
        maskedKey: openrouterChat.key ? maskKey(openrouterChat.key) : null
      },
      imageGen: {
        configured: keyStatus.genSource !== "missing",
        source: keyStatus.genSource,
        maskedKey: keyStatus.genKey ? maskKey(keyStatus.genKey) : null
      },
      imageAnalyze: {
        configured: keyStatus.analyzeSource !== "missing",
        source: keyStatus.analyzeSource,
        maskedKey: keyStatus.analyzeKey ? maskKey(keyStatus.analyzeKey) : null
      }
    });
  });

  app.post("/api/secrets/image-keys", requireAdminMw, async (req, res) => {
    const genKey = sanitizeApiKeyInput(req.body?.imageGenApiKey);
    const analyzeKey = sanitizeApiKeyInput(req.body?.imageAnalyzeApiKey);
    const chatKey = sanitizeApiKeyInput(req.body?.chatApiKey);
    const openaiChatKey = sanitizeApiKeyInput(req.body?.openaiChatApiKey);
    const openrouterChatKey = sanitizeApiKeyInput(req.body?.openrouterChatApiKey);
    const secrets = await loadSecrets();
    if (genKey) secrets.imageGenApiKey = genKey;
    if (analyzeKey) secrets.imageAnalyzeApiKey = analyzeKey;
    if (chatKey || openaiChatKey) {
      const key = openaiChatKey || chatKey;
      secrets.chatApiKey = key;
      secrets.openaiChatApiKey = key;
    }
    if (openrouterChatKey) secrets.openrouterChatApiKey = openrouterChatKey;
    await saveSecrets(secrets);
    res.json({ ok: true, message: "Keys stored locally. Not committed to project." });
  });

  app.post("/api/build", async (_req, res) => {
    try {
      const project = await loadProject();
      const result = await generateSite(project);
      res.json({ ok: true, result });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error) });
    }
  });

  app.post("/api/publish", async (_req, res) => {
    try {
      const allow = process.env.SBUILD_ALLOW_PUBLISH === "1";
      const target = allow ? "/var/www/blackfishfarms.com" : publishedPreviewDir;
      await fs.mkdir(target, { recursive: true });

      if (!allow) {
        try {
          await fs.rm(target, { recursive: true, force: true });
          await fs.mkdir(target, { recursive: true });
        } catch {
          // keep best effort
        }
      }

      await copyDir(distDir, target);
      res.json({ ok: true, dryRun: !allow, target });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error) });
    }
  });

  app.post("/api/backup", async (_req, res) => {
    try {
      await fs.mkdir(backupsDir, { recursive: true });
      const stamp = new Date().toISOString().replaceAll(":", "-");
      const target = path.join(backupsDir, `project-${stamp}.json`);
      await fs.copyFile(projectFile, target);
      res.json({ ok: true, backup: target });
    } catch (error) {
      res.status(500).json({ ok: false, warn: true, error: String(error) });
    }
  });

  app.post("/api/restore", async (req, res) => {
    try {
      const restorePath = String(req.body?.path || "");
      if (!restorePath) {
        res.status(400).json({ ok: false, warn: true, error: "path is required" });
        return;
      }
      const backupsRoot = path.resolve(backupsDir);
      const resolved = path.resolve(backupsRoot, restorePath);
      if (!resolved.startsWith(backupsRoot + path.sep)) {
        res.status(400).json({ ok: false, warn: true, error: "restore path must resolve inside the backups directory" });
        return;
      }
      await fs.copyFile(resolved, projectFile);
      res.json({ ok: true, restoredFrom: resolved });
    } catch (error) {
      res.status(500).json({ ok: false, warn: true, error: String(error) });
    }
  });

  app.get("/api/status", async (_req, res) => {
    const keyStatus = await getImageApiKeyStatus();
    const chatStatus = await getChatProviderStatus();
    let editorDistExists = false;
    try {
      await fs.access(editorIndexPath);
      editorDistExists = true;
    } catch {
      editorDistExists = false;
    }
    const imageGenChannel = {
      ...channelSummaryFromSource(keyStatus.genSource as "env" | "local" | "missing"),
      message: keyStatus.genSource === "missing" ? "Image generation API key missing." : `Image generation configured from ${keyStatus.genSource}.`
    };
    const imageAnalyzeChannel = {
      ...channelSummaryFromSource(keyStatus.analyzeSource as "env" | "local" | "missing"),
      message: keyStatus.analyzeSource === "missing" ? "Image analysis API key missing." : `Image analysis configured from ${keyStatus.analyzeSource}.`
    };
    const chatChannel = {
      ...channelSummaryFromSource(chatStatus.source),
      provider: chatStatus.provider,
      model: chatStatus.model,
      message: chatStatus.message
    };
    res.json({
      ok: true,
      status: {
        chatApi: chatStatus.source === "missing" && chatStatus.provider !== "local"
          ? "missing-key"
          : `configured-${chatStatus.source}`,
        chatModel: chatStatus.model,
        chatProviderMode: chatStatus.mode,
        chatFallbackEnabled: chatStatus.fallbackEnabled,
        chatFallbackTimeoutSec: chatStatus.fallbackTimeoutSec,
        imageApi: keyStatus.genSource === "missing" ? "missing-key" : `configured-${keyStatus.genSource}`,
        imageAnalyzeApi: keyStatus.analyzeSource === "missing" ? "missing-key" : `configured-${keyStatus.analyzeSource}`,
        publishMode: process.env.SBUILD_ALLOW_PUBLISH === "1" ? "live-enabled" : "dry-run",
        chat: chatChannel,
        imageGen: imageGenChannel,
        imageAnalyze: imageAnalyzeChannel,
        imagePipeline: imagePipelineSourceMarker(),
        projectPath: projectFile,
        distPath: distDir,
        editorDistPath: resolvedEditorDistPath,
        editorDistExists
      }
    });
  });

  // Serve built editor assets for local prototype usage.
  app.use("/assets", express.static(editorAssetsPath, {
    immutable: true,
    maxAge: "1y",
    setHeaders: setImmutableAssetCacheHeaders
  }));
  app.use(express.static(resolvedEditorDistPath, {
    index: false,
    setHeaders: (res, filePath) => {
      if (path.basename(filePath) === "index.html") {
        setAppShellCacheHeaders(res);
      }
    }
  }));

  app.use("/api", (_req, res) => {
    res.status(404).json({ ok: false, error: "API route not found" });
  });

  app.get("*", async (req, res) => {
    if (isApiPath(req.path)) {
      res.status(404).json({ ok: false, error: "API route not found" });
      return;
    }
    if (req.path.startsWith("/project/images")) {
      res.status(404).type("text/plain").send("Image asset not found");
      return;
    }
    await sendEditorFallback(res, editorIndexPath, resolvedEditorDistPath);
  });

  return app;
}
