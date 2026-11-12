import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

export type AtomicPublishPaths = {
  rootDir: string;
  releasesDir: string;
  currentLink: string;
};

export type PromoteAtomicPublishOptions = {
  rootDir: string;
  stageDir: string;
  domain: string;
  gitSha: string;
  now?: Date;
  releaseName?: string;
  requiredFiles?: string[];
  retainReleases?: number;
  dryRun?: boolean;
};

export type PromoteAtomicPublishResult = {
  releaseName: string;
  releaseDir: string;
  currentLink: string;
  previousReleaseName: string | null;
  removedReleases: string[];
};

export type RollbackAtomicPublishOptions = {
  rootDir: string;
  targetReleaseName?: string;
  retainReleases?: number;
};

export type RetainReleasesOptions = {
  rootDir: string;
  retainReleases: number;
  protectReleaseNames?: string[];
};

const defaultRequiredFiles = ["index.html", "assets/styles.css"];
const releaseNamePattern = /^\d{8}T\d{6}Z-[0-9a-f]{7,40}$/;
const gitShaPattern = /^[0-9a-f]{7,40}$/;
const domainPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function assertInside(baseDir: string, candidate: string, label: string): void {
  const resolvedBase = path.resolve(baseDir);
  const resolvedCandidate = path.resolve(candidate);
  if (resolvedCandidate !== resolvedBase && !resolvedCandidate.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error(`${label} must stay inside ${resolvedBase}`);
  }
}

function safeRequiredRelativePath(relativePath: string): string {
  const normalized = path.posix.normalize(String(relativePath).replace(/\\/g, "/"));
  if (
    path.isAbsolute(relativePath) ||
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new Error(`Unsafe required file path: ${relativePath}`);
  }
  return normalized;
}

function resolvePublishPaths(rootDir: string): AtomicPublishPaths {
  const root = path.resolve(rootDir);
  return {
    rootDir: root,
    releasesDir: path.join(root, "releases"),
    currentLink: path.join(root, "current")
  };
}

function assertDryRunTempPath(targetPath: string, label: string): void {
  const resolved = path.resolve(targetPath);
  const tmp = path.resolve(os.tmpdir());
  if (resolved !== tmp && !resolved.startsWith(`${tmp}${path.sep}`)) {
    throw new Error(`${label} must be under the OS temp directory in dry-run mode`);
  }
}

async function readCurrentReleaseName(currentLink: string): Promise<string | null> {
  try {
    const stat = await fs.lstat(currentLink);
    if (!stat.isSymbolicLink()) throw new Error("current must be a symlink");
    const target = await fs.readlink(currentLink);
    const releaseName = path.basename(target);
    validateReleaseName(releaseName);
    return releaseName;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function swapCurrentSymlink(paths: AtomicPublishPaths, releaseName: string): Promise<void> {
  const releaseDir = path.join(paths.releasesDir, releaseName);
  assertInside(paths.releasesDir, releaseDir, "release directory");
  const relativeTarget = path.relative(paths.rootDir, releaseDir);
  const tempLink = path.join(paths.rootDir, `.current-${releaseName}-${randomUUID()}.tmp`);

  await fs.symlink(relativeTarget, tempLink, "dir");
  try {
    await fs.rename(tempLink, paths.currentLink);
  } catch (error) {
    await fs.rm(tempLink, { force: true });
    throw error;
  }
}

export function validatePublishDomain(domain: string): string {
  const normalized = String(domain || "").trim();
  if (!domainPattern.test(normalized)) {
    throw new Error(`Unsafe publish domain: ${domain}`);
  }
  return normalized;
}

export function validateReleaseName(releaseName: string): string {
  const normalized = String(releaseName || "").trim();
  if (!releaseNamePattern.test(normalized)) {
    throw new Error(`Unsafe release name: ${releaseName}`);
  }
  return normalized;
}

export function createReleaseName(options: { now?: Date; gitSha: string }): string {
  const sha = String(options.gitSha || "").trim();
  if (!gitShaPattern.test(sha)) throw new Error(`Unsafe git sha: ${options.gitSha}`);
  const timestamp = (options.now || new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return validateReleaseName(`${timestamp}-${sha}`);
}

export async function validateStageDirectory(stageDir: string, requiredFiles: string[] = defaultRequiredFiles): Promise<void> {
  // Staging validation must complete before any release directory can be promoted.
  const resolvedStage = path.resolve(stageDir);
  const stageStat = await fs.lstat(resolvedStage);
  if (!stageStat.isDirectory()) throw new Error(`Stage path is not a directory: ${resolvedStage}`);

  for (const requiredFile of requiredFiles) {
    const relative = safeRequiredRelativePath(requiredFile);
    const target = path.resolve(resolvedStage, relative);
    assertInside(resolvedStage, target, "required staged file");
    let stat;
    try {
      stat = await fs.lstat(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Required staged file is missing: ${relative}`);
      }
      throw error;
    }
    if (!stat.isFile()) throw new Error(`Required staged file is not a file: ${relative}`);
  }
}

export async function listReleaseNames(rootDir: string): Promise<string[]> {
  const paths = resolvePublishPaths(rootDir);
  try {
    const entries = await fs.readdir(paths.releasesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && releaseNamePattern.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function getCurrentReleaseName(rootDir: string): Promise<string | null> {
  return readCurrentReleaseName(resolvePublishPaths(rootDir).currentLink);
}

async function withPublishRootLock<T>(rootDir: string, operation: () => Promise<T>): Promise<T> {
  const root = path.resolve(rootDir);
  await fs.mkdir(root, { recursive: true });
  const lockDir = path.join(root, ".atomic-publish.lock");
  try {
    await fs.mkdir(lockDir, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("Publish root is locked; another operation or an unrecovered lock exists");
    }
    throw error;
  }
  try {
    return await operation();
  } finally {
    // Only the creator releases the lock. Never recover by age/PID or recursively
    // delete it: an interrupted operation deliberately leaves a fail-closed lock.
    await fs.rmdir(lockDir);
  }
}

async function retainReleasesWhileLocked(options: RetainReleasesOptions): Promise<string[]> {
  const keep = Math.max(0, Math.floor(options.retainReleases));
  const paths = resolvePublishPaths(options.rootDir);
  const releases = await listReleaseNames(options.rootDir);
  const current = await getCurrentReleaseName(options.rootDir);
  const protectedNames = new Set((options.protectReleaseNames || []).map(validateReleaseName));
  if (current) protectedNames.add(current);

  const newest = new Set(releases.slice().reverse().slice(0, keep));
  const removed: string[] = [];
  for (const releaseName of releases) {
    if (newest.has(releaseName) || protectedNames.has(releaseName)) continue;
    await fs.rm(path.join(paths.releasesDir, releaseName), { recursive: true, force: true });
    removed.push(releaseName);
  }
  return removed;
}

/** Fails closed if the root is already locked, including an unrecovered crash lock. */
export async function retainAtomicReleases(options: RetainReleasesOptions): Promise<string[]> {
  return withPublishRootLock(options.rootDir, () => retainReleasesWhileLocked(options));
}

/**
 * Publishes within caller-owned, trusted filesystem trees. Atomicity applies to
 * the current symlink rename, not crash durability or hostile symlink traversal.
 * All mutating helper operations share an exclusive, fail-fast filesystem lock.
 * After a crash, inspect the root before manually resolving its remaining lock.
 */
export async function promoteAtomicPublish(options: PromoteAtomicPublishOptions): Promise<PromoteAtomicPublishResult> {
  const paths = resolvePublishPaths(options.rootDir);
  const stageDir = path.resolve(options.stageDir);
  const releaseName = validateReleaseName(options.releaseName || createReleaseName({ now: options.now, gitSha: options.gitSha }));
  const releaseDir = path.join(paths.releasesDir, releaseName);

  validatePublishDomain(options.domain);
  assertInside(paths.releasesDir, releaseDir, "release directory");
  if (options.dryRun) {
    assertDryRunTempPath(paths.rootDir, "publish root");
    assertDryRunTempPath(stageDir, "stage directory");
  }

  await validateStageDirectory(stageDir, options.requiredFiles);
  return withPublishRootLock(paths.rootDir, async () => {
    await fs.mkdir(paths.releasesDir, { recursive: true });
    try {
      await fs.mkdir(releaseDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(`Release already exists: ${releaseName}`);
      }
      throw error;
    }

    let previousReleaseName: string | null;
    try {
      previousReleaseName = await readCurrentReleaseName(paths.currentLink);
      // mkdir above reserves this release exclusively. Copy into its empty children,
      // rather than asking cp to exclusively create the already-owned directory.
      for (const entry of await fs.readdir(stageDir)) {
        await fs.cp(path.join(stageDir, entry), path.join(releaseDir, entry), {
          recursive: true,
          errorOnExist: true,
          force: false
        });
      }
      await swapCurrentSymlink(paths, releaseName);
    } catch (error) {
      await fs.rm(releaseDir, { recursive: true, force: true });
      throw error;
    }

    const removedReleases = options.retainReleases === undefined
      ? []
      : await retainReleasesWhileLocked({
          rootDir: paths.rootDir,
          retainReleases: options.retainReleases,
          protectReleaseNames: previousReleaseName ? [previousReleaseName] : []
        });

    return {
      releaseName,
      releaseDir,
      currentLink: paths.currentLink,
      previousReleaseName,
      removedReleases
    };
  });
}

export async function rollbackAtomicPublish(options: RollbackAtomicPublishOptions): Promise<{ releaseName: string; currentLink: string; removedReleases: string[] }> {
  const paths = resolvePublishPaths(options.rootDir);
  return withPublishRootLock(paths.rootDir, async () => {
    const currentReleaseName = await readCurrentReleaseName(paths.currentLink);
    const releases = await listReleaseNames(paths.rootDir);
    const targetReleaseName = options.targetReleaseName
      ? validateReleaseName(options.targetReleaseName)
      : releases.filter((releaseName) => releaseName !== currentReleaseName).at(-1);

    if (!targetReleaseName) throw new Error("No rollback target release found");
    if (!releases.includes(targetReleaseName)) throw new Error(`Rollback target does not exist: ${targetReleaseName}`);

    await swapCurrentSymlink(paths, targetReleaseName);
    const removedReleases = options.retainReleases === undefined
      ? []
      : await retainReleasesWhileLocked({
          rootDir: paths.rootDir,
          retainReleases: options.retainReleases,
          protectReleaseNames: [targetReleaseName]
        });

    return { releaseName: targetReleaseName, currentLink: paths.currentLink, removedReleases };
  });
}
