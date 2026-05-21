import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import multer from "multer";
import {
  CropMode,
  ImageSizeDecision,
  ImageTargetContext,
  OpenAIImageSize,
  SBuildProject,
  decideImageSize
} from "@sbuild/shared";
import { applyDeterministicPaintFix, chatWithFallback, wizardFallback } from "./lib/ai.js";
import {
  backupsDir,
  distDir,
  editedImagesDir,
  editorDistDir,
  generatedImagesDir,
  projectFile,
  projectImagesDir,
  publishedPreviewDir
} from "./lib/paths.js";
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

const upload = multer({ dest: projectImagesDir });
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

async function listImagesRecursive(baseDir: string, current = ""): Promise<string[]> {
  const absolute = path.join(baseDir, current);
  const entries = await fs.readdir(absolute, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const next = path.join(current, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listImagesRecursive(baseDir, next)));
      continue;
    }
    out.push(`/project/images/${next.replace(/\\/g, "/")}`);
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

  app.get("/api/images", async (_req, res) => {
    try {
      await fs.mkdir(projectImagesDir, { recursive: true });
      const images = await listImagesRecursive(projectImagesDir);
      res.json({ ok: true, images: images.sort() });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error) });
    }
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
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) {
      res.status(400).json({ ok: false, error: "prompt is required" });
      return;
    }

    const targetContext = parseTargetContext(req.body?.targetContext);
    let sizeDecision = decideImageSize(targetContext);
    sizeDecision = withExplicitSize(sizeDecision, req.body?.explicitSize ?? req.body?.size);
    const warnings: string[] = [...sizeDecision.warnings];

    const key = process.env.SBUILD_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
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
    const key = process.env.SBUILD_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
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
      res.status(500).json({
        ok: false,
        unavailable: true,
        message: `Local photo edit failed: ${String(error)}`,
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
        imagePipeline: imagePipelineSourceMarker(),
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
