# sBuild Changelog

## Unreleased / Prototype

### 0.5.0-dev — Help Guide, Website Manager, User Management
- **Added**
  - Help/User Guide modal with accordion sections, topbar `?` button, close/backdrop/Escape dismiss — accepted desktop + mobile QA
  - Website Manager MVP: create, rename, slug, show/hide, parent, duplicate, and delete pages
  - Admin identity and user management: login as admin, create/reset/disable users, change password
  - Admin-only Image/API Keys tab gated by role
  - AI Markup mode (renamed from Paint Mode) with drawing improvements
  - Canvas/theme isolation: prevent editor chrome colors from leaking into site preview
- **Safety**
  - Publish remains dry-run only; `publishAllowed=false` and unauth `/api/publish` returns 401
- **Proof**
  - `/tmp/proof_sbuild_help_guide_acceptance_20260530T<time>`

### 0.4.0-dev — Versioning, Transparent Styles, Visual Effects
- **Added**
  - Formal versioning system with `SBUILD_VERSION = "0.4.0-dev"`
  - `getBuildInfo()` helper exposing version, git commit, branch, build date, dirty flag
  - Server `/health` now returns `appName`, `version`, `gitCommit`, `buildDate`, `publishAllowed`
  - Editor topbar shows `sBuild v0.4.0-dev` instead of hardcoded `sBuild v2`
  - Settings → About tab with version, git commit, build date, and changelog summary
  - Transparent as a first-class color/style option for backgrounds, borders, and text
  - Visual effect presets: Glass, Neon glow, Soft card, Bold panel, Terminal, Clean, Image overlay
  - Border style presets: None, Thin, Accent, Double, Dashed, Glow edge
  - Shadow/effect presets: None, Soft, Lifted, Strong, Neon, Inner
  - Text effect presets: None, Subtle glow, Strong glow, Outline, Shadow
  - Button style presets: Solid, Outline, Ghost, Pill, Glow
  - Color picker swatches with transparent checkerboard preview
  - `scripts/version-sbuild.sh` for bump/show version
  - `CHANGELOG.md` tracking
- **Changed**
  - Color controls now offer `Use theme`, `Transparent`, and `Custom color` modes
  - Background type selector upgraded with structured transparent handling
  - Style panel reorganized with Background Style, Border Style, Shadow, and Text Effect preset rows
- **Fixed**
  - Hardcoded `sBuild v2` replaced with dynamic version string
- **Safety**
  - Publish remains dry-run only unless `SBUILD_ALLOW_PUBLISH=1`
  - No secrets stored in `project.json`
- **Proof**
  - `/tmp/proof_sbuild_version_transparent_style_20260522T<time>`

### 0.3.0-dev — Beginner Style Editor Cleanup
- **Added**
  - Two-color gradient builder with direction controls and presets
  - Dedicated Image Manager tab in right panel
  - Project photo folder setting with path validation
  - Editor chrome style isolation (user colors don't leak into UI)
- **Changed**
  - Font weight display now shows numeric values (400/600/700/800)
  - Image thumbnails listing includes edited images folder
- **Proof**
  - `/tmp/proof_sbuild_beginner_style_cleanup_20260522T170559Z`

### 0.2.0-dev — Beginner Style Editor
- **Added**
  - Theme persistence after hard refresh (`selectedTheme` in project model)
  - Clear block→part targeting badge with debug block ID
  - Quick toolbar: Bold, Align, Smaller/Bigger, Reset
  - Text presets: Font, Size, Weight, Color swatches
  - Box/spacing presets: Padding, Margin, Border, Radius, Shadow
  - Background type selector: Theme/Solid/Gradient/Image/Transparent
  - Image manager modal for upload/selection
  - Friendly block labels and part-level highlighting
- **Proof**
  - `/tmp/proof_sbuild_beginner_style_editor_20260522T161638Z`

### 0.1.0-dev — Prototype Shell
- **Added**
  - Monorepo scaffold with shared, server, editor, cli packages
  - Black Fish Farms starter template
  - Express API routes: project, images, fonts, AI chat/paint/image/wizard, build, publish, backup, restore, status
  - Browser editor with top bar, left drawer, canvas, right drawer
  - Block renderers for hero, text, image, cards, hours, gallery, contact, testimonial, map, marquee, spacer, divider, html
  - Preview toggle + device modes
  - Paint overlay with prompt → AI fix
  - Nav editor, font browser, style controls, deploy panel
  - Safe deterministic fallbacks for missing provider/key cases
  - Static generator output
- **Proof**
  - `/tmp/proof_sbuild_goal_20260521T132015Z`

---

## Versioning Scheme

- **Major 0** = prototype / not fully accepted
- **Minor** increments for larger feature checkpoints
- **Patch** increments for fixes / cleanup
- **Build metadata** includes date and git short hash when available
- **Future**: once prototype accepted → v1.0.0
