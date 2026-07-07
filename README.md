# sBuild — Visual Website Builder

A local-first visual website builder with page management, user accounts, image tools, AI markup notes, and protected dry-run publishing. Built with React editor, Express API, and TypeScript.

**Current Version:** `0.1.0`  
**Package Manager:** pnpm 10.18.3

---

## Features

- **Visual Editor** - Drag-and-drop website builder with live preview
- **Page Management** - Create and organize multiple pages
- **User Accounts** - Authenticated project ownership
- **Image Tools** - Upload, edit, and library management with AI enhancement support
- **AI Markup Notes** - Context-aware AI suggestions and markup generation
- **Dry-Run Publishing** - Protected publishing workflow with safety checks
- **Mobile-Responsive** - Full mobile usability across editor and preview
- **Local-First** - Works offline-first with production data isolation

---

## Architecture

sBuild is a **monorepo** using `pnpm` workspaces. The project is organized into independent packages:

```
sbuild/
├── packages/
│   ├── server/          # Express API and backend logic
│   ├── editor/          # React-based visual editor (frontend)
│   ├── shared/          # Shared types and utilities
│   └── cli/             # Command-line interface
├── project/             # Project data (example seed)
├── scripts/             # Build and utility scripts
├── docs/                # Design and operational docs
└── templates/           # Site templates
```

### Language Composition
- **TypeScript**: 996,168 bytes (62.4%)
- **JavaScript**: 271,910 bytes (17.0%)
- **CSS**: 104,331 bytes (6.5%)
- **Shell**: 16,910 bytes (1.1%)
- **HTML**: 300 bytes (0.02%)

---

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm 10.18.3

### Installation & Development

```bash
# Clone and navigate
cd sbuild

# Install dependencies
pnpm install

# Run dev servers (server + editor in parallel)
pnpm dev
```

### Production Build

```bash
# Generate build metadata
pnpm prebuild

# Build all packages
pnpm build

# Start server
PORT=3137 node packages/server/dist/index.js
```

### Standalone Helper Script

```bash
bash scripts/run-local-sbuild.sh
```

---

## Development Workflows

### Editor Development Only
```bash
pnpm --filter @sbuild/editor dev
```
Runs Vite dev server at `http://localhost:5177`

### Linting & Type Checking
```bash
pnpm lint       # Type check all packages
pnpm typecheck  # Full TypeScript validation
pnpm test       # Run test suite
```

### Smoke Testing
```bash
pnpm smoke      # Run smoke tests and capture proof logs
```

---

## API & URLs

### Local Development
- **Editor Root**: `http://127.0.0.1:3137/`
- **Health Check**: `http://127.0.0.1:3137/health`
- **Project API**: `http://127.0.0.1:3137/api/project`
- **Editor Dev Server**: `http://localhost:5177`

### Endpoints

**Health & Meta**
- `GET /health` - Server health and build information

**Project Management**
- `GET /api/project` - Fetch project data
- `POST /api/project` - Update project

**Image Routes**
- `POST /api/ai/image` - Generate images via OpenAI
- `POST /api/images/edit` - Edit uploaded photos (local `sharp` fallback)
- `POST /api/ai/image-edit` - Alias for image edit endpoint

**AI & Chat**
- OpenCode chat with fallback mock behavior

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3137` | Server port |
| `SBUILD_ALLOW_PUBLISH` | - | Set to `1` to enable real publish target `/var/www/blackfishfarms.com` |
| `SBUILD_OPENAI_API_KEY` | - | OpenAI API key for image generation (or use `OPENAI_API_KEY`) |
| `GOOGLE_FONTS_API_KEY` | - | Google Fonts API key for live font list fetching |
| `SBUILD_OPENCODE_BIN` | - | Optional path to OpenCode CLI binary |
| `SBUILD_DATA_ROOT` | - | Production data root (e.g., `/var/lib/sbuild` for production) |

---

## Data Management

### Project Data

Production mutable project data **lives outside the git worktree** for safety:

- **Production Data Root**: `/var/lib/sbuild`
- **Production Project File**: `/var/lib/sbuild/project.json`
- **Production Images**: `/var/lib/sbuild/images`

### Git Tracked Examples
- **Seed Project**: `project/project.example.json`
- **Local Residue** (ignored): `project/project.json` — do not commit

### Live Data Policy
See `docs/ops/project-json-live-data-policy.md` for full live data handling guidelines.

---

## Prototype Limitations

### Image API
- `/api/ai/image` accepts `targetContext` parameter
- Automatically selects provider and output sizing via `decideImageSize()`
- Returns `sizeDecision` and `warnings` for verification

### Image Editing
- `/api/images/edit` supports uploaded photo editing workflows
- Local `sharp` library fallback for: `enhance`, `black-white`, `color-pop`, `crop-fit`
- Optional OpenCode CLI support

### AI & Fallbacks
- OpenAI integration when API key is configured
- Safe "unavailable" response when key is missing
- OpenCode chat uses mock fallback on CLI failure
- Fallback image providers when primary fails

### Publishing
- **Dry-run by default** for safety
- Explicit backup path payload required for restore flows

---

## Design Principles

sBuild follows strict design contracts (see `DESIGN.md`):

1. **Protect production** - Data isolation and safe defaults
2. **Separate concerns** - Editor chrome ≠ user site preview
3. **Mobile-first** - Full mobile usability required
4. **Honest versioning** - Build identity must be truthful
5. **Live data safety** - Never dirty source control with user data

---

## Project Documentation

- **`DESIGN.md`** - Design contracts and implementation guidelines
- **`GOAL-RESULT.md`** - Project goals and results
- **`CHANGELOG.md`** - Version history and changes
- **`PLAN.md`** - Current project plan
- **`sprint-contract.md`** - Sprint commitments and expectations
- **`docs/`** - Operational and design documentation

---

## Scripts

All scripts are located in the `scripts/` directory:

- `run-local-sbuild.sh` - Local development launcher
- `smoke-sbuild.sh` - Smoke test runner
- `generate-build-meta.sh` - Build metadata generation

---

## Commands Reference

```bash
pnpm dev              # Run server + editor in parallel
pnpm build            # Build all packages
pnpm typecheck        # TypeScript validation
pnpm lint             # Lint all packages
pnpm test             # Run test suite
pnpm smoke            # Run smoke tests with proof logs
pnpm --filter [pkg]   # Run command for specific package
```

---

## Contributing

Before making changes to sBuild:

1. Read `DESIGN.md` for design contracts
2. Run `git status --short` to check current state
3. Make focused, scoped changes
4. Run `pnpm typecheck && pnpm test`
5. Validate with real commands before push
6. Ensure browser QA for UI changes
7. Ensure mobile QA for shell/modal/panel changes

### Key Constraints
- Do not commit live user data to `project/project.json`
- Preserve `/var/lib/sbuild` in production environments
- Maintain editor/preview CSS isolation
- Keep mobile usability intact

---

## License

See repository for license details.

---

## Support & Issues

- Issues: [GitHub Issues](https://github.com/GurthBro0ks/sbuild/issues)
- Discussions: [GitHub Discussions](https://github.com/GurthBro0ks/sbuild/discussions)
