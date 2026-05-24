import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app.js";
import { loadSharp, resolveProjectImageAbsolutePath } from "./lib/imagePipeline.js";
import { projectFile } from "./lib/paths.js";

let baseUrl = "";
let closeServer: (() => Promise<void>) | null = null;

before(async () => {
  const app = createApp();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
  closeServer = async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  };
});

after(async () => {
  if (closeServer) await closeServer();
});

async function startTempServer(editorDistPath: string): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app = createApp({ editorDistPath });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const addr = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  };
}

async function withNoOpenAIKey<T>(fn: () => Promise<T>): Promise<T> {
  const oldA = process.env.SBUILD_OPENAI_API_KEY;
  const oldB = process.env.OPENAI_API_KEY;
  delete process.env.SBUILD_OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    return await fn();
  } finally {
    if (oldA === undefined) delete process.env.SBUILD_OPENAI_API_KEY;
    else process.env.SBUILD_OPENAI_API_KEY = oldA;
    if (oldB === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldB;
  }
}

test("/api/ai/image no-key safe response includes sizeDecision", async () => {
  await withNoOpenAIKey(async () => {
    const response = await fetch(`${baseUrl}/api/ai/image`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "catfish farm at sunrise",
        targetContext: { blockType: "hero", usage: "heroBackground" }
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json() as {
      ok: boolean;
      unavailable?: boolean;
      sizeDecision?: { providerSize?: string };
      warnings?: string[];
    };
    assert.equal(body.ok, false);
    assert.equal(body.unavailable, true);
    assert.equal(body.sizeDecision?.providerSize, "1536x1024");
    assert.ok(Array.isArray(body.warnings));
  });
});

test("root route returns HTML when editor dist exists", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sbuild-editor-dist-"));
  await fs.mkdir(path.join(tempDir, "assets"), { recursive: true });
  await fs.writeFile(path.join(tempDir, "index.html"), "<!doctype html><html><body><div id='root'>sbuild-test-root</div></body></html>", "utf8");
  await fs.writeFile(path.join(tempDir, "assets", "test.js"), "console.log('asset-ok')", "utf8");

  const server = await startTempServer(tempDir);
  try {
    const rootResponse = await fetch(`${server.baseUrl}/`);
    const rootHtml = await rootResponse.text();
    assert.equal(rootResponse.status, 200);
    assert.ok(rootHtml.includes("sbuild-test-root"));

    const assetResponse = await fetch(`${server.baseUrl}/assets/test.js`);
    const assetText = await assetResponse.text();
    assert.equal(assetResponse.status, 200);
    assert.ok(assetText.includes("asset-ok"));

    const spaResponse = await fetch(`${server.baseUrl}/some/editor/path`);
    const spaHtml = await spaResponse.text();
    assert.equal(spaResponse.status, 200);
    assert.ok(spaHtml.includes("sbuild-test-root"));
  } finally {
    await server.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("/api/unknown does not return editor HTML", async () => {
  const response = await fetch(`${baseUrl}/api/this-route-does-not-exist`);
  const body = await response.json() as { ok: boolean; error?: string };
  assert.equal(response.status, 404);
  assert.equal(body.ok, false);
  assert.ok(String(body.error || "").toLowerCase().includes("api route"));
});

test("missing editor dist returns clear message and health reports false", async () => {
  const missingPath = path.join(os.tmpdir(), `sbuild-missing-dist-${Date.now()}`);
  const server = await startTempServer(missingPath);
  try {
    const rootResponse = await fetch(`${server.baseUrl}/`);
    const rootText = await rootResponse.text();
    assert.equal(rootResponse.status, 503);
    assert.ok(rootText.includes("pnpm -r build"));

    const healthResponse = await fetch(`${server.baseUrl}/health`);
    const healthBody = await healthResponse.json() as { editorDistExists?: boolean };
    assert.equal(healthResponse.status, 200);
    assert.equal(healthBody.editorDistExists, false);
  } finally {
    await server.close();
  }
});

test("/api/project remains available with editor static serving", async () => {
  const response = await fetch(`${baseUrl}/api/project`);
  const body = await response.json() as { ok: boolean; project?: unknown };
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.ok(Boolean(body.project));
});

test("/api/secrets/image-keys updates /api/secrets/status source safely", async () => {
  const key = `sk-local-${Date.now()}-demo`;
  const saveResponse = await fetch(`${baseUrl}/api/secrets/image-keys`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageGenApiKey: key })
  });
  assert.equal(saveResponse.status, 200);

  const statusResponse = await fetch(`${baseUrl}/api/secrets/status`);
  assert.equal(statusResponse.status, 200);
  const body = await statusResponse.json() as {
    imageGen?: { configured?: boolean; source?: string; maskedKey?: string | null };
  };
  assert.equal(body.imageGen?.configured, true);
  assert.ok(body.imageGen?.source === "local" || body.imageGen?.source === "env");
  assert.ok((body.imageGen?.maskedKey || "").length >= 4);
});

test("/api/ai/opencode/auth-status returns safe status payload", async () => {
  const response = await fetch(`${baseUrl}/api/ai/opencode/auth-status`);
  assert.equal(response.status, 200);
  const body = await response.json() as { ok: boolean; status?: string; message?: string; commands?: string[] };
  assert.equal(body.ok, true);
  assert.ok(typeof body.status === "string");
  assert.ok(typeof body.message === "string");
  assert.ok(Array.isArray(body.commands));
});

test("/api/images/edit returns unavailable for unsupported no-key edits", async () => {
  await withNoOpenAIKey(async () => {
    const uploadForm = new FormData();
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YVn7mQAAAAASUVORK5CYII=",
      "base64"
    );
    uploadForm.append("images", new Blob([png1x1], { type: "image/png" }), "cleanup-source.png");
    const uploadResponse = await fetch(`${baseUrl}/api/images`, { method: "POST", body: uploadForm });
    const uploadBody = await uploadResponse.json() as { uploads: Array<{ url: string }> };
    const uploadedPath = uploadBody.uploads[0]?.url;
    assert.ok(uploadedPath);

    const response = await fetch(`${baseUrl}/api/images/edit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imagePath: uploadedPath,
        instruction: "clean up",
        editType: "cleanup",
        targetContext: { blockType: "image", usage: "inlineImage" }
      })
    });
    const body = await response.json() as { ok: boolean; unavailable?: boolean; error?: string; message?: string };
    assert.equal(body.ok, false);
    assert.equal(body.unavailable, true);
  });
});

test("uploaded image edit fallback black-white preserves original and handles sharp availability", async () => {
  const sharp = await loadSharp();
  let sharpUsable = false;
  if (sharp) {
    try {
      await sharp.default(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YVn7mQAAAAASUVORK5CYII=",
          "base64"
        )
      ).png().toBuffer();
      sharpUsable = true;
    } catch {
      sharpUsable = false;
    }
  }

  await withNoOpenAIKey(async () => {
    const uploadForm = new FormData();
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YVn7mQAAAAASUVORK5CYII=",
      "base64"
    );
    uploadForm.append("images", new Blob([png1x1], { type: "image/png" }), "sample.png");

    const uploadResponse = await fetch(`${baseUrl}/api/images`, {
      method: "POST",
      body: uploadForm
    });
    assert.equal(uploadResponse.status, 200);
    const uploadBody = await uploadResponse.json() as { ok: boolean; uploads: Array<{ url: string }> };
    assert.equal(uploadBody.ok, true);
    const uploadedPath = uploadBody.uploads[0]?.url;
    assert.ok(uploadedPath);

    const sourceAbs = resolveProjectImageAbsolutePath(uploadedPath);
    const before = await fs.readFile(sourceAbs);

    const editResponse = await fetch(`${baseUrl}/api/images/edit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imagePath: uploadedPath,
        instruction: "make it classic",
        editType: "black-white",
        targetContext: { blockType: "image", usage: "inlineImage", cropMode: "contain" }
      })
    });

    const editBodyText = await editResponse.text();
    const editBody = JSON.parse(editBodyText) as {
      ok: boolean;
      editedImageUrl?: string;
      originalImageUrl?: string;
      sizeDecision?: { providerSize?: string };
      message?: string;
      warnings?: string[];
      unavailable?: boolean;
    };
    assert.equal(editResponse.status, 200);
    assert.equal(editBody.sizeDecision?.providerSize, "1024x1024");

    const afterBytes = await fs.readFile(sourceAbs);
    assert.deepEqual(afterBytes, before);

    if (sharpUsable) {
      assert.equal(editBody.ok, true);
      assert.ok(editBody.editedImageUrl);
      assert.ok(editBody.originalImageUrl);
      assert.notEqual(editBody.editedImageUrl, editBody.originalImageUrl);
      const editedAbs = resolveProjectImageAbsolutePath(editBody.editedImageUrl!);
      await fs.access(editedAbs);
      return;
    }

    assert.equal(editBody.ok, false);
    assert.equal(editBody.unavailable, true);
    const combined = `${editBody.message || ""} ${(editBody.warnings || []).join(" ")}`.toLowerCase();
    assert.ok(combined.includes("fallback") || combined.includes("sharp") || combined.includes("unavailable"));
  });
});

test("project save/load roundtrip preserves block part styles including transparent and gradient", async () => {
  const originalRaw = await fs.readFile(projectFile, "utf8");
  try {
    // Load current project
    const loadResponse = await fetch(`${baseUrl}/api/project`);
    const loadBody = await loadResponse.json() as { ok: boolean; project: any };
    assert.equal(loadBody.ok, true);

    const project = loadBody.project;
    const heroBlock = project.pages[0].blocks[0];
    heroBlock.styles = heroBlock.styles || {};
    heroBlock.styles.parts = {
      container: {
        backgroundColor: "transparent"
      }
    };

    // Save with transparent background
    const saveResponse = await fetch(`${baseUrl}/api/project`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project })
    });
    assert.equal(saveResponse.status, 200);

    // Load back and verify transparent persisted
    const reloadResponse = await fetch(`${baseUrl}/api/project`);
    const reloadBody = await reloadResponse.json() as { ok: boolean; project: any };
    assert.equal(reloadBody.ok, true);

    const loadedHero = reloadBody.project.pages[0].blocks[0];
    assert.equal(loadedHero.styles.parts.container.backgroundColor, "transparent");

    // Now test gradient
    heroBlock.styles.parts.container = {
      backgroundColor: "linear-gradient(135deg, #ff6b6b, #feca57)",
      gradientType: "linear",
      gradientColors: ["#ff6b6b", "#feca57"],
      gradientDirection: "135deg"
    };

    const saveGradientResponse = await fetch(`${baseUrl}/api/project`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project })
    });
    assert.equal(saveGradientResponse.status, 200);

    const reloadGradientResponse = await fetch(`${baseUrl}/api/project`);
    const reloadGradientBody = await reloadGradientResponse.json() as { ok: boolean; project: any };
    const loadedGradientHero = reloadGradientBody.project.pages[0].blocks[0];
    assert.equal(loadedGradientHero.styles.parts.container.backgroundColor, "linear-gradient(135deg, #ff6b6b, #feca57)");
    assert.equal(loadedGradientHero.styles.parts.container.gradientType, "linear");
    assert.deepEqual(loadedGradientHero.styles.parts.container.gradientColors, ["#ff6b6b", "#feca57"]);
  } finally {
    await fs.writeFile(projectFile, originalRaw, "utf8");
  }
});
