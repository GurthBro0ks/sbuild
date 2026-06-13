# Test Integrity — Follow-up Plan

Status as of 2026-06-13 (phase: sbuild-test-integrity).

## What this phase fixed
- **Shared tests run for real.** `@sbuild/shared` `test` no longer `echo`s; it compiles
  `pageHelpers.test.ts` into an isolated `dist-test` (via `tsconfig.test.json`) and runs it
  with `node --test`, never touching the runtime `packages/shared/dist`.
- **Lint is no longer theater.** `shared`/`server`/`editor` `lint` scripts now run real
  `tsc --noEmit` type checks instead of `echo`. (No ESLint config exists in the repo; a real
  ESLint migration was intentionally out of scope.)
- **Git-dependent editor test hardened.** The `generate-build-meta.sh` regression now skips
  cleanly outside a `.git` checkout and runs the full assertion when git + HEAD are available,
  so it never masks a real failure and never requires `.git` in a workcopy.
- **Behavioral coverage added.** `generateSite.renderBlock` rendering/escaping tests and a
  backup→restore byte-for-byte round-trip test (on top of the existing restore valid/invalid
  tests from the auth/restore fix).

## Known remaining gaps (deliberately deferred)
1. **Editor source-regex contract tests (F-T1).** The bulk of `ui-contract.test.js` asserts
   against `App.tsx` source text rather than rendered behavior. These are brittle and prove
   "the string exists", not "the UI works". Replacing them needs a jsdom/component harness.
2. **No DOM/component rendering for the editor.** `getDisplayVersion`, the version-mismatch
   banner, and the health-failure state live inside `App.tsx` and are only checked via source
   regex today.

## Recommended next steps (separate phases)
1. **Extract pure editor helpers.** Move `getDisplayVersion(buildInfo, status)` and the build
   identity/mismatch logic out of `App.tsx` into a framework-free `*.ts` module so they can be
   unit-tested with `node --test` (no jsdom needed). Then add behavioral tests:
   - version string formatting for match / mismatch / health-unavailable inputs;
   - banner visibility decision for each state.
2. **Add a jsdom + @testing-library/react harness** (Vitest or `node --test` + jsdom) for the
   editor and convert the highest-value regex contracts (version banner, image library tabs,
   chat-clear guard) into real render-and-assert tests. Keep the regex tests until each is
   replaced 1:1 so coverage never regresses.
3. **generateSite end-to-end output.** Parameterize the output directory (or inject `distDir`)
   so `generateSite()` can be tested against a temp dir, then assert the full index.html /
   styles.css / sitemap.xml / robots.txt artifacts (currently only `renderBlock` is unit-tested
   because `generateSite()` writes to a fixed production `dist`).
