# sBuild DESIGN.md Adoption — Audit & Plan

> **Status:** Docs-only audit/plan. No `DESIGN.md` is created in this phase.
> **Phase:** `sbuild-designmd-audit-plan`
> **Date (UTC):** 2026-06-25; current-state note added 2026-06-27
> **Repo:** `/opt/slimy/sbuild` — branch `main`, current accepted `HEAD=b24045b`
> **Author role:** SlimyAI ops lead (planning-only)
>
> This document inventories the *current* sBuild UI/design reality from code,
> proposes the safest structure for a future `DESIGN.md`, defines what becomes
> machine-readable tokens vs. human rationale, and lists the validation gate that
> must pass **before** `DESIGN.md` is treated as source of truth. It changes no
> runtime behavior and restarts no service.

---

## Current accepted state note — 2026-06-27

This remains a documentation/adoption plan. It is **not** an implemented root
`DESIGN.md`, and it does not make the design system authoritative.

Current repo state to preserve during future work:

- sBuild A-D follow-up is accepted at commit `21baac5`.
- Operator QA confirmed the deployed UI reported `0.5.0-dev.142+21baac5`
  with browser/server build match.
- The `project/project.json` live-data policy is accepted at commit `b24045b`
  and lives at `docs/ops/project-json-live-data-policy.md`.
- `project/project.json` is production live/user data and may remain a tracked
  dirty file in the production worktree. This plan must cross-reference the
  policy, not duplicate or override it.
- Future docs-only DESIGN.md adoption phases should not restart services,
  deploy, change Caddy/DNS/cron/timers/tmux, touch publish settings, or create
  root `DESIGN.md` unless that exact file is explicitly approved.

---

## 0. Scope & Non-Goals

**In scope (this phase):**
- Read-only inventory of existing tokens, typography, spacing, mobile rules,
  components, copy tone, and accessibility reality.
- A proposed `DESIGN.md` outline and a token-extraction strategy.
- A validation plan and risk list for the follow-up implementation phase.

**Explicit non-goals (this phase):**
- Do **not** create root `DESIGN.md` yet (none exists today — confirmed below).
- Do **not** refactor CSS, extract tokens into a real file, or change any color.
- Do **not** restart services, build, deploy, or push.

---

## 1. Current Design Reality — Source-of-Truth Map

There is **no `DESIGN.md`** and no tracked file matching `*design*` in the repo
today (`git ls-files | grep -i design` → empty). Design decisions currently live
entirely in code:

| Concern | Current source of truth | Location |
|---|---|---|
| Editor chrome colors (light) | CSS `:root`-equivalent on `html, body` | `packages/editor/src/styles.css:4-28` |
| Editor chrome colors (dark) | `.sbuild-editor-shell.theme-dark` | `packages/editor/src/styles.css:30-47` |
| Editor chrome colors (canvas isolation copy) | `.canvas-frame` re-declares light `--editor-*` | `packages/editor/src/styles.css:910-929` |
| Site theme tokens (`--sbuild-*`) | Set inline at runtime from project styles | `packages/editor/src/App.tsx:2237-2251` |
| Built-in site theme presets (8) | `themePresets` array | `packages/editor/src/App.tsx:397-406` |
| Block style presets (bg/border/shadow) | `BACKGROUND_STYLE_PRESETS` etc. | `packages/editor/src/App.tsx:408+` |
| Typography catalog | Google Fonts `@import` | `packages/editor/src/styles.css:1` |
| Block/component vocabulary | `BlockType` union | `packages/shared/src/types.ts:1-14` |
| Global style + theme schema | `SBuildGlobalStyles`, `SBuildThemePreset` | `packages/shared/src/types.ts:221-265` |
| Layout/width modes | `BlockLayout`, width presets | `packages/shared/src/types.ts:25-36` |

### 1.1 Two-tier token system (the central architectural fact)

sBuild deliberately separates **editor chrome** from **user-site content** with
two distinct CSS custom-property namespaces:

- **`--editor-*`** — the builder application's own UI (topbar, drawers, buttons,
  status pills). Light values declared on `html, body`; dark values overridden by
  `.sbuild-editor-shell.theme-dark`.
- **`--sbuild-*`** — the *website being built*. These are written to the DOM at
  runtime via `target.style.setProperty("--sbuild-…", …)` from
  `project.globalStyles.colors` (`App.tsx:2237-2251`).

**Scope isolation:** `.canvas-frame` re-declares the **light** `--editor-*`
defaults (`styles.css:910-929`) so the user's site preview is never tinted by the
editor's dark theme. This is intentional and load-bearing — any token refactor
must preserve it. (See related history in memory: `extractBlockContent` /
scope-isolation work.)

### 1.2 Color tokens — editor chrome

| Token | Light | Dark |
|---|---|---|
| `--editor-bg` | `#f9f9f9` | `#1e1e1e` |
| `--editor-panel-bg` | `#ffffff` | `#252526` |
| `--editor-panel-bg-2` | `#f3f3f3` | `#2d2d2d` |
| `--editor-border` | `#e0e0e0` | `#3e3e42` |
| `--editor-text` | `#222222` | `#e0e0e0` |
| `--editor-text-muted` | `#666666` | `#858585` |
| `--editor-accent` | `#2b6dff` | `#3794ff` |
| `--editor-button-bg` | `#ffffff` | `#333333` |
| `--editor-button-text` | `#222222` | `#e0e0e0` |
| `--editor-button-border` | `#e0e0e0` | `#444444` |
| `--editor-status-bg` | `#eef5ff` | `#2d2d2d` |
| `--editor-input-bg` | `#ffffff` | `#3c3c3c` |
| `--editor-danger` | `#c44` | `#f44747` |
| `--editor-highlight` | `#2b6dff` | `#3794ff` |

> Note: the light set is duplicated verbatim inside `.canvas-frame` (plus an
> extra `--editor-muted: #888888` and `--editor-surface: #f5f5f5` only present
> there). This duplication is a known maintenance hazard — see §6 Risks.

### 1.3 Color tokens — user site (`--sbuild-*`)

Referenced in CSS: `--sbuild-bg`, `--sbuild-page-bg`, `--sbuild-canvas-bg`,
`--sbuild-surface`, `--sbuild-nav-bg`, `--sbuild-card-bg`, `--sbuild-border`,
`--sbuild-text`, `--sbuild-heading-color`, `--sbuild-heading-font`,
`--sbuild-body-font`, `--sbuild-button-bg`, `--sbuild-button-text`,
`--sbuild-editor-bg`. These derive from the `SBuildGlobalStyles.colors` schema
(`types.ts:224-246`), which has ~22 optional color slots
(`bg/surface/text/accent/muted` required-ish, plus `pageBackground`,
`canvasBackground`, `navBackground`, `blockBackground`, `blockAltBackground`,
`cardBackground`, `cardAltBackground`, `headingColor`, `bodyTextColor`,
`mutedTextColor`, `accentColor`, `buttonBackground`, `buttonTextColor`,
`borderColor`, `shadowColor`, `linkColor`).

### 1.4 Built-in site theme presets (8)

From `App.tsx:397-406` (`themePresets`): **Harvest Light**, **Farmstand Dark**,
**Slimy Neon**, **Midnight Orchard**, **Retro Terminal**, **Clean Market**,
**Ocean**, **Sunset**. Each carries a full color object, `headingFont`,
`bodyFont`, and `isDark`. "Harvest Light" / "Farmstand Dark" reflect the
Black Fish Farms origin domain.

### 1.5 Typography

- **Font catalog (loaded):** Bebas Neue, Lato (400/700), Libre Baskerville
  (400/700), Merriweather (400/700), Nunito Sans (400/700), Playfair Display
  (700), Poppins (400/600/700), Space Grotesk (400/700) — `styles.css:1`.
- **Editor chrome base:** `Nunito Sans` (`styles.css:58`); app logo uses
  `Bebas Neue` with `letter-spacing: 0.04em` (`styles.css:115-121`).
- **Site fonts:** chosen per theme (`headingFont` / `bodyFont`), surfaced as
  `--sbuild-heading-font` / `--sbuild-body-font` (`App.tsx:2250-2251`).
- **Per-block override:** free-text `fontFamily` input in the Props drawer
  (`App.tsx:4930`), wrapped as `'<font>', sans-serif`.
- Optional live Google Fonts list via `GOOGLE_FONTS_API_KEY` (README env vars).

### 1.6 Spacing / density

- **Border-radius scale (by frequency):** 6px (×42), 8px (×28), 10px (×24),
  4px (×11), 12px (×9), 999px pill (×8), 16/14/18px (rare). The editor chrome is
  compact/tool-dense; rounded pills used for status + toggles.
- **Gap scale:** 6px (×36), 8px (×32), 4px (×18), 10px (×9), 2px (×6), 12px (×4).
- **Touch targets:** commonly `36px` min, with `40px`/`48px` in places
  (`styles.css:983-984, 945, 1511`). **36px is below the WCAG 2.5.5 / 44px
  recommendation** — flagged in §6.

### 1.7 Mobile / responsive rules

- **Primary breakpoint:** `@media (max-width: 768px)` (used in ~10 places).
- **Tablet range:** `@media (max-width: 1100px)` and
  `@media (min-width: 1101px) and (max-width: 1300px)`.
- **Viewport safety:** `--safe-area-top/bottom` from `env(safe-area-inset-*)`
  (`styles.css:10-11`); shell sizing uses `100dvh` not `100vh`
  (`styles.css:61, 109`) — a deliberate fix from prior mobile-viewport work.
- **Canvas device widths:** tablet `820px`, phone `430px` (`styles.css:931-932`).
- `prefers-reduced-motion: reduce` honored (`styles.css:1829`).

### 1.8 Component / pattern vocabulary

- **Blocks (13):** `hero, text, image, cards, hours, gallery, contact,
  testimonial, map, marquee, spacer, divider, html` (`types.ts:1-14`).
- **Block effects:** `glow, marquee, fade-in, gradient-text, parallax, pulse,
  hover-grow` (`types.ts:16-23`).
- **Style presets:** background `clean/glass/neon/soft/bold/terminal/image-overlay`;
  border `none/thin/accent/double/dashed/glow-edge`; shadow
  `none/soft/lifted/strong/neon/inner` (`types.ts:38-40`).
- **Editor shell patterns:** sticky topbar, right Props drawer, dashed
  `canvas-frame`, `canvas-nav` site header, floating AI panel, and the
  uncontrolled `EditableText` contentEditable helper (caret-fix infrastructure).

### 1.9 Copy tone

Plain, action-first, and **safety-reassuring**. Status/affordance strings favor
non-destructive language and explicit outcomes:
`"Unsaved changes"`, `"Saving..."`, `"Saved!"`, `"Save failed."`,
`"Preview only — nothing applied. Use Save to Library or Apply to Selected
Block to make changes."`, `"Reverted to last save"`,
`"Saved to Image Library. Select a block to apply."` Publishing is framed as
guarded/dry-run. DESIGN.md copy guidance should codify this calm, explicit,
non-destructive voice.

### 1.10 Accessibility — current reality (not aspiration)

- ~36 `aria-*` / `role=` usages in `App.tsx`.
- `:focus-visible` outlines (3px accent) on gallery slots and some controls
  (`styles.css:1191-1193, 3525`).
- `prefers-reduced-motion` block present.
- **Gaps to record honestly:** several `outline: none` / `outline: none
  !important` resets (`styles.css:670, 1745-1748, 2877, 3101…`); 36px touch
  targets below 44px; no documented contrast audit for the 8 presets.

---

## 2. Proposed `DESIGN.md` Outline

Recommended location: **repo root `DESIGN.md`** (discoverable next to README),
with machine-readable tokens factored into a separate data file (see §3).

```
DESIGN.md
1.  Purpose & Status (source-of-truth scope; what it does/doesn't govern)
2.  Design Principles (local-first, non-destructive, calm/explicit copy,
    editor-chrome vs user-site separation)
3.  Token Architecture
    3.1 Editor chrome tokens (--editor-*) — light/dark
    3.2 User-site tokens (--sbuild-*) — runtime-applied from project styles
    3.3 Scope-isolation contract (canvas-frame light reset) — DO NOT BREAK
4.  Color Tokens (tables; point at machine-readable source in §3)
5.  Typography (catalog, chrome fonts, site fonts, per-block override rules)
6.  Spacing & Density (radius scale, gap scale, touch-target policy)
7.  Responsive Rules (breakpoints 768/1100/1300, dvh, safe-area, device widths)
8.  Component & Block Vocabulary (13 blocks, effects, style presets)
9.  Theme Presets (the 8 built-ins; how a preset maps to tokens)
10. Copy & Voice Guidelines (tone, status-message patterns)
11. Accessibility Baseline & Known Gaps (focus, reduced-motion, contrast TODO)
12. Known Issues This Doc Does NOT Solve (links to §QA below)
13. Change Process (how to update tokens without drift)
```

Keep `DESIGN.md` **descriptive of current reality first**, with aspirational
items clearly marked `PLANNED` / `GAP` so it never over-claims.

---

## 3. Machine-Readable vs. Human-Readable Split

**Machine-readable (extract to a single source of truth, e.g.
`packages/shared/src/designTokens.ts` or `design-tokens.json`, imported by both
CSS-gen and TS):**
- Editor chrome color tokens (light + dark) — currently triplicated across
  `styles.css` (`html,body`, `.theme-dark`, `.canvas-frame`).
- The 8 `themePresets` color/font objects (today inline in `App.tsx:397-406`).
- Spacing scale (radius set `{4,6,8,10,12,16,999}`, gap set `{2,4,6,8,10,12}`).
- Breakpoints (`768`, `1100`, `1300`) and canvas device widths (`820`, `430`).
- Font catalog list (the 8 families) + default chrome/site fonts.
- Block/effect/style-preset enums (already typed in `shared/types.ts` — reference,
  don't duplicate).

**Human-readable rationale (stays prose in `DESIGN.md`):**
- *Why* chrome and site tokens are separated and why the canvas resets to light.
- *Why* copy is non-destructive/dry-run framed.
- Touch-target and contrast policy intent (and the honest gap notes).
- When to add a new block type vs. a new style preset.
- Migration/versioning guidance for the persisted `project.json` style schema.

> **Single-source rule:** DESIGN.md tables should be *generated from or
> cross-checked against* the machine-readable file, never hand-maintained in
> parallel — otherwise drift re-introduces the current triplication problem.

---

## 4. Validation Plan — Before `DESIGN.md` Becomes Source of Truth

The follow-up phase must prove the documented values match shipped CSS/TS, with
**zero behavior change**, before DESIGN.md is authoritative:

1. **Inventory parity check:** every token value in DESIGN.md/`designTokens`
   equals the current value in `styles.css` + `App.tsx` (diff to confirm `0`
   value changes). A throwaway script/grep comparison is sufficient.
2. **Triplication reconciliation (read-only first):** confirm the three
   `--editor-*` light declarations are byte-identical except for the canvas-only
   extras (`--editor-muted`, `--editor-surface`); document any divergence.
3. **Docs-only truth gate:** for a descriptive documentation phase, run
   `git diff --check`, `pnpm -r lint`, `pnpm -r typecheck`, and `pnpm -r test`.
   Do not build, deploy, or restart services for docs-only adoption work.
4. **Contract test (optional, recommended):** add a test asserting
   `themePresets` and the token file agree, so future drift fails CI.
5. **Scope-isolation regression:** confirm canvas preview still renders with
   light `--editor-*` even when the editor shell is in dark theme.
6. **Token-extraction proof, separate phase only:** if/when tokens are
   extracted, run the broader build/visual parity proof in that later phase.
   The built CSS must be semantically identical (visual diff or hashed-rule
   comparison) before any restart is even proposed.
7. **Operator sign-off:** operator confirms DESIGN.md matches the live UI on
   desktop + mobile before flipping it to "source of truth."

DESIGN.md stays marked `DRAFT — descriptive only` until steps 1–7 pass.

---

## 5. Files Likely Touched in the Next Phase

**Next phase (write DESIGN.md, descriptive-only):**
- `DESIGN.md` (new, root) — descriptive snapshot, but only if the mission
  explicitly names that filename.
- `docs/sbuild-designmd-adoption-plan.md` (this file) — status update only.

**Later phase (token extraction, separate sprint, higher risk):**
- `packages/shared/src/designTokens.ts` **or** `design-tokens.json` (new).
- `packages/editor/src/styles.css` (replace literals with `var()` / generated
  values — behavior-preserving only).
- `packages/editor/src/App.tsx` (`themePresets` sourced from the token file).
- `packages/editor/src/ui-contract.test.js` (add drift/parity tests).

> The descriptive DESIGN.md phase should **not** touch `styles.css` or `App.tsx`.
> Token extraction is a distinct, test-gated change and must not be bundled with
> doc authoring.

---

## 6. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Token triplication** (`--editor-*` light values in 3 places) — extraction could silently change a value | Value-parity diff (Validation §4.1–4.2); no-op build proof |
| R2 | **DESIGN.md over-claims** (documents intent as if shipped) | Mark every aspirational item `PLANNED`/`GAP`; descriptive-first |
| R3 | **Drift** between DESIGN.md tables and code | Single source of truth + contract test (§3, §4.4) |
| R4 | **Scope-isolation breakage** if canvas reset is "deduplicated" away | Treat canvas light reset as a contract; regression test (§4.5) |
| R5 | **Bundling docs with refactor** raises blast radius on auth-sensitive service | Keep doc phase pure-docs; extraction is a separate gated sprint |
| R6 | **Accessibility gaps get frozen as "the standard"** (36px targets, outline resets) | Record them as GAPs with a remediation TODO, not as approved baseline |
| R7 | **Persistent dirty `project/project.json`** confuses "clean" claims | Treat it as live/user data; follow `docs/ops/project-json-live-data-policy.md`; never stage it during doc work |
| R8 | **Docs-only work accidentally becomes an implementation phase** | No root `DESIGN.md`, code edits, skill installs, build, deploy, or restart unless explicitly approved |

---

## 7. Known QA Issues DESIGN.md Must NOT Paper Over

Pulled from `claude-progress.md`, `feature_list.json`, and live repo state:

1. **A-D follow-up is accepted at `21baac5`** and operator QA passed for the
   visible deployed version `0.5.0-dev.142+21baac5`, browser/server match,
   image upload/delete, caret typing, and save. DESIGN.md may reference that
   accepted state, but it must not imply unrelated design/token extraction has
   shipped.
2. **`project/project.json` is live/user project data** and may remain dirty in
   the production worktree. Follow `docs/ops/project-json-live-data-policy.md`
   instead of treating dirty status as something to hide or clean.
3. **Latent testimonial quote-doubling** behavior is known and out of scope.
4. **Touch targets at 36px** below the 44px recommendation; **`outline:none`
   resets** reduce keyboard-focus visibility in places.
5. **No contrast audit** exists for the 8 presets (esp. Retro Terminal /
   Slimy Neon high-saturation pairs).

---

## Safe Future Implementation Checklist

Use this checklist before any future phase converts this plan into a root
`DESIGN.md`, installs design skills, or extracts tokens.

1. Read context first:
   - `cat /home/slimy/AGENTS.md`
   - `cat /home/slimy/claude-progress.md`
   - `source /home/slimy/init.sh`
2. Record proof in a fresh `/tmp/proof_sbuild_designmd_*` directory.
3. Run `git status --short` and identify unrelated dirty files before editing.
4. Preserve `project/project.json` as live/user data:
   - keep it dirty if already dirty
   - do not stage it
   - do not reset, delete, overwrite, move, or hide it
   - follow `docs/ops/project-json-live-data-policy.md`
5. Do not create root `DESIGN.md` unless that exact filename is the explicit
   mission.
6. Do not install, symlink, or modify skills unless explicitly approved.
7. For docs-only work, do not build, deploy, restart `sbuild.service`, change
   Caddy/DNS/cron/timers/tmux, or touch publish settings.
8. For UI behavior or token extraction work, require repo validation plus
   operator desktop/mobile browser QA before acceptance.
9. Keep unrelated dirty work separate and commit only task-related files.
10. Report final status using the standard fields: proof dir, validation, dirty
    state, notification status, whether services changed, and the next step.

---

## 8. Manual QA Checklist (operator)

- [ ] Review `docs/sbuild-designmd-adoption-plan.md` end-to-end.
- [ ] Confirm the token tables (§1.2–1.3) match what you see in the live editor
      (light + dark) on desktop.
- [ ] Confirm the canvas preview stays light even when the editor is dark
      (scope isolation, §1.1).
- [ ] Confirm the 8 theme presets (§1.4) match the theme picker in the app.
- [ ] Confirm breakpoint behavior at ≤768px (mobile) and the 1100/1300 tablet
      ranges feels right on a real device.
- [ ] Confirm copy-tone examples (§1.9) reflect the actual UI strings.
- [ ] Confirm the Known QA Issues list (§7) is accurate and nothing is hidden.
- [ ] Decide & confirm: the next phase **may** create a descriptive root
      `DESIGN.md` (no code/token changes), if and only if that exact filename
      is approved.
- [ ] Manual QA remains **PENDING** until the operator explicitly confirms.

---

## 9. Safety Statement

This phase is **docs-only**. No service was restarted; no build, deploy, or push
was performed; no production behavior changed. No Caddy, DNS, cron, systemd
timer, tmux, secret, Discord/webhook, or runtime setting was touched. The only
pre-existing dirty file (`project/project.json`) was left untouched and not
staged. No `DESIGN.md` was created in this phase. Manual QA remains pending until
the operator confirms this document matches current sBuild UI reality and
approves the next phase.
