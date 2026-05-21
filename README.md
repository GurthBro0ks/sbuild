# sBuild v2 Prototype

sBuild is a local-first website builder prototype with a React editor, Express API, and JSON-to-static-site generator.

## Quick Start

```bash
pnpm install
pnpm -r build
PORT=3137 node packages/server/dist/index.js
```

Editor dev mode:

```bash
pnpm --filter @sbuild/editor dev
```

## URLs

- Server/health: `http://localhost:3137/health`
- Project API: `http://localhost:3137/api/project`
- Editor dev: `http://localhost:5177`

## Commands

- `pnpm dev` runs server+editor in parallel
- `pnpm build` builds all packages
- `pnpm typecheck` typechecks workspace
- `pnpm smoke` runs the smoke script and captures proof logs

## Env Vars

- `PORT` (default `3137`)
- `SBUILD_ALLOW_PUBLISH=1` enables real publish target `/var/www/blackfishfarms.com`
- `SBUILD_OPENAI_API_KEY` or `OPENAI_API_KEY` for image route enablement
- `GOOGLE_FONTS_API_KEY` to fetch live Google Fonts list
- `SBUILD_OPENCODE_BIN` optional OpenCode CLI path

## Prototype Limitations

- `/api/ai/image` accepts `targetContext` and auto-selects provider/output sizing via deterministic `decideImageSize()`.
- `/api/images/edit` (and alias `/api/ai/image-edit`) supports uploaded-photo edit flows with local `sharp` fallback for `enhance`, `black-white`, `color-pop`, and `crop-fit`.
- `/api/ai/image` and edit routes return `sizeDecision` and `warnings` for prototype verification.
- `/api/ai/image` calls OpenAI when key is configured, otherwise returns a safe unavailable response.
- OpenCode chat uses fallback mock behavior when CLI invocation fails.
- Publish is dry-run by default for safety.
- Restore flow expects an explicit backup path payload.
