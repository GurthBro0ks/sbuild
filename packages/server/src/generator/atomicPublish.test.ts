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
    assert.equal(await fs.readFile(path.join(result.releaseDir, "assets/styles.css"), "utf8"), 'body{content:"release-one"}');
    assert.deepEqual((await fs.readdir(result.releaseDir)).sort(), ["assets", "index.html", "robots.txt", "sitemap.xml"]);
    assert.equal((await fs.lstat(path.join(rootDir, "current"))).isSymbolicLink(), true);
  });
});

test("promotion copies hidden files and nested directories without changing the stage", async () => {
  await withWorkspace(async ({ rootDir, stageDir }) => {
    await writeStageSite(stageDir);
    await fs.mkdir(path.join(stageDir, ".well-known", "nested"), { recursive: true });
    await fs.writeFile(path.join(stageDir, ".well-known", "nested", "verification.txt"), "verification");
    const result = await promoteAtomicPublish({ rootDir, stageDir, domain: "example.com", gitSha: "abcdef1" });
    for (const directory of [stageDir, result.releaseDir]) {
      assert.equal(await fs.readFile(path.join(directory, ".well-known", "nested", "verification.txt"), "utf8"), "verification");
      assert.equal(await fs.readFile(path.join(directory, "index.html"), "utf8"), "<html>site</html>");
    }
  });
});

test("promotion refuses existing release directories, files and dangling symlinks without removing them", async (t) => {
  for (const kind of ["directory", "file", "symlink"] as const) {
    await t.test(kind, async () => {
      await withWorkspace(async ({ rootDir, stageDir }) => {
        await writeStageSite(stageDir);
        const releaseName = "20260709T171500Z-abcdef1";
        const releaseDir = path.join(rootDir, "releases", releaseName);
        await fs.mkdir(path.dirname(releaseDir));
        if (kind === "directory") {
          await fs.mkdir(releaseDir);
          await fs.writeFile(path.join(releaseDir, "sentinel"), "existing");
        } else if (kind === "file") {
          await fs.writeFile(releaseDir, "existing");
        } else {
          await fs.symlink("missing-release", releaseDir);
        }
        await assert.rejects(
          promoteAtomicPublish({ rootDir, stageDir, domain: "example.com", gitSha: "abcdef1", releaseName }),
          /Release already exists/
        );
        if (kind === "symlink") assert.equal(await fs.readlink(releaseDir), "missing-release");
        else assert.equal(await fs.readFile(kind === "directory" ? path.join(releaseDir, "sentinel") : releaseDir, "utf8"), "existing");
        assert.deepEqual(await fs.readdir(path.dirname(releaseDir)), [releaseName]);
        await assert.rejects(fs.lstat(path.join(rootDir, "current")), { code: "ENOENT" });
      });
    });
  }
});

test("concurrent promotions with the same name have exactly one owner", async () => {
  await withWorkspace(async ({ rootDir, stageDir }) => {
    await writeStageSite(stageDir);
    const options = { rootDir, stageDir, domain: "example.com", gitSha: "abcdef1", releaseName: "20260709T171500Z-abcdef1" };
    const outcomes = await Promise.allSettled([promoteAtomicPublish(options), promoteAtomicPublish(options)]);
    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
    const failure = outcomes.find((outcome) => outcome.status === "rejected");
    assert.ok(failure?.status === "rejected");
    assert.match(String(failure.reason), /Publish root is locked|Release already exists/);
    assert.equal(await getCurrentReleaseName(rootDir), options.releaseName);
    assert.equal(await fs.readFile(path.join(rootDir, "current", "index.html"), "utf8"), "<html>site</html>");
  });
});

test("invalid current entries clean up only the newly owned release", async (t) => {
  for (const kind of ["file", "directory", "malformed-symlink"] as const) {
    await t.test(kind, async () => {
      await withWorkspace(async ({ rootDir, stageDir }) => {
        await writeStageSite(stageDir);
        const current = path.join(rootDir, "current");
        if (kind === "file") await fs.writeFile(current, "existing");
        else if (kind === "directory") await fs.mkdir(current);
        else await fs.symlink("releases/not-a-release", current);
        const sentinel = "20260709T171500Z-1111111";
        await fs.mkdir(path.join(rootDir, "releases", sentinel), { recursive: true });
        await fs.writeFile(path.join(rootDir, "releases", sentinel, "sentinel"), "existing");
        await assert.rejects(
          promoteAtomicPublish({ rootDir, stageDir, domain: "example.com", gitSha: "abcdef1", releaseName: "20260709T171600Z-abcdef1" }),
          kind === "malformed-symlink" ? /Unsafe release name/ : /current must be a symlink/
        );
        assert.deepEqual(await fs.readdir(path.join(rootDir, "releases")), [sentinel]);
        assert.equal(await fs.readFile(path.join(rootDir, "releases", sentinel, "sentinel"), "utf8"), "existing");
        if (kind === "malformed-symlink") assert.equal(await fs.readlink(current), "releases/not-a-release");
        else if (kind === "file") assert.equal(await fs.readFile(current, "utf8"), "existing");
        else assert.equal((await fs.lstat(current)).isDirectory(), true);
      });
    });
  }
});

test("a partial copy failure removes the new release and preserves current and stage", async (t) => {
  await withWorkspace(async ({ rootDir, stageDir }) => {
    await writeStageSite(stageDir, "first");
    const first = await promoteAtomicPublish({ rootDir, stageDir, domain: "example.com", gitSha: "1111111" });
    await resetStage(stageDir, "second");
    const copy = fs.cp;
    const failure = new Error("injected failure after copying a child");
    const mock = t.mock.method(fs, "cp", async (...args: Parameters<typeof fs.cp>) => {
      await copy(...args);
      throw failure;
    });
    try {
      await assert.rejects(promoteAtomicPublish({ rootDir, stageDir, domain: "example.com", gitSha: "2222222" }), (error) => error === failure);
      assert.equal(mock.mock.callCount(), 1);
      assert.deepEqual(await listReleaseNames(rootDir), [first.releaseName]);
      assert.equal(await currentSymlinkTarget(rootDir), path.join("releases", first.releaseName));
      assert.equal(await fs.readFile(path.join(rootDir, "current", "index.html"), "utf8"), "<html>first</html>");
      assert.equal(await fs.readFile(path.join(stageDir, "index.html"), "utf8"), "<html>second</html>");
    } finally {
      mock.mock.restore();
    }
  });
});

test("a destination child collision is refused and the owned release is cleaned up", async (t) => {
  await withWorkspace(async ({ rootDir, stageDir }) => {
    await writeStageSite(stageDir);
    const releaseName = "20260709T171500Z-abcdef1";
    const read = fs.readdir;
    const mock = t.mock.method(fs, "readdir", async (...args: Parameters<typeof fs.readdir>) => {
      const entries = await read(...args);
      if (args[0] === stageDir) {
        await fs.writeFile(path.join(rootDir, "releases", releaseName, "index.html"), "collision");
      }
      return entries;
    });
    try {
      await assert.rejects(
        promoteAtomicPublish({ rootDir, stageDir, domain: "example.com", gitSha: "abcdef1", releaseName }),
        { code: "ERR_FS_CP_EEXIST" }
      );
      assert.deepEqual(await listReleaseNames(rootDir), []);
      await assert.rejects(fs.lstat(path.join(rootDir, "current")), { code: "ENOENT" });
      assert.equal(await fs.readFile(path.join(stageDir, "index.html"), "utf8"), "<html>site</html>");
    } finally {
      mock.mock.restore();
    }
  });
});

test("a failed current swap cleans up the new release and temporary symlink", async (t) => {
  await withWorkspace(async ({ rootDir, stageDir }) => {
    await writeStageSite(stageDir, "first");
    const first = await promoteAtomicPublish({ rootDir, stageDir, domain: "example.com", gitSha: "1111111" });
    await resetStage(stageDir, "second");
    const failure = new Error("injected rename failure");
    const mock = t.mock.method(fs, "rename", async () => { throw failure; });
    try {
      await assert.rejects(promoteAtomicPublish({ rootDir, stageDir, domain: "example.com", gitSha: "2222222" }), (error) => error === failure);
      assert.deepEqual(await listReleaseNames(rootDir), [first.releaseName]);
      assert.deepEqual((await fs.readdir(rootDir)).sort(), ["current", "releases"]);
      assert.equal(await currentSymlinkTarget(rootDir), path.join("releases", first.releaseName));
      assert.equal(await fs.readFile(path.join(rootDir, "current", "index.html"), "utf8"), "<html>first</html>");
    } finally {
      mock.mock.restore();
    }
  });
});

test("rollback holds the root lock through failure cleanup and allows a later retry", async (t) => {
  await withWorkspace(async ({ rootDir, stageDir }) => {
    await writeStageSite(stageDir);
    const first = await promoteAtomicPublish({ rootDir, stageDir, domain: "example.com", gitSha: "1111111" });
    const second = await promoteAtomicPublish({ rootDir, stageDir, domain: "example.com", gitSha: "2222222" });
    let started!: () => void;
    const startedGate = new Promise<void>((resolve) => { started = resolve; });
    let release!: () => void;
    const releaseGate = new Promise<void>((resolve) => { release = resolve; });
    const failure = new Error("injected rollback rename failure");
    const mock = t.mock.method(fs, "rename", async () => {
      started();
      await releaseGate;
      throw failure;
    });
    const options = { rootDir, targetReleaseName: first.releaseName };
    const failed = assert.rejects(rollbackAtomicPublish(options), (error) => error === failure);
    try {
      await startedGate;
      await assert.rejects(rollbackAtomicPublish(options), /Publish root is locked/);
      await assert.rejects(retainAtomicReleases({ rootDir, retainReleases: 0 }), /Publish root is locked/);
      assert.equal(await getCurrentReleaseName(rootDir), second.releaseName);
    } finally {
      release();
      await failed;
      mock.mock.restore();
    }
    assert.deepEqual((await fs.readdir(rootDir)).sort(), ["current", "releases"]);
    assert.equal((await rollbackAtomicPublish(options)).releaseName, first.releaseName);
  });
});

test("retention and other publishers cannot delete an in-progress release", async (t) => {
  await withWorkspace(async ({ rootDir, stageDir }) => {
    await writeStageSite(stageDir, "first");
    const firstName = "20260709T171500Z-1111111";
    const secondName = "20260709T171600Z-2222222";
    let paused!: () => void;
    const pausedGate = new Promise<void>((resolve) => { paused = resolve; });
    let resume!: () => void;
    const resumeGate = new Promise<void>((resolve) => { resume = resolve; });
    const copy = fs.cp;
    const mock = t.mock.method(fs, "cp", async (...args: Parameters<typeof fs.cp>) => {
      if (args[0] === path.join(stageDir, "index.html")) {
        paused();
        await resumeGate;
      }
      return copy(...args);
    });
    const options = { rootDir, stageDir, domain: "example.com", gitSha: "1111111" };
    const first = promoteAtomicPublish({ ...options, releaseName: firstName });
    try {
      await pausedGate;
      assert.equal(await fs.readFile(path.join(rootDir, "releases", firstName, "assets/styles.css"), "utf8"), 'body{content:"first"}');
      await assert.rejects(promoteAtomicPublish({ ...options, releaseName: secondName, retainReleases: 0 }), /Publish root is locked/);
      await assert.rejects(retainAtomicReleases({ rootDir, retainReleases: 0 }), /Publish root is locked/);
      await assert.rejects(rollbackAtomicPublish({ rootDir, targetReleaseName: firstName }), /Publish root is locked/);
      assert.deepEqual(await listReleaseNames(rootDir), [firstName]);
    } finally {
      resume();
      await first;
      mock.mock.restore();
    }
    assert.equal(await getCurrentReleaseName(rootDir), firstName);
    assert.equal(await fs.readFile(path.join(rootDir, "current/assets/styles.css"), "utf8"), 'body{content:"first"}');
    assert.equal(await fs.readFile(path.join(rootDir, "current/index.html"), "utf8"), "<html>first</html>");
    const second = await promoteAtomicPublish({ ...options, releaseName: secondName, retainReleases: 0 });
    assert.equal(second.previousReleaseName, firstName);
    assert.deepEqual(await listReleaseNames(rootDir), [firstName, secondName]);
    assert.deepEqual(await retainAtomicReleases({ rootDir, retainReleases: 0 }), [firstName]);
    assert.equal(await getCurrentReleaseName(rootDir), secondName);
  });
});

test("existing lock entries are refused without takeover or cleanup", async (t) => {
  for (const kind of ["empty-directory", "nonempty-directory", "file", "symlink"] as const) {
    await t.test(kind, async () => {
      await withWorkspace(async ({ rootDir, stageDir }) => {
        await writeStageSite(stageDir);
        const lock = path.join(rootDir, ".atomic-publish.lock");
        if (kind.endsWith("directory")) {
          await fs.mkdir(lock);
          if (kind === "nonempty-directory") await fs.writeFile(path.join(lock, "sentinel"), "existing");
        } else if (kind === "file") await fs.writeFile(lock, "existing");
        else await fs.symlink("missing-lock", lock);
        await assert.rejects(promoteAtomicPublish({ rootDir, stageDir, domain: "example.com", gitSha: "1111111" }), /Publish root is locked/);
        await assert.rejects(retainAtomicReleases({ rootDir, retainReleases: 0 }), /Publish root is locked/);
        await assert.rejects(rollbackAtomicPublish({ rootDir }), /Publish root is locked/);
        if (kind === "symlink") assert.equal(await fs.readlink(lock), "missing-lock");
        else if (kind === "file") assert.equal(await fs.readFile(lock, "utf8"), "existing");
        else if (kind === "nonempty-directory") assert.equal(await fs.readFile(path.join(lock, "sentinel"), "utf8"), "existing");
        else assert.deepEqual(await fs.readdir(lock), []);
        assert.deepEqual(await fs.readdir(rootDir), [".atomic-publish.lock"]);
      });
    });
  }
});

test("lock release failure preserves committed output and refuses subsequent mutation", async (t) => {
  await withWorkspace(async ({ rootDir, stageDir }) => {
    await writeStageSite(stageDir);
    const lock = path.join(rootDir, ".atomic-publish.lock");
    const failure = new Error("injected lock release failure");
    const mock = t.mock.method(fs, "rmdir", async () => { throw failure; });
    try {
      await assert.rejects(promoteAtomicPublish({ rootDir, stageDir, domain: "example.com", gitSha: "1111111" }), (error) => error === failure);
    } finally {
      mock.mock.restore();
    }
    assert.equal((await fs.lstat(lock)).isDirectory(), true);
    assert.equal(await fs.readFile(path.join(rootDir, "current/index.html"), "utf8"), "<html>site</html>");
    await assert.rejects(retainAtomicReleases({ rootDir, retainReleases: 0 }), /Publish root is locked/);
    assert.deepEqual(await listReleaseNames(rootDir), [await getCurrentReleaseName(rootDir)]);
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
