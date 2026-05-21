import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import multer from "multer";
import { SBuildProject } from "@sbuild/shared";
import { applyDeterministicPaintFix, chatWithFallback, wizardFallback } from "./lib/ai.js";
import {
  backupsDir,
  distDir,
  editorDistDir,
  projectFile,
  projectImagesDir,
  publishedPreviewDir
} from "./lib/paths.js";
import { loadProject, saveProject, validateProjectShape } from "./lib/projectStore.js";
import { generateSite } from "./generator/generateSite.js";

const upload = multer({ dest: projectImagesDir });

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

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "4mb" }));
  app.use("/project/images", express.static(projectImagesDir));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, app: "sbuild", version: "0.1.0" });
  });

  app.get("/api/project", async (_req, res) => {
    try {
      const project = await loadProject();
      res.json({ ok: true, project });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error) });
    }
  });

  app.put("/api/project", async (req, res) => {
    try {
      const project = req.body?.project as unknown;
      if (!validateProjectShape(project)) {
        res.status(400).json({ ok: false, error: "Invalid project payload" });
        return;
      }
      await saveProject(project);
      res.json({ ok: true });
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
    const prompt = String(req.body?.prompt || "");
    const result = await chatWithFallback(prompt);
    res.json({ ok: true, ...result });
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
    const key = process.env.SBUILD_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!key) {
      res.status(200).json({ ok: false, unavailable: true, message: "Image generation unavailable: API key not configured." });
      return;
    }

    // Intentionally minimal in prototype: key present but generation call deferred.
    res.json({ ok: false, unavailable: true, message: "Prototype image route not wired to provider yet." });
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
    const key = process.env.SBUILD_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    res.json({
      ok: true,
      status: {
        imageApi: key ? "configured" : "missing-key",
        publishMode: process.env.SBUILD_ALLOW_PUBLISH === "1" ? "live-enabled" : "dry-run",
        projectPath: projectFile,
        distPath: distDir
      }
    });
  });

  if (process.env.NODE_ENV === "production") {
    app.use(express.static(editorDistDir));
    app.get("*", async (req, res, next) => {
      if (req.path.startsWith("/api/") || req.path.startsWith("/project/images")) {
        next();
        return;
      }
      try {
        const indexPath = path.join(editorDistDir, "index.html");
        await fs.access(indexPath);
        res.type("html");
        createReadStream(indexPath).pipe(res);
      } catch {
        next();
      }
    });
  }

  return app;
}
