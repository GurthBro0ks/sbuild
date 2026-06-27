# sBuild Design Contract

This file is the root design contract for sBuild agents. Keep it practical, current, and proof-driven.

sBuild is a protected staging website editor for Black Fish Farms. The editor chrome, preview canvas, generated site content, image library, and build/version identity all have separate responsibilities. Do not blur them.

## Current Accepted State

* Production mutable project data lives outside the git worktree via `SBUILD_DATA_ROOT=/var/lib/sbuild`.
* Production project data path: `/var/lib/sbuild/project.json`.
* Production images path: `/var/lib/sbuild/images`.
* Tracked seed/example: `project/project.example.json`.
* Repo-local `project/project.json` is ignored local residue and must not be committed.
* Live data handling policy: `docs/ops/project-json-live-data-policy.md`.
* Historical adoption plan and audit: `docs/sbuild-designmd-adoption-plan.md`.

## Design Priorities

1. Protect production.
2. Protect live project data.
3. Keep editor chrome separate from user-site preview.
4. Preserve mobile usability.
5. Preserve browser/server build identity honesty.
6. Require proof, tests, and operator QA before accepting UI behavior changes.

## Token Boundaries

sBuild uses two conceptual styling layers.

### Editor Chrome

Editor chrome includes the topbar, side panels, modals, toolbars, settings, debug panels, image library UI, and admin controls.

Use editor-facing styling/tokens for editor chrome. Editor styling must not leak into generated user-site content.

### User-Site Preview/Content

User-site content includes blocks rendered inside the website preview/site canvas, such as hero, text, cards, hours, gallery, contact, testimonial, map, marquee, spacer, divider, and HTML blocks.

Use site/theme-facing styling/tokens for preview content. User-site theme choices should affect the preview/site content, not the editor shell.

## Canvas Scope Isolation

The canvas is a boundary.

* Do not let editor reset/global styles accidentally restyle the generated site.
* Do not let user-site block styles restyle editor controls.
* Avoid broad selectors that cross from editor shell into preview content.
* Any future CSS refactor must prove editor controls and preview content still render separately.
* UI changes that affect the canvas require browser QA.

## Mobile Contract

Mobile usability is load-bearing.

* Topbar must remain visible and usable.
* Drawer/sidebar behavior must not clip or trap the user.
* Modals must fit the viewport and support scrolling.
* AI panel and image library must remain usable on phone-sized screens.
* Any mobile shell change requires desktop and mobile/browser QA.

## Text Editing Contract

Text editing must not reverse text or jump the caret.

Previously affected fields included headings, nav labels, hours row day, testimonial quote, and testimonial author. Any edit to `contentEditable`, controlled text inputs, block field rendering, or caret logic must include targeted regression coverage and operator QA.

## Image Library Contract

The image library stores uploaded/generated project assets and controls images used by gallery blocks and image fields.

* Production images live under `/var/lib/sbuild/images`.
* Do not assume repo-local `project/images` is the production source.
* Upload and delete behavior must be tested together.
* Delete endpoints must preserve path traversal protections and compatibility expectations.
* Image changes require browser QA for upload, browse, selection, and delete.

## Build/Version Identity Contract

sBuild must honestly report the served build.

* Browser/server build match must remain visible in Settings/About.
* Version drift warnings must be real, not caused by docs-only repo commits.
* `/health.gitCommit` represents served build identity.
* Repo HEAD diagnostics may differ after docs-only commits and must remain clearly diagnostic.
* Do not hide stale-client or stale-bundle problems.

## Live Data Contract

Mutable production data must not dirty source control.

* Production data root: `/var/lib/sbuild`.
* Source seed/example: `project/project.example.json`.
* Ignored local residue: `project/project.json`.
* Do not commit live user data.
* Do not reset, delete, or overwrite live data to make git clean.
* Follow `docs/ops/project-json-live-data-policy.md`.

## Docs-Only Work

Docs-only design work may create or edit docs, but must not:

* deploy
* restart services
* build production artifacts
* change Caddy/DNS/cron/timers/tmux
* change Discord secrets
* change service env
* touch `/var/lib/sbuild` except read-only verification
* modify live project data

Docs-only work still needs a proof dir, git status, validation, secret scan, and closeout.

## UI Implementation Work

Any future implementation based on this design contract must include:

* fresh proof dir
* `git status` before edits
* unrelated dirty-state report
* targeted tests
* lint/typecheck/test validation
* build when behavior changes
* browser QA
* mobile QA when shell/modal/panel behavior changes
* no push until proof PASS and operator QA PASS

## Agent Checklist

Before changing sBuild:

1. Read `/home/slimy/AGENTS.md`.
2. Read `/home/slimy/claude-progress.md`.
3. Run `source /home/slimy/init.sh`.
4. Confirm target machine and repo.
5. Run `git status --short`.
6. Keep unrelated dirty state separate.
7. Preserve `/var/lib/sbuild` and ignored live data.
8. Make the smallest scoped change.
9. Validate with real commands.
10. Report proof dir, changed files, commit, push status, service changes, notification status, and QA status.

## When In Doubt

Stop with `RESULT=WARN` instead of guessing. Protect production and live data first.
