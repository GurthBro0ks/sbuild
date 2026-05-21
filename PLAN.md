# sBuild Prototype Plan

This prototype provides a local-first website builder with:
- JSON project schema in `project/project.json`
- React editor UI (`packages/editor`)
- Express API + static generator (`packages/server`)
- Shared TypeScript schema (`packages/shared`)
- CLI entrypoint (`packages/cli`)

The first goal is a working vertical slice with deterministic AI fallbacks, safe publish dry-runs, and a smoke script.
