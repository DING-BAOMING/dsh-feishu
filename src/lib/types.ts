/**
 * dsh-feishu 共享类型定义
 */

// ============================================================================
// 配置类型
// ============================================================================

export interface FeishuConfig {
  appId: string
  appSecret: string   // role('secret') — 通过 ctx.credentials.get() 获取
  driveFolderToken?: string
  docxFolderToken?: string
  bitableFolderToken?: string
  uploadTimeout?: number   // ms，默认 60000
  maxFileSize?: number     // MB，默认 20
  locale?: 'zh-CN' | 'en'
}

// ============================================================================
// 云盘类型
// ============================================================================

export interface DriveFile {
  fileToken: string
  name: string
  size: number        // bytes
  createdAt: string
  updatedAt: string
  type: 'file' | 'folder'
}

export interface DriveQuota {
  used: number   // bytes
  total: number  // bytes
}

export interface UploadResult {
  success: boolean
  fileToken: string
  fileName: string
  size: number
}

export interface DownloadResult {
  success: boolean
  path: string
  size: number
}

export interface ListFilesResult {
  files: DriveFile[]
  hasMore: boolean
  pageToken?: string
}

// ============================================================================
// 云文档类型
// ============================================================================

export interface DocxDocument {
  documentId: string
  title: string
  updatedAt: string
}

export interface DocxBlock {
  blockId: string
  blockType: number
  content?: string
  children?: DocxBlock[]
}

export interface WriteBlockResult {
  success: boolean
  blockId: string
}

// ============================================================================
// 多维表格类型
// ============================================================================

export interface BitableApp {
  appToken: string
  name: string
}

export interface BitableField {
  fieldId: string
  name: string
  type: number
}

export interface BitableTable {
  tableId: string
  name: string
  fields: BitableField[]
}

export interface BitableRecord {
  recordId: string
  fields: Record<string, unknown>
}

export interface InsertRecordResult {
  success: boolean
  recordId: string
}

// ============================================================================
// 工具结果类型
// ============================================================================

export interface VerifyConnectionResult {
  success: boolean
  message: string
  quota?: DriveQuota
  userName?: string
}

export interface DeleteResult {
  success: boolean
}

// ============================================================================
// 错误类型
// ============================================================================

export class FeishuApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'FeishuApiError'
  }
}
