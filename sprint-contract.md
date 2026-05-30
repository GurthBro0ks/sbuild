# Sprint: AI Top Menu (Three-Tab Panel)

## Goal
Replace the generic AI Assistant right-drawer panel with a proper AI Top Menu that opens below the toolbar with three tabs: AI Chat, AI Image Gen, AI Image Enhance.

## Done Criteria (testable)

1. **Top toolbar AI button opens AI Top Menu panel** — verify: `grep 'aiTopMenuOpen' App.tsx` and UI contract test
2. **AI Top Menu has three tabs: AI Chat, AI Image Gen, AI Image Enhance** — verify: UI contract tests check tab labels
3. **Tabs switch without closing the panel** — verify: UI contract test
4. **AI Chat shows target selector (Selected Block, Current Page, Whole Site)** — verify: UI contract test
5. **Ask AI with missing provider/key shows safe setup message** — verify: UI contract test + server test
6. **Apply Suggestion disabled until valid proposal exists** — verify: UI contract test
7. **AI Image Gen shows missing-provider message when no key/provider** — verify: server test returns safe JSON
8. **AI Image Enhance shows "select image first" when no image target** — verify: UI contract test
9. **Markup attach control appears only when markup exists or shows disabled explanation** — verify: UI contract test
10. **Theme isolation intact** — verify: existing theme bleed tests still pass
11. **Help/User Guide still opens** — verify: existing help tests still pass
12. **Admin-only Image/API Keys remains admin-only** — verify: existing admin tests still pass
13. **Publish safety intact** — verify: `curl -X POST /api/publish` returns 401
14. **All existing tests pass** — verify: `pnpm -r test` green

## Regression List
- Help/User Guide modal opens and closes
- Theme isolation (no editor↔canvas bleed)
- Paint/Markup mode still works
- Save/Revert still works
- Publish dry-run still protected
- Admin-only secrets routes still gated
- Mobile drawer still works
