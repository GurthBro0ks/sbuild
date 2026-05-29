RESULT: PASS

Project: /opt/slimy/sbuild
Human QA status before fix: almost fixed, top buttons clipped
Commit before: c5c116b
Commit after: pending local commit

Files changed:
- packages/editor/src/styles.css
- packages/editor/src/App.tsx
- packages/editor/src/ui-contract.test.js

Root cause of top clipping:
- Mobile topbar safe-area handling used additive `calc(8px + env(safe-area-inset-top, 0px))` and was visually tight on iPhone Safari in the fixed topbar layout.
- The toolbar itself was not duplicate-offset broken; remaining issue was insufficient top breathing room in the fixed topbar region.

Exact safe-area/topbar fix:
- Mobile-only topbar now uses a safe-area floor rule: `padding-top: max(8px, env(safe-area-inset-top, 0px));`.
- Toolbar measurement/debug now includes visible top padding diagnostics via `topbarPaddingTop`/`topPad`.
- Spacer contract remains unchanged: measured topbar height still drives `--mobile-topbar-h` and `.topbar-mobile-spacer`.

Confirmation duplicate-offset fix remains intact:
- `mobile-toolbar-gap-repair active` marker remains present.
- `mobile-toolbar-spacer-v3 active` marker remains absent.
- Single offset owner remains `.topbar-mobile-spacer` on mobile.
- Mobile canvas controls still do not reference `--mobile-topbar-h` for their own offset.

Final offset owner:
- spacer

Debug marker status:
- Main debug strip still shows `mobile-toolbar-gap-repair` and gap metrics.
- Added top padding metric: `topPad` in strip, `topbarPaddingTop` in debug panel.

Validation results:
- pnpm -r typecheck: PASS
- pnpm -r build: PASS
- pnpm -r lint: PASS
- pnpm -r test: PASS
- bash scripts/smoke-sbuild.sh: PASS
- curl http://127.0.0.1:3137/health: ok, gitCommit=c5c116b before commit, publishAllowed=false
- curl POST /api/publish unauthenticated: 401 Authentication required

Infrastructure safety:
- Caddy/DNS/WordPress untouched
- Login/session auth untouched
- Publish dry-run safety untouched

Remaining dirty files:
- packages/editor/src/App.tsx
- packages/editor/src/styles.css
- packages/editor/src/ui-contract.test.js
- project/project.json
- project/image-folder.json

Pushed: NO

Manual iPhone QA checklist:
1. Open https://sbuilder.blackfishfarms.com
2. Login
3. Open Settings/About and confirm new commit
4. Confirm top toolbar/title/buttons are no longer clipped at the top
5. Confirm hamburger, title, Preview, Paint, Images, AI, Settings, Save, Revert, Build, Publish are visible/tappable
6. Confirm blue status pill is readable
7. Confirm no giant blank gap returned
8. Confirm canvas debug/device controls start close under toolbar/status
9. Confirm debug marker still says mobile-toolbar-gap-repair active
10. Confirm it does not say mobile-toolbar-spacer-v3 active
11. Open/close Settings and confirm gap does not grow
12. Trigger status changes and confirm gap does not grow
13. Confirm Desktop row layout still works
14. Confirm Publish remains dry-run
