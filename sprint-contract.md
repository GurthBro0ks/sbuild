# Sprint Contract: AI Markup Theme Isolation + QA Repair

## What
Fix AI Markup mode theme bleed: editor/dark markup styling leaks into website preview during Markup mode. Site preview must show only the selected Website Theme regardless of Builder UI Theme.

## Done Criteria
1. [x] `.canvas-frame` resets `--editor-*` CSS vars to light defaults, preventing dark editor theme from bleeding into site preview
2. [x] Paint overlay has explicit `width: 100%; height: 100%` for full canvas coverage
3. [x] Paint overlay capture mode has `touch-action: none` and `user-select: none` for reliable touch drawing and text selection prevention
4. [x] Toolbar text: "Discard" → "Discard Markup"; helper text updated to "Click and drag to draw. Markup is only for AI notes and is not published."
5. [x] 4 UI contract tests added (theme isolation, overlay sizing, touch-action, click-drag instruction)
6. [x] 2 existing test assertions updated for new toolbar text
7. [x] All 307/307 editor tests pass
8. [x] Typecheck, build, lint all pass
9. [x] Smoke test passes (auth gates, publish safety)
10. [x] Published to origin/main

## Regression List
- Editor theme switching must still work (Builder UI Theme → Dark/Light)
- Website preview must remain unaffected by editor theme
- Paint/markup drawing must still work
- Preview/Edit mode isolation must be preserved
- Publish must remain dry-run (publishAllowed=false)
- Unauth POST /api/publish returns 401
- No force push
