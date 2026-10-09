/**
 * dsh-feishu 插件主入口
 * Phase 1: 完整实现 drive / docx / bitable host tools
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { getFeishuClient, resetClientForProfile } from './lib/client'
import { rateLimiter } from './lib/rateLimit'
import { wrapFeishuError, FeishuApiError, isPathError } from './lib/errors'
import { isPathAllowed, safeReadFile } from './lib/pathGuard'
import type {
  DriveFile,
  DocxDocument,
  DocxBlock,
  BitableApp,
  BitableTable,
  BitableRecord,
} from './lib/types'
import type {
  DriveFileListResponse,
  DriveFileItem,
  DriveUploadResponse,
  DriveMetaResponse,
  DocxDocumentResponse,
  DocxBlockListResponse,
  DocxBlockResponse,
  DocxCreateBlockResponse,
  DocxRawContentResponse,
  BitableAppResponse,
  BitableTableListResponse,
  BitableTableResponse,
  BitableRecordListResponse,
  BitableRecordResponse,
} from './lib/apiTypes'

import * as Zod from 'zod'

export const FEISHU_NS = settingsNamespace('dsh-feishu')

const configSchema = Zod.object({
  appId: Zod.string(),
  appSecret: Zod.string(),
  driveFolderToken: Zod.string().optional(),
  docxFolderToken: Zod.string().optional(),
  bitableFolderToken: Zod.string().optional(),
  uploadTimeout: Zod.number().min(5000).max(300000).default(60000),
  maxFileSize: Zod.number().min(1).max(20).default(20),
  locale: Zod.enum(['zh-CN', 'en']).default('zh-CN'),
})

export { configSchema as Config, apply }

// ============================================================================
// 凭证获取辅助
// ============================================================================

async function getAppSecret(ctx: Context): Promise<string> {
  try {
    const creds = ctx as Context & { credentials?: { get: (_k: string) => Promise<string> } }
    return (await creds.credentials?.get('dsh-feishu.appSecret')) ?? ''
  } catch {
    return ''
  }
}

function getProfileId(ctx: Context): string {
  return (ctx as Context & { profile?: { id: string } }).profile?.id ?? 'default'
}

// ============================================================================
// SDK 类型
// ============================================================================

type SDK = {
  drive: {
    file: {
      list(_opts: { params: { folder_token: string; page_size: number; page_token?: string } }): Promise<{ code?: number; data?: DriveFileListResponse }>
      uploadAll(_opts: { data: { file_name: string; parent_type: string; parent_node: string; size: string } }): Promise<{ code?: number; data?: DriveUploadResponse }>
      delete(_opts: { path: { file_token: string } }): Promise<{ code?: number }>
      createFolder(_opts: { data: { name: string; folder_token?: string } }): Promise<{ code?: number; data?: { file_token?: string } }>
      get(_opts: { path: { file_token: string } }): Promise<{ code?: number; data?: DriveMetaResponse }>
      download(_opts: { path: { file_token: string } }): Promise<unknown>
    }
  }
  docx: {
    document: {
      create(_opts: { data: { title: string; folder_token?: string } }): Promise<{ code?: number; data?: { document?: DocxDocumentResponse } }>
      get(_opts: { path: { document_id: string } }): Promise<{ code?: number; data?: { document?: DocxDocumentResponse } }>
    }
    block: {
      list(_opts: { path: { document_id: string; block_id: string }; params: { page_size: number; page_token?: string } }): Promise<{ code?: number; data?: DocxBlockListResponse }>
      create(_opts: { path: { document_id: string; block_id?: string }; data: { children: Record<string, unknown>[]; index?: number } }): Promise<{ code?: number; data?: DocxCreateBlockResponse }>
      delete(_opts: { path: { document_id: string; block_id: string } }): Promise<{ code?: number }>
    }
    rawContent: {
      get(_opts: { path: { document_id: string } }): Promise<{ code?: number; data?: DocxRawContentResponse }>
    }
  }
  bitable: {
    app: {
      get(_opts: { path: { app_token: string } }): Promise<{ code?: number; data?: { app?: BitableAppResponse } }>
    }
    table: {
      list(_opts: { path: { app_token: string } }): Promise<{ code?: number; data?: BitableTableListResponse }>
    }
    tableRecord: {
      list(_opts: { path: { app_token: string; table_id: string }; params: { page_size: number; page_token?: string } }): Promise<{ code?: number; data?: BitableRecordListResponse }>
      create(_opts: { path: { app_token: string; table_id: string }; data: { fields: Record<string, unknown> } }): Promise<{ code?: number; data?: { record?: BitableRecordResponse } }>
      update(_opts: { path: { app_token: string; table_id: string; record_id: string }; data: { fields: Record<string, unknown> } }): Promise<{ code?: number; data?: { record?: BitableRecordResponse } }>
      delete(_opts: { path: { app_token: string; table_id: string; record_id: string } }): Promise<{ code?: number }>
    }
  }
}

function sdk(client: unknown): SDK {
  return client as unknown as SDK
}

// ============================================================================
// 工具注册
// ============================================================================

function registerTool(
  ctx: Context,
  tool: {
    name: string
    description: string
     
    parameters: Zod.ZodType
    execute: (params: Record<string, unknown>, ctx: Context) => Promise<unknown>
  }
): void {
  ;(ctx.registry as any).global.set(`tool:${tool.name}`, {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: async (params: Record<string, unknown>) => tool.execute(params, ctx),
  })
}

// ============================================================================
// apply()
// ============================================================================

function apply(ctx: Context, config: Record<string, unknown>): void {
  installSettingsSection(ctx, FEISHU_NS, configSchema as any, config, {
    setSource: () => {},
    validate: () => {},
    onChange: () => { resetClientForProfile(getProfileId(ctx)) },
  })

  // =========================================================================
  // DRIVE 工具
  // =========================================================================

  // feishu_verify_connection
  registerTool(ctx, {
    name: 'feishu_verify_connection',
    description: '验证飞书应用连接状态',
    parameters: Zod.object({}),
    execute: async () => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.drive.file.list({
        params: { folder_token: '', page_size: 1 },
      })
      if (r.code !== 0) throw wrapFeishuError(r, '验证连接失败')
      return { success: true, message: '飞书应用连接正常' }
    },
  })

  // feishu_list_files
  registerTool(ctx, {
    name: 'feishu_list_files',
    description: '列出飞书云盘文件夹中的文件',
    parameters: Zod.object({
      folderToken: Zod.string().optional(),
      pageSize: Zod.number().min(1).max(200).default(50).optional(),
      pageToken: Zod.string().optional(),
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.drive.file.list({
        params: {
          folder_token: (params.folderToken as string | undefined) ?? (config.driveFolderToken as string | undefined) ?? '',
          page_size: Number(params.pageSize) || 50,
          page_token: params.pageToken as string | undefined,
        },
      })
      if (r.code !== 0) throw wrapFeishuError(r, '获取文件列表失败')
      const rawFiles = r.data?.files ?? []
      const files: DriveFile[] = rawFiles.map((f: DriveFileItem) => {
        const rf = f as { token?: string; file_token?: string; name?: string; size?: number; created_time?: string; updated_time?: string; type?: string; mime_type?: string }
        return {
          token: rf.token ?? rf.file_token ?? '',
          name: rf.name ?? '',
          size: rf.size ?? 0,
          createdTime: rf.created_time ?? '',
          updatedTime: rf.updated_time ?? '',
          type: (rf.type === 'folder' ? 'folder' : 'file') as 'file' | 'folder',
          mimeType: rf.mime_type,
        }
      })
      return { files, hasMore: r.data?.has_more ?? false, pageToken: r.data?.page_token }
    },
  })

  // feishu_upload_file
  registerTool(ctx, {
    name: 'feishu_upload_file',
    description: '上传本地文件到飞书云盘（最大 20MB）',
    parameters: Zod.object({
      localPath: Zod.string(),
      folderToken: Zod.string().optional(),
      fileName: Zod.string().optional(),
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const localPath = params.localPath as string
      if (!isPathAllowed(localPath)) throw new FeishuApiError(`路径不在允许范围内: ${localPath}`, 'PATH_FORBIDDEN')
      let buf: Buffer
      try {
        buf = safeReadFile(localPath)
      } catch (e) {
        if (isPathError(e)) throw new FeishuApiError(`无法读取文件: ${localPath}`, 'PATH_FORBIDDEN')
        throw e
      }
      const sz = buf.length
      const maxSize = (config.maxFileSize as number) ?? 20
      if (sz > maxSize * 1024 * 1024) throw new FeishuApiError(`文件超过 ${maxSize}MB 限制`, '230013')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      const parentFolder = (params.folderToken as string | undefined) ?? (config.driveFolderToken as string | undefined) ?? ''
      await rateLimiter.acquire()
      const r = await client.drive.file.uploadAll({
        data: {
          file_name: (params.fileName as string | undefined) ?? localPath.split(/[/\\]/).pop() ?? 'file',
          parent_type: 'explorer',
          parent_node: parentFolder,
          size: String(sz),
        },
      })
      if (r.code !== 0 || !r.data?.file_token) throw wrapFeishuError(r, '上传文件失败')
      return { success: true, fileToken: r.data.file_token, fileName: localPath.split(/[/\\]/).pop() ?? 'file', size: sz }
    },
  })

  // feishu_delete_file
  registerTool(ctx, {
    name: 'feishu_delete_file',
    description: '删除飞书云盘中的文件或文件夹',
    parameters: Zod.object({ fileToken: Zod.string() }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.drive.file.delete({ path: { file_token: params.fileToken as string } })
      if (r.code !== 0) throw wrapFeishuError(r, '删除文件失败')
      return { success: true }
    },
  })

  // feishu_create_folder
  registerTool(ctx, {
    name: 'feishu_create_folder',
    description: '在飞书云盘中创建文件夹',
    parameters: Zod.object({
      folderName: Zod.string(),
      parentFolderToken: Zod.string().optional(),
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.drive.file.createFolder({
        data: {
          name: params.folderName as string,
          folder_token: (params.parentFolderToken as string | undefined) ?? (config.driveFolderToken as string | undefined),
        },
      })
      if (r.code !== 0 || !r.data?.file_token) throw wrapFeishuError(r, '创建文件夹失败')
      return { success: true, folderToken: r.data.file_token, folderName: params.folderName as string }
    },
  })

  // feishu_download_file
  registerTool(ctx, {
    name: 'feishu_download_file',
    description: '将飞书云盘文件下载到本地路径',
    parameters: Zod.object({
      fileToken: Zod.string(),
      savePath: Zod.string(),
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const savePath = params.savePath as string
      if (!isPathAllowed(savePath)) throw new FeishuApiError(`保存路径不在允许范围内: ${savePath}`, 'PATH_FORBIDDEN')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const metaR = await client.drive.file.get({ path: { file_token: params.fileToken as string } })
      if (metaR.code !== 0 || !metaR.data?.files?.length) throw wrapFeishuError(metaR, '获取文件信息失败')
      const fileInfo = metaR.data.files![0]
      await rateLimiter.acquire()
      const dlResult = await client.drive.file.download({ path: { file_token: params.fileToken as string } })
      const downloadData = dlResult as { writeFile?: (_path: string) => Promise<string>; pipe?: (_ws: unknown) => void }
      if (downloadData?.writeFile) {
        await downloadData.writeFile(savePath)
      }
      return { success: true, savePath, fileName: fileInfo.name ?? '', size: fileInfo.size ?? 0 }
    },
  })

  // =========================================================================
  // DOCX 工具
  // =========================================================================

  // feishu_create_document
  registerTool(ctx, {
    name: 'feishu_create_document',
    description: '创建新的飞书云文档',
    parameters: Zod.object({
      title: Zod.string(),
      folderToken: Zod.string().optional(),
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.docx.document.create({
        data: {
          title: params.title as string,
          folder_token: (params.folderToken as string | undefined) ?? (config.docxFolderToken as string | undefined),
        },
      })
      if (r.code !== 0 || !r.data?.document) throw wrapFeishuError(r, '创建文档失败')
      const doc = r.data.document
      return {
        success: true,
        document_id: doc.document_id ?? '',
        title: doc.title ?? '',
      }
    },
  })

  // feishu_get_document
  registerTool(ctx, {
    name: 'feishu_get_document',
    description: '获取飞书云文档的元信息',
    parameters: Zod.object({ documentId: Zod.string() }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.docx.document.get({ path: { document_id: params.documentId as string } })
      if (r.code !== 0 || !r.data?.document) throw wrapFeishuError(r, '获取文档失败')
      const doc = r.data.document
      const result: DocxDocument = {
        document_id: doc.document_id ?? '',
        title: doc.title ?? '',
        created_time: doc.created_time ?? '',
        updated_time: doc.updated_time ?? '',
        owner: doc.owner,
      }
      return { document: result }
    },
  })

  // feishu_get_blocks
  registerTool(ctx, {
    name: 'feishu_get_blocks',
    description: '获取云文档的块结构',
    parameters: Zod.object({
      documentId: Zod.string(),
      blockId: Zod.string().optional(),
      pageSize: Zod.number().min(1).max(500).default(500).optional(),
      pageToken: Zod.string().optional(),
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.docx.block.list({
        path: { document_id: params.documentId as string, block_id: (params.blockId as string | undefined) ?? '0' },
        params: { page_size: Number(params.pageSize) || 500, page_token: params.pageToken as string | undefined },
      })
      if (r.code !== 0) throw wrapFeishuError(r, '获取块失败')
      const blocks: DocxBlock[] = (r.data?.items ?? []).map((b: DocxBlockResponse) => ({
        block_id: b.block_id ?? '',
        block_type: b.block_type ?? 0,
      }))
      return { blocks, hasMore: r.data?.has_more ?? false, pageToken: r.data?.page_token }
    },
  })

  // feishu_create_block
  registerTool(ctx, {
    name: 'feishu_create_block',
    description: '在云文档中创建新的块',
    parameters: Zod.object({
      documentId: Zod.string(),
      blockId: Zod.string().optional(),
      blockType: Zod.number(),
      content: Zod.string().optional(),
      index: Zod.number().optional(),
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const blockType = Number(params.blockType)
      const blockData: Record<string, unknown> = { block_type: blockType }
      if (params.content) {
        blockData.paragraph = { elements: [{ text_run: { content: params.content } }], style: {} }
      }
      const r = await client.docx.block.create({
        path: { document_id: params.documentId as string, block_id: params.blockId as string | undefined },
        data: { children: [blockData], index: params.index as number | undefined },
      })
      if (r.code !== 0 || !r.data?.blocks?.length) throw wrapFeishuError(r, '创建块失败')
      return { success: true, blockId: r.data.blocks[0].block_id ?? '' }
    },
  })

  // feishu_delete_block
  registerTool(ctx, {
    name: 'feishu_delete_block',
    description: '删除云文档中的块',
    parameters: Zod.object({ documentId: Zod.string(), blockId: Zod.string() }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.docx.block.delete({
        path: { document_id: params.documentId as string, block_id: params.blockId as string },
      })
      if (r.code !== 0) throw wrapFeishuError(r, '删除块失败')
      return { success: true }
    },
  })

  // feishu_get_raw_content
  registerTool(ctx, {
    name: 'feishu_get_raw_content',
    description: '获取云文档的纯文本内容',
    parameters: Zod.object({ documentId: Zod.string() }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.docx.rawContent.get({ path: { document_id: params.documentId as string } })
      if (r.code !== 0) throw wrapFeishuError(r, '获取文档内容失败')
      return { content: r.data?.content ?? '' }
    },
  })

  // =========================================================================
  // BITABLE 工具
  // =========================================================================

  // feishu_get_bitable
  registerTool(ctx, {
    name: 'feishu_get_bitable',
    description: '获取多维表格的元信息',
    parameters: Zod.object({ appToken: Zod.string() }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.bitable.app.get({ path: { app_token: params.appToken as string } })
      if (r.code !== 0 || !r.data?.app) throw wrapFeishuError(r, '获取多维表格失败')
      const app: BitableApp = {
        app_token: r.data.app.app_token ?? '',
        name: r.data.app.name ?? '',
        revision_id: r.data.app.revision_id,
      }
      return { app }
    },
  })

  // feishu_list_tables
  registerTool(ctx, {
    name: 'feishu_list_tables',
    description: '列出多维表格中的所有数据表',
    parameters: Zod.object({ appToken: Zod.string() }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.bitable.table.list({ path: { app_token: params.appToken as string } })
      if (r.code !== 0) throw wrapFeishuError(r, '获取数据表列表失败')
      const tables: BitableTable[] = (r.data?.items ?? []).map((t: BitableTableResponse) => ({
        table_id: t.table_id ?? '',
        name: t.name ?? '',
        default_view_id: t.default_view_id,
        created_time: t.created_time,
        updated_time: t.updated_time,
      }))
      return { tables }
    },
  })

  // feishu_list_records
  registerTool(ctx, {
    name: 'feishu_list_records',
    description: '列出多维表格数据表中的记录',
    parameters: Zod.object({
      appToken: Zod.string(),
      tableId: Zod.string(),
      pageSize: Zod.number().min(1).max(500).default(100).optional(),
      pageToken: Zod.string().optional(),
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.bitable.tableRecord.list({
        path: { app_token: params.appToken as string, table_id: params.tableId as string },
        params: { page_size: Number(params.pageSize) || 100, page_token: params.pageToken as string | undefined },
      })
      if (r.code !== 0) throw wrapFeishuError(r, '获取记录列表失败')
      const records: BitableRecord[] = (r.data?.items ?? []).map((rec: BitableRecordResponse) => ({
        record_id: rec.record_id ?? '',
        fields: rec.fields ?? {},
        created_time: rec.created_time,
        updated_time: rec.updated_time,
      }))
      return { records, hasMore: r.data?.has_more ?? false, pageToken: r.data?.page_token }
    },
  })

  // feishu_create_record
  registerTool(ctx, {
    name: 'feishu_create_record',
    description: '在多维表格数据表中插入一条新记录',
    parameters: Zod.object({
      appToken: Zod.string(),
      tableId: Zod.string(),
      fields: Zod.record(Zod.string(), Zod.unknown()),
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.bitable.tableRecord.create({
        path: { app_token: params.appToken as string, table_id: params.tableId as string },
        data: { fields: params.fields as Record<string, unknown> },
      })
      if (r.code !== 0 || !r.data?.record) throw wrapFeishuError(r, '创建记录失败')
      const rec = r.data.record
      const record: BitableRecord = {
        record_id: rec.record_id ?? '',
        fields: rec.fields ?? {},
        created_time: rec.created_time,
        updated_time: rec.updated_time,
      }
      return { success: true, recordId: rec.record_id ?? '', record }
    },
  })

  // feishu_update_record
  registerTool(ctx, {
    name: 'feishu_update_record',
    description: '更新多维表格数据表中的一条记录',
    parameters: Zod.object({
      appToken: Zod.string(),
      tableId: Zod.string(),
      recordId: Zod.string(),
      fields: Zod.record(Zod.string(), Zod.unknown()),
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.bitable.tableRecord.update({
        path: { app_token: params.appToken as string, table_id: params.tableId as string, record_id: params.recordId as string },
        data: { fields: params.fields as Record<string, unknown> },
      })
      if (r.code !== 0) throw wrapFeishuError(r, '更新记录失败')
      const rec = r.data?.record
      if (!rec) return { success: false }
      const record: BitableRecord = {
        record_id: rec.record_id ?? '',
        fields: rec.fields ?? {},
        created_time: rec.created_time,
        updated_time: rec.updated_time,
      }
      return { success: true, record }
    },
  })

  // feishu_delete_record
  registerTool(ctx, {
    name: 'feishu_delete_record',
    description: '删除多维表格数据表中的一条记录',
    parameters: Zod.object({
      appToken: Zod.string(),
      tableId: Zod.string(),
      recordId: Zod.string(),
    }),
    execute: async (params) => {
      const appSecret = await getAppSecret(ctx)
      if (!appSecret) throw new FeishuApiError('请先配置 App Secret', 'NO_SECRET')
      const pid = getProfileId(ctx)
      const client = sdk(getFeishuClient(pid, { appId: config.appId as string, appSecret }))
      await rateLimiter.acquire()
      const r = await client.bitable.tableRecord.delete({
        path: { app_token: params.appToken as string, table_id: params.tableId as string, record_id: params.recordId as string },
      })
      if (r.code !== 0) throw wrapFeishuError(r, '删除记录失败')
      return { success: true }
    },
  })
}
