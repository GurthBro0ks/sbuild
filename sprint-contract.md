# Sprint Contract: sBuild Help / User Guide

## Goal
Add a beginner-friendly "Help" / "User Guide" modal accessible from the topbar.

## Done Criteria
1. Help button (labeled "?") appears in topbar near Settings
2. Clicking Help opens a modal titled "sBuild Help / User Guide"
3. Modal contains accordion sections covering: Quick Start, Modes, Pages/Website Manager, Blocks, Styling, Images, AI/Markup, Accounts, Save/Revert/Safety, Troubleshooting
4. Modal is scrollable, viewport-bounded, closeable via button/backdrop/Escape
5. Desktop and mobile layout preserved (no clipping, no iPhone zoom, no autofocus)
6. UI contract tests verify: Help button exists, modal opens, core terms present, modal closes
7. Existing Settings, Website Manager, Preview, Markup tests still pass
8. publishAllowed remains false, unauth POST /api/publish returns 401

## Regression List
- Settings modal (open/close, tabs)
- Website Manager modal (open/close, page actions)
- Preview mode isolation
- Markup mode
- Builder UI theme isolation
- Mobile toolbar and drawer layout
- Publish remains dry-run
