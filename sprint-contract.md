# Sprint Contract: Admin Login + User Management

## What
Replace single shared login "sbuilder" with "admin" identity, add admin-only user management inside Settings.

## Done Criteria
1. [x] `SBUILD_AUTH_USERNAME` changed to `admin`; existing login flow works
2. [x] Migration idempotent: admin user created from env on first startup
3. [x] Account Management tab in Settings: change own password (requires current password, validates confirmation)
4. [x] User Management tab visible only to admin users
5. [x] Admin can create users, reset passwords, disable/delete non-admin users (not last admin)
6. [x] Non-admin cannot see or access user-management APIs (401)
7. [x] Publish remains dry-run; unauthenticated POST /api/publish returns 401
8. [x] Server tests pass (auth/role tests added)
9. [x] Typecheck, build, lint, test all pass
10. [x] Smoke test passes (auth gates, publish safety)

## Regression List
- Login/logout must still work
- Settings must open for all users
- Publish must remain dry-run (publishAllowed=false)
- Unauth POST /api/publish returns 401
- Website Manager still opens
- Preview/Edit still works
- Paint toolbar untouched
- No force push
