RESULT: PASS

Project: /opt/slimy/sbuild
human QA status before fix: ce8cc7a rejected, action controls clipped
commit before: ce8cc7a
commit after: bbb36166308a00e8b7a38513a81d16e71d472917

files changed/staged:
- packages/editor/src/App.tsx
- packages/editor/src/ui-contract.test.js

root cause of zero debug measurements:
- Mobile toolbar measurement effect ran before the editor layout (`project && selectedPage`) existed, hit the early-return path (`!topbarRef.current`), zeroed all debug values, and never re-ran because it only depended on `isMobileViewport`.

root cause of clipped action controls:
- With measurement stuck at zero, `--mobile-topbar-h` was not set to the actual visible toolbar height. The mobile spacer then fell back to its default height while the fixed toolbar was taller, so the top of the `Duplicate/Delete/Up/Down` strip sat under the toolbar/status area.

exact fix:
- In `App.tsx`, changed toolbar measurement lifecycle to depend on physical mobile viewport + layout readiness (`mobileLayoutReady = Boolean(project && selectedPage)`), not preview device mode.
- Added robust re-measure triggers: double `requestAnimationFrame`, delayed timeout, `ResizeObserver` on topbar/status/spacer/canvas-controls, and listeners for `resize`, `orientationchange`, and `visualViewport` resize/scroll.
- Added explicit missing-measurement diagnostics (`measurementMissing`) instead of silently presenting misleading all-zero values.
- Added marker `action-controls-offset active` in debug panel and mobile strip while preserving `mobile-toolbar-gap-repair active`.

final offset owner: spacer
whether action controls are now inside/after offset owner: YES (`topbar-mobile-spacer` appears before `workspace` and `canvas-controls`)

debug marker status:
- present: `mobile-toolbar-gap-repair active`
- present: `action-controls-offset active`
- absent: `mobile-toolbar-spacer-v3 active`

expected non-zero runtime values:
- On visible mobile topbar: `toolbarH`, `spacerH`, `topbarBottom`, and `ccTop` should be non-zero.
- If measurement is unavailable, debug reports `measurementMissing=true` instead of fake zero metrics.

validation results:
- pnpm -r typecheck: PASS
- pnpm -r build: PASS
- pnpm -r lint: PASS
- pnpm -r test: PASS
- bash scripts/smoke-sbuild.sh: PASS
- curl http://127.0.0.1:3137/health: ok, publishAllowed=false
- curl POST /api/publish unauthenticated: 401 Authentication required

accepted commit before push: bbb36166308a00e8b7a38513a81d16e71d472917
final HEAD: bbb36166308a00e8b7a38513a81d16e71d472917
origin/main after push: bbb36166308a00e8b7a38513a81d16e71d472917
pushed: YES
proof directory: /tmp/proof_sbuild_mobile_toolbar_acceptance_push_20260529T095240Z
human iPhone QA accepted: yes

debug values from accepted screenshot:
- toolbarH=171
- spacerH=171
- topbarBottom=171
- ccTop=179
- gapPx=8
- dup=false
- topPad=8
- missing=false

root cause fixed:
- mobile measurement ran too early and did not rerun after editor layout readiness

final offset owner:
- spacer .topbar-mobile-spacer using --mobile-toolbar-h

duplicate-offset fix intact: yes
active markers:
- mobile-toolbar-gap-repair
- action-controls-offset
rejected marker absent:
- mobile-toolbar-spacer-v3

health publishAllowed false: YES
publish auth/dry-run result: unauthenticated publish is blocked (401), dry-run guard unchanged

Caddy/DNS/WordPress untouched: YES

remaining dirty files:
- project/project.json
- project/image-folder.json

next suggested phase:
- mobile toolbar density pass (compact grouping) while preserving current spacer measurement contract and dry-run/auth safety.

manual iPhone QA checklist:
1. Open https://sbuilder.blackfishfarms.com
2. Login
3. Open Settings/About and confirm new commit
4. Confirm top toolbar/title/buttons are visible
5. Confirm blue status pill is readable
6. Confirm Duplicate/Delete/Up/Down action controls are fully visible and not hidden under toolbar/status
7. Confirm no giant blank gap returned
8. Confirm canvas debug/device controls start close under toolbar/status
9. Confirm debug says mobile-toolbar-gap-repair active
10. Confirm debug says action-controls-offset active
11. Confirm it does not say mobile-toolbar-spacer-v3 active
12. Confirm debug values are not all fake zero when toolbar is visible
13. Confirm gapPx is small and positive, ideally 8-32px
14. Open/close Settings and confirm gap does not grow
15. Trigger status changes and confirm gap does not grow
16. Confirm Desktop row layout still works
17. Confirm Publish remains dry-run
