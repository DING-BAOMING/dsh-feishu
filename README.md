# dsh-feishu-cloud

Feishu (Lark) cloud drive, documents, and bitable plugin for DeepSeek Harness.

[![CI](https://github.com/DING-BAOMING/dsh-feishu/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DING-BAOMING/dsh-feishu/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.3.0-brightgreen)](https://nodejs.org/)

## Features

| Module | Features |
|--------|----------|
| **Cloud Drive (drive)** | Upload / Download / List / Delete files, show storage quota |
| **Cloud Documents (docx)** | Create / Write / Read / Delete documents |
| **Bitable** | Create bitable, CRUD records |

## Requirements

- DeepSeek Harness (DSH)
- Node.js >= 20.3.0
- Feishu self-built app (personal or enterprise)

## Quick Install

```bash
# From npm (after publish)
dsh plugin add dsh-feishu-cloud

# From local tgz
dsh plugin add ./dsh-feishu-cloud-*.tgz
```

## Feishu App Setup

1. Open [Feishu Open Platform](https://open.feishu.cn/app) — create a self-built app
2. Enable permissions (as needed):
   - `drive:file` — cloud drive read/write
   - `docx:document` — cloud documents read/write
   - `bitable:app` — bitable read/write
3. Get **App ID** and **App Secret** from Credentials page
4. In DSH Settings — Feishu Connection — paste credentials and click Verify

> Personal edition: permissions are self-approved. Enterprise edition: requires admin approval.

## Development

```bash
npm install          # Install dependencies
npm run build        # Build (tsup)
npm run test         # Run unit tests
npm run lint:check  # ESLint check
npm run typecheck   # TypeScript check
npm run dev         # Watch mode
```

## Security Design

| Mechanism | Description |
|-----------|-------------|
| `appSecret` | Stored via `ctx.credentials` — never in logs or config |
| Multi-profile | `Map<profileId, Client>` — profiles are isolated |
| Path allowlist | Only DSH working directory accessible |
| QPS rate limit | Token bucket, 5 QPS max |

## Project Structure

```
dsh-feishu-cloud/
  src/
    index.ts           # Plugin entry: registers 18 host tools + settings card
    client/
      index.ts        # Settings Card UI (React, injected via slots)
    lib/
      client.ts       # FeishuClient factory (multi-profile)
      rateLimit.ts    # Token-bucket rate limiter
      pathGuard.ts    # Path traversal prevention
      errors.ts       # Unified error handling
      types.ts        # Shared types
      apiTypes.ts     # API response types
  lib/                # Built output
  tests/unit/         # Unit tests (vitest)
  docs/               # Full design docs
  package.json
  tsup.config.ts
  cordis.patch.yml    # Plugin discovery patch
```

## Docs

| Topic | Doc |
|-------|-----|
| Project overview | [docs/00-项目总览.md](./docs/00-项目总览.md) |
| API specifications | [docs/01-功能规格.md](./docs/01-功能规格.md) |
| UI design | [docs/02-UI设计.md](./docs/02-UI设计.md) |
| Architecture | [docs/03-技术架构.md](./docs/03-技术架构.md) |
| Development plan | [docs/04-开发计划.md](./docs/04-开发计划.md) |
| Release plan | [docs/05-发布计划.md](./docs/05-发布计划.md) |
| Review report | [docs/06-审查报告.md](./docs/06-审查报告.md) |
| Comprehensive evaluation | [docs/07-综合评估.md](./docs/07-综合评估.md) |

## Contributing

PRs welcome! Please ensure:
- `npm run build` passes
- `npm run test` passes (27 unit tests)
- `npm run lint:check` passes (0 errors)
- `npm run typecheck` passes

## License

MIT — see [LICENSE](./LICENSE)
