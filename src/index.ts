/**
 * dsh-feishu 插件主入口
 * Phase 0 骨架：可编译，tools 通过 cordis registry 全局对象注册
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { getFeishuClient, resetClientForProfile, isValidAppId } from './lib/client'
import { rateLimiter } from './lib/rateLimit'
import { wrapFeishuError, FeishuApiError } from './lib/errors'
import type { FeishuConfig } from './lib/types'

export const FEISHU_NS = settingsNamespace('dsh-feishu')

export const Config = z.object({
  appId:             z.string(),
  appSecret:         z.string().role('secret'),
  driveFolderToken:  z.string().optional(),
  docxFolderToken:   z.string().optional(),
  bitableFolderToken: z.string().optional(),
  uploadTimeout:     z.number().min(5000).max(300000).default(60000),
  maxFileSize:       z.number().min(1).max(20).default(20),
  locale:            z.enum(['zh-CN', 'en']).default('zh-CN'),
})

export function apply(ctx: Context, config: Record<string, unknown>) {
  installSettingsSection(ctx, FEISHU_NS, Config, config, {
    setSource: () => {},
    validate: (value) => {
      if (value.appId && !isValidAppId(value.appId)) throw new Error('App ID must start with cli_')
    },
    onChange: () => {
      const pid = (ctx as Context & { profile?: { id: string } }).profile?.id ?? 'default'
      resetClientForProfile(pid)
    },
  })

  ctx.registry.global.set('tool:feishu_hello', {
    name: 'feishu_hello',
    description: 'Test if dsh-feishu is loaded',
    parameters: z.object({}),
    execute: async () => ({ message: 'dsh-feishu loaded!', appId: config.appId ?? '(not configured)' }),
  })

  ctx.registry.global.set('tool:feishu_verify_connection', {
    name: 'feishu_verify_connection',
    description: 'Verify Feishu app connection',
    parameters: z.object({ appId: z.string() }),
    execute: async ({ appId }: { appId: string }) => {
      const creds = (ctx as Context & { credentials?: { get: (k: string) => Promise<string> } })
      const appSecret = await creds.credentials?.get('dsh-feishu.appSecret') ?? ''
      if (!appSecret) return { success: false, message: 'Configure App Secret in settings' }
      const pid = (ctx as Context & { profile?: { id: string } }).profile?.id ?? 'default'
      const client = getFeishuClient(pid, { appId, appSecret })
      try {
        await rateLimiter.acquire()
        const r = await (client as Record<string, unknown>).request?.({
          method: 'GET', url: '/drive/v1/files', params: { page_size: 1 },
        }) as { code: number }
        if (r?.code !== 0) return { success: false, message: `Failed, code: ${r?.code}` }
        return { success: true, message: 'Connection successful', userName: appId }
      } catch (e) {
        return { success: false, message: wrapFeishuError(e, 'Connection failed').message }
      }
    },
  })

  ctx.registry.global.set('tool:feishu_list_files', {
    name: 'feishu_list_files',
    description: 'List files in Feishu cloud drive',
    parameters: z.object({
      folderToken: z.string().optional(),
      pageSize: z.number().default(50),
      pageToken: z.string().optional(),
    }),
    execute: async ({ folderToken, pageSize = 50, pageToken }: Record<string, unknown>) => {
      const creds = (ctx as Context & { credentials?: { get: (k: string) => Promise<string> } })
      const appSecret = await creds.credentials?.get('dsh-feishu.appSecret') ?? ''
      const pid = (ctx as Context & { profile?: { id: string } }).profile?.id ?? 'default'
      const client = getFeishuClient(pid, { appId: config.appId ?? '', appSecret })
      await rateLimiter.acquire()
      const r = await (client as Record<string, unknown>).request?.({
        method: 'GET', url: '/drive/v1/files',
        params: { folder_token: folderToken ?? '', page_size: String(pageSize), ...(pageToken ? { page_token: pageToken } : {}) },
      }) as { code: number; data?: { files?: unknown[]; has_more?: boolean; page_token?: string } }
      if (r?.code !== 0) throw wrapFeishuError(r, 'Failed to list files')
      return { files: r?.data?.files ?? [], hasMore: r?.data?.has_more ?? false, pageToken: r?.data?.page_token }
    },
  })

  ctx.registry.global.set('tool:feishu_upload_file', {
    name: 'feishu_upload_file',
    description: 'Upload file to Feishu cloud drive (max 20MB)',
    parameters: z.object({ localPath: z.string(), folderToken: z.string().optional() }),
    execute: async ({ localPath, folderToken }: Record<string, unknown>) => {
      const creds = (ctx as Context & { credentials?: { get: (k: string) => Promise<string> } })
      const appSecret = await creds.credentials?.get('dsh-feishu.appSecret') ?? ''
      const pid = (ctx as Context & { profile?: { id: string } }).profile?.id ?? 'default'
      const client = getFeishuClient(pid, { appId: config.appId ?? '', appSecret })
      const { safeReadFile } = await import('./lib/pathGuard')
      const buf = safeReadFile(localPath as string)
      const sz = buf.length
      if (sz > (config.maxFileSize ?? 20) * 1024 * 1024) throw new FeishuApiError(`File exceeds ${config.maxFileSize ?? 20}MB`, '230013')
      await rateLimiter.acquire()
      const r = await (client as Record<string, unknown>).request?.({
        method: 'POST', url: '/drive/v1/upload_all',
        data: { file_name: (localPath as string).split(/[/\\]/).pop() ?? 'file', parent_type: 'explorer', parent_node: folderToken ?? '', size: String(sz) },
      }) as { code: number; data?: { file_token?: string } }
      if (r?.code !== 0 || !r?.data?.file_token) throw wrapFeishuError(r, 'Upload failed')
      return { success: true, fileToken: r.data.file_token, fileName: (localPath as string).split(/[/\\]/).pop() ?? 'file', size: sz }
    },
  })

  ctx.registry.global.set('tool:feishu_delete_file', {
    name: 'feishu_delete_file',
    description: 'Delete file from Feishu cloud drive',
    parameters: z.object({ fileToken: z.string() }),
    execute: async ({ fileToken }: { fileToken: string }) => {
      const creds = (ctx as Context & { credentials?: { get: (k: string) => Promise<string> } })
      const appSecret = await creds.credentials?.get('dsh-feishu.appSecret') ?? ''
      const pid = (ctx as Context & { profile?: { id: string } }).profile?.id ?? 'default'
      const client = getFeishuClient(pid, { appId: config.appId ?? '', appSecret })
      await rateLimiter.acquire()
      const r = await (client as Record<string, unknown>).request?.({
        method: 'DELETE', url: `/drive/v1/files/${fileToken}`,
      }) as { code: number }
      if (r?.code !== 0) throw wrapFeishuError(r, 'Delete failed')
      return { success: true }
    },
  })
}
