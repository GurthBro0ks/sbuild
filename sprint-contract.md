# Sprint Contract: AI Top Menu UX Repair

## What
Fix AI Chat UX: mode gating, chat-style UI, Apply Suggestion safety, per-user memory.

## Done Criteria (testable)
1. `pnpm -r typecheck` passes
2. `pnpm -r build` passes
3. `pnpm -r lint` passes
4. `pnpm -r test` passes (editor + server)
5. `bash scripts/smoke-sbuild.sh` passes
6. `curl http://127.0.0.1:3137/health` shows publishAllowed=false
7. `curl -X POST /api/publish` (unauth) returns 401
8. AI Chat opens from Edit, Preview, AND Markup modes
9. AI Chat shows chat-style message bubbles, not toolbar form
10. Apply Suggestion disabled for plain text, disabled in Preview/Markup, enabled only in Edit with valid proposal
11. Per-user memory endpoint keyed by session user
12. Manual desktop + mobile QA checklist provided

## Regression List
- publishAllowed stays false
- unauth publish 401
- Image Gen tab works
- Image Enhance tab works
- Website Manager unchanged
- Settings/Account/User Management unchanged
- Help Guide unchanged
- Theme isolation intact
- Save/Revert/Build/Publish toolbar unchanged
