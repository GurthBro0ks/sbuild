RESULT: PASS

Project: /opt/slimy/sbuild
Current HEAD: b622ef6
Live commit expected: b622ef6
Human QA status of d811dc1: FAILED

State:
- d811dc1 is in history only (not HEAD).
- Runtime dirty files remain only:
  - project/project.json
  - project/image-folder.json

Live verification:
- Public staging /health reports gitCommit=b622ef6.
- Public root redirects to /login as expected.
- No Caddy/DNS/WordPress changes made.

Source grep conclusion:
- Marker present: "mobile-toolbar-gap-repair active"
- Marker absent: "mobile-toolbar-spacer-v3 active"
- Final offset owner is spacer path only on mobile via .topbar-mobile-spacer using --mobile-topbar-h.
- Canvas controls mobile block does not use toolbar offset variable directly.

Final layout contract:
- fixed toolbar: YES (mobile)
- spacer or padding: spacer
- single offset owner: .topbar-mobile-spacer

Validation results:
- pnpm -r typecheck: PASS
- pnpm -r build: PASS
- pnpm -r lint: PASS
- pnpm -r test: PASS
- bash scripts/smoke-sbuild.sh: PASS
- curl http://127.0.0.1:3137/health: ok, publishAllowed=false, gitCommit=b622ef6
- curl POST /api/publish unauthenticated: 401 Authentication required

Service/process check:
- systemctl --user status sbuild: unit not found
- systemctl status sbuild: unit not found
- pm2: no sbuild process listed
- Active sbuild app process is node packages/server/dist/index.js on port 3137.
- Restart/rebuild for commit visibility: NOT required (live already serving b622ef6)

Remaining dirty files:
- project/project.json
- project/image-folder.json

Pushed: NO

Manual iPhone QA checklist:
1. Open https://sbuilder.blackfishfarms.com
2. Login
3. Confirm Settings/About Git commit shows b622ef6
4. Confirm debug marker says "mobile-toolbar-gap-repair active"
5. Confirm it does not show "mobile-toolbar-spacer-v3 active"
6. Confirm blue status pill is readable
7. Confirm big blank gap under toolbar/status is gone
8. Confirm canvas debug/device controls start close under toolbar/status
9. Confirm gapPx is under 48px if shown
10. Open/close Settings and confirm gap does not grow
11. Trigger status changes and confirm gap does not grow
12. Confirm toolbar stays fixed while scrolling
13. Confirm Desktop row layout still works
14. Confirm Publish remains dry-run
