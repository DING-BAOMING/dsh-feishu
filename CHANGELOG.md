# Changelog

All notable changes to this project will be documented in this file.

## [0.0.2] - 2026-10-10

### Added
- Settings Card UI (Phase 2): credentials input (App ID / App Secret), connection verify button, storage quota bar, setup tutorial accordion
- 18 host tools: drive (6) + docx (6) + bitable (6)
- `@ts-nocheck` on client entry (DSH web shell provides React types at runtime)
- `dist-client` output via tsup for DSH client module loading

### Changed
- Package renamed from `dsh-feishu` (taken on npm) to `dsh-feishu-cloud`
- `dsh.client.inject` array removed (settings section registered via `ctx.slots` in client entry)

### Fixed
- `@deepseek-ai/dsh-settings` moved from `devDependencies` to `dependencies` (runtime import)
- Duplicate `export function apply` / `export { apply }` conflict resolved
- `cordis.patch.yml` added to package `files` array

## [0.0.1] - 2026-10-09

### Added
- Initial skeleton: `src/index.ts` with Phase 0 placeholder
- `tsup.config.ts` build configuration
- `cordis.patch.yml` plugin discovery patch
