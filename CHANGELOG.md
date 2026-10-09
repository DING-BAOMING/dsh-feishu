# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2024-XX-XX

### Added

- Initial skeleton release
- Phase 0 scaffolding: project structure, tsdown config, CI workflow
- P0 security framework embedded:
  - `Map<profileId, Client>` multi-profile isolation
  - `RateLimiter` (5 QPS) for API rate protection
  - `pathGuard` for allowed-path validation
  - `ctx.credentials.get()` dynamic secret reading
- Basic unit tests for `pathGuard`, `rateLimiter`, `client` isolation
- GitHub Actions CI workflow
- Branch protection + CODEOWNERS configured
- MIT License

### Planned (v1.0.0)

- Cloud Drive: upload / download / list / delete files
- Cloud Documents: create / write / read / delete docs
- Bitable: create / CRUD records
- Settings Card UI (Drive / Docx / Bitable tabs)
- Multipart upload for files > 20MB
