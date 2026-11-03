import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app.js";
import type { AddressInfo } from "node:net";

// Every filesystem target, including the stand-in for live, is disposable.
// No existing server, account, production path, or external service is used.
test("publish route requires explicit intent and preserves the authorization gate", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sbuild-publish-contract-"));
  const publishPaths = { source: path.join(root, "dist"), preview: path.join(root, "preview"), live: path.join(root, "live") };
  const envNames = ["SBUILD_ALLOW_PUBLISH", "SBUILD_AUTH_USERNAME", "SBUILD_AUTH_PASSWORD_HASH", "SBUILD_SESSION_SECRET"] as const;
  const saved = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  for (const name of envNames) delete process.env[name];
  await fs.mkdir(publishPaths.source);
  await fs.mkdir(publishPaths.live);
  await fs.writeFile(path.join(publishPaths.source, "index.html"), "synthetic new build");
  await fs.writeFile(path.join(publishPaths.live, "index.html"), "original live sentinel");
  const app = createApp({ publishPaths });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/publish`;
  async function post(body?: unknown) {
    return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  try {
    for (const flag of [undefined, "0", "1"]) {
      if (flag === undefined) delete process.env.SBUILD_ALLOW_PUBLISH;
      else process.env.SBUILD_ALLOW_PUBLISH = flag;
      for (const body of [undefined, {}, [], { dryRun: "true" }, { dryRun: "false" }, { dryRun: 0 }, { dryRun: null }, { mode: "live" }, { dryRun: true, mode: "live" }, { dryRun: false, mode: "dry-run" }]) {
        assert.equal((await post(body)).status, 400, `reject ${JSON.stringify(body)} with flag ${flag}`);
        await assert.rejects(fs.access(publishPaths.preview));
        assert.equal(await fs.readFile(path.join(publishPaths.live, "index.html"), "utf8"), "original live sentinel");
      }
    }
    // Raw JSON is essential here: JSON.stringify cannot produce duplicate keys.
    // Reject either ordering, equal duplicates, and escaped spellings of the key.
    for (const flag of [undefined, "0", "1", "true"]) {
      if (flag === undefined) delete process.env.SBUILD_ALLOW_PUBLISH;
      else process.env.SBUILD_ALLOW_PUBLISH = flag;
      for (const raw of [
        '{"dryRun":true,"dryRun":false}', '{"dryRun":false,"dryRun":true}',
        '{"dryRun":true,"dryRun":true}', '{"dryRun":false,"dryRun":false}',
        '{"dryRun":true,"dry\\u0052un":false}', '{"dry\\u0052un":false,"dryRun":true}',
        '{"dry\\u0052un":true,"dryRun":false}', '{"dryRun":false,"dry\\u0052un":true}',
        '{"dryRun":true,"nested":{"dryRun":false}}'
      ]) {
        const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: raw });
        assert.equal(response.status, 400, `reject raw ${raw} with flag ${flag}`);
        await assert.rejects(fs.access(publishPaths.preview));
        assert.equal(await fs.readFile(path.join(publishPaths.live, "index.html"), "utf8"), "original live sentinel");
      }
    }
    for (const flag of ["0", "1"]) {
      process.env.SBUILD_ALLOW_PUBLISH = flag;
      await fs.mkdir(publishPaths.preview, { recursive: true });
      await fs.writeFile(path.join(publishPaths.preview, "stale.html"), "stale preview");
      const response = await post({ dryRun: true });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true, dryRun: true, target: publishPaths.preview });
      assert.equal(await fs.readFile(path.join(publishPaths.preview, "index.html"), "utf8"), "synthetic new build");
      await assert.rejects(fs.access(path.join(publishPaths.preview, "stale.html")));
      assert.equal(await fs.readFile(path.join(publishPaths.live, "index.html"), "utf8"), "original live sentinel");
    }
    for (const flag of [undefined, "0", "true"]) {
      if (flag === undefined) delete process.env.SBUILD_ALLOW_PUBLISH;
      else process.env.SBUILD_ALLOW_PUBLISH = flag;
      assert.equal((await post({ dryRun: false })).status, 403);
      assert.equal(await fs.readFile(path.join(publishPaths.live, "index.html"), "utf8"), "original live sentinel");
    }
    process.env.SBUILD_ALLOW_PUBLISH = "1";
    const escaped = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: ' \n { "dry\\u0052un" : true } \t ' });
    assert.equal(escaped.status, 200);
    assert.deepEqual(await escaped.json(), { ok: true, dryRun: true, target: publishPaths.preview });
    assert.equal(await fs.readFile(path.join(publishPaths.live, "index.html"), "utf8"), "original live sentinel");
    const live = await post({ dryRun: false });
    assert.equal(live.status, 200);
    assert.deepEqual(await live.json(), { ok: true, dryRun: false, target: publishPaths.live });
    assert.equal(await fs.readFile(path.join(publishPaths.live, "index.html"), "utf8"), "synthetic new build");

    // Build a separate auth-enabled app, still with only synthetic paths.
    const protectedApp = createApp({ publishPaths, enableAuth: true, usersFilePath: path.join(root, "users.json") });
    const protectedServer = protectedApp.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => protectedServer.once("listening", resolve));
    try {
      const protectedUrl = `http://127.0.0.1:${(protectedServer.address() as AddressInfo).port}/api/publish`;
      for (const body of [{}, { dryRun: true }, { dryRun: false }]) {
        assert.equal((await fetch(protectedUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).status, 401);
      }
    } finally {
      await new Promise<void>((resolve) => protectedServer.close(() => resolve()));
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const name of envNames) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});
