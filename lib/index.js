var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/pathGuard.ts
var pathGuard_exports = {};
__export(pathGuard_exports, {
  isPathAllowed: () => isPathAllowed,
  safeReadFile: () => safeReadFile,
  safeWriteFile: () => safeWriteFile
});
import path from "path";
function normalize(p) {
  return path.normalize(path.resolve(p));
}
function isPathAllowed(filePath) {
  const resolved = normalize(filePath);
  return ALLOWED_ROOTS.some((root) => resolved.startsWith(normalize(root)));
}
function safeReadFile(filePath) {
  if (!isPathAllowed(filePath)) {
    const err = new Error(`\u8DEF\u5F84\u4E0D\u5728\u5141\u8BB8\u8303\u56F4\u5185: ${filePath}`);
    err.name = "PATH_FORBIDDEN";
    throw err;
  }
  const fs = __require("fs");
  return fs.readFileSync(filePath);
}
function safeWriteFile(filePath, data) {
  if (!isPathAllowed(filePath)) {
    const err = new Error(`\u8DEF\u5F84\u4E0D\u5728\u5141\u8BB8\u8303\u56F4\u5185: ${filePath}`);
    err.name = "PATH_FORBIDDEN";
    throw err;
  }
  const fs = __require("fs");
  fs.writeFileSync(filePath, data);
}
var ALLOWED_ROOTS;
var init_pathGuard = __esm({
  "src/lib/pathGuard.ts"() {
    "use strict";
    ALLOWED_ROOTS = [
      // DSH 默认数据目录
      process.env.DSH_HOME ?? path.join(process.env.HOME ?? "C:\\", ".dsh"),
      // 临时目录
      process.env.TMP ?? process.env.TEMP ?? "/tmp",
      // 用户文档目录（fallback）
      process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "Documents") : path.join(process.env.HOME ?? "", "Documents")
    ];
  }
});

// src/index.ts
import z from "@deepseek-ai/schemastery";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";

// src/lib/client.ts
import { Client, LoggerLevel } from "@larksuiteoapi/node-sdk";
var _clients = /* @__PURE__ */ new Map();
function getFeishuClient(profileId, config) {
  if (!_clients.has(profileId)) {
    const client = new Client({
      appId: config.appId,
      appSecret: config.appSecret,
      loggerLevel: LoggerLevel.error
      // ⚠️ P0 安全：只用 error 级别，不打请求/响应体
    });
    _clients.set(profileId, client);
  }
  return _clients.get(profileId);
}
function resetClientForProfile(profileId) {
  _clients.delete(profileId);
}
function isValidAppId(appId) {
  return appId.startsWith("cli_") && appId.length >= 18;
}

// src/lib/rateLimit.ts
var QPS_LIMIT = 5;
var REFILL_INTERVAL_MS = 200;
var RateLimiter = class {
  tokens = QPS_LIMIT;
  lastRefillMs = Date.now();
  queue = [];
  /**
   * 获取一个令牌（等待可用）
   * 调用方需 await此方法后再发 API 请求
   */
  async acquire() {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
      setTimeout(() => {
        this.refill();
        if (this.tokens > 0) {
          this.tokens--;
          const next = this.queue.shift();
          if (next) next();
          resolve();
        } else {
          this.queue.push(resolve);
        }
      }, REFILL_INTERVAL_MS);
    });
  }
  /** 补充令牌 */
  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefillMs;
    const refillCount = Math.floor(elapsed / REFILL_INTERVAL_MS);
    if (refillCount > 0) {
      this.tokens = Math.min(QPS_LIMIT, this.tokens + refillCount);
      this.lastRefillMs = now;
    }
  }
  /** 返回当前可用令牌数（调试用） */
  available() {
    this.refill();
    return this.tokens;
  }
};
var rateLimiter = new RateLimiter();

// src/lib/errors.ts
var FeishuApiError = class extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = "FeishuApiError";
  }
  code;
  statusCode;
};
function wrapFeishuError(e, defaultMsg) {
  if (e instanceof FeishuApiError) return e;
  if (e && typeof e === "object" && "code" in e) {
    const code = String(e.code);
    const msg = e.msg;
    if (code === "99991401") return new FeishuApiError("App Secret \u9519\u8BEF\u6216\u5E94\u7528\u4E0D\u5B58\u5728", code);
    if (code === "99991664") return new FeishuApiError("\u6743\u9650\u4E0D\u8DB3\uFF0C\u8BF7\u68C0\u67E5\u5E94\u7528\u662F\u5426\u5F00\u901A\u4E86\u5BF9\u5E94\u6743\u9650", code);
    if (code === "230013") return new FeishuApiError("\u6587\u4EF6\u8D85\u8FC7 20MB \u9650\u5236", code);
    if (code === "230001") return new FeishuApiError("\u8BF7\u6C42\u9891\u7387\u8D85\u9650\uFF085 QPS\uFF09\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", code);
    if (code === "99991403") return new FeishuApiError("tenant_access_token \u5DF2\u8FC7\u671F\uFF0C\u8BF7\u5237\u65B0", code);
    return new FeishuApiError(msg ?? defaultMsg, code);
  }
  return new FeishuApiError(defaultMsg, "UNKNOWN");
}

// src/index.ts
var FEISHU_NS = settingsNamespace("dsh-feishu");
var Config = z.object({
  appId: z.string(),
  appSecret: z.string().role("secret"),
  driveFolderToken: z.string().optional(),
  docxFolderToken: z.string().optional(),
  bitableFolderToken: z.string().optional(),
  uploadTimeout: z.number().min(5e3).max(3e5).default(6e4),
  maxFileSize: z.number().min(1).max(20).default(20),
  locale: z.enum(["zh-CN", "en"]).default("zh-CN")
});
function apply(ctx, config) {
  installSettingsSection(ctx, FEISHU_NS, Config, config, {
    setSource: () => {
    },
    validate: (value) => {
      if (value.appId && !isValidAppId(value.appId)) throw new Error("App ID must start with cli_");
    },
    onChange: () => {
      const pid = ctx.profile?.id ?? "default";
      resetClientForProfile(pid);
    }
  });
  ctx.registry.global.set("tool:feishu_hello", {
    name: "feishu_hello",
    description: "Test if dsh-feishu is loaded",
    parameters: z.object({}),
    execute: async () => ({ message: "dsh-feishu loaded!", appId: config.appId ?? "(not configured)" })
  });
  ctx.registry.global.set("tool:feishu_verify_connection", {
    name: "feishu_verify_connection",
    description: "Verify Feishu app connection",
    parameters: z.object({ appId: z.string() }),
    execute: async ({ appId }) => {
      const creds = ctx;
      const appSecret = await creds.credentials?.get("dsh-feishu.appSecret") ?? "";
      if (!appSecret) return { success: false, message: "Configure App Secret in settings" };
      const pid = ctx.profile?.id ?? "default";
      const client = getFeishuClient(pid, { appId, appSecret });
      try {
        await rateLimiter.acquire();
        const r = await client.request?.({
          method: "GET",
          url: "/drive/v1/files",
          params: { page_size: 1 }
        });
        if (r?.code !== 0) return { success: false, message: `Failed, code: ${r?.code}` };
        return { success: true, message: "Connection successful", userName: appId };
      } catch (e) {
        return { success: false, message: wrapFeishuError(e, "Connection failed").message };
      }
    }
  });
  ctx.registry.global.set("tool:feishu_list_files", {
    name: "feishu_list_files",
    description: "List files in Feishu cloud drive",
    parameters: z.object({
      folderToken: z.string().optional(),
      pageSize: z.number().default(50),
      pageToken: z.string().optional()
    }),
    execute: async ({ folderToken, pageSize = 50, pageToken }) => {
      const creds = ctx;
      const appSecret = await creds.credentials?.get("dsh-feishu.appSecret") ?? "";
      const pid = ctx.profile?.id ?? "default";
      const client = getFeishuClient(pid, { appId: config.appId ?? "", appSecret });
      await rateLimiter.acquire();
      const r = await client.request?.({
        method: "GET",
        url: "/drive/v1/files",
        params: { folder_token: folderToken ?? "", page_size: String(pageSize), ...pageToken ? { page_token: pageToken } : {} }
      });
      if (r?.code !== 0) throw wrapFeishuError(r, "Failed to list files");
      return { files: r?.data?.files ?? [], hasMore: r?.data?.has_more ?? false, pageToken: r?.data?.page_token };
    }
  });
  ctx.registry.global.set("tool:feishu_upload_file", {
    name: "feishu_upload_file",
    description: "Upload file to Feishu cloud drive (max 20MB)",
    parameters: z.object({ localPath: z.string(), folderToken: z.string().optional() }),
    execute: async ({ localPath, folderToken }) => {
      const creds = ctx;
      const appSecret = await creds.credentials?.get("dsh-feishu.appSecret") ?? "";
      const pid = ctx.profile?.id ?? "default";
      const client = getFeishuClient(pid, { appId: config.appId ?? "", appSecret });
      const { safeReadFile: safeReadFile2 } = await Promise.resolve().then(() => (init_pathGuard(), pathGuard_exports));
      const buf = safeReadFile2(localPath);
      const sz = buf.length;
      if (sz > (config.maxFileSize ?? 20) * 1024 * 1024) throw new FeishuApiError(`File exceeds ${config.maxFileSize ?? 20}MB`, "230013");
      await rateLimiter.acquire();
      const r = await client.request?.({
        method: "POST",
        url: "/drive/v1/upload_all",
        data: { file_name: localPath.split(/[/\\]/).pop() ?? "file", parent_type: "explorer", parent_node: folderToken ?? "", size: String(sz) }
      });
      if (r?.code !== 0 || !r?.data?.file_token) throw wrapFeishuError(r, "Upload failed");
      return { success: true, fileToken: r.data.file_token, fileName: localPath.split(/[/\\]/).pop() ?? "file", size: sz };
    }
  });
  ctx.registry.global.set("tool:feishu_delete_file", {
    name: "feishu_delete_file",
    description: "Delete file from Feishu cloud drive",
    parameters: z.object({ fileToken: z.string() }),
    execute: async ({ fileToken }) => {
      const creds = ctx;
      const appSecret = await creds.credentials?.get("dsh-feishu.appSecret") ?? "";
      const pid = ctx.profile?.id ?? "default";
      const client = getFeishuClient(pid, { appId: config.appId ?? "", appSecret });
      await rateLimiter.acquire();
      const r = await client.request?.({
        method: "DELETE",
        url: `/drive/v1/files/${fileToken}`
      });
      if (r?.code !== 0) throw wrapFeishuError(r, "Delete failed");
      return { success: true };
    }
  });
}
export {
  Config,
  FEISHU_NS,
  apply
};
