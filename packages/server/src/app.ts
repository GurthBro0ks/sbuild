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
} from "@sbuild/shared";
import { execSync } from "node:child_process";
import crypto from "node:crypto";

const DEFAULT_OLLAMA_ENDPOINT = "http://127.0.0.1:11434";
const DEFAULT_LOCAL_CHAT_MODEL = "qwen2.5:1.5b";
const OLD_DEFAULT_LOCAL_CHAT_MODEL = "qwen3:4b";

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

function getBuildInfo(): SBuildBuildInfo & { dirtySummary?: GitDirtySummary } {
  const commit = safeGitCommand("git rev-parse --short HEAD", repoRoot) || "unknown";
  const branch = resolveBranch(repoRoot, commit);
  const dirty = computeDirtySummary(repoRoot);
  const buildDate = new Date().toISOString();
  return {
    version: SBUILD_VERSION,
    appName: SBUILD_APP_NAME,
    gitCommit: commit,
    branch,
    buildDate,
    dirty: dirty.modifiedTracked > 0 || dirty.untracked > 0,
    dirtySummary: dirty,
    publishAllowed: process.env.SBUILD_ALLOW_PUBLISH === "1",
  };
}
import { applyDeterministicPaintFix, wizardFallback } from "./lib/ai.js";
import { getMemoryForUser, appendMemoryForUser, clearMemoryForUser } from "./lib/aiMemory.js";
import { getChatHistory, appendChatHistory, clearChatHistory, replaceChatHistory, sanitizeChatText as sanitizeChatTextImported } from "./lib/chatHistoryStore.js";
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
  repoRoot,
  secretsFile
} from "./lib/paths.js";

const imageFolderConfigFile = path.join(path.dirname(projectFile), "image-folder.json");

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

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, projectImagesDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".bin";
      const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      cb(null, `${base}${ext}`);
    }
  })
});
const validProviderSizes: OpenAIImageSize[] = ["1024x1024", "1024x1536", "1536x1024"];
const localSharpEditTypes = new Set(["enhance", "black-white", "crop-fit", "color-pop"]);

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
    out.push({
      name: entry.name,
      url: urlPath,
      folder: current.replace(/\\/g, "/") || "root",
      extension,
      contentType: inferContentType(extension),
      isRenderableImage: renderableExtensions.has(extension),
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
  app.use(cors());
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
      gitCommit: info.gitCommit,
      buildDate: info.buildDate,
      dirty: info.dirty,
      dirtySummary: info.dirtySummary,
      branch: info.branch,
      publishAllowed: info.publishAllowed,
      editorDistExists,
      paths: {
        editorDistPath: resolvedEditorDistPath,
        editorIndexPath,
        projectPath: projectFile
      }
    });
  });

  app.get("/api/project", async (_req, res) => {
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
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    migrateFromEnv();

    const user = findUserByUsername(username);
    if (!user || !verifyUserPassword(password, user.passwordHash)) {
      res.status(401).type("html").send(renderLoginPage("Invalid username or password."));
      return;
    }
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

  app.post("/api/images", upload.array("images", 12), async (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    const uploads = files.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      url: `/project/images/${file.filename}`
    }));
    res.json({ ok: true, uploads });
  });

  app.delete("/api/images", async (req, res) => {
    const filenames = req.body?.filenames;
    if (!filenames || !Array.isArray(filenames)) {
      res.status(400).json({ ok: false, error: "filenames array is required" });
      return;
    }
    const results: { filename: string; deleted: boolean; error?: string }[] = [];
    for (const filename of filenames) {
      const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, "");
      const filePath = path.join(projectImagesDir, safeName);
      try {
        await fs.unlink(filePath);
        results.push({ filename: safeName, deleted: true });
      } catch (error) {
        results.push({ filename: safeName, deleted: false, error: String(error) });
      }
    }
    const allDeleted = results.every((r) => r.deleted);
    res.json({ ok: allDeleted, results, deletedCount: results.filter((r) => r.deleted).length });
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
    if (!prompt) {
      res.status(400).json({ ok: false, error: "prompt is required" });
      return;
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
    res.json({ ok: true, ...result });
  });

  app.post("/api/ai/suggest", async (req, res) => {
    const prompt = String(req.body?.prompt || "").trim();
    const targetKind = String(req.body?.targetKind || "block");
    const blockId = String(req.body?.blockId || "");
    const blockType = String(req.body?.blockType || "");
    const chatHistory = Array.isArray(req.body?.chatHistory) ? req.body.chatHistory as Array<{ role: string; text: string }> : [];
    if (!prompt) {
      res.status(400).json({ ok: false, error: "prompt is required" });
      return;
    }
    if (isRuntimeIdentityQuestion(prompt)) {
      const config = await getChatProviderConfig();
      const provider = config.provider || "auto";
      if (provider === "ollama" || provider === "auto") {
        const ollama = await getOllamaStatus();
        if (ollama.reachable && ollama.model) {
          const modelToUse = preferredLocalModelName(ollama.models, config.model) || ollama.model;
          res.json({
            ok: true,
            suggestion: `Using local Ollama model ${modelToUse}.`,
            provider: "ollama",
            model: modelToUse,
            message: `Local chat connected: ${modelToUse}`,
            source: "local",
            latencyMs: 0,
            isLocal: true,
            proposal: null,
            hasProposal: false,
            targetKind,
            blockId,
            blockType
          });
          return;
        }
      }
    }
    if (isUiStateQuestion(prompt)) {
      const answer = answerUiStateQuestion(prompt, targetKind, blockId, blockType);
      if (answer !== null) {
        res.json({
          ok: true,
          suggestion: answer,
          provider: "local",
          model: "ui-state",
          message: "UI state answer",
          source: "local",
          latencyMs: 0,
          isLocal: true,
          proposal: null,
          hasProposal: false,
          targetKind,
          blockId,
          blockType
        });
        return;
      }
    }
    if (isCasualOffTopic(prompt)) {
      const casualAnswer = answerCasualOffTopic(prompt);
      const username = auth.enabled ? (() => {
        const session = getSession(req);
        return session ? session.u : null;
      })() : "dev";
      if (username) {
        const persistedItems: PersistedChatItem[] = [
          { role: "user", text: prompt, timestamp: Date.now() },
          { role: "assistant", text: casualAnswer, timestamp: Date.now(), provider: "local", model: "casual-router", source: "local", latencyMs: 0 }
        ];
        appendChatHistory(username, req.body?.projectPath || undefined, persistedItems);
      }
      res.json({
        ok: true,
        suggestion: casualAnswer,
        provider: "local",
        model: "casual-router",
        message: "Casual/off-topic response",
        source: "local",
        latencyMs: 0,
        isLocal: true,
        proposal: null,
        hasProposal: false,
        targetKind,
        blockId,
        blockType
      });
      return;
    }
    const contextPrefix = targetKind === "site"
      ? "You are editing the whole website project. "
      : targetKind === "page"
        ? "You are editing the current page. "
        : blockType
          ? `You are editing a ${blockType} block. `
          : "You are editing a block. ";
    const isQuestion = isQuestionPrompt(prompt);
    const fieldInstruction = !isQuestion && targetKind === "block" && blockType
      ? fieldInstructionFromPrompt(prompt, blockType)
      : "";
    const proposalInstruction = !isQuestion && targetKind === "block"
      ? `If you are proposing a direct replacement for editable block copy, return a JSON object in a fenced \`\`\`json block with {"kind":"replace-copy","replaceText":"...","targetField":"heading or subheading or body"}. Otherwise answer normally with plain text and no proposal object. `
      : "";
    const fullPrompt = `${contextPrefix}${fieldInstruction}${proposalInstruction}${prompt}`;
    const result = await chatWithProviders(fullPrompt, chatHistory);
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
      blockType
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

      const generatedDir = await ensureImageSubdir("generated");
      const stem = safeFilenameStem(prompt).slice(0, 48);
      const suffix = randomSuffix();
      const originalPath = path.join(generatedDir, `${stem}-original-${suffix}.png`);

      const originalBuffer = item.b64_json
        ? Buffer.from(item.b64_json, "base64")
        : await fetchUrlToBuffer(item.url!);
      await saveBufferAsPng(originalPath, originalBuffer);

      let imagePath = originalPath;
      const sharpMod = await loadSharp();
      if (!sharpMod) {
        warnings.push("sharp not available; returning original generated image.");
      } else {
        try {
          const fitted = await fitWithSharp({
            input: originalBuffer,
            cropMode: sizeDecision.cropMode,
            outputWidth: sizeDecision.outputWidth,
            outputHeight: sizeDecision.outputHeight
          });
          const fittedPath = path.join(generatedDir, `${stem}-fitted-${suffix}.png`);
          await saveBufferAsPng(fittedPath, fitted);
          imagePath = fittedPath;
        } catch (error) {
          warnings.push(`Image fitting failed; original kept. ${String(error)}`);
        }
      }

      res.json({
        ok: true,
        model,
        imageUrl: projectImageUrlFromAbsolute(imagePath),
        originalImageUrl: imagePath === originalPath ? undefined : projectImageUrlFromAbsolute(originalPath),
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

  async function getChatApiKeyStatus(): Promise<{ chatKey: string; chatSource: "env" | "local" | "missing" }> {
    const envChat = process.env.SBUILD_OPENAI_CHAT_API_KEY || process.env.OPENAI_API_KEY || "";
    const secrets = await loadSecrets();
    const localChat = String((secrets as Record<string, unknown>).chatApiKey || "").trim();
    const chatKey = envChat || localChat;
    const chatSource: "env" | "local" | "missing" = envChat ? "env" : localChat ? "local" : "missing";
    return { chatKey, chatSource };
  }

  type ChatProviderConfig = {
    provider: string;
    model: string;
    baseUrl: string;
    apiKey: string;
  };

  async function getChatProviderConfig(): Promise<ChatProviderConfig> {
    const secrets = await loadSecrets();
    const s = secrets as Record<string, unknown>;
    const chatKeyStatus = await getChatApiKeyStatus();
    const provider = String(s.chatProvider || "auto");
    const ollama = await getOllamaStatus();
    let savedModel = String(s.chatModel || "").trim();
    if (savedModel === OLD_DEFAULT_LOCAL_CHAT_MODEL && !s._chatModelMigrated && (provider === "ollama" || provider === "auto")) {
      if (ollama.models.some((m) => m.name === DEFAULT_LOCAL_CHAT_MODEL)) {
        savedModel = DEFAULT_LOCAL_CHAT_MODEL;
        secrets.chatModel = DEFAULT_LOCAL_CHAT_MODEL;
        secrets._chatModelMigrated = true;
        await saveSecrets(secrets);
      }
    }
    const model = savedModel || ((provider === "ollama" || provider === "auto") ? (preferredLocalModelName(ollama.models, DEFAULT_LOCAL_CHAT_MODEL) || "") : "");
    const defaultBaseUrl = provider === "ollama" || provider === "auto"
      ? ollama.endpoint
      : (process.env.SBUILD_OPENAI_CHAT_BASE_URL || "https://api.openai.com/v1");
    return {
      provider,
      model,
      baseUrl: String(s.chatBaseUrl || defaultBaseUrl),
      apiKey: chatKeyStatus.chatKey
    };
  }

  async function saveChatProviderConfig(cfg: { provider?: string; model?: string; baseUrl?: string; apiKey?: string }): Promise<void> {
    const secrets = await loadSecrets();
    const provider = String(cfg.provider ?? secrets.chatProvider ?? "auto").trim();
    const model = String(cfg.model || "").trim();
    const baseUrl = String(cfg.baseUrl || "").trim();
    if (cfg.provider !== undefined) secrets.chatProvider = provider;
    if (cfg.model !== undefined) secrets.chatModel = model;
    if (cfg.baseUrl !== undefined) {
      secrets.chatBaseUrl = provider === "openai" || provider === "openrouter" || provider === "openai-compatible"
        ? baseUrl
        : "";
    }
    if (cfg.apiKey !== undefined && cfg.apiKey) secrets.chatApiKey = cfg.apiKey;
    await saveSecrets(secrets);
  }

  type ChatProviderResult = {
    provider: string;
    source: "local" | "env" | "missing";
    available: boolean;
    response: string;
    model?: string;
    message?: string;
    latencyMs?: number;
    isLocal?: boolean;
  };

  type StructuredSuggestionProposal = {
    kind: "replace-copy";
    replaceText: string;
    targetField?: string;
  };

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

  function isUiStateQuestion(prompt: string): boolean {
    return /\bwhich\s+(block|target|mode|page|selection|selected)\b|\bwhat\s+block\b|\bwhat\s+selection\b|\bwhat\s+mode\b/i.test(prompt);
  }

  function answerUiStateQuestion(prompt: string, targetKind: string, blockId: string, blockType: string): string | null {
    const normalizedPrompt = prompt.toLowerCase();
    if (/which block|what block|which selection|what selection|selected block/i.test(normalizedPrompt)) {
      if (!blockId || !blockType) {
        return "No block is currently selected.";
      }
      const label = blockTypeLabelsForState(blockType);
      return `The selected target is the ${label} block (${blockId}).`;
    }
    if (/which target|which mode|what target|what mode/i.test(normalizedPrompt)) {
      if (targetKind === "site") return "Whole Site is active.";
      if (targetKind === "page") return "Current Page is active.";
      if (targetKind === "block") {
        if (!blockId || !blockType) return "Selected Block is active (no block selected).";
      const label = blockTypeLabelsForState(blockType);
        return `Selected Block is active (${label}).`;
      }
    }
    if (/what page|which page/i.test(normalizedPrompt)) {
      if (targetKind === "page") return "Current Page is active.";
      if (targetKind === "site") return "Whole Site is active.";
      return "Current Page is active.";
    }
    return null;
  }

  function blockTypeLabelsForState(blockType: string): string {
    const labels: Record<string, string> = {
      hero: "Hero section",
      text: "Text section",
      image: "Image block",
      cards: "Cards section",
      gallery: "Gallery block",
      contact: "Contact section",
      hours: "Hours section",
      testimonial: "Testimonial block",
      map: "Map block",
      marquee: "Marquee block",
      spacer: "Spacer block",
      divider: "Divider block",
      html: "HTML block"
    };
    return labels[blockType] || blockType;
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

  function isCasualOffTopic(prompt: string): boolean {
    const trimmed = prompt.trim().toLowerCase();
    const casualPatterns = [
      /\b(do you like|do you prefer|do you enjoy|do you love|do you hate)\b/,
      /\b(what['']?s your favorite|what['']?s your (least )?favorite)\b/,
      /\b(tell me a joke|tell me a story|sing|dance|play)\b/,
      /\b(how are you|how do you feel|what do you think about)\b/,
      /\b(pickles|pizza|weather|sports team|movie|song|music|food|recipe|cook)\b/,
      /\b(who (is|are|was|were) .*(president|mayor|governor|ceo))\b/,
      /\b(what (is|was|are|were) .*(capital|population|tallest|longest|biggest))\b/
    ];
    const hasSiteEditKeywords = /\b(site|page|block|website|heading|title|description|text|copy|layout|image|hero|section|footer|header|nav|gallery|card|button|cta|background|font|color|style|content|paragraph|subheading|tagline|blurb|intro|body|title)\b/i.test(trimmed);
    if (hasSiteEditKeywords) return false;
    for (const pattern of casualPatterns) {
      if (pattern.test(trimmed)) return true;
    }
    return false;
  }

  function answerCasualOffTopic(prompt: string): string {
    const trimmed = prompt.trim().toLowerCase();
    if (/^(do you like|do you prefer|do you enjoy|do you love|do you hate)/i.test(trimmed)) {
      return "That's outside what I do — I'm focused on helping you build and edit your website. Want help with copy, layout, or images instead?";
    }
    if (/^(tell me a joke|tell me a story|sing|dance|play)/i.test(trimmed)) {
      return "I'm here to help with your website. Ask me to write copy, suggest layouts, or edit images!";
    }
    if (/^(how are you|how do you feel)/i.test(trimmed)) {
      return "I'm ready to help with your website. What would you like to work on?";
    }
    return "That's outside my scope — I help with website building and editing. Want to work on your site's copy, layout, or images?";
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
      return { reachable: true, endpoint, model, models, message: model ? `Local chat connected: ${model}` : "Ollama reachable but no local models installed." };
    } catch {
      return { reachable: false, endpoint, model: null, models: [], message: "Ollama not reachable on localhost." };
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
        isLocal: false
      };
    }

    const config = await getChatProviderConfig();
    const provider = config.provider || "auto";

    if (provider === "disabled") {
      return {
        provider: "disabled",
        source: "local",
        available: false,
        response: "AI chat is disabled in settings.",
        message: "Provider set to disabled",
        latencyMs: Date.now() - startedAt,
        isLocal: true
      };
    }

    if (provider === "ollama" || provider === "auto") {
      const ollama = await getOllamaStatus();
      if (ollama.reachable && ollama.model) {
        const modelToUse = preferredLocalModelName(ollama.models, config.model) || ollama.model;
        if (isRuntimeIdentityQuestion(cleanPrompt)) {
          return {
            provider: "ollama",
            source: "local",
            available: true,
            response: `Using local Ollama model ${modelToUse}.`,
            model: modelToUse,
            message: `Local chat connected: ${modelToUse}`,
            latencyMs: Date.now() - startedAt,
            isLocal: true
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
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 30000);
          const historyMessages: Array<{ role: string; content: string }> = [
            { role: "system", content: systemPrompt }
          ];
          if (chatHistory && chatHistory.length > 0) {
            const recentHistory = chatHistory.slice(-5);
            for (const msg of recentHistory) {
              if (msg.role === "user" || msg.role === "assistant") {
                historyMessages.push({ role: msg.role, content: msg.text });
              }
            }
          }
          const userMessage = `${cleanPrompt}\n\nPlease respond concisely and directly. Do not include your reasoning process.`;
          historyMessages.push({ role: "user", content: userMessage });
          const isQwen3 = modelToUse.startsWith("qwen3");
          const requestBody: any = {
            model: modelToUse,
            stream: false,
            options: {
              temperature: 0.2,
              num_predict: 512
            },
            messages: historyMessages
          };
          if (isQwen3) {
            requestBody.think = false;
          }
          const response = await fetch(`${ollama.endpoint}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify(requestBody)
          });
          clearTimeout(timer);
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
            message?: { content?: string; thinking?: string };
          };
          let text = String(payload.message?.content || "").trim();
          const looksLikeRawJson = text.startsWith("{") && text.includes("\"kind\"") && !cleanPrompt.toLowerCase().includes("json");
          if (looksLikeRawJson) {
            try {
              const parsed = JSON.parse(text) as Record<string, unknown>;
              if (parsed.kind === "replace-copy" && typeof parsed.replaceText === "string") {
                text = `Suggestion: replace the block text with "${parsed.replaceText}"`;
              } else {
                text = String((parsed as Record<string, unknown>).replaceText || (parsed as Record<string, unknown>).text || text);
              }
            } catch {
              // leave as-is
            }
          }
          const thinking = payload.message?.thinking || "";
          if (!text && thinking) {
            text = `[Note: response based on model reasoning]\n${thinking.trim()}`;
          }
          if (response.ok && text) {
            return {
              provider: "ollama",
              source: "local",
              available: true,
              response: text,
              model: modelToUse,
              message: `Local chat connected: ${modelToUse}`,
              latencyMs: Date.now() - startedAt,
              isLocal: true
            };
          }
          const safeDiagnostics = [`status=${response.status}`, `hasMessage=${Boolean(payload.message)}`, `hasError=${Boolean(payload.error)}`].join(" ");
          return {
            provider: "ollama",
            source: "local",
            available: false,
            response: `AI chat unavailable: Local Ollama model ${modelToUse} timed out or returned no content; provider is still configured.`,
            model: modelToUse,
            message: `Local model ${modelToUse} returned no content (${safeDiagnostics}); provider is still configured.`,
            latencyMs: Date.now() - startedAt,
            isLocal: true
          };
        } catch (error) {
          const message = error instanceof Error && error.name === "AbortError"
            ? `Local Ollama model ${modelToUse} timed out after 30 seconds; provider is still configured.`
            : `Local model request failed: ${error instanceof Error ? error.message : String(error)}; provider is still configured.`;
          return {
            provider: "ollama",
            source: "local",
            available: false,
            response: `AI chat unavailable: ${message}`,
            model: modelToUse,
            message,
            latencyMs: Date.now() - startedAt,
            isLocal: true
          };
        }
      }
    }

    if (provider === "ollama" && !config.apiKey) {
      return {
        provider: "ollama",
        source: "missing",
        available: false,
        response: "AI chat unavailable: Ollama not reachable and no API key configured.",
        message: "Ollama not reachable",
        latencyMs: Date.now() - startedAt,
        isLocal: true
      };
    }

    if (provider === "openai" || provider === "openai-compatible" || provider === "openrouter" || provider === "auto") {
      const chatKeyStatus = await getChatApiKeyStatus();
      const chatKey = config.apiKey || chatKeyStatus.chatKey;
      if (!chatKey) {
        return {
          provider: "none",
          source: "missing",
          available: false,
          response: "AI chat unavailable: no API key configured.",
          message: "No API key available",
          latencyMs: Date.now() - startedAt,
          isLocal: false
        };
      }

      const chatBase = (config.baseUrl?.trim() || process.env.SBUILD_OPENAI_CHAT_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
      let chatModel = config.model?.trim() || process.env.SBUILD_CHAT_MODEL || "gpt-4o-mini";
      if (provider === "openrouter") {
        chatModel = config.model?.trim() || "openrouter/auto";
      }
      try {
        const responseSource = chatKeyStatus.chatSource;
        const remoteMessages: Array<{ role: string; content: string }> = [
          { role: "system", content: runtimeIdentityPrompt({ provider: provider === "openrouter" ? "openrouter" : "openai-compatible", model: chatModel, source: responseSource }) }
        ];
        if (chatHistory && chatHistory.length > 0) {
          const recentHistory = chatHistory.slice(-10);
          for (const msg of recentHistory) {
            if (msg.role === "user" || msg.role === "assistant") {
              remoteMessages.push({ role: msg.role, content: msg.text });
            }
          }
        }
        remoteMessages.push({ role: "user", content: cleanPrompt });
        const response = await fetch(`${chatBase}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${chatKey}`
          },
          body: JSON.stringify({
            model: chatModel,
            messages: remoteMessages
          })
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = String(payload.choices?.[0]?.message?.content || "").trim();
        if (response.ok && text) {
          return {
            provider: provider === "openrouter" ? "openrouter" : "openai-compatible",
            source: chatKeyStatus.chatSource,
            available: true,
            response: text,
            model: chatModel,
            message: `Chat ready via ${chatBase}`,
            latencyMs: Date.now() - startedAt,
            isLocal: false
          };
        }
        return {
          provider: provider === "openrouter" ? "openrouter" : "openai-compatible",
          source: chatKeyStatus.chatSource,
          available: false,
          response: "AI chat unavailable: provider returned no content.",
          model: chatModel,
          message: payload.error?.message || `Chat provider returned ${response.status}`,
          latencyMs: Date.now() - startedAt,
          isLocal: false
        };
      } catch {
        return {
          provider: provider === "openrouter" ? "openrouter" : "openai-compatible",
          source: chatKeyStatus.chatSource,
          available: false,
          response: "AI chat unavailable: provider request failed.",
          model: chatModel,
          message: "Chat provider request failed",
          latencyMs: Date.now() - startedAt,
          isLocal: false
        };
      }
    }

    return {
      provider: "none",
      source: "missing",
      available: false,
      response: "AI chat unavailable: no provider configured.",
      message: "Unknown provider",
      latencyMs: Date.now() - startedAt,
      isLocal: false
    };
  }

  async function getChatProviderStatus(): Promise<{ status: "connected" | "not_configured"; source: "local" | "env" | "missing"; provider: string; model?: string; message: string; configuredProvider?: string; localModels?: Array<{ name: string }> }> {
    const config = await getChatProviderConfig();
    const ollama = await getOllamaStatus();
    const localModels = ollama.models.map((model) => ({ name: model.name }));

    if (config.provider === "disabled") {
      return {
        status: "not_configured",
        source: "local",
        provider: "disabled",
        message: "AI chat is disabled in settings.",
        configuredProvider: "disabled",
        localModels
      };
    }

    if (config.provider === "ollama" || config.provider === "auto") {
      if (ollama.reachable && ollama.model) {
        const modelToUse = preferredLocalModelName(ollama.models, config.model) || ollama.model;
        return {
          status: "connected",
          source: "local",
          provider: "ollama",
          model: modelToUse,
          message: `Local chat connected: ${modelToUse}`,
          configuredProvider: config.provider,
          localModels
        };
      }
      if (config.provider === "ollama") {
        return {
          status: "not_configured",
          source: "local",
          provider: "ollama",
          message: "Ollama selected but not reachable. Install Ollama or switch provider.",
          configuredProvider: "ollama",
          localModels
        };
      }
    }

    if (config.apiKey) {
      const chatKeyStatus = await getChatApiKeyStatus();
      return {
        status: "connected",
        source: chatKeyStatus.chatSource,
        provider: config.provider === "openrouter" ? "openrouter" : "openai-compatible",
        model: config.model || process.env.SBUILD_CHAT_MODEL || "gpt-4o-mini",
        message: `Chat configured via ${config.provider} (${config.baseUrl || "default endpoint"})`,
        configuredProvider: config.provider,
        localModels
      };
    }

    if (ollama.reachable && ollama.model) {
      return {
        status: "connected",
        source: "local",
        provider: "ollama",
        model: ollama.model,
        message: `Local chat connected: ${ollama.model}`,
        configuredProvider: "auto",
        localModels
      };
    }

    return {
      status: "not_configured",
      source: "missing",
      provider: "none",
      message: ollama.reachable ? "Ollama reachable but no model loaded." : "No chat provider configured.",
      configuredProvider: config.provider,
      localModels
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
    const channels = {
      chat: {
        ...channelSummaryFromSource(chatStatus.source),
        provider: chatStatus.provider,
        model: chatStatus.model,
        message: chatStatus.message
      },
      imageGen: {
        ...channelSummaryFromSource(keyStatus.genSource as "env" | "local" | "missing"),
        message: keyStatus.genSource !== "missing" ? `Key configured from ${keyStatus.genSource}` : "Missing image generation API key."
      },
      imageAnalyze: {
        ...channelSummaryFromSource(keyStatus.analyzeSource as "env" | "local" | "missing"),
        message: keyStatus.analyzeSource !== "missing" ? `Key configured from ${keyStatus.analyzeSource}` : "Missing image analysis API key."
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
        name: "Image Generation API",
        status: keyStatus.genSource !== "missing" ? "connected" : "not_configured",
        message: keyStatus.genSource !== "missing" ? `Key configured from ${keyStatus.genSource}` : "Missing. Set OPENAI_API_KEY or enter below."
      },
      {
        name: "Image Analysis API",
        status: keyStatus.analyzeSource !== "missing" ? "connected" : "not_configured",
        message: keyStatus.analyzeSource !== "missing" ? `Key configured from ${keyStatus.analyzeSource}` : "Missing. Set OPENAI_API_KEY or enter below."
      },
      {
        name: "AI Chat Provider",
        status: chatStatus.status,
        message: chatStatus.message
      }
    ];
    res.json({ ok: true, providers, channels });
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
    const chatKeyStatus = await getChatApiKeyStatus();
    res.json({
      ok: true,
      provider: config.provider || "auto",
      model: config.model || "",
      baseUrl: config.baseUrl || "",
      hasApiKey: Boolean(config.apiKey),
      apiKeySource: chatKeyStatus.chatSource,
      maskedApiKey: config.apiKey ? maskKey(config.apiKey) : null
    });
  });

  app.post("/api/ai/providers/config", requireAdminMw, async (req, res) => {
    const provider = String(req.body?.provider || "auto").trim();
    const model = String(req.body?.model || "").trim();
    const baseUrl = String(req.body?.baseUrl || "").trim();
    const apiKey = String(req.body?.apiKey || "").trim();

    const validProviders = ["auto", "disabled", "openai", "openrouter", "ollama", "openai-compatible"];
    if (!validProviders.includes(provider)) {
      res.status(400).json({ ok: false, error: `Invalid provider: ${provider}` });
      return;
    }

    await saveChatProviderConfig({ provider, model, baseUrl, apiKey });
    const config = await getChatProviderConfig();
    res.json({
      ok: true,
      message: "Provider configuration saved.",
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      hasApiKey: Boolean(config.apiKey)
    });
  });

  app.get("/api/secrets/status", requireAdminMw, async (_req, res) => {
    const keyStatus = await getImageApiKeyStatus();
    const chatStatus = await getChatApiKeyStatus();
    const chatProviderConfig = await getChatProviderConfig();
    const channels = {
      chat: {
        ...channelSummaryFromSource(chatStatus.chatSource),
        maskedKey: chatStatus.chatKey ? maskKey(chatStatus.chatKey) : null
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
        configured: chatStatus.chatSource !== "missing",
        source: chatStatus.chatSource,
        maskedKey: chatStatus.chatKey ? maskKey(chatStatus.chatKey) : null
      },
      chatProvider: {
        provider: chatProviderConfig.provider || "auto",
        model: chatProviderConfig.model || "",
        baseUrl: chatProviderConfig.baseUrl || "",
        hasApiKey: Boolean(chatProviderConfig.apiKey)
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
    const genKey = String(req.body?.imageGenApiKey || "").trim();
    const analyzeKey = String(req.body?.imageAnalyzeApiKey || "").trim();
    const chatKey = String(req.body?.chatApiKey || "").trim();
    const secrets = await loadSecrets();
    if (genKey) secrets.imageGenApiKey = genKey;
    if (analyzeKey) secrets.imageAnalyzeApiKey = analyzeKey;
    if (chatKey) secrets.chatApiKey = chatKey;
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
      await fs.copyFile(restorePath, projectFile);
      res.json({ ok: true, restoredFrom: restorePath });
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
      model: chatStatus.model || process.env.SBUILD_CHAT_MODEL || DEFAULT_LOCAL_CHAT_MODEL,
      message: chatStatus.message
    };
    res.json({
      ok: true,
      status: {
        chatApi: chatStatus.status === "connected"
          ? `configured-${chatStatus.source}`
          : "missing-key",
        chatModel: chatStatus.model || process.env.SBUILD_CHAT_MODEL || DEFAULT_LOCAL_CHAT_MODEL,
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
  app.use("/assets", express.static(editorAssetsPath));
  app.use(express.static(resolvedEditorDistPath, { index: false }));

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
