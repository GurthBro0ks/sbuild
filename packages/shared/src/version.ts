export const SBUILD_VERSION = "0.5.0-dev";
export const SBUILD_APP_NAME = "sBuild";

export interface SBuildDirtySummary {
  modifiedTracked: number;
  untracked: number;
}

export interface SBuildBuildInfo {
  version: string;
  appName: string;
  baseVersion: string;
  displayVersion: string;
  gitCommit: string;
  gitCommitFull: string;
  branch: string;
  buildDate: string;
  commitCount: number;
  dirty: boolean;
  dirtySummary?: SBuildDirtySummary;
  repoHeadCommit?: string;
  repoHeadCommitFull?: string;
  repoBranch?: string;
  repoDirty?: boolean;
  repoDirtySummary?: SBuildDirtySummary;
  publishAllowed: boolean;
}

export function computeDisplayVersion(baseVersion: string, commitShort: string, commitCount: number): string {
  if (!commitShort || commitShort === "unknown") return baseVersion;
  return `${baseVersion}.${commitCount}+${commitShort}`;
}
