// src/index.ts
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";

// src/lib/client.ts
import * as lark from "@larksuiteoapi/node-sdk";
var _clients = /* @__PURE__ */ new Map();
function getFeishuClient(profileId, config) {
  if (!_clients.has(profileId)) {
    const client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      loggerLevel: lark.LoggerLevel.error
    });
    _clients.set(profileId, client);
  }
  return _clients.get(profileId);
}
function resetClientForProfile(profileId) {
  _clients.delete(profileId);
}

// src/lib/rateLimit.ts
var QPS_LIMIT = 5;
var REFILL_INTERVAL_MS = 200;
var MAX_QUEUE_SIZE = 1e3;
var RateLimiter = class {
  tokens = QPS_LIMIT;
  lastRefillMs = Date.now();
  queue = [];
  /**
   * 获取一个令牌（等待可用）
   * 调用方需 await 此方法后再发 API 请求
   * @throws Error 如果队列已满（超过 MAX_QUEUE_SIZE）
   */
  async acquire() {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      throw new Error(`RateLimiter queue overflow: ${MAX_QUEUE_SIZE} requests pending`);
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
        } else if (this.queue.length > 0) {
          this.queue.shift()?.();
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
  /** 返回队列长度（调试用） */
  pending() {
    return this.queue.length;
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
var ERROR_CODE_MAP = {
  // 认证错误
  "99991401": "App Secret \u9519\u8BEF\u6216\u5E94\u7528\u4E0D\u5B58\u5728\uFF0C\u8BF7\u68C0\u67E5\u914D\u7F6E",
  "99991403": "tenant_access_token \u5DF2\u8FC7\u671F\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5",
  "99991411": "app_access_token \u8FC7\u671F\uFF0C\u8BF7\u5237\u65B0",
  "99991400": "\u8BF7\u6C42\u53C2\u6570\u9519\u8BEF",
  // 权限错误
  "99991664": "\u6743\u9650\u4E0D\u8DB3\uFF0C\u8BF7\u68C0\u67E5\u5E94\u7528\u662F\u5426\u5F00\u901A\u4E86\u5BF9\u5E94\u6743\u9650",
  "99991661": "\u5E94\u7528\u672A\u5B89\u88C5\u6216\u5DF2\u88AB\u7981\u7528",
  // 资源错误
  "230001": "\u8BF7\u6C42\u9891\u7387\u8D85\u9650\uFF085 QPS\uFF09\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5",
  "230002": "\u6587\u4EF6\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664",
  "230003": "\u6587\u4EF6\u540D\u65E0\u6548\u6216\u5305\u542B\u975E\u6CD5\u5B57\u7B26",
  "230004": "\u4E0D\u652F\u6301\u7684\u6587\u4EF6\u683C\u5F0F",
  "230005": "\u6587\u4EF6\u6570\u91CF\u8D85\u51FA\u9650\u5236",
  "230013": "\u6587\u4EF6\u8D85\u8FC7 20MB \u9650\u5236",
  "230014": "\u6587\u4EF6\u5939\u5BB9\u91CF\u8D85\u51FA\u9650\u5236",
  "230020": "\u4E91\u76D8\u7A7A\u95F4\u4E0D\u8DB3",
  // 文档错误
  "130001": "\u6587\u6863\u4E0D\u5B58\u5728\u6216\u65E0\u8BBF\u95EE\u6743\u9650",
  "130002": "\u6587\u6863\u5DF2\u88AB\u5220\u9664",
  "130003": "\u7981\u6B62\u8BBF\u95EE\u6B64\u6587\u6863",
  "130004": "\u6587\u6863\u6807\u9898\u65E0\u6548",
  // 多维表格错误
  "150001": "\u591A\u7EF4\u8868\u683C\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u8BBF\u95EE",
  "150002": "\u6570\u636E\u8868\u4E0D\u5B58\u5728",
  "150003": "\u8BB0\u5F55\u4E0D\u5B58\u5728\u6216\u5DF2\u5220\u9664",
  "150004": "\u5B57\u6BB5\u6570\u91CF\u8D85\u51FA\u9650\u5236",
  "150005": "\u8BB0\u5F55\u6570\u91CF\u8D85\u51FA\u9650\u5236",
  // 通用错误
  "99991660": "\u8BF7\u6C42\u5185\u5BB9\u8FC7\u957F",
  "99991663": "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF"
};
function wrapFeishuError(e, defaultMsg) {
  if (e instanceof FeishuApiError) return e;
  if (e && typeof e === "object") {
    const obj = e;
    const code = obj.code != null ? String(obj.code) : "UNKNOWN";
    const msg = typeof obj.msg === "string" ? obj.msg : typeof obj.message === "string" ? obj.message : void 0;
    const mapped = ERROR_CODE_MAP[code];
    if (mapped) return new FeishuApiError(mapped, code);
    return new FeishuApiError(msg ?? defaultMsg, code);
  }
  if (e instanceof Error) {
    return new FeishuApiError(e.message, "UNKNOWN");
  }
  return new FeishuApiError(defaultMsg, "UNKNOWN");
}
function isPathError(e) {
  return e instanceof Error && e.name === "PATH_FORBIDDEN";
}

// src/lib/pathGuard.ts
import path from "path";
import { readFileSync, writeFileSync } from "fs";
var ALLOWED_ROOTS = [
  // DSH 默认数据目录
  process.env.DSH_HOME ?? path.join(process.env.HOME ?? "C:\\", ".dsh"),
  // 临时目录
  process.env.TMP ?? process.env.TEMP ?? "/tmp",
  // 用户文档目录（fallback）
  process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "Documents") : path.join(process.env.HOME ?? "", "Documents")
];
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
  return readFileSync(filePath);
}

// src/index.ts
import * as Zod from "zod";
var FEISHU_NS = settingsNamespace("dsh-feishu");
var configSchema = Zod.object({
  appId: Zod.string(),
  appSecret: Zod.string(),
  driveFolderToken: Zod.string().optional(),
  docxFolderToken: Zod.string().optional(),
  bitableFolderToken: Zod.string().optional(),
  uploadTimeout: Zod.number().min(5e3).max(3e5).default(6e4),
  maxFileSize: Zod.number().min(1).max(20).default(20),
  locale: Zod.enum(["zh-CN", "en"]).default("zh-CN")
});
async function getAppSecret(ctx) {
  try {
    const creds = ctx;
    return await creds.credentials?.get("dsh-feishu.appSecret") ?? "";
  } catch {
    return "";
  }
}
function getProfileId(ctx) {
  return ctx.profile?.id ?? "default";
}
function sdk(client) {
  return client;
}
function registerTool(ctx, tool) {
  ;
  ctx.registry.global.set(`tool:${tool.name}`, {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: async (params) => tool.execute(params, ctx)
  });
}
function apply(ctx, config) {
  installSettingsSection(ctx, FEISHU_NS, configSchema, config, {
    setSource: () => {
    },
    validate: () => {
    },
    onChange: () => {
      resetClientForProfile(getProfileId(ctx));
    }
  });
  registerTool(ctx, {
    name: "feishu_verify_connection",
    description: "\u9A8C\u8BC1\u98DE\u4E66\u5E94\u7528\u8FDE\u63A5\u72B6\u6001",
    parameters: Zod.object({}),
    execute: async () => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.drive.file.list({
        params: { folder_token: "", page_size: 1 }
      });
      if (r.code !== 0) throw wrapFeishuError(r, "\u9A8C\u8BC1\u8FDE\u63A5\u5931\u8D25");
      return { success: true, message: "\u98DE\u4E66\u5E94\u7528\u8FDE\u63A5\u6B63\u5E38" };
    }
  });
  registerTool(ctx, {
    name: "feishu_list_files",
    description: "\u5217\u51FA\u98DE\u4E66\u4E91\u76D8\u6587\u4EF6\u5939\u4E2D\u7684\u6587\u4EF6",
    parameters: Zod.object({
      folderToken: Zod.string().optional(),
      pageSize: Zod.number().min(1).max(200).default(50).optional(),
      pageToken: Zod.string().optional()
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.drive.file.list({
        params: {
          folder_token: params.folderToken ?? config.driveFolderToken ?? "",
          page_size: Number(params.pageSize) || 50,
          page_token: params.pageToken
        }
      });
      if (r.code !== 0) throw wrapFeishuError(r, "\u83B7\u53D6\u6587\u4EF6\u5217\u8868\u5931\u8D25");
      const rawFiles = r.data?.files ?? [];
      const files = rawFiles.map((f) => {
        const rf = f;
        return {
          token: rf.token ?? rf.file_token ?? "",
          name: rf.name ?? "",
          size: rf.size ?? 0,
          createdTime: rf.created_time ?? "",
          updatedTime: rf.updated_time ?? "",
          type: rf.type === "folder" ? "folder" : "file",
          mimeType: rf.mime_type
        };
      });
      return { files, hasMore: r.data?.has_more ?? false, pageToken: r.data?.page_token };
    }
  });
  registerTool(ctx, {
    name: "feishu_upload_file",
    description: "\u4E0A\u4F20\u672C\u5730\u6587\u4EF6\u5230\u98DE\u4E66\u4E91\u76D8\uFF08\u6700\u5927 20MB\uFF09",
    parameters: Zod.object({
      localPath: Zod.string(),
      folderToken: Zod.string().optional(),
      fileName: Zod.string().optional()
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const localPath = params.localPath;
      if (!isPathAllowed(localPath)) throw new FeishuApiError(`\u8DEF\u5F84\u4E0D\u5728\u5141\u8BB8\u8303\u56F4\u5185: ${localPath}`, "PATH_FORBIDDEN");
      let buf;
      try {
        buf = safeReadFile(localPath);
      } catch (e) {
        if (isPathError(e)) throw new FeishuApiError(`\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6: ${localPath}`, "PATH_FORBIDDEN");
        throw e;
      }
      const sz = buf.length;
      const maxSize = config.maxFileSize ?? 20;
      if (sz > maxSize * 1024 * 1024) throw new FeishuApiError(`\u6587\u4EF6\u8D85\u8FC7 ${maxSize}MB \u9650\u5236`, "230013");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      const parentFolder = params.folderToken ?? config.driveFolderToken ?? "";
      await rateLimiter.acquire();
      const r = await client.drive.file.uploadAll({
        data: {
          file_name: params.fileName ?? localPath.split(/[/\\]/).pop() ?? "file",
          parent_type: "explorer",
          parent_node: parentFolder,
          size: String(sz)
        }
      });
      if (r.code !== 0 || !r.data?.file_token) throw wrapFeishuError(r, "\u4E0A\u4F20\u6587\u4EF6\u5931\u8D25");
      return { success: true, fileToken: r.data.file_token, fileName: localPath.split(/[/\\]/).pop() ?? "file", size: sz };
    }
  });
  registerTool(ctx, {
    name: "feishu_delete_file",
    description: "\u5220\u9664\u98DE\u4E66\u4E91\u76D8\u4E2D\u7684\u6587\u4EF6\u6216\u6587\u4EF6\u5939",
    parameters: Zod.object({ fileToken: Zod.string() }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.drive.file.delete({ path: { file_token: params.fileToken } });
      if (r.code !== 0) throw wrapFeishuError(r, "\u5220\u9664\u6587\u4EF6\u5931\u8D25");
      return { success: true };
    }
  });
  registerTool(ctx, {
    name: "feishu_create_folder",
    description: "\u5728\u98DE\u4E66\u4E91\u76D8\u4E2D\u521B\u5EFA\u6587\u4EF6\u5939",
    parameters: Zod.object({
      folderName: Zod.string(),
      parentFolderToken: Zod.string().optional()
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.drive.file.createFolder({
        data: {
          name: params.folderName,
          folder_token: params.parentFolderToken ?? config.driveFolderToken
        }
      });
      if (r.code !== 0 || !r.data?.file_token) throw wrapFeishuError(r, "\u521B\u5EFA\u6587\u4EF6\u5939\u5931\u8D25");
      return { success: true, folderToken: r.data.file_token, folderName: params.folderName };
    }
  });
  registerTool(ctx, {
    name: "feishu_download_file",
    description: "\u5C06\u98DE\u4E66\u4E91\u76D8\u6587\u4EF6\u4E0B\u8F7D\u5230\u672C\u5730\u8DEF\u5F84",
    parameters: Zod.object({
      fileToken: Zod.string(),
      savePath: Zod.string()
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const savePath = params.savePath;
      if (!isPathAllowed(savePath)) throw new FeishuApiError(`\u4FDD\u5B58\u8DEF\u5F84\u4E0D\u5728\u5141\u8BB8\u8303\u56F4\u5185: ${savePath}`, "PATH_FORBIDDEN");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const metaR = await client.drive.file.get({ path: { file_token: params.fileToken } });
      if (metaR.code !== 0 || !metaR.data?.files?.length) throw wrapFeishuError(metaR, "\u83B7\u53D6\u6587\u4EF6\u4FE1\u606F\u5931\u8D25");
      const fileInfo = metaR.data.files[0];
      await rateLimiter.acquire();
      const dlResult = await client.drive.file.download({ path: { file_token: params.fileToken } });
      const downloadData = dlResult;
      if (downloadData?.writeFile) {
        await downloadData.writeFile(savePath);
      }
      return { success: true, savePath, fileName: fileInfo.name ?? "", size: fileInfo.size ?? 0 };
    }
  });
  registerTool(ctx, {
    name: "feishu_create_document",
    description: "\u521B\u5EFA\u65B0\u7684\u98DE\u4E66\u4E91\u6587\u6863",
    parameters: Zod.object({
      title: Zod.string(),
      folderToken: Zod.string().optional()
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.docx.document.create({
        data: {
          title: params.title,
          folder_token: params.folderToken ?? config.docxFolderToken
        }
      });
      if (r.code !== 0 || !r.data?.document) throw wrapFeishuError(r, "\u521B\u5EFA\u6587\u6863\u5931\u8D25");
      const doc = r.data.document;
      return {
        success: true,
        document_id: doc.document_id ?? "",
        title: doc.title ?? ""
      };
    }
  });
  registerTool(ctx, {
    name: "feishu_get_document",
    description: "\u83B7\u53D6\u98DE\u4E66\u4E91\u6587\u6863\u7684\u5143\u4FE1\u606F",
    parameters: Zod.object({ documentId: Zod.string() }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.docx.document.get({ path: { document_id: params.documentId } });
      if (r.code !== 0 || !r.data?.document) throw wrapFeishuError(r, "\u83B7\u53D6\u6587\u6863\u5931\u8D25");
      const doc = r.data.document;
      const result = {
        document_id: doc.document_id ?? "",
        title: doc.title ?? "",
        created_time: doc.created_time ?? "",
        updated_time: doc.updated_time ?? "",
        owner: doc.owner
      };
      return { document: result };
    }
  });
  registerTool(ctx, {
    name: "feishu_get_blocks",
    description: "\u83B7\u53D6\u4E91\u6587\u6863\u7684\u5757\u7ED3\u6784",
    parameters: Zod.object({
      documentId: Zod.string(),
      blockId: Zod.string().optional(),
      pageSize: Zod.number().min(1).max(500).default(500).optional(),
      pageToken: Zod.string().optional()
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.docx.block.list({
        path: { document_id: params.documentId, block_id: params.blockId ?? "0" },
        params: { page_size: Number(params.pageSize) || 500, page_token: params.pageToken }
      });
      if (r.code !== 0) throw wrapFeishuError(r, "\u83B7\u53D6\u5757\u5931\u8D25");
      const blocks = (r.data?.items ?? []).map((b) => ({
        block_id: b.block_id ?? "",
        block_type: b.block_type ?? 0
      }));
      return { blocks, hasMore: r.data?.has_more ?? false, pageToken: r.data?.page_token };
    }
  });
  registerTool(ctx, {
    name: "feishu_create_block",
    description: "\u5728\u4E91\u6587\u6863\u4E2D\u521B\u5EFA\u65B0\u7684\u5757",
    parameters: Zod.object({
      documentId: Zod.string(),
      blockId: Zod.string().optional(),
      blockType: Zod.number(),
      content: Zod.string().optional(),
      index: Zod.number().optional()
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const blockType = Number(params.blockType);
      const blockData = { block_type: blockType };
      if (params.content) {
        blockData.paragraph = { elements: [{ text_run: { content: params.content } }], style: {} };
      }
      const r = await client.docx.block.create({
        path: { document_id: params.documentId, block_id: params.blockId },
        data: { children: [blockData], index: params.index }
      });
      if (r.code !== 0 || !r.data?.blocks?.length) throw wrapFeishuError(r, "\u521B\u5EFA\u5757\u5931\u8D25");
      return { success: true, blockId: r.data.blocks[0].block_id ?? "" };
    }
  });
  registerTool(ctx, {
    name: "feishu_delete_block",
    description: "\u5220\u9664\u4E91\u6587\u6863\u4E2D\u7684\u5757",
    parameters: Zod.object({ documentId: Zod.string(), blockId: Zod.string() }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.docx.block.delete({
        path: { document_id: params.documentId, block_id: params.blockId }
      });
      if (r.code !== 0) throw wrapFeishuError(r, "\u5220\u9664\u5757\u5931\u8D25");
      return { success: true };
    }
  });
  registerTool(ctx, {
    name: "feishu_get_raw_content",
    description: "\u83B7\u53D6\u4E91\u6587\u6863\u7684\u7EAF\u6587\u672C\u5185\u5BB9",
    parameters: Zod.object({ documentId: Zod.string() }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.docx.rawContent.get({ path: { document_id: params.documentId } });
      if (r.code !== 0) throw wrapFeishuError(r, "\u83B7\u53D6\u6587\u6863\u5185\u5BB9\u5931\u8D25");
      return { content: r.data?.content ?? "" };
    }
  });
  registerTool(ctx, {
    name: "feishu_get_bitable",
    description: "\u83B7\u53D6\u591A\u7EF4\u8868\u683C\u7684\u5143\u4FE1\u606F",
    parameters: Zod.object({ appToken: Zod.string() }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.bitable.app.get({ path: { app_token: params.appToken } });
      if (r.code !== 0 || !r.data?.app) throw wrapFeishuError(r, "\u83B7\u53D6\u591A\u7EF4\u8868\u683C\u5931\u8D25");
      const app = {
        app_token: r.data.app.app_token ?? "",
        name: r.data.app.name ?? "",
        revision_id: r.data.app.revision_id
      };
      return { app };
    }
  });
  registerTool(ctx, {
    name: "feishu_list_tables",
    description: "\u5217\u51FA\u591A\u7EF4\u8868\u683C\u4E2D\u7684\u6240\u6709\u6570\u636E\u8868",
    parameters: Zod.object({ appToken: Zod.string() }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.bitable.table.list({ path: { app_token: params.appToken } });
      if (r.code !== 0) throw wrapFeishuError(r, "\u83B7\u53D6\u6570\u636E\u8868\u5217\u8868\u5931\u8D25");
      const tables = (r.data?.items ?? []).map((t) => ({
        table_id: t.table_id ?? "",
        name: t.name ?? "",
        default_view_id: t.default_view_id,
        created_time: t.created_time,
        updated_time: t.updated_time
      }));
      return { tables };
    }
  });
  registerTool(ctx, {
    name: "feishu_list_records",
    description: "\u5217\u51FA\u591A\u7EF4\u8868\u683C\u6570\u636E\u8868\u4E2D\u7684\u8BB0\u5F55",
    parameters: Zod.object({
      appToken: Zod.string(),
      tableId: Zod.string(),
      pageSize: Zod.number().min(1).max(500).default(100).optional(),
      pageToken: Zod.string().optional()
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.bitable.tableRecord.list({
        path: { app_token: params.appToken, table_id: params.tableId },
        params: { page_size: Number(params.pageSize) || 100, page_token: params.pageToken }
      });
      if (r.code !== 0) throw wrapFeishuError(r, "\u83B7\u53D6\u8BB0\u5F55\u5217\u8868\u5931\u8D25");
      const records = (r.data?.items ?? []).map((rec) => ({
        record_id: rec.record_id ?? "",
        fields: rec.fields ?? {},
        created_time: rec.created_time,
        updated_time: rec.updated_time
      }));
      return { records, hasMore: r.data?.has_more ?? false, pageToken: r.data?.page_token };
    }
  });
  registerTool(ctx, {
    name: "feishu_create_record",
    description: "\u5728\u591A\u7EF4\u8868\u683C\u6570\u636E\u8868\u4E2D\u63D2\u5165\u4E00\u6761\u65B0\u8BB0\u5F55",
    parameters: Zod.object({
      appToken: Zod.string(),
      tableId: Zod.string(),
      fields: Zod.record(Zod.string(), Zod.unknown())
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.bitable.tableRecord.create({
        path: { app_token: params.appToken, table_id: params.tableId },
        data: { fields: params.fields }
      });
      if (r.code !== 0 || !r.data?.record) throw wrapFeishuError(r, "\u521B\u5EFA\u8BB0\u5F55\u5931\u8D25");
      const rec = r.data.record;
      const record2 = {
        record_id: rec.record_id ?? "",
        fields: rec.fields ?? {},
        created_time: rec.created_time,
        updated_time: rec.updated_time
      };
      return { success: true, recordId: rec.record_id ?? "", record: record2 };
    }
  });
  registerTool(ctx, {
    name: "feishu_update_record",
    description: "\u66F4\u65B0\u591A\u7EF4\u8868\u683C\u6570\u636E\u8868\u4E2D\u7684\u4E00\u6761\u8BB0\u5F55",
    parameters: Zod.object({
      appToken: Zod.string(),
      tableId: Zod.string(),
      recordId: Zod.string(),
      fields: Zod.record(Zod.string(), Zod.unknown())
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.bitable.tableRecord.update({
        path: { app_token: params.appToken, table_id: params.tableId, record_id: params.recordId },
        data: { fields: params.fields }
      });
      if (r.code !== 0) throw wrapFeishuError(r, "\u66F4\u65B0\u8BB0\u5F55\u5931\u8D25");
      const rec = r.data?.record;
      if (!rec) return { success: false };
      const record2 = {
        record_id: rec.record_id ?? "",
        fields: rec.fields ?? {},
        created_time: rec.created_time,
        updated_time: rec.updated_time
      };
      return { success: true, record: record2 };
    }
  });
  registerTool(ctx, {
    name: "feishu_delete_record",
    description: "\u5220\u9664\u591A\u7EF4\u8868\u683C\u6570\u636E\u8868\u4E2D\u7684\u4E00\u6761\u8BB0\u5F55",
    parameters: Zod.object({
      appToken: Zod.string(),
      tableId: Zod.string(),
      recordId: Zod.string()
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx);
      if (!appSecret) throw new FeishuApiError("\u8BF7\u5148\u914D\u7F6E App Secret", "NO_SECRET");
      const pid = getProfileId(ctx);
      const client = sdk(getFeishuClient(pid, { appId: config.appId, appSecret }));
      await rateLimiter.acquire();
      const r = await client.bitable.tableRecord.delete({
        path: { app_token: params.appToken, table_id: params.tableId, record_id: params.recordId }
      });
      if (r.code !== 0) throw wrapFeishuError(r, "\u5220\u9664\u8BB0\u5F55\u5931\u8D25");
      return { success: true };
    }
  });
}
export {
  configSchema as Config,
  FEISHU_NS,
  apply
};
