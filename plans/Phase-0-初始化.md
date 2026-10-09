# Phase 0：项目初始化 — 执行计划

## 目标

建立可运行的 dsh-feishu 项目骨架，安装后能在 DSH 设置页看到入口。

## 前置依赖

- Node.js ≥ 20.3.0
- pnpm ≥ 9
- DSH 已安装并正常运行
- GitHub 账号（用于创建仓库）

---

## 步骤 1：创建 GitHub 仓库

**操作**：
1. 登录 [GitHub](https://github.com)
2. 点击右上角 `+` → `New repository`
3. 填写：
   - **Repository name**：`dsh-feishu`
   - **Description**：`飞书云盘、云文档、多维表格 DSH 插件`
   - **Visibility**：Public
   - **Initialize**：勾选 Add a README file（**不要**勾选 .gitignore，pnpm 项目需要自己配置）
4. 点击 `Create repository`

**输出**：仓库 URL（`https://github.com/<username>/dsh-feishu`）

---

## 步骤 2：克隆到本地

```bash
git clone https://github.com/<username>/dsh-feishu.git
cd dsh-feishu
```

---

## 步骤 3：初始化 pnpm 项目

```bash
# 初始化 package.json
pnpm init

# 关键字段配置（直接编辑 package.json 或用命令行）
# 参考 docs/03-技术架构.md 29.2 节
```

**最终 `package.json` 关键字段**：

```json
{
  "name": "dsh-feishu",
  "version": "0.0.1",
  "description": "飞书云盘、云文档、多维表格 DSH 插件",
  "type": "module",
  "main": "./lib/index.js",
  "exports": {
    ".": {
      "types": "./lib/types/index.d.ts",
      "default": "./lib/index.js"
    },
    "./client": {
      "types": "./lib/types/client/index.d.ts",
      "default": "./lib/client.js"
    }
  },
  "dsh": {
    "client": {
      "platform": "web",
      "inject": ["@deepseek-ai/dsh-client-ui-settings-plugins"]
    }
  },
  "engines": {
    "node": ">=20.3.0"
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "lint": "eslint src --fix",
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "tsdown": "^0.8.0",
    "vitest": "^1.4.0"
  },
  "dependencies": {
    "@larksuiteoapi/node-sdk": "^1.4.0",
    "@deepseek-ai/cordis": "workspace:*",
    "@deepseek-ai/schemastery": "workspace:*"
  }
}
```

---

## 步骤 4：安装依赖

```bash
pnpm install
```

**注意**：`workspace:*` 依赖表示从 DSH 本身解析，需要 DSH 已安装。如果 workspace 解析失败，先跳过 cordis/schemastery，直接写固定版本：

```bash
pnpm add @larksuiteoapi/node-sdk
pnpm add -D @deepseek-ai/cordis @deepseek-ai/schemastery
# 如果 workspace 协议不支持，用固定版本：
# pnpm add @deepseek-ai/cordis@0.2.0-rc.2
```

---

## 步骤 5：创建 tsdown.config.ts

```typescript
// tsdown.config.ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entryPoints: ['src/index.ts', 'src/client/index.ts'],
  outDir: 'lib',
  dts: true,
  splitting: false,
  clean: true,
  platform: 'node',
  treeshake: true,
})
```

---

## 步骤 6：创建 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "lib",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "lib", "dist"]
}
```

---

## 步骤 7：创建 cordis.yml

```yaml
# cordis.yml
name: dsh-feishu
version: 0.0.1
description: 飞书云盘、云文档、多维表格 DSH 插件
license: MIT
homepage: https://github.com/<username>/dsh-feishu
repository:
  type: git
  url: https://github.com/<username>/dsh-feishu
```

---

## 步骤 8：创建最小 src/index.ts

```typescript
// src/index.ts
import type { Context } from '@deepseek-ai/cordis'
import { Schema } from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'

export const FEISHU_NS = settingsNamespace('dsh-feishu')

export interface Config {
  appId: string
  appSecret: string
}

export const Config: Schema<Config> = Schema.object({
  appId:     Schema.string(),
  appSecret: Schema.string().role('secret'),
})

export function apply(ctx: Context, config: Config) {
  // 注册 settings card
  installSettingsSection(ctx, FEISHU_NS, Config, config, {
    setSource: (current) => { /* noop */ },
    onChange: () => { /* noop */ },
  })

  // 注册一个 dummy tool 验证 host tools 可用
  ctx.tools.register(
    {
      name: 'feishu_hello',
      description: '测试飞书连接',
      parameters: Schema.object({}),
      execute: async () => {
        return { message: 'Hello from dsh-feishu!', appId: config.appId }
      },
    },
    { namespace: 'feishu' }
  )
}
```

---

## 步骤 9：创建 src/client/index.ts

```typescript
// src/client/index.ts
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

export const inject = ['slots', 'locale', 'settingsScope']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('settings.plugin.item', () =>
    ctx.slots.register({
      name: 'settings.plugin.item',
      key: 'dsh-feishu',
      locale: 'settings.dshFeishu',
      inject: () => ({ type: 'div', children: '飞书插件（加载中...）' }),
    }, null)
  )
}
```

---

## 步骤 10：构建并测试安装

```bash
# 构建
pnpm build

# 检查产物
ls lib/

# 打包
pnpm pack

# 本地安装
dsh plugin add ./dsh-feishu-0.0.1.tgz

# 重启 DSH，打开设置页 → 插件 → 找到 dsh-feishu
```

---

## ⚠️ Phase 0 必须同时解决的 P0 安全问题

> 以下 6 个 P0 问题在 Phase 0 骨架搭建时必须一并解决，不得拖到 Phase 1。
> 审查来源：docs/06-审查报告.md

### P0-1：appSecret 不走工具入参，从 credentials 运行时读取

```typescript
// ❌ 错误（appSecret 会进工具日志）
execute: async ({ appId, appSecret }) => { ... }

// ✅ 正确（appSecret 从 credentials 动态获取，不进日志）
execute: async ({ appId }, ctx) => {
  const appSecret = await ctx.credentials.get('dsh-feishu.appSecret')
  if (!appSecret) throw new Error('请先在设置页填写 App Secret')
}
```

### P0-2：Client 单例改为 Map<profileId, Client>

```typescript
// ❌ 错误（多 Profile 串号）
let _client: Client | null = null

// ✅ 正确（每个 Profile 独立实例）
const _clients = new Map<string, Client>()
export function getFeishuClient(ctx: Context, config: FeishuConfig): Client {
  const key = ctx.profile.id
  if (!_clients.has(key)) { _clients.set(key, new Client({ ... })) }
  return _clients.get(key)!
}
```

### P0-3：tsdown.config.ts 用标准 API

> ✅ Phase-0 计划已使用标准 tsdown API，此项已确认正确，无需修改。

### P0-4：host tools execute 闭包不捕获 config

```typescript
// ❌ 错误（config 是 apply() 时的快照）
execute: async () => {
  const token = await getToken(config.appSecret)  // 旧值
}

// ✅ 正确（每次执行时动态获取最新 credentials）
execute: async (_, ctx) => {
  const appSecret = await ctx.credentials.get('dsh-feishu.appSecret')
  const freshConfig = await ctx.settings.get('dsh-feishu')
}
```

### P0-5：localPath / savePath 必须加白名单验证

```typescript
const ALLOWED_ROOTS = [DSH_HOME, DSH_DATA]  // 只允许读写 DSH 工作区

function validatePath(p: string): boolean {
  const r = path.resolve(p)
  return ALLOWED_ROOTS.some(root => r.startsWith(path.resolve(root)))
}
```

### P0-6：QPS 5 全局 RateLimiter（即使是 dummy 骨架也要留好接口）

```typescript
// src/lib/rateLimit.ts（Phase 0 至少写好框架，Phase 1 实现逻辑）
class RateLimiter {
  async acquire(): Promise<void> {
    // TODO: 实现令牌桶（5 QPS）
    // Phase 1 前可空实现，但接口要保留
  }
}
export const rateLimiter = new RateLimiter()
```

---

## 验收标准

- [ ] `pnpm build` 成功，无报错
- [ ] `lib/` 目录生成了 `index.js` + `index.d.ts` + `client/index.js`
- [ ] `dsh plugin add ./dsh-feishu-*.tgz` 成功
- [ ] DSH 设置页 → 插件 出现 `dsh-feishu` 入口
- [ ] 点击入口显示卡片（哪怕是空白或 Hello 字样）
- [ ] Agent 对话中可调用 `feishu_hello` 工具
- [ ] P0-1~P0-6 的代码框架已嵌入骨架（即使功能 stub）

---

## GitHub 安全协作配置（Phase 0 一起配置）

创建仓库后立即在 GitHub → Settings → Branches → Add rule：

```
Pattern: main
☑ Require a pull request before merging
☑ Require at least 1 approving review
☑ Do not allow bypassing
```

创建 `.github/CODEOWNERS`：
```
* @your-github-username
```

创建 `.github/pull_request_template.md`：
```markdown
## 变更说明
（请描述你改了什么、为什么改、如何测试）

## 自检清单
- [ ] pnpm build 通过
- [ ] pnpm lint 无新增问题
- [ ] 新功能有测试
```

---

## 踩坑记录

> 本节由执行者在开发过程中实时填写。

| 日期 | 问题 | 解决方案 |
|------|------|---------|
| | | |
