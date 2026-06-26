import {
  BUILD_META,
  SBUILD_VERSION,
  type CardsBlockData,
  type GalleryBlockData,
  type ImageBlockData,
  type SBuildBuildInfo,
  type SBuildProject
} from "@sbuild/shared";

export type ImageMeta = { name: string; url: string; folder: string; size: number; modified: string; isEdited: boolean; extension?: string; isRenderableImage?: boolean };
export type ImageLibraryFilter = "all" | "hide-blank" | "hide-tall" | "generated" | "uploaded" | "used";
export type BuildInfoStatus = "loading" | "ok" | "unavailable";
export type BuildIdentityState = {
  status: "loading" | "match" | "mismatch" | "unverified";
  browserCommit: string;
  serverCommit: string;
  message: string;
  detail: string;
};
export type ImageDiagnostics = { width: number; height: number; likelyWhite: boolean; likelyTallCapture: boolean };
export type ImageDeleteResult = { path: string; deleted: boolean; error?: string; skipped?: string };
export type ImageDeleteResponse = { ok: boolean; deletedCount: number; skippedCount: number; results: ImageDeleteResult[] };

export const RENDERABLE_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"]);

export function isRenderableImageMeta(meta: ImageMeta): boolean {
  if (meta.isRenderableImage === true) return true;
  if (meta.isRenderableImage === false) return false;
  if (typeof meta.extension === "string" && meta.extension) {
    return RENDERABLE_IMAGE_EXTENSIONS.has(meta.extension.toLowerCase());
  }
  if (typeof meta.name === "string" && meta.name.startsWith(".")) return false;
  if (typeof meta.size === "number" && meta.size === 0) return false;
  return true;
}

export function collectUsedImageUrls(project: SBuildProject | null): Set<string> {
  const used = new Set<string>();
  if (!project) return used;
  for (const page of project.pages) {
    for (const block of page.blocks) {
      if (block.styles?.backgroundImage) used.add(block.styles.backgroundImage);
      if (block.type === "image") {
        const src = (block.data as ImageBlockData).src;
        if (src) used.add(src);
      }
      if (block.type === "gallery") {
        const galleryData = block.data as GalleryBlockData;
        for (const image of galleryData.images || []) {
          if (image.src) used.add(image.src);
        }
      }
      if (block.type === "cards") {
        const cardsData = block.data as CardsBlockData;
        for (const item of cardsData.cards || []) {
          const src = (item as unknown as Record<string, unknown>).image;
          if (typeof src === "string" && src) used.add(src);
        }
      }
    }
  }
  return used;
}

export function isLikelyScreenshotName(name: string): boolean {
  return /(screenshot|screen[-_]?shot|capture|img[-_]?\d{4,})/i.test(name);
}

function isGeneratedImage(meta: ImageMeta): boolean {
  return /^generated(?:\/|$)/i.test(meta.folder);
}

function isUploadedImage(meta: ImageMeta): boolean {
  return !isGeneratedImage(meta) && !meta.isEdited;
}

function hasKnownCommit(commit: string | null | undefined): commit is string {
  return Boolean(commit && commit !== "unknown" && commit !== "unreachable" && commit !== "loading");
}

export function getDisplayVersion(buildInfo: SBuildBuildInfo | null, buildInfoStatus: BuildInfoStatus): string {
  if (buildInfo?.displayVersion) return buildInfo.displayVersion;
  if (buildInfoStatus === "unavailable") return `${SBUILD_VERSION} (version unverified)`;
  return SBUILD_VERSION;
}

export function getBuildIdentityState(
  buildInfo: SBuildBuildInfo | null,
  buildInfoStatus: BuildInfoStatus,
  browserCommit = BUILD_META.gitCommitShort || "unknown"
): BuildIdentityState {
  if (buildInfoStatus === "loading") {
    return {
      status: "loading",
      browserCommit,
      serverCommit: "loading",
      message: "Checking build identity.",
      detail: ""
    };
  }
  if (buildInfoStatus === "unavailable") {
    return {
      status: "unverified",
      browserCommit,
      serverCommit: "unreachable",
      message: "Version unverified - health unavailable.",
      detail: "The browser could not reach /health, so this bundle identity cannot be verified."
    };
  }

  const servedBuildCommit = buildInfo?.gitCommit || "unknown";
  if (!hasKnownCommit(browserCommit) || !hasKnownCommit(servedBuildCommit)) {
    return {
      status: "unverified",
      browserCommit,
      serverCommit: servedBuildCommit,
      message: "Version unverified - commit info unavailable.",
      detail: "Commit info is missing, so the browser/server build match cannot be verified."
    };
  }
  if (browserCommit !== servedBuildCommit) {
    return {
      status: "mismatch",
      browserCommit,
      serverCommit: servedBuildCommit,
      message: "Browser/server build mismatch - this browser is running an older or different sBuild bundle.",
      detail: `Hard refresh may be needed. Browser ${browserCommit}, server ${servedBuildCommit}.`
    };
  }
  return {
    status: "match",
    browserCommit,
    serverCommit: servedBuildCommit,
    message: "Browser and server build match.",
    detail: `Browser and server are both on ${servedBuildCommit}.`
  };
}

export function imagePassesFilter(meta: ImageMeta, filter: ImageLibraryFilter, diagnostics: ImageDiagnostics | undefined, usedImageUrls: Set<string>): boolean {
  if (filter === "all") return true;
  if (filter === "generated") return isGeneratedImage(meta);
  if (filter === "uploaded") return isUploadedImage(meta);
  if (filter === "used") return usedImageUrls.has(meta.url);
  if (filter === "hide-blank") return !(diagnostics?.likelyWhite);
  if (filter === "hide-tall") {
    if (diagnostics?.likelyTallCapture) return false;
    return !isLikelyScreenshotName(meta.name);
  }
  return true;
}

export function shouldSyncEditableTextContent(isFocused: boolean, isComposing: boolean): boolean {
  return !isFocused && !isComposing;
}

export function getSaveFailureState(error: unknown): { dirty: true; status: string; lastAction: "save" } {
  return {
    dirty: true,
    status: `Save failed: ${error instanceof Error ? error.message : "could not save project"}`,
    lastAction: "save"
  };
}

export function createImageDeleteRequest(paths: string[]): { url: "/api/images/delete"; init: RequestInit } {
  return {
    url: "/api/images/delete",
    init: {
      method: "POST",
      body: JSON.stringify({ paths })
    }
  };
}
