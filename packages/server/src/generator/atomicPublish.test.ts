import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createReleaseName,
  getCurrentReleaseName,
  listReleaseNames,
  promoteAtomicPublish,
  retainAtomicReleases,
  rollbackAtomicPublish,
  validatePublishDomain,
  validateReleaseName,
  validateStageDirectory
} from "./atomicPublish.js";

async function withWorkspace(fn: (workspace: { rootDir: string; stageDir: string }) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sbuild-atomic-publish-"));
  try {
    const rootDir = path.join(root, "publish-root");
    const stageDir = path.join(root, "stage");
    await fs.mkdir(rootDir, { recursive: true });
    await fs.mkdir(stageDir, { recursive: true });
    await fn({ rootDir, stageDir });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function writeStageSite(stageDir: string, marker = "site"): Promise<void> {
  await fs.mkdir(path.join(stageDir, "assets"), { recursive: true });
  await fs.writeFile(path.join(stageDir, "index.html"), `<html>${marker}</html>`, "utf8");
  await fs.writeFile(path.join(stageDir, "assets", "styles.css"), `body{content:"${marker}"}`, "utf8");
  await fs.writeFile(path.join(stageDir, "sitemap.xml"), "<urlset></urlset>", "utf8");
  await fs.writeFile(path.join(stageDir, "robots.txt"), "User-agent: *\nAllow: /\n", "utf8");
}

async function resetStage(stageDir: string, marker: string): Promise<void> {
  await fs.rm(stageDir, { recursive: true, force: true });
  await fs.mkdir(stageDir, { recursive: true });
  await writeStageSite(stageDir, marker);
}

async function currentSymlinkTarget(rootDir: string): Promise<string> {
  return fs.readlink(path.join(rootDir, "current"));
}

test("validateStageDirectory requires a directory and required staged files", async () => {
  await withWorkspace(async ({ stageDir }) => {
    await assert.rejects(
      validateStageDirectory(path.join(stageDir, "missing")),
      /no such file or directory|ENOENT/i
    );

    await assert.rejects(
      validateStageDirectory(stageDir),
      /Required staged file/i
    );

    await writeStageSite(stageDir);
    await validateStageDirectory(stageDir, ["index.html", "assets/styles.css", "sitemap.xml", "robots.txt"]);
  });
});

test("promoteAtomicPublish creates a timestamp-sha release and atomically swaps current symlink", async () => {
  await withWorkspace(async ({ rootDir, stageDir }) => {
    await writeStageSite(stageDir, "release-one");
    const result = await promoteAtomicPublish({
      rootDir,
      stageDir,
      domain: "blackfishfarms.com",
      gitSha: "94a3527",
      now: new Date("2026-07-09T17:15:00Z"),
      requiredFiles: ["index.html", "assets/styles.css"],
      dryRun: true
    });

    assert.equal(result.releaseName, "20260709T171500Z-94a3527");
    assert.equal(result.previousReleaseName, null);
    assert.equal(await getCurrentReleaseName(rootDir), result.releaseName);
    assert.equal(await currentSymlinkTarget(rootDir), path.join("releases", result.releaseName));
    assert.equal(await fs.readFile(path.join(result.releaseDir, "index.html"), "utf8"), "<html>release-one</html>");
    assert.equal((await fs.lstat(path.join(rootDir, "current"))).isSymbolicLink(), true);
  });
});

test("rollbackAtomicPublish repoints current to the previous release", async () => {
  await withWorkspace(async ({ rootDir, stageDir }) => {
    await writeStageSite(stageDir, "release-one");
    const first = await promoteAtomicPublish({
      rootDir,
      stageDir,
      domain: "blackfishfarms.com",
      gitSha: "1111111",
      now: new Date("2026-07-09T17:16:00Z"),
      dryRun: true
    });

    await resetStage(stageDir, "release-two");
    const second = await promoteAtomicPublish({
      rootDir,
      stageDir,
      domain: "blackfishfarms.com",
      gitSha: "2222222",
      now: new Date("2026-07-09T17:17:00Z"),
      dryRun: true
    });

    assert.equal(await getCurrentReleaseName(rootDir), second.releaseName);
    const rollback = await rollbackAtomicPublish({ rootDir });

    assert.equal(rollback.releaseName, first.releaseName);
    assert.equal(await getCurrentReleaseName(rootDir), first.releaseName);
    assert.equal(await currentSymlinkTarget(rootDir), path.join("releases", first.releaseName));
  });
});

test("retainAtomicReleases keeps N newest releases and never deletes current or rollback targets", async () => {
  await withWorkspace(async ({ rootDir, stageDir }) => {
    const releases: string[] = [];
    for (const [index, sha] of ["1111111", "2222222", "3333333", "4444444"].entries()) {
      await resetStage(stageDir, `release-${index + 1}`);
      const result = await promoteAtomicPublish({
        rootDir,
        stageDir,
        domain: "blackfishfarms.com",
        gitSha: sha,
        now: new Date(Date.UTC(2026, 6, 9, 17, 20 + index, 0)),
        dryRun: true
      });
      releases.push(result.releaseName);
    }

    const removed = await retainAtomicReleases({
      rootDir,
      retainReleases: 1,
      protectReleaseNames: [releases[0]]
    });

    assert.deepEqual(removed, [releases[1], releases[2]]);
    assert.deepEqual(await listReleaseNames(rootDir), [releases[0], releases[3]]);
    assert.equal(await getCurrentReleaseName(rootDir), releases[3]);
  });
});

test("promoteAtomicPublish failure before swap leaves current unchanged", async () => {
  await withWorkspace(async ({ rootDir, stageDir }) => {
    await writeStageSite(stageDir, "release-one");
    const first = await promoteAtomicPublish({
      rootDir,
      stageDir,
      domain: "blackfishfarms.com",
      gitSha: "1111111",
      now: new Date("2026-07-09T17:30:00Z"),
      dryRun: true
    });

    await fs.rm(path.join(stageDir, "index.html"));
    await assert.rejects(
      promoteAtomicPublish({
        rootDir,
        stageDir,
        domain: "blackfishfarms.com",
        gitSha: "2222222",
        now: new Date("2026-07-09T17:31:00Z"),
        dryRun: true
      }),
      /Required staged file/i
    );

    assert.equal(await getCurrentReleaseName(rootDir), first.releaseName);
    assert.equal(await currentSymlinkTarget(rootDir), path.join("releases", first.releaseName));
    assert.deepEqual(await listReleaseNames(rootDir), [first.releaseName]);
  });
});

test("domain, release name, and required file path validation reject unsafe input", async () => {
  assert.equal(validatePublishDomain("blackfishfarms.com"), "blackfishfarms.com");
  assert.throws(() => validatePublishDomain("https://blackfishfarms.com"), /Unsafe publish domain/);
  assert.throws(() => validatePublishDomain("../blackfishfarms.com"), /Unsafe publish domain/);
  assert.throws(() => validatePublishDomain("bad_domain.test"), /Unsafe publish domain/);

  assert.equal(validateReleaseName("20260709T173500Z-94a3527"), "20260709T173500Z-94a3527");
  assert.throws(() => validateReleaseName("../20260709T173500Z-94a3527"), /Unsafe release name/);
  assert.throws(() => validateReleaseName("20260709T173500Z-notasha"), /Unsafe release name/);

  await withWorkspace(async ({ stageDir }) => {
    await writeStageSite(stageDir);
    await assert.rejects(validateStageDirectory(stageDir, ["../index.html"]), /Unsafe required file path/);
  });
});

test("dry-run staging mode refuses non-temp roots before writing", async () => {
  await withWorkspace(async ({ stageDir }) => {
    await writeStageSite(stageDir);
    await assert.rejects(
      promoteAtomicPublish({
        rootDir: path.resolve("/not-temp-sbuild-atomic-publish-test"),
        stageDir,
        domain: "blackfishfarms.com",
        gitSha: "94a3527",
        now: new Date("2026-07-09T17:40:00Z"),
        dryRun: true
      }),
      /OS temp directory/
    );
  });
});

test("createReleaseName requires a sha-like suffix", () => {
  assert.equal(
    createReleaseName({ now: new Date("2026-07-09T17:45:00Z"), gitSha: "abcdef1" }),
    "20260709T174500Z-abcdef1"
  );
  assert.throws(() => createReleaseName({ gitSha: "not-a-sha" }), /Unsafe git sha/);
});
