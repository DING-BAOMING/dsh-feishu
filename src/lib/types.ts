/**
 * dsh-feishu 共享类型定义
 */

// ============================================================================
// 配置类型
// ============================================================================

export interface FeishuConfig {
  appId: string
  appSecret: string
  driveFolderToken?: string
  docxFolderToken?: string
  bitableFolderToken?: string
  uploadTimeout?: number
  maxFileSize?: number
  locale?: 'zh-CN' | 'en'
}

// ============================================================================
// 云盘类型
// ============================================================================

export interface DriveFile {
  token: string
  name: string
  size: number
  createdTime: string
  updatedTime: string
  type: 'file' | 'folder'
  mimeType?: string
}

export interface DriveQuota {
  used: number
  total: number
}

export interface UploadAllResponse {
  file_token: string
  file_size: number
}

export interface FileMetadata {
  token: string
  name: string
  size: number
  created_time: string
  updated_time: string
  type: string
}

// ============================================================================
// 云文档类型
// ============================================================================

export interface DocxDocument {
  document_id: string
  title: string
  created_time: string
  updated_time: string
  owner?: string
}

export interface DocxBlock {
  block_id: string
  parent_id?: string
  children?: string[]
  block_type: number
  block_type_str?: string
  data?: Record<string, unknown>
}

export interface DocxRawContent {
  content: string
}

// ============================================================================
// 多维表格类型
// ============================================================================

export interface BitableApp {
  app_token: string
  name: string
  revision_id?: string
}

export interface BitableTable {
  table_id: string
  name: string
  default_view_id?: string
  created_time?: string
  updated_time?: string
}

export interface BitableField {
  field_id: string
  field_name: string
  type: number
  ui_hint?: {
    options?: Array<{ name: string; color: number }>
  }
}

export interface BitableRecord {
  fields: Record<string, unknown>
  record_id: string
  created_time?: string
  updated_time?: string
}