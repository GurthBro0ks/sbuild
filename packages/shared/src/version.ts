export const SBUILD_VERSION = "0.5.0-dev";
export const SBUILD_APP_NAME = "sBuild";

export interface SBuildDirtySummary {
  modifiedTracked: number;
  untracked: number;
}

export interface SBuildBuildInfo {
  version: string;
  appName: string;
  gitCommit: string;
  branch: string;
  buildDate: string;
  dirty: boolean;
  dirtySummary?: SBuildDirtySummary;
  publishAllowed: boolean;
}
