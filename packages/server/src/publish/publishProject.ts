import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { SBuildProject } from "@sbuild/shared";
import { promoteAtomicPublish, validatePublishDomain } from "../generator/atomicPublish.js";
import { generateSiteToDirectory } from "../generator/generateSite.js";

export type PrivateTestPublishOptions = {
  project: SBuildProject;
  testRoot: string;
  testProjectImagesRoot: string;
  domain: string;
  siteId: string;
  gitSha: string;
  mode?: "test" | "live";
  testHooks?: {
    beforePromote?: () => Promise<void>;
  };
};

export type PrivateTestPublishResult = {
  mode: "test";
  siteId: string;
  releaseName: string;
  previousReleaseName: string | null;
  generatedFileCount: number;
  copiedAssetCount: number;
};

const activePublishes = new Set<string>();
const siteIdPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function assertTempPath(value: string, label: string): string {
  if (!value) throw new Error(`${label} is required for private test-root-only publish`);
  const resolved = path.resolve(value);
  const tempRoot = path.resolve(os.tmpdir());
  if (resolved === tempRoot || !resolved.startsWith(`${tempRoot}${path.sep}`)) {
    throw new Error(`${label} must be beneath the OS temp directory`);
  }
  return resolved;
}

function validateSiteId(siteId: string): string {
  const normalized = String(siteId || "").trim();
  if (!siteIdPattern.test(normalized)) throw new Error("Unsafe site ID");
  return normalized;
}

function countCopiedAssets(files: string[], stageDir: string): number {
  const imagesDir = `${path.resolve(stageDir, "images")}${path.sep}`;
  return files.filter((file) => path.resolve(file).startsWith(imagesDir)).length;
}

/**
 * Internal-only test publisher. It has no HTTP dependency and rejects live mode
 * before creating a stage or release. Callers must explicitly inject temp roots.
 */
export async function publishProject(options: PrivateTestPublishOptions): Promise<PrivateTestPublishResult> {
  if (options.mode !== undefined && options.mode !== "test") {
    throw new Error("Live publish mode is blocked for the private test service");
  }

  const testRoot = assertTempPath(options.testRoot, "testRoot");
  const projectImagesRoot = assertTempPath(options.testProjectImagesRoot, "testProjectImagesRoot");
  const domain = validatePublishDomain(options.domain);
  const siteId = validateSiteId(options.siteId);
  const lockKey = `${testRoot}:${siteId}`;
  if (activePublishes.has(lockKey)) throw new Error("Publish already in progress");

  activePublishes.add(lockKey);
  const stageDir = path.join(testRoot, "staging", `${siteId}-${randomUUID()}`);
  try {
    const generated = await generateSiteToDirectory(options.project, {
      outputDir: stageDir,
      projectImagesRoot
    });
    await options.testHooks?.beforePromote?.();
    const promoted = await promoteAtomicPublish({
      rootDir: testRoot,
      stageDir,
      domain,
      gitSha: options.gitSha,
      dryRun: true,
      requiredFiles: ["index.html", "assets/styles.css", "sitemap.xml", "robots.txt"]
    });

    return {
      mode: "test",
      siteId,
      releaseName: promoted.releaseName,
      previousReleaseName: promoted.previousReleaseName,
      generatedFileCount: generated.files.length,
      copiedAssetCount: countCopiedAssets(generated.files, stageDir)
    };
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
    activePublishes.delete(lockKey);
  }
}
