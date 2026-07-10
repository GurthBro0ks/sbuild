import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getCurrentReleaseName, listReleaseNames } from "../generator/atomicPublish.js";
import { makeBlock, makeTwoPageProject } from "../generator/__fixtures__/syntheticProject.js";
import { publishProject } from "./publishProject.js";

async function exists(filePath: string): Promise<boolean> {
  try { await fs.stat(filePath); return true; } catch { return false; }
}

async function withWorkspace(fn: (workspace: { root: string; publishRoot: string; imagesRoot: string }) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sbuild-private-publish-"));
  try {
    const publishRoot = path.join(root, "publish-root");
    const imagesRoot = path.join(root, "project-images");
    await fs.mkdir(imagesRoot, { recursive: true });
    await fn({ root, publishRoot, imagesRoot });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function writeImage(root: string, relative: string) {
  const target = path.join(root, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, "synthetic-image");
}

function projectWithReferencedAndUnsafeImages() {
  return makeTwoPageProject(
    [makeBlock("image", { id: "used", data: { src: "/images/used.png", alt: "Used" } })],
    [makeBlock("gallery", { id: "gallery", data: { title: "Gallery", images: [
      { id: "gallery-used", src: "/images/gallery-used.png", alt: "Used gallery" },
      { id: "external", src: "https://example.test/external.png", alt: "External" },
      { id: "data", src: "data:image/png;base64,AAAA", alt: "Data" },
      { id: "traversal", src: "/images/../escape.png", alt: "Traversal" }
    ] } })]
  );
}

function options(workspace: { publishRoot: string; imagesRoot: string }) {
  return {
    project: projectWithReferencedAndUnsafeImages(),
    testRoot: workspace.publishRoot,
    testProjectImagesRoot: workspace.imagesRoot,
    domain: "example.test",
    siteId: "test-site",
    gitSha: "245fe3b"
  } as const;
}

test("private test-root publisher stages multipage output, referenced assets, and atomic current", async () => {
  await withWorkspace(async (workspace) => {
    await writeImage(workspace.imagesRoot, "used.png");
    await writeImage(workspace.imagesRoot, "gallery-used.png");
    await writeImage(workspace.imagesRoot, "unused.png");
    await writeImage(workspace.imagesRoot, "escape.png");

    const result = await publishProject(options(workspace));
    assert.equal(result.mode, "test");
    assert.equal(result.siteId, "test-site");
    assert.equal(result.copiedAssetCount, 2);
    assert.equal(result.generatedFileCount >= 6, true);
    assert.equal(path.isAbsolute(result.releaseName), false);
    assert.equal(await getCurrentReleaseName(workspace.publishRoot), result.releaseName);
    assert.deepEqual(await listReleaseNames(workspace.publishRoot), [result.releaseName]);

    const release = path.join(workspace.publishRoot, "releases", result.releaseName);
    assert.equal(await exists(path.join(release, "index.html")), true);
    assert.equal(await exists(path.join(release, "about", "index.html")), true);
    assert.equal(await exists(path.join(release, "sitemap.xml")), true);
    assert.equal(await exists(path.join(release, "images", "used.png")), true);
    assert.equal(await exists(path.join(release, "images", "gallery-used.png")), true);
    assert.equal(await exists(path.join(release, "images", "unused.png")), false);
    assert.equal(await exists(path.join(release, "images", "escape.png")), false);
  });
});

test("private publisher rejects absent/non-temp roots, live mode, unsafe domain, and unsafe site ID", async () => {
  await withWorkspace(async (workspace) => {
    await assert.rejects(() => publishProject({ ...options(workspace), testRoot: "" }), /testRoot is required/);
    const nonTempRoot = path.join(path.sep, "var", "www", "unsafe");
    await assert.rejects(() => publishProject({ ...options(workspace), testRoot: nonTempRoot }), /OS temp directory/);
    await assert.rejects(() => publishProject({ ...options(workspace), mode: "live" }), /Live publish mode is blocked/);
    await assert.rejects(() => publishProject({ ...options(workspace), domain: "https://example.test" }), /Unsafe publish domain/);
    await assert.rejects(() => publishProject({ ...options(workspace), siteId: "../unsafe" }), /Unsafe site ID/);
  });
});

test("failure before promotion leaves current unchanged", async () => {
  await withWorkspace(async (workspace) => {
    const first = await publishProject(options(workspace));
    await assert.rejects(() => publishProject({
      ...options(workspace),
      gitSha: "94a3527",
      testHooks: { beforePromote: async () => { throw new Error("forced stage failure"); } }
    }), /forced stage failure/);
    assert.equal(await getCurrentReleaseName(workspace.publishRoot), first.releaseName);
    assert.deepEqual(await listReleaseNames(workspace.publishRoot), [first.releaseName]);
  });
});

test("concurrent private publish is rejected deterministically", async () => {
  await withWorkspace(async (workspace) => {
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => { releaseGate = resolve; });
    const first = publishProject({ ...options(workspace), testHooks: { beforePromote: async () => gate } });
    await new Promise((resolve) => setImmediate(resolve));
    await assert.rejects(() => publishProject(options(workspace)), /Publish already in progress/);
    releaseGate();
    await first;
  });
});
