import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

async function loadPaths() {
  return await import(`./paths.js?case=${Date.now()}-${Math.random()}`);
}

test("server paths use repo-local project directory by default", async () => {
  const originalDataRoot = process.env.SBUILD_DATA_ROOT;
  delete process.env.SBUILD_DATA_ROOT;
  try {
    const paths = await loadPaths();

    assert.equal(paths.dataRoot, path.join(paths.repoRoot, "project"));
    assert.equal(paths.projectDir, path.join(paths.repoRoot, "project"));
    assert.equal(paths.projectFile, path.join(paths.repoRoot, "project", "project.json"));
    assert.equal(paths.backupsDir, path.join(paths.repoRoot, "project", "backups"));
    assert.equal(paths.projectImagesDir, path.join(paths.repoRoot, "project", "images"));
  } finally {
    if (originalDataRoot === undefined) {
      delete process.env.SBUILD_DATA_ROOT;
    } else {
      process.env.SBUILD_DATA_ROOT = originalDataRoot;
    }
  }
});

test("server paths use SBUILD_DATA_ROOT for mutable production data", async () => {
  const originalDataRoot = process.env.SBUILD_DATA_ROOT;
  process.env.SBUILD_DATA_ROOT = "/var/lib/sbuild";
  try {
    const paths = await loadPaths();

    assert.equal(paths.dataRoot, "/var/lib/sbuild");
    assert.equal(paths.projectDir, "/var/lib/sbuild");
    assert.equal(paths.projectFile, "/var/lib/sbuild/project.json");
    assert.equal(paths.backupsDir, "/var/lib/sbuild/backups");
    assert.equal(paths.projectImagesDir, "/var/lib/sbuild/images");
  } finally {
    if (originalDataRoot === undefined) {
      delete process.env.SBUILD_DATA_ROOT;
    } else {
      process.env.SBUILD_DATA_ROOT = originalDataRoot;
    }
  }
});
