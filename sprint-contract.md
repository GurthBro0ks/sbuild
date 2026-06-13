# Sprint Contract — sBuild Runtime Hardening (Prompt 6A)

## What I'm building/fixing
Runtime hardening and error-handling cleanup with small, focused diffs:
- F-E1: `fetchJson` must throw on `!res.ok`, preserve server error messages, single body read.
- F-E2: `saveProject` error handling — visible "Save failed", keep unsaved state, never stuck at "Saving...".
- F-A3: Per-IP login throttle/backoff for `POST /login`.
- F-A4: Restrict CORS for this same-origin app (apiBase=""), env-gated, no wildcard default.
- F-A5: multer `limits.fileSize` + image-only MIME filter, clean 4xx/413 responses.
- F-Q1: image-delete duplication — inspect; consolidate only if low-risk else defer + document.
- F-V5: tiny version display fallback helper — only if small/isolated, else defer.

## Done criteria (verification)
1. `fetchJson` throws on non-ok with preserved message; no double body read.
   - `grep -n "res.ok" packages/editor/src/App.tsx`
2. `saveProject` wrapped in try/catch; failure keeps dirty + shows "Save failed".
   - `grep -n "Save failed" packages/editor/src/App.tsx`
3. `POST /login` rejects with 429 after repeated failures; correct login still succeeds.
   - new server test: repeated bad logins -> 429; fresh server good login -> cookie.
4. multer rejects oversized and non-image uploads; normal image upload still works.
   - new server tests for oversize (413) and non-image (400/415).
5. CORS no longer emits wildcard by default; same-origin/health/login unaffected.
   - `pnpm -r test` server suite still passes (health, login, 401 routes).
6. Workcopy `pnpm -r lint` PASS and `pnpm -r test` PASS.

## Regression list (must still work)
- `/health` returns 200 JSON.
- Unauth `GET /api/project` returns 401.
- `auth: login with admin credentials returns session cookie` test.
- `auth: login with wrong password returns 401` test.
- Existing `/api/images/delete` path-traversal + in-use tests.
- Editor `ui-contract.test.js` source assertions (saveProject, /api/project PUT).
- Live `sbuild.service` keeps running OLD dist (no restart this phase).
- `project/project.json` remains dirty, untouched, unstaged.
