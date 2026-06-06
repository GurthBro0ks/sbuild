import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app.js";
import { loadSharp, resolveProjectImageAbsolutePath } from "./lib/imagePipeline.js";
import { projectFile, secretsFile } from "./lib/paths.js";

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
  const oldChat = process.env.SBUILD_OPENAI_CHAT_API_KEY;
  const oldImage = process.env.SBUILD_OPENAI_IMAGE_API_KEY;
  const oldAnalyze = process.env.SBUILD_OPENAI_ANALYZE_API_KEY;
  let existingSecrets: string | null = null;
  delete process.env.SBUILD_OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SBUILD_OPENAI_CHAT_API_KEY;
  delete process.env.SBUILD_OPENAI_IMAGE_API_KEY;
  delete process.env.SBUILD_OPENAI_ANALYZE_API_KEY;
  try {
    existingSecrets = await fs.readFile(secretsFile, "utf8");
    await fs.rm(secretsFile, { force: true });
  } catch {
    existingSecrets = null;
  }
  try {
    return await fn();
  } finally {
    if (existingSecrets === null) {
      await fs.rm(secretsFile, { force: true });
    } else {
      await fs.writeFile(secretsFile, existingSecrets, "utf8");
    }
    if (oldA === undefined) delete process.env.SBUILD_OPENAI_API_KEY;
    else process.env.SBUILD_OPENAI_API_KEY = oldA;
    if (oldB === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldB;
    if (oldChat === undefined) delete process.env.SBUILD_OPENAI_CHAT_API_KEY;
    else process.env.SBUILD_OPENAI_CHAT_API_KEY = oldChat;
    if (oldImage === undefined) delete process.env.SBUILD_OPENAI_IMAGE_API_KEY;
    else process.env.SBUILD_OPENAI_IMAGE_API_KEY = oldImage;
    if (oldAnalyze === undefined) delete process.env.SBUILD_OPENAI_ANALYZE_API_KEY;
    else process.env.SBUILD_OPENAI_ANALYZE_API_KEY = oldAnalyze;
  }
}

async function withTemporarySecretsFileContent<T>(content: string, fn: () => Promise<T>): Promise<T> {
  let existingSecrets: string | null = null;
  try {
    existingSecrets = await fs.readFile(secretsFile, "utf8");
  } catch {
    existingSecrets = null;
  }
  await fs.writeFile(secretsFile, content, "utf8");
  try {
    return await fn();
  } finally {
    if (existingSecrets === null) {
      await fs.rm(secretsFile, { force: true });
    } else {
      await fs.writeFile(secretsFile, existingSecrets, "utf8");
    }
  }
}

async function withMockOllama<T>(handlers: {
  tags: { models: Array<{ name: string; size?: number; modified_at?: string; details?: { parameter_size?: string } }> };
  chat?: { status?: number; body?: unknown | (() => unknown); capture?: (body: unknown) => void };
}, fn: (endpoint: string) => Promise<T>): Promise<T> {
  const server = http.createServer((req, res) => {
    if (req.url === "/api/tags") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(handlers.tags));
      return;
    }
    if (req.url === "/api/chat") {
      let raw = "";
      req.on("data", (chunk) => { raw += String(chunk); });
      req.on("end", () => {
        handlers.chat?.capture?.(raw ? JSON.parse(raw) : {});
        const responseBody = typeof handlers.chat?.body === "function" ? handlers.chat.body() : handlers.chat?.body;
        res.writeHead(handlers.chat?.status || 200, { "content-type": "application/json" });
        res.end(JSON.stringify(responseBody || { message: { content: "mock reply" } }));
      });
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address() as AddressInfo;
  const endpoint = `http://127.0.0.1:${addr.port}`;
  const previousEndpoint = process.env.SBUILD_OLLAMA_ENDPOINT;
  delete process.env.SBUILD_OLLAMA_MODEL;
  process.env.SBUILD_OLLAMA_ENDPOINT = endpoint;
  try {
    return await fn(endpoint);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    if (previousEndpoint === undefined) delete process.env.SBUILD_OLLAMA_ENDPOINT;
    else process.env.SBUILD_OLLAMA_ENDPOINT = previousEndpoint;
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
  const key = `local-key-${Date.now()}-demo`;
  const chatKey = `local-chat-${Date.now()}-demo`;
  const saveResponse = await fetch(`${baseUrl}/api/secrets/image-keys`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageGenApiKey: key, chatApiKey: chatKey })
  });
  assert.equal(saveResponse.status, 200);

  const statusResponse = await fetch(`${baseUrl}/api/secrets/status`);
  assert.equal(statusResponse.status, 200);
  const rawText = await statusResponse.text();
  assert.ok(!rawText.includes(key));
  assert.ok(!rawText.includes(chatKey));
  const body = JSON.parse(rawText) as {
    channels?: {
      chat?: { configured?: boolean; source?: string };
      imageGen?: { configured?: boolean; source?: string };
      imageAnalyze?: { configured?: boolean; source?: string };
    };
    chat?: { configured?: boolean; source?: string; maskedKey?: string | null };
    imageGen?: { configured?: boolean; source?: string; maskedKey?: string | null };
  };
  assert.equal(body.channels?.chat?.configured, true);
  assert.ok(body.channels?.chat?.source === "local" || body.channels?.chat?.source === "env");
  assert.equal(body.channels?.imageGen?.configured, true);
  assert.ok(body.channels?.imageGen?.source === "local" || body.channels?.imageGen?.source === "env");
  assert.equal(body.chat?.configured, true);
  assert.ok(body.chat?.source === "local" || body.chat?.source === "env");
  assert.ok((body.chat?.maskedKey || "").length >= 4);
  assert.equal(body.imageGen?.configured, true);
  assert.ok(body.imageGen?.source === "local" || body.imageGen?.source === "env");
  assert.ok((body.imageGen?.maskedKey || "").length >= 4);
});

test("/api/status uses local secret key source when env key is missing", async () => {
  const oldA = process.env.SBUILD_OPENAI_API_KEY;
  const oldB = process.env.OPENAI_API_KEY;
  delete process.env.SBUILD_OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const saveResponse = await fetch(`${baseUrl}/api/secrets/image-keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageGenApiKey: `local-key-${Date.now()}-status` })
    });
    assert.equal(saveResponse.status, 200);

    const statusResponse = await fetch(`${baseUrl}/api/status`);
    assert.equal(statusResponse.status, 200);
    const body = await statusResponse.json() as {
      ok: boolean;
      status?: { imageApi?: string };
    };
    assert.equal(body.ok, true);
    assert.equal(body.status?.imageApi, "configured-local");
  } finally {
    if (oldA === undefined) delete process.env.SBUILD_OPENAI_API_KEY;
    else process.env.SBUILD_OPENAI_API_KEY = oldA;
    if (oldB === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldB;
  }
});

test("/api/status reports chat API source and model", async () => {
  const oldChat = process.env.SBUILD_OPENAI_CHAT_API_KEY;
  const oldOpenAI = process.env.OPENAI_API_KEY;
  delete process.env.SBUILD_OPENAI_CHAT_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const saveResponse = await fetch(`${baseUrl}/api/secrets/image-keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chatApiKey: `local-chat-${Date.now()}-status` })
    });
    assert.equal(saveResponse.status, 200);

    const statusResponse = await fetch(`${baseUrl}/api/status`);
    assert.equal(statusResponse.status, 200);
    const body = await statusResponse.json() as {
      ok: boolean;
      status?: {
        chatApi?: string;
        chatModel?: string;
        chat?: { configured?: boolean; source?: string; status?: string };
        imageGen?: { configured?: boolean; source?: string; status?: string };
        imageAnalyze?: { configured?: boolean; source?: string; status?: string };
      };
    };
    assert.equal(body.ok, true);
    assert.equal(body.status?.chatApi, "configured-local");
    assert.ok(typeof body.status?.chatModel === "string" && body.status.chatModel.length > 0);
    assert.equal(typeof body.status?.chat?.configured, "boolean");
    assert.equal(typeof body.status?.imageGen?.configured, "boolean");
    assert.equal(typeof body.status?.imageAnalyze?.configured, "boolean");
  } finally {
    if (oldChat === undefined) delete process.env.SBUILD_OPENAI_CHAT_API_KEY;
    else process.env.SBUILD_OPENAI_CHAT_API_KEY = oldChat;
    if (oldOpenAI === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldOpenAI;
  }
});

test("/api/ai/providers/status includes AI Chat Provider entry", async () => {
  const response = await fetch(`${baseUrl}/api/ai/providers/status`);
  assert.equal(response.status, 200);
  const body = await response.json() as {
    ok: boolean;
    channels?: {
      chat?: { configured?: boolean; source?: string; status?: string };
      imageGen?: { configured?: boolean; source?: string; status?: string };
      imageAnalyze?: { configured?: boolean; source?: string; status?: string };
    };
    providers?: Array<{ name: string; status: string; message?: string }>;
  };
  assert.equal(body.ok, true);
  assert.equal(typeof body.channels?.chat?.configured, "boolean");
  assert.equal(typeof body.channels?.imageGen?.configured, "boolean");
  assert.equal(typeof body.channels?.imageAnalyze?.configured, "boolean");
  const chatProvider = (body.providers || []).find((provider) => provider.name === "AI Chat Provider");
  assert.ok(chatProvider);
  assert.ok(["connected", "not_configured", "unknown", "error"].includes(String(chatProvider?.status || "")));
  assert.ok(typeof chatProvider?.message === "string");
});

test("/api/ai/providers/discover prefers qwen3:4b and only returns installed models", async () => {
  await withMockOllama({
    tags: {
      models: [
        { name: "mistral:7b" },
        { name: "qwen3:4b", details: { parameter_size: "4B" } },
        { name: "qwen3:4b" }
      ]
    }
  }, async () => {
    const response = await fetch(`${baseUrl}/api/ai/providers/discover`);
    assert.equal(response.status, 200);
    const body = await response.json() as {
      ok: boolean;
      ollama?: { reachable?: boolean; models?: Array<{ name: string }> };
    };
    assert.equal(body.ok, true);
    assert.equal(body.ollama?.reachable, true);
    assert.deepEqual(body.ollama?.models?.map((model) => model.name), ["qwen3:4b", "mistral:7b"]);
  });
});

test("/api/ai/providers/config prefers local qwen3 without reusing image keys", async () => {
  await withMockOllama({
    tags: {
      models: [
        { name: "mistral:7b" },
        { name: "qwen3:4b", details: { parameter_size: "4B" } }
      ]
    }
  }, async (endpoint) => {
    await withNoOpenAIKey(async () => {
      await withTemporarySecretsFileContent(JSON.stringify({
        imageGenApiKey: "img-local-123456",
        imageAnalyzeApiKey: "analyze-local-654321",
        chatProvider: "ollama",
        chatModel: ""
      }), async () => {
        const response = await fetch(`${baseUrl}/api/ai/providers/config`);
        assert.equal(response.status, 200);
        const body = await response.json() as {
          ok: boolean;
          provider?: string;
          model?: string;
          baseUrl?: string;
          hasApiKey?: boolean;
          apiKeySource?: string;
        };
        assert.equal(body.ok, true);
        assert.equal(body.provider, "ollama");
        assert.equal(body.model, "qwen3:4b");
        assert.equal(body.baseUrl, endpoint);
        assert.equal(body.hasApiKey, false);
        assert.equal(body.apiKeySource, "missing");
      });
    });
  });
});

test("auth: saving chat provider config does not overwrite image channel secrets", async () => {
  const server = await createAuthTestServer();
  try {
    await withMockOllama({
      tags: { models: [{ name: "qwen3:4b" }] }
    }, async () => {
      await withTemporarySecretsFileContent(JSON.stringify({
        imageGenApiKey: "sk-image-1234567890",
        imageAnalyzeApiKey: "sk-analyze-0987654321"
      }), async () => {
        const adminSession = await loginAs(server, "admin", "admin123");
        const saveRes = await fetch(`${server.baseUrl}/api/ai/providers/config`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie: `sbuild_session=${adminSession}` },
          body: JSON.stringify({ provider: "ollama", model: "qwen3:4b", baseUrl: "https://api.openai.com/v1" })
        });
        assert.equal(saveRes.status, 200);

        const statusRes = await fetch(`${server.baseUrl}/api/secrets/status`, {
          headers: { cookie: `sbuild_session=${adminSession}` }
        });
        assert.equal(statusRes.status, 200);
        const body = await statusRes.json() as {
          ok: boolean;
          chatProvider?: { provider?: string; model?: string; baseUrl?: string };
          imageGen?: { configured?: boolean; source?: string; maskedKey?: string | null };
          imageAnalyze?: { configured?: boolean; source?: string; maskedKey?: string | null };
          chat?: { configured?: boolean; maskedKey?: string | null };
        };
        assert.equal(body.ok, true);
        assert.equal(body.chatProvider?.provider, "ollama");
        assert.equal(body.chatProvider?.model, "qwen3:4b");
        assert.equal(body.chatProvider?.baseUrl, `http://127.0.0.1:${new URL(process.env.SBUILD_OLLAMA_ENDPOINT || "").port}`);
        assert.equal(body.imageGen?.configured, true);
        assert.equal(body.imageGen?.source, "local");
        assert.ok((body.imageGen?.maskedKey || "").length >= 4);
        assert.equal(body.imageAnalyze?.configured, true);
        assert.equal(body.imageAnalyze?.source, "local");
        assert.ok((body.imageAnalyze?.maskedKey || "").length >= 4);
        assert.equal(body.chat?.configured, false);
      });
    });
  } finally {
    await server.close();
  }
});

test("/api/status handles malformed local secrets file safely", async () => {
  await withTemporarySecretsFileContent("{ not-json ", async () => {
    const response = await fetch(`${baseUrl}/api/status`);
    assert.equal(response.status, 200);
    const body = await response.json() as {
      ok: boolean;
      status?: {
        imageApi?: string;
        imageAnalyzeApi?: string;
        imageGen?: { configured?: boolean; source?: string };
        imageAnalyze?: { configured?: boolean; source?: string };
      };
    };
    assert.equal(body.ok, true);
    assert.ok(typeof body.status?.imageApi === "string");
    assert.ok(typeof body.status?.imageAnalyzeApi === "string");
    assert.equal(typeof body.status?.imageGen?.configured, "boolean");
    assert.equal(typeof body.status?.imageAnalyze?.configured, "boolean");
  });
});

test("/api/ai/providers/test supports image-analyze provider", async () => {
  const response = await fetch(`${baseUrl}/api/ai/providers/test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "image-analyze" })
  });
  assert.equal(response.status, 200);
  const body = await response.json() as { ok: boolean; status?: string; message?: string };
  assert.ok(typeof body.status === "string");
  assert.ok(typeof body.message === "string");
});

test("/api/ai/memory sanitizes key-like strings", async () => {
  const postResponse = await fetch(`${baseUrl}/api/ai/memory`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ summary: "token=local-token-123 and apiKey: abc123" })
  });
  assert.equal(postResponse.status, 200);

  const getResponse = await fetch(`${baseUrl}/api/ai/memory`);
  assert.equal(getResponse.status, 200);
  const body = await getResponse.json() as { ok: boolean; memory?: { summaries?: string[] } };
  assert.equal(body.ok, true);
  const last = body.memory?.summaries?.slice(-1)[0] || "";
  assert.ok(last.includes("apiKey: [redacted]"));
  assert.ok(!last.includes("apiKey: abc123"));
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

test("/api/images/folder accepts project/images and rejects unsafe paths", async () => {
  const accepted = await fetch(`${baseUrl}/api/images/folder`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ folder: "project/images/subfolder" })
  });
  assert.equal(accepted.status, 200);
  const acceptedBody = await accepted.json() as { ok: boolean; folder?: string };
  assert.equal(acceptedBody.ok, true);
  assert.equal(acceptedBody.folder, "project/images/subfolder");

  const invalidPaths = ["", "/go", "../", "../../etc", "project/../secrets", "go", "project/images/../../etc"];
  for (const invalid of invalidPaths) {
    const response = await fetch(`${baseUrl}/api/images/folder`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ folder: invalid })
    });
    assert.equal(response.status, 400, `expected 400 for ${invalid}`);
    const body = await response.json() as { ok: boolean; error?: string };
    assert.equal(body.ok, false);
    assert.ok((body.error || "").length > 0);
  }
});

// --- Auth tests (with enabled auth) ---

function createAuthTestServer() {
  const app = createApp({ enableAuth: true, usersFilePath: path.join(os.tmpdir(), `sbuild-auth-test-users-${Date.now()}.json`) });
  const server = app.listen(0);
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return { baseUrl, server, close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))) };
}

async function loginAs(server: ReturnType<typeof createAuthTestServer>, username: string, password: string): Promise<string> {
  const loginRes = await fetch(`${server.baseUrl}/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }).toString(),
    redirect: "manual"
  });
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const match = setCookie.match(/sbuild_session=([^;]+)/);
  return match ? match[1] : "";
}

test("auth: login with admin credentials returns session cookie", async () => {
  const server = await createAuthTestServer();
  try {
    const sessionToken = await loginAs(server, "admin", "admin123");
    assert.ok(sessionToken.length > 0, "should get session token");
  } finally {
    await server.close();
  }
});

test("auth: login with wrong password returns 401", async () => {
  const server = await createAuthTestServer();
  try {
    const loginRes = await fetch(`${server.baseUrl}/login`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: "admin", password: "wrong" }).toString(),
      redirect: "manual"
    });
    assert.equal(loginRes.status, 401);
  } finally {
    await server.close();
  }
});

test("auth: GET /api/account/me returns current user info", async () => {
  const server = await createAuthTestServer();
  try {
    const sessionToken = await loginAs(server, "admin", "admin123");
    const meRes = await fetch(`${server.baseUrl}/api/account/me`, {
      headers: { cookie: `sbuild_session=${sessionToken}` }
    });
    assert.equal(meRes.status, 200);
    const body = await meRes.json() as { ok: boolean; user: { username: string; role: string } };
    assert.equal(body.ok, true);
    assert.equal(body.user.username, "admin");
    assert.equal(body.user.role, "admin");
  } finally {
    await server.close();
  }
});

test("auth: unauth GET /api/account/me returns 401", async () => {
  const server = await createAuthTestServer();
  try {
    const meRes = await fetch(`${server.baseUrl}/api/account/me`);
    assert.equal(meRes.status, 401);
  } finally {
    await server.close();
  }
});

test("auth: change password with correct current password succeeds", async () => {
  const server = await createAuthTestServer();
  try {
    const sessionToken = await loginAs(server, "admin", "admin123");
    const changeRes = await fetch(`${server.baseUrl}/api/account/change-password`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `sbuild_session=${sessionToken}` },
      body: JSON.stringify({ currentPassword: "admin123", newPassword: "newpass123", confirmPassword: "newpass123" })
    });
    assert.equal(changeRes.status, 200);
    const body = await changeRes.json() as { ok: boolean; message: string };
    assert.equal(body.ok, true);

    // Verify login with new password works
    const newSessionToken = await loginAs(server, "admin", "newpass123");
    assert.ok(newSessionToken.length > 0);
  } finally {
    await server.close();
  }
});

test("auth: change password with wrong current password fails", async () => {
  const server = await createAuthTestServer();
  try {
    const sessionToken = await loginAs(server, "admin", "admin123");
    const changeRes = await fetch(`${server.baseUrl}/api/account/change-password`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `sbuild_session=${sessionToken}` },
      body: JSON.stringify({ currentPassword: "wrongpass", newPassword: "newpass123", confirmPassword: "newpass123" })
    });
    assert.equal(changeRes.status, 403);
  } finally {
    await server.close();
  }
});

test("auth: change password with mismatched confirmation fails", async () => {
  const server = await createAuthTestServer();
  try {
    const sessionToken = await loginAs(server, "admin", "admin123");
    const changeRes = await fetch(`${server.baseUrl}/api/account/change-password`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `sbuild_session=${sessionToken}` },
      body: JSON.stringify({ currentPassword: "admin123", newPassword: "newpass123", confirmPassword: "different" })
    });
    assert.equal(changeRes.status, 400);
  } finally {
    await server.close();
  }
});

test("auth: admin can list users and create non-admin user", async () => {
  const server = await createAuthTestServer();
  try {
    const adminSession = await loginAs(server, "admin", "admin123");
    const listRes = await fetch(`${server.baseUrl}/api/admin/users`, {
      headers: { cookie: `sbuild_session=${adminSession}` }
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json() as { ok: boolean; users: Array<{ username: string; role: string }> };
    assert.equal(listBody.ok, true);
    assert.ok(listBody.users.length >= 1);
    assert.equal(listBody.users[0].username, "admin");

    const createRes = await fetch(`${server.baseUrl}/api/admin/users`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `sbuild_session=${adminSession}` },
      body: JSON.stringify({ username: "operator", password: "op12345" })
    });
    assert.equal(createRes.status, 200);
    const createBody = await createRes.json() as { ok: boolean; user: { username: string; role: string } };
    assert.equal(createBody.ok, true);
    assert.equal(createBody.user.username, "operator");
    assert.equal(createBody.user.role, "user");
  } finally {
    await server.close();
  }
});

test("auth: non-admin user cannot access admin APIs", async () => {
  const server = await createAuthTestServer();
  try {
    const adminSession = await loginAs(server, "admin", "admin123");

    // Create a normal user
    await fetch(`${server.baseUrl}/api/admin/users`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `sbuild_session=${adminSession}` },
      body: JSON.stringify({ username: "operator", password: "op12345" })
    });

    // Login as normal user
    const userSession = await loginAs(server, "operator", "op12345");
    assert.ok(userSession.length > 0);

    // Try to access admin API
    const listRes = await fetch(`${server.baseUrl}/api/admin/users`, {
      headers: { cookie: `sbuild_session=${userSession}` }
    });
    assert.equal(listRes.status, 403);

    // Verify account/me shows user role
    const meRes = await fetch(`${server.baseUrl}/api/account/me`, {
      headers: { cookie: `sbuild_session=${userSession}` }
    });
    assert.equal(meRes.status, 200);
    const meBody = await meRes.json() as { ok: boolean; user: { username: string; role: string } };
    assert.equal(meBody.user.role, "user");
  } finally {
    await server.close();
  }
});

test("auth: admin can disable non-admin user", async () => {
  const server = await createAuthTestServer();
  try {
    const adminSession = await loginAs(server, "admin", "admin123");
    await fetch(`${server.baseUrl}/api/admin/users`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `sbuild_session=${adminSession}` },
      body: JSON.stringify({ username: "operator", password: "op12345" })
    });

    const listRes = await fetch(`${server.baseUrl}/api/admin/users`, {
      headers: { cookie: `sbuild_session=${adminSession}` }
    });
    const listBody = await listRes.json() as { ok: boolean; users: Array<{ id: string; username: string }> };
    const userId = listBody.users.find((u) => u.username === "operator")?.id;
    assert.ok(userId);

    const deleteRes = await fetch(`${server.baseUrl}/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: { cookie: `sbuild_session=${adminSession}` }
    });
    assert.equal(deleteRes.status, 200);

    // Verify user no longer shows in list
    const listAfterRes = await fetch(`${server.baseUrl}/api/admin/users`, {
      headers: { cookie: `sbuild_session=${adminSession}` }
    });
    const listAfterBody = await listAfterRes.json() as { ok: boolean; users: Array<{ username: string; disabled?: boolean }> };
    const disabledUser = listAfterBody.users.find((u) => u.username === "operator");
    assert.equal(disabledUser?.disabled, true);
  } finally {
    await server.close();
  }
});

test("auth: publish still returns 401 without auth", async () => {
  const server = await createAuthTestServer();
  try {
    const publishRes = await fetch(`${server.baseUrl}/api/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(publishRes.status, 401);
  } finally {
    await server.close();
  }
});

test("auth: unauth GET /api/secrets/status returns 401", async () => {
  const server = await createAuthTestServer();
  try {
    const res = await fetch(`${server.baseUrl}/api/secrets/status`);
    assert.equal(res.status, 401);
  } finally {
    await server.close();
  }
});

test("auth: unauth POST /api/secrets/image-keys returns 401", async () => {
  const server = await createAuthTestServer();
  try {
    const res = await fetch(`${server.baseUrl}/api/secrets/image-keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageGenApiKey: "sk-test" })
    });
    assert.equal(res.status, 401);
  } finally {
    await server.close();
  }
});

test("auth: non-admin user GET /api/secrets/status returns 403", async () => {
  const server = await createAuthTestServer();
  try {
    const adminSession = await loginAs(server, "admin", "admin123");
    await fetch(`${server.baseUrl}/api/admin/users`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `sbuild_session=${adminSession}` },
      body: JSON.stringify({ username: "operator", password: "op12345" })
    });
    const userSession = await loginAs(server, "operator", "op12345");
    assert.ok(userSession.length > 0);

    const res = await fetch(`${server.baseUrl}/api/secrets/status`, {
      headers: { cookie: `sbuild_session=${userSession}` }
    });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});

test("auth: non-admin user POST /api/secrets/image-keys returns 403", async () => {
  const server = await createAuthTestServer();
  try {
    const adminSession = await loginAs(server, "admin", "admin123");
    await fetch(`${server.baseUrl}/api/admin/users`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `sbuild_session=${adminSession}` },
      body: JSON.stringify({ username: "operator", password: "op12345" })
    });
    const userSession = await loginAs(server, "operator", "op12345");
    assert.ok(userSession.length > 0);

    const res = await fetch(`${server.baseUrl}/api/secrets/image-keys`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `sbuild_session=${userSession}` },
      body: JSON.stringify({ imageGenApiKey: "sk-test" })
    });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});

test("auth: admin user can GET /api/secrets/status", async () => {
  const server = await createAuthTestServer();
  try {
    const adminSession = await loginAs(server, "admin", "admin123");
    const res = await fetch(`${server.baseUrl}/api/secrets/status`, {
      headers: { cookie: `sbuild_session=${adminSession}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { ok: boolean };
    assert.equal(body.ok, true);
  } finally {
    await server.close();
  }
});

test("auth: admin user can POST /api/secrets/image-keys", async () => {
  const server = await createAuthTestServer();
  try {
    const adminSession = await loginAs(server, "admin", "admin123");
    const res = await fetch(`${server.baseUrl}/api/secrets/image-keys`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `sbuild_session=${adminSession}` },
      body: JSON.stringify({ imageGenApiKey: "sk-admin-test" })
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { ok: boolean; message: string };
    assert.equal(body.ok, true);
  } finally {
    await server.close();
  }
});

test("POST /api/ai/suggest returns structured response", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] }, chat: { body: { message: { content: "mock suggestion" } } } }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Make the heading more catchy",
          targetKind: "block",
          blockId: "test-block-1",
          blockType: "hero"
        })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as {
        ok: boolean;
        suggestion?: string;
        provider?: string;
        model?: string;
        source?: string;
        latencyMs?: number;
        targetKind?: string;
        blockId?: string;
        blockType?: string;
      };
      assert.equal(body.ok, true);
      assert.ok(body.suggestion, "suggestion field exists");
      assert.equal(body.provider, "ollama");
      assert.equal(body.model, "qwen3:4b");
      assert.equal(body.source, "local");
      assert.equal(typeof body.latencyMs, "number");
      assert.equal(body.targetKind, "block");
      assert.equal(body.blockId, "test-block-1");
      assert.equal(body.blockType, "hero");
    });
  });
});

test("POST /api/ai/suggest returns 400 when prompt is empty", async () => {
  const response = await fetch(`${baseUrl}/api/ai/suggest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "" })
  });
  assert.equal(response.status, 400);
  const body = await response.json() as { ok: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.ok(body.error);
});

test("POST /api/ai/suggest with site targetKind includes site context prefix", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] }, chat: { body: { message: { content: "mock site suggestion" } } } }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Suggest a better color scheme",
          targetKind: "site"
        })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; targetKind?: string };
      assert.equal(body.targetKind, "site");
    });
  });
});

test("POST /api/ai/suggest returns stable hasProposal/provider fields", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] }, chat: { body: { message: { content: "mock stable response" } } } }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "hello",
          targetKind: "block",
          blockId: "test-1",
          blockType: "hero"
        })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; hasProposal?: boolean; provider?: string; model?: string; source?: string; latencyMs?: number };
      assert.equal(body.ok, true);
      assert.equal(typeof body.hasProposal, "boolean");
      assert.equal(typeof body.provider, "string");
      assert.equal(body.model, "qwen3:4b");
      assert.equal(body.source, "local");
      assert.equal(typeof body.latencyMs, "number");
      if (body.provider === "none") {
        assert.equal(body.hasProposal, false);
      }
    });
  });
});

test("POST /api/ai/suggest keeps hasProposal false for normal model/status answers", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] }, chat: { body: { message: { content: "Using local Ollama model qwen3:4b." } } } }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "What model are you using?", targetKind: "block", blockId: "test-1", blockType: "hero" })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { hasProposal?: boolean; proposal?: unknown };
      assert.equal(body.hasProposal, false);
      assert.equal(body.proposal, null);
    });
  });
});

test("POST /api/ai/suggest enables hasProposal for structured proposal responses", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen3:4b" }] },
    chat: { body: { message: { content: "```json\n{\"kind\":\"replace-copy\",\"replaceText\":\"Fresh catfish every Friday.\"}\n```" } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Make this shorter", targetKind: "block", blockId: "test-1", blockType: "hero" })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { hasProposal?: boolean; proposal?: { kind?: string; replaceText?: string } | null };
      assert.equal(body.hasProposal, true);
      assert.equal(body.proposal?.kind, "replace-copy");
      assert.equal(body.proposal?.replaceText, "Fresh catfish every Friday.");
    });
  });
});

test("POST /api/ai/suggest passes local provider metadata into Ollama prompt context", async () => {
  let capturedBody: any = null;
  await withMockOllama({
    tags: { models: [{ name: "qwen3:4b" }] },
    chat: {
      body: { message: { content: "metadata-aware reply" } },
      capture: (body) => { capturedBody = body; }
    }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Rewrite this briefly: Fresh catfish available every Friday.", targetKind: "site" })
      });
      assert.equal(response.status, 200);
      assert.equal(capturedBody?.model, "qwen3:4b");
      assert.equal(capturedBody?.options?.temperature, 0.2);
      const messages = Array.isArray(capturedBody?.messages) ? capturedBody.messages : [];
      assert.equal(messages[0]?.role, "system");
      assert.match(String(messages[0]?.content || ""), /Runtime chat provider: ollama\./);
      assert.match(String(messages[0]?.content || ""), /Runtime chat model: qwen3:4b\./);
      assert.match(String(messages[0]?.content || ""), /Do not claim to be a cloud-hosted provider/);
    });
  });
});

test("POST /api/ai/suggest answers UI state questions from request context without calling model", async () => {
  await withNoOpenAIKey(async () => {
    const response = await fetch(`${baseUrl}/api/ai/suggest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Which block is selected?",
        targetKind: "block",
        blockId: "hero-abc123",
        blockType: "hero"
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { ok: boolean; suggestion?: string; hasProposal?: boolean; provider?: string; model?: string };
    assert.equal(body.ok, true);
    assert.match(String(body.suggestion || ""), /Hero section.*hero-abc123/);
    assert.equal(body.hasProposal, false);
    assert.equal(body.provider, "local");
    assert.equal(body.model, "ui-state");
  });
});

test("POST /api/ai/suggest answers which target mode from request context", async () => {
  await withNoOpenAIKey(async () => {
    const response = await fetch(`${baseUrl}/api/ai/suggest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Which target mode is selected?",
        targetKind: "page"
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { ok: boolean; suggestion?: string; hasProposal?: boolean };
    assert.equal(body.ok, true);
    assert.match(String(body.suggestion || ""), /Current Page is active/);
    assert.equal(body.hasProposal, false);
  });
});

test("POST /api/ai/suggest does not enable hasProposal for UI state answers", async () => {
  await withNoOpenAIKey(async () => {
    const response = await fetch(`${baseUrl}/api/ai/suggest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Which block is selected?",
        targetKind: "block",
        blockId: "",
        blockType: ""
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { ok: boolean; hasProposal?: boolean };
    assert.equal(body.hasProposal, false);
  });
});

test("POST /api/ai/chat answers identity questions from runtime metadata", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] } }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "What model are you using? Are you local?" })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { provider?: string; model?: string; source?: string; response?: string; latencyMs?: number };
      assert.equal(body.provider, "ollama");
      assert.equal(body.model, "qwen3:4b");
      assert.equal(body.source, "local");
      assert.match(String(body.response || ""), /local Ollama model qwen3:4b/i);
      assert.equal(typeof body.latencyMs, "number");
    });
  });
});

test("POST /api/ai/chat keeps local provider metadata on no-content replies", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] }, chat: { body: { message: { content: "" } } } }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "hello" })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { provider?: string; model?: string; source?: string; response?: string; message?: string };
      assert.equal(body.provider, "ollama");
      assert.equal(body.model, "qwen3:4b");
      assert.equal(body.source, "local");
      assert.match(String(body.response || ""), /provider is still configured/i);
      assert.match(String(body.message || ""), /provider is still configured/i);
    });
  });
});

test("POST /api/ai/chat follow-up after identity keeps configured local provider on failure", async () => {
  let callCount = 0;
  await withMockOllama({
    tags: { models: [{ name: "qwen3:4b" }] },
    chat: {
      body: () => {
        callCount += 1;
        return callCount === 1
          ? { message: { content: "normal reply" } }
          : { message: { content: "" } };
      }
    }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const first = await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Rewrite this briefly: Fresh catfish available every Friday." })
      }).then((r) => r.json() as Promise<{ provider?: string; model?: string; source?: string; response?: string }>);
      assert.equal(first.provider, "ollama");
      assert.equal(first.model, "qwen3:4b");
      assert.equal(first.source, "local");
      assert.equal(first.response, "normal reply");

      const second = await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Which scope tab is selected?" })
      }).then((r) => r.json() as Promise<{ provider?: string; model?: string; source?: string; response?: string }>);
      assert.equal(second.provider, "ollama");
      assert.equal(second.model, "qwen3:4b");
      assert.equal(second.source, "local");
      assert.match(String(second.response || ""), /provider is still configured/i);
      assert.doesNotMatch(String(second.response || ""), /no provider configured/i);
    });
  });
});

test("POST /api/ai/chat response does not leak raw secret values", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] }, chat: { body: { message: { content: "safe local reply" } } } }, async () => {
    await withTemporarySecretsFileContent(JSON.stringify({
      chatApiKey: "sk-secret-chat-value",
      imageGenApiKey: "sk-secret-image-value",
      imageAnalyzeApiKey: "sk-secret-analyze-value",
      chatProvider: "ollama",
      chatModel: "qwen3:4b"
    }), async () => {
      const response = await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "hello" })
      });
      assert.equal(response.status, 200);
      const raw = await response.text();
      assert.ok(!raw.includes("sk-secret-chat-value"));
      assert.ok(!raw.includes("sk-secret-image-value"));
      assert.ok(!raw.includes("sk-secret-analyze-value"));
    });
  });
});

test("POST /api/ai/suggest passes chat history as messages to Ollama", async () => {
  let capturedBody: unknown = null;
  await withMockOllama({
    tags: { models: [{ name: "qwen3:4b" }] },
    chat: {
      capture: (body) => { capturedBody = body; },
      body: { message: { content: "follow-up reply" } }
    }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Make it shorter",
          targetKind: "block",
          blockId: "test-block",
          blockType: "text",
          chatHistory: [
            { role: "user", text: "Write a welcome message" },
            { role: "assistant", text: "Welcome to our site!" }
          ]
        })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; suggestion?: string };
      assert.equal(body.ok, true);
      assert.equal(body.suggestion, "follow-up reply");
      const messages = (capturedBody as { messages?: Array<{ role: string; content: string }> })?.messages || [];
      assert.ok(messages.length >= 4, "messages include system + history + user prompt");
      const userMsg = messages.find((m) => m.role === "user" && m.content.includes("Write a welcome message"));
      assert.ok(userMsg, "history user message passed through");
      const assistantMsg = messages.find((m) => m.role === "assistant" && m.content.includes("Welcome to our site"));
      assert.ok(assistantMsg, "history assistant message passed through");
      const finalUser = messages.find((m) => m.role === "user" && m.content.includes("Make it shorter"));
      assert.ok(finalUser, "current user prompt included");
    });
  });
});

test("POST /api/ai/chat fails safely with malformed provider config", async () => {
  await withTemporarySecretsFileContent(JSON.stringify({ chatProvider: "bogus-provider", chatModel: "qwen3:4b" }), async () => {
    const response = await fetch(`${baseUrl}/api/ai/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "hello" })
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { ok: boolean; provider?: string; response?: string; source?: string };
    assert.equal(body.ok, true);
    assert.equal(body.provider, "none");
    assert.equal(body.source, "missing");
    assert.match(String(body.response || ""), /no provider configured/i);
  });
});

test("GET /api/ai/memory returns user memory", async () => {
  const response = await fetch(`${baseUrl}/api/ai/memory`);
  assert.equal(response.status, 200);
  const body = await response.json() as { ok: boolean; memory: { summaries: string[]; lastChatAt: number } };
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.memory.summaries));
});

test("POST /api/ai/memory appends summary for user", async () => {
  const response = await fetch(`${baseUrl}/api/ai/memory`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ summary: "test summary " + Date.now() })
  });
  assert.equal(response.status, 200);
  const body = await response.json() as { ok: boolean };
  assert.equal(body.ok, true);
});

test("POST /api/ai/memory returns 400 when summary is empty", async () => {
  const response = await fetch(`${baseUrl}/api/ai/memory`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ summary: "" })
  });
  assert.equal(response.status, 400);
  const body = await response.json() as { ok: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.ok(body.error);
});

test("DELETE /api/ai/memory clears user memory", async () => {
  await fetch(`${baseUrl}/api/ai/memory`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ summary: "to be cleared" })
  });
  const delResponse = await fetch(`${baseUrl}/api/ai/memory`, { method: "DELETE" });
  assert.equal(delResponse.status, 200);
  const delBody = await delResponse.json() as { ok: boolean };
  assert.equal(delBody.ok, true);
  const getResponse = await fetch(`${baseUrl}/api/ai/memory`);
  const getBody = await getResponse.json() as { ok: boolean; memory: { summaries: string[] } };
  assert.equal(getBody.memory.summaries.length, 0);
});
