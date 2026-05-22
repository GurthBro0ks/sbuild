# Sprint Contract: sBuild Persistence/Chrome/Image Fix

## What
Fix the remaining manual QA blockers focused on persistence correctness, editor chrome style isolation, image manager completeness/discoverability, crop/fit visibility, build metadata branch/dirty status, terminal preset animation visibility, preset description discoverability, and theme override preservation.

## Done Criteria
1. Save + hard refresh reloads from `project/project.json` and preserves text/theme/style/image/layout edits
2. Smoke/project roundtrip does not permanently overwrite real `project/project.json`
3. Diagnostics and `/health` include reliable branch and accurate dirty status behavior
4. Editor shell UI is fully isolated from user site styles (toolbar/panels/buttons/status/debug remain readable)
5. Right panel tabs and content remain readable and scrollable at normal viewport widths
6. Image Manager modal clearly shows project photo folder controls with validation and persistence
7. `/api/images` returns complete file metadata (including unsupported/extensionless entries) and UI renders fallback cards
8. Crop/Fit action is always visible with clear disabled reason and safe enabled behavior
9. Terminal preset has visible animation marker/effect and preset descriptions are visible near selector
10. Theme dropdown preserves explicit custom overrides; Apply Theme to All Blocks performs intentional broad reset
11. Publish endpoint remains dry-run unless `SBUILD_ALLOW_PUBLISH=1`
12. `pnpm -r typecheck`, `pnpm -r build`, `pnpm -r lint`, `pnpm -r test`, and `bash scripts/smoke-sbuild.sh` pass

## Regression List
- version visible in topbar
- About tab build metadata + diagnostics copy
- selected part targeting
- image upload/apply
- B&W and Enhance image edits
- row join 2/3/4
- edge resize
- save/reload custom styles
- publish dry-run
- typecheck/build/lint/test all pass
