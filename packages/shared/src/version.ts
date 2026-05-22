export const SBUILD_VERSION = "0.4.0-dev";
export const SBUILD_APP_NAME = "sBuild";

export interface SBuildBuildInfo {
  version: string;
  appName: string;
  gitCommit: string;
  branch: string;
  buildDate: string;
  dirty: boolean;
  publishAllowed: boolean;
}
