# AI Top Menu (Three-Tab Panel) — Result

## Commit
Pending commit on main branch (not yet committed).

## Files Changed
- `packages/editor/src/App.tsx` (+311 lines) — AI Top Menu panel, state, functions, tab content
- `packages/editor/src/styles.css` (+159 lines) — AI panel CSS (desktop + mobile, theme isolation)
- `packages/editor/src/ui-contract.test.js` (+122 lines) — 16 new UI contract tests, 3 updated
- `packages/server/src/app.ts` (+28 lines) — POST /api/ai/suggest endpoint
- `packages/server/src/app.test.ts` (+57 lines) — 3 new server tests for suggest endpoint
- `sprint-contract.md` — updated for this sprint

## Validation Results
- `pnpm -r typecheck` → PASS
- `pnpm -r build` → PASS
- `pnpm -r lint` → PASS
- `pnpm -r test` → PASS (editor 344/344, server 42/42)
- `bash scripts/smoke-sbuild.sh` → PASS
- `systemctl --user restart sbuild.service` → active
- `curl http://127.0.0.1:3137/health` → publishAllowed=false, editorDistExists=true
- `curl -X POST /api/publish` (unauth) → 401

## Safety Results
- publishAllowed remains false
- unauth POST /api/publish returns 401
- Runtime files (project/project.json, project/image-folder.json) NOT committed
- No API keys logged or leaked
- AI endpoints return structured JSON
- AI endpoints do not publish, deploy, shell out, or write project files
- Theme isolation preserved (uses editor CSS variables)

## Manual QA Checklist

### Desktop
- [ ] AI button in top toolbar opens AI Top Menu panel below toolbar
- [ ] Panel has three tabs: AI Chat, AI Image Gen, AI Image Enhance
- [ ] Tabs switch without closing the panel
- [ ] AI Chat shows target selector (Selected Block, Current Page, Whole Site)
- [ ] Target selector highlights active target
- [ ] Missing provider/key shows safe message (no crash)
- [ ] Apply Suggestion button disabled until valid proposal
- [ ] Apply Suggestion changes local editor state, does not auto-save
- [ ] Image Gen tab understandable, does not fake generation
- [ ] Image Enhance tab shows "select image first" when no image selected
- [ ] Markup attachment control shows when markup exists
- [ ] Markup disabled state explains why (no markup drawn)
- [ ] Theme isolation: no editor↔canvas bleed
- [ ] Save/Revert still work
- [ ] Publish remains dry-run/protected
- [ ] Help/User Guide still opens
- [ ] Admin-only Image/API Keys remains admin-only
- [ ] Close button closes the panel cleanly

### Mobile
- [ ] AI button opens usable AI menu (bottom sheet style)
- [ ] Tabs are reachable
- [ ] Prompt inputs do not zoom page unexpectedly
- [ ] Buttons are reachable
- [ ] No horizontal overflow
- [ ] Closing panel returns cleanly to editor

## Known Limitations
- AI Chat Apply Suggestion replaces first text field (heading/body/text) found in block data
- AI Image Gen "Use in Selected Block" only works for image/hero/gallery blocks
- AI Image Enhance requires a selected image block or hero background with an actual image set
- Markup attachment is visual only (button appears, but doesn't send markup data to AI endpoint yet)
- Image Library save from AI Image Gen is not yet wired (shows disabled state correctly)
- Missing provider/key returns mock/fallback responses, not error states
