# dsh-feishu — 飞书 DSH 插件

> 让 DeepSeek Harness 直接读写飞书云盘、云文档和多维表格

[![CI](https://github.com/DING-BAOMING/dsh-feishu/actions/workflows/ci.yml/badge.svg)](https://github.com/DING-BAOMING/dsh-feishu/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.3.0-brightgreen)](https://nodejs.org/)

## 功能特性

| 模块 | 功能 |
|------|------|
| **云盘（drive）** | 上传 / 下载 / 列出 / 删除文件，显示云盘容量 |
| **云文档（docx）** | 创建 / 写入 / 读取 / 删除文档 |
| **多维表格（bitable）** | 创建多维表格，CRUD 记录 |

> v1.0 完成基础 CRUD；v1.1 支持 >20MB 分卷上传

## 系统要求

- DeepSeek Harness (DSH)
- Node.js ≥ 20.3.0
- 飞书自建应用（个人版 / 企业版均可）

## 快速安装

```bash
# 从 npm 安装（发布后）
dsh plugin add dsh-feishu

# 或从源码安装
git clone https://github.com/DING-BAOMING/dsh-feishu.git
cd dsh-feishu
pnpm install && pnpm build
dsh plugin add ./dsh-feishu-*.tgz
```

## 飞书应用配置

1. 打开 [飞书开放平台](https://open.feishu.cn/app) → 创建自建应用
2. 开通权限（按需开通）：
   - `drive:file` — 云盘读写
   - `docx:document` — 云文档读写
   - `bitable:app` — 多维表格读写
3. 获取 **App ID**（`cli_` 开头）和 **App Secret**
4. 在 DSH 设置页 → 飞书插件 → 填入凭证 → 验证连接

> 个人版：权限自批；企业版：需管理员审批

## 开发

```bash
pnpm install          # 安装依赖
pnpm build            # 构建
pnpm test             # 单元测试
pnpm lint            # ESLint 检查
pnpm dev             # 开发模式（热重载）
```

## 安全设计

| 机制 | 说明 |
|------|------|
| `appSecret` | 通过 `role('secret')` + `ctx.credentials.get()`，永不进日志/配置 |
| 多账号隔离 | `Map<profileId, Client>`，多 Profile 不串号 |
| 路径白名单 | 只能读写 DSH 工作区，禁止任意文件访问 |
| QPS 限流 | 令牌桶保护，5 QPS 内 |
| CI 密钥扫描 | GitHub Actions 自动检查代码中是否有硬编码密钥 |

## 项目结构

```
dsh-feishu/
├── src/
│   ├── index.ts          # Host 入口：注册 tools + settings card
│   ├── client/          # Settings Card UI（Phase 2+）
│   └── lib/            # 核心库
│       ├── client.ts     # FeishuClient 管理（多 Profile 隔离）
│       ├── rateLimit.ts  # QPS 令牌桶
│       ├── pathGuard.ts  # 路径白名单验证
│       ├── errors.ts     # 统一错误处理
│       └── types.ts      # 共享类型
├── tests/
│   └── unit/           # 单元测试
├── docs/               # 完整设计文档（中文）
├── package.json
└── tsdown.config.ts
```

## 文档导航

| 你想了解 | 文档 |
|---------|------|
| 功能规划 / 技术选型 | [docs/00-项目总览.md](./docs/00-项目总览.md) |
| API 详细规格 | [docs/01-功能规格.md](./docs/01-功能规格.md) |
| UI 设计稿 | [docs/02-UI设计.md](./docs/02-UI设计.md) |
| 架构设计 | [docs/03-技术架构.md](./docs/03-技术架构.md) |
| 开发计划 | [docs/04-开发计划.md](./docs/04-开发计划.md) |
| 发布计划 | [docs/05-发布计划.md](./docs/05-发布计划.md) |
| 审查报告 | [docs/06-审查报告.md](./docs/06-审查报告.md) |
| 综合评估 | [docs/07-综合评估.md](./docs/07-综合评估.md) |

## 贡献

欢迎提交 Issue 和 Pull Request！

提交 PR 前请确保：
- `pnpm build` 通过
- `pnpm test` 通过
- PR 包含单元测试
- 不包含任何密钥或凭证

## 许可证

MIT — 详见 [LICENSE](./LICENSE)

---

## 状态看板

| 版本 | 状态 | 说明 |
|------|------|------|
| v0.0.1 | 🔨 开发中 | Phase 0 骨架，P0 安全框架已嵌入 |
| v1.0.0 | 📋 规划中 | 云盘 / 云文档 / 多维表格 基础功能 |
| v1.1.0 | 📋 规划中 | 分卷上传（>20MB）/ 云文档富文本 |
