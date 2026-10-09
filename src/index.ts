/**
 * dsh-feishu 插件主入口
 *
 * ⚠️ P0 修复要点：
 * - P0-1：appSecret 不作为工具参数，从 ctx.credentials 运行时读取
 * - P0-2：Client 按 profileId 隔离（Map<profileId, Client>）
 * - P0-4：tools execute 闭包不捕获 config，每次动态读取
 * - P0-6：所有 API 调用经 rateLimiter 限流
 */

import type { Context } from '@deepseek-ai/cordis'
import { Schema } from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { getFeishuClient, resetClientForProfile, isValidAppId } from './lib/client'
import { rateLimiter } from './lib/rateLimiter'
import { wrapFeishuError, FeishuApiError, isPathError } from './lib/errors'
import type {
  FeishuConfig,
  VerifyConnectionResult,
  UploadResult,
  DownloadResult,
  ListFilesResult,
  DeleteResult,
  DriveFile,
} from './lib/types'

export const FEISHU_NS = settingsNamespace('dsh-feishu')

// ============================================================================
// Config Schema（role('secret') 保护 appSecret）
// ============================================================================

export const Config = Schema.object<FeishuConfig>({
  appId:     Schema.string(),
  appSecret: Schema.string().role('secret'),  // ⚠️ 不序列化进日志/配置转储
  driveFolderToken:  Schema.string().optional(),
  docxFolderToken:   Schema.string().optional(),
  bitableFolderToken: Schema.string().optional(),
  uploadTimeout: Schema.number().min(5000).max(300000).default(60000),
  maxFileSize:  Schema.number().min(1).max(20).default(20),
  locale:      Schema.enum(['zh-CN', 'en']).default('zh-CN'),
})

// ============================================================================
// Host Tools 注册
// ============================================================================

export function apply(ctx: Context, config: FeishuConfig) {

  // 安装 Settings Card UI
  installSettingsSection(ctx, FEISHU_NS, Config, config, {
    validate: async (value) => {
      // ⚠️ P0-4：validate 错误信息不涉及 appSecret
      if (value.appId && !isValidAppId(value.appId)) {
        throw new Error('App ID 必须以 cli_ 开头，请在飞书开放平台查看')
      }
    },
    setSource: (current) => current,
    onChange: (profileId) => {
      // ⚠️ P0-2：凭证变更后重置对应 Profile 的 Client
      resetClientForProfile(profileId)
    },
  })

  // -------------------------------------------------------------------------
  // Tool: feishu_verify_connection（验证连接）
  // ⚠️ P0-1：入参只有 appId，appSecret 从 credentials 运行时读取
  // -------------------------------------------------------------------------
  ctx.tools.register(
    {
      name: 'feishu_verify_connection',
      description: '验证飞书应用连接是否可用，获取云盘容量信息',
      parameters: Schema.object({
        appId: Schema.string(),  // ← 只传 appId，不传 appSecret
      }),
      execute: async ({ appId }): Promise<VerifyConnectionResult> => {
        const appSecret = await (ctx as Context & { credentials: { get: (k: string) => Promise<string> } })
          .credentials.get('dsh-feishu.appSecret')
        if (!appSecret) {
          return { success: false, message: '请先在设置页填写 App Secret' }
        }

        const profileId = (ctx as Context & { profile: { id: string } }).profile.id
        const client = getFeishuClient(profileId, { appId, appSecret })

        try {
          await rateLimiter.acquire()
          const resp = await client.request({
            method: 'GET',
            url: '/drive/v1/files',
            params: { page_size: 1 },
          }) as { code: number; data?: { files: unknown[] } }

          if (resp.code !== 0) {
            return { success: false, message: `连接失败，错误码：${resp.code}` }
          }

          return {
            success: true,
            message: '连接成功',
            userName: appId,
          }
        } catch (e) {
          const fe = wrapFeishuError(e, '连接验证失败')
          return { success: false, message: fe.message }
        }
      },
    },
    { namespace: 'feishu' }
  )

  // -------------------------------------------------------------------------
  // Tool: feishu_upload_file（上传文件）
  // ⚠️ P0-5：localPath 必须通过 pathGuard 白名单验证
  // -------------------------------------------------------------------------
  ctx.tools.register(
    {
      name: 'feishu_upload_file',
      description: '上传本地文件到飞书云盘（≤20MB）',
      parameters: Schema.object({
        localPath: Schema.string(),   // ← 受 pathGuard 白名单保护
        folderToken: Schema.string().optional(),
      }),
      execute: async ({ localPath, folderToken }): Promise<UploadResult> => {
        const profileId = (ctx as Context & { profile: { id: string } }).profile.id
        const appSecret = await (ctx as Context & { credentials: { get: (k: string) => Promise<string> } })
          .credentials.get('dsh-feishu.appSecret')
        const freshConfig = await (ctx as Context & { settings: { get: (k: string) => Promise<FeishuConfig> } })
          .settings.get('dsh-feishu')

        const { safeReadFile } = await import('./lib/pathGuard')
        const fileBuffer = safeReadFile(localPath)
        const fileSize = fileBuffer.length

        if (fileSize > (freshConfig.maxFileSize ?? 20) * 1024 * 1024) {
          throw new FeishuApiError(
            `文件超过 ${freshConfig.maxFileSize ?? 20}MB 限制，请压缩后重试`,
            '230013'
          )
        }

        const client = getFeishuClient(profileId, { appId: freshConfig.appId, appSecret })
        await rateLimiter.acquire()

        const resp = await client.request({
          method: 'POST',
          url: '/drive/v1/upload_all',
          data: {
            file_name: localPath.split(/[/\\]/).pop() ?? 'file',
            parent_type: 'explorer',
            parent_node: folderToken ?? '',
            size: String(fileSize),
          },
          headers: { 'Content-Type': 'multipart/form-data' },
        }) as { code: number; data?: { file_token?: string } }

        if (resp.code !== 0 || !resp.data?.file_token) {
          const fe = wrapFeishuError(resp, '上传失败')
          throw fe
        }

        return {
          success: true,
          fileToken: resp.data.file_token,
          fileName: localPath.split(/[/\\]/).pop() ?? 'file',
          size: fileSize,
        }
      },
    },
    { namespace: 'feishu' }
  )

  // -------------------------------------------------------------------------
  // Tool: feishu_list_files（列出文件）
  // -------------------------------------------------------------------------
  ctx.tools.register(
    {
      name: 'feishu_list_files',
      description: '列出飞书云盘文件',
      parameters: Schema.object({
        folderToken: Schema.string().optional(),
        pageSize: Schema.number().default(50),
        pageToken: Schema.string().optional(),
      }),
      execute: async ({ folderToken, pageSize = 50, pageToken }): Promise<ListFilesResult> => {
        const profileId = (ctx as Context & { profile: { id: string } }).profile.id
        const appSecret = await (ctx as Context & { credentials: { get: (k: string) => Promise<string> } })
          .credentials.get('dsh-feishu.appSecret')
        const freshConfig = await (ctx as Context & { settings: { get: (k: string) => Promise<FeishuConfig> } })
          .settings.get('dsh-feishu')

        const client = getFeishuClient(profileId, { appId: freshConfig.appId, appSecret })
        await rateLimiter.acquire()

        const resp = await client.request({
          method: 'GET',
          url: '/drive/v1/files',
          params: {
            folder_token: folderToken ?? '',
            page_size: String(pageSize),
            ...(pageToken ? { page_token: pageToken } : {}),
          },
        }) as {
          code: number
          data?: {
            files?: Array<{
              token: string; name: string; size: number
              created_time: string; updated_time: string; type: string
            }>
            has_more?: boolean
            page_token?: string
          }
        }

        if (resp.code !== 0) {
          const fe = wrapFeishuError(resp, '列出文件失败')
          throw fe
        }

        const files: DriveFile[] = (resp.data?.files ?? []).map((f) => ({
          fileToken: f.token,
          name: f.name,
          size: f.size,
          createdAt: f.created_time,
          updatedAt: f.updated_time,
          type: f.type as 'file' | 'folder',
        }))

        return {
          files,
          hasMore: resp.data?.has_more ?? false,
          pageToken: resp.data?.page_token,
        }
      },
    },
    { namespace: 'feishu' }
  )

  // -------------------------------------------------------------------------
  // Tool: feishu_download_file（下载文件）
  // ⚠️ P0-5：savePath 白名单验证
  // -------------------------------------------------------------------------
  ctx.tools.register(
    {
      name: 'feishu_download_file',
      description: '从飞书云盘下载文件到本地',
      parameters: Schema.object({
        fileToken: Schema.string(),
        savePath: Schema.string(),  // ← 受 pathGuard 白名单保护
      }),
      execute: async ({ fileToken, savePath }): Promise<DownloadResult> => {
        const profileId = (ctx as Context & { profile: { id: string } }).profile.id
        const appSecret = await (ctx as Context & { credentials: { get: (k: string) => Promise<string> } })
          .credentials.get('dsh-feishu.appSecret')
        const freshConfig = await (ctx as Context & { settings: { get: (k: string) => Promise<FeishuConfig> } })
          .settings.get('dsh-feishu')

        const { safeWriteFile } = await import('./lib/pathGuard')

        const client = getFeishuClient(profileId, { appId: freshConfig.appId, appSecret })
        await rateLimiter.acquire()

        const resp = await client.request({
          method: 'GET',
          url: `/drive/v1/files/${fileToken}/download`,
          responseType: 'arraybuffer',
        }) as ArrayBuffer

        const buffer = Buffer.from(resp)
        safeWriteFile(savePath, buffer)

        return { success: true, path: savePath, size: buffer.length }
      },
    },
    { namespace: 'feishu' }
  )

  // -------------------------------------------------------------------------
  // Tool: feishu_delete_file（删除文件）
  // -------------------------------------------------------------------------
  ctx.tools.register(
    {
      name: 'feishu_delete_file',
      description: '删除飞书云盘文件',
      parameters: Schema.object({
        fileToken: Schema.string(),
      }),
      execute: async ({ fileToken }): Promise<DeleteResult> => {
        const profileId = (ctx as Context & { profile: { id: string } }).profile.id
        const appSecret = await (ctx as Context & { credentials: { get: (k: string) => Promise<string> } })
          .credentials.get('dsh-feishu.appSecret')
        const freshConfig = await (ctx as Context & { settings: { get: (k: string) => Promise<FeishuConfig> } })
          .settings.get('dsh-feishu')

        const client = getFeishuClient(profileId, { appId: freshConfig.appId, appSecret })
        await rateLimiter.acquire()

        const resp = await client.request({
          method: 'DELETE',
          url: `/drive/v1/files/${fileToken}`,
        }) as { code: number }

        if (resp.code !== 0) {
          const fe = wrapFeishuError(resp, '删除失败')
          throw fe
        }

        return { success: true }
      },
    },
    { namespace: 'feishu' }
  )

  // -------------------------------------------------------------------------
  // Tool: feishu_hello（测试用 dummy）
  // -------------------------------------------------------------------------
  ctx.tools.register(
    {
      name: 'feishu_hello',
      description: '测试飞书插件是否正常加载',
      parameters: Schema.object({}),
      execute: async () => {
        const freshConfig = await (ctx as Context & { settings: { get: (k: string) => Promise<FeishuConfig> } })
          .settings.get('dsh-feishu')
        return {
          message: 'dsh-feishu 插件已正常加载！',
          appId: freshConfig.appId ?? '(未配置)',
        }
      },
    },
    { namespace: 'feishu' }
  )
}
