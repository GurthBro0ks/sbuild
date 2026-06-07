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
import {
  getChatHistory,
  appendChatHistory,
  clearChatHistory,
  replaceChatHistory
} from "./lib/chatHistoryStore.js";

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

test("/api/ai/providers/discover prefers qwen2.5:1.5b and only returns installed models", async () => {
  await withMockOllama({
    tags: {
      models: [
        { name: "mistral:7b" },
        { name: "qwen2.5:1.5b", details: { parameter_size: "1.5B" } },
        { name: "qwen3:4b", details: { parameter_size: "4B" } }
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
    assert.deepEqual(body.ollama?.models?.map((model) => model.name), ["qwen2.5:1.5b", "mistral:7b", "qwen3:4b"]);
  });
});

test("/api/ai/providers/config prefers local qwen2.5 without reusing image keys", async () => {
  await withMockOllama({
    tags: {
      models: [
        { name: "mistral:7b" },
        { name: "qwen2.5:1.5b", details: { parameter_size: "1.5B" } },
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
        assert.equal(body.model, "qwen2.5:1.5b");
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
      assert.match(String(messages[0]?.content || ""), /helpful assistant for sBuild/);
      assert.match(String(messages[0]?.content || ""), /Do NOT wrap your answer in JSON/);
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

test("POST /api/ai/suggest does not intercept model identity questions as UI state", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen2.5:1.5b" }] } }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "What model are you using?",
          targetKind: "block",
          blockId: "hero-abc123",
          blockType: "hero"
        })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; suggestion?: string; provider?: string; model?: string };
      assert.equal(body.ok, true);
      assert.match(String(body.suggestion || ""), /local Ollama model qwen2\.5:1\.5b/i);
      assert.equal(body.provider, "ollama");
      assert.equal(body.model, "qwen2.5:1.5b");
    });
  });
});

test("POST /api/ai/suggest answers 'are you local' with runtime metadata", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen2.5:1.5b" }] } }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Are you local?",
          targetKind: "block",
          blockId: "test-block",
          blockType: "hero"
        })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; suggestion?: string; provider?: string; model?: string };
      assert.equal(body.ok, true);
      assert.match(String(body.suggestion || ""), /local Ollama model qwen2\.5:1\.5b/i);
    });
  });
});

test("GET /api/ai/chat/history returns messages after chat", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] }, chat: { body: { message: { content: "hello response" } } } }, async () => {
    await withNoOpenAIKey(async () => {
      await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "hello test history" })
      });
      const response = await fetch(`${baseUrl}/api/ai/chat/history`);
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; messages: Array<{ role: string; text: string }> };
      assert.equal(body.ok, true);
      assert.ok(Array.isArray(body.messages));
      assert.ok(body.messages.length >= 2);
      assert.equal(body.messages[body.messages.length - 2].role, "user");
      assert.equal(body.messages[body.messages.length - 1].role, "assistant");
    });
  });
});

test("DELETE /api/ai/chat/history clears messages", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] }, chat: { body: { message: { content: "temp response" } } } }, async () => {
    await withNoOpenAIKey(async () => {
      await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "temp question for delete test" })
      });
      const delResponse = await fetch(`${baseUrl}/api/ai/chat/history`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      assert.equal(delResponse.status, 200);
      const delBody = await delResponse.json() as { ok: boolean };
      assert.equal(delBody.ok, true);
      const getResponse = await fetch(`${baseUrl}/api/ai/chat/history`);
      const getBody = await getResponse.json() as { ok: boolean; messages: unknown[] };
      assert.equal(getBody.messages.length, 0);
    });
  });
});

test("isUiStateQuestion does not match 'what model' substring", async () => {
  await withNoOpenAIKey(async () => {
    const response = await fetch(`${baseUrl}/api/ai/suggest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "What model are you using?",
        targetKind: "page"
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { ok: boolean; model?: string };
    assert.equal(body.ok, true);
    assert.notEqual(body.model, "ui-state");
  });
});

test("stale qwen3:4b old-default config migrates to qwen2.5:1.5b when available", async () => {
  await withMockOllama({
    tags: {
      models: [
        { name: "qwen2.5:1.5b", details: { parameter_size: "1.5B" } },
        { name: "qwen3:4b", details: { parameter_size: "4B" } }
      ]
    }
  }, async () => {
    await withTemporarySecretsFileContent(JSON.stringify({
      chatProvider: "ollama",
      chatModel: "qwen3:4b"
    }), async () => {
      const response = await fetch(`${baseUrl}/api/ai/providers/config`);
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; provider?: string; model?: string };
      assert.equal(body.ok, true);
      assert.equal(body.provider, "ollama");
      assert.equal(body.model, "qwen2.5:1.5b");
      const secretsRaw = await fs.readFile(secretsFile, "utf8");
      const secretsParsed = JSON.parse(secretsRaw) as Record<string, unknown>;
      assert.equal(secretsParsed.chatModel, "qwen2.5:1.5b");
      assert.equal(secretsParsed._chatModelMigrated, true);
    });
  });
});

test("explicit qwen3:4b selection preserved when migration flag is already set", async () => {
  await withMockOllama({
    tags: {
      models: [
        { name: "qwen2.5:1.5b", details: { parameter_size: "1.5B" } },
        { name: "qwen3:4b", details: { parameter_size: "4B" } }
      ]
    }
  }, async () => {
    await withTemporarySecretsFileContent(JSON.stringify({
      chatProvider: "ollama",
      chatModel: "qwen3:4b",
      _chatModelMigrated: true
    }), async () => {
      const response = await fetch(`${baseUrl}/api/ai/providers/config`);
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; provider?: string; model?: string };
      assert.equal(body.ok, true);
      assert.equal(body.provider, "ollama");
      assert.equal(body.model, "qwen3:4b");
    });
  });
});

test("migration does not run when new default is not available", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen3:4b", details: { parameter_size: "4B" } }] }
  }, async () => {
    await withTemporarySecretsFileContent(JSON.stringify({
      chatProvider: "ollama",
      chatModel: "qwen3:4b"
    }), async () => {
      const response = await fetch(`${baseUrl}/api/ai/providers/config`);
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; provider?: string; model?: string };
      assert.equal(body.ok, true);
      assert.equal(body.model, "qwen3:4b");
    });
  });
});

test("provider status reports active model consistently across endpoints", async () => {
  await withMockOllama({
    tags: {
      models: [
        { name: "qwen2.5:1.5b", details: { parameter_size: "1.5B" } },
        { name: "qwen3:4b", details: { parameter_size: "4B" } }
      ]
    }
  }, async () => {
    await withTemporarySecretsFileContent(JSON.stringify({
      chatProvider: "ollama",
      chatModel: "qwen2.5:1.5b"
    }), async () => {
      const providersRes = await fetch(`${baseUrl}/api/ai/providers/status`);
      assert.equal(providersRes.status, 200);
      const providersBody = await providersRes.json() as {
        channels?: { chat?: { model?: string; message?: string } };
        providers?: Array<{ name: string; message?: string }>;
      };
      assert.equal(providersBody.channels?.chat?.model, "qwen2.5:1.5b");
      assert.match(String(providersBody.channels?.chat?.message || ""), /qwen2\.5:1\.5b/);
      const statusRes = await fetch(`${baseUrl}/api/status`);
      assert.equal(statusRes.status, 200);
      const statusBody = await statusRes.json() as { status?: { chatModel?: string; chat?: { model?: string; message?: string } } };
      assert.equal(statusBody.status?.chatModel, "qwen2.5:1.5b");
      assert.equal(statusBody.status?.chat?.model, "qwen2.5:1.5b");
      assert.match(String(statusBody.status?.chat?.message || ""), /qwen2\.5:1\.5b/);
    });
  });
});

test("no raw secrets returned in provider status or config endpoints", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen2.5:1.5b", details: { parameter_size: "1.5B" } }] }
  }, async () => {
    await withTemporarySecretsFileContent(JSON.stringify({
      chatProvider: "ollama",
      chatModel: "qwen2.5:1.5b",
      chatApiKey: "sk-test-secret-key-12345678",
      imageGenApiKey: "sk-image-secret-87654321",
      imageAnalyzeApiKey: "sk-analyze-secret-abcdefgh"
    }), async () => {
      for (const endpoint of ["/api/ai/providers/status", "/api/ai/providers/config", "/api/status"]) {
        const res = await fetch(`${baseUrl}${endpoint}`);
        const text = await res.text();
        assert.doesNotMatch(text, /sk-test-secret-key-12345678/, `${endpoint} leaks chatApiKey`);
        assert.doesNotMatch(text, /sk-image-secret-87654321/, `${endpoint} leaks imageGenApiKey`);
        assert.doesNotMatch(text, /sk-analyze-secret-abcdefgh/, `${endpoint} leaks imageAnalyzeApiKey`);
      }
    });
  });
});

test("chatHistoryStore: per-user isolation", () => {
  const ts = Date.now();
  appendChatHistory("user-a-isolation-test", undefined, [
    { role: "user", text: "hello from A", timestamp: ts },
    { role: "assistant", text: "A reply", timestamp: ts }
  ]);
  appendChatHistory("user-b-isolation-test", undefined, [
    { role: "user", text: "hello from B", timestamp: ts },
    { role: "assistant", text: "B reply", timestamp: ts }
  ]);
  const aHistory = getChatHistory("user-a-isolation-test");
  const bHistory = getChatHistory("user-b-isolation-test");
  assert.ok(aHistory.some((m) => m.text.includes("from A")));
  assert.ok(!aHistory.some((m) => m.text.includes("from B")));
  assert.ok(bHistory.some((m) => m.text.includes("from B")));
  assert.ok(!bHistory.some((m) => m.text.includes("from A")));
  clearChatHistory("user-a-isolation-test");
  clearChatHistory("user-b-isolation-test");
});

test("chatHistoryStore: per-project isolation", () => {
  const ts = Date.now();
  appendChatHistory("user-proj-test", "/project/alpha", [
    { role: "user", text: "alpha question", timestamp: ts },
    { role: "assistant", text: "alpha answer", timestamp: ts }
  ]);
  appendChatHistory("user-proj-test", "/project/beta", [
    { role: "user", text: "beta question", timestamp: ts },
    { role: "assistant", text: "beta answer", timestamp: ts }
  ]);
  const alphaHistory = getChatHistory("user-proj-test", "/project/alpha");
  const betaHistory = getChatHistory("user-proj-test", "/project/beta");
  assert.ok(alphaHistory.some((m) => m.text.includes("alpha")));
  assert.ok(!alphaHistory.some((m) => m.text.includes("beta")));
  assert.ok(betaHistory.some((m) => m.text.includes("beta")));
  assert.ok(!betaHistory.some((m) => m.text.includes("alpha")));
  clearChatHistory("user-proj-test", "/project/alpha");
  clearChatHistory("user-proj-test", "/project/beta");
});

test("chatHistoryStore: delete only clears targeted project", () => {
  const ts = Date.now();
  appendChatHistory("user-del-test", "/project/keep", [
    { role: "user", text: "keep this", timestamp: ts }
  ]);
  appendChatHistory("user-del-test", "/project/remove", [
    { role: "user", text: "remove this", timestamp: ts }
  ]);
  clearChatHistory("user-del-test", "/project/remove");
  const keepHistory = getChatHistory("user-del-test", "/project/keep");
  const removeHistory = getChatHistory("user-del-test", "/project/remove");
  assert.ok(keepHistory.some((m) => m.text.includes("keep this")));
  assert.equal(removeHistory.length, 0);
  clearChatHistory("user-del-test", "/project/keep");
});

test("chatHistoryStore: redacts secrets from persisted text", () => {
  const ts = Date.now();
  appendChatHistory("user-secret-test", undefined, [
    { role: "user", text: "my key is sk-AbCdEf1234567890xYz", timestamp: ts }
  ]);
  const history = getChatHistory("user-secret-test");
  assert.ok(!history.some((m) => m.text.includes("sk-AbCdEf1234567890xYz")));
  assert.ok(history.some((m) => m.text.includes("[redacted-api-key]")));
  clearChatHistory("user-secret-test");
});

test("chatHistoryStore: caps at MAX_MESSAGES_PER_PROJECT", () => {
  const ts = Date.now();
  for (let i = 0; i < 110; i++) {
    appendChatHistory("user-cap-test", "/project/cap", [
      { role: "user", text: `msg-${i}`, timestamp: ts + i }
    ]);
  }
  const history = getChatHistory("user-cap-test", "/project/cap");
  assert.equal(history.length, 100);
  assert.ok(history[0].text.startsWith("msg-10"));
  assert.ok(history[99].text.startsWith("msg-109"));
  clearChatHistory("user-cap-test", "/project/cap");
});

test("POST /api/ai/chat stores history with projectPath", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] }, chat: { body: { message: { content: "project reply" } } } }, async () => {
    await withNoOpenAIKey(async () => {
      await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "project test", projectPath: "/my/project" })
      });
      const historyRes = await fetch(`${baseUrl}/api/ai/chat/history?projectPath=${encodeURIComponent("/my/project")}`);
      const historyBody = await historyRes.json() as { ok: boolean; messages: Array<{ role: string; text: string }> };
      assert.equal(historyBody.ok, true);
      assert.ok(historyBody.messages.length >= 2);
      const lastUser = historyBody.messages.filter((m) => m.role === "user").pop();
      assert.ok(lastUser?.text.includes("project test"));
      const lastAssistant = historyBody.messages.filter((m) => m.role === "assistant").pop();
      assert.ok(lastAssistant?.text.includes("project reply"));
      await fetch(`${baseUrl}/api/ai/chat/history`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectPath: "/my/project" })
      });
    });
  });
});

test("POST /api/ai/chat/save persists chat without download", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] }, chat: { body: { message: { content: "save reply" } } } }, async () => {
    await withNoOpenAIKey(async () => {
      await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "save test", projectPath: "/save/project" })
      });
      const saveRes = await fetch(`${baseUrl}/api/ai/chat/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectPath: "/save/project",
          messages: [
            { role: "user", text: "save test", timestamp: Date.now() },
            { role: "assistant", text: "save reply", timestamp: Date.now() }
          ]
        })
      });
      assert.equal(saveRes.status, 200);
      const cd = saveRes.headers.get("content-disposition") || "";
      assert.equal(cd.includes("attachment"), false, "save must not create download");
      const body = await saveRes.json() as { ok: boolean; savedAt: string; messageCount: number };
      assert.equal(body.ok, true);
      assert.ok(body.savedAt);
      assert.ok(body.messageCount >= 2);
      const historyRes = await fetch(`${baseUrl}/api/ai/chat/history?projectPath=${encodeURIComponent("/save/project")}`);
      const historyBody = await historyRes.json() as { ok: boolean; messages: Array<{ role: string; text: string }> };
      assert.ok(historyBody.messages.some((m) => m.text.includes("save reply")));
      await fetch(`${baseUrl}/api/ai/chat/history`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectPath: "/save/project" })
      });
    });
  });
});

test("POST /api/ai/suggest rejects proposal with empty replaceText", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen3:4b" }] },
    chat: { body: { message: { content: '```json\n{"kind":"replace-copy","replaceText":"  "}\n```' } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "fix this",
          targetKind: "block",
          blockId: "test-block",
          blockType: "text"
        })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; hasProposal?: boolean; proposal?: unknown };
      assert.equal(body.hasProposal, false);
      assert.equal(body.proposal, null);
    });
  });
});

test("POST /api/ai/suggest rejects proposal with replaceText exceeding 2000 chars", async () => {
  const longText = "x".repeat(2001);
  await withMockOllama({
    tags: { models: [{ name: "qwen3:4b" }] },
    chat: { body: { message: { content: `\`\`\`json\n{"kind":"replace-copy","replaceText":"${longText}"}\n\`\`\`` } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "fix this",
          targetKind: "block",
          blockId: "test-block",
          blockType: "text"
        })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; hasProposal?: boolean; proposal?: unknown };
      assert.equal(body.hasProposal, false);
      assert.equal(body.proposal, null);
    });
  });
});

test("POST /api/ai/suggest accepts valid proposal within size limit", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen3:4b" }] },
    chat: { body: { message: { content: '```json\n{"kind":"replace-copy","replaceText":"Hello World"}\n```' } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "fix this",
          targetKind: "block",
          blockId: "test-block",
          blockType: "text"
        })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; hasProposal?: boolean; proposal?: { kind: string; replaceText: string } };
      assert.equal(body.hasProposal, true);
      assert.equal(body.proposal?.kind, "replace-copy");
      assert.equal(body.proposal?.replaceText, "Hello World");
    });
  });
});

test("POST /api/ai/suggest strips raw JSON from suggestion when proposal exists", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen3:4b" }] },
    chat: { body: { message: { content: 'Here is my suggestion:\n```json\n{"kind":"replace-copy","replaceText":"New Hero Text"}\n```\nThis will improve the heading.' } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "suggest a better heading",
          targetKind: "block",
          blockId: "test-block",
          blockType: "hero"
        })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; suggestion?: string; hasProposal?: boolean };
      assert.equal(body.hasProposal, true);
      assert.equal(body.suggestion?.includes("```json"), false, "suggestion must not contain fenced JSON");
      assert.equal(body.suggestion?.includes('"kind"'), false, "suggestion must not contain raw proposal JSON");
    });
  });
});

test("POST /api/ai/suggest does not create proposal for question prompts", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen3:4b" }] },
    chat: { body: { message: { content: 'The background color is blue based on the CSS.' } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "what color is the background?",
          targetKind: "block",
          blockId: "test-block",
          blockType: "hero"
        })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; hasProposal?: boolean; suggestion?: string };
      assert.equal(body.hasProposal, false, "question prompts must not produce proposals");
      assert.ok(body.suggestion);
    });
  });
});

test("POST /api/ai/suggest does not create proposal for 'are you sure'", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen3:4b" }] },
    chat: { body: { message: { content: "Yes, I'm confident in that suggestion." } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "are you sure?",
          targetKind: "block",
          blockId: "test-block",
          blockType: "hero"
        })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; hasProposal?: boolean };
      assert.equal(body.hasProposal, false);
    });
  });
});

test("POST /api/ai/suggest does not create proposal even when model returns JSON for question", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen3:4b" }] },
    chat: { body: { message: { content: '```json\n{"kind":"replace-copy","replaceText":"#ffffff"}\n```' } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "what color is the background of the selected block?",
          targetKind: "block",
          blockId: "test-block",
          blockType: "hero"
        })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; hasProposal?: boolean; suggestion?: string };
      assert.equal(body.hasProposal, false, "question prompts must not produce proposals even if model returns JSON");
      assert.equal(body.suggestion?.includes("```json"), false, "display text must not contain fenced JSON");
    });
  });
});

test("POST /api/ai/suggest creates proposal for action prompts", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen3:4b" }] },
    chat: { body: { message: { content: '```json\n{"kind":"replace-copy","replaceText":"Welcome to our site"}\n```' } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const response = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "suggest a better description for the hero",
          targetKind: "block",
          blockId: "test-block",
          blockType: "hero"
        })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { ok: boolean; hasProposal?: boolean; proposal?: { kind: string; replaceText: string } };
      assert.equal(body.hasProposal, true);
      assert.equal(body.proposal?.replaceText, "Welcome to our site");
    });
  });
});

test("POST /api/ai/suggest strips raw JSON from persisted history", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen3:4b" }] },
    chat: { body: { message: { content: '```json\n{"kind":"replace-copy","replaceText":"Clean text"}\n```' } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "replace the heading",
          targetKind: "block",
          blockId: "test-block",
          blockType: "hero",
          projectPath: "/strip-test"
        })
      });
      const historyRes = await fetch(`${baseUrl}/api/ai/chat/history?projectPath=${encodeURIComponent("/strip-test")}`);
      const historyBody = await historyRes.json() as { ok: boolean; messages: Array<{ role: string; text: string }> };
      const assistantMsgs = historyBody.messages.filter((m) => m.role === "assistant");
      assert.ok(assistantMsgs.length > 0);
      assert.equal(assistantMsgs[assistantMsgs.length - 1].text.includes("```json"), false, "persisted history must not contain fenced JSON");
      await fetch(`${baseUrl}/api/ai/chat/history`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectPath: "/strip-test" })
      });
    });
  });
});

test("POST /api/ai/chat/save per-user per-project isolation", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] } }, async () => {
    await withNoOpenAIKey(async () => {
      await fetch(`${baseUrl}/api/ai/chat/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectPath: "/iso/project-a",
          messages: [
            { role: "user", text: "project a message", timestamp: Date.now() },
            { role: "assistant", text: "reply a", timestamp: Date.now() }
          ]
        })
      });
      await fetch(`${baseUrl}/api/ai/chat/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectPath: "/iso/project-b",
          messages: [
            { role: "user", text: "project b message", timestamp: Date.now() },
            { role: "assistant", text: "reply b", timestamp: Date.now() }
          ]
        })
      });
      const histA = await (await fetch(`${baseUrl}/api/ai/chat/history?projectPath=${encodeURIComponent("/iso/project-a")}`)).json() as { messages: Array<{ text: string }> };
      const histB = await (await fetch(`${baseUrl}/api/ai/chat/history?projectPath=${encodeURIComponent("/iso/project-b")}`)).json() as { messages: Array<{ text: string }> };
      assert.ok(histA.messages.some((m) => m.text.includes("project a")));
      assert.ok(!histA.messages.some((m) => m.text.includes("project b")));
      assert.ok(histB.messages.some((m) => m.text.includes("project b")));
      assert.ok(!histB.messages.some((m) => m.text.includes("project a")));
      await fetch(`${baseUrl}/api/ai/chat/history`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectPath: "/iso/project-a" }) });
      await fetch(`${baseUrl}/api/ai/chat/history`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectPath: "/iso/project-b" }) });
    });
  });
});

test("POST /api/ai/chat/save redacts secrets from persisted messages", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] } }, async () => {
    await withNoOpenAIKey(async () => {
      await fetch(`${baseUrl}/api/ai/chat/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectPath: "/secret-redact",
          messages: [
            { role: "user", text: "my key is sk-abc123def456ghi789jkl012", timestamp: Date.now() },
            { role: "assistant", text: "Bearer token_xxxxxxxxxxxxxxxx found", timestamp: Date.now() }
          ]
        })
      });
      const histRes = await fetch(`${baseUrl}/api/ai/chat/history?projectPath=${encodeURIComponent("/secret-redact")}`);
      const histBody = await histRes.json() as { messages: Array<{ text: string }> };
      assert.ok(histBody.messages.some((m) => m.text.includes("[redacted-api-key]")));
      assert.ok(histBody.messages.some((m) => m.text.includes("[redacted-token]")));
      assert.ok(!histBody.messages.some((m) => m.text.includes("sk-abc123")));
      assert.ok(!histBody.messages.some((m) => m.text.includes("Bearer token_x")));
      await fetch(`${baseUrl}/api/ai/chat/history`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectPath: "/secret-redact" }) });
    });
  });
});

test("DELETE /api/ai/chat/history deletes only current project", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] } }, async () => {
    await withNoOpenAIKey(async () => {
      await fetch(`${baseUrl}/api/ai/chat/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectPath: "/del/alpha",
          messages: [{ role: "user", text: "alpha message", timestamp: Date.now() }, { role: "assistant", text: "alpha reply", timestamp: Date.now() }]
        })
      });
      await fetch(`${baseUrl}/api/ai/chat/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectPath: "/del/beta",
          messages: [{ role: "user", text: "beta message", timestamp: Date.now() }, { role: "assistant", text: "beta reply", timestamp: Date.now() }]
        })
      });
      await fetch(`${baseUrl}/api/ai/chat/history`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectPath: "/del/alpha" }) });
      const histAlpha = await (await fetch(`${baseUrl}/api/ai/chat/history?projectPath=${encodeURIComponent("/del/alpha")}`)).json() as { messages: Array<{ text: string }> };
      const histBeta = await (await fetch(`${baseUrl}/api/ai/chat/history?projectPath=${encodeURIComponent("/del/beta")}`)).json() as { messages: Array<{ text: string }> };
      assert.equal(histAlpha.messages.length, 0);
      assert.ok(histBeta.messages.some((m) => m.text.includes("beta message")));
      await fetch(`${baseUrl}/api/ai/chat/history`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectPath: "/del/beta" }) });
    });
  });
});

test("field-aware: description prompt infers subheading target", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen2.5:1.5b" }] },
    chat: { body: { message: { content: '{"kind":"replace-copy","replaceText":"Farm fresh eggs","targetField":"subheading"}' } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const res = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "write a new description for the farm", targetKind: "block", blockId: "hero-1", blockType: "hero" })
      });
      const body = await res.json() as { ok: boolean; proposal?: { targetField?: string }; hasProposal: boolean };
      assert.ok(body.ok);
      assert.ok(body.hasProposal);
      assert.equal(body.proposal?.targetField, "subheading");
    });
  });
});

test("field-aware: headline prompt infers heading target", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen2.5:1.5b" }] },
    chat: { body: { message: { content: '{"kind":"replace-copy","replaceText":"Welcome Home","targetField":"heading"}' } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const res = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "write a new headline for the hero", targetKind: "block", blockId: "hero-1", blockType: "hero" })
      });
      const body = await res.json() as { ok: boolean; proposal?: { targetField?: string }; hasProposal: boolean };
      assert.ok(body.ok);
      assert.ok(body.hasProposal);
      assert.equal(body.proposal?.targetField, "heading");
    });
  });
});

test("field-aware: fallback inference when AI omits targetField", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen2.5:1.5b" }] },
    chat: { body: { message: { content: '{"kind":"replace-copy","replaceText":"Fresh produce daily"}' } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const res = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "write a new description for the farm produce", targetKind: "block", blockId: "hero-1", blockType: "hero" })
      });
      const body = await res.json() as { ok: boolean; proposal?: { targetField?: string }; hasProposal: boolean };
      assert.ok(body.ok);
      assert.ok(body.hasProposal);
      assert.equal(body.proposal?.targetField, "subheading");
    });
  });
});

test("field-aware: text block body prompt infers body target", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen2.5:1.5b" }] },
    chat: { body: { message: { content: '{"kind":"replace-copy","replaceText":"We grow it fresh"}' } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const res = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "rewrite the body text about our farm", targetKind: "block", blockId: "text-1", blockType: "text" })
      });
      const body = await res.json() as { ok: boolean; proposal?: { targetField?: string }; hasProposal: boolean };
      assert.ok(body.ok);
      assert.ok(body.hasProposal);
      assert.equal(body.proposal?.targetField, "body");
    });
  });
});

test("Restore Chat loads saved history from server", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] } }, async () => {
    await withNoOpenAIKey(async () => {
      await fetch(`${baseUrl}/api/ai/chat/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectPath: "/restore/test",
          messages: [
            { role: "user", text: "restore me", timestamp: Date.now() },
            { role: "assistant", text: "restored reply", timestamp: Date.now() }
          ]
        })
      });
      const res = await fetch(`${baseUrl}/api/ai/chat/history?projectPath=${encodeURIComponent("/restore/test")}`);
      const body = await res.json() as { ok: boolean; messages: Array<{ text: string }> };
      assert.ok(body.ok);
      assert.equal(body.messages.length, 2);
      assert.ok(body.messages.some((m) => m.text.includes("restore me")));
      assert.ok(body.messages.some((m) => m.text.includes("restored reply")));
      await fetch(`${baseUrl}/api/ai/chat/history`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectPath: "/restore/test" }) });
    });
  });
});

test("Save Chat does not create download/export response", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] } }, async () => {
    await withNoOpenAIKey(async () => {
      const res = await fetch(`${baseUrl}/api/ai/chat/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectPath: "/save/no-download",
          messages: [{ role: "user", text: "test", timestamp: Date.now() }, { role: "assistant", text: "reply", timestamp: Date.now() }]
        })
      });
      assert.equal(res.headers.get("content-disposition"), null);
      const body = await res.json() as { ok: boolean; savedAt: string };
      assert.ok(body.ok);
      assert.ok(body.savedAt);
      await fetch(`${baseUrl}/api/ai/chat/history`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectPath: "/save/no-download" }) });
    });
  });
});

test("chat history is per-user isolated", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] } }, async () => {
    await withNoOpenAIKey(async () => {
      appendChatHistory("user-a", "/iso", [{ role: "user", text: "user a msg", timestamp: Date.now() }]);
      appendChatHistory("user-b", "/iso", [{ role: "user", text: "user b msg", timestamp: Date.now() }]);
      const histA = getChatHistory("user-a", "/iso");
      const histB = getChatHistory("user-b", "/iso");
      assert.equal(histA.length, 1);
      assert.ok(histA[0].text.includes("user a msg"));
      assert.equal(histB.length, 1);
      assert.ok(histB[0].text.includes("user b msg"));
      clearChatHistory("user-a", "/iso");
      clearChatHistory("user-b", "/iso");
    });
  });
});

test("chat history is per-project isolated", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] } }, async () => {
    await withNoOpenAIKey(async () => {
      appendChatHistory("dev", "/proj-alpha", [{ role: "user", text: "alpha msg", timestamp: Date.now() }]);
      appendChatHistory("dev", "/proj-beta", [{ role: "user", text: "beta msg", timestamp: Date.now() }]);
      const histA = getChatHistory("dev", "/proj-alpha");
      const histB = getChatHistory("dev", "/proj-beta");
      assert.equal(histA.length, 1);
      assert.ok(histA[0].text.includes("alpha msg"));
      assert.equal(histB.length, 1);
      assert.ok(histB[0].text.includes("beta msg"));
      clearChatHistory("dev", "/proj-alpha");
      clearChatHistory("dev", "/proj-beta");
    });
  });
});

test("Clear Chat does not delete server history", async () => {
  await withMockOllama({ tags: { models: [{ name: "qwen3:4b" }] } }, async () => {
    await withNoOpenAIKey(async () => {
      await fetch(`${baseUrl}/api/ai/chat/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectPath: "/clear-test",
          messages: [{ role: "user", text: "persisted msg", timestamp: Date.now() }, { role: "assistant", text: "persisted reply", timestamp: Date.now() }]
        })
      });
      const histBefore = await (await fetch(`${baseUrl}/api/ai/chat/history?projectPath=${encodeURIComponent("/clear-test")}`)).json() as { messages: Array<{ text: string }> };
      assert.ok(histBefore.messages.length > 0);
      const histAfter = await (await fetch(`${baseUrl}/api/ai/chat/history?projectPath=${encodeURIComponent("/clear-test")}`)).json() as { messages: Array<{ text: string }> };
      assert.ok(histAfter.messages.length > 0);
      assert.ok(histAfter.messages.some((m) => m.text.includes("persisted msg")));
      await fetch(`${baseUrl}/api/ai/chat/history`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectPath: "/clear-test" }) });
    });
  });
});

test("proposal with targetField in response is preserved", async () => {
  await withMockOllama({
    tags: { models: [{ name: "qwen2.5:1.5b" }] },
    chat: { body: { message: { content: 'Here is my suggestion:\n```json\n{"kind":"replace-copy","replaceText":"New tagline","targetField":"subheading"}\n```\nHope this helps!' } } }
  }, async () => {
    await withNoOpenAIKey(async () => {
      const res = await fetch(`${baseUrl}/api/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "suggest a new tagline", targetKind: "block", blockId: "hero-1", blockType: "hero" })
      });
      const body = await res.json() as { ok: boolean; proposal?: { targetField?: string; replaceText: string }; hasProposal: boolean };
      assert.ok(body.ok);
      assert.ok(body.hasProposal);
      assert.equal(body.proposal?.replaceText, "New tagline");
      assert.equal(body.proposal?.targetField, "subheading");
    });
  });
});
