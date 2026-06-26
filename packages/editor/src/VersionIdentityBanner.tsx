import type { BuildIdentityState } from "./editorBehavior.js";

type VersionIdentityBannerProps = {
  buildIdentity: BuildIdentityState;
  buildInfoError: string;
  onDismiss: () => void;
};

export function VersionIdentityBanner({ buildIdentity, buildInfoError, onDismiss }: VersionIdentityBannerProps) {
  return (
    <div className={`version-identity-banner version-identity-${buildIdentity.status}`} role="status" data-testid="version-identity-banner">
      <div className="version-identity-banner-copy">
        <strong>{buildIdentity.status === "mismatch" ? "Version drift detected" : "Version unverified"}</strong>
        <span>{buildIdentity.message}</span>
        {buildIdentity.detail && <span>{buildIdentity.detail}</span>}
        {buildInfoError && <span>Health error: {buildInfoError}</span>}
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss version identity warning">Dismiss</button>
    </div>
  );
}
