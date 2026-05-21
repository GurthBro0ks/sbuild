import { CropMode, ImageSizeDecision, ImageTargetContext } from "./types.js";

const DEFAULT_DECISION: ImageSizeDecision = {
  providerSize: "1024x1024",
  desiredAspectRatio: "1:1",
  outputWidth: 1024,
  outputHeight: 1024,
  cropMode: "cover",
  reason: "Unknown context uses safe square default.",
  warnings: []
};

function parseAspectRatio(hint?: string): { w: number; h: number } | null {
  if (!hint) return null;
  const trimmed = hint.trim();
  if (!trimmed) return null;

  if (trimmed.includes(":")) {
    const [wStr, hStr] = trimmed.split(":", 2);
    const w = Number(wStr);
    const h = Number(hStr);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return { w, h };
    }
    return null;
  }

  const ratio = Number(trimmed);
  if (Number.isFinite(ratio) && ratio > 0) {
    return { w: ratio, h: 1 };
  }

  return null;
}

function roundEven(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function outputFromAspect(ratio: { w: number; h: number }, baseWidth: number): { width: number; height: number } {
  const rawHeight = (baseWidth * ratio.h) / ratio.w;
  return { width: roundEven(baseWidth), height: roundEven(rawHeight) };
}

function chooseProviderByAspect(ratio: { w: number; h: number }): "1024x1024" | "1024x1536" | "1536x1024" {
  const aspect = ratio.w / ratio.h;
  if (aspect > 1.1) return "1536x1024";
  if (aspect < 0.9) return "1024x1536";
  return "1024x1024";
}

export function decideImageSize(targetContext?: Partial<ImageTargetContext> | null): ImageSizeDecision {
  if (!targetContext) {
    return {
      ...DEFAULT_DECISION,
      warnings: ["No targetContext provided; using safe default sizing."]
    };
  }

  const warnings: string[] = [];
  const blockType = targetContext.blockType || "unknown";
  const usage = targetContext.usage || "custom";
  const cropMode: CropMode = targetContext.cropMode || "cover";
  const aspectHint = parseAspectRatio(targetContext.aspectRatioHint);
  if (targetContext.aspectRatioHint && !aspectHint) {
    warnings.push(`Invalid aspectRatioHint '${targetContext.aspectRatioHint}', ignored.`);
  }

  if (usage === "heroBackground" || blockType === "hero" || blockType === "background") {
    return {
      providerSize: "1536x1024",
      desiredAspectRatio: aspectHint ? `${aspectHint.w}:${aspectHint.h}` : "16:9",
      outputWidth: aspectHint ? outputFromAspect(aspectHint, 1536).width : 1536,
      outputHeight: aspectHint ? outputFromAspect(aspectHint, 1536).height : 864,
      cropMode,
      reason: "Hero/background images prefer a wide landscape render with cover fit.",
      warnings
    };
  }

  if (usage === "socialOg") {
    return {
      providerSize: "1536x1024",
      desiredAspectRatio: "1200:630",
      outputWidth: 1200,
      outputHeight: 630,
      cropMode: "cover",
      reason: "Social OG graphics are generated wide then cropped to 1200x630.",
      warnings
    };
  }

  if (usage === "logo" || blockType === "navLogo") {
    return {
      providerSize: "1024x1024",
      desiredAspectRatio: aspectHint ? `${aspectHint.w}:${aspectHint.h}` : "1:1",
      outputWidth: 512,
      outputHeight: 512,
      cropMode: targetContext.cropMode || "contain",
      reason: "Logo workflows use square transparent-friendly output with contain fit.",
      warnings
    };
  }

  if (usage === "favicon" || blockType === "favicon") {
    return {
      providerSize: "1024x1024",
      desiredAspectRatio: "1:1",
      outputWidth: 512,
      outputHeight: 512,
      cropMode: targetContext.cropMode || "contain",
      reason: "Favicons generate from square master art for later downscaling.",
      warnings
    };
  }

  if (usage === "galleryItem" || usage === "cardImage" || blockType === "gallery" || blockType === "card") {
    const ratio = aspectHint || { w: 1, h: 1 };
    const squareish = Math.abs(ratio.w / ratio.h - 1) < 0.2;
    const dims = squareish ? { width: 1024, height: 1024 } : outputFromAspect(ratio, 1024);
    return {
      providerSize: squareish ? "1024x1024" : chooseProviderByAspect(ratio),
      desiredAspectRatio: `${ratio.w}:${ratio.h}`,
      outputWidth: dims.width,
      outputHeight: dims.height,
      cropMode,
      reason: "Gallery/card imagery defaults to square unless a specific aspect ratio is requested.",
      warnings
    };
  }

  if (usage === "inlineImage" || blockType === "image") {
    const ratio = aspectHint || { w: 1, h: 1 };
    const dims = outputFromAspect(ratio, ratio.w >= ratio.h ? 1200 : 1024);
    return {
      providerSize: chooseProviderByAspect(ratio),
      desiredAspectRatio: `${ratio.w}:${ratio.h}`,
      outputWidth: dims.width,
      outputHeight: dims.height,
      cropMode,
      reason: "Inline image blocks preserve requested aspect when available.",
      warnings
    };
  }

  return {
    ...DEFAULT_DECISION,
    cropMode,
    warnings
  };
}
