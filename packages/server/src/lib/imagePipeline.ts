import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CropMode } from "@sbuild/shared";
import { projectImagesDir } from "./paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type SharpModule = {
  default: (input?: Buffer | string) => {
    grayscale: () => any;
    normalize: () => any;
    modulate: (options: Record<string, number>) => any;
    sharpen: () => any;
    resize: (width: number, height: number, options: { fit: "cover" | "contain" | "fill" }) => any;
    png: () => any;
    toBuffer: () => Promise<Buffer>;
  };
};

let sharpModulePromise: Promise<SharpModule | null> | null = null;

export function safeFilenameStem(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "image";
}

export function randomSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function projectImageUrlFromAbsolute(filePath: string): string {
  const relative = path.relative(projectImagesDir, filePath).replace(/\\/g, "/");
  return `/project/images/${relative}`;
}

export function resolveProjectImageAbsolutePath(imagePathOrUrl: string): string {
  const raw = imagePathOrUrl.trim();
  if (!raw) {
    throw new Error("imagePath is required");
  }

  let relative: string;
  if (raw.startsWith("/project/images/")) {
    relative = raw.slice("/project/images/".length);
  } else if (raw.startsWith("project/images/")) {
    relative = raw.slice("project/images/".length);
  } else {
    relative = raw;
  }

  const resolved = path.resolve(projectImagesDir, relative);
  const root = path.resolve(projectImagesDir);
  if (!resolved.startsWith(root)) {
    throw new Error("imagePath must resolve under /project/images");
  }

  return resolved;
}

export async function ensureImageSubdir(subdir: string): Promise<string> {
  const dir = path.join(projectImagesDir, subdir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function loadSharp(): Promise<SharpModule | null> {
  if (!sharpModulePromise) {
    sharpModulePromise = import("sharp")
      .then((mod) => mod as SharpModule)
      .catch(() => null);
  }
  return sharpModulePromise;
}

export function sharpFitForCropMode(cropMode: CropMode): "cover" | "contain" | "fill" {
  if (cropMode === "contain") return "contain";
  if (cropMode === "fill") return "fill";
  return "cover";
}

export async function saveBufferAsPng(targetPath: string, buffer: Buffer): Promise<void> {
  await fs.writeFile(targetPath, buffer);
}

export async function fetchUrlToBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image URL ${url}: ${response.status}`);
  }
  const bytes = await response.arrayBuffer();
  return Buffer.from(bytes);
}

export async function fitWithSharp(options: {
  input: Buffer;
  cropMode: CropMode;
  outputWidth: number;
  outputHeight: number;
}): Promise<Buffer> {
  const sharpMod = await loadSharp();
  if (!sharpMod) {
    throw new Error("sharp is not installed");
  }
  const instance = sharpMod.default(options.input);
  return instance
    .resize(options.outputWidth, options.outputHeight, { fit: sharpFitForCropMode(options.cropMode) })
    .png()
    .toBuffer();
}

export async function applyLocalEditWithSharp(options: {
  input: Buffer;
  editType: string;
  cropMode: CropMode;
  outputWidth: number;
  outputHeight: number;
}): Promise<Buffer> {
  const sharpMod = await loadSharp();
  if (!sharpMod) {
    throw new Error("sharp is not installed");
  }

  let pipeline = sharpMod.default(options.input);
  switch (options.editType) {
    case "black-white":
      pipeline = pipeline.grayscale();
      break;
    case "enhance":
      pipeline = pipeline.normalize().modulate({ brightness: 1.05, saturation: 1.08 }).sharpen();
      break;
    case "brighten":
      pipeline = pipeline.modulate({ brightness: 1.18 }).normalize();
      break;
    case "sharpen":
      pipeline = pipeline.sharpen();
      break;
    case "color-pop":
      pipeline = pipeline.modulate({ saturation: 1.25, brightness: 1.03 }).sharpen();
      break;
    case "soften-bg":
      pipeline = pipeline.modulate({ brightness: 0.98 }).blur(0.6).normalize();
      break;
    case "square-crop":
      pipeline = pipeline.resize(options.outputWidth, options.outputWidth, { fit: "cover" });
      return pipeline.png().toBuffer();
    case "wide-hero-crop":
      pipeline = pipeline.resize(Math.max(options.outputWidth, 1536), 1024, { fit: "cover" });
      return pipeline.png().toBuffer();
    case "crop-fit":
      break;
    default:
      throw new Error(`Unsupported local edit type: ${options.editType}`);
  }

  pipeline = pipeline.resize(options.outputWidth, options.outputHeight, {
    fit: sharpFitForCropMode(options.cropMode)
  });

  return pipeline.png().toBuffer();
}

export function imagePipelineSourceMarker(): string {
  return `image-pipeline:${path.relative(path.resolve(__dirname, "../../.."), __filename)}`;
}
