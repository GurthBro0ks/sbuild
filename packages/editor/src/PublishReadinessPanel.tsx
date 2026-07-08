import type { SBuildBuildInfo } from "@sbuild/shared";

type PublishReadinessBuildInfo = SBuildBuildInfo & {
  editorDistExists?: boolean;
};

type PublishReadinessPanelProps = {
  buildInfo: PublishReadinessBuildInfo | null;
  buildInfoStatus: "loading" | "ok" | "unavailable";
  dirty: boolean;
  previewAvailable: boolean;
};

function statusLabel(kind: "ready" | "blocked" | "info" | "warn") {
  if (kind === "ready") return "Ready";
  if (kind === "blocked") return "Blocked";
  if (kind === "warn") return "Check";
  return "Info";
}

type ChecklistItem = {
  label: string;
  value: string;
  kind: "ready" | "blocked" | "info" | "warn";
};

export function PublishReadinessPanel({ buildInfo, buildInfoStatus, dirty, previewAvailable }: PublishReadinessPanelProps) {
  const healthUnavailable = buildInfoStatus !== "ok";
  const publishAllowed = Boolean(buildInfo?.publishAllowed);
  const repoDirtyKnown = buildInfoStatus === "ok" && typeof buildInfo?.repoDirty === "boolean";
  const editorDistKnown = buildInfoStatus === "ok" && typeof buildInfo?.editorDistExists === "boolean";

  const items: ChecklistItem[] = [
    {
      label: "Publish mode",
      value: publishAllowed ? "Live publish allowed by server health" : "Dry-run only - Live publish disabled",
      kind: publishAllowed ? "warn" : "blocked"
    },
    {
      label: "Project state",
      value: dirty ? "Unsaved changes present" : "Project saved",
      kind: dirty ? "warn" : "ready"
    },
    {
      label: "Build artifact",
      value: healthUnavailable
        ? "Health unavailable"
        : buildInfo?.dirty
          ? "Built from local source changes"
          : "Build artifact reports clean source state",
      kind: healthUnavailable ? "warn" : buildInfo?.dirty ? "warn" : "ready"
    },
    {
      label: "Repo working tree",
      value: repoDirtyKnown ? (buildInfo?.repoDirty ? "Repo has local changes" : "Repo clean") : "Repo status unavailable",
      kind: repoDirtyKnown ? (buildInfo?.repoDirty ? "warn" : "ready") : "info"
    },
    {
      label: "Editor dist",
      value: editorDistKnown ? (buildInfo?.editorDistExists ? "Editor build available" : "Editor build missing") : "Editor build status unavailable",
      kind: editorDistKnown ? (buildInfo?.editorDistExists ? "ready" : "warn") : "info"
    },
    {
      label: "Preview",
      value: previewAvailable ? "Preview is available from the current editor session" : "Preview unavailable until a page is loaded",
      kind: previewAvailable ? "ready" : "info"
    },
    {
      label: "Owner approval",
      value: "Owner approval required before live publish",
      kind: "blocked"
    },
    {
      label: "Public output",
      value: "No public changes are made by dry-run",
      kind: "info"
    }
  ];

  return (
    <section className="publish-readiness-panel" aria-labelledby="publish-readiness-heading" data-testid="publish-readiness-panel">
      <div className="publish-readiness-header">
        <div>
          <h4 id="publish-readiness-heading">Publish Readiness</h4>
          <p className="hint">
            {publishAllowed
              ? "Server health reports live publish is allowed; owner approval is still required before using it."
              : "Live publish disabled. Publish runs are dry-run only."}
          </p>
        </div>
        <strong className="publish-readiness-mode">{publishAllowed ? "Live guarded" : "Dry-run only"}</strong>
      </div>
      <ul className="publish-readiness-list">
        {items.map((item) => (
          <li key={item.label} className={`publish-readiness-item publish-readiness-${item.kind}`}>
            <span className="publish-readiness-label">{item.label}</span>
            <span className="publish-readiness-value">{item.value}</span>
            <span className="publish-readiness-badge">{statusLabel(item.kind)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
