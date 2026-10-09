// dsh-feishu API 类型别名
//
// 避免在 as 断言中写复杂泛型（esbuild 解析问题）
// 所有飞书 SDK 调用统一用 unknown + 类型守卫模式

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// 通用
// ============================================================================

/** 飞书 API 通用响应结构 */
export interface FeishuResponse<T = any> {
  code?: number
  msg?: string
  data?: T
}

// ============================================================================
// Drive
// ============================================================================

export interface DriveFileItem {
  token?: string
  file_token?: string
  name?: string
  size?: number
  created_time?: string
  updated_time?: string
  type?: string
  mime_type?: string
}

export interface DriveFileListResponse {
  files?: DriveFileItem[]
  has_more?: boolean
  page_token?: string
}

export interface DriveQuotaResponse {
  total?: number
  used?: number
}

export interface DriveUploadResponse {
  file_token?: string
  file_size?: string
}

export interface DriveMetaResponse {
  files?: DriveFileItem[]
}

// ============================================================================
// Docx
// ============================================================================

export interface DocxDocumentResponse {
  document_id?: string
  title?: string
  created_time?: string
  updated_time?: string
  owner?: string
}

export interface DocxBlockResponse {
  block_id?: string
  parent_id?: string
  children?: string[]
  block_type?: number
  block_type_str?: string
  data?: Record<string, unknown>
}

export interface DocxBlockListResponse {
  items?: DocxBlockResponse[]
  has_more?: boolean
  page_token?: string
}

export interface DocxCreateBlockResponse {
  blocks?: DocxBlockResponse[]
}

export interface DocxRawContentResponse {
  content?: string
}

// ============================================================================
// Bitable
// ============================================================================

export interface BitableAppResponse {
  app_token?: string
  name?: string
  revision_id?: string
}

export interface BitableTableResponse {
  table_id?: string
  name?: string
  default_view_id?: string
  created_time?: string
  updated_time?: string
}

export interface BitableTableListResponse {
  items?: BitableTableResponse[]
}

export interface BitableRecordResponse {
  record_id?: string
  fields?: Record<string, unknown>
  created_time?: string
  updated_time?: string
}

export interface BitableRecordListResponse {
  items?: BitableRecordResponse[]
  has_more?: boolean
  page_token?: string
}